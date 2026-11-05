#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Deterministic, dependency-free, preview-only Close Quarters ZIP builder.

A static import closure is safer than copying an entire repository or relying
on npm installation. The release content is exact and the manifest is checked.
No network, publishing, storefront, or API credentials.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path, PurePosixPath
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[3]
PREFIX = "CORPOWARS-CLOSE-QUARTERS/"
FRONT = (
    "LICENSE", "NOTICE",
    "games/close-quarters/index.html", "games/close-quarters/style.css",
    "games/close-quarters/README.md", "games/close-quarters/NOTICE",
)
ENTRY = "games/close-quarters/src/main.js"
IMPORT = re.compile(r"""\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]""", re.M)
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)


def source(path: str) -> bytes:
    key = PurePosixPath(path)
    if key.is_absolute() or ".." in key.parts or not path or "\\" in path:
        raise ValueError(f"Unsafe archive path: {path!r}")
    candidate = ROOT
    for part in key.parts:
        candidate /= part
        if candidate.is_symlink():
            raise ValueError(f"Symlink not permitted: {path}")
    if not candidate.is_file():
        raise FileNotFoundError(candidate)
    data = candidate.read_bytes()
    if len(data) > 500_000:
        raise ValueError(f"Unexpectedly large source: {path}")
    return data


def closure() -> dict[str, bytes]:
    selected: dict[str, bytes] = {name: source(name) for name in FRONT}
    work = [ENTRY]
    while work:
        path = work.pop()
        if path in selected:
            continue
        if not (path.startswith("src/") or path.startswith("games/close-quarters/src/")):
            raise ValueError(f"Unapproved module boundary: {path}")
        if not path.endswith(".js") or len(selected) > 80:
            raise ValueError(f"Invalid module graph: {path}")
        data = source(path)
        selected[path] = data
        text = data.decode("utf-8")
        if re.search(r"\bimport\s*\(", text):
            raise ValueError(f"Dynamic import not permitted: {path}")
        for match in IMPORT.finditer(text):
            ref = match[1] or match[2]
            if not ref.startswith("./") and not ref.startswith("../"):
                raise ValueError(f"Nonlocal dependency: {path}: {ref}")
            name = str(PurePosixPath(path).parent.joinpath(ref))
            # PurePosixPath does not collapse '..'; normalize under explicit root.
            stack: list[str] = []
            for part in name.split("/"):
                if part in ("", "."):
                    continue
                if part == "..":
                    if not stack:
                        raise ValueError("Import escaped repository")
                    stack.pop()
                else:
                    stack.append(part)
            resolved = "/".join(stack)
            if not resolved.endswith(".js"):
                raise ValueError(f"Unbounded import extension: {ref}")
            work.append(resolved)
    return dict(sorted(selected.items()))


def manifest(files: dict[str, bytes]) -> bytes:
    return "".join(
        f"{hashlib.sha256(value).hexdigest()}  {name}\n"
        for name, value in files.items()
    ).encode("ascii")


def info(name: str) -> zipfile.ZipInfo:
    entry = zipfile.ZipInfo(PREFIX + name, ZIP_EPOCH)
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    entry.compress_type = zipfile.ZIP_DEFLATED
    return entry


def build(dest: Path) -> str:
    files = closure()
    files["SHA256SUMS.txt"] = manifest(files)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(files.items()):
            z.writestr(info(name), data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    verify(dest)
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    print(f"Built {dest} ({len(files)} entries) SHA-256 {digest}")
    return digest


def verify(dest: Path) -> None:
    selected = closure()
    expected = dict(selected)
    expected["SHA256SUMS.txt"] = manifest(selected)
    with zipfile.ZipFile(dest, "r") as z:
        actual = z.namelist()
        wanted = [PREFIX + x for x in sorted(expected)]
        if actual != wanted:
            raise ValueError("Archive entry set/order differs from the pinned import closure")
        for member, data in expected.items():
            zi = z.getinfo(PREFIX + member)
            if zi.date_time != ZIP_EPOCH or zi.file_size != len(data):
                raise ValueError(f"Noncanonical ZIP metadata for {member}")
            if z.read(zi) != data:
                raise ValueError(f"Archive content does not match the source for {member}")
    print(f"Verified {dest} against {len(expected)} allowlisted entries")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    exclusive = parser.add_mutually_exclusive_group(required=True)
    exclusive.add_argument("--output", type=Path, help="Write a preview ZIP only")
    exclusive.add_argument("--verify", type=Path, help="Verify ZIP against checked-out sources")
    args = parser.parse_args()
    if args.verify:
        verify(args.verify)
    else:
        build(args.output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, UnicodeError, zipfile.BadZipFile) as exc:
        print(f"BONUS PACKAGE FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
