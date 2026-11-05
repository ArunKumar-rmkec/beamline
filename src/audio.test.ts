import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoardAudio } from './audio.ts';

test('BoardAudio lazily creates AudioContext on first interaction only', () => {
  let created = 0;
  class FakeAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    constructor() {
      created += 1;
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
  }

  // @ts-expect-error test mock
  globalThis.window = {
    AudioContext: FakeAudioContext as unknown as typeof AudioContext,
  };

  const audio = new BoardAudio();
  assert.equal(audio.hasContext(), false);
  assert.equal(created, 0);

  // Resume before interaction should not create AudioContext
  audio.resume();
  assert.equal(audio.hasContext(), false);
  assert.equal(created, 0);

  // Suspend before interaction does nothing
  audio.suspend();
  assert.equal(audio.hasContext(), false);
  assert.equal(created, 0);

  // First interaction triggers creation
  audio.interact();
  assert.equal(audio.hasContext(), true);
  assert.equal(created, 1);

  // Subsequent resumes reuse existing context
  audio.resume();
  assert.equal(created, 1);
});
