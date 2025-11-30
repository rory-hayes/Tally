import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import BatchDetailPage from "@/app/batches/[batchId]/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ batchId: "batch-123" }),
}));

vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/AppLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/batches/BatchDetailView", () => ({
  BatchDetailView: ({ batchId }: { batchId: string }) => (
    <div data-testid="batch-detail-view">batch {batchId}</div>
  ),
}));

describe("Batch detail page", () => {
  it("renders the batch detail view with route param", () => {
    render(<BatchDetailPage />);
    expect(screen.getByTestId("batch-detail-view")).toHaveTextContent(
      "batch batch-123"
    );
  });
});