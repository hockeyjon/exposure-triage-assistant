"use client";

import Modal from "./Modal";
import { ticketTitle, ticketDescription, PRIORITY_STYLES, type TicketControl } from "@/lib/useTicket";
import type { Finding } from "@/lib/types";

export default function TicketStatusButton({ finding, control }: { finding: Finding; control: TicketControl }) {
  if (!control.ticket) return null;
  const ticket = control.ticket;

  return (
    <>
      <button
        onClick={control.openDetails}
        className="shrink-0 rounded bg-orange-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-500"
      >
        Trouble ticket: {ticket.number}
      </button>

      {control.dialog === "details" && (
        <Modal
          title={ticket.number}
          onClose={control.close}
          footer={
            <button
              onClick={control.close}
              className="rounded border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Close
            </button>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLES[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className="text-xs text-ink-muted">Status: Open</span>
              <span className="text-xs text-ink-muted">Created: {ticket.createdAt}</span>
            </div>
            <p className="font-medium text-ink">{ticketTitle(finding)}</p>
            <pre className="whitespace-pre-wrap rounded border border-line bg-surface p-3 font-mono text-xs text-ink-muted">
              {ticketDescription(finding)}
            </pre>
            <p className="text-xs text-ink-muted/70">
              Illustrative only — this is a mock ticket, not filed in a real tracker.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
