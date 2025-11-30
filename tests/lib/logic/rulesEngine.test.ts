import { describe, it, expect } from "vitest";
import { calculateDiff } from "@/lib/logic/payslipDiff";
import { runRules } from "@/lib/logic/rulesEngine";

const basePrevious = {
  gross_pay: 3000,
  net_pay: 2100,
  paye: 600,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 700,
  pension_employee: 150,
  pension_employer: 150,
  prsi_or_ni_category: "A1",
};

const baseCurrent = {
  ...basePrevious,
};

describe("runRules", () => {
  it("flags large net change", () => {
    const current = { ...baseCurrent, net_pay: 2600 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("NET_CHANGE_LARGE");
  });

  it("flags large gross change", () => {
    const current = { ...baseCurrent, gross_pay: 3900 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("GROSS_CHANGE_LARGE");
  });

  it("flags tax spike without gross change", () => {
    const current = { ...baseCurrent, paye: 900 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("TAX_SPIKE_WITHOUT_GROSS");
  });

  it("detects YTD regression", () => {
    const current = { ...baseCurrent, ytd_gross: 14000 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("YTD_REGRESSION");
  });

  it("detects PRSI/NI category changes", () => {
    const current = { ...baseCurrent, prsi_or_ni_category: "B2" };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("PRSI_CATEGORY_CHANGE");
  });

  it("detects high pension percentage", () => {
    const current = { ...baseCurrent, gross_pay: 2000, pension_employee: 400, pension_employer: 400 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).toEqual(
      expect.arrayContaining(["PENSION_EMPLOYEE_HIGH", "PENSION_EMPLOYER_HIGH"])
    );
  });

  it("returns empty list when no rules triggered", () => {
    const diff = calculateDiff(basePrevious, baseCurrent);
    const issues = runRules(baseCurrent, basePrevious, diff);
    expect(issues).toHaveLength(0);
  });
});

