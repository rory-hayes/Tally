import { uk2025Config } from "@/config/uk/2025";

export type UkPayeBand = {
  label: string;
  rate: number;
  upTo: number | null; // null means no upper cap
};

export type UkNicThresholds = {
  primaryThresholdWeekly: number;
  secondaryThresholdWeekly: number;
  upperEarningsLimitWeekly: number;
  freePortUpperWeekly?: number;
};

export type UkNicRates = {
  employeeLowerRate: number; // between PT and UEL
  employeeUpperRate: number; // above UEL
  employerRate: number;
  employerFreePortRate?: number;
};

export type UkStudentLoanThreshold = {
  plan: "Plan1" | "Plan2" | "Plan4" | "Plan5" | "Postgrad";
  thresholdAnnual: number;
  rate: number;
};

export type UkTaxYearConfig = {
  year: number;
  references: string[];
  paye: {
    personalAllowance: number;
    bands: UkPayeBand[];
  };
  nic: {
    thresholds: UkNicThresholds;
    rates: UkNicRates;
  };
  studentLoans: UkStudentLoanThreshold[];
};

const UK_CONFIG_BY_YEAR: Record<number, UkTaxYearConfig> = {};

export const registerUkConfig = (config: UkTaxYearConfig) => {
  UK_CONFIG_BY_YEAR[config.year] = config;
};

export const getUkConfigForYear = (taxYear?: number | null): UkTaxYearConfig => {
  const availableYears = Object.keys(UK_CONFIG_BY_YEAR).map(Number);
  if (!availableYears.length) {
    throw new Error("No UK tax config registered");
  }
  const targetYear = typeof taxYear === "number" ? taxYear : Math.max(...availableYears);
  const config = UK_CONFIG_BY_YEAR[targetYear];
  if (!config) {
    throw new Error(`No UK tax config found for year ${targetYear}`);
  }
  return config;
};

// Register bundled configs
registerUkConfig(uk2025Config);
