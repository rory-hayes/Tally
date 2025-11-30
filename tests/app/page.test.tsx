import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/dashboard/DashboardView", () => ({
  DashboardView: () => <div data-testid="dashboard-view-mock">Dashboard</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  usePathname: () => "/",
}));

import Home from "@/app/page";

describe("Home page", () => {
  it("renders the dashboard view", async () => {
    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("dashboard-view-mock")).toBeInTheDocument();
  });
});

