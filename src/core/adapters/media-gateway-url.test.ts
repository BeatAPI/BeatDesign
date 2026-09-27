import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMediaGatewayBaseUrl } from './media-gateway-url';

test('accepts HTTPS gateways and loopback HTTP development URLs', () => {
  assert.equal(
    normalizeMediaGatewayBaseUrl('https://media.example.com/gateway/'),
    'https://media.example.com/gateway'
  );
  assert.equal(
    normalizeMediaGatewayBaseUrl('http://127.0.0.1:8000/'),
    'http://127.0.0.1:8000'
  );
  assert.equal(
    normalizeMediaGatewayBaseUrl('http://flow2api-media:8000/', {
      allowedHttpHosts: ['flow2api-media'],
    }),
    'http://flow2api-media:8000'
  );
});

test('rejects clear-text remote, credentialed, and query-bearing gateways', () => {
  for (const url of [
    'http://media.example.com',
    'http://flow2api-media:8000',
    'https://user:pass@media.example.com',
    'https://media.example.com?key=secret',
    'file:///tmp/gateway',
  ]) {
    assert.throws(() => normalizeMediaGatewayBaseUrl(url));
  }
});
