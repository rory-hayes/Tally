"use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DataSourceUploader } from "@/components/data/DataSourceUploader";
import { ingestBankPaymentsCsv } from "@/lib/functions/ingestion";

const sampleCsv = `employee_id,amount,currency,reference
EMP001,2500,EUR,April payroll
EMP002,2100,EUR,April payroll`;

function PaymentsIntegrationView() {
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
    await ingestBankPaymentsCsv({
      batchId,
      clientId,
      csv,
      fileName: file.name,
    });
  };

  return (
    <DataSourceUploader
      title="Bank payment file ingestion"
      description="Upload SEPA/BACS-style CSV payment files to reconcile bank payments against net pay."
      expectedColumns={["employee_id", "amount", "currency", "reference"]}
      sampleCsv={sampleCsv}
      onSubmit={handleUpload}
      actionLabel="Upload payment file"
    />
  );
}

export default function PaymentsIntegrationPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <PaymentsIntegrationView />
      </AppLayout>
    </RequireAuth>
  );
}
