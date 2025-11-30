import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { CreateBatchModal } from "@/components/batches/CreateBatchModal";

describe("CreateBatchModal", () => {
  it("submits batch details", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateBatchModal
        open
        onCancel={() => undefined}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/payroll period/i), {
      target: { value: "Jan 2025" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "first run" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create batch/i }));

    await waitFor(() =>
      expect(handleSubmit).toHaveBeenCalledWith({
        periodLabel: "Jan 2025",
        notes: "first run",
      })
    );
  });

  it("requires period label", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateBatchModal
        open
        onCancel={() => undefined}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /create batch/i }));

    const field = screen.getByLabelText(/payroll period/i);
    await waitFor(() =>
      expect(field).toHaveAttribute("aria-invalid", "true")
    );
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});


