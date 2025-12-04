import { describe, it, expect } from "vitest";
import { reconcileSubmissionTotals } from "@/lib/rules/submissionReconciliation";

describe("submission reconciliation", () => {
  const payslips = [
    { employee_id: "emp1", paye: 500, usc_or_ni: 100 },
    { employee_id: "emp2", paye: 520, usc_or_ni: 110 },
  ];

  it("returns no issues when submission matches payslips", () => {
    const issues = reconcileSubmissionTotals(
      { paye_total: 1020, usc_or_ni_total: 210, employee_count: 2 },
      payslips as any
    );
    expect(issues).toHaveLength(0);
  });

  it("flags submission total mismatches", () => {
    const issues = reconcileSubmissionTotals(
      { paye_total: 900, usc_or_ni_total: 200, employee_count: 2 },
      payslips as any
    );
    expect(issues.map((i) => i.ruleCode)).toContain("SUBMISSION_TOTAL_MISMATCH");
  });

  it("flags employee count mismatches", () => {
    const issues = reconcileSubmissionTotals(
      { paye_total: 1020, usc_or_ni_total: 210, employee_count: 3 },
      payslips as any
    );
    expect(issues.map((i) => i.ruleCode)).toContain("SUBMISSION_EMPLOYEE_COUNT_MISMATCH");
  });
});
