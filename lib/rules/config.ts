import type { CountryCode, RuleConfig } from "@/lib/rules/types";
import { getIeConfigForYear } from "@/lib/rules/ieConfig";

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
    ieConfig: null,
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
    ieConfig: null,
  },
};

export const getDefaultRuleConfig = (
  country: CountryCode = "IE",
  taxYear?: number | null
): RuleConfig => {
  const exact = DEFAULT_CONFIGS[buildKey(country, taxYear)];
  const fallback = DEFAULT_CONFIGS[buildKey(country)];
  const base = exact ?? fallback ?? DEFAULT_CONFIGS[buildKey("IE")];
  const cloned: RuleConfig = { ...base, ieConfig: base.ieConfig ?? null };

  if (country === "IE") {
    try {
      cloned.ieConfig = getIeConfigForYear(taxYear);
    } catch (err) {
      console.warn("[rules] Missing IE config for year", taxYear, err);
      cloned.ieConfig = null;
    }
  }

  return cloned;
};

export const mergeRuleConfig = (
  base: RuleConfig,
  override?: Partial<RuleConfig> | null
): RuleConfig => {
  if (!override) return { ...base };
  return { ...base, ...override };
};

