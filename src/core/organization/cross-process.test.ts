import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import type { BeatDesignCommand } from '../commands/executor';

type CommandRequest = {
  projectId: string;
  origin: 'mcp';
  commandId: string;
  idempotencyKey: string;
  expectedRevision: number;
  command: BeatDesignCommand;
};
type CommandResult = {
  ok: boolean;
  code?: string;
  message?: string;
  revision?: number;
};
const workerSource = `
import { persistBeatDesignCommand } from './src/core/commands/persist.ts';
let providerCalls = 0;
globalThis.fetch = async () => { providerCalls++; throw new Error('Unexpected network call in organization race test'); };
process.stdout.write('READY\\n');
let body = ''; for await (const chunk of process.stdin) body += chunk;
const result = await persistBeatDesignCommand(JSON.parse(body));
process.stdout.write('RESULT:' + JSON.stringify({result,providerCalls}) + '\\n', () => process.exit(0));
`;

async function race(requests: CommandRequest[]) {
  const workers = requests.map((request) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', workerSource],
      { env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );
    let readyResolve!: () => void;
    let resultResolve!: (result: CommandResult) => void;
    let reject!: (reason: Error) => void;
    let stderr = '';
    let outcome: CommandResult | undefined;
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });
    const result = new Promise<CommandResult>((resolve, rejectResult) => {
      resultResolve = resolve;
      reject = rejectResult;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Race worker timeout: ${stderr}`));
      readyResolve();
    }, 30_000);
    child.stderr.on('data', (data) => {
      stderr += String(data);
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (line === 'READY') readyResolve();
      if (line.startsWith('RESULT:')) {
        const data = JSON.parse(line.slice(7));
        assert.equal(data.providerCalls, 0);
        outcome = data.result;
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
      readyResolve();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      readyResolve();
      if (code !== 0 || !outcome)
        reject(new Error(`Race worker failed (${code}): ${stderr}`));
      else resultResolve(outcome);
    });
    return { child, ready, result, request };
  });
  try {
    await Promise.all(workers.map((worker) => worker.ready));
    for (const worker of workers)
      worker.child.stdin.end(JSON.stringify(worker.request));
    return await Promise.all(workers.map((worker) => worker.result));
  } finally {
    for (const worker of workers)
      if (worker.child.exitCode === null) worker.child.kill();
  }
}

test('cross-process CAS, Element bind/delete races and receipt failures remain atomic in isolated SQLite', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'beatdesign-organization-races-')
  );
  process.env.BEATDESIGN_DATA_DIR = directory;
  execFileSync(
    process.execPath,
    ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
    { env: process.env, stdio: 'pipe', windowsHide: true }
  );
  const { createProject, loadProjectWithLatestSnapshot } =
    await import('../projects/projects');
  const { persistBeatDesignCommand } = await import('../commands/persist');
  const { getOrganization } = await import('./service');
  const { recordUserAsset, linkProjectAsset } =
    await import('../workspace-lib/assets/user-assets');
  const { buildTextCard } = await import('../beatcanvas/text-nodes');
  const { getDb } = await import('../workspace-lib/db-adapter');
  const { sql } = await import('drizzle-orm');
  const project = await createProject({
    name: 'Synthetic cross-process fixture',
  });
  const request = (
    commandId: string,
    command: BeatDesignCommand,
    expectedRevision: number
  ): CommandRequest => ({
    projectId: project.id,
    origin: 'mcp',
    commandId,
    idempotencyKey: commandId,
    expectedRevision,
    command,
  });

  const folders = await race(
    ['a', 'b'].map((suffix) =>
      request(
        `folder-${suffix}`,
        {
          type: 'organization.apply',
          operations: [
            {
              type: 'create_folder',
              folderId: `folder-${suffix}`,
              name: `Folder ${suffix}`,
              parentId: null,
            },
          ],
        },
        0
      )
    )
  );
  assert.equal(
    folders.filter((result) => result.ok).length,
    1,
    JSON.stringify(folders)
  );
  assert.equal(folders.find((result) => !result.ok)?.code, 'REVISION_CONFLICT');
  assert.equal((await getOrganization(project.id)).revision, 1);
  assert.equal(
    Object.keys((await getOrganization(project.id)).document.folders).length,
    1
  );

  await recordUserAsset({
    id: 'race-picture',
    type: 'image',
    source: 'upload',
    bucket: 'local-project-assets',
    objectKey: 'race-picture.png',
    publicUrl: '/race-picture.png',
    filename: 'Synthetic.png',
  });
  await linkProjectAsset({
    projectId: project.id,
    assetId: 'race-picture',
    role: 'upload',
  });
  const element = await persistBeatDesignCommand(
    request(
      'create-element',
      {
        type: 'organization.apply',
        operations: [
          {
            type: 'create_element',
            elementId: 'character',
            name: 'Synthetic character',
            kind: 'character',
            description: '',
            versionId: 'v1',
            assetId: 'race-picture',
          },
        ],
      },
      1
    )
  );
  assert.equal(element.ok, true, JSON.stringify(element));
  const draft = {
    ...buildTextCard({ id: 'draft', name: 'Synthetic generation' }),
    kind: 'generation' as const,
    type: 'image' as const,
    textContent: undefined,
    textRole: undefined,
  };
  const created = await persistBeatDesignCommand(
    request(
      'create-draft',
      {
        type: 'canvas.apply',
        operations: [{ type: 'upsert_card', card: draft }],
      },
      1
    )
  );
  assert.equal(created.ok, true, JSON.stringify(created));
  const bindingRace = await race([
    request(
      'bind-element',
      {
        type: 'canvas.apply',
        operations: [
          {
            type: 'bind_element',
            bindingId: 'fixed-character',
            consumerCardId: 'draft',
            elementId: 'character',
            versionId: 'v1',
            assetId: 'race-picture',
            referenceCardId: 'character-ref',
            order: 0,
            role: 'subject',
          },
        ],
      },
      created.revision!
    ),
    request(
      'delete-element',
      {
        type: 'organization.apply',
        operations: [{ type: 'remove_element', elementId: 'character' }],
      },
      element.revision!
    ),
  ]);
  assert.equal(
    bindingRace.filter((result) => result.ok).length,
    1,
    JSON.stringify(bindingRace)
  );
  const organization = await getOrganization(project.id);
  const canvas = (await loadProjectWithLatestSnapshot({
    projectId: project.id,
  }))!.snapshot;
  const bindings = Object.values(canvas.organization?.elementBindings ?? {});
  assert.ok(
    !bindings.length || !organization.document.elements.character.deletedAt,
    'An active binding cannot point at a deleted Element'
  );

  const db = await getDb();
  await db.run(
    sql.raw(
      "CREATE TRIGGER reject_test_receipt BEFORE INSERT ON project_command_receipt WHEN NEW.command_id = 'rollback-command' BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END"
    )
  );
  const before = await getOrganization(project.id);
  const rejected = await persistBeatDesignCommand(
    request(
      'rollback-command',
      {
        type: 'organization.apply',
        operations: [
          {
            type: 'create_folder',
            folderId: 'must-roll-back',
            name: 'Must roll back',
            parentId: null,
          },
        ],
      },
      before.revision
    )
  );
  assert.equal(rejected.ok, false);
  assert.deepEqual(
    await getOrganization(project.id),
    before,
    'Receipt failure must roll back metadata and revision'
  );
  const receipt = await db.all(
    sql.raw(
      "SELECT command_id FROM project_command_receipt WHERE command_id = 'rollback-command'"
    )
  );
  assert.equal(receipt.length, 0);
  for (const table of ['generation_history', 'generation_upload_intent']) {
    const rows = await db.all(
      sql.raw(`SELECT count(*) AS total FROM ${table}`)
    );
    assert.equal(Number(rows[0].total), 0);
  }
});
