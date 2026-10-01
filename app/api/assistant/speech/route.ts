import OpenAI from "openai";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { conversationId?: string; messageId?: string };
    if (!body.conversationId || !body.messageId) {
      return NextResponse.json({ error: "Choose an assistant reply to speak." }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("assistant_messages")
      .select("content")
      .eq("id", body.messageId)
      .eq("conversation_id", body.conversationId)
      .eq("user_id", userId)
      .eq("role", "assistant")
      .single();
    if (error || !message?.content) {
      return NextResponse.json({ error: "That assistant reply is unavailable." }, { status: 404 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let spokenText = message.content;
    if (message.content.length > 450 || message.content.includes("**")
      || /(?:^|\n)\s*(?:[-*#]|\d+\.)\s/m.test(message.content)) {
      try {
        const spoken = await client.responses.create({
          model: process.env.OPENAI_VOICE_REPLY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
          instructions: "Turn the assistant's written answer into a brief spoken reply. Speak directly to the user as the assistant, like a thoughtful colleague in a live conversation. Lead with the answer. Use two or three short sentences, generally under 75 words. Preserve the important outcome, any action actually taken, pending status, uncertainty, and essential numbers. Do not add facts or promises. Do not read headings, bullets, citations, or a full report aloud. If the answer needs more detail, say that the details are on screen. Do not say 'the written response says'.",
          input: message.content.slice(0, 12000),
          reasoning: { effort: "low" },
          text: { verbosity: "low" },
          max_output_tokens: 400,
          store: false,
        }, { signal: request.signal });
        spokenText = spoken.output_text.trim() || message.content;
      } catch {
        // Keep speech available if the optional short-form rewrite fails.
      }
    }
    spokenText = spokenText.length > 3800
      ? `${spokenText.slice(0, 3750)}. The rest of the response is on screen.`
      : spokenText;
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      instructions: "Speak naturally, like a calm and attentive conversation. Use a warm tone and an unhurried pace. Do not sound like a formal report.",
      input: spokenText,
      response_format: "mp3",
    }, { signal: request.signal });
    return new NextResponse(new Uint8Array(await speech.arrayBuffer()), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Authentication required." || message === "Your session is no longer valid.") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to speak this reply." }, { status: 500 });
  }
}
