/**
 * Timeclock API Integration Tests
 * Tests all timeclock endpoints including clock in/out, breaks, and entries
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';

describe('Timeclock API', () => {
  let authToken: string;
  let testPin: string = '1234';

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@servio.com',
        password: 'demo123'
      });
    authToken = loginResponse.body.token;
  });

  describe('POST /api/timeclock/clock-in', () => {
    it('should clock in successfully with valid PIN', async () => {
      const response = await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pin: testPin,
          position: 'Server'
        })
        .expect(200);

      expect(response.body).toHaveProperty('clockInTime');
      expect(response.body).toHaveProperty('status');
    });

    it('should reject invalid PIN', async () => {
      const response = await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pin: '0000',
          position: 'Server'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject clock in without PIN', async () => {
      const response = await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          position: 'Server'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject if already clocked in', async () => {
      // First clock in
      await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin, position: 'Server' })
        .expect(200);

      // Try to clock in again
      const response = await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin, position: 'Server' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/timeclock/clock-out', () => {
    beforeAll(async () => {
      // Ensure we're clocked in
      await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin, position: 'Server' });
    });

    it('should clock out successfully', async () => {
      const response = await request(app)
        .post('/api/timeclock/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pin: testPin,
          notes: 'End of shift'
        })
        .expect(200);

      expect(response.body).toHaveProperty('clockOutTime');
      expect(response.body).toHaveProperty('totalHours');
    });

    it('should reject clock out without being clocked in', async () => {
      // First clock out to ensure we're not clocked in
      await request(app)
        .post('/api/timeclock/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin });

      const response = await request(app)
        .post('/api/timeclock/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/timeclock/start-break', () => {
    beforeAll(async () => {
      // Clock in first
      await request(app)
        .post('/api/timeclock/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin, position: 'Server' });
    });

    it('should start break', async () => {
      const response = await request(app)
        .post('/api/timeclock/start-break')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin })
        .expect(200);

      expect(response.body).toHaveProperty('breakStartTime');
      expect(response.body).toHaveProperty('status');
    });

    it('should reject if already on break', async () => {
      const response = await request(app)
        .post('/api/timeclock/start-break')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/timeclock/end-break', () => {
    it('should end break', async () => {
      const response = await request(app)
        .post('/api/timeclock/end-break')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin })
        .expect(200);

      expect(response.body).toHaveProperty('breakEndTime');
    });
  });

  describe('GET /api/timeclock/current-staff', () => {
    it('should return currently clocked in staff', async () => {
      const response = await request(app)
        .get('/api/timeclock/current-staff')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/timeclock/entries', () => {
    it('should return time entries', async () => {
      const response = await request(app)
        .get('/api/timeclock/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/timeclock/entries?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by user', async () => {
      const response = await request(app)
        .get('/api/timeclock/entries?userId=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/timeclock/entries', () => {
    it('should create manual time entry', async () => {
      const response = await request(app)
        .post('/api/timeclock/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          clockInTime: '2024-01-15T09:00:00Z',
          clockOutTime: '2024-01-15T17:00:00Z',
          position: 'Server'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/timeclock/entries/:id', () => {
    it('should update time entry', async () => {
      const response = await request(app)
        .put('/api/timeclock/entries/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Updated notes'
        })
        .expect(200);

      expect(response.body).toHaveProperty('notes');
    });
  });

  describe('GET /api/timeclock/stats', () => {
    it('should return timeclock statistics', async () => {
      const response = await request(app)
        .get('/api/timeclock/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalHours');
      expect(response.body).toHaveProperty('totalShifts');
    });

    it('should filter stats by date range', async () => {
      const response = await request(app)
        .get('/api/timeclock/stats?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalHours');
    });
  });

  describe('POST /api/timeclock/pin-login', () => {
    it('should login with PIN', async () => {
      const response = await request(app)
        .post('/api/timeclock/pin-login')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: testPin })
        .expect(200);

      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid PIN', async () => {
      const response = await request(app)
        .post('/api/timeclock/pin-login')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: '0000' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/timeclock/my-stats', () => {
    it('should return current user stats', async () => {
      const response = await request(app)
        .get('/api/timeclock/my-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalHours');
    });
  });

  describe('GET /api/timeclock/staff-hours', () => {
    it('should return staff hours summary', async () => {
      const response = await request(app)
        .get('/api/timeclock/staff-hours')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Manager Endpoints', () => {
    describe('POST /api/timeclock/manager/clock-in', () => {
      it('should allow manager to clock in staff', async () => {
        const response = await request(app)
          .post('/api/timeclock/manager/clock-in')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            userId: 2,
            position: 'Cook',
            clockInTime: '2024-01-15T10:00:00Z'
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      });
    });

    describe('POST /api/timeclock/manager/clock-out', () => {
      it('should allow manager to clock out staff', async () => {
        const response = await request(app)
          .post('/api/timeclock/manager/clock-out')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            userId: 2,
            clockOutTime: '2024-01-15T18:00:00Z'
          })
          .expect(200);

        expect(response.body).toHaveProperty('clockOutTime');
      });
    });

    describe('POST /api/timeclock/manager/reverse-entry', () => {
      it('should allow manager to reverse entry', async () => {
        const response = await request(app)
          .post('/api/timeclock/manager/reverse-entry')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            entryId: 1,
            reason: 'Clocked out by manager'
          })
          .expect(200);

        expect(response.body).toHaveProperty('reversed');
      });
    });

    describe('GET /api/timeclock/manager/all-staff', () => {
      it('should return all staff clock status', async () => {
        const response = await request(app)
          .get('/api/timeclock/manager/all-staff')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
});

describe('Staff Scheduling API', () => {
  let authToken: string;

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@servio.com',
        password: 'demo123'
      });
    authToken = loginResponse.body.token;
  });

  describe('GET /api/scheduling/schedules', () => {
    it('should return schedules', async () => {
      const response = await request(app)
        .get('/api/scheduling/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/scheduling/schedules?startDate=2024-01-01&endDate=2024-01-07')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/scheduling/schedules', () => {
    it('should create a schedule', async () => {
      const response = await request(app)
        .post('/api/scheduling/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          date: '2024-01-20',
          startTime: '09:00',
          endTime: '17:00',
          position: 'Server'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/scheduling/schedules/:id', () => {
    it('should update a schedule', async () => {
      // First create a schedule
      const createResponse = await request(app)
        .post('/api/scheduling/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          date: '2024-01-21',
          startTime: '09:00',
          endTime: '17:00',
          position: 'Server'
        });

      const scheduleId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/scheduling/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: '10:00',
          endTime: '18:00'
        })
        .expect(200);

      expect(response.body.startTime).toBe('10:00');
    });
  });

  describe('DELETE /api/scheduling/schedules/:id', () => {
    it('should delete a schedule', async () => {
      // Create schedule to delete
      const createResponse = await request(app)
        .post('/api/scheduling/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          date: '2024-01-22',
          startTime: '09:00',
          endTime: '17:00',
          position: 'Server'
        });

      const scheduleId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/scheduling/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/scheduling/publish', () => {
    it('should publish schedule', async () => {
      const response = await request(app)
        .post('/api/scheduling/publish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: '2024-01-20',
          endDate: '2024-01-26'
        })
        .expect(200);

      expect(response.body).toHaveProperty('published');
    });
  });

  describe('Shift Templates', () => {
    describe('GET /api/scheduling/templates', () => {
      it('should return shift templates', async () => {
        const response = await request(app)
          .get('/api/scheduling/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/scheduling/templates', () => {
      it('should create shift template', async () => {
        const response = await request(app)
          .post('/api/scheduling/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Morning Shift',
            startTime: '06:00',
            endTime: '14:00',
            position: 'Cook'
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      });
    });
  });
});
