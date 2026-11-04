/* SPDX-License-Identifier: Apache-2.0 */
#include "hardware.h"
#include "game.h"
volatile u32 timer_ticks,audio_irqs;
volatile u8 keys[128];
u16 frame_seg;
u8 audio_ok,muted,audio_paused;
Module music;
u8 module_data[MOD_CAP+1];
u32 module_size;
extern u32 old_timer,old_keyboard,old_sound;
extern void timer_isr(void),keyboard_isr(void),sound_isr(void);
static u16 dma_block,dma_seg,sb_base;
static u8 sb_irq,sb_dma,old_pic,half,fx_ticks;
static u8 hooks;
static u16 cs(void){u16 s;__asm__("movw %%cs,%0":"=r"(s));return s;}
static u32 vector(u8 n){u32 ax=0x3500|n,bx=0;u16 es;__asm__ volatile("pushw %%es;int $0x21;movw %%es,%2;popw %%es":"+a"(ax),"=b"(bx),"=r"(es)::"memory","cc");return ((u32)es<<16)|(bx&65535);}
static void set_vector(u8 n,u32 address){u32 ax=0x2500|n,dx=address&65535;u16 seg=(u16)(address>>16);__asm__ volatile("pushw %%ds;movw %2,%%ds;int $0x21;popw %%ds":"+a"(ax),"+d"(dx):"r"(seg):"memory","cc");}
static u16 alloc(u16 paragraphs){u32 ax=0x4800,bx=paragraphs;u8 err;__asm__ volatile("int $0x21;setc %0":"=qm"(err),"+a"(ax),"+b"(bx)::"memory","cc");return err?0:(u16)ax;}
static void release(u16 s){if(!s)return;u32 ax=0x4900;__asm__ volatile("pushw %%es;movw %1,%%es;int $0x21;popw %%es":"+a"(ax):"r"(s):"memory","cc");}
static u8 far_byte(u16 seg,u32 offset){u8 b;__asm__ volatile("pushw %%es;movw %1,%%es;movb %%es:(%2),%0;popw %%es":"=q"(b):"r"(seg),"r"(offset):"memory");return b;}
static int read_file(const char *name,u8 *data,u16 cap){
    u32 ax=0x3d00,dx=(u32)name;u8 err;
    __asm__ volatile("int $0x21;setc %0":"=qm"(err),"+a"(ax),"+d"(dx)::"memory","cc");if(err)return 0;
    u32 handle=ax&65535,bx=handle,cx=cap;dx=(u32)data;ax=0x3f00;
    __asm__ volatile("int $0x21;setc %0":"=qm"(err),"+a"(ax),"+b"(bx),"+c"(cx),"+d"(dx)::"memory","cc");
    int count=err?0:(int)(ax&65535);ax=0x3e00;bx=handle;
    __asm__ volatile("int $0x21":"+a"(ax),"+b"(bx)::"memory","cc");return count;
}
static u16 create_file(const char *name){u32 ax=0x3c00,cx=0,dx=(u32)name;u8 err;__asm__ volatile("int $0x21;setc %0":"=qm"(err),"+a"(ax),"+c"(cx),"+d"(dx)::"memory","cc");return err?0xffff:(u16)ax;}
static void write_file(u16 h,u16 seg,const void *data,u16 size){u32 ax=0x4000,bx=h,cx=size,dx=(u32)data;__asm__ volatile("pushw %%ds;movw %4,%%ds;int $0x21;popw %%ds":"+a"(ax),"+b"(bx),"+c"(cx),"+d"(dx):"r"(seg):"memory","cc");}
static void close_file(u16 h){u32 ax=0x3e00,bx=h;__asm__ volatile("int $0x21":"+a"(ax),"+b"(bx)::"memory","cc");}
void save_file(const char *name,const void *data,u16 size){u16 h=create_file(name);if(h!=0xffff){write_file(h,cs(),data,size);close_file(h);}}
void save_audio(const char *name){u16 h=create_file(name);if(h!=0xffff){write_file(h,dma_seg,0,1024);close_file(h);}}
void save_frame(const char *name){u16 h=create_file(name);if(h!=0xffff){write_file(h,frame_seg,0,64000);close_file(h);}}
int command_test(void){u16 s=cs();u8 n=far_byte(s,0x80);for(int i=1;i<n;i++)if(far_byte(s,0x80+i)=='/'&&(far_byte(s,0x81+i)=='T'||far_byte(s,0x81+i)=='t'))return 1;return 0;}
static int dsp(u8 b){for(u32 i=0;i<65535;i++)if(!(in(sb_base+12)&128)){out(sb_base+12,b);return 1;}return 0;}
static int dsp_read(void){for(u32 i=0;i<65535;i++)if(in(sb_base+14)&128)return in(sb_base+10);return -1;}
/* Honor BLASTER; only primary-PIC IRQ 5/7 and DMA 5/6/7 are supported. */
static int blaster(void){
    u16 env=(u16)(far_byte(cs(),0x2c)|((u16)far_byte(cs(),0x2d)<<8));u32 p=0;sb_base=0;sb_irq=sb_dma=0;
    while(p<32760){if(!far_byte(env,p))break;u32 start=p;
        while(p<32760&&far_byte(env,p))p++;
        const char *tag="BLASTER=";int match=1;for(int i=0;i<8;i++)if(far_byte(env,start+i)!=tag[i])match=0;
        if(match){u32 at=start+8;while(at<p){u8 key=far_byte(env,at++);int base=key=='A'?16:10;u16 value=0;int digits=0;
            while(at<p){u8 c=far_byte(env,at);int d=c>='0'&&c<='9'?c-'0':c>='A'&&c<='F'?c-'A'+10:c>='a'&&c<='f'?c-'a'+10:99;
                if(d>=base)break;value=(u16)(value*base+d);at++;digits++;}
            if(digits){if(key=='A')sb_base=value;if(key=='I')sb_irq=(u8)value;if(key=='H')sb_dma=(u8)value;}
        }break;}p++;
    }
    return sb_base>=0x210&&sb_base<=0x280&&!(sb_base&15)&&(sb_irq==5||sb_irq==7)&&sb_dma>=5&&sb_dma<=7;
}
static u16 dma_port(void){return (u16)(0xc0+(sb_dma-4)*4);}
static u16 dma_page(void){return sb_dma==5?0x8b:sb_dma==6?0x89:0x8a;}
static void sound_stop(void){
    if(!audio_ok)return;
    cli();dsp(0xd5);dsp(0xd9);dsp(0xd3);out(0xd4,(u8)(4+sb_dma-4));in(sb_base+15);out(0x21,old_pic);audio_ok=0;sti();
    set_vector((u8)(8+sb_irq),old_sound);
}
static int sound_start(void){
    if(!dma_seg||!music.valid||!blaster())return 0;
    out(sb_base+6,1);for(int i=0;i<256;i++)in(sb_base+6);out(sb_base+6,0);
    if(dsp_read()!=0xaa||!dsp(0xe1))return 0;
    int major=dsp_read();dsp_read();if(major<4)return 0;
    out(sb_base+4,0x80);if(!(in(sb_base+5)&(sb_irq==5?2:4)))return 0;
    out(sb_base+4,0x81);if(!(in(sb_base+5)&(1<<sb_dma)))return 0;
    half=0;segment(dma_seg);for(u32 i=0;i<1024;i++)pixel(i,0);
    old_sound=vector((u8)(8+sb_irq));set_vector((u8)(8+sb_irq),((u32)cs()<<16)|(u16)(u32)sound_isr);
    cli();old_pic=in(0x21);out(0x21,(u8)(old_pic&~(1<<sb_irq)));
    u8 ch=(u8)(sb_dma-4);u32 physical=(u32)dma_seg<<4,address=physical>>1;
    out(0xd4,(u8)(4|ch));out(0xd8,0);out(0xd6,(u8)(0x58|ch));
    out(dma_port(),(u8)address);out(dma_port(),(u8)(address>>8));out(dma_page(),(u8)(physical>>16));
    out(dma_port()+2,255);out(dma_port()+2,1); /* 512 words, circular buffer */
    out(0xd4,ch);
    int ok=dsp(0x41)&&dsp(MOD_RATE>>8)&&dsp(MOD_RATE&255)&&dsp(0xd1)&&dsp(0xb6)&&dsp(0x10)&&dsp(255)&&dsp(0);
    audio_ok=1;sti();if(!ok)sound_stop();segment(frame_seg);return ok;
}
int audio_irq(void){
    out(sb_base+4,0x82);if(!(in(sb_base+5)&2))return 0;
    in(sb_base+15);
    segment(dma_seg);u32 offset=(u32)half*512;
    for(u32 i=0;i<256;i++){i16 value=(muted||audio_paused)?0:mod_next(&music);__asm__ volatile("movw %0,%%es:(%1)"::"r"(value),"r"(offset+i*2):"memory");}
    half^=1;audio_irqs++;out(0x20,0x20);return 1;
}
int load_music(const char *name){sound_stop();module_size=(u32)read_file(name,module_data,MOD_CAP+1);if(!mod_load(&music,module_data,module_size))return 0;return sound_start();}
int hardware_init(void){
    frame_seg=alloc(4000);if(!frame_seg)return 0;
    /* 2K block lets a 1K DMA buffer move past a 64K boundary if necessary. */
    dma_block=alloc(128);dma_seg=dma_block;
    if(dma_seg&&(((u32)dma_seg<<4)&65535)>64512)dma_seg=(u16)((dma_seg+63)&~63);
    old_timer=vector(8);old_keyboard=vector(9);
    set_vector(8,((u32)cs()<<16)|(u16)(u32)timer_isr);set_vector(9,((u32)cs()<<16)|(u16)(u32)keyboard_isr);hooks=1;
    cli();out(0x43,0x36);out(0x40,17045&255);out(0x40,17045>>8);sti();
    u32 ax=0x13;__asm__ volatile("int $0x10":"+a"(ax)::"memory","cc");segment(frame_seg);return 1;
}
void hardware_close(void){
    sound_stop();out(0x61,in(0x61)&~3);
    if(hooks){cli();out(0x43,0x36);out(0x40,0);out(0x40,0);sti();set_vector(8,old_timer);set_vector(9,old_keyboard);hooks=0;}
    u32 ax=3;__asm__ volatile("int $0x10":"+a"(ax)::"memory","cc");release(dma_block);release(frame_seg);
}
void present(void){
    u32 src=0,dst=0,count=16000;
    __asm__ volatile("pushw %%ds;pushw %%es;movw %3,%%ds;movw $0xa000,%%ax;movw %%ax,%%es;rep movsl;popw %%es;popw %%ds":"+S"(src),"+D"(dst),"+c"(count):"r"(frame_seg):"eax","memory");
}
u16 input_read(void){
    u16 v=0;if(keys[30]||keys[75])v|=LEFT;if(keys[32]||keys[77])v|=RIGHT;
    if(keys[17]||keys[72]||keys[57])v|=JUMP;if(keys[29]||keys[45])v|=FIRE;
    if(keys[18])v|=USE;if(keys[44])v|=PANIC;if(keys[33])v|=ORDER_F;if(keys[35])v|=ORDER_H;
    if(keys[16])v|=SWITCH;for(int i=0;i<4;i++)if(keys[2+i])v|=SELECT1<<i;
    if(keys[25])v|=PAUSE;if(keys[28])v|=START;if(keys[1])v|=QUIT;return v;
}
void effect(u8 id){if(!id||muted)return;u16 divisor=id==1?900:id==2?1600:id==3?3500:600;out(0x43,0xb6);out(0x42,(u8)divisor);out(0x42,(u8)(divisor>>8));out(0x61,in(0x61)|3);fx_ticks=2;}
void effect_tick(void){if(fx_ticks&&!--fx_ticks)out(0x61,in(0x61)&~3);}
