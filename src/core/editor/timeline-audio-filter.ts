/** Preserve clip gains independently of silent/delayed timeline inputs. */
export function buildTimelineAudioMixFilter(inputCount: number, duration: number) {
  if (!Number.isSafeInteger(inputCount) || inputCount < 1 || !Number.isFinite(duration) || duration <= 0)
    throw new Error('Audio mixing requires inputs and a positive timeline duration.');
  const seconds = duration.toFixed(3);
  return `amix=inputs=${inputCount}:duration=longest:dropout_transition=0:normalize=0,` +
    // Disable the limiter's automatic makeup gain; compensate its lookahead.
    'alimiter=limit=0.95:level=0:latency=1,' +
    `atrim=duration=${seconds},apad=whole_dur=${seconds}`;
}
