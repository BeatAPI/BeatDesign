import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBeatApiTaskRequest,
  normalizeBeatApiTaskResult,
} from './beatapi-adapter';

test('maps a canvas image request to BeatAPI image tasks', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 2,
      model: 'gpt-image-2',
      input: {
        prompt: '  Editorial product photograph  ',
        image_urls: ['https://example.com/product.png'],
        aspect_ratio: '4:5',
        wmOutputQuality: '2k',
      },
    }),
    {
      path: '/v1/images/tasks',
      body: {
        model: 'gpt-image-2',
        prompt: 'Editorial product photograph',
        images: ['https://example.com/product.png'],
        aspect_ratio: '4:5',
        resolution: '2K',
      },
    }
  );
});

test('maps a canvas video request to BeatAPI video tasks', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'seedance-2',
      input: {
        prompt: 'Neon market tracking shot',
        image_urls: ['https://example.com/first-frame.png'],
        video_urls: ['https://example.com/reference.mp4'],
        audio_urls: ['https://example.com/reference.mp3'],
        aspect_ratio: '9:16',
        wmDuration: '8s',
        wmOutputQuality: '1080p',
        wmSound: true,
      },
    }),
    {
      path: '/v1/videos/tasks',
      body: {
        model: 'seedance-2',
        prompt: 'Neon market tracking shot',
        aspect_ratio: '9:16',
        duration: 8,
        resolution: '1080p',
        generate_audio: true,
        reference_images: ['https://example.com/first-frame.png'],
        reference_videos: ['https://example.com/reference.mp4'],
        reference_audios: ['https://example.com/reference.mp3'],
      },
    }
  );
});

test('passes image references to every BeatAPI image model', () => {
  const request = buildBeatApiTaskRequest({
    effectType: 2,
    model: 'nano-banana',
    input: {
      prompt: 'Restyle this image',
      image_urls: ['https://example.com/source.png'],
    },
  });

  assert.deepEqual(request.body.images, ['https://example.com/source.png']);
});

test('does not truncate upstream images before BeatAPI model limits are configured', () => {
  const images = [
    'https://example.com/one.png',
    'https://example.com/two.png',
    'https://example.com/three.png',
  ];
  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'seedance-2',
    input: {
      prompt: 'Use all connected images',
      image_urls: images,
    },
  });

  assert.deepEqual(request.body.images, images);
});

test('maps MiniMax and Kling quality values to official BeatAPI resolutions', () => {
  assert.equal(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'minimax-h3',
      input: { prompt: 'Dawn village', wmOutputQuality: '2k', wmDuration: '5s' },
    }).body.resolution,
    '2K'
  );
  assert.equal(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'kling-3',
      input: { prompt: 'Product orbit', wmOutputQuality: '4k', wmDuration: '5s' },
    }).body.resolution,
    '4K'
  );
});

test('rejects models outside the public BeatAPI media catalog', () => {
  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'private-provider-model',
        input: { prompt: 'Test' },
      }),
    /Unsupported BeatAPI video model/
  );
});

test('accepts only official BeatAPI provider media URLs', () => {
  assert.equal(
    normalizeBeatApiTaskResult({
      id: 'task-1',
      status: 'succeeded',
      output: {
        media: [
          {
            type: 'image',
            url: 'https://media.beatapi.io/outputs/task-1/result.png',
          },
        ],
      },
    }).status,
    'succeeded'
  );

  const rejected = normalizeBeatApiTaskResult({
    id: 'task-2',
    status: 'succeeded',
    output: {
      media: [{ type: 'image', url: 'https://attacker.example/result.png' }],
    },
  });
  assert.equal(rejected.status, 'failed');
  assert.match('error' in rejected ? rejected.error || '' : '', /untrusted media URL/);
});
