import assert from 'node:assert/strict';
import test from 'node:test';

import { getWwwRedirectLocation } from './canonical-url';

test('redirects www hosts to the https apex host', () => {
  assert.equal(
    getWwwRedirectLocation('http://www.beat-ai.example/templates?tab=video'),
    'https://beat-ai.example/templates?tab=video'
  );
});

test('redirects any www subdomain to its non-www canonical host', () => {
  assert.equal(
    getWwwRedirectLocation('https://www.assets.beat-ai.example/path#preview'),
    'https://assets.beat-ai.example/path#preview'
  );
});

test('does not redirect canonical or local hosts', () => {
  assert.equal(getWwwRedirectLocation('https://beat-ai.example/'), null);
  assert.equal(getWwwRedirectLocation('http://www.localhost:3002/'), null);
});
