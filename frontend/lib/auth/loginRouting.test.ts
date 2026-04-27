import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_LANDING_ROUTE,
  DEFAULT_USER_LANDING_ROUTE,
  ONBOARDING_ROUTE,
  getPostLoginRoute,
} from './loginRouting.ts';

test('routes admin users directly to admin landing page without onboarding status check', async () => {
  let onboardingCheckCalls = 0;

  const route = await getPostLoginRoute('admin', async () => {
    onboardingCheckCalls += 1;
    return { data: { data: { onboardingCompleted: false } } };
  });

  assert.equal(route, ADMIN_LANDING_ROUTE);
  assert.equal(onboardingCheckCalls, 0);
});

test('routes staff users to onboarding when onboarding is incomplete', async () => {
  let onboardingCheckCalls = 0;

  const route = await getPostLoginRoute('staff', async () => {
    onboardingCheckCalls += 1;
    return { data: { data: { onboardingCompleted: false } } };
  });

  assert.equal(route, ONBOARDING_ROUTE);
  assert.equal(onboardingCheckCalls, 1);
});

test('routes owners to dashboard when onboarding is complete', async () => {
  let onboardingCheckCalls = 0;

  const route = await getPostLoginRoute('owner', async () => {
    onboardingCheckCalls += 1;
    return { data: { data: { onboardingCompleted: true } } };
  });

  assert.equal(route, DEFAULT_USER_LANDING_ROUTE);
  assert.equal(onboardingCheckCalls, 1);
});
