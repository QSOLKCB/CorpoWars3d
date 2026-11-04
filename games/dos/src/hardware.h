/* SPDX-License-Identifier: Apache-2.0 */
#ifndef CW_HARDWARE_H
#define CW_HARDWARE_H
#include "types.h"
#include "mod.h"
extern volatile u32 timer_ticks,audio_irqs;
extern volatile u8 keys[128];
extern u16 frame_seg;
extern u8 audio_ok,muted,audio_paused;
extern Module music;
extern u8 module_data[MOD_CAP+1];
extern u32 module_size;
static inline void out(u16 port,u8 value){__asm__ volatile("outb %0,%1"::"a"(value),"Nd"(port));}
static inline u8 in(u16 port){u8 value;__asm__ volatile("inb %1,%0":"=a"(value):"Nd"(port));return value;}
static inline void cli(void){__asm__ volatile("cli":::"memory");}
static inline void sti(void){__asm__ volatile("sti":::"memory");}
static inline void segment(u16 s){__asm__ volatile("movw %0,%%es"::"r"(s):"memory");}
static inline void pixel(u32 offset,u8 color){__asm__ volatile("movb %b0,%%es:(%1)"::"q"(color),"r"(offset):"memory");}
int hardware_init(void);
void hardware_close(void);
void present(void);
int load_music(const char *name);
int audio_irq(void);
void save_audio(const char *name);
u16 input_read(void);
int command_test(void);
void save_file(const char *name,const void *data,u16 size);
void save_frame(const char *name);
void effect(u8 id);
void effect_tick(void);
#endif
