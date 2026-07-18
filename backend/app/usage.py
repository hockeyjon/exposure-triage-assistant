"""Tracks daily LLM call volume so a bug, a bot, or unexpected traffic can't
run up an unbounded API bill. Calls, not tokens: token counts aren't
reliably available at every call site (streaming chat responses in
particular), and a call cap is a simpler, correct-by-construction lever
that still bounds the worst case. Persisted in SQLite rather than kept in
memory, since scripts/watchdog.sh restarts this process on its own — an
in-memory counter would silently reset every time that fires.
"""
from __future__ import annotations

import datetime

from . import config, db


class DailyLimitReached(Exception):
    pass


# Prefixes a message surfaced to the frontend when it should trigger the
# "request a limit increase" modal, rather than being displayed as an
# ordinary LLM error. The frontend strips this before display — see
# frontend/src/lib/limitReached.ts, which must match this exact string.
LIMIT_REACHED_MARKER = "[[daily_limit_reached]]"


def _today() -> str:
    return datetime.date.today().isoformat()


def init_usage_db() -> None:
    conn = db.get_connection()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS llm_usage (date TEXT PRIMARY KEY, calls INTEGER NOT NULL)")
        conn.execute("CREATE TABLE IF NOT EXISTS contact_requests (date TEXT PRIMARY KEY, count INTEGER NOT NULL)")
        conn.commit()
    finally:
        conn.close()


def calls_today() -> int:
    conn = db.get_connection()
    try:
        row = conn.execute("SELECT calls FROM llm_usage WHERE date = ?", (_today(),)).fetchone()
        return row["calls"] if row else 0
    finally:
        conn.close()


def record_call() -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            "INSERT INTO llm_usage (date, calls) VALUES (?, 1) "
            "ON CONFLICT(date) DO UPDATE SET calls = calls + 1",
            (_today(),),
        )
        conn.commit()
    finally:
        conn.close()


def check_daily_limit() -> None:
    """Raises if today's LLM call count has already reached the configured
    daily cap. Call this before starting work that would make an LLM call —
    the point is to avoid the call, not count it after the fact."""
    if config.DAILY_LLM_CALL_LIMIT <= 0:
        return  # 0 or negative disables the limit
    if calls_today() >= config.DAILY_LLM_CALL_LIMIT:
        raise DailyLimitReached(
            f"Daily LLM usage limit reached ({config.DAILY_LLM_CALL_LIMIT} calls). Resets at midnight UTC."
        )


def contact_requests_today() -> int:
    conn = db.get_connection()
    try:
        row = conn.execute("SELECT count FROM contact_requests WHERE date = ?", (_today(),)).fetchone()
        return row["count"] if row else 0
    finally:
        conn.close()


def record_contact_request() -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            "INSERT INTO contact_requests (date, count) VALUES (?, 1) "
            "ON CONFLICT(date) DO UPDATE SET count = count + 1",
            (_today(),),
        )
        conn.commit()
    finally:
        conn.close()


def check_contact_request_limit() -> None:
    """Raises if today's limit-increase-request email count has already
    reached the configured cap — this endpoint exists to catch a genuine,
    occasional request, not to double as a general contact form."""
    if config.LIMIT_INCREASE_REQUEST_DAILY_CAP <= 0:
        return
    if contact_requests_today() >= config.LIMIT_INCREASE_REQUEST_DAILY_CAP:
        raise DailyLimitReached("Too many requests today. Please try again tomorrow.")
