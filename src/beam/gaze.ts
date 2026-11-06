export interface GazeTarget {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface GazeResult<T extends GazeTarget> {
  piece: T;
  angleDeg: number;
}

/**
 * Raycast forward from head pose to find the movable piece nearest the gaze ray within `maxAngleDegrees` (default 10°).
 */
export function findGazedPiece<T extends GazeTarget>(
  headPos: { x: number; y: number; z: number },
  headForward: { x: number; y: number; z: number },
  pieces: readonly T[],
  maxAngleDegrees = 10,
): GazeResult<T> | null {
  let bestPiece: T | null = null;
  let minAngle = maxAngleDegrees;

  const fLen = Math.hypot(headForward.x, headForward.y, headForward.z) || 1;
  const fx = headForward.x / fLen;
  const fy = headForward.y / fLen;
  const fz = headForward.z / fLen;

  for (const piece of pieces) {
    const dx = piece.x - headPos.x;
    const dy = piece.y - headPos.y;
    const dz = piece.z - headPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-4) continue;
    const dot = Math.min(1, Math.max(-1, (dx * fx + dy * fy + dz * fz) / dist));
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    if (angleDeg <= minAngle) {
      minAngle = angleDeg;
      bestPiece = piece;
    }
  }

  return bestPiece ? { piece: bestPiece, angleDeg: minAngle } : null;
}

/**
 * Selects piece for pinch:
 * Prefers piece in hand reach radius; if none in reach, selects gazed piece.
 */
export function selectPieceForPinch<T extends GazeTarget>(
  handPos: { x: number; y: number; z: number },
  pieces: readonly T[],
  reachRadius: number,
  gazedPiece: T | null,
): T | null {
  let best: T | null = null;
  let bestDist = reachRadius;

  for (const piece of pieces) {
    const dist = Math.hypot(piece.x - handPos.x, piece.y - handPos.y, piece.z - handPos.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = piece;
    }
  }

  if (best) return best;
  return gazedPiece ?? null;
}
