import type { CountryCode, RuleConfig } from "@/lib/rules/types";
import { getIeConfigForYear } from "@/lib/rules/ieConfig";
import { getUkConfigForYear } from "@/lib/rules/ukConfig";

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
    ukConfig: null,
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
    ukConfig: null,
  },
};

export const getDefaultRuleConfig = (
  country: CountryCode = "IE",
  taxYear?: number | null
): RuleConfig => {
  const exact = DEFAULT_CONFIGS[buildKey(country, taxYear)];
  const fallback = DEFAULT_CONFIGS[buildKey(country)];
  const base = exact ?? fallback ?? DEFAULT_CONFIGS[buildKey("IE")];
  const cloned: RuleConfig = { ...base, ieConfig: base.ieConfig ?? null, ukConfig: base.ukConfig ?? null };

  if (country === "IE") {
    try {
      cloned.ieConfig = getIeConfigForYear(taxYear);
    } catch (err) {
      console.warn("[rules] Missing IE config for year", taxYear, err);
      cloned.ieConfig = null;
    }
  }

  if (country === "UK") {
    try {
      cloned.ukConfig = getUkConfigForYear(taxYear);
    } catch (err) {
      console.warn("[rules] Missing UK config for year", taxYear, err);
      cloned.ukConfig = null;
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
