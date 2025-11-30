"use client";

import Link from "next/link";
import { Alert, Card, Empty, Spin, Table, Tag, Typography } from "antd";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import type { DashboardClientSummary } from "@/lib/repositories/dashboard";

const severityColor: Record<"critical" | "warning" | "info", string> = {
  critical: "red",
  warning: "orange",
  info: "blue",
};

const columns = [
  {
    title: "Client",
    dataIndex: "name",
    key: "name",
    render: (_: unknown, record: DashboardClientSummary) => (
      <Link href={`/clients/${record.id}`}>{record.name}</Link>
    ),
  },
  {
    title: "Latest batch",
    dataIndex: "latestBatchPeriod",
    key: "latestBatchPeriod",
    render: (value: string | null) => value ?? "No batches yet",
  },
  {
    title: "Issues",
    dataIndex: "issueCounts",
    key: "issueCounts",
    render: (counts: DashboardClientSummary["issueCounts"]) => (
      <>
        <Tag color={severityColor.critical} data-testid="critical-count">
          Critical: {counts.critical}
        </Tag>
        <Tag color={severityColor.warning} data-testid="warning-count">
          Warning: {counts.warning}
        </Tag>
        <Tag color={severityColor.info} data-testid="info-count">
          Info: {counts.info}
        </Tag>
      </>
    ),
  },
];

export function DashboardView() {
  const { status, data, error } = useDashboardSummary();

  return (
    <div data-testid="dashboard-view">
      <Typography.Title level={3}>Practice Overview</Typography.Title>
      <Typography.Paragraph type="secondary">
        Track batches and issues across all clients.
      </Typography.Paragraph>
      <Card variant="borderless">
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <Spin data-testid="dashboard-loading" />
          </div>
        )}

        {status === "error" && error && (
          <Alert
            type="error"
            title="Unable to load dashboard data"
            description={error}
            showIcon
          />
        )}

        {status === "success" && data.length === 0 && (
          <Empty description="No clients yet. Upload a batch to get started." />
        )}

        {status === "success" && data.length > 0 && (
          <Table
            rowKey="id"
            dataSource={data}
            columns={columns}
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
}

