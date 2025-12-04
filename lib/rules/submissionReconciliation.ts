import type { IssueCandidate } from "@/lib/rules/types";
import type { PayslipLike } from "@/lib/logic/payslipDiff";
import type { SubmissionSummary } from "@/lib/submissions/parser";

const TOLERANCE = 1;

const formatNumber = (value: number) => Number(value.toFixed(2));

type SubmissionTotals = {
  paye: number;
  usc_or_ni: number;
  employeeIds: Set<string>;
};

export const reconcileSubmissionTotals = (
  submission: SubmissionSummary | null | undefined,
  payslips: PayslipLike[]
): IssueCandidate[] => {
  if (!submission) return [];

  const totals = payslips.reduce<SubmissionTotals>(
    (acc, p) => {
      acc.paye += p.paye ?? 0;
      acc.usc_or_ni += p.usc_or_ni ?? 0;
      acc.employeeIds.add(p.employee_id ?? p.id ?? "");
      return acc;
    },
    { paye: 0, usc_or_ni: 0, employeeIds: new Set<string>() }
  );

  const issues: IssueCandidate[] = [];

  const payeDelta = totals.paye - (submission.paye_total ?? 0);
  const uscDelta = totals.usc_or_ni - (submission.usc_or_ni_total ?? 0);

  if (Math.abs(payeDelta) > TOLERANCE || Math.abs(uscDelta) > TOLERANCE) {
    issues.push({
      ruleCode: "SUBMISSION_TOTAL_MISMATCH",
      severity: "critical",
      description: "Submission totals do not match payslip totals",
      data: {
        payslipPaye: formatNumber(totals.paye),
        submissionPaye: formatNumber(submission.paye_total ?? 0),
        payeDifference: formatNumber(payeDelta),
        payslipUscOrNi: formatNumber(totals.usc_or_ni),
        submissionUscOrNi: formatNumber(submission.usc_or_ni_total ?? 0),
        uscOrNiDifference: formatNumber(uscDelta),
      },
    });
  }

  const uniqueEmployeeCount = Array.from(totals.employeeIds).filter((id) => !!id).length;
  if (
    typeof submission.employee_count === "number" &&
    submission.employee_count > 0 &&
    submission.employee_count !== uniqueEmployeeCount
  ) {
    issues.push({
      ruleCode: "SUBMISSION_EMPLOYEE_COUNT_MISMATCH",
      severity: "critical",
      description: "Submission employee count does not match payslips",
      data: {
        submissionEmployeeCount: submission.employee_count,
        payslipEmployeeCount: uniqueEmployeeCount,
      },
    });
  }

  return issues;
};
