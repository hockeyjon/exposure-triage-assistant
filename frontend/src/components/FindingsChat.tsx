"use client";

import { useState } from "react";
import type { Exchange, Finding, NodeName } from "@/lib/types";
import ActiveChatSession from "./ActiveChatSession";
import SavedChatSession from "./SavedChatSession";
import Spinner from "./Spinner";

interface SavedSession {
  id: number;
  title: string;
  exchanges: Exchange[];
}

export default function FindingsChat({
  findings,
  completedNodes,
}: {
  findings: Finding[];
  completedNodes: NodeName[];
}) {
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [activeKey, setActiveKey] = useState(0);

  const enrichDone = completedNodes.includes("enrich_and_score");
  const critiqueDone = completedNodes.includes("critique");

  if (!enrichDone) {
    return null;
  }

  function handleSave(title: string, exchanges: Exchange[]) {
    setSavedSessions((prev) => [...prev, { id: activeKey, title, exchanges }]);
    setActiveKey((k) => k + 1);
  }

  return (
    <div className="mb-6 rounded-lg border border-line bg-panel p-4" id="chat-panel">
      {!critiqueDone && (
        <>
          <h2 className="mb-1 text-sm font-semibold text-ink" id="chat-title">
            Preparing exposure rationale…
          </h2>
          <div className="flex items-center gap-2 py-1 text-xs text-ink-muted">
            <Spinner />
            <span>The LLM is still drafting and critiquing rationale for these findings.</span>
          </div>
        </>
      )}

      {critiqueDone && (
        <>
          {savedSessions.map((s) => (
            <SavedChatSession key={s.id} title={s.title} exchanges={s.exchanges} />
          ))}
          <ActiveChatSession key={activeKey} findings={findings} onSave={handleSave} />
        </>
      )}
    </div>
  );
}
