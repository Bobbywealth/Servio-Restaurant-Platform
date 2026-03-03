import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

// Public webhook endpoint for Twilio inbound SMS.
// We intentionally keep this lightweight and return TwiML immediately.
// Inbound SMS can be read by polling Twilio (or we can store in DB later).

const router = Router();

router.post('/inbound', async (req: Request, res: Response) => {
  try {
    const from = String((req.body as any)?.From || '');
    const to = String((req.body as any)?.To || '');
    const body = String((req.body as any)?.Body || '');

    logger.info('[twilio:sms] inbound', {
      from,
      to,
      bodyPreview: body.slice(0, 200)
    });
  } catch (err) {
    logger.warn('[twilio:sms] inbound_parse_error', {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Return empty TwiML to avoid any auto-reply.
  res.type('text/xml').status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

export default router;
