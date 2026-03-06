// Kitchen Assistant Service - Servio AI Kitchen Assistant
// Handles voice AI interactions, cooking sessions, and timer management

import { Pool } from 'pg';
import RecipeService, { RecipeWithDetails, CookingSession, RecipeIngredient, CookingTimer } from './RecipeService';
import { SocketService } from './SocketService';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Voice command types
export type VoiceCommand = 
  | 'start_recipe'
  | 'next_step'
  | 'previous_step'
  | 'repeat_step'
  | 'show_ingredients'
  | 'scale_recipe'
  | 'pause_recipe'
  | 'resume_recipe'
  | 'stop_recipe'
  | 'start_timer'
  | 'check_timer'
  | 'ingredient_lookup'
  | 'training_mode';

export interface VoiceCommandResult {
  command: VoiceCommand;
  success: boolean;
  response: string;
  data?: any;
}

export interface ActiveCookingSession {
  session: CookingSession;
  recipe: RecipeWithDetails;
  currentStepInstruction: string;
  timerRemaining?: number;
}

export interface KitchenState {
  activeSessions: ActiveCookingSession[];
  timers: CookingTimer[];
}

class KitchenAssistantService {
  // Parse voice command from natural language
  parseCommand(text: string): { command: VoiceCommand; params: any } {
    const lowerText = text.toLowerCase().trim();
    
    // Start recipe patterns
    if (lowerText.match(/^(start|begin|open|load)\s+(.*recipe)/) || 
        lowerText.match(/^(start|begin)\s+(the\s+)?(.*)/)) {
      const recipeMatch = lowerText.match(/(?:start|begin|open|load)\s+(?:the\s+)?(.+?)(?:\s+recipe)?$/i);
      const recipeName = recipeMatch ? recipeMatch[1].replace(/recipe$/i, '').trim() : '';
      
      // Check for training mode
      if (lowerText.includes('training')) {
        return { command: 'training_mode', params: { recipeName, training: true } };
      }
      
      return { command: 'start_recipe', params: { recipeName } };
    }
    
    // Next step patterns
    if (lowerText.match(/^(next|next step|continue|proceed)/)) {
      return { command: 'next_step', params: {} };
    }
    
    // Previous step patterns
    if (lowerText.match(/^(previous|last|go back)/)) {
      return { command: 'previous_step', params: {} };
    }
    
    // Repeat step patterns
    if (lowerText.match(/^(repeat|say again|what was that|once more)/)) {
      return { command: 'repeat_step', params: {} };
    }
    
    // Show ingredients patterns
    if (lowerText.match(/^(show|what|list)\s+(ingredients?|what.?s in)/)) {
      return { command: 'show_ingredients', params: {} };
    }
    
    // Scale recipe patterns
    if (lowerText.match(/^(scale|adjust|change).*(servings?|portion)/) ||
        lowerText.match(/^(servings?|portion).*(scale|adjust|change)/)) {
      const scaleMatch = lowerText.match(/(\d+)\s*(servings?|portions?)/);
      const servings = scaleMatch ? parseInt(scaleMatch[1]) : null;
      return { command: 'scale_recipe', params: { servings } };
    }
    
    // Pause recipe patterns
    if (lowerText.match(/^(pause|hold|wait)/)) {
      return { command: 'pause_recipe', params: {} };
    }
    
    // Resume recipe patterns
    if (lowerText.match(/^(resume|continue|keep going)/)) {
      return { command: 'resume_recipe', params: {} };
    }
    
    // Stop recipe patterns
    if (lowerText.match(/^(stop|cancel|end|finish|done)/)) {
      return { command: 'stop_recipe', params: {} };
    }
    
    // Ingredient lookup patterns
    if (lowerText.match(/^(how much|how many|what amount|amount of)\s+(.+?)\s+(goes in|is in|for)/)) {
      const ingredientMatch = lowerText.match(/(?:how much|how many|what amount|amount of)\s+(.+?)\s+(?:goes in|is in|for)/);
      return { command: 'ingredient_lookup', params: { ingredientName: ingredientMatch ? ingredientMatch[1].trim() : '' } };
    }
    
    // Default - try to interpret as ingredient lookup
    if (lowerText.includes('?')) {
      return { command: 'ingredient_lookup', params: { ingredientName: lowerText.replace(/\?/g, '').trim() } };
    }
    
    return { command: 'start_recipe', params: { recipeName: lowerText } };
  }

  // Start a new cooking session
  async startCookingSession(recipeId: number, companyId: number, deviceId?: string, scaledServings?: number): Promise<CookingSession> {
    const recipe = await RecipeService.getRecipeById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const servings = scaledServings || recipe.servings;
    
    const query = `
      INSERT INTO cooking_sessions (recipe_id, company_id, device_id, current_step, status, scaled_servings)
      VALUES ($1, $2, $3, 1, 'active', $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [recipeId, companyId, deviceId || null, servings]);
    
    // If there's a timer for step 1, start it
    if (recipe.steps[0]?.timer_seconds) {
      await this.startTimer(result.rows[0].id, recipeId, 1, recipe.steps[0].timer_seconds);
    }
    
    return result.rows[0];
  }

  // Get current step details
  async getCurrentStep(sessionId: number): Promise<{ step: any; recipe: RecipeWithDetails; session: CookingSession } | null> {
    const sessionQuery = `SELECT * FROM cooking_sessions WHERE id = $1`;
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return null;
    }
    
    const session = sessionResult.rows[0];
    const recipe = await RecipeService.getRecipeById(session.recipe_id);
    
    if (!recipe) {
      return null;
    }
    
    const step = recipe.steps.find(s => s.step_number === session.current_step);
    
    return { step, recipe, session };
  }

  // Move to next step
  async nextStep(sessionId: number): Promise<VoiceCommandResult> {
    const current = await this.getCurrentStep(sessionId);
    
    if (!current) {
      return { command: 'next_step', success: false, response: 'No active cooking session found.' };
    }
    
    if (!current.step) {
      // Recipe completed
      await this.completeSession(sessionId);
      return { command: 'next_step', success: true, response: 'Congratulations! You have completed the recipe. Great job!' };
    }
    
    const nextStepNumber = current.session.current_step + 1;
    const nextStep = current.recipe.steps.find(s => s.step_number === nextStepNumber);
    
    // Update session
    await pool.query(
      `UPDATE cooking_sessions SET current_step = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [nextStepNumber, sessionId]
    );
    
    // Start timer for new step if exists
    if (nextStep?.timer_seconds) {
      await this.startTimer(sessionId, current.recipe.id, nextStepNumber, nextStep.timer_seconds);
    }
    
    const response = nextStep 
      ? `Step ${nextStepNumber}: ${nextStep.instruction}${nextStep.timer_seconds ? `. This step takes ${Math.floor(nextStep.timer_seconds / 60)} minutes.` : ''}`
      : 'Congratulations! You have completed all steps of the recipe.';
    
    return { command: 'next_step', success: true, response, data: { stepNumber: nextStepNumber, step: nextStep } };
  }

  // Go to previous step
  async previousStep(sessionId: number): Promise<VoiceCommandResult> {
    const current = await this.getCurrentStep(sessionId);
    
    if (!current) {
      return { command: 'previous_step', success: false, response: 'No active cooking session found.' };
    }
    
    if (current.session.current_step <= 1) {
      return { command: 'previous_step', success: true, response: 'You are already at the first step.' };
    }
    
    const prevStepNumber = current.session.current_step - 1;
    const prevStep = current.recipe.steps.find(s => s.step_number === prevStepNumber);
    
    if (!prevStep) {
      return { command: 'previous_step', success: false, response: 'Previous step not found.' };
    }
    
    await pool.query(
      `UPDATE cooking_sessions SET current_step = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [prevStepNumber, sessionId]
    );
    
    // Cancel any running timer for current step
    await this.cancelTimersForStep(sessionId, current.session.current_step);
    
    // Start timer for previous step if exists
    if (prevStep?.timer_seconds) {
      await this.startTimer(sessionId, current.recipe.id, prevStepNumber, prevStep.timer_seconds);
    }
    
    return { 
      command: 'previous_step', 
      success: true, 
      response: `Step ${prevStepNumber}: ${prevStep.instruction}`,
      data: { stepNumber: prevStepNumber, step: prevStep }
    };
  }

  // Pause a cooking session
  async pauseSession(sessionId: number): Promise<void> {
    await pool.query(
      `UPDATE cooking_sessions SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sessionId]
    );
    
    // Pause all timers for this session
    await pool.query(
      `UPDATE cooking_timers SET status = 'paused' WHERE session_id = $1 AND status = 'running'`,
      [sessionId]
    );
  }

  // Resume a cooking session
  async resumeSession(sessionId: number): Promise<void> {
    await pool.query(
      `UPDATE cooking_sessions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sessionId]
    );
    
    // Resume all timers
    await pool.query(
      `UPDATE cooking_timers SET status = 'running' WHERE session_id = $1 AND status = 'paused'`,
      [sessionId]
    );
  }

  // Stop (complete) a cooking session
  async stopSession(sessionId: number): Promise<void> {
    await this.completeSession(sessionId);
  }

  // Complete session helper
  async completeSession(sessionId: number): Promise<void> {
    await pool.query(
      `UPDATE cooking_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sessionId]
    );
    
    // Complete all timers
    await pool.query(
      `UPDATE cooking_timers SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE session_id = $1`,
      [sessionId]
    );
  }

  // Scale a recipe in an active session
  async scaleSession(sessionId: number, newServings: number): Promise<VoiceCommandResult> {
    const current = await this.getCurrentStep(sessionId);
    
    if (!current) {
      return { command: 'scale_recipe', success: false, response: 'No active cooking session found.' };
    }
    
    await pool.query(
      `UPDATE cooking_sessions SET scaled_servings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newServings, sessionId]
    );
    
    // Log the scaling
    await pool.query(
      `INSERT INTO recipe_scaling_log (recipe_id, company_id, original_servings, new_servings)
       VALUES ($1, $2, $3, $4)`,
      [current.recipe.id, current.session.company_id, current.recipe.servings, newServings]
    );
    
    return { 
      command: 'scale_recipe', 
      success: true, 
      response: `Recipe scaled to ${newServings} servings. All ingredient quantities have been adjusted.`,
      data: { newServings }
    };
  }

  // Timer management
  async startTimer(sessionId: number, recipeId: number, stepNumber: number, durationSeconds: number): Promise<CookingTimer> {
    // Cancel any existing timer for this step
    await pool.query(
      `UPDATE cooking_timers SET status = 'cancelled' WHERE session_id = $1 AND step_number = $2 AND status = 'running'`,
      [sessionId, stepNumber]
    );
    
    const query = `
      INSERT INTO cooking_timers (session_id, recipe_id, step_number, duration_seconds, remaining_seconds, status)
      VALUES ($1, $2, $3, $4, $4, 'running')
      RETURNING *
    `;
    
    const result = await pool.query(query, [sessionId, recipeId, stepNumber, durationSeconds]);
    return result.rows[0];
  }

  // Update timer (called by worker/process)
  async tickTimers(): Promise<CookingTimer[]> {
    // Get all running timers
    const runningTimers = await pool.query(
      `SELECT * FROM cooking_timers WHERE status = 'running'`
    );
    
    const completedTimers: CookingTimer[] = [];
    
    for (const timer of runningTimers.rows) {
      const newRemaining = timer.remaining_seconds - 1;
      
      if (newRemaining <= 0) {
        // Timer completed
        await pool.query(
          `UPDATE cooking_timers SET status = 'completed', remaining_seconds = 0, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [timer.id]
        );
        completedTimers.push({ ...timer, remaining_seconds: 0, status: 'completed' });
      } else {
        // Check for halfway point
        const halfwayPoint = Math.floor(timer.duration_seconds / 2);
        const halfwayCompleted = newRemaining <= halfwayPoint && !timer.halfway_completed;
        
        await pool.query(
          `UPDATE cooking_timers SET remaining_seconds = $1, halfway_completed = $2 WHERE id = $3`,
          [newRemaining, halfwayCompleted, timer.id]
        );
        
        if (halfwayCompleted) {
          // Emit halfway reminder event
          this.emitTimerEvent('halfway', timer);
        }
      }
    }
    
    return completedTimers;
  }

  // Get all active timers for a session
  async getActiveTimers(sessionId: number): Promise<CookingTimer[]> {
    const result = await pool.query(
      `SELECT * FROM cooking_timers WHERE session_id = $1 AND status IN ('running', 'paused') ORDER BY remaining_seconds ASC`,
      [sessionId]
    );
    return result.rows;
  }

  // Get all active timers for a company (for multi-dish management)
  async getAllActiveTimers(companyId: number): Promise<CookingTimer[]> {
    const result = await pool.query(
      `SELECT ct.* FROM cooking_timers ct
       JOIN cooking_sessions cs ON ct.session_id = cs.id
       WHERE cs.company_id = $1 AND ct.status = 'running'
       ORDER BY ct.remaining_seconds ASC`,
      [companyId]
    );
    return result.rows;
  }

  // Cancel timers for a specific step
  async cancelTimersForStep(sessionId: number, stepNumber: number): Promise<void> {
    await pool.query(
      `UPDATE cooking_timers SET status = 'cancelled' WHERE session_id = $1 AND step_number = $2 AND status = 'running'`,
      [sessionId, stepNumber]
    );
  }

  // Get all active sessions for a company
  async getActiveSessions(companyId: number): Promise<ActiveCookingSession[]> {
    const sessionsQuery = `
      SELECT cs.*, r.dish_name as recipe_name 
      FROM cooking_sessions cs
      JOIN recipes r ON cs.recipe_id = r.id
      WHERE cs.company_id = $1 AND cs.status = 'active'
      ORDER BY cs.started_at ASC
    `;
    const sessionsResult = await pool.query(sessionsQuery, [companyId]);
    
    const activeSessions: ActiveCookingSession[] = [];
    
    for (const session of sessionsResult.rows) {
      const recipe = await RecipeService.getRecipeById(session.recipe_id);
      if (recipe) {
        const step = recipe.steps.find(s => s.step_number === session.current_step);
        const timers = await this.getActiveTimers(session.id);
        
        activeSessions.push({
          session,
          recipe,
          currentStepInstruction: step?.instruction || 'Completed',
          timerRemaining: timers[0]?.remaining_seconds
        });
      }
    }
    
    return activeSessions;
  }

  // Generate response for starting a recipe
  async generateStartResponse(recipe: RecipeWithDetails, scaledServings?: number): Promise<string> {
    const servings = scaledServings || recipe.servings;
    const scaleFactor = servings / recipe.servings;
    
    const firstStep = recipe.steps[0];
    
    let response = `Starting ${recipe.dish_name}.`;
    response += ` Batch size: ${servings} servings.`;
    
    if (scaledServings && scaledServings !== recipe.servings) {
      response += ` Scaled from ${recipe.servings} servings.`;
    }
    
    response += ` Step 1: ${firstStep.instruction}`;
    
    if (firstStep.timer_seconds) {
      response += `. This step takes ${Math.floor(firstStep.timer_seconds / 60)} minutes.`;
    }
    
    response += '. Tell me when you\'re ready for the next step.';
    
    return response;
  }

  // Get ingredient lookup response
  async getIngredientResponse(recipeId: number, ingredientName: string): Promise<string> {
    const ingredient = await RecipeService.getIngredientAmount(recipeId, ingredientName);
    
    if (!ingredient) {
      return `I couldn't find ${ingredientName} in this recipe.`;
    }
    
    const amount = ingredient.amount ? `${ingredient.amount} ${ingredient.unit || ''}` : 'See recipe for details';
    return `For ${ingredientName}, you need ${amount}.`;
  }

  // Format time for display/speech
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Emit timer events (for real-time updates)
  emitTimerEvent(type: string, timer: CookingTimer): void {
    // Get company ID for the session
    pool.query(
      `SELECT cs.company_id, r.dish_name FROM cooking_sessions cs 
       JOIN recipes r ON cs.recipe_id = r.id 
       WHERE cs.id = $1`,
      [timer.session_id]
    ).then(result => {
      if (result.rows.length > 0) {
        const { company_id, dish_name } = result.rows[0];
        
        const event = {
          sessionId: timer.session_id,
          recipeId: timer.recipe_id,
          recipeName: dish_name,
          stepNumber: timer.step_number,
          remainingSeconds: timer.remaining_seconds,
          status: type === 'halfway' ? 'halfway' as const : (type === 'complete' ? 'completed' as const : 'running' as const)
        };
        
        if (type === 'halfway') {
          SocketService.emitTimerHalfway(company_id, event);
        } else if (type === 'complete') {
          SocketService.emitTimerComplete(company_id, event);
        } else {
          SocketService.emitTimerUpdate(company_id, event);
        }
      }
    }).catch(err => {
      console.error('Failed to emit timer event:', err);
    });
  }
}

export default new KitchenAssistantService();
