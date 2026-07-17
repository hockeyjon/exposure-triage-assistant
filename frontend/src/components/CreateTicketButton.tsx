"use client";

import Modal from "./Modal";
import { ticketTitle, type TicketControl } from "@/lib/useTicket";
import type { Finding } from "@/lib/types";

export default function CreateTicketButton({ finding, control }: { finding: Finding; control: TicketControl }) {
  if (control.ticket) return null;

  return (
    <>
      <button
        onClick={control.openConfirm}
        className="shrink-0 rounded bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-500"
      >
        Create trouble ticket
      </button>

      {control.dialog === "confirm" && (
        <Modal
          title="Create trouble ticket?"
          onClose={control.close}
          footer={
            <>
              <button
                onClick={control.close}
                className="rounded border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={control.confirm}
                className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                Confirm
              </button>
            </>
          }
        >
          <p className="text-ink-muted">This will file a ticket for:</p>
          <p className="mt-1 font-mono text-ink">{ticketTitle(finding)}</p>
        </Modal>
      )}
    </>
  );
}
