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

/** Marks the board-edge poke target that opens or closes the level select menu. */
export const LevelsButton = createComponent(
  'LevelsButton',
  {},
  'Poke target that opens or closes the level select menu',
);

/** Marks the board-edge poke target that toggles one-hand mode. */
export const OneHandButton = createComponent(
  'OneHandButton',
  {},
  'Poke target that toggles one-hand mode',
);

/** Marks the poke target on the first-run tutorial panel. */
export const TutorialButton = createComponent(
  'TutorialButton',
  {},
  'Poke target that advances or dismisses the first-run tutorial',
);

/** Marks the skip poke target on the first-run tutorial panel. */
export const TutorialSkipButton = createComponent(
  'TutorialSkipButton',
  {},
  'Poke target that skips the first-run tutorial',
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

/** Marks a level choice poke target in the level menu. */
export const LevelChoiceButton = createComponent(
  'LevelChoiceButton',
  {},
  'Poke target that loads a specific level from the menu',
);

/** Marks the daily puzzle poke target in the level menu. */
export const DailyChoiceButton = createComponent(
  'DailyChoiceButton',
  {},
  'Poke target that loads the daily puzzle from the menu',
);

/** Marks the close button in the level menu. */
export const CloseMenuButton = createComponent(
  'CloseMenuButton',
  {},
  'Poke target that closes the level menu',
);

export default defineComponents([
  RecenterButton,
  HandMirrorButton,
  LevelsButton,
  OneHandButton,
  TutorialButton,
  TutorialSkipButton,
  ResumeButton,
  RestartButton,
  LevelChoiceButton,
  DailyChoiceButton,
  CloseMenuButton,
]);
