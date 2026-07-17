"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import type { Exchange, Finding } from "@/lib/types";
import AskedQuestion from "./AskedQuestion";
import Spinner from "./Spinner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  }

  async function onSaveClick() {
    setSaving(true);
    try {
      const resp = await fetch(`${API_URL}/findings/chat/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchanges: history }),
      });
      if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
      const data = await resp.json();
      onSave(data.title, history);
    } catch {
      onSave(history[0]?.question.slice(0, 60) ?? "Saved conversation", history);
    } finally {
      setSaving(false);
    }
  }

  const busy = isLoading || saving;

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-ink" id="chat-title">
        Ask about these findings
      </h2>
      <p className="mb-3 text-xs text-ink-muted" id="chat-description">
        Grounded in the {findings.length} finding{findings.length === 1 ? "" : "s"} below, reason
        it through before deciding what to act on.
      </p>

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
