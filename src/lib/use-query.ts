"use client";

import { useCallback, useEffect, useState } from "react";

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Runs a Supabase list query and tracks its state.
 *
 * The query runs inside the effect and only writes state after awaiting, so
 * nothing is set synchronously during the effect body (react-hooks
 * set-state-in-effect). While refetching, the previous rows stay on screen
 * rather than flashing a skeleton.
 */
export function useQuery<T>(
  run: () => PromiseLike<Result<T>>,
  deps: readonly unknown[],
): { rows: T[]; loading: boolean; error: string | null; reload: () => void } {
  const [state, setState] = useState<{ rows: T[]; loading: boolean; error: string | null }>({
    rows: [],
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await run();
      if (cancelled) return;
      setState({ rows: data ?? [], loading: false, error: error?.message ?? null });
    })();
    return () => {
      cancelled = true;
    };
    // `run` is recreated every render; the caller's deps define identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
