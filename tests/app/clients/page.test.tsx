import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientRow } from "@/lib/repositories/clients";

const repoMocks = vi.hoisted(() => ({
  getClientsForOrg: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

const mockGetClientsForOrg = repoMocks.getClientsForOrg;
const mockCreateClient = repoMocks.createClient;
const mockUpdateClient = repoMocks.updateClient;
const mockDeleteClient = repoMocks.deleteClient;

vi.mock("@/context/OrganisationContext", () => ({
  useOrganisation: () => ({ organisationId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/repositories/clients", () => repoMocks);

vi.mock("@/components/clients/ClientsTable", () => ({
  ClientsTable: ({
    clients,
    loading,
  }: {
    clients: ClientRow[];
    loading: boolean;
  }) => (
    <div data-testid="clients-table" data-loading={loading}>
      {clients.map((client) => (
        <div key={client.id}>{client.name}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/clients/ClientFormModal", () => {
  const React = require("react");
  return {
    ClientFormModal: ({
      open,
      onSubmit,
      onCancel,
    }: {
      open: boolean;
      onSubmit: (values: { name: string }) => Promise<void>;
      onCancel: () => void;
    }) => {
      const [name, setName] = React.useState("");
      if (!open) return null;
      return (
        <div data-testid="client-form-modal">
          <input
            aria-label="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={() => onSubmit({ name })}>Submit modal</button>
          <button onClick={onCancel}>Cancel modal</button>
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

import { ClientsManager } from "@/app/clients/page";

describe("ClientsManager workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientsForOrg.mockResolvedValue([]);
  });

  it("opens the modal when Add client is clicked", async () => {
    render(<ClientsManager />);

    await waitFor(() => expect(mockGetClientsForOrg).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /add client/i }));

    expect(screen.getByTestId("client-form-modal")).toBeInTheDocument();
  });

  it("submits client details and closes modal", async () => {
    mockGetClientsForOrg
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "client-1", name: "New Co", country: null, payroll_system: null },
      ]);
    mockCreateClient.mockResolvedValue({
      id: "client-1",
      name: "New Co",
      country: null,
      payroll_system: null,
    });

    render(<ClientsManager />);
    await waitFor(() => expect(mockGetClientsForOrg).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /add client/i }));
    fireEvent.change(screen.getByLabelText(/client-name/i), {
      target: { value: "New Co" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit modal/i }));

    await waitFor(() =>
      expect(mockCreateClient).toHaveBeenCalledWith("org-123", {
        name: "New Co",
      })
    );
    await waitFor(() =>
      expect(mockGetClientsForOrg).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("client-form-modal")
      ).not.toBeInTheDocument()
    );
  });

  it("updates table when new client is fetched after creation", async () => {
    mockGetClientsForOrg
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "client-42", name: "Omega LLC", country: "IE", payroll_system: "Sage" },
      ]);
    mockCreateClient.mockResolvedValue({
      id: "client-42",
      name: "Omega LLC",
      country: "IE",
      payroll_system: "Sage",
    });

    render(<ClientsManager />);
    await waitFor(() => expect(mockGetClientsForOrg).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /add client/i }));
    fireEvent.change(screen.getByLabelText(/client-name/i), {
      target: { value: "Omega LLC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit modal/i }));

    await waitFor(() =>
      expect(screen.getByTestId("clients-table")).toHaveTextContent("Omega LLC")
    );
  });
});


