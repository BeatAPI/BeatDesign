import assert from 'node:assert/strict';
import test from 'node:test';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import {
  claimGenerationUploadSlot,
  completeGenerationUploadSlot,
  consumeGenerationUploadIntent,
  failGenerationUploadIntent,
  GenerationIntentQuotaError,
  getGenerationUploadIntentAdmissionState,
  issueGenerationUploadIntent,
} from './generation-upload-intent';

const createTestDb = async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.executeMultiple(`
    CREATE TABLE project (id text PRIMARY KEY NOT NULL);
    CREATE TABLE generation_history (id text PRIMARY KEY NOT NULL);
    CREATE TABLE generation_upload_intent (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      effect_id integer NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      expected_upload_count integer DEFAULT 0 NOT NULL,
      reserved_upload_count integer DEFAULT 0 NOT NULL,
      completed_upload_count integer DEFAULT 0 NOT NULL,
      generation_id text,
      expires_at integer NOT NULL,
      consumed_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE generation_intent_upload (
      id text PRIMARY KEY NOT NULL,
      intent_id text NOT NULL,
      status text DEFAULT 'reserved' NOT NULL,
      storage_provider text,
      bucket text,
      object_key text,
      public_url text,
      filename text,
      mime_type text,
      size_bytes integer,
      created_at integer NOT NULL,
      completed_at integer
    );
    INSERT INTO project (id) VALUES ('project-1');
  `);
  return { client, db: drizzle({ client }) };
};

test('one upload intent allows its exact upload once and binds it to generation input', async () => {
  const { client, db } = await createTestDb();
  try {
    const now = new Date(1_000);
    const intentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 101,
      expectedUploadCount: 1,
      now,
      dbClient: db,
    });
    const slotId = await claimGenerationUploadSlot({
      intentId,
      projectId: 'project-1',
      now: new Date(2_000),
      dbClient: db,
    });
    assert.ok(slotId);
    assert.equal(
      await claimGenerationUploadSlot({
        intentId,
        projectId: 'project-1',
        now: new Date(2_000),
        dbClient: db,
      }),
      null
    );
    assert.equal(
      await completeGenerationUploadSlot({
        intentId,
        upload: {
          slotId,
          provider: 'beatapi',
          bucket: 'beatapi',
          key: 'inputs/file-1.png',
          url: 'https://media.beatapi.io/inputs/file-1.png',
          filename: 'file-1.png',
          mimeType: 'image/png',
          sizeBytes: 123,
        },
        now: new Date(3_000),
        dbClient: db,
      }),
      true
    );
    assert.equal(
      await consumeGenerationUploadIntent({
        intentId,
        projectId: 'project-1',
        effectId: 101,
        referencedUrls: ['https://attacker.example/unrelated.png'],
        now: new Date(4_000),
        dbClient: db,
      }),
      null
    );
    assert.equal(
      await consumeGenerationUploadIntent({
        intentId,
        projectId: 'project-1',
        effectId: 101,
        referencedUrls: [
          'https://media.beatapi.io/inputs/file-1.png',
          'https://attacker.example/extra.png',
        ],
        now: new Date(4_000),
        dbClient: db,
      }),
      null
    );
    assert.ok(
      await consumeGenerationUploadIntent({
        intentId,
        projectId: 'project-1',
        effectId: 101,
        referencedUrls: ['https://media.beatapi.io/inputs/file-1.png'],
        now: new Date(4_000),
        dbClient: db,
      })
    );
    assert.equal(
      await consumeGenerationUploadIntent({
        intentId,
        projectId: 'project-1',
        effectId: 101,
        referencedUrls: ['https://media.beatapi.io/inputs/file-1.png'],
        now: new Date(4_000),
        dbClient: db,
      }),
      null
    );
  } finally {
    client.close();
  }
});

test('zero-upload intents remain valid once and expired intents are rejected', async () => {
  const { client, db } = await createTestDb();
  try {
    const validId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 102,
      expectedUploadCount: 0,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.ok(
      await consumeGenerationUploadIntent({
        intentId: validId,
        projectId: 'project-1',
        effectId: 102,
        referencedUrls: [],
        now: new Date(2_000),
        dbClient: db,
      })
    );

    const projectAssetIntentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 104,
      expectedUploadCount: 0,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.ok(
      await consumeGenerationUploadIntent({
        intentId: projectAssetIntentId,
        projectId: 'project-1',
        effectId: 104,
        referencedUrls: ['https://media.beatapi.io/project/asset.png'],
        authorizedProjectUrls: ['https://media.beatapi.io/project/asset.png'],
        now: new Date(2_000),
        dbClient: db,
      })
    );

    const unknownAssetIntentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 105,
      expectedUploadCount: 0,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.equal(
      await consumeGenerationUploadIntent({
        intentId: unknownAssetIntentId,
        projectId: 'project-1',
        effectId: 105,
        referencedUrls: ['https://attacker.example/reference.png'],
        now: new Date(2_000),
        dbClient: db,
      }),
      null
    );

    const expiredId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 103,
      expectedUploadCount: 0,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.equal(
      await consumeGenerationUploadIntent({
        intentId: expiredId,
        projectId: 'project-1',
        effectId: 103,
        referencedUrls: [],
        now: new Date(601_000),
        dbClient: db,
      }),
      null
    );
  } finally {
    client.close();
  }
});

test('classifies intent failures so only safe zero-upload expiry can auto-refresh', async () => {
  const { client, db } = await createTestDb();
  try {
    const zeroUploadId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 401,
      expectedUploadCount: 0,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.deepEqual(
      await getGenerationUploadIntentAdmissionState({
        intentId: zeroUploadId,
        projectId: 'project-1',
        effectId: 401,
        now: new Date(601_000),
        dbClient: db,
      }),
      { status: 'expired', refreshableWithoutUploads: true }
    );

    const uploadIntentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 402,
      expectedUploadCount: 1,
      now: new Date(1_000),
      dbClient: db,
    });
    assert.deepEqual(
      await getGenerationUploadIntentAdmissionState({
        intentId: uploadIntentId,
        projectId: 'project-1',
        effectId: 402,
        now: new Date(2_000),
        dbClient: db,
      }),
      { status: 'incomplete', expectedUploadCount: 1 }
    );

    assert.ok(
      await consumeGenerationUploadIntent({
        intentId: zeroUploadId,
        projectId: 'project-1',
        effectId: 401,
        referencedUrls: [],
        now: new Date(2_000),
        dbClient: db,
      })
    );
    assert.deepEqual(
      await getGenerationUploadIntentAdmissionState({
        intentId: zeroUploadId,
        projectId: 'project-1',
        effectId: 401,
        now: new Date(3_000),
        dbClient: db,
      }),
      { status: 'used' }
    );

    await failGenerationUploadIntent({
      intentId: uploadIntentId,
      now: new Date(3_000),
      dbClient: db,
    });
    assert.deepEqual(
      await getGenerationUploadIntentAdmissionState({
        intentId: uploadIntentId,
        projectId: 'project-1',
        effectId: 402,
        now: new Date(4_000),
        dbClient: db,
      }),
      { status: 'invalid' }
    );
  } finally {
    client.close();
  }
});

test('zero-upload retries can reuse previously uploaded project files', async () => {
  const { client, db } = await createTestDb();
  try {
    const now = new Date(1_000);
    const firstIntentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 301,
      expectedUploadCount: 1,
      now,
      dbClient: db,
    });
    const slotId = await claimGenerationUploadSlot({
      intentId: firstIntentId,
      projectId: 'project-1',
      now: new Date(2_000),
      dbClient: db,
    });
    assert.ok(slotId);
    assert.equal(
      await completeGenerationUploadSlot({
        intentId: firstIntentId,
        upload: {
          slotId,
          provider: 'beatapi',
          bucket: 'beatapi',
          key: 'inputs/retry.png',
          url: 'https://media.beatapi.io/inputs/retry.png',
          filename: 'retry.png',
          mimeType: 'image/png',
          sizeBytes: 123,
        },
        now: new Date(3_000),
        dbClient: db,
      }),
      true
    );

    const retryIntentId = await issueGenerationUploadIntent({
      projectId: 'project-1',
      effectId: 302,
      expectedUploadCount: 0,
      now: new Date(4_000),
      dbClient: db,
    });
    assert.ok(
      await consumeGenerationUploadIntent({
        intentId: retryIntentId,
        projectId: 'project-1',
        effectId: 302,
        referencedUrls: ['https://media.beatapi.io/inputs/retry.png'],
        now: new Date(5_000),
        dbClient: db,
      })
    );
  } finally {
    client.close();
  }
});

test('limits active upload authorizations per project', async () => {
  const { client, db } = await createTestDb();
  try {
    for (let index = 0; index < 2; index += 1) {
      await issueGenerationUploadIntent({
        projectId: 'project-1',
        effectId: 200 + index,
        expectedUploadCount: 1,
        now: new Date(1_000),
        dbClient: db,
      });
    }
    await assert.rejects(
      issueGenerationUploadIntent({
        projectId: 'project-1',
        effectId: 202,
        expectedUploadCount: 1,
        now: new Date(1_000),
        dbClient: db,
      }),
      GenerationIntentQuotaError
    );
  } finally {
    client.close();
  }
});
