import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  calculateClientEmployeeCounts,
  createClient,
  deleteClient,
  getClientsForOrg,
  updateClient,
} from "@/lib/repositories/clients";

const from = vi.fn();

describe("clients repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReset();
    vi.mocked(getSupabaseBrowserClient).mockReturnValue({ from } as any);
  });

  it("queries clients scoped to an organisation", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqClients = vi.fn().mockReturnValue({ order });
    const selectClients = vi.fn().mockReturnValue({ eq: eqClients });
    const payEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectPayslips = vi.fn().mockReturnValue({ eq: payEq });

    from.mockReturnValueOnce({ select: selectClients });
    from.mockReturnValueOnce({ select: selectPayslips });

    await getClientsForOrg("org-123");

    expect(from).toHaveBeenNthCalledWith(1, "clients");
    expect(from).toHaveBeenNthCalledWith(2, "payslips");
    expect(selectClients).toHaveBeenCalledWith("id, name, country, payroll_system");
    expect(eqClients).toHaveBeenCalledWith("organisation_id", "org-123");
    expect(order).toHaveBeenCalledWith("name", { ascending: true });
    expect(payEq).toHaveBeenCalledWith("organisation_id", "org-123");
  });

  it("returns client rows from Supabase response", async () => {
    const records = [
      { id: "1", name: "Alpha", country: "IE", payroll_system: "Sage" },
    ];
    const order = vi.fn().mockResolvedValue({ data: records, error: null });
    const eqClients = vi.fn().mockReturnValue({ order });
    const selectClients = vi.fn().mockReturnValue({ eq: eqClients });
    const payEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectPayslips = vi.fn().mockReturnValue({ eq: payEq });

    from.mockReturnValueOnce({ select: selectClients });
    from.mockReturnValueOnce({ select: selectPayslips });

    const result = await getClientsForOrg("org-123");
    expect(result).toEqual(
      records.map((record) => ({ ...record, employees_processed: 0 }))
    );
  });

  it("throws when client list query fails", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ select });

    await expect(getClientsForOrg("org-123")).rejects.toThrow(/boom/);
  });

  it("attaches unique employee counts per client", async () => {
    const records = [
      { id: "1", name: "Alpha", country: "IE", payroll_system: "Sage" },
      { id: "2", name: "Beta", country: "UK", payroll_system: "Bright" },
    ];
    const order = vi.fn().mockResolvedValue({ data: records, error: null });
    const eqClients = vi.fn().mockReturnValue({ order });
    const selectClients = vi.fn().mockReturnValue({ eq: eqClients });

    const payRows = [
      { client_id: "1", employee_id: "emp-1" },
      { client_id: "1", employee_id: "emp-1" }, // duplicate should be ignored
      { client_id: "1", employee_id: "emp-2" },
      { client_id: "2", employee_id: "emp-9" },
      { client_id: null, employee_id: "emp-0" },
    ];
    const payEq = vi.fn().mockResolvedValue({ data: payRows, error: null });
    const selectPayslips = vi.fn().mockReturnValue({ eq: payEq });

    from.mockReturnValueOnce({ select: selectClients });
    from.mockReturnValueOnce({ select: selectPayslips });

    const result = await getClientsForOrg("org-123");
    expect(result).toEqual([
      { ...records[0], employees_processed: 2 },
      { ...records[1], employees_processed: 1 },
    ]);
  });

  it("creates a client tied to the organisation", async () => {
    const created = {
      id: "client-1",
      name: "Apex",
      country: "IE",
      payroll_system: "Sage",
    };
    const single = vi.fn().mockResolvedValue({ data: created, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    from.mockReturnValueOnce({ insert });

    const result = await createClient("org-123", {
      name: "Apex",
      country: "IE",
      payroll_system: "Sage",
    });

    expect(insert).toHaveBeenCalledWith({
      name: "Apex",
      country: "IE",
      payroll_system: "Sage",
      organisation_id: "org-123",
    });
    expect(select).toHaveBeenCalledWith("id, name, country, payroll_system");
    expect(result).toEqual(created);
  });

  it("updates a client within the organisation scope", async () => {
    const updated = {
      id: "client-9",
      name: "Updated",
      country: "UK",
      payroll_system: "Bright",
    };
    const single = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn();
    eq.mockReturnValueOnce({ eq, select });
    eq.mockReturnValueOnce({ select });
    const update = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ update });

    const result = await updateClient("org-123", "client-9", {
      name: "Updated",
    });

    expect(update).toHaveBeenCalledWith({ name: "Updated" });
    expect(eq).toHaveBeenNthCalledWith(1, "organisation_id", "org-123");
    expect(eq).toHaveBeenNthCalledWith(2, "id", "client-9");
    expect(select).toHaveBeenCalledWith("id, name, country, payroll_system");
    expect(result).toEqual(updated);
  });

  it("throws if no update fields are provided", async () => {
    await expect(
      updateClient("org-123", "client-9", {})
    ).rejects.toThrow(/No client fields/);
  });

  it("deletes a client scoped by organisation and id", async () => {
    const deleteResult = Promise.resolve({ error: null });
    const eq = vi.fn();
    eq.mockReturnValueOnce({ eq });
    eq.mockReturnValueOnce(deleteResult);
    const del = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ delete: del });

    await deleteClient("org-123", "client-9");

    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenNthCalledWith(1, "organisation_id", "org-123");
    expect(eq).toHaveBeenNthCalledWith(2, "id", "client-9");
  });

  it("surfaced delete errors", async () => {
    const eq = vi.fn();
    eq.mockReturnValueOnce({ eq });
    eq.mockReturnValueOnce(
      Promise.resolve({ error: { message: "cannot delete" } })
    );
    const del = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ delete: del });

    await expect(deleteClient("org-1", "client-1")).rejects.toThrow(
      /cannot delete/
    );
  });
});

describe("calculateClientEmployeeCounts", () => {
  it("counts unique employees per client", () => {
    const counts = calculateClientEmployeeCounts([
      { client_id: "1", employee_id: "A" },
      { client_id: "1", employee_id: "A" },
      { client_id: "1", employee_id: "B" },
      { client_id: "2", employee_id: "C" },
      { client_id: "2", employee_id: null },
      { client_id: null, employee_id: "X" },
    ]);

    expect(counts.get("1")).toBe(2);
    expect(counts.get("2")).toBe(1);
  });
});

