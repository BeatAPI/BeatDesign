import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';

import { BeatCanvasComposerShell } from './beatcanvas-composer-shell';

const draftCard: CanvasGenerationCard = {
  id: 'draft-1',
  kind: 'generation',
  type: 'image',
  name: 'Draft 1',
  url: null,
  prompt: 'prompt from plan row',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'idle',
  error: null,
  modelId: 'nano-banana-pro',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
};

const labels = {
  imageTitle: 'Image',
  videoTitle: 'Video',
  imageModeLabel: 'Image',
  videoModeLabel: 'Video',
  analysisModeLabel: 'Analyze',
  analysisModelLabel: 'Analysis model',
  analysisStandardModelLabel: 'Video Analysis Standard',
  analysisProModelLabel: 'Video Analysis Pro',
  analysisPromptPlaceholder: 'Ask what to inspect',
  analyzeLabel: 'Analyze',
  analyzingLabel: 'Analyzing',
  createGenerationCardLabel: 'Create generation card',
  createImageGenerationCardLabel: 'Image Generation Card',
  createVideoGenerationCardLabel: 'Video Generation Card',
  connectorUploadLabel: 'Upload',
  imagePromptPlaceholder: 'Prompt',
  videoPromptPlaceholder: 'Prompt',
  zoomLabel: 'Zoom',
  zoomOutLabel: 'Zoom out',
  zoomInLabel: 'Zoom in',
  selectToolLabel: 'Select',
  panToolLabel: 'Pan',
  fitViewLabel: 'Fit view',
  hideEdgesLabel: 'Hide connections',
  showEdgesLabel: 'Show connections',
  snapToGridLabel: 'Snap to grid',
  undoLabel: 'Undo',
  redoLabel: 'Redo',
  historyLabel: 'History',
  latestResultLabel: 'Latest result',
  fromCanvasLabel: 'From canvas',
  currentReferencesLabel: 'Attached',
  noCanvasReferencesLabel: 'No canvas cards',
  removeReferenceLabel: 'Remove reference',
  emptyStateTitle: 'Empty',
  emptyStateDescription: 'Empty canvas',
  emptyGuideTitle: 'Start creating',
  emptyGuideDescription: 'Choose a template',
  emptyTemplateBadge: 'Template',
  emptyFreeGenerateLabel: 'Free generation',
  emptyUploadStartLabel: 'Upload image',
  typeLabel: 'Type',
  modelLabel: 'Model',
  parameterLabel: 'Parameters',
  aspectRatioLabel: 'Aspect ratio',
  outputQualityLabel: 'Output quality',
  durationLabel: 'Duration',
  characterOrientationLabel: 'Character orientation',
  backgroundSourceLabel: 'Background source',
  languageLabel: 'Language',
  uploadImageLabel: 'Upload image',
  uploadVideoLabel: 'Upload video',
  generateLabel: 'Generate',
  regenerateLabel: 'Regenerate',
  generatingLabel: 'Generating',
  closeComposerLabel: 'Close generator',
  defaultSetupLabel: 'Default setup',
  modeOptionLabel: 'Mode',
  variantOptionLabel: 'Variant',
  qualityOptionLabel: 'Quality',
  tokenQualityLabel: 'Quality',
  tokenFastLabel: 'Fast',
  tokenLiteLabel: 'Lite',
  tokenLowLabel: 'Low',
  tokenMediumLabel: 'Medium',
  tokenStandardLabel: 'Standard',
  tokenHighLabel: 'High',
  tokenProLabel: 'Pro',
  tokenAdaptiveLabel: 'Adaptive',
  tokenAutoLabel: 'Auto',
  tokenLandscapeLabel: 'Landscape',
  tokenPortraitLabel: 'Portrait',
  tokenChineseLabel: 'Chinese',
  tokenEnglishLabel: 'English',
  tokenImageOrientationLabel: 'Follow image',
  tokenVideoOrientationLabel: 'Follow video',
  tokenInputImageLabel: 'Image background',
  tokenInputVideoLabel: 'Video background',
  queuedStatusLabel: 'Queued',
  generatingStatusLabel: 'Generating',
  readyStatusLabel: 'Ready',
  failedStatusLabel: 'Failed',
};

test('default composer renders the prompt input inline with the character count and close control', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerShell
      activeDraftCard={draftCard}
      composerRef={{ current: null }}
      isDraftBusy={false}
      isPromptComposing={false}
      labels={labels}
      onActiveComposerCardIdChange={() => {}}
      onPromptChange={() => {}}
      onPromptCommit={() => {}}
      onGenerateDraft={() => {}}
      onPromptCompositionChange={() => {}}
      promptCharacterCount={0}
      promptCharacterLimit={1000}
      promptInputValue=""
      promptPlaceholder="今天我们要创作什么"
      presentation={{ kind: 'default' }}
    >
      <div>controls</div>
    </BeatCanvasComposerShell>
  );

  assert.match(
    html,
    /<div class="grid min-w-0 grid-cols-\[minmax\(0,1fr\)_auto\] items-start gap-x-3 gap-y-2">[\s\S]*min-h-\[56px\][\s\S]*pl-2 pr-0 py-0[\s\S]*placeholder="今天我们要创作什么"[\s\S]*0\/1000[\s\S]*aria-label="Close generator"/
  );
  assert.match(html, /w-\[min\(560px,calc\(100vw-32px\)\)\]/);
  assert.doesNotMatch(
    html,
    /<div suppressHydrationWarning="" class="relative px-4 py-1\.5"><textarea/
  );
});

test('default composer hides estimated generation credits from the primary CTA', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerShell
      activeDraftCard={draftCard}
      composerRef={{ current: null }}
      isDraftBusy={false}
      isPromptComposing={false}
      labels={labels}
      onActiveComposerCardIdChange={() => {}}
      onPromptChange={() => {}}
      onPromptCommit={() => {}}
      onGenerateDraft={() => {}}
      onPromptCompositionChange={() => {}}
      promptCharacterCount={0}
      promptCharacterLimit={1000}
      promptInputValue=""
      promptPlaceholder="今天我们要创作什么"
      presentation={{ kind: 'default' }}
    >
      <div>controls</div>
    </BeatCanvasComposerShell>
  );

  assert.doesNotMatch(html, />5<\/span>/);
  assert.doesNotMatch(html, /≈5/);
  assert.match(html, /lucide-arrow-up/);
  assert.match(html, /Generate/);
});

test('default composer does not gate generate on local credits', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerShell
      activeDraftCard={draftCard}
      composerRef={{ current: null }}
      isDraftBusy={false}
      isPromptComposing={false}
      labels={labels}
      onActiveComposerCardIdChange={() => {}}
      onPromptChange={() => {}}
      onPromptCommit={() => {}}
      onGenerateDraft={() => {}}
      onPromptCompositionChange={() => {}}
      promptCharacterCount={0}
      promptCharacterLimit={1000}
      promptInputValue=""
      promptPlaceholder="今天我们要创作什么"
      presentation={{ kind: 'default' }}
    >
      <div>controls</div>
    </BeatCanvasComposerShell>
  );

  assert.doesNotMatch(html, /disabled=""/);
  assert.match(html, /Generate/);
});

test('composer keeps the generate arrow after the first take exists', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerShell
      activeDraftCard={draftCard}
      composerRef={{ current: null }}
      isDraftBusy={false}
      isPromptComposing={false}
      labels={labels}
      onActiveComposerCardIdChange={() => {}}
      onPromptChange={() => {}}
      onPromptCommit={() => {}}
      onGenerateDraft={() => {}}
      onPromptCompositionChange={() => {}}
      promptCharacterCount={0}
      promptCharacterLimit={1000}
      promptInputValue=""
      promptPlaceholder="今天我们要创作什么"
      presentation={{ kind: 'default' }}
      takeCount={2}
    >
      <div>controls</div>
    </BeatCanvasComposerShell>
  );

  assert.match(html, /aria-label="Generate"/);
  assert.match(html, /lucide-arrow-up/);
  assert.doesNotMatch(html, /lucide-rotate-cw/);
});

test('unbound workflow inputs disable generation and explain the blocker accessibly without invoking actions', () => {
  let submissions = 0;
  const html = renderToStaticMarkup(
    <BeatCanvasComposerShell
      activeDraftCard={draftCard}
      composerRef={{ current: null }}
      isDraftBusy={false}
      isPromptComposing={false}
      labels={labels}
      generationBlockers={['请先绑定角色参考。']}
      onActiveComposerCardIdChange={() => {}}
      onPromptChange={() => {}}
      onPromptCommit={() => {}}
      onGenerateDraft={() => {
        submissions++;
      }}
      onPromptCompositionChange={() => {}}
      promptCharacterCount={0}
      promptCharacterLimit={1000}
      promptInputValue=""
      promptPlaceholder="Prompt"
    >
      <div>controls</div>
    </BeatCanvasComposerShell>
  );
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Generate"/);
  const description = html.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(description);
  assert.ok(html.includes(`id="${description}"`));
  assert.match(html, /role="status"/);
  assert.match(html, /请先绑定角色参考。/);
  assert.equal(submissions, 0);
});
