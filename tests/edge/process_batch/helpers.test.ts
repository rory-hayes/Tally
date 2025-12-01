import { describe, it, expect } from "vitest";
import {
  buildPayslipInsert,
  derivePayDateFromBatch,
  ensureNormalizedHasContent,
  listMissingFields,
  normalizeTextractResponse,
} from "@/supabase/functions/process_batch/helpers";

const sampleResponse = {
  Blocks: [
    { BlockType: "LINE", Text: "Payslip" },
    { BlockType: "LINE", Text: "PRSI Class A1" },
    { BlockType: "LINE", Text: "Pay Date: 31 Jan 2025" },
    { BlockType: "LINE", Text: "Gross Pay: 3,000.00" },
    { BlockType: "LINE", Text: "PAYE: 600.00" },
    { BlockType: "LINE", Text: "USC/NI: 135.50" },
    { BlockType: "LINE", Text: "Pension (Employee): 150.00" },
    { BlockType: "LINE", Text: "Pension (Employer): 180.00" },
    { BlockType: "LINE", Text: "Net Pay: 2,115.00" },
  ],
};

const emptyResponse = {
  Blocks: [{ BlockType: "LINE", Text: "Lorem ipsum" }],
};

describe("normalizeTextractResponse", () => {
  it("extracts amounts from Textract lines", () => {
    const normalized = normalizeTextractResponse(sampleResponse as any);
    expect(normalized.gross_pay).toBe(3000);
    expect(normalized.net_pay).toBe(2115);
    expect(normalized.paye).toBe(600);
    expect(normalized.usc_ni).toBe(135.5);
    expect(normalized.pension_ee).toBe(150);
    expect(normalized.pension_er).toBe(180);
    expect(normalized.prsi_category).toBe("A1");
    expect(normalized.pay_date).toBe("2025-01-31");
    expect(normalized.raw_text).toContain("Gross Pay");
  });

  it("returns nulls when amounts cannot be parsed", () => {
    const normalized = normalizeTextractResponse(emptyResponse as any);
    expect(listMissingFields(normalized)).toEqual([
      "gross_pay",
      "net_pay",
      "paye",
      "usc_ni",
      "pension_ee",
      "pension_er",
    ]);
  });
});

describe("buildPayslipInsert", () => {
  it("maps parsed values into the insert payload", () => {
    const normalized = normalizeTextractResponse(sampleResponse as any);
    const job = {
      organisation_id: "org-1",
      client_id: "client-1",
      batch_id: "batch-1",
      storage_path: "batches/batch-1/file.pdf",
    };

    const payload = buildPayslipInsert(job, "employee-1", normalized, "2025-01-31");

    expect(payload).toMatchObject({
      organisation_id: job.organisation_id,
      client_id: job.client_id,
      batch_id: job.batch_id,
      employee_id: "employee-1",
      pay_date: "2025-01-31",
      gross_pay: 3000,
      net_pay: 2115,
      paye: 600,
      usc_or_ni: 135.5,
      pension_employee: 150,
      pension_employer: 180,
      storage_path: job.storage_path,
      prsi_or_ni_category: "A1",
    });
    expect(payload.raw_ocr_json.raw_text).toContain("Payslip");
  });
});

describe("derivePayDateFromBatch", () => {
  it("parses month labels", () => {
    const date = derivePayDateFromBatch("Jan 2025", null);
    expect(date).toBe("2025-01-01");
  });

  it("falls back to created_at when label missing", () => {
    const date = derivePayDateFromBatch(null, "2025-02-15T10:00:00Z");
    expect(date).toBe("2025-02-15");
  });
});

describe("ensureNormalizedHasContent", () => {
  it("does nothing when raw_text contains content", () => {
    const normalized = normalizeTextractResponse(sampleResponse as any);
    expect(() => ensureNormalizedHasContent(normalized)).not.toThrow();
  });

  it("throws when the OCR response is empty", () => {
    const normalized = normalizeTextractResponse({ Blocks: [] } as any);
    expect(() => ensureNormalizedHasContent(normalized)).toThrow(
      "OCR result did not contain any text"
    );
  });
});

