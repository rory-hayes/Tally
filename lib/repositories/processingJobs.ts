import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ProcessingJobRow = {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  storage_path: string;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function createProcessingJob(input: {
  organisationId: string;
  clientId: string;
  batchId: string;
  storagePath: string;
}): Promise<ProcessingJobRow> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("processing_jobs")
    .insert({
      organisation_id: input.organisationId,
      client_id: input.clientId,
      batch_id: input.batchId,
      storage_path: input.storagePath,
      status: "pending",
    })
    .select(
      "id, organisation_id, client_id, batch_id, storage_path, status, error, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create processing job");
  }

  return data as ProcessingJobRow;
}


