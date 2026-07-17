"""Client for OSV.dev (Open Source Vulnerabilities) — free, no API key required."""
from __future__ import annotations

import re

import httpx
from cvss import CVSS2, CVSS3

OSV_QUERY_URL = "https://api.osv.dev/v1/query"

CVE_PATTERN = re.compile(r"^CVE-\d{4}-\d+$", re.IGNORECASE)


def query_package(name: str, version: str, ecosystem: str) -> list[dict]:
    """Return raw OSV vuln records affecting a given package@version."""
    payload = {"version": version, "package": {"name": name, "ecosystem": ecosystem}}
    resp = httpx.post(OSV_QUERY_URL, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json().get("vulns", [])


def extract_cve_id(vuln: dict) -> str:
    """Prefer a CVE alias; fall back to the OSV-native id (e.g. GHSA-...)."""
    for alias in vuln.get("aliases", []):
        if CVE_PATTERN.match(alias):
            return alias
    return vuln.get("id", "UNKNOWN")


def extract_cvss(vuln: dict) -> tuple[float | None, str | None]:
    """Parse the first usable CVSS vector on a vuln record into (base_score, severity)."""
    for entry in vuln.get("severity", []):
        vector = entry.get("score", "")
        try:
            if vector.startswith("CVSS:3"):
                c = CVSS3(vector)
            else:
                c = CVSS2(vector)
        except Exception:
            continue
        return round(float(c.base_score), 1), c.severities()[0]
    return None, None
