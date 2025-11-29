"use client";

import Link from "next/link";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { LoginForm } from "@/components/auth/LoginForm";

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f5",
  padding: "2rem",
};

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/");
      }
    });
  }, [router]);

  return (
    <div style={containerStyle}>
      <Card style={{ maxWidth: 420, width: "100%" }}>
        <Typography.Title level={3}>Sign in to Tally</Typography.Title>
        <Typography.Paragraph type="secondary">
          Verify payroll batches securely.
        </Typography.Paragraph>
        <LoginForm onSuccess={() => router.replace("/")} />
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          New here? <Link href="/signup">Create an account</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

