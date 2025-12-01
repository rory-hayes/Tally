import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach } from "vitest";
import { BatchDetailView } from "@/components/batches/BatchDetailView";

const mockUseBatchDetail = vi.fn();
const downloadCsvMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useBatchDetail", () => ({
  useBatchDetail: () => mockUseBatchDetail(),
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/repositories/batches", () => ({
  updateBatchStatus: vi.fn(),
}));

vi.mock("@/lib/storage/batchUploads", () => ({
  uploadBatchFiles: vi.fn(),
}));

vi.mock("@/lib/functions/createProcessingJobs", () => ({
  invokeCreateProcessingJobs: vi.fn(),
}));

vi.mock("@/lib/functions/downloadBatchIssuesCsv", () => ({
  downloadBatchIssuesCsv: (...args: unknown[]) => downloadCsvMock(...args),
}));

vi.mock("@/components/batches/BatchReportModal", () => ({
  BatchReportModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="batch-report-modal">
        <button onClick={onClose}>Close report</button>
      </div>
    ) : null,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const sampleDetail = {
  batch: {
    id: "batch-1",
    organisation_id: "org-123",
    client_id: "client-1",
    period_label: "May 2025",
    status: "processing",
    total_files: 5,
    processed_files: 3,
    created_at: "2025-05-01T12:00:00Z",
  },
  employees: [
    {
      employeeId: "emp-1",
      employeeName: "Alice",
      employeeRef: "EMP001",
      payslipId: "p-1",
      issues: { critical: 1, warning: 2, info: 0 },
    },
  ],
  totals: {
    employeesProcessed: 1,
    critical: 1,
    warning: 2,
    info: 0,
  },
};

describe("BatchDetailView", () => {
  beforeEach(() => {
    mockUseBatchDetail.mockReturnValue({
      status: "success",
      data: sampleDetail,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("renders summary metrics", () => {
    render(<BatchDetailView batchId="batch-1" />);
    const employeesCard = screen.getByText("Employees processed").parentElement;
    expect(employeesCard).toHaveTextContent("1");
    const criticalCard = screen.getByText("Critical issues").parentElement;
    expect(criticalCard).toHaveTextContent("1");
  });

  it("renders employees table", () => {
    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("EMP001")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("links employees to the employee detail view", () => {
    render(<BatchDetailView batchId="batch-1" />);
    const link = screen.getByRole("link", { name: /view/i });
    expect(link).toHaveAttribute(
      "href",
      "/clients/client-1/employees/emp-1?batchId=batch-1"
    );
  });

  it("triggers CSV download when button clicked", async () => {
    render(<BatchDetailView batchId="batch-1" />);
    fireEvent.click(screen.getByRole("button", { name: /download csv/i }));
    await waitFor(() => expect(downloadCsvMock).toHaveBeenCalledWith("batch-1"));
  });

  it("opens the printable report modal", async () => {
    render(<BatchDetailView batchId="batch-1" />);
    fireEvent.click(screen.getByRole("button", { name: /view report/i }));
    expect(screen.getByTestId("batch-report-modal")).toBeInTheDocument();
  });

  it("shows spinner while loading", () => {
    mockUseBatchDetail.mockReturnValue({
      status: "loading",
      data: null,
      error: null,
      refresh: vi.fn(),
    });

    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByLabelText(/loading batch/i)).toBeInTheDocument();
  });

  it("renders Empty state when no employees", () => {
    mockUseBatchDetail.mockReturnValue({
      status: "success",
      data: {
        ...sampleDetail,
        employees: [],
        totals: { employeesProcessed: 0, critical: 0, warning: 0, info: 0 },
      },
      error: null,
      refresh: vi.fn(),
    });

    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByText(/No employees processed yet/i)).toBeInTheDocument();
  });
});

