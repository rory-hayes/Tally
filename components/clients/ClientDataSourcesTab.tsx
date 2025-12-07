"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Form,
  Input,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { dataSourceLabels, type DataSourceType } from "@/types/dataSources";
import {
  ClientDataSource,
  listClientDataSources,
  upsertClientDataSource,
} from "@/lib/repositories/clientDataSources";

const sourceTypes: DataSourceType[] = [
  "PAYROLL_REGISTER",
  "GL_EXPORT",
  "GROSS_TO_NET",
  "BANK_PAYMENTS",
  "STATUTORY_SUBMISSION",
];

type ClientDataSourcesTabProps = {
  organisationId: string;
  clientId: string;
};

type EditorState = {
  open: boolean;
  type: DataSourceType | null;
  record: ClientDataSource | null;
};

export function ClientDataSourcesTab({
  organisationId,
  clientId,
}: ClientDataSourcesTabProps) {
  const [rows, setRows] = useState<ClientDataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    type: null,
    record: null,
  });
  const [form] = Form.useForm();

  const fetchRows = useMemo(
    () => async () => {
      try {
        setLoading(true);
        const data = await listClientDataSources(organisationId, clientId);
        setRows(data);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : "Unable to load data sources";
        setError(messageText);
      } finally {
        setLoading(false);
      }
    },
    [organisationId, clientId]
  );

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openEditor = (type: DataSourceType, record?: ClientDataSource | null) => {
    setEditor({ open: true, type, record: record ?? null });
    form.setFieldsValue({
      template_name: record?.template_name ?? "",
      mapping_config: JSON.stringify(record?.mapping_config ?? {}, null, 2),
    });
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const configText = values.mapping_config as string;
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = configText ? JSON.parse(configText) : {};
    } catch (err) {
      throw new Error("Mapping config must be valid JSON");
    }
    if (!editor.type) return;
    await upsertClientDataSource(organisationId, clientId, {
      type: editor.type,
      template_name: values.template_name ?? null,
      mapping_config: parsedConfig,
      is_active: true,
    });
    setEditor({ open: false, type: null, record: null });
    await fetchRows();
  };

  const columns: ColumnsType<ClientDataSource> = [
    {
      title: "Type",
      dataIndex: "type",
      render: (value: DataSourceType) => dataSourceLabels[value] ?? value,
    },
    {
      title: "Template",
      dataIndex: "template_name",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Status",
      key: "status",
      render: (_value, record) =>
        record?.template_name ? (
          <Tag color="green">Configured</Tag>
        ) : (
          <Tag color="default">Not configured</Tag>
        ),
    },
    {
      title: "Last used",
      dataIndex: "last_used_at",
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : "—",
    },
    {
      title: "Action",
      key: "action",
      render: (_value, record) => (
        <Button type="link" onClick={() => openEditor(record.type, record)}>
          {record.template_name ? "Edit mapping" : "Configure"}
        </Button>
      ),
    },
  ];

  const mergedRows: ClientDataSource[] = sourceTypes.map((type) => {
    const found = rows.find((row) => row.type === type);
    return (
      found ?? {
        id: `${type}-placeholder`,
        organisation_id: organisationId,
        client_id: clientId,
        type,
        template_name: null,
        mapping_config: {},
        is_active: true,
        last_used_at: null,
      }
    );
  });

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <div>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          Data sources
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Configure client-specific mappings for payroll register, GL, bank files, and statutory exports.
        </Typography.Paragraph>
      </div>
      <Alert
        type="info"
        showIcon
        message="Save mapping JSON once per client"
        description="Match the exact column headers from your exports (employee IDs, pay dates, gross/net amounts). These mappings drive the batch wizard upload validation and keep parsing deterministic."
      />
      {error ? <Alert type="error" message={error} showIcon /> : null}
      <Card>
        <Table<ClientDataSource>
          rowKey={(record) => record.id}
          dataSource={mergedRows}
          columns={columns}
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        open={editor.open}
        title={`Configure ${editor.type ? dataSourceLabels[editor.type] : "data source"}`}
        onCancel={() => setEditor({ open: false, type: null, record: null })}
        onOk={handleSave}
        okText="Save mapping"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Template name"
            name="template_name"
            rules={[{ required: true, message: "Enter a template or mapping name" }]}
          >
            <Input placeholder="Eg. Sage IE register v1" />
          </Form.Item>
          <Form.Item
            label="Mapping config (JSON)"
            name="mapping_config"
            rules={[{ required: true, message: "Provide mapping JSON" }]}
          >
            <Input.TextArea
              rows={8}
              spellCheck={false}
              placeholder={`{
  "dateFormat": "DD/MM/YYYY",
  "employeeIdColumn": "employee_id",
  "grossColumn": "gross_pay"
}`}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Include header names and formats, e.g. {`{ "employeeIdColumn": "employee_id", "dateFormat": "DD/MM/YYYY" }`}. See Clients → Data sources uploads for sample CSVs.
          </Typography.Paragraph>
          <Alert
            type="info"
            showIcon
            message="Stored per client; used to parse monthly files uploaded in the batch wizard."
          />
        </Form>
      </Modal>
    </Space>
  );
}
