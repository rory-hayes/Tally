import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const CLIENT_FIELDS = ["id", "name", "country", "payroll_system"] as const;

export type ClientRow = {
  id: string;
  name: string;
  country: string | null;
  payroll_system: string | null;
};

export async function getClientsForOrganisation(
  organisationId: string
): Promise<ClientRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_FIELDS.join(", "))
    .eq("organisation_id", organisationId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`);
  }

  return (data ?? []) as unknown as ClientRow[];
}

