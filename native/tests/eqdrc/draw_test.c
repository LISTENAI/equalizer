#include "lsaudio/eqdrc.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition) do { if (!(condition)) { \
    fprintf(stderr, "line %d: %s\n", __LINE__, #condition); return 1; \
} } while (0)

int main(void)
{
    struMonoEqPrm eq = {0};
    struUIXYInfo eq_ui = {20, 20000, -30, 30, 3, 61};
    double output[5] = {999, 2.5, 2.5, 2.5, 999};
    for (int i = 0; i < 10; ++i) {
        eq.FilterPrm[i].FilterType = 2;
        eq.FilterPrm[i].fSampleRateHz = 48000;
        eq.FilterPrm[i].fQ = 0.707f;
        eq.FilterPrm[i].fFreqHz = 1000;
    }
    CHECK(EqDraw(&eq, &eq_ui, output + 1) == 0);
    eq.Enable = 1;
    CHECK(EqDraw(&eq, &eq_ui, output + 1) == 0);
    CHECK(output[0] == 999 && output[1] == 2.5 && output[3] == 2.5 && output[4] == 999);
    eq_ui.startFreq = 0;
    CHECK(EqDraw(&eq, &eq_ui, output + 1) == 0);
    CHECK(eq_ui.startFreq == 0.000001);
    eq_ui.xNum = 1;
    CHECK(EqDraw(&eq, &eq_ui, output + 1) == -12);
    eq_ui.xNum = 3;
    eq.FilterPrm[0].fQ = NAN;
    CHECK(EqDraw(&eq, &eq_ui, output + 1) == -8);
    CHECK(output[1] == 2.5);
    CHECK(EqDraw(NULL, NULL, NULL) == -2);

    struDrcPrm p = {0}, modified;
    struUIDrcInfo ui = {3, 61, -100, 0, -100, 0};
    float drc_output[5] = {999, 7, 7, 7, 999};
    p.iEnable = 1; p.Fs = 48000; p.At = 0.01f; p.Rt = 0.1f;
    p.Type = 1; p.RmsTime = 0.02f; p.SegNum = 2;
    p.Dot[0].X = p.Dot[0].Y = -100;
    p.Dot[1].X = p.Dot[1].Y = -30;
    p.Dot[2].Y = -15;
    CHECK(DrcDraw(&p, &ui, drc_output + 1, &modified) == 0);
    CHECK(drc_output[0] == 999 && drc_output[4] == 999);
    CHECK(modified.At == 0 && modified.Rt == 0 && modified.Type == 0);
    CHECK(p.At == 0.01f && p.Type == 1);
    CHECK(DrcDraw(NULL, &ui, drc_output + 1, &modified) == -3);
    CHECK(DrcDraw(&p, &ui, NULL, &modified) == -5);
    CHECK(DrcDraw(&p, &ui, drc_output + 1, NULL) == -3);
    p.Dot[0].W = NAN;
    CHECK(DrcDraw(&p, &ui, drc_output + 1, &modified) == -1);
    struDrcPrm2 object = {0};
    object.ModifiedDrcPrm = modified;
    memset(&p, 0, sizeof(p));
    CHECK(DrcDrawGet(&object, &p) == 0);
    CHECK(memcmp(&modified, &p, sizeof(p)) == 0);
    CHECK(DrcDrawGet(NULL, &p) == -2);
    CHECK(DrcDrawGet(&object, NULL) == -3);
    puts("curve contracts, output bounds and safe rejection of undefined vendor inputs: passed");
    return 0;
}
