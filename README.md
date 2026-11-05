# Beamline

A seated mixed-reality laser puzzle for the Meta Quest Browser. Pinch a mirror or a prism and twist it in 15° steps until every crystal is lit.

Hands only. Controllers are not used. The emulator starts in hands mode. The board sits centered, about 40cm in front of your eyes and 15cm below them, tilted like a tray table so the whole board, including **Center** and **Hand**, stays in view. There are no spatial anchors. **Center** on the near edge puts it back in front of you. **Hand** on that same edge turns the Hand Mirror prototype on. Progress is saved in `localStorage` under the `beamline:` prefix. `beamline:progress` is `{ v: 1, level, angles }` with a 1-based level, written on every level change and rotation.

## Requirements

- Node.js 20.19+ or 22.12+ (see `engines` in `package.json`)
- A current desktop Chrome. No headset is required.

## Run

```bash
npm install
npm test
npm run dev
```

Open the URL Vite prints (normally `https://localhost:8081/`). Accept the local certificate if Chrome asks. The page shows one **Enter XR** button under the title. There is no second button.

The emulator opens in hands mode. Pinch the pale disc on a mirror or prism and twist. A grabbed piece shows a yellow ring. The beam updates when the piece snaps. Poke **Center** to place the board again. Poke **Hand** to let an open palm reflect the beam. That bounce snaps to 15° and locks once it lights a target, so you can lower your hand.

A mirror reflects. A prism splits the beam in two: straight through, and a mirror bounce. A dark block stops the beam. When every crystal is lit, the board glows, a short chord plays, and the next level starts. The last level stays lit.

Taking the headset off (session `hidden` or `visible-blurred`) pauses the puzzle and the audio and writes progress. Coming back continues. If the XR session ends, one tap on **Enter XR** resumes the same level.

`npm run dev` starts IWSDK's dev tools, including the IWER emulator. `npm run dev:down` stops them.

## Build

```bash
npm run build
```

Production assets use Vite `base: '/beamline/'` so they load at [https://arunkumar-rmkec.github.io/beamline/](https://arunkumar-rmkec.github.io/beamline/). The dev server keeps `base: '/'`.

## Deploy

`.github/workflows/deploy.yml` tests, typechecks, and builds on pull requests. A push to `main` also uploads the `dist` folder with GitHub's Pages actions.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Until that is set, the workflow can succeed and still not update the site. This project does not publish a `gh-pages` branch.

## Test hook

Add `?test=1` to the page URL. The build then sets `window.beamline`. Without that query the object is absent.

```js
beamline.state()                 // level (1–6), paused, won, lit[], grabbed, pieces[]
beamline.grab('mirror-2-2')      // or grab('0') for the first movable piece
beamline.rotate(1)               // one 15° step on the grabbed piece
beamline.rotate('mirror-2-2', 3) // 3 steps × 15° on that piece
beamline.release()
beamline.level(4)                // levels are 1–6, loaded at their starting angles
beamline.pause()
beamline.resume()
```

A piece id is `type-column-row`, for example `prism-2-2`. `state().pose` is head-relative: hands and movable pieces, in meters.

Keys in this mode only: **Q** and **E** turn the selected piece one step, **Tab** selects the next piece (Shift+Tab the previous), **N** loads the next level. A win stays on the current level until **N** or `level()`.

## Later

Head-gaze highlight, the daily puzzle, one-hand mode, and the level menu are not in this build.
