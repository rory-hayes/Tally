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
  Popconfirm,
  Progress,
  notification,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useOrganisation } from "@/context/OrganisationContext";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import type { IssueSeverity } from "@/lib/repositories/batchDetails";
import { deleteBatch, updateBatchStatus } from "@/lib/repositories/batches";
import { uploadBatchFiles } from "@/lib/storage/batchUploads";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";
import { downloadBatchIssuesCsv } from "@/lib/functions/downloadBatchIssuesCsv";
import { BatchReportModal } from "@/components/batches/BatchReportModal";
import { logAuditEvent } from "@/lib/repositories/auditLogs";
import { retryFailedJobs } from "@/lib/repositories/processingJobs";
import { useRouter } from "next/navigation";

type BatchDetailViewProps = {
  batchId: string;
};

const severityColors: Record<IssueSeverity, string> = {
  critical: "red",
  warning: "orange",
  info: "blue",
};

const formatPayDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export function BatchDetailView({ batchId }: BatchDetailViewProps) {
  const { organisationId, profileId } = useOrganisation();
  const router = useRouter();
  const { status, data, error, refresh } = useBatchDetail(batchId);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const lastStatusRef = useRef<string | null>(null);

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
  const jobSummary =
    data?.jobs ?? { pending: 0, processing: 0, completed: 0, failed: 0, failedJobs: [] };
  const dataFiles = data?.dataFiles ?? [];
  const reconciliationIssues = data?.reconciliationIssues ?? [];
  const hasValidFileTotals =
    batch &&
    typeof batch.processed_files === "number" &&
    typeof batch.total_files === "number";
  const processedLabel = hasValidFileTotals
    ? `${batch.processed_files}/${batch.total_files} files processed`
    : null;
  const progressPercent =
    hasValidFileTotals && batch.total_files > 0
      ? Math.round((batch.processed_files / batch.total_files) * 100)
      : 0;
  const hasActiveJobs = jobSummary.pending + jobSummary.processing > 0;
  const hasFailedJobs = jobSummary.failedJobs.length > 0;
  const derivedStatus =
    batch && batch.status === "processing" && hasFailedJobs && !hasActiveJobs
      ? "failed"
      : batch?.status ?? "pending";
  const payDateLabel = formatPayDate(batch?.pay_date ?? null);
  const createdAt = batch ? new Date(batch.created_at).toLocaleString() : "";
  const dataFileBadges =
    dataFiles && dataFiles.length
      ? dataFiles.map((file) => ({
          key: `${file.type}-${file.original_filename ?? ""}`,
          label: file.original_filename ?? file.type,
          status: file.parsed_status,
          type: file.type,
        }))
      : [];

  useEffect(() => {
    if (!batch) return;
    const previous = lastStatusRef.current;
    if (previous && previous !== derivedStatus) {
      if (derivedStatus === "completed") {
        notification.success({
          title: "Batch processing completed",
          message: "Batch processing completed",
          description: `${batch.period_label ?? "Batch"} (${payDateLabel}) has finished processing.`,
        });
      } else if (derivedStatus === "failed") {
        notification.error({
          title: "Batch processing finished with failures",
          message: "Batch processing finished with failures",
          description: "Review failed files below and retry once issues are fixed.",
        });
      }
    }
    lastStatusRef.current = derivedStatus;
  }, [batch, derivedStatus, payDateLabel]);

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
        const isPdf = file.type?.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
        const maxSizeMb = 15;
        if (!isPdf) {
          message.error(`${file.name} is not a PDF. Please upload PDF payslips.`);
          return false;
        }
        if (file.size / 1024 / 1024 > maxSizeMb) {
          message.error(`${file.name} is too large. Limit ${maxSizeMb}MB per file.`);
          return false;
        }
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
    setUploadProgress({ uploaded: 0, total: files.length });
    try {
      await uploadBatchFiles(batch.id, files, (uploaded, total) =>
        setUploadProgress({ uploaded, total })
      );
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
      setUploadProgress(null);
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

  const handleRetryFailed = async () => {
    if (!batch) return;
    setRetrying(true);
    try {
      const resetCount = await retryFailedJobs(organisationId, batch.id);
      if (resetCount === 0) {
        message.info("No failed files to retry.");
        return;
      }
      await updateBatchStatus(organisationId, batch.id, {
        status: "processing",
        processed_files: Math.max((batch.processed_files ?? 0) - resetCount, 0),
      });
      message.success(`Retrying ${resetCount} file(s)`);
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to retry failed files"
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batch) return;
    setDeleting(true);
    try {
      await deleteBatch(organisationId, batch.id);
      message.success("Batch deleted");
      router.push(`/clients/${batch.client_id}`);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to delete batch"
      );
    } finally {
      setDeleting(false);
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

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card
        extra={
          <Space>
            <Button onClick={handleExportCsv} loading={exporting}>
              Download CSV
            </Button>
            <Button onClick={() => setReportVisible(true)}>View report</Button>
            <Button onClick={handleRetryFailed} loading={retrying} disabled={!hasFailedJobs}>
              Retry failed
            </Button>
            <Popconfirm
              title="Delete this batch?"
              description="Payslips, issues, and attached artefacts for this batch will be permanently removed."
              okText="Delete"
              cancelText="Cancel"
              onConfirm={handleDeleteBatch}
              okButtonProps={{ loading: deleting, danger: true }}
            >
              <Button danger loading={deleting}>Delete batch</Button>
            </Popconfirm>
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
          Pay date: <strong>{payDateLabel}</strong>
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Status:{" "}
          <Tag
            color={
              derivedStatus === "completed"
                ? "green"
                : derivedStatus === "failed"
                ? "red"
                : derivedStatus === "processing"
                ? "blue"
                : "gold"
            }
          >
            {derivedStatus}
          </Tag>
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Created: {createdAt}
        </Typography.Paragraph>
        {dataFileBadges.length ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Attached artefacts:{" "}
            {dataFileBadges.map((file) => (
              <Tag
                key={file.key}
                color={file.status === "parsed" ? "green" : file.status === "failed" ? "red" : "default"}
              >
                {file.type}: {file.label}
              </Tag>
            ))}
          </Typography.Paragraph>
        ) : null}
        {processedLabel && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <span data-testid="batch-file-progress">{processedLabel}</span>
              {hasFailedJobs && (
                <Tag color="red" style={{ marginLeft: 8 }} data-testid="batch-failed-count-tag">
                  {jobSummary.failed} failed
                </Tag>
              )}
            </Typography.Paragraph>
            <Progress
              percent={progressPercent}
              status={
                derivedStatus === "failed"
                  ? "exception"
                  : derivedStatus === "completed"
                  ? "success"
                  : "active"
              }
            />
          </Space>
        )}
        {hasFailedJobs && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            title={`${jobSummary.failed} file(s) failed during processing`}
            description={
              <Space direction="vertical">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {jobSummary.failedJobs.map((job) => (
                    <li key={job.id}>
                      {job.storagePath.split("/").pop()} {job.error ? `– ${job.error}` : ""}
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary">
                  Check that each PDF contains selectable text and is not encrypted. Then click “Retry failed.”
                </Typography.Text>
              </Space>
            }
          />
        )}
        {!hasFailedJobs && hasActiveJobs && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            title="Processing in progress"
            description={`${jobSummary.pending + jobSummary.processing} file(s) remaining…`}
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

      <Card title="Reconciliation checks">
        {reconciliationIssues.length === 0 ? (
          <Alert
            type="success"
            showIcon
            message="No reconciliation issues detected"
            description="Register, GL, bank, and submission totals match payslip data based on uploaded artefacts."
          />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {reconciliationIssues.map((issue) => (
              <Alert
                key={issue.id}
                type={issue.severity === "critical" ? "error" : issue.severity === "warning" ? "warning" : "info"}
                showIcon
                message={issue.description}
                description={
                  issue.data ? (
                    <Typography.Text type="secondary">{JSON.stringify(issue.data)}</Typography.Text>
                  ) : null
                }
              />
            ))}
          </Space>
        )}
      </Card>

      <Card title="Upload payslips">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Upload.Dragger {...draggerProps} style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon">Drop PDFs here or click to add</p>
            <p className="ant-upload-text">
              Upload payslip PDFs for this batch. Files are stored securely.
            </p>
            {fileList.length === 0 && (
              <Typography.Text type="secondary">
                Select one or more PDF files to enable upload. Accepted: PDF, up to 15MB each. You can drag from your desktop; in test sandboxes place files in a visible folder (e.g. share/slides).
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
          {uploadProgress ? (
            <Progress
              percent={Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}
              status={uploading ? "active" : "normal"}
              format={() => `${uploadProgress.uploaded}/${uploadProgress.total} files`}
            />
          ) : null}
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
