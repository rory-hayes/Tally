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
};

const NUMERIC_FIELDS = [
  "gross_pay",
  "net_pay",
  "paye",
  "usc_ni",
  "pension_ee",
  "pension_er",
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
    }
  );

  return {
    raw_text: lines.join("\n"),
    ...parsedValues,
  };
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

export const buildPayslipInsert = (
  job: PayslipJob,
  employeeId: string,
  normalized: NormalizedTextractResult
) => ({
  organisation_id: job.organisation_id,
  client_id: job.client_id,
  batch_id: job.batch_id,
  employee_id: employeeId,
  pay_date: new Date().toISOString().slice(0, 10),
  gross_pay: normalized.gross_pay,
  net_pay: normalized.net_pay,
  paye: normalized.paye,
  usc_or_ni: normalized.usc_ni,
  pension_employee: normalized.pension_ee,
  pension_employer: normalized.pension_er,
  raw_ocr_json: normalized,
  storage_path: job.storage_path,
});

export const listMissingFields = (
  normalized: NormalizedTextractResult
): NumericField[] =>
  NUMERIC_FIELDS.filter((field) => normalized[field] === null);

