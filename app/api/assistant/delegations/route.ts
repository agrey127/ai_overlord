import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import { getConversation } from "@/lib/assistant/repository";
import { executeDelegation, getDelegation, listDelegations } from "@/lib/assistant/delegations";
import { runDelegatedSpecialist } from "@/lib/assistant/specialist-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireChiefConversation(request: Request, conversationId: string) {
  const auth = await authenticateRequest(request);
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new Error("Choose a Chief of Staff chat.");
  const conversation = await getConversation(auth.supabase, auth.userId, conversationId);
  if (conversation.domain !== "chief_of_staff") throw new Error("Delegated tasks belong to Chief of Staff.");
  return auth;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to load delegated tasks.";
  const status = message.includes("Authentication") || message.includes("session") ? 401
    : message.includes("Chief of Staff") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
    const { supabase, userId } = await requireChiefConversation(request, conversationId);
    return NextResponse.json({ tasks: await listDelegations(supabase, userId, conversationId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { conversationId?: string; taskId?: string };
    const conversationId = body.conversationId ?? "";
    const taskId = body.taskId ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error("Choose a delegated task to retry.");
    const { supabase, userId } = await requireChiefConversation(request, conversationId);
    const task = await getDelegation(supabase, userId, conversationId, taskId);
    if (task.status === "completed") return NextResponse.json({ task });
    const result = await executeDelegation(supabase, userId, conversationId, taskId,
      (domain, objective) => runDelegatedSpecialist(supabase, userId, conversationId, domain, objective));
    return NextResponse.json({ task: result });
  } catch (error) { return errorResponse(error); }
}
