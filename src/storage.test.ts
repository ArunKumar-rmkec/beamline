import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HAND_MIRROR_KEY,
  MIRROR_ROT_KEY,
  PROGRESS_KEY,
  readHandMirror,
  readMirrorDegrees,
  readProgress,
  STORAGE_PREFIX,
  writeHandMirror,
  writeMirrorDegrees,
  writeProgress,
  type KeyValueStore,
} from './storage.ts';

function memoryStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('mirror angle round-trips under a beamline: key', () => {
  const store = memoryStore();
  assert.ok(MIRROR_ROT_KEY.startsWith(STORAGE_PREFIX));
  assert.equal(readMirrorDegrees(store, 0), 0);
  writeMirrorDegrees(store, 45);
  assert.equal(store.values.get(MIRROR_ROT_KEY), '45');
  assert.equal(readMirrorDegrees(store, 0), 45);
});

test('progress stores the level and piece angles under beamline:', () => {
  const store = memoryStore();
  assert.ok(PROGRESS_KEY.startsWith(STORAGE_PREFIX));
  assert.equal(readProgress(store, 6), null);
  writeProgress(store, { level: 3, angles: [45, 15] });
  assert.deepEqual(JSON.parse(store.values.get(PROGRESS_KEY)!), {
    v: 1,
    level: 4,
    angles: [45, 15],
  });
  assert.deepEqual(readProgress(store, 6), { level: 3, angles: [45, 15] });
});

test('a level change is stored as the 1-based level the player sees', () => {
  const store = memoryStore();
  writeProgress(store, { level: 1, angles: [0, 0] });
  assert.deepEqual(JSON.parse(store.values.get(PROGRESS_KEY)!), {
    v: 1,
    level: 2,
    angles: [0, 0],
  });
  assert.deepEqual(readProgress(store, 6), { level: 1, angles: [0, 0] });
});

test('a legacy 0-based progress save still loads', () => {
  const store = memoryStore();
  store.values.set(PROGRESS_KEY, JSON.stringify({ level: 1, angles: [0, 0] }));
  assert.deepEqual(readProgress(store, 6), { level: 1, angles: [0, 0] });
});

test('a slice 1 mirror angle migrates onto level 1', () => {
  const store = memoryStore();
  store.values.set(MIRROR_ROT_KEY, '45');
  assert.deepEqual(readProgress(store, 6), { level: 0, angles: [45] });
});

test('the hand mirror toggle is off unless saved', () => {
  const store = memoryStore();
  assert.ok(HAND_MIRROR_KEY.startsWith(STORAGE_PREFIX));
  assert.equal(readHandMirror(store), false);
  writeHandMirror(store, true);
  assert.equal(store.values.get(HAND_MIRROR_KEY), '1');
  assert.equal(readHandMirror(store), true);
  writeHandMirror(store, false);
  assert.equal(readHandMirror(store), false);
});

test('corrupt or blocked storage falls back without throwing', () => {
  const store = memoryStore();
  store.values.set(MIRROR_ROT_KEY, 'nope');
  assert.equal(readMirrorDegrees(store, 15), 15);
  store.values.set(PROGRESS_KEY, '{');
  assert.equal(readProgress(store, 6), null);
  store.values.set(PROGRESS_KEY, JSON.stringify({ level: 9, angles: [0] }));
  assert.equal(readProgress(store, 6), null);

  const blocked: KeyValueStore = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readMirrorDegrees(blocked, 0), 0);
  assert.equal(readProgress(blocked, 6), null);
  assert.equal(readHandMirror(blocked), false);
  assert.doesNotThrow(() => writeMirrorDegrees(blocked, 30));
  assert.doesNotThrow(() => writeProgress(blocked, { level: 0, angles: [0] }));
  assert.doesNotThrow(() => writeHandMirror(blocked, true));
});
