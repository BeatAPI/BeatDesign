import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const studioSource = readFileSync(
  new URL('./beat-studio-workspace.tsx', import.meta.url),
  'utf8'
);
const startHereSource = readFileSync(
  new URL('./studio-start-here.tsx', import.meta.url),
  'utf8'
);

test('studio uses the shared black creative surface without a persistent media sidebar', () => {
  assert.match(studioSource, /--beat-bg/);
  assert.doesNotMatch(studioSource, /Powered by BeatAPI/);
  assert.doesNotMatch(studioSource, /w-14 shrink-0 flex-col/);
});

test('studio mirrors the BeatAPI start state and composer rhythm', () => {
  const composerIndex = studioSource.indexOf('max-w-[1138px]');
  const mediaSelectIndex = studioSource.indexOf(
    'ariaLabel="Media type"',
    composerIndex
  );

  assert.ok(composerIndex >= 0);
  assert.ok(mediaSelectIndex > composerIndex);
  assert.match(studioSource, /StudioStartHere/);
  assert.match(startHereSource, /Create Here/);
  assert.match(
    startHereSource,
    /Imagine the scene\. Shape the mood\. Bring it to life\./
  );
  assert.match(startHereSource, /pointer-events-auto/);
  assert.match(startHereSource, /create-thumb-forest\.webp/);
  assert.match(startHereSource, /aria-pressed/);
  assert.match(startHereSource, /setSelectedSrc/);
  assert.doesNotMatch(startHereSource, /onSelect/);
  assert.doesNotMatch(studioSource, /selectStarterIdea/);
  assert.match(studioSource, /data-beatapi-composer/);
  assert.match(studioSource, /WorkspaceSelect/);
});

test('studio model selector follows the selected model name width', () => {
  assert.match(
    studioSource,
    /ariaLabel="Model"[\s\S]*?triggerClassName="w-fit max-w-full"/
  );
  assert.doesNotMatch(
    studioSource,
    /ariaLabel="Model"[\s\S]*?triggerClassName="w-\[224px\]"/
  );
});
