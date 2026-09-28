import { NextResponse } from "next/server";
import type { SavedMeal } from "@/lib/assistant/types";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import { getConversation } from "@/lib/assistant/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { messageId?: unknown };
    const messageId = String(body.messageId ?? "").trim();
    if (!messageId) {
      return NextResponse.json({ error: "The meal message is missing." }, { status: 400 });
    }

    const { data: message, error: messageError } = await supabase
      .from("assistant_messages")
      .select("id,conversation_id,metadata")
      .eq("id", messageId)
      .eq("user_id", userId)
      .eq("role", "assistant")
      .maybeSingle();
    if (messageError) throw new Error(`load meal message: ${messageError.message}`);
    if (!message) {
      return NextResponse.json({ error: "That meal message was not found." }, { status: 404 });
    }
    const conversation = await getConversation(supabase, userId, message.conversation_id);
    if (conversation.domain !== "nutrition") {
      return NextResponse.json({ error: "Meals can only be saved from the Nutrition chat." }, { status: 400 });
    }

    const metadata = (message.metadata ?? {}) as Record<string, unknown>;
    const mealLogId = Number(metadata.save_to_meals_log_id);
    if (!Number.isSafeInteger(mealLogId) || mealLogId <= 0) {
      return NextResponse.json({ error: "That message does not contain a meal to save." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("save_meal_log_as_saved", {
      p_user_id: userId,
      p_meal_log_id: mealLogId,
    });
    if (error) throw new Error(`save meal: ${error.message}`);
    if (!data || typeof data !== "object" || !("meal" in data)) {
      throw new Error("save meal: invalid database response");
    }

    const result = data as { meal: Record<string, unknown>; already_saved?: boolean };
    const saved: { meal: SavedMeal; already_saved?: boolean } = {
      already_saved: result.already_saved,
      meal: {
        id: String(result.meal.id),
        name: String(result.meal.name),
        description: result.meal.description == null ? null : String(result.meal.description),
        calories: result.meal.calories == null ? null : Number(result.meal.calories),
        protein_g: result.meal.protein_g == null ? null : Number(result.meal.protein_g),
        carbs_g: result.meal.carbs_g == null ? null : Number(result.meal.carbs_g),
        fat_g: result.meal.fat_g == null ? null : Number(result.meal.fat_g),
      },
    };
    const nextMetadata = {
      ...metadata,
      saved_meal_id: saved.meal.id,
      saved_to_meals: true,
    };
    const { error: updateError } = await supabase
      .from("assistant_messages")
      .update({ metadata: nextMetadata })
      .eq("id", messageId)
      .eq("user_id", userId);
    if (updateError) throw new Error(`update meal message: ${updateError.message}`);

    return NextResponse.json({ meal: saved.meal, alreadySaved: saved.already_saved === true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the meal.";
    const status = message.includes("Authentication") || message.includes("session")
      ? 401
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
