"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Button,
  message,
  Popconfirm,
  Progress,
  Tabs,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import { ClientRow, getClientById } from "@/lib/repositories/clients";
import { BatchRow, deleteBatch, getBatchesForClient } from "@/lib/repositories/batches";
import { ClientDataSourcesTab } from "@/components/clients/ClientDataSourcesTab";

const statusColorMap: Record<string, string> = {
  pending: "default",
  "pending upload": "default",
  processing: "blue",
  completed: "green",
  failed: "red",
};

function useBatchColumns(
  onOpenBatch: (batch: BatchRow) => void,
  onDeleteBatch: (batch: BatchRow) => void
): ColumnsType<BatchRow> {
  return useMemo(
    () => [
      {
        title: "Period",
        dataIndex: "period_label",
        key: "period_label",
      },
      {
        title: "Pay date",
        dataIndex: "pay_date",
        key: "pay_date",
        render: (value: string | null) =>
          value
            ? new Date(value).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (value: string) => (
          <Tag color={statusColorMap[value] ?? "default"}>{value}</Tag>
        ),
      },
      {
        title: "Files processed",
        key: "files",
        render: (_value, record) => {
          const processed = record.processed_files ?? 0;
          const total = record.total_files ?? 0;
          const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
          return (
            <Space direction="vertical" size={0}>
              <Progress
                percent={percent}
                size="small"
                status={
                  record.status === "failed"
                    ? "exception"
                    : record.status === "completed"
                    ? "success"
                    : "active"
                }
              />
              <Typography.Text type="secondary">
                {processed}/{total} files
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: "Employees",
        key: "employees",
        render: (_value, record) =>
          typeof record.employees_processed === "number"
            ? record.employees_processed
            : 0,
      },
      {
        title: "Actions",
        key: "actions",
        align: "right" as const,
        render: (_value, record) => (
          <Space>
            <Button type="link" onClick={() => onOpenBatch(record)}>
              Open
            </Button>
            <Popconfirm
              title="Delete this batch?"
              description="This removes payslips, issues, and attachments for the batch."
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => onDeleteBatch(record)}
            >
              <Button type="link" danger>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onOpenBatch, onDeleteBatch]
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId =
    typeof params.clientId === "string"
      ? params.clientId
      : Array.isArray(params.clientId)
      ? params.clientId[0]
      : "";

  return (
    <RequireAuth>
      <AppLayout>
        <ClientDetailContent clientId={clientId} />
      </AppLayout>
    </RequireAuth>
  );
}

type ClientDetailContentProps = {
  clientId: string;
};

export function ClientDetailContent({ clientId }: ClientDetailContentProps) {
  const router = useRouter();
  const { organisationId, profileId } = useOrganisation();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("batches");

  const fetchClient = useCallback(async () => {
    if (!clientId) return;
    setClientLoading(true);
    try {
      const data = await getClientById(organisationId, clientId);
      setClient(data);
      if (!data) {
        message.error("Client not found");
        router.replace("/clients");
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to load client"
      );
    } finally {
      setClientLoading(false);
    }
  }, [clientId, organisationId, router]);

  const fetchBatches = useCallback(async () => {
    if (!clientId) return;
    setBatchesLoading(true);
    try {
      const data = await getBatchesForClient(organisationId, clientId);
      setBatches(data);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to load batches"
      );
    } finally {
      setBatchesLoading(false);
    }
  }, [clientId, organisationId]);

  const handleBatchDelete = async (batch: BatchRow) => {
    try {
      await deleteBatch(organisationId, batch.id);
      message.success("Batch deleted");
      fetchBatches();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to delete batch"
      );
    }
  };

  useEffect(() => {
    fetchClient();
    fetchBatches();
  }, [fetchClient, fetchBatches]);

  const columns = useBatchColumns(
    (batch) => router.push(`/batches/${batch.id}`),
    handleBatchDelete
  );

  if (clientLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space
        orientation="horizontal"
        align="center"
        style={{ justifyContent: "space-between", width: "100%" }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {client.name}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {client.country ?? "Country unknown"} •{" "}
            {client.payroll_system ?? "Payroll system TBD"}
          </Typography.Paragraph>
        </div>
        <Space>
          <Button
            type="primary"
            onClick={() => router.push(`/clients/${clientId}/batches/new`)}
          >
            Upload new batch
          </Button>
        </Space>
      </Space>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "batches",
              label: "Batches",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Card
                    title="Client profile"
                    size="small"
                    style={{ marginBottom: 12 }}
                  >
                    <Space orientation="vertical">
                      <Typography.Text>
                        <strong>Country:</strong> {client.country ?? "—"}
                      </Typography.Text>
                      <Typography.Text>
                        <strong>Payroll system:</strong>{" "}
                        {client.payroll_system ?? "—"}
                      </Typography.Text>
                    </Space>
                  </Card>

                  <Card
                    title="Batches"
                    extra={
                      <Typography.Text type="secondary">
                        Track uploads and processing status
                      </Typography.Text>
                    }
                  >
                    {batches.length === 0 && !batchesLoading ? (
                      <Empty description="No batches yet. Upload your first payroll batch." />
                    ) : (
                      <Table<BatchRow>
                        rowKey="id"
                        dataSource={batches}
                        loading={batchesLoading}
                        columns={columns}
                        pagination={false}
                      />
                    )}
                  </Card>
                </Space>
              ),
            },
            {
              key: "data-sources",
              label: "Data sources",
              children: (
                <ClientDataSourcesTab
                  organisationId={organisationId}
                  clientId={clientId}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
