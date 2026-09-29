import type { SupabaseClient } from "@supabase/supabase-js";

export type SpecialistDomain = "running" | "strength" | "nutrition";
export type DelegationStatus = "pending" | "running" | "completed" | "failed";

export type AssistantDelegation = {
  id: string;
  chief_conversation_id: string;
  specialist_domain: SpecialistDomain;
  objective: string;
  status: DelegationStatus;
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const delegationColumns = "id,chief_conversation_id,specialist_domain,objective,status,result,error,created_at,started_at,completed_at";
const specialistDomains = new Set<SpecialistDomain>(["running", "strength", "nutrition"]);

export function validateDelegationInput(domain: string, objective: string) {
  if (!specialistDomains.has(domain as SpecialistDomain)) {
    throw new Error("Choose Running, Strength, or Nutrition for this assignment.");
  }
  const trimmed = objective.trim();
  if (!trimmed || trimmed.length > 500) throw new Error("Describe the assignment in 1 to 500 characters.");
  return { domain: domain as SpecialistDomain, objective: trimmed };
}

export async function listDelegations(supabase: SupabaseClient, userId: string, chiefConversationId: string) {
  const { data, error } = await supabase.from("assistant_delegations")
    .select(delegationColumns).eq("user_id", userId).eq("chief_conversation_id", chiefConversationId)
    .order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Unable to load delegated tasks: ${error.message}`);
  return (data ?? []) as AssistantDelegation[];
}

export async function getDelegation(supabase: SupabaseClient, userId: string, chiefConversationId: string, taskId: string) {
  const { data, error } = await supabase.from("assistant_delegations")
    .select(delegationColumns).eq("id", taskId).eq("user_id", userId)
    .eq("chief_conversation_id", chiefConversationId).maybeSingle();
  if (error) throw new Error(`Unable to load delegated task: ${error.message}`);
  if (!data) throw new Error("Delegated task was not found in this Chief of Staff chat.");
  return data as AssistantDelegation;
}

export async function createDelegation(
  supabase: SupabaseClient, userId: string, chiefConversationId: string,
  toolCallId: string, domain: string, objective: string,
) {
  const validated = validateDelegationInput(domain, objective);
  if (!toolCallId || toolCallId.length > 200) throw new Error("The assignment request is missing its tool call ID.");
  const { data, error } = await supabase.from("assistant_delegations")
    .insert({ user_id: userId, chief_conversation_id: chiefConversationId,
      source_tool_call_id: toolCallId, specialist_domain: validated.domain, objective: validated.objective })
    .select(delegationColumns).single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase.from("assistant_delegations")
      .select(delegationColumns).eq("user_id", userId).eq("chief_conversation_id", chiefConversationId)
      .eq("source_tool_call_id", toolCallId).single();
    if (existingError || !existing) throw new Error("Unable to recover the existing delegated task.");
    if (existing.specialist_domain !== validated.domain || existing.objective !== validated.objective) {
      throw new Error("This tool call ID already belongs to a different assignment.");
    }
    return existing as AssistantDelegation;
  }
  if (error) throw new Error(`Unable to create delegated task: ${error.message}`);
  return data as AssistantDelegation;
}

export async function executeDelegation(
  supabase: SupabaseClient, userId: string, chiefConversationId: string, taskId: string,
  runSpecialist: (domain: SpecialistDomain, objective: string) => Promise<string>,
) {
  const task = await getDelegation(supabase, userId, chiefConversationId, taskId);
  if (task.status === "completed") return task;
  const staleRunning = task.status === "running" && task.started_at
    && Date.now() - new Date(task.started_at).getTime() > 5 * 60_000;
  if (task.status === "running" && !staleRunning) return task;

  let claim = supabase.from("assistant_delegations")
    .update({ status: "running", started_at: new Date().toISOString(), completed_at: null, error: null })
    .eq("id", taskId).eq("user_id", userId).eq("chief_conversation_id", chiefConversationId)
    .eq("status", task.status);
  if (staleRunning && task.started_at) claim = claim.eq("started_at", task.started_at);
  const { data: claimed, error: claimError } = await claim.select(delegationColumns).maybeSingle();
  if (claimError) throw new Error(`Unable to start delegated task: ${claimError.message}`);
  if (!claimed) return getDelegation(supabase, userId, chiefConversationId, taskId);

  try {
    const result = (await runSpecialist(task.specialist_domain, task.objective)).trim();
    if (!result) throw new Error("The specialist returned no result.");
    const { data, error } = await supabase.from("assistant_delegations")
      .update({ status: "completed", result: result.slice(0, 8000), error: null,
        completed_at: new Date().toISOString() })
      .eq("id", taskId).eq("user_id", userId).eq("chief_conversation_id", chiefConversationId)
      .eq("status", "running").eq("started_at", claimed.started_at)
      .select(delegationColumns).single();
    if (error) throw new Error(`Unable to save specialist result: ${error.message}`);
    return data as AssistantDelegation;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error("Delegated specialist task failed:", reason);
    const { data, error: updateError } = await supabase.from("assistant_delegations")
      .update({ status: "failed", error: "The specialist could not finish this task. Retry it from the task list.",
        completed_at: new Date().toISOString() })
      .eq("id", taskId).eq("user_id", userId).eq("chief_conversation_id", chiefConversationId)
      .eq("status", "running").eq("started_at", claimed.started_at)
      .select(delegationColumns).single();
    if (updateError) throw new Error(`Unable to record delegated task failure: ${updateError.message}`);
    return data as AssistantDelegation;
  }
}
