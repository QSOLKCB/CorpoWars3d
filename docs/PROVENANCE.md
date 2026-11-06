# Donor provenance

| Source | Exact source commit | Reuse |
| --- | --- | --- |
| QSOLKCB/CorpoWars | `815b609cd6c2eb5c789a78ebe3e91d0438807b79` | Simulation, campaign/economy, challenges, agent profiles and fiction; adapted controlled-agent hook |
| QSOLKCB/VANILLAJS | `1f965f4e5b6669de0f954e3a39b11aa679e56720` | FixedClock copied to `src/vendor/time.js`; retained GPU buffer/input reset/pointer-ownership patterns adapted |
| QSOLKCB/QUICKSCOPER | `7c406e2545d82ee6bdc5fda5f198eb22fa183a84` | `math.js`, `audio.js`, `music.js`, `controller.js`; raw WebGL/camera/input architecture consulted |
| QSOLKCB/OPT | `7556dd36acd53ed3ed538fd03b1db44e5c1ec869` | Conceptual invariant-driven reuse, bounded working set and cache invalidation; no source copied |

All copied QSOL source is Apache-2.0. Existing attribution is retained in NOTICE.
CorpoWars' rendering reuse credits VANILLAJS and OPT; VANILLAJS' rendering notice
credits OPT's invariant/signature concepts. These inherited acknowledgements are
retained. No Wonderbuild or GPL source is introduced.

The FPS adapter, instanced renderer, software compatibility renderer, procedural
3D city/sign atlas, interface, tests and packaging are new work for CorpoWars3d.
The software path uses conventional perspective projection and near clipping;
the inverse-square-root experiment is the conventional IEEE-754 bit estimate
with one Newton step, confined to the benchmark. No historical game source is
included. Syndicate/FreeSynd are genre inspiration only, not asset/code donors.

Character skins (`src/skins.js`) are new work. Sharing one skin data module
between every renderer follows the pattern used for INERTIA ZERO's hull skins
in QSOLKCB/GAMES (same author); no GAMES source is copied. The colour lookup
table and three-word seed "twist" follow techniques publicly described for
Elite (Acornsoft, 1984); no Elite code, data, seeds or assets are used.
