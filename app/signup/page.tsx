"use client";

import Link from "next/link";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { SignupForm } from "@/components/auth/SignupForm";

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f5",
  padding: "2rem",
};

export default function SignupPage() {
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
        <Typography.Title level={3}>Create your Tally account</Typography.Title>
        <Typography.Paragraph type="secondary">
          Monitor payroll anomalies across every client.
        </Typography.Paragraph>
        <SignupForm onSuccess={() => router.replace("/")} />
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

