# Architecture

`src/simulation.js`, `campaign.js` and `challenges.js` adapt the original
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

Character skins are pure presentation (`src/skins.js`). Both renderers call
`emitCharacter`, which emits local cuboids through a callback; colours resolve
through one lookup table, and enemy variants come from a seeded 16-bit twist of
the actor id. Skin parts stay inside the 1.9 m × 0.6 m shot volume used by
`shoot`; tests enforce those bounds for every skin, stride and variant.

Direct shots have a minimum 40 m reach, with a 2× head hit multiplier. Autonomous
agents retain their original weapon ranges and original target damage. This is
an intentional FPS balance adaptation, not identical 2D/3D numerical combat.
Aim-down-sights narrows FOV and slows movement; it does not introduce hidden hit
probabilities. Sprint/crouch and a small jump apply only to the piloted agent.

Agent collision uses a 0.13-tile footprint, four corner occupancy checks and
bounded substeps; movement slides independently along X/Y. Autonomous routing
retains tile-center paths. Buildings' blocked tile footprints match their 3D
cover boxes and are full-height obstacles; jumping does not bypass cover.

## Facing and pursuit

Simulation headings follow the camera: yaw θ faces (sin θ, −cos θ) on the x/y
ground plane. Both renderers rotate a part's local (x, z) by t to
(x cos t + z sin t, −x sin t + z cos t), so characters are placed with
`actorAngle(θ) = −θ`; local −Z is forward in `skins.js`. `tests/ai.test.js`
checks every emitted part of both renderers against that rotation.

`tick` records presentation-only `focus` ids: the guard an autonomous agent is
engaging, and the agent or courier a guard has detected. After each tick the FPS
adapter faces units at their focus, otherwise along their motion. Guards plan a
chase on first contact, re-plan at most every 0.25 s when the target leaves the
route's goal tile or the route is empty, and keep the 1.1 s patrol think.
`pursuitPath` drops the unit's own tile centre from the start of a route when a
second waypoint exists; 4-connected tiles keep the shortcut inside walkable
tiles.

## Control nodes and reserves

`objectives.js` (from CorpoWars) defines the order: relay, vault, then control
nodes, then exit; escort contracts capture nodes before the vault releases the
witness. Nodes are four-second stationary channels with the same rules as the
terminals, and each spawns one defender (ids 500+). Reserve patches add to the
issued medkits; the issued ones are spent first, and `main.js` records reserve
consumption in the campaign save immediately.

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

## Device boundary

`controller.js` samples standard Gamepad state once per rendered frame; curved
radial sticks preserve analog magnitudes. Buttons provide edges for actions and
held state for triggers. Identity changes and lifecycle resets require neutral
input, including partial trigger pulls. `touch.js` owns pointers independently;
look deltas and brief fire/jump presses survive render frames without a simulation
tick, then are consumed once. `devices.js` routes menus, tactical cursor and
browser pointer capture. Neither pure input module reads browser state.

All devices feed the same 60 Hz movement/aim/shot rules. Blur, pause, handoff,
rotation and cancellation clear transient input. A disconnected active controller
pauses. Keyboard auto-repeat cannot re-arm a cleared key. Acquiring mouse capture
is not a shot. Automatic death switches also clear device input. The tactical
canvas is sized as a square with ResizeObserver so pointer-to-world coordinates
match the drawn map in both phone orientations.

## Encounter and Panic adaptations

City patrols use seeded ordering, unique IDs, existing pathfinding and unchanged
combat/Follow AI. Extra patrols have two street waypoints; initial homes/routes
exclude insertion. Relay response is a finite once-only event with distance and
line-of-sight spawn exclusions. Original hold and extraction waves remain.

Panic snapshots selected living sources and visible hostile targets once at
activation. `panicActive` counts down the effect; `panicCooldown` counts down
effect plus recharge, guaranteeing full downtime after effect expiration. Both
advance only in simulation time. No toggle/armed/automatic-recast state remains.
Empty-target activation still spends the cooldown; changing selection cannot
refresh it. Original research range/duration/recharge benefits are preserved.
