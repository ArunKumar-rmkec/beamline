# Beamline

A seated mixed-reality laser-mirror puzzle for the Meta Quest Browser. This repository is slice 1: one board, one mirror, one target. You pinch the mirror and twist it in 15° steps until the beam hits the crystal.

Hands only. Controllers are not used. The board is placed from your head pose (about 50cm in front and tilted toward you). There are no spatial anchors. A **Center** button on the near edge of the board puts it back in front of you. The mirror angle is saved in `localStorage` under `beamline:mirror-rot` on every step.

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

In the emulator, switch to hands if the session starts on controllers, pinch the pale disc around the mirror, and twist. The beam updates when the mirror snaps. At 45° it hits the crystal, which lights up and shows **Lit**. Poke **Center** to place the board in front of the headset again.

`npm run dev` starts IWSDK's dev tools, including the IWER emulator. `npm run dev:down` stops them.

## Build

```bash
npm run build
```

Production assets use Vite `base: '/beamline/'` so they load at [https://arunkumar-rmkec.github.io/beamline/](https://arunkumar-rmkec.github.io/beamline/). The dev server keeps `base: '/'`.

## Deploy

`.github/workflows/deploy.yml` tests, typechecks, and builds on pull requests. A push to `main` also uploads the `dist` folder with GitHub's Pages actions.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Until that is set, the workflow can succeed and still not update the site. This project does not publish a `gh-pages` branch.

## Slice 1 only

Later puzzles (prisms, blockers, more levels, hand mirror, daily puzzle, audio, and the level menu) are not in this build.
