#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Packaged compact-operations Chromium smoke. Executed only in CI."""
from __future__ import annotations
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(os.environ['BONUS_ROOT']).resolve() if os.environ.get('BONUS_ROOT') else Path(__file__).resolve().parents[3]
if not (ROOT / 'games/close-quarters/index.html').is_file():
    raise RuntimeError(f'Invalid game root: {ROOT}')


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_: object) -> None:
        pass


@contextmanager
def server():
    web = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    worker = Thread(target=web.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{web.server_port}"
    finally:
        web.shutdown()
        web.server_close()
        worker.join(timeout=5)


def main():
    with server() as origin, sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
        )
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        errors = []
        outside = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda req: outside.append(req.url)
                if urlparse(req.url).netloc != urlparse(origin).netloc else None)
        page.goto(origin + "/games/close-quarters/index.html?qa", wait_until="networkidle")
        page.wait_for_function("Boolean(window.compactQA?.renderer)")
        assert page.locator(".sector").count() == 8
        assert page.locator(".sector:disabled").count() == 7
        page.locator("#launch").click()
        page.wait_for_function("window.compactQA?.active")
        assert page.evaluate("window.compactQA.game.world.size") == 24
        assert page.evaluate("window.compactQA.game.agents.length") == 4
        assert page.evaluate("window.compactQA.game.guards.length") == 6
        assert not page.locator("#fatal").is_visible()
        shots = os.environ.get('BONUS_SCREENSHOT_DIR')
        if shots:
            Path(shots).mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(Path(shots) / 'bonus-fps.png'))
        page.locator("#mapButton").click()
        assert page.locator("#mapPanel").is_visible()
        assert page.evaluate("window.compactQA.game.tactical") is True
        assert page.evaluate("window.compactQA.game.controlled") is None
        if shots:
            page.screenshot(path=str(Path(shots) / 'bonus-tactical.png'))
        page.locator("#closeMap").click()
        assert page.evaluate("window.compactQA.game.tactical") is False
        page.keyboard.press("p")
        assert page.locator("#pausePanel").is_visible(), "keyboard pause"
        page.locator("#resume").click()
        assert not page.locator("#pausePanel").is_visible()
        page.wait_for_timeout(180)
        assert page.evaluate("window.compactQA.game.time") > 0
        assert page.evaluate("window.compactQA.renderer.stats.draws") >= 1
        if os.environ.get("BONUS_ALL_SECTORS") == "1":
            # The private QA harness checks each of the eight authored scenes
            # without mutating real players' local saves or overriding progression
            # logic in the shipped runtime.
            page.evaluate("""() => localStorage.setItem(
                'corpowars-close-quarters-v1',
                JSON.stringify({version:1, unlocked:7, best:Array(8).fill(null)})
            )""")
            page.reload(wait_until="networkidle")
            page.wait_for_function("Boolean(window.compactQA?.renderer)")
            assert page.locator(".sector:disabled").count() == 0
            expected_enemy_rosters = [6, 8, 8, 9, 10, 11, 12, 9]
            for index, count in enumerate(expected_enemy_rosters):
                page.evaluate("(index) => window.compactQA.begin(index)", index)
                page.wait_for_function(
                    "(index) => window.compactQA.game?.bonus.sector === index",
                    arg=index,
                )
                assert page.evaluate("window.compactQA.game.world.size") == 24
                assert page.evaluate("window.compactQA.game.guards.length") == count
                assert page.evaluate("window.compactQA.game.agents.length") == 4
                assert page.evaluate("window.compactQA.game.phase") == "active"
                page.wait_for_timeout(50)
                assert page.evaluate("window.compactQA.renderer.stats.draws") >= 1
                assert not page.locator("#fatal").is_visible()
            print("BONUS EIGHT-SECTOR SMOKE: all 8 playable author layouts, renderer and rosters PASS")
        assert not errors, f"Browser errors: {errors}"
        assert not outside, f"Nonlocal requests: {outside}"
        browser.close()
        print("BONUS SMOKE: 8-sector board, 24x24 gameplay, map, pause, renderer, offline requests PASS")


if __name__ == "__main__":
    main()
