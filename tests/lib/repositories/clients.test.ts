import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getClientsForOrganisation } from "@/lib/repositories/clients";

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

const setupMockClient = () => {
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const client = { from };
  vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as any);

  return { client, select, eq, order, from };
};

describe("clients repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("queries by organisation id", async () => {
    const { from, eq } = setupMockClient();
    await getClientsForOrganisation("org-123");

    expect(from).toHaveBeenCalledWith("clients");
    expect(eq).toHaveBeenCalledWith("organisation_id", "org-123");
  });

  it("returns rows from supabase response", async () => {
    const records = [
      { id: "1", name: "Alpha", country: "IE", payroll_system: "Sage" },
    ];
    const { order } = setupMockClient();
    order.mockResolvedValueOnce({ data: records, error: null });

    const result = await getClientsForOrganisation("org-123");
    expect(result).toEqual(records);
  });

  it("throws when Supabase returns an error", async () => {
    const { order } = setupMockClient();
    order.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    await expect(getClientsForOrganisation("org-123")).rejects.toThrow(
      /boom/
    );
  });
});

