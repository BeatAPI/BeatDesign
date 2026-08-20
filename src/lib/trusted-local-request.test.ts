import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
  validateTrustedLocalJsonMutation,
  validateTrustedWorkspaceJsonMutation,
} from './trusted-local-request';

const request = (headers: Record<string, string>) =>
  new Request('http://127.0.0.1:3020/api/config/beatapi', {
    method: 'POST',
    headers,
    body: JSON.stringify({ apiKey: 'test-key' }),
  });

test('accepts a same-origin local JSON settings mutation', () => {
  assert.deepEqual(
    validateTrustedLocalJsonMutation(
      request({
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:3020',
        'sec-fetch-site': 'same-origin',
        [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
      })
    ),
    { ok: true }
  );
});

test('rejects cross-site, simple-content, and marker-free settings requests', () => {
  const cases = [
    request({
      'content-type': 'application/json',
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
      [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
    }),
    request({
      'content-type': 'text/plain',
      [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
    }),
    request({ 'content-type': 'application/json' }),
  ];

  for (const candidate of cases) {
    assert.equal(validateTrustedLocalJsonMutation(candidate).ok, false);
  }
});

test('accepts same-origin workspace mutations on an access-controlled deployment', () => {
  const hostedRequest = new Request(
    'https://workspace.example/api/app/projects',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://workspace.example',
        'sec-fetch-site': 'same-origin',
        [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
      },
      body: JSON.stringify({ name: 'Project' }),
    }
  );

  assert.deepEqual(validateTrustedWorkspaceJsonMutation(hostedRequest), {
    ok: true,
  });
  assert.equal(validateTrustedLocalJsonMutation(hostedRequest).ok, false);
});
