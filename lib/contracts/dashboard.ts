export type TodayNutritionHomeRow = {
  user_id: string | null;
  meal_date: string | null;
  calories: number | null;
  protein_g: number | null;
  calorie_goal: number | null;
  protein_goal_g: number | null;
  calories_remaining: number | null;
  protein_remaining: number | null;
};


export type CashflowProjection7dRow = {
  current_balance: number | null;
  projected_balance_7d: number | null;
};
