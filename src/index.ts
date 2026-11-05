import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BoardSystem } from './board-system.js';

const container = document.getElementById('scene-container');
if (!(container instanceof HTMLDivElement)) {
  throw new Error('Missing #scene-container');
}

// The project manifest offers immersive-ar on load. IWER draws the Enter XR
// button for that offer, and offers it again after the session ends.
World.create(container, projectOptions).then((world) => {
  world.registerSystem(BoardSystem, { priority: 1 });
});
