import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { ClientFormModal } from "@/components/clients/ClientFormModal";

describe("ClientFormModal", () => {
  it("submits client details", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ClientFormModal
        open
        title="Add client"
        initialValues={{ country: "UK" }}
        onCancel={() => undefined}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/client name/i), {
      target: { value: "Acme" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(
      () =>
        expect(handleSubmit).toHaveBeenCalledWith({
          name: "Acme",
          country: "UK",
        }),
      { timeout: 7000 }
    );
  });

  it("blocks submission when name missing", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ClientFormModal
        open
        title="Add client"
        onCancel={() => undefined}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/enter the client name/i)
      ).toBeInTheDocument()
    );
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

