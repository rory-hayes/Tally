import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { ClientsTable } from "@/components/clients/ClientsTable";
import type { ClientRow } from "@/lib/repositories/clients";

const clients: ClientRow[] = [
  {
    id: "1",
    name: "Acme",
    country: "IE",
    payroll_system: "Sage",
    employees_processed: 5,
  },
  {
    id: "2",
    name: "Beta",
    country: "UK",
    payroll_system: "BrightPay",
    employees_processed: 2,
  },
];

describe("ClientsTable", () => {
  it("renders client rows", () => {
    render(
      <ClientsTable
        loading={false}
        clients={clients}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("invokes edit callback", () => {
    const onEdit = vi.fn();
    render(
      <ClientsTable
        loading={false}
        clients={[clients[0]]}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(clients[0]);
  });

  it("confirms deletion before invoking callback", async () => {
    const onDelete = vi.fn();
    render(
      <ClientsTable
        loading={false}
        clients={[clients[0]]}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(
        document.querySelector(".ant-popconfirm")
      ).toBeTruthy()
    );

    const confirmButton = document.querySelector(
      ".ant-popconfirm .ant-btn-primary"
    ) as HTMLButtonElement;
    fireEvent.click(confirmButton);

    expect(onDelete).toHaveBeenCalledWith(clients[0]);
  });
});


