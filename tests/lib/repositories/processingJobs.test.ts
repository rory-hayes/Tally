import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { createProcessingJob } from "@/lib/repositories/processingJobs";

const from = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReset();
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({ from } as any);
});

describe("processing jobs repository", () => {
  it("creates a processing job", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "job-1",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    from.mockReturnValueOnce({ insert });

    await createProcessingJob({
      organisationId: "org-1",
      clientId: "client-1",
      batchId: "batch-1",
      storagePath: "batches/batch-1/file.pdf",
    });

    expect(insert).toHaveBeenCalledWith({
      organisation_id: "org-1",
      client_id: "client-1",
      batch_id: "batch-1",
      storage_path: "batches/batch-1/file.pdf",
      status: "pending",
    });
  });
});


