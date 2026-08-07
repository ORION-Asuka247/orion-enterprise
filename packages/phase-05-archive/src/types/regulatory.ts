export type UUID = string;

export type RegulatoryChangeStatus =
  | "detected"
  | "analysing"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "implemented";

export interface NormalizedRegulatoryItem {
  externalId?: string | null;
  canonicalUrl: string;
  title: string;
  organisation?: string | null;
  documentType?: string | null;
  publicationDate?: string | null;
  updatedDate?: string | null;
  effectiveDate?: string | null;
  rawContent: string;
  structuredContent: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SourceCheckResult {
  seen: number;
  newOrChanged: number;
  errors: string[];
}

export interface RegulatoryAnalysis {
  summary: string;
  whatChanged: string;
  whyItMatters: string;
  urgency: "low" | "medium" | "high" | "critical" | "unknown";
  confidence: number;
  proposedEffectiveDate?: string | null;
  affectedComplianceDomains: string[];
  affectedAssetTypeCodes: string[];
  affectedTemplateCodes: string[];
  proposedActions: Array<{
    type: string;
    description: string;
    urgency?: string;
  }>;
  citations: Array<{
    url: string;
    title?: string;
    section?: string;
  }>;
  requiresLegalReview: boolean;
}
