import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const studioSource = readFileSync(
  new URL('./beat-studio-workspace.tsx', import.meta.url),
  'utf8'
);
const composerSource = readFileSync(
  new URL('./studio-composer.tsx', import.meta.url),
  'utf8'
);
const feedSource = readFileSync(
  new URL('./studio-generation-feed.tsx', import.meta.url),
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

test('studio keeps the original wide composer and a project generation feed', () => {
  assert.match(studioSource, /StudioComposer/);
  assert.match(studioSource, /StudioGenerationFeed/);
  assert.match(studioSource, /StudioStartHere/);
  assert.match(composerSource, /max-w-\[1138px\]/);
  assert.match(composerSource, /ariaLabel="Media type"/);
  assert.match(composerSource, /WorkspaceSelect/);
  assert.match(composerSource, /BeatCanvasComposerParameterPicker/);
  assert.match(composerSource, /truncatePromptToMaxChars/);
  assert.match(composerSource, /labels\.regenerateLabel/);
  assert.match(feedSource, /max-w-\[1138px\]/);
  assert.match(feedSource, /formatStudioHistoryDateTime/);
  assert.match(feedSource, /h-\[240px\]/);
  assert.match(feedSource, /object-contain/);
  assert.doesNotMatch(feedSource, /item\.prompt/);
  assert.match(studioSource, /justify-end/);
  assert.match(startHereSource, /Create Here/);
  assert.match(studioSource, /fetchProjectGenerations/);
});

test('studio model selector follows the selected model name width', () => {
  assert.match(
    composerSource,
    /ariaLabel="Model"[\s\S]*?triggerClassName="w-fit max-w-full"/
  );
});
