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
 * Seated placement. IWER's default hands rest about 36cm ahead and 10cm
 * below the head, and the emulator looks out with a 90° vertical view.
 * 40cm forward and 15cm down keeps the whole tray inside that view and
 * inside a seated reach on a Quest. The tray is centered on the facing
 * direction. The tilt faces the surface at the player.
 */
export const BOARD_FORWARD_M = 0.4;
export const BOARD_DROP_M = 0.15;
/** Meters to the player's right of the facing direction. Zero keeps the tray centered. */
export const BOARD_SIDE_M = 0;
/** Visible pinch disc on a movable piece. */
export const GRAB_PAD_RADIUS = 0.05;
/**
 * Generous reach radius ensuring resting hands at the default emulator pose (x=0.25)
 * and seated players can reliably grab movable pieces.
 */
export const GENEROUS_GRAB_RADIUS = 0.38;
export const SOLO_REACH_RADIUS = GENEROUS_GRAB_RADIUS;
/** Radians from horizontal. Far edge up, surface facing the seated player. */
export const TRAY_TILT_RADIANS = Math.atan2(BOARD_FORWARD_M, BOARD_DROP_M);

/** Near-edge poke targets. They sit outside the grid on the near edge shelf, never overlapping level geometry. */
export const EDGE_BUTTON_WIDTH = 0.088;
export const EDGE_BUTTON_HEIGHT = 0.036;
export const EDGE_BUTTON_DEPTH = 0.02;
/** Board-local Y of a near-edge button center. Negative Y is toward the player. */
export const EDGE_BUTTON_Y = -BOARD_HEIGHT / 2 - EDGE_BUTTON_HEIGHT / 2 - 0.005;

/**
 * Degrees below a level gaze for a point on the board's Y axis.
 * Matches the tray basis: local +Y is the far edge.
 */
export function trayDepressionDegrees(localY: number): number {
  const sin = Math.sin(TRAY_TILT_RADIANS);
  const cos = Math.cos(TRAY_TILT_RADIANS);
  const y = -BOARD_DROP_M + localY * sin;
  const z = -BOARD_FORWARD_M - localY * cos;
  return (Math.atan2(-y, -z) * 180) / Math.PI;
}

export function cellCenter(col: number, row: number): { x: number; y: number } {
  const cellWidth = BOARD_WIDTH / GRID_COLS;
  const cellHeight = BOARD_HEIGHT / GRID_ROWS;
  return {
    x: -BOARD_WIDTH / 2 + (col + 0.5) * cellWidth,
    y: -BOARD_HEIGHT / 2 + (row + 0.5) * cellHeight,
  };
}
