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

export default defineComponents([RecenterButton, HandMirrorButton]);
