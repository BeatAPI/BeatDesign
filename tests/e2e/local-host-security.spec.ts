import { test, expect } from '@playwright/test';

test('production workspace rejects rebound Host for reads and same-origin mutations', async ({request}) => {
  const before = await (await request.get('/api/app/projects')).json();
  for (const path of ['/api/ping', '/api/app/projects', '/']) {
    const response = await request.get(path, {headers:{host:'attacker.example:3042',origin:'http://attacker.example:3042','sec-fetch-site':'same-origin'}});
    expect(response.status()).toBe(403);
  }
  const mutation = await request.post('/api/app/projects', {headers:{host:'attacker.example:3042',origin:'http://attacker.example:3042','sec-fetch-site':'same-origin','x-beatapi-workspace-request':'1'}, data:{name:'Blocked rebound request'}});
  expect(mutation.status()).toBe(403);
  const after = await (await request.get('/api/app/projects')).json();
  expect(after).toEqual(before);
});
