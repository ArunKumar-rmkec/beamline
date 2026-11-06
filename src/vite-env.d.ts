/// <reference types="vite/client" />
/// <reference types="@iwsdk/vite-plugin-dev/client" />

interface BeamlinePieceState {
  id: string;
  type: 'mirror' | 'prism' | 'blocker';
  col: number;
  row: number;
  movable: boolean;
  degrees: number;
}

interface BeamlinePosePoint {
  x: number;
  y: number;
  z: number;
}

/** Present only while the page is open with `?test=1`. */
interface BeamlineTestApi {
  state(): {
    level: number;
    paused: boolean;
    inputSettled: boolean;
    won: boolean;
    lit: boolean[];
    grabbed: string | null;
    wrist: {
      rollDeg: number;
      baselineDeg: number;
      appliedSteps: number;
      guardRejects: number;
    };
    gaze?: {
      piece: string | null;
      id?: string | null;
      angle: number | null;
      angleDeg?: number | null;
    };
    oneHand?: {
      enabled: boolean;
      direction: number;
      dwellTime?: number;
    };
    audio?: {
      contextState: AudioContextState | 'uninitialized';
      lastWinChordAt: number;
      chordsPlayed: number;
    };
    handMirror?: {
      on: boolean;
      intercepting: boolean;
      lockedAngle: number | null;
      lockedTarget: number | null;
      enabled?: boolean;
      visible?: boolean;
    };
    layout?: {
      bottomPieceEdgeY: number;
      buttonTopY: number;
      gapM: number;
    };
    ui: {
      tutorial: { visible: boolean; step: number };
      pausedPanel: boolean;
      endPanel: boolean;
      menu?: boolean;
    };
    presses: {
      center: number;
      hand: number;
      levels?: number;
      oneHand?: number;
      tutorial: number;
      next?: number;
      skip?: number;
      resume: number;
      restart: number;
      [button: string]: number | undefined;
    };
    trayWorld?: BeamlinePosePoint;
    pieces: BeamlinePieceState[];
    pose: {
      buttons: {
        center: BeamlinePosePoint;
        hand: BeamlinePosePoint;
        levels?: BeamlinePosePoint;
        oneHand?: BeamlinePosePoint;
        tutorial: BeamlinePosePoint;
        next?: BeamlinePosePoint;
        skip?: BeamlinePosePoint;
        resume: BeamlinePosePoint;
        restart: BeamlinePosePoint;
        [button: string]: BeamlinePosePoint | undefined;
      };
      hands: { left: BeamlinePosePoint; right: BeamlinePosePoint };
      pieces: Array<BeamlinePosePoint & { id: string }>;
    };
  };
  grab(id: string): boolean;
  /** `rotate(1)` turns the grabbed piece one 15° step. `rotate(id, steps)` turns that piece. */
  rotate(steps: number): boolean;
  rotate(id: string, steps: number): boolean;
  wrist?(quat: { x: number; y: number; z: number; w: number }, deltaSeconds?: number): boolean;
  release(): void;
  level(n: number): void;
  pause(): void;
  resume(): void;
  resetTutorial(): void;
  press?(button: string): boolean;
  menu?(open?: boolean): boolean;
  daily?(dateStr?: string): boolean;
  oneHand?(on?: boolean): boolean;
  palm?(x?: number | null, y?: number): boolean;
}

interface Window {
  beamline?: BeamlineTestApi;
}
