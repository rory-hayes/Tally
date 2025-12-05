import type { PlaywrightTestConfig } from "@playwright/test";

const PORT = process.env.PORT || 3000;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

const config: PlaywrightTestConfig = {
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npm run dev -- --hostname 0.0.0.0 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_USE_SUPABASE_MOCK: "true",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
};

export default config;
