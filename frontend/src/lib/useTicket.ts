"use client";

import { useState } from "react";
import type { Finding } from "./types";

export interface Ticket {
  number: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  createdAt: string;
}

export type TicketDialog = "none" | "confirm" | "details";

function priorityFor(riskScore: number): Ticket["priority"] {
  if (riskScore >= 0.7) return "Critical";
  if (riskScore >= 0.4) return "High";
  if (riskScore >= 0.15) return "Medium";
  return "Low";
}

/** Shared ticket state for one finding row, so the "create" button (next to
 * the confidence pill) and the "status" button (right-aligned) can be
 * rendered in two different places but stay in sync. */
export function useTicket(finding: Finding) {
  const [dialog, setDialog] = useState<TicketDialog>("none");
  const [ticket, setTicket] = useState<Ticket | null>(null);

  return {
    ticket,
    dialog,
    openConfirm: () => setDialog("confirm"),
    openDetails: () => setDialog("details"),
    close: () => setDialog("none"),
    confirm: () => {
      setTicket({
        number: `SEC-${Math.floor(1000 + Math.random() * 9000)}`,
        priority: priorityFor(finding.risk_score),
        createdAt: new Date().toLocaleString(),
      });
      setDialog("none");
    },
  };
}

export type TicketControl = ReturnType<typeof useTicket>;

export function ticketTitle(f: Finding): string {
  return f.package ? `Remediate ${f.cve_id} in ${f.package}@${f.version}` : `Remediate ${f.cve_id}`;
}

export function ticketDescription(f: Finding): string {
  const lines = [
    `Risk score: ${f.risk_score.toFixed(3)} (real-risk rank #${f.risk_rank ?? "—"}, CVSS-only rank #${f.cvss_rank ?? "—"})`,
    `CVSS: ${f.cvss_score ?? "—"}${f.cvss_severity ? ` (${f.cvss_severity})` : ""}`,
    `EPSS: ${f.epss_score !== null && f.epss_score !== undefined ? f.epss_score.toFixed(3) : "—"}`,
    `CISA KEV: ${f.in_kev ? `Yes — confirmed active exploitation${f.kev_date_added ? `, added ${f.kev_date_added}` : ""}` : "No"}`,
  ];
  if (f.rationale) lines.push("", f.rationale);
  return lines.join("\n");
}

export const PRIORITY_STYLES: Record<Ticket["priority"], string> = {
  Critical: "bg-rose-950 text-rose-300 border-rose-700/50",
  High: "bg-amber-950 text-amber-300 border-amber-700/50",
  Medium: "bg-brand/10 text-brand border-brand/30",
  Low: "bg-panel text-ink-muted border-line",
};
