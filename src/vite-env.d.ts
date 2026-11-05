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
    pieces: BeamlinePieceState[];
    pose: {
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
}

interface Window {
  beamline?: BeamlineTestApi;
}
