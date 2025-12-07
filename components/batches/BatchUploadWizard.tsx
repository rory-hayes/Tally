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
  Progress,
} from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import { uploadBatchFiles } from "@/lib/storage/batchUploads";
import { updateBatchStatus } from "@/lib/repositories/batches";
import { createBatchForClient } from "@/lib/repositories/batches";
import { recordBatchDataFile } from "@/lib/repositories/batchDataFiles";
import { listClientDataSources } from "@/lib/repositories/clientDataSources";
import type { ClientDataSource } from "@/lib/repositories/clientDataSources";
import { getDefaultRuleConfig } from "@/lib/rules/config";
import { upsertBatchRuleSnapshot } from "@/lib/repositories/batchRuleSnapshots";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";
import { logAuditEvent } from "@/lib/repositories/auditLogs";
import type { DataSourceType } from "@/types/dataSources";
import { dataSourceLabels } from "@/types/dataSources";

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
  {
    id: "core-tax",
    label: "Core tax rules (IE/UK)",
    description: "Net/gross deltas, PAYE/USC/NI spikes, PRSI/NIC category changes, YTD regressions.",
  },
  {
    id: "reconciliation",
    label: "Reconciliation (register/GL/bank/submissions)",
    description: "Cross-check register totals, GL postings, bank payments, and ROS/RTI submissions against payslips.",
  },
  {
    id: "contract-compliance",
    label: "Contract / HR compliance",
    description: "Validate payslip rates against contract data, hours, and pension thresholds.",
  },
];

const artefactTypes: DataSourceType[] = [
  "PAYROLL_REGISTER",
  "GL_EXPORT",
  "GROSS_TO_NET",
  "BANK_PAYMENTS",
  "STATUTORY_SUBMISSION",
  "CONTRACT_SNAPSHOT",
];

const artefactFieldHelp: Partial<Record<DataSourceType, string[]>> = {
  PAYROLL_REGISTER: ["employee_id", "gross_pay", "net_pay", "paye", "usc_or_ni"],
  GL_EXPORT: ["wages", "employer_taxes", "pensions", "other", "currency"],
  BANK_PAYMENTS: ["employee_id", "amount", "currency", "reference"],
  STATUTORY_SUBMISSION: ["paye_total", "usc_or_ni_total", "employee_count", "tax_year", "source_file"],
  CONTRACT_SNAPSHOT: [
    "employee_id",
    "salary_amount",
    "salary_period",
    "hourly_rate",
    "standard_hours_per_week",
    "effective_from",
    "effective_to",
  ],
  GROSS_TO_NET: ["period_label", "total_gross", "total_net", "employee_count"],
};

const artefactTemplates: Partial<
  Record<
    DataSourceType,
    {
      filename: string;
      rows: string[][];
    }
  >
> = {
  PAYROLL_REGISTER: {
    filename: "payroll_register_template.csv",
    rows: [
      [
        "employee_id",
        "gross_pay",
        "net_pay",
        "paye",
        "usc_or_ni",
        "nic_employee",
        "nic_employer",
        "student_loan",
        "postgrad_loan",
      ],
      ["EMP001", "3000", "2100", "500", "100", "120", "140", "0", "0"],
    ],
  },
  GL_EXPORT: {
    filename: "gl_payroll_template.csv",
    rows: [
      ["wages", "employer_taxes", "pensions", "other", "currency"],
      ["120000", "13500", "4200", "0", "EUR"],
    ],
  },
  BANK_PAYMENTS: {
    filename: "bank_payments_template.csv",
    rows: [
      ["employee_id", "amount", "currency", "reference"],
      ["EMP001", "2500", "EUR", "April payroll"],
    ],
  },
  STATUTORY_SUBMISSION: {
    filename: "submission_summary_template.csv",
    rows: [
      ["paye_total", "usc_or_ni_total", "employee_count", "tax_year", "source_file"],
      ["1100", "190", "2", "2025", "RTI-FPS-APR.csv"],
    ],
  },
  CONTRACT_SNAPSHOT: {
    filename: "contracts_template.csv",
    rows: [
      [
        "employee_id",
        "salary_amount",
        "salary_period",
        "hourly_rate",
        "standard_hours_per_week",
        "effective_from",
        "effective_to",
      ],
      ["EMP001", "52000", "annual", "", "40", "2025-01-01", ""],
    ],
  },
  GROSS_TO_NET: {
    filename: "gross_to_net_template.csv",
    rows: [
      ["period_label", "total_gross", "total_net", "employee_count"],
      ["2025-02", "82000", "62000", "24"],
    ],
  },
};

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
  const [payslipUploadProgress, setPayslipUploadProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const [payslipFiles, setPayslipFiles] = useState<UploadFile[]>([]);
  const [artefactFiles, setArtefactFiles] = useState<Record<DataSourceType, UploadFile | null>>(
    () =>
      artefactTypes.reduce(
        (acc, type) => ({ ...acc, [type]: null }),
        {} as Record<DataSourceType, UploadFile | null>
      )
  );
  const [artefactErrors, setArtefactErrors] = useState<Record<DataSourceType, string | null>>(
    () =>
      artefactTypes.reduce(
        (acc, type) => ({ ...acc, [type]: null }),
        {} as Record<DataSourceType, string | null>
      )
  );
  const [uploadingArtefactType, setUploadingArtefactType] = useState<DataSourceType | null>(null);
  const [artefactUploadsCompleted, setArtefactUploadsCompleted] = useState(false);

  const downloadTemplate = (type: DataSourceType) => {
    const template = artefactTemplates[type];
    if (!template) return;
    const csv = template.rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = template.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const [dataSources, setDataSources] = useState<ClientDataSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedRulePacks, setSelectedRulePacks] = useState<string[]>([
    "core-tax",
    "reconciliation",
  ]);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(new Date(value))
      : "—";
  const handleStepChange = (value: number) => {
    if (value <= currentStep) {
      setCurrentStep(value);
    }
  };

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
    const files = payslipFiles.reduce<File[]>((acc, file) => {
      if (file.originFileObj) {
        acc.push(file.originFileObj as File);
      }
      return acc;
    }, []);
    if (!files.length) {
      message.warning("Select payslip files to upload.");
      return;
    }
    setUploadingPayslips(true);
    setPayslipUploadProgress({ uploaded: 0, total: files.length });
    try {
      const uploads = await uploadBatchFiles(batchInfo.id, files, (uploaded, total) =>
        setPayslipUploadProgress({ uploaded, total })
      );
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
      setPayslipUploadProgress(null);
    }
  };

  const handleArtefactUpload = async (type: DataSourceType) => {
    if (!batchInfo) {
      message.error("Create the batch first.");
      return;
    }
    const fileEntry = artefactFiles[type];
    const file = fileEntry?.originFileObj as File | undefined;
    if (!file) {
      message.warning("Select a CSV file first.");
      return;
    }
    setArtefactErrors((prev) => ({ ...prev, [type]: null }));
    setUploadingArtefactType(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", clientId);
      formData.append("organisationId", organisationId);
      formData.append("type", type);

      const response = await fetch(`/api/batches/${batchInfo.id}/artefacts`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messageText = payload?.error ?? "Upload failed";
        throw new Error(messageText);
      }

      setArtefactFiles((prev) => ({ ...prev, [type]: null }));
      setSummary((prev) => ({ ...prev, [type]: "Uploaded" }));
      setArtefactUploadsCompleted(true);
      message.success(`${dataSourceLabels[type]} uploaded`);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Upload failed";
      setArtefactErrors((prev) => ({ ...prev, [type]: messageText }));
      message.error(messageText);
    } finally {
      setUploadingArtefactType(null);
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
        {artefactFieldHelp[type]?.length ? (
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            Required columns: {artefactFieldHelp[type]!.join(", ")}
          </Typography.Text>
        ) : null}
        <Upload.Dragger
          disabled={!configured || uploadingArtefactType === type}
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
            setArtefactErrors((prev) => ({ ...prev, [type]: null }));
            return false;
          }}
          onRemove={() => {
            setArtefactFiles((prev) => ({ ...prev, [type]: null }));
            setArtefactErrors((prev) => ({ ...prev, [type]: null }));
          }}
          style={{ marginBottom: 12 }}
        >
          <p className="ant-upload-drag-icon">Drop CSV here or click to browse</p>
        </Upload.Dragger>
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {artefactTemplates[type] ? (
            <Button type="link" onClick={() => downloadTemplate(type)} size="small">
              Download template
            </Button>
          ) : null}
          {artefactErrors[type] ? (
            <Typography.Text type="danger">{artefactErrors[type]}</Typography.Text>
          ) : null}
        </Space>
        <Button
          type="primary"
          block
          disabled={!configured || !file || uploadingArtefactType === type}
          loading={uploadingArtefactType === type}
          onClick={() => void handleArtefactUpload(type)}
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
          {payslipUploadProgress ? (
            <Progress
              percent={Math.round(
                (payslipUploadProgress.uploaded / payslipUploadProgress.total) * 100
              )}
              status={uploadingPayslips ? "active" : "normal"}
              format={() =>
                `${payslipUploadProgress.uploaded}/${payslipUploadProgress.total} files`
              }
            />
          ) : null}
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
          <Space direction="vertical">
            <Button
              type="primary"
              disabled={!artefactUploadsCompleted}
              onClick={() => setCurrentStep(3)}
            >
              Continue to rule packs
            </Button>
            <Typography.Text type={artefactUploadsCompleted ? "secondary" : "danger"}>
              {artefactUploadsCompleted
                ? "You can keep uploading additional artefacts even after moving on."
                : "Upload at least one artefact to continue."}
            </Typography.Text>
          </Space>
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
            value={selectedRulePacks}
            onChange={(values) => setSelectedRulePacks(values as string[])}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {rulePackOptions.map((opt) => (
                <Checkbox key={opt.id} value={opt.id} style={{ alignItems: "flex-start" }}>
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{opt.label}</Typography.Text>
                    <Typography.Text type="secondary">{opt.description}</Typography.Text>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
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
              {formatDate(batchInfo?.pay_date ?? null)}
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
              <Button onClick={() => setCurrentStep(0)}>Edit batch details</Button>
              <Button onClick={() => setCurrentStep(1)}>Edit uploads</Button>
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
      <Alert
        type="info"
        showIcon
        message="Pay date and mappings drive downstream checks."
        description="The pay date saved in step 1 is reused for all payslips and employee views. Use the Data sources tab to store mapping JSON; each artefact card includes required columns and a sample CSV."
      />
      {error ? <Alert type="error" message={error} showIcon /> : null}
      <Steps
        current={currentStep}
        onChange={handleStepChange}
        items={steps.map((step) => ({ title: step.title }))}
      />
      <Card>{steps[currentStep]?.content}</Card>
    </Space>
  );
}
