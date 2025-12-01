import { describe, it, expect } from "vitest";
import { calculateDiff } from "@/lib/logic/payslipDiff";
import { runRules } from "@/lib/logic/rulesEngine";

const basePrevious = {
  gross_pay: 3000,
  net_pay: 2100,
  paye: 600,
  usc_or_ni: 139.5,
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
  usc_or_ni: 139.5,
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

  it("flags USC spike without matching gross change and builds descriptive copy", () => {
    const current = { ...baseCurrent, usc_or_ni: 220, gross_pay: 3050 };
    const previous = { ...basePrevious, usc_or_ni: 139.5, gross_pay: 3000 };
    const diff = calculateDiff(previous, current);
    const issues = runRules(current, previous, diff);
    const uscIssue = issues.find((i) => i.ruleCode === "USC_SPIKE_WITHOUT_GROSS");
    expect(uscIssue).toBeTruthy();
    expect(uscIssue?.description).toMatch(/USC\/NI increased by \+57\.7%/i);
    expect(uscIssue?.description).toMatch(/gross pay increased by \+1\.7%/i);
  });

  it("does not flag USC spike when gross change is comparable", () => {
    const current = { ...baseCurrent, usc_or_ni: 220, gross_pay: 3600 };
    const previous = { ...basePrevious, usc_or_ni: 139.5, gross_pay: 3000 };
    const diff = calculateDiff(previous, current);
    const issues = runRules(current, previous, diff);
    expect(issues.map((i) => i.ruleCode)).not.toContain("USC_SPIKE_WITHOUT_GROSS");
  });

  it("detects high pension percentages for employee and employer with readable description", () => {
    const current = { ...baseCurrent, gross_pay: 3200, pension_employee: 320, pension_employer: 400 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    const employeeIssue = issues.find((i) => i.ruleCode === "PENSION_EMPLOYEE_HIGH");
    const employerIssue = issues.find((i) => i.ruleCode === "PENSION_EMPLOYER_HIGH");
    expect(employeeIssue?.description).toMatch(/10\.0% of gross pay \(€320\.00\/€3,200\.00\)/);
    expect(employerIssue?.description).toMatch(/12\.5%/);
  });

  it("flags employee pension issues even without a previous payslip", () => {
    const current = { ...baseCurrent, gross_pay: 3200, pension_employee: 320 };
    const diff = calculateDiff(null, current);
    const issues = runRules(current, null, diff);
    expect(issues.map((i) => i.ruleCode)).toContain("PENSION_EMPLOYEE_HIGH");
  });

  it("does not flag pension contributions below thresholds", () => {
    const current = { ...baseCurrent, pension_employee: 200, pension_employer: 200 };
    const diff = calculateDiff(basePrevious, current);
    const issues = runRules(current, basePrevious, diff);
    expect(issues.map((i) => i.ruleCode)).not.toContain("PENSION_EMPLOYEE_HIGH");
    expect(issues.map((i) => i.ruleCode)).not.toContain("PENSION_EMPLOYER_HIGH");
  });

  it("returns empty list when no rules triggered", () => {
    const diff = calculateDiff(basePrevious, baseCurrent);
    const issues = runRules(baseCurrent, basePrevious, diff);
    expect(issues).toHaveLength(0);
  });
});

