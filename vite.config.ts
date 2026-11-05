/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /beamline/. Dev stays at / so the emulator opens the root.
  base: command === 'build' ? '/beamline/' : '/',
  plugins: [iwsdkDev(), emulateOnlyWithoutNativeXR(), preferIwerHands()],
  server: { host: '0.0.0.0', port: 8081, open: false },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (its own three vs the app's super-three alias). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
}));

/**
 * The dev plugin can inject IWER into a production build, but its activation
 * check is hostname/user-agent only. Gate that startup so a browser with
 * native immersive-ar or immersive-vr keeps its own WebXR runtime.
 */
function emulateOnlyWithoutNativeXR() {
  const marker = 'startIwsdkDevRuntime(';
  return {
    name: 'beamline-iwer-without-native-xr',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('iwer-injection') || !code.includes(marker)) return null;
      if (code.includes('beamlineLacksNativeImmersiveXR')) return null;
      const call = splitCall(code, marker);
      if (call == null) return null;
      const trailingSemicolon = code[call.end] === ';' ? 1 : 0;
      const wrapped = `async function beamlineLacksNativeImmersiveXR() {
  const xr = navigator.xr;
  if (xr == null || typeof xr.isSessionSupported !== 'function') return true;
  const supported = (mode) => {
    try {
      return Promise.resolve(xr.isSessionSupported(mode)).then(
        (value) => value === true,
        () => false,
      );
    } catch {
      return Promise.resolve(false);
    }
  };
  try {
    const [ar, vr] = await Promise.race([
      Promise.all([supported('immersive-ar'), supported('immersive-vr')]),
      new Promise((resolve) => {
        setTimeout(() => resolve([false, false]), 2000);
      }),
    ]);
    return ar !== true && vr !== true;
  } catch {
    return true;
  }
}
if (await beamlineLacksNativeImmersiveXR()) {
  startIwsdkDevRuntime(${call.arg});
}
`;
      return {
        code:
          code.slice(0, call.start) +
          wrapped +
          code.slice(call.end + trailingSemicolon),
        map: null,
      };
    },
  };
}

/**
 * IWER boots in controller mode. Beamline is hands-only, so the emulated
 * device, its reset, and the dev-tools store start on hands.
 */
function preferIwerHands() {
  return {
    name: 'beamline-iwer-hands',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('injection-template')) return null;
      const next = code
        .replaceAll(
          'inputMode: "controller", setInputMode:',
          'inputMode: "hand", setInputMode:',
        )
        .replaceAll(
          'primaryInputMode: "controller", pendingReferenceSpaceReset: false',
          'primaryInputMode: "hand", pendingReferenceSpaceReset: false',
        )
        .replaceAll(
          'this.device.primaryInputMode = "controller", this.device.stereoEnabled = false',
          'this.device.primaryInputMode = "hand", this.device.stereoEnabled = false',
        );
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}

function splitCall(code, marker) {
  const start = code.indexOf(marker);
  if (start < 0) return null;
  let index = start + marker.length;
  let depth = 1;
  let quote = '';
  while (index < code.length && depth > 0) {
    const char = code[index];
    if (quote) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) quote = '';
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      index += 1;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    index += 1;
  }
  if (depth !== 0) return null;
  return { start, end: index, arg: code.slice(start + marker.length, index - 1) };
}
