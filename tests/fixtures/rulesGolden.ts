import type { CountryCode, IssueSeverity, RuleCode } from "@/lib/rules/types";
import type { PayslipLike } from "@/lib/logic/payslipDiff";

export type GoldenScenario = {
  name: string;
  country: CountryCode;
  previous: PayslipLike | null;
  current: PayslipLike;
  expectedIssues: { ruleCode: RuleCode; severity: IssueSeverity }[];
};

const basePayslip: PayslipLike = {
  gross_pay: 3000,
  net_pay: 2100,
  paye: 600,
  usc_or_ni: 120,
  pension_employee: 150,
  pension_employer: 150,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 600,
  prsi_or_ni_category: "A1",
};

const clone = (overrides: Partial<PayslipLike> = {}) => ({
  ...basePayslip,
  ...overrides,
});

export const goldenScenarios: GoldenScenario[] = [
  {
    name: "IE baseline correct payroll",
    country: "IE",
    previous: clone(),
    current: clone(),
    expectedIssues: [],
  },
  {
    name: "IE large net change warning",
    country: "IE",
    previous: clone(),
    current: clone({ net_pay: 2600 }),
    expectedIssues: [{ ruleCode: "NET_CHANGE_LARGE", severity: "warning" }],
  },
  {
    name: "IE PAYE spike warning",
    country: "IE",
    previous: clone(),
    current: clone({ paye: 900 }),
    expectedIssues: [{ ruleCode: "TAX_SPIKE_WITHOUT_GROSS", severity: "warning" }],
  },
  {
    name: "IE YTD regression critical",
    country: "IE",
    previous: clone(),
    current: clone({ ytd_net: 10000 }),
    expectedIssues: [{ ruleCode: "YTD_REGRESSION", severity: "critical" }],
  },
  {
    name: "UK baseline correct payroll",
    country: "UK",
    previous: clone({ prsi_or_ni_category: "B1" }),
    current: clone({ prsi_or_ni_category: "B1" }),
    expectedIssues: [],
  },
  {
    name: "UK PRSI/NI category change info",
    country: "UK",
    previous: clone({ prsi_or_ni_category: "A1" }),
    current: clone({ prsi_or_ni_category: "B2" }),
    expectedIssues: [{ ruleCode: "PRSI_CATEGORY_CHANGE", severity: "info" }],
  },
  {
    name: "UK USC spike warning",
    country: "UK",
    previous: clone(),
    current: clone({ usc_or_ni: 220, gross_pay: 3050 }),
    expectedIssues: [{ ruleCode: "USC_SPIKE_WITHOUT_GROSS", severity: "warning" }],
  },
];

