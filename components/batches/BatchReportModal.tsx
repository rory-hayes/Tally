"use client";

import { useMemo } from "react";
import { Button, Empty, Modal, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { BatchDetail, EmployeeIssueSummary } from "@/lib/repositories/batchDetails";

type BatchReportModalProps = {
  open: boolean;
  onClose: () => void;
  batch: BatchDetail["batch"];
  totals: BatchDetail["totals"];
  employees: BatchDetail["employees"];
};

export function BatchReportModal({
  open,
  onClose,
  batch,
  totals,
  employees,
}: BatchReportModalProps) {
  const columns: ColumnsType<EmployeeIssueSummary> = useMemo(
    () => [
      {
        title: "Employee",
        dataIndex: "employeeName",
        key: "employeeName",
      },
      {
        title: "Reference",
        dataIndex: "employeeRef",
        key: "employeeRef",
        render: (value: string | null) => value ?? "—",
      },
      {
        title: "Critical",
        dataIndex: ["issues", "critical"],
        key: "critical",
      },
      {
        title: "Warning",
        dataIndex: ["issues", "warning"],
        key: "warning",
      },
      {
        title: "Info",
        dataIndex: ["issues", "info"],
        key: "info",
      },
    ],
    []
  );

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    let printWindow: Window | null = null;
    const canOpen =
      typeof window.open === "function" &&
      !(typeof navigator !== "undefined" && navigator.userAgent?.includes?.("jsdom"));
    if (canOpen) {
      try {
        printWindow = window.open("", "_blank", "noopener,noreferrer");
      } catch (err) {
        printWindow = null;
      }
    }
    const printableHtml = `
      <html>
        <head>
          <title>Batch report ${batch.period_label}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h1, h2, h3 { margin: 0 0 8px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .summary { margin-top: 12px; }
            .tag { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #1677ff; color: white; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Batch issue report</h1>
          <div>Period: <strong>${batch.period_label}</strong></div>
          <div class="summary">Status: <span class="tag">${batch.status}</span> • Created ${new Date(batch.created_at).toLocaleString()}</div>
          <h2>Summary</h2>
          <ul>
            <li>Employees processed: ${totals.employeesProcessed}</li>
            <li>Critical issues: ${totals.critical}</li>
            <li>Warnings: ${totals.warning}</li>
            <li>Info issues: ${totals.info}</li>
          </ul>
          ${
            employees.length
              ? `<h2>Employee issues</h2>
                <table>
                  <thead>
                    <tr><th>Employee</th><th>Reference</th><th>Critical</th><th>Warning</th><th>Info</th></tr>
                  </thead>
                  <tbody>
                    ${employees
                      .map(
                        (row) =>
                          `<tr>
                            <td>${row.employeeName}</td>
                            <td>${row.employeeRef ?? "—"}</td>
                            <td>${row.issues.critical}</td>
                            <td>${row.issues.warning}</td>
                            <td>${row.issues.info}</td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>`
              : "<p>No issues for this batch.</p>"
          }
        </body>
      </html>
    `;
    if (!printWindow) {
      if (window.print) {
        window.print();
      }
      return;
    }
    printWindow.document.write(printableHtml);
    printWindow.document.close();
    printWindow.focus();
    if (printWindow.print) {
      printWindow.print();
    } else if (window.print) {
      window.print();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      title="Batch Issue Report"
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="print" type="primary" onClick={handlePrint}>
          Print report
        </Button>,
      ]}
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 4 }}>
            {batch.period_label}
          </Typography.Title>
          <Typography.Text type="secondary">
            Batch ID: {batch.id} • Status: {batch.status} • Created:{" "}
            {new Date(batch.created_at).toLocaleString()}
          </Typography.Text>
        </div>

        <Space size="large" wrap>
          <SummaryCard label="Employees processed" value={totals.employeesProcessed} />
          <SummaryCard label="Critical issues" value={totals.critical} />
          <SummaryCard label="Warnings" value={totals.warning} />
          <SummaryCard label="Info" value={totals.info} />
        </Space>

        {employees.length === 0 ? (
          <Empty description="No issues found for this batch." />
        ) : (
          <Table<EmployeeIssueSummary>
            dataSource={employees}
            columns={columns}
            rowKey="employeeId"
            pagination={false}
            size="small"
          />
        )}
      </Space>
    </Modal>
  );
}

type SummaryCardProps = {
  label: string;
  value: number;
};

const SummaryCard = ({ label, value }: SummaryCardProps) => (
  <div style={{ minWidth: 160 }}>
    <Typography.Text type="secondary">{label}</Typography.Text>
    <Typography.Title level={4} style={{ margin: 0 }}>
      {value}
    </Typography.Title>
  </div>
);
