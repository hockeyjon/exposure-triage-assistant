"use client";

import { useEffect, useState } from "react";
import { fetchInventory, streamAnalysis } from "@/lib/api";
import { scrollToId } from "@/lib/scroll";
import AgentTrace from "@/components/AgentTrace";
import RankingTable from "@/components/RankingTable";
import InventoryPanel from "@/components/InventoryPanel";
import ImportDependenciesButton from "@/components/ImportDependenciesButton";
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
              <ImportDependenciesButton onImported={setDependencies} />
            )}
          </div>
        </div>

        {(running || completedNodes.length > 0 || connectionError) && (
          <div id="agent-trace-panel" className="mb-8 rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Agent trace</h2>
            <AgentTrace
              completedNodes={completedNodes}
              running={running}
              errorMessage={connectionError ?? state?.error ?? null}
            />
          </div>
        )}

        {state?.findings && state.findings.length > 0 && !state?.error && (
          <RankingTable
            findings={state.findings}
            completedNodes={completedNodes}
            summary={state.summary ?? null}
          />
        )}
      </div>
    </div>
  );
}
