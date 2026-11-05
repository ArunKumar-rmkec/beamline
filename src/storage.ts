/** Every persisted key starts with this prefix. */
export const STORAGE_PREFIX = 'beamline:';
export const MIRROR_ROT_KEY = `${STORAGE_PREFIX}mirror-rot`;
export const PROGRESS_KEY = `${STORAGE_PREFIX}progress`;
export const HAND_MIRROR_KEY = `${STORAGE_PREFIX}hand-mirror`;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Progress {
  level: number;
  angles: number[];
}

export function readMirrorDegrees(store: KeyValueStore, fallback: number): number {
  try {
    const raw = store.getItem(MIRROR_ROT_KEY);
    if (raw == null || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeMirrorDegrees(store: KeyValueStore, degrees: number): void {
  try {
    store.setItem(MIRROR_ROT_KEY, String(degrees));
  } catch {
    // Private mode and full disks throw. The piece still holds its angle in memory.
  }
}

function finiteAngles(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.some((angle) => typeof angle !== 'number' || !Number.isFinite(angle))) {
    return null;
  }
  return value;
}

export function readProgress(store: KeyValueStore, levelCount: number): Progress | null {
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (raw != null && raw.trim() !== '') {
      const parsed = JSON.parse(raw) as { level?: unknown; angles?: unknown };
      const angles = finiteAngles(parsed.angles);
      const level = parsed.level;
      if (
        typeof level === 'number' &&
        Number.isInteger(level) &&
        level >= 0 &&
        level < levelCount &&
        angles
      ) {
        return { level, angles };
      }
    }
  } catch {
    // Fall through to the slice 1 mirror key.
  }

  const legacy = readMirrorDegrees(store, Number.NaN);
  if (Number.isFinite(legacy) && levelCount > 0) return { level: 0, angles: [legacy] };
  return null;
}

export function writeProgress(store: KeyValueStore, progress: Progress): void {
  try {
    store.setItem(
      PROGRESS_KEY,
      JSON.stringify({ level: progress.level, angles: progress.angles }),
    );
  } catch {
    // The in-memory board still has the angles.
  }
}

export function readHandMirror(store: KeyValueStore): boolean {
  try {
    return store.getItem(HAND_MIRROR_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHandMirror(store: KeyValueStore, enabled: boolean): void {
  try {
    store.setItem(HAND_MIRROR_KEY, enabled ? '1' : '0');
  } catch {
    // The toggle still flips in memory.
  }
}
