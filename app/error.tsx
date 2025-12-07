"use client";

import { Button, Card, Space, Typography } from "antd";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 520, width: "100%" }} title="Something went wrong">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Typography.Paragraph>
            We hit an unexpected error. Please try reloading or return to the dashboard while we investigate.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Error reference: {error.digest ?? "not available"}
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={reset}>
              Refresh page
            </Button>
            <Link href="/">
              <Button>Back to dashboard</Button>
            </Link>
            <Link href="mailto:support@tallypayroll.com?subject=Tally%20error">
              <Button type="link">Contact support</Button>
            </Link>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
