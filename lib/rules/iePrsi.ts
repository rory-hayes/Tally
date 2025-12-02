import type { PayslipLike } from "@/lib/logic/payslipDiff";
import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";

export type PayFrequency = "weekly" | "biweekly" | "four_weekly" | "monthly";

export type IePrsiProfile = {
  expectedClass?: string | null;
  isPensioner?: boolean;
  age?: number | null;
  isSelfEmployed?: boolean;
  lowPayRole?: boolean;
  payFrequency?: PayFrequency | null;
  weeklyEarningsOverride?: number | null;
};

export type IePrsiResult = {
  classCode: string;
  weeklyEarnings: number;
  subjectEarnings: number;
  employeeRate: number;
  employerRate: number;
  employeeCredit: number;
  employeeCharge: number;
  employerCharge: number;
};

const clamp = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const round2 = (value: number) => Math.round(value * 100) / 100;

export const normalizePrsiClass = (value?: string | null) => {
  if (!value || typeof value !== "string") return null;
  const match = value.trim().toUpperCase().match(/^([A-Z])/);
  return match ? match[1] : null;
};

export const deriveWeeklyEarnings = (
  gross: number | null | undefined,
  frequency?: PayFrequency | null,
  override?: number | null
) => {
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.max(0, override);
  }
  const pay = clamp(gross);
  switch (frequency) {
    case "monthly":
      return pay / 4.345; // approx weeks per month
    case "biweekly":
      return pay / 2;
    case "four_weekly":
      return pay / 4;
    default:
      return pay;
  }
};

const calculatePrsiCredit = (
  earnings: number,
  threshold: number,
  creditConfig?: IeTaxYearConfig["prsi"]["credit"]
) => {
  if (!creditConfig || earnings <= threshold) return 0;
  const { maxWeeklyCredit, tapersToZeroAt } = creditConfig;
  if (earnings >= tapersToZeroAt) return 0;
  const taperRange = tapersToZeroAt - threshold;
  if (taperRange <= 0) return 0;
  const progress = (earnings - threshold) / taperRange;
  return Math.max(0, maxWeeklyCredit * (1 - progress));
};

export const calcIePrsi = (
  payslip: PayslipLike,
  config: IeTaxYearConfig,
  profile?: IePrsiProfile | null
): IePrsiResult | null => {
  const declaredClass =
    normalizePrsiClass(payslip.prsi_or_ni_category) ??
    normalizePrsiClass(profile?.expectedClass);
  const classConfig = declaredClass ? config.prsi.classes[declaredClass] : null;
  if (!classConfig) return null;

  const weeklyEarnings = deriveWeeklyEarnings(
    payslip.gross_pay,
    profile?.payFrequency,
    profile?.weeklyEarningsOverride
  );
  const threshold = classConfig.weeklyThreshold ?? 0;
  const subjectEarnings = weeklyEarnings <= threshold ? 0 : weeklyEarnings;

  const employeeRate = classConfig.employeeRate ?? 0;
  const employerRate = classConfig.employerRate ?? 0;

  const employeeBase = subjectEarnings * employeeRate;
  const employerBase = subjectEarnings * employerRate;
  const employeeCredit =
    classConfig.class === "A"
      ? calculatePrsiCredit(subjectEarnings, threshold, config.prsi.credit)
      : 0;
  const employeeCharge = Math.max(0, employeeBase - employeeCredit);

  return {
    classCode: classConfig.class,
    weeklyEarnings: round2(weeklyEarnings),
    subjectEarnings: round2(subjectEarnings),
    employeeRate,
    employerRate,
    employeeCredit: round2(employeeCredit),
    employeeCharge: round2(employeeCharge),
    employerCharge: round2(employerBase),
  };
};
