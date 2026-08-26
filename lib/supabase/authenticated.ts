import { createClient } from "@supabase/supabase-js";

export function createAuthenticatedSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function authenticateRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!accessToken) throw new Error("Authentication required.");

  const supabase = createAuthenticatedSupabase(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) throw new Error("Your session is no longer valid.");

  return {
    supabase,
    user: data.user,
    userId: data.user.email ?? data.user.id,
  };
}
