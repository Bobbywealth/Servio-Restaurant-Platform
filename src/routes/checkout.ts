// src/routes/checkout.ts
// Backend endpoints for SERVIO pricing plan checkout flow.
// Handles: create-checkout-session, Stripe webhook, and session-status.

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingStructure {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  is_featured: number | boolean;
  is_active: number | boolean;
  features: string | null;
}

interface StripeCheckoutSession {
  id: string;
  url: string;
  status: string;
  customer_email: string | null;
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Rate limiter (same pattern as authRateLimiter in auth.ts)
// ---------------------------------------------------------------------------

const checkoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: { message: 'Too many checkout attempts. Please try again in 15 minutes.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ---------------------------------------------------------------------------
// Stripe helpers (raw fetch, same pattern as orders.ts)
// ---------------------------------------------------------------------------

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return key;
}

function stripeAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getStripeKey()}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ===========================================================================
// POST /create-checkout-session
// Public endpoint — creates restaurant + user in DB, then opens a Stripe
// Checkout Session in subscription mode.
// ===========================================================================

router.post(
  '/create-checkout-session',
  checkoutRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, restaurantName, planSlug } = req.body ?? {};

    // --- Validate inputs ---
    if (!name || !email || !password || !restaurantName || !planSlug) {
      return res.status(400).json({
        success: false,
        error: { message: 'All fields are required: name, email, password, restaurantName, planSlug' }
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    logger.info(
      `[checkout.create-session] entry ${JSON.stringify({
        email: normalizedEmail,
        planSlug,
        restaurantName
      })}`
    );

    const db = DatabaseService.getInstance().getDatabase();

    // --- Look up plan ---
    const plan = await db.get<PricingStructure>(
      'SELECT * FROM pricing_structures WHERE slug = ? AND is_active = TRUE',
      [String(planSlug)]
    );

    if (!plan) {
      logger.warn(`[checkout.create-session] plan_not_found ${JSON.stringify({ planSlug })}`);
      return res.status(404).json({
        success: false,
        error: { message: `Plan '${planSlug}' not found or is no longer available` }
      });
    }

    // --- Check for existing email ---
    const existingUser = await db.get<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = ?',
      [normalizedEmail]
    );
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { message: 'An account with this email already exists' }
      });
    }

    // --- Create restaurant (same logic as auth.ts /signup) ---
    const restaurantId = uuidv4();
    const slug = String(restaurantName)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    await db.run(
      'INSERT INTO restaurants (id, name, slug) VALUES (?, ?, ?)',
      [restaurantId, String(restaurantName), slug]
    );

    logger.info(
      `[checkout.create-session] restaurant_created ${JSON.stringify({ restaurantId, slug })}`
    );

    // --- Create owner user ---
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(String(password), 10);

    await db.run(
      'INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, restaurantId, String(name), normalizedEmail, passwordHash, 'owner', JSON.stringify(['*'])]
    );

    logger.info(
      `[checkout.create-session] user_created ${JSON.stringify({ userId, restaurantId })}`
    );

    // NOTE: subscription_tier/subscription_status/billing_email live on the
    // `companies` table, NOT `restaurants`. We track billing via
    // admin_billing_subscriptions (upserted in the webhook handler).
    // The restaurant + user are created above; Stripe webhook activates billing.

    logger.info(
      `[checkout.create-session] subscription_pending ${JSON.stringify({
        restaurantId,
        planSlug
      })}`
    );

    // --- Create Stripe Checkout Session ---
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    let checkoutUrl: string | null = null;

    try {
      const params = new URLSearchParams();

      params.append('mode', 'subscription');
      params.append('customer_email', normalizedEmail);

      // Line item with inline price (subscription mode)
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append(
        'line_items[0][price_data][unit_amount]',
        String(Math.round(Number(plan.price_monthly) * 100))
      );
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][price_data][product_data][name]', `${plan.name} Plan`);
      params.append('line_items[0][quantity]', '1');

      // Metadata — allows webhook to correlate session with our DB records
      params.append('metadata[restaurantId]', restaurantId);
      params.append('metadata[userId]', userId);
      params.append('metadata[planSlug]', String(planSlug));
      params.append('subscription_data[metadata][restaurantId]', restaurantId);
      params.append('subscription_data[metadata][userId]', userId);
      params.append('subscription_data[metadata][planSlug]', String(planSlug));

      // Redirect URLs
      params.append(
        'success_url',
        `${frontendUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`
      );
      params.append(
        'cancel_url',
        `${frontendUrl}/signup?plan=${encodeURIComponent(String(planSlug))}&cancelled=true`
      );

      const sessionResponse = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
        method: 'POST',
        headers: stripeAuthHeaders(),
        body: params.toString()
      });

      if (!sessionResponse.ok) {
        const responseText = await sessionResponse.text();
        throw new Error(`Stripe session creation failed (${sessionResponse.status}): ${responseText}`);
      }

      const sessionPayload = (await sessionResponse.json()) as StripeCheckoutSession;
      checkoutUrl = sessionPayload.url ?? null;

      if (!checkoutUrl) {
        throw new Error('Stripe did not return a checkout URL');
      }

      logger.info(
        `[checkout.create-session] stripe_session_created ${JSON.stringify({
          restaurantId,
          userId,
          planSlug,
          sessionId: sessionPayload.id
        })}`
      );
    } catch (stripeError) {
      // If Stripe fails, still return user info so they can log in later.
      // Subscription stays 'pending' and can be resolved manually / by retry.
      logger.error(
        `[checkout.create-session] stripe_error ${JSON.stringify({
          restaurantId,
          userId,
          planSlug,
          message:
            stripeError instanceof Error ? stripeError.message : String(stripeError)
        })}`
      );

      return res.status(200).json({
        success: true,
        data: {
          checkoutUrl: null,
          stripeError: true,
          message: 'Account created but payment session could not be started. You can log in and retry.',
          restaurant: { id: restaurantId, name: restaurantName, slug },
          user: { id: userId, name, email: normalizedEmail, role: 'owner' }
        }
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        checkoutUrl
      }
    });
  })
);

// ===========================================================================
// POST /webhook/stripe
// Public endpoint — must receive raw body (register with express.raw() before
// mounting this router, e.g.:
//   app.use('/checkout/webhook/stripe', express.raw({ type: 'application/json' }));
//   app.use('/checkout', checkoutRouter);
// Verifies Stripe-Signature header using HMAC-SHA256.
// ===========================================================================

router.post(
  '/webhook/stripe',
  asyncHandler(async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('[checkout.webhook] STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ success: false, error: { message: 'Webhook not configured' } });
    }

    // --- Verify Stripe signature ---
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      logger.warn('[checkout.webhook] missing stripe-signature header');
      return res.status(400).json({ success: false, error: { message: 'Missing Stripe signature' } });
    }

    // Raw body is required; Express must be configured with express.raw() for this route.
    const rawBody: Buffer = req.body as Buffer;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error('[checkout.webhook] raw body not available — ensure express.raw() middleware is applied');
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid body format; raw body required for webhook verification' }
      });
    }

    // Stripe signature format: t=<timestamp>,v1=<hmac>,...
    let stripeEvent: { type: string; data: { object: any } };
    try {
      stripeEvent = verifyStripeSignature(rawBody, signature, webhookSecret);
    } catch (sigError) {
      logger.warn(
        `[checkout.webhook] signature_verification_failed ${JSON.stringify({
          message: sigError instanceof Error ? sigError.message : String(sigError)
        })}`
      );
      return res.status(400).json({ success: false, error: { message: 'Invalid webhook signature' } });
    }

    const db = DatabaseService.getInstance().getDatabase();
    const { type, data } = stripeEvent;
    const stripeObject = data.object as any;

    logger.info(`[checkout.webhook] event_received ${JSON.stringify({ type })}`);

    // --- Handle events ---
    if (type === 'checkout.session.completed') {
      const { restaurantId, userId, planSlug } = stripeObject.metadata ?? {};

      if (!restaurantId) {
        logger.warn(
          `[checkout.webhook] checkout.session.completed missing restaurantId in metadata ${JSON.stringify({ sessionId: stripeObject.id })}`
        );
        return res.status(200).json({ received: true });
      }

      // NOTE: subscription columns live on `companies`, not `restaurants`.
      // Billing is tracked via admin_billing_subscriptions below.

      logger.info(
        `[checkout.webhook] subscription_activated ${JSON.stringify({
          restaurantId,
          userId,
          planSlug,
          sessionId: stripeObject.id
        })}`
      );

      // Upsert admin_billing_subscriptions if the table exists
      try {
        const tableExists = await db.get<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_billing_subscriptions' LIMIT 1`
        );

        if (tableExists) {
          const subscriptionId = uuidv4();
          const priceMonthly = stripeObject.amount_total ? stripeObject.amount_total / 100 : 0;

          await db.run(
            `INSERT INTO admin_billing_subscriptions
                (id, restaurant_id, package_name, status, billing_cycle, amount, contact_email, stripe_customer_id, stripe_subscription_id)
              VALUES (?, ?, ?, 'active', 'monthly', ?, ?, ?, ?)
              ON CONFLICT (restaurant_id) DO UPDATE SET
                package_name  = excluded.package_name,
                status        = 'active',
                amount        = excluded.amount,
                contact_email = excluded.contact_email,
                stripe_customer_id = excluded.stripe_customer_id,
                stripe_subscription_id = excluded.stripe_subscription_id,
                updated_at    = CURRENT_TIMESTAMP`,
            [
              subscriptionId,
              restaurantId,
              planSlug ?? 'unknown',
              priceMonthly,
              stripeObject.customer_email ?? null,
              stripeObject.customer ?? null,
              stripeObject.subscription ?? null
            ]
          );

          logger.info(
            `[checkout.webhook] admin_billing_subscription_upserted ${JSON.stringify({
              restaurantId,
              planSlug
            })}`
          );
        }
      } catch (billingError) {
        // Non-fatal: log and continue
        logger.error(
          `[checkout.webhook] admin_billing_upsert_error ${JSON.stringify({
            restaurantId,
            message: billingError instanceof Error ? billingError.message : String(billingError)
          })}`
        );
      }
    } else if (type === 'customer.subscription.deleted') {
      // Stripe sends subscription objects here; metadata lives on the subscription object itself.
      // Legacy subscriptions may not have metadata, so fall back to lookup via stored Stripe IDs.
      const restaurantId = await resolveRestaurantIdFromSubscription(db, stripeObject);

      if (restaurantId) {
        // Update billing subscription record if it exists
        try {
          await db.run(
            `UPDATE admin_billing_subscriptions
                SET status     = 'canceled',
                    updated_at = CURRENT_TIMESTAMP
              WHERE restaurant_id = ?`,
            [restaurantId]
          );
        } catch {
          // Table may not exist — ignore
        }

        logger.info(
          `[checkout.webhook] subscription_canceled ${JSON.stringify({ restaurantId })}`
        );
      } else {
        logger.warn(
          `[checkout.webhook] customer.subscription.deleted no restaurantId in metadata ${JSON.stringify({
            subscriptionId: stripeObject.id,
            customerId: stripeObject.customer ?? null
          })}`
        );
      }
    } else {
      logger.info(`[checkout.webhook] unhandled_event_type ${JSON.stringify({ type })}`);
    }

    return res.status(200).json({ received: true });
  })
);

// ===========================================================================
// GET /session-status/:sessionId
// Public endpoint — proxies session status from Stripe.
// ===========================================================================

router.get(
  '/session-status/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId ?? '');

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId is required' }
      });
    }

    logger.info(`[checkout.session-status] fetching ${JSON.stringify({ sessionId })}`);

    const sessionResponse = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: stripeAuthHeaders()
      }
    );

    if (!sessionResponse.ok) {
      const responseText = await sessionResponse.text();
      logger.error(
        `[checkout.session-status] stripe_error ${JSON.stringify({
          sessionId,
          status: sessionResponse.status,
          body: responseText
        })}`
      );
      return res.status(sessionResponse.status === 404 ? 404 : 502).json({
        success: false,
        error: { message: `Failed to retrieve session from Stripe (${sessionResponse.status})` }
      });
    }

    const session = (await sessionResponse.json()) as StripeCheckoutSession;

    return res.status(200).json({
      success: true,
      data: {
        status: session.status,
        customerEmail: session.customer_email,
        planSlug: session.metadata?.planSlug ?? null
      }
    });
  })
);

// ===========================================================================
// Stripe webhook signature verification
// Implements https://stripe.com/docs/webhooks/signatures
// Format: t=<unix_ts>,v1=<sig1>,v1=<sig2>,...
// ===========================================================================

function verifyStripeSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): { type: string; data: { object: any } } {
  const parts = signature.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      if (!acc[key]) acc[key] = [];
      acc[key].push(value);
    }
    return acc;
  }, {});

  const timestamp = parts['t']?.[0];
  const v1Signatures = parts['v1'] ?? [];

  if (!timestamp) {
    throw new Error('No timestamp in Stripe-Signature header');
  }

  // Prevent replay attacks: reject events older than 5 minutes
  const tolerance = 5 * 60; // seconds
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > tolerance) {
    throw new Error(`Webhook timestamp out of tolerance (ts=${timestamp}, now=${now})`);
  }

  // Compute expected HMAC
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison against each v1 signature
  const matched = v1Signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'hex'),
        Buffer.from(sig, 'hex')
      );
    } catch {
      return false;
    }
  });

  if (!matched) {
    throw new Error('Stripe signature verification failed');
  }

  // Signature valid — parse and return the event
  return JSON.parse(rawBody.toString('utf8')) as { type: string; data: { object: any } };
}

async function resolveRestaurantIdFromSubscription(
  db: ReturnType<ReturnType<typeof DatabaseService.getInstance>['getDatabase']>,
  subscription: any
): Promise<string | null> {
  const metadataRestaurantId = subscription?.metadata?.restaurantId;
  if (metadataRestaurantId) {
    return String(metadataRestaurantId);
  }

  const byStripeIds = await db.get<{ restaurant_id: string }>(
    `SELECT restaurant_id
       FROM admin_billing_subscriptions
      WHERE stripe_subscription_id = ?
         OR stripe_customer_id = ?
      LIMIT 1`,
    [subscription?.id ?? null, subscription?.customer ?? null]
  );

  return byStripeIds?.restaurant_id ?? null;
}

export default router;
