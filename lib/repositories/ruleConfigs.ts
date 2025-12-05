import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { RuleConfig } from "@/lib/rules/types";

export type RuleConfigRow = {
  id: string;
  organisation_id: string;
  client_id: string;
  config: Partial<RuleConfig> & Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const COLUMNS = "id, organisation_id, client_id, config, created_at, updated_at";

export async function fetchRuleConfig(
  organisationId: string,
  clientId: string
): Promise<RuleConfigRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("client_rule_config")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data as RuleConfigRow | null) ?? null;
}

export async function upsertRuleConfig(
  organisationId: string,
  clientId: string,
  config: Partial<RuleConfig> & Record<string, unknown>
): Promise<RuleConfigRow> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("client_rule_config")
    .upsert(
      {
        organisation_id: organisationId,
        client_id: clientId,
        config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organisation_id,client_id" }
    )
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save rule configuration");
  }

  return data as RuleConfigRow;
}

export async function deleteRuleConfig(
  organisationId: string,
  clientId: string
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("client_rule_config")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(error.message);
  }
}
