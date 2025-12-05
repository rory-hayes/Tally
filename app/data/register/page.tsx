"use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DataSourceUploader } from "@/components/data/DataSourceUploader";
import { ingestRegisterCsv } from "@/lib/functions/ingestion";

const sampleCsv = `employee_id,gross_pay,net_pay,paye,usc_or_ni
EMP001,3200,2500,500,100
EMP002,3000,2100,600,90
,6200,4600,1100,190`;

function RegisterIntegrationView() {
  const handleUpload = async ({
    clientId,
    batchId,
    file,
  }: {
    clientId: string;
    batchId?: string;
    file: File;
  }) => {
    const csv = await file.text();
    if (!batchId) throw new Error("Batch is required");
    await ingestRegisterCsv({ batchId, clientId, csv });
  };

  return (
    <DataSourceUploader
      title="Payroll register ingestion"
      description="Load gross-to-net register exports (CSV) to reconcile batch totals and detect missing payslips."
      expectedColumns={[
        "employee_id",
        "gross_pay",
        "net_pay",
        "paye",
        "usc_or_ni",
      ]}
      sampleCsv={sampleCsv}
      onSubmit={handleUpload}
      actionLabel="Upload register"
    />
  );
}

export default function RegisterIntegrationPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <RegisterIntegrationView />
      </AppLayout>
    </RequireAuth>
  );
}
