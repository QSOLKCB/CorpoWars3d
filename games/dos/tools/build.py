#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build real-mode DOS COM using GCC's 16-bit code generator and GNU binutils.
No libc, DOS extender, package download or runtime installation is involved.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile
ROOT=Path(__file__).resolve().parents[1]


def build():
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    flags=['-m16','-march=i386','-Os','-std=c99','-ffreestanding','-fno-pic','-fno-pie','-fno-stack-protector','-fno-asynchronous-unwind-tables','-fno-unwind-tables','-fno-builtin','-fno-ident','-mpreferred-stack-boundary=2','-Wall','-Wextra','-Werror','-Wno-misleading-indentation']
    objects=[]
    for name in ['start.S','game.c','mod.c','hardware.c','render.c','main.c']:
        obj=out/(name.split('.')[0]+'.o');objects.append(str(obj))
        subprocess.run(['gcc',*flags,'-c',str(ROOT/'src'/name),'-o',str(obj)],check=True)
    subprocess.run(['ld','-m','elf_i386','--no-warn-rwx-segments','-T',str(ROOT/'src'/'dos.ld'),'-Map',str(out/'CORPO.MAP'),'-o',str(out/'CORPO.ELF'),*objects],check=True)
    subprocess.run(['objcopy','-O','binary',str(out/'CORPO.ELF'),str(out/'CORPO.COM')],check=True)
    for p in (ROOT/'music').glob('*.MOD'):shutil.copyfile(p,out/p.name)
    for name in ['DOSBOX.CONF','PLAY.BAT','README.TXT']:shutil.copyfile(ROOT/name,out/name)
    shutil.copyfile(ROOT.parents[1]/'LICENSE',out/'LICENSE.TXT')
    shutil.copyfile(ROOT/'docs'/'PROVENANCE.md',out/'NOTICE.TXT')
    members=['LICENSE.TXT','NOTICE.TXT','CORPO.COM','MENU.MOD','ACTION.MOD','BOSS.MOD','DOSBOX.CONF','PLAY.BAT','README.TXT']
    hashes={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in members}
    (out/'SHA256SUMS').write_text(''.join(f'{sha}  {name}\n' for name,sha in hashes.items()))
    with zipfile.ZipFile(out/'CORPO-DOS.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name in members+['SHA256SUMS']:
            info=zipfile.ZipInfo('CORPO-DOS/'+name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,(out/name).read_bytes())
    print(json.dumps({'com_bytes':(out/'CORPO.COM').stat().st_size,'zip_bytes':(out/'CORPO-DOS.zip').stat().st_size,'hashes':hashes},indent=2))
    return out

if __name__=='__main__':build()
