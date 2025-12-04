import { describe, it, expect } from "vitest";
import { parsePaymentCsv } from "@/lib/payments/parser";

describe("parsePaymentCsv", () => {
  it("parses payments with employee_id and amount", () => {
    const csv = `employee_id,amount,reference
emp1,2100.50,NET PAY
emp2,2200,NET PAY`;
    const rows = parsePaymentCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      employee_id: "emp1",
      amount: 2100.5,
      reference: "NET PAY",
    });
  });

  it("handles missing employee id gracefully", () => {
    const csv = `employee_id,amount
,500`;
    const [row] = parsePaymentCsv(csv);
    expect(row.employee_id).toBeNull();
  });
});
