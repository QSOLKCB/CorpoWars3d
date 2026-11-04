/* SPDX-License-Identifier: Apache-2.0 */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/game.h"
#include "../src/mod.h"
static Game g;
static void start(void){game_init(&g);game_step(&g,START);game_step(&g,0);}
static void step(int n,u16 input){for(int i=0;i<n;i++)game_step(&g,input);}
int main(void){
    assert(sizeof(u32)==4&&sizeof(u16)==2);
    start();assert(g.phase==RUN);
    for(int level=0;level<3;level++){
        game_level(&g,(u8)level);int live=0;
        for(int i=0;i<ENEMIES;i++){Actor*e=&g.e[i];assert(e->hp>0);assert(e->x/Q>250&&e->x/Q<2040);assert(!game_solid(level,e->x/Q,e->y/Q+21));live++;}assert(live==26);
    }
    start();for(int i=0;i<ENEMIES;i++)g.e[i].hp=0;memset(g.shots,0,sizeof(g.shots));int hp=g.a[0].hp;step(20,RIGHT);int x=g.a[0].x;game_step(&g,SELECT1<<1);assert(g.active==1&&g.a[0].hp==hp&&abs(g.a[0].x-x)<=3*Q);
    game_step(&g,0);game_step(&g,ORDER_H);assert(g.a[0].order==HOLD);game_step(&g,0);game_step(&g,ORDER_F);assert(g.a[0].order==FOLLOW);
    /* Selecting a held agent and handing it back to AI must keep its order. */
    game_step(&g,0);game_step(&g,ORDER_H);assert(g.a[0].order==HOLD);
    game_step(&g,0);game_step(&g,SELECT1);assert(g.active==0&&g.a[0].order==HOLD);
    game_step(&g,0);game_step(&g,SELECT1<<1);x=g.a[0].x;
    step(20,RIGHT);assert(g.a[0].order==HOLD&&g.a[0].x==x);
    start();g.a[1].order=HOLD;g.a[0].hp=0;game_step(&g,0);
    assert(g.active==1&&g.a[1].order==HOLD);
    start();game_step(&g,PANIC);assert(g.panic==525);step(10,0);game_step(&g,PANIC);assert(g.panic==514);game_step(&g,0);game_step(&g,PAUSE);u32 tick=g.tick;u16 cooldown=g.panic;step(100,0);assert(g.tick==tick&&g.panic==cooldown);game_step(&g,PAUSE);game_step(&g,0);step(525,0);game_step(&g,PANIC);assert(g.panic==525);
    start();for(int i=0;i<ENEMIES;i++)g.e[i].hp=0;g.a[0].x=1770*Q;
    step(20,USE|LEFT);assert(!g.terminal);g.a[0].x=1770*Q;step(34,USE);assert(!g.terminal);step(1,USE);assert(g.terminal);
    /* Pause freezes simulation, bullets, objectives and music is gated by driver. */
    game_step(&g,PAUSE);Game before=g;step(100,FIRE|RIGHT|USE);assert(g.tick==before.tick&&g.a[0].x==before.a[0].x&&g.score==before.score);
    start();for(int i=0;i<4;i++)g.a[i].hp=0;game_step(&g,0);assert(g.phase==LOST);game_step(&g,START);assert(g.phase==RUN&&g.a[0].hp==100);
    /* End-to-end route with actual collisions, guards, squad AI and objectives. */
    start();int jumped=0;
    for(int t=0;t<14000&&g.phase==RUN;t++){
        Actor*a=&g.a[g.active];int px=a->x/Q,py=a->y/Q;u16 in=RIGHT|FIRE;
        if(!g.terminal&&px>=1748&&px<=1780)in=USE|FIRE;
        if(a->ground&&(game_solid(g.level,px+18,py+12)||!game_solid(g.level,px+22,py+24))&&!jumped){in|=JUMP;jumped=1;}else jumped=0;
        for(int k=0;k<ENEMIES;k++)if(g.e[k].hp>0&&g.e[k].x>a->x&&g.e[k].x-a->x<125*Q&&abs(g.e[k].y-a->y)<12*Q){int clear=1;for(int xx=px+14;xx<g.e[k].x/Q;xx++)if(game_solid(g.level,xx,py+9))clear=0;if(clear&&a->ground&&!(in&JUMP))in&=~RIGHT;}
        if(g.panic==0)in|=PANIC;
        game_step(&g,in);
        for(int j=0;j<4;j++){Actor *p=&g.a[j];assert(p->y<190*Q);if(p->hp>0)for(int yy=p->y/Q;yy<p->y/Q+22;yy++)for(int xx=p->x/Q;xx<p->x/Q+12;xx++)assert(!game_solid(g.level,xx,yy));}
    }
    if(g.phase!=WON)fprintf(stderr,"route: phase=%d level=%d x=%d y=%d hp=%d relay=%d boss=%d kills=%d\n",g.phase,g.level,g.a[g.active].x/Q,g.a[g.active].y/Q,g.a[g.active].hp,g.terminal,g.boss_dead,g.kills);
    assert(g.phase==WON);
    puts("PASS: three playable districts; squad, pause, cooldown, objectives");return 0;
}
