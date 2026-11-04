"""Standard Gamepad and touch emulation through the shipped browser entrypoint."""
import math


def run_device_checks(browser, url, out):
    errors = []
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    context.add_init_script("""window.testPads=[];
      Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPads});""")
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_function("window.corpowarsQA !== undefined")
    page.locator('[data-tab="settings"]').click()
    page.locator('#keyboard').check()
    page.locator('[data-tab="contracts"]').click()
    page.locator('#deploy').click()
    page.bring_to_front()

    def pad(buttons=None, axes=None):
        page.evaluate("""({buttons,axes})=>{window.testPads=[{index:0,id:'Emulated Xbox',connected:true,mapping:'standard',
          axes:axes||[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({value:buttons.includes(i)?1:0,pressed:buttons.includes(i)}))}];}""",
                      {"buttons": buttons or [], "axes": axes})

    def neutral():
        pad()
        page.wait_for_function("window.corpowarsQA.devices.pad.ready")

    def press(button):
        pad([button])
        page.wait_for_timeout(120)
        neutral()

    neutral()
    pad([9])  # First device handoff consumes input until neutral.
    page.wait_for_function("window.corpowarsQA.devices.source === 'gamepad'")
    neutral()
    before = page.evaluate("({x:corpowarsQA.game.agents[0].x,yaw:corpowarsQA.game.agents[0].yaw})")
    pad(axes=[.6, 0, .5, 0])
    page.wait_for_function("old=>Math.abs(corpowarsQA.game.agents[0].x-old.x)>.02 && corpowarsQA.game.agents[0].yaw!==old.yaw", arg=before)
    neutral()
    shots = page.evaluate("corpowarsQA.game.shots")
    pad([6, 7])
    page.wait_for_function("n=>corpowarsQA.game.shots>n && corpowarsQA.game.ads>.2", arg=shots)
    neutral()
    press(3)
    assert page.evaluate("corpowarsQA.game.viewId") == 1
    press(4)
    assert page.evaluate("corpowarsQA.game.tactical")
    press(9)
    assert page.evaluate("corpowarsQA.game.paused")
    frozen = page.evaluate("corpowarsQA.game.time")
    press(5)  # All agents.
    pad(axes=[.8, 0, 0, 0])
    page.wait_for_timeout(350)
    neutral()
    press(0)  # Order at controller cursor, while paused.
    assert page.evaluate("corpowarsQA.game.agents.some(a=>a.path.length>0)")
    assert page.evaluate("corpowarsQA.game.time") == frozen
    # Paused tactical controls are focusable and RT invokes the focused action.
    press(13)
    assert page.evaluate("document.activeElement.closest('#hud') !== null")
    page.screenshot(path=str(out / 'controller-planning.png'))
    press(1)
    assert not page.evaluate("corpowarsQA.game.tactical")
    assert page.evaluate("corpowarsQA.game.paused")
    press(9)
    page.wait_for_function("!corpowarsQA.game.paused")
    pad([7])
    page.wait_for_timeout(100)
    page.evaluate("window.testPads=[]")
    page.wait_for_function("corpowarsQA.game.paused")
    shots = page.evaluate("corpowarsQA.game.shots")
    page.wait_for_timeout(200)
    assert page.evaluate("corpowarsQA.game.shots") == shots
    context.close()

    mobile = browser.new_context(viewport={"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = mobile.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_function("window.corpowarsQA !== undefined")
    page.locator('#deploy').tap()
    page.wait_for_selector('#touchOverlay', state='visible')
    assert page.evaluate("document.pointerLockElement === null")
    # CDP sends genuine multi-touch input; no direct input/simulation mutation.
    cdp = mobile.new_cdp_session(page)
    move = page.locator('#movePad').bounding_box()
    fire = page.locator('[data-touch="fire"]').bounding_box()
    x, y = move['x'] + move['width']/2, move['y'] + move['height']/2
    fx, fy = fire['x'] + fire['width']/2, fire['y'] + fire['height']/2

    def touches(kind, points):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [dict(id=i, x=px, y=py, radiusX=2, radiusY=2, force=1) for i, px, py in points]})

    pose = page.evaluate("({x:corpowarsQA.game.agents[0].x,y:corpowarsQA.game.agents[0].y,yaw:corpowarsQA.game.agents[0].yaw,shots:corpowarsQA.game.shots})")
    touches('touchStart', [(1, x, y), (2, fx, fy)])
    touches('touchMove', [(1, x, y-35), (2, fx-20, fy)])
    page.wait_for_function("p=>{const g=corpowarsQA.game,a=g.agents[0];return g.shots>p.shots && a.yaw!==p.yaw && Math.hypot(a.x-p.x,a.y-p.y)>.02;}", arg=pose)
    touches('touchCancel', [])
    page.wait_for_function("corpowarsQA.devices.touch.pointers.size===0")
    shots = page.evaluate("corpowarsQA.game.shots")
    page.wait_for_timeout(650)
    assert page.evaluate("corpowarsQA.game.shots") == shots
    page.screenshot(path=str(out / 'mobile-fps-landscape.png'))
    page.locator('[data-action="map"]').tap()
    page.locator('#pauseButton').tap()
    assert page.locator('#pause').is_hidden()
    assert 'PAUSED' in page.locator('#tacticalFeed').inner_text()
    page.locator('#squad .agent').nth(0).tap()
    page.locator('#selectMultiple').tap()
    page.locator('#squad .agent').nth(1).tap()
    assert page.evaluate('[...corpowarsQA.game.selected]') == [0, 1]
    rect = page.locator('#tacticalMap').bounding_box()
    page.touchscreen.tap(rect['x'] + rect['width']*(30+11.5/36*700)/760, rect['y'] + rect['height']*(30+29.5/36*700)/760)
    assert page.evaluate('corpowarsQA.game.agents[0].path.length>0')
    for id in ['selectAll', 'pilotSelected', 'mapAttack', 'pauseButton']:
        r = page.locator('#'+id).bounding_box()
        assert r and r['width'] >= 30 and r['height'] >= 24, (id, r)
        assert r['x'] >= 0 and r['y'] >= 0 and r['x']+r['width'] <= 845 and r['y']+r['height'] <= 391, (id, r)
    page.screenshot(path=str(out / 'mobile-map-landscape.png'))
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(out / 'mobile-map-portrait.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('#pilotSelected').tap()
    page.locator('#resume').tap()
    page.screenshot(path=str(out / 'mobile-fps-portrait.png'))
    assert page.locator('#touchOverlay').is_visible()
    assert not errors, errors
    mobile.close()
    return ['Xbox analog move/look', 'Xbox aim/fire/switch', 'Xbox paused map orders', 'Xbox disconnect cancellation',
            'multi-touch move/fire/look', 'touch cancellation', 'mobile tactical selection/orders', 'landscape/portrait layouts']
