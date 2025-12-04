import { describe, it, expect } from "vitest";
import { parseRegisterCsv, sumPayslipTotals } from "@/lib/register/parser";

describe("parseRegisterCsv", () => {
  it("parses CSV rows into register entries", () => {
    const csv = `employee_id,gross_pay,net_pay,paye,usc_or_ni
emp1,3000,2100,500,100
emp2,3200,2200,520,110`;
    const entries = parseRegisterCsv(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      employee_id: "emp1",
      gross_pay: 3000,
      net_pay: 2100,
      paye: 500,
      usc_or_ni: 100,
      entry_type: "employee",
    });
  });

  it("marks batch total rows when employee_id is empty", () => {
    const csv = `employee_id,gross_pay,net_pay,paye
,6000,4300,1000`;
    const [entry] = parseRegisterCsv(csv);
    expect(entry.entry_type).toBe("batch_total");
    expect(entry.employee_id).toBeNull();
  });
});

describe("sumPayslipTotals", () => {
  it("sums gross/net/paye/usc values across payslips", () => {
    const totals = sumPayslipTotals([
      { gross_pay: 1000, net_pay: 800, paye: 150, usc_or_ni: 20 },
      { gross_pay: 2000, net_pay: 1500, paye: 250, usc_or_ni: 40 },
    ]);
    expect(totals).toEqual({
      gross_pay: 3000,
      net_pay: 2300,
      paye: 400,
      usc_or_ni: 60,
    });
  });
});
