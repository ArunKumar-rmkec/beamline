import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Entity,
  Float32BufferAttribute,
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
import { BoardAudio } from './audio.js';
import {
  BOARD_DROP_M,
  BOARD_FORWARD_M,
  BOARD_SIDE_M,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GENEROUS_GRAB_RADIUS,
  GRAB_PAD_RADIUS,
  SOLO_REACH_RADIUS,
  BLOCKER_HALF_HEIGHT,
  BLOCKER_HALF_WIDTH,
  EDGE_BUTTON_DEPTH,
  EDGE_BUTTON_HEIGHT,
  EDGE_BUTTON_WIDTH,
  EDGE_BUTTON_Y,
  GRID_COLS,
  GRID_ROWS,
  MIRROR_HALF_LENGTH,
  TARGET_RADIUS,
  TRAY_TILT_RADIANS,
  cellCenter,
} from './beam/level.js';
import {
  LEVELS,
  boardFromLevel,
  movablePieces,
  type LevelDef,
  type LevelPiece,
  type PieceType,
} from './beam/levels.js';
import { palmOutgoingDegrees } from './beam/palm.js';
import {
  SNAP_STEP_RADIANS,
  angleFromStepsOrDegrees,
  chooseTwistDelta,
  nearestSnap,
  signedTwist,
  smoothAngle,
  snapWithHysteresis,
  wrapPi,
  type Quat,
  type Vec3,
} from './beam/snap.js';
import { solveBeam, type BeamHand, type BeamSegment } from './beam/solver.js';
import {
  HandMirrorButton,
  RecenterButton,
  RestartButton,
  ResumeButton,
  TutorialButton,
} from './components.js';
import {
  clearTutorial,
  readHandMirror,
  readProgress,
  readTutorialDone,
  writeHandMirror,
  writeProgress,
  writeTutorialDone,
} from './storage.js';

const PIECE_Z = 0.02;
const BEAM_Z = 0.018;
const WIN_HOLD = 3.2;
const HAND_REACH_Z = 0.16;
const HAND_CATCH = 0.08;
const HAND_RADIUS = 0.03;
/** A single-frame jump larger than this is a tracking loss, not a wrist. */
const TRACKING_JUMP = (40 * Math.PI) / 180;
const TIP_DEAD_ZONE = 0.025;
const BUTTON_DEBOUNCE_MS = 250;
const BUTTON_SETTLE_DISTANCE = 0.06;
const SETTLE_HOLD_TIME = 0.5;
const SETTLE_TIMEOUT = 1.0;

const beamGeometry = new BoxGeometry(1, 1, 1);
const beamMaterial = new MeshBasicMaterial({ color: 0xfff4f6 });
const glowMaterial = new MeshBasicMaterial({
  color: 0xff2d55,
  transparent: true,
  opacity: 0.45,
  blending: AdditiveBlending,
  depthWrite: false,
});
const grabGeometry = new CylinderGeometry(GRAB_PAD_RADIUS, GRAB_PAD_RADIUS, 0.012, 24);
const soloReachGeometry = new CylinderGeometry(SOLO_REACH_RADIUS, SOLO_REACH_RADIUS, 0.012, 20);
const highlightGeometry = new CylinderGeometry(0.074, 0.074, 0.006, 32);
const mirrorEdgeGeometry = new BoxGeometry(MIRROR_HALF_LENGTH * 2 + 0.014, 0.0045, 0.0045);
const grabMaterial = new MeshStandardMaterial({
  color: 0xd5e4f5,
  transparent: true,
  opacity: 0.34,
  roughness: 0.35,
  metalness: 0.05,
  depthWrite: false,
});
const reachMaterial = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});
const highlightMaterial = new MeshBasicMaterial({ color: 0xffe14a });
const mirrorEdgeMaterial = new MeshBasicMaterial({ color: 0xf4fbff });
const mirrorGeometry = new BoxGeometry(MIRROR_HALF_LENGTH * 2, 0.01, 0.016);
const mirrorMaterial = new MeshStandardMaterial({
  color: 0xeef3f8,
  metalness: 0.88,
  roughness: 0.16,
  emissive: 0xb7c9de,
  emissiveIntensity: 0.45,
});
const prismGeometry = new CylinderGeometry(0.004, 0.03, 0.016, 3);
const prismMaterial = new MeshStandardMaterial({
  color: 0x9ee7ff,
  emissive: 0x2aa4c8,
  emissiveIntensity: 0.7,
  roughness: 0.15,
  metalness: 0.2,
  transparent: true,
  opacity: 0.88,
});
const blockerGeometry = new BoxGeometry(
  BLOCKER_HALF_WIDTH * 2,
  BLOCKER_HALF_HEIGHT * 2,
  0.046,
);
const blockerMaterial = new MeshStandardMaterial({
  color: 0x2a241f,
  roughness: 0.84,
  metalness: 0.04,
  emissive: 0x120e0c,
  emissiveIntensity: 0.3,
});
const sourceGeometry = new CylinderGeometry(0.012, 0.016, 0.04, 12);
const sourceMaterial = new MeshStandardMaterial({
  color: 0xff3355,
  emissive: 0xff2244,
  emissiveIntensity: 1.5,
  roughness: 0.35,
});
const targetGeometry = new OctahedronGeometry(TARGET_RADIUS, 0);
const sparkGeometry = new OctahedronGeometry(0.008, 0);
const sparkMaterial = new MeshBasicMaterial({
  color: 0xffd27a,
  transparent: true,
  opacity: 0.9,
  blending: AdditiveBlending,
  depthWrite: false,
});
const handDiscMaterial = new MeshBasicMaterial({
  color: 0xd7fff0,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  side: DoubleSide,
});

interface LivePiece {
  type: PieceType;
  col: number;
  row: number;
  movable: boolean;
  object: Group;
  entity: Entity | null;
  committed: number;
  smoothed: number;
}

interface Spark {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

function labelTexture(text: string, fill: string, ink: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(8, 10, 14, 0.45)';
    context.lineWidth = 10;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = ink;
    context.font = '600 108px Inter, "Liberation Sans", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const TUTORIAL_STEPS = [
  'Poke buttons with your finger',
  'Pinch a mirror to grab it',
  'Twist your hand to rotate',
] as const;

function tutorialCardTexture(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#102033';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(8, 10, 14, 0.45)';
    context.lineWidth = 8;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.fillStyle = '#f4f7fb';
    context.font = '600 30px Inter, "Liberation Sans", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, 48);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function panelCardTexture(title: string, fill = '#102033', ink = '#f4f7fb', fontSize = 72): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(8, 10, 14, 0.45)';
    context.lineWidth = 10;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = ink;
    context.font = `700 ${fontSize}px Inter, "Liberation Sans", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(title, canvas.width / 2, 75);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function pieceId(piece: LivePiece): string {
  return `${piece.type}-${piece.col}-${piece.row}`;
}

function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000;
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
  return new LineSegments(geometry, new LineBasicMaterial({ color: 0x9ec3d6 }));
}

function nearestIncoming(
  segments: readonly BeamSegment[],
  x: number,
  y: number,
  maxDistance: number,
): { x: number; y: number } | null {
  let best = maxDistance;
  let found: { x: number; y: number } | null = null;
  for (const segment of segments) {
    const dx = segment.x1 - segment.x0;
    const dy = segment.y1 - segment.y0;
    const length2 = dx * dx + dy * dy;
    if (length2 < 1e-8) continue;
    const raw = ((x - segment.x0) * dx + (y - segment.y0) * dy) / length2;
    const t = Math.max(0, Math.min(1, raw));
    const px = segment.x0 + dx * t;
    const py = segment.y0 + dy * t;
    const distance = Math.hypot(x - px, y - py);
    if (distance < best) {
      best = distance;
      found = { x: dx, y: dy };
    }
  }
  return found;
}

function pieceDegrees(piece: LivePiece): number {
  return Math.round((wrapPi(piece.committed) * 180) / Math.PI);
}

/**
 * Seated board. Pieces come from the current level. Mirrors and prisms
 * pinch-twist in 15° steps. Blockers stay put. Every target has to be lit.
 */
export class BoardSystem extends createSystem({
  recenterPressed: { required: [RecenterButton, Pressed] },
  handPressed: { required: [HandMirrorButton, Pressed] },
  tutorialPressed: { required: [TutorialButton, Pressed] },
  resumePressed: { required: [ResumeButton, Pressed] },
  restartPressed: { required: [RestartButton, Pressed] },
}) {
  private readonly board = new Group();
  private readonly beamGroup = new Group();
  private readonly sparkGroup = new Group();
  private readonly handDisc = new Group();
  private readonly audio = new BoardAudio();
  private readonly beams: Array<{ glow: Mesh; core: Mesh }> = [];
  private readonly sparks: Spark[] = [];
  private readonly pieces: LivePiece[] = [];
  private readonly targets: Mesh[] = [];

  private boardEntity: Entity | null = null;
  private boardMaterial!: MeshStandardMaterial;
  private handMaterial!: MeshBasicMaterial;
  private banner!: Mesh;
  private pausedCard!: Mesh;
  private resumeButtonMesh!: Mesh;
  private levelLabel!: Mesh;
  private sourceMesh: Mesh | null = null;
  private level: LevelDef = LEVELS[0] ?? {
    id: '1',
    par: 1,
    solution: [],
    source: { col: 0, row: 0, dir: 0 },
    pieces: [],
    targets: [],
  };
  private levelIndex = 0;

  private twisting = false;
  private active: LivePiece | null = null;
  private startAngle = 0;
  private startTip = 0;
  private tipReady = false;
  private readonly startGrip: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly gripNow: Quat = { x: 0, y: 0, z: 0, w: 1 };

  private paused = false;
  private docHidden = false;
  private xrState: VisibilityState = VisibilityState.NonImmersive;
  private needsPlace = true;
  private inputSettled = true;
  private timeSincePlacement = 0;
  private handsFarContinuous = 0;
  private won = false;
  private winPlayed = false;
  private winHold = 0;
  private anim = 0;
  private beamKey = '';
  private handEnabled = false;
  private handLocked = false;
  private handSpec: BeamHand | null = null;
  private hookPaused = false;
  private hookHeld: LivePiece | null = null;
  private pinchHeldPiece: LivePiece | null = null;
  private pinchHand: 'left' | 'right' | null = null;
  private lastPalm: { x: number; y: number; nx: number; ny: number; nz: number } | null = null;
  private readonly level1Cue = new Group();
  private cueAnim = 0;
  private testMode = false;
  private lit: boolean[] = [];
  private recenterMesh: Mesh | null = null;
  private handMesh: Mesh | null = null;
  private centerPresses = 0;
  private handPresses = 0;
  private lastCenterPress = -Infinity;
  private lastHandPress = -Infinity;

  private tutorialCard!: Mesh;
  private tutorialButtonMesh!: Mesh;
  private tutorialButtonMaterial!: MeshBasicMaterial;
  private tutorialStep = 0;
  private tutorialVisible = false;
  private tutorialChecked = false;
  private tutorialPresses = 0;
  private lastTutorialPress = -Infinity;

  private resumePresses = 0;
  private lastResumePress = -Infinity;

  private endCard!: Mesh;
  private restartButtonMesh!: Mesh;
  private endPanelVisible = false;
  private restartPresses = 0;
  private lastRestartPress = -Infinity;

  private recenterEntity: Entity | null = null;
  private handEntity: Entity | null = null;
  private tutorialEntity: Entity | null = null;
  private resumeEntity: Entity | null = null;
  private restartEntity: Entity | null = null;

  private readonly headPos = new Vector3();
  private readonly forward = new Vector3();
  private readonly boardPos = new Vector3();
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly boardNormal = new Vector3();
  private readonly scratch = new Vector3();
  private readonly local = new Vector3();
  private readonly palmNormal = new Vector3();
  private readonly scratchQuat = new Quaternion();
  private readonly pressButtonPos = new Vector3();
  private readonly pressHandPos = new Vector3();
  private readonly previewBackground = new Color(0x1c2836);
  private readonly basis = new Matrix4();
  private readonly inverse = new Matrix4();
  private readonly normal: Vec3 = { x: 0, y: 0, z: 1 };

  init(): void {
    const saved = readProgress(localStorage, LEVELS.length);
    this.handEnabled = readHandMirror(localStorage);
    this.levelIndex = saved?.level ?? 0;
    this.buildStatic();
    this.loadLevel(this.levelIndex, saved?.angles ?? null);
    this.cleanupFuncs.push(
      this.queries.recenterPressed.subscribe('qualify', () => {
        if (!this.inputSettled || !this.isPressNearButton(this.recenterMesh)) return;
        this.recenter();
      }),
      this.queries.handPressed.subscribe('qualify', () => {
        if (!this.inputSettled || !this.isPressNearButton(this.handMesh)) return;
        this.toggleHandMirror();
      }),
      this.queries.tutorialPressed.subscribe('qualify', () => {
        if (!this.inputSettled || !this.isPressNearButton(this.tutorialButtonMesh)) return;
        this.advanceTutorial();
      }),
      this.queries.resumePressed.subscribe('qualify', () => {
        if (!this.inputSettled || !this.isPressNearButton(this.resumeButtonMesh)) return;
        this.resumeFromPanel();
      }),
      this.queries.restartPressed.subscribe('qualify', () => {
        if (!this.inputSettled || !this.isPressNearButton(this.restartButtonMesh)) return;
        this.restartGame();
      }),
    );

    const onDocumentVisibility = () => {
      this.docHidden = document.visibilityState === 'hidden';
      this.applyPause();
    };
    document.addEventListener('visibilitychange', onDocumentVisibility);
    const resumeAudio = () => this.audio.interact();
    window.addEventListener('pointerdown', resumeAudio);
    this.cleanupFuncs.push(
      this.visibilityState.subscribe((state) => {
        const prev = this.xrState;
        this.xrState = state;
        if (state === VisibilityState.Visible || state === VisibilityState.NonImmersive) {
          this.needsPlace = true;
        }
        if (state === VisibilityState.NonImmersive) {
          this.endTwist();
          this.audio.suspend();
          this.save();
          this.inputSettled = true;
          this.timeSincePlacement = 0;
          this.handsFarContinuous = 0;
        }
        if (state === VisibilityState.Visible) {
          if (prev === VisibilityState.NonImmersive) {
            this.onXrSessionStart();
          } else {
            this.endTwist();
          }
          this.world.scene.background = null;
          this.audio.resume();
          this.checkFirstRunTutorial();
        }
        this.applyPause();
      }),
      () => document.removeEventListener('visibilitychange', onDocumentVisibility),
      () => window.removeEventListener('pointerdown', resumeAudio),
    );
    this.xrState = this.visibilityState.value;
    this.applyPause();
    this.installTestHook();
  }

  private onXrSessionStart(): void {
    const grab = this.world.getSystem(GrabSystem);
    for (const piece of this.pieces) {
      if (piece.entity) {
        grab?.forceRelease(piece.entity);
      }
    }
    this.endTwist();
    this.hookHeld = null;
    this.pinchHeldPiece = null;
    this.pinchHand = null;

    this.lastCenterPress = -Infinity;
    this.lastHandPress = -Infinity;
    this.lastTutorialPress = -Infinity;
    this.lastResumePress = -Infinity;
    this.lastRestartPress = -Infinity;

    for (const entity of [
      this.recenterEntity,
      this.handEntity,
      this.tutorialEntity,
      this.resumeEntity,
      this.restartEntity,
    ]) {
      if (entity?.hasComponent(Pressed)) {
        entity.removeComponent(Pressed);
      }
    }

    if (!readTutorialDone(localStorage)) {
      this.tutorialChecked = false;
    }

    this.inputSettled = false;
    this.timeSincePlacement = 0;
    this.handsFarContinuous = 0;
  }

  private recenter(bypassDebounce = false): void {
    if (!bypassDebounce && !this.inputSettled) return;
    if (this.tutorialVisible) return;
    const now = performance.now();
    if (!bypassDebounce && now - this.lastCenterPress < BUTTON_DEBOUNCE_MS) return;
    this.lastCenterPress = now;
    this.centerPresses += 1;
    this.audio.interact();
    this.needsPlace = true;
  }

  private toggleHandMirror(bypassDebounce = false): void {
    if (!bypassDebounce && !this.inputSettled) return;
    if (this.tutorialVisible) return;
    const now = performance.now();
    if (!bypassDebounce && now - this.lastHandPress < BUTTON_DEBOUNCE_MS) return;
    this.lastHandPress = now;
    this.handPresses += 1;
    this.audio.interact();
    this.handEnabled = !this.handEnabled;
    this.handLocked = false;
    this.handSpec = null;
    this.beamKey = '';
    writeHandMirror(localStorage, this.handEnabled);
    this.paintHandButton();
    this.syncBeam();
  }

  private checkFirstRunTutorial(): void {
    if (this.tutorialChecked) return;
    this.tutorialChecked = true;
    if (!readTutorialDone(localStorage)) {
      this.tutorialStep = 0;
      this.tutorialVisible = true;
      this.updateTutorialCard();
    }
  }

  private advanceTutorial(bypassDebounce = false): void {
    if (!bypassDebounce && !this.inputSettled) return;
    if (!this.tutorialVisible) return;
    const now = performance.now();
    if (!bypassDebounce && now - this.lastTutorialPress < BUTTON_DEBOUNCE_MS) return;
    this.lastTutorialPress = now;
    this.tutorialPresses += 1;
    this.audio.interact();
    if (this.tutorialStep < TUTORIAL_STEPS.length - 1) {
      this.tutorialStep += 1;
      this.updateTutorialCard();
    } else {
      this.tutorialVisible = false;
      if (this.tutorialCard) this.tutorialCard.visible = false;
      if (this.tutorialButtonMesh) this.tutorialButtonMesh.visible = false;
      writeTutorialDone(localStorage);
    }
  }

  private updateTutorialCard(): void {
    if (!this.tutorialCard || !this.tutorialButtonMesh) return;
    this.tutorialCard.visible = this.tutorialVisible;
    this.tutorialButtonMesh.visible = this.tutorialVisible;
    if (!this.tutorialVisible) return;
    const cardMat = this.tutorialCard.material;
    if (cardMat instanceof MeshBasicMaterial) {
      cardMat.map?.dispose();
      cardMat.map = tutorialCardTexture(TUTORIAL_STEPS[this.tutorialStep] ?? '');
      cardMat.needsUpdate = true;
    }
    const btnText = this.tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Got it' : 'Next';
    this.tutorialButtonMaterial.map?.dispose();
    this.tutorialButtonMaterial.map = labelTexture(btnText, '#ffe14a', '#1a1000');
    this.tutorialButtonMaterial.needsUpdate = true;
  }

  private resumeFromPanel(bypassDebounce = false): void {
    if (!bypassDebounce && !this.inputSettled) return;
    if (this.tutorialVisible) return;
    const now = performance.now();
    if (!bypassDebounce && now - this.lastResumePress < BUTTON_DEBOUNCE_MS) return;
    this.lastResumePress = now;
    this.resumePresses += 1;
    this.audio.interact();
    this.hookPaused = false;
    this.applyPause();
  }

  private restartGame(bypassDebounce = false): void {
    if (!bypassDebounce && !this.inputSettled) return;
    if (this.tutorialVisible) return;
    const now = performance.now();
    if (!bypassDebounce && now - this.lastRestartPress < BUTTON_DEBOUNCE_MS) return;
    this.lastRestartPress = now;
    this.restartPresses += 1;
    this.audio.interact();
    this.endPanelVisible = false;
    if (this.endCard) this.endCard.visible = false;
    if (this.restartButtonMesh) this.restartButtonMesh.visible = false;
    this.loadLevel(0, null);
  }

  update(delta: number): void {
    if (this.needsPlace) this.placeWhenReady();
    this.applyPause();
    if (!this.paused && !this.needsPlace) {
      this.updateInputSettled(delta);
      if (this.inputSettled) {
        this.integrateTwist(delta);
      } else {
        this.endTwist();
        const grab = this.world.getSystem(GrabSystem);
        for (const piece of this.pieces) {
          if (piece.entity?.hasComponent(Grabbed)) {
            grab?.forceRelease(piece.entity);
          }
        }
      }
      this.integrateHand();
      this.integrateWin(delta);
      if (this.won) this.anim += delta;
      this.updateLevel1Cue(delta);
    }
    this.layoutPieces();
    this.frameDesktopPreview();
    const pulse = this.won && !this.paused ? 1 + 0.12 * Math.sin(this.anim * 5) : 1;
    for (const target of this.targets) target.scale.setScalar(pulse);
  }

  private areHandsFar(): boolean {
    const handSpaces = [
      this.player.gripSpaces.left,
      this.player.gripSpaces.right,
      this.player.indexTipSpaces.left,
      this.player.indexTipSpaces.right,
    ].filter(Boolean);

    const buttons = [
      this.recenterMesh,
      this.handMesh,
      this.tutorialButtonMesh,
      this.resumeButtonMesh,
      this.restartButtonMesh,
    ].filter((b): b is Mesh => Boolean(b && b.visible));

    for (const space of handSpaces) {
      space.updateWorldMatrix(true, false);
      this.scratch.setFromMatrixPosition(space.matrixWorld);

      for (const piece of this.pieces) {
        if (!piece.movable) continue;
        piece.object.updateWorldMatrix(true, false);
        this.local.setFromMatrixPosition(piece.object.matrixWorld);
        if (this.scratch.distanceTo(this.local) <= GENEROUS_GRAB_RADIUS) {
          return false;
        }
      }

      for (const button of buttons) {
        button.updateWorldMatrix(true, false);
        this.local.setFromMatrixPosition(button.matrixWorld);
        if (this.scratch.distanceTo(this.local) <= BUTTON_SETTLE_DISTANCE) {
          return false;
        }
      }
    }

    return true;
  }

  private updateInputSettled(delta: number): void {
    if (this.inputSettled) return;
    this.timeSincePlacement += delta;
    if (this.areHandsFar()) {
      this.handsFarContinuous += delta;
    } else {
      this.handsFarContinuous = 0;
    }
    if (this.handsFarContinuous >= SETTLE_HOLD_TIME || this.timeSincePlacement >= SETTLE_TIMEOUT) {
      this.inputSettled = true;
      for (const entity of [
        this.recenterEntity,
        this.handEntity,
        this.tutorialEntity,
        this.resumeEntity,
        this.restartEntity,
      ]) {
        if (entity?.hasComponent(Pressed)) {
          entity.removeComponent(Pressed);
        }
      }
    }
  }

  private buildStatic(): void {
    this.board.name = 'board';
    this.boardMaterial = new MeshStandardMaterial({
      color: 0x1b2836,
      roughness: 0.72,
      metalness: 0.08,
      emissive: 0x0c1824,
      emissiveIntensity: 0.85,
    });
    const slab = new Mesh(new BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, 0.012), this.boardMaterial);
    this.banner = new Mesh(
      new PlaneGeometry(0.09, 0.034),
      new MeshBasicMaterial({
        map: labelTexture('Lit', '#12382a', '#d9ffe9'),
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.banner.name = 'win';
    this.banner.position.set(0, BOARD_HEIGHT / 2 - 0.03, 0.03);
    this.banner.visible = false;

    this.pausedCard = new Mesh(
      new PlaneGeometry(0.24, 0.12),
      new MeshBasicMaterial({
        map: panelCardTexture('Paused', '#102033', '#f4f7fb', 64),
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.pausedCard.name = 'paused';
    this.pausedCard.position.set(0, 0.015, 0.055);
    this.pausedCard.visible = false;

    this.endCard = new Mesh(
      new PlaneGeometry(0.26, 0.13),
      new MeshBasicMaterial({
        map: panelCardTexture('You finished!', '#102033', '#ffd23a', 52),
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.endCard.name = 'finished';
    this.endCard.position.set(0, 0.015, 0.055);
    this.endCard.visible = false;

    this.tutorialCard = new Mesh(
      new PlaneGeometry(0.28, 0.085),
      new MeshBasicMaterial({
        map: tutorialCardTexture(TUTORIAL_STEPS[0]),
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.tutorialCard.name = 'tutorial-card';
    this.tutorialCard.position.set(0, BOARD_HEIGHT / 2 + 0.058, 0.02);
    this.tutorialCard.visible = false;

    this.levelLabel = new Mesh(
      new PlaneGeometry(0.04, 0.028),
      new MeshBasicMaterial({ transparent: true, side: DoubleSide }),
    );
    this.levelLabel.position.set(-BOARD_WIDTH / 2 + 0.03, BOARD_HEIGHT / 2 - 0.028, 0.02);

    const disc = new Mesh(grabGeometry, handDiscMaterial);
    disc.rotation.x = Math.PI / 2;
    const tick = new Mesh(mirrorGeometry, handDiscMaterial);
    tick.scale.set(0.55, 0.45, 0.4);
    this.handDisc.add(disc, tick);
    this.handDisc.visible = false;

    this.beamGroup.name = 'beam';
    this.sparkGroup.name = 'sparks';
    for (let index = 0; index < 12; index += 1) {
      const mesh = new Mesh(sparkGeometry, sparkMaterial);
      mesh.visible = false;
      this.sparkGroup.add(mesh);
      this.sparks.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    const coneGeom = new ConeGeometry(0.012, 0.024, 16);
    coneGeom.rotateZ(Math.PI);
    const coneMesh = new Mesh(coneGeom, new MeshBasicMaterial({ color: 0xffd23a }));
    coneMesh.position.set(0, -0.012, 0);

    const shaftGeom = new CylinderGeometry(0.0035, 0.0035, 0.018, 12);
    const shaftMesh = new Mesh(shaftGeom, new MeshBasicMaterial({ color: 0xffd23a }));
    shaftMesh.position.set(0, 0.009, 0);

    this.level1Cue.add(coneMesh, shaftMesh);
    this.level1Cue.name = 'level-1-cue';
    this.level1Cue.visible = false;

    this.board.add(
      slab,
      gridLines(),
      this.beamGroup,
      this.sparkGroup,
      this.banner,
      this.pausedCard,
      this.endCard,
      this.tutorialCard,
      this.levelLabel,
      this.handDisc,
      this.level1Cue,
    );
    this.boardEntity = this.world.createTransformEntity(this.board, { persistent: true });

    const shelf = new Mesh(
      new BoxGeometry(EDGE_BUTTON_WIDTH * 2 + 0.08, EDGE_BUTTON_HEIGHT + 0.016, 0.01),
      this.boardMaterial,
    );
    shelf.name = 'button-shelf';
    shelf.position.set(0, EDGE_BUTTON_Y, 0.005);
    this.board.add(shelf);

    const buttonGeometry = new BoxGeometry(
      EDGE_BUTTON_WIDTH,
      EDGE_BUTTON_HEIGHT,
      EDGE_BUTTON_DEPTH,
    );
    const recenter = new Mesh(
      buttonGeometry,
      new MeshBasicMaterial({
        map: labelTexture('Center', '#ffe14a', '#1a1000'),
      }),
    );
    recenter.name = 'recenter';
    recenter.position.set(-0.07, EDGE_BUTTON_Y, 0.012);
    recenter.addEventListener('pointerdown', () => {
      if (!this.inputSettled) return;
      this.recenter();
    });
    this.recenterMesh = recenter;
    const recenterEntity = this.world.createTransformEntity(recenter, {
      parent: this.boardEntity,
    });
    recenterEntity.addComponent(PokeInteractable);
    recenterEntity.addComponent(RecenterButton);
    this.recenterEntity = recenterEntity;

    this.handMaterial = new MeshBasicMaterial({
      map: labelTexture('Hand', '#3dffb0', '#04140c'),
    });
    const hand = new Mesh(buttonGeometry, this.handMaterial);
    hand.name = 'hand-mirror';
    hand.position.set(0.07, EDGE_BUTTON_Y, 0.012);
    hand.addEventListener('pointerdown', () => {
      if (!this.inputSettled) return;
      this.toggleHandMirror();
    });
    this.handMesh = hand;
    const handEntity = this.world.createTransformEntity(hand, { parent: this.boardEntity });
    handEntity.addComponent(PokeInteractable);
    handEntity.addComponent(HandMirrorButton);
    this.handEntity = handEntity;
    this.paintHandButton();

    this.tutorialButtonMaterial = new MeshBasicMaterial({
      map: labelTexture('Next', '#ffe14a', '#1a1000'),
    });
    const tutorialBtnGeom = new BoxGeometry(0.075, 0.025, 0.016);
    const tutorialBtn = new Mesh(tutorialBtnGeom, this.tutorialButtonMaterial);
    tutorialBtn.name = 'tutorial-button';
    tutorialBtn.position.set(0, BOARD_HEIGHT / 2 + 0.038, 0.026);
    tutorialBtn.visible = false;
    this.tutorialButtonMesh = tutorialBtn;
    const tutorialEntity = this.world.createTransformEntity(tutorialBtn, {
      parent: this.boardEntity,
    });
    tutorialEntity.addComponent(PokeInteractable);
    tutorialEntity.addComponent(TutorialButton);
    this.tutorialEntity = tutorialEntity;

    const resumeBtnGeom = new BoxGeometry(0.09, 0.032, 0.018);
    const resumeBtn = new Mesh(
      resumeBtnGeom,
      new MeshBasicMaterial({
        map: labelTexture('Resume', '#3dffb0', '#04140c'),
      }),
    );
    resumeBtn.name = 'resume-button';
    resumeBtn.position.set(0, -0.024, 0.065);
    resumeBtn.visible = false;
    resumeBtn.addEventListener('pointerdown', () => {
      if (!this.inputSettled) return;
      this.resumeFromPanel();
    });
    this.resumeButtonMesh = resumeBtn;
    const resumeEntity = this.world.createTransformEntity(resumeBtn, {
      parent: this.boardEntity,
    });
    resumeEntity.addComponent(PokeInteractable);
    resumeEntity.addComponent(ResumeButton);
    this.resumeEntity = resumeEntity;

    const restartBtnGeom = new BoxGeometry(0.09, 0.032, 0.018);
    const restartBtn = new Mesh(
      restartBtnGeom,
      new MeshBasicMaterial({
        map: labelTexture('Restart', '#ffe14a', '#1a1000'),
      }),
    );
    restartBtn.name = 'restart-button';
    restartBtn.position.set(0, -0.024, 0.065);
    restartBtn.visible = false;
    restartBtn.addEventListener('pointerdown', () => {
      if (!this.inputSettled) return;
      this.restartGame();
    });
    this.restartButtonMesh = restartBtn;
    const restartEntity = this.world.createTransformEntity(restartBtn, {
      parent: this.boardEntity,
    });
    restartEntity.addComponent(PokeInteractable);
    restartEntity.addComponent(RestartButton);
    this.restartEntity = restartEntity;
  }

  private loadLevel(index: number, angles: number[] | null): void {
    const level = LEVELS[index] ?? LEVELS[0];
    if (!level) return;
    this.level = level;
    this.levelIndex = LEVELS.indexOf(level);
    this.won = false;
    this.winPlayed = false;
    this.winHold = 0;
    this.anim = 0;
    this.handLocked = false;
    this.handSpec = null;
    this.beamKey = '';
    this.endTwist();
    this.clearLevel();
    const usable =
      angles && angles.length === movablePieces(level).length ? angles : null;
    let movable = 0;
    for (const piece of level.pieces) {
      const degrees = piece.movable ? (usable?.[movable++] ?? piece.rot) : piece.rot;
      this.buildPiece(piece, (degrees * Math.PI) / 180);
    }
    this.buildSource();
    this.buildTargets();
    this.paintLevel();
    this.hideSparks();
    this.banner.visible = false;
    this.endPanelVisible = false;
    if (this.endCard) this.endCard.visible = false;
    if (this.restartButtonMesh) this.restartButtonMesh.visible = false;
    this.hookHeld = null;
    this.syncBeam();
    this.save();
  }

  private clearLevel(): void {
    this.pinchHeldPiece = null;
    this.pinchHand = null;
    const grab = this.world.getSystem(GrabSystem);
    for (const piece of this.pieces) {
      if (piece.entity) {
        grab?.forceRelease(piece.entity);
        // Destroying drops the transform before the mesh is detached. Removing
        // the mesh first clears the parent and TransformSystem warns.
        piece.entity.destroy();
        piece.entity = null;
      } else {
        piece.object.removeFromParent();
      }
    }
    this.pieces.length = 0;
    for (const target of this.targets) {
      target.removeFromParent();
      const material = target.material;
      if (material instanceof MeshStandardMaterial) material.dispose();
    }
    this.targets.length = 0;
    this.sourceMesh?.removeFromParent();
    this.sourceMesh = null;
  }

  private buildPiece(piece: LevelPiece, radians: number): void {
    const center = cellCenter(piece.col, piece.row);
    const group = new Group();
    group.name = piece.type;
    if (piece.type === 'blocker') {
      group.add(new Mesh(blockerGeometry, blockerMaterial));
    } else if (piece.type === 'prism') {
      const gem = new Mesh(prismGeometry, prismMaterial);
      gem.rotation.x = Math.PI / 2;
      group.add(gem);
    } else {
      group.add(new Mesh(mirrorGeometry, mirrorMaterial));
      const edge = new Mesh(mirrorEdgeGeometry, mirrorEdgeMaterial);
      edge.name = 'mirror-edge';
      edge.position.set(0, 0.007, 0.01);
      group.add(edge);
    }
    if (piece.movable) {
      const pad = new Mesh(grabGeometry, grabMaterial);
      pad.name = 'pad';
      pad.rotation.x = Math.PI / 2;
      group.add(pad);
      const reach = new Mesh(soloReachGeometry, reachMaterial);
      reach.name = 'reach';
      reach.rotation.x = Math.PI / 2;
      group.add(reach);
      const highlight = new Mesh(highlightGeometry, highlightMaterial);
      highlight.name = 'grabbed';
      highlight.rotation.x = Math.PI / 2;
      highlight.position.z = -0.008;
      highlight.visible = false;
      group.add(highlight);
    }
    group.position.set(center.x, center.y, piece.type === 'blocker' ? 0.03 : PIECE_Z);
    if (piece.type !== 'blocker') group.rotation.z = radians;
    this.board.add(group);

    let entity: Entity | null = null;
    if (piece.movable && this.boardEntity) {
      entity = this.world.createTransformEntity(group, { parent: this.boardEntity });
      entity.addComponent(OneHandGrabbable, { rotate: false, translate: false });
    }
    this.pieces.push({
      type: piece.type,
      col: piece.col,
      row: piece.row,
      movable: piece.movable,
      object: group,
      entity,
      committed: radians,
      smoothed: radians,
    });
  }

  private buildSource(): void {
    const center = cellCenter(this.level.source.col, this.level.source.row);
    const source = new Mesh(sourceGeometry, sourceMaterial);
    source.name = 'source';
    source.position.set(center.x, center.y, PIECE_Z);
    source.rotation.z = -Math.PI / 2 + (this.level.source.dir * Math.PI) / 180;
    this.board.add(source);
    this.sourceMesh = source;
  }

  private buildTargets(): void {
    for (const target of this.level.targets) {
      const center = cellCenter(target.col, target.row);
      const material = new MeshStandardMaterial({
        color: 0x12383c,
        emissive: 0x062428,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new Mesh(targetGeometry, material);
      mesh.name = 'target';
      mesh.position.set(center.x, center.y, 0.03);
      this.board.add(mesh);
      this.targets.push(mesh);
    }
  }

  private paintLevel(): void {
    const material = this.levelLabel.material;
    if (!(material instanceof MeshBasicMaterial)) return;
    material.map?.dispose();
    material.map = labelTexture(this.level.id, '#102033', '#d5e4f5');
    material.needsUpdate = true;
  }

  private paintHandButton(): void {
    this.handMaterial.color.setHex(this.handEnabled ? 0xd6ffe8 : 0xffffff);
  }

  private paintTarget(index: number, lit: boolean): void {
    const mesh = this.targets[index];
    if (!mesh) return;
    const material = mesh.material;
    if (!(material instanceof MeshStandardMaterial)) return;
    if (lit) {
      material.color.setHex(0xfff6d4);
      material.emissive.setHex(0xffc14a);
      material.emissiveIntensity = 2.4;
      return;
    }
    material.color.setHex(0x12383c);
    material.emissive.setHex(0x062428);
    material.emissiveIntensity = 0.4;
  }

  private simPaused(): boolean {
    return (
      this.hookPaused ||
      this.docHidden ||
      this.xrState === VisibilityState.Hidden ||
      this.xrState === VisibilityState.VisibleBlurred
    );
  }

  private applyPause(): void {
    const paused = this.simPaused();
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.pausedCard) this.pausedCard.visible = paused;
    if (this.resumeButtonMesh) this.resumeButtonMesh.visible = paused;
    if (this.endPanelVisible) {
      if (this.endCard) this.endCard.visible = !paused;
      if (this.restartButtonMesh) this.restartButtonMesh.visible = !paused;
    }
    if (!paused) return;
    this.endTwist();
    this.audio.suspend();
    this.save();
  }

  private placeWhenReady(): void {
    if (
      this.xrState !== VisibilityState.Visible &&
      this.xrState !== VisibilityState.NonImmersive
    ) {
      return;
    }
    this.player.head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(this.player.head.matrixWorld);
    // The first immersive frames can report the head at the origin.
    if (this.xrState === VisibilityState.Visible && this.headPos.y < 0.75) return;
    this.placeTray();
    this.needsPlace = false;
  }

  private placeTray(): void {
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(head.matrixWorld);
    this.forward.set(0, 0, -1).transformDirection(head.matrixWorld);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.boardPos.copy(this.headPos).addScaledVector(this.forward, BOARD_FORWARD_M);
    this.boardPos.y -= BOARD_DROP_M;
    // Zero when the tray is centered on the facing direction.
    this.scratch.set(-this.forward.z, 0, this.forward.x);
    if (this.scratch.lengthSq() > 1e-8) {
      this.scratch.normalize().multiplyScalar(BOARD_SIDE_M);
      this.boardPos.add(this.scratch);
    }
    this.orientTray(this.forward);
    this.board.position.copy(this.boardPos);
    this.board.updateWorldMatrix(true, true);
    this.endTwist();
  }

  /**
   * Before Enter XR the desktop camera is not the headset. Sit it on the
   * board normal so the whole tilted tray is in frame.
   */
  private frameDesktopPreview(): void {
    if (this.xrState !== VisibilityState.NonImmersive) return;
    this.world.scene.background = this.previewBackground;
    this.board.updateWorldMatrix(true, true);
    this.boardPos.setFromMatrixPosition(this.board.matrixWorld);
    this.forward.set(0, 0, 1).transformDirection(this.board.matrixWorld);
    this.scratch.copy(this.boardPos).addScaledVector(this.forward, 0.92);
    const camera = this.world.camera;
    if (camera.parent) {
      camera.parent.updateWorldMatrix(true, false);
      camera.parent.worldToLocal(this.scratch);
    }
    camera.position.copy(this.scratch);
    camera.lookAt(this.boardPos);
    camera.updateProjectionMatrix();
  }

  /** Far edge up, normal tipped toward the player. `forward` is horizontal. */
  private orientTray(forward: Vector3): void {
    const sin = Math.sin(TRAY_TILT_RADIANS);
    const cos = Math.cos(TRAY_TILT_RADIANS);
    this.yAxis.set(forward.x * cos, sin, forward.z * cos).normalize();
    this.boardNormal.set(-forward.x * sin, cos, -forward.z * sin).normalize();
    this.xAxis.crossVectors(this.yAxis, this.boardNormal).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.boardNormal);
    this.board.quaternion.setFromRotationMatrix(this.basis);
  }

  private layoutPieces(): void {
    for (const piece of this.pieces) {
      const center = cellCenter(piece.col, piece.row);
      piece.object.position.set(center.x, center.y, piece.type === 'blocker' ? 0.03 : PIECE_Z);
      if (piece.type !== 'blocker') piece.object.rotation.set(0, 0, piece.committed);
      const highlight = piece.object.getObjectByName('grabbed');
      if (highlight) {
        highlight.visible =
          piece.entity?.hasComponent(Grabbed) === true ||
          piece === this.pinchHeldPiece ||
          piece === this.hookHeld;
      }
    }
    if (this.handEnabled) {
      this.handDisc.visible = true;
      if (this.handSpec) {
        this.handDisc.position.set(this.handSpec.x, this.handSpec.y, 0.024);
        this.handDisc.rotation.z = (this.handSpec.dir * Math.PI) / 180;
      } else if (this.lastPalm) {
        this.handDisc.position.set(this.lastPalm.x, this.lastPalm.y, 0.024);
        this.handDisc.rotation.z = Math.PI / 4;
      } else {
        this.handDisc.position.set(0.08, -0.06, 0.024);
        this.handDisc.rotation.z = Math.PI / 4;
      }
    } else {
      this.handDisc.visible = false;
    }
  }

  private updateLevel1Cue(delta: number): void {
    if (this.levelIndex !== 0 || this.won || this.paused) {
      this.level1Cue.visible = false;
      return;
    }
    const piece = this.pieces.find((p) => p.movable);
    if (!piece) {
      this.level1Cue.visible = false;
      return;
    }
    const isGrabbed =
      piece.entity?.hasComponent(Grabbed) === true ||
      piece === this.pinchHeldPiece ||
      piece === this.hookHeld;
    if (isGrabbed || pieceDegrees(piece) !== 0) {
      this.level1Cue.visible = false;
      return;
    }
    this.cueAnim += delta;
    this.level1Cue.visible = true;
    const center = cellCenter(piece.col, piece.row);
    const bob = Math.sin(this.cueAnim * 3.5) * 0.006;
    this.level1Cue.position.set(center.x, center.y + 0.046 + bob, 0.035);
  }

  private endTwist(): void {
    if (this.active) {
      const snapped = nearestSnap(this.active.smoothed);
      if (snapped !== this.active.committed) {
        this.active.committed = snapped;
        this.audio.tick();
        this.syncBeam();
      }
      this.save();
    }
    this.twisting = false;
    this.tipReady = false;
    this.active = null;
    this.pinchHeldPiece = null;
    this.pinchHand = null;
  }

  private grabbedPiece(): LivePiece | null {
    for (const piece of this.pieces) {
      if (piece.entity?.hasComponent(Grabbed)) return piece;
    }
    return null;
  }

  private findNearestMovablePiece(hand: 'left' | 'right'): LivePiece | null {
    const grip = this.player.gripSpaces[hand];
    grip.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(grip.matrixWorld);

    let best: LivePiece | null = null;
    let bestDist = GENEROUS_GRAB_RADIUS;

    for (const piece of this.pieces) {
      if (!piece.movable) continue;
      piece.object.updateWorldMatrix(true, false);
      this.local.setFromMatrixPosition(piece.object.matrixWorld);
      const dist = this.scratch.distanceTo(this.local);
      if (dist < bestDist) {
        bestDist = dist;
        best = piece;
      }
    }
    return best;
  }

  private getActiveGrab(): { piece: LivePiece; hand: 'left' | 'right' } | null {
    if (!this.inputSettled) return null;
    const grabbed = this.grabbedPiece();
    if (grabbed?.entity) {
      const hand = this.world.getSystem(GrabSystem)?.getHolderHand(grabbed.entity);
      if ((hand === 'left' || hand === 'right') && this.input.xr.isPrimary('hand', hand)) {
        return { piece: grabbed, hand };
      }
    }
    if (this.pinchHeldPiece && this.pinchHand) {
      if (
        this.input.xr.isPrimary('hand', this.pinchHand) &&
        this.input.xr.getSelectState(this.pinchHand).active
      ) {
        return { piece: this.pinchHeldPiece, hand: this.pinchHand };
      }
      this.pinchHeldPiece = null;
      this.pinchHand = null;
    }
    for (const hand of ['right', 'left'] as const) {
      if (!this.input.xr.isPrimary('hand', hand)) continue;
      const select = this.input.xr.getSelectState(hand);
      if (select.active || select.start) {
        const nearest = this.findNearestMovablePiece(hand);
        if (nearest) {
          this.pinchHeldPiece = nearest;
          this.pinchHand = hand;
          return { piece: nearest, hand };
        }
      }
    }
    return null;
  }

  private integrateTwist(delta: number): void {
    const active = this.getActiveGrab();
    if (!active) {
      this.endTwist();
      return;
    }
    const { piece, hand } = active;
    this.readBoardAxes();
    this.readQuat(this.player.gripSpaces[hand], this.gripNow);
    const tipDelta = this.tipDelta(hand, piece);
    if (!this.twisting || this.active !== piece) {
      this.twisting = true;
      this.active = piece;
      this.startAngle = piece.committed;
      this.copyQuat(this.gripNow, this.startGrip);
      piece.smoothed = piece.committed;
      return;
    }
    const gripDelta = signedTwist(this.startGrip, this.gripNow, this.normal);
    let twist = chooseTwistDelta(tipDelta, gripDelta);
    if (Math.abs(twist) > TRACKING_JUMP) {
      this.startAngle = piece.committed;
      this.tipReady = false;
      this.copyQuat(this.gripNow, this.startGrip);
      piece.smoothed = piece.committed;
      twist = 0;
    }
    piece.smoothed = smoothAngle(piece.smoothed, this.startAngle + twist, delta);
    const next = snapWithHysteresis(piece.smoothed, piece.committed);
    if (next === piece.committed) return;
    piece.committed = next;
    this.audio.tick();
    this.save();
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

  private tipDelta(hand: 'left' | 'right', piece: LivePiece): number {
    const tip = this.player.indexTipSpaces[hand];
    tip.updateWorldMatrix(true, false);
    piece.object.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(tip.matrixWorld);
    this.local.setFromMatrixPosition(piece.object.matrixWorld);
    this.scratch.sub(this.local);
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

  private angleList(): number[] {
    return this.pieces.filter((piece) => piece.movable).map((piece) => pieceDegrees(piece));
  }

  private integrateHand(): void {
    if (!this.handEnabled) {
      this.lastPalm = null;
      if (this.handSpec) {
        this.handSpec = null;
        this.handLocked = false;
        this.syncBeam();
      }
      return;
    }
    if (this.handLocked) return;
    const palm = this.readPalm();
    this.lastPalm = palm;
    if (!palm) {
      if (this.handSpec) {
        this.handSpec = null;
        this.syncBeam();
      }
      return;
    }
    const angles = this.angleList();
    const bare = solveBeam(boardFromLevel(this.level, angles));
    const incoming = nearestIncoming(bare.segments, palm.x, palm.y, HAND_CATCH);
    if (!incoming) {
      if (this.handSpec) {
        this.handSpec = null;
        this.syncBeam();
      }
      return;
    }
    const dir = palmOutgoingDegrees(incoming.x, incoming.y, palm.nx, palm.ny, palm.nz);
    if (dir == null) return;
    const spec: BeamHand = {
      x: Math.round(palm.x * 200) / 200,
      y: Math.round(palm.y * 200) / 200,
      radius: HAND_RADIUS,
      dir,
    };
    const withHand = solveBeam(boardFromLevel(this.level, angles, spec));
    const bareLit = bare.lit.filter(Boolean).length;
    const nextLit = withHand.lit.filter(Boolean).length;
    if (nextLit > bareLit) this.handLocked = true;
    if (
      this.handSpec &&
      this.handSpec.x === spec.x &&
      this.handSpec.y === spec.y &&
      this.handSpec.dir === spec.dir
    ) {
      return;
    }
    this.handSpec = spec;
    this.syncBeam();
  }

  /** Palm center on the board, and the palm normal in board space. Grip +Y faces out of the palm. */
  private readPalm(): { x: number; y: number; nx: number; ny: number; nz: number } | null {
    this.board.updateWorldMatrix(true, false);
    this.inverse.copy(this.board.matrixWorld).invert();
    let best: { x: number; y: number; nx: number; ny: number; nz: number } | null = null;
    let bestZ = Number.POSITIVE_INFINITY;
    for (const hand of ['left', 'right'] as const) {
      if (!this.input.xr.isPrimary('hand', hand)) continue;
      const grip = this.player.gripSpaces[hand];
      grip.updateWorldMatrix(true, false);
      this.scratch.setFromMatrixPosition(grip.matrixWorld);
      this.local.copy(this.scratch).applyMatrix4(this.inverse);
      if (Math.abs(this.local.x) > BOARD_WIDTH / 2 + 0.12) continue;
      if (Math.abs(this.local.y) > BOARD_HEIGHT / 2 + 0.08) continue;
      if (this.local.z < -0.02 || this.local.z > HAND_REACH_Z) continue;
      if (Math.abs(this.local.z) >= bestZ) continue;
      this.palmNormal.set(0, 1, 0).transformDirection(grip.matrixWorld);
      this.palmNormal.transformDirection(this.inverse);
      bestZ = Math.abs(this.local.z);
      best = {
        x: this.local.x,
        y: this.local.y,
        nx: this.palmNormal.x,
        ny: this.palmNormal.y,
        nz: this.palmNormal.z,
      };
    }
    return best;
  }

  private integrateWin(delta: number): void {
    if (!this.won || this.tutorialVisible) return;
    this.stepSparks(delta);
    if (this.levelIndex >= LEVELS.length - 1 || this.testMode) return;
    // A long first frame must not skip the payoff.
    this.winHold += Math.min(delta, 0.05);
    if (this.winHold < WIN_HOLD) return;
    this.loadLevel(this.levelIndex + 1, null);
  }

  private syncBeam(): void {
    const angles = this.angleList();
    const hand = this.handSpec;
    const key = `${this.levelIndex}|${angles.join(',')}|${
      hand ? `${hand.x.toFixed(3)}:${hand.y.toFixed(3)}:${hand.dir}` : ''
    }`;
    if (key === this.beamKey) return;
    this.beamKey = key;
    const result = solveBeam(boardFromLevel(this.level, angles, hand ?? undefined));
    this.rebuildBeam(result.segments);
    this.won = result.hitTarget;
    this.lit = result.lit.slice();
    result.lit.forEach((lit, index) => this.paintTarget(index, lit));
    this.boardMaterial.emissive.setHex(this.won ? 0x24523a : 0x0c1824);
    this.boardMaterial.emissiveIntensity = this.won ? 0.7 : 0.85;

    const isLastLevel = this.levelIndex >= LEVELS.length - 1;
    if (this.won && isLastLevel) {
      this.endPanelVisible = true;
      if (this.endCard) this.endCard.visible = !this.paused;
      if (this.restartButtonMesh) this.restartButtonMesh.visible = !this.paused;
      this.banner.visible = false;
    } else {
      this.endPanelVisible = false;
      if (this.endCard) this.endCard.visible = false;
      if (this.restartButtonMesh) this.restartButtonMesh.visible = false;
      this.banner.visible = this.won;
    }

    if (!this.won) {
      this.winPlayed = false;
      this.winHold = 0;
      this.hideSparks();
      return;
    }
    if (this.winPlayed) return;
    this.winPlayed = true;
    this.audio.win();
    this.burst();
  }

  private rebuildBeam(segments: readonly BeamSegment[]): void {
    let used = 0;
    for (const segment of segments) {
      const dx = segment.x1 - segment.x0;
      const dy = segment.y1 - segment.y0;
      const length = Math.hypot(dx, dy);
      if (length < 1e-5) continue;
      const pair = this.beams[used] ?? this.makeBeam();
      const angle = Math.atan2(dy, dx);
      const x = (segment.x0 + segment.x1) / 2;
      const y = (segment.y0 + segment.y1) / 2;
      pair.glow.visible = true;
      pair.core.visible = true;
      pair.glow.scale.set(length, 0.016, 0.01);
      pair.core.scale.set(length, 0.0045, 0.0045);
      pair.glow.position.set(x, y, BEAM_Z);
      pair.core.position.set(x, y, BEAM_Z);
      pair.glow.rotation.z = angle;
      pair.core.rotation.z = angle;
      used += 1;
    }
    for (let index = used; index < this.beams.length; index += 1) {
      const pair = this.beams[index];
      if (!pair) continue;
      pair.glow.visible = false;
      pair.core.visible = false;
    }
  }

  private makeBeam(): { glow: Mesh; core: Mesh } {
    const glow = new Mesh(beamGeometry, glowMaterial);
    const core = new Mesh(beamGeometry, beamMaterial);
    this.beamGroup.add(glow, core);
    const pair = { glow, core };
    this.beams.push(pair);
    return pair;
  }

  private burst(): void {
    for (const spark of this.sparks) {
      spark.life = 0.8 + Math.random() * 0.5;
      spark.vx = (Math.random() - 0.5) * 0.18;
      spark.vy = 0.04 + Math.random() * 0.22;
      spark.vz = 0.04 + Math.random() * 0.12;
      spark.mesh.visible = true;
      spark.mesh.position.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.1, 0.04);
      spark.mesh.scale.setScalar(1);
    }
  }

  private stepSparks(delta: number): void {
    for (const spark of this.sparks) {
      spark.life -= delta;
      if (spark.life <= 0) {
        spark.life = 0.55 + Math.random() * 0.35;
        spark.vx = (Math.random() - 0.5) * 0.16;
        spark.vy = 0.05 + Math.random() * 0.16;
        spark.vz = 0.03 + Math.random() * 0.08;
        spark.mesh.position.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.1, 0.04);
      }
      spark.mesh.visible = true;
      spark.mesh.position.x += spark.vx * delta;
      spark.mesh.position.y += spark.vy * delta;
      spark.mesh.position.z += spark.vz * delta;
      spark.mesh.scale.setScalar(Math.max(spark.life, 0.25));
    }
  }

  private hideSparks(): void {
    for (const spark of this.sparks) {
      spark.life = 0;
      spark.mesh.visible = false;
    }
  }

  private save(): void {
    writeProgress(localStorage, { level: this.levelIndex, angles: this.angleList() });
  }

  /**
   * `?test=1` only. Exposes `window.beamline` and Q/E/Tab/N so a playtest
   * can drive the board without a headset.
   */
  private installTestHook(): void {
    if (new URLSearchParams(window.location.search).get('test') !== '1') return;
    this.testMode = true;
    const api = {
      state: () => this.hookState(),
      grab: (id: string) => this.hookGrab(id),
      rotate: (stepsOrId: string | number, maybeSteps?: number) => {
        if (typeof stepsOrId === 'number' && maybeSteps === undefined) {
          return this.hookRotateHeld(stepsOrId);
        }
        if (typeof maybeSteps === 'number') return this.hookRotate(String(stepsOrId), maybeSteps);
        return false;
      },
      release: () => this.hookRelease(),
      level: (n: number) => this.hookLevel(n),
      pause: () => this.hookPause(true),
      resume: () => this.hookPause(false),
      resetTutorial: () => this.hookResetTutorial(),
      press: (button: string) => this.hookPress(button),
    };
    window.beamline = api;
    const onKey = (event: KeyboardEvent) => this.onTestKey(event);
    window.addEventListener('keydown', onKey, true);
    this.cleanupFuncs.push(() => {
      window.removeEventListener('keydown', onKey, true);
      if (window.beamline === api) delete window.beamline;
    });
  }

  private onTestKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    if (
      event.code !== 'KeyQ' &&
      event.code !== 'KeyE' &&
      event.code !== 'Tab' &&
      event.code !== 'KeyN'
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!this.inputSettled || this.tutorialVisible) return;
    if (event.code === 'KeyQ') {
      this.hookRotateHeld(-1);
    } else if (event.code === 'KeyE') {
      this.hookRotateHeld(1);
    } else if (event.code === 'Tab') {
      this.hookCycle(event.shiftKey ? -1 : 1);
    } else if (event.code === 'KeyN') {
      if (this.levelIndex < LEVELS.length - 1) this.hookLevel(this.levelIndex + 2);
    }
  }

  private hookRotateHeld(steps: number): boolean {
    const piece = this.hookHeld ?? this.grabbedPiece() ?? this.pieces.find((item) => item.movable);
    if (!piece) return false;
    return this.applySteps(piece, steps);
  }

  private hookCycle(direction: number): void {
    const movable = this.pieces.filter((piece) => piece.movable);
    if (movable.length === 0) return;
    const current = this.hookHeld ? movable.indexOf(this.hookHeld) : -1;
    const next = (current + direction + movable.length) % movable.length;
    const piece = movable[next];
    if (piece) this.hookGrab(pieceId(piece));
  }

  private hookPause(paused: boolean): void {
    this.hookPaused = paused;
    this.applyPause();
  }

  private hookLevel(n: number): void {
    if (!Number.isInteger(n) || n < 1 || n > LEVELS.length) return;
    this.hookPaused = false;
    const saved = readProgress(localStorage, LEVELS.length);
    const angles = saved?.level === n - 1 ? saved.angles : null;
    this.loadLevel(n - 1, angles);
    this.applyPause();
  }

  private hookGrab(id: string): boolean {
    const piece = this.pieceById(id);
    if (!piece || !piece.movable) return false;
    this.hookHeld = piece;
    return true;
  }

  private hookRotate(id: string, steps: number): boolean {
    const piece = this.pieceById(id);
    if (!piece) return false;
    return this.applySteps(piece, steps);
  }

  /** Write 15° steps onto the piece. Skips the pinch-twist integrator. */
  private applySteps(piece: LivePiece, steps: number): boolean {
    if (!piece.movable || !Number.isFinite(steps)) return false;
    this.hookHeld = piece;
    if (piece.entity) this.world.getSystem(GrabSystem)?.forceRelease(piece.entity);
    this.endTwist();
    const next = angleFromStepsOrDegrees(piece.committed, steps);
    piece.committed = next;
    piece.smoothed = next;
    if (piece.type !== 'blocker') piece.object.rotation.z = next;
    this.audio.tick();
    this.save();
    this.syncBeam();
    return true;
  }

  private hookRelease(): void {
    const piece = this.hookHeld ?? this.grabbedPiece() ?? this.pinchHeldPiece;
    if (piece?.entity) this.world.getSystem(GrabSystem)?.forceRelease(piece.entity);
    this.hookHeld = null;
    this.pinchHeldPiece = null;
    this.pinchHand = null;
    this.endTwist();
    this.save();
  }

  private pieceById(id: string): LivePiece | null {
    const exact = this.pieces.find((piece) => pieceId(piece) === id);
    if (exact) return exact;
    if (/^\d+$/.test(id)) {
      const movable = this.pieces.filter((piece) => piece.movable);
      return movable[Number(id)] ?? null;
    }
    return null;
  }

  private isPressNearButton(button: Object3D | null): boolean {
    if (!button || !button.visible) return false;
    button.updateWorldMatrix(true, false);
    this.pressButtonPos.setFromMatrixPosition(button.matrixWorld);

    let hasFingertip = false;
    const session = this.xrManager?.getSession?.();
    const frame = this.xrManager?.getFrame?.() ?? (this as any).xrFrame;
    const refSpace = this.xrManager?.getReferenceSpace?.();

    if (frame && refSpace && session?.inputSources) {
      for (const source of session.inputSources) {
        if ((source as any).hand) {
          const hand = (source as any).hand;
          let joint: any;
          if (typeof hand.get === 'function') {
            joint = hand.get('index-finger-tip');
          } else if (Symbol.iterator in Object(hand)) {
            for (const j of hand) {
              if (j?.jointName === 'index-finger-tip') {
                joint = j;
                break;
              }
            }
          }
          if (joint) {
            const pose =
              typeof frame.getJointPose === 'function'
                ? frame.getJointPose(joint, refSpace)
                : typeof frame.getPose === 'function'
                  ? frame.getPose(joint, refSpace)
                  : null;
            if (pose) {
              hasFingertip = true;
              this.player.updateWorldMatrix(true, false);
              this.pressHandPos
                .set(
                  pose.transform.position.x,
                  pose.transform.position.y,
                  pose.transform.position.z,
                )
                .applyMatrix4(this.player.matrixWorld);
              if (this.pressHandPos.distanceTo(this.pressButtonPos) <= 0.04) {
                return true;
              }
            }
          }
        }
      }
    }

    if (!hasFingertip) {
      for (const hand of ['left', 'right'] as const) {
        const isHand = this.input?.xr?.isPrimary
          ? this.input.xr.isPrimary('hand', hand)
          : Boolean(this.player.indexTipSpaces?.[hand]);
        if (isHand) {
          const tip = this.player.indexTipSpaces?.[hand];
          if (tip) {
            hasFingertip = true;
            tip.updateWorldMatrix(true, false);
            this.pressHandPos.setFromMatrixPosition(tip.matrixWorld);
            if (this.pressHandPos.distanceTo(this.pressButtonPos) <= 0.04) {
              return true;
            }
          }
        }
      }
    }

    if (hasFingertip) {
      return false;
    }

    for (const hand of ['left', 'right'] as const) {
      const grip = this.player.gripSpaces?.[hand];
      if (grip) {
        grip.updateWorldMatrix(true, false);
        this.pressHandPos.setFromMatrixPosition(grip.matrixWorld);
        if (this.pressHandPos.distanceTo(this.pressButtonPos) <= 0.15) {
          return true;
        }
      }
    }

    return false;
  }

  private worldPoint(object: Object3D | null): { x: number; y: number; z: number } {
    if (!object) return { x: 0, y: 0, z: 0 };
    object.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(object.matrixWorld);
    return { x: roundMm(this.scratch.x), y: roundMm(this.scratch.y), z: roundMm(this.scratch.z) };
  }

  private headRelative(object: Object3D): { x: number; y: number; z: number } {
    this.player.head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(this.player.head.matrixWorld);
    object.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(object.matrixWorld).sub(this.headPos);
    this.player.head.getWorldQuaternion(this.scratchQuat);
    this.scratch.applyQuaternion(this.scratchQuat.invert());
    return { x: roundMm(this.scratch.x), y: roundMm(this.scratch.y), z: roundMm(this.scratch.z) };
  }

  private hookResetTutorial(): void {
    clearTutorial(localStorage);
    this.tutorialChecked = false;
    this.tutorialStep = 0;
    this.tutorialVisible = true;
    this.updateTutorialCard();
  }

  private hookPress(button: string): boolean {
    const key = button.toLowerCase();
    if (key === 'center' || key === 'recenter') {
      this.recenter(true);
      return true;
    }
    if (key === 'hand') {
      this.toggleHandMirror(true);
      return true;
    }
    if (key === 'tutorial' || key === 'next' || key === 'gotit' || key === 'got it') {
      this.advanceTutorial(true);
      return true;
    }
    if (key === 'resume') {
      this.resumeFromPanel(true);
      return true;
    }
    if (key === 'restart') {
      this.restartGame(true);
      return true;
    }
    return false;
  }

  private getBottomPieceEdgeY(): number {
    let lowest = 0;
    let found = false;
    for (const piece of this.pieces) {
      if (piece.row !== 0) continue;
      const center = cellCenter(piece.col, piece.row);
      let halfH = 0;
      if (piece.type === 'blocker') {
        halfH = BLOCKER_HALF_HEIGHT;
      } else if (piece.type === 'mirror') {
        const cos = Math.abs(Math.cos(piece.committed));
        const sin = Math.abs(Math.sin(piece.committed));
        halfH = MIRROR_HALF_LENGTH * sin + 0.005 * cos;
      } else if (piece.type === 'prism') {
        halfH = 0.03;
      }
      const bottom = center.y - halfH;
      if (!found || bottom < lowest) {
        lowest = bottom;
        found = true;
      }
    }
    return found ? roundMm(lowest) : roundMm(-BOARD_HEIGHT / 2);
  }

  private hookState() {
    const held = this.grabbedPiece() ?? this.pinchHeldPiece ?? this.hookHeld;
    const bottomPieceEdgeY = this.getBottomPieceEdgeY();
    const buttonTopY = roundMm(EDGE_BUTTON_Y + EDGE_BUTTON_HEIGHT / 2);
    const gapM = roundMm(bottomPieceEdgeY - buttonTopY);
    return {
      level: this.levelIndex + 1,
      paused: this.paused,
      inputSettled: this.inputSettled,
      won: this.won,
      lit: this.lit.slice(),
      grabbed: held ? pieceId(held) : null,
      handMirror: {
        enabled: this.handEnabled,
        visible: this.handDisc.visible,
      },
      layout: {
        bottomPieceEdgeY,
        buttonTopY,
        gapM,
      },
      ui: {
        tutorial: {
          visible: this.tutorialVisible,
          step: this.tutorialStep,
        },
        pausedPanel: this.pausedCard ? this.pausedCard.visible : false,
        endPanel: this.endPanelVisible,
      },
      presses: {
        center: this.centerPresses,
        hand: this.handPresses,
        tutorial: this.tutorialPresses,
        next: this.tutorialPresses,
        resume: this.resumePresses,
        restart: this.restartPresses,
      },
      trayWorld: this.worldPoint(this.board),
      pieces: this.pieces.map((piece) => ({
        id: pieceId(piece),
        type: piece.type,
        col: piece.col,
        row: piece.row,
        movable: piece.movable,
        degrees: pieceDegrees(piece),
      })),
      pose: {
        buttons: {
          center: this.worldPoint(this.recenterMesh),
          hand: this.worldPoint(this.handMesh),
          tutorial: this.worldPoint(this.tutorialButtonMesh),
          next: this.worldPoint(this.tutorialButtonMesh),
          resume: this.worldPoint(this.resumeButtonMesh),
          restart: this.worldPoint(this.restartButtonMesh),
        },
        hands: {
          left: this.headRelative(this.player.gripSpaces.left),
          right: this.headRelative(this.player.gripSpaces.right),
        },
        pieces: this.pieces
          .filter((piece) => piece.movable)
          .map((piece) => ({ id: pieceId(piece), ...this.headRelative(piece.object) })),
      },
    };
  }
}
