/**
 * Orders API Integration Tests
 * Tests all order-related endpoints including CRUD operations, status updates, and analytics
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';

describe('Orders API', () => {
  let authToken: string;
  let testRestaurantId: string;
  let testOrderId: string;

  const baseUrl = '/api/orders';

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@servio.com',
        password: 'demo123'
      });

    authToken = loginResponse.body.token;
    testRestaurantId = loginResponse.body.user?.restaurantId || '1';
  });

  describe('GET /api/orders', () => {
    it('should return list of orders with valid auth', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get(`${baseUrl}?status=pending`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        response.body.forEach((order: any) => {
          expect(order.status).toBe('pending');
        });
      }
    });

    it('should filter orders by channel', async () => {
      const response = await request(app)
        .get(`${baseUrl}?channel=web`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`${baseUrl}?limit=10&offset=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should reject request without auth', async () => {
      const response = await request(app)
        .get(baseUrl)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/orders', () => {
    const newOrder = {
      restaurantId: '1',
      items: [
        {
          menuItemId: '1',
          name: 'Test Item',
          quantity: 2,
          price: 9.99,
          modifiers: []
        }
      ],
      customer: {
        name: 'Test Customer',
        phone: '555-1234'
      },
      channel: 'web'
    };

    it('should create a new order', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newOrder)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      testOrderId = response.body.id;
    });

    it('should reject order without items', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...newOrder,
          items: []
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject order without customer info', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...newOrder,
          customer: null
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should calculate order total automatically', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newOrder)
        .expect(201);

      expect(response.body).toHaveProperty('total');
      expect(response.body.total).toBe(19.98); // 2 * 9.99
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order by id', async () => {
      const response = await request(app)
        .get(`${baseUrl}/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get(`${baseUrl}/999999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('should update order details', async () => {
      const response = await request(app)
        .put(`${baseUrl}/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Test notes'
        })
        .expect(200);

      expect(response.body).toHaveProperty('notes');
    });

    it('should reject invalid order data', async () => {
      const response = await request(app)
        .put(`${baseUrl}/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          total: -100 // Invalid
        })
        .expect(400);
    });
  });

  describe('POST /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const response = await request(app)
        .post(`${baseUrl}/1/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'preparing'
        })
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should allow valid status transitions', async () => {
      const statuses = ['pending', 'preparing', 'ready', 'completed'];
      
      for (const status of statuses) {
        const response = await request(app)
          .post(`${baseUrl}/1/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status })
          .expect(200);
        
        expect(response.body.status).toBe(status);
      }
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post(`${baseUrl}/1/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/orders/:id/prep-time', () => {
    it('should update preparation time', async () => {
      const response = await request(app)
        .post(`${baseUrl}/1/prep-time`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prepTimeMinutes: 15
        })
        .expect(200);

      expect(response.body).toHaveProperty('prepTimeMinutes');
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should delete an order', async () => {
      // First create an order to delete
      const createResponse = await request(app)
        .post(baseUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          restaurantId: '1',
          items: [{ menuItemId: '1', name: 'Test', quantity: 1, price: 10 }],
          customer: { name: 'Test', phone: '555-0000' },
          channel: 'web'
        });

      const orderId = createResponse.body.id;

      const response = await request(app)
        .delete(`${baseUrl}/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 when deleting non-existent order', async () => {
      const response = await request(app)
        .delete(`${baseUrl}/999999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/orders/stats/summary', () => {
    it('should return order statistics', async () => {
      const response = await request(app)
        .get(`${baseUrl}/stats/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalOrders');
      expect(response.body).toHaveProperty('totalRevenue');
    });
  });

  describe('GET /api/orders/analytics', () => {
    it('should return order analytics', async () => {
      const response = await request(app)
        .get(`${baseUrl}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ordersByDay');
      expect(response.body).toHaveProperty('ordersByStatus');
    });
  });

  describe('GET /api/orders/public/:slug', () => {
    it('should return public order tracking info', async () => {
      const response = await request(app)
        .get(`${baseUrl}/public/test-restaurant`)
        .expect(200);

      expect(response.body).toHaveProperty('restaurant');
    });
  });

  describe('GET /api/orders/waiting-times', () => {
    it('should return waiting time estimates', async () => {
      const response = await request(app)
        .get(`${baseUrl}/waiting-times`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
