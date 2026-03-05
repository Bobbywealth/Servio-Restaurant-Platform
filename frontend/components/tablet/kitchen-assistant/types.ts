// Kitchen Assistant Types

export interface Recipe {
  id: number;
  dish_name: string;
  description: string | null;
  category_id: number | null;
  company_id: number | null;
  batch_size: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  difficulty: string;
  cuisine_type: string | null;
  image_url: string | null;
  is_active: boolean;
  version: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  order_index: number;
}

export interface RecipeStep {
  id: number;
  recipe_id: number;
  step_number: number;
  instruction: string;
  timer_seconds: number | null;
  halfway_reminder: boolean;
  temperature: string | null;
  notes: string | null;
}

export interface CookingSession {
  id: number;
  recipe_id: number;
  company_id: number | null;
  device_id: string | null;
  current_step: number;
  status: string;
  scaled_servings: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface KitchenSession {
  session: CookingSession;
  recipe: Recipe;
  currentStepInstruction: string;
  timerRemaining?: number;
}

export interface CookingTimer {
  id: number;
  session_id: number;
  recipe_id: number;
  step_number: number;
  duration_seconds: number;
  remaining_seconds: number;
  status: string;
  halfway_completed: boolean;
  started_at: string;
  completed_at: string | null;
}

export interface VoiceCommandResult {
  command: string;
  success: boolean;
  response: string;
  data?: {
    session?: CookingSession;
    recipe?: Recipe;
    stepNumber?: number;
    step?: RecipeStep;
    ingredients?: RecipeIngredient[];
    newServings?: number;
    trainingMode?: boolean;
  };
}

export interface RecipeCategory {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
