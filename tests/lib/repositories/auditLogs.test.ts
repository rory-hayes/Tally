import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAuditEvent } from "@/lib/repositories/auditLogs";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({
  insert: insertMock,
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

describe("logAuditEvent", () => {
  beforeEach(() => {
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("inserts audit log rows", async () => {
    await logAuditEvent({
      organisationId: "org-1",
      actorId: "user-1",
      action: "batch_created",
      metadata: { batchId: "batch-1" },
    });

    expect(fromMock).toHaveBeenCalledWith("audit_logs");
    expect(insertMock).toHaveBeenCalledWith({
      organisation_id: "org-1",
      user_id: "user-1",
      action: "batch_created",
      metadata: { batchId: "batch-1" },
    });
  });

  it("logs errors without throwing", async () => {
    const error = { message: "boom" };
    insertMock.mockResolvedValueOnce({ error });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await logAuditEvent({
      organisationId: "org-1",
      actorId: "user-1",
      action: "payslips_uploaded",
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

