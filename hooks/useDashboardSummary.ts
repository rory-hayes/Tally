"use client";

import { useEffect, useState } from "react";
import { useOrganisation } from "@/context/OrganisationContext";
import {
  fetchDashboardSummaries,
  type DashboardClientSummary,
} from "@/lib/repositories/dashboard";

export type DashboardSummaryState =
  | { status: "idle"; data: DashboardClientSummary[]; error: null }
  | { status: "loading"; data: DashboardClientSummary[]; error: null }
  | { status: "success"; data: DashboardClientSummary[]; error: null }
  | { status: "error"; data: DashboardClientSummary[]; error: string };

export function useDashboardSummary(): DashboardSummaryState {
  const [state, setState] = useState<DashboardSummaryState>({
    status: "idle",
    data: [],
    error: null,
  });
  const { organisationId } = useOrganisation();

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ status: "loading", data: [], error: null });
      try {
        const summaries = await fetchDashboardSummaries(organisationId);
        if (!active) return;
        setState({ status: "success", data: summaries, error: null });
      } catch (err) {
        if (!active) return;
        setState({
          status: "error",
          data: [],
          error: err instanceof Error ? err.message : "Unable to load dashboard",
        });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [organisationId]);

  return state;
}

