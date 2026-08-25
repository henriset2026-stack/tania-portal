// ============================================================
// TANIA Avatar — Supabase Edge Function: tania-assistant
// Deploy : supabase functions deploy tania-assistant
// Secret : supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Security model:
// - The Anthropic API key lives ONLY here (never in the browser).
// - Every DB tool runs with the CALLER's JWT, so PostgreSQL RLS
//   applies: the bot can never reveal data the user cannot read.
//   (e.g. a `talent` asking about budget gets zero rows — by design.)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "claude-haiku-4-5-20251001"; // cheapest capable model
const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY_MESSAGES = 12;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // ganti dengan domain Netlify Anda di produksi
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- Tool definitions (Claude tool use) ----------
const tools = [
  {
    name: "get_my_profile",
    description:
      "Profil user yang sedang bertanya: nama, role, squad, grade, dan daftar kompetensinya.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_my_timesheet_week",
    description:
      "Timesheet milik user pada rentang tanggal tertentu, termasuk status (draft/submitted/approved/rejected).",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_utilization",
    description:
      "Utilisasi bulanan (jam approved vs kapasitas) dari view utilization_monthly. Bisa difilter per squad. Hasil mengikuti hak akses user.",
    input_schema: {
      type: "object",
      properties: {
        period_month: {
          type: "string",
          description: "Bulan dalam format YYYY-MM-01",
        },
        squad: { type: "string", description: "Nama squad (opsional)" },
      },
      required: ["period_month"],
    },
  },
  {
    name: "search_talent_by_skill",
    description:
      "Cari talent chapter berdasarkan nama skill (partial match), mengembalikan nama, squad, level skill, dan sertifikasi.",
    input_schema: {
      type: "object",
      properties: {
        skill_name: { type: "string" },
        min_level: { type: "integer", description: "1-5, default 1" },
      },
      required: ["skill_name"],
    },
  },
  {
    name: "get_feasibility_pipeline",
    description:
      "Daftar feasibility case beserta skor total dan status keputusan (go/no_go/hold/belum diputuskan).",
    input_schema: {
      type: "object",
      properties: {
        undecided_only: { type: "boolean", description: "Default false" },
      },
      required: [],
    },
  },
  {
    name: "get_budget_summary",
    description:
      "Ringkasan anggaran per program/kategori: plan vs committed vs realized vs remaining, dari view budget_summary. User tanpa hak akses budget akan mendapat hasil kosong.",
    input_schema: {
      type: "object",
      properties: {
        fiscal_year: { type: "integer", description: "Contoh: 2026" },
      },
      required: [],
    },
  },
];

// ---------- Tool executors (all via caller's RLS) ----------
// deno-lint-ignore no-explicit-any
async function runTool(sb: any, name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "get_my_profile": {
        const { data: auth } = await sb.auth.getUser();
        const uid = auth?.user?.id;
        const { data: profile, error } = await sb
          .from("profiles")
          .select("full_name, role, squad, grade, location")
          .eq("id", uid)
          .single();
        if (error) throw error;
        const { data: skills } = await sb
          .from("profile_skills")
          .select("level, is_certified, skills(name)")
          .eq("profile_id", uid);
        return JSON.stringify({ profile, skills: skills ?? [] });
      }
      case "get_my_timesheet_week": {
        const { data: auth } = await sb.auth.getUser();
        const { data, error } = await sb
          .from("timesheets")
          .select(
            "work_date, hours, status, approval_note, projects(code, name), activities(name)",
          )
          .eq("profile_id", auth?.user?.id)
          .gte("work_date", input.start_date)
          .lte("work_date", input.end_date)
          .order("work_date");
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "get_utilization": {
        let q = sb
          .from("utilization_monthly")
          .select("*")
          .eq("period_month", input.period_month)
          .limit(100);
        if (input.squad) q = q.eq("squad", input.squad);
        const { data, error } = await q;
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "search_talent_by_skill": {
        const { data, error } = await sb
          .from("profile_skills")
          .select("level, is_certified, profiles(full_name, squad, role), skills!inner(name)")
          .ilike("skills.name", `%${input.skill_name}%`)
          .gte("level", input.min_level ?? 1)
          .limit(50);
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "get_feasibility_pipeline": {
        let q = sb
          .from("feasibility_cases")
          .select("title, customer, total_score, decision, decided_at, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (input.undecided_only) q = q.is("decision", null);
        const { data, error } = await q;
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "get_budget_summary": {
        let q = sb.from("budget_summary").select("*").limit(100);
        if (input.fiscal_year) q = q.eq("fiscal_year", input.fiscal_year);
        const { data, error } = await q;
        if (error) throw error;
        return JSON.stringify(data);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String((e as Error)?.message ?? e) });
  }
}

// ---------- Anthropic call ----------
// deno-lint-ignore no-explicit-any
async function callClaude(messages: any[], systemPrompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }
  return await res.json();
}

// ---------- Main handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    // 1. Authenticate the caller; all DB access uses THEIR token (RLS!)
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { conversation_id, message } = await req.json();
    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // 2. Ensure conversation exists & belongs to caller (RLS enforces this)
    let convId = conversation_id as string | undefined;
    if (!convId) {
      const { data, error } = await sb
        .from("chat_conversations")
        .insert({
          profile_id: auth.user.id,
          title: message.slice(0, 60),
        })
        .select("id")
        .single();
      if (error) throw error;
      convId = data.id;
    }

    // 3. Load recent history + save the new user message
    const { data: history } = await sb
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);
    await sb.from("chat_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // deno-lint-ignore no-explicit-any
    const messages: any[] = [
      ...(history ?? []).reverse().map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt =
      `Kamu adalah TANIA, asisten AI portal Chapter Product & Solution (DPS) Telkom Indonesia. ` +
      `Jawab dalam Bahasa Indonesia, singkat, ramah, dan profesional. ` +
      `Hari ini: ${today}. ` +
      `Gunakan tools untuk menjawab pertanyaan tentang talent, timesheet, utilisasi, feasibility, dan budget — jangan mengarang angka. ` +
      `Data yang kamu terima sudah difilter sesuai hak akses user; kalau hasil kosong, katakan kemungkinan user tidak punya akses ke data tersebut. ` +
      `Kamu hanya bisa MEMBACA data — untuk mengubah data, arahkan user ke halaman modul terkait. ` +
      `Tolak sopan pertanyaan di luar konteks portal TANIA.`;

    // 4. Tool-use loop
    let totalIn = 0;
    let totalOut = 0;
    let finalText = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const resp = await callClaude(messages, systemPrompt);
      totalIn += resp.usage?.input_tokens ?? 0;
      totalOut += resp.usage?.output_tokens ?? 0;

      const toolUses = resp.content.filter((b: any) => b.type === "tool_use");
      const textParts = resp.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text);

      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
        finalText = textParts.join("\n").trim() ||
          "Maaf, saya tidak bisa menjawab pertanyaan itu.";
        break;
      }

      messages.push({ role: "assistant", content: resp.content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await runTool(sb, tu.name, tu.input ?? {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }
      messages.push({ role: "user", content: toolResults });

      if (round === MAX_TOOL_ROUNDS) {
        finalText =
          "Maaf, pertanyaan ini terlalu kompleks untuk saya jawab sekarang. Coba pecah menjadi pertanyaan yang lebih spesifik.";
      }
    }

    // 5. Save assistant reply (with token usage for cost monitoring)
    await sb.from("chat_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: finalText,
      input_tokens: totalIn,
      output_tokens: totalOut,
    });

    return new Response(
      JSON.stringify({ conversation_id: convId, reply: finalText }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String((e as Error)?.message ?? e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
