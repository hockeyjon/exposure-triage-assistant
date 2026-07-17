"""SQLite storage for the dependency inventory.

The database is treated as a cache of the repo's real dependencies, not a
source of truth in its own right — it's dropped and rebuilt from
requirements.txt / package.json (+ package-lock.json) on every backend
startup (see inventory.py), so there's no migration story to maintain.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "inventory.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                ecosystem TEXT NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def replace_dependencies(deps: list[dict]) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM dependencies")
        conn.executemany(
            "INSERT INTO dependencies (name, version, ecosystem, source) "
            "VALUES (:name, :version, :ecosystem, :source)",
            deps,
        )
        conn.commit()
    finally:
        conn.close()


def get_all_dependencies() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT name, version, ecosystem, source FROM dependencies ORDER BY source, name"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
