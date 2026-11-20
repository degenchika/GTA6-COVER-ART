# GTA6-COVER-ART

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/degenchika/GTA6-COVER-ART/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/degenchika/GTA6-COVER-ART/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Cover Studio — an offline web app that turns a photo and a caption into cover art in the style of GTA 6's posters. Pick a multi-panel layout (Hero, Duo, Trio, Quad, Strip or Column), drop a photo into each panel, drag to reposition and scroll to zoom the crop, choose a colour grade (Vice Sunset, Neon Nights, Palm Dusk, Mono Noir, Golden Hour or Midnight Drive), set a bold caption with size, position and colour, and export a PNG in post sizes 1080 × 1080, 1080 × 1350 or 1920 × 1080. Switching to a layout with more panels fills its empty panels from the samples, and the preview follows the export size, so what you see is the shape you will get. Keys 1–4 pick a panel and double-click resets its crop. It runs entirely in a desktop browser from its own static files: photos never leave the machine. All lettering is our own — Bebas Neue and Archivo Black under the SIL Open Font License, bundled in `app/fonts/` (re-downloaded from the google/fonts repository) — with no Rockstar Games logo, artwork or fonts anywhere.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Serve the app locally with `node serve.ts`, then open http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cdzr1hpv&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
