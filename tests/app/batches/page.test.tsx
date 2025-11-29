import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, vi } from "vitest";
import { BatchUploadContent } from "@/app/batches/[batchId]/page";
import { batchFixture } from "@/tests/fixtures/batches";

const repoMocks = vi.hoisted(() => ({
  getBatchById: vi.fn(),
  updateBatchStatus: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  uploadBatchFiles: vi.fn(),
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/repositories/batches", () => ({
  getBatchById: repoMocks.getBatchById,
  updateBatchStatus: repoMocks.updateBatchStatus,
}));

vi.mock("@/lib/storage/batchUploads", () => ({
  uploadBatchFiles: storageMocks.uploadBatchFiles,
}));

const mockMessage = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("antd", () => {
  const React = require("react");

  const Button = ({
    children,
    onClick,
    disabled,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  const Typography = {
    Title: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
    Paragraph: ({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    ),
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };

  const Tag = ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  );

  const Space = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  const Upload = {
    Dragger: ({
      beforeUpload,
      children,
    }: {
      beforeUpload?: (file: any) => boolean;
      children: React.ReactNode;
    }) => (
      <div>
        <button
          onClick={() =>
            beforeUpload?.({
              uid: "test-file",
              name: "sample.pdf",
              originFileObj: new File(
                ["test"],
                "sample.pdf",
                { type: "application/pdf" }
              ),
            })
          }
        >
          mock-add-file
        </button>
        {children}
      </div>
    ),
  };

  const Spin = () => <div>loading...</div>;

  return {
    __esModule: true,
    Button,
    Card,
    Typography,
    Tag,
    Space,
    Upload,
    Spin,
    message: mockMessage,
  };
});

describe("BatchUploadContent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockMessage.success.mockReset();
    mockMessage.error.mockReset();
    mockMessage.warning.mockReset();
    repoMocks.getBatchById.mockResolvedValue({ ...batchFixture });
    repoMocks.updateBatchStatus.mockResolvedValue({
      ...batchFixture,
      total_files: batchFixture.total_files + 1,
    });
    storageMocks.uploadBatchFiles.mockResolvedValue(["path/to/sample.pdf"]);
  });

  it("enables upload button once files are selected", async () => {
    render(<BatchUploadContent batchId={batchFixture.id} />);
    await screen.findByText(/Batch upload/i);

    const uploadButton = screen.getByText(/Upload files/i) as HTMLButtonElement;
    expect(uploadButton).toBeDisabled();

    fireEvent.click(screen.getByText(/mock-add-file/i));
    expect(uploadButton).not.toBeDisabled();
  });

  it("uploads files and updates batch totals", async () => {
    render(<BatchUploadContent batchId={batchFixture.id} />);

    await screen.findByText(/Batch upload/i);

    fireEvent.click(screen.getByText(/mock-add-file/i));
    fireEvent.click(screen.getByText(/Upload files/i));

    await waitFor(() =>
      expect(storageMocks.uploadBatchFiles).toHaveBeenCalledWith(
        batchFixture.id,
        expect.any(Array)
      )
    );

    expect(repoMocks.updateBatchStatus).toHaveBeenCalledWith(
      "org-123",
      batchFixture.id,
      { total_files: 1 }
    );
    expect(mockMessage.success).toHaveBeenCalled();
  });
});


