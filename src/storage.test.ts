import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MIRROR_ROT_KEY,
  readMirrorDegrees,
  STORAGE_PREFIX,
  writeMirrorDegrees,
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

test('corrupt or blocked storage falls back without throwing', () => {
  const store = memoryStore();
  store.values.set(MIRROR_ROT_KEY, 'nope');
  assert.equal(readMirrorDegrees(store, 15), 15);

  const blocked: KeyValueStore = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readMirrorDegrees(blocked, 0), 0);
  assert.doesNotThrow(() => writeMirrorDegrees(blocked, 30));
});
