"""Safety, determinism and hard release-gate tests for Payhip packaging."""
# SPDX-License-Identifier: Apache-2.0
import hashlib
import io
import json
import sys
import tempfile
import unittest
from unittest import mock
import wave
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import package_payhip
from package_payhip import build, verify, BONUS_MEMBER, verify_bonus, make_zip, POSTSCRIPT_MEMBER

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

    def valid_creative(self):
        story = self.assets / "story/Fiction.epub"
        with zipfile.ZipFile(story, "w") as z:
            z.writestr("mimetype", "application/epub+zip")
            z.writestr("META-INF/container.xml", "<container/>")
        music = self.assets / "music/Theme.wav"
        with wave.open(str(music), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(22050)
            w.writeframes(bytes(512))

    @staticmethod
    def repack_nested(source: bytes, overrides=None, remove=(), resign=False) -> bytes:
        """Preserve canonical member metadata; change only selected payloads."""
        with zipfile.ZipFile(io.BytesIO(source)) as z:
            infos = [(info, z.read(info)) for info in z.infolist()]
        payloads = {info.filename: content for info, content in infos
                    if info.filename not in remove}
        payloads.update(overrides or {})
        if resign:
            prefix = "CORPOWARS-CLOSE-QUARTERS/"
            receipt = prefix + "SHA256SUMS.txt"
            payloads[receipt] = "".join(
                f"{hashlib.sha256(payload).hexdigest()}  {name[len(prefix):]}\n"
                for name, payload in sorted(payloads.items()) if name != receipt
            ).encode("ascii")
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as z:
            for info, _ in infos:
                if info.filename in payloads:
                    z.writestr(info, payloads[info.filename])
        return out.getvalue()

    def test_preview_is_reproducible_and_explicitly_not_for_sale(self):
        one, two = self.root / "a.zip", self.root / "b.zip"
        build(self.root, one, "preview")
        build(self.root, two, "preview")
        self.assertEqual(one.read_bytes(), two.read_bytes())
        verify(one, self.root)
        with zipfile.ZipFile(one) as z:
            self.assertIn("Story/STORY_PENDING.txt", z.namelist())
            self.assertIn("Music/MUSIC_PENDING.txt", z.namelist())
            self.assertEqual(json.loads(z.read("MANIFEST.json"))["edition"], "preview")
            self.assertIn(BONUS_MEMBER, z.namelist())
            self.assertEqual(z.namelist()[-1], BONUS_MEMBER,
                             "Secret bonus must appear after music/story")
            verify_bonus(z.read(BONUS_MEMBER))
            self.assertNotIn(b"CLOSE QUARTERS", z.read("START_HERE.txt"))
            self.assertNotIn(b"ZZ-POST-SOUNDTRACK", z.read("START_HERE.txt"))
            self.assertIn(b"CLOSE QUARTERS", z.read(POSTSCRIPT_MEMBER))

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
        self.valid_creative()
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
        verify(one, self.root)

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
            verify(altered, self.root)

    def test_nested_bonus_tampering_is_rejected_even_with_outer_receipts_updated(self):
        original, altered = self.root / "original.zip", self.root / "altered.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as z:
            body = {n: z.read(n) for n in z.namelist()
                    if n not in ("MANIFEST.json", "SHA256SUMS")}
        path = "CORPOWARS-CLOSE-QUARTERS/games/close-quarters/src/main.js"
        with zipfile.ZipFile(io.BytesIO(body[BONUS_MEMBER])) as nested:
            original_script = nested.read(path)
        body[BONUS_MEMBER] = self.repack_nested(
            body[BONUS_MEMBER], overrides={path: original_script + b"/* injected */"}
        )
        # Metadata remains canonical and outer receipts are regenerated. The
        # exact failure must come from the INNER SHA-256 receipt, not ZIP headers.
        make_zip(body, altered, "preview")
        with self.assertRaisesRegex(ValueError, "nested SHA-256 receipt mismatch"):
            verify(altered, self.root)

    def test_resigned_bonus_edit_and_removed_module_fail_source_authenticity(self):
        original, altered = self.root / "original.zip", self.root / "altered.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as z:
            body = {n: z.read(n) for n in z.namelist()
                    if n not in ("MANIFEST.json", "SHA256SUMS")}
        path = "CORPOWARS-CLOSE-QUARTERS/games/close-quarters/src/main.js"
        with zipfile.ZipFile(io.BytesIO(body[BONUS_MEMBER])) as nested:
            script = nested.read(path)
        for desc, changes, removed, error in (
            ("changed", {path: script + b"// changed\n"}, (), "differs from checked-out source"),
            ("missing", {}, (path,), "member set differs from checked-out source"),
        ):
            with self.subTest(case=desc):
                with zipfile.ZipFile(original) as pristine:
                    original_bonus = pristine.read(BONUS_MEMBER)
                body[BONUS_MEMBER] = self.repack_nested(
                    original_bonus,
                    overrides=changes, remove=removed, resign=True)
                # A self-consistent but malicious ZIP passes receipt-only checks.
                verify_bonus(body[BONUS_MEMBER])
                make_zip(dict(body), altered, "preview")
                with self.assertRaisesRegex(ValueError, error):
                    verify(altered, self.root)

    def test_checkout_mutation_during_bundle_creation_fails_closed(self):
        original = package_payhip.create_bonus
        target = self.root / "dist/src/main.js"

        def mutate_after_game_snapshot(root):
            target.write_text("export const entry = 'changed during build';")
            return original(root)

        out = self.root / "moving-checkout.zip"
        with mock.patch.object(package_payhip, "create_bonus", side_effect=mutate_after_game_snapshot):
            with self.assertRaisesRegex(ValueError, "changed during packaging"):
                build(self.root, out, "preview")
        self.assertFalse(out.exists())

    def test_linked_checkout_root_and_ancestor_are_rejected(self):
        alias = self.root / "linked-root"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Linked"):
            build(alias, self.root / "bad-linked.zip", "preview")
        # Link in an ancestor, not just at the --root leaf.
        directory = alias / "subtree"
        with self.assertRaisesRegex(ValueError, "Linked"):
            package_payhip.ensure_unlinked_path(directory)

    def test_release_verifier_checks_extensions_and_contents_after_resigning(self):
        self.valid_creative()
        original, altered = self.root / "real-release.zip", self.root / "forged-release.zip"
        build(self.root, original, "release", self.assets)
        with zipfile.ZipFile(original) as z:
            real = {n: z.read(n) for n in z.namelist()
                    if n not in ("MANIFEST.json", "SHA256SUMS")}
        cases = (
            ("unsupported", "Story/notes.txt", "Music/theme.bin", None, "supported"),
            ("broken_epub", "Story/Fiction.epub", "Music/Theme.wav",
             b"invalid epub", "EPUB"),
            ("broken_audio", "Story/Fiction.epub", "Music/Theme.wav",
             b"invalid audio", "WAV"),
            ("nested_story", "Story/deep/Fiction.epub", "Music/Theme.wav",
             None, "supported"),
        )
        for desc, story_name, music_name, invalid, expected in cases:
            with self.subTest(case=desc):
                body = {n: v for n, v in real.items()
                        if not n.startswith(("Story/", "Music/"))}
                body[story_name] = (invalid if desc == "broken_epub"
                                    else real["Story/Fiction.epub"])
                body[music_name] = (invalid if desc == "broken_audio"
                                    else real["Music/Theme.wav"])
                make_zip(body, altered, "release")
                with self.assertRaisesRegex(ValueError, expected):
                    verify(altered, self.root)

    def test_reordered_premium_archive_rejected_with_original_receipts(self):
        original, altered = self.root / "canonical.zip", self.root / "reversed.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as src, zipfile.ZipFile(altered, "w") as dst:
            for info in reversed(src.infolist()):
                dst.writestr(info, src.read(info))
        with self.assertRaisesRegex(ValueError, "unordered"):
            verify(altered, self.root)

    def test_symlink_metadata_in_nested_bonus_is_rejected(self):
        original, altered = self.root / "canonical.zip", self.root / "symlink-bonus.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as outer:
            entries = {n: outer.read(n) for n in outer.namelist()
                       if n not in ("MANIFEST.json", "SHA256SUMS")}
        stream = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(entries[BONUS_MEMBER])) as nested, zipfile.ZipFile(stream, "w") as dst:
            for info in nested.infolist():
                payload = nested.read(info)
                if info.filename.endswith("games/close-quarters/src/main.js"):
                    info.external_attr = 0o120777 << 16
                dst.writestr(info, payload)
        entries[BONUS_MEMBER] = stream.getvalue()
        # Re-sign every outer receipt: only the nested ZIP's file-type metadata
        # changes. Payload hashes alone must not make it appear safe to extract.
        make_zip(entries, altered, "preview")
        with self.assertRaisesRegex(ValueError, "Nonregular"):
            verify(altered, self.root)

    def test_symlink_metadata_in_outer_zip_is_rejected(self):
        original, altered = self.root / "canonical.zip", self.root / "symlink-outer.zip"
        build(self.root, original, "preview")
        with zipfile.ZipFile(original) as src, zipfile.ZipFile(altered, "w") as dst:
            for info in src.infolist():
                payload = src.read(info)
                if info.filename == "Browser-Game/src/main.js":
                    info.external_attr = 0o120777 << 16
                dst.writestr(info, payload)
        with self.assertRaisesRegex(ValueError, "Nonregular"):
            verify(altered, self.root)

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
            verify(altered, self.root)

if __name__ == "__main__":
    unittest.main()
