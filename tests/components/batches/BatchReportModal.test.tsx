import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchReportModal } from "@/components/batches/BatchReportModal";

const sampleBatch = {
  id: "batch-1",
  organisation_id: "org-1",
  client_id: "client-1",
  period_label: "Jan 2025",
  status: "completed",
  total_files: 2,
  processed_files: 2,
  created_at: "2025-01-31T00:00:00.000Z",
};

const sampleTotals = {
  employeesProcessed: 1,
  critical: 1,
  warning: 0,
  info: 0,
};

const sampleEmployees = [
  {
    employeeId: "emp-1",
    employeeName: "Alice",
    employeeRef: "EMP001",
    payslipId: "pay-1",
    issues: { critical: 1, warning: 0, info: 0 },
  },
];

describe("BatchReportModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders batch summary and table rows", () => {
    render(
      <BatchReportModal
        open
        onClose={vi.fn()}
        batch={sampleBatch}
        totals={sampleTotals}
        employees={sampleEmployees}
      />
    );

    expect(screen.getByText(/Jan 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/Employees processed/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("EMP001")).toBeInTheDocument();
  });

  it("shows empty messaging when no employees present", () => {
    render(
      <BatchReportModal
        open
        onClose={vi.fn()}
        batch={sampleBatch}
        totals={{ ...sampleTotals, employeesProcessed: 0, critical: 0, warning: 0, info: 0 }}
        employees={[]}
      />
    );

    expect(screen.getByText(/no issues found for this batch/i)).toBeInTheDocument();
  });

  it("invokes window.print when clicking Print report", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(
      <BatchReportModal
        open
        onClose={vi.fn()}
        batch={sampleBatch}
        totals={sampleTotals}
        employees={sampleEmployees}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /print report/i }));
    expect(printSpy).toHaveBeenCalled();
  });
});

