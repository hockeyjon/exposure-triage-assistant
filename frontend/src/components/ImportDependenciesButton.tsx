"use client";

import { useState } from "react";
import Modal from "./Modal";
import { importInventory } from "@/lib/api";
import type { Dependency } from "@/lib/types";

export default function ImportDependenciesButton({ onImported }: { onImported: (deps: Dependency[]) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setFile(null);
    setError(null);
  }

  async function submit(mode: "add" | "replace") {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const deps = await importInventory(file, mode);
      onImported(deps);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
      >
        Import Dependencies
      </button>

      {open && (
        <Modal
          title="Import dependencies"
          onClose={close}
          footer={
            <>
              <button
                onClick={close}
                className="rounded border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => submit("add")}
                disabled={!file || busy}
                className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Importing…" : "Add to inventory"}
              </button>
              <button
                onClick={() => submit("replace")}
                disabled={!file || busy}
                className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Importing…" : "Replace inventory"}
              </button>
            </>
          }
        >
          <p className="mb-3 text-ink-muted">
            Upload a <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">requirements.txt</code> or{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">package.json</code>. Only
            lines or entries with an explicit version can be checked, since there&rsquo;s nothing installed
            here to resolve a bare package name against.
          </p>
          <input
            type="file"
            accept=".txt,.json,text/plain,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-hover"
          />
          {file && <p className="mt-2 text-xs text-ink-muted">{file.name}</p>}
          {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          <p className="mt-3 text-xs text-ink-muted/70">
            &ldquo;Add&rdquo; merges these into what&rsquo;s already loaded. &ldquo;Replace&rdquo; clears the
            current inventory first. Neither survives a backend restart or rescan: those always rebuild from
            this project&rsquo;s real manifests.
          </p>
        </Modal>
      )}
    </>
  );
}
