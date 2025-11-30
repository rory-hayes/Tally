import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, beforeEach } from "vitest";
import { BatchDetailView } from "@/components/batches/BatchDetailView";

const mockUseBatchDetail = vi.fn();

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
});

