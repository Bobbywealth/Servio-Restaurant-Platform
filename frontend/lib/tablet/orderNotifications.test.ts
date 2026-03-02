import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRefreshForNotification } from './orderNotifications';

test('should refresh for known notification type', () => {
  const warnings: Array<{ message: string; payload: unknown }> = [];

  const result = shouldRefreshForNotification(
    { notification: { type: 'order.created_web' } },
    (message, payload) => warnings.push({ message, payload })
  );

  assert.equal(result, true);
  assert.equal(warnings.length, 0);
});

test('should ignore payload when notification is missing', () => {
  const warnings: Array<{ message: string; payload: unknown }> = [];

  const result = shouldRefreshForNotification(
    {},
    (message, payload) => warnings.push({ message, payload })
  );

  assert.equal(result, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /missing type/);
});

test('should ignore payload when notification type is unknown', () => {
  const warnings: Array<{ message: string; payload: unknown }> = [];

  const result = shouldRefreshForNotification(
    { notification: { type: 'order.cancelled' } },
    (message, payload) => warnings.push({ message, payload })
  );

  assert.equal(result, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /unknown type/);
});
