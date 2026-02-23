import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { getEffectiveRestaurantId } from '../middleware/apiKeyAuth';

const router = Router();

/**
 * GET /api/staff
 * List all staff members for the restaurant
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = getEffectiveRestaurantId(req);

  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant ID is required' }
    });
  }

  const staff = await db.all(
    `SELECT id, name, email, role, is_active, created_at
     FROM users
     WHERE restaurant_id = ? AND is_active = TRUE
     ORDER BY name`,
    [restaurantId]
  );

  res.json({
    success: true,
    data: staff
  });
}));

export default router;
