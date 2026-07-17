import { NODE_LABELS, type NodeName } from "@/lib/types";

interface Props {
  completedNodes: NodeName[];
  running: boolean;
  errorMessage: string | null;
}

export default function AgentTrace({ completedNodes, running, errorMessage }: Props) {
  return (
    <ol className="space-y-2">
      {completedNodes.map((node, i) => (
        <li key={`${node}-${i}`} className="flex items-center gap-3 text-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">
            ✓
          </span>
          <span className="text-ink">{NODE_LABELS[node]}</span>
        </li>
      ))}
      {running && (
        <li className="flex items-center gap-3 text-sm">
          <span className="flex h-5 w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-amber-500 text-xs text-white">
            …
          </span>
          <span className="text-ink-muted">Working…</span>
        </li>
      )}
      {errorMessage && (
        <li className="mt-2 rounded border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          {errorMessage}
        </li>
      )}
    </ol>
  );
}
