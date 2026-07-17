"""Client for the CISA Known Exploited Vulnerabilities (KEV) catalog.

Free, no API key. This is the "attackers are actively using this right now"
signal — membership in this catalog is a much stronger prioritization
signal than CVSS severity alone.
"""
from __future__ import annotations

import time

import httpx

KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

_CACHE_TTL_SECONDS = 60 * 60  # refresh at most once an hour
_cache: dict[str, dict] | None = None
_cache_fetched_at: float = 0.0


def _load_catalog() -> dict[str, dict]:
    global _cache, _cache_fetched_at
    now = time.time()
    if _cache is not None and (now - _cache_fetched_at) < _CACHE_TTL_SECONDS:
        return _cache
    resp = httpx.get(KEV_URL, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    _cache = {v["cveID"]: v for v in data.get("vulnerabilities", [])}
    _cache_fetched_at = now
    return _cache


def lookup(cve_ids: list[str]) -> dict[str, dict]:
    """Return {cve_id: {"date_added": str, "known_ransomware_use": str}} for KEV members."""
    catalog = _load_catalog()
    out = {}
    for cve_id in cve_ids:
        entry = catalog.get(cve_id)
        if entry:
            out[cve_id] = {
                "date_added": entry.get("dateAdded"),
                "known_ransomware_use": entry.get("knownRansomwareCampaignUse", "Unknown"),
                "vulnerability_name": entry.get("vulnerabilityName"),
            }
    return out
