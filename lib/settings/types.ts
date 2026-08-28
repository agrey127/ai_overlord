export type ProfileSettings = {
  full_name: string;
  timezone: string;
  bmr_calories: number | null;
  tdee_calories: number | null;
  calorie_deficit_goal: number | null;
  protein_goal_g: number | null;
  fiber_goal_g: number | null;
  sodium_goal_mg: number | null;
  weekly_run_goal: number;
  weekly_strength_goal: number;
  weekly_mileage_goal: number | null;
  target_weight_lbs: number | null;
  weight_goal_mode: "cut" | "maintain" | "bulk";
  target_rate_lbs_per_week: number | null;
};

export type RunningRace = {
  id: string;
  race_name: string;
  race_date: string;
  distance_miles: number;
  location: string | null;
  goal_time_minutes: number | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

export type SettingsResponse = {
  email: string | null;
  profile: ProfileSettings;
  races: RunningRace[];
};
