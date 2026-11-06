import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellCenter } from './level.ts';
import { boardFromLevel, LEVELS } from './levels.ts';
import { findPalmLockAngle, palmOutgoingDegrees } from './palm.ts';
import { solveBeam } from './solver.ts';

test('a palm facing the beam like a 45 degree mirror sends it up', () => {
  const degrees = palmOutgoingDegrees(1, 0, -Math.SQRT1_2, Math.SQRT1_2, 0);
  assert.equal(degrees, 90);
});

test('a palm facing back along +X returns the beam', () => {
  const degrees = palmOutgoingDegrees(1, 0, -1, 0, 0);
  assert.equal(degrees, 180);
});

test('a palm normal straight out of the board leaves the beam unchanged', () => {
  assert.equal(palmOutgoingDegrees(1, 0, 0, 0, 1), 0);
});

test('a bounce that leaves the plane is rejected', () => {
  assert.equal(palmOutgoingDegrees(1, 0, 1, 0, 1), null);
});

test('the outgoing direction snaps to 15 degrees', () => {
  assert.equal(palmOutgoingDegrees(1, 0, -Math.sin(0.4), Math.cos(0.4), 0), 45);
});

test('findPalmLockAngle snaps to 15 degree direction that hits a target', () => {
  const level1 = LEVELS[0]!;
  // Level 1: mirror at (2, 2) is at rot 0 (not reflecting up to (2, 4))
  const board = boardFromLevel(level1, [0]);
  const palmPos = cellCenter(2, 2);
  const incoming = { x: 1, y: 0 };

  const lock = findPalmLockAngle(board, palmPos, incoming);
  assert.ok(lock !== null, 'palm lock should be found');
  assert.equal(lock.angle, 90, 'should lock to 90 degrees straight up to target');
  assert.equal(lock.targetIndex, 0, 'should lock to target index 0');

  // Verify that placing hand at this lock lights the target and wins
  const res = solveBeam({
    ...board,
    hand: { x: palmPos.x, y: palmPos.y, radius: 0.03, dir: lock.angle },
  });
  assert.equal(res.lit[0], true, 'target 0 should be lit');
  assert.equal(res.hitTarget, true, 'level 1 is won with palm lock');
});

test('findPalmLockAngle returns null when no 15 degree snap angle hits target', () => {
  const level1 = LEVELS[0]!;
  const board = boardFromLevel(level1, [0]);
  // Place palm in corner where beam cannot reach target
  const palmPos = cellCenter(5, 0);
  const incoming = { x: 1, y: 0 };

  const lock = findPalmLockAngle(board, palmPos, incoming);
  assert.equal(lock, null);
});
