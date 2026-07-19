# Exposure Triage Assistant

*Current release: **v1.0***

**CVSS tells you how bad a vulnerability *could* be. It says nothing about whether anyone is
actually exploiting it.** This tool audits its own supply chain — the backend's installed Python
packages and the frontend's npm dependencies — and re-ranks any exposures by real-world
exploitation signal instead of raw severity, showing its reasoning at every step instead of
hiding it behind a single chat completion.

By default there's no manifest to paste and no CVE to type in (you can also bring your own, see
below). On startup, the backend scans
`backend/requirements.txt` (resolved against the actually-installed package versions) and
`frontend/package.json` (resolved against `package-lock.json` for exact versions) into a SQLite
database. Clicking **Prioritize Exposures** analyzes whatever is currently in that database — this
project's real dependencies, not a hypothetical example.

The agent:

1. Resolves affected CVEs for every loaded package via [OSV.dev](https://osv.dev)
2. Enriches each with [EPSS](https://www.first.org/epss/) (daily-updated probability of
   exploitation in the next 30 days) and the [CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
   (confirmed, currently-being-exploited vulnerabilities)
3. Computes a deterministic risk score from those signals
4. Has an LLM draft a plain-language rationale for the ranking, then **critiques its own draft**
   against the source data and strips out anything it can't support
5. Shows you both rankings side by side — CVSS-only vs. real risk — so the delta is visible, not
   asserted

All three vulnerability-data sources are free and require no API key.

## Why this isn't just "a chatbot over some CVE data"

The ranking itself is never left to the LLM. `backend/app/tools/scoring.py` computes it from
three numeric fields with a fixed, documented formula — reproducible and auditable, not a matter
of model sampling. The LLM's job is narrower: explain the ranking in plain language, then review
its own explanation for claims the data doesn't support, lowering confidence or rewriting where it
overreaches. That draft → critique split, plus a UI that streams each pipeline step instead of a
single opaque response, is what keeps the "AI" part honest.

## Architecture

```
frontend/  Next.js (App Router, TypeScript, Tailwind)
  - Loads GET /inventory on page load — shows exactly what will be analyzed
  - "Prioritize Exposures" → GET /analyze, consumes a Server-Sent Events stream (no request body)
  - Live "agent trace" panel (one line per graph node, as it completes)
  - Side-by-side CVSS-only vs. real-risk ranking, with rank-delta indicators

backend/   FastAPI + LangGraph + LangChain + SQLite
  - On startup: inventory.py scans requirements.txt + package.json/package-lock.json
    into a SQLite DB (backend/data/inventory.db, rebuilt fresh every boot — it's a
    cache of the repo's real state, not a source of truth to migrate)
  - LangGraph pipeline: load_inventory → fetch_vulnerabilities → enrich_and_score
    → draft_rationale (LLM) → critique (LLM)
  - tools/osv.py    — OSV.dev client + CVSS vector parsing (via the `cvss` package)
  - tools/epss.py   — EPSS batch lookup
  - tools/kev.py    — CISA KEV catalog (cached in-process, refreshed hourly)
  - tools/scoring.py — the deterministic risk formula
  - LLM provider is swappable (Anthropic or OpenAI) via one env var; nothing in
    the graph or prompts is provider-specific
```

The backend degrades gracefully if no LLM key is configured: the deterministic ranking still
runs and streams to the UI, with a clear message explaining why narration is unavailable, instead
of a hard failure. The same degradation kicks in once `DAILY_LLM_CALL_LIMIT` (default 20, combined
across narration, critique, chat, and chat titling) is hit for the day — a backstop against a
runaway loop or unexpected traffic running up an API bill, tracked in SQLite so a watchdog-triggered
restart doesn't quietly reset the count. When that happens, the frontend offers a modal to email a
request for a higher limit, sent via AWS SES (`POST /contact/limit-increase`, itself capped at
`LIMIT_INCREASE_REQUEST_DAILY_CAP` sends/day) — see backend/.env.example for the SES settings.

## Running it locally

**Backend**

Requires **Python 3.10+** — `langchain`/`langgraph` won't install on older versions. On macOS,
plain `python3` is often Apple's bundled 3.9, which fails to resolve these packages at all with a
"Could not find a version that satisfies the requirement" error, not a clear "wrong Python"
message. Check with `python3 --version` first; if it's below 3.10, use a specific interpreter
(`python3.10`, `python3.12`, whatever you have via Homebrew/pyenv) in the venv command below.

```bash
cd backend
python3.10 -m venv .venv && source .venv/bin/activate   # use your actual 3.10+ interpreter
pip install -r requirements.txt
cp .env.example .env   # then fill in ANTHROPIC_API_KEY or OPENAI_API_KEY
uvicorn app.main:app --reload --port 8001
```

Getting a key (both are self-serve, pay-as-you-go, a few dollars covers a lot of runs on the
cheapest models):
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL should match the backend port above
npm run dev
```

Then open `http://localhost:3000`. The inventory panel shows what's loaded; click **Prioritize
Exposures** to analyze it.

If you add or upgrade a dependency and want to see it reflected without restarting the backend,
call `POST /inventory/rescan`.

**Why the ranking shows more than this project's own dependencies:** this project's own
dependencies may well be clean, so by default (`INCLUDE_DEMO_PACKAGES=true` in `backend/.env`) a
handful of real, intentionally outdated packages (Pillow, PyYAML, requests, lodash — all with
genuine public CVEs) are merged in alongside the real scan, so there's always something to rank.
They're tagged `source: "demo"` end to end and rendered in a clearly-labeled, separately styled
panel in the UI — never mixed into or presented as this project's real dependencies. Set
`INCLUDE_DEMO_PACKAGES=false` to see only this project's actual dependency scan.

**Want to check a different project?** Click **Import Dependencies** to upload a
`requirements.txt` or `package.json` of your own: add it to what's already loaded, or replace the
inventory with it entirely. Only lines or entries with an explicit version are usable, since
there's no installed environment here to resolve a bare package name against. Imports are tagged
`source: "imported"`, shown in their own labeled panel, and don't survive a rescan or restart —
those always rebuild from this project's real manifests.

## Deployment

Both sides run on ordinary shared hosting with no root access — no systemd, no direct control
over the web server config beyond what Apache's per-directory `.htaccess` allows. That constraint
shaped the deployment more than the frameworks did.

- **Backend** runs under `uvicorn`, kept alive by `supervisord` — a pure-Python process manager
  that installs into the project's own virtualenv and needs no root to run, restarted
  automatically on reboot via a crontab entry. Apache's `mod_proxy`, configured through a plain
  `.htaccess` rewrite rule, forwards `/api/*` to that local port. A separate cron'd
  `scripts/watchdog.sh` restarts it if a shared-host resource-limit enforcement action (CPU,
  memory, or I/O quota) kills the process outright — a reboot-only crontab entry doesn't catch
  that, since the box itself never restarts.
- **Frontend** ships as a Next.js **static export** (`output: "export"`), not a running Node
  process — every dynamic part of the UI is a client component calling the FastAPI backend
  directly, so there's nothing for a Node server to do at runtime. The build output is plain
  HTML/CSS/JS sitting in a directory Apache already serves.

Each side has its own deploy script (`backend/deploy.sh`, `frontend/scripts/deploy.sh`) that
builds, tars, and `scp`s the result, plus a `scripts/deploy.env.example` (copy to `deploy.env` and
fill in your real host/user/key — it's gitignored, never committed). The backend's archive also
carries `scripts/watchdog.sh` along for the ride, so it lands on the server automatically instead
of needing a separate manual copy.

## Roadmap

### Known limitations (v1.0)

- OSV lookups are sequential per package rather than batched — fine for a project's own
  dependency count, not for auditing someone else's 500-dependency lockfile
- Only two ecosystems, pip and npm — no support yet for Maven, Cargo, or others
- No historical tracking — each run is a fresh snapshot; a real tool would track how EPSS scores
  shift day to day for the same dependency set
- No test suite yet

### Planned for v1.1

- **Ticket comments** — after clicking "Create trouble ticket," add additional comments to that
  ticket instead of it being a one-shot, fire-and-forget action
- **Persistent chat history** — saved chat conversations currently live only in React state, gone
  on refresh or when the tab closes. Persist them (e.g. `localStorage`, or a backend table keyed
  to the browser) so they're still there the next time the app opens.

### Planned for v2.0

- **Pre-disclosure vulnerability watch agent** — continuously scans the internet for emerging
  vulnerabilities before they're published as a CVE, instead of relying solely on OSV/EPSS/KEV,
  which only cover already-disclosed CVEs
- **Event-triggered prioritization agent** — runs the pipeline on its own whenever the
  pre-disclosure watch agent finds something or the dependency supply chain changes, instead of
  only ever running on a manual click

## License

MIT — see [LICENSE](LICENSE).
