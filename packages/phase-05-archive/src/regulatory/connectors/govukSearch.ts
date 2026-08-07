import type { NormalizedRegulatoryItem } from "../../types/regulatory";

const BASE = "https://www.gov.uk/api/search.json";

export async function searchGovUk(params: {
  query: string;
  count?: number;
  start?: number;
}): Promise<NormalizedRegulatoryItem[]> {
  const url = new URL(BASE);
  url.searchParams.set("q", params.query);
  url.searchParams.set("count", String(params.count ?? 50));
  url.searchParams.set("start", String(params.start ?? 0));
  url.searchParams.set("order", "-public_timestamp");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ORION-Regulatory-Intelligence/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`GOV.UK Search API ${response.status}`);
  }

  const payload: any = await response.json();

  return (payload.results ?? []).map((r: any) => {
    const path = r.link || r.base_path || "";
    const canonicalUrl = path.startsWith("http")
      ? path
      : `https://www.gov.uk${path}`;

    return {
      externalId: r.content_id ?? path,
      canonicalUrl,
      title: r.title ?? "Untitled GOV.UK publication",
      organisation:
        r.organisations?.[0]?.title ??
        r.organisation_name ??
        null,
      documentType: r.format ?? r.content_store_document_type ?? null,
      publicationDate: r.public_timestamp?.slice(0, 10) ?? null,
      updatedDate: r.public_timestamp?.slice(0, 10) ?? null,
      effectiveDate: null,
      rawContent: JSON.stringify(r),
      structuredContent: r,
      metadata: {
        source: "GOV.UK Search API",
        link: path
      }
    } satisfies NormalizedRegulatoryItem;
  });
}
