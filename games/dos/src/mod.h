/* SPDX-License-Identifier: Apache-2.0 */
#ifndef CW_MOD_H
#define CW_MOD_H
#include "types.h"
#define MOD_RATE 11025
#define MOD_CAP 16384
/* Deliberately small M.K. subset: notes, instruments, Cxx and Fxx. */
typedef struct { const i8 *data; u32 length, loop, end; u8 volume; } Sample;
typedef struct { const Sample *sample; u32 pos, step; u8 volume; } Voice;
typedef struct {
    const u8 *data;
    Sample sample[31]; Voice voice[4];
    u32 phase, rows; u16 bpm; u8 speed, tick, order, row, orders, valid;
} Module;
int mod_load(Module *m, const u8 *data, u32 size);
i16 mod_next(Module *m);
#endif
