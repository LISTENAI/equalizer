#include "biquad.h"
#include <math.h>

/* These rounding points are observable in the original coefficient exports.
 * In particular, the angular constant is binary32 2*pi promoted to double. */
void lsaudio_biquad_coefficients(const struFilterPrm *p, double a[3], double b[3])
{
    float w = (float)((double)p->fFreqHz * 6.2831854820251465 / p->fSampleRateHz);
    float c = (float)cos(w), s = (float)sin(w);
    float alpha = (float)((double)s / (2.0 * p->fQ));
    float aa[3], bb[3];
    if (p->FilterType < 2) {
        double v = p->FilterType == 0 ? 1.0 - c : 1.0 + c;
        bb[0] = bb[2] = (float)(v * 0.5);
        bb[1] = (float)(p->FilterType == 0 ? v : -v);
        aa[0] = (float)(1.0 + alpha);
        aa[1] = (float)(-2.0 * c);
        aa[2] = (float)(1.0 - alpha);
    } else {
        float gain = (float)pow(10.0, (double)p->fDbGain / 40.0);
        if (p->FilterType == 2) {
            float boost = alpha * gain, cut = alpha / gain;
            bb[0] = (float)(1.0 + boost);
            bb[1] = (float)(-2.0 * c);
            bb[2] = (float)(1.0 - boost);
            aa[0] = (float)(1.0 + cut);
            aa[1] = bb[1];
            aa[2] = (float)(1.0 - cut);
        } else {
            float beta = (float)(sqrt(gain) / p->fQ);
            beta *= s;
            double plus = (double)gain + 1.0, minus = (double)gain - 1.0;
            if (p->FilterType == 3) {
                double numerator = plus - (double)c * minus;
                double denominator = (double)c * minus + plus;
                bb[0] = (float)(((double)beta + numerator) * gain);
                bb[1] = (float)((minus - (double)c * plus) * ((double)gain * 2.0));
                bb[2] = (float)((numerator - beta) * gain);
                aa[0] = (float)((double)beta + denominator);
                aa[1] = (float)(((double)c * plus + minus) * -2.0);
                aa[2] = (float)(denominator - beta);
            } else {
                double numerator = plus + (double)c * minus;
                double denominator = plus - (double)c * minus;
                bb[0] = (float)(((double)beta + numerator) * gain);
                bb[1] = (float)(((double)c * plus + minus) * ((double)gain * -2.0));
                bb[2] = (float)((numerator - beta) * gain);
                aa[0] = (float)((double)beta + denominator);
                aa[1] = (float)((minus - (double)c * plus) * 2.0);
                aa[2] = (float)(denominator - beta);
            }
        }
    }
    if (p->fFreqHz >= (double)p->fSampleRateHz * 0.5 || p->fFreqHz < 0) {
        bb[0] = aa[0]; bb[1] = bb[2] = aa[1] = aa[2] = 0;
    }
    a[0] = 1;
    for (int i = 0; i < 3; ++i) {
        b[i] = (float)(bb[i] / aa[0]);
        if (i) a[i] = (float)(aa[i] / aa[0]);
    }
}
