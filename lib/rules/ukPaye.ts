import type { PayFrequency } from "@/lib/rules/iePrsi";
import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";

type PayPeriodsPerYear = Record<PayFrequency, number>;

const PERIODS_PER_YEAR: PayPeriodsPerYear = {
  weekly: 52,
  biweekly: 26,
  four_weekly: 13,
  monthly: 12,
};

const clamp = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const round2 = (value: number) => Math.round(value * 100) / 100;

const parseTaxCodeAllowance = (taxCode: string, defaultAllowance: number) => {
  const cleaned = taxCode.trim().toUpperCase();
  if (cleaned === "BR") {
    return 0;
  }
  const match = cleaned.match(/(\d{1,4})/);
  if (!match) return defaultAllowance;
  const codeNumber = Number(match[1]);
  return codeNumber * 10;
};

export type UkPayeResult = {
  allowancePerPeriod: number;
  taxablePerPeriod: number;
  taxDue: number;
};

export const calcUkPaye = (
  gross: number | null | undefined,
  config: UkTaxYearConfig,
  taxCode: string,
  payFrequency: PayFrequency | null | undefined
): UkPayeResult => {
  const grossPay = clamp(gross);
  const periods = payFrequency ? PERIODS_PER_YEAR[payFrequency] ?? 12 : 12;

  const annualAllowance = parseTaxCodeAllowance(taxCode, config.paye.personalAllowance);
  const allowancePerPeriod = annualAllowance / periods;

  const taxablePerPeriod = Math.max(0, grossPay - allowancePerPeriod);

  let taxDue = 0;
  const bands = config.paye.bands;
  const taxableAnnual = taxablePerPeriod * periods;

  if (taxCode.trim().toUpperCase() === "BR") {
    // Basic Rate applied to all taxable income
    const basicRate = bands[0]?.rate ?? 0.2;
    taxDue = taxablePerPeriod * basicRate;
  } else {
    let remainingAnnual = taxableAnnual;
    let previousCap = 0;
    bands.forEach((band, index) => {
      if (remainingAnnual <= 0) return;
      const upperCap = band.upTo ?? taxableAnnual;
      const bandSpan = upperCap - previousCap;
      const used = Math.max(0, Math.min(remainingAnnual, bandSpan));
      const usedPerPeriod = used / periods;
      taxDue += usedPerPeriod * band.rate;
      remainingAnnual -= used;
      previousCap = upperCap;
    });
  }

  return {
    allowancePerPeriod: round2(allowancePerPeriod),
    taxablePerPeriod: round2(taxablePerPeriod),
    taxDue: round2(taxDue),
  };
};
