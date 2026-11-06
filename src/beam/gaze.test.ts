import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findGazedPiece, selectPieceForPinch, type GazeTarget } from './gaze.ts';

test('head gaze raycast selects piece directly in front (angle ~ 0)', () => {
  const headPos = { x: 0, y: 1.5, z: 0 };
  const headForward = { x: 0, y: 0, z: -1 };
  const pieces: GazeTarget[] = [
    { id: 'mirror-1', x: 0, y: 1.5, z: -0.5 },
    { id: 'mirror-2', x: 0.5, y: 1.5, z: -0.5 },
  ];

  const res = findGazedPiece(headPos, headForward, pieces, 10);
  assert.ok(res !== null);
  assert.equal(res.piece.id, 'mirror-1');
  assert.ok(res.angleDeg < 0.1);
});

test('head gaze selects nearest piece within ~10 degrees', () => {
  const headPos = { x: 0, y: 1.5, z: 0 };
  const headForward = { x: 0, y: 0, z: -1 };
  // z = -1.0. At distance 1m, 5 degrees is ~0.087m, 8 degrees is ~0.14m, 15 degrees is ~0.26m
  const pieces: GazeTarget[] = [
    { id: 'piece-8deg', x: 0.14, y: 1.5, z: -1 },
    { id: 'piece-5deg', x: 0.08, y: 1.5, z: -1 },
    { id: 'piece-15deg', x: 0.3, y: 1.5, z: -1 },
  ];

  const res = findGazedPiece(headPos, headForward, pieces, 10);
  assert.ok(res !== null);
  assert.equal(res.piece.id, 'piece-5deg');
  assert.ok(res.angleDeg <= 5.0);
});

test('head gaze returns null when all pieces are outside 10 degrees', () => {
  const headPos = { x: 0, y: 1.5, z: 0 };
  const headForward = { x: 0, y: 0, z: -1 };
  const pieces: GazeTarget[] = [
    { id: 'piece-far', x: 0.5, y: 1.5, z: -0.5 }, // ~45 degrees
  ];

  const res = findGazedPiece(headPos, headForward, pieces, 10);
  assert.equal(res, null);
});

test('pinch selection prefers piece in reach, but falls back to gazed piece when hand is far', () => {
  const pieceA: GazeTarget = { id: 'piece-a', x: 0, y: 0, z: -0.4 };
  const pieceB: GazeTarget = { id: 'piece-b', x: 0.2, y: 0, z: -0.4 };
  const pieces = [pieceA, pieceB];
  const reachRadius = 0.1;

  // Case 1: hand close to pieceB (0.05m away)
  const handNearB = { x: 0.25, y: 0, z: -0.4 };
  const chosen1 = selectPieceForPinch(handNearB, pieces, reachRadius, pieceA);
  assert.equal(chosen1?.id, 'piece-b');

  // Case 2: hand far from all pieces (e.g. resting at x=0.5), gazing at pieceA
  const handFar = { x: 0.5, y: 0, z: -0.4 };
  const chosen2 = selectPieceForPinch(handFar, pieces, reachRadius, pieceA);
  assert.equal(chosen2?.id, 'piece-a', 'should select gazed piece when no piece in reach');

  // Case 3: hand far and no gazed piece
  const chosen3 = selectPieceForPinch(handFar, pieces, reachRadius, null);
  assert.equal(chosen3, null);
});
