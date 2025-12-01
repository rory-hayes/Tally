"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEmployeeComparison } from "@/hooks/useEmployeeComparison";
import type { IssueSeverity } from "@/lib/repositories/employeeDetails";

const fieldLabels: Record<string, string> = {
  gross_pay: "Gross pay",
  net_pay: "Net pay",
  paye: "PAYE",
  usc_or_ni: "USC/NI",
  pension_employee: "Employee pension",
  pension_employer: "Employer pension",
};

const severityColor: Record<IssueSeverity, string> = {
  critical: "red",
  warning: "orange",
  info: "blue",
};

type EmployeeDetailViewProps = {
  employeeId: string;
  batchId: string;
};

export function EmployeeDetailView({ employeeId, batchId }: EmployeeDetailViewProps) {
  const { status, data, error, toggleIssue } = useEmployeeComparison(employeeId, batchId);
  const [noteModal, setNoteModal] = useState<{ open: boolean; issueId: string | null; note: string }>({
    open: false,
    issueId: null,
    note: "",
  });

  const diffRows = useMemo(() => {
    if (!data?.diff) return [];
    return Object.entries(fieldLabels).map(([field, label]) => ({
      key: field,
      label,
      previous: data.diff[field as keyof typeof data.diff]?.previous ?? null,
      current: data.diff[field as keyof typeof data.diff]?.current ?? null,
      delta: data.diff[field as keyof typeof data.diff]?.delta ?? null,
      percentChange: data.diff[field as keyof typeof data.diff]?.percentChange ?? null,
    }));
  }, [data]);

  const issueItems = data?.issues ?? [];

  const columns: ColumnsType<(typeof diffRows)[number]> = [
    { title: "Field", dataIndex: "label", key: "label" },
    {
      title: "Previous",
      dataIndex: "previous",
      key: "previous",
      render: (value: number | null) => (value === null ? "—" : `€${value.toFixed(2)}`),
    },
    {
      title: "Current",
      dataIndex: "current",
      key: "current",
      render: (value: number | null) => (value === null ? "—" : `€${value.toFixed(2)}`),
    },
    {
      title: "Change",
      dataIndex: "delta",
      key: "delta",
      render: (_value, record) =>
        record.delta === null ? "—" : `${record.delta >= 0 ? "+" : ""}${record.delta.toFixed(2)}`,
    },
    {
      title: "% change",
      dataIndex: "percentChange",
      key: "percentChange",
      render: (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`),
    },
  ];

  if (status === "loading" || status === "idle") {
    return (
      <div
        style={{ minHeight: "50vh", display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        <Spin aria-label="Loading employee details" />
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <Alert
        type="error"
        message="Unable to load employee details"
        description={error ?? "Try reloading the page."}
        showIcon
      />
    );
  }

  const handleResolve = (issueId: string, resolved: boolean) => {
    if (resolved) {
      toggleIssue(issueId, false);
      return;
    }
    setNoteModal({ open: true, issueId, note: "" });
  };

  const handleResolveSubmit = async () => {
    if (!noteModal.issueId) return;
    await toggleIssue(noteModal.issueId, true, noteModal.note.trim() || null);
    setNoteModal({ open: false, issueId: null, note: "" });
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          {data.employeeName}
        </Typography.Title>
        <Typography.Text type="secondary">
          {data.employeeRef ?? "No employee ref"} • Batch #{data.batchId}
        </Typography.Text>
        <Descriptions bordered column={2} style={{ marginTop: 16 }}>
          <Descriptions.Item label="Current pay date">
            {data.currentPayslip.pay_date ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Previous pay date">
            {data.previousPayslip?.pay_date ?? "None"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Current period">
            <Statistic
              title="Net pay"
              prefix="€"
              precision={2}
              value={data.currentPayslip.net_pay ?? 0}
            />
            <Statistic
              title="Gross pay"
              prefix="€"
              precision={2}
              value={data.currentPayslip.gross_pay ?? 0}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Previous period">
            <Statistic
              title="Net pay"
              prefix="€"
              precision={2}
              value={data.previousPayslip?.net_pay ?? 0}
            />
            <Statistic
              title="Gross pay"
              prefix="€"
              precision={2}
              value={data.previousPayslip?.gross_pay ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Field differences">
        {diffRows.length === 0 ? (
          <Empty description="No comparison data available." />
        ) : (
          <Table
            rowKey="key"
            dataSource={diffRows}
            columns={columns}
            pagination={false}
            size="small"
          />
        )}
      </Card>

      <Card title="Issues">
        {issueItems.length === 0 ? (
          <Empty description="No issues for this employee." />
        ) : (
          <List
            dataSource={issueItems}
            renderItem={(issue) => (
              <List.Item
                actions={[
                  <Button
                    key="resolve"
                    type="link"
                    onClick={() => handleResolve(issue.id, issue.resolved)}
                  >
                    {issue.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={severityColor[issue.severity]}>{issue.severity}</Tag>
                      <Typography.Text
                        delete={issue.resolved}
                        type={issue.resolved ? "secondary" : undefined}
                      >
                        {issue.description}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    issue.note ? (
                      <Typography.Text type="secondary">Note: {issue.note}</Typography.Text>
                    ) : null
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        open={noteModal.open}
        title="Mark issue as resolved"
        onCancel={() => setNoteModal({ open: false, issueId: null, note: "" })}
        onOk={handleResolveSubmit}
      >
        <Typography.Paragraph>
          Optionally add a note explaining how the issue was resolved.
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="Note (optional)"
          value={noteModal.note}
          onChange={(e) => setNoteModal((prev) => ({ ...prev, note: e.target.value }))}
        />
      </Modal>
    </Space>
  );
}

