import type { DetectDocumentTextCommandOutput } from "npm:@aws-sdk/client-textract";

export type NormalizedTextractResult = {
  raw_text: string;
  gross_pay: number | null;
  net_pay: number | null;
  paye: number | null;
  usc_ni: number | null;
  pension_ee: number | null;
  pension_er: number | null;
};

export const normalizeTextractResponse = (
  response: DetectDocumentTextCommandOutput | null | undefined
): NormalizedTextractResult => {
  const blocks = Array.isArray(response?.Blocks) ? response?.Blocks : [];
  const lines = blocks
    .filter(
      (block) =>
        block?.BlockType === "LINE" && typeof block.Text === "string" && block.Text.trim().length
    )
    .map((block) => block.Text!.trim());

  return {
    raw_text: lines.join("\n"),
    gross_pay: null,
    net_pay: null,
    paye: null,
    usc_ni: null,
    pension_ee: null,
    pension_er: null,
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

