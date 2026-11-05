import {
  BLOCKER_HALF_HEIGHT,
  BLOCKER_HALF_WIDTH,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MIRROR_HALF_LENGTH,
  TARGET_RADIUS,
  cellCenter,
} from './level.ts';
import type { BeamBlocker, BeamBoard, BeamHand, BeamMirror } from './solver.ts';

export type PieceType = 'mirror' | 'prism' | 'blocker';

export interface LevelPiece {
  type: PieceType;
  col: number;
  row: number;
  /** Degrees. 0 lies along +X. Blockers ignore this. */
  rot: number;
  movable: boolean;
}

export interface LevelTarget {
  col: number;
  row: number;
}

export interface LevelDef {
  id: string;
  /** Movable-piece degrees that light every target. */
  solution: readonly number[];
  par: number;
  source: { col: number; row: number; dir: number };
  pieces: readonly LevelPiece[];
  targets: readonly LevelTarget[];
}

/**
 * Six handmade boards. Angles start at 0. Each `solution` is the movable
 * pieces, in order, snapped to 15°.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    id: '1',
    par: 1,
    solution: [45],
    source: { col: 0, row: 2, dir: 0 },
    pieces: [{ type: 'mirror', col: 2, row: 2, rot: 0, movable: true }],
    targets: [{ col: 2, row: 4 }],
  },
  {
    id: '2',
    par: 2,
    solution: [45, 45],
    source: { col: 0, row: 1, dir: 0 },
    pieces: [
      { type: 'mirror', col: 2, row: 1, rot: 0, movable: true },
      { type: 'mirror', col: 2, row: 3, rot: 0, movable: true },
    ],
    targets: [{ col: 5, row: 3 }],
  },
  {
    id: '3',
    par: 1,
    solution: [45],
    source: { col: 0, row: 2, dir: 0 },
    pieces: [
      { type: 'mirror', col: 2, row: 2, rot: 0, movable: true },
      { type: 'blocker', col: 4, row: 2, rot: 0, movable: false },
    ],
    targets: [{ col: 2, row: 4 }],
  },
  {
    id: '4',
    par: 1,
    solution: [45],
    source: { col: 0, row: 2, dir: 0 },
    pieces: [{ type: 'prism', col: 2, row: 2, rot: 0, movable: true }],
    targets: [
      { col: 2, row: 4 },
      { col: 5, row: 2 },
    ],
  },
  {
    id: '5',
    par: 2,
    solution: [45, 45],
    source: { col: 0, row: 1, dir: 0 },
    pieces: [
      { type: 'mirror', col: 2, row: 1, rot: 0, movable: true },
      { type: 'blocker', col: 4, row: 1, rot: 0, movable: false },
      { type: 'prism', col: 2, row: 3, rot: 0, movable: true },
    ],
    targets: [
      { col: 2, row: 4 },
      { col: 5, row: 3 },
    ],
  },
  {
    id: '6',
    par: 3,
    solution: [45, 45, 45],
    source: { col: 0, row: 0, dir: 0 },
    pieces: [
      { type: 'mirror', col: 2, row: 0, rot: 0, movable: true },
      { type: 'blocker', col: 4, row: 0, rot: 0, movable: false },
      { type: 'mirror', col: 2, row: 2, rot: 0, movable: true },
      { type: 'blocker', col: 2, row: 3, rot: 0, movable: false },
      { type: 'prism', col: 4, row: 2, rot: 0, movable: true },
    ],
    targets: [
      { col: 4, row: 4 },
      { col: 5, row: 2 },
    ],
  },
];

export function movablePieces(level: LevelDef): LevelPiece[] {
  return level.pieces.filter((piece) => piece.movable);
}

/** Board-plane description of a level. `angles` overrides movable pieces, in order. */
export function boardFromLevel(
  level: LevelDef,
  angles: readonly number[],
  hand?: BeamHand,
): BeamBoard {
  const source = cellCenter(level.source.col, level.source.row);
  let movable = 0;
  const mirrors: BeamMirror[] = [];
  const prisms: BeamMirror[] = [];
  const blockers: BeamBlocker[] = [];
  for (const piece of level.pieces) {
    const center = cellCenter(piece.col, piece.row);
    const rot = piece.movable ? (angles[movable++] ?? piece.rot) : piece.rot;
    if (piece.type === 'blocker') {
      blockers.push({
        x: center.x,
        y: center.y,
        halfWidth: BLOCKER_HALF_WIDTH,
        halfHeight: BLOCKER_HALF_HEIGHT,
      });
      continue;
    }
    const surface = {
      x: center.x,
      y: center.y,
      rot,
      halfLength: MIRROR_HALF_LENGTH,
    };
    if (piece.type === 'prism') prisms.push(surface);
    else mirrors.push(surface);
  }
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    source: { x: source.x, y: source.y, dir: level.source.dir },
    mirrors,
    prisms,
    blockers,
    targets: level.targets.map((target) => {
      const center = cellCenter(target.col, target.row);
      return { x: center.x, y: center.y, radius: TARGET_RADIUS };
    }),
    ...(hand ? { hand } : {}),
  };
}
