import { describe, it, expect } from "vitest";
import { runRules } from "@/lib/logic/rulesEngine";

describe("rule registry", () => {
  it("flags new joiners when no previous payslip exists", () => {
    const issues = runRules(
      {
        employee_id: "EMP001",
        gross_pay: 3000,
        net_pay: 2200,
      },
      null,
      {
        gross_pay: { previous: null, current: 3000, delta: null, percentChange: null },
        net_pay: { previous: null, current: 2200, delta: null, percentChange: null },
        paye: { previous: null, current: null, delta: null, percentChange: null },
        usc_or_ni: { previous: null, current: null, delta: null, percentChange: null },
        prsi_employee: { previous: null, current: null, delta: null, percentChange: null },
        prsi_employer: { previous: null, current: null, delta: null, percentChange: null },
        nic_employee: { previous: null, current: null, delta: null, percentChange: null },
        nic_employer: { previous: null, current: null, delta: null, percentChange: null },
        student_loan: { previous: null, current: null, delta: null, percentChange: null },
        postgrad_loan: { previous: null, current: null, delta: null, percentChange: null },
        pension_employee: { previous: null, current: null, delta: null, percentChange: null },
        pension_employer: { previous: null, current: null, delta: null, percentChange: null },
        ytd_gross: { previous: null, current: null, delta: null, percentChange: null },
        ytd_net: { previous: null, current: null, delta: null, percentChange: null },
        ytd_tax: { previous: null, current: null, delta: null, percentChange: null },
        ytd_usc_or_ni: { previous: null, current: null, delta: null, percentChange: null },
      },
      { country: "IE", taxYear: 2025 }
    );

    const joiner = issues.find((issue) => issue.ruleCode === "NEW_JOINER");
    expect(joiner).toBeDefined();
    expect(joiner?.severity).toBe("info");
    expect(joiner?.description).toMatch(/New joiner/i);
  });
});
