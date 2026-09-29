#include "lsaudio/eqdrc.h"
#include <math.h>
#include <stdlib.h>
#include "fft4096.h"
#include "biquad.h"

#define FFT_SIZE 4096
#define BINS (FFT_SIZE / 2)

static int validate(const struMonoEqPrm *p, const struUIXYInfo *ui, const double *y)
{
    if (!p) return -2;
    if (p->Enable > 1) return -3;
    /* Disabled filters are still validated by the reference. */
    for (int i = 0; i < 10; ++i) {
        const struFilterPrm *f = p->FilterPrm + i;
        if (f->FilterEnable > 1) return -5;
        if (f->FilterType > 4) return -6;
        if (f->fSampleRateHz != 16000 && f->fSampleRateHz != 48000) return -7;
        if (!isfinite(f->fQ) || f->fQ < 0.3f || f->fQ > 30) return -8;
        if (!isfinite(f->fDbGain) || f->fDbGain < -30 || f->fDbGain > 30) return -9;
        if (!isfinite(f->fFreqHz) || f->fFreqHz < 20 ||
            f->fFreqHz > (f->fSampleRateHz == 16000 ? 8000 : 20000)) return -10;
    }
    if (!ui) return -11;
    if (ui->xNum <= 0 || ui->yNum <= 0) return -12;
    if (!isfinite(ui->startFreq) || !isfinite(ui->endFreq) || ui->startFreq < 0 || ui->startFreq >= ui->endFreq) return -13;
    if (!isfinite(ui->startGain) || !isfinite(ui->endGain) || ui->startGain >= ui->endGain) return -14;
    if (!y) return -15;
    return 0;
}

static double interpolate(const double *db, double step, double frequency, double value)
{
    /* Reference selects the first minimum of abs((int)(binHz-frequency)),
     * then the next three closest neighbours and uses Lagrange interpolation. */
    int nearest = 0;
    double distance = HUGE_VAL;
    for (int i = 0; i < BINS; ++i) {
        double delta = trunc(i * step - frequency);
        if (fabs(delta) < distance) { distance = fabs(delta); nearest = i; }
    }
    int indices[4] = {nearest, 0, 0, 0};
    int left = nearest - 1, right = nearest + 1;
    for (int i = 1; i < 4; ++i) {
        if (right >= BINS || (left >= 0 && right * step - frequency >= frequency - left * step)) indices[i] = left--;
        else indices[i] = right++;
    }
    for (int i = 0; i < 4; ++i) {
        double term = db[indices[i]];
        for (int j = 0; j < 4; ++j) if (i != j) {
            term = ((frequency - indices[j] * step) * term) / (indices[i] * step - indices[j] * step);
        }
        value += term;
    }
    return value;
}

int EqDraw(const struMonoEqPrm *p, struUIXYInfo *ui, double *y)
{
    int error = validate(p, ui, y);
    if (error || !p->Enable) return error;
    /* The reference has undefined behaviour for an enabled one-point plot. */
    if (ui->xNum == 1) return -12;
    double *work = (double *)calloc(FFT_SIZE * 2, sizeof(double));
    if (!work) return -1;
    double *spectrum = work + FFT_SIZE;
    work[0] = 1;
    for (int f = 0; f < 10; ++f) if (p->FilterPrm[f].FilterEnable) {
        double a[3], b[3], x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        lsaudio_biquad_coefficients(p->FilterPrm + f, a, b);
        for (int i = 0; i < FFT_SIZE; ++i) {
            double x = work[i];
            double feedback = (-y1 * a[1] + 0.0) + (-y2 * a[2]);
            double out = b[0] * x + feedback;
            out += b[1] * x1;
            out += b[2] * x2;
            x2 = x1; x1 = x; y2 = y1; y1 = out; work[i] = out;
        }
    }
    lsaudio_rfft4096(work, spectrum);
    spectrum[1] = 0; /* Packed Nyquist bin is excluded by the original. */
    for (int i = 0; i < BINS; ++i) work[i] = 20.0 * log10(sqrt(spectrum[i * 2] * spectrum[i * 2] + spectrum[i * 2 + 1] * spectrum[i * 2 + 1]));
    double step = ((int)p->FilterPrm[0].fSampleRateHz / 2) / (double)(BINS - 1);
    if (ui->startFreq == 0) ui->startFreq = 0.000001;
    for (int i = 0; i < ui->xNum; ++i) {
        double frequency = pow(10.0, log10(ui->startFreq) + i * ((log10(ui->endFreq) - log10(ui->startFreq)) / (ui->xNum - 1)));
        /* The vendor helper accumulates into the caller's existing output. */
        y[i] = interpolate(work, step, frequency, y[i]);
    }
    free(work);
    return 0;
}
