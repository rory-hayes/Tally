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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import { ClientRow, getClientById } from "@/lib/repositories/clients";
import { BatchRow, createBatchForClient, getBatchesForClient } from "@/lib/repositories/batches";
import { logAuditEvent } from "@/lib/repositories/auditLogs";
import { CreateBatchModal } from "@/components/batches/CreateBatchModal";

const statusColorMap: Record<string, string> = {
  pending: "default",
  "pending upload": "default",
  processing: "blue",
  completed: "green",
  failed: "red",
};

function useBatchColumns(
  onOpenBatch: (batch: BatchRow) => void
): ColumnsType<BatchRow> {
  return useMemo(
    () => [
      {
        title: "Period",
        dataIndex: "period_label",
        key: "period_label",
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
        render: (_value, record) =>
          `${record.processed_files}/${record.total_files}`,
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
          <Button type="link" onClick={() => onOpenBatch(record)}>
            Open
          </Button>
        ),
      },
    ],
    [onOpenBatch]
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
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => {
    fetchClient();
    fetchBatches();
  }, [fetchClient, fetchBatches]);

  const handleBatchSubmit = async (values: {
    periodLabel: string;
    notes?: string | null;
  }) => {
    try {
      const actorId = profileId ?? "system";
      const newBatch = await createBatchForClient(organisationId, {
        clientId,
        periodLabel: values.periodLabel,
        notes: values.notes ?? null,
        totalFiles: 0,
        processedFiles: 0,
        status: "pending",
      });
      setBatches((prev) => [newBatch, ...prev]);
      setModalOpen(false);
      message.success("Batch created. Continue with upload.");
      await logAuditEvent({
        organisationId,
        actorId,
        action: "batch_created",
        metadata: {
          batchId: newBatch.id,
          clientId,
          periodLabel: values.periodLabel,
        },
      });
      router.push(`/batches/${newBatch.id}`);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to create batch"
      );
      throw err;
    }
  };

  const columns = useBatchColumns((batch) =>
    router.push(`/batches/${batch.id}`)
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
        <Button type="primary" onClick={() => setModalOpen(true)}>
          Upload batch
        </Button>
      </Space>

      <Card title="Client profile">
        <Space orientation="vertical">
          <Typography.Text>
            <strong>Country:</strong> {client.country ?? "—"}
          </Typography.Text>
          <Typography.Text>
            <strong>Payroll system:</strong> {client.payroll_system ?? "—"}
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

      <CreateBatchModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleBatchSubmit}
      />
    </Space>
  );
}


