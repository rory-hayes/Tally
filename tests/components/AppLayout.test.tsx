import { render, screen, act } from "@testing-library/react";
import AppLayout from "@/components/layout/AppLayout";

describe("AppLayout", () => {
  it("renders header and sider areas", async () => {
    await act(async () => {
      render(
        <AppLayout>
          <div>Sample content</div>
        </AppLayout>
      );
    });

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("app-sider")).toBeInTheDocument();
  });
});

