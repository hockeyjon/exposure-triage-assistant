"""Client for the EPSS API (first.org) — free, no API key required.

EPSS = Exploit Prediction Scoring System: a daily-updated probability
(0-1) that a given CVE will be exploited in the wild in the next 30 days.
This is the primary signal used to re-rank findings away from raw CVSS.
"""
from __future__ import annotations

import httpx

EPSS_URL = "https://api.first.org/data/v1/epss"

# The API accepts a comma-separated batch; keep batches modest to stay
# well under any practical URL-length limit.
_BATCH_SIZE = 100


def fetch_scores(cve_ids: list[str]) -> dict[str, dict]:
    """Return {cve_id: {"epss": float, "percentile": float}} for known CVEs."""
    results: dict[str, dict] = {}
    unique_ids = list(dict.fromkeys(cve_ids))  # de-dupe, preserve order
    for i in range(0, len(unique_ids), _BATCH_SIZE):
        batch = unique_ids[i : i + _BATCH_SIZE]
        resp = httpx.get(EPSS_URL, params={"cve": ",".join(batch)}, timeout=15)
        resp.raise_for_status()
        for row in resp.json().get("data", []):
            results[row["cve"]] = {
                "epss": float(row["epss"]),
                "percentile": float(row["percentile"]),
            }
    return results
