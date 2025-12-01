export const PAYSLIP_SELECT_FIELDS =
  "id, organisation_id, client_id, batch_id, employee_id, pay_date, gross_pay, net_pay, paye, usc_or_ni, pension_employee, pension_employer, ytd_gross, ytd_net, ytd_tax, ytd_usc_or_ni, prsi_or_ni_category";

type PayslipNumericField =
  | "gross_pay"
  | "net_pay"
  | "paye"
  | "usc_or_ni"
  | "pension_employee"
  | "pension_employer"
  | "ytd_gross"
  | "ytd_net"
  | "ytd_tax"
  | "ytd_usc_or_ni";

type PayslipLike = Partial<Record<PayslipNumericField, number | null | undefined>> & {
  prsi_or_ni_category?: string | null;
};

export type PayslipForRules = PayslipLike & {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  employee_id: string;
  prsi_or_ni_category?: string | null;
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

export type IssueSeverity = "info" | "warning" | "critical";

export type RuleCode =
  | "NET_CHANGE_LARGE"
  | "GROSS_CHANGE_LARGE"
  | "TAX_SPIKE_WITHOUT_GROSS"
  | "USC_SPIKE"
  | "YTD_REGRESSION"
  | "PRSI_CATEGORY_CHANGE"
  | "PENSION_OVER_THRESHOLD";

export type IssueCandidate = {
  ruleCode: RuleCode;
  severity: IssueSeverity;
  description: string;
};

const NET_CHANGE_THRESHOLD = 15;
const GROSS_CHANGE_THRESHOLD = 15;
const TAX_SPIKE_THRESHOLD = 20;
const USC_SPIKE_THRESHOLD = 20;
const MAX_GROSS_DELTA_FOR_TAX_SPIKE = 5;
const PENSION_PERCENT_THRESHOLD = 12;

const formatAmount = (value: number | null | undefined) =>
  typeof value === "number" ? `€${value.toFixed(2)}` : "n/a";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "n/a";

const RULE_DEFINITIONS: Record<
  RuleCode,
  { severity: IssueSeverity; description: (ctx: Record<string, unknown>) => string }
> = {
  NET_CHANGE_LARGE: {
    severity: "warning",
    description: ({ previous, current, percentChange }) =>
      `Net pay changed by ${formatPercent(percentChange as number | null | undefined)} (${formatAmount(
        previous as number | null | undefined
      )} → ${formatAmount(current as number | null | undefined)})`,
  },
  GROSS_CHANGE_LARGE: {
    severity: "warning",
    description: ({ previous, current, percentChange }) =>
      `Gross pay changed by ${formatPercent(percentChange as number | null | undefined)} (${formatAmount(
        previous as number | null | undefined
      )} → ${formatAmount(current as number | null | undefined)})`,
  },
  TAX_SPIKE_WITHOUT_GROSS: {
    severity: "warning",
    description: ({ percentChange }) =>
      `PAYE increased by ${formatPercent(percentChange as number | null | undefined)} while gross pay stayed flat`,
  },
  USC_SPIKE: {
    severity: "warning",
    description: ({ percentChange }) =>
      `USC/NI increased by ${formatPercent(percentChange as number | null | undefined)} while gross pay stayed flat`,
  },
  YTD_REGRESSION: {
    severity: "critical",
    description: ({ fieldLabel, previous, current }) =>
      `${fieldLabel ?? "YTD value"} decreased (${formatAmount(previous as number | null | undefined)} → ${formatAmount(
        current as number | null | undefined
      )})`,
  },
  PRSI_CATEGORY_CHANGE: {
    severity: "info",
    description: ({ detail }) => `PRSI/NI category changed ${detail ?? ""}`.trim(),
  },
  PENSION_OVER_THRESHOLD: {
    severity: "warning",
    description: ({ detail, percentChange }) =>
      `${detail ?? "Pension contribution"} is ${formatPercent(percentChange as number | null | undefined)} of gross pay`,
  },
};

const pushIssue = (
  issues: IssueCandidate[],
  ruleCode: RuleCode,
  ctx: Record<string, unknown>,
  severityOverride?: IssueSeverity
) => {
  const rule = RULE_DEFINITIONS[ruleCode];
  issues.push({
    ruleCode,
    severity: severityOverride ?? rule.severity,
    description: rule.description(ctx),
  });
};

const normalizeValue = (value: number | null | undefined) =>
  typeof value === "number" ? value : null;

const calculateDelta = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) {
    if (current !== null && previous === null) {
      return current;
    }
    if (current === null && previous !== null) {
      return -previous;
    }
    return null;
  }
  return current - previous;
};

const calculatePercentChange = (delta: number | null, previous: number | null) => {
  if (delta === null || previous === null || previous === 0) {
    return null;
  }
  return (delta / Math.abs(previous)) * 100;
};

const calculateDiff = (
  previous: PayslipLike | null | undefined,
  current: PayslipLike
): Record<
  PayslipNumericField,
  { previous: number | null; current: number | null; delta: number | null; percentChange: number | null }
> => {
  const fields: PayslipNumericField[] = [
    "gross_pay",
    "net_pay",
    "paye",
    "usc_or_ni",
    "pension_employee",
    "pension_employer",
    "ytd_gross",
    "ytd_net",
    "ytd_tax",
    "ytd_usc_or_ni",
  ];

  return fields.reduce((acc, field) => {
    const prevValue = normalizeValue(previous?.[field]);
    const currValue = normalizeValue(current[field]);
    const delta = calculateDelta(currValue, prevValue);
    acc[field] = {
      previous: prevValue,
      current: currValue,
      delta,
      percentChange: calculatePercentChange(delta, prevValue),
    };
    return acc;
  }, {} as Record<PayslipNumericField, { previous: number | null; current: number | null; delta: number | null; percentChange: number | null }>);
};

const runRules = (
  current: PayslipLike,
  previous: PayslipLike | null,
  diff: ReturnType<typeof calculateDiff>
) => {
  const issues: IssueCandidate[] = [];

  const netEntry = diff.net_pay;
  if (netEntry.percentChange !== null && Math.abs(netEntry.percentChange) >= NET_CHANGE_THRESHOLD) {
    pushIssue(issues, "NET_CHANGE_LARGE", {
      previous: netEntry.previous,
      current: netEntry.current,
      percentChange: netEntry.percentChange,
    });
  }

  const grossEntry = diff.gross_pay;
  if (grossEntry.percentChange !== null && Math.abs(grossEntry.percentChange) >= GROSS_CHANGE_THRESHOLD) {
    pushIssue(issues, "GROSS_CHANGE_LARGE", {
      previous: grossEntry.previous,
      current: grossEntry.current,
      percentChange: grossEntry.percentChange,
    });
  }

  const payeEntry = diff.paye;
  if (
    payeEntry.percentChange !== null &&
    Math.abs(payeEntry.percentChange) >= TAX_SPIKE_THRESHOLD &&
    (grossEntry.percentChange === null || Math.abs(grossEntry.percentChange) <= MAX_GROSS_DELTA_FOR_TAX_SPIKE)
  ) {
    pushIssue(issues, "TAX_SPIKE_WITHOUT_GROSS", {
      percentChange: payeEntry.percentChange,
    });
  }

  const uscEntry = diff.usc_or_ni;
  if (
    uscEntry.percentChange !== null &&
    Math.abs(uscEntry.percentChange) >= USC_SPIKE_THRESHOLD &&
    (grossEntry.percentChange === null || Math.abs(grossEntry.percentChange) <= MAX_GROSS_DELTA_FOR_TAX_SPIKE)
  ) {
    pushIssue(issues, "USC_SPIKE", {
      percentChange: uscEntry.percentChange,
    });
  }

  (["ytd_gross", "ytd_net", "ytd_tax", "ytd_usc_or_ni"] as PayslipNumericField[]).forEach((field) => {
    const entry = diff[field];
    if (entry.previous !== null && entry.current !== null && entry.current < entry.previous) {
      pushIssue(issues, "YTD_REGRESSION", {
        fieldLabel: field.replace("ytd_", "YTD ").toUpperCase(),
        previous: entry.previous,
        current: entry.current,
      });
    }
  });

  const prevCategory = previous?.prsi_or_ni_category?.trim().toUpperCase();
  const currCategory = current?.prsi_or_ni_category?.trim().toUpperCase();
  if (prevCategory && currCategory && prevCategory !== currCategory) {
    pushIssue(issues, "PRSI_CATEGORY_CHANGE", { detail: `${prevCategory} → ${currCategory}` });
  }

  const grossCurrent = grossEntry.current;
  const pensionPercent = (amount: number | null) => {
    if (amount === null || grossCurrent === null || grossCurrent === 0) return null;
    return (amount / grossCurrent) * 100;
  };

  const employeePercent = pensionPercent(current.pension_employee ?? null);
  if (employeePercent !== null && employeePercent >= PENSION_PERCENT_THRESHOLD) {
    pushIssue(
      issues,
      "PENSION_OVER_THRESHOLD",
      { detail: "Employee pension contribution", percentChange: employeePercent },
      "warning"
    );
  }

  const employerPercent = pensionPercent(current.pension_employer ?? null);
  if (employerPercent !== null && employerPercent >= PENSION_PERCENT_THRESHOLD) {
    pushIssue(
      issues,
      "PENSION_OVER_THRESHOLD",
      { detail: "Employer pension contribution", percentChange: employerPercent },
      "info"
    );
  }

  return issues;
};

const buildIssueRows = (
  payslip: PayslipForRules,
  candidates: IssueCandidate[]
): IssueInsertRow[] =>
  candidates.map((issue) => ({
    organisation_id: payslip.organisation_id,
    client_id: payslip.client_id,
    batch_id: payslip.batch_id,
    employee_id: payslip.employee_id,
    payslip_id: payslip.id,
    rule_code: issue.ruleCode,
    severity: issue.severity,
    description: issue.description,
    note: null,
  }));

export const buildIssuesForPayslip = (
  current: PayslipForRules,
  previous: PayslipForRules | null
): IssueInsertRow[] => {
  const diff = calculateDiff(previous, current);
  const issues = runRules(current, previous, diff);
  return buildIssueRows(current, issues);
};

