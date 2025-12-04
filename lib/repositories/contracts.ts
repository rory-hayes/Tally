import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const CONTRACT_COLUMNS = [
  "id",
  "organisation_id",
  "client_id",
  "employee_id",
  "salary_amount",
  "salary_period",
  "hourly_rate",
  "standard_hours_per_week",
  "effective_from",
  "effective_to",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

export type ContractRow = {
  id: string;
  organisation_id: string;
  client_id: string | null;
  employee_id: string;
  salary_amount: number | null;
  salary_period: string | null;
  hourly_rate: number | null;
  standard_hours_per_week: number | null;
  effective_from: string | null;
  effective_to: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type ContractUpsertInput = {
  client_id?: string | null;
  salary_amount?: number | null;
  salary_period?: string | null;
  hourly_rate?: number | null;
  standard_hours_per_week?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  metadata?: Record<string, unknown> | null;
};

const sanitizePayload = <T extends Record<string, unknown>>(payload: T) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;

export async function getContractForEmployee(
  organisationId: string,
  employeeId: string
): Promise<ContractRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(CONTRACT_COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data ?? null) as ContractRow | null;
}

export async function upsertContract(
  organisationId: string,
  employeeId: string,
  payload: ContractUpsertInput
): Promise<ContractRow> {
  const supabase = getSupabaseBrowserClient();
  const sanitized = sanitizePayload(payload);
  const { data, error } = await supabase
    .from("contracts")
    .upsert(
      {
        organisation_id: organisationId,
        employee_id: employeeId,
        ...sanitized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id" }
    )
    .select(CONTRACT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save contract");
  }

  return data as unknown as ContractRow;
}
