"""The core agent pipeline.

Design principle: the risk *ranking* is a deterministic, auditable function
of public data (see tools/scoring.py) — it is never left to LLM sampling.
The LLM's job is narrower and more honest: explain the ranking in plain
language, grounded only in the fields it was given, and then critique its
own explanation for unsupported claims before returning it. That two-pass
draft -> critique split is what keeps this from being "an AI-wrapped UI":
the reasoning is inspectable at every node, not a single opaque completion.

There is no user-provided input. "Prioritize Exposures" analyzes this
project's own dependencies — loaded into the database at startup by
inventory.py from requirements.txt and package.json/package-lock.json.
"""
from __future__ import annotations

from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph

from . import config, db
from .llm import get_llm
from .models import CritiqueResult
from .tools import epss, kev, osv, scoring


class GraphState(TypedDict, total=False):
    packages: list[dict]   # [{name, version, ecosystem, source}] loaded from the DB
    findings: list[dict]   # accumulating Finding-shaped dicts
    summary: Optional[str]
    error: Optional[str]
    _draft: Optional[dict]  # draft_rationale's output, consumed by critique


def node_load_inventory(state: GraphState) -> GraphState:
    return {"packages": db.get_all_dependencies()}


def node_fetch_vulnerabilities(state: GraphState) -> GraphState:
    raw_records: list[dict] = []  # each: {cve_id, package, version, cvss_score, cvss_severity}

    for pkg in state.get("packages", []):
        vulns = osv.query_package(pkg["name"], pkg["version"], pkg["ecosystem"])
        for vuln in vulns:
            cve_id = osv.extract_cve_id(vuln)
            cvss_score, cvss_sev = osv.extract_cvss(vuln)
            raw_records.append(
                {
                    "cve_id": cve_id,
                    "package": pkg["name"],
                    "version": pkg["version"],
                    "cvss_score": cvss_score,
                    "cvss_severity": cvss_sev,
                }
            )

    # De-dupe by CVE id (the same CVE can surface via multiple advisory
    # sources); keep the record with the highest-confidence CVSS score.
    deduped: dict[str, dict] = {}
    for rec in raw_records:
        existing = deduped.get(rec["cve_id"])
        if existing is None or (existing["cvss_score"] is None and rec["cvss_score"] is not None):
            deduped[rec["cve_id"]] = rec

    return {"findings": list(deduped.values())}


def node_enrich_and_score(state: GraphState) -> GraphState:
    findings = state.get("findings", [])
    cve_ids = [f["cve_id"] for f in findings]

    epss_data = epss.fetch_scores(cve_ids) if cve_ids else {}
    kev_data = kev.lookup(cve_ids) if cve_ids else {}

    for f in findings:
        e = epss_data.get(f["cve_id"], {})
        k = kev_data.get(f["cve_id"])
        f["epss_score"] = e.get("epss")
        f["epss_percentile"] = e.get("percentile")
        f["in_kev"] = k is not None
        f["kev_date_added"] = k.get("date_added") if k else None
        f["kev_known_ransomware_use"] = k.get("known_ransomware_use") if k else None
        f["risk_score"] = scoring.compute_risk_score(f["cvss_score"], f["epss_score"], f["in_kev"])

    # CVSS-only rank (what a naive "sort by severity" tool would show).
    by_cvss = sorted(findings, key=lambda f: (f["cvss_score"] or 0), reverse=True)
    for i, f in enumerate(by_cvss, start=1):
        f["cvss_rank"] = i

    # Real-risk rank (what this tool actually recommends acting on first).
    by_risk = sorted(findings, key=lambda f: f["risk_score"], reverse=True)
    for i, f in enumerate(by_risk, start=1):
        f["risk_rank"] = i

    for f in findings:
        f["rank_delta"] = f["cvss_rank"] - f["risk_rank"]

    return {"findings": by_risk}


_NARRATION_SYSTEM_PROMPT = """You are a vulnerability-prioritization assistant. \
You will be shown a list of CVEs with objective fields already computed: CVSS base score, \
EPSS (real-world exploitation probability, 0-1), and CISA KEV membership (confirmed active exploitation).

For each CVE, write a 1-2 sentence rationale for its priority rank. RULES:
- Only reference the fields you were given (cvss_score, epss_score, in_kev, kev_known_ransomware_use). \
Do not invent details about the vulnerability, affected systems, or attack vectors that were not provided.
- If a field is missing (e.g. cvss_score is null), say so rather than guessing a value.
- Set confidence to "low" if key fields (cvss_score or epss_score) are missing, "medium" if all fields are \
present but the signals conflict, "high" if all fields are present and agree.
- Also write a short overall summary contrasting the CVSS-only ranking with the real-risk ranking."""

_CRITIQUE_SYSTEM_PROMPT = """You are reviewing a draft vulnerability prioritization writeup for accuracy. \
You will see the original data fields AND a draft rationale/summary. Your job:
- Remove or rewrite any claim in the draft that is not directly supported by the data fields provided.
- Lower the confidence rating if the rationale overreaches given the available data.
- Keep the same output schema. Return the corrected version, not commentary about the correction."""


def _findings_to_llm_payload(findings: list[dict]) -> list[dict]:
    return [
        {
            "cve_id": f["cve_id"],
            "package": f.get("package"),
            "cvss_score": f.get("cvss_score"),
            "cvss_severity": f.get("cvss_severity"),
            "epss_score": f.get("epss_score"),
            "in_kev": f.get("in_kev"),
            "kev_known_ransomware_use": f.get("kev_known_ransomware_use"),
            "cvss_rank": f.get("cvss_rank"),
            "risk_rank": f.get("risk_rank"),
        }
        for f in findings
    ]


def node_draft_rationale(state: GraphState) -> GraphState:
    findings = state.get("findings", [])
    top = findings[: config.MAX_NARRATED_FINDINGS]
    if not top:
        return {"summary": "No known vulnerabilities found in this project's dependencies."}

    try:
        llm = get_llm(temperature=0).with_structured_output(CritiqueResult)
        payload = _findings_to_llm_payload(top)
        draft: CritiqueResult = llm.invoke(
            [
                {"role": "system", "content": _NARRATION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Findings (sorted by real risk rank):\n{payload}"},
            ]
        )
    except Exception as exc:  # missing/invalid API key, provider outage, etc.
        return {"error": f"LLM narration unavailable ({exc}); showing deterministic ranking only."}

    # Stash the draft on state under a private key for the critique node.
    return {"_draft": draft.model_dump()}


def node_critique(state: GraphState) -> GraphState:
    findings = state.get("findings", [])
    top = findings[: config.MAX_NARRATED_FINDINGS]
    draft = state.get("_draft")
    if state.get("error"):
        return {"summary": state["error"]}
    if not draft:
        return {}

    try:
        llm = get_llm(temperature=0).with_structured_output(CritiqueResult)
        payload = _findings_to_llm_payload(top)
        reviewed: CritiqueResult = llm.invoke(
            [
                {"role": "system", "content": _CRITIQUE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Original data fields:\n{payload}\n\nDraft to review:\n{draft}",
                },
            ]
        )
    except Exception as exc:
        return {"summary": f"LLM critique unavailable ({exc}); showing deterministic ranking only."}

    by_id = {nf.cve_id: nf for nf in reviewed.findings}
    for f in findings:
        narrated = by_id.get(f["cve_id"])
        if narrated:
            f["rationale"] = narrated.rationale
            f["confidence"] = narrated.confidence
        elif f in top:
            f["rationale"] = None
            f["confidence"] = "low"
        else:
            f["rationale"] = "Not narrated (below prioritization cutoff for this run)."
            f["confidence"] = "low"

    return {"findings": findings, "summary": reviewed.summary}


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("load_inventory", node_load_inventory)
    graph.add_node("fetch_vulnerabilities", node_fetch_vulnerabilities)
    graph.add_node("enrich_and_score", node_enrich_and_score)
    graph.add_node("draft_rationale", node_draft_rationale)
    graph.add_node("critique", node_critique)

    graph.set_entry_point("load_inventory")
    graph.add_edge("load_inventory", "fetch_vulnerabilities")
    graph.add_edge("fetch_vulnerabilities", "enrich_and_score")
    graph.add_edge("enrich_and_score", "draft_rationale")
    graph.add_edge("draft_rationale", "critique")
    graph.add_edge("critique", END)

    return graph.compile()
