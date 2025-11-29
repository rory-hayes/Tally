"use client";

import { useParams } from "next/navigation";
import { Card, Typography } from "antd";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";

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
        <Card>
          <Typography.Title level={4} style={{ marginBottom: 16 }}>
            Batch upload
          </Typography.Title>
          <Typography.Paragraph>
            Batch <Typography.Text code>{batchId}</Typography.Text> is ready.
            Placeholder upload workflow coming soon.
          </Typography.Paragraph>
        </Card>
      </AppLayout>
    </RequireAuth>
  );
}


