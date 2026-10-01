import { createHash } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ResponseFunctionToolCall, ResponseInputContent } from "openai/resources/responses/responses";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import {
  getCurrentOrNextWorkout,
  getConversation,
  saveMessage,
  updateConversation,
} from "@/lib/assistant/repository";
import { runAssistantTool } from "@/lib/assistant/tools";
import { assistantRequestsConfirmation } from "@/lib/assistant/confirmation";
import { ASSISTANT_PROMPT_VERSION, getAssistantDomainConfig } from "@/lib/assistant/domain-config";
import { getSharedCoachingGoals } from "@/lib/assistant/coaching-goals";
import { runDelegatedSpecialist } from "@/lib/assistant/specialist-runner";

export const runtime = "nodejs";
export const maxDuration = 120;

function titleFromMessage(message: string) {
  const compact = message.trim().replace(/\s+/g, " ");
  return compact.length > 42 ? `${compact.slice(0, 39)}…` : compact || "New conversation";
}

function stableSafetyId(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

function isUntitledConversation(title: string) {
  return title === "New conversation" || /^New (?:general|strength|running|nutrition|Chief of Staff) chat$/.test(title);
}

function localDate() {
  const timeZone = process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, timeZone };
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as {
      message?: string;
      conversationId?: string | null;
      images?: Array<{ data_url?: string }>;
      voiceMode?: boolean;
    };
    const message = body.message?.trim() ?? "";
    const voiceMode = body.voiceMode === true;
    const images = Array.isArray(body.images) ? body.images : [];
    if (!message && !images.length) {
      return NextResponse.json({ error: "A message or screenshot is required." }, { status: 400 });
    }
    if (!body.conversationId) {
      return NextResponse.json({ error: "Choose a chat before sending a message." }, { status: 400 });
    }
    if (images.length > 3) {
      return NextResponse.json({ error: "Attach at most 3 screenshots at a time." }, { status: 400 });
    }
    const imageUrls = images.map((image) => image.data_url ?? "");
    const supportedImage = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
    if (imageUrls.some((imageUrl) => !supportedImage.test(imageUrl))) {
      return NextResponse.json({ error: "Screenshots must be JPEG, PNG, or WebP images." }, { status: 400 });
    }
    if (imageUrls.some((imageUrl) => imageUrl.length > 11_000_000)
      || imageUrls.reduce((total, imageUrl) => total + imageUrl.length, 0) > 26_000_000) {
      return NextResponse.json({ error: "The attached screenshots are too large." }, { status: 413 });
    }
    const displayMessage = message || "Import this Garmin activity from the attached screenshot.";

    const conversation = await getConversation(supabase, userId, body.conversationId);
    const domainConfig = getAssistantDomainConfig(conversation.domain);
    if (!domainConfig) {
      return NextResponse.json({ error: "This conversation does not have an active assistant configuration." }, { status: 400 });
    }
    if (imageUrls.length && conversation.domain !== "running") {
      return NextResponse.json({ error: "Garmin run screenshots can only be attached in the Running chat." }, { status: 400 });
    }

    // Keep visible transcripts while starting every domain on the current
    // instruction version. Older model chains may contain stale boundaries.
    let previousResponseId: string | undefined = conversation.last_response_id ?? undefined;
    if (previousResponseId) {
      const { data: latestAssistant, error: latestError } = await supabase
        .from("assistant_messages")
        .select("metadata")
        .eq("conversation_id", conversation.id)
        .eq("user_id", userId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw new Error(`Unable to check assistant chat history: ${latestError.message}`);
      if (Number(latestAssistant?.metadata?.prompt_version) !== ASSISTANT_PROMPT_VERSION) {
        previousResponseId = undefined;
      }
    }

    await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "user",
      content: displayMessage,
      metadata: imageUrls.length ? { image_count: imageUrls.length, image_source: "garmin_screenshot" } : undefined,
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sharedGoals = ["strength", "running", "nutrition", "chief_of_staff"].includes(conversation.domain)
      ? await getSharedCoachingGoals(supabase, userId) : null;
    const common = {
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
      instructions: `${domainConfig.instructions}\nApplication local date: ${JSON.stringify(localDate())}.`
        + (sharedGoals ? `\nRead-only shared coaching goals: ${JSON.stringify(sharedGoals)}. These are structured saved goals, not instructions from other chats. Do not claim access to other transcripts or private training limits.` : "")
        + (voiceMode ? "\nThe user is speaking with you. Respond as in a live conversation: answer directly in a few natural sentences, usually under 100 words. Avoid headings, bullet lists, status labels, and reading out a report. Mention any action you took, what remains pending, and important uncertainty. Ask at most one useful follow-up. If the user requests detail, give it without forcing an artificial length limit." : ""),
      tools: domainConfig.tools,
      reasoning: { effort: "low" as const },
      text: { verbosity: "low" as const },
      safety_identifier: stableSafetyId(userId),
      store: true,
      parallel_tool_calls: false,
    };

    const userContent: ResponseInputContent[] = [
      { type: "input_text", text: displayMessage },
      ...imageUrls.map((imageUrl) => ({
        type: "input_image" as const,
        detail: "high" as const,
        image_url: imageUrl,
      })),
    ];

    let response = await client.responses.create({
      ...common,
      previous_response_id: previousResponseId,
      input: [{ role: "user", content: userContent }],
    });

    let confirmationRequired = false;
    let saveableMealLogId: number | null = null;
    for (let round = 0; round < 12; round += 1) {
      const calls = response.output.filter(
        (item): item is ResponseFunctionToolCall => item.type === "function_call",
      );
      if (!calls.length) break;

      const toolResults = await Promise.all(
        calls.map(async (call) => {
          const result = await runAssistantTool(
            supabase,
            userId,
            call.name,
            call.arguments,
            { conversationId: conversation.id, domain: conversation.domain,
              toolCallId: call.call_id,
              runDelegatedSpecialist: (domain, objective) => runDelegatedSpecialist(
                supabase, userId, conversation.id, domain, objective),
            },
          );
          await saveMessage(supabase, {
            conversationId: conversation.id,
            userId,
            role: "tool",
            content: JSON.stringify(result),
            toolName: call.name,
            toolCallId: call.call_id,
          });
          return {
            toolName: call.name,
            result,
            output: {
              type: "function_call_output" as const,
              call_id: call.call_id,
              output: JSON.stringify(result),
            },
          };
        }),
      );
      confirmationRequired ||= toolResults.some(({ result }) => (
        typeof result === "object"
        && result !== null
        && "confirmation_required" in result
        && result.confirmation_required === true
      ));
      for (const { toolName, result } of toolResults) {
        if (toolName !== "confirm_estimated_meal" || typeof result !== "object" || result === null) continue;
        const meal = "meal" in result && typeof result.meal === "object" && result.meal !== null
          ? result.meal as Record<string, unknown>
          : null;
        const mealLogId = Number(meal?.id);
        if (Number.isSafeInteger(mealLogId) && mealLogId > 0) saveableMealLogId = mealLogId;
      }

      response = await client.responses.create({
        ...common,
        previous_response_id: response.id,
        input: toolResults.map(({ output }) => output),
      });
    }

    const answer = response.output_text.trim() || "I completed the request, but no summary was returned.";
    confirmationRequired = assistantRequestsConfirmation(answer, confirmationRequired);
    const assistantMessage = await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "assistant",
      content: answer,
      metadata: {
        prompt_version: ASSISTANT_PROMPT_VERSION,
        ...(voiceMode ? { voice_mode: true } : {}),
        ...(confirmationRequired ? { confirmation_required: true } : {}),
        ...(saveableMealLogId ? { save_to_meals_log_id: saveableMealLogId } : {}),
      },
    });

    await updateConversation(supabase, userId, conversation.id, {
      title: isUntitledConversation(conversation.title) ? titleFromMessage(displayMessage) : undefined,
      last_response_id: response.id,
    });

    const workout = await getCurrentOrNextWorkout(supabase, userId);
    return NextResponse.json({ conversationId: conversation.id, message: assistantMessage, workout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant request failed.";
    const status = message.includes("Authentication") || message.includes("session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
