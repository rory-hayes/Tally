"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useOrganisation } from "@/context/OrganisationContext";
import { getClientsForOrg, type ClientRow } from "@/lib/repositories/clients";
import { getBatchesForClient, type BatchRow } from "@/lib/repositories/batches";

const downloadSample = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

type DataSourceUploaderProps<TExtra extends Record<string, unknown> = Record<string, unknown>> = {
  title: string;
  description: string;
  expectedColumns: string[];
  sampleCsv: string;
  requireBatch?: boolean;
  requireCountry?: boolean;
  countryOptions?: { label: string; value: string }[];
  defaultCountry?: string;
  actionLabel?: string;
  extraFieldsRender?: (form: ReturnType<typeof Form.useForm>[0]) => React.ReactNode;
  helperText?: string;
  fieldHelp?: { name: string; description: string }[];
  sampleFilename?: string;
  onSubmit: (input: {
    clientId: string;
    batchId?: string;
    country?: string;
    file: File;
    extras?: TExtra;
  }) => Promise<unknown>;
};

export function DataSourceUploader<TExtra extends Record<string, unknown> = Record<string, unknown>>({
  title,
  description,
  expectedColumns,
  sampleCsv,
  requireBatch = true,
  requireCountry = false,
  countryOptions = [
    { value: "IE", label: "Ireland" },
    { value: "UK", label: "United Kingdom" },
  ],
  defaultCountry,
  actionLabel = "Upload",
  extraFieldsRender,
  helperText,
  fieldHelp,
  sampleFilename = "sample.csv",
  onSubmit,
}: DataSourceUploaderProps<TExtra>) {
  const { organisationId } = useOrganisation();
  const [form] = Form.useForm();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const data = await getClientsForOrg(organisationId);
        if (!active) return;
        setClients(data);
      } catch (err) {
        if (!active) return;
        const messageText = err instanceof Error ? err.message : "Unable to load clients";
        setError(messageText);
        message.error(messageText);
      } finally {
        if (active) setLoadingClients(false);
      }
    };
    void loadClients();
    return () => {
      active = false;
    };
  }, [organisationId]);

  const handleClientChange = async (clientId: string) => {
    form.setFieldsValue({ batchId: undefined });
    if (!clientId) {
      setBatches([]);
      return;
    }
    try {
      setLoadingBatches(true);
      const rows = await getBatchesForClient(organisationId, clientId);
      setBatches(rows);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Unable to load batches";
      message.error(messageText);
    } finally {
      setLoadingBatches(false);
    }
  };

  const mergedExpectedColumns = useMemo(
    () => expectedColumns.join(", "),
    [expectedColumns]
  );

  const draggerProps = useMemo(
    () => ({
      multiple: false,
      accept: ".csv",
      fileList,
      beforeUpload: (file: RcFile) => {
        setFileList([
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
      onRemove: () => {
        setFileList([]);
      },
    }),
    [fileList]
  );

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const values = form.getFieldsValue();
      const clientId = values.clientId as string | undefined;
      const batchId = values.batchId as string | undefined;
      const country = values.country as string | undefined;

      if (!clientId) {
        message.error("Select a client");
        return;
      }
      if (requireBatch && !batchId) {
        message.error("Select a batch");
        return;
      }
      if (requireCountry && !country) {
        message.error("Select a country");
        return;
      }
      const rcFile = fileList[0]?.originFileObj as File | undefined;
      if (!rcFile) {
        message.error("Choose a CSV file to upload");
        return;
      }

      const text = await rcFile.text();
      const headerLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
      const headers = headerLine
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      const missingHeaders = expectedColumns.filter(
        (col) => !headers.includes(col.toLowerCase())
      );
      if (missingHeaders.length) {
        const missingList = missingHeaders.join(", ");
        message.error(`Missing required column(s): ${missingList}`);
        setSubmitting(false);
        return;
      }

      await onSubmit({
        clientId,
        batchId,
        country,
        file: rcFile,
        extras: values as TExtra,
      });
      setFileList([]);
      message.success("Upload completed");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Upload failed";
      setError(messageText);
      message.error(messageText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title={title}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        {helperText ? (
          <Alert
            showIcon
            type="info"
            message={helperText}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            country: defaultCountry,
          }}
          onFinish={handleFinish}
        >
          <Form.Item
            label="Client"
            name="clientId"
            rules={[{ required: true, message: "Select a client" }]}
          >
            <Select
              placeholder="Select client"
              loading={loadingClients}
              onChange={handleClientChange}
              options={clients.map((client) => ({
                label: `${client.name} (${client.country ?? "N/A"})`,
                value: client.id,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          {requireBatch ? (
            <Form.Item
              label="Batch"
              name="batchId"
              rules={[{ required: true, message: "Select a batch" }]}
            >
              <Select
                placeholder="Select batch period"
                loading={loadingBatches}
                disabled={!form.getFieldValue("clientId")}
                options={batches.map((batch) => ({
                  label: `${batch.period_label} (${batch.status})`,
                  value: batch.id,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          ) : null}

          {requireCountry ? (
            <Form.Item
              label="Country"
              name="country"
              rules={[{ required: true, message: "Select a country" }]}
            >
              <Select
                placeholder="Select country"
                options={countryOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          ) : null}

          {extraFieldsRender ? extraFieldsRender(form) : null}

          <Form.Item label="Upload CSV" required>
            <Upload.Dragger {...draggerProps} aria-label={`${title} CSV uploader`}>
              <p className="ant-upload-drag-icon">Drop CSV here or click to browse</p>
              <p className="ant-upload-text">
                Expected columns: {mergedExpectedColumns}
              </p>
              <p className="ant-upload-hint">
                Only .csv files are supported. We keep your data inside your organisation boundary.
              </p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setFileList([])} disabled={!fileList.length}>
                Clear file
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {actionLabel}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Divider />
        <Space align="center" size="middle">
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Template
          </Typography.Title>
          <Button size="small" onClick={() => downloadSample(sampleCsv, sampleFilename)}>
            Download CSV
          </Button>
        </Space>
        <Typography.Paragraph type="secondary">
          Copy this sample CSV to get started.
        </Typography.Paragraph>
        <pre
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
            fontSize: 12,
          }}
        >
          {sampleCsv}
        </pre>
        {fieldHelp?.length ? (
          <Space direction="vertical" size="small">
            <Typography.Title level={5} style={{ marginBottom: 0 }}>
              Field definitions
            </Typography.Title>
            <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
              {fieldHelp.map((field) => (
                <li key={field.name}>
                  <Typography.Text strong>{field.name}</Typography.Text>:{" "}
                  <Typography.Text type="secondary">{field.description}</Typography.Text>
                </li>
              ))}
            </ul>
          </Space>
        ) : null}
      </Space>
    </Card>
  );
}
