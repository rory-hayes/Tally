"use client";

import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmployeeDetailView } from "@/components/employees/EmployeeDetailView";

export default function EmployeeDetailPage() {
  const params = useParams<{ clientId: string; employeeId: string }>();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId") ?? "";
  const employeeId =
    typeof params.employeeId === "string"
      ? params.employeeId
      : Array.isArray(params.employeeId)
      ? params.employeeId[0]
      : "";

  return (
    <RequireAuth>
      <AppLayout>
        <EmployeeDetailView employeeId={employeeId} batchId={batchId} />
      </AppLayout>
    </RequireAuth>
  );
}

