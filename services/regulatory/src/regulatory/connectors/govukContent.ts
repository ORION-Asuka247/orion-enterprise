import type { NormalizedRegulatoryItem } from "../../types/regulatory";

const BASE = "https://www.gov.uk/api/content";

export async function fetchGovUkContent(
  canonicalUrl: string
): Promise<NormalizedRegulatoryItem> {
  const parsed = new URL(canonicalUrl);
  const basePath = parsed.pathname;

  const response = await fetch(`${BASE}${basePath}`, {
    headers: {
      accept: "application/json",
      "user-agent": "ORION-Regulatory-Intelligence/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`GOV.UK Content API ${response.status}: ${basePath}`);
  }

  const c: any = await response.json();
  const details = c.details ?? {};
  const body =
    details.body ??
    details.parts?.map((p: any) => p.body).join("\n") ??
    "";

  return {
    externalId: c.content_id ?? basePath,
    canonicalUrl,
    title: c.title ?? "Untitled GOV.UK content",
    organisation:
      c.links?.organisations?.[0]?.title ??
      c.links?.primary_publishing_organisation?.[0]?.title ??
      null,
    documentType: c.document_type ?? c.schema_name ?? null,
    publicationDate: c.public_updated_at?.slice(0, 10) ?? null,
    updatedDate: c.public_updated_at?.slice(0, 10) ?? null,
    effectiveDate: null,
    rawContent: body || JSON.stringify(c),
    structuredContent: c,
    metadata: {
      basePath,
      documentType: c.document_type,
      schemaName: c.schema_name,
      withdrawnNotice: c.withdrawn_notice ?? null
    }
  };
}
