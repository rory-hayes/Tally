import { describe, expect, it } from "vitest";
import { buildBatchIssuesCsv } from "@/lib/logic/batchIssuesCsv";

describe("buildBatchIssuesCsv", () => {
  it("includes header row even when there are no issues", () => {
    const csv = buildBatchIssuesCsv([]);
    expect(csv).toBe("employee,employee_ref,rule_code,severity,description,values");
  });

  it("serialises issue rows with basic data", () => {
    const csv = buildBatchIssuesCsv([
      {
        employeeName: "Alice",
        employeeRef: "EMP-001",
        ruleCode: "NET_CHANGE_LARGE",
        severity: "warning",
        description: "Net pay changed significantly",
        values: "Δ=500",
      },
    ]);

    expect(csv).toContain("Alice,EMP-001,NET_CHANGE_LARGE,warning,Net pay changed significantly,Δ=500");
  });

  it("escapes commas, quotes, and new lines", () => {
    const csv = buildBatchIssuesCsv([
      {
        employeeName: "Bob \"The Builder\"",
        employeeRef: "EMP,002",
        ruleCode: "YTD_REGRESSION",
        severity: "critical",
        description: "YTD tax decreased\nCheck payroll data",
        values: null,
      },
    ]);

    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '"Bob ""The Builder""","EMP,002",YTD_REGRESSION,critical,"YTD tax decreased\nCheck payroll data",'
    );
  });

  it("serialises multiple issues preserving order", () => {
    const csv = buildBatchIssuesCsv([
      {
        employeeName: "Alice",
        employeeRef: "EMP-001",
        ruleCode: "NET_CHANGE",
        severity: "warning",
        description: "Net pay changed",
        values: "Δ€100",
      },
      {
        employeeName: "Bob",
        employeeRef: "EMP-002",
        ruleCode: "YTD_REGRESSION",
        severity: "critical",
        description: "YTD net decreased",
        values: "",
      },
    ]);

    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("Alice,EMP-001,NET_CHANGE,warning,Net pay changed,Δ€100");
    expect(lines[2]).toBe("Bob,EMP-002,YTD_REGRESSION,critical,YTD net decreased,");
  });
});

