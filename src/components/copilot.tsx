"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "./session-provider";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/*
 * TANIA Copilot — AV-01, the chat widget for the Avatar module.
 *
 * The assistant runs in the `tania-assistant` edge function, which queries
 * the database with THE CALLER'S JWT. So it can only ever read what the
 * signed-in user could read: a talent asking about budget gets nothing back,
 * because RLS refuses, not because a prompt told the model to decline
 * (AV-03). Never "fix" a permission complaint by editing the system prompt.
 *
 * It is read-only by design (AV-04) and history is private per user (AV-05).
 *
 * The function is the only paid component in TANIA. Until ANTHROPIC_API_KEY
 * is set on the project, calls fail and this widget says so plainly rather
 * than looking broken.
 */

const MAX_CHARS = 2000; // the edge function rejects anything longer

interface Msg {
  role: "user" | "assistant";
  content: string;
  /** Local-only marker for a message that failed to send. */
  failed?: boolean;
}

const SUGGESTIONS = [
  "Berapa utilisasi chapter bulan ini?",
  "Siapa yang belum submit timesheet minggu ini?",
  "Proyek mana yang berstatus critical?",
];

export function Copilot() {
  const { userId, profile } = useSession();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load this user's most recent conversation once the panel is first opened.
  // RLS scopes chat_conversations to the owner, so no filter is needed for
  // correctness — only for picking which conversation to resume.
  useEffect(() => {
    if (!open || loadedHistory || !userId || !isSupabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id")
        .order("updated_at", { ascending: false })
        .range(0, 0);
      const conv = convs?.[0]?.id as string | undefined;
      if (!conv) {
        if (!cancelled) setLoadedHistory(true);
        return;
      }
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conv)
        .order("created_at")
        .range(0, 99);
      if (cancelled) return;
      setConversationId(conv);
      setMsgs((rows ?? []) as Msg[]);
      setLoadedHistory(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loadedHistory, userId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open, busy]);

  if (!userId) return null;

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setBusy(true);

    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sesi berakhir. Muat ulang halaman.");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tania-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ conversation_id: conversationId, message: question }),
        },
      );

      if (!res.ok) {
        // 404 means the function was never deployed; 500 usually means the
        // Anthropic key is missing. Say which, rather than "terjadi kesalahan".
        const detail =
          res.status === 404
            ? "Edge function tania-assistant belum di-deploy."
            : res.status === 403
              ? "Origin ini belum masuk daftar ALLOWED_ORIGINS."
              : res.status === 401
                ? "Sesi tidak valid. Masuk ulang."
                : "Layanan asisten belum aktif — ANTHROPIC_API_KEY belum disetel pada project.";
        throw new Error(detail);
      }

      const body = (await res.json()) as { conversation_id: string; reply: string };
      setConversationId(body.conversation_id);
      setMsgs((m) => [...m, { role: "assistant", content: body.reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
      setError(msg);
      setMsgs((m) => [...m, { role: "assistant", content: msg, failed: true }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      {/* ------------------------------------------------ launcher ---- */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka TANIA Copilot"
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-[#0f172a] pl-4 pr-5 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,.28)] hover:bg-slate-800"
        >
          <Spark />
          Copilot
        </button>
      ) : null}

      {/* --------------------------------------------------- panel ---- */}
      {open ? (
        <aside
          className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-border bg-white shadow-[-12px_0_40px_rgba(15,23,42,.10)] sm:w-[400px]"
          role="complementary"
          aria-label="TANIA Copilot"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a] text-white">
                <Spark />
              </span>
              <div className="leading-tight">
                <div className="text-[14px] font-semibold">TANIA Copilot</div>
                <div className="text-[11px] text-muted-foreground">
                  Menjawab dari data yang boleh Anda lihat
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="text-slate-400 hover:text-slate-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {msgs.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-slate-600">
                  Halo{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Tanyakan
                  apa saja tentang talent, workload, timesheet, kelayakan proyek, atau anggaran.
                </p>
                <p className="rounded-lg border border-border bg-surface p-3 text-[12px] leading-relaxed text-muted-foreground">
                  Copilot hanya membaca. Untuk mengubah data, gunakan halaman modulnya. Jawaban
                  dibatasi hak akses Anda — bukan oleh instruksi, tetapi oleh Row Level Security
                  basis data.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-lg border border-border bg-white px-3 py-2 text-left text-[12.5px] hover:border-slate-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {msgs.map((m, i) => (
                  <li
                    key={i}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        "max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed " +
                        (m.role === "user"
                          ? "bg-[#0f172a] text-white"
                          : m.failed
                            ? "border border-red-200 bg-red-50 text-red-800"
                            : "border border-border bg-surface text-slate-800")
                      }
                    >
                      {m.content}
                    </div>
                  </li>
                ))}
                {busy ? (
                  <li className="flex justify-start">
                    <div className="rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-muted-foreground">
                      Menyusun jawaban…
                    </div>
                  </li>
                ) : null}
              </ul>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-border p-3">
            {error ? (
              <p role="alert" className="mb-2 text-[11.5px] leading-relaxed text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                placeholder="Tanya sesuatu… (Enter kirim, Shift+Enter baris baru)"
                aria-label="Pertanyaan untuk Copilot"
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-border px-3 py-2 text-[13px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Kirim"
                className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-[#0f172a] text-white disabled:opacity-40"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
              <span>Riwayat percakapan privat — tidak dapat dibaca siapa pun, termasuk admin.</span>
              <span>
                {input.length}/{MAX_CHARS}
              </span>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}

function Spark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.4l1.9 4.9 4.9 1.9-4.9 1.9L12 17l-1.9-4.9L5.2 10.2l4.9-1.9L12 3.4Z" />
      <path d="M18.4 15.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
    </svg>
  );
}
