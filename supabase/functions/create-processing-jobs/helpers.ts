type StorageObject = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, unknown>;
};

export type JobRow = {
  organisation_id: string;
  client_id: string;
  batch_id: string;
  storage_path: string;
  status: "pending" | "processing" | "completed" | "failed";
};

type BuildJobRowsArgs = {
  organisationId: string;
  clientId: string;
  batchId: string;
  objects: StorageObject[];
  existingPaths?: Set<string>;
};

export function buildProcessingJobRows({
  organisationId,
  clientId,
  batchId,
  objects,
  existingPaths,
}: BuildJobRowsArgs): JobRow[] {
  const rows: JobRow[] = [];
  const prefix = `batches/${batchId}`;

  for (const object of objects) {
    if (!object.name || object.name.endsWith("/")) {
      continue;
    }

    const storagePath = `${prefix}/${object.name}`;
    if (existingPaths?.has(storagePath)) {
      continue;
    }

    rows.push({
      organisation_id: organisationId,
      client_id: clientId,
      batch_id: batchId,
      storage_path: storagePath,
      status: "processing",
    });
  }

  return rows;
}
 