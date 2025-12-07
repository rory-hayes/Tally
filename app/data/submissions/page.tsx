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
      sampleFilename="submission_summary_template.csv"
      helperText="Totals here are matched to payslip and register totals to flag filing discrepancies. Include the tax year used for the submission."
      fieldHelp={[
        { name: "paye_total", description: "Total PAYE/Income Tax submitted for the period." },
        { name: "usc_or_ni_total", description: "Total USC (IE) or NI (UK) submitted." },
        { name: "employee_count", description: "Number of employees included in the submission." },
        { name: "tax_year", description: "Tax year the submission relates to (YYYY)." },
        { name: "source_file", description: "Filename or reference of the ROS/RTI export." },
      ]}
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
