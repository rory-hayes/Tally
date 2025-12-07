export type DataSourceType =
  | "PAYSLIP_PDF"
  | "PAYROLL_REGISTER"
  | "GL_EXPORT"
  | "GROSS_TO_NET"
  | "BANK_PAYMENTS"
  | "STATUTORY_SUBMISSION";

export const dataSourceLabels: Record<DataSourceType, string> = {
  PAYSLIP_PDF: "Payslip PDF",
  PAYROLL_REGISTER: "Payroll register",
  GL_EXPORT: "GL export",
  GROSS_TO_NET: "Gross-to-net summary",
  BANK_PAYMENTS: "Bank payments",
  STATUTORY_SUBMISSION: "Revenue/HMRC submission",
};
