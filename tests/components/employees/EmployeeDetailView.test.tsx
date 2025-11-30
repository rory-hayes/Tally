import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, vi } from "vitest";
import { EmployeeDetailView } from "@/components/employees/EmployeeDetailView";

const mockUseEmployeeComparison = vi.fn();

vi.mock("@/hooks/useEmployeeComparison", () => ({
  useEmployeeComparison: () => mockUseEmployeeComparison(),
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin" }),
}));

const sampleComparison = {
  employeeId: "emp-1",
  employeeName: "Alice",
  employeeRef: "EMP001",
  batchId: "batch-1",
  clientId: "client-1",
  currentPayslip: { id: "cur", net_pay: 2100, gross_pay: 3200 },
  previousPayslip: { id: "prev", net_pay: 2000, gross_pay: 3000 },
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
      resolved: false,
      note: null,
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

  it("renders employee summary and diff table", () => {
    render(<EmployeeDetailView employeeId="emp-1" batchId="batch-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Gross pay").length).toBeGreaterThan(0);
    expect(screen.getByText("Issues")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /mark as resolved/i }));

    fireEvent.change(screen.getByPlaceholderText("Note (optional)"), {
      target: { value: "Checked and OK" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() =>
      expect(toggleIssue).toHaveBeenCalledWith("issue-1", true, "Checked and OK")
    );
  });
});

