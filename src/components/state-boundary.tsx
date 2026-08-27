import type { ReactNode } from "react";
import { Button } from "./ui/button";

/**
 * The five states every data screen must define (UIUX.md §6.2).
 *
 * `denied` matters most: RLS returns zero rows for data the caller may not
 * read, and that is not an error (TRD DA-5). Pass `denied` when a query
 * succeeds but returns nothing AND the role plausibly has no access, so the
 * screen says so instead of showing a blank table.
 */
export function StateBoundary({
  loading,
  error,
  empty,
  denied,
  emptyMessage = "Belum ada data.",
  emptyAction,
  onRetry,
  skeletonRows = 4,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  denied?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  skeletonRows?: number;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
        ))}
        <span className="sr-only">Memuat data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-[13px] text-foreground">Gagal memuat data.</p>
        <p className="text-[12px] text-muted-foreground">{error}</p>
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        ) : null}
      </div>
    );
  }

  if (denied) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground">
          Tidak ada data yang dapat Anda lihat.
        </p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
