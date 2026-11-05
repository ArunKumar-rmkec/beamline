import { nearestSnap, SNAP_STEP_RADIANS } from './snap.ts';

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
