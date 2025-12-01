"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEmployeeComparison,
  updateIssueResolution,
  type EmployeeComparison,
} from "@/lib/repositories/employeeDetails";
import { useOrganisation } from "@/context/OrganisationContext";

export type EmployeeComparisonState =
  | { status: "idle"; data: EmployeeComparison | null; error: null }
  | { status: "loading"; data: EmployeeComparison | null; error: null }
  | { status: "success"; data: EmployeeComparison; error: null }
  | { status: "error"; data: EmployeeComparison | null; error: string };

export function useEmployeeComparison(employeeId: string, batchId: string) {
  const { organisationId, profileId } = useOrganisation();
  const [state, setState] = useState<EmployeeComparisonState>({
    status: "idle",
    data: null,
    error: null,
  });

  const load = useCallback(async () => {
    if (!employeeId || !batchId) {
      return;
    }
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    try {
      const data = await fetchEmployeeComparison({
        organisationId,
        employeeId,
        batchId,
      });
      setState({ status: "success", data, error: null });
    } catch (err) {
      setState({
        status: "error",
        data: null,
        error: err instanceof Error ? err.message : "Unable to load payslips",
      });
    }
  }, [organisationId, employeeId, batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleIssue = useCallback(
    async (issueId: string, resolved: boolean, note?: string | null) => {
      const comparison = state.data;
      await updateIssueResolution({
        issueId,
        resolved,
        note,
        audit: comparison
          ? {
              organisationId,
              actorId: profileId,
              batchId: comparison.batchId,
              employeeId: comparison.employeeId,
            }
          : undefined,
      });
      await load();
    },
    [state, organisationId, profileId, load]
  );

  return { ...state, reload: load, toggleIssue };
}

