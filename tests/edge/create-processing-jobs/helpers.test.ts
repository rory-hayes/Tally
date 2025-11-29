import { describe, it, expect } from "vitest";
import { buildProcessingJobRows } from "@/supabase/functions/create-processing-jobs/helpers";

describe("buildProcessingJobRows", () => {
  it("creates pending job rows for each storage object", () => {
    const rows = buildProcessingJobRows({
      organisationId: "org-1",
      clientId: "client-1",
      batchId: "batch-1",
      objects: [{ name: "file-a.pdf" }, { name: "file-b.pdf" }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        organisation_id: "org-1",
        client_id: "client-1",
        batch_id: "batch-1",
        storage_path: "batches/batch-1/file-a.pdf",
        status: "processing",
      }),
      expect.objectContaining({
        storage_path: "batches/batch-1/file-b.pdf",
        status: "processing",
      }),
    ]);
  });

  it("skips folders and already processed files", () => {
    const rows = buildProcessingJobRows({
      organisationId: "org-1",
      clientId: "client-1",
      batchId: "batch-1",
      objects: [{ name: "folder/" }, { name: "file-a.pdf" }],
      existingPaths: new Set(["batches/batch-1/file-a.pdf"]),
    });

    expect(rows).toHaveLength(0);
  });
});
 