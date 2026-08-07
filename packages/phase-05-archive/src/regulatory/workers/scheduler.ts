import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { runGovUkSearchSource } from "../services/sourceRunner";

export async function regulatorySchedulerTick() {
  const now = Date.now();

  const { data: sources, error } = await supabaseAdmin
    .from("regulatory_sources")
    .select("*")
    .eq("is_enabled", true);

  if (error) throw error;

  const results: any[] = [];

  for (const source of sources ?? []) {
    const due =
      !source.last_checked_at ||
      now - new Date(source.last_checked_at).getTime() >=
        source.polling_interval_minutes * 60_000;

    if (!due) continue;

    try {
      if (source.source_type === "govuk_search") {
        const result = await runGovUkSearchSource(source);
        results.push({ source: source.code, success: true, ...result });
      } else {
        // Adapters for legislation/RSS/web sources are deliberately separate.
        // Unsupported sources remain visible as not-yet-implemented rather than
        // silently treated as successful.
        results.push({
          source: source.code,
          success: false,
          skipped: true,
          reason: `No active adapter for ${source.source_type}`
        });
      }

      await supabaseAdmin
        .from("regulatory_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
          consecutive_failures: 0
        })
        .eq("id", source.id);
    } catch (e: any) {
      await supabaseAdmin
        .from("regulatory_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_error: e?.message ?? String(e),
          consecutive_failures: source.consecutive_failures + 1
        })
        .eq("id", source.id);

      results.push({
        source: source.code,
        success: false,
        error: e?.message ?? String(e)
      });
    }
  }

  return results;
}
