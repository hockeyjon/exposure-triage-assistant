"use client";

import { useEffect, useState } from "react";
import type { Exchange, Finding, NodeName } from "@/lib/types";
import { scrollToElement } from "@/lib/scroll";
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
  onLimitReached,
}: {
  findings: Finding[];
  completedNodes: NodeName[];
  onLimitReached: (message: string) => void;
}) {
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [activeKey, setActiveKey] = useState(0);
  const [saveVersion, setSaveVersion] = useState(0);

  const enrichDone = completedNodes.includes("enrich_and_score");
  const critiqueDone = completedNodes.includes("critique");

  // Saving pushes the new conversation to the bottom of the list, which
  // usually leaves the analyst looking at the tail end of it. Scroll back
  // up so the whole saved stack, starting from the oldest, is in view.
  useEffect(() => {
    if (saveVersion === 0) return;
    const first = document.getElementById("saved-chat-sessions")?.firstElementChild as HTMLElement | null;
    if (first) scrollToElement(first, "top", "smooth", 10);
  }, [saveVersion]);

  if (!enrichDone) {
    return null;
  }

  function handleSave(title: string, exchanges: Exchange[]) {
    setSavedSessions((prev) => [...prev, { id: activeKey, title, exchanges }]);
    setActiveKey((k) => k + 1);
    setSaveVersion((v) => v + 1);
  }

  function handleRenameSaved(id: number, title: string) {
    setSavedSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  function handleDeleteSaved(id: number) {
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (!critiqueDone) {
    return (
      <div className="mb-6 rounded-lg border border-line bg-panel p-4" id="chat-panel">
        <h2 className="mb-1 text-sm font-semibold text-ink" id="chat-title">
          Preparing exposure rationale…
        </h2>
        <div className="flex items-center gap-2 py-1 text-xs text-ink-muted">
          <Spinner />
          <span>The LLM is still drafting and critiquing rationale for these findings.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      {savedSessions.length > 0 && (
        <div id="saved-chat-sessions" className="space-y-4">
          {savedSessions.map((s) => (
            <SavedChatSession
              key={s.id}
              id={`chat-panel-saved-${s.id}`}
              title={s.title}
              exchanges={s.exchanges}
              onRename={(title) => handleRenameSaved(s.id, title)}
              onDelete={() => handleDeleteSaved(s.id)}
            />
          ))}
        </div>
      )}
      <ActiveChatSession key={activeKey} findings={findings} onSave={handleSave} onLimitReached={onLimitReached} />
    </div>
  );
}
