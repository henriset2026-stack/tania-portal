"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import type { CellValue } from "@/lib/xlsx";

/**
 * XM-03 — export a table to Excel.
 *
 * The writer is loaded on demand so it stays out of the initial bundle
 * (AGENTS.md performance rules). PDF export is not in the MVP; on a static
 * export it would have to be produced in the browser (PRD §6, XM-03 ◐).
 */
export function ExportButton({
  filename,
  sheetName,
  rows,
  disabled,
}: {
  filename: string;
  sheetName: string;
  /** First row is the header. */
  rows: () => CellValue[][];
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const { buildXlsx } = await import("@/lib/xlsx");
      const blob = buildXlsx(sheetName, rows());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick; revoking immediately cancels the download
      // in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={run} disabled={busy || disabled}>
      {busy ? "Menyiapkan…" : "Export Excel"}
    </Button>
  );
}
