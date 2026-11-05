/** 15° mirror steps, with a dead zone so a small wrist tremor does not tick over. */
export const SNAP_STEP_RADIANS = Math.PI / 12;
export const SNAP_HYSTERESIS_RADIANS = (4 * Math.PI) / 180;
export const TWIST_SMOOTH_TAU_SECONDS = 0.08;

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function wrapPi(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Ease toward a target angle along the short way around the circle. */
export function smoothAngle(
  current: number,
  target: number,
  deltaSeconds: number,
  tau = TWIST_SMOOTH_TAU_SECONDS,
): number {
  if (!(deltaSeconds > 0) || !(tau > 0)) return target;
  const alpha = 1 - Math.exp(-deltaSeconds / tau);
  return current + wrapPi(target - current) * alpha;
}

/**
 * Stay on `heldSnap` until the smoothed angle crosses the halfway mark
 * by `hysteresis`. Then jump a whole number of steps.
 */
export function snapWithHysteresis(
  angle: number,
  heldSnap: number,
  step = SNAP_STEP_RADIANS,
  hysteresis = SNAP_HYSTERESIS_RADIANS,
): number {
  const delta = wrapPi(angle - heldSnap);
  const threshold = step / 2 + hysteresis;
  if (Math.abs(delta) < threshold) return heldSnap;
  const steps = Math.round(delta / step);
  if (steps === 0) return heldSnap;
  return heldSnap + steps * step;
}

export function nearestSnap(angle: number, step = SNAP_STEP_RADIANS): number {
  return Math.round(angle / step) * step;
}

/**
 * Compute the next snapped angle given a step count (e.g. 1, -1) or degrees (e.g. 15, -15).
 * Ensures positive rotates positive.
 */
export function angleFromStepsOrDegrees(
  committed: number,
  stepsOrDegrees: number,
): number {
  const steps =
    Math.abs(stepsOrDegrees) >= 15
      ? Math.round(stepsOrDegrees / 15)
      : Math.trunc(stepsOrDegrees);
  return wrapPi(committed + steps * SNAP_STEP_RADIANS);
}

/** Signed rotation of `to` relative to `from`, projected onto `axis`. */
export function signedTwist(from: Quat, to: Quat, axis: Vec3): number {
  const invX = -from.x;
  const invY = -from.y;
  const invZ = -from.z;
  const invW = from.w;
  const x = to.w * invX + to.x * invW + to.y * invZ - to.z * invY;
  const y = to.w * invY - to.x * invZ + to.y * invW + to.z * invX;
  const z = to.w * invZ + to.x * invY - to.y * invX + to.z * invW;
  const w = to.w * invW - to.x * invX - to.y * invY - to.z * invZ;
  const proj = x * axis.x + y * axis.y + z * axis.z;
  const tx = axis.x * proj;
  const ty = axis.y * proj;
  const tz = axis.z * proj;
  const length = Math.hypot(tx, ty, tz, w) || 1;
  const angle = 2 * Math.atan2(Math.hypot(tx, ty, tz) / length, w / length);
  return proj < 0 ? -angle : angle;
}

/**
 * Wrist roll and fingertip orbit both describe the same twist.
 * Keep the stronger one so they are not added on top of each other.
 */
export function chooseTwistDelta(tipDelta: number, gripDelta: number): number {
  return Math.abs(tipDelta) > Math.abs(gripDelta) ? tipDelta : gripDelta;
}
