import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function createRuleChangeProposal(params: {
  changeId: string;
  existingRuleId?: string | null;
  existingRuleVersionId?: string | null;
  proposedRuleCode?: string | null;
  proposedRuleName?: string | null;
  proposal: Record<string, unknown>;
  rationale: string;
  sourceReferences: unknown[];
  proposedBy?: string | null;
}) {
  // Important: this creates a PROPOSAL only.
  // It never inserts directly into compliance_rule_versions.
  const { data, error } = await supabaseAdmin
    .from("rule_change_proposals")
    .insert({
      regulatory_change_id: params.changeId,
      existing_rule_id: params.existingRuleId ?? null,
      existing_rule_version_id: params.existingRuleVersionId ?? null,
      proposed_rule_code: params.proposedRuleCode ?? null,
      proposed_rule_name: params.proposedRuleName ?? null,
      proposal: params.proposal,
      rationale: params.rationale,
      source_references: params.sourceReferences,
      status: "awaiting_review",
      proposed_by: params.proposedBy ?? null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
