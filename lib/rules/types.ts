import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";
import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";
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
  | "IE_PRSI_CLASS_UNUSUAL";

export type IssueDataPayload = Record<string, unknown>;

export type IssueCandidate = {
  ruleCode: RuleCode;
  severity: IssueSeverity;
  description: string;
  data?: IssueDataPayload;
};

export type CountryCode = "IE" | "UK" | string;

export type RuleEvaluationContext = {
  current: PayslipLike;
  previous: PayslipLike | null;
  diff: PayslipDiff;
  country: CountryCode;
  taxYear: number | null;
  config: RuleConfig;
  ieContext?: IeRuleContext | null;
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
