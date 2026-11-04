/* SPDX-License-Identifier: Apache-2.0 */
#include "game.h"
static int absval(int x) { return x<0?-x:x; }
static void zero(void *p,u32 n) { u8 *b=p; while(n--) *b++=0; }
/* All platforms and cover use this single collision/render definition. */
int game_tile(int level,int x,int y) {
    if(x<0 || x>=LEVEL_W) return 1;
    if(y<0 || y>10) return 0;
    if(y==10) {
        if((x>=24+level*2 && x<=26+level*2) || (x>=61 && x<=63) || (x>=93 && x<=95)) return 0;
        return 1;
    }
    if(y==9 && (x==21+level*2 || x==44 || x==82 || x==107)) return 2;
    if(y==7 && ((x>=10&&x<=15)||(x>=34&&x<=40)||(x>=69&&x<=76)||(x>=99&&x<=104))) return 3;
    if(y==5 && ((x>=48&&x<=55)||(x>=86&&x<=90))) return 3;
    return 0;
}
int game_solid(int level,int x,int y) { return game_tile(level,x>>4,y>>4)!=0; }
static int blocked(Game *g,int x,int y) {
    for(int row=y>>4;row<=(y+21)>>4;row++)
        for(int col=x>>4;col<=(x+11)>>4;col++)
            if(game_tile(g->level,col,row))return 1;
    return 0;
}
static void physics(Game *g,Actor *a) {
    /* Sweep each pixel along each axis: an upper corner must not snap the feet
       to the wrong tile row when descending beside a platform. */
    i32 goal=a->x+a->vx;int p=a->x>>8,end=goal>>8,sign=a->vx>0?1:-1;
    while(p!=end){if(blocked(g,p+sign,a->y>>8)){goal=p*Q;a->vx=0;break;}p+=sign;}
    a->x=goal;
    a->vy+=100;if(a->vy>7*Q)a->vy=7*Q;
    goal=a->y+a->vy;p=a->y>>8;end=goal>>8;sign=a->vy>0?1:-1;a->ground=0;
    while(p!=end){if(blocked(g,a->x>>8,p+sign)){goal=p*Q;if(a->vy>0)a->ground=1;a->vy=0;break;}p+=sign;}
    a->y=goal;
    if(a->vy>=0&&blocked(g,a->x>>8,(a->y>>8)+1))a->ground=1;
    if(a->y>190*Q)a->hp=0;
    if(a->cool)a->cool--;
    if(a->hurt)a->hurt--;
}
static int clear_line(Game *g,int x,int y,int target) {
    int sign=target>x?1:-1;
    for(int p=x;absval(p-target)>4;p+=sign*4) if(game_solid(g->level,p,y)) return 0;
    return 1;
}
static void shoot(Game *g,Actor *a,int enemy,int boss) {
    if(a->cool || a->hp<=0) return;
    for(int i=0;i<SHOTS;i++) if(!g->shots[i].life) {
        Shot *b=&g->shots[i]; b->life=30; b->enemy=(u8)enemy;
        b->x=(i16)(a->x/Q+(a->dir?14:-3)); b->y=(i16)(a->y/Q+9);
        b->vx=(i16)(a->dir?8:-8); b->vy=0; b->damage=(u8)(enemy?(boss?12:7):12);
        a->cool=(u8)(enemy?(boss?12:45):9); g->sfx=enemy?2:1; return;
    }
}
void game_level(Game *g,u8 level) {
    g->level=level;g->camera=0;g->terminal=0;g->progress=0;g->boss_dead=0;g->previous=0;g->paused=0;
    zero(g->e,sizeof(g->e));zero(g->shots,sizeof(g->shots));zero(g->pickups,sizeof(g->pickups));
    for(int i=0;i<AGENTS;i++) {
        Actor *a=&g->a[i];a->x=(100-i*19)*Q;a->y=138*Q;a->vx=a->vy=0;a->ground=1;
        a->dir=1;a->order=FOLLOW;a->cool=a->hurt=0;
    }
    for(int i=0;i<ENEMIES;i++) {
        Actor *e=&g->e[i];int x=300+i*64;
        if(i==ENEMIES-1) x=1940;
        while(game_solid(level,x,144)||!game_solid(level,x,160)||!game_solid(level,x+11,160)) x+=16;
        e->x=x*Q;e->y=138*Q;e->ground=1;e->hp=(i==ENEMIES-1)?(180+level*60):(24+level*6);e->dir=0;e->cool=(u8)(i*7%40);
        if(i==4 || i==13) { e->x=(i==4?36:72)*16*Q;e->y=90*Q; }
    }
}
void game_init(Game *g) { zero(g,sizeof(*g)); for(int i=0;i<AGENTS;i++)g->a[i].hp=(i==3?140:100);game_level(g,0);g->phase=BRIEF; }
static void swap(Game *g,int id) { if(g->a[id].hp>0) { g->active=(u8)id;g->a[id].order=FOLLOW; } }
static void next(Game *g) { for(int n=1;n<=4;n++)if(g->a[(g->active+n)%4].hp>0){swap(g,(g->active+n)%4);return;}g->phase=LOST; }
void game_step(Game *g,u16 input) {
    u16 edge=input&~g->previous;g->previous=input;g->sfx=0;
    if(edge&QUIT) {g->phase=EXIT;return;}
    if(g->phase!=RUN) {if(edge&START){game_init(g);g->phase=RUN;g->previous=input;}return;}
    if(edge&PAUSE) {g->paused^=1;return;}
    if(g->paused) return;
    g->tick++;if(g->panic)g->panic--;
    if(edge&SWITCH)next(g);
    for(int i=0;i<4;i++)if(edge&(SELECT1<<i))swap(g,i);
    Actor *leader=&g->a[g->active];
    if(edge&ORDER_F)for(int i=0;i<4;i++)g->a[i].order=FOLLOW;
    if(edge&ORDER_H)for(int i=0;i<4;i++)if(i!=g->active)g->a[i].order=HOLD;
    if((edge&PANIC)&&!g->panic) {
        for(int i=0;i<ENEMIES;i++)if(g->e[i].hp>0&&absval((g->e[i].x-leader->x)/Q)<112)g->e[i].cool=120;
        g->panic=35*15;g->sfx=3;
    }
    for(int i=0;i<4;i++) {
        Actor *a=&g->a[i];if(a->hp<=0)continue;
        i32 airborne_vx=a->vx; a->vx=0;
        if(i==g->active) {
            a->vx=((input&RIGHT?1:0)-(input&LEFT?1:0))*3*Q;
            if((edge&JUMP)&&a->ground) a->vy=-8*Q;
            if(a->vx)a->dir=a->vx>0;
            if(input&FIRE)shoot(g,a,0,0);
        } else {
            /* Keep a jump moving until landing; braking over a gap kills followers. */
            if(!a->ground) a->vx=airborne_vx;
            int delta=(leader->x-a->x)/Q;
            if(a->order==FOLLOW&&absval(delta)>25+(i+1)*5) {
                if(a->ground||!a->vx) a->vx=delta>0?3*Q:-3*Q;a->dir=a->vx>0;
                int ahead=a->x/Q+(a->dir?21:-9), y=a->y/Q;
                if(a->ground && (game_solid(g->level,ahead,y+12)||!game_solid(g->level,ahead,y+24)||(leader->ground&&leader->y<a->y-16*Q&&absval(delta)<40))) a->vy=-8*Q;
            }
            for(int k=0;k<ENEMIES;k++) { Actor *e=&g->e[k];
                if(e->hp>0&&absval((e->x-a->x)/Q)<150&&absval((e->y-a->y)/Q)<16&&clear_line(g,a->x/Q+6,a->y/Q+9,e->x/Q+6)) {
                    a->dir=e->x>a->x;shoot(g,a,0,0);break;
                }
            }
        }
        physics(g,a);
    }
    if(leader->hp<=0){next(g);leader=&g->a[g->active];if(g->phase!=RUN)return;}
    for(int i=0;i<ENEMIES;i++) {
        Actor *e=&g->e[i];if(e->hp<=0)continue;
        int delta=(leader->x-e->x)/Q;e->vx=0;
        if(absval(delta)<290) {
            Actor *target=leader;int best=10000;
            for(int j=0;j<4;j++)if(g->a[j].hp>0) {int d=absval((g->a[j].x-e->x)/Q);if(d<best){best=d;target=&g->a[j];}}
            e->dir=target->x>e->x;
            if(best>105&&e->ground) {
                int ahead=e->x/Q+(e->dir?18:-6);
                if(game_solid(g->level,ahead,e->y/Q+24)&&!game_solid(g->level,ahead,e->y/Q+14))e->vx=e->dir?Q:-Q;
            }
            if(best<230&&absval((target->y-e->y)/Q)<20&&clear_line(g,e->x/Q+6,e->y/Q+9,target->x/Q+6))shoot(g,e,1,i==ENEMIES-1);
        }
        physics(g,e);
    }
    for(int i=0;i<SHOTS;i++) {
        Shot *b=&g->shots[i];if(!b->life)continue;b->life--;
        int steps=absval(b->vx),sign=b->vx>0?1:-1;
        for(int s=0;s<steps&&b->life;s++) {
            b->x+=sign;b->y+=b->vy;
            if(game_solid(g->level,b->x,b->y)){b->life=0;break;}
            Actor *actors=b->enemy?g->a:g->e;int count=b->enemy?AGENTS:ENEMIES;
            for(int k=0;k<count;k++) {Actor *a=&actors[k];
                if(a->hp>0&&b->x>=a->x/Q&&b->x<a->x/Q+12&&b->y>=a->y/Q&&b->y<a->y/Q+22) {
                    b->life=0;if(!a->hurt){a->hp-=b->damage;a->hurt=b->enemy?14:2;
                        if(a->hp<=0&&!b->enemy){g->score+=100;g->kills++;if(k==ENEMIES-1){g->boss_dead=1;g->score+=900;}g->sfx=3;}}
                    break;
                }
            }
        }
    }
    /* A terminal needs a living, stationary pilot holding E for one second. */
    if(leader->hp>0&&absval(leader->x/Q-1770)<28&&leader->ground&&!leader->vx&&(input&USE)) {
        if(g->progress<35)g->progress++;
        if(g->progress==35&&!g->terminal){g->terminal=1;g->score+=500;g->sfx=4;}
    } else if(!g->terminal)g->progress=0;
    for(int i=0;i<6;i++)if(!g->pickups[i])for(int j=0;j<4;j++) {
        Actor *a=&g->a[j];int x=520+i*240;
        if(a->hp>0&&a->hp<(j==3?140:100)&&absval(a->x/Q-x)<14&&a->y/Q>112){a->hp+=35;if(a->hp>(j==3?140:100))a->hp=j==3?140:100;g->pickups[i]=1;g->sfx=4;break;}
    }
    if(leader->hp<=0){next(g);leader=&g->a[g->active];}
    if(g->phase==RUN&&leader->x/Q>2010&&g->terminal&&g->boss_dead) {
        if(g->level==2)g->phase=WON;else game_level(g,g->level+1);
    }
    g->camera=(i16)(leader->x/Q-120);if(g->camera<0)g->camera=0;if(g->camera>LEVEL_W*16-320)g->camera=LEVEL_W*16-320;
}
