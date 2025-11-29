"use client";

import { useEffect, useState } from "react";
import { useOrganisation } from "@/context/OrganisationContext";
import { getClientsForOrg, type ClientRow } from "@/lib/repositories/clients";

export type ClientRecord = ClientRow;

export type ClientsHookState =
  | { status: "idle"; data: ClientRecord[]; error: null }
  | { status: "loading"; data: ClientRecord[]; error: null }
  | { status: "success"; data: ClientRecord[]; error: null }
  | { status: "error"; data: ClientRecord[]; error: string };

export function useClients(): ClientsHookState {
  const [state, setState] = useState<ClientsHookState>({
    status: "idle",
    data: [],
    error: null,
  });
  const { organisationId } = useOrganisation();

  useEffect(() => {
    let active = true;
    async function fetchClients() {
      setState({ status: "loading", data: [], error: null });

      try {
        const clients = await getClientsForOrg(organisationId);
        if (!active) return;

        setState({
          status: "success",
          data: clients,
          error: null,
        });
      } catch (err) {
        if (!active) return;
        setState({
          status: "error",
          data: [],
          error: err instanceof Error ? err.message : "Failed to load clients",
        });
      }
    }

    fetchClients();

    return () => {
      active = false;
    };
  }, [organisationId]);

  return state;
}

