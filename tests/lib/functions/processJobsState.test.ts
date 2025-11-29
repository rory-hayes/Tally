import { describe, it, expect, vi } from "vitest";
import { markJobStatusRecord } from "@/supabase/functions/process-ocr-jobs/helpers";

describe("job status transitions", () => {
  it("updates processing_jobs row with completed status", async () => {
    const eq = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    await markJobStatusRecord({ from } as never, "job-1", true);

    expect(from).toHaveBeenCalledWith("processing_jobs");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", error: null })
    );
    expect(eq).toHaveBeenCalledWith("id", "job-1");
  });

  it("records error details when a job fails", async () => {
    const eq = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    await markJobStatusRecord(
      { from } as never,
      "job-2",
      false,
      "Parsing failed"
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "Parsing failed",
      })
    );
  });
});

