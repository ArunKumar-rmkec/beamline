import { boardFromLevel, type LevelDef, type LevelPiece } from './levels.ts';
import { solveBeam } from './solver.ts';

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

function mulberry32(a: number) {
  let seed = a >>> 0;
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandidate(seed: number): LevelDef {
  const rng = mulberry32(seed);
  const type = Math.floor(rng() * 4);

  if (type === 0) {
    // 1 mirror bouncing up
    const r0 = 1 + Math.floor(rng() * 2); // row 1 or 2
    const c1 = 2 + Math.floor(rng() * 2); // col 2 or 3
    const r1 = 3 + Math.floor(rng() * 2); // row 3 or 4
    return {
      id: 'Daily',
      par: 1,
      solution: [45],
      source: { col: 0, row: r0, dir: 0 },
      pieces: [
        { type: 'mirror', col: c1, row: r0, rot: 0, movable: true },
        { type: 'blocker', col: c1 + 2, row: r0, rot: 0, movable: false },
      ],
      targets: [{ col: c1, row: r1 }],
    };
  }

  if (type === 1) {
    // 1 mirror bouncing down
    const r0 = 3 + Math.floor(rng() * 2); // row 3 or 4
    const c1 = 2 + Math.floor(rng() * 2); // col 2 or 3
    const r1 = Math.floor(rng() * 2); // row 0 or 1
    return {
      id: 'Daily',
      par: 1,
      solution: [135],
      source: { col: 0, row: r0, dir: 0 },
      pieces: [
        { type: 'mirror', col: c1, row: r0, rot: 0, movable: true },
        { type: 'blocker', col: c1 + 2, row: r0, rot: 0, movable: false },
      ],
      targets: [{ col: c1, row: r1 }],
    };
  }

  if (type === 2) {
    // 2 mirrors
    const r0 = Math.floor(rng() * 2); // row 0 or 1
    const c1 = 2;
    const r1 = r0 + 2; // row 2 or 3
    const c2 = 4 + Math.floor(rng() * 2); // col 4 or 5
    return {
      id: 'Daily',
      par: 2,
      solution: [45, 45],
      source: { col: 0, row: r0, dir: 0 },
      pieces: [
        { type: 'mirror', col: c1, row: r0, rot: 0, movable: true },
        { type: 'blocker', col: 4, row: r0, rot: 0, movable: false },
        { type: 'mirror', col: c1, row: r1, rot: 0, movable: true },
      ],
      targets: [{ col: c2, row: r1 }],
    };
  }

  // 1 mirror + 1 prism
  const r0 = Math.floor(rng() * 2); // row 0 or 1
  const c1 = 2;
  const r1 = r0 + 2; // row 2 or 3
  const c2 = 4 + Math.floor(rng() * 2); // col 4 or 5
  const r2 = 4;
  return {
    id: 'Daily',
    par: 2,
    solution: [45, 45],
    source: { col: 0, row: r0, dir: 0 },
    pieces: [
      { type: 'mirror', col: c1, row: r0, rot: 0, movable: true },
      { type: 'blocker', col: 4, row: r0, rot: 0, movable: false },
      { type: 'prism', col: c1, row: r1, rot: 0, movable: true },
    ],
    targets: [
      { col: c1, row: r2 },
      { col: c2, row: r1 },
    ],
  };
}

export function isSolvableAndNoShortcut(level: LevelDef): boolean {
  // 1. Solution solves the puzzle
  const solved = solveBeam(boardFromLevel(level, level.solution));
  if (!solved.hitTarget) return false;

  // 2. Starting angles do NOT solve the puzzle
  const startingAngles = level.pieces.filter((p) => p.movable).map(() => 0);
  const start = solveBeam(boardFromLevel(level, startingAngles));
  if (start.hitTarget) return false;

  // 3. No target is lit at start (no unintended shortcut)
  if (start.lit.some(Boolean)) return false;

  return true;
}

export function generateDaily(dateInput?: Date | string): LevelDef {
  const dateStr =
    typeof dateInput === 'string'
      ? dateInput
      : localDateString(dateInput instanceof Date ? dateInput : new Date());

  const baseSeed = hashString(dateStr);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = generateCandidate(baseSeed + attempt);
    if (isSolvableAndNoShortcut(candidate)) {
      return candidate;
    }
  }

  // Guaranteed fallback template
  return {
    id: 'Daily',
    par: 1,
    solution: [45],
    source: { col: 0, row: 2, dir: 0 },
    pieces: [
      { type: 'mirror', col: 2, row: 2, rot: 0, movable: true },
      { type: 'blocker', col: 4, row: 2, rot: 0, movable: false },
    ],
    targets: [{ col: 2, row: 4 }],
  };
}
