import { vi } from "vitest";

vi.mock("@/hooks/useClients", () => ({
  useClients: vi.fn(),
}));

import { render, screen } from "@testing-library/react";
import { ClientsPreview } from "@/components/clients/ClientsPreview";
import { useClients, type ClientsHookState } from "@/hooks/useClients";

const mockUseClients = vi.mocked(useClients);

describe("ClientsPreview", () => {
  it("shows a spinner while loading", () => {
    mockUseClients.mockReturnValue({
      status: "loading",
      data: [],
      error: null,
    } as ClientsHookState);

    render(<ClientsPreview />);
    expect(screen.getByTestId("clients-loading")).toBeInTheDocument();
  });

  it("renders empty state when no clients", () => {
    mockUseClients.mockReturnValue({
      status: "success",
      data: [],
      error: null,
    } as ClientsHookState);

    render(<ClientsPreview />);
    expect(
      screen.getByText(/no clients yet/i)
    ).toBeInTheDocument();
  });

  it("lists available clients", () => {
    mockUseClients.mockReturnValue({
      status: "success",
      data: [
        {
          id: "1",
          name: "Acme Ltd",
          country: "IE",
          payroll_system: "Sage",
        },
      ],
      error: null,
    } as ClientsHookState);

    render(<ClientsPreview />);
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
  });

  it("shows error alert when query fails", () => {
    mockUseClients.mockReturnValue({
      status: "error",
      data: [],
      error: "boom",
    } as ClientsHookState);

    render(<ClientsPreview />);
    expect(screen.getByText(/unable to load clients/i)).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

