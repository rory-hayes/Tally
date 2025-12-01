"use client";

import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useOrganisation } from "@/context/OrganisationContext";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import type { IssueSeverity } from "@/lib/repositories/batchDetails";
import { updateBatchStatus } from "@/lib/repositories/batches";
import { uploadBatchFiles } from "@/lib/storage/batchUploads";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";
import { downloadBatchIssuesCsv } from "@/lib/functions/downloadBatchIssuesCsv";
import { BatchReportModal } from "@/components/batches/BatchReportModal";
import { logAuditEvent } from "@/lib/repositories/auditLogs";

type BatchDetailViewProps = {
  batchId: string;
};

const severityColors: Record<IssueSeverity, string> = {
  critical: "red",
  warning: "orange",
  info: "blue",
};

export function BatchDetailView({ batchId }: BatchDetailViewProps) {
  const { organisationId, profileId } = useOrganisation();
  const { status, data, error, refresh } = useBatchDetail(batchId);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  const batch = data?.batch ?? null;

  const draggerProps = useMemo(
    () => ({
      multiple: true,
      accept: ".pdf,.PDF",
      fileList,
      showUploadList: true,
      onRemove: (file: UploadFile) => {
        setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      },
      beforeUpload: (file: RcFile) => {
        setFileList((prev) => [
          ...prev,
          {
            uid: file.uid,
            name: file.name,
            size: file.size,
            type: file.type,
            originFileObj: file,
          },
        ]);
        return false;
      },
    }),
    [fileList]
  );

  const handleUpload = async () => {
    if (!batch || fileList.length === 0) {
      message.warning("Select at least one file to upload.");
      return;
    }
    const actorId = profileId ?? "system";

    const rcFiles = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is RcFile => !!file);
    const files = rcFiles.map((file) => file as File);

    if (!files.length) {
      message.warning("Unable to read selected files.");
      return;
    }

    setUploading(true);
    try {
      await uploadBatchFiles(batch.id, files);
      await updateBatchStatus(organisationId, batch.id, {
        total_files: (batch.total_files ?? 0) + files.length,
      });
      await invokeCreateProcessingJobs(batch.id);
      message.success(`${files.length} file(s) uploaded and queued for processing.`);
      await logAuditEvent({
        organisationId,
        actorId,
        action: "payslips_uploaded",
        metadata: {
          batchId: batch.id,
          fileCount: files.length,
          clientId: batch.client_id,
          fileNames: files.map((file) => file.name),
        },
      });
      setFileList([]);
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again later."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!batch) {
      return;
    }
    setExporting(true);
    try {
      await downloadBatchIssuesCsv(batch.id);
      message.success("Issue CSV download started.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to download CSV. Try again."
      );
    } finally {
      setExporting(false);
    }
  };

  if (status === "loading" || status === "idle") {
    return (
      <div style={{ minHeight: "50vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Spin aria-label="Loading batch" />
      </div>
    );
  }

  if (status === "error" || !data || !batch) {
    return (
      <Alert
        type="error"
        message="Unable to load batch details"
        description={error ?? "Try reloading the page."}
        showIcon
      />
    );
  }

  const columns = [
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
    ...(["critical", "warning", "info"] as IssueSeverity[]).map((level) => ({
      title: level.charAt(0).toUpperCase() + level.slice(1),
      dataIndex: ["issues", level],
      key: level,
      render: (value: number, record: (typeof data.employees)[number]) => (
        <Tag color={severityColors[level]}>{record.issues[level]}</Tag>
      ),
    })),
    {
        title: "Action",
        key: "action",
        render: (_: unknown, record: (typeof data.employees)[number]) => (
          <Link
            href={`/clients/${batch.client_id}/employees/${record.employeeId}?batchId=${batch.id}`}
          >
            View
          </Link>
        ),
    },
  ];

  const createdAt = new Date(batch.created_at).toLocaleString();
  const hasValidFileTotals =
    typeof batch.processed_files === "number" && typeof batch.total_files === "number";
  const processedLabel = hasValidFileTotals
    ? `${batch.processed_files}/${batch.total_files} files processed`
    : null;
  const hasActiveJobs = data.jobs.pending + data.jobs.processing > 0;
  const hasFailedJobs = data.jobs.failedJobs.length > 0;

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card
        extra={
          <Space>
            <Button onClick={handleExportCsv} loading={exporting}>
              Download CSV
            </Button>
            <Button onClick={() => setReportVisible(true)}>View report</Button>
          </Space>
        }
      >
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          Batch overview
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Period: <strong>{batch.period_label}</strong>
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Status:{" "}
          <Tag color={batch.status === "completed" ? "green" : "gold"}>
            {batch.status}
          </Tag>
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Created: {createdAt}
        </Typography.Paragraph>
          {processedLabel && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <span data-testid="batch-file-progress">{processedLabel}</span>
              {hasFailedJobs && (
                <Tag color="red" style={{ marginLeft: 8 }} data-testid="batch-failed-count-tag">
                  {data.jobs.failed} failed
                </Tag>
              )}
            </Typography.Paragraph>
          )}
        {hasFailedJobs && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            title={`${data.jobs.failed} file(s) failed during processing`}
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.jobs.failedJobs.map((job) => (
                  <li key={job.id}>
                    {job.storagePath.split("/").pop()} {job.error ? `– ${job.error}` : ""}
                  </li>
                ))}
              </ul>
            }
          />
        )}
        {!hasFailedJobs && hasActiveJobs && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            title="Processing in progress"
            description={`${data.jobs.pending + data.jobs.processing} file(s) remaining…`}
          />
        )}
      </Card>

      <Space orientation="horizontal" size="large" wrap>
        <Card style={{ minWidth: 200 }}>
          <Typography.Text type="secondary">Employees processed</Typography.Text>
          <Typography.Title level={3}>
            {data.totals.employeesProcessed}
          </Typography.Title>
        </Card>
        <Card style={{ minWidth: 200 }}>
          <Typography.Text type="secondary">Critical issues</Typography.Text>
          <Typography.Title level={3} style={{ color: severityColors.critical }}>
            {data.totals.critical}
          </Typography.Title>
        </Card>
        <Card style={{ minWidth: 200 }}>
          <Typography.Text type="secondary">Warnings</Typography.Text>
          <Typography.Title level={3} style={{ color: severityColors.warning }}>
            {data.totals.warning}
          </Typography.Title>
        </Card>
        <Card style={{ minWidth: 200 }}>
          <Typography.Text type="secondary">Info issues</Typography.Text>
          <Typography.Title level={3} style={{ color: severityColors.info }}>
            {data.totals.info}
          </Typography.Title>
        </Card>
      </Space>

      <Card title="Employee issues">
        {data.employees.length === 0 ? (
          <Empty description="No employees processed yet." />
        ) : (
          <Table
            rowKey="employeeId"
            dataSource={data.employees}
            columns={columns}
            pagination={false}
          />
        )}
      </Card>

      <Card title="Upload payslips">
        <Upload.Dragger {...draggerProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">Drop PDFs here or click to add</p>
          <p className="ant-upload-text">
            Upload payslip PDFs for this batch. Files are stored securely.
          </p>
          {fileList.length === 0 && (
            <Typography.Text type="secondary">
              Select one or more PDF files to enable upload.
            </Typography.Text>
          )}
        </Upload.Dragger>
        <Space>
          <Button onClick={() => setFileList([])} disabled={fileList.length === 0 || uploading}>
            Clear selection
          </Button>
          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={uploading || fileList.length === 0}
          >
            {uploading ? "Uploading…" : "Upload files"}
          </Button>
        </Space>
      </Card>

      <BatchReportModal
        open={reportVisible}
        onClose={() => setReportVisible(false)}
        batch={batch}
        totals={data.totals}
        employees={data.employees}
      />
    </Space>
  );
}

