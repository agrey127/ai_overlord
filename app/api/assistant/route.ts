import { createHash } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import {
  createConversation,
  ensureTodayWorkout,
  getConversation,
  saveMessage,
  updateConversation,
} from "@/lib/assistant/repository";
import { assistantTools, runAssistantTool } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const instructions = `You are Baseline, a direct and practical application-wide personal assistant.
Strength training is the first active module, but the application will also support nutrition, finance, relationships, and planning.
Use tools as the source of truth for workout data. Never invent saved workouts, weights, repetitions, or progress.
When the user imports a training handoff or summary, use its explicit exercise prescriptions to populate matching structured workout fields; do not infer a single weight from an ambiguous range. Treat heavy, volume, light, technique, accessory, and bodyweight versions as distinct prescriptions even when the exercise name matches. Never transfer a target weight or progress result across training roles. Use the workout/day context to assign the role, and use standard only when no more specific role is supported.
For read requests, inspect and answer. For write requests, perform only the explicit in-scope change.
When the user explicitly asks to pause, undo starting, or return today's in-progress workout to scheduled, use the return-to-scheduled tool. This preserves all logged sets.
Warm-ups are display-only preparation items: show or update them with the warm-up tool, but never log them as working sets or count them toward workout completion. Use target-weight tools only for weights explicitly provided by the user or already present in saved workout data.
After starting a workout, lead with its saved warm-up checklist before presenting the first working exercise.
When the user explicitly corrects today's workout and the complete intended prescription is available in conversation context, replace the saved workout with the replacement tool instead of merely describing a mismatch. If prescription details are incomplete, ask one concise question.
An untouched scheduled workout may be replaced without a second confirmation. Never set confirm_destructive=true unless the user explicitly confirms after being told that an existing workout has started, completed, or contains logged sets.
Require clear user intent before deleting a set or completing a workout. A user may finish a workout with incomplete exercises or sets; mark it completed without inventing missing work, and briefly report the completed set count. If required log-set details are missing, ask one concise question.
After a successful write, state exactly what changed. Keep answers compact, calm, and specific.`;

function titleFromMessage(message: string) {
  const compact = message.trim().replace(/\s+/g, " ");
  return compact.length > 42 ? `${compact.slice(0, 39)}…` : compact || "New conversation";
}

function stableSafetyId(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { message?: string; conversationId?: string | null };
    const message = body.message?.trim() ?? "";
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const conversation = body.conversationId
      ? await getConversation(supabase, userId, body.conversationId)
      : await createConversation(supabase, userId, titleFromMessage(message));

    await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "user",
      content: message,
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const common = {
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
      instructions,
      tools: assistantTools,
      reasoning: { effort: "low" as const },
      text: { verbosity: "low" as const },
      safety_identifier: stableSafetyId(userId),
      store: true,
      parallel_tool_calls: false,
    };

    let response = await client.responses.create({
      ...common,
      previous_response_id: conversation.last_response_id ?? undefined,
      input: [{ role: "user", content: message }],
    });

    for (let round = 0; round < 5; round += 1) {
      const calls = response.output.filter(
        (item): item is ResponseFunctionToolCall => item.type === "function_call",
      );
      if (!calls.length) break;

      const outputs = await Promise.all(
        calls.map(async (call) => {
          const result = await runAssistantTool(supabase, userId, call.name, call.arguments);
          await saveMessage(supabase, {
            conversationId: conversation.id,
            userId,
            role: "tool",
            content: JSON.stringify(result),
            toolName: call.name,
            toolCallId: call.call_id,
          });
          return {
            type: "function_call_output" as const,
            call_id: call.call_id,
            output: JSON.stringify(result),
          };
        }),
      );

      response = await client.responses.create({
        ...common,
        previous_response_id: response.id,
        input: outputs,
      });
    }

    const answer = response.output_text.trim() || "I completed the request, but no summary was returned.";
    const assistantMessage = await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "assistant",
      content: answer,
    });

    await updateConversation(supabase, userId, conversation.id, {
      title: conversation.title === "New conversation" ? titleFromMessage(message) : undefined,
      last_response_id: response.id,
      domain: "strength",
    });

    const workout = await ensureTodayWorkout(supabase, userId);
    return NextResponse.json({ conversationId: conversation.id, message: assistantMessage, workout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant request failed.";
    const status = message.includes("Authentication") || message.includes("session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
