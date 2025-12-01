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
    if (typeof window !== "undefined" && window.print) {
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

