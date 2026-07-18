import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "About | Exposure Triage Assistant",
  description: "What the frontend and backend actually do, and what's next.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-lg border border-line bg-panel p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="space-y-3 text-sm text-ink">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">About this project</h1>
        <p className="mb-8 max-w-2xl text-sm text-ink-muted">
          This tool doesn&rsquo;t decide what to fix. It surfaces real exploitation signal,
          not just a severity score, and a documented trail of how it got to a given ranking, so
          the person who makes the final call on what to act on has more to work with than a raw
          CVSS list.
        </p>

        <Section title="Frontend">
          <p>
            Next.js (App Router) with TypeScript and Tailwind CSS. On load, it calls{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">GET /inventory</code>{" "}
            to show exactly what&rsquo;s tracked. Clicking <strong>Prioritize Exposures</strong> opens{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">GET /analyze</code>, a
            Server-Sent Events stream, and renders each pipeline step as it arrives: the live
            &ldquo;agent trace,&rdquo; the side-by-side CVSS-vs-real-risk tables, and the mock
            trouble-ticket workflow are all client-side state built on top of that stream.
          </p>
          <p>
            The inventory isn&rsquo;t locked to this project&rsquo;s own manifests.{" "}
            <strong>Import Dependencies</strong> uploads a <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">requirements.txt</code> or{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">package.json</code> against{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">POST /inventory/import</code>, either merged into what&rsquo;s
            already loaded or replacing it outright. Only entries with an explicit pinned version are
            usable, since there&rsquo;s no installed environment here to resolve a bare package name
            against. Imported rows are tagged <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">source: &quot;imported&quot;</code>,
            shown in their own labeled panel, and gone on the next rescan or restart: those always
            rebuild from this project&rsquo;s real manifests, never from something a visitor uploaded.
          </p>
          <p>
            The <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">/analyze</code>{" "}
            agent-trace stream is consumed with a hand-rolled{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">fetch</code> +{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">ReadableStream</code> reader
            (<code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">src/lib/api.ts</code>), not
            Vercel&rsquo;s AI SDK: that stream is a custom multi-node protocol the SDK isn&rsquo;t
            shaped for. The findings chat above the ranking is a different story, and where the SDK
            is actually a natural fit.
          </p>
          <p>
            That chat is built on <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">@ai-sdk/react</code>&rsquo;s{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">useCompletion</code>{" "}
            hook (<code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">FindingsChat.tsx</code>),
            pointed at the FastAPI backend&rsquo;s own{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">/findings/chat</code>{" "}
            endpoint instead of a Next.js API route, using the SDK&rsquo;s plain-text streaming
            protocol. No Next.js API route, no Node server: the static export stays exactly what
            it was, just with a client hook now pointed at a Python endpoint instead of a hand-rolled
            one. It&rsquo;s grounded in every finding currently on screen, not just one, so an
            analyst can ask something like &ldquo;which of these are actually exploitable without
            authentication?&rdquo; before deciding what to open a ticket for.
          </p>
          <p>
            A conversation gets an auto-generated title the moment the first answer lands, from a
            lightweight LLM call against <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">POST /findings/chat/title</code>{" "}
            that summarizes the exchange so far. Both the active conversation and anything saved
            afterward can be renamed or deleted from there, so a conversation doesn&rsquo;t have to
            be finished before it has a name worth keeping.
          </p>
        </Section>

        <Section title="Backend">
          <p>
            FastAPI serving a <strong>LangGraph</strong>-compiled state graph (
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">backend/app/graph.py</code>):
          </p>
          <p className="font-mono text-xs text-ink-muted">
            load_inventory → fetch_vulnerabilities → enrich_and_score → draft_rationale → critique
          </p>
          <p>
            Only two of those five nodes touch an LLM at all:{" "}
            <strong>draft_rationale</strong> and <strong>critique</strong>. The other three are
            deterministic Python: loading the dependency inventory from SQLite, querying OSV.dev for
            CVEs, and computing the risk score from CVSS/EPSS/KEV. That split is intentional: the
            ranking itself is reproducible and auditable, never a matter of model sampling.
          </p>
          <p>
            The two LLM nodes use <strong>LangChain</strong>&rsquo;s{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">with_structured_output</code>{" "}
            to get schema-validated Pydantic output (a rationale and confidence per finding, plus a
            summary) instead of parsing free text. By default they&rsquo;re backed by{" "}
            <strong>Anthropic&rsquo;s Claude</strong> (via <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">langchain-anthropic</code>,
            defaulting to Haiku): draft_rationale writes an initial explanation of the ranking, and
            critique reviews that draft against the original data fields and strips out anything it
            can&rsquo;t support. The provider is swappable to OpenAI via a single env var; nothing in
            the graph or prompts is Anthropic-specific.
          </p>
          <p>
            A third endpoint, <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">POST /findings/chat</code>,
            powers the findings chat: it streams the LLM&rsquo;s answer token-by-token via
            LangChain&rsquo;s <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">astream()</code>,
            grounded in a compact summary of every finding currently on screen (CVE, package,
            CVSS, EPSS, KEV status, both ranks, and rationale). The system prompt is explicit
            about not inventing specifics it wasn&rsquo;t given, and saying so when a question
            falls outside that data: the same evidence discipline as the ranking pipeline itself,
            just applied conversationally.
          </p>
        </Section>

        <Section title="Deployment">
          <p>
            This runs on a shared host without root access: no systemd, no direct control over
            the web server config beyond what Apache&rsquo;s per-directory{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">.htaccess</code>{" "}
            allows. That constraint shaped both sides of the deployment more than the frameworks
            did.
          </p>
          <p>
            The FastAPI backend runs under <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">uvicorn</code>,
            kept alive by <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">supervisord</code>,{" "}
            a pure-Python process manager that installs into the project&rsquo;s own virtualenv and
            needs no root to run, restarted automatically on reboot via a single crontab entry.
            Apache&rsquo;s <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">mod_proxy</code>,
            configured through a plain <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">.htaccess</code>{" "}
            rewrite rule, forwards <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">/api/*</code> to
            that local port. One process, one port, one proxy rule: a small, well-understood surface.
          </p>
          <p>
            Restart-on-reboot doesn&rsquo;t cover every failure mode: a shared-host resource-limit
            enforcement action (CPU, memory, or I/O quota) can kill the process outright without the
            box itself ever rebooting, so a reboot-only crontab entry never fires. A separate cron&rsquo;d{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">scripts/watchdog.sh</code>{" "}
            checks every few minutes and restarts the backend only if it&rsquo;s actually down. It
            was added after exactly that kind of kill took the backend out during a heavy deploy day,
            and nothing brought it back until someone noticed.
          </p>
          <p>
            The frontend ships as a <strong>static export</strong>, not a running Node process.
            Every dynamic part of this app (the inventory panel, the agent trace, the ranking
            tables) is a client component making a browser-side <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">fetch</code>{" "}
            against that FastAPI backend. No page here does request-time server rendering, so there&rsquo;s
            nothing for a Node server to actually do at runtime. The build output is plain
            HTML/CSS/JS sitting in a directory Apache already serves. No Node.js runtime runs on the
            server at all.
          </p>
          <p>
            Server-side rendering or Next.js API routes would change that calculus, not just add
            to it: a live Node process instead of static files means installing and managing a
            Node runtime on a host that doesn&rsquo;t expose one as cleanly as it does Python
            interpreters, a second entry in the process supervisor to keep{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">next start</code> alive,
            and an Apache proxy rule that has to cover the entire path rather than just{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">/api/*</code>, since
            every page request (not only data calls) would need forwarding to Node. That&rsquo;s
            real operational surface to take on for a feature this app has no functional need for
            today.
          </p>
        </Section>

        <Section title="Roadmap">
          <p className="text-ink-muted">Two agents, on top of the pipeline that exists today:</p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Autonomous prioritization agent.</strong>{" "}
              Right now, a person has to click
              Prioritize Exposures. The next step is an agent that runs this pipeline on its own:
              on a schedule, whenever the inventory changes, or whenever a new vulnerability is
              found by the &ldquo;vulnerability watch agent,&rdquo; so a current prioritized view
              is always available without anyone requesting it.
            </li>
            <li>
              <strong>Continuous vulnerability watch agent.</strong>{" "}
              Right now, OSV/EPSS/KEV are
              queried fresh, synchronously, once per run. The next step is a background agent that
              watches those sources continuously between runs, so a newly disclosed CVE affecting
              this inventory is caught the moment it&rsquo;s published, not only the next time
              someone happens to click the button.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
