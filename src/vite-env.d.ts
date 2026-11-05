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
    won: boolean;
    lit: boolean[];
    grabbed: string | null;
    handMirror?: { enabled: boolean; visible: boolean };
    ui: {
      tutorial: { visible: boolean; step: number };
      pausedPanel: boolean;
      endPanel: boolean;
    };
    presses: {
      center: number;
      hand: number;
      tutorial: number;
      next?: number;
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
        tutorial: BeamlinePosePoint;
        next?: BeamlinePosePoint;
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
  release(): void;
  level(n: number): void;
  pause(): void;
  resume(): void;
  resetTutorial(): void;
  press?(button: string): boolean;
}

interface Window {
  beamline?: BeamlineTestApi;
}
