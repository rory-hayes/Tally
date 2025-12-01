import { describe, expect, it } from "vitest";
import { buildEmployeeIssueSummaries } from "@/lib/repositories/batchDetails";

describe("buildEmployeeIssueSummaries", () => {
  it("aggregates issues per employee and totals by severity", () => {
    const payslips = [
      {
        id: "pay-1",
        employee_id: "emp-1",
        employees: { name: "Alice", external_employee_ref: "EMP001" },
      },
      {
        id: "pay-2",
        employee_id: "emp-2",
        employees: { name: "Bob", external_employee_ref: "EMP002" },
      },
    ];

    const issues = [
      { employee_id: "emp-1", severity: "warning" },
      { employee_id: "emp-1", severity: "warning" },
      { employee_id: "emp-2", severity: "critical" },
    ];

    const { employees, totals } = buildEmployeeIssueSummaries(payslips as any, issues as any);

    expect(employees).toHaveLength(2);
    expect(employees.find((e) => e.employeeId === "emp-1")?.issues.warning).toBe(2);
    expect(employees.find((e) => e.employeeId === "emp-2")?.issues.critical).toBe(1);
    expect(totals).toEqual({ critical: 1, warning: 2, info: 0 });
  });

  it("ignores issues without employee or severity", () => {
    const payslips = [
      { id: "pay-1", employee_id: "emp-1", employees: { name: "Alice", external_employee_ref: "EMP001" } },
    ];
    const issues = [
      { employee_id: "emp-1", severity: "info" },
      { employee_id: null, severity: "warning" },
      { employee_id: "emp-1", severity: null },
    ];

    const { totals } = buildEmployeeIssueSummaries(payslips as any, issues as any);
    expect(totals).toEqual({ critical: 0, warning: 0, info: 1 });
  });
});

