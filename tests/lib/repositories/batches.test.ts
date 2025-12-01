import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  calculateBatchEmployeeCounts,
  createBatchForClient,
  getBatchesForClient,
  updateBatchStatus,
} from "@/lib/repositories/batches";

const from = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReset();
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({ from } as any);
});

describe("batches repository", () => {
  it("creates batches with required fields", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "batch-1",
        status: "pending",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    from.mockReturnValueOnce({ insert });

    await createBatchForClient("org-1", {
      clientId: "client-1",
      periodLabel: "Jan 2025",
      totalFiles: 5,
    });

    expect(insert).toHaveBeenCalledWith({
      organisation_id: "org-1",
      client_id: "client-1",
      period_label: "Jan 2025",
      status: "pending",
      total_files: 5,
      processed_files: 0,
      notes: null,
    });
    expect(select).toHaveBeenCalledWith(
      "id, organisation_id, client_id, period_label, status, total_files, processed_files, notes"
    );
  });

  it("lists batches scoped by org and client", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn();
    eq.mockReturnValueOnce({ eq, order });
    eq.mockReturnValueOnce({ order });
    const select = vi.fn().mockReturnValue({ eq });

    const payEqClient = vi.fn().mockResolvedValue({ data: [], error: null });
    const payEqOrg = vi.fn().mockReturnValue({ eq: payEqClient });
    const paySelect = vi.fn().mockReturnValue({ eq: payEqOrg });

    from.mockReturnValueOnce({ select });
    from.mockReturnValueOnce({ select: paySelect });

    await getBatchesForClient("org-1", "client-9");

    expect(eq).toHaveBeenNthCalledWith(1, "organisation_id", "org-1");
    expect(eq).toHaveBeenNthCalledWith(2, "client_id", "client-9");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(payEqOrg).toHaveBeenCalledWith("organisation_id", "org-1");
    expect(payEqClient).toHaveBeenCalledWith("client_id", "client-9");
  });

  it("updates batch status within organisation", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "batch-1", status: "processing" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn();
    eq.mockReturnValueOnce({ eq, select });
    eq.mockReturnValueOnce({ select });
    const update = vi.fn().mockReturnValue({ eq });
    from.mockReturnValueOnce({ update });

    await updateBatchStatus("org-1", "batch-1", { status: "processing" });

    expect(update).toHaveBeenCalledWith({ status: "processing" });
    expect(eq).toHaveBeenNthCalledWith(1, "organisation_id", "org-1");
    expect(eq).toHaveBeenNthCalledWith(2, "id", "batch-1");
    expect(select).toHaveBeenCalledWith(
      "id, organisation_id, client_id, period_label, status, total_files, processed_files, notes"
    );
  });

  it("throws when update payload empty", async () => {
    await expect(
      updateBatchStatus("org", "batch", {})
    ).rejects.toThrow(/No batch updates/);
  });
});

describe("calculateBatchEmployeeCounts", () => {
  it("returns unique employee counts per batch", () => {
    const counts = calculateBatchEmployeeCounts([
      { batch_id: "batch-1", employee_id: "A" },
      { batch_id: "batch-1", employee_id: "A" },
      { batch_id: "batch-1", employee_id: "B" },
      { batch_id: "batch-2", employee_id: "C" },
      { batch_id: null, employee_id: "Z" },
    ]);

    expect(counts.get("batch-1")).toBe(2);
    expect(counts.get("batch-2")).toBe(1);
  });
});


