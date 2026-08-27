export type AssistantDomain =
  | "general"
  | "strength"
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
  status: "scheduled" | "in_progress" | "completed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  warmups: string[];
  exercises: StrengthExercise[];
};

export type AssistantBootstrap = {
  user: { id: string; email: string | null };
  conversations: AssistantConversation[];
  messages: AssistantMessage[];
  selectedConversationId: string | null;
  workout: StrengthWorkout;
};

export type AssistantChatResponse = {
  conversationId: string;
  message: AssistantMessage;
  workout: StrengthWorkout;
};
