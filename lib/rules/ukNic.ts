import { deriveWeeklyEarnings } from "@/lib/rules/iePrsi";
import type { PayFrequency } from "@/lib/rules/iePrsi";
import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";

export type UkNicResult = {
  category: string;
  weeklyEarnings: number;
  employeeCharge: number;
  employerCharge: number;
  employeeLowerRateUsed: number;
  employeeUpperRateUsed: number;
  employerRateUsed: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export const normalizeNicCategory = (category?: string | null) => {
  if (!category) return null;
  return category.trim().toUpperCase().charAt(0);
};

export const calcUkNic = (
  gross: number | null | undefined,
  config: UkTaxYearConfig,
  categoryLetter?: string | null,
  payFrequency?: PayFrequency | null | undefined
): UkNicResult => {
  const category = normalizeNicCategory(categoryLetter) ?? "A";
  const catConfig = config.nic.categories[category] ?? config.nic.categories.A;
  const weeklyEarnings = deriveWeeklyEarnings(gross, payFrequency);
  const { thresholds, rates } = config.nic;

  const lowerRate =
    typeof catConfig.employeeLowerRateOverride === "number"
      ? catConfig.employeeLowerRateOverride
      : rates.employeeLowerRate;
  const upperRate =
    typeof catConfig.employeeUpperRateOverride === "number"
      ? catConfig.employeeUpperRateOverride
      : rates.employeeUpperRate;
  const employerRate =
    typeof catConfig.employerRateOverride === "number" ? catConfig.employerRateOverride : rates.employerRate;

  const abovePrimary = Math.max(0, weeklyEarnings - thresholds.primaryThresholdWeekly);
  const lowerSlice = Math.min(abovePrimary, thresholds.upperEarningsLimitWeekly - thresholds.primaryThresholdWeekly);
  const upperSlice = Math.max(0, weeklyEarnings - thresholds.upperEarningsLimitWeekly);

  const employeeCharge = lowerSlice * lowerRate + upperSlice * upperRate;

  let employerCharge = 0;
  const employerBase = Math.max(0, weeklyEarnings - thresholds.secondaryThresholdWeekly);

  const upperSecondary = thresholds.upperSecondaryThresholdWeekly ?? thresholds.upperEarningsLimitWeekly;
  if (
    typeof catConfig.employerRateBelowUpperSecondary === "number" &&
    weeklyEarnings <= upperSecondary
  ) {
    employerCharge = employerBase * catConfig.employerRateBelowUpperSecondary;
  } else {
    employerCharge = employerBase * employerRate;
  }

  return {
    category,
    weeklyEarnings: round2(weeklyEarnings),
    employeeCharge: round2(employeeCharge),
    employerCharge: round2(employerCharge),
    employeeLowerRateUsed: lowerRate,
    employeeUpperRateUsed: upperRate,
    employerRateUsed: employerRate,
  };
};
