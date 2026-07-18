"use client";

import type { Finding, NodeName } from "@/lib/types";
import { scrollToId } from "@/lib/scroll";
import FindingRow from "./FindingRow";
import FindingsChat from "./FindingsChat";

const RISK_TABLES_ID = "risk-tables";

interface Props {
  findings: Finding[];
  completedNodes: NodeName[];
  summary: string | null;
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined || delta === 0) {
    return <span className="text-xs text-ink-muted">=</span>;
  }
  const up = delta > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-brand" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

export function ConfidencePill({ confidence }: { confidence: Finding["confidence"] }) {
  const styles = {
    high: "bg-brand/10 text-brand border-brand/30",
    medium: "bg-amber-950 text-amber-300 border-amber-700/50",
    low: "bg-panel text-ink-muted border-line",
  } as const;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${styles[confidence]}`}>
      {confidence}
    </span>
  );
}

function RankColumn({
  title,
  subtitle,
  findings,
  rankKey,
  showDelta,
}: {
  title: string;
  subtitle: string;
  findings: Finding[];
  rankKey: "cvss_rank" | "risk_rank";
  showDelta: boolean;
}) {
  const sorted = [...findings].sort((a, b) => (a[rankKey] ?? 999) - (b[rankKey] ?? 999));
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </div>
      <ol className="divide-y divide-line">
        {sorted.map((f) => (
          <li key={f.cve_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-5 shrink-0 text-ink-muted">{f[rankKey]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-ink">{f.cve_id}</span>
                {f.in_kev && (
                  <span className="shrink-0 rounded bg-rose-950 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-700/50">
                    KEV
                  </span>
                )}
              </div>
              {f.package && (
                <span className="text-xs text-ink-muted">
                  {f.package}@{f.version}
                </span>
              )}
            </div>
            <div className="shrink-0 text-right text-xs text-ink-muted">
              CVSS {f.cvss_score ?? "—"} · EPSS {f.epss_score !== null && f.epss_score !== undefined ? f.epss_score.toFixed(3) : "—"}
            </div>
            {showDelta && <div className="w-12 shrink-0 text-right"><DeltaBadge delta={f.rank_delta} /></div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function RankingTable({ findings, completedNodes, summary }: Props) {
  if (findings.length === 0) return null;

  const critiqueDone = completedNodes.includes("critique");

  return (
    <div className="space-y-6">
      <FindingsChat findings={findings} completedNodes={completedNodes} />

      {critiqueDone && summary && (
        <div className="rounded-lg border border-brand/30 bg-brand/10 p-4 text-sm text-ink">
          {summary}
        </div>
      )}

      {critiqueDone && (
        <div className="rounded-lg border border-line bg-panel" id="finding-rationale-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Findings Rationale</h3>
            <button
              onClick={() => scrollToId("finding-rationale-panel", "bottom")}
              className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
            >
              View Raw Risk Tables ↓
            </button>
          </div>
          <ul className="divide-y divide-line">
            {[...findings]
              .sort((a, b) => (a.risk_rank ?? 999) - (b.risk_rank ?? 999))
              .map((f) => (
                <FindingRow key={f.cve_id} finding={f} />
              ))}
          </ul>
        </div>
      )}

      <div id={RISK_TABLES_ID} className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Raw Risk Tables</h3>
          {critiqueDone && (
            <button
              onClick={() => scrollToId("agent-trace-panel", "bottom")}
              className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
            >
              View Findings Rationale ↑
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RankColumn
            title="Sorted by CVSS (naive)"
            subtitle="What a “patch the highest severity first” tool would tell you"
            findings={findings}
            rankKey="cvss_rank"
            showDelta={false}
          />
          <RankColumn
            title="Sorted by real-world risk"
            subtitle="EPSS exploitation probability + CISA KEV + CVSS, weighted"
            findings={findings}
            rankKey="risk_rank"
            showDelta={true}
          />
        </div>

        {critiqueDone && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => scrollToId("agent-trace-panel", "bottom")}
              className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
            >
              View Findings Rationale ↑
            </button>
            <button
              onClick={() => scrollToId("finding-rationale-panel", "bottom")}
              className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
            >
              View Raw Risk Tables ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
