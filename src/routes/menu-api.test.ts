/**
 * Menu API Integration Tests
 * Tests all menu-related endpoints including categories, items, modifiers, and sizes
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';

describe('Menu API', () => {
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

  describe('GET /api/menu/categories', () => {
    it('should return list of categories', async () => {
      const response = await request(app)
        .get('/api/menu/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/menu/categories', () => {
    it('should create a new category', async () => {
      const response = await request(app)
        .post('/api/menu/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Category',
          description: 'Test Description',
          sortOrder: 0
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Category');
    });

    it('should reject category without name', async () => {
      const response = await request(app)
        .post('/api/menu/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No name' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/menu/categories/:id', () => {
    it('should update a category', async () => {
      // First create a category
      const createResponse = await request(app)
        .post('/api/menu/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Test Category' });

      const categoryId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/menu/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Category Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Category Name');
    });
  });

  describe('DELETE /api/menu/categories/:id', () => {
    it('should delete a category', async () => {
      // Create category to delete
      const createResponse = await request(app)
        .post('/api/menu/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Delete Test Category' });

      const categoryId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/menu/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/menu/items', () => {
    it('should return list of menu items', async () => {
      const response = await request(app)
        .get('/api/menu/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/menu/items?category=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/menu/items', () => {
    it('should create a new menu item', async () => {
      const response = await request(app)
        .post('/api/menu/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Menu Item',
          description: 'Test description',
          price: 9.99,
          categoryId: 1,
          isAvailable: true
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Menu Item');
    });
  });

  describe('PUT /api/menu/items/:id', () => {
    it('should update a menu item', async () => {
      const response = await request(app)
        .put('/api/menu/items/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Item Name',
          price: 12.99
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Item Name');
    });
  });

  describe('DELETE /api/menu/items/:id', () => {
    it('should delete a menu item', async () => {
      // First create an item to delete
      const createResponse = await request(app)
        .post('/api/menu/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Delete Test Item',
          price: 9.99,
          categoryId: 1
        });

      const itemId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/menu/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/menu/items/set-unavailable', () => {
    it('should set item as unavailable', async () => {
      const response = await request(app)
        .post('/api/menu/items/set-unavailable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: '1',
          channels: ['all']
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('POST /api/menu/items/set-available', () => {
    it('should set item as available', async () => {
      const response = await request(app)
        .post('/api/menu/items/set-available')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: '1',
          channels: ['all']
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('GET /api/menu/items/search', () => {
    it('should search menu items', async () => {
      const response = await request(app)
        .get('/api/menu/items/search?q=pizza')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Menu Item Sizes', () => {
    describe('GET /api/menu/items/:id/sizes', () => {
      it('should return item sizes', async () => {
        const response = await request(app)
          .get('/api/menu/items/1/sizes')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/menu/items/:id/sizes', () => {
      it('should add size to item', async () => {
        const response = await request(app)
          .post('/api/menu/items/1/sizes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Large',
            priceModifier: 3.00
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      });
    });
  });

  describe('PUT /api/menu/categories/reorder', () => {
    it('should reorder categories', async () => {
      const response = await request(app)
        .put('/api/menu/categories/reorder')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryIds: [2, 1, 3]
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });
});

describe('Modifiers API', () => {
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

  describe('GET /api/modifiers/restaurants/:restaurantId/modifier-groups', () => {
    it('should return modifier groups', async () => {
      const response = await request(app)
        .get('/api/modifiers/restaurants/1/modifier-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/modifiers/restaurants/:restaurantId/modifier-groups', () => {
    it('should create modifier group', async () => {
      const response = await request(app)
        .post('/api/modifiers/restaurants/1/modifier-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Size',
          required: true,
          multiSelect: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });
});
