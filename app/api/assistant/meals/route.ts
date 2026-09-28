import { NextResponse } from "next/server";
import { getConversation, logSavedMeal } from "@/lib/assistant/repository";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mealTypes = new Set(["breakfast", "lunch", "dinner", "snack"]);

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as {
      conversationId?: unknown;
      savedMealId?: unknown;
      mealType?: unknown;
      servings?: unknown;
    };
    const savedMealId = String(body.savedMealId ?? "").trim();
    const conversationId = String(body.conversationId ?? "").trim();
    const mealType = String(body.mealType ?? "").trim().toLowerCase();
    const servings = Number(body.servings);

    if (!conversationId) {
      return NextResponse.json({ error: "Open the Nutrition chat before logging a meal." }, { status: 400 });
    }
    const conversation = await getConversation(supabase, userId, conversationId);
    if (conversation.domain !== "nutrition") {
      return NextResponse.json({ error: "Meals can only be logged from the Nutrition chat." }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedMealId)) {
      return NextResponse.json({ error: "Choose a valid saved meal." }, { status: 400 });
    }
    if (!mealTypes.has(mealType)) {
      return NextResponse.json({ error: "Choose breakfast, lunch, dinner, or snack." }, { status: 400 });
    }
    if (!Number.isFinite(servings) || servings <= 0 || servings > 20) {
      return NextResponse.json({ error: "Servings must be between 0.01 and 20." }, { status: 400 });
    }

    const result = await logSavedMeal(supabase, userId, {
      saved_meal_id: savedMealId,
      meal_type: mealType as "breakfast" | "lunch" | "dinner" | "snack",
      servings,
      confirm: true,
    });
    return NextResponse.json({ logged: result.meal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log the saved meal.";
    const status = message.includes("Authentication") || message.includes("session")
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("Servings") || message.includes("Add calories") || message.includes("Choose breakfast")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
