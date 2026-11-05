# CorpoWars3d: Premium Operations — packaging and creative handoff

**Proposed Payhip price:** **US$5.00**. This is a product plan, not a live listing. Publishing, price confirmation, commercial artwork, and licensing decisions require owner approval.

## Contents

- **Eight** sequential playable squad-FPS contracts: the six original operations plus **Black Dividend** (hold/broadcast operation, violet district) and **Proxy Election** (timed lockdown, crimson district). The expansion deliberately reuses proven city/navigation layouts while adding mission composition and themed structural details.
- **Five** optional campaign medals, including new **Ghost Dividend** (zero security eliminations) and **Unbroken Signal** (four surviving agents on Hostile). Medals are cosmetic: no extra credits, combat power, or new save format.
- Offline-capable browser FPS with local progress, no account, no remote textures, no game engine.
- **Dividend Zero**: separate DOSBox-ready 16-bit demake as a bonus.
- **One original short-story booklet and one original music track**, created independently and incorporated only after the author's storyboard/story handoff and the final song session.
- **Secret post-soundtrack bonus — Close Quarters**: eight AFTER//ZERO 24×24 arenas transplanted onto the CorpoWars four-agent squad FPS, with an independent local-save namespace, chrono and an offline gameplay ZIP. The customer-facing `START_HERE.txt` deliberately does not spoil it; instructions reside in `ZZ-POST-SOUNDTRACK-BONUS/00-AFTER_THE_MUSIC.txt`. The gameplay ZIP is the **last archive member**, after the story and music, at `ZZ-POST-SOUNDTRACK-BONUS/CORPOWARS-CLOSE-QUARTERS.zip`.

## Exact producer sequence

1. Merge this implementation PR only after CI, code review, packaged-browser smoke and performance evidence pass.
2. Merge the independently authored storyboard/story work, review its thematic and factual continuity, then perform the narrative bridge. Do not overwrite the other author's creative files.
3. Compose the soundtrack after the book, and present **Close Quarters only after the music** as the final secret bonus. Keep soundtrack licensing and rights distinct from the Apache-2.0 game code.
4. Place final assets **locally** in `premium/assets/story/` (exactly one **.epub** or **.pdf**) and `premium/assets/music/` (exactly one **.wav**, **.flac**, **.mp3**, **.ogg** or **.m4a**). Put original creative assets outside the public Git repository to avoid giving the paid extras away.
5. Build and inspect the final package locally from a **quiescent, trusted checkout**. The builder generates Close Quarters from its checked-out ES-module closure, checks both layers of SHA-256 receipts, compares the ZIP members to checked-out source bytes, and rejects missing/corrupt modules or source changes observed during packaging. It refuses linked roots and ancestors. The bonus ZIP must remain the final entry after `Music/`. Confirm owner rights, price, store cover art, screenshots, and ebook/music quality.
   The premium preview has explicit story/music placeholders and must never be sold as the final product.
6. Create a Payhip digital download product for US$5.00 **manually**, attach the fully verified release ZIP and publish only on explicit owner approval. GitHub Actions **never uploads** to Payhip.

## Reproducible commands

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/package_payhip.py --mode preview --out premium/out/CorpoWars3d-PREVIEW.zip
python3 scripts/package_payhip.py --verify premium/out/CorpoWars3d-PREVIEW.zip

# Run ONLY when the author has delivered the complete story and soundtrack:
python3 scripts/package_payhip.py --mode release --out premium/out/CorpoWars3d-Premium-Operations.zip
python3 scripts/package_payhip.py --verify premium/out/CorpoWars3d-Premium-Operations.zip
sha256sum premium/out/CorpoWars3d-Premium-Operations.zip
```

The public GitHub Actions workflow builds **preview only** (with conspicuous placeholder notices), checks the post-soundtrack Close Quarters bonus against the checked-out source closure, validates its nested SHA-256 manifest, launches the nested game in Chromium, and verifies two byte-identical ZIPs. `--mode release` is intentionally blocked until both creative assets are available; both the builder and verifier enforce one supported top-level story file and soundtrack, validating basic container/header structure rather than copyright or creative quality. ZIP entries have canonical timestamps, file types, sorted paths and compression.

**Integrity is not authenticity:** internal SHA-256 receipts and `MANIFEST.json` are generated from the archive's own contents, so someone who repacks a ZIP can regenerate them. `--verify` therefore compares the archive's games, DOS package, guides and Close Quarters module closure against the trusted local checkout (`--root` defaults to this repository). Do not call a detached archive independently authenticated without a trusted checkout or external signed digest. The packaging source-stability recheck detects observed changes but is not an OS-level atomic snapshot: do not change or swap the worktree during a build. Build from an immutable commit/worktree when preparing a sale. Compiler/browser cross-device parity is a distinct test.

No Node package installation is required; Node is existing test/build tooling and Python uses the standard library. This file does not authorize publishing, refunds, copyright claims over Apache code or price changes.

## Proposed narrative bridge for the storyboard author

**Black Dividend:** the squad intercepts a public emergency network whose predictive algorithm taxes even the *act* of evacuation. The liberated ledger identifies an automated board-voting process; the broadcast reveals the names of those stripped of representation. The mechanics support a defensive hold at a transmitter and extraction of survivors.

**Proxy Election:** the board's proxy-vote failsafe hides an original register of affected people. The objective is disabling the lock, recovering the register, and beating the district lockdown. The moral question is not whether the data is valuable, but who may decide its custody after liberation.

These are **mission prompts, not canonical prose**. The book's independent storyboard owns character arcs and continuity. Once it is merged, update mission dialogue/briefings and narrative collectibles without changing the proven operation objectives, save rules or level topology unless explicitly reviewed.

## Optimization evidence

- `OPT-INV-001`: adjacent cuboid instances reuse `Math.sin`/`Math.cos` orientation results when input angles are identical, with exact Float32 data parity tests, retaining the existing buffer reuse. A zero angle avoids both calls.
- Removed the per-frame temporary squad/guard concatenation from the renderer.
- `VANILLAJS` fixed 60 Hz clock and the existing cover/collision and upload contracts remain authoritative.
- The new `ballisticStep` uses closed-form constant-acceleration vertical motion within the same 60 Hz frame contract. Ground clamping and input cancellation remain explicit; native positional collision remains unchanged.
- Any speedup claim requires comparable browser CPU/GPU measurements on matching workloads, including allocations and frame times. The CI unit/preview gate proves correctness and packaging **not FPS improvement**.

## Final release acceptance criteria

- The main browser game's packaged WebGL smoke passes at the exact Git head.
- Close Quarters' eight-sector authored geometry and enemy placements pass deterministic unit tests.
- The integrated premium ZIP contains `Browser-Game/`, `Bonus-DOS/`, final `Story/`, final `Music/`, and `ZZ-POST-SOUNDTRACK-BONUS/` **after** Story/Music (not merely a README reference).
- Both outer and nested inner archives have valid SHA-256 receipts **and** match the trusted checkout. Self-resigned mutations, removed modules, nonregular metadata and unexpected content are rejected in source-backed verification. Regenerating on unchanged source yields byte-identical ZIPs.
- The included Close Quarters executable launches **from the extracted nested ZIP** in Chromium with no outbound requests. A standalone ZIP green run is not enough.
- The release builder and verifier reject missing or unsupported creative files, malformed PDF/EPUB or audio headers, symlinked roots/ancestors, missing bonus modules, changed source inputs, and archive tampering. `START_HERE.txt` must not disclose the final bonus; post-music instructions live alongside it. Do not publish the NOT-FOR-SALE preview.
- Owner reviews the final epub/pdf and actual recorded song, checks the storefront presentation and price, and explicitly authorizes publication. CI cannot inspect the private creative assets until supplied.

## Licensing and release boundaries

The game remains Apache-2.0 (including existing donor provenance, LICENSE and NOTICE). Packaging it for a US$5.00 product does not revoke recipients' open-source rights. Story, music and art need a clear separate rights statement. Never import a third-party licensed soundtrack or image without permission. This build process is local-first, no DRM, no cloud build requirement to make a local ZIP, and does not modify the DOS game.
