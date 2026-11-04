/* SPDX-License-Identifier: Apache-2.0 */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/mod.h"
static u8 data[MOD_CAP+1],copy[MOD_CAP+1];
static Module m;
static int load(const char *name){FILE*f=fopen(name,"rb");assert(f);int n=(int)fread(data,1,sizeof(data),f);fclose(f);return n;}
int main(int argc,char **argv){assert(argc==4);
    for(int track=1;track<4;track++){
        int n=load(argv[track]);assert(mod_load(&m,data,n));
        i32 peak=0;long energy=0;for(int i=0;i<MOD_RATE*70;i++){i32 s=mod_next(&m);if(abs(s)>peak)peak=abs(s);energy+=abs(s);}
        assert(m.rows>512&&peak>1000&&peak<=32768&&energy>1000000);
        memcpy(copy,data,n);copy[1080]='X';assert(!mod_load(&m,copy,n));
        for(int len=0;len<n;len++)assert(!mod_load(&m,data,len));
        memcpy(copy,data,n);copy[45]=65;assert(!mod_load(&m,copy,n));
        memcpy(copy,data,n);copy[1086]=(copy[1086]&0xf0)|1;assert(!mod_load(&m,copy,n));
        memcpy(copy,data,n);copy[48]=255;copy[49]=255;assert(!mod_load(&m,copy,n));
        memcpy(copy,data,n);copy[950]=129;assert(!mod_load(&m,copy,n));
    }
    puts("PASS: MOD bounds and 70-second looping mixes for all three tracks");return 0;
}
