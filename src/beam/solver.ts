/**
 * 2D beam solver on the board plane.
 * Mirrors reflect, prisms split (a game rule, not real optics), blockers stop
 * the beam, and every target has to be lit. Hard stop at 32 bounces.
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

export interface BeamBlocker {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
}

export interface BeamTarget {
  x: number;
  y: number;
  radius: number;
}

/** A palm bounce already snapped onto the board. The ray leaves along `dir`. */
export interface BeamHand {
  x: number;
  y: number;
  radius: number;
  dir: number;
}

export interface BeamBoard {
  width: number;
  height: number;
  source: BeamSource;
  mirrors: readonly BeamMirror[];
  prisms?: readonly BeamMirror[];
  blockers?: readonly BeamBlocker[];
  targets: readonly BeamTarget[];
  hand?: BeamHand;
}

export interface BeamSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BeamResult {
  segments: BeamSegment[];
  /** True when every target is lit. A board with no targets is not won. */
  hitTarget: boolean;
  lit: boolean[];
  /** How many times the beam reflected or split. Never exceeds MAX_BOUNCES. */
  bounces: number;
}

interface Hit {
  t: number;
  x: number;
  y: number;
  kind: 'mirror' | 'prism' | 'blocker' | 'target' | 'edge' | 'hand';
  nx: number;
  ny: number;
  index: number;
}

interface Ray {
  x: number;
  y: number;
  dx: number;
  dy: number;
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

function rayAABB(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number | null {
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;
  const slabs: Array<[number, number, number, number]> = [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
  ];
  for (const [origin, delta, min, max] of slabs) {
    if (Math.abs(delta) < PARALLEL_EPSILON) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / delta;
    let t2 = (max - origin) / delta;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (tMin > HIT_EPSILON) return tMin;
  return null;
}

function raySegment(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  piece: BeamMirror,
): Hit | null {
  const rad = degreesToRadians(piece.rot);
  const sx = Math.cos(rad);
  const sy = Math.sin(rad);
  const x1 = piece.x - sx * piece.halfLength;
  const y1 = piece.y - sy * piece.halfLength;
  const x2 = piece.x + sx * piece.halfLength;
  const y2 = piece.y + sy * piece.halfLength;
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
  return { t, x: ox + dx * t, y: oy + dy * t, kind: 'mirror', nx, ny, index: -1 };
}

function consider(best: Hit | null, hit: Hit | null): Hit | null {
  if (hit == null) return best;
  if (best == null || hit.t < best.t) return hit;
  return best;
}

function closestHit(ray: Ray, board: BeamBoard, minX: number, minY: number, maxX: number, maxY: number): Hit | null {
  let best: Hit | null = null;
  const edgeT = rayRectExit(ray.x, ray.y, ray.dx, ray.dy, minX, minY, maxX, maxY);
  if (Number.isFinite(edgeT) && edgeT > HIT_EPSILON) {
    best = {
      t: edgeT,
      x: ray.x + ray.dx * edgeT,
      y: ray.y + ray.dy * edgeT,
      kind: 'edge',
      nx: 0,
      ny: 0,
      index: -1,
    };
  }

  board.mirrors.forEach((mirror, index) => {
    const hit = raySegment(ray.x, ray.y, ray.dx, ray.dy, mirror);
    if (hit) hit.index = index;
    best = consider(best, hit);
  });

  (board.prisms ?? []).forEach((prism, index) => {
    const hit = raySegment(ray.x, ray.y, ray.dx, ray.dy, prism);
    if (hit) {
      hit.kind = 'prism';
      hit.index = index;
    }
    best = consider(best, hit);
  });

  (board.blockers ?? []).forEach((blocker, index) => {
    const t = rayAABB(
      ray.x,
      ray.y,
      ray.dx,
      ray.dy,
      blocker.x - blocker.halfWidth,
      blocker.y - blocker.halfHeight,
      blocker.x + blocker.halfWidth,
      blocker.y + blocker.halfHeight,
    );
    if (t == null) return;
    best = consider(best, {
      t,
      x: ray.x + ray.dx * t,
      y: ray.y + ray.dy * t,
      kind: 'blocker',
      nx: 0,
      ny: 0,
      index,
    });
  });

  board.targets.forEach((target, index) => {
    const t = rayCircle(ray.x, ray.y, ray.dx, ray.dy, target.x, target.y, target.radius);
    if (t == null) return;
    best = consider(best, {
      t,
      x: ray.x + ray.dx * t,
      y: ray.y + ray.dy * t,
      kind: 'target',
      nx: 0,
      ny: 0,
      index,
    });
  });

  const hand = board.hand;
  if (hand) {
    const t = rayCircle(ray.x, ray.y, ray.dx, ray.dy, hand.x, hand.y, hand.radius);
    if (t != null) {
      best = consider(best, {
        t,
        x: ray.x + ray.dx * t,
        y: ray.y + ray.dy * t,
        kind: 'hand',
        nx: 0,
        ny: 0,
        index: -1,
      });
    }
  }

  return best;
}

function pushRay(queue: Ray[], x: number, y: number, dx: number, dy: number): void {
  const length = Math.hypot(dx, dy) || 1;
  const ndx = dx / length;
  const ndy = dy / length;
  queue.push({
    x: x + ndx * HIT_EPSILON,
    y: y + ndy * HIT_EPSILON,
    dx: ndx,
    dy: ndy,
  });
}

export function solveBeam(board: BeamBoard): BeamResult {
  const minX = -board.width / 2;
  const maxX = board.width / 2;
  const minY = -board.height / 2;
  const maxY = board.height / 2;
  const dir = degreesToRadians(board.source.dir);
  const queue: Ray[] = [
    {
      x: board.source.x,
      y: board.source.y,
      dx: Math.cos(dir),
      dy: Math.sin(dir),
    },
  ];
  const segments: BeamSegment[] = [];
  const lit = board.targets.map(() => false);
  let bounces = 0;

  while (queue.length > 0 && segments.length < MAX_BOUNCES) {
    const ray = queue.shift();
    if (!ray) break;
    const best = closestHit(ray, board, minX, minY, maxX, maxY);
    if (best == null) break;
    segments.push({ x0: ray.x, y0: ray.y, x1: best.x, y1: best.y });
    if (best.kind === 'target') {
      if (best.index >= 0) lit[best.index] = true;
      continue;
    }
    if (best.kind === 'edge' || best.kind === 'blocker') continue;
    if (bounces >= MAX_BOUNCES) continue;

    bounces += 1;
    if (best.kind === 'hand' && board.hand) {
      const out = degreesToRadians(board.hand.dir);
      const dx = Math.cos(out);
      const dy = Math.sin(out);
      queue.push({
        x: board.hand.x + dx * (board.hand.radius + HIT_EPSILON),
        y: board.hand.y + dy * (board.hand.radius + HIT_EPSILON),
        dx,
        dy,
      });
      continue;
    }

    const bounced = reflect(ray.dx, ray.dy, best.nx, best.ny);
    pushRay(queue, best.x, best.y, bounced.x, bounced.y);
    if (best.kind === 'prism') {
      pushRay(queue, best.x, best.y, ray.dx, ray.dy);
    }
  }

  return {
    segments,
    lit,
    hitTarget: lit.length > 0 && lit.every(Boolean),
    bounces,
  };
}
