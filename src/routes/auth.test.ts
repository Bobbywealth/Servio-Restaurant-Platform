/**
 * Authentication API Integration Tests
 * Tests all authentication endpoints including login, signup, logout, and token management
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';

describe('Authentication API', () => {
  const baseUrl = '/api/auth';
  const testUser = {
    email: `test_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  describe('POST /api/auth/signup', () => {
    it('should create a new user account', async () => {
      const response = await request(app)
        .post(`${baseUrl}/signup`)
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post(`${baseUrl}/signup`)
        .send(testUser)
        .expect(201);

      const response = await request(app)
        .post(`${baseUrl}/signup`)
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post(`${baseUrl}/signup`)
        .send({
          ...testUser,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post(`${baseUrl}/signup`)
        .send({
          ...testUser,
          email: `test_${Date.now()}@test.com`,
          password: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post(`${baseUrl}/signup`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    let createdUser = {
      email: `logintest_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Login',
      lastName: 'Test'
    };

    beforeAll(async () => {
      // Create user first
      await request(app)
        .post(`${baseUrl}/signup`)
        .send(createdUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: createdUser.email,
          password: createdUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(createdUser.email);
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: 'nonexistent@test.com',
          password: 'password'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: createdUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: 'demo@servio.com',
          password: 'demo123'
        });
      token = response.body.token;
    });

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get(`${baseUrl}/me`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get(`${baseUrl}/me`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get(`${baseUrl}/me`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: 'demo@servio.com',
          password: 'demo123'
        });
      refreshToken = response.body.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post(`${baseUrl}/refresh`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post(`${baseUrl}/refresh`)
        .send({ refreshToken: 'invalid' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let token: string;

    beforeAll(async () => {
      const response = await request(app)
        .post(`${baseUrl}/login`)
        .send({
          email: 'demo@servio.com',
          password: 'demo123'
        });
      token = response.body.token;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post(`${baseUrl}/logout`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should invalidate token after logout', async () => {
      await request(app)
        .post(`${baseUrl}/logout`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use the token again
      const response = await request(app)
        .get(`${baseUrl}/me`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
