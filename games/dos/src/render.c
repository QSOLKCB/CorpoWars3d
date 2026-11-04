/* SPDX-License-Identifier: Apache-2.0 */
#include "hardware.h"
#include "render.h"
#include "../assets/graphics.h"
static const char *names[4]={"VEX","NULL","ECHO","IRON"};
static const char *districts[3]={"01 - NEON DOCKS","02 - DATA FOUNDRY","03 - EXECUTIVE ROW"};
static void rect(int x,int y,int w,int h,u8 c){
    if(x<0){w+=x;x=0;}if(y<0){h+=y;y=0;}if(x+w>320)w=320-x;if(y+h>200)h=200-y;
    if(w<=0||h<=0)return;
    for(int yy=y;yy<y+h;yy++){u32 p=(u32)(yy*320+x),n=(u32)w;__asm__ volatile("rep stosb":"+D"(p),"+c"(n):"a"(c):"memory");}
}
static void text(int x,int y,const char *s,u8 color,int scale){
    for(;*s;s++,x+=6*scale){int c=*s;if(c<32||c>90)continue;
        for(int col=0;col<5;col++){u8 bits=font[(c-32)*5+col];for(int row=0;row<7;row++)if(bits&(1<<row))rect(x+col*scale,y+row*scale,scale,scale,color);}
    }
}
static void number(int x,int y,u32 n,u8 color){char b[9];int k=8;b[k]=0;do{b[--k]=(char)('0'+n%10);n/=10;}while(n&&k);text(x,y,b+k,color,1);}
static void panel(int x,int y,int w,int h){rect(x,y,w,h,2);rect(x,y,w,1,10);rect(x,y+h-1,w,1,9);rect(x,y,1,h,4);rect(x+w-1,y,1,h,4);}
void render_init(void){out(0x3c8,0);for(int i=0;i<768;i++)out(0x3c9,i<(int)sizeof(palette)?palette[i]:0);}
static void background(Game *g){
    rect(0,0,320,200,0);
    for(int i=0;i<45;i++){int x=(i*79+17-g->camera/8)%320;if(x<0)x+=320;rect(x,25+i*31%88,1,1,i%4?4:7);}
    rect(232-g->camera/20,42,27,26,2);rect(238-g->camera/20,43,22,22,3);
    for(int i=-1;i<9;i++){int x=i*53-(g->camera/4)%53,h=30+(i+9)*37%65;rect(x,163-h,43,h,1);rect(x+4,158-h,34,4,3);
        for(int r=0;r<h/12;r++)for(int c=0;c<4;c++)if((r+c+i)%3)rect(x+6+c*8,168-h+r*12,3,4,((r+i)&1)?3:9);}
    for(int i=-1;i<7;i++){int x=i*67-(g->camera/2)%67,h=34+(i+7)*19%42;rect(x,177-h,49,h,2);rect(x+3,177-h,43,2,4);for(int r=0;r<h/10;r++)rect(x+8,185-h+r*10,27,2,3);}
    rect(0,182,320,18,1);
}
static void actor(Game *g,Actor *a,u8 color,int active,int boss){
    if(a->hp<=0)return;int x=a->x/Q-g->camera-2,y=a->y/Q+22;
    if(x<-20||x>320)return;
    if(a->hurt&&(g->tick&1))color=8;
    if(boss){rect(x-2,y-3,20,27,16);rect(x-3,y-2,22,2,18);}
    int frame=a->vx?((g->tick/5)&1):0;
    for(int yy=0;yy<24;yy++)for(int xx=0;xx<16;xx++){
        u8 c=sprites[frame*384+yy*16+xx];if(c==30)c=color;
        int sx=x+(a->dir?xx:15-xx),sy=y+yy;
        if(c&&sx>=0&&sx<320&&sy>=24&&sy<200)pixel((u32)(sy*320+sx),c);
    }
    if(active){rect(x+6,y-6,5,1,11);rect(x+7,y-5,3,1,11);rect(x+8,y-4,1,1,11);}
    if(a->cool>=7&&a->cool<=9)rect(a->dir?x+17:x-4,y+10,4,2,27);
}
static void world(Game *g){
    for(int y=0;y<11;y++)for(int x=g->camera/16;x<g->camera/16+21;x++){
        int tile=game_tile(g->level,x,y),sx=x*16-g->camera,sy=y*16+24;
        if(!tile)continue;
        if(tile==1){rect(sx,sy,16,16,3);rect(sx,sy,16,2,6);rect(sx+1,sy+4,14,1,2);rect(sx+2,sy+8,4,4,2);rect(sx+10,sy+8,4,4,2);}
        if(tile==2){rect(sx,sy,16,16,24);rect(sx+1,sy+1,14,2,26);rect(sx+2,sy+4,12,10,25);rect(sx+4,sy+6,8,1,27);rect(sx+4,sy+10,8,1,24);}
        if(tile==3){rect(sx,sy,16,16,2);rect(sx,sy,16,2,10);rect(sx+2,sy+4,12,2,4);rect(sx+1,sy+10,4,2,9);rect(sx+9,sy+10,4,2,9);}
    }
    /* Terminal, exit and medical caches are world-space objects. */
    int tx=1770-g->camera;rect(tx,160,15,24,4);rect(tx+2,162,11,10,g->terminal?21:9);rect(tx+4,164,7,2,11);rect(tx+4,169,5,1,11);
    if(tx>-80&&tx<330){text(tx-20,145,g->terminal?"RELAY OPEN":"HOLD E",g->terminal?22:11,1);if(g->progress)rect(tx-8,155,g->progress,2,10);}
    int ex=2010-g->camera;rect(ex,128,25,56,16);rect(ex+2,130,21,54,3);rect(ex+4,132,17,51,g->terminal&&g->boss_dead?20:12);text(ex-1,117,"EXIT",11,1);
    for(int i=0;i<6;i++)if(!g->pickups[i]){int x=520+i*240-g->camera;rect(x,173,11,9,20);rect(x+4,174,3,7,22);rect(x+2,176,7,3,22);}
    for(int i=0;i<ENEMIES;i++)actor(g,&g->e[i],i==ENEMIES-1?18:13,0,i==ENEMIES-1);
    for(int i=0;i<4;i++)if(i!=g->active)actor(g,&g->a[i],(u8)(10+i*4),0,0);
    actor(g,&g->a[g->active],(u8)(10+g->active*4),1,0);
    for(int i=0;i<SHOTS;i++)if(g->shots[i].life)rect(g->shots[i].x-g->camera,g->shots[i].y+24,4,1,g->shots[i].enemy?14:27);
}
static void hud(Game *g){
    rect(0,0,320,23,1);rect(0,22,320,1,9);
    for(int i=0;i<4;i++){int x=4+i*49;u8 c=g->a[i].hp>0?(i==g->active?11:6):12;
        text(x,3,names[i],c,1);if(i==g->active)rect(x-2,2,1,17,10);
        rect(x,13,42,5,3);if(g->a[i].hp>0)rect(x,13,g->a[i].hp*42/(i==3?140:100),5,(u8)(10+i*4));
    }
    text(204,3,"EMP",9,1);if(g->panic)number(229,3,(g->panic+34)/35,6);else text(229,3,"READY",11,1);
    text(204,13,g->a[(g->active+1)%4].order==HOLD?"HOLD":"FOLLOW",7,1);
    number(276,3,g->score,27);text(276,13,audio_ok&&!muted?"MOD":"MUTE",5,1);
}
void render(Game *g){
    segment(frame_seg);background(g);
    if(g->phase==BRIEF){
        rect(0,41,320,65,1);text(26,47,"CORPO",11,4);text(146,80,"WARS",13,3);text(29,84,"DOS / 16",6,1);
        text(47,116,"FOUR BODIES. ONE CONSCIENCE.",7,1);
        text(79,137,"ENTER - INFILTRATE",g->tick&16?8:11,1);
        text(26,157,"ARROWS MOVE   SPACE JUMP   CTRL FIRE",6,1);
        text(26,170,"1-4 SWAP   F FOLLOW   H HOLD   Z EMP",6,1);
        text(26,183,"E RELAY   P PAUSE   M MUTE   ESC QUIT",5,1);
    }else{
        world(g);hud(g);
        if(g->camera<90){text(12,39,districts[g->level],11,1);text(12,52,"BREACH RELAY. DEFEAT WARDEN. EXTRACT.",7,1);}
        if(g->paused){panel(39,57,242,89);text(88,68,"TACTICAL PAUSE",11,2);text(60,96,"RELEASE CONTROLS. P TO RESUME.",7,1);text(60,113,"F FOLLOW / H HOLD WHILE RUNNING",6,1);text(60,130,"ESC RETURNS TO DOS",5,1);}
        if(g->phase==LOST||g->phase==WON){panel(33,51,254,103);text(50,65,g->phase==WON?"CONTRACT CLOSED":"SQUAD OFFLINE",g->phase==WON?11:13,2);text(70,96,"SCORE",7,1);number(118,96,g->score,27);text(70,112,"ENTER - NEW OPERATION",11,1);text(70,135,"ESC - RETURN TO DOS",6,1);}
    }
    present();
}
