# Dividend Zero — provenance and music mapping

Copyright 2026 QSOL-IMC / Trent Slade. Apache-2.0, as in the repository LICENSE.
The DOS source, bitmap art, sample recipes and compositions are new work. No
recorded samples, ripped sprites, proprietary game code or pre-existing songs
are included. Syndicate is an inspiration for the squad premise, not an asset donor.

## QSOLKCB references

- **E8_MUSIC**, commit `d8e5983d84af03f03a969abe3356dcf80c0e0e97`:
  `js/e8-core.js` (exact E8 root families and dot-product adjacency),
  `scripts/e8_ministry_dr660_loop.py` (deterministic industrial percussion),
  `CANONICAL_SONIFICATION.md` (interpretive/canonical boundary).
  https://github.com/QSOLKCB/E8_MUSIC/tree/d8e5983d84af03f03a969abe3356dcf80c0e0e97
- **SONIFICATION**, commit `5a9af7876dac3f55839f2a23d7655d70c2158990`:
  `sonification/core/synthesis/fm.py` and `docs/SONIFICATION_MAPPING.md`
  (explicit synthesis recipes, envelopes and bounded output). The optional
  synthesis package is the reference, not the root ETQ workflow's renderer.
  https://github.com/QSOLKCB/SONIFICATION/tree/5a9af7876dac3f55839f2a23d7655d70c2158990

Both donor repositories are MPL-2.0. Their source files are not copied or linked
into this game. The Python standard-library implementation here is newly written
around the mathematical structures and synthesis concepts described above.
Existing FPS donor notices remain in the repository root NOTICE.

## Authored mapping, completely specified

`tools/assets.py` enumerates doubled E8 roots: 112 vectors with two coordinates
in {-2,+2}, and 128 vectors of eight {-1,+1} coordinates with even negative parity.
Every root has squared norm 8. Neighbors have integer dot product 4; every root
has 56 neighbors. The walk starts at `seed % 240` and chooses neighbors using
`state = (1664525*state + 1013904223) mod 2^32`, then `state % 56`.

Projection weights `[1,-1,2,-2,3,-3,5,-5]` select a minor-pentatonic melody from
`abs(dot(root,weights)) % 10`. The scale, rhythm, harmony, tempo and instruments
are compositional choices. This is **interpretive game music**, not ETQ-101's
canonical sonification, a physical E8 sound, or evidence for a scientific claim.

Six original instruments: a one-cycle FM bass, additive glass lead, additive pad,
exponentially swept kick, seeded noise/body snare and seeded noise/metallic hat.
One-shot percussion has finite envelopes; all samples are quantized to signed
8-bit PCM. Six samples occupy 2,752 bytes per module. Four 64-row patterns and
an eight-entry order list make each complete track **7,932 bytes**.

| Track | Seed | BPM | Purpose |
| --- | ---: | ---: | --- |
| MENU.MOD | 232 | 112 | Infiltration briefing |
| ACTION.MOD | 12648430 | 132 | District combat |
| BOSS.MOD | 45141 | 148 | Relay / warden approach |

The integer runtime mixer uses four voices, 16.16 sample cursors, nearest-sample
resampling and the PAL Amiga clock convention. Notes/instruments, Cxx volume and
Fxx speed/tempo are supported. Finetune, arpeggios, slides, vibrato, jumps and other
tracker effects are rejected. This is intentionally an authored-track player.

## Hardware/format references

- Creative Technology, *Sound Blaster Series Hardware Programming Guide*,
  chapters 2 and 6: BLASTER configuration, DSP 4.xx shared IRQ status, sample rate,
  Bxh signed 16-bit auto-init DMA, D5h/D9h stop and 2xFh acknowledgement.
  https://www.ardent-tool.com/sound/Sound_Blaster_HW_Programming_Guide_1st.pdf
- Original MOD file-format description, Corion archive:
  https://www.fileformat.info/format/mod/corion.htm
- GCC x86 options, `-m16`: 16-bit code with the i386 programming model.
  https://gcc.gnu.org/onlinedocs/gcc/x86-Options.html

These documents are references; their text and example implementations are not
redistributed. The DOS package includes the repository Apache-2.0 license and
this notice. DOSBox itself is not bundled.
