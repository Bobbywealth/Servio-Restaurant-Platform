import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStatus } from './utils.ts';

test('normalizes ready and completed as distinct canonical statuses', () => {
  assert.equal(normalizeStatus('ready'), 'ready');
  assert.equal(normalizeStatus('READY'), 'ready');
  assert.equal(normalizeStatus(' completed '), 'completed');
  assert.equal(normalizeStatus('COMPLETED'), 'completed');
});

test('normalizes picked-up aliases to ready', () => {
  assert.equal(normalizeStatus('picked-up'), 'ready');
  assert.equal(normalizeStatus('picked up'), 'ready');
  assert.equal(normalizeStatus('PiCkEd Up'), 'ready');
});

test('keeps existing aliases for received and preparing', () => {
  assert.equal(normalizeStatus('new'), 'received');
  assert.equal(normalizeStatus('preparing'), 'preparing');
  assert.equal(normalizeStatus('in-progress'), 'preparing');
});
