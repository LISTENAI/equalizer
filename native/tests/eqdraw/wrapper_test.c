#include "lsaudio/eqdraw.h"
#include <limits.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition) do { if (!(condition)) { \
    fprintf(stderr, "line %d: %s\n", __LINE__, #condition); return 1; \
} } while (0)

int main(void)
{
    struMonoEqPrm p = {0};
    struUIXYInfo ui = {20, 20000, -30, 30, 1024, 61};
    for (int i = 0; i < 10; ++i) {
        p.FilterPrm[i].FilterType = 2;
        p.FilterPrm[i].fSampleRateHz = 48000;
        p.FilterPrm[i].fQ = 0.707f;
        p.FilterPrm[i].fFreqHz = 1000;
    }
    eqDrawResult *eq = eqDrawPoints(&p, &ui);
    CHECK(eq && eq->ret == 0 && eq->arr_size == 1024);
    CHECK(eq->points[1023][0] > 19999 && eq->points[1023][1] == 0);
    freePoints(eq);
    int invalid[] = {-1, 1025, INT_MAX};
    for (unsigned i = 0; i < sizeof(invalid) / sizeof(invalid[0]); ++i) {
        ui.xNum = invalid[i];
        eq = eqDrawPoints(&p, &ui);
        CHECK(eq && eq->ret == -12 && eq->arr_size == 0 && eq->points[1023][1] == 0);
        freePoints(eq);
    }
    eq = eqDrawPoints(&p, NULL);
    CHECK(eq && eq->ret == -11 && eq->arr_size == 0);
    freePoints(eq);
    ui.xNum = 3;
    ui.startFreq = 0;
    eq = eqDrawPoints(&p, &ui);
    CHECK(eq && eq->ret == 0 && ui.startFreq == 0.000001);
    CHECK(eq->points[0][0] > 0 && eq->points[0][1] == 0);
    freePoints(eq);
    eq = eqDrawPoints(NULL, &ui);
    CHECK(eq && eq->ret == -2 && eq->arr_size == 0);
    freePoints(eq);

    struDrcPrm drc = {0};
    struUIDrcInfo drc_ui = {315, 315, -100, 0, -100, 0};
    drc.iEnable = 1; drc.Fs = 48000; drc.SegNum = 2;
    drc.Dot[0].X = drc.Dot[0].Y = -100;
    drc.Dot[1].X = drc.Dot[1].Y = -30;
    drc.Dot[1].W = 100;
    drc.Dot[2].Y = -15;
    drcDrawResult *d = drcDrawPoints(drc, &drc_ui);
    CHECK(d && d->ret == 0 && d->arr_size == 315 && d->dot_size == 3);
    CHECK(d->fs == 48000 && d->dots[1].W == 30 && drc.Dot[1].W == 100);
    CHECK(d->points[314][0] == 0 && d->points[314][1] < -15);
    CHECK(d->dots[6].X == 0);
    freeDrcPoints(d);
    int bad_width[] = {-1, 316, INT_MAX};
    for (unsigned i = 0; i < sizeof(bad_width) / sizeof(bad_width[0]); ++i) {
        drc_ui.WidthX = bad_width[i];
        d = drcDrawPoints(drc, &drc_ui);
        CHECK(d && d->ret == -17 && d->arr_size == 0 && d->dot_size == 0 && d->fs == 0);
        freeDrcPoints(d);
    }
    drc_ui.WidthX = 33;
    d = drcDrawPoints(drc, &drc_ui);
    CHECK(d && d->ret == 0 && d->arr_size == 33 && d->points[314][0] == 0 && d->points[314][1] == 0);
    freeDrcPoints(d);
    drc.iEnable = 0; drc.SegNum = 7;
    d = drcDrawPoints(drc, &drc_ui);
    CHECK(d && d->ret == -8 && d->dot_size == 0);
    freeDrcPoints(d);
    d = drcDrawPoints(drc, NULL);
    CHECK(d && d->ret == -20);
    freeDrcPoints(d);
    freePoints(NULL); freeDrcPoints(NULL);
    /* Repeated successful and failed allocation/free paths; the wrapper uses
     * stack scratch storage, so only each returned object requires freeing. */
    for (int i = 0; i < 2000; ++i) {
        eq = eqDrawPoints(&p, &ui);
        CHECK(eq && eq->ret == 0 && eq->points[1023][0] == 0);
        freePoints(eq);
        d = drcDrawPoints(drc, &drc_ui);
        CHECK(d && d->ret == -8);
        freeDrcPoints(d);
    }
    puts("wrapper ABI, by-value DRC, capacities, error payloads and repeated allocation/free: passed");
    return 0;
}
