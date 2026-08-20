import assert from 'node:assert/strict';
import test from 'node:test';
import {
  respData,
  respErr,
  respForbidden,
  respInternalError,
  respUnauthorized,
} from './resp';

test('error envelopes use meaningful HTTP status codes', async () => {
  assert.equal(respErr('Bad request').status, 400);
  assert.equal(respErr('Missing', 404).status, 404);
  assert.equal(respUnauthorized().status, 401);
  assert.equal(respForbidden().status, 403);
  assert.equal(respInternalError().status, 500);
});

test('response data preserves valid falsy values', async () => {
  assert.deepEqual(await respData(0).json(), {
    code: 0,
    message: 'ok',
    data: 0,
  });
});
