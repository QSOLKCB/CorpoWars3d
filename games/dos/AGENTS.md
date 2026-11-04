# DOS target rules

- This directory is the native DOS exception to the root browser runtime rule.
  Keep it independent; do not move the working FPS or expand its deploy allowlist.
- C99, a small GNU assembler startup, Python standard-library asset/build tools.
  GCC `-m16 -march=i386`: real-mode 16-bit execution with 386 integer instructions.
  No libc, DOS extender, engine, npm or downloaded runtime.
- Fixed 35 Hz game updates, bounded actors/projectiles, shared collision/render
  tiles. Preserve health and orders when switching agents. Pause freezes gameplay.
  In this platformer, friendly bullets pass through squadmates; enemies and
  scenery stop them. The browser FPS keeps its existing friendly-occlusion rule.
- Keep MOD parsing bounded. Only advertise supported effects. Amiga M.K. sample
  data is signed 8-bit; the output mixer/DMA stream is signed 16-bit mono.
- Generate original samples and graphics from the checked-in recipes. Credit
  SONIFICATION and E8_MUSIC at exact donor commits; do not label authored music
  as canonical scientific sonification.
- Run `uv run --no-project python games/dos/tools/check.py`, `build.py`, and
  `smoke.py` (same directory prefix). Smoke requires DOSBox 0.74 or compatible.
  Retain the root checks. Report emulator evidence separately from hardware tests.
- `dist/` is temporary. The small `download/CORPO-DOS.zip` is an intentional
  ready-to-play artifact. Rebuild and compare it in CI; include source hashes in
  the evidence. GCC 13.3 / binutils 2.42 is the reference toolchain.
