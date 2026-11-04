/* SPDX-License-Identifier: Apache-2.0 */
#include "mod.h"
static u16 be16(const u8 *p) { return (u16)((p[0]<<8)|p[1]); }
static void zero(void *p, u32 n) { u8 *b=p; while(n--) *b++=0; }
static void row(Module *m) {
    const u8 *p=m->data+1084+(u32)m->data[952+m->order]*1024+(u32)m->row*16;
    for(int c=0;c<4;c++,p+=4) {
        Voice *v=&m->voice[c]; u8 s=(p[0]&0xf0)|(p[2]>>4), fx=p[2]&15;
        u16 period=((p[0]&15)<<8)|p[1];
        if(s) { v->sample=&m->sample[s-1]; v->volume=v->sample->volume; }
        if(period) { v->pos=0; v->step=((3546895u*256u/period)*256u)/MOD_RATE; }
        if(fx==12) v->volume=p[3];
        if(fx==15) { if(p[3]<=32) m->speed=p[3]; else m->bpm=p[3]; }
    }
    m->rows++;
}
int mod_load(Module *m, const u8 *d, u32 n) {
    zero(m,sizeof(*m));
    if(n<1084 || n>MOD_CAP || d[1080]!='M' || d[1081]!='.' || d[1082]!='K' || d[1083]!='.') return 0;
    u32 patterns=0, offset;
    if(!d[950] || d[950]>128) return 0;
    for(u32 i=0;i<d[950];i++) { if(d[952+i]>7) return 0; if(d[952+i]>=patterns) patterns=d[952+i]+1; }
    offset=1084+patterns*1024;
    if(offset>n) return 0;
    for(u32 i=0;i<31;i++) {
        const u8 *h=d+20+i*30; Sample *s=&m->sample[i];
        s->length=(u32)be16(h+22)*2; s->loop=(u32)be16(h+26)*2;
        u32 loop_length=(u32)be16(h+28)*2;
        s->end=loop_length>2 ? s->loop+loop_length : 0;
        if(h[24] || h[25]>64 || s->end>s->length || offset+s->length>n) return 0;
        s->data=(const i8 *)d+offset; s->volume=h[25]; offset+=s->length;
    }
    if(offset!=n) return 0;
    for(u32 i=1084;i<1084+patterns*1024;i+=4) {
        u8 s=(d[i]&0xf0)|(d[i+2]>>4), fx=d[i+2]&15, p=d[i+3];
        u16 period=((d[i]&15)<<8)|d[i+1];
        if(s>31 || (s && !m->sample[s-1].length) || (period && (period<113 || period>856))) return 0;
        if(!((fx==0 && p==0) || (fx==12 && p<=64) || (fx==15 && p))) return 0;
    }
    m->data=d; m->orders=d[950]; m->bpm=125; m->speed=6; m->valid=1; row(m); return 1;
}
i16 mod_next(Module *m) {
    if(!m->valid) return 0;
    i32 value=0;
    for(int c=0;c<4;c++) {
        Voice *v=&m->voice[c]; const Sample *s=v->sample;
        if(!s || !v->step) continue;
        u32 index=v->pos>>16;
        if(s->end && index>=s->end) {
            v->pos=(s->loop<<16)+(v->pos-(s->end<<16))%((s->end-s->loop)<<16); index=v->pos>>16;
        }
        if(index<s->length) { value+=s->data[index]*v->volume; v->pos+=v->step; }
    }
    m->phase+=(u32)m->bpm*2;
    if(m->phase>=MOD_RATE*5u) {
        m->phase-=MOD_RATE*5u;
        if(++m->tick>=m->speed) {
            m->tick=0;
            if(++m->row==64) { m->row=0; if(++m->order==m->orders) m->order=0; }
            row(m);
        }
    }
    /* 4 * signed 8-bit * volume <= 64 fits signed 16-bit exactly. */
    return (i16)value;
}
