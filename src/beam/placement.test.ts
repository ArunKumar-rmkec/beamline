import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLOCKER_HALF_HEIGHT,
  BOARD_DROP_M,
  BOARD_FORWARD_M,
  BOARD_HEIGHT,
  BOARD_SIDE_M,
  EDGE_BUTTON_HEIGHT,
  EDGE_BUTTON_Y,
  MIRROR_HALF_LENGTH,
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
  assert.ok(BOARD_FORWARD_M >= 0.40 && BOARD_FORWARD_M <= 0.46);
  assert.ok(BOARD_DROP_M >= 0.24 && BOARD_DROP_M <= 0.30);
  assert.equal(BOARD_SIDE_M, 0);

  const reach = Math.hypot(BOARD_FORWARD_M, BOARD_DROP_M, BOARD_SIDE_M);
  assert.ok(reach < 0.55, `center is ${reach.toFixed(2)}m from the eyes`);

  // Buttons sit outside the level geometry on the near edge, clearing the 90° vertical view.
  const buttonFarEdge = EDGE_BUTTON_Y + EDGE_BUTTON_HEIGHT / 2;
  assert.ok(buttonFarEdge < -BOARD_HEIGHT / 2, 'buttons sit strictly below the level grid');
  const buttonLip = EDGE_BUTTON_Y - EDGE_BUTTON_HEIGHT / 2;
  const depression = trayDepressionDegrees(buttonLip);
  assert.ok(depression < 58, `near lip is ${depression.toFixed(1)}° below the gaze`);
  assert.ok(
    TRAY_TILT_RADIANS >= (30 * Math.PI) / 180 &&
    TRAY_TILT_RADIANS <= (40 * Math.PI) / 180,
  );

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
  assert.ok(
    inPlane < SOLO_REACH_RADIUS,
    `grip misses the mirror by ${inPlane.toFixed(3)}m`,
  );
});

test('every piece and button sits within 0.6m of the shoulders', async () => {
  const { LEVELS } = await import('./levels.ts');
  const sin = Math.sin(TRAY_TILT_RADIANS);
  const cos = Math.cos(TRAY_TILT_RADIANS);

  // Seated player shoulders: ~0.15m below eyes, ±0.18m lateral
  const shoulders = [
    { x: -0.18, y: -0.15, z: 0 },
    { x: 0.18, y: -0.15, z: 0 },
  ];

  const toWorld = (localX: number, localY: number, localZ = 0.02) => ({
    x: localX,
    y: -BOARD_DROP_M + localY * sin + localZ * cos,
    z: -BOARD_FORWARD_M - localY * cos + localZ * sin,
  });

  const checkReach = (name: string, localX: number, localY: number, localZ = 0.02) => {
    const pt = toWorld(localX, localY, localZ);
    const dLeft = Math.hypot(pt.x - shoulders[0].x, pt.y - shoulders[0].y, pt.z - shoulders[0].z);
    const dRight = Math.hypot(pt.x - shoulders[1].x, pt.y - shoulders[1].y, pt.z - shoulders[1].z);
    const minD = Math.min(dLeft, dRight);
    assert.ok(minD <= 0.6, `${name} is at ${minD.toFixed(3)}m, exceeding 0.6m reach`);
  };

  // Check all grid cells (0..5 cols, 0..4 rows)
  for (let c = 0; c < 6; c++) {
    for (let r = 0; r < 5; r++) {
      const p = cellCenter(c, r);
      checkReach(`cell(${c},${r})`, p.x, p.y);
    }
  }

  // Check all level pieces, sources, targets
  for (const lvl of LEVELS) {
    const src = cellCenter(lvl.source.col, lvl.source.row);
    checkReach(`level ${lvl.id} source`, src.x, src.y);
    for (const piece of lvl.pieces) {
      const p = cellCenter(piece.col, piece.row);
      checkReach(`level ${lvl.id} piece ${piece.type}`, p.x, p.y);
    }
    for (const tgt of lvl.targets) {
      const p = cellCenter(tgt.col, tgt.row);
      checkReach(`level ${lvl.id} target`, p.x, p.y);
    }
  }

  // Check near-edge buttons (recenter, hand, levels, one-hand)
  for (const bx of [-0.15, -0.05, 0.05, 0.15]) {
    checkReach(`near button x=${bx}`, bx, EDGE_BUTTON_Y);
  }

  // Check top-edge buttons (tutorial next & skip)
  for (const tx of [-0.06, 0.06]) {
    checkReach(`top button x=${tx}`, tx, BOARD_HEIGHT / 2 + 0.038);
  }
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

test('level 6 gap between bottom-row pieces and button top edge is at least 3cm', async () => {
  const { LEVELS } = await import('./levels.ts');
  const level6 = LEVELS.find((l) => l.id === '6');
  assert.ok(level6, 'level 6 exists');
  const buttonTopY = EDGE_BUTTON_Y + EDGE_BUTTON_HEIGHT / 2;
  let lowestEdgeY = 0;
  let found = false;
  for (const piece of level6.pieces) {
    if (piece.row !== 0) continue;
    const center = cellCenter(piece.col, piece.row);
    const halfH = piece.type === 'blocker' ? BLOCKER_HALF_HEIGHT : MIRROR_HALF_LENGTH;
    const bottomEdge = center.y - halfH;
    if (!found || bottomEdge < lowestEdgeY) {
      lowestEdgeY = bottomEdge;
      found = true;
    }
  }
  const gapM = lowestEdgeY - buttonTopY;
  assert.ok(
    gapM >= 0.03,
    `gap between level 6 bottom pieces (${lowestEdgeY.toFixed(3)}) and buttons (${buttonTopY.toFixed(3)}) is ${gapM.toFixed(3)}m, should be >= 0.030m`,
  );
});
