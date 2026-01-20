import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';

const router = express.Router();

function isValidDate(date: string): boolean {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTime(time: string): boolean {
  // HH:MM 24h
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * GET /api/bookings?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Public: returns booked slots for a date range
 */
router.get('/', async (req, res) => {
  try {
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');

    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Provide start and end in YYYY-MM-DD format'
      });
    }

    const db = await DatabaseService.getInstance().getDatabase();
    const bookings = await db.all<{
      booking_date: string;
      booking_time: string;
    }>(
      `
      SELECT booking_date, booking_time
      FROM demo_bookings
      WHERE booking_date >= ? AND booking_date <= ?
        AND status = 'scheduled'
      ORDER BY booking_date ASC, booking_time ASC
      `,
      [start, end]
    );

    res.json({ bookings });
  } catch (error) {
    logger.error('Failed to load demo bookings:', error);
    res.status(500).json({
      error: 'Failed to load bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/bookings
 * Public: create a booking
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      restaurantName,
      bookingDate,
      bookingTime,
      timezone,
      notes
    } = req.body || {};

    if (!name || !email || !bookingDate || !bookingTime || !timezone) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'name, email, bookingDate, bookingTime, and timezone are required'
      });
    }

    if (!isValidDate(String(bookingDate)) || !isValidTime(String(bookingTime))) {
      return res.status(400).json({
        error: 'Invalid booking date/time',
        message: 'bookingDate must be YYYY-MM-DD and bookingTime must be HH:MM (24h)'
      });
    }

    const db = await DatabaseService.getInstance().getDatabase();

    const existing = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM demo_bookings
      WHERE booking_date = ? AND booking_time = ?
        AND status = 'scheduled'
      `,
      [bookingDate, bookingTime]
    );

    if ((existing?.count || 0) > 0) {
      return res.status(409).json({
        error: 'Slot unavailable',
        message: 'That time slot is already booked. Please choose another.'
      });
    }

    const id = uuidv4();
    await db.run(
      `
      INSERT INTO demo_bookings (
        id, name, email, phone, restaurant_name,
        booking_date, booking_time, timezone, notes, status,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 'scheduled',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      `,
      [
        id,
        String(name),
        String(email),
        phone ? String(phone) : null,
        restaurantName ? String(restaurantName) : null,
        String(bookingDate),
        String(bookingTime),
        String(timezone),
        notes ? String(notes) : null
      ]
    );

    res.status(201).json({
      id,
      status: 'scheduled'
    });
  } catch (error) {
    logger.error('Failed to create demo booking:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

