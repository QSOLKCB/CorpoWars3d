# Architecture

`src/simulation.js`, `campaign.js` and `challenges.js` preserve the original
CorpoWars simulation and data. The donor core skips automatic movement/triggers
for `game.controlled`, while retaining that agent's cooldown and reload. An
optional pure control stage runs after previous-pose capture and before combat
and objective evaluation. It records actual direct motion so moving or airborne
piloted agents cannot operate stationary terminals or hold zones. The flag resets
each tick, including when control returns to AI. Calls without this control stage
keep the original autonomous behavior. Target acquisition, line of sight, formation routing,
security behavior, economy and save validation remain in the donor core.

`src/fps.js` is a pure adapter: perspective selection, manual motion, 3D ray
tracing, follow orders and the bridge back to the original command API. It has no
DOM, network, wall clock or ambient randomness. Tests exercise it independently
of either renderer. `src/main.js` owns DOM/input/audio/storage and the single
animation loop. Restart replaces state without adding listeners or loops.

The simulation uses x/y ground-plane tiles, 2.5 m per tile. Rendering maps those
to +X/+Z metres with +Y up. Camera yaw zero faces -Z. QUICKSCOPER's column-major
projection/view matrices and slab ray-box intersection are used directly.

## Direct control contract

- Exactly one living agent is directly controlled in FPS mode; none in tactical.
- Switching keeps persistent actor identity, timers, resources, aim and routes.
- Direct movement cancels only that actor's route, target and follow assignment.
- Other agents retain their routes and original automatic combat behavior.
- A direct trigger is camera-aligned hitscan against the nearest solid building
  or actor, including the living released courier. Friendly actors stop the ray
  but take no friendly-fire damage. Inactive and dead couriers do not obstruct it.
- Follow cancels the outstanding escort assignment. Escort clears Follow for
  its selected recipients, so competing schedulers cannot overwrite their orders.
- Native and software renderers consume the same state and hit results.

Direct shots have a minimum 40 m reach, with a 2× head hit multiplier. Autonomous
agents retain their original weapon ranges and original target damage. This is
an intentional FPS balance adaptation, not identical 2D/3D numerical combat.
Aim-down-sights narrows FOV and slows movement; it does not introduce hidden hit
probabilities. Sprint/crouch and a small jump apply only to the piloted agent.

Agent collision uses a 0.13-tile footprint, four corner occupancy checks and
bounded substeps; movement slides independently along X/Y. Autonomous routing
retains tile-center paths. Buildings' blocked tile footprints match their 3D
cover boxes and are full-height obstacles; jumping does not bypass cover.

## Lifecycle and failure paths

The VANILLAJS clock uses a 1/60 s step, at most six updates and 0.1 s incoming
frame debt. Pausing resets accumulated debt. Blur, hidden tabs, pointer unlock
after a successful FPS lock and explicit pause stop simulation and clear all
held inputs. Deliberately unlocking for tactical command does not pause it.
Pointer-lock rejection falls back to keyboard aim; a lock is never required to
play. Mouse buttons are tracked independently using the full buttons bitmask.

A tactical pause leaves the map, squad selection and order controls available.
Its keyboard route accepts planning commands without collecting held movement,
aim or trigger inputs. Tab uses normal focus navigation; M returns to first
person without resuming simulation. Leaving planning opens the ordinary pause
modal. Both pause transitions clear held inputs and fixed-clock backlog.

Storage and audio are optional. Campaign data is reconstructed through the
original whitelist/economy validator. Settings have explicit types/ranges.
Unsupported graphics display an actionable error; missing WebGL tries the
software path first. Lost WebGL context pauses and requests a reload. Campaign
progress is saved between operations; mid-mission saves are not implemented.

`sw.js` precaches an explicit local list and uses a registration-scope-specific
cache prefix. It never deletes another game's caches or intercepts unrelated
paths. Runtime changes require a cache version bump. All runtime URLs are
relative and work under a repository subpath.
