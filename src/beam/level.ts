/** Playfield size. The physical board matches this, about 40×30cm. */
export const BOARD_WIDTH = 0.4;
export const BOARD_HEIGHT = 0.3;
export const GRID_COLS = 6;
export const GRID_ROWS = 5;
export const MIRROR_HALF_LENGTH = 0.03;
export const TARGET_RADIUS = 0.022;
export const BLOCKER_HALF_WIDTH = 0.026;
export const BLOCKER_HALF_HEIGHT = 0.024;

/**
 * Seated placement. 50cm is inside the doc's 45–55cm range.
 * The drop puts the board at chest-to-lap height while the center stays
 * inside a 2ft reach. The surface tilt is derived from those two so the
 * board reads as a tray table instead of a steep screen.
 */
export const BOARD_FORWARD_M = 0.5;
export const BOARD_DROP_M = 0.34;
/** Radians from horizontal. Far edge up, surface facing the seated player. */
export const TRAY_TILT_RADIANS = Math.atan2(BOARD_FORWARD_M, BOARD_DROP_M);

export function cellCenter(col: number, row: number): { x: number; y: number } {
  const cellWidth = BOARD_WIDTH / GRID_COLS;
  const cellHeight = BOARD_HEIGHT / GRID_ROWS;
  return {
    x: -BOARD_WIDTH / 2 + (col + 0.5) * cellWidth,
    y: -BOARD_HEIGHT / 2 + (row + 0.5) * cellHeight,
  };
}
