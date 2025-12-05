"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Space,
  Steps,
  Typography,
  Upload,
  Checkbox,
  Tag,
  message,
} from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import { uploadBatchFiles } from "@/lib/storage/batchUploads";
import { updateBatchStatus } from "@/lib/repositories/batches";
import { createBatchForClient } from "@/lib/repositories/batches";
import { recordBatchDataFile } from "@/lib/repositories/batchDataFiles";
import { listClientDataSources } from "@/lib/repositories/clientDataSources";
import type { ClientDataSource } from "@/lib/repositories/clientDataSources";
import { ingestRegisterCsv, ingestGlCsv, ingestBankPaymentsCsv, ingestSubmissionCsv } from "@/lib/functions/ingestion";
import { getDefaultRuleConfig } from "@/lib/rules/config";
import { upsertBatchRuleSnapshot } from "@/lib/repositories/batchRuleSnapshots";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";
import { logAuditEvent } from "@/lib/repositories/auditLogs";
import type { DataSourceType } from "@/types/dataSources";
import { dataSourceLabels } from "@/types/dataSources";
import { parseContractCsv } from "@/lib/contracts/parser";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type WizardProps = {
  organisationId: string;
  profileId: string | null;
  clientId: string;
  clientName: string;
  clientCountry: string | null;
  onComplete?: (batchId: string) => void;
};

type BatchInfo = {
  id: string;
  period_label: string;
  pay_date?: string | null;
};

const rulePackOptions = [
  { id: "core-tax", label: "Core tax rules (IE/UK)" },
  { id: "reconciliation", label: "Reconciliation (register/GL/bank/submissions)" },
  { id: "contract-compliance", label: "Contract / HR compliance" },
];

const artefactTypes: DataSourceType[] = [
  "PAYROLL_REGISTER",
  "GL_EXPORT",
  "GROSS_TO_NET",
  "BANK_PAYMENTS",
  "STATUTORY_SUBMISSION",
  "CONTRACT_SNAPSHOT",
];

export function BatchUploadWizard({
  organisationId,
  profileId,
  clientId,
  clientName,
  clientCountry,
  onComplete,
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [form] = Form.useForm();
  const [uploadingPayslips, setUploadingPayslips] = useState(false);
  const [payslipFiles, setPayslipFiles] = useState<UploadFile[]>([]);
  const [artefactFiles, setArtefactFiles] = useState<Record<DataSourceType, UploadFile | null>>(
    () =>
      artefactTypes.reduce(
        (acc, type) => ({ ...acc, [type]: null }),
        {} as Record<DataSourceType, UploadFile | null>
      )
  );
  const [dataSources, setDataSources] = useState<ClientDataSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedRulePacks, setSelectedRulePacks] = useState<string[]>([
    "core-tax",
    "reconciliation",
  ]);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSources = async () => {
      setLoadingSources(true);
      try {
        const rows = await listClientDataSources(organisationId, clientId);
        setDataSources(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load data sources");
      } finally {
        setLoadingSources(false);
      }
    };
    void loadSources();
  }, [organisationId, clientId]);

  const configuredTypes = useMemo(() => new Set(dataSources.map((s) => s.type)), [dataSources]);

  const handleCreateBatch = async () => {
    const values = await form.validateFields();
    const batch = await createBatchForClient(organisationId, {
      clientId,
      periodLabel: values.period_label,
      payDate: values.pay_date ? values.pay_date.format("YYYY-MM-DD") : null,
      payFrequency: values.pay_frequency ?? null,
      totalFiles: 0,
      processedFiles: 0,
      status: "pending",
    });
    setBatchInfo({
      id: batch.id,
      period_label: batch.period_label,
      pay_date: batch.pay_date ?? null,
    });
    message.success("Batch created. Continue with uploads.");
    setCurrentStep(1);
  };

  const draggerProps = {
    multiple: true,
    accept: ".pdf,.zip,.ZIP,.PDF",
    fileList: payslipFiles,
    beforeUpload: (file: RcFile) => {
      setPayslipFiles((prev) => [
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
    onRemove: (file: UploadFile) => {
      setPayslipFiles((prev) => prev.filter((f) => f.uid !== file.uid));
    },
  };

  const uploadPayslips = async () => {
    if (!batchInfo) {
      message.error("Create the batch first.");
      return;
    }
    const files = payslipFiles
      .map((f) => f.originFileObj)
      .filter((f): f is File => !!f);
    if (!files.length) {
      message.warning("Select payslip files to upload.");
      return;
    }
    setUploadingPayslips(true);
    try {
      const uploads = await uploadBatchFiles(batchInfo.id, files);
      await Promise.all(
        uploads.map((upload) =>
          recordBatchDataFile({
            organisationId,
            clientId,
            batchId: batchInfo.id,
            type: "PAYSLIP_PDF",
            storagePath: upload.path,
            originalFilename: upload.originalName,
            parsedStatus: "pending",
          })
        )
      );
      await updateBatchStatus(organisationId, batchInfo.id, {
        total_files: uploads.length,
        status: "pending",
      });
      setSummary((prev) => ({ ...prev, payslips: `${uploads.length} file(s)` }));
      message.success(`Uploaded ${uploads.length} payslip file(s).`);
      setCurrentStep(2);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to upload payslips");
    } finally {
      setUploadingPayslips(false);
    }
  };

  const handleArtefactUpload = async (type: DataSourceType, file: File) => {
    if (!batchInfo) return;
    try {
      const uploads = await uploadBatchFiles(batchInfo.id, [file]);
      const upload = uploads[0];
      let parsedStatus: "pending" | "parsed" | "failed" = "pending";
      let parsedError: string | null = null;
      const csvText = await file.text();
      try {
        if (type === "PAYROLL_REGISTER") {
          await ingestRegisterCsv({ batchId: batchInfo.id, clientId, csv: csvText });
        } else if (type === "GL_EXPORT") {
          await ingestGlCsv({ batchId: batchInfo.id, clientId, csv: csvText });
        } else if (type === "BANK_PAYMENTS") {
          await ingestBankPaymentsCsv({
            batchId: batchInfo.id,
            clientId,
            csv: csvText,
            fileName: file.name,
          });
        } else if (type === "STATUTORY_SUBMISSION") {
          await ingestSubmissionCsv({
            batchId: batchInfo.id,
            clientId,
            country: (clientCountry ?? "IE").toUpperCase(),
            csv: csvText,
          });
        } else if (type === "CONTRACT_SNAPSHOT") {
          const rows = parseContractCsv(csvText);
          if (rows.length) {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.from("contracts").upsert(
              rows.map((row) => ({
                organisation_id: organisationId,
                client_id: clientId,
                employee_id: row.employee_id,
                salary_amount: row.salary_amount,
                salary_period: row.salary_period,
                hourly_rate: row.hourly_rate,
                standard_hours_per_week: row.standard_hours_per_week,
                effective_from: row.effective_from,
                effective_to: row.effective_to,
                metadata: row.metadata ?? null,
              })),
              { onConflict: "employee_id" }
            );
            if (error) throw new Error(error.message);
          }
        }
        parsedStatus = "parsed";
      } catch (err) {
        parsedStatus = "failed";
        parsedError = err instanceof Error ? err.message : "Parse failed";
      }
      await recordBatchDataFile({
        organisationId,
        clientId,
        batchId: batchInfo.id,
        type,
        storagePath: upload.path,
        originalFilename: upload.originalName,
        parsedStatus,
        parsedError,
      });
      setArtefactFiles((prev) => ({ ...prev, [type]: null }));
      setSummary((prev) => ({
        ...prev,
        [type]: parsedStatus === "parsed" ? "Attached" : "Failed",
      }));
      if (parsedStatus === "parsed") {
        message.success(`${dataSourceLabels[type]} uploaded`);
      } else {
        message.error(parsedError ?? "Upload failed");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const artefactCards = artefactTypes.map((type) => {
    const configured = configuredTypes.has(type);
    const file = artefactFiles[type];
    return (
      <Card
        key={type}
        size="small"
        title={dataSourceLabels[type]}
        extra={
          configured ? (
            <Tag color="green">Configured</Tag>
          ) : (
            <Tag color="default">Configure in Client → Data sources</Tag>
          )
        }
        style={{ minWidth: 260 }}
      >
        <Typography.Paragraph type="secondary" style={{ minHeight: 48 }}>
          {type === "PAYROLL_REGISTER" && "Reconcile gross/net vs payslips."}
          {type === "GL_EXPORT" && "Reconcile payroll vs accounting totals."}
          {type === "BANK_PAYMENTS" && "Validate net pay disbursements."}
          {type === "STATUTORY_SUBMISSION" && "Match ROS/RTI submissions to payroll totals."}
          {type === "CONTRACT_SNAPSHOT" && "Enrich rules with contract data."}
          {type === "GROSS_TO_NET" && "Batch-level summary from payroll system."}
        </Typography.Paragraph>
        <Upload.Dragger
          disabled={!configured}
          multiple={false}
          accept=".csv"
          fileList={file ? [file] : []}
          beforeUpload={(rcFile: RcFile) => {
            const uploadFile: UploadFile = {
              uid: rcFile.uid,
              name: rcFile.name,
              size: rcFile.size,
              type: rcFile.type,
              originFileObj: rcFile,
            };
            setArtefactFiles((prev) => ({ ...prev, [type]: uploadFile }));
            return false;
          }}
          onRemove={() => {
            setArtefactFiles((prev) => ({ ...prev, [type]: null }));
          }}
          style={{ marginBottom: 12 }}
        >
          <p className="ant-upload-drag-icon">Drop CSV here or click to browse</p>
        </Upload.Dragger>
        <Button
          type="primary"
          block
          disabled={!configured || !file}
          onClick={() => {
            const rcFile = file?.originFileObj as File | undefined;
            if (rcFile) {
              void handleArtefactUpload(type, rcFile);
            }
          }}
        >
          Upload
        </Button>
      </Card>
    );
  });

  const handleSaveRules = async () => {
    if (!batchInfo) {
      message.error("Create batch first.");
      return;
    }
    const payDate = batchInfo.pay_date ? new Date(batchInfo.pay_date) : new Date();
    const taxYear = payDate.getUTCFullYear();
    const resolvedConfig = getDefaultRuleConfig(
      (clientCountry as "IE" | "UK" | undefined) ?? "IE",
      taxYear
    );
    await upsertBatchRuleSnapshot({
      organisationId,
      clientId,
      batchId: batchInfo.id,
      country: clientCountry ?? null,
      rulePackIds: selectedRulePacks,
      resolvedConfig,
    });
    await updateBatchStatus(organisationId, batchInfo.id, {
      selected_rule_packs: selectedRulePacks,
    });
    setCurrentStep(4);
  };

  const handleConfirm = async () => {
    if (!batchInfo) return;
    try {
      await invokeCreateProcessingJobs(batchInfo.id);
      if (profileId) {
        await logAuditEvent({
          organisationId,
          actorId: profileId,
          action: "batch_created",
          metadata: {
            batchId: batchInfo.id,
            clientId,
            periodLabel: batchInfo.period_label,
          },
        });
      }
      message.success("Batch created and processing started");
      if (onComplete) onComplete(batchInfo.id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Unable to start processing");
    }
  };

  const steps = [
    {
      title: "Batch details",
      content: (
        <Form layout="vertical" form={form} initialValues={{ pay_frequency: "monthly" }}>
          <Form.Item
            label="Period label"
            name="period_label"
            rules={[{ required: true, message: "Enter the payroll period" }]}
          >
            <Input placeholder="Eg. January 2025" />
          </Form.Item>
          <Form.Item label="Pay date" name="pay_date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Frequency" name="pay_frequency">
            <Input placeholder="monthly / weekly / fortnightly" />
          </Form.Item>
          <Button type="primary" onClick={handleCreateBatch}>
            Save batch
          </Button>
        </Form>
      ),
    },
    {
      title: "Upload payslips",
      content: (
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Alert
            type="info"
            showIcon
            message="Upload payslip PDFs or a ZIP. Required for OCR and rules."
          />
          <Upload.Dragger {...draggerProps} style={{ minHeight: 180 }}>
            <p className="ant-upload-drag-icon">Drop PDFs/ZIP here or click</p>
            <p className="ant-upload-text">
              Files are stored per batch. We recommend one file per employee.
            </p>
          </Upload.Dragger>
          <Button
            type="primary"
            onClick={uploadPayslips}
            disabled={!payslipFiles.length || uploadingPayslips}
            loading={uploadingPayslips}
          >
            Upload payslips
          </Button>
        </Space>
      ),
    },
    {
      title: "Monthly artefacts",
      content: (
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Typography.Paragraph type="secondary">
            Upload monthly files for reconciliation. Cards are enabled when the client has a mapping configured.
          </Typography.Paragraph>
          <Space wrap size="middle">
            {artefactCards}
          </Space>
          {loadingSources ? <Typography.Text>Loading mappings…</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: "Rule packs",
      content: (
        <Card>
          <Typography.Paragraph>
            Choose which rule packs apply to this batch. Defaults are based on client country.
          </Typography.Paragraph>
          <Checkbox.Group
            options={rulePackOptions.map((opt) => ({ label: opt.label, value: opt.id }))}
            value={selectedRulePacks}
            onChange={(values) => setSelectedRulePacks(values as string[])}
          />
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={handleSaveRules}>
              Save rule packs
            </Button>
          </div>
        </Card>
      ),
    },
    {
      title: "Review & confirm",
      content: (
        <Card>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Review
          </Typography.Title>
          <Space direction="vertical">
            <Typography.Text>
              Client: <strong>{clientName}</strong> ({clientCountry ?? "N/A"})
            </Typography.Text>
            <Typography.Text>
              Period: <strong>{batchInfo?.period_label}</strong> Pay date:{" "}
              {batchInfo?.pay_date
                ? new Date(batchInfo.pay_date).toISOString().slice(0, 10)
                : "—"}
            </Typography.Text>
            <Typography.Text>
              Payslips: {summary.payslips ?? "Not uploaded"}
            </Typography.Text>
            {artefactTypes.map((type) => (
              <Typography.Text key={type}>
                {dataSourceLabels[type]}: {summary[type] ?? "Not attached"}
              </Typography.Text>
            ))}
            <Typography.Text>
              Rule packs: {selectedRulePacks.map((id) => rulePackOptions.find((r) => r.id === id)?.label).join(", ")}
            </Typography.Text>
            <Space>
              <Button onClick={() => setCurrentStep(3)}>Back</Button>
              <Button type="primary" onClick={handleConfirm} disabled={!batchInfo}>
                Create & start processing
              </Button>
            </Space>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          New batch for {clientName}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Guided wizard for payslips and monthly artefacts. Configure mappings in Client → Data sources.
        </Typography.Paragraph>
      </div>
      {error ? <Alert type="error" message={error} showIcon /> : null}
      <Steps current={currentStep} items={steps.map((step) => ({ title: step.title }))} />
      <Card>{steps[currentStep]?.content}</Card>
    </Space>
  );
}
