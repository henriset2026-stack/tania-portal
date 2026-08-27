"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";

interface SessionState {
  loading: boolean;
  /** Null when signed out, or when Supabase is not configured. */
  userId: string | null;
  profile: Profile | null;
  /** Set when the profile row could not be read. */
  error: string | null;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState>({
  loading: true,
  userId: null,
  profile: null,
  error: null,
  signOut: async () => {},
});

export function useSession() {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Without env vars there is nothing to resolve, so that state is the
  // initial value rather than something an effect sets on first render.
  const [state, setState] = useState<Omit<SessionState, "signOut">>({
    loading: isSupabaseConfigured,
    userId: null,
    profile: null,
    error: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;

    async function load(userId: string | null) {
      if (!userId) {
        if (active) setState({ loading: false, userId: null, profile: null, error: null });
        return;
      }
      // The profile row is created by the handle_new_user() trigger, and RLS
      // lets every signed-in user read profiles.
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, squad, grade, location, manager_id, is_active, created_at, updated_at",
        )
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      setState({
        loading: false,
        userId,
        profile: (data as Profile | null) ?? null,
        error: error ? error.message : null,
      });
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, loading: true }));
      load(session?.user.id ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
  }

  return <Ctx.Provider value={{ ...state, signOut }}>{children}</Ctx.Provider>;
}
