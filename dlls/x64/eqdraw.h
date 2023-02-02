#include<stdio.h>

typedef struct _eqDrawResult {
    int ret;
    int arr_size;
    double points[840][2];
}eqDrawResult;

_declspec(dllexport) eqDrawResult* eqDrawPoints(pstMonoEqPrm pstEqPrm, struUIXYInfo* XYData);
_declspec(dllexport) void freePoints(eqDrawResult* result);