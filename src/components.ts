import { createComponent, defineComponents } from '@iwsdk/core';

/** Marks the board-edge poke target that recenters the puzzle. */
export const RecenterButton = createComponent(
  'RecenterButton',
  {},
  'Poke target that places the board back in front of the player',
);

export default defineComponents([RecenterButton]);
