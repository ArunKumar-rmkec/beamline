/** Every persisted key starts with this prefix. */
export const STORAGE_PREFIX = 'beamline:';
export const MIRROR_ROT_KEY = `${STORAGE_PREFIX}mirror-rot`;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
    // Private mode and full disks throw. The mirror still holds its angle in memory.
  }
}
