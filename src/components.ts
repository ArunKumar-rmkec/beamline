import { createComponent, defineComponents } from '@iwsdk/core';

/** Marks the board-edge poke target that recenters the puzzle. */
export const RecenterButton = createComponent(
  'RecenterButton',
  {},
  'Poke target that places the board back in front of the player',
);

/** Marks the board-edge poke target that toggles the Hand Mirror prototype. */
export const HandMirrorButton = createComponent(
  'HandMirrorButton',
  {},
  'Poke target that turns the palm reflector on or off',
);

/** Marks the poke target on the first-run tutorial panel. */
export const TutorialButton = createComponent(
  'TutorialButton',
  {},
  'Poke target that advances or dismisses the first-run tutorial',
);

/** Marks the poke target on the paused panel. */
export const ResumeButton = createComponent(
  'ResumeButton',
  {},
  'Poke target that resumes from the paused panel',
);

/** Marks the poke target on the end screen. */
export const RestartButton = createComponent(
  'RestartButton',
  {},
  'Poke target that restarts the game from the end screen',
);

export default defineComponents([
  RecenterButton,
  HandMirrorButton,
  TutorialButton,
  ResumeButton,
  RestartButton,
]);
