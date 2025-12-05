"use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DataSourceUploader } from "@/components/data/DataSourceUploader";
import { ingestSubmissionCsv } from "@/lib/functions/ingestion";

const sampleCsv = `paye_total,usc_or_ni_total,employee_count,tax_year,source_file
1100,190,2,2025,RTI-FPS-APR.csv`;

function SubmissionsIntegrationView() {
  const handleUpload = async ({
    clientId,
    batchId,
    country,
    file,
  }: {
    clientId: string;
    batchId?: string;
    country?: string;
    file: File;
  }) => {
    if (!batchId) throw new Error("Batch is required");
    if (!country) throw new Error("Country is required");
    const csv = await file.text();
    await ingestSubmissionCsv({ batchId, clientId, country, csv });
  };

  return (
    <DataSourceUploader
      title="Revenue.ie & HMRC submissions"
      description="Upload ROS/RTI submission summaries (CSV) to reconcile statutory filings against payroll."
      expectedColumns={["paye_total", "usc_or_ni_total", "employee_count", "tax_year", "source_file"]}
      sampleCsv={sampleCsv}
      onSubmit={handleUpload}
      requireCountry
      actionLabel="Upload submission summary"
    />
  );
}

export default function SubmissionsIntegrationPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <SubmissionsIntegrationView />
      </AppLayout>
    </RequireAuth>
  );
}
