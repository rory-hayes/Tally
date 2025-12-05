import type { PayslipLike } from "@/lib/logic/payslipDiff";
import type { CountryCode, IssueSeverity, RuleCode } from "@/lib/rules/types";

export type GoldenTestCase = {
  id: string;
  description: string;
  country: CountryCode;
  taxYear: number;
  current: PayslipLike;
  previous?: PayslipLike | null;
  expectedIssues: { ruleCode: RuleCode; severity: IssueSeverity }[];
};

export const severityModel: Partial<Record<RuleCode, IssueSeverity>> = {
  NET_CHANGE_LARGE: "warning",
  GROSS_CHANGE_LARGE: "warning",
  TAX_SPIKE_WITHOUT_GROSS: "warning",
  USC_SPIKE_WITHOUT_GROSS: "warning",
  YTD_REGRESSION: "critical",
  PRSI_CATEGORY_CHANGE: "info",
  IE_PAYE_MISMATCH: "critical",
  IE_USC_MISMATCH: "critical",
  IE_PRSI_MISMATCH: "critical",
  UK_PAYE_MISMATCH: "critical",
  UK_NIC_MISMATCH: "critical",
  UK_STUDENT_LOAN_MISMATCH: "warning",
  REGISTER_PAYSPLIP_TOTAL_MISMATCH: "warning",
  GL_PAYROLL_TOTAL_MISMATCH: "warning",
  BANK_NETPAY_MISMATCH: "critical",
  SUBMISSION_TOTAL_MISMATCH: "critical",
};

export const goldenDataset: GoldenTestCase[] = [
  {
    id: "ie-clean",
    description: "IE employee with no anomalies",
    country: "IE",
    taxYear: 2025,
    current: {
      employee_id: "EMP001",
      gross_pay: 3200,
      net_pay: 2500,
      paye: 500,
      usc_or_ni: 100,
      pension_employee: 50,
      pension_employer: 50,
      prsi_or_ni_category: "A1",
    },
    previous: null,
    expectedIssues: [],
  },
  {
    id: "ie-paye-mismatch",
    description: "IE PAYE mismatch beyond tolerance",
    country: "IE",
    taxYear: 2025,
    current: {
      employee_id: "EMP002",
      gross_pay: 3000,
      net_pay: 2000,
      paye: 800,
      usc_or_ni: 90,
      pension_employee: 0,
      pension_employer: 0,
      prsi_or_ni_category: "A1",
    },
    previous: {
      employee_id: "EMP002",
      gross_pay: 3000,
      net_pay: 2100,
      paye: 700,
      usc_or_ni: 90,
      pension_employee: 0,
      pension_employer: 0,
      prsi_or_ni_category: "A1",
    },
    expectedIssues: [{ ruleCode: "IE_PAYE_MISMATCH", severity: "critical" }],
  },
  {
    id: "uk-nic-mismatch",
    description: "UK NIC mismatch on category A",
    country: "UK",
    taxYear: 2025,
    current: {
      employee_id: "EMP003",
      gross_pay: 2800,
      net_pay: 2100,
      paye: 400,
      usc_or_ni: 180,
      nic_employee: 180,
      nic_employer: 200,
      pension_employee: 0,
      pension_employer: 0,
      prsi_or_ni_category: "A",
    },
    previous: {
      employee_id: "EMP003",
      gross_pay: 2700,
      net_pay: 2050,
      paye: 390,
      usc_or_ni: 150,
      nic_employee: 150,
      nic_employer: 190,
      pension_employee: 0,
      pension_employer: 0,
      prsi_or_ni_category: "A",
    },
    expectedIssues: [{ ruleCode: "UK_NIC_MISMATCH", severity: "critical" }],
  },
];
