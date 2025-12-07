import { describe, it, expect } from "vitest";
import { pickPreviousPayslip } from "@/lib/repositories/employeeDetails";

const buildPayslip = (overrides: Partial<{ id: string; batch_id: string; pay_date: string | null }>) => ({
  id: overrides.id ?? "current",
  organisation_id: "org",
  client_id: "client",
  employee_id: "emp",
  batch_id: overrides.batch_id ?? "batch-current",
  pay_date: overrides.pay_date ?? "2025-01-31",
});

describe("pickPreviousPayslip", () => {
  it("returns the most recent earlier payslip", () => {
    const payslips = [
      buildPayslip({ id: "current", batch_id: "batch-current", pay_date: "2025-06-30" }),
      buildPayslip({ id: "older", batch_id: "batch-older", pay_date: "2025-05-30" }),
      buildPayslip({ id: "oldest", batch_id: "batch-oldest", pay_date: "2025-04-30" }),
    ];

    const previous = pickPreviousPayslip(payslips as any, "batch-current");
    expect(previous?.id).toBe("older");
  });

  it("returns null when only future payslips exist", () => {
    const payslips = [
      buildPayslip({ id: "current", batch_id: "batch-current", pay_date: "2025-01-31" }),
      buildPayslip({ id: "later", batch_id: "batch-later", pay_date: "2025-06-30" }),
    ];

    const previous = pickPreviousPayslip(payslips as any, "batch-current");
    expect(previous).toBeNull();
  });
});

