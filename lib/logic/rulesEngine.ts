import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";

export type IssueSeverity = "info" | "warning" | "critical";

export type RuleCode =
  | "NET_CHANGE_LARGE"
  | "GROSS_CHANGE_LARGE"
  | "TAX_SPIKE_WITHOUT_GROSS"
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

type RuleDefinition = {
  severity: IssueSeverity;
  buildDescription: (context: RuleContext) => string;
};

type RuleContext = {
  fieldLabel?: string;
  previous?: number | null;
  current?: number | null;
  percentChange?: number | null;
  detail?: string;
};

const NET_CHANGE_THRESHOLD = 15; // %
const GROSS_CHANGE_THRESHOLD = 15; // %
const TAX_SPIKE_THRESHOLD = 20; // %
const MAX_GROSS_DELTA_FOR_TAX_SPIKE = 5; // %
const PENSION_PERCENT_THRESHOLD = 12; // %

const RULE_DEFINITIONS: Record<RuleCode, RuleDefinition> = {
  NET_CHANGE_LARGE: {
    severity: "warning",
    buildDescription: ({ fieldLabel = "Net pay", previous, current, percentChange }) =>
      `${fieldLabel} changed by ${formatPercent(percentChange)} (${formatAmount(
        previous
      )} → ${formatAmount(current)})`,
  },
  GROSS_CHANGE_LARGE: {
    severity: "warning",
    buildDescription: ({ fieldLabel = "Gross pay", previous, current, percentChange }) =>
      `${fieldLabel} changed by ${formatPercent(percentChange)} (${formatAmount(
        previous
      )} → ${formatAmount(current)})`,
  },
  TAX_SPIKE_WITHOUT_GROSS: {
    severity: "warning",
    buildDescription: ({ percentChange }) =>
      `PAYE increased by ${formatPercent(percentChange)} while gross pay stayed flat`,
  },
  YTD_REGRESSION: {
    severity: "critical",
    buildDescription: ({ fieldLabel, previous, current }) =>
      `${fieldLabel ?? "YTD value"} decreased (${formatAmount(previous)} → ${formatAmount(current)})`,
  },
  PRSI_CATEGORY_CHANGE: {
    severity: "info",
    buildDescription: ({ detail }) => `PRSI/NI category changed ${detail ?? ""}`.trim(),
  },
  PENSION_EMPLOYEE_HIGH: {
    severity: "warning",
    buildDescription: ({ percentChange }) =>
      `Employee pension contribution is ${formatPercent(percentChange)} of gross pay`,
  },
  PENSION_EMPLOYER_HIGH: {
    severity: "info",
    buildDescription: ({ percentChange }) =>
      `Employer pension contribution is ${formatPercent(percentChange)} of gross pay`,
  },
};

const formatAmount = (value: number | null | undefined) =>
  typeof value === "number" ? `€${value.toFixed(2)}` : "n/a";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "n/a";

const pushIssue = (
  issues: IssueCandidate[],
  ruleCode: RuleCode,
  context: RuleContext = {},
  metadata?: Record<string, unknown>
) => {
  const definition = RULE_DEFINITIONS[ruleCode];
  issues.push({
    ruleCode,
    severity: definition.severity,
    description: definition.buildDescription(context),
    metadata,
  });
};

const hasPreviousData = (entry: { previous: number | null }) =>
  typeof entry.previous === "number";

const pensionPercent = (amount: number | null, gross: number | null) => {
  if (amount === null || gross === null || gross === 0) {
    return null;
  }
  return (amount / gross) * 100;
};

export const runRules = (
  current: PayslipLike,
  previous: PayslipLike | null,
  diff: PayslipDiff
): IssueCandidate[] => {
  const issues: IssueCandidate[] = [];

  // Rule 1: Large net change
  if (
    hasPreviousData(diff.net_pay) &&
    diff.net_pay.percentChange !== null &&
    Math.abs(diff.net_pay.percentChange) >= NET_CHANGE_THRESHOLD
  ) {
    pushIssue(issues, "NET_CHANGE_LARGE", {
      fieldLabel: "Net pay",
      previous: diff.net_pay.previous,
      current: diff.net_pay.current,
      percentChange: diff.net_pay.percentChange,
    });
  }

  // Rule 2: Large gross change
  if (
    hasPreviousData(diff.gross_pay) &&
    diff.gross_pay.percentChange !== null &&
    Math.abs(diff.gross_pay.percentChange) >= GROSS_CHANGE_THRESHOLD
  ) {
    pushIssue(issues, "GROSS_CHANGE_LARGE", {
      fieldLabel: "Gross pay",
      previous: diff.gross_pay.previous,
      current: diff.gross_pay.current,
      percentChange: diff.gross_pay.percentChange,
    });
  }

  // Rule 3: Tax spike without gross change
  if (
    hasPreviousData(diff.paye) &&
    diff.paye.percentChange !== null &&
    Math.abs(diff.paye.percentChange) >= TAX_SPIKE_THRESHOLD &&
    (diff.gross_pay.percentChange === null ||
      Math.abs(diff.gross_pay.percentChange) <= MAX_GROSS_DELTA_FOR_TAX_SPIKE)
  ) {
    pushIssue(issues, "TAX_SPIKE_WITHOUT_GROSS", {
      percentChange: diff.paye.percentChange,
    });
  }

  // Rule 4: YTD regressions
  ["ytd_gross", "ytd_net", "ytd_tax", "ytd_usc_or_ni"].forEach((field) => {
    const entry = diff[field as keyof PayslipDiff];
    if (hasPreviousData(entry) && entry.current !== null && entry.current < (entry.previous ?? 0)) {
      pushIssue(issues, "YTD_REGRESSION", {
        fieldLabel: field.replace("ytd_", "YTD ").toUpperCase(),
        previous: entry.previous,
        current: entry.current,
      });
    }
  });

  // Rule 5: PRSI/NI category change
  const prevCategory = previous?.prsi_or_ni_category?.trim().toUpperCase();
  const currCategory = current?.prsi_or_ni_category?.trim().toUpperCase();
  if (prevCategory && currCategory && prevCategory !== currCategory) {
    pushIssue(issues, "PRSI_CATEGORY_CHANGE", {
      detail: `${prevCategory} → ${currCategory}`,
    });
  }

  // Rule 6: Pension percentage higher than threshold
  const grossCurrent = diff.gross_pay.current ?? null;
  const employeePercent = pensionPercent(current.pension_employee ?? null, grossCurrent);
  if (employeePercent !== null && employeePercent >= PENSION_PERCENT_THRESHOLD) {
    pushIssue(issues, "PENSION_EMPLOYEE_HIGH", {
      percentChange: employeePercent,
    });
  }

  const employerPercent = pensionPercent(current.pension_employer ?? null, grossCurrent);
  if (employerPercent !== null && employerPercent >= PENSION_PERCENT_THRESHOLD) {
    pushIssue(issues, "PENSION_EMPLOYER_HIGH", {
      percentChange: employerPercent,
    });
  }

  return issues;
};

