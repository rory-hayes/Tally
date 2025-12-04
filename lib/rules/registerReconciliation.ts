import type { IssueCandidate } from "@/lib/rules/types";
import type { PayslipLike } from "@/lib/logic/payslipDiff";
import type { RegisterEntry } from "@/lib/register/parser";

const TOLERANCE = 1;

const formatNumber = (value: number) => Number(value.toFixed(2));

export type ReconciliationResult = {
  issues: IssueCandidate[];
};

export const reconcileRegister = (payslips: PayslipLike[], register: RegisterEntry[]): ReconciliationResult => {
  const issues: IssueCandidate[] = [];
  const registerByEmployee = new Map<string, RegisterEntry>();
  register.forEach((entry) => {
    if (entry.entry_type === "employee" && entry.employee_id) {
      registerByEmployee.set(entry.employee_id, entry);
    }
  });

  payslips.forEach((p) => {
    const employeeId = p.employee_id ?? p.id ?? undefined;
    if (!employeeId) return;
    const match = registerByEmployee.get(employeeId);
    if (!match) {
      issues.push({
        ruleCode: "MISSING_REGISTER_ENTRY",
        severity: "warning",
        description: `No register entry for employee ${employeeId}`,
      });
      return;
    }
    const deltaGross = (p.gross_pay ?? 0) - (match.gross_pay ?? 0);
    const deltaNet = (p.net_pay ?? 0) - (match.net_pay ?? 0);
    if (Math.abs(deltaGross) > TOLERANCE || Math.abs(deltaNet) > TOLERANCE) {
      issues.push({
        ruleCode: "REGISTER_PAYSPLIP_TOTAL_MISMATCH",
        severity: "warning",
        description: `Payslip vs register mismatch for ${employeeId}`,
        data: {
          payslipGross: formatNumber(p.gross_pay ?? 0),
          registerGross: formatNumber(match.gross_pay ?? 0),
          payslipNet: formatNumber(p.net_pay ?? 0),
          registerNet: formatNumber(match.net_pay ?? 0),
          grossDifference: formatNumber(deltaGross),
          netDifference: formatNumber(deltaNet),
        },
      });
    }
  });

  registerByEmployee.forEach((entry, employeeId) => {
    const hasPayslip = payslips.some((p) => p.employee_id === employeeId || p.id === employeeId);
    if (!hasPayslip) {
      issues.push({
        ruleCode: "MISSING_PAYSLIP",
        severity: "warning",
        description: `Register contains employee ${employeeId} without payslip`,
      });
    }
  });

  return { issues };
};
