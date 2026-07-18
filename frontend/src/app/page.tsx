"use client";

import { useEffect, useState } from "react";
import { fetchInventory, streamAnalysis } from "@/lib/api";
import { scrollToId } from "@/lib/scroll";
import { isLimitReachedMessage, stripLimitReachedMarker } from "@/lib/limitReached";
import AgentTrace from "@/components/AgentTrace";
import RankingTable from "@/components/RankingTable";
import InventoryPanel from "@/components/InventoryPanel";
import ImportDependenciesButton from "@/components/ImportDependenciesButton";
import LimitIncreaseModal from "@/components/LimitIncreaseModal";
import Header from "@/components/Header";
import type { Dependency, GraphPublicState, NodeName } from "@/lib/types";

export default function Home() {
  const [dependencies, setDependencies] = useState<Dependency[] | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [completedNodes, setCompletedNodes] = useState<NodeName[]>([]);
  const [state, setState] = useState<GraphPublicState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [importVersion, setImportVersion] = useState(0);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitContextMessage, setLimitContextMessage] = useState<string | null>(null);

  function openLimitModal(rawMessage: string) {
    setLimitContextMessage(stripLimitReachedMarker(rawMessage).trim());
    setLimitModalOpen(true);
  }

  useEffect(() => {
    fetchInventory()
      .then(setDependencies)
      .catch((err) => setInventoryError(err instanceof Error ? err.message : String(err)))
      .finally(() => setInventoryLoading(false));
  }, []);

  // completedNodes only grows during a run, and critique is the last node,
  // so this fires exactly once per run — right when critique lands.
  useEffect(() => {
    if (completedNodes.includes("critique")) {
      scrollToId("dependency-inventory-panel", "bottom");
    }
  }, [completedNodes]);

  // A freshly imported list can push the Prioritize Exposures button off
  // screen. If that happened, ease down to it instead of leaving the user
  // to scroll and find it themselves.
  useEffect(() => {
    if (importVersion === 0) return;
    const panel = document.getElementById("dependency-inventory-panel");
    if (panel && panel.getBoundingClientRect().bottom > window.innerHeight) {
      scrollToId("dependency-inventory-panel", "bottom", "smooth");
    }
  }, [importVersion]);

  function handleImported(deps: Dependency[]) {
    setDependencies(deps);
    setImportVersion((v) => v + 1);
  }

  async function runAnalysis() {
    if (running) return;
    setRunning(true);
    setCompletedNodes([]);
    setState(null);
    setConnectionError(null);

    try {
      for await (const evt of streamAnalysis()) {
        if (evt.type === "node") {
          setCompletedNodes((prev) => [...prev, evt.payload.node]);
          setState(evt.payload.state);
        } else if (evt.type === "done") {
          setState(evt.payload.state);
          // draft_rationale carries a limit-reached failure into
          // state.error; critique (which still runs even when
          // draft_rationale already failed) copies that same value into
          // state.summary, or sets it there directly if critique is the
          // one that hit the limit. Either is a real trigger — checked
          // here, once the run has fully settled, rather than in an effect
          // reacting to state after the fact.
          const trigger = evt.payload.state.error ?? evt.payload.state.summary ?? null;
          if (isLimitReachedMessage(trigger)) {
            openLimitModal(trigger);
          }
        } else if (evt.type === "error") {
          setConnectionError(evt.payload.message);
        }
      }
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <span className="mb-4 inline-block rounded-full border border-line bg-panel px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink-muted">
            Dependency Exposure Intelligence
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Exposure Triage Assistant
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            CVSS tells you how bad a vulnerability could be. It says nothing about whether
            anyone is actually exploiting it.
          </p>
        </div>

        <div id="dependency-inventory-panel" className="mb-8 rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Dependency inventory</h2>
          <InventoryPanel
            dependencies={dependencies}
            loading={inventoryLoading}
            error={inventoryError}
            hidden={running || completedNodes.length > 0}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={runAnalysis}
              disabled={running}
              className="rounded bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? "Analyzing…" : "Prioritize Exposures"}
            </button>
            {!(running || completedNodes.length > 0) && (
              <ImportDependenciesButton onImported={handleImported} />
            )}
          </div>
        </div>

        {(running || completedNodes.length > 0 || connectionError) && (
          <div id="agent-trace-panel" className="mb-8 rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Agent trace</h2>
            <AgentTrace
              completedNodes={completedNodes}
              running={running}
              errorMessage={connectionError ?? (state?.error ? stripLimitReachedMarker(state.error) : null)}
            />
          </div>
        )}

        {state?.findings && state.findings.length > 0 && !state?.error && (
          <RankingTable
            findings={state.findings}
            completedNodes={completedNodes}
            summary={state.summary ? stripLimitReachedMarker(state.summary) : null}
            onLimitReached={openLimitModal}
          />
        )}
      </div>

      <LimitIncreaseModal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        contextMessage={limitContextMessage}
      />
    </div>
  );
}
