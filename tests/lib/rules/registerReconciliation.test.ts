import { describe, it, expect } from "vitest";
import { reconcileRegister } from "@/lib/rules/registerReconciliation";
import { reconcileGlToPayslips } from "@/lib/rules/glReconciliation";

describe("register reconciliation", () => {
  const payslips = [
    { employee_id: "emp1", gross_pay: 3000, net_pay: 2100, paye: 500, usc_or_ni: 100 },
    { employee_id: "emp2", gross_pay: 3200, net_pay: 2200, paye: 520, usc_or_ni: 110 },
  ];
  const register = [
    { employee_id: "emp1", entry_type: "employee", gross_pay: 3000, net_pay: 2100, paye: 500 },
    { employee_id: "emp2", entry_type: "employee", gross_pay: 3200, net_pay: 2200, paye: 520 },
  ];

  it("returns no issues when register matches payslips", () => {
    const { issues } = reconcileRegister(payslips as any, register as any);
    expect(issues).toHaveLength(0);
  });

  it("flags missing register entries", () => {
    const { issues } = reconcileRegister(payslips as any, register.slice(1) as any);
    expect(issues.map((i) => i.ruleCode)).toContain("MISSING_REGISTER_ENTRY");
  });

  it("flags missing payslips in register", () => {
    const registerWithExtra = [...register, { employee_id: "emp3", entry_type: "employee", gross_pay: 1000, net_pay: 700, paye: 150 }];
    const { issues } = reconcileRegister(payslips as any, registerWithExtra as any);
    expect(issues.map((i) => i.ruleCode)).toContain("MISSING_PAYSLIP");
  });

  it("flags mismatches beyond tolerance", () => {
    const registerAltered = register.map((r, idx) =>
      idx === 0 ? { ...r, gross_pay: 3105 } : r
    );
    const { issues } = reconcileRegister(payslips as any, registerAltered as any);
    const mismatch = issues.find((i) => i.ruleCode === "REGISTER_PAYSPLIP_TOTAL_MISMATCH");
    expect(mismatch).toBeTruthy();
    expect(mismatch?.data).toMatchObject({
      payslipGross: expect.any(Number),
      registerGross: expect.any(Number),
    });
  });

  it("flags GL mismatches when totals differ", () => {
    const glIssues = reconcileGlToPayslips(
      { wages: 10000, employer_taxes: 500, pensions: 0 },
      payslips as any
    );
    expect(glIssues.map((i) => i.ruleCode)).toContain("GL_PAYROLL_TOTAL_MISMATCH");
  });
});
