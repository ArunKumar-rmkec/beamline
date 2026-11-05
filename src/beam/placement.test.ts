import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARD_DROP_M,
  BOARD_FORWARD_M,
  BOARD_HEIGHT,
  BOARD_SIDE_M,
  EDGE_BUTTON_HEIGHT,
  EDGE_BUTTON_Y,
  TRAY_TILT_RADIANS,
  trayDepressionDegrees,
} from './level.ts';

/**
 * Grip of IWER's default right hand, measured head-relative in the
 * production emulator after switching to hands. The input gizmo rests at
 * about (±0.25, −0.10, −0.40); the hand grip that pinches is this pose.
 */
const RIGHT_GRIP = { x: 0.279, y: -0.098, z: -0.355 };

test('the tray sits in reach of a seated player and inside the emulator view', () => {
  assert.ok(BOARD_FORWARD_M >= 0.35 && BOARD_FORWARD_M <= 0.45);
  assert.ok(BOARD_DROP_M >= 0.15 && BOARD_DROP_M <= 0.25);
  assert.ok(BOARD_SIDE_M > 0 && BOARD_SIDE_M < 0.3);

  const reach = Math.hypot(BOARD_FORWARD_M, BOARD_DROP_M, BOARD_SIDE_M);
  assert.ok(reach < 0.55, `center is ${reach.toFixed(2)}m from the eyes`);

  // Buttons sit on the near lip. That lip has to clear the 90° vertical view.
  const buttonLip = EDGE_BUTTON_Y - EDGE_BUTTON_HEIGHT / 2;
  assert.equal(buttonLip, -BOARD_HEIGHT / 2);
  const depression = trayDepressionDegrees(buttonLip);
  assert.ok(depression < 42, `near lip is ${depression.toFixed(1)}° below the gaze`);
  assert.ok(TRAY_TILT_RADIANS > 0.4);

  const sin = Math.sin(TRAY_TILT_RADIANS);
  const cos = Math.cos(TRAY_TILT_RADIANS);
  const normalY = cos;
  const normalZ = sin;
  // Level 1 mirror is 3.3cm left of the board center, on the surface.
  const mirrorX = BOARD_SIDE_M - 0.033;
  const mirrorY = -BOARD_DROP_M + 0.02 * normalY;
  const mirrorZ = -BOARD_FORWARD_M + 0.02 * normalZ;
  const ox = RIGHT_GRIP.x - mirrorX;
  const oy = RIGHT_GRIP.y - mirrorY;
  const oz = RIGHT_GRIP.z - mirrorZ;
  const plane = oy * normalY + oz * normalZ;
  const inPlane = Math.hypot(ox, oy - plane * normalY, oz - plane * normalZ);
  const spare = Math.sqrt(Math.max(0, 0.07 ** 2 - plane ** 2));
  assert.ok(plane > 0 && plane < 0.07, `grip is ${plane.toFixed(3)}m off the mirror`);
  assert.ok(
    inPlane < 0.05 + spare,
    `grip misses the mirror pad by ${inPlane.toFixed(3)}m`,
  );
});
