import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { BeatCanvasComposerModelPicker } from './beatcanvas-composer-model-picker';

test('default canvas model picker follows the selected model label width', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerModelPicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen={false}
      modelOptions={[
        {
          id: 'seedance-2',
          name: 'Seedance 2.0',
          effectId: 1,
          uploadPath: '/api/generate',
          imageBucketName: 'test',
        },
      ]}
      onDraftModelChange={() => {}}
      onOpenChange={() => {}}
      selectedModelId="seedance-2"
      selectedModelLabel="Seedance 2.0"
    />
  );

  assert.match(html, /min-w-0 max-w-full/);
  assert.match(html, /w-fit max-w-full/);
  assert.doesNotMatch(html, /lg:min-w-\[196px\]/);
});
