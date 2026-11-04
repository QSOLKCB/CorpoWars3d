/* SPDX-License-Identifier: Apache-2.0 */
#ifndef CW_GAME_H
#define CW_GAME_H
#include "types.h"
#define AGENTS 4
#define ENEMIES 26
#define SHOTS 48
#define Q 256
#define LEVEL_W 128
#define WORLD_H 176
#define RUN 1
#define BRIEF 0
#define LOST 2
#define WON 3
#define EXIT 4
#define FOLLOW 0
#define HOLD 1
#define LEFT 1
#define RIGHT 2
#define JUMP 4
#define FIRE 8
#define USE 16
#define PANIC 32
#define ORDER_F 64
#define ORDER_H 128
#define SWITCH 256
#define SELECT1 512
#define PAUSE 8192
#define START 16384
#define QUIT 32768

typedef struct { i32 x,y,vx,vy; i16 hp; u8 dir,ground,cool,hurt,order; } Actor;
typedef struct { i16 x,y,vx,vy; u8 life,enemy,damage; } Shot;
typedef struct {
    Actor a[AGENTS],e[ENEMIES]; Shot shots[SHOTS];
    u32 tick,score; u16 previous,panic,terminal,progress,kills;
    i16 camera; u8 level,active,phase,paused,boss_dead,sfx,pickups[6];
} Game;
void game_init(Game *g);
void game_step(Game *g,u16 input);
void game_level(Game *g,u8 level);
int game_solid(int level,int px,int py);
int game_tile(int level,int tx,int ty);
#endif
