#include "lsaudio/eqdrc.h"
#include <math.h>
#include <string.h>

static int validate(const struDrcPrm *p, const struUIDrcInfo *ui)
{
    if (!p) return -3;
    if (!ui) return -20;
    if (p->iEnable != 0 && p->iEnable != 1) return -1;
    if (p->iEnable) {
        if (p->Fs != 16000 && p->Fs != 48000) return -7;
        if (!isfinite(p->Rt) || p->Rt < 0 || p->Rt > 1.00001f) return -10;
        if (!isfinite(p->At) || p->At < 0 || p->At > 0.10001f) return -9;
        if (!isfinite(p->RmsTime) || p->RmsTime < 0 || p->RmsTime > 0.10001f) return -10;
        if (p->Type < 0 || p->Type > 1) return -14;
        if (p->SegNum < 2 || p->SegNum > 6) return -8;
        if (p->Dot[0].X != -100 || p->Dot[p->SegNum].X != 0) return -11;
        for (int i = 0; i < p->SegNum; ++i) {
            if (!isfinite(p->Dot[i].X) || p->Dot[i].X < -100 || p->Dot[i].X > 0 || p->Dot[i].X > p->Dot[i + 1].X) return -11;
            if (!isfinite(p->Dot[i].Y) || p->Dot[i].Y < -100) return -12;
        }
        if (!isfinite(p->Dot[p->SegNum].Y) || p->Dot[p->SegNum].Y < -100 || p->Dot[p->SegNum].Y > 0) return -12;
    }
    if (ui->WidthX <= p->SegNum) return -17;
    if (!isfinite(ui->startXGain) || ui->startXGain < -100 || ui->startXGain >= ui->endXGain) return -18;
    if (!isfinite(ui->endXGain) || ui->endXGain > 0) return -19;
    if (ui->HeightY <= p->SegNum) return -17;
    if (!isfinite(ui->startYGain) || ui->startYGain < -100 || ui->startYGain >= ui->endYGain) return -21;
    if (!isfinite(ui->endYGain) || ui->endYGain > 0) return -22;
    return 0;
}

static void modify(const struDrcPrm *p, struDrcPrm *m)
{
    *m = *p;
    m->At = m->Rt = 0;
    m->Type = 0;
    m->Fs = fminf(48000, fmaxf(16000, m->Fs));
    if (m->SegNum < 1) m->SegNum = 1;
    if (m->SegNum > 6) m->SegNum = 6;
    m->Dot[0].X = -100;
    m->Dot[m->SegNum].X = 0;
    for (int i = 1; i < m->SegNum; ++i) if (m->Dot[i].X < m->Dot[i - 1].X) m->Dot[i].X = m->Dot[i - 1].X;
    for (int i = 0; i <= m->SegNum; ++i) {
        if (i < m->SegNum) {
            float gap = m->Dot[i + 1].X - m->Dot[i].X;
            if (m->Dot[i].W * 0.5f > gap * 0.5f) m->Dot[i].W = gap;
        }
        if (i > 0) {
            float gap = m->Dot[i].X - m->Dot[i - 1].X;
            if (m->Dot[i].W * 0.5f > gap * 0.5f) m->Dot[i].W = gap;
        }
    }
}

int DrcDrawGet(const struDrcPrm2 *object, struDrcPrm *params)
{
    if (!object) return -2;
    if (!params) return -3;
    memmove(params, &object->ModifiedDrcPrm, sizeof(*params));
    return 0;
}

int DrcDraw(const struDrcPrm *p, const struUIDrcInfo *ui, float *y, struDrcPrm *modified)
{
    if (!y) return -5;
    int error = validate(p, ui);
    if (error) return error;
    if (!modified) return -3;
    if (ui->WidthX < 2 || ui->HeightY < 1) return -17;
    for (int i = 0; i < 7; ++i) if (!isfinite(p->Dot[i].X) || !isfinite(p->Dot[i].Y) || !isfinite(p->Dot[i].W)) return -1;
    struDrcPrm m;
    modify(p, &m);
    *modified = m;
    float x[7], half[7], offset[7], slope[6], inverse[7];
    for (int i = 0; i <= m.SegNum; ++i) {
        x[i] = m.Dot[i].X * 32768.0f;
        half[i] = (m.Dot[i].W * 32768.0f) * 0.5f;
        offset[i] = (m.Dot[i].Y - m.Dot[i].X) * 32768.0f;
        inverse[i] = 1.0f / fmaxf(m.Dot[i].W, 0.01f);
        if (i < m.SegNum) slope[i] = (m.Dot[i + 1].Y - m.Dot[i].Y) / fmaxf(m.Dot[i + 1].X - m.Dot[i].X, 0.01f);
    }
    float previous_gain = 0;
    for (int i = 0; i < ui->WidthX; ++i) {
        float db = (ui->endXGain - ui->startXGain) * (float)i / (float)(ui->WidthX - 1) + ui->startXGain;
        float input = powf(10.0f, db / 20.0f) * 32768.0f;
        float level = (log10f(fabsf(input * (1.0f / 32768.0f))) * 20.0f) * 32768.0f;
        float out = 0;
        if (level <= x[0] - half[0]) out = (level + 0.0f) + offset[0];
        else if (level > x[m.SegNum] + half[m.SegNum]) {
            out = (level - x[m.SegNum]) * slope[m.SegNum - 1] + x[m.SegNum];
            out = (out + 0.0f) + offset[m.SegNum];
        } else {
            int found = 0;
            for (int j = 0; j < m.SegNum; ++j) if (level > x[j] + half[j] && level <= x[j + 1] - half[j + 1]) {
                out = (level - x[j]) * slope[j] + x[j];
                out = (out + 0.0f) + offset[j];
                found = 1;
                break;
            }
            if (!found) for (int j = 0; j <= m.SegNum; ++j) if (level > x[j] - half[j] && level <= x[j] + half[j]) {
                float delta = level - x[j];
                float left = (delta - half[j]) * (1.0f / 256.0f);
                float right = (delta + half[j]) * (1.0f / 256.0f);
                float before = j == 0 ? 1.0f : slope[j - 1];
                float after = j == m.SegNum ? before : slope[j];
                float a = ((1.0f - before) * left) * left;
                float b = ((after - 1.0f) * right) * right;
                out = (a + b) * inverse[j];
                out = ((out + level) + 0.0f) + offset[j];
                break;
            }
        }
        /* Drawing uses zero attack/release but the fixed-point-inspired
         * smoother still has a 0.5 coefficient and a +2 rounding bias.
         * Removing these changes the returned curve measurably. */
        float gain = out - level;
        float smoothed = (((previous_gain - gain + 2.0f) * 0.25f) * 0.5f) * (1.0f / 1024.0f) + gain;
        previous_gain = smoothed;
        float exponent = fmaxf(-3276800.0f, fminf(smoothed, 3276800.0f));
        /* Preserve the vendor approximation to the dB->linear exponent,
         * rather than replacing it with ln(10)/20. */
        exponent = ((exponent * 236.0f) * (1.0f / 65536.0f)) * (1.0f / 1024.0f);
        float multiplier = expf(exponent) * 1024.0f;
        float output = (float)(((double)input * multiplier) * (1.0 / 1024.0));
        y[i] = output == 0 ? -100 : log10f(fabsf(output * (1.0f / 32768.0f))) * 20.0f;
    }
    if (y[0] < -100) y[0] = -100;
    return 0;
}
