"use client";

import type { Finding } from "@/lib/types";
import { useTicket } from "@/lib/useTicket";
import { ConfidencePill } from "./RankingTable";
import CreateTicketButton from "./CreateTicketButton";
import TicketStatusButton from "./TicketStatusButton";

export default function FindingRow({ finding: f }: { finding: Finding }) {
  const ticketControl = useTicket(f);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-ink">{f.cve_id}</span>
          <ConfidencePill confidence={f.confidence} />
          <CreateTicketButton finding={f} control={ticketControl} />
          {f.in_kev && (
            <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-700/50">
              Actively exploited (CISA KEV{f.kev_date_added ? `, added ${f.kev_date_added}` : ""})
            </span>
          )}
        </div>
        <TicketStatusButton finding={f} control={ticketControl} />
      </div>
      {f.rationale && <p className="mt-1 text-sm text-ink-muted">{f.rationale}</p>}
    </li>
  );
}
