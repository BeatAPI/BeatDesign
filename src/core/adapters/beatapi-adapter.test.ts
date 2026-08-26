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
        wmOutputQuality: '720p',
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
        resolution: '720p',
        generate_audio: true,
        reference_images: ['https://example.com/first-frame.png'],
        reference_videos: ['https://example.com/reference.mp4'],
        reference_audios: ['https://example.com/reference.mp3'],
      },
    }
  );

  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'grok-imagine-video-1.5',
      input: {
        prompt: 'A native 1080p cinematic landscape',
        aspect_ratio: '16:9',
        wmDuration: '12s',
        wmOutputQuality: '1080p',
      },
    }).body,
    {
      model: 'grok-imagine-video-1.5',
      prompt: 'A native 1080p cinematic landscape',
      aspect_ratio: '16:9',
      duration: 12,
      resolution: '1080p',
    }
  );
});

test('maps standard and deep video analysis to the stable BeatAPI workflow', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 3,
      model: 'video-analysis',
      input: {
        prompt: 'List each action with timestamps',
        video_url: 'https://media.beatapi.io/inputs/review.mp4',
        analysis_depth: 'deep',
        max_output_tokens: 4096,
      },
    }),
    {
      path: '/v1/video-analysis/tasks',
      body: {
        video_url: 'https://media.beatapi.io/inputs/review.mp4',
        prompt: 'List each action with timestamps',
        analysis_depth: 'deep',
        max_output_tokens: 4096,
      },
    }
  );

  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 3,
      model: 'video-analysis',
      input: {
        prompt: 'Summarize this video',
        video_url: 'https://media.beatapi.io/inputs/review.mov',
      },
    }).body,
    {
      video_url: 'https://media.beatapi.io/inputs/review.mov',
      prompt: 'Summarize this video',
      analysis_depth: 'standard',
      max_output_tokens: 2048,
    }
  );
});

test('keeps video analysis text and usage in normalized task output', () => {
  const result = normalizeBeatApiTaskResult({
    id: 'analysis-1',
    status: 'succeeded',
    output: {
      text: '00:04 — Product enters frame',
      usage: { input_tokens: 120, output_tokens: 18 },
    },
  });

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.output, {
    taskId: 'analysis-1',
    provider: 'beatapi',
    requestId: null,
    stage: null,
    analysis_text: '00:04 — Product enters frame',
    usage: { input_tokens: 120, output_tokens: 18 },
  });
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

test('uses reference images by default and frames only when @Image roles are explicit', () => {
  const frames = [
    'https://example.com/first.png',
    'https://example.com/last.png',
  ];
  const defaultRequest = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'seedance-2',
    input: {
      prompt: 'Use @Image1 and @Image2 as visual references',
      image_urls: frames,
    },
  });

  assert.equal(defaultRequest.body.images, undefined);
  assert.deepEqual(defaultRequest.body.reference_images, frames);

  const frameRequest = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'seedance-2',
    input: {
      prompt: 'Use @Image1 as the first frame and @Image2 as the last frame',
      image_urls: frames,
    },
  });

  assert.deepEqual(frameRequest.body.images, frames);
  assert.equal(frameRequest.body.reference_images, undefined);

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

  assert.equal(request.body.images, undefined);
  assert.deepEqual(request.body.reference_images, images);
});

test('explicit Chinese @Image roles determine first and last frame order', () => {
  const firstAttached = 'https://example.com/attached-first.png';
  const secondAttached = 'https://example.com/attached-second.png';
  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'minimax-h3',
    input: {
      prompt: '将 @Image2 作为首帧，@Image1 作为尾帧。',
      image_urls: [firstAttached, secondAttached],
    },
  });

  assert.deepEqual(request.body.images, [secondAttached, firstAttached]);
  assert.equal(request.body.reference_images, undefined);
});

test('normalizes MiniMax H3 text defaults and Veo reference quality', () => {
  const h3 = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'minimax-h3',
    input: {
      prompt: 'Dawn village',
      aspect_ratio: 'adaptive',
    },
  });
  assert.equal(h3.body.aspect_ratio, '16:9');

  const veo = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'veo-3.1',
    input: {
      prompt: 'Use all three visual references',
      image_urls: [
        'https://example.com/subject.png',
        'https://example.com/location.png',
        'https://example.com/style.png',
      ],
      mode: 'quality',
    },
  });
  assert.equal(veo.body.images, undefined);
  assert.deepEqual(veo.body.reference_images, [
    'https://example.com/subject.png',
    'https://example.com/location.png',
    'https://example.com/style.png',
  ]);
  assert.equal(veo.body.quality, 'Fast');
});

test('rejects parameter combinations BeatAPI does not support', () => {
  const references = [
    'https://example.com/one.png',
    'https://example.com/two.png',
    'https://example.com/three.png',
  ];

  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'seedance-2',
        input: {
          prompt: 'Use all references',
          image_urls: references,
          wmOutputQuality: '1080p',
        },
      }),
    /1080p.*reference image/i
  );
  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'veo-3.1',
        input: {
          prompt: 'Use all references',
          image_urls: references,
          aspect_ratio: 'auto',
          mode: 'fast',
        },
      }),
    /reference mode requires aspect_ratio/i
  );
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

test('maps Grok Imagine Image 2.0 generation and editing requests', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 2,
      model: 'grok-imagine-image-2.0',
      input: {
        prompt: 'Editorial portrait',
        aspect_ratio: '3:2',
      },
    }).body,
    {
      model: 'grok-imagine-image-2.0',
      prompt: 'Editorial portrait',
      aspect_ratio: '3:2',
    }
  );

  const references = Array.from(
    { length: 5 },
    (_, index) => `https://example.com/reference-${index + 1}.png`
  );
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 2,
      model: 'grok-imagine-image-2.0',
      input: {
        prompt: 'Preserve the source composition',
        image_urls: references,
        aspect_ratio: 'auto',
      },
    }).body,
    {
      model: 'grok-imagine-image-2.0',
      prompt: 'Preserve the source composition',
      images: references,
      aspect_ratio: 'auto',
    }
  );

  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 2,
        model: 'grok-imagine-image-2.0',
        input: { prompt: 'Invalid auto ratio', aspect_ratio: 'auto' },
      }),
    /auto aspect ratio requires a reference image/
  );
});

test('maps Grok Imagine Video 1.5 text, reference, and first-frame modes', () => {
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'grok-imagine-video-1.5',
      input: {
        prompt: 'A cinematic product reveal',
        aspect_ratio: '16:9',
        wmDuration: '8s',
        wmOutputQuality: '480p',
      },
    }).body,
    {
      model: 'grok-imagine-video-1.5',
      prompt: 'A cinematic product reveal',
      aspect_ratio: '16:9',
      duration: 8,
      resolution: '480p',
    }
  );

  const references = Array.from(
    { length: 7 },
    (_, index) => `https://example.com/grok-reference-${index + 1}.png`
  );
  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'grok-imagine-video-1.5',
      input: {
        prompt: 'Use all references for style and identity',
        image_urls: references,
        aspect_ratio: '9:16',
        wmDuration: '15s',
        wmOutputQuality: '720p',
      },
    }).body,
    {
      model: 'grok-imagine-video-1.5',
      prompt: 'Use all references for style and identity',
      reference_images: references,
      aspect_ratio: '9:16',
      duration: 15,
      resolution: '720p',
    }
  );

  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: 1,
      model: 'grok-imagine-video-1.5',
      input: {
        prompt: 'Use @Image1 as the first frame',
        image_urls: ['https://example.com/first-frame.png'],
        aspect_ratio: '16:9',
        wmDuration: '6s',
        wmOutputQuality: '720p',
      },
    }).body,
    {
      model: 'grok-imagine-video-1.5',
      prompt: 'Use @Image1 as the first frame',
      images: ['https://example.com/first-frame.png'],
      duration: 6,
      resolution: '720p',
    }
  );

  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'grok-imagine-video-1.5',
        input: {
          prompt: 'Use @Image1 as the first frame and @Image2 as the last frame',
          image_urls: [
            'https://example.com/first.png',
            'https://example.com/last.png',
          ],
        },
      }),
    /supports one first frame only/
  );

  assert.throws(
    () =>
      buildBeatApiTaskRequest({
        effectType: 1,
        model: 'grok-imagine-video-1.5',
        input: {
          prompt: 'Use multiple references at native resolution',
          image_urls: [
            'https://example.com/reference-one.png',
            'https://example.com/reference-two.png',
          ],
          wmOutputQuality: '1080p',
        },
      }),
    /1080p accepts at most one image/
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
