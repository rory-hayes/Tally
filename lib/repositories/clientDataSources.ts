import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { DataSourceType } from "@/types/dataSources";

export type ClientDataSource = {
  id: string;
  organisation_id: string;
  client_id: string;
  type: DataSourceType;
  template_name: string | null;
  mapping_config: Record<string, unknown>;
  is_active: boolean;
  last_used_at: string | null;
  created_at?: string;
  updated_at?: string;
};

const COLUMNS =
  "id, organisation_id, client_id, type, template_name, mapping_config, is_active, last_used_at, created_at, updated_at";

export async function listClientDataSources(
  organisationId: string,
  clientId: string
): Promise<ClientDataSource[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("client_data_sources")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .order("type", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientDataSource[];
}

export async function upsertClientDataSource(
  organisationId: string,
  clientId: string,
  payload: Partial<ClientDataSource> & { type: DataSourceType }
): Promise<ClientDataSource> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("client_data_sources")
    .upsert(
      {
        organisation_id: organisationId,
        client_id: clientId,
        type: payload.type,
        template_name: payload.template_name ?? null,
        mapping_config: payload.mapping_config ?? {},
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organisation_id,client_id,type" }
    )
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save data source mapping");
  }

  return data as ClientDataSource;
}
