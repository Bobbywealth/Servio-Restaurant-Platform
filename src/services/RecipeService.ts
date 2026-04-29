// Recipe Service - Servio AI Kitchen Assistant
// Manages recipes, ingredients, steps, and scaling

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  created_at: Date;
  updated_at: Date;
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

export interface RecipeWithDetails extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface CookingSession {
  id: number;
  recipe_id: number;
  company_id: number | null;
  device_id: string | null;
  current_step: number;
  status: string;
  scaled_servings: number | null;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
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
  started_at: Date;
  completed_at: Date | null;
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

export interface RecipeWithDetails extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface CookingSession {
  id: number;
  recipe_id: number;
  company_id: number | null;
  device_id: string | null;
  current_step: number;
  status: string;
  scaled_servings: number | null;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
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
  started_at: Date;
  completed_at: Date | null;
}

class RecipeService {
  // Get all recipes for a company
  async getRecipes(companyId: number, categoryId?: number): Promise<Recipe[]> {
    let query = `
      SELECT * FROM recipes 
      WHERE company_id = $1 AND is_active = true
    `;
    const params: any[] = [companyId];
    
    if (categoryId) {
      query += ` AND category_id = $2`;
      params.push(categoryId);
    }
    
    query += ` ORDER BY dish_name ASC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get recipe by ID with all details in company scope
  async getRecipeByIdForCompany(recipeId: number, companyId: number): Promise<RecipeWithDetails | null> {
    const recipeQuery = `
      SELECT * FROM recipes
      WHERE id = $1 AND company_id = $2 AND is_active = true
    `;
    const recipeResult = await pool.query(recipeQuery, [recipeId, companyId]);
    
    if (recipeResult.rows.length === 0) {
      return null;
    }
    
    const recipe = recipeResult.rows[0];
    
    // Get ingredients
    const ingredientsQuery = `
      SELECT * FROM recipe_ingredients 
      WHERE recipe_id = $1 
      ORDER BY order_index ASC
    `;
    const ingredientsResult = await pool.query(ingredientsQuery, [recipeId]);
    
    // Get steps
    const stepsQuery = `
      SELECT * FROM recipe_steps 
      WHERE recipe_id = $1 
      ORDER BY step_number ASC
    `;
    const stepsResult = await pool.query(stepsQuery, [recipeId]);
    
    return {
      ...recipe,
      ingredients: ingredientsResult.rows,
      steps: stepsResult.rows
    };
  }

  // Backward-compatible recipe lookup (prefer getRecipeByIdForCompany for tenant-safe access)
  async getRecipeById(recipeId: number, companyId?: number): Promise<RecipeWithDetails | null> {
    if (companyId !== undefined) {
      return this.getRecipeByIdForCompany(recipeId, companyId);
    }

    const recipeQuery = `
      SELECT * FROM recipes
      WHERE id = $1 AND is_active = true
    `;
    const recipeResult = await pool.query(recipeQuery, [recipeId]);

    if (recipeResult.rows.length === 0) {
      return null;
    }

    const recipe = recipeResult.rows[0];
    const ingredientsResult = await pool.query(
      `SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY order_index ASC`,
      [recipeId]
    );
    const stepsResult = await pool.query(
      `SELECT * FROM recipe_steps WHERE recipe_id = $1 ORDER BY step_number ASC`,
      [recipeId]
    );

    return {
      ...recipe,
      ingredients: ingredientsResult.rows,
      steps: stepsResult.rows
    };
  }

  // Search recipes by name
  async searchRecipes(companyId: number, searchTerm: string): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes 
      WHERE company_id = $1 AND is_active = true 
      AND (dish_name ILIKE $2 OR description ILIKE $2 OR cuisine_type ILIKE $2)
      ORDER BY dish_name ASC
      LIMIT 20
    `;
    const result = await pool.query(query, [companyId, `%${searchTerm}%`]);
    return result.rows;
  }

  // Scale recipe ingredients based on new serving size
  scaleIngredients(ingredients: RecipeIngredient[], originalServings: number, newServings: number): RecipeIngredient[] {
    const scaleFactor = newServings / originalServings;
    
    return ingredients.map(ingredient => ({
      ...ingredient,
      amount: ingredient.amount ? Number((ingredient.amount * scaleFactor).toFixed(2)) : null
    }));
  }

  // Create a new recipe
  async createRecipe(recipe: Partial<Recipe>, ingredients: Partial<RecipeIngredient>[], steps: Partial<RecipeStep>[]): Promise<number> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert recipe
      const recipeQuery = `
        INSERT INTO recipes (dish_name, description, category_id, company_id, batch_size, 
          prep_time_minutes, cook_time_minutes, servings, difficulty, cuisine_type, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      
      const recipeResult = await client.query(recipeQuery, [
        recipe.dish_name,
        recipe.description || null,
        recipe.category_id || null,
        recipe.company_id || null,
        recipe.batch_size || 1,
        recipe.prep_time_minutes || null,
        recipe.cook_time_minutes || null,
        recipe.servings || 1,
        recipe.difficulty || 'medium',
        recipe.cuisine_type || null,
        recipe.image_url || null
      ]);
      
      const recipeId = recipeResult.rows[0].id;
      
      // Insert ingredients
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, notes, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [recipeId, ing.name, ing.amount || null, ing.unit || null, ing.notes || null, i]
        );
      }
      
      // Insert steps
      for (const step of steps) {
        await client.query(
          `INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds, halfway_reminder, temperature, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [recipeId, step.step_number, step.instruction, step.timer_seconds || null, 
           step.halfway_reminder || false, step.temperature || null, step.notes || null]
        );
      }
      
      await client.query('COMMIT');
      return recipeId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update an existing recipe
  async updateRecipe(
    recipeId: number,
    companyId: number,
    recipe: Partial<Recipe>,
    ingredients?: Partial<RecipeIngredient>[],
    steps?: Partial<RecipeStep>[]
  ): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update recipe
      const updateQuery = `
        UPDATE recipes SET 
          dish_name = COALESCE($1, dish_name),
          description = COALESCE($2, description),
          category_id = COALESCE($3, category_id),
          batch_size = COALESCE($4, batch_size),
          prep_time_minutes = COALESCE($5, prep_time_minutes),
          cook_time_minutes = COALESCE($6, cook_time_minutes),
          servings = COALESCE($7, servings),
          difficulty = COALESCE($8, difficulty),
          cuisine_type = COALESCE($9, cuisine_type),
          image_url = COALESCE($10, image_url),
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND company_id = $12 AND is_active = true
      `;
      
      const updateResult = await client.query(updateQuery, [
        recipe.dish_name,
        recipe.description,
        recipe.category_id,
        recipe.batch_size,
        recipe.prep_time_minutes,
        recipe.cook_time_minutes,
        recipe.servings,
        recipe.difficulty,
        recipe.cuisine_type,
        recipe.image_url,
        recipeId,
        companyId
      ]);

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      // Update ingredients if provided
      if (ingredients) {
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          await client.query(
            `INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, notes, order_index)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [recipeId, ing.name, ing.amount || null, ing.unit || null, ing.notes || null, i]
          );
        }
      }
      
      // Update steps if provided
      if (steps) {
        await client.query('DELETE FROM recipe_steps WHERE recipe_id = $1', [recipeId]);
        for (const step of steps) {
          await client.query(
            `INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds, halfway_reminder, temperature, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [recipeId, step.step_number, step.instruction, step.timer_seconds || null, 
             step.halfway_reminder || false, step.temperature || null, step.notes || null]
          );
        }
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete (deactivate) a recipe
  async deleteRecipe(recipeId: number, companyId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE recipes
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [recipeId, companyId]
    );

    return result.rowCount > 0;
  }

  // Get recipe categories
  async getCategories(companyId?: number): Promise<any[]> {
    let query = `SELECT * FROM recipe_categories`;
    const params: any[] = [];
    
    if (companyId) {
      query += ` WHERE company_id = $1 OR is_default = true ORDER BY is_default DESC, name ASC`;
      params.push(companyId);
    } else {
      query += ` WHERE is_default = true ORDER BY name ASC`;
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get ingredient amount for a specific recipe (for ingredient lookup)
  async getIngredientAmount(recipeId: number, ingredientName: string): Promise<RecipeIngredient | null> {
    const query = `
      SELECT * FROM recipe_ingredients 
      WHERE recipe_id = $1 AND LOWER(name) LIKE LOWER($2)
      LIMIT 1
    `;
    const result = await pool.query(query, [recipeId, `%${ingredientName}%`]);
    return result.rows[0] || null;
  }

  // Find recipe by ingredient
  async findRecipesByIngredient(companyId: number, ingredientName: string): Promise<Recipe[]> {
    const query = `
      SELECT DISTINCT r.* FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      WHERE r.company_id = $1 AND r.is_active = true 
      AND LOWER(ri.name) LIKE LOWER($2)
      ORDER BY r.dish_name ASC
      LIMIT 10
    `;
    const result = await pool.query(query, [companyId, `%${ingredientName}%`]);
    return result.rows;
  }
}

export default new RecipeService();
