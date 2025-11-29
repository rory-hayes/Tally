"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ClientRecord = {
  id: string;
  name: string;
  country: string | null;
  payroll_system: string | null;
};

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

  useEffect(() => {
    let active = true;
    async function fetchClients() {
      setState({ status: "loading", data: [], error: null });

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, country, payroll_system")
        .order("name", { ascending: true });

      if (!active) return;

      if (error) {
        setState({ status: "error", data: [], error: error.message });
        return;
      }

      setState({
        status: "success",
        data: data ?? [],
        error: null,
      });
    }

    fetchClients();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

