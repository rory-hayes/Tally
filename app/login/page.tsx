"use client";

import Link from "next/link";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSessionInvalidError } from "@/lib/authErrors";

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
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function redirectIfAuthenticated() {
      const { data } = await supabase.auth.getSession();
      if (!mounted || !data.session) {
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (error) {
        if (isSessionInvalidError(error.message)) {
          await supabase.auth.signOut();
        }
        return;
      }

      if (userData.user) {
        router.replace("/");
      }
    }

    redirectIfAuthenticated();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      if (session) {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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

