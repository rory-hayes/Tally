import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { RuleConfig } from "@/lib/rules/types";

export type BatchRuleSnapshot = {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  country: string | null;
  rule_pack_ids: string[];
  resolved_config: RuleConfig | Record<string, unknown>;
  created_at?: string;
};

const COLUMNS =
  "id, organisation_id, client_id, batch_id, country, rule_pack_ids, resolved_config, created_at";

export async function upsertBatchRuleSnapshot(input: {
  organisationId: string;
  clientId: string;
  batchId: string;
  country: string | null;
  rulePackIds: string[];
  resolvedConfig: RuleConfig;
}): Promise<BatchRuleSnapshot> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batch_rule_config_snapshot")
    .upsert(
      {
        organisation_id: input.organisationId,
        client_id: input.clientId,
        batch_id: input.batchId,
        country: input.country,
        rule_pack_ids: input.rulePackIds,
        resolved_config: input.resolvedConfig,
      },
      { onConflict: "batch_id" }
    )
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save rule config snapshot");
  }

  return data as BatchRuleSnapshot;
}

export async function fetchBatchRuleSnapshot(
  organisationId: string,
  batchId: string
): Promise<BatchRuleSnapshot | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batch_rule_config_snapshot")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data as BatchRuleSnapshot | null) ?? null;
}
