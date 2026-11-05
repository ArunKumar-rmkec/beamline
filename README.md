# Beamline

A seated mixed-reality laser puzzle for the Meta Quest Browser. Pinch a mirror or a prism and twist it in 15° steps until every crystal is lit.

Hands only. Controllers are not used. The board sits about 50cm in front of you, dropped toward lap height and tilted like a tray table. There are no spatial anchors. **Center** on the near edge puts it back in front of you. **Hand** on that same edge turns the Hand Mirror prototype on. Progress is saved in `localStorage` under the `beamline:` prefix (`beamline:progress` holds the current level and piece angles).

## Requirements

- Node.js 20.19+ or 22.12+ (see `engines` in `package.json`)
- A current desktop Chrome. No headset is required.

## Run

```bash
npm install
npm test
npm run dev
```

Open the URL Vite prints (normally `https://localhost:8081/`). Accept the local certificate if Chrome asks. The page goes straight to IWER's **Enter XR** button. There is no title screen.

In the emulator, switch to hands if the session starts on controllers. Pinch the pale disc on a mirror or prism and twist. The beam updates when the piece snaps. Poke **Center** to place the board again. Poke **Hand** to let an open palm reflect the beam. That bounce snaps to 15° and locks once it lights a target, so you can lower your hand.

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

## Later

Head-gaze highlight, the daily puzzle, one-hand mode, and the level menu are not in this build.
