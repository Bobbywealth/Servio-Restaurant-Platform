// Kitchen Assistant API Routes - Servio AI Kitchen Assistant
// Handles voice commands, cooking sessions, and recipe management

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { getEffectiveRestaurantId } from '../middleware/apiKeyAuth';
import RecipeService from '../services/RecipeService';
import KitchenAssistantService from '../services/KitchenAssistantService';

const router = Router();

// Helper to get company ID with fallback
async function getCompanyId(req: Request): Promise<number> {
  const queryCompanyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
  if (queryCompanyId) return queryCompanyId;
  const restaurantId = await getEffectiveRestaurantId(req);
  if (restaurantId) return restaurantId as unknown as number;
  throw new Error('Company ID not found');
}

// All routes require authentication
router.use(requireAuthOrApiKey({ requiredScopes: ['read:menu', 'write:menu'] }));

// Get all recipes for a restaurant
router.get('/recipes', asyncHandler(async (req: Request, res: Response) => {
  const companyId = await getCompanyId(req);
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
  
  const recipes = await RecipeService.getRecipes(companyId as number, categoryId);
  res.json({ recipes });
}));

// Search recipes
router.get('/recipes/search', asyncHandler(async (req: Request, res: Response) => {
  const companyId = await getCompanyId(req);
  const searchTerm = req.query.q as string;
  
  if (!searchTerm) {
    return res.status(400).json({ error: 'Search term required' });
  }
  
  const recipes = await RecipeService.searchRecipes(companyId as number, searchTerm);
  res.json({ recipes });
}));

// Get single recipe with all details
router.get('/recipes/:id', asyncHandler(async (req: Request, res: Response) => {
  const recipeId = parseInt(req.params.id as string);
  
  if (isNaN(recipeId)) {
    return res.status(400).json({ error: 'Invalid recipe ID' });
  }
  
  const recipe = await RecipeService.getRecipeById(recipeId);
  
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  
  res.json({ recipe });
}));

// Get recipe categories
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : await getEffectiveRestaurantId(req);
  
  const categories = await RecipeService.getCategories(companyId as number | undefined);
  res.json({ categories });
}));

// Start a cooking session
router.post('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const companyId = await getCompanyId(req);
  const { recipeId, deviceId, scaledServings } = req.body;
  
  if (!recipeId) {
    return res.status(400).json({ error: 'recipeId is required' });
  }
  
  const session = await KitchenAssistantService.startCookingSession(
    recipeId as number, 
    companyId as number, 
    deviceId, 
    scaledServings
  );
  
  // Get recipe details for response
  const recipe = await RecipeService.getRecipeById(recipeId as number);
  const response = await KitchenAssistantService.generateStartResponse(recipe!, scaledServings);
  
  res.json({ 
    session, 
    recipe,
    response 
  });
}));

// Get active cooking sessions
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const companyId = await getCompanyId(req);
  
  const sessions = await KitchenAssistantService.getActiveSessions(companyId as number);
  res.json({ sessions });
}));

// Get single session details
router.get('/sessions/:id', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = parseInt(req.params.id as string);
  
  const current = await KitchenAssistantService.getCurrentStep(sessionId);
  
  if (!current) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(current);
}));

// Process voice command
router.post('/command', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, text, recipeId, companyId } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Voice command text is required' });
  }
  
  // Parse the command
  const { command, params } = KitchenAssistantService.parseCommand(text as string);
  const effectiveCompanyId = companyId || await getEffectiveRestaurantId(req);
  
  let result: any;
  
  switch (command) {
    case 'start_recipe': {
      // Find recipe by name
      const recipes = await RecipeService.searchRecipes(effectiveCompanyId as number, params.recipeName);
      if (recipes.length === 0) {
        return res.json({
          command,
          success: false,
          response: `I couldn't find a recipe called "${params.recipeName}". Would you like me to search for recipes?`
        });
      }
      
      const recipe = await RecipeService.getRecipeById(recipes[0].id);
      const session = await KitchenAssistantService.startCookingSession(
        recipes[0].id,
        effectiveCompanyId as number,
        req.body.deviceId
      );
      
      const response = await KitchenAssistantService.generateStartResponse(recipe!);
      
      result = {
        command,
        success: true,
        response,
        data: { session, recipe }
      };
      break;
    }
    
    case 'training_mode': {
      const recipes = await RecipeService.searchRecipes(effectiveCompanyId as number, params.recipeName);
      if (recipes.length === 0) {
        return res.json({
          command,
          success: false,
          response: `I couldn't find a recipe called "${params.recipeName}".`
        });
      }
      
      const recipe = await RecipeService.getRecipeById(recipes[0].id);
      const session = await KitchenAssistantService.startCookingSession(
        recipes[0].id,
        effectiveCompanyId as number,
        req.body.deviceId
      );
      
      const firstStep = recipe!.steps![0];
      const response = `Training mode enabled for ${recipe!.dish_name}. Step 1: ${firstStep.instruction}. ${firstStep.notes || 'This step requires careful attention.'} Tell me when you're ready for the next step.`;
      
      result = {
        command,
        success: true,
        response,
        data: { session, recipe, trainingMode: true }
      };
      break;
    }
    
    case 'next_step': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'Which recipe would you like to continue? Please start a recipe first.'
        });
      }
      result = await KitchenAssistantService.nextStep(sessionId as number);
      break;
    }
    
    case 'previous_step': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'Which recipe are you working on?'
        });
      }
      result = await KitchenAssistantService.previousStep(sessionId as number);
      break;
    }
    
    case 'repeat_step': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'No active cooking session.'
        });
      }
      const current = await KitchenAssistantService.getCurrentStep(sessionId as number);
      if (!current) {
        return res.json({
          command,
          success: false,
          response: 'No active cooking session.'
        });
      }
      
      result = {
        command,
        success: true,
        response: current.step 
          ? `Step ${current.session.current_step}: ${current.step.instruction}`
          : 'Recipe completed.',
        data: { step: current.step }
      };
      break;
    }
    
    case 'show_ingredients': {
      if (!recipeId) {
        return res.json({
          command,
          success: false,
          response: 'Which recipe\'s ingredients would you like to see?'
        });
      }
      
      const recipe = await RecipeService.getRecipeById(recipeId as number);
      if (!recipe) {
        return res.json({
          command,
          success: false,
          response: 'Recipe not found.'
        });
      }
      
      const ingredientsList = recipe.ingredients!
        .map((i: any) => `${i.amount || ''} ${i.unit || ''} ${i.name}`.trim())
        .join(', ');
      
      result = {
        command,
        success: true,
        response: `Here are the ingredients for ${recipe.dish_name}: ${ingredientsList}`,
        data: { ingredients: recipe.ingredients }
      };
      break;
    }
    
    case 'scale_recipe': {
      if (!sessionId || !params.servings) {
        return res.json({
          command,
          success: false,
          response: 'Please specify the number of servings. For example: "Scale to 40 servings."'
        });
      }
      result = await KitchenAssistantService.scaleSession(sessionId as number, params.servings);
      break;
    }
    
    case 'pause_recipe': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'No active cooking session to pause.'
        });
      }
      await KitchenAssistantService.pauseSession(sessionId as number);
      result = {
        command,
        success: true,
        response: 'Cooking paused. Say "resume" to continue when ready.'
      };
      break;
    }
    
    case 'resume_recipe': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'No paused cooking session to resume.'
        });
      }
      await KitchenAssistantService.resumeSession(sessionId as number);
      result = {
        command,
        success: true,
        response: 'Cooking resumed. Continuing from where we left off.'
      };
      break;
    }
    
    case 'stop_recipe': {
      if (!sessionId) {
        return res.json({
          command,
          success: false,
          response: 'No active cooking session to stop.'
        });
      }
      await KitchenAssistantService.stopSession(sessionId as number);
      result = {
        command,
        success: true,
        response: 'Cooking session ended. Thank you for using Servio AI Kitchen Assistant!'
      };
      break;
    }
    
    case 'ingredient_lookup': {
      if (!recipeId || !params.ingredientName) {
        return res.json({
          command,
          success: false,
          response: 'Which ingredient would you like to know about? Please specify the recipe first.'
        });
      }
      
      const response = await KitchenAssistantService.getIngredientResponse(recipeId as number, params.ingredientName);
      result = {
        command,
        success: true,
        response
      };
      break;
    }
    
    default:
      result = {
        command,
        success: false,
        response: 'I didn\'t understand that. Try saying "Start [recipe name]" or "Next step".'
      };
  }
  
  res.json(result);
}));

// Get timers for a session
router.get('/sessions/:id/timers', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = parseInt(req.params.id as string);
  
  const timers = await KitchenAssistantService.getActiveTimers(sessionId);
  res.json({ timers });
}));

// Get all active timers for a company
router.get('/timers', asyncHandler(async (req: Request, res: Response) => {
  const companyId = await getCompanyId(req);
  
  const timers = await KitchenAssistantService.getAllActiveTimers(companyId as number);
  res.json({ timers });
}));

// Manual timer control
router.post('/timers', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, recipeId, stepNumber, durationSeconds } = req.body;
  
  if (!sessionId || !durationSeconds) {
    return res.status(400).json({ error: 'sessionId and durationSeconds are required' });
  }
  
  const timer = await KitchenAssistantService.startTimer(
    sessionId as number,
    recipeId,
    stepNumber,
    durationSeconds
  );
  
  res.json({ timer });
}));

export default router;
