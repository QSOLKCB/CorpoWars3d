"""CI-only packaged-game verification. uv run --with playwright==1.56.0 ..."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright
from device_smoke import run_device_checks

ROOT = Path(__file__).resolve().parent.parent
PREFIX = "/CorpoWars3d/"


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = "/" + self.path[len(PREFIX):]
        super().do_GET()

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "dist")))
threading.Thread(target=server.serve_forever, daemon=True).start()
out = ROOT / "test-results"
out.mkdir(exist_ok=True)
errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}{PREFIX}?qa")
        page.wait_for_function("window.corpowarsQA !== undefined")
        assert page.locator("#fatal").is_hidden()
        # This job explicitly tests the primary renderer, including shader compile.
        assert page.evaluate("!window.corpowarsQA.renderer.software"), "Native WebGL unavailable in CI"
        page.screenshot(path=str(out / "briefing.png"))
        page.get_by_role("button", name="03 / SYSTEM", exact=True).click()
        page.locator("#keyboard").check()
        page.get_by_role("button", name="01 / CONTRACTS", exact=True).click()
        page.locator("#deploy").click()
        page.wait_for_function("window.corpowarsQA.game.time > .5")
        assert page.evaluate("window.corpowarsQA.game.controlled") == 0
        page.keyboard.press("2")
        page.wait_for_function("window.corpowarsQA.game.controlled === 1")
        page.keyboard.press("Tab")
        assert page.locator("#tactical").is_visible()
        assert page.evaluate("window.corpowarsQA.game.controlled === null")
        page.locator("#selectAll").click()
        rect = page.locator("#tacticalMap").bounding_box()
        # Open east-west street near spawn; actual UI order, not a state mutation.
        px = (30 + 11.5 / 36 * 700) / 760
        py = (30 + 29.5 / 36 * 700) / 760
        page.mouse.click(rect["x"] + rect["width"] * px, rect["y"] + rect["height"] * py)
        page.wait_for_function("window.corpowarsQA.game.agents[0].x > 4.7")
        assert page.evaluate("window.corpowarsQA.game.agents.every(a => a.command === 'MOVE')")
        page.screenshot(path=str(out / "tactical.png"))
        page.keyboard.press("h")
        page.keyboard.press("v")
        page.wait_for_function("window.corpowarsQA.game.holdFire")
        page.keyboard.press("p")
        assert page.locator("#pause").is_hidden()
        assert page.locator("#tactical").is_visible()
        assert "PAUSED" in page.locator("#status").inner_text()
        frozen = page.evaluate("window.corpowarsQA.game.time")
        positions = page.evaluate("window.corpowarsQA.game.agents.map(a => [a.x, a.y])")
        page.locator("#squad .agent").nth(0).click()
        assert page.evaluate("[...window.corpowarsQA.game.selected]") == [0]
        page.keyboard.press("Tab")
        assert page.locator("#squad .agent").nth(1).evaluate("el => el === document.activeElement")
        page.keyboard.press("f")
        assert page.evaluate("window.corpowarsQA.game.follow.has(0)")
        # Mouse orders and keyboard orders remain usable without running a tick.
        py = (30 + 20.5 / 36 * 700) / 760
        page.mouse.click(rect["x"] + rect["width"] * px, rect["y"] + rect["height"] * py)
        assert page.evaluate("window.corpowarsQA.game.agents[0].path.length > 0")
        page.keyboard.press("h")
        assert page.evaluate("window.corpowarsQA.game.agents[0].path.length") == 0
        page.keyboard.press("g")
        assert page.evaluate("window.corpowarsQA.game.agents[0].path.length > 0")
        shots_before_planning = page.evaluate("window.corpowarsQA.game.shots")
        yaw_before_planning = page.evaluate("window.corpowarsQA.game.agents[1].yaw")
        page.keyboard.down("w")
        page.keyboard.down("Space")
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(200)
        page.keyboard.up("w")
        page.keyboard.up("Space")
        assert page.evaluate("window.corpowarsQA.game.time") == frozen
        assert page.evaluate("window.corpowarsQA.game.agents.map(a => [a.x, a.y])") == positions
        assert page.evaluate("window.corpowarsQA.game.shots") == shots_before_planning
        assert page.evaluate("window.corpowarsQA.game.agents[1].yaw") == yaw_before_planning
        page.screenshot(path=str(out / "paused-tactical.png"))
        page.keyboard.press("p")
        page.wait_for_function("value => window.corpowarsQA.game.time > value", arg=frozen)
        page.wait_for_function("point => { const a=window.corpowarsQA.game.agents[0]; return a.x !== point[0] || a.y !== point[1]; }", arg=positions[0])
        page.keyboard.press("h")
        page.keyboard.press("p")
        # Leaving the map while paused must retain pause in the direct view.
        page.locator("#returnFPS").click()
        assert page.locator("#pause").is_visible()
        assert page.evaluate("window.corpowarsQA.game.paused")
        page.locator("#resume").click()
        page.keyboard.press("1")
        page.wait_for_function("window.corpowarsQA.game.controlled === 0")
        # Resuming a direct agent does not silently keep squad orders moving it.
        page.keyboard.down("Space")
        page.wait_for_function("window.corpowarsQA.game.shots > 0")
        page.keyboard.up("Space")
        page.keyboard.press("r")
        page.wait_for_function("window.corpowarsQA.game.agents[0].reload > 0")
        page.wait_for_function("window.corpowarsQA.game.agents[0].reload <= 0")
        # Track mouse buttons independently; releasing LMB before RMB must stop.
        page.mouse.move(720, 400)
        page.mouse.down(button="right")
        page.mouse.down(button="left")
        page.wait_for_function("window.corpowarsQA.game.shots > 1")
        page.mouse.up(button="left")
        page.mouse.up(button="right")
        shots = page.evaluate("window.corpowarsQA.game.shots")
        page.wait_for_timeout(700)
        assert page.evaluate("window.corpowarsQA.game.shots") == shots
        page.screenshot(path=str(out / "fps.png"))
        telemetry = page.evaluate("({...window.corpowarsQA.renderer.stats, version: window.corpowarsQA.renderer.gl.getParameter(window.corpowarsQA.renderer.gl.VERSION)})")
        assert telemetry["draws"] == 4, telemetry
        uploads = telemetry["staticUploads"]
        page.wait_for_timeout(100)
        assert page.evaluate("window.corpowarsQA.renderer.stats.staticUploads") == uploads
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        assert page.evaluate("window.corpowarsQA.game.paused")
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        context.set_offline(True)
        page.reload()
        page.wait_for_function("window.corpowarsQA !== undefined")
        assert page.locator("#menu").is_visible()
        assert not errors, errors
        device_checks = run_device_checks(browser, f"http://127.0.0.1:{server.server_port}{PREFIX}?qa", out)
        result = {"passed": True, "renderer": telemetry, "page_errors": errors,
                  "checks": ["native WebGL shaders", "repository subpath", "deploy", "agent switch", "tactical all-AI",
                             "map movement", "hold and fire orders", "pause freeze", "paused tactical selection and orders",
                             "paused direct-input cancellation", "paused view transition", "manual fire and reload",
                             "overlapping mouse buttons", "static upload retention", "blur cancellation", "offline reload"] + device_checks}
        (out / "browser.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))
        context.close()
        browser.close()
finally:
    server.shutdown()
