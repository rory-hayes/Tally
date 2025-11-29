"use client";

import { useEffect } from "react";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { CreateOrganisationForm } from "@/components/auth/CreateOrganisationForm";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f5",
  padding: "2rem",
};

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function redirectIfComplete() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("organisation_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active || error) return;
      if (data?.organisation_id) {
        router.replace("/");
      }
    }

    redirectIfComplete();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <RequireAuth>
      <div style={containerStyle}>
        <Card style={{ maxWidth: 480, width: "100%" }}>
          <Typography.Title level={3}>
            Create your organisation
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            We’ll use this to scope clients, batches, and permissions across
            your firm.
          </Typography.Paragraph>
          <CreateOrganisationForm onSuccess={() => router.replace("/")} />
        </Card>
      </div>
    </RequireAuth>
  );
}

