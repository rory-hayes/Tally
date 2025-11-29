import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({ status: "success", data: [], error: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

import Home from "@/app/page";

describe("Home page", () => {
  it("shows the Tally dashboard heading", async () => {
    await act(async () => {
      render(<Home />);
    });

    expect(
      screen.getByRole("heading", { name: /tally dashboard/i })
    ).toBeInTheDocument();
  });
});

