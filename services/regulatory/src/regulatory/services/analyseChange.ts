import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { simpleLineDiff } from "../analysis/diff";
import {
  REGULATORY_ANALYSIS_PROMPT_VERSION,
  buildRegulatoryAnalysisPrompt
} from "../analysis/prompt";
import type { RegulatoryAnalysis } from "../../types/regulatory";

export interface JsonModel {
  generateJson(prompt: string): Promise<{
    provider: string;
    model: string;
    value: RegulatoryAnalysis;
  }>;
}

export async function analyseRegulatoryChange(
  changeId: string,
  model: JsonModel
) {
  const { data: change, error: changeError } = await supabaseAdmin
    .from("regulatory_changes")
    .select(`
      *,
      regulatory_documents(*),
      from_version:regulatory_document_versions!regulatory_changes_from_version_id_fkey(*),
      to_version:regulatory_document_versions!regulatory_changes_to_version_id_fkey(*)
    `)
    .eq("id", changeId)
    .single();

  if (changeError) throw changeError;

  const doc: any = change.regulatory_documents;
  const before = (change.from_version as any)?.raw_content ?? "";
  const after = (change.to_version as any)?.raw_content ?? "";
  const diff = simpleLineDiff(before, after);

  const { data: mappings } = await supabaseAdmin
    .from("regulatory_topic_mappings")
    .select("*")
    .eq("is_active", true);

  const prompt = buildRegulatoryAnalysisPrompt({
    title: doc.title,
    canonicalUrl: doc.canonical_url,
    organisation: doc.organisation,
    previousContent: before,
    currentContent: after,
    diff,
    topicMappings: mappings ?? []
  });

  await supabaseAdmin
    .from("regulatory_changes")
    .update({
      status: "analysing",
      machine_diff: diff
    })
    .eq("id", changeId);

  const generated = await model.generateJson(prompt);
  const a = generated.value;

  validateAnalysis(a);

  const { data: existing } = await supabaseAdmin
    .from("regulatory_analyses")
    .select("analysis_version")
    .eq("regulatory_change_id", changeId)
    .order("analysis_version", { ascending: false })
    .limit(1);

  const version = (existing?.[0]?.analysis_version ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("regulatory_analyses")
    .insert({
      regulatory_change_id: changeId,
      analysis_version: version,
      model_provider: generated.provider,
      model_name: generated.model,
      prompt_version: REGULATORY_ANALYSIS_PROMPT_VERSION,
      summary: a.summary,
      what_changed: a.whatChanged,
      why_it_matters: a.whyItMatters,
      proposed_effective_date: a.proposedEffectiveDate ?? null,
      urgency: a.urgency,
      confidence: a.confidence,
      affected_compliance_domains: a.affectedComplianceDomains,
      affected_asset_type_codes: a.affectedAssetTypeCodes,
      affected_template_codes: a.affectedTemplateCodes,
      proposed_actions: a.proposedActions,
      citations: a.citations,
      requires_legal_review: a.requiresLegalReview
    })
    .select()
    .single();

  if (error) throw error;

  await supabaseAdmin
    .from("regulatory_changes")
    .update({
      status: "awaiting_review",
      significance_score: significance(a, diff),
      detected_summary: a.summary
    })
    .eq("id", changeId);

  return data;
}

function validateAnalysis(a: RegulatoryAnalysis) {
  if (!a.summary || !a.whatChanged || !a.whyItMatters) {
    throw new Error("Incomplete regulatory analysis");
  }
  if (a.confidence < 0 || a.confidence > 100) {
    throw new Error("Invalid confidence");
  }
  if (!Array.isArray(a.citations) || a.citations.length === 0) {
    throw new Error("Regulatory analysis requires source citation");
  }
}

function significance(a: RegulatoryAnalysis, diff: any) {
  const urgencyWeight: Record<string, number> = {
    low: 15,
    medium: 40,
    high: 70,
    critical: 90,
    unknown: 25
  };

  const diffWeight = Math.min(10, (diff.changedLineCount ?? 0) / 10);
  return Math.min(100, urgencyWeight[a.urgency] + diffWeight);
}
