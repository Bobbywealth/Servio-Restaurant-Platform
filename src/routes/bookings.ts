import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';

type BookingTableName = 'demo_bookings' | 'demo_requests';

type BookingCreatePayload = {
  name?: string;
  email?: string;
  phone?: string;
  restaurantName?: string;
  restaurant_name?: string;
  bookingDate?: string;
  booking_date?: string;
  bookingTime?: string;
  booking_time?: string;
  timezone?: string;
  notes?: string;
};

const router = express.Router();

const bookingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many booking requests. Please try again in a few minutes.'
  }
});

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s().-]{7,20}$/;

const isValidDate = (value: string): boolean => {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const isValidTimezone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const normalizeCreatePayload = (payload: BookingCreatePayload) => ({
  name: String(payload.name || '').trim(),
  email: String(payload.email || '').trim().toLowerCase(),
  phone: payload.phone ? String(payload.phone).trim() : null,
  restaurant_name: String(payload.restaurantName || payload.restaurant_name || '').trim() || null,
  booking_date: String(payload.bookingDate || payload.booking_date || '').trim(),
  booking_time: String(payload.bookingTime || payload.booking_time || '').trim(),
  timezone: String(payload.timezone || '').trim() || 'UTC',
  notes: payload.notes ? String(payload.notes).trim() : null
});

export const validateCreatePayload = (payload: BookingCreatePayload): string[] => {
  const normalized = normalizeCreatePayload(payload);
  const errors: string[] = [];

  if (!normalized.name) errors.push('name is required');
  if (!normalized.email) errors.push('email is required');
  if (!normalized.booking_date) errors.push('bookingDate is required');
  if (!normalized.booking_time) errors.push('bookingTime is required');

  if (normalized.email && !EMAIL_REGEX.test(normalized.email)) {
    errors.push('email must be a valid email address');
  }

  if (normalized.phone && !PHONE_REGEX.test(normalized.phone)) {
    errors.push('phone must be a valid phone number');
  }

  if (normalized.booking_date && !isValidDate(normalized.booking_date)) {
    errors.push('bookingDate must be in YYYY-MM-DD format');
  }

  if (normalized.booking_time && !TIME_REGEX.test(normalized.booking_time)) {
    errors.push('bookingTime must be in HH:mm 24-hour format');
  }

  if (normalized.timezone && !isValidTimezone(normalized.timezone)) {
    errors.push('timezone must be a valid IANA timezone');
  }

  return errors;
};

export const resolveBookingTable = async (): Promise<BookingTableName | null> => {
  const db = await DatabaseService.getInstance().getDatabase();
  const tableCandidates: BookingTableName[] = ['demo_bookings', 'demo_requests'];

  const attempts: Array<{ sql: string; params: string[] }> = [
    {
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${tableCandidates.map(() => '?').join(',')}) LIMIT 1`,
      params: tableCandidates
    },
    {
      sql: `SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (${tableCandidates.map(() => '?').join(',')}) LIMIT 1`,
      params: tableCandidates
    }
  ];

  for (const attempt of attempts) {
    try {
      const result = await db.get<{ name: BookingTableName }>(attempt.sql, attempt.params);
      if (result?.name) return result.name;
    } catch {
      // Keep trying; environments may not support sqlite_master or information_schema.
    }
  }

  return null;
};

export const getBookingsHandler = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const start = typeof req.query.start === 'string' ? req.query.start.trim() : '';
    const end = typeof req.query.end === 'string' ? req.query.end.trim() : '';

    if (start && !isValidDate(start)) {
      return res.status(400).json({ error: 'Invalid start date. Use YYYY-MM-DD.' });
    }
    if (end && !isValidDate(end)) {
      return res.status(400).json({ error: 'Invalid end date. Use YYYY-MM-DD.' });
    }
    if (start && end && start > end) {
      return res.status(400).json({ error: 'start must be before or equal to end.' });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const tableName = await resolveBookingTable();
    if (!tableName) return res.json({ bookings: [] });

    const whereParts: string[] = [];
    const params: string[] = [];
    if (start) {
      whereParts.push('CAST(booking_date AS DATE) >= CAST(? AS DATE)');
      params.push(start);
    }
    if (end) {
      whereParts.push('CAST(booking_date AS DATE) <= CAST(? AS DATE)');
      params.push(end);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const bookings = await db.all(
      `SELECT booking_date, booking_time
       FROM ${tableName}
       ${whereClause}
       ORDER BY booking_date ASC, booking_time ASC`,
      params
    );

    return res.json({ bookings });
  } catch (error) {
    logger.error('Failed to list bookings:', error);
    return res.status(500).json({
      error: 'Failed to load bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createBookingHandler = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const errors = validateCreatePayload(req.body as BookingCreatePayload);
    if (errors.length) {
      return res.status(400).json({
        error: 'Invalid booking payload',
        details: errors
      });
    }

    const booking = normalizeCreatePayload(req.body as BookingCreatePayload);
    const db = await DatabaseService.getInstance().getDatabase();
    const tableName = await resolveBookingTable();

    if (!tableName) {
      return res.status(503).json({
        error: 'Booking service unavailable',
        details: 'No demo booking table is available.'
      });
    }

    const existing = await db.get<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM ${tableName}
       WHERE booking_date = ? AND booking_time = ?`,
      [booking.booking_date, booking.booking_time]
    );

    if ((existing?.total || 0) > 0) {
      return res.status(409).json({
        error: 'This slot is already booked.',
        code: 'SLOT_CONFLICT'
      });
    }

    const id = randomUUID();

    await db.run(
      `INSERT INTO ${tableName}
        (id, name, email, phone, restaurant_name, booking_date, booking_time, timezone, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        booking.name,
        booking.email,
        booking.phone,
        booking.restaurant_name,
        booking.booking_date,
        booking.booking_time,
        booking.timezone,
        booking.notes,
        'pending'
      ]
    );

    return res.status(201).json({
      id,
      booking: {
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        timezone: booking.timezone
      },
      message: 'Booking request created successfully.'
    });
  } catch (error) {
    logger.error('Failed to create booking:', error);
    return res.status(500).json({
      error: 'Failed to create booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

router.get('/', bookingsLimiter, getBookingsHandler);
router.post('/', bookingsLimiter, createBookingHandler);

export default router;
