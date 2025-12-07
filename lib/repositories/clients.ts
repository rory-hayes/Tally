import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const CLIENT_FIELDS = ["id", "name", "country", "payroll_system"] as const;
const CLIENT_COLUMNS = CLIENT_FIELDS.join(", ");

export type ClientRow = {
  id: string;
  name: string;
  country: string | null;
  payroll_system: string | null;
  employees_processed?: number;
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

export type ClientEmployeeRow = {
  client_id: string | null;
  employee_id: string | null;
};

export const calculateClientEmployeeCounts = (
  rows: ClientEmployeeRow[] | null | undefined
) => {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  (rows ?? []).forEach((row) => {
    if (!row.client_id || !row.employee_id) {
      return;
    }
    const occurrenceKey = `${row.client_id}:${row.employee_id}`;
    if (seen.has(occurrenceKey)) {
      return;
    }
    seen.add(occurrenceKey);
    counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
  });
  return counts;
};

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

  const { data: payslipRows, error: payslipError } = await supabase
    .from("payslips")
    .select("client_id, employee_id")
    .eq("organisation_id", organisationId);

  if (payslipError) {
    throw new Error(
      `Failed to load client employee counts: ${payslipError.message}`
    );
  }

  const counts = calculateClientEmployeeCounts(
    payslipRows as ClientEmployeeRow[] | null
  );

  const clientRows = (data ?? []) as unknown as ClientRow[];
  return clientRows.map((client) => ({
    ...client,
    employees_processed: counts.get(client.id) ?? 0,
  }));
}

export const getClientsForOrganisation = getClientsForOrg;

export async function createClient(
  organisationId: string,
  input: ClientCreateInput
): Promise<ClientRow> {
  const supabase = getSupabaseBrowserClient();
  const payrollSystem =
    typeof input.payroll_system === "string" && input.payroll_system.trim().length
      ? input.payroll_system.trim()
      : "Unknown";
  const payload = sanitizePayload({
    ...input,
    payroll_system: payrollSystem,
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
  const sanitized = sanitizePayload({
    ...updates,
    payroll_system:
      updates.payroll_system !== undefined
        ? updates.payroll_system?.trim() || "Unknown"
        : undefined,
  });
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

export async function getClientById(
  organisationId: string,
  clientId: string
): Promise<ClientRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("id", clientId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data ?? null) as ClientRow | null;
}
