import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { contentHash } from "../analysis/hash";
import { searchGovUk } from "../connectors/govukSearch";
import { fetchGovUkContent } from "../connectors/govukContent";
import type { NormalizedRegulatoryItem } from "../../types/regulatory";

export async function runGovUkSearchSource(source: any) {
  const run = await createRun(source.id);
  let seen = 0;
  let newOrChanged = 0;

  try {
    const queries: string[] = source.query_config?.queries ?? [];

    for (const query of queries) {
      const results = await searchGovUk({
        query,
        count: source.query_config?.count ?? 50
      });

      for (const result of results) {
        seen += 1;

        let full: NormalizedRegulatoryItem = result;

        if (source.query_config?.fetch_discovered_pages !== false) {
          try {
            full = await fetchGovUkContent(result.canonicalUrl);
          } catch {
            // Search metadata remains useful if Content API lookup fails.
          }
        }

        const outcome = await storeItem(source.id, full);
        if (outcome?.change_id) newOrChanged += 1;
      }
    }

    await finishRun(run.id, {
      success: true,
      seen,
      newOrChanged
    });

    return { seen, newOrChanged };
  } catch (error: any) {
    await finishRun(run.id, {
      success: false,
      seen,
      newOrChanged,
      error: error?.message ?? String(error)
    });
    throw error;
  }
}

async function storeItem(sourceId: string, item: NormalizedRegulatoryItem) {
  const stableContent = item.rawContent || JSON.stringify(item.structuredContent);
  const hash = contentHash(stableContent);

  const { data, error } = await supabaseAdmin.rpc(
    "record_regulatory_document_version",
    {
      p_source_id: sourceId,
      p_external_id: item.externalId ?? null,
      p_canonical_url: item.canonicalUrl,
      p_title: item.title,
      p_organisation: item.organisation ?? null,
      p_document_type: item.documentType ?? null,
      p_publication_date: item.publicationDate ?? null,
      p_updated_date: item.updatedDate ?? null,
      p_effective_date: item.effectiveDate ?? null,
      p_content_hash: hash,
      p_raw_content: item.rawContent,
      p_structured_content: item.structuredContent,
      p_metadata: item.metadata
    }
  );

  if (error) throw error;
  return data;
}

async function createRun(sourceId: string) {
  const { data, error } = await supabaseAdmin
    .from("regulatory_source_runs")
    .insert({ source_id: sourceId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function finishRun(
  runId: string,
  result: {
    success: boolean;
    seen: number;
    newOrChanged: number;
    error?: string;
  }
) {
  const { error } = await supabaseAdmin
    .from("regulatory_source_runs")
    .update({
      completed_at: new Date().toISOString(),
      success: result.success,
      items_seen: result.seen,
      items_changed: result.newOrChanged,
      error_message: result.error ?? null
    })
    .eq("id", runId);

  if (error) throw error;
}
