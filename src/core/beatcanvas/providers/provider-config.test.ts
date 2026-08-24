import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BEATAPI_BASE_URL,
  getBeatCanvasProviderPublicConfig,
  getBeatCanvasProviderServerConfig,
  isOfficialBeatApiBaseUrl,
  resolveBeatCanvasProviderId,
} from './provider-config';

test('BeatAPI is the default BeatCanvas generation provider', () => {
  assert.equal(resolveBeatCanvasProviderId(undefined), 'beatapi');
  assert.deepEqual(getBeatCanvasProviderPublicConfig(undefined), {
    id: 'beatapi',
    label: 'BeatAPI',
    isDefault: true,
    supports: ['image', 'video', 'analysis'],
  });
});

test('default server config points to the production BeatAPI endpoint', () => {
  assert.equal(
    getBeatCanvasProviderServerConfig().baseUrl,
    DEFAULT_BEATAPI_BASE_URL
  );
  assert.equal(
    getBeatCanvasProviderServerConfig({
      baseUrl: 'https://attacker.example',
      apiKey: 'sk-test',
    }).baseUrl,
    DEFAULT_BEATAPI_BASE_URL
  );
});

test('managed storage eligibility is limited to the official BeatAPI billing endpoint', () => {
  assert.equal(isOfficialBeatApiBaseUrl(undefined), true);
  assert.equal(isOfficialBeatApiBaseUrl('https://api.beatapi.io/'), true);
  assert.equal(isOfficialBeatApiBaseUrl('https://api.beatapi.io/v1'), false);
  assert.equal(isOfficialBeatApiBaseUrl('https://api.beatapi.io.example.com'), false);
  assert.equal(isOfficialBeatApiBaseUrl('https://provider.example.com'), false);
  assert.equal(isOfficialBeatApiBaseUrl('not-a-url'), false);
});
