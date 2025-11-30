import { describe, it, expect } from "vitest";
import { buildIssuesForPayslip } from "@/supabase/functions/process_batch/rules";

const basePayslip = {
  id: "current",
  organisation_id: "org",
  client_id: "client",
  batch_id: "batch",
  employee_id: "emp",
  gross_pay: 3000,
  net_pay: 2100,
  paye: 500,
  usc_or_ni: 120,
  pension_employee: 150,
  pension_employer: 150,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 600,
  prsi_or_ni_category: "A1",
};

describe("buildIssuesForPayslip", () => {
  it("generates issue rows when rules fire", () => {
    const previous = { ...basePayslip, id: "prev", net_pay: 1500 };
    const current = { ...basePayslip, net_pay: 2500 };

    const issues = buildIssuesForPayslip(current, previous);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      payslip_id: "current",
      employee_id: "emp",
      rule_code: "NET_CHANGE_LARGE",
    });
  });

  it("handles missing previous payslip gracefully", () => {
    const current = { ...basePayslip, gross_pay: 2000, pension_employee: 400 };

    const issues = buildIssuesForPayslip(current, null);
    expect(issues.map((issue) => issue.rule_code)).toContain("PENSION_EMPLOYEE_HIGH");
  });

  it("returns empty array when no rules triggered", () => {
    const issues = buildIssuesForPayslip(basePayslip, { ...basePayslip, id: "prev" });
    expect(issues).toHaveLength(0);
  });
});

