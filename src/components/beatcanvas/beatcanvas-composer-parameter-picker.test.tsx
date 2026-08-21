import assert from 'node:assert/strict';
import test from 'node:test';

import { commitComposerParameterSelection } from './beatcanvas-composer-parameter-picker';

test('parameter selection applies the value and closes the picker', () => {
  const events: Array<string | boolean> = [];

  commitComposerParameterSelection({
    applyChange: () => events.push('changed'),
    onOpenChange: (nextOpen) => events.push(nextOpen),
  });

  assert.deepEqual(events, ['changed', false]);
});
