"""Safety, determinism and hard release-gate tests for Payhip packaging."""
# SPDX-License-Identifier: Apache-2.0
import io
import json
import sys
import tempfile
import unittest
import wave
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from package_payhip import build, verify, BONUS_MEMBER, verify_bonus, make_zip

class PackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        dist = self.root / "dist"
        (dist / "src").mkdir(parents=True)
        for filename in ("index.html", "style.css", "icon.svg", "sw.js", "LICENSE", "NOTICE"):
            (dist / filename).write_text("fixture: " + filename)
        (dist / "src/main.js").write_text("export const entry = true;")
        dos = self.root / "games/dos/download"
        dos.mkdir(parents=True)
        (dos / "CORPO-DOS.zip").write_bytes(b"fixture DOS archive")
        # Minimal, real static-module closure under an isolated fixture root.
        bonus = self.root / "games/close-quarters"
        (bonus / "src").mkdir(parents=True)
        for name in ("index.html", "style.css", "README.md", "NOTICE"):
            (bonus / name).write_text("fixture: " + name)
        (bonus / "src/main.js").write_text(
            "import {entry} from '../../../src/main.js';\nexport {entry};\n"
        )
        src = self.root / "src"
        src.mkdir()
        (src / "main.js").write_text("export const entry = true;\n")
        for name in ("LICENSE", "NOTICE"):
            (self.root / name).write_text("fixture: " + name)
        source_tool = Path(__file__).resolve().parent.parent / "games/close-quarters/tools/package.py"
        (bonus / "tools").mkdir()
        (bonus / "tools/package.py").write_bytes(source_tool.read_bytes())
        self.assets = self.root / "premium/assets"
        (self.assets / "story").mkdir(parents=True)
        (self.assets / "music").mkdir(parents=True)

    def test_preview_is_reproducible_and_explicitly_not_for_sale(self):
        one, two = self.root / "a.zip", self.root / "b.zip"
        build(self.root, one, "preview")
        build(self.root, two, "preview")
        self.assertEqual(one.read_bytes(), two.read_bytes())
        verify(one)
        with zipfile.ZipFile(one) as z:
            self.assertIn("Story/STORY_PENDING.txt", z.namelist())
            self.assertIn("Music/MUSIC_PENDING.txt", z.namelist())
            self.assertEqual(json.loads(z.read("MANIFEST.json"))["edition"], "preview")
            self.assertIn(BONUS_MEMBER, z.namelist())
            self.assertEqual(z.namelist()[-1], BONUS_MEMBER,
                             "Secret bonus must appear after music/story")
            verify_bonus(z.read(BONUS_MEMBER))
            self.assertIn(b"AFTER THE MUSIC", z.read("START_HERE.txt"))

    def test_release_rejects_absent_or_bad_creative_assets(self):
        out = self.root / "release.zip"
        with self.assertRaises(ValueError):
            build(self.root, out, "release")
        (self.assets / "story/Fiction.epub").write_bytes(b"placeholder")
        (self.assets / "music/Theme.wav").write_bytes(b"fake music")
        with self.assertRaises(ValueError):
            build(self.root, out, "release")
        self.assertFalse(out.exists())

    def test_real_epub_and_pcm_audio_produce_a_release_without_placeholders(self):
        story = self.assets / "story/Fiction.epub"
        with zipfile.ZipFile(story, "w") as z:
            z.writestr("mimetype", "application/epub+zip")
            z.writestr("META-INF/container.xml", "<container/>")
        music = self.assets / "music/Theme.wav"
        with wave.open(str(music), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(22050)
            w.writeframes(b"\\x00\\x00" * 256)
        one, two = self.root / "a.zip", self.root / "b.zip"
        build(self.root, one, "release", self.assets)
        build(self.root, two, "release", self.assets)
        self.assertEqual(one.read_bytes(), two.read_bytes())
        with zipfile.ZipFile(one) as z:
            self.assertEqual(json.loads(z.read("MANIFEST.json"))["edition"], "release")
            self.assertFalse(any("PENDING" in n for n in z.namelist()))
            self.assertTrue(any(n.endswith("Fiction.epub") for n in z.namelist()))
            self.assertTrue(any(n.endswith("Theme.wav") for n in z.namelist()))
            self.assertEqual(z.namelist()[-1], BONUS_MEMBER)
            verify_bonus(z.read(BONUS_MEMBER))
        verify(one)

    def test_release_blocked_if_bonus_source_is_missing(self):
        (self.root / "games/close-quarters/src/main.js").unlink()
        with self.assertRaises((FileNotFoundError, ValueError)):
            build(self.root, self.root / "missing-bonus.zip", "preview")

    def test_source_change_invalidates_the_bonus_and_outer_receipt(self):
        one, two = self.root / "source-one.zip", self.root / "source-two.zip"
        build(self.root, one, "preview")
        (self.root / "src/main.js").write_text("export const entry = 42;\n")
        build(self.root, two, "preview")
        with zipfile.ZipFile(one) as a, zipfile.ZipFile(two) as b:
            self.assertNotEqual(a.read(BONUS_MEMBER), b.read(BONUS_MEMBER))
            self.assertNotEqual(a.read("MANIFEST.json"), b.read("MANIFEST.json"))
        self.assertNotEqual(one.read_bytes(), two.read_bytes())

    def test_repacked_bogus_bonus_is_rejected_even_with_matching_outer_receipt(self):
        original, altered = self.root / "original.zip", self.root / "altered.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as z:
            body = {n: z.read(n) for n in z.namelist()
                    if n not in ("MANIFEST.json", "SHA256SUMS")}
        body[BONUS_MEMBER] = b"not a playable archive"
        make_zip(body, altered, "preview")
        with self.assertRaises(ValueError):
            verify(altered)

    def test_nested_bonus_tampering_is_rejected_even_with_outer_receipts_updated(self):
        original, altered = self.root / "original.zip", self.root / "altered.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as z:
            body = {n: z.read(n) for n in z.namelist()
                    if n not in ("MANIFEST.json", "SHA256SUMS")}
        old = body[BONUS_MEMBER]
        with zipfile.ZipFile(io.BytesIO(old)) as nested:
            entries = {n: nested.read(n) for n in nested.namelist()}
        name = next(n for n in entries if n.endswith("games/close-quarters/src/main.js"))
        entries[name] += b"/* injected */"
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as nested:
            for name, data in sorted(entries.items()):
                nested.writestr(name, data)
        body[BONUS_MEMBER] = stream.getvalue()
        make_zip(body, altered, "preview")
        with self.assertRaises(ValueError):
            verify(altered)

    def test_symlink_cannot_leak_files_into_bundle(self):
        target = self.root / "secret.txt"
        target.write_text("DO NOT BUNDLE")
        (self.root / "dist/src/outside.txt").symlink_to(target)
        with self.assertRaises(ValueError):
            build(self.root, self.root / "bad.zip", "preview")

    def test_corrupt_manifest_or_body_is_rejected(self):
        original, altered = self.root / "original.zip", self.root / "altered.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as src, zipfile.ZipFile(altered, "w") as dst:
            for name in src.namelist():
                value = src.read(name)
                if name == "START_HERE.txt":
                    value += b"CHANGED"
                dst.writestr(name, value)
        with self.assertRaises(ValueError):
            verify(altered)

if __name__ == "__main__":
    unittest.main()
