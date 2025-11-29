"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Spin } from "antd";

type AuthStatus = "checking" | "authenticated";

export function RequireAuth({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function ensureSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        router.replace("/login");
      } else {
        setStatus("authenticated");
      }
    }

    ensureSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session) {
        setStatus("checking");
        router.replace("/login");
      } else {
        setStatus("authenticated");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (status !== "authenticated") {
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

