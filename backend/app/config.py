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

# Hard cap on LLM calls per day, combined across draft_rationale, critique,
# the findings chat, and its auto-titling — a provider-agnostic backstop
# against a runaway loop or unexpected traffic running up an API bill. Past
# the cap, those features degrade the same way they already do when no LLM
# key is configured: a clear inline message instead of a hard failure. Resets
# at UTC midnight. 0 (or negative) disables the limit entirely.
DAILY_LLM_CALL_LIMIT = int(os.getenv("DAILY_LLM_CALL_LIMIT", "20"))

# On by default: a handful of intentionally outdated, real,
# publicly-known-vulnerable packages are merged into the inventory (tagged
# source="demo", never mixed silently into the real backend/frontend scan)
# so a visitor sees actual exposures ranked without needing this project to
# have a real vulnerable dependency, or knowing to flip this var themselves.
# See inventory.py DEMO_PACKAGES.
INCLUDE_DEMO_PACKAGES = os.getenv("INCLUDE_DEMO_PACKAGES", "true").lower() in ("1", "true", "yes")

# AWS SES — sends the "daily limit increase request" email offered once
# DAILY_LLM_CALL_LIMIT is hit. SES_SENDER_EMAIL must be a verified sending
# identity in the SES account the credentials below belong to.
AWS_REGION = os.getenv("AWS_REGION", "us-east-2")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
SES_SENDER_EMAIL = os.getenv("SES_SENDER_EMAIL", "")
LIMIT_REQUEST_NOTIFY_EMAIL = os.getenv("LIMIT_REQUEST_NOTIFY_EMAIL", "")

# How many limit-increase-request emails /contact/limit-increase will send
# per day. Low on purpose — this exists to catch a genuine, occasional
# request, not to double as a general-purpose contact form.
LIMIT_INCREASE_REQUEST_DAILY_CAP = int(os.getenv("LIMIT_INCREASE_REQUEST_DAILY_CAP", "5"))

# Optional override for where inventory.py looks for the frontend's
# package.json/package-lock.json. Unset (the default) resolves to the
# sibling ../frontend directory, correct for local dev where backend/ and
# frontend/ share a repo. In production the two are deployed to entirely
# separate, unrelated directories, and the frontend's own deploy artifact
# is just its static build output — package.json never ships there by
# design — so scripts/deploy.sh bundles a copy into ./frontend-manifest
# and production's .env should set FRONTEND_DIR=./frontend-manifest.
FRONTEND_DIR = os.getenv("FRONTEND_DIR")
