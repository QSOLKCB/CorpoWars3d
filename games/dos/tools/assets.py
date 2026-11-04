#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Original, authored game assets. No samples, fonts or recordings are imported.
E8 coordinates are doubled integers. This is interpretive music, not ETQ-101's
canonical scientific sonification. See docs/PROVENANCE.md for donor references.
"""
import hashlib
import itertools
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
PERIODS = [856,808,762,720,678,640,604,570,538,508,480,453,
           428,404,381,360,339,320,302,285,269,254,240,226,
           214,202,190,180,170,160,151,143,135,127,120,113]


def roots_e8():
    roots = []
    for i,j in itertools.combinations(range(8), 2):
        for a,b in itertools.product((-2,2), repeat=2):
            v=[0]*8;v[i]=a;v[j]=b;roots.append(tuple(v))
    roots += [v for v in itertools.product((-1,1), repeat=8) if v.count(-1)%2==0]
    assert len(set(roots))==240 and all(sum(x*x for x in v)==8 for v in roots)
    return roots


def walk(seed, count):
    roots=roots_e8()
    neighbors=[[j for j,b in enumerate(roots) if sum(x*y for x,y in zip(a,b))==4] for a in roots]
    assert all(len(n)==56 for n in neighbors)
    result=[];at=seed%240
    for _ in range(count):
        result.append(roots[at]);seed=(1664525*seed+1013904223)&0xffffffff
        at=neighbors[at][seed%56]
    return result


def samples():
    # Single-cycle harmonic loops plus decaying mathematical percussion.
    tau=2*math.pi
    defs=[]
    for name, length, volume, loop in [('FM BASS',64,42,True),('E8 GLASS',64,24,True),('KICK',1024,54,False),('SNARE',1024,36,False),('HAT',512,18,False),('PAD',64,16,True)]:
        values=[];rng=0xE800+length
        for i in range(length):
            t=i/8287;phase=tau*i/length
            rng=(1664525*rng+1013904223)&0xffffffff;noise=((rng>>8)/8388608)-1
            if name=='FM BASS': value=math.sin(phase+0.65*math.sin(2*phase))
            elif name=='E8 GLASS': value=(math.sin(phase)+0.3*math.sin(3*phase)+0.15*math.sin(7*phase))/1.45
            elif name=='PAD': value=(math.sin(phase)+0.4*math.sin(2*phase))/1.4
            elif name=='KICK': value=math.sin(tau*(45*t+100*(1-math.exp(-35*t))/35))*math.exp(-32*t)
            elif name=='SNARE': value=(noise*0.7+0.3*math.sin(tau*180*t))*math.exp(-27*t)
            else: value=(0.75*noise+0.25*math.sin(tau*3100*t))*math.exp(-60*t)
            if not loop: value*=min(1,i/8)*min(1,(length-1-i)/32)
            values.append(max(-127,min(127,round(value*112))))
        defs.append((name,bytes(v&255 for v in values),volume,loop))
    return defs


def event(instrument=0, note=None, effect=0, parameter=0):
    p=0 if note is None else PERIODS[note]
    return bytes([(instrument&0xf0)|(p>>8),p&255,((instrument&15)<<4)|effect,parameter])


def module(title, seed, tempo):
    instruments=samples();data=bytearray(title.encode('ascii').ljust(20,b'\0'))
    for i in range(31):
        if i<len(instruments):
            name,sample,vol,loop=instruments[i]
            data+=name.encode().ljust(22,b'\0')+struct.pack('>HBBHH',len(sample)//2,0,vol,0,len(sample)//2 if loop else 1)
        else: data+=bytes(30)
    data+=bytes([8,0])+bytes([0,1,0,2,0,1,3,2])+bytes(120)+b'M.K.'
    roots=walk(seed,128);scale=[0,3,5,7,10];weights=[1,-1,2,-2,3,-3,5,-5]
    for pattern in range(4):
        for row in range(64):
            chord=[0,5,3,7][pattern];r=roots[pattern*32+row//2]
            degree=abs(sum(x*w for x,w in zip(r,weights)))%10
            note=12+scale[degree%5]+(12 if degree>=5 else 0)
            bass=(chord+(12 if row%16==12 else 0))%24
            ch=[event(),event(),event(),event()]
            if row%4==0:ch[0]=event(1,bass)
            if row%4==0 or (pattern==3 and row%2==0):ch[1]=event(2,note)
            if row%16 in (0,8):ch[2]=event(3,12)
            if row%16 in (4,12):ch[2]=event(4,12)
            if row%2==0:ch[3]=event(5,12)
            if row%16==15:ch[3]=event(6,12+chord)
            if row==0:ch[3]=event(5,12,15,tempo)
            data+=b''.join(ch)
    for _,sample,_,_ in instruments:data+=sample
    return bytes(data)

# Hand-authored 5x7 bitmap lettering, stored as five column masks per glyph.
GLYPHS={
'A':['01110','10001','10001','11111','10001','10001','10001'],
'B':['11110','10001','10001','11110','10001','10001','11110'],
'C':['01111','10000','10000','10000','10000','10000','01111'],
'D':['11110','10001','10001','10001','10001','10001','11110'],
'E':['11111','10000','10000','11110','10000','10000','11111'],
'F':['11111','10000','10000','11110','10000','10000','10000'],
'G':['01111','10000','10000','10111','10001','10001','01110'],
'H':['10001','10001','10001','11111','10001','10001','10001'],
'I':['11111','00100','00100','00100','00100','00100','11111'],
'J':['00111','00010','00010','00010','10010','10010','01100'],
'K':['10001','10010','10100','11000','10100','10010','10001'],
'L':['10000','10000','10000','10000','10000','10000','11111'],
'M':['10001','11011','10101','10101','10001','10001','10001'],
'N':['10001','11001','10101','10011','10001','10001','10001'],
'O':['01110','10001','10001','10001','10001','10001','01110'],
'P':['11110','10001','10001','11110','10000','10000','10000'],
'Q':['01110','10001','10001','10001','10101','10010','01101'],
'R':['11110','10001','10001','11110','10100','10010','10001'],
'S':['01111','10000','10000','01110','00001','00001','11110'],
'T':['11111','00100','00100','00100','00100','00100','00100'],
'U':['10001','10001','10001','10001','10001','10001','01110'],
'V':['10001','10001','10001','10001','10001','01010','00100'],
'W':['10001','10001','10001','10101','10101','11011','10001'],
'X':['10001','10001','01010','00100','01010','10001','10001'],
'Y':['10001','10001','01010','00100','00100','00100','00100'],
'Z':['11111','00001','00010','00100','01000','10000','11111'],
'0':['01110','10001','10011','10101','11001','10001','01110'],
'1':['00100','01100','00100','00100','00100','00100','01110'],
'2':['01110','10001','00001','00010','00100','01000','11111'],
'3':['11110','00001','00001','01110','00001','00001','11110'],
'4':['00010','00110','01010','10010','11111','00010','00010'],
'5':['11111','10000','10000','11110','00001','00001','11110'],
'6':['01110','10000','10000','11110','10001','10001','01110'],
'7':['11111','00001','00010','00100','01000','01000','01000'],
'8':['01110','10001','10001','01110','10001','10001','01110'],
'9':['01110','10001','10001','01111','00001','00001','01110'],
'-':['00000','00000','00000','11111','00000','00000','00000'],
':':['00000','00100','00100','00000','00100','00100','00000'],
'/':['00001','00001','00010','00100','01000','10000','10000'],
'.':['00000','00000','00000','00000','00000','00100','00100'],
'!':['00100','00100','00100','00100','00100','00000','00100'],
'>':['10000','01000','00100','00010','00100','01000','10000'],
}


def graphics():
    palette=[(7,9,19),(13,17,32),(21,27,43),(32,42,58),(48,60,75),(72,83,96),(110,126,137),(168,193,198),
             (225,240,223),(30,114,140),(34,207,207),(148,248,218),(138,42,73),(225,66,92),(246,138,116),(250,208,134),
             (70,57,112),(120,79,159),(176,116,202),(222,165,236),(44,84,68),(70,145,92),(139,209,111),(204,246,142),
             (84,49,39),(139,78,46),(208,126,54),(246,193,85),(22,25,37),(46,48,63),(95,99,117),(0,0,0)]
    pal=bytes(c//4 for color in palette for c in color)
    font=bytes(sum((1<<y) for y,row in enumerate(GLYPHS.get(chr(c),['00000']*7)) if row[x]=='1') for c in range(32,91) for x in range(5))
    sprites=[]
    for frame in range(2):
        p=[0]*384
        def rect(x,y,w,h,color):
            for yy in range(y,y+h):
                for xx in range(x,x+w):p[yy*16+xx]=color
        rect(4,1,7,6,3);rect(5,2,6,3,7);rect(6,4,6,2,10);rect(5,6,5,2,14)
        rect(3,8,8,9,30);rect(4,9,2,6,7);rect(8,8,3,4,30)
        rect(7,11,8,3,4);rect(12,11,4,2,7);rect(5,12,4,2,14)
        rect(3,17,4,5,3);rect(8,17,3,5,4)
        rect(2 if frame else 3,21,5,2,7);rect(9 if frame else 8,21 if frame else 22,5,2,6)
        sprites+=p
    return pal,font,bytes(sprites)


def c_array(name,data):
    lines=[f'static const u8 {name}[{len(data)}]={{']
    lines += [','.join(str(v) for v in data[i:i+32])+',' for i in range(0,len(data),32)]
    return '\n'.join(lines+['};'])


def generate(target=ROOT):
    (target/'assets').mkdir(parents=True,exist_ok=True);(target/'music').mkdir(parents=True,exist_ok=True)
    pal,font,sprites=graphics()
    header='/* SPDX-License-Identifier: Apache-2.0; generated by tools/assets.py */\n'+ '\n'.join(c_array(k,v) for k,v in [('palette',pal),('font',font),('sprites',sprites)])+'\n'
    (target/'assets'/'graphics.h').write_text(header)
    receipt={'format':'M.K. / four channels / signed 8-bit samples','mix_hz':11025,'roots':240,'neighbors_per_root':56,'tracks':{}}
    for filename,title,seed,tempo in [('MENU.MOD','CORPO // INFILTRATE',0xE8,112),('ACTION.MOD','CORPO // DIVIDEND',0xC0FFEE,132),('BOSS.MOD','CORPO // LIQUIDATE',0xB055,148)]:
        data=module(title,seed,tempo);(target/'music'/filename).write_bytes(data)
        receipt['tracks'][filename]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'seed':seed,'bpm':tempo,'patterns':4,'orders':8,'samples':6}
    receipt['graphics_sha256']=hashlib.sha256(header.encode()).hexdigest()
    (target/'assets'/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt

if __name__=='__main__':
    print(json.dumps(generate(),indent=2))
