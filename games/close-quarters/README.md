# CorpoWars: Close Quarters — standalone single-player bonus

**Four agents. Eight compact sectors. Zero network authority.**

This is a deliberately separate bonus game for the US$5 CorpoWars3d Payhip package.
The main squad FPS, its campaign/save state, the DOS demake, the book, and the
music handoff are not changed by this PR.

## Game

- **AFTER//ZERO** authored 24×24 sector geometry and exact enemy coordinates:
  Dead Channel, Freight Ghost, Last Train, Memory Leak, Hot Metal, False Eden,
  Hostile Takeover, Zero Hour. The eight maps come from
  `QSOLKCB/AFTER-ZERO/public/src/maps.js`, blob
  `6023c6bdaa428b99dadc9ffb22cee9bbc358cec7` (verbatim Apache-2.0 source).
- **CorpoWars3d / CorpoWars** pure combat and squad simulation: switch among
  VEX / NULL / ECHO / IRON, autonomous teammates, cover and LOS, campaign
  weapons, reloads, EMP, panic, heal and tactical orders.
- **CorpoWars3d** neon procedural buildings and instanced/retained WebGL
  renderer, with Canvas 2D fallback. Every donor solid tile is exactly covered
  by a merged collision/building rectangle; tile value 4 stays traversable.
- **VANILLAJS / OPT** rules reused through the existing exact simulation and
  renderer: fixed 60 Hz clock, bounded catch-up, compact tile/rectangle
  geometry, retained draw buffers and no unsafe numerical shortcuts.
- **Chrono** — hold B for a bounded slow-time tactical window. Simulated time
  scales to 0.42 while reserve drains; the input loop remains responsive.
- All AFTER//ZERO authored relays are required. Sector 1 has one relay and one
  extra data-cache objective derived from an existing pickup. At 3+ relays the
  second objective advances through the remaining original coordinates.

The bonus uses an independent campaign progression key
`corpowars-close-quarters-v1`; unlock the next sector by completing the
previous. It neither loads nor changes the main CorpoWars3d save/economy.
No payments, online services, lobbies, trackers, account, or runtime packages.

## Launch

From the repository root:

```sh
uv run --no-project python -m http.server 8000
```

Open `http://localhost:8000/games/close-quarters/` in a modern desktop
browser. For the standalone archive, unzip, serve the extracted folder the same
way and open `/CORPOWARS-CLOSE-QUARTERS/games/close-quarters/`.
`file://` is not supported because browsers restrict ES module imports.

| Input | Action |
| --- | --- |
| WASD / mouse / arrow keys | Move / aim (arrows work if mouse capture unavailable) |
| LMB or Space / RMB / R | Fire / aim-down-sights / reload |
| Shift / Ctrl / J | Sprint / crouch / jump |
| 1–4 / Q | Pilot agent / switch agent |
| Tab or M | Live tactical map; click floor to move, visible enemy to focus fire |
| F / G / H / V | Follow / advance / hold / hold fire |
| X / C / Z | EMP / heal / panic burst |
| B (hold) | Chrono reserve |
| P or Escape | Pause and clear all input |

Gamepad and touch are **not implemented in this independent bonus**; the
main CorpoWars3d game retains its supported controller and touch modes.
There is no multiplayer mode and there will be no backend deployment.

## Verify and package, without publishing

```sh
node --test games/close-quarters/tests/sector.test.js
node scripts/check.js
node scripts/build.js
uv run --no-project python games/close-quarters/tools/package.py --output /tmp/CORPOWARS-CLOSE-QUARTERS.zip
uv run --no-project python games/close-quarters/tools/package.py --verify /tmp/CORPOWARS-CLOSE-QUARTERS.zip
```

The builder computes the **static ES module import closure** from the bonus
entrypoint, copies only the requisite `src/` dependencies, local HTML/CSS,
Apache-2.0/NOTICE and this guide, and creates a canonical ZIP with fixed
timestamps and a SHA-256 file manifest. Two builds on the same interpreter
must be byte-identical; test archived bytes against checked-out source bytes.
Only the owner decides what to distribute. The workflow uploads a **preview
artifact**, not a release or storefront product.

### Premium package integration

PR #4 introduces `scripts/package_payhip.py` and owns the premium package
build. That parallel PR is intentionally untouched here. Once both PRs are
merged and the narrative/music assets have been supplied, incorporate the
`games/close-quarters/` directory plus its resolved `src/` dependencies
as a named **Close Quarters** bonus within the release pack. For a standalone
bonus, use the ZIP builder above; if nesting its ZIP inside the Payhip
bundle, provide a clear `START_HERE` entry. Do not package a stale copy of
`src/` or drop the parent paths required by `../../../src` imports.

This stage does **not** change the public Pages deployment, invent the book,
create the music track, set Payhip storefront settings, or automatically
release a package. The US$5 price is a product-level decision, not a runtime
feature or a hidden fee.

## Determinism and evidence boundaries

The unit suite checks donor schema/reachability, exact rectangle coverage,
spawn safety, authored enemy rosters, agent invariants, replay equivalence,
chrono reserve and bounded progression. CI also validates the existing FPS,
build and WebGL browser smoke, launches the bonus in Chromium and checks there
are no outbound requests. No framerate/speedup number is asserted without
paired target-machine measurements; smaller maps are a design choice, not a
claimed hardware benchmark. OPT-BUDGET-001-style gates use **correctness and
repeatability** first; independent performance certification is a separate task.

See [NOTICE](NOTICE) for precise source provenance.
