"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganisation } from "@/context/OrganisationContext";
import type { BatchDetail } from "@/lib/repositories/batchDetails";
import { fetchBatchDetail } from "@/lib/repositories/batchDetails";

export type BatchDetailState =
  | { status: "idle"; data: BatchDetail | null; error: null }
  | { status: "loading"; data: BatchDetail | null; error: null }
  | { status: "success"; data: BatchDetail; error: null }
  | { status: "error"; data: BatchDetail | null; error: string };

export function useBatchDetail(batchId: string) {
  const { organisationId } = useOrganisation();
  const [state, setState] = useState<BatchDetailState>({
    status: "idle",
    data: null,
    error: null,
  });

  const load = useCallback(async () => {
    if (!batchId) return;
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    try {
      const data = await fetchBatchDetail(organisationId, batchId);
      setState({ status: "success", data, error: null });
    } catch (err) {
      setState({
        status: "error",
        data: null,
        error: err instanceof Error ? err.message : "Unable to load batch",
      });
    }
  }, [batchId, organisationId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

