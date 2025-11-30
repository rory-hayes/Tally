"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BatchDetailView } from "@/components/batches/BatchDetailView";

export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const batchId =
    typeof params.batchId === "string"
      ? params.batchId
      : Array.isArray(params.batchId)
      ? params.batchId[0]
      : "";

  return (
    <RequireAuth>
      <AppLayout>
        <BatchDetailView batchId={batchId} />
      </AppLayout>
    </RequireAuth>
  );
}
