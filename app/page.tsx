 "use client";

import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function Home() {
  return (
    <RequireAuth>
      <AppLayout>
        <DashboardView />
      </AppLayout>
    </RequireAuth>
  );
}
