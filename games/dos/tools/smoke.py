#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Execute the real COM under DOSBox; inspect DOS-written VGA/DMA evidence.
/TEST injects deterministic game commands, not physical keyboard events.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import zlib
from assets import ROOT,graphics


def png(raw, path):
    assert len(raw)==64000 and max(raw)<32
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data))
    rows=b''.join(b'\0'+raw[y*320:y*320+320] for y in range(200))
    palette=bytes(v*4 for v in graphics()[0])
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,3,0,0,0))+chunk(b'PLTE',palette)+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))


def smoke(dosbox):
    out=ROOT/'dist';evidence=out/'evidence';evidence.mkdir(exist_ok=True)
    config=(ROOT/'DOSBOX.CONF').read_text();config=config[:config.index('[autoexec]')]
    result={}
    # A second run in the same DOS session exercises restored IRQ/PIT handlers.
    for label,blaster,music in [('sb16','A220 I5 D1 H5 T6',True),('silent','A220 I7 D1 H6 T6',True),('missing','A220 I5 D1 H5 T6',False),('corrupt','A220 I5 D1 H5 T6',True)]:
        with tempfile.TemporaryDirectory(prefix='corpo-dos-') as tmp:
            run=Path(tmp);shutil.copyfile(out/'CORPO.COM',run/'CORPO.COM')
            if music:
                for name in ['MENU.MOD','ACTION.MOD','BOSS.MOD']:shutil.copyfile(out/name,run/name)
            if label=='corrupt':
                for name in ['MENU.MOD','ACTION.MOD','BOSS.MOD']:(run/name).write_bytes(b'M.K. truncated')
            commands=f'[autoexec]\nmount c .\nc:\nset BLASTER={blaster}\ncorpo.com /TEST\n'
            if label=='sb16':commands+='copy SMOKE.BIN FIRST.BIN\ncorpo.com /TEST\n'
            commands+='exit\n';(run/'TEST.CONF').write_text(config+commands)
            env=dict(os.environ,SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy')
            proc=subprocess.run([dosbox,'-conf','TEST.CONF'],cwd=run,env=env,capture_output=True,text=True,timeout=60)
            (evidence/(label+'.log')).write_text(proc.stdout+proc.stderr)
            assert proc.returncode==0,(label,proc.returncode,proc.stderr)
            values=struct.unpack('<16I',(run/'SMOKE.BIN').read_bytes())
            magic,frames,ticks,irqs,rows,audio,x,active,cooldown,paused,order,steps,kills,loaded,_,_=values
            assert magic==0x43574431 and frames==211 and ticks>=422 and steps==168 and paused==0
            assert active==1 and 0<cooldown<525
            if label=='sb16':
                assert irqs>180 and rows>0 and audio==1 and loaded==7,values
                first=struct.unpack('<16I',(run/'FIRST.BIN').read_bytes());assert first[3]>180 and first[5]==1
                pcm=(run/'AUDIO.RAW').read_bytes();samples=struct.unpack('<512h',pcm)
                assert max(map(abs,samples))>500 and len(set(samples))>30
                (evidence/'DMA.RAW').write_bytes(pcm)
            else:assert audio==0 and irqs==0 and loaded==(7 if label=='silent' else 0),values
            for name in ['TITLE','PLAY','PAUSE','BOSS']:
                raw=(run/(name+'.RAW')).read_bytes();assert len(set(raw))>=7
                if label=='sb16':png(raw,evidence/(name.lower()+'.png'))
            result[label]={'frames':frames,'timer_ticks':ticks,'audio_irqs':irqs,'tracker_rows':rows,'audio_enabled':bool(audio),'loaded_tracks_mask':loaded,'simulation_steps':steps}
    result['binary_sha256']=hashlib.sha256((out/'CORPO.COM').read_bytes()).hexdigest()
    result['scope']='DOSBox 0.74 software VGA/SB16, scripted game commands. Physical hardware and physical keyboard latency not measured.'
    (evidence/'smoke.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--dosbox',default='dosbox');args=parser.parse_args();smoke(args.dosbox)
