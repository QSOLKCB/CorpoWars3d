#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from assets import ROOT,generate,roots_e8,walk


def check():
    # Rebuild every committed asset. A recipe edit must update the asset too.
    with tempfile.TemporaryDirectory() as tmp:
        generated=Path(tmp);generate(generated)
        for rel in ['assets/graphics.h','assets/manifest.json','music/MENU.MOD','music/ACTION.MOD','music/BOSS.MOD']:
            assert (generated/rel).read_bytes()==(ROOT/rel).read_bytes(),f'stale generated asset: {rel}'
    assert len(roots_e8())==240 and walk(232,100)==walk(232,100)
    steps=walk(232,100)
    assert all(sum(x*y for x,y in zip(a,b))==4 for a,b in zip(steps,steps[1:]))
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    flags=['-std=c99','-O2','-Wall','-Wextra','-Werror','-Wno-misleading-indentation','-fsanitize=address,undefined','-fno-omit-frame-pointer']
    env=dict(os.environ);env['ASAN_OPTIONS']='detect_leaks=0'  # no heap in engine; restricted runners cannot inspect /proc
    for test,source,args in [('core','game',[]),('music','mod',[str(ROOT/'music'/name) for name in ['MENU.MOD','ACTION.MOD','BOSS.MOD']])]:
        exe=out/(test+'-test');subprocess.run(['gcc',*flags,str(ROOT/'tests'/(test+'.c')),str(ROOT/'src'/(source+'.c')),'-o',str(exe)],check=True)
        subprocess.run([str(exe),*args],env=env,check=True)
    print('PASS: assets match their deterministic recipes; exact E8 root/edge invariants')

if __name__=='__main__':check()
