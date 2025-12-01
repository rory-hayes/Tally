"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Spin } from "antd";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  OrganisationProvider,
  OrganisationContextValue,
} from "@/context/OrganisationContext";
import { fetchCurrentProfile } from "@/lib/repositories/profiles";

type AuthState =
  | { status: "checking" }
  | { status: "needsOrg" }
  | { status: "ready"; profile: OrganisationContextValue };

export function RequireAuth({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    const loadProfile = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      if (!session) {
        router.replace("/login");
        setState({ status: "checking" });
        return;
      }

      const profile = await fetchCurrentProfile();

      if (!mounted) return;

      if (!profile || !profile.organisation_id) {
        setState({ status: "needsOrg" });
        if (pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
        return;
      }

      const organisationId = profile.organisation_id!;

      setState({
        status: "ready",
        profile: {
          organisationId,
          profileId: profile.id,
          role: profile.role,
        },
      });
    };

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session) {
        setState({ status: "checking" });
        router.replace("/login");
      } else {
        loadProfile();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (state.status === "checking") {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin />
      </div>
    );
  }

  if (state.status === "needsOrg") {
    if (pathname !== "/onboarding") {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Spin />
        </div>
      );
    }

    return <>{children}</>;
  }

  return (
    <OrganisationProvider value={state.profile}>{children}</OrganisationProvider>
  );
}

