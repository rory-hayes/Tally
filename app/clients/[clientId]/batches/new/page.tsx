"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Spin, Typography, Alert } from "antd";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import { getClientById, type ClientRow } from "@/lib/repositories/clients";
import { BatchUploadWizard } from "@/components/batches/BatchUploadWizard";

export default function NewBatchPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  return (
    <RequireAuth>
      <AppLayout>
        <NewBatchContent clientId={clientId} />
      </AppLayout>
    </RequireAuth>
  );
}

function NewBatchContent({ clientId }: { clientId: string }) {
  const { organisationId, profileId } = useOrganisation();
  const router = useRouter();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getClientById(organisationId, clientId);
        if (!data) {
          setError("Client not found");
          setStatus("error");
          return;
        }
        setClient(data);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load client");
        setStatus("error");
      }
    };
    void load();
  }, [organisationId, clientId]);

  if (status === "loading") {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  if (status === "error" || !client) {
    return <Alert type="error" message={error ?? "Unable to load client"} />;
  }

  return (
    <BatchUploadWizard
      organisationId={organisationId}
      profileId={profileId}
      clientId={clientId}
      clientName={client.name}
      clientCountry={client.country}
      onComplete={(batchId) => router.push(`/batches/${batchId}`)}
    />
  );
}
