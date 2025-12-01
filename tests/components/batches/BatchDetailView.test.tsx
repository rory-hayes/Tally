import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach } from "vitest";
import { BatchDetailView } from "@/components/batches/BatchDetailView";

const mockUseBatchDetail = vi.fn();
const downloadCsvMock = vi.fn().mockResolvedValue(undefined);
const uploadBatchFilesMock = vi.fn().mockResolvedValue(undefined);
const updateBatchStatusMock = vi.fn().mockResolvedValue(undefined);
const invokeProcessingMock = vi.fn().mockResolvedValue(undefined);
const logAuditMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useBatchDetail", () => ({
  useBatchDetail: () => mockUseBatchDetail(),
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({
    organisationId: "org-123",
    profileId: "profile-1",
    role: "admin",
  }),
}));

vi.mock("@/lib/repositories/batches", () => ({
  updateBatchStatus: (...args: unknown[]) => updateBatchStatusMock(...args),
}));

vi.mock("@/lib/storage/batchUploads", () => ({
  uploadBatchFiles: (...args: unknown[]) => uploadBatchFilesMock(...args),
}));

vi.mock("@/lib/functions/createProcessingJobs", () => ({
  invokeCreateProcessingJobs: (...args: unknown[]) => invokeProcessingMock(...args),
}));

vi.mock("@/lib/functions/downloadBatchIssuesCsv", () => ({
  downloadBatchIssuesCsv: (...args: unknown[]) => downloadCsvMock(...args),
}));

vi.mock("@/lib/repositories/auditLogs", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditMock(...args),
}));

vi.mock("@/components/batches/BatchReportModal", () => ({
  BatchReportModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="batch-report-modal">
        <button onClick={onClose}>Close report</button>
      </div>
    ) : null,
}));

const draggerHandle: { beforeUpload?: (file: unknown) => unknown } = {};

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  const MockDragger = (props: any) => {
    draggerHandle.beforeUpload = props.beforeUpload;
    return (
      <div data-testid="upload-dragger">
        {props.children}
      </div>
    );
  };
  return {
    ...actual,
    Upload: {
      Dragger: MockDragger,
    },
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

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
    {
      employeeId: "emp-2",
      employeeName: "Bob",
      employeeRef: "EMP002",
      payslipId: "p-2",
      issues: { critical: 0, warning: 1, info: 1 },
    },
  ],
  totals: {
    employeesProcessed: 2,
    critical: 1,
    warning: 3,
    info: 1,
  },
  jobs: {
    pending: 0,
    processing: 0,
    completed: 2,
    failed: 0,
    failedJobs: [],
  },
};

let refreshMock: ReturnType<typeof vi.fn>;

describe("BatchDetailView", () => {
  beforeEach(() => {
    uploadBatchFilesMock.mockClear();
    updateBatchStatusMock.mockClear();
    invokeProcessingMock.mockClear();
    logAuditMock.mockClear();
    downloadCsvMock.mockClear();
    draggerHandle.beforeUpload = undefined;
    refreshMock = vi.fn().mockResolvedValue(undefined);
    mockUseBatchDetail.mockReturnValue({
      status: "success",
      data: sampleDetail,
      error: null,
      refresh: refreshMock,
    });
  });

  it("renders summary metrics", () => {
    render(<BatchDetailView batchId="batch-1" />);
    const employeesCard = screen.getByText("Employees processed").parentElement;
    expect(employeesCard).toHaveTextContent("2");
    const criticalCard = screen.getByText("Critical issues").parentElement;
    expect(criticalCard).toHaveTextContent("1");
    const warningCard = screen.getByText("Warnings").parentElement;
    expect(warningCard).toHaveTextContent("3");
  });

  it("renders employees table", () => {
    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("EMP001")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /view/i })).toHaveLength(2);
  });

  it("links employees to the employee detail view", () => {
    render(<BatchDetailView batchId="batch-1" />);
    const [link] = screen.getAllByRole("link", { name: /view/i });
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

  it("disables upload button when no files selected", () => {
    render(<BatchDetailView batchId="batch-1" />);
    const uploadButton = screen.getByRole("button", { name: /upload files/i });
    expect(uploadButton).toBeDisabled();
  });

  it("shows processing summary text when provided", () => {
    const detailWithProgress = {
      ...sampleDetail,
      batch: { ...sampleDetail.batch, processed_files: 1, total_files: 3 },
      jobs: { ...sampleDetail.jobs, processing: 1 },
    };
      mockUseBatchDetail.mockReturnValue({
        status: "success",
        data: detailWithProgress,
        error: null,
        refresh: vi.fn(),
      });

    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByTestId("batch-file-progress")).toHaveTextContent("1/3 files processed");
    expect(screen.getByText(/processing in progress/i)).toBeInTheDocument();
  });

  it("shows failed job details when jobs fail", () => {
    mockUseBatchDetail.mockReturnValue({
      status: "success",
      data: {
        ...sampleDetail,
        jobs: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 1,
          failedJobs: [
            { id: "job-1", storagePath: "batches/batch-1/EMP003.pdf", error: "OCR error" },
          ],
        },
      },
      error: null,
      refresh: vi.fn(),
    });

    render(<BatchDetailView batchId="batch-1" />);
    expect(screen.getByText(/failed during processing/i)).toBeInTheDocument();
    expect(screen.getByText(/EMP003.pdf/i)).toBeInTheDocument();
    expect(screen.getByTestId("batch-failed-count-tag")).toHaveTextContent("1 failed");
  });

  it("refreshes when tab becomes visible", () => {
    const refresh = vi.fn();
    mockUseBatchDetail.mockReturnValue({
      status: "success",
      data: sampleDetail,
      error: null,
      refresh,
    });
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    render(<BatchDetailView batchId="batch-1" />);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalled();

    if (originalDescriptor) {
      Object.defineProperty(document, "visibilityState", originalDescriptor);
    }
  });
  it("logs audit event after uploading files", async () => {
    render(<BatchDetailView batchId="batch-1" />);

    await act(async () => {
      draggerHandle.beforeUpload?.({
        uid: "file-1",
        name: "Jan.pdf",
        size: 1234,
        type: "application/pdf",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /upload files/i }));

    await waitFor(() =>
      expect(uploadBatchFilesMock).toHaveBeenCalledWith("batch-1", expect.any(Array))
    );
    expect(logAuditMock).toHaveBeenCalledWith({
      organisationId: "org-123",
      actorId: "profile-1",
      action: "payslips_uploaded",
      metadata: {
        batchId: "batch-1",
        clientId: "client-1",
        fileCount: 1,
        fileNames: ["Jan.pdf"],
      },
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});

