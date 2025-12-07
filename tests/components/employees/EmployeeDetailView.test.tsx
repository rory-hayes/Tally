import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, vi } from "vitest";
import { EmployeeDetailView } from "@/components/employees/EmployeeDetailView";

const mockUseEmployeeComparison = vi.fn();

vi.mock("@/hooks/useEmployeeComparison", () => ({
  useEmployeeComparison: () => mockUseEmployeeComparison(),
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin", profileId: "profile-current" }),
}));

const sampleComparison = {
  employeeId: "emp-1",
  employeeName: "Alice",
  employeeRef: "EMP001",
  batchId: "batch-1",
  clientId: "client-1",
  currentBatchPeriodLabel: "February 2025",
  previousBatchPeriodLabel: "January 2025",
  currentBatchPayDate: "2025-02-28",
  previousBatchPayDate: "2025-01-31",
  currentPayslip: { id: "cur", net_pay: 2100, gross_pay: 3200, pay_date: "2025-02-28" },
  previousPayslip: { id: "prev", net_pay: 2000, gross_pay: 3000, pay_date: "2025-01-31" },
  diff: {
    gross_pay: { previous: 3000, current: 3200, delta: 200, percentChange: 6.7 },
    net_pay: { previous: 2000, current: 2100, delta: 100, percentChange: 5 },
    paye: { previous: 600, current: 650, delta: 50, percentChange: 8.3 },
    usc_or_ni: { previous: 120, current: 130, delta: 10, percentChange: 8.3 },
    pension_employee: { previous: 150, current: 160, delta: 10, percentChange: 6.6 },
    pension_employer: { previous: 180, current: 190, delta: 10, percentChange: 5.5 },
    ytd_gross: { previous: 15000, current: 18200, delta: 3200, percentChange: 21.3 },
    ytd_net: { previous: 12000, current: 15100, delta: 3100, percentChange: 25.8 },
    ytd_tax: { previous: 3000, current: 3300, delta: 300, percentChange: 10 },
    ytd_usc_or_ni: { previous: 700, current: 730, delta: 30, percentChange: 4.2 },
  },
  issues: [
    {
      id: "issue-1",
      rule_code: "NET_CHANGE_LARGE",
      severity: "warning",
      description: "Net pay increased significantly",
      data: {
        field: "paye",
        previousValue: 600,
        currentValue: 750,
        difference: 150,
        percentChange: 25,
        grossPercentChange: 2,
      },
      resolved: false,
      note: null,
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: "issue-2",
      rule_code: "USC_SPIKE_WITHOUT_GROSS",
      severity: "warning",
      description: "USC spiked",
      data: null,
      resolved: true,
      note: null,
      resolved_at: "2025-03-01T10:00:00.000Z",
      resolved_by: "profile-current",
    },
    {
      id: "issue-3",
      rule_code: "ocr_ingest",
      severity: "info",
      description: "OCR ingestion captured 1024 characters",
      data: null,
      resolved: false,
      note: null,
      resolved_at: null,
      resolved_by: null,
    },
  ],
};

describe("EmployeeDetailView", () => {
  beforeEach(() => {
    mockUseEmployeeComparison.mockReturnValue({
      status: "success",
      data: sampleComparison,
      error: null,
      toggleIssue: vi.fn(),
    });
  });

  it("renders employee summary, diff table, and formatted pay dates", () => {
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Gross pay").length).toBeGreaterThan(0);
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText(/February 28, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/January 31, 2025/)).toBeInTheDocument();
  });

  it("opens resolve modal and calls toggleIssue", async () => {
    const toggleIssue = vi.fn();
    mockUseEmployeeComparison.mockReturnValue({
      status: "success",
      data: sampleComparison,
      error: null,
      toggleIssue,
    });

    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);

    const resolveButtons = screen.getAllByRole("button", { name: /mark as resolved/i });
    fireEvent.click(resolveButtons[0]);

    fireEvent.change(screen.getByPlaceholderText("Note (optional)"), {
      target: { value: "Checked and OK" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() =>
      expect(toggleIssue).toHaveBeenCalledWith("issue-1", true, "Checked and OK")
    );
  });

  it("renders resolved issues with secondary styling and tooltip metadata", () => {
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    const resolved = screen.getByText(/usc spiked/i).closest("span");
    expect(resolved).toHaveClass("ant-typography-secondary");
    expect(resolved?.getAttribute("data-resolved-info")).toMatch(/Resolved by you on/);
  });

  it("shows structured issue data when provided", () => {
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.getAllByText("€600.00").length).toBeGreaterThan(0);
    expect(screen.getByText("+€150.00")).toBeInTheDocument();
    expect(screen.getAllByText("25.0%").length).toBeGreaterThan(0);
  });

  it("filters out noisy OCR ingestion issues", () => {
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.queryByText(/OCR ingestion captured/i)).not.toBeInTheDocument();
  });

  it("falls back to batch period when pay date missing", () => {
    const comparison = {
      ...sampleComparison,
      currentPayslip: { ...sampleComparison.currentPayslip, pay_date: null },
      currentBatchPayDate: null,
      currentBatchPeriodLabel: "March 2025",
    };
    mockUseEmployeeComparison.mockReturnValueOnce({
      status: "success",
      data: comparison,
      error: null,
      toggleIssue: vi.fn(),
    });
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.getByText(/March 2025/)).toBeInTheDocument();
  });

  it("uses batch pay date when payslip pay date is absent", () => {
    const comparison = {
      ...sampleComparison,
      currentPayslip: { ...sampleComparison.currentPayslip, pay_date: null },
      currentBatchPayDate: "2025-02-25",
    };
    mockUseEmployeeComparison.mockReturnValueOnce({
      status: "success",
      data: comparison,
      error: null,
      toggleIssue: vi.fn(),
    });
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.getByText(/February 25, 2025/)).toBeInTheDocument();
  });
});
