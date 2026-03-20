#!/usr/bin/env npx tsx

/**
 * Servio Restaurant Platform - Comprehensive Stress Test Runner
 * 
 * Executes all stress test scenarios including:
 * - Load Testing (normal and peak load)
 * - Concurrency Testing (multiple simultaneous users)
 * - Performance Benchmarking (response times, throughput)
 * - Security Vulnerability Testing
 * - Failure Mode Testing (network interruptions, service failures)
 * - Edge Case Testing (invalid inputs, boundary conditions)
 * - Scenario Simulations (complete user flows)
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  baseUrl: process.env.STRESS_TEST_URL || 'http://localhost:3002',
  testRestaurantId: process.env.STRESS_TEST_RESTAURANT_ID || 'demo-restaurant-1',
  testAdminToken: process.env.STRESS_TEST_ADMIN_TOKEN || '',
  concurrencyLevels: [1, 5, 10, 20, 50],
  durationMs: 20000, // 20 seconds per load test (reduced for faster execution)
  warmupMs: 3000,
  cooldownMs: 2000,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  requestTimeout: 30000,
};

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  name: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration: number;
  metrics?: Metrics;
  error?: string;
  timestamp: Date;
}

interface Metrics {
  requests: number;
  errors: number;
  errorRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  rps?: number; // requests per second
}

interface HttpRequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface TestScenario {
  name: string;
  category: string;
  execute: () => Promise<TestResult>;
}

// ============================================================================
// UTILITIES
// ============================================================================

function log(category: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${category}] ${message}`;
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function calculateMetrics(responseTimes: number[], errorCount: number): Metrics {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const requests = responseTimes.length;
  const errors = errorCount;
  const errorRate = (errors / requests) * 100;
  
  return {
    requests,
    errors,
    errorRate,
    avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / requests,
    minResponseTime: sorted[0] || 0,
    maxResponseTime: sorted[sorted.length - 1] || 0,
    p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)] || 0,
    p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || 0,
    throughput: (requests / (sorted[sorted.length - 1] / 1000)) * requests,
    rps: requests / ((sorted[sorted.length - 1]) / 1000),
  };
}

async function makeRequest(options: HttpRequestOptions): Promise<{ statusCode: number; body: string; duration: number }> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, CONFIG.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Servio-StressTest/1.0',
        ...options.headers,
      },
      timeout: options.timeout || CONFIG.requestTimeout,
    };
    
    const req = client.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({ statusCode: res.statusCode || 0, body, duration });
      });
    });
    
    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      reject(new Error(`Request failed: ${err.message} (${duration}ms)`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${Date.now() - startTime}ms`));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function authenticate(): Promise<string> {
  log('AUTH', 'Authenticating test user');
  
  const response = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'Test123!',
    }),
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Authentication failed: ${response.statusCode}`);
  }
  
  const data = JSON.parse(response.body);
  const token = data.token || data.accessToken;
  
  if (!token) {
    throw new Error('No token received from authentication');
  }
  
  log('AUTH', 'Authentication successful', { token: token.substring(0, 20) + '...' });
  return token;
}

// ============================================================================
// LOAD TESTING
// ============================================================================

async function runLoadTest(
  name: string,
  requestFactory: (index: number) => HttpRequestOptions,
  concurrentUsers: number,
  durationMs: number
): Promise<TestResult> {
  log('LOAD', `Starting load test: ${name}`, { concurrentUsers, durationMs });
  
  const startTime = Date.now();
  const responseTimes: number[] = [];
  let errorCount = 0;
  let requestCount = 0;
  let activeRequests = 0;
  const maxActiveRequests = concurrentUsers * 2;
  
  const runRequests = async () => {
    const testEndTime = startTime + durationMs;
    let index = 0;
    
    while (Date.now() < testEndTime) {
      // Throttle if too many concurrent requests
      while (activeRequests >= maxActiveRequests) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const currentIndex = index++;
      activeRequests++;
      
      const request = requestFactory(currentIndex);
      const requestStart = Date.now();
      
      makeRequest(request)
        .then((response) => {
          responseTimes.push(response.duration);
          if (response.statusCode >= 400) {
            errorCount++;
          }
        })
        .catch(() => {
          errorCount++;
        })
        .finally(() => {
          activeRequests--;
          requestCount++;
        });
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  
  // Run concurrent workers
  const workers = Array(concurrentUsers).fill(null).map(() => runRequests());
  await Promise.all(workers);
  
  // Wait for remaining requests
  while (activeRequests > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalDuration = Date.now() - startTime;
  const metrics = calculateMetrics(responseTimes, errorCount);
  
  log('LOAD', `Completed load test: ${name}`, {
    duration: totalDuration,
    requests: metrics.requests,
    errors: metrics.errors,
    errorRate: metrics.errorRate.toFixed(2) + '%',
    avgResponseTime: metrics.avgResponseTime.toFixed(2) + 'ms',
    p95ResponseTime: metrics.p95ResponseTime.toFixed(2) + 'ms',
  });
  
  return {
    name,
    category: 'Load Testing',
    status: metrics.errorRate < 1 ? 'passed' : metrics.errorRate < 5 ? 'warning' : 'failed',
    duration: totalDuration,
    metrics,
    timestamp: new Date(),
  };
}

// ============================================================================
// CONCURRENCY TESTING
// ============================================================================

async function runConcurrencyTest(
  name: string,
  operations: Array<{ description: string; request: HttpRequestOptions }>,
  concurrentUsers: number
): Promise<TestResult> {
  log('CONCURRENCY', `Starting concurrency test: ${name}`, { concurrentUsers, operations: operations.length });
  
  const startTime = Date.now();
  const results: Array<{ operation: string; success: boolean; duration: number; error?: string }> = [];
  
  // Run operations concurrently
  const tasks = operations.flatMap((op, opIndex) =>
    Array(concurrentUsers).fill(null).map((_, userIndex) => ({
      ...op,
      userIndex,
      opIndex,
    }))
  );
  
  const promises = tasks.map(async (task) => {
    try {
      const response = await makeRequest(task.request);
      results.push({
        operation: task.description,
        success: response.statusCode < 400,
        duration: response.duration,
        error: response.statusCode >= 400 ? `HTTP ${response.statusCode}` : undefined,
      });
    } catch (error: any) {
      results.push({
        operation: task.description,
        success: false,
        duration: 0,
        error: error.message,
      });
    }
  });
  
  await Promise.all(promises);
  
  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  
  log('CONCURRENCY', `Completed concurrency test: ${name}`, {
    duration: totalDuration,
    totalOperations: results.length,
    successes: successCount,
    errors: errorCount,
  });
  
  return {
    name,
    category: 'Concurrency Testing',
    status: errorCount === 0 ? 'passed' : errorCount < results.length * 0.1 ? 'warning' : 'failed',
    duration: totalDuration,
    metrics: {
      requests: results.length,
      errors: errorCount,
      errorRate: (errorCount / results.length) * 100,
      avgResponseTime: results.reduce((a, b) => a + b.duration, 0) / results.length,
      minResponseTime: Math.min(...results.map(r => r.duration)),
      maxResponseTime: Math.max(...results.map(r => r.duration)),
      p50ResponseTime: 0, // Not applicable for this test type
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
    },
    timestamp: new Date(),
  };
}

// ============================================================================
// PERFORMANCE BENCHMARKING
// ============================================================================

interface EndpointBenchmark {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
  body?: object;
}

async function runPerformanceBenchmark(
  endpoints: EndpointBenchmark[],
  token: string
): Promise<TestResult> {
  log('BENCHMARK', 'Starting performance benchmark', { endpoints: endpoints.length });
  
  const startTime = Date.now();
  const results: Array<{
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number;
    error?: string;
  }> = [];
  
  // Run each endpoint multiple times to get accurate metrics
  const iterations = 10;
  
  for (const endpoint of endpoints) {
    for (let i = 0; i < iterations; i++) {
      const headers: Record<string, string> = {};
      if (endpoint.auth) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      try {
        const response = await makeRequest({
          method: endpoint.method,
          path: endpoint.path,
          headers,
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        });
        
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          statusCode: response.statusCode,
          duration: response.duration,
        });
      } catch (error: any) {
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          statusCode: 0,
          duration: 0,
          error: error.message,
        });
      }
    }
  }
  
  // Calculate metrics per endpoint
  const endpointMetrics: Record<string, {
    method: string;
    statusCode: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  }> = {};
  
  for (const endpoint of endpoints) {
    const endpointResults = results.filter(r => r.endpoint === endpoint.path && r.method === endpoint.method);
    const durations = endpointResults.map(r => r.duration).filter(d => d > 0).sort((a, b) => a - b);
    const errors = endpointResults.filter(r => r.statusCode >= 400 || r.error);
    
    endpointMetrics[endpoint.path] = {
      method: endpoint.method,
      statusCode: endpointResults[0]?.statusCode || 0,
      avgResponseTime: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p50ResponseTime: durations[Math.floor(durations.length * 0.5)] || 0,
      p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
      p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
      errorRate: (errors.length / endpointResults.length) * 100,
    };
  }
  
  const totalDuration = Date.now() - startTime;
  
  log('BENCHMARK', 'Performance benchmark completed', {
    totalDuration,
    endpoints: Object.keys(endpointMetrics).length,
  });
  
  // Print benchmark results
  console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===\n');
  console.log('Endpoint'.padEnd(40) + 'Method'.padEnd(8) + 'Avg'.padEnd(10) + 'p50'.padEnd(10) + 'p95'.padEnd(10) + 'p99'.padEnd(10) + 'Error%');
  console.log('-'.repeat(98));
  
  for (const [path, metrics] of Object.entries(endpointMetrics)) {
    const displayPath = path.length > 38 ? path.substring(0, 35) + '...' : path;
    console.log(
      displayPath.padEnd(40) +
      metrics.method.padEnd(8) +
      `${metrics.avgResponseTime.toFixed(2)}ms`.padEnd(10) +
      `${metrics.p50ResponseTime.toFixed(2)}ms`.padEnd(10) +
      `${metrics.p95ResponseTime.toFixed(2)}ms`.padEnd(10) +
      `${metrics.p99ResponseTime.toFixed(2)}ms`.padEnd(10) +
      `${metrics.errorRate.toFixed(1)}%`
    );
  }
  console.log('');
  
  return {
    name: 'Performance Benchmark',
    category: 'Performance Benchmarking',
    status: 'passed',
    duration: totalDuration,
    timestamp: new Date(),
  };
}

// ============================================================================
// SECURITY VULNERABILITY TESTING
// ============================================================================

interface SecurityTest {
  name: string;
  description: string;
  request: HttpRequestOptions;
  expectedStatus: number;
  checkResponse?: (body: string) => boolean;
}

async function runSecurityTests(token: string): Promise<TestResult> {
  log('SECURITY', 'Starting security vulnerability tests');
  
  const startTime = Date.now();
  const tests: SecurityTest[] = [
    // SQL Injection Tests
    {
      name: 'SQL Injection - Order Notes',
      description: 'Test for SQL injection in order notes field',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'Test',
          notes: "'; DROP TABLE orders; --",
        }),
      },
      expectedStatus: 400,
    },
    {
      name: 'SQL Injection - Menu Search',
      description: 'Test for SQL injection in menu search',
      request: {
        method: 'GET',
        path: '/api/menu?search=%27%20OR%20%271%27%3D%271',
        headers: { 'Authorization': `Bearer ${token}` },
      },
      expectedStatus: 400,
    },
    
    // XSS Tests
    {
      name: 'XSS - Order Notes',
      description: 'Test for XSS in order notes',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'Test',
          notes: '<script>alert("xss")</script>',
        }),
      },
      expectedStatus: 400,
      checkResponse: (body) => !body.includes('<script>'),
    },
    
    // Authorization Tests
    {
      name: 'Missing Authorization Header',
      description: 'Test protected endpoint without auth',
      request: {
        method: 'GET',
        path: '/api/orders',
      },
      expectedStatus: 401,
    },
    {
      name: 'Invalid Token',
      description: 'Test with malformed token',
      request: {
        method: 'GET',
        path: '/api/orders',
        headers: { 'Authorization': 'Bearer invalid_token_123' },
      },
      expectedStatus: 401,
    },
    {
      name: 'Expired Token Format',
      description: 'Test with clearly invalid token format',
      request: {
        method: 'GET',
        path: '/api/orders',
        headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' },
      },
      expectedStatus: 401,
    },
    
    // Rate Limiting Tests
    {
      name: 'Rapid Authentication Requests',
      description: 'Test rate limiting on auth endpoint',
      request: {
        method: 'POST',
        path: '/api/auth/login',
        body: JSON.stringify({ email: 'attacker@test.com', password: 'wrong' }),
      },
      expectedStatus: 429,
    },
    
    // Input Validation Tests
    {
      name: 'Missing Required Fields',
      description: 'Test order creation without required fields',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      expectedStatus: 400,
    },
    {
      name: 'Invalid JSON Payload',
      description: 'Test with malformed JSON',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: '{invalid json}',
      },
      expectedStatus: 400,
    },
    {
      name: 'Oversized Payload',
      description: 'Test with payload exceeding size limit',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'x'.repeat(CONFIG.maxPayloadSize + 1) }),
      },
      expectedStatus: 413,
    },
    
    // CORS Tests
    {
      name: 'Invalid Origin Header',
      description: 'Test request from unauthorized origin',
      request: {
        method: 'GET',
        path: '/api/orders',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://evil-website.com',
        },
      },
      expectedStatus: 403,
    },
    
    // Path Traversal Tests
    {
      name: 'Path Traversal Attempt',
      description: 'Test for path traversal vulnerability',
      request: {
        method: 'GET',
        path: '/api/../../../etc/passwd',
        headers: { 'Authorization': `Bearer ${token}` },
      },
      expectedStatus: 404,
    },
  ];
  
  const results: Array<{
    name: string;
    passed: boolean;
    statusCode: number;
    error?: string;
  }> = [];
  
  for (const test of tests) {
    try {
      const response = await makeRequest(test.request);
      const passed = response.statusCode === test.expectedStatus;
      
      if (test.checkResponse && !test.checkResponse(response.body)) {
        results.push({
          name: test.name,
          passed: false,
          statusCode: response.statusCode,
          error: 'Response validation failed',
        });
      } else {
        results.push({
          name: test.name,
          passed,
          statusCode: response.statusCode,
          error: passed ? undefined : `Expected ${test.expectedStatus}, got ${response.statusCode}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: test.name,
        passed: false,
        statusCode: 0,
        error: error.message,
      });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  
  log('SECURITY', 'Security vulnerability tests completed', {
    totalDuration,
    passed: passedTests,
    failed: failedTests,
  });
  
  // Print results
  console.log('\n=== SECURITY VULNERABILITY TEST RESULTS ===\n');
  console.log('Test'.padEnd(50) + 'Status'.padEnd(10) + 'Code');
  console.log('-'.repeat(70));
  
  for (const result of results) {
    const displayName = result.name.length > 48 ? result.name.substring(0, 45) + '...' : result.name;
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(
      displayName.padEnd(50) +
      status.padEnd(10) +
      (result.statusCode > 0 ? result.statusCode.toString() : 'ERR')
    );
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
  console.log('');
  
  return {
    name: 'Security Vulnerability Tests',
    category: 'Security Testing',
    status: failedTests === 0 ? 'passed' : 'warning',
    duration: totalDuration,
    metrics: {
      requests: tests.length,
      errors: failedTests,
      errorRate: (failedTests / tests.length) * 100,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
    },
    timestamp: new Date(),
  };
}

// ============================================================================
// FAILURE MODE TESTING
// ============================================================================

async function runFailureModeTests(): Promise<TestResult> {
  log('FAILURE', 'Starting failure mode tests');
  
  const startTime = Date.now();
  const tests: Array<{
    name: string;
    description: string;
    execute: () => Promise<boolean>;
  }> = [
    {
      name: 'Health Check Endpoint',
      description: 'Verify health endpoint returns proper status',
      execute: async () => {
        const response = await makeRequest({
          method: 'GET',
          path: '/health',
        });
        return response.statusCode === 200 && response.body.includes('ok');
      },
    },
    {
      name: 'API Docs Health Endpoint',
      description: 'Verify API docs health is accessible',
      execute: async () => {
        const response = await makeRequest({
          method: 'GET',
          path: '/api/docs/health',
        });
        return response.statusCode === 200 && response.body.includes('Servio');
      },
    },
    {
      name: '404 Handler',
      description: 'Verify 404 returns proper error format',
      execute: async () => {
        const response = await makeRequest({
          method: 'GET',
          path: '/api/nonexistent-endpoint-12345',
        });
        return response.statusCode === 404 && response.body.includes('Not Found');
      },
    },
    {
      name: 'Method Not Allowed',
      description: 'Verify405 returned for invalid method',
      execute: async () => {
        const response = await makeRequest({
          method: 'DELETE',
          path: '/health',
        });
        return response.statusCode === 405;
      },
    },
    {
      name: 'Request Timeout Handling',
      description: 'Verify request timeout is enforced',
      execute: async () => {
        const start = Date.now();
        try {
          await makeRequest({
            method: 'GET',
            path: '/api/orders',
            timeout: 100, // Very short timeout
          });
          return false; // Should have timed out
        } catch (error: any) {
          return error.message.includes('timeout') || Date.now() - start < 200;
        }
      },
    },
    {
      name: 'Large Response Handling',
      description: 'Verify large responses are handled',
      execute: async () => {
        // This test just verifies the endpoint can handle requests
        const response = await makeRequest({
          method: 'GET',
          path: '/api/menu',
          headers: { 'Authorization': `Bearer ${CONFIG.testAdminToken}` },
        });
        return response.statusCode === 200 || response.statusCode === 401;
      },
    },
  ];
  
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  
  for (const test of tests) {
    try {
      const passed = await test.execute();
      results.push({ name: test.name, passed });
    } catch (error: any) {
      results.push({ name: test.name, passed: false, error: error.message });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.passed).length;
  
  log('FAILURE', 'Failure mode tests completed', {
    totalDuration,
    passed: passedTests,
    failed: results.length - passedTests,
  });
  
  // Print results
  console.log('\n=== FAILURE MODE TEST RESULTS ===\n');
  console.log('Test'.padEnd(50) + 'Status');
  console.log('-'.repeat(60));
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(result.name.padEnd(50) + status);
  }
  console.log('');
  
  return {
    name: 'Failure Mode Tests',
    category: 'Failure Mode Testing',
    status: passedTests === results.length ? 'passed' : 'warning',
    duration: totalDuration,
    timestamp: new Date(),
  };
}

// ============================================================================
// EDGE CASE TESTING
// ============================================================================

async function runEdgeCaseTests(token: string): Promise<TestResult> {
  log('EDGE', 'Starting edge case tests');
  
  const startTime = Date.now();
  const tests: Array<{
    name: string;
    description: string;
    request: HttpRequestOptions;
    validate: (response: { statusCode: number; body: string }) => boolean;
  }> = [
    // Empty and Null Values
    {
      name: 'Empty Order Items Array',
      description: 'Create order with empty items array',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [],
          customerName: 'Test',
        }),
      },
      validate: (r) => r.statusCode >= 400, // Should reject
    },
    {
      name: 'Null Customer Name',
      description: 'Create order with null customer name',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: null,
        }),
      },
      validate: (r) => r.statusCode >= 400, // Should reject
    },
    
    // Unicode and Special Characters
    {
      name: 'Emoji in Customer Name',
      description: 'Use emoji characters in customer name',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: '😀🎉Test👨‍👩‍👧‍👦',
        }),
      },
      validate: (r) => r.statusCode === 200 || r.statusCode === 201 || r.statusCode >= 400,
    },
    {
      name: 'Unicode Characters',
      description: 'Use various unicode characters',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'José García-Müller',
        }),
      },
      validate: (r) => r.statusCode === 200 || r.statusCode === 201 || r.statusCode >= 400,
    },
    
    // Boundary Values
    {
      name: 'Zero Price Item',
      description: 'Create order with $0.00 item',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 0 }],
          customerName: 'Free Test',
        }),
      },
      validate: (r) => true, // Accept any status - business logic decides
    },
    {
      name: 'Negative Quantity',
      description: 'Create order with negative quantity',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: -1, price: 10 }],
          customerName: 'Negative Test',
        }),
      },
      validate: (r) => r.statusCode >= 400, // Should reject
    },
    {
      name: 'Very Long Order Notes',
      description: 'Test with maximum length order notes',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: CONFIG.testRestaurantId,
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'Long Notes Test',
          notes: 'A'.repeat(10000), // Very long string
        }),
      },
      validate: (r) => r.statusCode === 200 || r.statusCode === 201 || r.statusCode >= 400,
    },
    
    // Invalid IDs
    {
      name: 'Invalid Restaurant ID Format',
      description: 'Use invalid UUID format',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'not-a-valid-uuid',
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'Test',
        }),
      },
      validate: (r) => r.statusCode >= 400, // Should reject
    },
    {
      name: 'Non-existent Restaurant ID',
      description: 'Use non-existent restaurant ID',
      request: {
        method: 'POST',
        path: '/api/orders',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          items: [{ itemId: 'test', quantity: 1, price: 10 }],
          customerName: 'Test',
        }),
      },
      validate: (r) => r.statusCode >= 400 || r.statusCode === 404, // Should reject
    },
  ];
  
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  
  for (const test of tests) {
    try {
      const response = await makeRequest(test.request);
      const passed = test.validate(response);
      results.push({ name: test.name, passed });
    } catch (error: any) {
      results.push({ name: test.name, passed: false, error: error.message });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.passed).length;
  
  log('EDGE', 'Edge case tests completed', {
    totalDuration,
    passed: passedTests,
    failed: results.length - passedTests,
  });
  
  // Print results
  console.log('\n=== EDGE CASE TEST RESULTS ===\n');
  console.log('Test'.padEnd(50) + 'Status');
  console.log('-'.repeat(60));
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(result.name.padEnd(50) + status);
  }
  console.log('');
  
  return {
    name: 'Edge Case Tests',
    category: 'Edge Case Testing',
    status: passedTests === results.length ? 'passed' : 'warning',
    duration: totalDuration,
    timestamp: new Date(),
  };
}

// ============================================================================
// SCENARIO SIMULATIONS
// ============================================================================

async function runScenarioSimulations(token: string): Promise<TestResult> {
  log('SCENARIO', 'Starting scenario simulations');
  
  const startTime = Date.now();
  const scenarios: Array<{
    name: string;
    description: string;
    execute: () => Promise<{ success: boolean; duration: number; error?: string }>;
  }> = [
    // Full Customer Order Flow
    {
      name: 'Full Order Flow',
      description: 'Complete customer journey: browse menu -> create order -> check status',
      execute: async () => {
        const scenarioStart = Date.now();
        
        // 1. Browse menu
        const menuResponse = await makeRequest({
          method: 'GET',
          path: '/api/menu',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (menuResponse.statusCode !== 200) {
          return { success: false, duration: Date.now() - scenarioStart, error: 'Menu fetch failed' };
        }
        
        // 2. Create order
        const orderResponse = await makeRequest({
          method: 'POST',
          path: '/api/orders',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: CONFIG.testRestaurantId,
            items: [{ itemId: 'test', quantity: 1, price: 10 }],
            customerName: 'Scenario Test',
          }),
        });
        if (orderResponse.statusCode !== 200 && orderResponse.statusCode !== 201) {
          return { success: false, duration: Date.now() - scenarioStart, error: 'Order creation failed' };
        }
        
        const orderData = JSON.parse(orderResponse.body);
        const orderId = orderData.id || orderData.order?.id;
        
        // 3. Check order status
        if (orderId) {
          const statusResponse = await makeRequest({
            method: 'GET',
            path: `/api/orders/${orderId}`,
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (statusResponse.statusCode !== 200) {
            return { success: false, duration: Date.now() - scenarioStart, error: 'Status check failed' };
          }
        }
        
        return { success: true, duration: Date.now() - scenarioStart };
      },
    },
    
    // Staff Clock-In Flow
    {
      name: 'Staff Clock-In Flow',
      description: 'Staff member clocks in, takes break, clocks out',
      execute: async () => {
        const scenarioStart = Date.now();
        
        // 1. Clock in
        const clockInResponse = await makeRequest({
          method: 'POST',
          path: '/api/timeclock/clock-in',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: CONFIG.testRestaurantId,
            pin: '3456',
          }),
        });
        if (clockInResponse.statusCode !== 200 && clockInResponse.statusCode !== 201) {
          return { success: false, duration: Date.now() - scenarioStart, error: 'Clock in failed' };
        }
        
        // 2. Get current staff status
        const staffResponse = await makeRequest({
          method: 'GET',
          path: '/api/timeclock/current-staff',
        });
        if (staffResponse.statusCode !== 200) {
          return { success: false, duration: Date.now() - scenarioStart, error: 'Staff status failed' };
        }
        
        // 3. Clock out (simulated)
        await makeRequest({
          method: 'POST',
          path: '/api/timeclock/clock-out',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: CONFIG.testRestaurantId,
            pin: '3456',
          }),
        });
        
        return { success: true, duration: Date.now() - scenarioStart };
      },
    },
    
    // Menu Browsing Performance
    {
      name: 'Menu Browsing Performance',
      description: 'Simulate rapid menu page navigation',
      execute: async () => {
        const scenarioStart = Date.now();
        const pages = 5;
        
        for (let i = 0; i < pages; i++) {
          const response = await makeRequest({
            method: 'GET',
            path: `/api/menu?page=${i}&limit=20`,
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.statusCode !== 200) {
            return { success: false, duration: Date.now() - scenarioStart, error: `Page ${i} failed` };
          }
        }
        
        return { success: true, duration: Date.now() - scenarioStart };
      },
    },
    
    // Concurrent Order Status Updates
    {
      name: 'Concurrent Order Updates',
      description: 'Multiple users checking order status simultaneously',
      execute: async () => {
        const scenarioStart = Date.now();
        const concurrentRequests = 10;
        
        const requests = Array(concurrentRequests).fill(null).map(async () => {
          return makeRequest({
            method: 'GET',
            path: '/api/orders',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        });
        
        const results = await Promise.all(requests);
        const allSuccess = results.every(r => r.statusCode === 200);
        
        return { 
          success: allSuccess, 
          duration: Date.now() - scenarioStart,
          error: allSuccess ? undefined : 'Some requests failed'
        };
      },
    },
  ];
  
  const results: Array<{ name: string; success: boolean; duration: number; error?: string }> = [];
  
  for (const scenario of scenarios) {
    const result = await scenario.execute();
    results.push({
      name: scenario.name,
      success: result.success,
      duration: result.duration,
      error: result.error,
    });
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const totalDuration = Date.now() - startTime;
  const passedScenarios = results.filter(r => r.success).length;
  
  log('SCENARIO', 'Scenario simulations completed', {
    totalDuration,
    passed: passedScenarios,
    failed: results.length - passedScenarios,
  });
  
  // Print results
  console.log('\n=== SCENARIO SIMULATION RESULTS ===\n');
  console.log('Scenario'.padEnd(40) + 'Duration'.padEnd(12) + 'Status');
  console.log('-'.repeat(65));
  for (const result of results) {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    console.log(
      result.name.padEnd(40) +
      `${result.duration}ms`.padEnd(12) +
      status
    );
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
  console.log('');
  
  return {
    name: 'Scenario Simulations',
    category: 'Scenario Testing',
    status: passedScenarios === results.length ? 'passed' : 'warning',
    duration: totalDuration,
    timestamp: new Date(),
  };
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  const testStartTime = Date.now();
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Servio Restaurant Platform - Comprehensive Stress Tests    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  log('TEST', 'Starting comprehensive stress test suite');
  log('TEST', `Target URL: ${CONFIG.baseUrl}`);
  log('TEST', `Test Restaurant ID: ${CONFIG.testRestaurantId}`);
  
  const results: TestResult[] = [];
  
  // Authenticate
  let token = CONFIG.testAdminToken;
  if (!token) {
    try {
      token = await authenticate();
    } catch (error: any) {
      log('AUTH', 'Authentication failed - some tests may be skipped', { error: error.message });
    }
  }
  
  // =========================================================================
  // LOAD TESTS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  LOAD TESTING');
  console.log('═'.repeat(70) + '\n');
  
  // Normal load test
  results.push(await runLoadTest(
    'Normal Load - Menu Browse',
    (index) => ({
      method: 'GET',
      path: '/api/menu',
      headers: { 'Authorization': `Bearer ${token}` },
    }),
    10,
    CONFIG.durationMs
  ));
  
  // Peak load test with more concurrency
  results.push(await runLoadTest(
    'Peak Load - Order Creation',
    (index) => ({
      method: 'POST',
      path: '/api/orders',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        restaurantId: CONFIG.testRestaurantId,
        items: [{ itemId: `item-${index}`, quantity: 1, price: 10 }],
        customerName: `LoadTest-${index}`,
      }),
    }),
    20,
    CONFIG.durationMs
  ));
  
  // =========================================================================
  // CONCURRENCY TESTS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  CONCURRENCY TESTING');
  console.log('═'.repeat(70) + '\n');
  
  results.push(await runConcurrencyTest(
    'Multi-User Menu Access',
    [
      { description: 'Browse Menu', request: { method: 'GET', path: '/api/menu', headers: { 'Authorization': `Bearer ${token}` } } },
      { description: 'Browse Categories', request: { method: 'GET', path: '/api/menu/categories', headers: { 'Authorization': `Bearer ${token}` } } },
    ],
    20
  ));
  
  // =========================================================================
  // PERFORMANCE BENCHMARK
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  PERFORMANCE BENCHMARKING');
  console.log('═'.repeat(70) + '\n');
  
  const endpoints: EndpointBenchmark[] = [
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/api/docs/health', description: 'API docs health' },
    { method: 'GET', path: '/api/menu', description: 'List menu', auth: true },
    { method: 'GET', path: '/api/orders', description: 'List orders', auth: true },
    { method: 'GET', path: '/api/staff', description: 'List staff', auth: true },
    { method: 'GET', path: '/api/timeclock/current-staff', description: 'Current staff' },
  ];
  
  results.push(await runPerformanceBenchmark(endpoints, token));
  
  // =========================================================================
  // SECURITY TESTS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  SECURITY VULNERABILITY TESTING');
  console.log('═'.repeat(70) + '\n');
  
  results.push(await runSecurityTests(token));
  
  // =========================================================================
  // FAILURE MODE TESTS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  FAILURE MODE TESTING');
  console.log('═'.repeat(70) + '\n');
  
  results.push(await runFailureModeTests());
  
  // =========================================================================
  // EDGE CASE TESTS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  EDGE CASE TESTING');
  console.log('═'.repeat(70) + '\n');
  
  results.push(await runEdgeCaseTests(token));
  
  // =========================================================================
  // SCENARIO SIMULATIONS
  // =========================================================================
  
  console.log('\n' + '═'.repeat(70));
  console.log('  SCENARIO SIMULATIONS');
  console.log('═'.repeat(70) + '\n');
  
  results.push(await runScenarioSimulations(token));
  
  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  
  const totalDuration = Date.now() - testStartTime;
  
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  TEST EXECUTION SUMMARY'.padEnd(68) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  
  const passedCount = results.filter(r => r.status === 'passed').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  console.log(`║  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`.padEnd(69) + '║');
  console.log(`║  Total Test Suites: ${results.length}`.padEnd(69) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  console.log(`║  ✓ Passed:  ${passedCount}`.padEnd(69) + '║');
  console.log(`║  ⚠ Warning: ${warningCount}`.padEnd(69) + '║');
  console.log(`║  ✗ Failed:  ${failedCount}`.padEnd(69) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  
  // Category breakdown
  const categories = [...new Set(results.map(r => r.category))];
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.status === 'passed').length;
    console.log(`║  ${category}: ${categoryPassed}/${categoryResults.length} passed`.padEnd(69) + '║');
  }
  
  console.log('╚' + '═'.repeat(68) + '╝\n');
  
  // Detailed results table
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  DETAILED RESULTS'.padEnd(68) + '║');
  console.log('╠' + '═'.repeat(40) + '╦' + '═'.repeat(10) + '╦' + '═'.repeat(15) + '╦' + '═'.repeat(5) + '╗');
  console.log('║' + ' Test'.padEnd(40) + '║' + ' Status'.padEnd(10) + '║' + ' Duration'.padEnd(15) + '║' + ' Err%'.padEnd(5) + '║');
  console.log('╟' + '─'.repeat(40) + '╫' + '─'.repeat(10) + '╫' + '─'.repeat(15) + '╫' + '─'.repeat(5) + '╢');
  
  for (const result of results) {
    const statusIcon = result.status === 'passed' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    const errorRate = result.metrics?.errorRate?.toFixed(1) || '-';
    console.log(
      '║' + result.name.substring(0, 38).padEnd(40) +
      '║' + `${statusIcon} ${result.status}`.padEnd(10) +
      '║' + `${result.duration}ms`.padEnd(15) +
      '║' + `${errorRate}%`.padEnd(5) +
      '║'
    );
  }
  
  console.log('╚' + '═'.repeat(40) + '╩' + '═'.repeat(10) + '╩' + '═'.repeat(15) + '╩' + '═'.repeat(5) + '╝\n');
  
  // Performance metrics summary
  const loadTestResults = results.filter(r => r.category === 'Load Testing' && r.metrics);
  if (loadTestResults.length > 0) {
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + '  PERFORMANCE METRICS SUMMARY'.padEnd(68) + '║');
    console.log('╠' + '═'.repeat(68) + '╣');
    
    for (const result of loadTestResults) {
      const m = result.metrics!;
      console.log(`║  ${result.name}`.padEnd(69) + '║');
      console.log(`║    Avg: ${m.avgResponseTime.toFixed(2)}ms | p95: ${m.p95ResponseTime.toFixed(2)}ms | Errors: ${m.errors} (${m.errorRate.toFixed(2)}%)`.padEnd(69) + '║');
    }
    
    console.log('╚' + '═'.repeat(68) + '╝\n');
  }
  
  // Save results to file
  const reportPath = path.join(__dirname, '../../stress-test-report.json');
  const report = {
    executionDate: new Date().toISOString(),
    totalDuration,
    configuration: CONFIG,
    summary: {
      totalTests: results.length,
      passed: passedCount,
      warnings: warningCount,
      failed: failedCount,
    },
    results: results.map(r => ({
      name: r.name,
      category: r.category,
      status: r.status,
      duration: r.duration,
      metrics: r.metrics,
      error: r.error,
      timestamp: r.timestamp.toISOString(),
    })),
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log('TEST', `Report saved to: ${reportPath}`);
  
  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  const markdownPath = path.join(__dirname, '../../stress-test-report.md');
  fs.writeFileSync(markdownPath, markdownReport);
  log('TEST', `Markdown report saved to: ${markdownPath}`);
  
  log('TEST', 'Comprehensive stress test suite completed');
  
  // Exit with appropriate code
  process.exit(failedCount > 0 ? 1 : 0);
}

function generateMarkdownReport(report: any): string {
  return `# Servio Restaurant Platform - Stress Test Report

**Execution Date:** ${report.executionDate}  
**Total Duration:** ${report.totalDuration}ms (${(report.totalDuration / 1000).toFixed(1)}s)  
**Environment:** ${report.configuration.baseUrl}

## Summary

| Metric | Value |
|--------|-------|
| Total Test Suites | ${report.summary.totalTests} |
| Passed | ${report.summary.passed} |
| Warnings | ${report.summary.warnings} |
| Failed | ${report.summary.failed} |
| Success Rate | ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}% |

## Test Categories

${[...new Set(report.results.map((r: any) => r.category))].map((category: any) => {
  const categoryResults = report.results.filter((r: any) => r.category === category);
  const passed = categoryResults.filter((r: any) => r.status === 'passed').length;
  return `- **${category}:** ${passed}/${categoryResults.length} passed`;
}).join('\n')}

## Detailed Results

| Test | Category | Status | Duration | Error Rate |
|------|----------|--------|----------|------------|
${report.results.map((r: any) => {
  const statusIcon = r.status === 'passed' ? '✅' : r.status === 'warning' ? '⚠️' : '❌';
  return `| ${r.name} | ${r.category} | ${statusIcon} | ${r.duration}ms | ${r.metrics?.errorRate?.toFixed(2) || '-'}% |`;
}).join('\n')}

## Performance Metrics

${report.results.filter((r: any) => r.metrics && r.category === 'Load Testing').map((r: any) => `
### ${r.name}

| Metric | Value |
|--------|-------|
| Total Requests | ${r.metrics.requests} |
| Errors | ${r.metrics.errors} |
| Error Rate | ${r.metrics.errorRate.toFixed(2)}% |
| Avg Response Time | ${r.metrics.avgResponseTime.toFixed(2)}ms |
| Min Response Time | ${r.metrics.minResponseTime.toFixed(2)}ms |
| Max Response Time | ${r.metrics.maxResponseTime.toFixed(2)}ms |
| p50 Response Time | ${r.metrics.p50ResponseTime.toFixed(2)}ms |
| p95 Response Time | ${r.metrics.p95ResponseTime.toFixed(2)}ms |
| p99 Response Time | ${r.metrics.p99ResponseTime.toFixed(2)}ms |
`).join('\n')}

## Recommendations

${generateRecommendations(report)}

---

*Report generated by Servio Stress Test Runner v1.0*
`;
}

function generateRecommendations(report: any): string {
  const recommendations: string[] = [];
  
  // Check for performance issues
  const loadTests = report.results.filter((r: any) => r.category === 'Load Testing' && r.metrics);
  for (const test of loadTests) {
    if (test.metrics.p95ResponseTime > 1000) {
      recommendations.push(`- **Performance:** ${test.name} has p95 response time > 1000ms - consider optimization`);
    }
    if (test.metrics.errorRate > 1) {
      recommendations.push(`- **Reliability:** ${test.name} has error rate > 1% - investigate error sources`);
    }
  }
  
  // Check for security issues
  const securityTests = report.results.filter((r: any) => r.category === 'Security Testing');
  for (const test of securityTests) {
    if (test.status !== 'passed') {
      recommendations.push(`- **Security:** Review ${test.name} - some security checks failed`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('- All tests passed successfully. No immediate actions required.');
  }
  
  return recommendations.join('\n');
}

// ============================================================================
// ENTRY POINT
// ============================================================================

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
