/* SPDX-License-Identifier: Apache-2.0 */
#include "hardware.h"
#include "game.h"
#include "render.h"
static Game game;
static u32 report[16];
int main(void){
    int test=command_test();game_init(&game);
    if(!hardware_init())return 1;
    render_init();load_music("MENU.MOD");
    u32 last=timer_ticks,frames=0;u8 track=0,mkey=0,blocked=0,loaded=music.valid?1:0;
    while(game.phase!=EXIT){
        u32 now=timer_ticks;if(now-last<2){__asm__ volatile("sti;hlt");continue;}
        /* 35 fixed steps/sec, drop backlog beyond four steps after a stall. */
        if(now-last>8)last=now-8;last+=2;
        u16 input=input_read();u8 was_paused=game.paused;
        if(test){
            input=frames==20?START:frames>20&&frames<85?RIGHT|FIRE:frames==95?SWITCH:frames==110?PANIC:frames==130?ORDER_H:frames==145?PAUSE:frames==165?PAUSE:0;
            if(frames==60)input|=JUMP;
            if(frames==175){game_level(&game,2);for(int i=0;i<4;i++){game.a[i].x=(1850-i*19)*Q;game.a[i].hp=100;}}
            if(frames==210)input|=QUIT;
        }
        if(blocked){if(!(input&(LEFT|RIGHT|JUMP|FIRE|USE|PANIC)))blocked=0;else input&=PAUSE|QUIT;}
        game_step(&game,input);
        if(was_paused!=game.paused){blocked=1;out(0x61,in(0x61)&~3);}
        audio_paused=game.paused;
        if(keys[50]&&!mkey)muted^=1;mkey=keys[50];
        u8 wanted=game.phase==BRIEF?0:game.a[game.active].x/Q>1640?2:1;
        if(wanted!=track){track=wanted;load_music(track==0?"MENU.MOD":track==1?"ACTION.MOD":"BOSS.MOD");if(music.valid)loaded|=1<<track;}
        effect_tick();if(!game.paused)effect(game.sfx);
        render(&game);
        if(test&&frames==5)save_frame("TITLE.RAW");
        if(test&&frames==80)save_frame("PLAY.RAW");
        if(test&&frames==155)save_frame("PAUSE.RAW");
        if(test&&frames==200){save_frame("BOSS.RAW");if(audio_ok)save_audio("AUDIO.RAW");}
        frames++;
    }
    if(test){
        report[0]=0x43574431;report[1]=frames;report[2]=timer_ticks;report[3]=audio_irqs;report[4]=music.rows;report[5]=audio_ok;
        report[6]=game.a[0].x/Q;report[7]=game.active;report[8]=game.panic;report[9]=game.paused;report[10]=game.a[0].order;report[11]=game.tick;report[12]=game.kills;report[13]=loaded;
        save_file("SMOKE.BIN",report,sizeof(report));
    }
    hardware_close();return 0;
}
