#include "lsaudio/eqdrc.h"
#include <math.h>

double EqCalcXToFreq(int x, struUIXYInfo *ui)
{
    if (ui->startFreq == 0) ui->startFreq = 0.000001;
    return pow(10.0, log10(ui->startFreq) + (double)x *
               ((log10(ui->endFreq) - log10(ui->startFreq)) / (ui->xNum - 1)));
}

int EqCalcFreqToX(double frequency, const struUIXYInfo *ui)
{
    return (int)((log10(frequency) - log10(ui->startFreq)) * (ui->xNum - 1) /
                 (log10(ui->endFreq) - log10(ui->startFreq)));
}

double EqCalcYToGain(int y, const struUIXYInfo *ui)
{
    return ui->startGain + y * (ui->endGain - ui->startGain) / (ui->yNum - 1);
}

int EqCalcGainToY(double gain, const struUIXYInfo *ui)
{
    return (int)((gain - ui->startGain) * (ui->yNum - 1) / (ui->endGain - ui->startGain));
}

float DrcCalcXToDb(const struUIDrcInfo *ui, int x)
{
    return ui->startXGain + (float)x * (ui->endXGain - ui->startXGain) / (float)(ui->WidthX - 1);
}

float DrcCalcYToDb(const struUIDrcInfo *ui, int y)
{
    return ui->startYGain + (float)y * (ui->endYGain - ui->startYGain) / (float)(ui->HeightY - 1);
}

int DrcCalcDbToX(const struUIDrcInfo *ui, float gain)
{
    return (int)roundf((gain - ui->startXGain) * (float)ui->WidthX / (ui->endXGain - ui->startXGain));
}

int DrcCalcDbToY(const struUIDrcInfo *ui, float gain)
{
    return (int)roundf((gain - ui->startYGain) * (float)ui->HeightY / (ui->endYGain - ui->startYGain));
}
