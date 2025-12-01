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

const capture = (overrides: Partial<typeof basePayslip>, prevOverrides?: Partial<typeof basePayslip>) => {
  const previous = { ...basePayslip, id: "prev", ...prevOverrides };
  const current = { ...basePayslip, ...overrides };
  return buildIssuesForPayslip(current, previous);
};

describe("buildIssuesForPayslip", () => {
  it("generates issue rows for large net change", () => {
    const issues = capture({ net_pay: 2600 }, { net_pay: 2000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("NET_CHANGE_LARGE");
  });

  it("flags large gross pay shifts", () => {
    const issues = capture({ gross_pay: 3900 }, { gross_pay: 3000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("GROSS_CHANGE_LARGE");
  });

  it("detects tax spike without gross change", () => {
    const issues = capture({ paye: 900 }, { paye: 600, gross_pay: 3000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("TAX_SPIKE_WITHOUT_GROSS");
  });

  it("surfaces YTD regressions", () => {
    const issues = capture({ ytd_net: 10000 }, { ytd_net: 12000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("YTD_REGRESSION");
  });

  it("detects PRSI/NI category changes", () => {
    const current = { ...basePayslip, prsi_or_ni_category: "B1" };
    const issues = buildIssuesForPayslip(current, { ...basePayslip, id: "prev", prsi_or_ni_category: "A1" });
    expect(issues.map((issue) => issue.rule_code)).toContain("PRSI_CATEGORY_CHANGE");
  });

  it("EMP003 triggers USC spike", () => {
    const issues = capture({ usc_or_ni: 200, gross_pay: 3050 }, { usc_or_ni: 100, gross_pay: 3000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("USC_SPIKE");
  });

  it("EMP005 triggers pension_over_threshold for both EE and ER", () => {
    const issues = capture({ gross_pay: 2000, pension_employee: 400, pension_employer: 320 }, null);
    const pensionIssues = issues.filter((issue) => issue.rule_code === "PENSION_OVER_THRESHOLD");
    expect(pensionIssues).toHaveLength(2);
    expect(pensionIssues.map((issue) => issue.description)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Employee pension contribution/),
        expect.stringMatching(/Employer pension contribution/),
      ])
    );
  });

  it("returns empty array when no rules triggered", () => {
    const issues = buildIssuesForPayslip(basePayslip, { ...basePayslip, id: "prev" });
    expect(issues).toHaveLength(0);
  });
});

