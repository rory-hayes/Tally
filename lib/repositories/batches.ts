import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type BatchRow = {
  id: string;
  organisation_id: string;
  client_id: string;
  period_label: string;
  status: string;
  total_files: number;
  processed_files: number;
  notes: string | null;
  employees_processed?: number;
};

export type CreateBatchInput = {
  clientId: string;
  periodLabel: string;
  totalFiles: number;
  processedFiles?: number;
  status?: "pending" | "processing" | "completed" | "failed";
  notes?: string | null;
};

const BATCH_COLUMNS =
  "id, organisation_id, client_id, period_label, status, total_files, processed_files, notes";

type BatchEmployeeRow = {
  batch_id: string | null;
  employee_id: string | null;
};

export const calculateBatchEmployeeCounts = (
  rows: BatchEmployeeRow[] | null | undefined
) => {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  (rows ?? []).forEach((row) => {
    if (!row.batch_id || !row.employee_id) {
      return;
    }
    const key = `${row.batch_id}:${row.employee_id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    counts.set(row.batch_id, (counts.get(row.batch_id) ?? 0) + 1);
  });
  return counts;
};

export async function createBatchForClient(
  organisationId: string,
  input: CreateBatchInput
): Promise<BatchRow> {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    organisation_id: organisationId,
    client_id: input.clientId,
    period_label: input.periodLabel,
    status: input.status ?? "pending",
    total_files: input.totalFiles,
    processed_files: input.processedFiles ?? 0,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("batches")
    .insert(payload)
    .select(BATCH_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create batch");
  }

  return data as unknown as BatchRow;
}

export async function getBatchesForClient(
  organisationId: string,
  clientId: string
): Promise<BatchRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data: payslipRows, error: payslipError } = await supabase
    .from("payslips")
    .select("batch_id, employee_id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId);

  if (payslipError) {
    throw new Error(`Failed to load batch employee counts: ${payslipError.message}`);
  }

  const counts = calculateBatchEmployeeCounts(
    payslipRows as BatchEmployeeRow[] | null
  );

  const batchRows = (data ?? []) as unknown as BatchRow[];
  return batchRows.map((batch) => ({
    ...batch,
    employees_processed: counts.get(batch.id) ?? 0,
  }));
}

export async function getBatchById(
  organisationId: string,
  batchId: string
): Promise<BatchRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("id", batchId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data ?? null) as BatchRow | null;
}

export async function updateBatchStatus(
  organisationId: string,
  batchId: string,
  updates: Partial<
    Pick<
      BatchRow,
      "status" | "total_files" | "processed_files" | "notes"
    >
  >
): Promise<BatchRow> {
  const supabase = getSupabaseBrowserClient();
  const sanitizedEntries = Object.entries(updates).filter(
    ([, value]) => value !== undefined
  );

  if (sanitizedEntries.length === 0) {
    throw new Error("No batch updates provided");
  }

  const sanitized = Object.fromEntries(sanitizedEntries);

  const { data, error } = await supabase
    .from("batches")
    .update(sanitized)
    .eq("organisation_id", organisationId)
    .eq("id", batchId)
    .select(BATCH_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update batch");
  }

  return data as unknown as BatchRow;
}


