import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchRow, CreateBatchInput } from "@/lib/repositories/batches";
import type { ClientRow } from "@/lib/repositories/clients";

const repoMocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
  getBatchesForClient: vi.fn(),
  createBatchForClient: vi.fn(),
}));

vi.mock("@/lib/repositories/clients", () => ({
  getClientById: repoMocks.getClientById,
}));

vi.mock("@/lib/repositories/batches", () => ({
  getBatchesForClient: repoMocks.getBatchesForClient,
  createBatchForClient: repoMocks.createBatchForClient,
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin" }),
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/components/batches/CreateBatchModal", () => {
  const React = require("react");
  return {
    CreateBatchModal: ({
      open,
      onSubmit,
      onCancel,
    }: {
      open: boolean;
      onSubmit: (values: { periodLabel: string }) => Promise<void>;
      onCancel: () => void;
    }) => {
      const [period, setPeriod] = React.useState("");
      if (!open) return null;
      return (
        <div data-testid="batch-modal">
          <input
            aria-label="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <button onClick={() => onSubmit({ periodLabel: period })}>
            Submit batch
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      );
    },
  };
});

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { ClientDetailContent } from "@/app/clients/[clientId]/page";

const clientFixture: ClientRow = {
  id: "client-123",
  name: "Acme Corp",
  country: "IE",
  payroll_system: "Sage",
};

const emptyBatchList: BatchRow[] = [];

describe("ClientDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.getClientById.mockResolvedValue(clientFixture);
    repoMocks.getBatchesForClient.mockResolvedValue(emptyBatchList);
  });

  it("opens batch modal", async () => {
    render(<ClientDetailContent clientId="client-123" />);

    await waitFor(() =>
      expect(repoMocks.getClientById).toHaveBeenCalledWith(
        "org-123",
        "client-123"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /upload batch/i }));

    expect(screen.getByTestId("batch-modal")).toBeInTheDocument();
  });

  it("creates batch and updates table", async () => {
    const createdBatch: Partial<BatchRow> & { id: string } = {
      id: "batch-1",
      organisation_id: "org-123",
      client_id: "client-123",
      period_label: "Jan 2025",
      status: "pending",
      total_files: 0,
      processed_files: 0,
      notes: null,
    };

    repoMocks.createBatchForClient.mockResolvedValue(createdBatch);

    render(<ClientDetailContent clientId="client-123" />);

    await waitFor(() =>
      expect(repoMocks.getBatchesForClient).toHaveBeenCalledWith(
        "org-123",
        "client-123"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /upload batch/i }));
    fireEvent.change(screen.getByLabelText(/period/i), {
      target: { value: "Jan 2025" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit batch/i }));

    await waitFor(() =>
      expect(repoMocks.createBatchForClient).toHaveBeenCalledWith("org-123", {
        clientId: "client-123",
        periodLabel: "Jan 2025",
        notes: null,
        totalFiles: 0,
        processedFiles: 0,
        status: "pending",
      })
    );

    await waitFor(() =>
      expect(
        screen.getByText(/jan 2025/i)
      ).toBeInTheDocument()
    );

    expect(mockRouter.push).toHaveBeenCalledWith("/batches/batch-1");
  });
});


