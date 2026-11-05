import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARD_DROP_M,
  BOARD_FORWARD_M,
  BOARD_HEIGHT,
  BOARD_SIDE_M,
  EDGE_BUTTON_HEIGHT,
  EDGE_BUTTON_Y,
  SOLO_REACH_RADIUS,
  TRAY_TILT_RADIANS,
  cellCenter,
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
  assert.equal(BOARD_SIDE_M, 0);

  const reach = Math.hypot(BOARD_FORWARD_M, BOARD_DROP_M, BOARD_SIDE_M);
  assert.ok(reach < 0.55, `center is ${reach.toFixed(2)}m from the eyes`);

  // Buttons sit outside the level geometry on the near edge, clearing the 90° vertical view.
  const buttonFarEdge = EDGE_BUTTON_Y + EDGE_BUTTON_HEIGHT / 2;
  assert.ok(buttonFarEdge < -BOARD_HEIGHT / 2, 'buttons sit strictly below the level grid');
  const buttonLip = EDGE_BUTTON_Y - EDGE_BUTTON_HEIGHT / 2;
  const depression = trayDepressionDegrees(buttonLip);
  assert.ok(depression < 46, `near lip is ${depression.toFixed(1)}° below the gaze`);
  assert.ok(TRAY_TILT_RADIANS > 0.4);

  const sin = Math.sin(TRAY_TILT_RADIANS);
  const cos = Math.cos(TRAY_TILT_RADIANS);
  const normalY = cos;
  const normalZ = sin;
  const mirror = cellCenter(2, 2);
  const mirrorX = BOARD_SIDE_M + mirror.x;
  const mirrorY = -BOARD_DROP_M + mirror.y * sin + 0.02 * normalY;
  const mirrorZ = -BOARD_FORWARD_M - mirror.y * cos + 0.02 * normalZ;
  const ox = RIGHT_GRIP.x - mirrorX;
  const oy = RIGHT_GRIP.y - mirrorY;
  const oz = RIGHT_GRIP.z - mirrorZ;
  const plane = oy * normalY + oz * normalZ;
  const inPlane = Math.hypot(ox, oy - plane * normalY, oz - plane * normalZ);
  const spare = Math.sqrt(Math.max(0, 0.07 ** 2 - plane ** 2));
  assert.ok(plane > 0 && plane < 0.07, `grip is ${plane.toFixed(3)}m off the mirror`);
  assert.ok(
    inPlane < SOLO_REACH_RADIUS + spare,
    `grip misses the mirror by ${inPlane.toFixed(3)}m`,
  );
});

test('levels 3 and 6 buttons never overlap any level geometry', async () => {
  const { LEVELS } = await import('./levels.ts');
  const buttonTopY = EDGE_BUTTON_Y + EDGE_BUTTON_HEIGHT / 2;
  for (const levelId of ['3', '6']) {
    const level = LEVELS.find((l) => l.id === levelId);
    assert.ok(level, `level ${levelId} exists`);
    // Source emitter position
    const sourcePos = cellCenter(level.source.col, level.source.row);
    assert.ok(
      sourcePos.y - 0.02 > buttonTopY,
      `level ${levelId} emitter (y=${sourcePos.y.toFixed(3)}) overlaps buttons (top=${buttonTopY.toFixed(3)})`,
    );
    // Pieces
    for (const piece of level.pieces) {
      const piecePos = cellCenter(piece.col, piece.row);
      assert.ok(
        piecePos.y - 0.02 > buttonTopY,
        `level ${levelId} piece ${piece.type} (y=${piecePos.y.toFixed(3)}) overlaps buttons`,
      );
    }
  }
});

test('tutorial panel sits strictly above the top edge of the board grid', () => {
  const TUTORIAL_CARD_Y = BOARD_HEIGHT / 2 + 0.058;
  const TUTORIAL_CARD_HEIGHT = 0.085;
  const TUTORIAL_BTN_Y = BOARD_HEIGHT / 2 + 0.038;
  const TUTORIAL_BTN_HEIGHT = 0.025;

  const cardBottomEdge = TUTORIAL_CARD_Y - TUTORIAL_CARD_HEIGHT / 2;
  const btnBottomEdge = TUTORIAL_BTN_Y - TUTORIAL_BTN_HEIGHT / 2;

  assert.ok(
    cardBottomEdge >= BOARD_HEIGHT / 2,
    `tutorial card bottom (${cardBottomEdge.toFixed(3)}) should be above board top (${(BOARD_HEIGHT / 2).toFixed(3)})`,
  );
  assert.ok(
    btnBottomEdge >= BOARD_HEIGHT / 2,
    `tutorial button bottom (${btnBottomEdge.toFixed(3)}) should be above board top (${(BOARD_HEIGHT / 2).toFixed(3)})`,
  );
});
