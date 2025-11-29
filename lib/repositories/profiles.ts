import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isSessionInvalidError } from "@/lib/authErrors";

export type ProfileRow = {
  id: string;
  organisation_id: string | null;
  role: "admin" | "staff";
};

export async function fetchCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (isSessionInvalidError(userError.message)) {
      await supabase.auth.signOut();
      return null;
    }
    throw new Error(userError.message);
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, organisation_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function createOrganisationWithProfile(
  organisationName: string
): Promise<{ organisationId: string }> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (isSessionInvalidError(userError.message)) {
      await supabase.auth.signOut();
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error("No authenticated user");
  }

  const { data, error } = await supabase.rpc<
    string,
    { organisation_name: string }
  >(
    "create_organisation_for_current_user",
    {
      organisation_name: organisationName,
    }
  );

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create organisation");
  }

  return { organisationId: data };
}

