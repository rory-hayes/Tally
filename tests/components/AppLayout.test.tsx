import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const mockRouter = {
  replace: vi.fn(),
  push: vi.fn(),
};

const mockPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/auth", () => ({
  signOut: vi.fn(),
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    message: {
      error: vi.fn(),
    },
  };
});

import AppLayout from "@/components/layout/AppLayout";
import { signOut } from "@/lib/auth";

const renderLayout = async () => {
  await act(async () => {
    render(
      <AppLayout>
        <div>Sample content</div>
      </AppLayout>
    );
  });
};

describe("AppLayout", () => {
  it("renders header, sider, and content areas", async () => {
    await renderLayout();

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("app-sider")).toBeInTheDocument();
    expect(screen.getByText("Sample content")).toBeInTheDocument();
  });

  it("shows the primary navigation items", async () => {
    await renderLayout();

    expect(screen.getByRole("menuitem", { name: /dashboard/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /clients/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeVisible();
  });

  it("signs out when button is clicked", async () => {
    await renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(mockRouter.replace).toHaveBeenCalledWith("/login");
  });

  it("navigates via sidebar menu", async () => {
    await renderLayout();
    fireEvent.click(screen.getByRole("menuitem", { name: /clients/i }));
    expect(mockRouter.push).toHaveBeenCalledWith("/clients");
  });
});
