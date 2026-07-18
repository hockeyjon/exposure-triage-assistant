import type { Dependency } from "@/lib/types";

interface Props {
  dependencies: Dependency[] | null;
  loading: boolean;
  error: string | null;
  hidden: boolean;
}

export default function InventoryPanel({ dependencies, loading, error, hidden }: Props) {
  if (hidden) {
    return null;
  }
  if (loading) {
    return <p className="text-sm text-ink-muted">Loading inventory…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-amber-300">
        Couldn&rsquo;t load inventory: {error}
      </p>
    );
  }
  if (!dependencies || dependencies.length === 0) {
    return <p className="text-sm text-ink-muted">No dependencies loaded.</p>;
  }

  const backend = dependencies.filter((d) => d.source === "backend");
  const frontend = dependencies.filter((d) => d.source === "frontend");
  const demo = dependencies.filter((d) => d.source === "demo");
  const imported = dependencies.filter((d) => d.source === "imported");

  const columns = [
    { label: "Backend (Python)", items: backend },
    { label: "Frontend (npm)", items: frontend },
  ].filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-4" id="inventory-panel">
      {columns.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {columns.map(({ label, items }) => (
            <div key={label}>
              <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-muted">
                {label} · {items.length}
              </p>
              <ul className="space-y-0.5 font-mono text-xs text-ink-muted">
                {items.map((d) => (
                  <li key={`${d.source}-${d.name}`} className="truncate">
                    {d.name}
                    <span className="text-ink-muted/60">@{d.version}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {demo.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-100 p-3">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-black">
            Demo packages · {demo.length}{" "}
            <span className="normal-case tracking-normal text-black/70">
              — illustrative only, not real dependencies of this project (INCLUDE_DEMO_PACKAGES=true)
            </span>
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-black/80">
            {demo.map((d) => (
              <li key={`${d.source}-${d.name}`} className="truncate">
                {d.name}
                <span className="text-black/50">@{d.version}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {imported.length > 0 && (
        <div className="rounded border border-line bg-[var(--brand-light)] p-3">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-black">
            Imported · {imported.length}{" "}
            <span className="normal-case tracking-normal text-black/70">
              — from an uploaded manifest, not this project&rsquo;s own scan
            </span>
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-black/80">
            {imported.map((d) => (
              <li key={`${d.source}-${d.name}`} className="truncate">
                {d.name}
                <span className="text-black/50">@{d.version}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
