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

test('keeps multiple @Video references in BeatAPI array order', () => {
  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'seedance-2',
    input: {
      prompt: 'Use @Video1 for motion and @Video2 for camera movement',
      video_urls: [
        'https://example.com/motion.mp4',
        'https://example.com/camera.mp4',
      ],
    },
  });

  assert.deepEqual(request.body.reference_videos, [
    'https://example.com/motion.mp4',
    'https://example.com/camera.mp4',
  ]);
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

test('maps Kling 2.6 and 3.0 Motion Control to the dedicated BeatAPI contract', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'kling-2.6-motion-control',
      input: {
        prompt: 'Follow the dance motion precisely',
        image_urls: ['https://media.beatapi.io/inputs/character.png'],
        video_urls: ['https://media.beatapi.io/inputs/motion.mp4'],
        wmOutputQuality: '1080p',
        sourceVideoDurationSeconds: 15,
        characterOrientation: 'video',
      },
    }),
    {
      path: '/v1/videos/tasks',
      body: {
        model: 'kling-2.6-motion-control',
        prompt: 'Follow the dance motion precisely',
        images: ['https://media.beatapi.io/inputs/character.png'],
        reference_videos: ['https://media.beatapi.io/inputs/motion.mp4'],
        resolution: '1080p',
        character_orientation: 'video',
      },
    }
  );

  const kling3 = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'kling-3-motion-control',
    input: {
      prompt: 'Keep the character identity stable',
      image_urls: ['https://media.beatapi.io/inputs/character.png'],
      video_urls: ['https://media.beatapi.io/inputs/motion.mov'],
      wmOutputQuality: '720p',
      sourceVideoDurationSeconds: 8,
      characterOrientation: 'image',
      backgroundSource: 'input_image',
    },
  });

  assert.deepEqual(kling3.body, {
    model: 'kling-3-motion-control',
    prompt: 'Keep the character identity stable',
    images: ['https://media.beatapi.io/inputs/character.png'],
    reference_videos: ['https://media.beatapi.io/inputs/motion.mov'],
    resolution: '720p',
    character_orientation: 'image',
    background_source: 'input_image',
  });
});

test('validates Motion Control media counts and orientation duration', () => {
  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'kling-2.6-motion-control',
        input: {
          prompt: 'Dance',
          image_urls: [],
          video_urls: ['https://media.beatapi.io/inputs/motion.mp4'],
        },
      }),
    /exactly one image/
  );
  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'kling-3-motion-control',
        input: {
          prompt: 'Dance',
          image_urls: ['https://media.beatapi.io/inputs/character.png'],
          video_urls: ['https://media.beatapi.io/inputs/motion.mp4'],
          sourceVideoDurationSeconds: 11,
          characterOrientation: 'image',
        },
      }),
    /up to 10 seconds/
  );
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'kling-3-motion-control',
      input: {
        prompt: 'Dance',
        image_urls: ['https://cdn.example.com/character.png?signature=image'],
        video_urls: ['https://cdn.example.com/motion.mp4?signature=video'],
      },
    }).body,
    {
      model: 'kling-3-motion-control',
      prompt: 'Dance',
      images: ['https://cdn.example.com/character.png?signature=image'],
      reference_videos: ['https://cdn.example.com/motion.mp4?signature=video'],
      resolution: '720p',
      character_orientation: 'video',
      background_source: 'input_video',
    }
  );
  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'kling-3-motion-control',
        input: {
          prompt: 'Dance',
          image_urls: ['http://127.0.0.1/character.png'],
          video_urls: ['https://cdn.example.com/motion.mp4'],
        },
      }),
    /public HTTP\(S\) URLs/
  );
});

test('maps Seedance 2 Fast and Mini as separate BeatAPI models', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'seedance-2-fast',
      input: {
        prompt: 'Fast market draft',
        wmDuration: '5s',
        wmOutputQuality: '720p',
        wmSound: true,
      },
    }).body,
    {
      model: 'seedance-2-fast',
      prompt: 'Fast market draft',
      duration: 5,
      resolution: '720p',
      generate_audio: true,
    }
  );
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'seedance-2-mini',
      input: {
        prompt: 'Low-cost storyboard',
        wmDuration: '5s',
        wmOutputQuality: '480p',
      },
    }).body,
    {
      model: 'seedance-2-mini',
      prompt: 'Low-cost storyboard',
      duration: 5,
      resolution: '480p',
    }
  );
});

test('maps Veo 3.1 quality tiers and resolution into BeatAPI fields', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'veo-3.1',
      input: {
        prompt: 'Coastal sunrise',
        aspect_ratio: '16:9',
        wmOutputQuality: '1080p',
        mode: 'fast',
      },
    }).body,
    {
      model: 'veo-3.1',
      prompt: 'Coastal sunrise',
      aspect_ratio: '16:9',
      resolution: '1080p',
      quality: 'Fast',
    }
  );
  assert.equal(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'veo-3.1',
      input: { prompt: 'Storyboard draft', mode: 'lite', wmOutputQuality: '4k' },
    }).body.quality,
    'Lite'
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
