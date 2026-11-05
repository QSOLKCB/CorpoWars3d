#!/usr/bin/env python3
"""Deterministic, local-first CorpoWars3d Payhip bundle builder (stdlib only).

Preview artifacts explicitly exclude unpublished story/music. Release mode
requires separately supplied, validated creative assets. No uploads occur here.
"""
# SPDX-License-Identifier: Apache-2.0
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import wave
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
FIXED_TIME = (1980, 1, 1, 0, 0, 0)
MAX_FILE_BYTES = 250 * 1024 * 1024
MAX_TOTAL_BYTES = 1024 * 1024 * 1024
GAME_FILES = ("index.html", "style.css", "icon.svg", "sw.js", "LICENSE", "NOTICE")
STORY_TYPES = {".epub", ".pdf"}
MUSIC_TYPES = {".wav", ".flac", ".mp3", ".ogg", ".m4a"}
GUIDE = """CORPOWARS3D: PREMIUM OPERATIONS
Four bodies. One conscience. No shareholders were consulted.

BROWSER GAME
1. Extract the entire ZIP; do not launch the game inside the archive.
2. If Python 3 is installed, open a terminal in Browser-Game and run:
   python -m http.server 8000 --bind 127.0.0.1
   (On Linux use python3; on Windows 'py -m http.server ...' also works.)
3. Open http://127.0.0.1:8000/ in a modern browser.
   Browser ES modules require HTTP. Do NOT open index.html via file://.
4. All game assets are local. Internet access is not needed to play.
   Campaign progress is stored locally in this browser (no cloud saves).

DOS BONUS: DIVIDEND ZERO
Extract Bonus-DOS/CORPO-DOS.zip separately. Follow its README.TXT.
DOSBox is required; this is a separate 16-bit DOS game.

STORY AND MUSIC
The release bundle includes one original narrative and one music track.
The preview bundle has explicit placeholders and is NOT FOR SALE.

RIGHTS
Browser game: Apache-2.0, see Browser-Game/LICENSE and NOTICE.
Story, music, cover artwork: distinct rights reserved by their respective
creators, subject to the terms supplied with the final creative assets.
No DRM, licence server, installation package or external runtime libraries.
"""
RIGHTS = """PRODUCT STAGING NOTES — NOT AN END-USER LICENCE CHANGE
Proposed Payhip price: US$5.00 (owner confirms before manual publication).
Apache-2.0 software remains available under its existing permissive licence.
Do not describe the game software itself as exclusively licensed.
The paid value proposition is the curated offline bundle, DOS bonus, original
story and original soundtrack (subject to final creator permissions).
No customer publication or payment processing happens in this build.
"""


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def valid_name(name: str) -> bool:
    p = PurePosixPath(name)
    return bool(name and not name.startswith("/") and "\\" not in name
                and name == p.as_posix() and all(x not in ("", ".", "..") for x in p.parts))


def file_bytes(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Not a regular, unlinked file: {path}")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(f"Asset exceeds {MAX_FILE_BYTES} byte bound: {path}")
    return path.read_bytes()


def collect_tree(source: Path, prefix: str, required: tuple[str, ...] = ()) -> dict[str, bytes]:
    if not source.is_dir() or source.is_symlink():
        raise ValueError(f"Missing or linked source directory: {source}")
    for item in required:
        if not (source / item).is_file():
            raise ValueError(f"Required game file missing: {item}")
    entries = {}
    for item in source.rglob("*"):
        if item.is_symlink():
            raise ValueError(f"Symlink forbidden: {item}")
        if item.is_file():
            name = f"{prefix}/{item.relative_to(source).as_posix()}"
            if not valid_name(name):
                raise ValueError(f"Unsafe bundle path: {name}")
            entries[name] = file_bytes(item)
        elif not item.is_dir():
            raise ValueError(f"Unsupported filesystem entry: {item}")
    return entries


def one_asset(root: Path, folder: str, extensions: set[str]) -> Path:
    location = root / folder
    if not location.is_dir() or location.is_symlink():
        raise ValueError(f"Release requires {location} containing exactly one real asset")
    items = list(location.iterdir())
    if len(items) != 1 or items[0].suffix.lower() not in extensions:
        raise ValueError(f"Expected exactly one {folder} asset with supported extension")
    return items[0]


def validate_story(path: Path, data: bytes) -> None:
    if path.suffix.lower() == ".pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
            raise ValueError("Story PDF signature is invalid")
    else:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if z.read("mimetype") != b"application/epub+zip":
                    raise ValueError("Story EPUB mimetype is invalid")
                if "META-INF/container.xml" not in z.namelist():
                    raise ValueError("Story EPUB is missing its container metadata")
        except (zipfile.BadZipFile, KeyError) as err:
            raise ValueError("Story EPUB is not a valid EPUB container") from err


def validate_music(path: Path, data: bytes) -> None:
    ext = path.suffix.lower()
    if ext == ".wav":
        try:
            with wave.open(io.BytesIO(data), "rb") as reader:
                if reader.getnframes() < 1 or reader.getnchannels() < 1:
                    raise ValueError("Audio WAV contains no samples")
        except (EOFError, wave.Error) as err:
            raise ValueError("Audio WAV header is invalid") from err
        return
    if not ({
        ".flac": data.startswith(b"fLaC"),
        ".mp3": data.startswith(b"ID3") or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0),
        ".ogg": data.startswith(b"OggS"),
        ".m4a": data[4:8] == b"ftyp",
    }[ext]):
        raise ValueError(f"Audio {ext} signature is invalid")


def make_zip(entries: dict[str, bytes], output: Path, mode: str) -> None:
    if not all(valid_name(name) for name in entries):
        raise ValueError("Unsafe archive member")
    records = [{"path": name, "bytes": len(data), "sha256": sha(data)}
               for name, data in sorted(entries.items())]
    meta = {"schema": "corpowars3d-payhip-bundle/1", "edition": mode,
            "product": "CorpoWars3d: Premium Operations",
            "price_proposal": {"currency": "USD", "amount": "5.00"},
            "contents": records}
    entries["MANIFEST.json"] = (json.dumps(meta, sort_keys=True, separators=(",", ":")) + "\n").encode()
    entries["SHA256SUMS"] = "".join(f"{sha(data)}  {name}\n"
                                 for name, data in sorted(entries.items())).encode()
    if sum(map(len, entries.values())) > MAX_TOTAL_BYTES:
        raise ValueError("Bundle exceeds configured size bound")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w") as z:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, FIXED_TIME)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def build(root: Path, output: Path, mode: str, assets_root: Path | None = None) -> None:
    if mode not in ("preview", "release"):
        raise ValueError("Mode must be preview or release")
    entries = collect_tree(root / "dist", "Browser-Game", GAME_FILES)
    entries["Bonus-DOS/CORPO-DOS.zip"] = file_bytes(root / "games/dos/download/CORPO-DOS.zip")
    entries["START_HERE.txt"] = GUIDE.encode()
    entries["PRICING_AND_RIGHTS.txt"] = RIGHTS.encode()
    if mode == "preview":
        entries["Story/STORY_PENDING.txt"] = b"NOT FOR SALE: the original story is awaiting author handoff.\n"
        entries["Music/MUSIC_PENDING.txt"] = b"NOT FOR SALE: the original music track is awaiting composition.\n"
    else:
        root_assets = assets_root if assets_root is not None else root / "premium/assets"
        story = one_asset(root_assets, "story", STORY_TYPES)
        music = one_asset(root_assets, "music", MUSIC_TYPES)
        story_data, music_data = file_bytes(story), file_bytes(music)
        validate_story(story, story_data)
        validate_music(music, music_data)
        entries[f"Story/{story.name}"] = story_data
        entries[f"Music/{music.name}"] = music_data
    make_zip(entries, output, mode)
    verify(output)


def verify(archive: Path) -> None:
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        if len(names) != len(set(names)) or any(not valid_name(n) for n in names):
            raise ValueError("Duplicate or unsafe archive entries")
        if not {"MANIFEST.json", "SHA256SUMS", "START_HERE.txt"}.issubset(names):
            raise ValueError("Missing proof metadata")
        checksum = z.read("SHA256SUMS")
        expected = b"".join(f"{sha(z.read(n))}  {n}\n".encode() for n in sorted(names) if n != "SHA256SUMS")
        if checksum != expected:
            raise ValueError("Bundle checksums do not match")
        manifest = json.loads(z.read("MANIFEST.json"))
        actual = [{"path": n, "bytes": len(z.read(n)), "sha256": sha(z.read(n))}
                  for n in sorted(names) if n not in ("MANIFEST.json", "SHA256SUMS")]
        if manifest.get("schema") != "corpowars3d-payhip-bundle/1" or manifest.get("contents") != actual:
            raise ValueError("Manifest does not match payload")
        if manifest["edition"] == "release":
            if any("PENDING" in n for n in names) or not any(n.startswith("Story/") for n in names) or not any(n.startswith("Music/") for n in names):
                raise ValueError("Release missing paid creative assets")
        elif manifest["edition"] != "preview":
            raise ValueError("Invalid edition")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("preview", "release"), default="preview")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--assets-root", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / "premium/out/CorpoWars3d-Premium-Preview.zip")
    parser.add_argument("--verify", type=Path, help="Verify an existing archive instead of building")
    args = parser.parse_args()
    try:
        if args.verify:
            verify(args.verify)
            print(f"Verified {args.verify} (checksums + manifest)")
        else:
            build(args.root, args.out, args.mode, args.assets_root)
            print(f"Built and verified {args.mode.upper()} archive: {args.out}")
            print(f"SHA-256: {sha(args.out.read_bytes())}")
    except (OSError, ValueError, zipfile.BadZipFile) as err:
        print(f"Bundle blocked: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
