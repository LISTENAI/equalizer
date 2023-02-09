#include<stdio.h>
#include "iflytekEqDrcDrawApi.h"

typedef struct _eqDrawResult {
    int ret;
    int arr_size;
    double points[1024][2];
}eqDrawResult;

typedef struct _drcDrawResult {
    int ret;
    int arr_size;
    int dot_size;
    double points[315][2];
    float fs;
    struDrcDot dots[IFLYTTEK_MAX_DOT];
}drcDrawResult;

_declspec(dllexport) eqDrawResult* eqDrawPoints(pstMonoEqPrm pstEqPrm, struUIXYInfo* XYData);
_declspec(dllexport) drcDrawResult* drcDrawPoints(struDrcPrm pstdrcPrm, struUIDrcInfo* XYData);
_declspec(dllexport) void freePoints(eqDrawResult* result);
_declspec(dllexport) void freeDrcPoints(drcDrawResult* result);
