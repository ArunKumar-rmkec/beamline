/**
 * 2D beam solver on the board plane.
 * Mirrors reflect, targets catch the beam, and the board edge stops it.
 * No rendering and no browser APIs, so the tests can run in plain Node.
 */

export const MAX_BOUNCES = 32;

const HIT_EPSILON = 1e-4;
const PARALLEL_EPSILON = 1e-8;

export interface BeamSource {
  x: number;
  y: number;
  /** Degrees. 0 aims along +X and angles grow counterclockwise. */
  dir: number;
}

export interface BeamMirror {
  x: number;
  y: number;
  /** Surface angle in degrees. 0 lies along +X. */
  rot: number;
  halfLength: number;
}

export interface BeamTarget {
  x: number;
  y: number;
  radius: number;
}

export interface BeamBoard {
  width: number;
  height: number;
  source: BeamSource;
  mirrors: readonly BeamMirror[];
  targets: readonly BeamTarget[];
}

export interface BeamSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BeamResult {
  segments: BeamSegment[];
  hitTarget: boolean;
  /** How many times the beam reflected. Never exceeds MAX_BOUNCES. */
  bounces: number;
}

interface Hit {
  t: number;
  x: number;
  y: number;
  kind: 'mirror' | 'target' | 'edge';
  nx: number;
  ny: number;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function reflect(
  dx: number,
  dy: number,
  nx: number,
  ny: number,
): { x: number; y: number } {
  const dot = dx * nx + dy * ny;
  return { x: dx - 2 * dot * nx, y: dy - 2 * dot * ny };
}

function rayRectExit(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  let tExit = Number.POSITIVE_INFINITY;
  if (Math.abs(dx) > PARALLEL_EPSILON) {
    const t = dx > 0 ? (maxX - ox) / dx : (minX - ox) / dx;
    if (t > 0) tExit = Math.min(tExit, t);
  }
  if (Math.abs(dy) > PARALLEL_EPSILON) {
    const t = dy > 0 ? (maxY - oy) / dy : (minY - oy) / dy;
    if (t > 0) tExit = Math.min(tExit, t);
  }
  return tExit;
}

function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  radius: number,
): number | null {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t0 = (-b - root) / 2;
  const t1 = (-b + root) / 2;
  if (t0 > HIT_EPSILON) return t0;
  if (t1 > HIT_EPSILON) return t1;
  return null;
}

function rayMirror(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  mirror: BeamMirror,
): Hit | null {
  const rad = degreesToRadians(mirror.rot);
  const sx = Math.cos(rad);
  const sy = Math.sin(rad);
  const x1 = mirror.x - sx * mirror.halfLength;
  const y1 = mirror.y - sy * mirror.halfLength;
  const x2 = mirror.x + sx * mirror.halfLength;
  const y2 = mirror.y + sy * mirror.halfLength;
  const rx = x2 - x1;
  const ry = y2 - y1;
  const den = dx * ry - dy * rx;
  if (Math.abs(den) < PARALLEL_EPSILON) return null;
  const qx = x1 - ox;
  const qy = y1 - oy;
  const t = (qx * ry - qy * rx) / den;
  const u = (qx * dy - qy * dx) / den;
  if (t <= HIT_EPSILON || u < 0 || u > 1) return null;
  let nx = -ry;
  let ny = rx;
  const length = Math.hypot(nx, ny) || 1;
  nx /= length;
  ny /= length;
  if (dx * nx + dy * ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return {
    t,
    x: ox + dx * t,
    y: oy + dy * t,
    kind: 'mirror',
    nx,
    ny,
  };
}

export function solveBeam(board: BeamBoard): BeamResult {
  const minX = -board.width / 2;
  const maxX = board.width / 2;
  const minY = -board.height / 2;
  const maxY = board.height / 2;
  const dir = degreesToRadians(board.source.dir);
  let x = board.source.x;
  let y = board.source.y;
  let dx = Math.cos(dir);
  let dy = Math.sin(dir);
  const segments: BeamSegment[] = [];
  let bounces = 0;
  let hitTarget = false;

  for (let step = 0; step < MAX_BOUNCES; step += 1) {
    let best: Hit | null = null;
    const edgeT = rayRectExit(x, y, dx, dy, minX, minY, maxX, maxY);
    if (Number.isFinite(edgeT) && edgeT > HIT_EPSILON) {
      best = {
        t: edgeT,
        x: x + dx * edgeT,
        y: y + dy * edgeT,
        kind: 'edge',
        nx: 0,
        ny: 0,
      };
    }

    for (const mirror of board.mirrors) {
      const hit = rayMirror(x, y, dx, dy, mirror);
      if (hit && (best == null || hit.t < best.t)) best = hit;
    }

    for (const target of board.targets) {
      const t = rayCircle(x, y, dx, dy, target.x, target.y, target.radius);
      if (t != null && (best == null || t < best.t)) {
        best = {
          t,
          x: x + dx * t,
          y: y + dy * t,
          kind: 'target',
          nx: 0,
          ny: 0,
        };
      }
    }

    if (best == null) break;
    segments.push({ x0: x, y0: y, x1: best.x, y1: best.y });
    if (best.kind === 'target') {
      hitTarget = true;
      break;
    }
    if (best.kind === 'edge') break;

    const bounced = reflect(dx, dy, best.nx, best.ny);
    const length = Math.hypot(bounced.x, bounced.y) || 1;
    dx = bounced.x / length;
    dy = bounced.y / length;
    x = best.x + dx * HIT_EPSILON;
    y = best.y + dy * HIT_EPSILON;
    bounces += 1;
  }

  return { segments, hitTarget, bounces };
}
