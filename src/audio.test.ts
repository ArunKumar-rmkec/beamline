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

test('BoardAudio win() and tick() call resume() and schedule after resume resolves if suspended', async () => {
  let resumed = 0;
  let oscillatorsCreated = 0;
  let resolveResume: () => void = () => {};

  class FakeAudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    resume() {
      resumed += 1;
      return new Promise<void>((resolve) => {
        resolveResume = () => {
          this.state = 'running';
          resolve();
        };
      });
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    createOscillator() {
      oscillatorsCreated += 1;
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
  assert.equal(audio.contextState, 'uninitialized');
  assert.equal(audio.chordsPlayed, 0);
  assert.equal(audio.lastWinChordAt, 0);

  // Call win() while context will be created in suspended state
  audio.win();
  assert.equal(audio.hasContext(), true);
  assert.equal(audio.contextState, 'suspended');
  assert.equal(resumed, 1);
  // Not yet scheduled because resume is pending
  assert.equal(oscillatorsCreated, 0);
  assert.equal(audio.chordsPlayed, 0);

  // Now resolve resume
  resolveResume();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(audio.contextState, 'running');
  assert.equal(audio.chordsPlayed, 1);
  assert.ok(audio.lastWinChordAt > 0);
  assert.equal(oscillatorsCreated, 3); // 3 notes in chord

  // Call tick() while running: schedules immediately
  audio.tick();
  assert.equal(oscillatorsCreated, 4); // +1 note for tick
});
