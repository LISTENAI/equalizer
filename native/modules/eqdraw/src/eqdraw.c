#include "lsaudio/eqdraw.h"
#include <stdlib.h>

_Static_assert(sizeof(eqDrawResult) == 16392, "EQ result ABI mismatch");
_Static_assert(offsetof(eqDrawResult, points) == 8, "EQ point offset mismatch");
_Static_assert(sizeof(drcDrawResult) == 5144, "DRC result ABI mismatch");
_Static_assert(offsetof(drcDrawResult, points) == 16, "DRC point offset mismatch");
_Static_assert(offsetof(drcDrawResult, fs) == 5056, "DRC sample rate offset mismatch");
_Static_assert(offsetof(drcDrawResult, dots) == 5060, "DRC dot offset mismatch");

eqDrawResult *eqDrawPoints(const struMonoEqPrm *params, struUIXYInfo *ui)
{
    eqDrawResult *result = (eqDrawResult *)calloc(1, sizeof(*result));
    if (!result) return NULL;
    if (!ui) { result->ret = -11; return result; }
    if (ui->xNum < 0 || ui->xNum > LSAUDIO_EQ_POINTS_MAX) {
        result->ret = -12; return result;
    }
    double y[LSAUDIO_EQ_POINTS_MAX] = {0};
    result->ret = EqDraw(params, ui, y);
    if (result->ret < 0) return result;
    result->arr_size = ui->xNum;
    for (int i = 0; i < result->arr_size; ++i) {
        result->points[i][0] = EqCalcXToFreq(i, ui);
        result->points[i][1] = y[i];
    }
    return result;
}

drcDrawResult *drcDrawPoints(struDrcPrm params, const struUIDrcInfo *ui)
{
    drcDrawResult *result = (drcDrawResult *)calloc(1, sizeof(*result));
    if (!result) return NULL;
    if (!ui) { result->ret = -20; return result; }
    if (ui->WidthX < 0 || ui->WidthX > LSAUDIO_DRC_POINTS_MAX) {
        result->ret = -17; return result;
    }
    /* The original copies params.SegNum+1 dots, even when DrcDraw has
     * clamped the segment count of disabled parameters. Bound that copy. */
    if (params.SegNum < 0 || params.SegNum > 6) {
        result->ret = -8; return result;
    }
    float y[LSAUDIO_DRC_POINTS_MAX] = {0};
    struDrcPrm modified;
    result->ret = DrcDraw(&params, ui, y, &modified);
    if (result->ret < 0) return result;
    result->arr_size = ui->WidthX;
    result->dot_size = params.SegNum + 1;
    result->fs = modified.Fs;
    for (int i = 0; i < result->arr_size; ++i) {
        result->points[i][0] = DrcCalcXToDb(ui, i);
        result->points[i][1] = y[i];
    }
    for (int i = 0; i < result->dot_size; ++i) result->dots[i] = modified.Dot[i];
    return result;
}

void freePoints(eqDrawResult *result) { free(result); }
void freeDrcPoints(drcDrawResult *result) { free(result); }
