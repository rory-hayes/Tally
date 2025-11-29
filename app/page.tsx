 "use client";

import { Card, Space, Typography } from "antd";
import AppLayout from "@/components/layout/AppLayout";
import { ClientsPreview } from "@/components/clients/ClientsPreview";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function Home() {
  return (
    <RequireAuth>
      <AppLayout>
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <Typography.Title level={3}>Tally Dashboard</Typography.Title>
          <Typography.Paragraph type="secondary">
            This is the placeholder overview for the MVP. Replace this copy with
            live metrics once Supabase wiring is in place.
          </Typography.Paragraph>
          <Space orientation="horizontal" size="large" wrap>
            <Card title="Clients" style={{ minWidth: 280 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                0
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                Active client records
              </Typography.Paragraph>
            </Card>
            <Card title="Open Issues" style={{ minWidth: 280 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                0
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                Critical + warning issues
              </Typography.Paragraph>
            </Card>
          </Space>
          <ClientsPreview />
        </Space>
      </AppLayout>
    </RequireAuth>
  );
}
