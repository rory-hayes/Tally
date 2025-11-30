import { describe, it, expect } from "vitest";
import {
  buildPayslipInsert,
  listMissingFields,
  normalizeTextractResponse,
} from "@/supabase/functions/process_batch/helpers";

const sampleResponse = {
  Blocks: [
    { BlockType: "LINE", Text: "Payslip" },
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

    const payload = buildPayslipInsert(job, "employee-1", normalized);

    expect(payload.gross_pay).toBe(3000);
    expect(payload.net_pay).toBe(2115);
    expect(payload.pension_employee).toBe(150);
    expect(payload.storage_path).toBe(job.storage_path);
    expect(payload.raw_ocr_json.raw_text).toContain("Payslip");
  });
});

