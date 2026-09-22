import "server-only";
import { createServerSupabase, requireUser } from "./server";

export async function supabaseClient() {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  return supabase;
}
