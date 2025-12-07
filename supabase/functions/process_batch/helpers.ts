type TextractBlock = {
  BlockType?: string;
  Text?: string | null;
};

type TextractResponse = {
  Blocks?: TextractBlock[] | null;
};

export type NormalizedTextractResult = {
  raw_text: string;
  gross_pay: number | null;
  net_pay: number | null;
  paye: number | null;
  usc_ni: number | null;
  pension_ee: number | null;
  pension_er: number | null;
  ytd_gross: number | null;
  ytd_net: number | null;
  ytd_tax: number | null;
  ytd_usc_or_ni: number | null;
  prsi_category: string | null;
  pay_date: string | null;
};

const NUMERIC_FIELDS = [
  "gross_pay",
  "net_pay",
  "paye",
  "usc_ni",
  "pension_ee",
  "pension_er",
  "ytd_gross",
  "ytd_net",
  "ytd_tax",
  "ytd_usc_or_ni",
] as const;
type NumericField = (typeof NUMERIC_FIELDS)[number];

const FIELD_PATTERNS: Record<NumericField, RegExp[]> = {
  gross_pay: [/gross\s+pay[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i],
  net_pay: [/net\s+pay[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i],
  paye: [/paye[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i],
  usc_ni: [
    /(usc\/?ni|usc|ni)[^\d]*([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /usc\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  pension_ee: [
    /pension\s*\(employee\)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /employee\s+pension[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  pension_er: [
    /pension\s*\(employer\)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /employer\s+pension[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  ytd_gross: [
    /(year(?:-|\s*)to(?:-|\s*)date|ytd)\s*(?:gross|total\s+gross)[^\d]*([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /gross\s*(?:ytd|year(?:-|\s*)to(?:-|\s*)date)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  ytd_net: [
    /(year(?:-|\s*)to(?:-|\s*)date|ytd)\s*(?:net\s+pay|net)[^\d]*([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /net\s*(?:ytd|year(?:-|\s*)to(?:-|\s*)date)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  ytd_tax: [
    /(year(?:-|\s*)to(?:-|\s*)date|ytd)\s*(?:paye|tax)[^\d]*([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /(paye|tax)\s*(?:ytd|year(?:-|\s*)to(?:-|\s*)date)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
  ytd_usc_or_ni: [
    /(year(?:-|\s*)to(?:-|\s*)date|ytd)\s*(?:usc|usc\/?ni|ni)[^\d]*([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
    /(usc|usc\/?ni|ni)\s*(?:ytd|year(?:-|\s*)to(?:-|\s*)date)\s*[:\s-]+([$\u00a3\u20ac]?\s*[\d,]+(?:\.\d+)?)/i,
  ],
};

const normaliseAmount = (value: string) => {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const findAmount = (lines: string[], field: NumericField) => {
  for (const line of lines) {
    for (const pattern of FIELD_PATTERNS[field]) {
      const match = line.match(pattern);
      if (match) {
        const numericPortion = match[match.length - 1];
        const value = normaliseAmount(numericPortion);
        if (value !== null) {
          return value;
        }
      }
    }
  }
  return null;
};

export const normalizeTextractResponse = (
  response: TextractResponse | null | undefined
): NormalizedTextractResult => {
  const blocks = Array.isArray(response?.Blocks) ? response?.Blocks : [];
  const lines = blocks
    .filter(
      (block) =>
        block?.BlockType === "LINE" && typeof block.Text === "string" && block.Text.trim().length
    )
    .map((block) => block.Text!.trim());

  const parsedValues = NUMERIC_FIELDS.reduce<Record<NumericField, number | null>>(
    (acc, field) => {
      acc[field] = findAmount(lines, field);
      return acc;
    },
    {
      gross_pay: null,
      net_pay: null,
      paye: null,
      usc_ni: null,
      pension_ee: null,
      pension_er: null,
      ytd_gross: null,
      ytd_net: null,
      ytd_tax: null,
      ytd_usc_or_ni: null,
    }
  );

  const prsiCategory = findPrsiCategory(lines);
  const payDate = findPayDate(lines);

  return {
    raw_text: lines.join("\n"),
    prsi_category: prsiCategory,
    pay_date: payDate,
    ...parsedValues,
  };
};

const findPrsiCategory = (lines: string[]) => {
  const pattern = /(prsi|ni)\s+(?:class|category)\s*([a-z0-9]+)/i;
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[2]) {
      return match[2].toUpperCase();
    }
  }
  return null;
};

const MONTH_MAP: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const toIsoDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const stripOrdinals = (value: string) => value.replace(/(\d+)(st|nd|rd|th)/gi, "$1");

const parseDayMonthYear = (day: number, monthToken: string, year: number) => {
  const monthIndex = MONTH_MAP[monthToken.toLowerCase()];
  if (monthIndex === undefined) return null;
  return toIsoDate(new Date(Date.UTC(year, monthIndex, day)));
};

const parseSlashDate = (token: string) => {
  const parts = token.split(/[\/-]/).map((part) => part.trim());
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;

  if (a.length === 4) {
    return toIsoDate(new Date(`${a}-${b}-${c}`));
  }

  const day = Number(a);
  const month = Number(b) - 1;
  const year = Number(c.length === 2 ? `20${c}` : c);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    return null;
  }
  return toIsoDate(new Date(Date.UTC(year, month, day)));
};

const PERIOD_LABEL_REGEX =
  /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[^\d]{0,10}(\d{4})/i;

const findPayDate = (lines: string[]) => {
  for (const line of lines) {
    const isoMatch = line.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (isoMatch?.[0]) {
      const parsed = toIsoDate(new Date(isoMatch[0]));
      if (parsed) return parsed;
    }

    const slashMatch = line.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/);
    if (slashMatch?.[0]) {
      const parsed = parseSlashDate(slashMatch[0]);
      if (parsed) return parsed;
    }

    const textMatch = line.match(
      /\b\d{1,2}(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}\b/i
    );
    if (textMatch?.[0]) {
      const cleaned = stripOrdinals(textMatch[0]);
      const [dayToken, monthToken, yearToken] = cleaned.split(/\s+/);
      const parsed = parseDayMonthYear(Number(dayToken), monthToken, Number(yearToken));
      if (parsed) return parsed;
    }
  }
  return null;
};

export const ensureNormalizedHasContent = (
  normalized: NormalizedTextractResult
) => {
  if (!normalized.raw_text.trim().length) {
    throw new Error("OCR result did not contain any text");
  }
};

export const deriveIdentifierFromPath = (storagePath: string) => {
  const fileName = storagePath.split("/").pop() ?? "payslip.pdf";
  const match = fileName.match(/(EMP[\w\d]+)/i);
  if (match?.[0]) {
    return match[0].toUpperCase();
  }
  return fileName.replace(/\.pdf$/i, "").toUpperCase();
};

export const shouldCompleteBatch = (
  processedFiles: number,
  totalFiles: number
) => processedFiles >= totalFiles && totalFiles > 0;

export const buildBatchUpdatePayload = (
  processedFiles: number,
  totalFiles: number
) => {
  const updates: Record<string, unknown> = {
    processed_files: processedFiles,
  };

  if (shouldCompleteBatch(processedFiles, totalFiles)) {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
  }

  return updates;
};

type PayslipJob = {
  organisation_id: string;
  client_id: string;
  batch_id: string;
  storage_path: string;
};

export const derivePayDateFromBatch = (
  periodLabel?: string | null,
  createdAt?: string | null
): string | null => {
  if (periodLabel) {
    const match = periodLabel.match(PERIOD_LABEL_REGEX);
    if (match) {
      const monthIndex = MONTH_MAP[match[1].toLowerCase()];
      const year = Number(match[2]);
      if (monthIndex !== undefined && !Number.isNaN(year)) {
        const date = new Date(Date.UTC(year, monthIndex, 1));
        return toIsoDate(date);
      }
    }
  }

  if (createdAt) {
    return createdAt.slice(0, 10);
  }

  return null;
};

export const resolvePayDate = (
  batchPayDate: string | null,
  normalizedPayDate: string | null,
  periodLabel?: string | null,
  createdAt?: string | null
) => {
  if (batchPayDate) return batchPayDate;
  if (normalizedPayDate) return normalizedPayDate;
  return derivePayDateFromBatch(periodLabel, createdAt);
};

export const buildPayslipInsert = (
  job: PayslipJob,
  employeeId: string,
  normalized: NormalizedTextractResult,
  payDate: string
) => ({
  organisation_id: job.organisation_id,
  client_id: job.client_id,
  batch_id: job.batch_id,
  employee_id: employeeId,
  pay_date: payDate,
  gross_pay: normalized.gross_pay,
  net_pay: normalized.net_pay,
  paye: normalized.paye,
  usc_or_ni: normalized.usc_ni,
  pension_employee: normalized.pension_ee,
  pension_employer: normalized.pension_er,
  ytd_gross: normalized.ytd_gross,
  ytd_net: normalized.ytd_net,
  ytd_tax: normalized.ytd_tax,
  ytd_usc_or_ni: normalized.ytd_usc_or_ni,
  prsi_or_ni_category: normalized.prsi_category,
  raw_ocr_json: normalized,
  storage_path: job.storage_path,
});

export const listMissingFields = (
  normalized: NormalizedTextractResult
): NumericField[] =>
  NUMERIC_FIELDS.filter((field) => normalized[field] === null);
