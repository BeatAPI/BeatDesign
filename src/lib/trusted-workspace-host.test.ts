import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedWorkspaceHost } from './trusted-workspace-host';

test('accepts only local authorities, with matching Host when supplied', () => {
  for (const host of ['localhost:3020', '127.0.0.1:3020', '[::1]:3020']) {
    assert.equal(isTrustedWorkspaceHost(new Request(`http://${host}/api/app/projects`, {headers: {host}})), true);
  }
  for (const host of ['attacker.example:3020', '127.0.0.1.attacker.example:3020', 'localhost.attacker.example:3020', '192.168.1.2:3020']) {
    assert.equal(isTrustedWorkspaceHost(new Request(`http://${host}/api/app/projects`, {headers: {host, origin:`http://${host}`, 'sec-fetch-site':'same-origin'}})), false);
  }
  assert.equal(isTrustedWorkspaceHost(new Request('http://localhost:3020/api/app/projects', {headers:{host:'attacker.example:3020'}})), false);
});
