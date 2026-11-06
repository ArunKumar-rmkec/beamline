import {
  SNAP_STEP_RADIANS,
  SNAP_HYSTERESIS_RADIANS,
  TWIST_SMOOTH_TAU_SECONDS,
  smoothAngle,
  snapWithHysteresis,
  wrapPi,
} from './snap.ts';

export const TRACKING_JUMP = (40 * Math.PI) / 180;
export const TRACKING_MOVE_JUMP = 0.08;

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

export function quatMult(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatInv(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatFromRollDeg(deg: number): Quat {
  const rad = (deg * Math.PI) / 180;
  return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
}

export function extractWristRollRad(q: Quat): number {
  const len = Math.hypot(q.z, q.w);
  if (len < 1e-6) return 0;
  const z = q.z / len;
  const w = q.w / len;
  return wrapPi(2 * Math.atan2(z, w));
}

export function extractWristRollDeg(q: Quat): number {
  return Math.round(((extractWristRollRad(q) * 180) / Math.PI) * 10) / 10;
}

export interface WristState {
  rollDeg: number;
  baselineDeg: number;
  appliedSteps: number;
  guardRejects: number;
}

export class WristTracker {
  private grabbing = false;
  private grabPieceAngle = 0;
  private baselineQuat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private baselineDeg = 0;
  private lastQuat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private lastPos: Vec3 | null = null;
  private smoothedAngle = 0;
  private committedAngle = 0;
  private rollDeg = 0;
  private appliedSteps = 0;
  private guardRejects = 0;

  onGrab(pieceAngle: number, quat: Quat, pos: Vec3 | null = null): void {
    this.grabbing = true;
    this.grabPieceAngle = pieceAngle;
    this.baselineQuat = { ...quat };
    this.baselineDeg = extractWristRollDeg(quat);
    this.lastQuat = { ...quat };
    this.lastPos = pos ? { ...pos } : null;
    this.smoothedAngle = pieceAngle;
    this.committedAngle = pieceAngle;
    this.rollDeg = this.baselineDeg;
    this.appliedSteps = 0;
  }

  onRelease(): void {
    this.grabbing = false;
    this.appliedSteps = 0;
  }

  update(
    currentQuat: Quat,
    currentPos: Vec3 | null = null,
    deltaSeconds = 0.016,
  ): { pieceAngle: number; changed: boolean } {
    this.rollDeg = extractWristRollDeg(currentQuat);

    if (!this.grabbing) {
      this.lastQuat = { ...currentQuat };
      if (currentPos) this.lastPos = { ...currentPos };
      return { pieceAngle: this.committedAngle, changed: false };
    }

    // 1. Positional tracking jump guard (~8cm)
    if (this.lastPos && currentPos) {
      const dist = Math.hypot(
        currentPos.x - this.lastPos.x,
        currentPos.y - this.lastPos.y,
        currentPos.z - this.lastPos.z,
      );
      if (dist > TRACKING_MOVE_JUMP) {
        this.guardRejects++;
        // Re-baseline safely to avoid anomalous spin
        this.baselineQuat = { ...currentQuat };
        this.baselineDeg = extractWristRollDeg(currentQuat);
        this.grabPieceAngle = this.committedAngle;
        this.smoothedAngle = this.committedAngle;
        this.appliedSteps = 0;
        this.lastQuat = { ...currentQuat };
        this.lastPos = { ...currentPos };
        this.rollDeg = this.baselineDeg;
        return { pieceAngle: this.committedAngle, changed: false };
      }
    }

    // 2. Swing jump guard: non-roll swing (pitch/yaw) exceeding TRACKING_JUMP (~40°)
    // World-space deltas: twist is measured about the viewer's forward (world Z)
    // axis, so a wrist roll maps 1:1 whatever the joint's pitch/yaw offset.
    const frameRel = quatMult(currentQuat, quatInv(this.lastQuat));
    const frameTwistRad = extractWristRollRad(frameRel);
    const frameSwingLen = Math.hypot(frameRel.x, frameRel.y);
    const frameSwingRad = 2 * Math.atan2(frameSwingLen, Math.hypot(frameRel.z, frameRel.w));

    if (frameSwingRad > TRACKING_JUMP) {
      this.guardRejects++;
      this.baselineQuat = { ...currentQuat };
      this.baselineDeg = extractWristRollDeg(currentQuat);
      this.grabPieceAngle = this.committedAngle;
      this.smoothedAngle = this.committedAngle;
      this.appliedSteps = 0;
      this.lastQuat = { ...currentQuat };
      if (currentPos) this.lastPos = { ...currentPos };
      this.rollDeg = this.baselineDeg;
      return { pieceAngle: this.committedAngle, changed: false };
    }

    // 3. Roll delta from grab baseline
    const relToBaseline = quatMult(currentQuat, quatInv(this.baselineQuat));
    const deltaRollRad = extractWristRollRad(relToBaseline);

    const targetAngle = wrapPi(this.grabPieceAngle + deltaRollRad);

    // Single-frame roll jump (>40° twist, e.g. emulator Rot edit):
    // Treat as a re-baseline-safe step rather than discarding forever.
    if (Math.abs(frameTwistRad) > TRACKING_JUMP) {
      this.smoothedAngle = targetAngle;
    } else {
      this.smoothedAngle = smoothAngle(this.smoothedAngle, targetAngle, deltaSeconds);
    }

    // Snap from the raw wrist target (hysteresis already rejects jitter); smoothing
    // alone lagged a held roll by one 15° step on real frame timing.
    const next = snapWithHysteresis(targetAngle, this.committedAngle);
    const changed = next !== this.committedAngle;
    this.committedAngle = next;
    this.appliedSteps = Math.round(
      wrapPi(this.committedAngle - this.grabPieceAngle) / SNAP_STEP_RADIANS,
    );

    this.lastQuat = { ...currentQuat };
    if (currentPos) this.lastPos = { ...currentPos };

    return { pieceAngle: this.committedAngle, changed };
  }

  state(): WristState {
    return {
      rollDeg: this.rollDeg,
      baselineDeg: this.baselineDeg,
      appliedSteps: this.appliedSteps,
      guardRejects: this.guardRejects,
    };
  }

  reset(): void {
    this.grabbing = false;
    this.grabPieceAngle = 0;
    this.baselineQuat = { x: 0, y: 0, z: 0, w: 1 };
    this.baselineDeg = 0;
    this.lastQuat = { x: 0, y: 0, z: 0, w: 1 };
    this.lastPos = null;
    this.smoothedAngle = 0;
    this.committedAngle = 0;
    this.rollDeg = 0;
    this.appliedSteps = 0;
    this.guardRejects = 0;
  }
}
