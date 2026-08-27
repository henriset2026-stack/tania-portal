import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (singleton — AGENTS.md DA-6).
 *
 * The browser holds the anon key, so RLS is the only security boundary
 * (SAD AD-3). Never add the service_role key here.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when env vars are absent, so pages can explain instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.",
    );
  }
  client ??= createClient(url as string, anonKey as string, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
