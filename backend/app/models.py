from typing import Literal, Optional

from pydantic import BaseModel, Field


class Finding(BaseModel):
    cve_id: str
    package: Optional[str] = None
    version: Optional[str] = None

    cvss_score: Optional[float] = None
    cvss_severity: Optional[str] = None

    epss_score: Optional[float] = None
    epss_percentile: Optional[float] = None

    in_kev: bool = False
    kev_date_added: Optional[str] = None
    kev_known_ransomware_use: Optional[str] = None

    risk_score: float = 0.0
    cvss_rank: Optional[int] = None
    risk_rank: Optional[int] = None
    rank_delta: Optional[int] = None  # cvss_rank - risk_rank; positive = moved up in real risk

    rationale: Optional[str] = None
    confidence: Literal["high", "medium", "low"] = "medium"


class NarratedFinding(BaseModel):
    """Structured output schema the LLM fills in for one finding."""

    cve_id: str
    rationale: str = Field(description="1-2 sentences explaining this CVE's priority, grounded only in the provided CVSS/EPSS/KEV fields")
    confidence: Literal["high", "medium", "low"]


class CritiqueResult(BaseModel):
    """Structured output schema for the critique/verification pass."""

    findings: list[NarratedFinding]
    summary: str = Field(description="2-4 sentence overview of what changed between the CVSS ranking and the real-risk ranking, and why")
