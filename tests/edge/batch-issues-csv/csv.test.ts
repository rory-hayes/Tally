import { describe, it, expect } from "vitest";
import { buildBatchIssuesCsv } from "@/supabase/functions/batch-issues-csv/csv";

describe("buildBatchIssuesCsv", () => {
  it("prepends batch summary before issue rows", () => {
    const csv = buildBatchIssuesCsv(
      [
        {
          employeeName: "Alice",
          employeeRef: "EMP001",
          ruleCode: "NET_CHANGE_LARGE",
          severity: "critical",
          description: "Net pay jumped",
          values: "Reviewed manually",
        },
      ],
      {
        batchId: "batch-1",
        periodLabel: "January 2025",
        payDate: "2025-01-31",
        status: "failed",
        processedFiles: 2,
        totalFiles: 3,
        criticalCount: 1,
        warningCount: 0,
        infoCount: 0,
      }
    );

    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "batch_id,period_label,pay_date,status,processed_files,total_files,critical_issues,warning_issues,info_issues"
    );
    expect(lines[1]).toBe("batch-1,January 2025,2025-01-31,failed,2,3,1,0,0");
    expect(lines[3]).toBe("employee,employee_ref,rule_code,severity,description,values");
    expect(lines[4]).toBe("Alice,EMP001,NET_CHANGE_LARGE,critical,Net pay jumped,Reviewed manually");
  });
});

