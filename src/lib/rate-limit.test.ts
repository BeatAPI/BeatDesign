import assert from 'node:assert/strict';
import test from 'node:test';

import { enforceMinIntervalRateLimit } from './rate-limit';

test('cookie changes cannot bypass a cookie-independent rate limit', () => {
  const url = `https://example.com/api/test-${crypto.randomUUID()}`;
  const first = new Request(url, {
    method: 'POST',
    headers: { cookie: 'session=one', 'x-forwarded-for': '203.0.113.10' },
  });
  const second = new Request(url, {
    method: 'POST',
    headers: { cookie: 'session=two', 'x-forwarded-for': '203.0.113.10' },
  });
  const options = {
    intervalMs: 60_000,
    keyPrefix: 'cookie-independent-test',
    extraKey: 'same-email',
    includeCookie: false,
  };

  assert.equal(enforceMinIntervalRateLimit(first, options), null);
  assert.equal(enforceMinIntervalRateLimit(second, options)?.status, 429);
});
