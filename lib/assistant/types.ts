export type AssistantDomain =
  | "general"
  | "strength"
  | "running"
  | "nutrition"
  | "finance"
  | "relationships"
  | "planning";

export type AssistantConversation = {
  id: string;
  title: string;
  domain: AssistantDomain;
  updated_at: string;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type ActivityType = "run" | "bike" | "walk" | "swim" | "strength" | "other";

export type ActivityDraft = {
  id: string;
  activity_type: ActivityType;
  activity_date: string;
  duration_minutes: number;
  calories_burned: number;
  distance_miles: number | null;
  average_heart_rate: number | null;
  cadence: number | null;
  pace_min_per_mile: number | null;
  notes: string | null;
};

export type StrengthSet = {
  id: string;
  set_number: number;
  weight_lbs: number;
  reps: number;
  rir: number | null;
  completed_at: string;
};

export type StrengthTrainingRole =
  | "standard"
  | "heavy"
  | "volume"
  | "light"
  | "technique"
  | "accessory"
  | "bodyweight";

export type StrengthExercise = {
  id: string;
  exercise_name: string;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight_lbs: number | null;
  training_role: StrengthTrainingRole;
  rest_seconds: number;
  notes: string | null;
  sets: StrengthSet[];
};

export type StrengthWorkout = {
  id: string;
  name: string;
  scheduled_for: string;
  estimated_minutes: number;
  notes: string | null;
  status: "scheduled" | "in_progress" | "completed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  warmups: string[];
  exercises: StrengthExercise[];
};

export type SavedMeal = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type AssistantBootstrap = {
  user: { id: string; email: string | null };
  conversations: AssistantConversation[];
  messages: AssistantMessage[];
  selectedConversationId: string | null;
  workout: StrengthWorkout;
  savedMeals: SavedMeal[];
};

export type AssistantChatResponse = {
  conversationId: string;
  message: AssistantMessage;
  workout: StrengthWorkout;
};

export type AssistantThreadDomain = Extract<AssistantDomain, "strength" | "running" | "nutrition">;

export type AssistantConversationCreateResponse = {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
  created: boolean;
};
