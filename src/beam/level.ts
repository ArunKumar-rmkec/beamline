import type { BeamBoard } from './solver.js';

/** Playfield size. The physical board matches this, about 40×30cm. */
export const BOARD_WIDTH = 0.4;
export const BOARD_HEIGHT = 0.3;
export const GRID_COLS = 6;
export const GRID_ROWS = 5;
export const MIRROR_HALF_LENGTH = 0.03;
export const TARGET_RADIUS = 0.022;

/** Seated placement: 50cm in front of the head and 18cm below eye level. */
export const BOARD_FORWARD_M = 0.5;
export const BOARD_DROP_M = 0.18;

const SOURCE_CELL = { col: 0, row: 2 };
const MIRROR_CELL = { col: 2, row: 2 };
const TARGET_CELL = { col: 2, row: 4 };

/** Flat mirror lets the beam run past. This angle sends it up into the target. */
export const SOLVED_MIRROR_DEGREES = 45;

export function cellCenter(col: number, row: number): { x: number; y: number } {
  const cellWidth = BOARD_WIDTH / GRID_COLS;
  const cellHeight = BOARD_HEIGHT / GRID_ROWS;
  return {
    x: -BOARD_WIDTH / 2 + (col + 0.5) * cellWidth,
    y: -BOARD_HEIGHT / 2 + (row + 0.5) * cellHeight,
  };
}

export function levelBoard(mirrorDegrees: number): BeamBoard {
  const source = cellCenter(SOURCE_CELL.col, SOURCE_CELL.row);
  const mirror = cellCenter(MIRROR_CELL.col, MIRROR_CELL.row);
  const target = cellCenter(TARGET_CELL.col, TARGET_CELL.row);
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    source: { x: source.x, y: source.y, dir: 0 },
    mirrors: [
      {
        x: mirror.x,
        y: mirror.y,
        rot: mirrorDegrees,
        halfLength: MIRROR_HALF_LENGTH,
      },
    ],
    targets: [
      {
        x: target.x,
        y: target.y,
        radius: TARGET_RADIUS,
      },
    ],
  };
}

export const SOURCE_POSITION = cellCenter(SOURCE_CELL.col, SOURCE_CELL.row);
export const MIRROR_POSITION = cellCenter(MIRROR_CELL.col, MIRROR_CELL.row);
export const TARGET_POSITION = cellCenter(TARGET_CELL.col, TARGET_CELL.row);
