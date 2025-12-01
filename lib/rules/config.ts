import type { CountryCode, RuleConfig } from "@/lib/rules/types";

type CountryYearKey = string;

const buildKey = (country: CountryCode, taxYear?: number | null) =>
  `${country}:${taxYear ?? "default"}`;

const DEFAULT_CONFIGS: Record<CountryYearKey, RuleConfig> = {
  [buildKey("IE")]: {
    largeNetChangePercent: 15,
    largeGrossChangePercent: 15,
    payeSpikePercent: 20,
    uscSpikePercent: 20,
    maxGrossDeltaPercent: 5,
    maxGrossDeltaForUscPercent: 5,
    pensionEmployeePercent: 10,
    pensionEmployerPercent: 12,
  },
  [buildKey("UK")]: {
    largeNetChangePercent: 15,
    largeGrossChangePercent: 15,
    payeSpikePercent: 20,
    uscSpikePercent: 20,
    maxGrossDeltaPercent: 5,
    maxGrossDeltaForUscPercent: 5,
    pensionEmployeePercent: 10,
    pensionEmployerPercent: 12,
  },
};

export const getDefaultRuleConfig = (
  country: CountryCode = "IE",
  taxYear?: number | null
): RuleConfig => {
  const exact = DEFAULT_CONFIGS[buildKey(country, taxYear)];
  if (exact) return exact;
  const fallback = DEFAULT_CONFIGS[buildKey(country)];
  if (fallback) return fallback;
  return DEFAULT_CONFIGS[buildKey("IE")];
};

export const mergeRuleConfig = (
  base: RuleConfig,
  override?: Partial<RuleConfig> | null
): RuleConfig => {
  if (!override) return { ...base };
  return { ...base, ...override };
};

