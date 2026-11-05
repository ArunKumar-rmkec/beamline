import { Color, Quaternion, Vector3, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BoardSystem } from './board-system.js';

const container = document.getElementById('scene-container');
if (!(container instanceof HTMLDivElement)) {
  throw new Error('Missing #scene-container');
}

// Production builds inject IWER only when this browser has no native
// immersive-ar or immersive-vr runtime. The page still offers a visible
// Enter XR control; if that cannot start a session, the board stays on screen.
hideIwerOfferChrome();

World.create(container, projectOptions).then((world) => {
  world.registerSystem(BoardSystem, { priority: 1 });
  void installDesktopXRChrome(world);
});

async function installDesktopXRChrome(world: World): Promise<void> {
  const button = ensureEnterButton();
  const onSessionStart = () => {
    button.hidden = true;
    hideUnavailable();
  };
  const onSessionEnd = () => {
    void syncChrome(world, button);
  };
  world.renderer.xr.addEventListener('sessionstart', onSessionStart);
  world.renderer.xr.addEventListener('sessionend', onSessionEnd);
  button.addEventListener('click', () => {
    const offered = iwerEnterButton();
    if (offered) {
      offered.click();
      window.setTimeout(() => {
        if (!world.renderer.xr.isPresenting) showUnavailable(world);
      }, 700);
      return;
    }
    world.launchXR();
  });
  await syncChrome(world, button);
}

async function syncChrome(
  world: World,
  button: HTMLButtonElement,
): Promise<void> {
  if (world.renderer.xr.isPresenting) {
    button.hidden = true;
    hideUnavailable();
    return;
  }
  if (await immersiveSupported()) {
    hideUnavailable();
    button.hidden = false;
    return;
  }
  button.hidden = true;
  showUnavailable(world);
}

function ensureEnterButton(): HTMLButtonElement {
  const existing = document.getElementById('enter-xr');
  if (existing instanceof HTMLButtonElement) return existing;
  const button = document.createElement('button');
  button.id = 'enter-xr';
  button.type = 'button';
  button.textContent = 'Enter XR';
  button.hidden = true;
  document.body.appendChild(button);
  return button;
}

let unavailableShown = false;

function showUnavailable(world: World): void {
  const button = document.getElementById('enter-xr');
  if (button instanceof HTMLButtonElement) button.hidden = true;
  let message = document.getElementById('webxr-unavailable');
  if (!(message instanceof HTMLParagraphElement)) {
    message = document.createElement('p');
    message.id = 'webxr-unavailable';
    message.setAttribute('role', 'status');
    message.textContent = 'WebXR not available';
    document.body.appendChild(message);
  }
  message.hidden = false;
  if (unavailableShown) return;
  unavailableShown = true;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => frameBoard(world));
  });
}

function hideUnavailable(): void {
  const message = document.getElementById('webxr-unavailable');
  if (message instanceof HTMLElement) message.hidden = true;
}

function frameBoard(world: World): void {
  world.scene.background = new Color(0x243044);
  const board = world.scene.getObjectByName('board');
  if (!board) return;
  board.updateWorldMatrix(true, true);
  const center = new Vector3();
  const quaternion = new Quaternion();
  board.getWorldPosition(center);
  board.getWorldQuaternion(quaternion);
  const eye = center
    .clone()
    .addScaledVector(new Vector3(0, 0, 1).applyQuaternion(quaternion), 0.72);
  if (world.camera.parent) {
    world.camera.parent.updateWorldMatrix(true, false);
    world.camera.parent.worldToLocal(eye);
  }
  world.camera.position.copy(eye);
  world.camera.lookAt(center);
  world.camera.updateProjectionMatrix();
}

async function immersiveSupported(): Promise<boolean> {
  const xr = navigator.xr;
  if (xr == null || typeof xr.isSessionSupported !== 'function') return false;
  try {
    const [ar, vr] = await Promise.all([
      xr.isSessionSupported('immersive-ar'),
      xr.isSessionSupported('immersive-vr'),
    ]);
    return ar === true || vr === true;
  } catch {
    return false;
  }
}

function iwerEnterButton(): HTMLButtonElement | null {
  for (const host of document.body.children) {
    if (!(host instanceof HTMLElement) || host.shadowRoot == null) continue;
    for (const button of host.shadowRoot.querySelectorAll('button')) {
      if (button.textContent?.includes('Enter XR')) return button;
    }
  }
  return null;
}

function hideIwerOfferChrome(): void {
  const button = iwerEnterButton();
  const root = button?.getRootNode();
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    root.host.hidden = true;
  }
}
