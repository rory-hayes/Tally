import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";

export type IeUscBandUsage = {
  rate: number;
  amount: number;
  charge: number;
  upperLimit: number;
};

export type IeUscResult = {
  bandUsage: IeUscBandUsage[];
  totalCharge: number;
};

const clampIncome = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

export const calcIeUsc = (income: number | null | undefined, config: IeTaxYearConfig): IeUscResult => {
  const uscIncome = clampIncome(income);
  let remaining = uscIncome;
  const usage: IeUscBandUsage[] = [];

  config.usc.bands.forEach((band, index) => {
    if (remaining <= 0) return;
    const previousUpper = index === 0 ? 0 : Math.min(config.usc.bands[index - 1].upTo, uscIncome);
    const bandCap = Number.isFinite(band.upTo) ? band.upTo : uscIncome;
    const available = Math.max(0, Math.min(remaining, bandCap - previousUpper));
    const charge = available * band.rate;
    usage.push({
      rate: band.rate,
      amount: available,
      charge,
      upperLimit: band.upTo,
    });
    remaining -= available;
  });

  return {
    bandUsage: usage,
    totalCharge: usage.reduce((sum, band) => sum + band.charge, 0),
  };
};

