"use client";

import { useEffect, useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import type { Exchange, Finding } from "@/lib/types";
import AskedQuestion from "./AskedQuestion";
import Spinner from "./Spinner";
import PencilIcon from "./PencilIcon";
import TrashIcon from "./TrashIcon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchTitle(exchanges: Exchange[]): Promise<string> {
  const resp = await fetch(`${API_URL}/findings/chat/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exchanges }),
  });
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
  const data = await resp.json();
  return data.title;
}

export default function ActiveChatSession({
  findings,
  onSave,
}: {
  findings: Finding[];
  onSave: (title: string, exchanges: Exchange[]) => void;
}) {
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [derivedTitle, setDerivedTitle] = useState<string | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { completion, input, handleInputChange, handleSubmit, setInput, setCompletion, isLoading, error } =
    useCompletion({
      api: `${API_URL}/findings/chat`,
      streamProtocol: "text",
      body: { findings },
      onFinish: (prompt, finalCompletion) => {
        setHistory((prev) => [...prev, { question: prompt, answer: finalCompletion }]);
        setCompletion("");
        setPendingQuestion(null);
      },
    });

  // Names the session as soon as the first reply lands, not just when
  // "Save Conversation" is clicked — so the title is already sitting there
  // by the time anyone decides whether to save.
  useEffect(() => {
    if (history.length !== 1 || derivedTitle) return;
    setTitleLoading(true);
    fetchTitle(history)
      .then(setDerivedTitle)
      .catch(() => setDerivedTitle(history[0].question.slice(0, 60) || "Saved conversation"))
      .finally(() => setTitleLoading(false));
  }, [history, derivedTitle]);

  function onSubmit(e: React.FormEvent) {
    setPendingQuestion(input);
    handleSubmit(e);
    setInput("");
  }

  function onClear() {
    setHistory([]);
    setPendingQuestion(null);
    setCompletion("");
    setInput("");
    setDerivedTitle(null);
    setTitleLoading(false);
    setEditingTitle(false);
  }

  function startEditTitle() {
    setTitleDraft(derivedTitle ?? "");
    setEditingTitle(true);
  }

  function commitTitleEdit() {
    const trimmed = titleDraft.trim();
    if (trimmed) setDerivedTitle(trimmed);
    setEditingTitle(false);
  }

  async function onSaveClick() {
    if (derivedTitle) {
      onSave(derivedTitle, history);
      return;
    }
    setSaving(true);
    try {
      onSave(await fetchTitle(history), history);
    } catch {
      onSave(history[0]?.question.slice(0, 60) || "Saved conversation", history);
    } finally {
      setSaving(false);
    }
  }

  const busy = isLoading || saving;

  return (
    <div className="rounded-lg border border-line bg-panel p-4" id="chat-panel">
      {history.length === 0 ? (
        <>
          <h2 className="mb-1 text-sm font-semibold text-ink" id="chat-title">
            Ask about these findings
          </h2>
          <p className="mb-3 text-xs text-ink-muted" id="chat-description">
            Grounded in the {findings.length} finding{findings.length === 1 ? "" : "s"} below,
            reason it through before deciding what to act on.
          </p>
        </>
      ) : editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitleEdit();
            if (e.key === "Escape") setEditingTitle(false);
          }}
          onBlur={commitTitleEdit}
          className="mb-3 w-full rounded border border-brand/50 bg-surface px-2 py-1 text-sm font-semibold text-ink focus:outline-none"
        />
      ) : (
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink" id="chat-title">
            {derivedTitle ?? (titleLoading ? "Naming this conversation…" : "Conversation")}
          </h2>
          {derivedTitle && (
            <button
              onClick={startEditTitle}
              aria-label="Rename conversation"
              className="shrink-0 text-ink-muted transition-colors hover:text-ink"
            >
              <PencilIcon />
            </button>
          )}
          <button
            onClick={onClear}
            aria-label="Delete conversation"
            className="shrink-0 text-ink-muted transition-colors hover:text-ink"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {history.map((exchange, i) => (
        <div key={i} className="mb-3 space-y-1">
          <AskedQuestion value={exchange.question} />
          <p className="whitespace-pre-wrap text-sm text-ink">{exchange.answer}</p>
        </div>
      ))}

      {pendingQuestion !== null && (
        <div className="mb-3 space-y-1">
          <AskedQuestion value={pendingQuestion} />
          {completion && <p className="whitespace-pre-wrap text-sm text-ink">{completion}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-1.5 text-xs text-ink-muted">
          <Spinner />
          <span>Generating response…</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={input}
            id="chat-input"
            onChange={handleInputChange}
            placeholder="e.g. Which of these are actually exploitable without authentication?"
            className="flex-1 rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error.message}</p>}

      {history.length > 0 && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onSaveClick}
            disabled={busy}
            className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Conversation"}
          </button>
          <button
            onClick={onClear}
            disabled={busy}
            className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
