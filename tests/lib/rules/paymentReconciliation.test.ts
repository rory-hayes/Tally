import { describe, it, expect } from "vitest";
import { reconcilePaymentsToPayslips } from "@/lib/rules/paymentReconciliation";

describe("payment reconciliation", () => {
  const payslips = [
    { employee_id: "emp1", net_pay: 2100 },
    { employee_id: "emp2", net_pay: 2200 },
  ];
  const payments = [
    { employee_id: "emp1", amount: 2100 },
    { employee_id: "emp2", amount: 2200 },
  ];

  it("returns no issues when payments match payslips", () => {
    const issues = reconcilePaymentsToPayslips(payments as any, payslips as any);
    expect(issues).toHaveLength(0);
  });

  it("flags net pay mismatches beyond tolerance", () => {
    const issues = reconcilePaymentsToPayslips(
      [{ employee_id: "emp1", amount: 2000 }],
      [{ employee_id: "emp1", net_pay: 2100 }] as any
    );
    expect(issues.map((i) => i.ruleCode)).toContain("BANK_NETPAY_MISMATCH");
  });

  it("flags payments without payslips", () => {
    const issues = reconcilePaymentsToPayslips([{ employee_id: "emp3", amount: 100 }], payslips as any);
    expect(issues.map((i) => i.ruleCode)).toContain("BANK_PAYMENT_WITHOUT_PAYSLIP");
  });

  it("flags payslips without payments", () => {
    const issues = reconcilePaymentsToPayslips([], payslips as any);
    expect(issues.map((i) => i.ruleCode)).toContain("PAYSLIP_WITHOUT_PAYMENT");
  });
});
