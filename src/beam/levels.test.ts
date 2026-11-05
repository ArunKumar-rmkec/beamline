import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellCenter } from './level.ts';
import { boardFromLevel, LEVELS, movablePieces } from './levels.ts';
import { MAX_BOUNCES, solveBeam } from './solver.ts';

test('each level is solved by its known answer and not by the starting angles', () => {
  assert.equal(LEVELS.length, 6);
  const ids = new Set<string>();
  for (const level of LEVELS) {
    assert.equal(ids.has(level.id), false);
    ids.add(level.id);
    const movable = movablePieces(level);
    assert.equal(level.solution.length, movable.length);
    assert.ok(movable.length >= 1);

    const solved = solveBeam(boardFromLevel(level, level.solution));
    assert.equal(solved.hitTarget, true, `level ${level.id} solution`);
    assert.ok(solved.lit.every(Boolean));
    assert.ok(solved.bounces <= MAX_BOUNCES);
    assert.ok(solved.segments.length > 0);

    const start = solveBeam(boardFromLevel(level, movable.map(() => 0)));
    assert.equal(start.hitTarget, false, `level ${level.id} start`);
  }
});

test('the prism level sends two beams away from the prism', () => {
  const level = LEVELS[3];
  assert.ok(level);
  const prism = level.pieces.find((piece) => piece.type === 'prism');
  assert.ok(prism);
  const center = cellCenter(prism.col, prism.row);
  const result = solveBeam(boardFromLevel(level, level.solution));
  const leaving = result.segments.filter(
    (segment) => Math.hypot(segment.x0 - center.x, segment.y0 - center.y) < 0.02,
  );
  assert.ok(leaving.length >= 2, 'prism should split');
  assert.equal(result.lit.length, 2);
});
