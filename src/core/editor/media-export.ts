import { findCaptionAtTime, getCaptionStyleDefinition } from './captions';
import {
  getTimelineClipSource,
  type TimelineClip,
  type TimelineDocument,
} from './timeline-document';
import { diagnoseTimeline } from './timeline-diagnostics';

export type LocalMediaMetadata = {
  duration: number;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
};

export async function inspectLocalMedia(file: File): Promise<LocalMediaMetadata> {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  try {
    const [duration, videoTrack, audioTrack] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);

    return {
      duration,
      width: videoTrack?.displayWidth ?? null,
      height: videoTrack?.displayHeight ?? null,
      hasVideo: Boolean(videoTrack),
      hasAudio: Boolean(audioTrack),
      videoCodec: videoTrack?.codec ?? null,
      audioCodec: audioTrack?.codec ?? null,
    };
  } finally {
    input.dispose();
  }
}

export async function exportTrimmedMp4({
  file,
  start,
  end,
  onProgress,
}: {
  file: File;
  start: number;
  end: number;
  onProgress?: (progress: number) => void;
}) {
  if (!(end > start)) throw new Error('The export range is empty.');

  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
  } = await import('mediabunny');

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  try {
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start, end },
      video: {
        codec: 'avc',
        bitrate: QUALITY_HIGH,
        forceTranscode: true,
        keyFrameInterval: 1,
      },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map(({ reason }) => reason.replaceAll('_', ' '))
        .join(', ');
      throw new Error(`This browser cannot export the selected media${reasons ? `: ${reasons}` : '.'}`);
    }

    conversion.onProgress = (progress) => onProgress?.(progress);
    await conversion.execute();

    if (!target.buffer) throw new Error('The encoder produced no MP4 data.');
    onProgress?.(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}

type TimelineMediaRecord = {
  clip: TimelineClip;
  source: ReturnType<typeof getTimelineClipSource>;
  input: import('mediabunny').Input | null;
  videoTrack: import('mediabunny').InputVideoTrack | null;
  audioTrack: import('mediabunny').InputAudioTrack | null;
  imageBitmap: ImageBitmap | null;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
};

async function loadTimelineMedia(
  document: TimelineDocument,
  signal?: AbortSignal
) {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const records: TimelineMediaRecord[] = [];
  try {
    for (const track of document.tracks) {
      if (track.hidden || track.muted) continue;
      for (const clip of track.clips) {
        throwIfAborted(signal);
        if (clip.sourceType === 'caption') continue;
        const source = getTimelineClipSource(clip);
        const response = await fetch(source.sourceUrl, { signal });
        if (!response.ok) {
          throw new Error(`Timeline source is unavailable: ${source.name}`);
        }
        const blob = await response.blob();
        if (clip.sourceType === 'image') {
          const imageBitmap = await createImageBitmap(blob);
          records.push({
            clip,
            source,
            input: null,
            videoTrack: null,
            audioTrack: null,
            imageBitmap,
          });
          continue;
        }
        const input = new Input({
          source: new BlobSource(blob),
          formats: ALL_FORMATS,
        });
        try {
          const [videoTrack, audioTrack] = await Promise.all([
            input.getPrimaryVideoTrack(),
            input.getPrimaryAudioTrack(),
          ]);
          records.push({
            clip,
            source,
            input,
            videoTrack,
            audioTrack,
            imageBitmap: null,
          });
        } catch (error) {
          input.dispose();
          throw error;
        }
      }
    }
    return records;
  } catch (error) {
    disposeTimelineMediaRecords(records);
    throw error;
  }
}

function disposeTimelineMediaRecords(records: TimelineMediaRecord[]) {
  for (const record of records) {
    record.input?.dispose();
    record.imageBitmap?.close();
  }
}

function drawImageWithContain(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

export function wrapCaptionText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
) {
  const wrapped: string[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

  const pushParagraph = (paragraph: string) => {
    if (!paragraph) {
      wrapped.push('');
      return;
    }
    const tokens = Array.from(segmenter.segment(paragraph), ({ segment }) => segment);
    let line = '';
    for (const token of tokens) {
      const candidate = `${line}${token}`;
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      wrapped.push(line.trimEnd());
      if (measure(token) <= maxWidth) {
        line = token.trimStart();
        continue;
      }
      line = '';
      for (const character of Array.from(token)) {
        const characterCandidate = `${line}${character}`;
        if (line && measure(characterCandidate) > maxWidth) {
          wrapped.push(line);
          line = character;
        } else {
          line = characterCandidate;
        }
      }
    }
    if (line) wrapped.push(line.trimEnd());
  };

  for (const paragraph of text.split('\n')) pushParagraph(paragraph);
  return wrapped;
}

function drawRoundedCaptionBackground(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function gainAt(clip: TimelineClip, clipOffset: number) {
  if (clip.muted) return 0;
  const fadeIn = clip.fadeIn > 0 ? Math.min(1, clipOffset / clip.fadeIn) : 1;
  const fadeOut =
    clip.fadeOut > 0
      ? Math.min(1, (clip.duration - clipOffset) / clip.fadeOut)
      : 1;
  return Math.max(0, Math.min(1, clip.volume * Math.min(fadeIn, fadeOut)));
}

async function mixTimelineAudio(
  records: TimelineMediaRecord[],
  duration: number,
  sampleRate: number,
  signal?: AbortSignal
) {
  const { AudioBufferSink } = await import('mediabunny');
  const context = new OfflineAudioContext({
    numberOfChannels: 2,
    length: Math.max(1, Math.ceil(duration * sampleRate)),
    sampleRate,
  });
  let scheduled = false;

  for (const record of records) {
    if (!record.audioTrack || record.clip.muted) continue;
    const sink = new AudioBufferSink(record.audioTrack);
    for await (const wrapped of sink.buffers(
      record.source.inPoint,
      record.source.outPoint
    )) {
      throwIfAborted(signal);
      const segmentStart = Math.max(record.source.inPoint, wrapped.timestamp);
      const segmentEnd = Math.min(
        record.source.outPoint,
        wrapped.timestamp + wrapped.buffer.duration
      );
      const segmentDuration = segmentEnd - segmentStart;
      if (segmentDuration <= 0) continue;

      const timelineStart =
        record.clip.startTime + (segmentStart - record.source.inPoint);
      const timelineEnd = Math.min(duration, timelineStart + segmentDuration);
      if (timelineStart >= duration || timelineEnd <= timelineStart) continue;

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = wrapped.buffer;
      source.connect(gain);
      gain.connect(context.destination);
      const startOffset = timelineStart - record.clip.startTime;
      const endOffset = timelineEnd - record.clip.startTime;
      gain.gain.setValueAtTime(gainAt(record.clip, startOffset), timelineStart);
      gain.gain.linearRampToValueAtTime(
        gainAt(record.clip, endOffset),
        timelineEnd
      );
      source.start(
        timelineStart,
        Math.max(0, segmentStart - wrapped.timestamp),
        timelineEnd - timelineStart
      );
      scheduled = true;
    }
  }

  return scheduled ? context.startRendering() : null;
}

export async function exportTimelineMp4({
  document,
  onProgress,
  signal,
}: {
  document: TimelineDocument;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}) {
  if (document.duration <= 0) throw new Error('The timeline is empty.');
  const blocking = diagnoseTimeline(document).filter(
    (diagnostic) => diagnostic.severity === 'error'
  );
  if (blocking.length > 0) {
    throw new Error(`Timeline diagnostics failed: ${blocking[0].code}`);
  }

  const {
    AudioBufferSource,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
    VideoSampleSink,
  } = await import('mediabunny');
  const records = await loadTimelineMedia(document, signal);
  const firstVisual = records.find(
    (record) => record.videoTrack || record.imageBitmap
  );
  if (!firstVisual) {
    disposeTimelineMediaRecords(records);
    throw new Error('The timeline does not contain a readable visual track.');
  }

  const visualWidth =
    firstVisual.videoTrack?.displayWidth ?? firstVisual.imageBitmap?.width ?? 1920;
  const visualHeight =
    firstVisual.videoTrack?.displayHeight ?? firstVisual.imageBitmap?.height ?? 1080;
  const portrait =
    visualHeight > visualWidth;
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const frameRate = 30;
  const frameDuration = 1 / frameRate;
  const sampleRate = 48_000;
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    disposeTimelineMediaRecords(records);
    throw new Error('Canvas2D is unavailable in this browser.');
  }

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 1,
  });
  let mixedAudio: AudioBuffer | null;
  try {
    mixedAudio = await mixTimelineAudio(
      records,
      document.duration,
      sampleRate,
      signal
    );
  } catch (error) {
    disposeTimelineMediaRecords(records);
    throw error;
  }
  const audioSource = mixedAudio
    ? new AudioBufferSource({ codec: 'aac', bitrate: 192_000 })
    : null;
  output.addVideoTrack(videoSource, { frameRate });
  if (audioSource) output.addAudioTrack(audioSource);

  try {
    throwIfAborted(signal);
    await output.start();
    const visualRecords = records
      .filter((record) => record.videoTrack || record.imageBitmap)
      .sort((left, right) => left.clip.startTime - right.clip.startTime);
    const sinks = new Map(
      visualRecords
        .filter((record) => record.videoTrack)
        .map((record) => [
        record.clip.id,
        new VideoSampleSink(record.videoTrack!),
      ])
    );
    const frameCount = Math.max(1, Math.ceil(document.duration * frameRate));
    const audioPromise = audioSource?.add(mixedAudio!);

    for (let frame = 0; frame < frameCount; frame += 1) {
      throwIfAborted(signal);
      const timelineTime = Math.min(document.duration, frame * frameDuration);
      context.fillStyle = '#000';
      context.fillRect(0, 0, width, height);
      const active = [...visualRecords]
        .reverse()
        .find(
          (record) =>
            timelineTime >= record.clip.startTime &&
            timelineTime < record.clip.startTime + record.clip.duration
        );
      if (active?.imageBitmap) {
        drawImageWithContain(
          context,
          active.imageBitmap,
          active.imageBitmap.width,
          active.imageBitmap.height,
          width,
          height
        );
      } else if (active?.videoTrack) {
        const sourceTime = Math.min(
          active.source.outPoint - 0.000_001,
          active.source.inPoint + (timelineTime - active.clip.startTime)
        );
        const sample = await sinks.get(active.clip.id)!.getSample(sourceTime);
        if (sample) {
          sample.drawWithFit(context, { fit: 'contain' });
          sample.close();
        }
      }
      const caption = findCaptionAtTime(document, timelineTime);
      if (caption?.text) {
        const style = getCaptionStyleDefinition(document.captionStyle);
        const fontSize = Math.max(24, Math.round(height * style.fontScale));
        context.font = `${style.fontWeight} ${fontSize}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        const captionText = style.uppercase
          ? caption.text.toLocaleUpperCase()
          : caption.text;
        const lines = wrapCaptionText(
          captionText,
          width * style.maxWidth,
          (value) => context.measureText(value).width
        );
        const lineHeight = fontSize * style.lineHeight;
        const baseY = height - Math.round(height * style.bottomOffset);
        if (style.backgroundStyle) {
          const textWidth = Math.max(
            ...lines.map((line) => context.measureText(line).width),
            fontSize
          );
          const horizontalPadding = fontSize * style.horizontalPaddingScale;
          const verticalPadding = fontSize * style.verticalPaddingScale;
          const backgroundWidth = textWidth + horizontalPadding * 2;
          const backgroundHeight =
            lineHeight * lines.length + verticalPadding * 2;
          context.fillStyle = style.backgroundStyle;
          drawRoundedCaptionBackground(
            context,
            (width - backgroundWidth) / 2,
            baseY - lineHeight * lines.length - verticalPadding,
            backgroundWidth,
            backgroundHeight,
            fontSize * 0.24
          );
        }
        lines.forEach((line, index) => {
          const y = baseY - (lines.length - 1 - index) * lineHeight;
          if (style.strokeStyle) {
            context.lineWidth = Math.max(
              2,
              Math.round(fontSize * style.strokeScale)
            );
            context.strokeStyle = style.strokeStyle;
            context.lineJoin = 'round';
            context.strokeText(line, width / 2, y);
          }
          context.fillStyle = style.fillStyle;
          context.fillText(line, width / 2, y);
        });
      }
      await videoSource.add(timelineTime, frameDuration, {
        keyFrame: frame % frameRate === 0,
      });
      onProgress?.(((frame + 1) / frameCount) * 0.95);
    }

    await audioPromise;
    throwIfAborted(signal);
    await output.finalize();
    if (!target.buffer) throw new Error('The encoder produced no MP4 data.');
    onProgress?.(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (cause) {
    if (output.state === 'started') await output.cancel().catch(() => undefined);
    throw cause;
  } finally {
    disposeTimelineMediaRecords(records);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
