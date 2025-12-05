import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { BatchReportModal } from "@/components/batches/BatchReportModal";
import type { BatchDetail } from "@/lib/repositories/batchDetails";

const batch: BatchDetail["batch"] = {
  id: "batch-1",
  organisation_id: "org-1",
  client_id: "client-1",
  period_label: "2025-04",
  status: "completed",
  total_files: 2,
  processed_files: 2,
  created_at: new Date().toISOString(),
};

const totals: BatchDetail["totals"] = {
  employeesProcessed: 2,
  critical: 1,
  warning: 0,
  info: 1,
};

const employees: BatchDetail["employees"] = [
  {
    employeeId: "emp1",
    employeeName: "Alice",
    employeeRef: "A01",
    payslipId: "ps1",
    issues: { critical: 1, warning: 0, info: 0 },
  },
  {
    employeeId: "emp2",
    employeeName: "Bob",
    employeeRef: "B02",
    payslipId: "ps2",
    issues: { critical: 0, warning: 0, info: 1 },
  },
];

describe("BatchReportModal print", () => {
  it("opens a print window when Print report is clicked", () => {
    const openSpy = vi.fn(() => ({
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    })) as unknown as typeof window.open;

    const originalOpen = window.open;
    // @ts-expect-error override for test
    window.open = openSpy;

    render(
      <BatchReportModal
        open
        onClose={() => undefined}
        batch={batch}
        totals={totals}
        employees={employees}
      />
    );

    fireEvent.click(screen.getByText("Print report"));

    expect(openSpy).toHaveBeenCalled();

    window.open = originalOpen;
  });
});
