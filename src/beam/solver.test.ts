import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardFromLevel, LEVELS } from './levels.ts';
import { MAX_BOUNCES, reflect, solveBeam } from './solver.ts';

const levelOne = LEVELS[0];
if (!levelOne) throw new Error('missing level 1');

test('a 45 degree mirror sends +X straight up', () => {
  const bounced = reflect(1, 0, -Math.SQRT1_2, Math.SQRT1_2);
  assert.ok(Math.abs(bounced.x) < 1e-9);
  assert.ok(Math.abs(bounced.y - 1) < 1e-9);
});

test('level 1 hits the target only at the 45 degree step', () => {
  for (const degrees of [0, 15, 30, 45, 60, 75, 90]) {
    const result = solveBeam(boardFromLevel(levelOne, [degrees]));
    assert.equal(result.hitTarget, degrees === 45, `mirror ${degrees}°`);
    assert.ok(result.bounces <= MAX_BOUNCES);
    assert.ok(result.segments.length > 0);
  }
});

test('the solved beam has one bounce and ends on the target', () => {
  const result = solveBeam(boardFromLevel(levelOne, [45]));
  assert.equal(result.bounces, 1);
  assert.equal(result.segments.length, 2);
  const last = result.segments[1];
  assert.ok(last);
  assert.ok(last.y1 > last.y0);
});

test('a flat mirror lets the beam leave the board without a bounce', () => {
  const result = solveBeam(boardFromLevel(levelOne, [0]));
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

test('a prism splits +X into up and straight through', () => {
  const result = solveBeam({
    width: 1,
    height: 1,
    source: { x: -0.4, y: 0, dir: 0 },
    mirrors: [],
    prisms: [{ x: 0, y: 0, rot: 45, halfLength: 0.08 }],
    targets: [
      { x: 0, y: 0.35, radius: 0.04 },
      { x: 0.4, y: 0, radius: 0.04 },
    ],
  });
  assert.equal(result.hitTarget, true);
  assert.deepEqual(result.lit, [true, true]);
  const leaving = result.segments.filter(
    (segment) => Math.hypot(segment.x0, segment.y0) < 0.02,
  );
  assert.ok(leaving.length >= 2);
});

test('a blocker stops the beam short of the target', () => {
  const open = solveBeam({
    width: 1,
    height: 0.4,
    source: { x: -0.4, y: 0, dir: 0 },
    mirrors: [],
    targets: [{ x: 0.35, y: 0, radius: 0.04 }],
  });
  const blocked = solveBeam({
    width: 1,
    height: 0.4,
    source: { x: -0.4, y: 0, dir: 0 },
    mirrors: [],
    blockers: [{ x: 0, y: 0, halfWidth: 0.05, halfHeight: 0.05 }],
    targets: [{ x: 0.35, y: 0, radius: 0.04 }],
  });
  assert.equal(open.hitTarget, true);
  assert.equal(blocked.hitTarget, false);
  assert.ok(blocked.segments.length >= 1);
  const end = blocked.segments[blocked.segments.length - 1];
  assert.ok(end);
  assert.ok(end.x1 < 0.2);
});

test('one lit target does not win a two-target board', () => {
  const result = solveBeam({
    width: 1,
    height: 0.4,
    source: { x: -0.4, y: 0, dir: 0 },
    mirrors: [],
    targets: [
      { x: 0.2, y: 0, radius: 0.04 },
      { x: 0.2, y: 0.15, radius: 0.04 },
    ],
  });
  assert.deepEqual(result.lit, [true, false]);
  assert.equal(result.hitTarget, false);
});
