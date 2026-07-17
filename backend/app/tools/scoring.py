"""Deterministic risk scoring — the actual re-ranking logic.

This is intentionally NOT delegated to the LLM: a numeric ranking should be
reproducible and auditable, not a matter of model sampling. The LLM's job
(see graph.py) is to explain and critique this score, not invent it.

risk_score in [0, 1], weighted:
  - EPSS (real-world exploitation probability): 50%
  - CISA KEV membership (confirmed active exploitation): 30%
  - Normalized CVSS base score: 20%
"""
from __future__ import annotations

EPSS_WEIGHT = 0.5
KEV_WEIGHT = 0.3
CVSS_WEIGHT = 0.2


def compute_risk_score(
    cvss_score: float | None,
    epss_score: float | None,
    in_kev: bool,
) -> float:
    epss_component = (epss_score or 0.0) * EPSS_WEIGHT
    kev_component = (1.0 if in_kev else 0.0) * KEV_WEIGHT
    cvss_component = ((cvss_score or 0.0) / 10.0) * CVSS_WEIGHT
    return round(epss_component + kev_component + cvss_component, 4)
