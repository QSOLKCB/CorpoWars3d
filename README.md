# CorpoWars3d

**Four bodies. One conscience. Corporate policy is about to change.**

A single-player tactical squad FPS by QSOL-IMC / Trent Slade. Pilot any of
CorpoWars' four agents from first person, then step out to a live tactical map
and command the whole squad. Unpiloted agents use the original CorpoWars AI:
they follow routes, acquire visible targets, fire, reload and operate objectives.

Native HTML, CSS and JavaScript. Raw WebGL, procedural geometry, local synth
audio and local saves. No engine, CDN, remote font, runtime packages or accounts.

## Play locally

```sh
uv run --no-project python -m http.server 8000
```

Open `http://localhost:8000/` in a desktop browser. Modules need HTTP rather
than a `file:` URL. WebGL 2 is preferred; WebGL 1 instancing and expanded-buffer
paths are included. Devices without WebGL automatically use a lower-detail
software 3D renderer. An optional service worker supports offline reload after
the first successful visit. Audio and browser storage fail gracefully.

## The squad

| Agent | Role | Original base HP | Base speed |
| --- | --- | ---: | ---: |
| VEX | Point | 120 | 2.6 tiles/s |
| NULL | Breach | 100 | 2.8 tiles/s |
| ECHO | Recon | 90 | 3.0 tiles/s |
| IRON | Support | 140 | 2.4 tiles/s |

One tile is 2.5 metres in the 3D presentation. Switching agents preserves their
health, ammunition, reload timers, orientation and outstanding route. Taking
the movement controls overrides that agent's route. Switching away hands them
back to AI; the rest of the squad keeps its own orders. Downed agents cannot be
piloted. If the active agent falls, control transfers to the next survivor.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| LMB / RMB | Fire / aim down sights |
| 1–4 / Q | Switch perspective / cycle living agents |
| Tab / M | Live tactical map; all four agents run on AI |
| Map click / right click visible enemy | Formation move / focus fire |
| Tactical agent card / Shift-click | Select one recipient / adjust selection |
| F / G / H | Follow active agent / move at aim / hold position |
| V | Toggle autonomous squad fire discipline |
| X / C / Z | EMP / selected squad medical patch / panic system |
| E / B | Escort released witness / cycle selected AUG conversions |
| R / Shift / Ctrl / J | Reload / sprint / crouch / jump |
| P / Esc | Pause; orders can be planned on the paused tactical map |
| Arrows / Space | Keyboard aim / fire; keyboard mode disables pointer lock |

The map is **live**. Press P to pause for planning. To pilot a selected agent
from the map, press 1–4 or double-click their card. Move orders include the
piloted agent's saved route, but direct input remains in charge until you leave
their view. Follow applies to selected teammates. Hold-fire governs AI triggers;
the operator can still fire manually.

Terminals operate automatically when a living agent is stationary nearby.
Complete the relay, then the second objective, then bring **every surviving
agent** into extraction. Witness Protection also requires the courier alive at
extraction: press E after release to keep selected agents escorting them.

## Contracts and headquarters

The six original contracts unlock in order: Hostile Takeover, Ghost Shift,
Boardroom Blackout, Signal Siege, Witness Protection and Golden Parachute.
The hold-out waves, courier escort and lockdown deadline retain CorpoWars'
original rules. Headquarters includes the original weapons, AUG conversions,
medical research, augmentations, panic upgrades and difficulty selection.
Rewards are paid once per contract. Campaign saves use a separate, validated
CorpoWars3d storage key. Returning to headquarters abandons an unfinished run;
only between-contract campaign progress is saved.

## Rendering and optimization

- Static city geometry uploads once per operation. Buildings, windows, kerbs,
  street details and skyline share one instanced draw batch.
- Articulated agents and effects use a retained dynamic batch; the weapon uses
  a separate retained batch. Original signs share one generated texture atlas.
- The primary path uses four draws per FPS frame, independent of instance count.
  WebGL 1 without instancing expands geometry into retained vertex buffers.
- VANILLAJS' fixed clock runs gameplay at 60 Hz with bounded catch-up and
  interpolated presentation. The original binary-heap routing workspace is kept.
- HUD/map updates are capped at 10 Hz. The map terrain and software renderer's
  static camera view use bounded caches with explicit invalidation.
- High, Balanced and Low resolution controls, reduced motion, keyboard aim,
  invert aim, sensitivity and independent audio/music volume are available.
- The classic inverse-square-root bit trick is benchmarked but **not enabled**:
  it introduces approximation without a demonstrated gameplay benefit.

See [architecture](docs/ARCHITECTURE.md), [performance and limitations](docs/PERFORMANCE.md)
and [donor provenance](docs/PROVENANCE.md). This is an initial playable browser
release, not a claim of hardware certification or cross-browser bit exactness.

## Verify and package

Development commands use an existing Node 22+ executable; no npm install is needed.

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/benchmark.js
```

`dist/` is an allowlisted standalone static artifact. CI additionally uses
`uv` with pinned, CI-only Playwright to compile the real WebGL shaders and test
the packaged game under `/CorpoWars3d/`, including offline reload and simultaneous
mouse buttons. CI browser screenshots and telemetry are retained as artifacts.

The Pages workflow validates before deployment. For first publication, set
repository **Settings → Pages → Source → GitHub Actions**, then merge to main or
run **Deploy GitHub Pages**. Implementation PRs do not merge or publish themselves.

## License

Apache-2.0. Preserve [LICENSE](LICENSE) and [NOTICE](NOTICE).
Syndicate is a genre reference; this game includes original QSOL source and
procedural assets. It is not affiliated with Electronic Arts or Bullfrog.
