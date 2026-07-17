export type Confidence = "high" | "medium" | "low";

export interface Finding {
  cve_id: string;
  package?: string | null;
  version?: string | null;
  cvss_score?: number | null;
  cvss_severity?: string | null;
  epss_score?: number | null;
  epss_percentile?: number | null;
  in_kev: boolean;
  kev_date_added?: string | null;
  kev_known_ransomware_use?: string | null;
  risk_score: number;
  cvss_rank?: number | null;
  risk_rank?: number | null;
  rank_delta?: number | null;
  rationale?: string | null;
  confidence: Confidence;
}

export interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
  source: "backend" | "frontend" | "demo" | "imported";
}

export interface GraphPublicState {
  packages?: Dependency[];
  findings?: Finding[];
  summary?: string | null;
  error?: string | null;
}

export type NodeName =
  | "load_inventory"
  | "fetch_vulnerabilities"
  | "enrich_and_score"
  | "draft_rationale"
  | "critique";

export const NODE_LABELS: Record<NodeName, string> = {
  load_inventory: "Loading dependency inventory from the database",
  fetch_vulnerabilities: "Resolving CVEs via OSV.dev",
  enrich_and_score: "Enriching with EPSS + CISA KEV, scoring risk",
  draft_rationale: "Drafting rationale (LLM)",
  critique: "Critiquing rationale for unsupported claims (LLM)",
};

export interface NodeEvent {
  node: NodeName;
  state: GraphPublicState;
}

export interface Exchange {
  question: string;
  answer: string;
}
