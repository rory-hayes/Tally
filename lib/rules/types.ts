import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";

export type IssueSeverity = "info" | "warning" | "critical";

export type RuleCode =
  | "NET_CHANGE_LARGE"
  | "GROSS_CHANGE_LARGE"
  | "TAX_SPIKE_WITHOUT_GROSS"
  | "USC_SPIKE_WITHOUT_GROSS"
  | "YTD_REGRESSION"
  | "PRSI_CATEGORY_CHANGE"
  | "PENSION_EMPLOYEE_HIGH"
  | "PENSION_EMPLOYER_HIGH";

export type IssueCandidate = {
  ruleCode: RuleCode;
  severity: IssueSeverity;
  description: string;
  metadata?: Record<string, unknown>;
};

export type CountryCode = "IE" | "UK" | string;

export type RuleEvaluationContext = {
  current: PayslipLike;
  previous: PayslipLike | null;
  diff: PayslipDiff;
};

export type RuleEvaluationOutcome = {
  description?: string;
  severity?: IssueSeverity;
};

export type RuleEvaluationResult =
  | null
  | undefined
  | RuleEvaluationOutcome
  | RuleEvaluationOutcome[];

