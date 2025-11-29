import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

import AppLayout from "@/components/layout/AppLayout";

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
});

