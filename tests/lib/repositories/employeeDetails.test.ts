import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateIssueResolution } from "@/lib/repositories/employeeDetails";

const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({
  eq: eqMock,
}));
const fromMock = vi.fn(() => ({
  update: updateMock,
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

const auditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/repositories/auditLogs", () => ({
  logAuditEvent: auditLogMock,
}));

describe("updateIssueResolution", () => {
  beforeEach(() => {
    auditLogMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("logs when audit metadata provided", async () => {
    await updateIssueResolution({
      issueId: "issue-1",
      resolved: true,
      note: "done",
      audit: {
        organisationId: "org-1",
        actorId: "user-1",
        batchId: "batch-1",
        employeeId: "emp-1",
      },
    });

    expect(auditLogMock).toHaveBeenCalledWith({
      organisationId: "org-1",
      actorId: "user-1",
      action: "issue_resolved",
      metadata: {
        issueId: "issue-1",
        batchId: "batch-1",
        employeeId: "emp-1",
        note: "done",
      },
    });
  });

  it("skips audit when metadata missing", async () => {
    await updateIssueResolution({
      issueId: "issue-1",
      resolved: false,
    });
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

