"use client";

import { useEffect, useState } from "react";
import { useOrganisation } from "@/context/OrganisationContext";
import {
  getContractForEmployee,
  upsertContract,
  type ContractRow,
  type ContractUpsertInput,
} from "@/lib/repositories/contracts";

export type ContractHookState =
  | { status: "idle"; data: ContractRow | null; error: null }
  | { status: "loading"; data: ContractRow | null; error: null }
  | { status: "success"; data: ContractRow | null; error: null }
  | { status: "error"; data: ContractRow | null; error: string };

export function useEmployeeContract(employeeId: string | null | undefined) {
  const { organisationId } = useOrganisation();
  const [state, setState] = useState<ContractHookState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    if (!employeeId) return;
    async function fetchContract(targetEmployeeId: string) {
      setState({ status: "loading", data: null, error: null });
      try {
        const contract = await getContractForEmployee(organisationId, targetEmployeeId);
        if (!active) return;
        setState({ status: "success", data: contract, error: null });
      } catch (err) {
        if (!active) return;
        setState({
          status: "error",
          data: null,
          error: err instanceof Error ? err.message : "Failed to load contract",
        });
      }
    }
    fetchContract(employeeId);
    return () => {
      active = false;
    };
  }, [employeeId, organisationId]);

  const save = async (input: ContractUpsertInput) => {
    if (!employeeId) throw new Error("Employee ID is required to save contract");
    const updated = await upsertContract(organisationId, employeeId, input);
    setState({ status: "success", data: updated, error: null });
    return updated;
  };

  return { ...state, save };
}
