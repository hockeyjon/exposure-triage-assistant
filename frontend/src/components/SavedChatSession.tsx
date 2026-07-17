"use client";

import { useState } from "react";
import type { Exchange } from "@/lib/types";
import AskedQuestion from "./AskedQuestion";

export default function SavedChatSession({ title, exchanges }: { title: string; exchanges: Exchange[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3 overflow-hidden rounded border border-line">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 bg-[var(--brand-light)] px-3 py-2 text-left text-sm font-medium text-black"
      >
        <span className="truncate">{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {exchanges.map((exchange, i) => (
            <div key={i} className="space-y-1">
              <AskedQuestion value={exchange.question} />
              <p className="whitespace-pre-wrap text-sm text-ink">{exchange.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
