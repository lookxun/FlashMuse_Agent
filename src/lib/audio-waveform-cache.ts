export type CachedAudioWaveform = {
  objectUrl: string;
  peaks?: number[][];
  duration?: number;
};

const cache = new Map<string, CachedAudioWaveform>();
const inflight = new Map<string, Promise<CachedAudioWaveform>>();

export async function loadCachedAudioWaveform(url: string): Promise<CachedAudioWaveform> {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = inflight.get(url);
  if (pending) return pending;
  const task = (async () => {
    if (/^(blob:|data:)/i.test(url)) {
      const entry: CachedAudioWaveform = { objectUrl: url };
      cache.set(url, entry);
      return entry;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio waveform fetch ${response.status}`);
    const blob = await response.blob();
    const entry: CachedAudioWaveform = { objectUrl: URL.createObjectURL(blob) };
    cache.set(url, entry);
    return entry;
  })();
  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}

export function rememberAudioWaveformPeaks(url: string, peaks: number[][], duration: number) {
  const entry = cache.get(url);
  if (entry) {
    entry.peaks = peaks;
    entry.duration = duration;
    return;
  }
  cache.set(url, { objectUrl: url, peaks, duration });
}
