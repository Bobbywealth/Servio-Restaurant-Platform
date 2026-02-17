import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';

const router = express.Router();

router.get('/pricing-structures', async (_req, res) => {
  try {
    const db = await DatabaseService.getInstance().getDatabase();
    const plans = await db.all(
      `SELECT id, name, slug, description, price_monthly, price_yearly, is_featured, is_active, features, display_order
       FROM pricing_structures
       WHERE is_active = TRUE
       ORDER BY display_order ASC, price_monthly ASC`
    );

    res.json({
      plans: plans.map((plan: any) => ({
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features || '[]') : plan.features
      }))
    });
  } catch (error) {
    logger.error('Failed to load public pricing structures:', error);
    res.status(500).json({ error: 'Failed to load pricing structures' });
  }
});

export default router;
