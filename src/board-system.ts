import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Entity,
  Grabbed,
  GrabSystem,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  OneHandGrabbable,
  PlaneGeometry,
  PokeInteractable,
  Pressed,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
  createSystem,
} from '@iwsdk/core';
import {
  BOARD_DROP_M,
  BOARD_FORWARD_M,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  MIRROR_HALF_LENGTH,
  MIRROR_POSITION,
  SOURCE_POSITION,
  TARGET_POSITION,
  TARGET_RADIUS,
  levelBoard,
} from './beam/level.js';
import {
  chooseTwistDelta,
  nearestSnap,
  signedTwist,
  smoothAngle,
  snapWithHysteresis,
  wrapPi,
  type Quat,
  type Vec3,
} from './beam/snap.js';
import { solveBeam, type BeamSegment } from './beam/solver.js';
import { RecenterButton } from './components.js';
import { readMirrorDegrees, writeMirrorDegrees } from './storage.js';

const MIRROR_Z = 0.02;
const BEAM_Z = 0.018;
/** A single-frame jump larger than this is a tracking loss, not a wrist. */
const TRACKING_JUMP = (40 * Math.PI) / 180;
const TIP_DEAD_ZONE = 0.025;

const beamGeometry = new BoxGeometry(1, 1, 1);
const beamMaterial = new MeshBasicMaterial({ color: 0xfff4f6 });
const glowMaterial = new MeshBasicMaterial({
  color: 0xff2d55,
  transparent: true,
  opacity: 0.45,
  blending: AdditiveBlending,
  depthWrite: false,
});

function labelTexture(text: string, fill: string, ink: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ink;
    context.font = 'bold 72px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 68);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function gridLines(): LineSegments {
  const positions: number[] = [];
  const z = 0.0066;
  const cellWidth = BOARD_WIDTH / GRID_COLS;
  const cellHeight = BOARD_HEIGHT / GRID_ROWS;
  for (let col = 0; col <= GRID_COLS; col += 1) {
    const x = -BOARD_WIDTH / 2 + col * cellWidth;
    positions.push(x, -BOARD_HEIGHT / 2, z, x, BOARD_HEIGHT / 2, z);
  }
  for (let row = 0; row <= GRID_ROWS; row += 1) {
    const y = -BOARD_HEIGHT / 2 + row * cellHeight;
    positions.push(-BOARD_WIDTH / 2, y, z, BOARD_WIDTH / 2, y, z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new LineSegments(
    geometry,
    new LineBasicMaterial({ color: 0x9ec3d6 }),
  );
}

/**
 * One seated board: a source, a pinch-to-twist mirror, and a target.
 * Placement follows the head. The mirror angle is the only saved state.
 */
export class BoardSystem extends createSystem({
  recenterPressed: { required: [RecenterButton, Pressed] },
}) {
  private readonly board = new Group();
  private mirror = new Group();
  private mirrorEntity: Entity | null = null;
  private target!: Mesh;
  private targetMaterial!: MeshStandardMaterial;
  private boardMaterial!: MeshStandardMaterial;
  private banner!: Mesh;
  private beamGroup = new Group();

  private committed = 0;
  private smoothed = 0;
  private twisting = false;
  private startAngle = 0;
  private startTip = 0;
  private tipReady = false;
  private readonly startGrip: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private paused = false;
  private sawImmersive = false;
  private needsPlace = true;
  private won = false;
  private anim = 0;
  private renderedAngle = Number.NaN;

  private readonly headPos = new Vector3();
  private readonly forward = new Vector3();
  private readonly boardPos = new Vector3();
  private readonly toHead = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly scratch = new Vector3();
  private readonly mirrorPos = new Vector3();
  private readonly scratchQuat = new Quaternion();
  private readonly basis = new Matrix4();
  private readonly normal: Vec3 = { x: 0, y: 0, z: 1 };
  private readonly gripNow: Quat = { x: 0, y: 0, z: 0, w: 1 };

  init(): void {
    const stored = readMirrorDegrees(localStorage, 0);
    this.committed = nearestSnap((stored * Math.PI) / 180);
    this.smoothed = this.committed;
    this.buildBoard();
    this.syncBeam();

    this.queries.recenterPressed.subscribe('qualify', () => {
      this.placeBoard();
    });

    this.cleanupFuncs.push(
      this.visibilityState.subscribe((state) => {
        this.paused =
          state === VisibilityState.Hidden ||
          state === VisibilityState.VisibleBlurred;
        if (this.paused) this.endTwist();
        if (state === VisibilityState.Visible && !this.sawImmersive) {
          this.sawImmersive = true;
          this.needsPlace = true;
        } else if (state === VisibilityState.NonImmersive) {
          this.sawImmersive = false;
          this.needsPlace = true;
          this.endTwist();
        }
      }),
    );
  }

  update(delta: number): void {
    if (this.needsPlace) this.placeWhenHeadIsReady();
    if (this.paused) {
      this.endTwist();
    } else {
      this.integrateTwist(delta);
    }
    this.mirror.rotation.set(0, 0, this.committed);
    this.mirror.position.set(MIRROR_POSITION.x, MIRROR_POSITION.y, MIRROR_Z);
    if (!this.paused && this.won) this.anim += delta;
    const pulse = this.won ? 1 + 0.12 * Math.sin(this.anim * 5) : 1;
    this.target.scale.setScalar(pulse);
  }

  private buildBoard(): void {
    this.board.name = 'board';
    this.boardMaterial = new MeshStandardMaterial({
      color: 0x1b2836,
      roughness: 0.72,
      metalness: 0.08,
      emissive: 0x0c1824,
      emissiveIntensity: 0.85,
    });
    const slab = new Mesh(
      new BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, 0.012),
      this.boardMaterial,
    );
    slab.position.z = 0;

    const source = new Mesh(
      new CylinderGeometry(0.012, 0.016, 0.04, 16),
      new MeshStandardMaterial({
        color: 0xff3355,
        emissive: 0xff2244,
        emissiveIntensity: 1.5,
        roughness: 0.35,
      }),
    );
    source.name = 'source';
    source.rotation.z = -Math.PI / 2;
    source.position.set(SOURCE_POSITION.x, SOURCE_POSITION.y, MIRROR_Z);

    this.targetMaterial = new MeshStandardMaterial({
      color: 0x12383c,
      emissive: 0x062428,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.15,
    });
    this.target = new Mesh(new OctahedronGeometry(TARGET_RADIUS, 0), this.targetMaterial);
    this.target.name = 'target';
    this.target.position.set(TARGET_POSITION.x, TARGET_POSITION.y, 0.03);

    this.banner = new Mesh(
      new PlaneGeometry(0.09, 0.034),
      new MeshBasicMaterial({
        map: labelTexture('Lit', '#12382a', '#d9ffe9'),
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.banner.name = 'win';
    this.banner.position.set(0, BOARD_HEIGHT / 2 - 0.028, 0.02);
    this.banner.visible = false;

    this.beamGroup.name = 'beam';
    this.board.add(slab, gridLines(), source, this.target, this.beamGroup, this.banner);

    const boardEntity = this.world.createTransformEntity(this.board, {
      persistent: true,
    });

    this.mirror = new Group();
    this.mirror.name = 'mirror';
    const grabPad = new Mesh(
      new CylinderGeometry(0.055, 0.055, 0.014, 28),
      new MeshStandardMaterial({
        color: 0xd5e4f5,
        transparent: true,
        opacity: 0.34,
        roughness: 0.35,
        metalness: 0.05,
        depthWrite: false,
      }),
    );
    grabPad.rotation.x = Math.PI / 2;
    const bar = new Mesh(
      new BoxGeometry(MIRROR_HALF_LENGTH * 2, 0.01, 0.018),
      new MeshStandardMaterial({
        color: 0xeef3f8,
        metalness: 0.88,
        roughness: 0.16,
        emissive: 0xb7c9de,
        emissiveIntensity: 0.45,
      }),
    );
    this.mirror.add(grabPad, bar);
    this.mirror.position.set(MIRROR_POSITION.x, MIRROR_POSITION.y, MIRROR_Z);
    this.mirror.rotation.z = this.committed;

    const mirrorEntity = this.world.createTransformEntity(this.mirror, {
      parent: boardEntity,
    });
    mirrorEntity.addComponent(OneHandGrabbable, {
      rotate: false,
      translate: false,
    });
    this.mirrorEntity = mirrorEntity;

    const button = new Mesh(
      new BoxGeometry(0.05, 0.038, 0.014),
      new MeshStandardMaterial({
        map: labelTexture('Center', '#f0b429', '#241802'),
        roughness: 0.55,
        metalness: 0.05,
        emissive: 0x8a5a10,
        emissiveIntensity: 0.35,
      }),
    );
    button.name = 'recenter';
    button.position.set(0, -BOARD_HEIGHT / 2 + 0.024, 0.014);
    const buttonEntity = this.world.createTransformEntity(button, {
      parent: boardEntity,
    });
    buttonEntity.addComponent(PokeInteractable);
    buttonEntity.addComponent(RecenterButton);
  }

  private placeWhenHeadIsReady(): void {
    this.player.head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(this.player.head.matrixWorld);
    // The first immersive frames can report the head at the origin, before
    // the viewer pose arrives. Wait for an eye-height pose so the board
    // does not spawn under the floor.
    if (this.sawImmersive && this.headPos.y < 0.75) return;
    this.placeBoard();
    this.needsPlace = false;
  }

  private placeBoard(): void {
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(head.matrixWorld);
    this.forward.set(0, 0, -1).transformDirection(head.matrixWorld);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.boardPos.copy(this.headPos).addScaledVector(this.forward, BOARD_FORWARD_M);
    this.boardPos.y -= BOARD_DROP_M;
    this.toHead.copy(this.headPos).sub(this.boardPos);
    if (this.toHead.lengthSq() < 1e-6) this.toHead.set(0, 0, 1);
    this.toHead.normalize();
    this.xAxis.crossVectors(this.worldUp, this.toHead);
    if (this.xAxis.lengthSq() < 1e-6) this.xAxis.set(1, 0, 0);
    this.xAxis.normalize();
    this.yAxis.crossVectors(this.toHead, this.xAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.toHead);
    this.board.quaternion.setFromRotationMatrix(this.basis);
    this.board.position.copy(this.boardPos);
    this.board.updateWorldMatrix(true, true);
    this.endTwist();
  }

  private endTwist(): void {
    this.twisting = false;
    this.tipReady = false;
  }

  private integrateTwist(delta: number): void {
    const entity = this.mirrorEntity;
    if (!entity || !entity.hasComponent(Grabbed)) {
      this.endTwist();
      return;
    }
    const hand = this.world.getSystem(GrabSystem)?.getHolderHand(entity);
    if (hand !== 'left' && hand !== 'right') {
      this.endTwist();
      return;
    }
    if (!this.input.xr.isPrimary('hand', hand)) {
      this.endTwist();
      return;
    }

    this.readBoardAxes();
    this.readQuat(this.player.gripSpaces[hand], this.gripNow);
    const tipDelta = this.tipDelta(hand);
    if (!this.twisting) {
      this.twisting = true;
      this.startAngle = this.committed;
      this.copyQuat(this.gripNow, this.startGrip);
      this.smoothed = this.committed;
      return;
    }

    const gripDelta = signedTwist(this.startGrip, this.gripNow, this.normal);
    let twist = chooseTwistDelta(tipDelta, gripDelta);
    if (Math.abs(twist) > TRACKING_JUMP) {
      this.startAngle = this.committed;
      this.tipReady = false;
      this.copyQuat(this.gripNow, this.startGrip);
      this.smoothed = this.committed;
      twist = 0;
    }
    const raw = this.startAngle + twist;
    this.smoothed = smoothAngle(this.smoothed, raw, delta);
    const next = snapWithHysteresis(this.smoothed, this.committed);
    if (next === this.committed) return;
    this.committed = next;
    writeMirrorDegrees(
      localStorage,
      (nearestSnap(wrapPi(this.committed)) * 180) / Math.PI,
    );
    this.syncBeam();
  }

  private copyQuat(from: Quat, to: Quat): void {
    to.x = from.x;
    to.y = from.y;
    to.z = from.z;
    to.w = from.w;
  }

  private readBoardAxes(): void {
    this.board.updateWorldMatrix(true, false);
    this.scratch.set(0, 0, 1).transformDirection(this.board.matrixWorld);
    this.normal.x = this.scratch.x;
    this.normal.y = this.scratch.y;
    this.normal.z = this.scratch.z;
  }

  /** Orbit of the index tip around the mirror, or 0 when the finger is on top of it. */
  private tipDelta(hand: 'left' | 'right'): number {
    const tip = this.player.indexTipSpaces[hand];
    tip.updateWorldMatrix(true, false);
    this.mirror.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(tip.matrixWorld);
    this.mirrorPos.setFromMatrixPosition(this.mirror.matrixWorld);
    this.scratch.sub(this.mirrorPos);
    const right = this.xAxis.set(1, 0, 0).transformDirection(this.board.matrixWorld);
    const up = this.yAxis.set(0, 1, 0).transformDirection(this.board.matrixWorld);
    const x = this.scratch.dot(right);
    const y = this.scratch.dot(up);
    if (Math.hypot(x, y) < TIP_DEAD_ZONE) {
      this.tipReady = false;
      return 0;
    }
    const angle = Math.atan2(y, x);
    if (!this.twisting || !this.tipReady) {
      this.startTip = angle;
      this.tipReady = true;
      return 0;
    }
    return wrapPi(angle - this.startTip);
  }

  private readQuat(object: Object3D, out: Quat): void {
    object.updateWorldMatrix(true, false);
    object.getWorldQuaternion(this.scratchQuat);
    out.x = this.scratchQuat.x;
    out.y = this.scratchQuat.y;
    out.z = this.scratchQuat.z;
    out.w = this.scratchQuat.w;
  }

  private syncBeam(): void {
    if (this.renderedAngle === this.committed) return;
    this.renderedAngle = this.committed;
    const degrees = (this.committed * 180) / Math.PI;
    const result = solveBeam(levelBoard(degrees));
    this.rebuildBeam(result.segments);
    this.setWon(result.hitTarget);
  }

  private rebuildBeam(segments: readonly BeamSegment[]): void {
    for (const child of [...this.beamGroup.children]) this.beamGroup.remove(child);
    for (const segment of segments) {
      const dx = segment.x1 - segment.x0;
      const dy = segment.y1 - segment.y0;
      const length = Math.hypot(dx, dy);
      if (length < 1e-5) continue;
      const angle = Math.atan2(dy, dx);
      const glow = new Mesh(beamGeometry, glowMaterial);
      const core = new Mesh(beamGeometry, beamMaterial);
      glow.scale.set(length, 0.016, 0.01);
      core.scale.set(length, 0.0045, 0.0045);
      const x = (segment.x0 + segment.x1) / 2;
      const y = (segment.y0 + segment.y1) / 2;
      glow.position.set(x, y, BEAM_Z);
      core.position.set(x, y, BEAM_Z);
      glow.rotation.z = angle;
      core.rotation.z = angle;
      this.beamGroup.add(glow, core);
    }
  }

  private setWon(won: boolean): void {
    this.won = won;
    this.banner.visible = won;
    if (won) {
      this.targetMaterial.color.setHex(0xfff6d4);
      this.targetMaterial.emissive.setHex(0xffc14a);
      this.targetMaterial.emissiveIntensity = 2.4;
      this.boardMaterial.emissive.setHex(0x24523a);
      this.boardMaterial.emissiveIntensity = 0.7;
      return;
    }
    this.targetMaterial.color.setHex(0x12383c);
    this.targetMaterial.emissive.setHex(0x062428);
    this.targetMaterial.emissiveIntensity = 0.4;
      this.boardMaterial.emissive.setHex(0x0c1824);
    this.boardMaterial.emissiveIntensity = 0.85;
    this.target.scale.setScalar(1);
  }
}
