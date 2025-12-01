import { calculateDiff, type PayslipLike } from "../../../lib/logic/payslipDiff.ts";
import {
  runRules,
  type IssueCandidate,
  type IssueSeverity,
  type RuleCode,
} from "../../../lib/logic/rulesEngine.ts";

export const PAYSLIP_SELECT_FIELDS =
  "id, organisation_id, client_id, batch_id, employee_id, pay_date, gross_pay, net_pay, paye, usc_or_ni, pension_employee, pension_employer, ytd_gross, ytd_net, ytd_tax, ytd_usc_or_ni, prsi_or_ni_category";

export type PayslipForRules = PayslipLike & {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  employee_id: string;
};

export type IssueInsertRow = {
  organisation_id: string;
  client_id: string;
  batch_id: string;
  employee_id: string;
  payslip_id: string;
  rule_code: RuleCode;
  severity: IssueSeverity;
  description: string;
  note: null;
};

export { type IssueSeverity, type RuleCode, type IssueCandidate };

export const buildIssuesForPayslip = (
  current: PayslipForRules,
  previous: PayslipForRules | null
): IssueInsertRow[] => {
  const diff = calculateDiff(previous, current);
  const issues = runRules(current, previous, diff);

  return issues.map((issue) => ({
    organisation_id: current.organisation_id,
    client_id: current.client_id,
    batch_id: current.batch_id,
    employee_id: current.employee_id,
    payslip_id: current.id,
    rule_code: issue.ruleCode,
    severity: issue.severity,
    description: issue.description,
    note: null,
  }));
};

