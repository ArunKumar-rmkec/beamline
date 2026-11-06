import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateDaily, isSolvableAndNoShortcut, localDateString } from './daily.ts';
import { readDailyWon, writeDailyWon, type KeyValueStore } from '../storage.ts';

test('daily generator produces verified solvable puzzles across 60 dates without shortcuts', () => {
  const startDate = new Date('2026-01-01T12:00:00Z');

  for (let d = 0; d < 60; d += 1) {
    const curDate = new Date(startDate.getTime() + d * 86400000);
    const dateStr = curDate.toISOString().slice(0, 10);
    const puzzle = generateDaily(dateStr);

    assert.equal(puzzle.id, 'Daily');
    assert.ok(puzzle.solution.length > 0, `date ${dateStr} has solution`);
    assert.ok(puzzle.targets.length > 0, `date ${dateStr} has targets`);
    assert.ok(isSolvableAndNoShortcut(puzzle), `date ${dateStr} is verified solvable and has no shortcut`);

    // Deterministic: repeating the call with the same date gives identical puzzle
    const repeat = generateDaily(dateStr);
    assert.deepEqual(repeat, puzzle, `date ${dateStr} is deterministic`);
  }
});

test('localDateString formats YYYY-MM-DD properly', () => {
  const d = new Date(2026, 10, 6); // Nov 6, 2026
  assert.equal(localDateString(d), '2026-11-06');
});

test('daily puzzle win storage round-trips under beamline:daily', () => {
  const map = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };

  assert.equal(readDailyWon(store, '2026-11-06'), false);
  writeDailyWon(store, '2026-11-06');
  assert.equal(readDailyWon(store, '2026-11-06'), true);
  // Different date is not won
  assert.equal(readDailyWon(store, '2026-11-07'), false);
});
