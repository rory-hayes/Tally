"use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DataSourceUploader } from "@/components/data/DataSourceUploader";
import { ingestGlCsv } from "@/lib/functions/ingestion";

const sampleCsv = `wages,employer_taxes,pensions,other,currency
120000,13500,4200,0,EUR`;

function GlIntegrationView() {
  const handleUpload = async ({
    clientId,
    batchId,
    file,
  }: {
    clientId: string;
    batchId?: string;
    file: File;
  }) => {
    if (!batchId) throw new Error("Batch is required");
    const csv = await file.text();
    await ingestGlCsv({ batchId, clientId, csv });
  };

  return (
    <DataSourceUploader
      title="GL payroll postings"
      description="Upload GL payroll postings (e.g., from Xero/Sage exports) to reconcile accounting totals against payroll."
      expectedColumns={["wages", "employer_taxes", "pensions", "other", "currency"]}
      sampleCsv={sampleCsv}
      onSubmit={handleUpload}
      actionLabel="Upload GL file"
    />
  );
}

export default function GlIntegrationPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <GlIntegrationView />
      </AppLayout>
    </RequireAuth>
  );
}
