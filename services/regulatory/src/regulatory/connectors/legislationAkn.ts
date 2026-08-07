import type { NormalizedRegulatoryItem } from "../../types/regulatory";

export async function fetchLegislationAkn(
  canonicalUrl: string
): Promise<NormalizedRegulatoryItem> {
  const clean = canonicalUrl.replace(/\/+$/, "");
  const aknUrl = `${clean}/data.akn`;

  const response = await fetch(aknUrl, {
    headers: {
      accept: "application/xml,text/xml,*/*",
      "user-agent": "ORION-Regulatory-Intelligence/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`legislation.gov.uk AKN ${response.status}`);
  }

  const xml = await response.text();

  return {
    externalId: clean,
    canonicalUrl: clean,
    title: inferTitle(xml) ?? clean.split("/").slice(-3).join(" "),
    organisation: "The National Archives",
    documentType: "legislation",
    publicationDate: null,
    updatedDate: null,
    effectiveDate: null,
    rawContent: xml,
    structuredContent: {
      format: "Akoma Ntoso",
      sourceUrl: aknUrl
    },
    metadata: {
      format: "akn",
      aknUrl
    }
  };
}

function inferTitle(xml: string): string | null {
  const candidates = [
    /<FRBRname[^>]*value="([^"]+)"/i,
    /<docTitle[^>]*>(.*?)<\/docTitle>/is,
    /<shortTitle[^>]*>(.*?)<\/shortTitle>/is
  ];

  for (const re of candidates) {
    const match = xml.match(re);
    if (match?.[1]) {
      return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}
