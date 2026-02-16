export type AiMealItem = {
  name: string;
  quantity_text: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number; // 0..1
};

export type AiMealTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  soluble_fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
};

export type AiMealProposal = {
  description: string;
  items: AiMealItem[];
  totals: AiMealTotals;
  assumptions: string[];
  confidence: number; // 0..1
  needs_clarification: boolean;
};
