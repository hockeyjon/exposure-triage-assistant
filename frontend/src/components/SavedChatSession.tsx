"use client";

import { useState } from "react";
import type { Exchange } from "@/lib/types";
import AskedQuestion from "./AskedQuestion";

export default function SavedChatSession({
  id,
  title,
  exchanges,
}: {
  id: string;
  title: string;
  exchanges: Exchange[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel" id={id}>
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 bg-[var(--brand-light)] px-4 py-3 text-left text-sm font-medium text-black"
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
        <div className="space-y-3 border-t border-line p-4">
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
