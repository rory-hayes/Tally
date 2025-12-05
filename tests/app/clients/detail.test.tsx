import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchRow } from "@/lib/repositories/batches";
import { batchFixture } from "@/tests/fixtures/batches";
import { clientFixture } from "@/tests/fixtures/clients";

const repoMocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
  getBatchesForClient: vi.fn(),
  createBatchForClient: vi.fn(),
  getBatchById: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repositories/clients", () => ({
  getClientById: repoMocks.getClientById,
}));

vi.mock("@/lib/repositories/batches", () => ({
  getBatchesForClient: repoMocks.getBatchesForClient,
  createBatchForClient: repoMocks.createBatchForClient,
  getBatchById: repoMocks.getBatchById,
}));

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({
    organisationId: "org-123",
    profileId: "profile-1",
    role: "admin",
  }),
}));

vi.mock("@/lib/repositories/auditLogs", () => auditMocks);

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

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

const emptyBatchList: BatchRow[] = [];

describe("ClientDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMocks.logAuditEvent.mockClear();
    repoMocks.getClientById.mockResolvedValue({ ...clientFixture });
    repoMocks.getBatchesForClient.mockResolvedValue(emptyBatchList);
    repoMocks.getBatchById.mockResolvedValue({ ...batchFixture });
  });

  it("navigates to the batch wizard", async () => {
    render(<ClientDetailContent clientId="client-123" />);

    await waitFor(() =>
      expect(repoMocks.getClientById).toHaveBeenCalledWith(
        "org-123",
        "client-123"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /upload new batch/i }));

    expect(mockRouter.push).toHaveBeenCalledWith("/clients/client-123/batches/new");
  });

  it("opens an existing batch from the table", async () => {
    repoMocks.getBatchesForClient.mockResolvedValue([{ ...batchFixture }]);

    render(<ClientDetailContent clientId="client-123" />);

    await screen.findByText(batchFixture.period_label);

    fireEvent.click(screen.getByRole("button", { name: /open/i }));

    expect(mockRouter.push).toHaveBeenCalledWith(`/batches/${batchFixture.id}`);
  });
});

