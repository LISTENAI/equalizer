#include "lsaudio/soundeffect.h"
#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

#define CHECK(x) do { if (!(x)) { fprintf(stderr,"line %d: %s\n",__LINE__,#x); return 1; } } while (0)
typedef struct { uint32_t before[4], bytes[LSAUDIO_SOUND_INSTANCE_BYTES/4], after[4]; } GuardedInstance;
static void init_guard(GuardedInstance *instance) { memset(instance,0xa5,sizeof(*instance)); }
static int intact(const GuardedInstance *instance)
{
    for(int i=0;i<4;i++)if(instance->before[i]!=UINT32_C(0xa5a5a5a5)||instance->after[i]!=UINT32_C(0xa5a5a5a5))return 0;
    return 1;
}
int main(void)
{
    GuardedInstance a,b;init_guard(&a);init_guard(&b);
    int32_t size=0;
    CHECK(IFLYTEK_AudioCreate(a.bytes,&size)==0 && size==3508 && intact(&a));
    CHECK(IFLYTEK_AudioCreate(b.bytes,&size)==0 && IFLYTEK_AudioInitial(b.bytes)==0);
    CHECK(IFLYTEK_AudioInitial(a.bytes)==0);
    IFLYTEK_StruAudioPrm p;
    CHECK(IFLYTEK_AudioGet(a.bytes,&p)==0);
    p.BassBoostPrm.iEnable=p.TrebleoostPrm.iEnable=p.PeqPrm.Enable=p.DrcPrm.iEnable=p.GainPrm.iEnable=0;
    CHECK(IFLYTEK_AudioSet(a.bytes,&p)==0);
    int32_t input[64],output[64],other[64];
    for(int i=0;i<64;i++)input[i]=(i%2?-1:1)*i*500;
    CHECK(IFLYTEK_AudioProcess(a.bytes,input,output,64)==0 && memcmp(input,output,sizeof(input))==0);
    CHECK(IFLYTEK_AudioProcess(a.bytes,input,input,64)==0 && memcmp(input,output,sizeof(input))==0);
    int invalid[]={-1,0,65,INT_MAX};
    for(unsigned i=0;i<sizeof(invalid)/sizeof(invalid[0]);i++){
        memset(output,0x55,sizeof(output));
        CHECK(IFLYTEK_AudioProcess(a.bytes,input,output,invalid[i])==-1);
        for(int j=0;j<64;j++)CHECK(output[j]==INT32_C(0x55555555));
    }
    CHECK(IFLYTEK_AudioProcess(NULL,input,output,64)==-1);
    CHECK(IFLYTEK_AudioCreate(NULL,&size)==-1);
    CHECK(IFLYTEK_AudioCreate(a.bytes,NULL)==-1);
    CHECK(IFLYTEK_AudioGet(a.bytes,NULL)==-1 && IFLYTEK_AudioGetInfo(NULL)==-1);
    CHECK(IFLYTEK_AudioReset(a.bytes,5)==-1);
    CHECK(IFLYTEK_SetAlgParam(a.bytes,0,NULL)==LSAUDIO_SOUND_UNSUPPORTED);
    CHECK(IFLYTEK_SetAlgParam(a.bytes,5,NULL)==-503);
    lsaudioLimiterPrm limiter={1,100,48000,-6,4,1,100,4,0};
    CHECK(IFLYTEK_SetAlgParam(a.bytes,5,&limiter)==-1); /* exceeds ring capacity */
    limiter.lookahead_ms=NAN;
    CHECK(IFLYTEK_SetAlgParam(a.bytes,5,&limiter)==-1);
    p.PeqPrm.Enable=p.PeqPrm.FilterPrm[0].FilterEnable=1;
    p.PeqPrm.FilterPrm[0].FilterType=2;
    p.PeqPrm.FilterPrm[0].fDbGain=6;
    CHECK(IFLYTEK_AudioSet(a.bytes,&p)==0 && IFLYTEK_AudioSet(b.bytes,&p)==0);
    memset(input,0,sizeof(input));input[0]=10000;
    CHECK(IFLYTEK_AudioProcess(a.bytes,input,output,64)==0);
    CHECK(IFLYTEK_AudioProcess(b.bytes,input,other,64)==0);
    CHECK(memcmp(output,other,sizeof(output))==0);
    memset(input,0,sizeof(input));
    CHECK(IFLYTEK_AudioProcess(a.bytes,input,output,64)==0);
    CHECK(IFLYTEK_AudioProcess(b.bytes,input,other,64)==0);
    CHECK(memcmp(output,other,sizeof(output))==0);
    int nonzero=0;for(int i=0;i<64;i++)nonzero|=output[i];CHECK(nonzero!=0);
    CHECK(IFLYTEK_AudioDelete(a.bytes)==0 && IFLYTEK_AudioDelete(b.bytes)==0);
    CHECK(intact(&a)&&intact(&b));
    puts("sound storage bounds, in-place PCM, instance isolation, filter history and safe errors: passed");
    return 0;
}
