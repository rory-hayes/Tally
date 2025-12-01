import { ie2025Config } from "@/config/ie/2025";

export type IePayeBandCategory =
  | "single"
  | "married_one_income"
  | "married_two_income"
  | "single_parent";

export type IePayeBand = {
  category: IePayeBandCategory;
  standardRateCutoff: number;
  notes?: string;
};

export type IeUscBand = {
  upTo: number;
  rate: number;
};

export type IePrsiClass = {
  class: string;
  employeeRate: number;
  employerRate: number;
  weeklyThreshold?: number;
  note?: string;
};

export type IeTaxYearConfig = {
  year: number;
  references: string[];
  paye: {
    standardRate: number;
    higherRate: number;
    bands: IePayeBand[];
  };
  usc: {
    bands: IeUscBand[];
    surcharge?: { rate: number; appliesAbove: number; note?: string };
    reducedRates?: { label: string; rate: number; appliesUpTo: number }[];
  };
  prsi: {
    classes: Record<string, IePrsiClass>;
    credit?: { maxWeeklyCredit: number; tapersToZeroAt: number };
  };
};

const IE_CONFIG_BY_YEAR: Record<number, IeTaxYearConfig> = {
  2025: ie2025Config,
};

export const getIeConfigForYear = (taxYear?: number | null): IeTaxYearConfig => {
  const targetYear = typeof taxYear === "number" ? taxYear : ie2025Config.year;
  const config = IE_CONFIG_BY_YEAR[targetYear];
  if (!config) {
    throw new Error(`No IE tax config found for year ${targetYear}`);
  }
  return config;
};

