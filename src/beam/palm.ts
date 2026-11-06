import { nearestSnap, SNAP_STEP_RADIANS, wrapPi } from './snap.ts';
import { solveBeam, type BeamBoard, type BeamHand } from './solver.ts';

/**
 * Reflect `incoming` around the palm normal, drop the result onto the board
 * plane, and snap that direction to 15°. Returns null when the bounce leaves
 * the plane so steeply that the projection is unstable.
 */
export function palmOutgoingDegrees(
  incomingX: number,
  incomingY: number,
  normalX: number,
  normalY: number,
  normalZ: number,
): number | null {
  const incomingLength = Math.hypot(incomingX, incomingY);
  const normalLength = Math.hypot(normalX, normalY, normalZ);
  if (incomingLength < 1e-6 || normalLength < 1e-6) return null;
  const dx = incomingX / incomingLength;
  const dy = incomingY / incomingLength;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const nz = normalZ / normalLength;
  const dot = dx * nx + dy * ny;
  const rx = dx - 2 * dot * nx;
  const ry = dy - 2 * dot * ny;
  if (Math.hypot(rx, ry) < 0.25) return null;
  const radians = Math.atan2(ry, rx);
  const snapped = nearestSnap(radians, SNAP_STEP_RADIANS);
  const degrees = (Math.atan2(Math.sin(snapped), Math.cos(snapped)) * 180) / Math.PI;
  return Math.round(degrees);
}

export interface PalmLockResult {
  angle: number;
  targetIndex: number;
}

/**
 * Checks all 24 snap angles (15° steps) from `palmPos` on the board.
 * Finds angles where the palm reflection hits a target (lock).
 * Selects the angle nearest to `preferredDir` (or nearest to 90° bounce from incoming).
 */
export function findPalmLockAngle(
  board: BeamBoard,
  palmPos: { x: number; y: number },
  incoming: { x: number; y: number },
  preferredDir: number | null = null,
  palmRadius = 0.03,
): PalmLockResult | null {
  const bareRes = solveBeam(board);
  const candidates: Array<{
    angle: number;
    targetIndex: number;
    newlyLit: boolean;
    angularDiff: number;
  }> = [];

  let refDir = preferredDir;
  if (refDir === null) {
    const inAngle = (Math.atan2(incoming.y, incoming.x) * 180) / Math.PI;
    refDir = Math.round(inAngle + 90);
  }

  for (let step = 0; step < 24; step += 1) {
    const angle = step * 15;
    const testHand: BeamHand = {
      x: palmPos.x,
      y: palmPos.y,
      radius: palmRadius,
      dir: angle,
    };
    const testRes = solveBeam({ ...board, hand: testHand });

    const newlyLitIdx = testRes.lit.findIndex((lit, i) => lit && !bareRes.lit[i]);
    const anyLitIdx = newlyLitIdx !== -1 ? newlyLitIdx : testRes.lit.findIndex((lit) => lit);

    if (anyLitIdx !== -1) {
      const diffRad = Math.abs(wrapPi(((angle - refDir) * Math.PI) / 180));
      candidates.push({
        angle,
        targetIndex: anyLitIdx,
        newlyLit: newlyLitIdx !== -1,
        angularDiff: diffRad,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.newlyLit !== b.newlyLit) return a.newlyLit ? -1 : 1;
    return a.angularDiff - b.angularDiff;
  });

  const best = candidates[0];
  return best ? { angle: best.angle, targetIndex: best.targetIndex } : null;
}
