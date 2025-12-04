import type { IssueCandidate } from "@/lib/rules/types";
import type { PaymentRecord } from "@/lib/payments/parser";
import type { PayslipLike } from "@/lib/logic/payslipDiff";

const TOLERANCE = 1;

const formatNumber = (value: number) => Number(value.toFixed(2));

export const reconcilePaymentsToPayslips = (
  payments: PaymentRecord[],
  payslips: PayslipLike[]
): IssueCandidate[] => {
  const issues: IssueCandidate[] = [];
  const paymentsByEmployee = new Map<string, PaymentRecord[]>();
  payments.forEach((p) => {
    if (!p.employee_id) return;
    const list = paymentsByEmployee.get(p.employee_id) ?? [];
    list.push(p);
    paymentsByEmployee.set(p.employee_id, list);
  });

  const payslipsWithIds = payslips.filter((p) => p.employee_id);

  payslipsWithIds.forEach((p) => {
    const employeeId = p.employee_id as string;
    const netPay = p.net_pay ?? 0;
    const paymentsForEmployee = paymentsByEmployee.get(employeeId) ?? [];
    if (!paymentsForEmployee.length) {
      issues.push({
        ruleCode: "PAYSLIP_WITHOUT_PAYMENT",
        severity: "warning",
        description: `No payment found for payslip employee ${employeeId}`,
      });
      return;
    }
    const paidTotal = paymentsForEmployee.reduce((sum, pay) => sum + (pay.amount ?? 0), 0);
    const delta = netPay - paidTotal;
    if (Math.abs(delta) > TOLERANCE) {
      issues.push({
        ruleCode: "BANK_NETPAY_MISMATCH",
        severity: "warning",
        description: `Net pay mismatch for employee ${employeeId}`,
        data: {
          payslipNet: formatNumber(netPay),
          paidTotal: formatNumber(paidTotal),
          difference: formatNumber(delta),
        },
      });
    }
  });

  paymentsByEmployee.forEach((_list, employeeId) => {
    const hasPayslip = payslipsWithIds.some((p) => p.employee_id === employeeId);
    if (!hasPayslip) {
      issues.push({
        ruleCode: "BANK_PAYMENT_WITHOUT_PAYSLIP",
        severity: "warning",
        description: `Payment exists without payslip for employee ${employeeId}`,
      });
    }
  });

  return issues;
};
