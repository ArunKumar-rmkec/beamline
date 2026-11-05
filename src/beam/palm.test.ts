import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palmOutgoingDegrees } from './palm.ts';

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
