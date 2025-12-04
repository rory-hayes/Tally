import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";
import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";
import type { PayFrequency } from "@/lib/rules/iePrsi";
import type { IePrsiProfile } from "@/lib/rules/iePrsi";

export type IssueSeverity = "info" | "warning" | "critical";

export type RuleCode =
  | "NET_CHANGE_LARGE"
  | "GROSS_CHANGE_LARGE"
  | "TAX_SPIKE_WITHOUT_GROSS"
  | "USC_SPIKE_WITHOUT_GROSS"
  | "YTD_REGRESSION"
  | "PRSI_CATEGORY_CHANGE"
  | "PENSION_EMPLOYEE_HIGH"
  | "PENSION_EMPLOYER_HIGH"
  | "IE_PAYE_MISMATCH"
  | "IE_USC_MISMATCH"
  | "IE_PRSI_MISMATCH"
  | "IE_PRSI_CLASS_UNUSUAL"
  | "UK_PAYE_MISMATCH"
  | "UK_NIC_MISMATCH"
  | "UK_NIC_CATEGORY_UNUSUAL"
  | "UK_STUDENT_LOAN_MISMATCH"
  | "REGISTER_PAYSPLIP_TOTAL_MISMATCH"
  | "MISSING_REGISTER_ENTRY"
  | "MISSING_PAYSLIP"
  | "GL_PAYROLL_TOTAL_MISMATCH"
  | "GL_EMPLOYER_TAX_MISMATCH"
  | "BANK_NETPAY_MISMATCH"
  | "BANK_PAYMENT_WITHOUT_PAYSLIP"
  | "PAYSLIP_WITHOUT_PAYMENT";

export type IssueDataPayload = Record<string, unknown>;

export type IssueCandidate = {
  ruleCode: RuleCode;
  severity: IssueSeverity;
  description: string;
  data?: IssueDataPayload;
};

export type CountryCode = "IE" | "UK" | string;

export type ContractProfile = {
  salaryAmount?: number | null;
  salaryPeriod?: "annual" | "monthly" | "weekly" | "daily" | "hourly" | null;
  hourlyRate?: number | null;
  standardHoursPerWeek?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RuleEvaluationContext = {
  current: PayslipLike;
  previous: PayslipLike | null;
  diff: PayslipDiff;
  country: CountryCode;
  taxYear: number | null;
  config: RuleConfig;
  ieContext?: IeRuleContext | null;
  ukContext?: UkRuleContext | null;
  contractProfile?: ContractProfile | null;
};

export type RuleEvaluationOutcome = {
  description?: string;
  severity?: IssueSeverity;
  data?: IssueDataPayload;
};

export type RuleEvaluationResult =
  | null
  | undefined
  | RuleEvaluationOutcome
  | RuleEvaluationOutcome[];

export type RuleConfig = {
  largeNetChangePercent: number;
  largeGrossChangePercent: number;
  payeSpikePercent: number;
  uscSpikePercent: number;
  maxGrossDeltaPercent: number;
  maxGrossDeltaForUscPercent: number;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  ieConfig?: IeTaxYearConfig | null;
  ukConfig?: UkTaxYearConfig | null;
};

export type IeRuleContext = {
  paye?: {
    standardRateCutoff: number;
    taxCredits: number;
  };
  prsi?: IePrsiProfile | null;
};

export type UkRuleContext = {
  paye?: {
    taxCode?: string | null;
    payFrequency?: PayFrequency | null;
  };
  nic?: {
    categoryLetter?: string | null;
    payFrequency?: PayFrequency | null;
    age?: number | null;
    isApprentice?: boolean;
    isPensioner?: boolean;
    expectedCategory?: string | null;
  };
  studentLoans?: {
    planType?: "Plan1" | "Plan2" | "Plan4" | "Plan5" | null;
    hasPostgradLoan?: boolean;
    payFrequency?: PayFrequency | null;
  };
  contract?: ContractProfile | null;
};
