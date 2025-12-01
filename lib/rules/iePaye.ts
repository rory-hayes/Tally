import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";

export type IePayeInputs = {
  standardRateCutoff: number;
  taxCredits: number;
};

export type IePayeBreakdown = {
  standardBandUsed: number;
  higherBandUsed: number;
  standardTax: number;
  higherTax: number;
  grossTax: number;
  creditsApplied: number;
  netTax: number;
};

const clamp = (value: number, min = 0) => (Number.isFinite(value) ? Math.max(min, value) : 0);

export const calcIePaye = (
  gross: number | null | undefined,
  config: IeTaxYearConfig,
  inputs: IePayeInputs
): IePayeBreakdown => {
  const grossPay = clamp(gross);
  const cutoff = clamp(inputs.standardRateCutoff);
  const credits = clamp(inputs.taxCredits);

  const standardBandUsed = Math.min(grossPay, cutoff);
  const higherBandUsed = Math.max(0, grossPay - standardBandUsed);

  const standardTax = standardBandUsed * config.paye.standardRate;
  const higherTax = higherBandUsed * config.paye.higherRate;
  const grossTax = standardTax + higherTax;
  const netTax = Math.max(0, grossTax - credits);

  return {
    standardBandUsed,
    higherBandUsed,
    standardTax,
    higherTax,
    grossTax,
    creditsApplied: credits,
    netTax,
  };
};

