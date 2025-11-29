import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export async function signInWithEmailPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signUpWithEmailPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

