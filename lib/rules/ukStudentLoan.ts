import type { PayFrequency } from "@/lib/rules/iePrsi";
import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";

const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  four_weekly: 13,
  monthly: 12,
};

const clamp = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const round2 = (value: number) => Math.round(value * 100) / 100;

export type UkStudentLoanResult = {
  planType: string | null;
  postgradApplied: boolean;
  planCharge: number;
  postgradCharge: number;
  totalCharge: number;
  planThresholdPerPeriod: number | null;
  postgradThresholdPerPeriod: number | null;
};

const getPlanConfig = (config: UkTaxYearConfig, planType?: string | null) => {
  if (!planType) return null;
  return config.studentLoans.find((plan) => plan.plan === planType) ?? null;
};

const getPostgradConfig = (config: UkTaxYearConfig) =>
  config.studentLoans.find((plan) => plan.plan === "Postgrad") ?? null;

export const calcUkStudentLoan = (
  gross: number | null | undefined,
  config: UkTaxYearConfig,
  planType?: "Plan1" | "Plan2" | "Plan4" | "Plan5" | null,
  hasPostgradLoan?: boolean,
  payFrequency?: PayFrequency | null | undefined
): UkStudentLoanResult => {
  const pay = clamp(gross);
  const periods = payFrequency ? PERIODS_PER_YEAR[payFrequency] ?? 12 : 12;
  const planConfig = getPlanConfig(config, planType);
  const postgradConfig = hasPostgradLoan ? getPostgradConfig(config) : null;

  const planThresholdPerPeriod =
    planConfig && periods > 0 ? planConfig.thresholdAnnual / periods : null;
  const postgradThresholdPerPeriod =
    postgradConfig && periods > 0 ? postgradConfig.thresholdAnnual / periods : null;

  const planCharge =
    planThresholdPerPeriod !== null
      ? Math.max(0, pay - planThresholdPerPeriod) * (planConfig?.rate ?? 0)
      : 0;
  const postgradCharge =
    postgradThresholdPerPeriod !== null
      ? Math.max(0, pay - postgradThresholdPerPeriod) * (postgradConfig?.rate ?? 0)
      : 0;

  const roundedPlanCharge = round2(planCharge);
  const roundedPostgrad = round2(postgradCharge);

  return {
    planType: planType ?? null,
    postgradApplied: !!postgradConfig,
    planCharge: roundedPlanCharge,
    postgradCharge: roundedPostgrad,
    totalCharge: round2(roundedPlanCharge + roundedPostgrad),
    planThresholdPerPeriod: planThresholdPerPeriod ? round2(planThresholdPerPeriod) : null,
    postgradThresholdPerPeriod: postgradThresholdPerPeriod ? round2(postgradThresholdPerPeriod) : null,
  };
};
