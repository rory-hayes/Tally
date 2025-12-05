import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { DataSourceType } from "@/types/dataSources";

export type BatchDataFile = {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  type: DataSourceType;
  storage_path: string;
  original_filename: string | null;
  uploaded_at: string;
  parsed_status: "pending" | "parsed" | "failed";
  parsed_error: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

const COLUMNS =
  "id, organisation_id, client_id, batch_id, type, storage_path, original_filename, uploaded_at, parsed_status, parsed_error, meta, created_at, updated_at";

export async function recordBatchDataFile(input: {
  organisationId: string;
  clientId: string;
  batchId: string;
  type: DataSourceType;
  storagePath: string;
  originalFilename?: string | null;
  parsedStatus?: BatchDataFile["parsed_status"];
  parsedError?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<BatchDataFile> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batch_data_files")
    .insert({
      organisation_id: input.organisationId,
      client_id: input.clientId,
      batch_id: input.batchId,
      type: input.type,
      storage_path: input.storagePath,
      original_filename: input.originalFilename ?? null,
      parsed_status: input.parsedStatus ?? "pending",
      parsed_error: input.parsedError ?? null,
      meta: input.meta ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to record batch data file");
  }

  return data as BatchDataFile;
}

export async function listBatchDataFiles(
  organisationId: string,
  batchId: string
): Promise<BatchDataFile[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("batch_data_files")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BatchDataFile[];
}
