"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEmployeeComparison } from "@/hooks/useEmployeeComparison";
import type { IssueSeverity, IssueRow } from "@/lib/repositories/employeeDetails";
import { useOrganisation } from "@/context/OrganisationContext";
import { ContractEditor } from "@/components/employees/ContractEditor";

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

const issueDataLabels: Record<string, string> = {
  field: "Field",
  previousValue: "Previous",
  currentValue: "Current",
  difference: "Difference",
  percentChange: "% change",
  grossPercentChange: "Gross % change",
  expectedTax: "Expected tax",
  actualTax: "Actual tax",
  rateUsed: "Rate used",
  bandInfo: "Band",
};

const currencyDataKeys = new Set([
  "previousValue",
  "currentValue",
  "difference",
  "expectedTax",
  "actualTax",
]);
const percentDataKeys = new Set(["percentChange", "grossPercentChange", "rateUsed"]);

const formatIssueDataValue = (key: string, value: unknown) => {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    if (percentDataKeys.has(key)) {
      return `${value.toFixed(1)}%`;
    }
    if (currencyDataKeys.has(key)) {
      const absolute = Math.abs(value).toFixed(2);
      if (key === "difference" && value !== 0) {
        return `${value >= 0 ? "+" : "-"}€${absolute}`;
      }
      return `€${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const renderIssueDataDetails = (data?: Record<string, unknown> | null): ReactNode => {
  if (!data) {
    return null;
  }

  const orderedKeys = Object.keys(issueDataLabels).filter(
    (key) => data[key] !== undefined && data[key] !== null
  );
  const extraEntries = Object.entries(data).filter(([key]) => !(key in issueDataLabels));

  if (!orderedKeys.length && !extraEntries.length) {
    return null;
  }

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      {orderedKeys.length ? (
        <Descriptions size="small" column={1} colon>
          {orderedKeys.map((key) => (
            <Descriptions.Item key={key} label={issueDataLabels[key]}>
              {formatIssueDataValue(key, data[key])}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : null}
      {extraEntries.length ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {extraEntries.map(([key, value]) => `${key}: ${formatIssueDataValue(key, value)}`).join(" • ")}
        </Typography.Text>
      ) : null}
    </Space>
  );
};

const formatDisplayDate = (dateString?: string | null, fallbackLabel?: string | null) => {
  if (dateString) {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  if (fallbackLabel) {
    return fallbackLabel;
  }
  return "—";
};

type EmployeeDetailViewProps = {
  employeeId: string;
  batchId: string;
};

export function EmployeeDetailView({ employeeId, batchId }: EmployeeDetailViewProps) {
  const { profileId } = useOrganisation();
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

  const buildResolvedTooltip = (issue: IssueRow, profileId: string | null) => {
    if (!issue.resolved || !issue.resolved_at) {
      return null;
    }
    const resolverLabel =
      issue.resolved_by && profileId && issue.resolved_by === profileId
        ? "you"
        : issue.resolved_by ?? "another user";
    const resolvedDate = new Date(issue.resolved_at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `Resolved by ${resolverLabel} on ${resolvedDate}`;
  };

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

  const issueItems = data.issues ?? [];
  const currentPayDateLabel = formatDisplayDate(
    data.currentBatchPayDate ?? data.currentPayslip.pay_date ?? null,
    data.currentBatchPeriodLabel
  );
  const previousPayDateLabel = formatDisplayDate(
    data.previousBatchPayDate ?? data.previousPayslip?.pay_date ?? null,
    data.previousBatchPeriodLabel ?? "None"
  );

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
          <Descriptions.Item label="Current pay date">{currentPayDateLabel}</Descriptions.Item>
          <Descriptions.Item label="Previous pay date">{previousPayDateLabel}</Descriptions.Item>
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

      <ContractEditor employeeId={employeeId} />

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
        <div data-testid="employee-issues-list">
          {issueItems.length === 0 ? (
            <Empty description="No issues for this employee." />
          ) : (
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {issueItems.map((issue) => {
                const resolvedInfo = buildResolvedTooltip(issue, profileId);
                const descriptionNode = (
                  <Typography.Text
                    delete={issue.resolved}
                    type={issue.resolved ? "secondary" : undefined}
                    data-resolved-info={resolvedInfo ?? undefined}
                  >
                    {issue.description}
                  </Typography.Text>
                );

                return (
                  <Row key={issue.id} gutter={[8, 8]} align="middle">
                    <Col flex="auto">
                      <Space size="small" wrap>
                        <Tag color={severityColor[issue.severity]}>{issue.severity}</Tag>
                        {resolvedInfo ? (
                          <Tooltip title={resolvedInfo}>{descriptionNode}</Tooltip>
                        ) : (
                          descriptionNode
                        )}
                      </Space>
                      <div>
                        {(() => {
                          const noteNode = issue.note ? (
                            <Typography.Text type="secondary">Note: {issue.note}</Typography.Text>
                          ) : null;
                          const dataNode = renderIssueDataDetails(issue.data);
                          if (!noteNode && !dataNode) return null;
                          return (
                            <Space orientation="vertical" size="small">
                              {noteNode}
                              {dataNode}
                            </Space>
                          );
                        })()}
                      </div>
                    </Col>
                    <Col>
                      <Button type="link" onClick={() => handleResolve(issue.id, issue.resolved)}>
                        {issue.resolved ? "Mark as unresolved" : "Mark as resolved"}
                      </Button>
                    </Col>
                  </Row>
                );
              })}
            </Space>
          )}
        </div>
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
