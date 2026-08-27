"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

/**
 * Mandatory-reason dialog (UIUX.md §6.1, shared component `ReasonDialog`).
 *
 * Used for rejecting a timesheet and, later, for the feasibility decision.
 * The confirm button stays disabled while the reason is blank. The database
 * enforces the same rule, so this prevents an error rather than replacing a
 * safeguard.
 */
export function ReasonDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  // Mount only while open, so the reason field resets on each open without
  // an effect writing state (react-hooks/set-state-in-effect).
  if (!props.open) return null;
  return <Body {...props} />;
}

function Body({
  title,
  description,
  label,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open?: boolean;
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Focusing is a DOM sync, not a state write — an effect is correct here.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-title"
    >
      <div className="w-[460px] rounded-lg border border-border bg-white shadow-2xl">
        <div className="px-5 pt-[18px]">
          <h2 id="reason-title" className="text-[15.5px] font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <label htmlFor="reason" className="text-[13px] font-medium">
            {label} <span className="text-destructive">*</span>
          </label>
          <textarea
            id="reason"
            ref={ref}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[76px] rounded-md border border-border bg-white px-2.5 py-2 text-[13px] leading-relaxed focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
          {error ? (
            <p role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-[18px]">
          <Button onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={busy || reason.trim().length === 0}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "Memproses…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
