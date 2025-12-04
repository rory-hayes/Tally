import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContractForEmployee, upsertContract } from "@/lib/repositories/contracts";

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "contracts") {
    return { select: selectMock, upsert: upsertMock };
  }
  return {};
});

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

describe("contracts repository", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    const builder = {
      eq: vi.fn().mockImplementation(() => builder),
      maybeSingle: maybeSingleMock,
    };
    selectMock.mockReset();
    selectMock.mockReturnValue(builder);
    fromMock.mockClear();
    upsertMock.mockReset();
  });

  it("fetches contract by organisation and employee", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: "c1" }, error: null });
    const result = await getContractForEmployee("org1", "emp1");
    expect(fromMock).toHaveBeenCalledWith("contracts");
    expect(selectMock).toHaveBeenCalled();
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "c1" });
  });

  it("upserts contract and returns row", async () => {
    const selectReturn = { single: vi.fn() };
    upsertMock.mockReturnValue({ select: () => selectReturn });
    selectReturn.single = vi.fn().mockResolvedValue({ data: { id: "c2", employee_id: "emp1" }, error: null });

    const result = await upsertContract("org1", "emp1", { salary_amount: 50000, salary_period: "annual" });
    expect(fromMock).toHaveBeenCalledWith("contracts");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisation_id: "org1",
        employee_id: "emp1",
        salary_amount: 50000,
        salary_period: "annual",
      }),
      { onConflict: "employee_id" }
    );
    expect(result).toMatchObject({ id: "c2", employee_id: "emp1" });
  });
});
