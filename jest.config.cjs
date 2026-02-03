/** @type {import('jest').Config} */
module.exports = {
  // IMPORTANT: This repo contains Playwright E2E specs under frontend/e2e.
  // Jest must not attempt to load/transform those.
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  testEnvironment: 'node',

  // TypeScript transform
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },

  // Avoid Jest transform cache issues (was failing with onExit not a function)
  cache: false,

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/frontend/',
  ],

  // Test setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/**/*.d.ts',
    '!src/database/migrations/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};

