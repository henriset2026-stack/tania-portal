"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/session-provider";

/**
 * Phase 1 placeholder. The executive dashboard (XM-01) is phase 5 — it needs
 * utilization_monthly and budget_summary, which only have data once the
 * timesheet and budget modules exist.
 */
const PHASES = [
  { n: 2, label: "Timesheet", detail: "Entry mingguan, approval, compliance", ids: "TS-01, TS-02, TS-04" },
  { n: 3, label: "Talent & Workload", detail: "Competency matrix, alokasi, utilisasi", ids: "TM-02..04, WA-01..04" },
  { n: 4, label: "Feasibility & Budget", detail: "Scoring, keputusan, plan vs realisasi", ids: "PF-01..05, BC-01..05" },
  { n: 5, label: "Dashboard & polish", detail: "Dashboard eksekutif, export Excel", ids: "XM-01, XM-02, XM-03" },
];

export default function DashboardPage() {
  const { profile } = useSession();

  return (
    <AppShell title="Dashboard">
      <Card className="p-5">
        <p className="text-[13px]">
          Selamat datang{profile?.full_name ? `, ${profile.full_name}` : ""}.
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Fase 1 (fondasi) sudah aktif: autentikasi, profil, dan master data admin.
          Modul lain menyusul sesuai rencana rilis.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Profil Anda</div>
          <div className="mt-1 text-[15px] font-semibold">{profile?.full_name ?? "—"}</div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
            {profile?.squad ?? "Squad belum diisi"}
            {profile?.grade ? ` · ${profile.grade}` : ""}
          </div>
          <Link
            href="/profil/"
            className="mt-3 inline-block text-[12.5px] underline underline-offset-2"
          >
            Lengkapi profil →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Berikutnya</div>
          <ul className="mt-2 flex flex-col gap-2">
            {PHASES.map((p) => (
              <li key={p.n} className="flex items-start gap-2.5">
                <Badge>{`Fase ${p.n}`}</Badge>
                <span className="text-[12.5px]">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground"> — {p.detail}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{p.ids}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
