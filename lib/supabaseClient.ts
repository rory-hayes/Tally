import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabaseClient } from "@/lib/supabaseMock";

const useMock =
  process.env.NEXT_PUBLIC_USE_SUPABASE_MOCK === "true" ||
  process.env.SUPABASE_USE_MOCK === "true";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | undefined;

export const getSupabaseBrowserClient = () => {
  if (useMock) {
    if (!browserClient) {
      browserClient = createMockSupabaseClient() as unknown as SupabaseClient;
    }
    return browserClient;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
};

export const createSupabaseServerClient = () =>
  useMock && browserClient
    ? (browserClient as SupabaseClient)
    : createClient(supabaseUrl!, supabaseKey!);
