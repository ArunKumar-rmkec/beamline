import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelBoard, SOLVED_MIRROR_DEGREES } from './level.ts';
import { MAX_BOUNCES, reflect, solveBeam } from './solver.ts';

test('a 45 degree mirror sends +X straight up', () => {
  const bounced = reflect(1, 0, -Math.SQRT1_2, Math.SQRT1_2);
  assert.ok(Math.abs(bounced.x) < 1e-9);
  assert.ok(Math.abs(bounced.y - 1) < 1e-9);
});

test('level 1 hits the target only at the 45 degree step', () => {
  for (const degrees of [0, 15, 30, 45, 60, 75, 90]) {
    const result = solveBeam(levelBoard(degrees));
    assert.equal(
      result.hitTarget,
      degrees === SOLVED_MIRROR_DEGREES,
      `mirror ${degrees}°`,
    );
    assert.ok(result.bounces <= MAX_BOUNCES);
    assert.ok(result.segments.length > 0);
  }
});

test('the solved beam has one bounce and ends on the target', () => {
  const result = solveBeam(levelBoard(SOLVED_MIRROR_DEGREES));
  assert.equal(result.bounces, 1);
  assert.equal(result.segments.length, 2);
  const last = result.segments[1];
  assert.ok(last);
  assert.ok(last.y1 > last.y0);
});

test('a flat mirror lets the beam leave the board without a bounce', () => {
  const result = solveBeam(levelBoard(0));
  assert.equal(result.hitTarget, false);
  assert.equal(result.bounces, 0);
  assert.equal(result.segments.length, 1);
});

test('two facing mirrors stop at the bounce limit', () => {
  const result = solveBeam({
    width: 1,
    height: 1,
    source: { x: 0.05, y: 0, dir: 0 },
    mirrors: [
      { x: 0, y: 0, rot: 90, halfLength: 0.2 },
      { x: 0.2, y: 0, rot: 90, halfLength: 0.2 },
    ],
    targets: [],
  });
  assert.equal(result.bounces, MAX_BOUNCES);
  assert.equal(result.segments.length, MAX_BOUNCES);
  assert.equal(result.hitTarget, false);
});
