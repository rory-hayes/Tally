export type GlPosting = {
  wages: number;
  employer_taxes: number;
  pensions: number;
  other: number;
  currency: string | null;
};

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

export const parseGlCsv = (csv: string): GlPosting => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return { wages: 0, employer_taxes: 0, pensions: 0, other: 0, currency: null };
  }
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const totals: GlPosting = { wages: 0, employer_taxes: 0, pensions: 0, other: 0, currency: null };
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = parts[idx] ?? "";
    });
    totals.wages += parseNumber(record["wages"] ?? record["gross"]);
    totals.employer_taxes += parseNumber(record["employer_taxes"] ?? record["er_taxes"] ?? record["ni_er"]);
    totals.pensions += parseNumber(record["pensions"] ?? record["er_pension"]);
    totals.other += parseNumber(record["other"]);
    totals.currency = totals.currency ?? record["currency"] ?? null;
  }
  return totals;
};
