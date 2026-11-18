# Chooli 3D homepage prototype — project memory

Hand-over notes for any Claude (or person) picking up this work. Written 17 Nov 2026 from the
working sessions since 12 Nov 2026. Where this file and the code disagree, **the code wins**:
other sessions and teammates also commit to this repo, so re-check `git log` and
`src/lib/animation/config.ts` before acting on anything here.

---

## 1. What the project is

A premium, scroll-controlled cinematic 3D homepage for **Chooli Digital Marketing**
(live site: https://choolidigitalmarketing.com). The mascot is **Gus**, a friendly Bigfoot.

Page flow (top to bottom, `src/app/page.tsx`):

1. **IntroSequence**: a pinned 3D scene driven by scroll.
   - Opens on a wide cinematic mountain, and the big **CHOOLI** word rises behind the peak.
   - The header slides in, then Gus appears in the cloud bank and walks toward the camera,
     leaving footprints as he goes.
   - **"It's me, Gus."** screen, with a glance card on the right showing "4 core
     specialties", "10% of monthly retainers given to nonprofits" and "Rooted in Southern
     Indiana. Not limited by it."
   - Camera orbits to a three-quarter view for **"Meet Chooli. A different kind of digital
     marketing agency."**, with a short paragraph and the four service cards.
2. **NextSection** (`id="after-intro"`): white "What we actually do" services. It slides up
   over the pinned scene. Four brand-colour cards sit on a 3D curve and straighten on hover.
3. **CaseStudies**: "Real results. No magic." A custom drag/swipe slider (no library).
   Content is **placeholder** ("Sample story" chip). There are no real metrics yet.
4. **HowWeWork**: "A Simple, No-Nonsense Approach", a four-step scroll timeline.
   - As you scroll, an orange line fills down the centre with a glowing dot riding its tip.
   - When the line reaches a step, the node fills orange with a white core, the icon tile
     fills bottom-up with a blue gradient and the row's card appears.
   - The background image comes from Harwinder's PR.
5. **MountainWordmark**: "CHOOLI DIGITAL MARKETING" wordmark filled with the mountain image,
   with a mouse parallax. Added by a teammate.
6. **Community**: "Business That Gives Back" (the 10% giving programme), with a CTA to
   `LINKS.givingBack`. Uses representative Unsplash photos listed in
   `Community.images.json`. Added by a teammate.

Global pieces:
- **FloatingHeader**:
  - A compact logo tile on the left. It only appears after the 3D intro, once
    `#after-intro` reaches the top.
  - A **MENU** button. It now opens a mega menu mirroring the live site, with submenu icons.
  - A morning/night switch, currently **hidden** (see §6).
  - The single primary CTA, **"Talk About Your Business"**.
- **SmoothScroll** (Lenis).

---

## 2. Stack and where things live

- **Framework:** Next.js 16 (App Router, Turbopack), React 19 and TypeScript.
  - `AGENTS.md` warns that this Next.js has breaking changes from older versions. Read
    `node_modules/next/dist/docs/` before relying on older Next.js knowledge.
- **3D:** three 0.187, @react-three/fiber 9, @react-three/drei 10, three-mesh-bvh.
- **Animation:** GSAP ScrollTrigger and Lenis 1.3.27, pinned exactly (installed with
  `--save-exact`).
- **Styling:** Tailwind CSS v4. Tokens are in `src/app/globals.css` under `@theme`, and
  Community uses a CSS module.
- **3D asset tooling:** @gltf-transform/*, meshoptimizer, sharp, and Blender's Python module
  `bpy`.
- **Node:** the user-local Node is at `~/.local/node/bin`. Prefix commands with
  `PATH=$HOME/.local/node/bin:$PATH`.

Key files:

| Path | What |
| --- | --- |
| `src/lib/animation/config.ts` | **Single source of truth.** Holds BRAND, LINKS, MOUNTAIN, GROUND, RANGE, CHARACTER, ROUTE, LANDSCAPE (footprints), SMOOTH_SCROLL, TIMELINE, SHOTS (camera), CLOUDS, BRAND_WORD, INTRO, THEMES, THEME_SWITCH, CINEMATIC (mist, cloudBank), CASES and COPY (all intro text). Tune here first. |
| `src/components/sections/IntroSequence.tsx` | The pinned section. One ScrollTrigger feeds the `progress` store, which goes through `mapScroll()` (piecewise, `TIMELINE.scrollMap`). It also pauses WebGL rendering when the scene is covered. |
| `src/components/3d/*` | The R3F scene: Experience (Canvas, DPR cap), IntroScene, Mountain, Atmosphere (sky shader and clouds), Mist, PostFX (bloom, grade, vignette), BrandWord, Character, Landscape (footprints) and groundShader. |
| `src/lib/animation/theme.ts` | Morning and night palettes as live THREE objects that cross-fade. |
| `src/lib/animation/introClock.ts` | The opening sequence clock (word rise, then header, then copy). |
| `public/models/` | The web-ready GLBs the site loads. |
| `scripts/` | Asset build scripts (see §5). |
| `README.md` | Run and rebuild instructions. Partly out of date on characters. |

Scroll pipeline facts:
- Lenis is driven by the GSAP ticker: `lenis.raf(time * 1000)`, with
  `lenis.on('scroll', ScrollTrigger.update)` and `lagSmoothing(0)`.
  - Settings are in `SMOOTH_SCROLL`: lerp 0.06, wheelMultiplier 0.8.
  - A MutationObserver stops Lenis while the menu sets `html { overflow: hidden }`.
- The ScrollTrigger uses `scrub: true`. Lenis already smooths the scroll, so a numeric
  scrub would feel rubbery.
- The intro is `TIMELINE.scrollLengthVh` tall, currently 550vh. Its scrubbed range is that
  minus 2 viewport heights.
- **Performance fix (important):**
  - The 3D canvas stops rendering whenever `#after-intro` has reached the top of the
    viewport, so the opaque sections cover it completely.
  - Without this, the scene kept rendering under the white sections, and scrolling there
    dropped to about 15–25 fps. That was the "jerk in the white sections" the user
    reported.
  - The check runs on scroll in a rAF, in `IntroSequence.tsx`.

---

## 3. The user and their preferences

- The user is Sahil (GitHub account `testdeviser`). Teammate **Harwinder** works on the
  `Harwinder` branch.
- **Desktop only.** Don't check or tweak responsive or phone layouts unless asked again.
  This is saved as a Claude memory note too: "desktop-only-testing".
- They test on a **MacBook touchpad**, so scroll smoothness matters a lot.
- They like premium, cinematic, "engaging to the user" visuals with glass effects in the
  header.
- They give direction through screenshots, reference videos (screen recordings in
  `~/Library/CloudStorage/Dropbox/`) and short messages. Typos are common, so read for
  intent.
- Ask before big or irreversible choices. Do small iterations in place and show the result
  in the browser pane.
- They often ask "just let me know the suggestions first", so when they ask for options,
  give options before building.
- Before replacing a character or model, **take a backup first**. They asked for this
  explicitly.
- **Brand rules** come from `Chooli_Brand_Board_and_Standards_v1.pdf`, which the user said
  to use "for branding only":
  - Tailwind tokens: navy `#17376A`, orange `#F5862A`, ridge `#1F559B`, sky `#60A0CC`,
    deep `#10366D`, ink `#243349`, paper `#F7F9FC`.
  - `config.ts` also has a `BRAND` const with a newer palette: navy `#082D58`, orange
    `#FF7100`, light blue `#B6E3F6`. Check which one a section uses before changing colours.
  - **Never invent metrics, testimonials or client names.** Case studies stay clearly
    marked as samples.
  - The CTA label is **"Talk About Your Business"**.
- When the user says "model", they usually mean the **3D character or model**, not the AI
  model. That was misread once; "revert to the previous model" meant Gus.

### File-access restrictions (still in force, from the user, verbatim in spirit)

The user strictly limited what may be inspected on their machine:
- Work only inside this project folder (`chooli-3d-prototype`).
- Use only the files they explicitly provide or name.
- Never scan, list or recursively search their other folders, parent directories or
  unrelated files.
- Never read hidden or config files outside the project.
- Never rename, move, overwrite or delete their original files.
- **Ask before touching any other existing file.**

Files they have provided or authorised so far:
- `assets/`: Sand_mount.fbx, Walking.fbx, Main Character.fbx, mountain-new(.fbx),
  mountain-new-latest.{fbx,glb}, Arm-Stretching.{fbx,glb}, Walking-Left-Turn.fbx,
  Gorilla-Walking-updated.{fbx,glb}, Gus-v1.{fbx,glb}, and the `assets/gus-new/` set
  (Meshy export).
- `~/Downloads/mountain-new.fbx` and `~/Downloads/Chooli_Brand_Board_and_Standards_v1.pdf`.
- Screen recordings they attached, for example
  `~/Library/CloudStorage/Dropbox/Screen Recording 2026-11-13 at 5.12.04 PM.mov` and
  `… 5.18.19 PM.mov`.
  - macOS puts a narrow no-break space (U+202F) before "PM" in these names. Open them via
    a glob on the exact prefix, not by typing the name.
- Images pasted into the chat.

---

## 4. Decisions made (and why)

- **Pinning:** sticky positioning plus one ScrollTrigger. There's no scroll hijacking, and
  all copy is real HTML.
- **Smooth scrolling:** Lenis was added because the native touchpad scroll felt jerky.
  Users with reduced motion keep 1:1 scrolling.
- **Themes:**
  - Morning and night scenes were both built.
  - The switch is now **hidden** (`THEME_SWITCH = false`, an uncommitted local change at
    the time of writing).
  - While hidden, the scene always opens in morning and ignores any saved night choice.
- **Gus fades in out of the mist and cloud bank.** He's not visible in the opening shot,
  and footprints only form as he walks.
- **The walk from the mountain to Gus was shortened twice** at the user's request ("make
  it even shorter"). The pace is tuned in `TIMELINE.scrollMap`.
- **Header:**
  - Compact, with glass styling.
  - MENU sits on the left.
  - The CTA on the right is orange glass with navy text.
  - The logo appears only after the intro, because the big mountain CHOOLI word is the
    brand until then.
- **Case-study slider:** custom, not Slick. It supports drag, swipe, arrows and keyboard.
  The user chose to "keep samples for now".
- **Character history.** All earlier versions are backed up in `backups/`.
  1. Mixamo stand-in: `public/models/character.glb`.
  2. Gus from the reference images: `gus.glb`, built by `scripts/gus/`.
  3. Walking-Left-Turn character, then a gorilla version, then reverted, because the user
     didn't like the gorilla.
  4. **Gus-v1**, built 13 Nov:
     - The source was a static T-pose sculpt with 5.4M triangles.
     - Rigged by `scripts/gusv1/` and decimated to 70k triangles.
     - Distance-based skin weights were used, because Blender's bone-heat weighting
       fails on the fur.
     - Clips: Idle, Walk, Stretch. Output: `public/models/gus-character.glb`.
  5. **Current: `gus-new.glb`** (17 Nov, by another session or commit):
     - Built from a Meshy export with a SmartRig skeleton by
       `scripts/gus-new/convert.mjs`.
     - Clips: Idle, Walk and **CrossArms**. He folds his arms at "It's me, Gus." and
       holds them through "Meet Chooli".
     - Stride 1.4408, height 1.7.
     - `CHARACTER.look` brightens the fur.
- **GitHub contents:** only files the site uses are tracked. Source files in `assets/`
  stay local because several are over GitHub's 100 MB limit. The user chose not to set up
  Git LFS "for now".
- **Staging link:** not set up.
  - Vercel CLI sign-in was tried twice, and each device-code sign-in timed out.
  - The user was offered a Cloudflare tunnel or Netlify Drop, and said "not now".
  - Now that the code is on GitHub, the easiest route is to import the repo on
    vercel.com or netlify.com through the web. The site then redeploys on every push.

---

## 5. Workflows

### Run locally

```bash
cd /Users/td-mac2/Documents/Sahil-Files/Chooli-2.0/chooli-3d-prototype
PATH=$HOME/.local/node/bin:$PATH npm run build
PATH=$HOME/.local/node/bin:$PATH npx next start --port 3210   # run in background
```
- The user views the site at **http://localhost:3210**, a production build, because the
  dev server is less smooth.
- After editing files, rebuild and restart the server; edits don't hot-reload in this mode.
- `npm run dev` (port 3000) also works for quick iteration.
- Typecheck with `npx tsc --noEmit`.

### Verifying in the Claude desktop app's browser pane

- Open the page with `preview_start` (url `http://localhost:3210`).
- **Show the preview pane before screenshots.** A hidden pane makes screenshots time out.
- Set a desktop viewport, for example `resize_window` 1600×900, and reset it to "desktop"
  when done.
- Drive scrolling with JS: `window.scrollTo(...)`, then wait about 2–4 s, because Lenis
  eases the scroll.
- To reach a point in the intro, scroll to
  `(intro.offsetHeight - innerHeight*2) * fraction`.
- To check WebGL work, hook `gl.drawElements` on the canvas context and count calls per
  second.
- To analyse a reference video, build an ffmpeg contact sheet with
  `ffmpeg -i video -vf "fps=2.5,scale=640:-1,tile=4x4" -frames:v 1 sheet.jpg`.
  ffmpeg is at `~/.local/bin/ffmpeg`.

### Git and GitHub

- **Repo:** https://github.com/testdeviser/Chooli2.0. This folder is the clone, and the
  remote is `origin`.
- **Branches:**
  - `main`: the production line. PRs merge here.
  - `Sahil`: the user's working branch. The local folder is on it.
  - `Harwinder`: the teammate's branch.
- **Flow:**
  1. Work on `Sahil`.
  2. Push it.
  3. Open a PR into `main` on GitHub.
  4. Before starting new work, run `git pull origin main`.
- Commit messages end with a `Co-Authored-By: Claude …` line, as the session's attribution
  reminder gives it.
- `.gitignore` keeps local-only:
  - `assets/`, `backups/`, `references/` and `.claude/`.
  - The old models: `character.glb`, `gus.glb` and `*.meta.json`.
  - The old build scripts: `build_character.py`, `build_gorilla_character.py`,
    `build_gus_character.py`, `convert_mountain.py` and `scripts/gus/`.
  - `AGENTS.md`.
- Push and fetch work through the macOS keychain credential helper. Use
  `GIT_TERMINAL_PROMPT=0` so a missing credential fails fast instead of hanging.
- **Model work needs this Mac's folder.** Rebuilding 3D models requires `assets/`, which
  only exists here. Code and section changes can be done from any clone.

### Rebuilding 3D assets

- **Blender Python:** create a venv with uv and **bpy 4.4.0**. 4.5.0 has no macOS arm64
  wheel. Also install `numpy<2`.
  ```bash
  UV="/Users/td-mac2/Library/Application Support/Claude/uv-runtime/uv-0.9.7-darwin-arm64/uv"
  "$UV" venv --python 3.11 <scratch>/bpyenv
  VIRTUAL_ENV=<scratch>/bpyenv "$UV" pip install "bpy==4.4.0" "numpy<2"
  ```
  Run scripts with `<scratch>/bpyenv/bin/python -I script.py …`.
- **Blender MCP add-on:** port 9876 was never reachable, so everything was done headless
  with bpy.
- **Mountain:**
  1. `scripts/convert_mountain_glb.py` turns `assets/mountain-new-latest.glb` into
     `.cache/mountain*.raw.glb`.
  2. `npm run assets:optimize` (`scripts/optimize-glb.mjs`, meshopt) writes
     `public/models/mountain.glb` and `mountain-lite.glb`.
- **Current Gus:** `node scripts/gus-new/convert.mjs` reads `assets/gus-new/*` and writes
  `public/models/gus-new.glb`.
- **Gus-v1 (previous):**
  1. `scripts/gusv1/prep.py assets/Gus-v1.glb .cache/gusv1` imports, decimates, scales and
     profiles the sculpt.
  2. `scripts/gusv1/rig.py assets .cache/gusv1 <out>` fits the Mixamo skeleton, sets
     weights, attaches the Idle/Walk/Stretch clips and exports.
- **Swapping the character:**
  1. Back up the current GLB, its meta file and the `CHARACTER` block from `config.ts` into
     `backups/<name>-<date>/` with a README.
  2. Update `CHARACTER.url`, `clips`, `stride` (the measured metres per walk cycle; it stops
     foot sliding) and `height`.
- **Python edits:** use `/usr/bin/python3 -I` for quick file edits.

### Skills, tools and memory

- No custom skills were made for this project. The work used the built-in tools: the
  browser pane, the Artifact tool (not used for the site itself) and Bash.
- Claude's per-project memory folder
  (`~/.claude/projects/-Users-td-mac2-Documents-Sahil-Files-Chooli-2-0/memory/`) holds one
  note, "desktop-only-testing".

---

## 6. Current status (17 Nov 2026)

- **Branch `Sahil`:** at `677cfe5` (the merge of PR #5), 3 commits ahead of `origin/Sahil`.
  - It matches `origin/main`.
  - Local `main` is stale (behind 8); run `git switch main && git pull` if needed.
- **Uncommitted local changes:** the hidden theme switch.
  - `THEME_SWITCH = false` in `config.ts`.
  - The check in `FloatingHeader.tsx`, and the initial theme ignoring saved night choices
    in `theme.ts`.
  - These came from another session and aren't committed yet.
- PRs #1–#5 are merged into `main`, combining work from both Sahil and Harwinder.
- **Localhost:** port 3210 was started earlier. It may no longer be running; restart it as
  in §5.
- **This file:** `PROJECT_MEMORY.md` is untracked. Commit it if you want it on GitHub, or
  add it to `.gitignore` to keep it local.

## 7. Open items / next steps

1. **Commit the hidden theme switch** (or discard it) and push `Sahil`, then open a PR into
   `main`.
2. **Staging link.** Import the GitHub repo on Vercel or Netlify through the web (the user
   signs in). The user has deferred this.
3. **Case studies:** waiting for real stories, photos, logos and approved numbers from the
   user. Until then, keep the "Sample story" chips.
4. **"Know more" service links:** waiting for the user's service page URLs. Most cards point
   to `LINKS.site` for now, and SEO points to `LINKS.seo`.
5. **Community photos** are representative Unsplash images. Replace them with real ones when
   supplied.
6. **Optional, if the user asks:** upload `assets/` with Git LFS, which needs `git-lfs`
   installed. The user said "leave it for now".
7. Keep **desktop-only** until the user says otherwise.
