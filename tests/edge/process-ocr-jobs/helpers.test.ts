import { describe, it, expect } from "vitest";
import {
  buildJobStatusUpdate,
  createStubPayslip,
  normalizeOcrPayload,
  shouldCompleteBatch,
} from "@/supabase/functions/process-ocr-jobs/helpers";

describe("process-ocr-jobs helpers", () => {
  it("normalizes OCR payloads with explicit fields", () => {
    const normalized = normalizeOcrPayload(
      {
        employee_name: "Jane Doe",
        employee_ref: "EMP-123",
        pay_date: "2025-11-29",
        gross_pay: "1000.55",
        net_pay: 900.45,
      },
      "batches/demo/file.pdf"
    );

    expect(normalized).toMatchObject({
      employeeName: "Jane Doe",
      employeeExternalRef: "EMP-123",
      payDate: "2025-11-29",
      grossPay: 1000.55,
      netPay: 900.45,
    });
  });

  it("falls back to file derived identifiers", () => {
    const normalized = normalizeOcrPayload({}, "batches/demo/sample_EMP999.pdf");
    expect(normalized.employeeName).toContain("EMP999");
    expect(normalized.employeeExternalRef).toContain("EMP999");
  });

  it("creates stub payload when OCR API is not configured", () => {
    const stub = createStubPayslip("batches/demo/sample_EMP777.pdf");
    expect(stub.employeeName).toContain("EMP777");
    expect(stub.payDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("determines when batches should be marked completed", () => {
    expect(shouldCompleteBatch(3, 3)).toBe(true);
    expect(shouldCompleteBatch(2, 3)).toBe(false);
  });

  it("builds job status payloads", () => {
    expect(buildJobStatusUpdate(true)).toEqual({
      status: "completed",
      error: null,
    });
    expect(buildJobStatusUpdate(false, "boom")).toEqual({
      status: "failed",
      error: "boom",
    });
  });
});

