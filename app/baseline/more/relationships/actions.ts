"use server";

import { revalidatePath } from "next/cache";
import { supabaseClient } from "@/lib/supabase/client";

const USER_ID = "agrey127@gmail.com";

function requireField(formData: FormData, key: string) {
  const v = formData.get(key);
  if (!v || typeof v !== "string" || v.trim() === "") {
    throw new Error(`Missing field: ${key}`);
  }
  return v.trim();
}

export async function planRelationship(formData: FormData) {
  const commitment_id = requireField(formData, "commitment_id");
  const planned_for_local = requireField(formData, "planned_for"); // datetime-local
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  // Convert "YYYY-MM-DDTHH:mm" into ISO; treat as local time of the server.
  // For now: just append ":00" and let Postgres parse it as timestamptz if your DB expects it.
  const planned_for = planned_for_local.length === 16 ? `${planned_for_local}:00` : planned_for_local;

  const supabase = supabaseClient();

  // Close any existing active plan for this commitment
  await supabase
    .from("relationship_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", USER_ID)
    .eq("commitment_id", commitment_id)
    .eq("is_active", true);

  // Insert new active plan
  const { error } = await supabase.from("relationship_plans").insert({
    user_id: USER_ID,
    commitment_id,
    planned_for,
    notes,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/baseline/more/relationships");
}

export async function logRelationship(formData: FormData) {
  const commitment_id = requireField(formData, "commitment_id");
  const occurred_at_local = requireField(formData, "occurred_at"); // datetime-local
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const occurred_at = occurred_at_local.length === 16 ? `${occurred_at_local}:00` : occurred_at_local;

  const supabase = supabaseClient();

  // Insert event (adjust column names if your table differs)
  const { error } = await supabase.from("relationship_events").insert({
    user_id: USER_ID,
    commitment_id,
    occurred_at,
  });

  if (error) throw new Error(error.message);

  // Auto-close any active plan (nice UX)
  await supabase
    .from("relationship_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", USER_ID)
    .eq("commitment_id", commitment_id)
    .eq("is_active", true);

  revalidatePath("/baseline/more/relationships");
}
