import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  quatFromRollDeg,
  quatMult,
  extractWristRollDeg,
  WristTracker,
} from './wrist.ts';

const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI);

test('wrist tracker: grab captures baseline and reports initial state', () => {
  const tracker = new WristTracker();
  tracker.onGrab(0, quatFromRollDeg(0));

  const state = tracker.state();
  assert.equal(state.rollDeg, 0);
  assert.equal(state.baselineDeg, 0);
  assert.equal(state.appliedSteps, 0);
  assert.equal(state.guardRejects, 0);
});

test('wrist tracker: roll +15° -> +15° piece rotation', () => {
  const tracker = new WristTracker();
  tracker.onGrab(0, quatFromRollDeg(0));

  // Feed +15° roll over several frames
  let res = { pieceAngle: 0, changed: false };
  for (let i = 0; i < 15; i++) {
    res = tracker.update(quatFromRollDeg(15), null, 0.016);
  }

  assert.equal(toDeg(res.pieceAngle), 15);
  const state = tracker.state();
  assert.equal(state.rollDeg, 15);
  assert.equal(state.baselineDeg, 0);
  assert.equal(state.appliedSteps, 1);
  assert.equal(state.guardRejects, 0);
});

test('wrist tracker: roll +60° (gradual and single-step) -> +60°', () => {
  // Gradual roll: 0 -> 15 -> 30 -> 45 -> 60
  const trackerGradual = new WristTracker();
  trackerGradual.onGrab(0, quatFromRollDeg(0));

  for (let r = 5; r <= 60; r += 5) {
    for (let frame = 0; frame < 5; frame++) {
      trackerGradual.update(quatFromRollDeg(r), null, 0.016);
    }
  }

  const gradualState = trackerGradual.state();
  assert.equal(gradualState.rollDeg, 60);
  assert.equal(gradualState.baselineDeg, 0);
  assert.equal(gradualState.appliedSteps, 4);
  assert.equal(gradualState.guardRejects, 0);

  // Single-step roll jump: 0 -> 60 in one frame (e.g. from emulator Rot field edit)
  const trackerSingle = new WristTracker();
  trackerSingle.onGrab(0, quatFromRollDeg(0));

  const resSingle = trackerSingle.update(quatFromRollDeg(60), null, 0.016);
  assert.equal(toDeg(resSingle.pieceAngle), 60);

  const singleState = trackerSingle.state();
  assert.equal(singleState.rollDeg, 60);
  assert.equal(singleState.baselineDeg, 0);
  assert.equal(singleState.appliedSteps, 4);
  assert.equal(singleState.guardRejects, 0);
});

test('wrist tracker: roll back -> 0', () => {
  const tracker = new WristTracker();
  tracker.onGrab(0, quatFromRollDeg(0));

  // Roll to 60°
  tracker.update(quatFromRollDeg(60), null, 0.016);
  assert.equal(tracker.state().appliedSteps, 4);

  // Single-step roll back to 0°
  tracker.update(quatFromRollDeg(0), null, 0.016);
  assert.equal(tracker.state().rollDeg, 0);
  assert.equal(tracker.state().baselineDeg, 0);
  assert.equal(tracker.state().appliedSteps, 0);
  assert.equal(toDeg(tracker.state().appliedSteps * (Math.PI / 12)), 0);

  // Gradual roll back test
  tracker.update(quatFromRollDeg(45), null, 0.016);
  assert.equal(tracker.state().appliedSteps, 3);
  for (let r = 40; r >= 0; r -= 5) {
    for (let frame = 0; frame < 10; frame++) {
      tracker.update(quatFromRollDeg(r), null, 0.016);
    }
  }
  assert.equal(tracker.state().appliedSteps, 0);
});

test('wrist tracker: negative roll sign rotates piece negative (-15° -> -15°)', () => {
  const tracker = new WristTracker();
  tracker.onGrab(0, quatFromRollDeg(0));

  let res = { pieceAngle: 0, changed: false };
  for (let i = 0; i < 15; i++) {
    res = tracker.update(quatFromRollDeg(-15), null, 0.016);
  }

  assert.equal(toDeg(res.pieceAngle), -15);
  const state = tracker.state();
  assert.equal(state.rollDeg, -15);
  assert.equal(state.baselineDeg, 0);
  assert.equal(state.appliedSteps, -1);
  assert.equal(state.guardRejects, 0);
});

test('wrist tracker: jump guard rejects positional teleport (>8cm) and swing (>40°) without rejecting roll', () => {
  const tracker = new WristTracker();
  tracker.onGrab(0, quatFromRollDeg(0), { x: 0, y: 0, z: 0 });

  // 1. Positional jump of 10cm (> 8cm)
  tracker.update(quatFromRollDeg(0), { x: 0.10, y: 0, z: 0 }, 0.016);
  assert.equal(tracker.state().guardRejects, 1);

  // 2. Swing jump (e.g. pitch by 50° > 40°)
  const pRad = (50 * Math.PI) / 180;
  const qPitch50 = { x: Math.sin(pRad / 2), y: 0, z: 0, w: Math.cos(pRad / 2) };
  tracker.update(qPitch50, { x: 0.10, y: 0, z: 0 }, 0.016);
  assert.equal(tracker.state().guardRejects, 2);

  // 3. Legitimate single-step roll (60°, about the viewer-forward axis) is NOT rejected (pitch stays at 50°)
  const qPitchAndRoll = quatMult(quatFromRollDeg(60), qPitch50);
  tracker.update(qPitchAndRoll, { x: 0.10, y: 0, z: 0 }, 0.016);
  assert.equal(tracker.state().guardRejects, 2);
  assert.equal(tracker.state().appliedSteps, 4);
});

test('wrist tracker: a pitched wrist joint still maps a 60° roll to exactly +60°', () => {
  // Real XR wrist joints sit pitched/yawed relative to the viewer (IWER default ≈ 30° pitch).
  const tilt = { x: 0.2574, y: 0.1336, z: 0.0362, w: 0.9563 };
  const tracker = new WristTracker();
  tracker.onGrab(0, tilt, null);
  let res = { pieceAngle: 0, changed: false };
  for (let r = 5; r <= 60; r += 5) res = tracker.update(quatMult(quatFromRollDeg(r), tilt), null, 0.016);
  assert.equal(Math.round((res.pieceAngle * 180) / Math.PI), 60);
});
