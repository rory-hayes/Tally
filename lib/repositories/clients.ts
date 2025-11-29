import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const CLIENT_FIELDS = ["id", "name", "country", "payroll_system"] as const;
const CLIENT_COLUMNS = CLIENT_FIELDS.join(", ");

export type ClientRow = {
  id: string;
  name: string;
  country: string | null;
  payroll_system: string | null;
};

export type ClientCreateInput = {
  name: string;
  country?: string | null;
  payroll_system?: string | null;
};

export type ClientUpdateInput = Partial<ClientCreateInput>;

function sanitizePayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as T;
}

export async function getClientsForOrg(
  organisationId: string
): Promise<ClientRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("organisation_id", organisationId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`);
  }

  return (data ?? []) as unknown as ClientRow[];
}

export const getClientsForOrganisation = getClientsForOrg;

export async function createClient(
  organisationId: string,
  input: ClientCreateInput
): Promise<ClientRow> {
  const supabase = getSupabaseBrowserClient();
  const payload = sanitizePayload({
    ...input,
    organisation_id: organisationId,
  });

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select(CLIENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create client");
  }

  return data as unknown as ClientRow;
}

export async function updateClient(
  organisationId: string,
  clientId: string,
  updates: ClientUpdateInput
): Promise<ClientRow> {
  const sanitized = sanitizePayload(updates);
  if (Object.keys(sanitized).length === 0) {
    throw new Error("No client fields were provided to update.");
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clients")
    .update(sanitized)
    .eq("organisation_id", organisationId)
    .eq("id", clientId)
    .select(CLIENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update client");
  }

  return data as unknown as ClientRow;
}

export async function deleteClient(
  organisationId: string,
  clientId: string
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("id", clientId);

  if (error) {
    throw new Error(error.message);
  }
}

