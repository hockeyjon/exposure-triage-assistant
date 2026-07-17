import os

from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic").lower()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# How many top-ranked findings the LLM narrates/critiques. Keeps latency and
# cost bounded when a manifest resolves to a large number of CVEs.
MAX_NARRATED_FINDINGS = int(os.getenv("MAX_NARRATED_FINDINGS", "12"))

# Off by default. When true, a handful of intentionally outdated, real,
# publicly-known-vulnerable packages are merged into the inventory (tagged
# source="demo", never mixed silently into the real backend/frontend scan)
# so the ranking UI has something to show without needing an actual
# vulnerable dependency in this project. See inventory.py DEMO_PACKAGES.
INCLUDE_DEMO_PACKAGES = os.getenv("INCLUDE_DEMO_PACKAGES", "false").lower() in ("1", "true", "yes")

# Optional override for where inventory.py looks for the frontend's
# package.json/package-lock.json. Unset (the default) resolves to the
# sibling ../frontend directory, correct for local dev where backend/ and
# frontend/ share a repo. In production the two are deployed to entirely
# separate, unrelated directories, and the frontend's own deploy artifact
# is just its static build output — package.json never ships there by
# design — so scripts/deploy.sh bundles a copy into ./frontend-manifest
# and production's .env should set FRONTEND_DIR=./frontend-manifest.
FRONTEND_DIR = os.getenv("FRONTEND_DIR")
