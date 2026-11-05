import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseTwistDelta,
  nearestSnap,
  signedTwist,
  smoothAngle,
  SNAP_STEP_RADIANS,
  snapWithHysteresis,
  wrapPi,
} from './snap.ts';

const DEG = Math.PI / 180;

test('small tremor stays on the current step', () => {
  assert.equal(snapWithHysteresis(4 * DEG, 0), 0);
  assert.equal(snapWithHysteresis(10 * DEG, 0), 0);
});

test('crossing the dead zone snaps to the next 15 degree step', () => {
  assert.equal(snapWithHysteresis(12 * DEG, 0), SNAP_STEP_RADIANS);
  assert.equal(snapWithHysteresis(20 * DEG, 0), SNAP_STEP_RADIANS);
});

test('hysteresis does not immediately snap back', () => {
  const held = SNAP_STEP_RADIANS;
  assert.equal(snapWithHysteresis(held - 11 * DEG, held), held);
  assert.equal(snapWithHysteresis(held - 13 * DEG, held), 0);
});

test('smoothing takes the short way around the circle', () => {
  const current = 170 * DEG;
  const target = -170 * DEG;
  const next = smoothAngle(current, target, 0.05, 0.08);
  assert.ok(next > current);
  assert.ok(next < 180 * DEG);
});

test('a settled twist of 20 degrees lands on 15', () => {
  const raw = 20 * DEG;
  const smoothed = smoothAngle(0, raw, 1, 0.08);
  assert.ok(Math.abs(smoothed - raw) < 1e-4);
  assert.equal(snapWithHysteresis(smoothed, 0), SNAP_STEP_RADIANS);
});

test('wrist roll around Z reports a signed angle', () => {
  const axis = { x: 0, y: 0, z: 1 };
  const identity = { x: 0, y: 0, z: 0, w: 1 };
  const half = 10 * DEG;
  const rolled = { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
  const angle = signedTwist(identity, rolled, axis);
  assert.ok(Math.abs(angle - 20 * DEG) < 1e-6);
  assert.ok(Math.abs(signedTwist(identity, identity, axis)) < 1e-8);
});

test('the stronger twist wins and nearest snap restores a saved angle', () => {
  assert.equal(chooseTwistDelta(0.2, -0.05), 0.2);
  assert.equal(chooseTwistDelta(0.02, -0.4), -0.4);
  assert.equal(nearestSnap(46 * DEG), 45 * DEG);
  assert.ok(Math.abs(wrapPi(Math.PI * 3) - Math.PI) < 1e-9 || Math.abs(wrapPi(Math.PI * 3) + Math.PI) < 1e-9);
});

test('positive rotate(+15) and rotate(1) rotate positive, negative rotates negative', async () => {
  const { angleFromStepsOrDegrees } = await import('./snap.ts');
  const toDegrees = (rad: number) => Math.round((rad * 180) / Math.PI);

  // Degrees input
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, 15)), 15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, +15)), 15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, -15)), -15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, 30)), 30);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, -45)), -45);

  // Step counts input
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, 1)), 15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, +1)), 15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, -1)), -15);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, 2)), 30);
  assert.equal(toDegrees(angleFromStepsOrDegrees(0, 3)), 45);
});
