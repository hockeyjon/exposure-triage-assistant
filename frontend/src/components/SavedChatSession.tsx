"use client";

import { useState } from "react";
import type { Exchange } from "@/lib/types";
import AskedQuestion from "./AskedQuestion";
import PencilIcon from "./PencilIcon";
import TrashIcon from "./TrashIcon";

export default function SavedChatSession({
  id,
  title,
  exchanges,
  onRename,
  onDelete,
}: {
  id: string;
  title: string;
  exchanges: Exchange[];
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function startEdit() {
    setDraft(title);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel" id={id}>
      <div className="flex items-center gap-2 bg-[var(--brand-light)] px-4 py-3">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commitEdit}
            className="min-w-0 flex-1 rounded border border-black/30 bg-white px-2 py-1 text-sm text-black focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-black"
          >
            {title}
          </button>
        )}

        <button
          onClick={startEdit}
          aria-label="Rename conversation"
          className="shrink-0 text-black/60 transition-colors hover:text-black"
        >
          <PencilIcon />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete conversation"
          className="shrink-0 text-black/60 transition-colors hover:text-black"
        >
          <TrashIcon />
        </button>

        {!editing && (
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="shrink-0 text-black"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

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
