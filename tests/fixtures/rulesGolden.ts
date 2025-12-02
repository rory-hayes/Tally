import type { CountryCode, IssueSeverity, RuleCode } from "@/lib/rules/types";
import type { PayslipLike } from "@/lib/logic/payslipDiff";
import type { RuleRuntimeOptions } from "@/lib/logic/rulesEngine";
import { getIeConfigForYear } from "@/lib/rules/ieConfig";
import { calcIeUsc } from "@/lib/rules/ieUsc";

export type GoldenScenario = {
  name: string;
  country: CountryCode;
  previous: PayslipLike | null;
  current: PayslipLike;
  expectedIssues: { ruleCode: RuleCode; severity: IssueSeverity }[];
  runtimeOptions?: Partial<RuleRuntimeOptions>;
};

const basePayslip: PayslipLike = {
  gross_pay: 3000,
  net_pay: 2100,
  paye: 600,
  pension_employee: 150,
  pension_employer: 150,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 600,
  prsi_or_ni_category: "A1",
};

const ieConfig2025 = getIeConfigForYear(2025);
const baselineUsc = calcIeUsc(basePayslip.gross_pay ?? 0, ieConfig2025).totalCharge;
basePayslip.usc_or_ni = baselineUsc;

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
  {
    name: "IE PAYE mismatch warning",
    country: "IE",
    previous: clone({
      gross_pay: 4000,
      paye: 400,
      usc_or_ni: calcIeUsc(4000, ieConfig2025).totalCharge,
    }),
    current: clone({
      gross_pay: 4000,
      paye: 400,
      usc_or_ni: calcIeUsc(4000, ieConfig2025).totalCharge,
    }),
    expectedIssues: [{ ruleCode: "IE_PAYE_MISMATCH", severity: "warning" }],
    runtimeOptions: {
      ieContext: {
        paye: {
          standardRateCutoff: 3500,
          taxCredits: 300,
        },
      },
      taxYear: 2025,
    },
  },
  {
    name: "IE USC mismatch warning",
    country: "IE",
    previous: clone({ gross_pay: 80000, usc_or_ni: 500 }),
    current: clone({ gross_pay: 80000, usc_or_ni: 500 }),
    expectedIssues: [{ ruleCode: "IE_USC_MISMATCH", severity: "warning" }],
    runtimeOptions: {
      taxYear: 2025,
    },
  },
];

