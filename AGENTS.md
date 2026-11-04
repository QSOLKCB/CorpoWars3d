# CorpoWars3d engineering rules

- Keep the Apache-2.0 license, donor commit provenance and NOTICE intact.
- Runtime is native HTML/CSS/ES modules, raw WebGL/Canvas 2D and synthesized Web
  Audio. Do not add a game engine, CDN, remote assets or runtime packages.
- Keep simulation and FPS rules independent of DOM, graphics and ambient clocks.
  Preserve squad actor identity/resources across perspective switches and the
  original autonomous behavior for every unpiloted actor.
- Camera aim, collision, map footprints and shot cover must agree. Cover wins
  equal ray distances; friendly actors stop direct shots without taking damage.
- Preserve fixed-step simulation, bounded catch-up and cancellation of every
  held input on pause/blur/unlock. Restart must not add listeners or loops.
- Use `uv run` / `uvx` for Python tools. Existing Node is development tooling only;
  there is no npm install/build dependency. Keep deploy artifacts allowlisted.
- Run `node --test tests/*.test.js`, `node scripts/check.js` and
  `node scripts/build.js`. Browser changes also need the CI packaged WebGL smoke
  test. Distinguish executed checks, CI evidence and unavailable device coverage.
- Bump the service-worker version when runtime assets change. All URLs must
  remain relative and offline caches restricted to this registration's scope.
- Do not claim speedups without bounded comparable measurements. Keep native
  arithmetic authoritative unless a defined accuracy budget and target evidence
  justify an approximation. Report source hashes for local benchmark evidence.
- Submit implementation via a PR. Do not merge, release, retag or publish as part
  of implementation unless the owner authorizes those actions.
