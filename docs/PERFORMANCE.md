# Performance and verification boundaries

## Implemented mechanisms

The WebGL 2/ANGLE path uses one immutable unit-cube VBO and packed 12-float
instances. One static city batch includes all structural geometry and windows.
One dynamic batch includes actors/objectives/effects, one atlas batch contains
signs, and one dynamic batch contains the first-person weapon. A normal FPS frame
therefore has four draw calls. Geometry counts still affect GPU cost; batching
does not eliminate overdraw or guarantee a frame rate.

Dynamic GPU buffers retain geometrically grown capacities and upload active
ranges via bufferSubData. Static batches upload only when the operation/world
changes. Shader/attribute limits and uniform locations are cached at setup.
Without instancing, the same cuboids expand to retained vertex arrays with the
same draw count but substantially greater upload cost. Neither path allocates
or deletes GPU buffers during ordinary frames.

The software path has reduced facade detail and clipped, depth-sorted convex
faces. Its bounded one-view background cache keys every camera/projection/size
dimension and resets on world replacement. Moving cameras reconstruct it.
Actors/terminals behind full-height building cover are culled using the shared
line-of-sight function. Sorting does not implement a general per-pixel depth
buffer, so overlapping effects and geometry can differ from native WebGL.

The navigation workspace already uses a per-world, epoch-stamped binary heap
in the CorpoWars donor. It retains original tie order rather than adding a
path cache that might alias distinct origins. Follow paths update at most once
per 0.6 s. Map terrain rebuilds on world replacement; dynamic maps and DOM status
update at 10 Hz. Gameplay remains 60 Hz with a bounded catch-up window.

## Bounded local arithmetic experiment

Run `node scripts/benchmark.js --write` to regenerate `PERFORMANCE_LOCAL.json`.
The fixture compares native reciprocal square root with the classic 0x5f3759df
bit estimate plus one Newton iteration on 200,000 positive inputs, after warmup,
in nine alternating-order repetitions. One scratch float/int view is reused.
The report records every sample, host/runtime and source-file SHA-256 hashes.

The recorded runs varied with host load; neither variant established a stable,
material timing advantage. The maximum relative error is about 0.0017522
(0.17522%). This does not justify replacing exact gameplay math. Native Math.sqrt /
Math.hypot and squared comparisons remain authoritative. No approximate hit,
collision, navigation or normalized-input calculation is enabled.

The same run measures 600 fixed simulation steps on each contract, five repeats
per contract. The JSON retains individual samples and per-contract medians from this host's
Node process. This is CPU simulation throughput, not in-game FPS.
Use the JSON's hashes to identify the measured source state; later source edits
require a new report before treating it as current evidence.

## Verification

Pure tests isolate direct/autonomous combat, cover, friendly occlusion, switching,
timers/resources, movement collision, diagonal normalization, fire discipline,
death switching, total loss, pause and bounded clock catch-up. A combat-free
fixture completes all six original objective/escort/hold/deadline paths using
squad commands; it establishes reachability, not difficulty balance.

The managed preview browser lacked WebGL. Its software path was used for local
UI checks. This does not validate the primary shaders or owner hardware speed.
The CI browser job explicitly requires real WebGL context creation (software
ANGLE in Chromium), compiles the shaders, tests the packaged repository subpath,
agent/map/input/pause flows, retains static upload counts and verifies offline
reload. Its screenshots and JSON are separate run evidence, not claimed until
that exact CI run passes.

Unverified device coverage: Trent's RTX 5060 Ti, other physical GPUs, Safari,
Firefox, physical Xbox controllers, iOS/Android touch feel and screen-reader usability during FPS.
CI adds emulated standard gamepads and Chromium multi-touch, which do not establish
physical device compatibility or subjective aiming feel.
No GPU speedup against an earlier 3D release is claimed: this is the first 3D
implementation. Screenshots from software mode must be labelled accordingly.

## Executed primary-renderer CI evidence

The WebGL 2 job passed on source commit
`590e8bbad14621a4cbae5cf587716f4bd90e9600` in run `41856224981`.
It recorded 7,143 instances, four draw calls and 8,064 dynamic upload bytes in
the sampled FPS frame. Static upload counts stayed constant during continued
frames. Thirteen packaged browser checks passed with no page exceptions,
including simultaneous mouse buttons and offline reload.

`QA_NATIVE_CI.json` preserves exact source/run/artifact identifiers, the verified
ZIP SHA-256, browser telemetry and screenshot SHA-256 values. The images in
`images/` are copied directly from that artifact. Chromium used ANGLE SwiftShader
(a software GPU), so this validates the native WebGL API/shader path and behavior,
not physical GPU frame rate. That artifact is historical initial-build evidence; the controller/mobile
revision requires its own passing run and is not covered by those screenshots.

## Controller/mobile revision contract

For the cover hot loop, X = fresh per-building boxes versus one retained private
scratch box; F = bounded synchronous scalar implementations; f = median time for
10,000 identical ordered rays; d = minimize; C = exact distances/cover ties and
live geometry edits; B = five warmups plus nine alternating paired trials;
S = stop at that budget. Variables are categorical, local scope, noisy timing,
derivative-free information, cheap sequential evaluations, semantic/resource
constraints, exact arithmetic. Reuse follows OPT-INV-001 and VANILLAJS retained
workspaces. A WeakMap geometry-cache experiment was rejected after its warmed
lookup/validation overhead exceeded fresh boxes in an exploratory probe.

`PERFORMANCE_LOCAL.json` records the final fresh/retained samples and exact parity.
No global GPU/FPS improvement is inferred. Extra patrols intentionally increase
actor work; fixed-step, upload and draw-count checks remain. DOM nodes are retained,
unchanged world-label text is not recreated, and the hidden minimap is skipped in
touch and tactical modes. Main-loop and device changes require packaged browser
checks in addition to pure input/gameplay tests.
