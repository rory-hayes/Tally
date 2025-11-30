import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DashboardView } from "@/components/dashboard/DashboardView";

const mockUseDashboardSummary = vi.fn();

vi.mock("@/hooks/useDashboardSummary", () => ({
  useDashboardSummary: () => mockUseDashboardSummary(),
}));

const sampleData = [
  {
    id: "client-1",
    name: "Acme Ltd",
    country: "IE",
    payroll_system: "BrightPay",
    latestBatchPeriod: "April 2025",
    latestBatchDate: "2025-04-30",
    issueCounts: { critical: 2, warning: 3, info: 5 },
  },
];

describe("DashboardView", () => {
  beforeEach(() => {
    mockUseDashboardSummary.mockReset();
  });

  it("shows loading spinner", () => {
    mockUseDashboardSummary.mockReturnValue({
      status: "loading",
      data: [],
      error: null,
    });

    render(<DashboardView />);
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
  });

  it("renders dashboard table with issue counts", () => {
    mockUseDashboardSummary.mockReturnValue({
      status: "success",
      data: sampleData,
      error: null,
    });

    render(<DashboardView />);
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByTestId("critical-count")).toHaveTextContent("2");
    expect(screen.getByTestId("warning-count")).toHaveTextContent("3");
    expect(screen.getByTestId("info-count")).toHaveTextContent("5");
  });

  it("shows error message when loading fails", () => {
    mockUseDashboardSummary.mockReturnValue({
      status: "error",
      data: [],
      error: "Boom",
    });

    render(<DashboardView />);
    expect(
      screen.getByText(/Unable to load dashboard data/i)
    ).toBeInTheDocument();
  });
});

