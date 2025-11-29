"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Button,
  Card,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import {
  BatchRow,
  getBatchById,
  updateBatchStatus,
} from "@/lib/repositories/batches";
import { uploadBatchFiles } from "@/lib/storage/batchUploads";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";

export default function BatchUploadPage() {
  const params = useParams<{ batchId: string }>();
  const batchId =
    typeof params.batchId === "string"
      ? params.batchId
      : Array.isArray(params.batchId)
      ? params.batchId[0]
      : "";

  return (
    <RequireAuth>
      <AppLayout>
        <BatchUploadContent batchId={batchId} />
      </AppLayout>
    </RequireAuth>
  );
}

type BatchUploadContentProps = {
  batchId: string;
};

export function BatchUploadContent({ batchId }: BatchUploadContentProps) {
  const { organisationId } = useOrganisation();
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const fetchBatch = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const data = await getBatchById(organisationId, batchId);
      if (!data) {
        message.error("Batch not found.");
      }
      setBatch(data);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to load batch."
      );
    } finally {
      setLoading(false);
    }
  }, [batchId, organisationId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  const uploadDisabled = uploading || fileList.length === 0;

  const handleUpload = async () => {
    if (fileList.length === 0 || !batch) {
      message.warning("Select at least one file to upload.");
      return;
    }

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
      await uploadBatchFiles(batchId, files);
      const updated = await updateBatchStatus(organisationId, batchId, {
        total_files: (batch.total_files ?? 0) + files.length,
      });

      let nextBatchState: BatchRow = updated;
      try {
        await invokeCreateProcessingJobs(batchId);
        nextBatchState = { ...updated, status: "processing" };
        message.success("Files uploaded and queued for processing.");
      } catch (jobError) {
        message.error(
          jobError instanceof Error
            ? jobError.message
            : "Processing jobs could not be created."
        );
      }

      setBatch(nextBatchState);
      setFileList([]);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Upload failed. Try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const draggerProps = useMemo(
    () => ({
      multiple: true,
      accept: ".pdf,.PDF",
      fileList,
      onRemove: (file: UploadFile) => {
        setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      },
      onChange: (info: { fileList: UploadFile[] }) => {
        setFileList(info.fileList);
      },
      beforeUpload: (file: RcFile) => {
        const uploadFile: UploadFile = {
          uid: file.uid,
          name: file.name,
          type: file.type,
          size: file.size,
          originFileObj: file,
        };
        setFileList((prev) => [...prev, uploadFile]);
        return false;
      },
    }),
    [fileList]
  );

  if (loading || !batch) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin />
      </div>
    );
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Space orientation="vertical" size="small" style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Batch upload
          </Typography.Title>
          <Typography.Paragraph>
            Batch ID: <Typography.Text code>{batch.id}</Typography.Text>
          </Typography.Paragraph>
          <Typography.Text>
            Period: <strong>{batch.period_label}</strong>
          </Typography.Text>
          <Typography.Text>
            Status:{" "}
            <Tag color={batch.status === "completed" ? "green" : "default"}>
              {batch.status}
            </Tag>
          </Typography.Text>
          <Typography.Text>
            Total files: <strong>{batch.total_files}</strong>
          </Typography.Text>
        </Space>
      </Card>

      <Card title="Upload payslips">
        <Upload.Dragger {...draggerProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">Drop PDFs here or click to add</p>
          <p className="ant-upload-text">
            Upload payslip PDFs for this batch. Files are stored securely.
          </p>
        </Upload.Dragger>
        <Space>
          <Button onClick={() => setFileList([])} disabled={fileList.length === 0 || uploading}>
            Clear selection
          </Button>
          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={uploadDisabled}
          >
            Upload files
          </Button>
        </Space>
      </Card>
    </Space>
  );
}



