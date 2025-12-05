"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import { getClientsForOrg, type ClientRow } from "@/lib/repositories/clients";
import {
  deleteRuleConfig,
  fetchRuleConfig,
  upsertRuleConfig,
} from "@/lib/repositories/ruleConfigs";
import { getDefaultRuleConfig, mergeRuleConfig } from "@/lib/rules/config";
import type { CountryCode, IssueSeverity, RuleCode, RuleConfig } from "@/lib/rules/types";
import { goldenDataset, severityModel } from "@/lib/rules/goldenDataset";

const severityOptions: { label: string; value: IssueSeverity }[] = [
  { label: "Critical", value: "critical" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
];

const overrideableRules: { code: RuleCode; label: string }[] = [
  { code: "IE_PAYE_MISMATCH", label: "IE PAYE mismatch" },
  { code: "IE_USC_MISMATCH", label: "IE USC mismatch" },
  { code: "IE_PRSI_MISMATCH", label: "IE PRSI mismatch" },
  { code: "UK_PAYE_MISMATCH", label: "UK PAYE mismatch" },
  { code: "UK_NIC_MISMATCH", label: "UK NIC mismatch" },
  { code: "REGISTER_PAYSPLIP_TOTAL_MISMATCH", label: "Register vs payslip totals" },
  { code: "GL_PAYROLL_TOTAL_MISMATCH", label: "GL payroll total mismatch" },
  { code: "BANK_NETPAY_MISMATCH", label: "Bank net pay mismatch" },
  { code: "SUBMISSION_TOTAL_MISMATCH", label: "Submission total mismatch" },
];

type FormValues = {
  country: string;
  taxYear?: number | null;
  enabledRulePacks?: string[];
  largeNetChangePercent: number;
  largeGrossChangePercent: number;
  payeSpikePercent: number;
  uscSpikePercent: number;
  maxGrossDeltaPercent: number;
  maxGrossDeltaForUscPercent: number;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  severityOverrides?: Partial<Record<RuleCode, IssueSeverity>>;
  enrichment?: {
    includeEvidence?: boolean;
    includeBandBreakdown?: boolean;
    includeGoldenContext?: boolean;
  };
  goldenDatasetText?: string;
};

function SettingsView() {
  const { organisationId } = useOrganisation();
  const [form] = Form.useForm<FormValues>();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
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

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const applyConfigToForm = (baseConfig: RuleConfig, overrides?: Partial<RuleConfig> | null) => {
    const merged = mergeRuleConfig(baseConfig, overrides ?? undefined);
    form.setFieldsValue({
      country: merged.countryOverride ?? (selectedClient?.country as CountryCode | undefined) ?? "IE",
      taxYear: merged.taxYearOverride ?? new Date().getFullYear(),
      enabledRulePacks: merged.enabledRulePacks,
      largeNetChangePercent: merged.largeNetChangePercent,
      largeGrossChangePercent: merged.largeGrossChangePercent,
      payeSpikePercent: merged.payeSpikePercent,
      uscSpikePercent: merged.uscSpikePercent,
      maxGrossDeltaPercent: merged.maxGrossDeltaPercent,
      maxGrossDeltaForUscPercent: merged.maxGrossDeltaForUscPercent,
      pensionEmployeePercent: merged.pensionEmployeePercent,
      pensionEmployerPercent: merged.pensionEmployerPercent,
      severityOverrides: merged.severityOverrides ?? {},
      enrichment: merged.enrichment ?? {},
      goldenDatasetText: JSON.stringify(overrides?.goldenDataset ?? goldenDataset, null, 2),
    });
  };

  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedClient) return;
      const baseConfig = getDefaultRuleConfig(
        (selectedClient.country as CountryCode | undefined) ?? "IE",
        new Date().getFullYear()
      );
      setLoadingConfig(true);
      try {
        const row = await fetchRuleConfig(organisationId, selectedClient.id);
        applyConfigToForm(baseConfig, row?.config ?? undefined);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : "Unable to load rule configuration";
        setError(messageText);
        message.error(messageText);
        applyConfigToForm(baseConfig);
      } finally {
        setLoadingConfig(false);
      }
    };
    void loadConfig();
  }, [organisationId, selectedClient]);

  const handleSave = async () => {
    if (!selectedClient) {
      message.error("Select a client to configure");
      return;
    }
    try {
      const values = await form.validateFields();
      let parsedGolden: unknown = null;
      if (values.goldenDatasetText) {
        try {
          parsedGolden = JSON.parse(values.goldenDatasetText);
        } catch (err) {
          message.error("Golden dataset JSON is invalid");
          return;
        }
      }

      const payload: Partial<RuleConfig> & Record<string, unknown> = {
        enabledRulePacks: values.enabledRulePacks,
        countryOverride: values.country ?? null,
        taxYearOverride: values.taxYear ?? null,
        largeNetChangePercent: values.largeNetChangePercent,
        largeGrossChangePercent: values.largeGrossChangePercent,
        payeSpikePercent: values.payeSpikePercent,
        uscSpikePercent: values.uscSpikePercent,
        maxGrossDeltaPercent: values.maxGrossDeltaPercent,
        maxGrossDeltaForUscPercent: values.maxGrossDeltaForUscPercent,
        pensionEmployeePercent: values.pensionEmployeePercent,
        pensionEmployerPercent: values.pensionEmployerPercent,
        severityOverrides: values.severityOverrides ?? {},
        enrichment: values.enrichment ?? {},
        goldenDataset: parsedGolden,
      };

      await upsertRuleConfig(organisationId, selectedClient.id, payload);
      message.success("Rule configuration saved");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Unable to save settings";
      setError(messageText);
      message.error(messageText);
    }
  };

  const handleReset = async () => {
    if (!selectedClient) return;
    try {
      await deleteRuleConfig(organisationId, selectedClient.id);
      const base = getDefaultRuleConfig(
        (selectedClient.country as CountryCode | undefined) ?? "IE",
        new Date().getFullYear()
      );
      applyConfigToForm(base);
      message.success("Reset to defaults");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Unable to reset settings";
      message.error(messageText);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          Rules & Engine Configuration
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Select a client, tune thresholds, pick rule packs, and manage golden datasets.
        </Typography.Paragraph>
      </div>

      {error ? <Alert type="error" message={error} showIcon /> : null}

      <Card>
        <Form form={form} layout="vertical" disabled={loadingClients || loadingConfig}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Client"
                required
                validateStatus={selectedClient ? undefined : "error"}
                help={!selectedClient ? "Pick a client to load/save settings" : undefined}
              >
                <Select
                  placeholder="Select client"
                  loading={loadingClients}
                  options={clients.map((client) => ({
                    label: `${client.name} (${client.country ?? "N/A"})`,
                    value: client.id,
                  }))}
                  value={selectedClientId ?? undefined}
                  onChange={setSelectedClientId}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Country" name="country" rules={[{ required: true, message: "Country required" }]}>
                <Select
                  options={[
                    { value: "IE", label: "Ireland" },
                    { value: "UK", label: "United Kingdom" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Tax year" name="taxYear">
                <InputNumber style={{ width: "100%" }} min={2020} max={2100} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Rule packs" name="enabledRulePacks">
            <Select
              mode="multiple"
              options={[
                { value: "core-tax", label: "Core tax rules (IE/UK)" },
                { value: "reconciliation", label: "Reconciliation (register/GL/bank/submissions)" },
                { value: "contract-compliance", label: "Contract compliance" },
              ]}
              placeholder="Select packs to run"
            />
          </Form.Item>

          <Divider />
          <Typography.Title level={5}>Thresholds & tolerances</Typography.Title>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Form.Item label="Large net change %" name="largeNetChangePercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Large gross change %" name="largeGrossChangePercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="PAYE spike %" name="payeSpikePercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={200} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="USC/NI spike %" name="uscSpikePercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={200} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Max gross delta %" name="maxGrossDeltaPercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Max gross delta for USC %"
                name="maxGrossDeltaForUscPercent"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Pension EE threshold %" name="pensionEmployeePercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Pension ER threshold %" name="pensionEmployerPercent" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>Severity overrides</Typography.Title>
          <Row gutter={[12, 12]}>
            {overrideableRules.map((rule) => (
              <Col span={8} key={rule.code}>
                <Form.Item label={rule.label} name={["severityOverrides", rule.code]}>
                  <Select allowClear options={severityOptions} placeholder={severityModel[rule.code] ?? "Default"} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider />
          <Typography.Title level={5}>Enrichment options</Typography.Title>
          <Row gutter={[12, 12]}>
            <Col span={8}>
              <Form.Item label="Include expected vs actual" name={["enrichment", "includeEvidence"]} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Include band breakdowns"
                name={["enrichment", "includeBandBreakdown"]}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Include golden context"
                name={["enrichment", "includeGoldenContext"]}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>Golden dataset & severity model</Typography.Title>
          <Form.Item
            name="goldenDatasetText"
            help="Paste JSON describing golden test cases. Saved with the client rule config."
          >
            <Input.TextArea rows={8} spellCheck={false} />
          </Form.Item>

          <Collapse>
            <Collapse.Panel header="Preview severity model" key="severity">
              <Table
                size="small"
                pagination={false}
                rowKey="rule"
                dataSource={Object.entries(severityModel).map(([rule, severity]) => ({
                  rule,
                  severity,
                }))}
                columns={[
                  { title: "Rule", dataIndex: "rule" },
                  {
                    title: "Severity",
                    dataIndex: "severity",
                    render: (value: string) => <Tag color={value === "critical" ? "red" : value === "warning" ? "orange" : "blue"}>{value}</Tag>,
                  },
                ]}
              />
            </Collapse.Panel>
            <Collapse.Panel header="Preview golden cases" key="golden">
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={goldenDataset}
                columns={[
                  { title: "ID", dataIndex: "id" },
                  { title: "Country", dataIndex: "country" },
                  { title: "Tax year", dataIndex: "taxYear" },
                  { title: "Description", dataIndex: "description" },
                  {
                    title: "Expected issues",
                    dataIndex: "expectedIssues",
                    render: (issues) =>
                      (issues as { ruleCode: RuleCode; severity: IssueSeverity }[]).map((issue) => (
                        <Tag key={issue.ruleCode} color={issue.severity === "critical" ? "red" : issue.severity === "warning" ? "orange" : "blue"}>
                          {issue.ruleCode}
                        </Tag>
                      )),
                  },
                ]}
              />
            </Collapse.Panel>
          </Collapse>

          <Divider />
          <Space>
            <Button onClick={handleReset}>Reset to defaults</Button>
            <Button type="primary" onClick={handleSave} loading={loadingConfig}>
              Save configuration
            </Button>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <SettingsView />
      </AppLayout>
    </RequireAuth>
  );
}
