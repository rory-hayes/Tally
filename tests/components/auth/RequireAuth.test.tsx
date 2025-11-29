import { render, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, vi } from "vitest";

const mockAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

const mockSubscription = { unsubscribe: vi.fn() };
mockAuth.onAuthStateChange.mockReturnValue({
  data: { subscription: mockSubscription },
});

vi.mock("@/lib/repositories/profiles", () => ({
  fetchCurrentProfile: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({
    auth: mockAuth,
  }),
}));

let mockPathname = "/";
const routerReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  usePathname: () => mockPathname,
}));

import { fetchCurrentProfile } from "@/lib/repositories/profiles";
import { RequireAuth } from "@/components/auth/RequireAuth";

const mockedFetchCurrentProfile = vi.mocked(fetchCurrentProfile);

describe("RequireAuth", () => {
  beforeEach(() => {
    mockPathname = "/";
    routerReplace.mockReset();
    mockedFetchCurrentProfile.mockReset();
    mockAuth.getSession.mockReset();
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription },
    });
    mockSubscription.unsubscribe.mockReset();
  });

  it("redirects unauthenticated users to /login", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <RequireAuth>
        <div>Secret</div>
      </RequireAuth>
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("sends users without organisations to /onboarding", async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockedFetchCurrentProfile.mockResolvedValue({
      id: "user-1",
      organisation_id: null,
      role: "admin",
    });

    render(
      <RequireAuth>
        <div>Secret</div>
      </RequireAuth>
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/onboarding");
    });
  });
});


