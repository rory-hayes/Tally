import type { IssueCandidate } from "@/lib/rules/types";
import type { GlPosting } from "@/lib/gl/parser";
import type { PayslipLike } from "@/lib/logic/payslipDiff";

const TOLERANCE = 1;

const formatNumber = (value: number) => Number(value.toFixed(2));

export const reconcileGlToPayslips = (
  gl: GlPosting | null | undefined,
  payslips: PayslipLike[]
): IssueCandidate[] => {
  if (!gl) return [];
  const totals = payslips.reduce(
    (acc, p) => {
      acc.wages += p.gross_pay ?? 0;
      acc.employer_taxes += p.nic_employer ?? 0;
      acc.pensions += p.pension_employer ?? 0;
      return acc;
    },
    { wages: 0, employer_taxes: 0, pensions: 0 }
  );

  const issues: IssueCandidate[] = [];

  const wagesDelta = totals.wages - (gl.wages ?? 0);
  if (Math.abs(wagesDelta) > TOLERANCE) {
    issues.push({
      ruleCode: "GL_PAYROLL_TOTAL_MISMATCH",
      severity: "warning",
      description: "GL wages total does not match payslips",
      data: {
        payslipWages: formatNumber(totals.wages),
        glWages: formatNumber(gl.wages ?? 0),
        difference: formatNumber(wagesDelta),
      },
    });
  }

  const erTaxDelta = totals.employer_taxes - (gl.employer_taxes ?? 0);
  if (Math.abs(erTaxDelta) > TOLERANCE) {
    issues.push({
      ruleCode: "GL_EMPLOYER_TAX_MISMATCH",
      severity: "warning",
      description: "GL employer taxes do not match payslips",
      data: {
        payslipEmployerTaxes: formatNumber(totals.employer_taxes),
        glEmployerTaxes: formatNumber(gl.employer_taxes ?? 0),
        difference: formatNumber(erTaxDelta),
      },
    });
  }

  return issues;
};
