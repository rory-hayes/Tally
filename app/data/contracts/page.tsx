"use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DataSourceUploader } from "@/components/data/DataSourceUploader";
import { useOrganisation } from "@/context/OrganisationContext";
import { parseContractCsv } from "@/lib/contracts/parser";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const sampleCsv = `employee_id,salary_amount,salary_period,hourly_rate,standard_hours_per_week,effective_from,effective_to
EMP001,52000,annual,,40,2025-01-01,
EMP002,,hourly,22.5,38,2025-02-01,
`;

function ContractsIntegrationView() {
  const { organisationId } = useOrganisation();

  const handleUpload = async ({
    clientId,
    file,
  }: {
    clientId: string;
    file: File;
  }) => {
    const csv = await file.text();
    const rows = parseContractCsv(csv);
    if (!rows.length) {
      throw new Error("No contract rows parsed from CSV");
    }

    const supabase = getSupabaseBrowserClient();
    const payload = rows.map((row) => ({
      organisation_id: organisationId,
      client_id: clientId,
      employee_id: row.employee_id,
      salary_amount: row.salary_amount,
      salary_period: row.salary_period,
      hourly_rate: row.hourly_rate,
      standard_hours_per_week: row.standard_hours_per_week,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      metadata: row.metadata ?? null,
    }));

    const { error } = await supabase
      .from("contracts")
      .upsert(payload, { onConflict: "employee_id" });

    if (error) {
      throw new Error(error.message);
    }
  };

  return (
    <DataSourceUploader
      title="Contract & HR data"
      description="Upload employee contract data (salary/hourly and hours) to power contract compliance checks and enrichment. Uses the contracts table directly."
      expectedColumns={[
        "employee_id",
        "salary_amount",
        "salary_period",
        "hourly_rate",
        "standard_hours_per_week",
        "effective_from",
        "effective_to",
      ]}
      sampleCsv={sampleCsv}
      requireBatch={false}
      actionLabel="Upload contract data"
      onSubmit={handleUpload}
    />
  );
}

export default function ContractsIntegrationPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <ContractsIntegrationView />
      </AppLayout>
    </RequireAuth>
  );
}
