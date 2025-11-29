"use client";

import {
  createContext,
  useContext,
  PropsWithChildren,
  useMemo,
} from "react";

export type OrganisationContextValue = {
  organisationId: string;
  role: string;
};

const OrganisationContext = createContext<OrganisationContextValue | null>(null);

export function OrganisationProvider({
  value,
  children,
}: PropsWithChildren<{ value: OrganisationContextValue }>) {
  const memoized = useMemo(() => value, [value.organisationId, value.role]);
  return (
    <OrganisationContext.Provider value={memoized}>
      {children}
    </OrganisationContext.Provider>
  );
}

export function useOrganisation() {
  const ctx = useContext(OrganisationContext);
  if (!ctx) {
    throw new Error("useOrganisation must be used within OrganisationProvider");
  }
  return ctx;
}

