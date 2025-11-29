import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
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
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ select });

    await getClientsForOrg("org-123");

    expect(from).toHaveBeenCalledWith("clients");
    expect(select).toHaveBeenCalledWith("id, name, country, payroll_system");
    expect(eq).toHaveBeenCalledWith("organisation_id", "org-123");
    expect(order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("returns client rows from Supabase response", async () => {
    const records = [
      { id: "1", name: "Alpha", country: "IE", payroll_system: "Sage" },
    ];
    const order = vi.fn().mockResolvedValue({ data: records, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });

    from.mockReturnValueOnce({ select });

    const result = await getClientsForOrg("org-123");
    expect(result).toEqual(records);
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

