"use client";

import { Card, Empty, Spin, Typography, Alert, Space } from "antd";
import { useClients } from "@/hooks/useClients";

export function ClientsPreview() {
  const { status, data, error } = useClients();

  return (
    <Card title="Recent Clients" data-testid="clients-preview">
      {status === "loading" && (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <Spin data-testid="clients-loading" />
        </div>
      )}

      {status === "error" && error && (
        <Alert
          type="error"
          title="Unable to load clients"
          description={error}
          showIcon
        />
      )}

      {status === "success" && data.length === 0 && (
        <Empty description="No clients yet. Upload your first batch to see activity." />
      )}

      {status === "success" && data.length > 0 && (
        <Space orientation="vertical" size="small" style={{ width: "100%" }}>
          {data.map((client) => (
            <div key={client.id}>
              <Typography.Text strong>{client.name}</Typography.Text>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {client.country ?? "Unknown"} •{" "}
                {client.payroll_system ?? "Unspecified"}
              </Typography.Paragraph>
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

