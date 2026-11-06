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

test('brute-force all snap angle combos for every level and assert winning sets', () => {
  const SNAP_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];

  function getAngleCombos(pieceCount: number): number[][] {
    let combos: number[][] = [[]];
    for (let i = 0; i < pieceCount; i++) {
      combos = combos.flatMap((c) => SNAP_ANGLES.map((a) => [...c, a]));
    }
    return combos;
  }

  for (const level of LEVELS) {
    const movable = movablePieces(level);
    const combos = getAngleCombos(movable.length);
    const winningCombos: number[][] = [];
    for (const combo of combos) {
      const result = solveBeam(boardFromLevel(level, combo));
      if (result.hitTarget) {
        winningCombos.push(combo);
      }
    }

    const hasListedSolution = winningCombos.some((combo) =>
      combo.length === level.solution.length &&
      combo.every((val, i) => val === level.solution[i]),
    );
    assert.ok(hasListedSolution, `level ${level.id} listed solution should win`);

    if (level.id === '2') {
      const wins45_45 = winningCombos.some((c) => c[0] === 45 && c[1] === 45);
      const wins15_0 = winningCombos.some((c) => c[0] === 15 && c[1] === 0);
      assert.equal(wins45_45, true, 'level 2 [45, 45] should win');
      assert.equal(wins15_0, false, 'level 2 [15, 0] should not win');
    }

    assert.deepEqual(winningCombos, [Array.from(level.solution)], `level ${level.id} winning combos`);
  }
});
