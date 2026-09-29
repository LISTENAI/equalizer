#include "lsaudio/soundeffect.h"
#include "biquad.h"
#include <math.h>
#include <limits.h>
#include <string.h>
#include "tables.inc"

#define SOUND_MAGIC UINT32_C(0x534e4431)
typedef struct { int32_t c[5], x1, x2, y1, y2; uint32_t shift; } Biquad;
typedef struct {
    int32_t x[7], half[7], offset[7], attack, release, previous;
    float slope[6], inverse[7];
} Compressor;
typedef struct {
    float samples[256], threshold, attack, release, makeup, gain, peak;
    int32_t enable, length, index, peak_index;
} Limiter;
typedef struct {
    uint32_t magic;
    IFLYTEK_StruAudioPrm params;
    Biquad filters[12];
    Compressor compressor;
    float volume;
    Limiter limiter;
} Sound;
_Static_assert(sizeof(Sound) <= LSAUDIO_SOUND_INSTANCE_BYTES, "instance buffer too small");
_Static_assert(_Alignof(Sound) <= _Alignof(uint32_t), "instance alignment changed");

/* Explicit x86 conversion/wrap semantics without signed overflow UB. */
static int32_t signed_bits(uint32_t x) { int32_t out; memcpy(&out, &x, 4); return out; }
static int32_t asr(int32_t x, unsigned bits)
{
    if (!bits) return x;
    return signed_bits(((uint32_t)x >> bits) | (x < 0 ? UINT32_MAX << (32 - bits) : 0));
}
static int32_t add32(int32_t a, int32_t b) { return signed_bits((uint32_t)a + (uint32_t)b); }
static int32_t sub32(int32_t a, int32_t b) { return signed_bits((uint32_t)a - (uint32_t)b); }
static int32_t mul32(int32_t a, int32_t b) { return signed_bits((uint32_t)a * (uint32_t)b); }
static int32_t cvt(float x)
{
    if (!isfinite(x) || x >= 2147483648.0f || x < -2147483648.0f) return INT32_MIN;
    return (int32_t)x;
}
static int32_t scale(int32_t value, float factor)
{
    float v = (float)value * factor;
    return cvt(fmaxf(-2147483648.0f, fminf(v, 2147483648.0f)));
}
static int valid(const Sound *s) { return s && s->magic == SOUND_MAGIC; }

static IFLYTEK_StruAudioPrm defaults(void)
{
    IFLYTEK_StruAudioPrm p = {0};
    p.BassBoostPrm.fFs = 48000; p.BassBoostPrm.fFreqHz = 500;
    p.TrebleoostPrm.iEnable = 1; p.TrebleoostPrm.fFs = 48000; p.TrebleoostPrm.fFreqHz = 2000;
    p.PeqPrm.Enable = 1;
    const uint8_t types[5] = {1, 2, 2, 2, 2};
    const float qs[5] = {0.707f, 3, 0.7f, 0.7f, 5};
    const float gains[5] = {0, -5, 2, -8, 5};
    const float frequencies[5] = {300, 190, 600, 2800, 16000};
    for (int i = 0; i < 10; ++i) {
        struFilterPrm *f = &p.PeqPrm.FilterPrm[i];
        f->FilterType = types[i % 5]; f->fSampleRateHz = 48000;
        f->fQ = qs[i % 5]; f->fDbGain = gains[i % 5]; f->fFreqHz = frequencies[i % 5];
    }
    p.DrcPrm.Fs = 48000; p.DrcPrm.At = 0.005f; p.DrcPrm.Rt = 0.1f; p.DrcPrm.SegNum = 6;
    const float dots[7] = {-100, -80, -40, -20, -15, -6, 0};
    for (int i = 0; i < 7; ++i) p.DrcPrm.Dot[i].X = p.DrcPrm.Dot[i].Y = dots[i];
    p.GainPrm.iEnable = 1; p.GainPrm.dSampleRate = 48000;
    return p;
}

static void configure_filter(Biquad *f, const struFilterPrm *p)
{
    double a[3], b[3];
    lsaudio_biquad_coefficients(p, a, b);
    float maximum = 1;
    for (int i = 1; i < 3; ++i) maximum = fmaxf(maximum, fabsf((float)a[i]));
    for (int i = 0; i < 2; ++i) maximum = fmaxf(maximum, fabsf((float)b[i]));
    memset(f, 0, sizeof(*f));
    if (!isfinite(maximum)) return; /* malformed disabled filters may be unchecked by the legacy API */
    f->shift = maximum > 1 ? (uint32_t)ceilf(log2f(maximum)) : 0;
    if (f->shift > 30) f->shift = 30;
    float factor = (float)(UINT32_C(1) << (31 - f->shift));
    for (int i = 0; i < 3; ++i) f->c[i] = cvt((float)b[i] * factor);
    f->c[3] = cvt(-(float)a[1] * factor);
    f->c[4] = cvt(-(float)a[2] * factor);
}
static void filter_samples(Biquad *f, int32_t *samples, int n)
{
    for (int i = 0; i < n; ++i) {
        int32_t x = samples[i];
        uint64_t acc = (uint64_t)((int64_t)f->c[0] * x);
        acc += (uint64_t)((int64_t)f->c[1] * f->x1);
        acc += (uint64_t)((int64_t)f->c[2] * f->x2);
        acc += (uint64_t)((int64_t)f->c[3] * f->y1);
        acc += (uint64_t)((int64_t)f->c[4] * f->y2);
        int32_t y = signed_bits((uint32_t)(acc >> (31 - f->shift)));
        f->x2 = f->x1; f->x1 = x; f->y2 = f->y1; f->y1 = y;
        samples[i] = y;
    }
}
static int validate_boost(const struBassBoostPrm *p, int base)
{
    if ((uint32_t)p->iEnable > 1) return -(base + 6);
    if (!isfinite(p->fFs) || p->fFs < 8000 || p->fFs > 48000) return -(base + 7);
    if (!isfinite(p->fDbGain) || p->fDbGain < -100 || p->fDbGain > 100) return -(base + 9);
    if (!isfinite(p->fFreqHz) || p->fFreqHz < 0 || p->fFreqHz > p->fFs * 0.5f) return -(base + 8);
    return 0;
}
static int validate_eq(const struMonoEqPrm *p)
{
    uint32_t enable; memcpy(&enable, p, 4);
    if (enable > 1) return -306;
    for (int i = 0; i < 10; ++i) {
        const struFilterPrm *f = &p->FilterPrm[i];
        if (!f->FilterEnable) continue;
        if (f->FilterEnable != 1) return -306;
        if (f->FilterType > 4) return -307;
        if (!isfinite(f->fSampleRateHz) || f->fSampleRateHz < 8000 || f->fSampleRateHz > 48000) return -308;
        if (!isfinite(f->fQ) || f->fQ < 0.3f || f->fQ > 30) return -309;
        if (!isfinite(f->fDbGain) || f->fDbGain < -30 || f->fDbGain > 30) return -310;
        if (!isfinite(f->fFreqHz) || f->fFreqHz < 20 || f->fFreqHz > 20000) return -311;
    }
    return 0;
}
static int validate_drc(const struDrcPrm *p)
{
    if ((uint32_t)p->iEnable > 1) return -406;
    if (!isfinite(p->Fs) || p->Fs < 8000 || p->Fs > 48000) return -407;
    if (!isfinite(p->At) || p->At < 0 || p->At > 0.1f) return -409;
    if (!isfinite(p->Rt) || p->Rt < 0 || p->Rt > 1) return -410;
    if (p->iEnable) {
        if (p->SegNum < 2 || p->SegNum > 6) return -408;
        for (int i = 0; i <= p->SegNum; ++i) {
            if (!isfinite(p->Dot[i].X) || p->Dot[i].X < -100 || p->Dot[i].X > 0) return -411;
            if (!isfinite(p->Dot[i].Y) || p->Dot[i].Y < -100 || p->Dot[i].Y > 0) return -412;
            if (!isfinite(p->Dot[i].W) || p->Dot[i].W < 0 || p->Dot[i].W > 20) return -417;
        }
        if (p->Dot[0].X != -100) return -418;
        if (p->Dot[p->SegNum].X != 0) return -419;
        for (int i = 0; i < p->SegNum; ++i) if (p->Dot[i].X >= p->Dot[i + 1].X) return -420;
    }
    if ((uint32_t)p->Type > 1) return -415;
    if (p->Type == 1 && (!isfinite(p->RmsTime) || p->RmsTime < 0 || p->RmsTime > 0.1f)) return -416;
    return 0;
}
static void configure_drc(Sound *s, const struDrcPrm *source)
{
    struDrcPrm p = *source;
    if (p.Type == 1) p.Type = 0;
    if (p.SegNum < 1) p.SegNum = 1;
    if (p.SegNum > 6) p.SegNum = 6;
    p.Dot[0].X = -100; p.Dot[p.SegNum].X = 0;
    for (int i = 1; i < p.SegNum; ++i) if (p.Dot[i].X < p.Dot[i - 1].X) p.Dot[i].X = p.Dot[i - 1].X;
    for (int i = 0; i <= p.SegNum; ++i) {
        if (i < p.SegNum) p.Dot[i].W = fminf(p.Dot[i].W, p.Dot[i + 1].X - p.Dot[i].X);
        if (i) p.Dot[i].W = fminf(p.Dot[i].W, p.Dot[i].X - p.Dot[i - 1].X);
    }
    s->params.DrcPrm = p;
    Compressor *d = &s->compressor;
    float fs = (float)(int32_t)p.Fs;
    float exponent = -2.1972246170043945f / fmaxf(fs * p.At, 0.000001f);
    d->attack = (int32_t)(exp((double)exponent) * 4096.0 + 0.5);
    exponent = -2.1972246170043945f / fmaxf(fs * p.Rt, 0.000001f);
    d->release = (int32_t)(exp((double)exponent) * 4096.0 + 0.5);
    for (int i = 0; i <= p.SegNum; ++i) {
        d->x[i] = cvt(p.Dot[i].X * 32768.0f);
        d->half[i] = asr(cvt(p.Dot[i].W * 32768.0f), 1);
        d->offset[i] = cvt((p.Dot[i].Y - p.Dot[i].X) * 32768.0f);
        d->inverse[i] = 1.0f / fmaxf(p.Dot[i].W, 0.01f);
        if (i < p.SegNum) d->slope[i] = (p.Dot[i + 1].Y - p.Dot[i].Y) / fmaxf(p.Dot[i + 1].X - p.Dot[i].X, 0.01f);
    }
}
static int set_module(Sound *s, const IFLYTEK_StruAudioPrm *p, int module)
{
    int error;
    if (module < 2) {
        const struBassBoostPrm *v = module ? &p->TrebleoostPrm : &p->BassBoostPrm;
        error = validate_boost(v, module ? 200 : 100);
        if (error) return error;
        if (v->iEnable) {
            struFilterPrm f = {0}; f.FilterEnable = 1; f.FilterType = module ? 4 : 3;
            f.fSampleRateHz = v->fFs; f.fQ = 0.7071067690849304f; f.fDbGain = v->fDbGain; f.fFreqHz = v->fFreqHz;
            configure_filter(&s->filters[module], &f);
        }
        if (module) s->params.TrebleoostPrm = *v; else s->params.BassBoostPrm = *v;
    } else if (module == 2) {
        error = validate_eq(&p->PeqPrm); if (error) return error;
        for (int i = 0; i < 10; ++i) {
            const struFilterPrm *f = &p->PeqPrm.FilterPrm[i];
            if (f->FilterType <= 4 && isfinite(f->fSampleRateHz) && f->fSampleRateHz > 0 && isfinite(f->fQ) && f->fQ > 0)
                configure_filter(&s->filters[i + 2], f);
            else memset(&s->filters[i + 2], 0, sizeof(Biquad));
        }
        s->params.PeqPrm = p->PeqPrm;
    } else if (module == 3) {
        error = validate_drc(&p->DrcPrm); if (error) return error;
        for (int i = 0; i < 7; ++i) if (!isfinite(p->DrcPrm.Dot[i].X) || !isfinite(p->DrcPrm.Dot[i].Y) || !isfinite(p->DrcPrm.Dot[i].W)) return -1;
        configure_drc(s, &p->DrcPrm);
    } else {
        const struGainPrm *v = &p->GainPrm;
        if ((uint32_t)v->iEnable > 1) return -506;
        if (!isfinite(v->dSampleRate) || v->dSampleRate < 8000 || v->dSampleRate > 48000) return -508;
        if (!isfinite(v->dVolume) || v->dVolume < -100 || v->dVolume > 100) return -509;
        s->params.GainPrm = *v;
        s->volume = powf(10, v->dVolume / 20.0f);
    }
    return 0;
}

static int32_t level_db(int32_t input)
{
    uint32_t magnitude = input < 0 ? 0u - (uint32_t)input : (uint32_t)input;
    float value = (float)signed_bits(magnitude);
    uint32_t bits; memcpy(&bits, &value, 4);
    uint32_t mantissa = (bits & UINT32_C(0x7fffff)) | UINT32_C(0x3f000000);
    memcpy(&value, &mantissa, 4);
    int index = (int)(((value - 0.5f) * 1024.0f) * 2.0f);
    float exponent = (float)((int)((bits >> 23) & 255) - 126);
    float log_value = exponent * 0.6931471824645996f + log_fraction[index];
    return cvt((log_value - 10.397207260131836f) * 284619.21875f);
}
static int32_t exponential(int32_t exponent)
{
    /* Q10 exponential, including original signed-16 truncation. */
    int32_t neg = -(int32_t)(int16_t)(uint16_t)exponent;
    int integer = -asr(neg, 10);
    if (integer < -5) return 1;
    if (integer > 5) return 1048576;
    unsigned fraction = ((uint32_t)neg << 6) & 65535;
    unsigned index = fraction >> 8, blend = fraction & 255;
    uint32_t v = ((uint32_t)exp_fraction[index] * (256 - blend) + (uint32_t)exp_fraction[index + 1] * blend) >> 8;
    if (!integer) return (int32_t)(v >> 6);
    uint32_t factor = exp_integer[integer + 5];
    uint32_t low = ((factor & 65535) * v + 32767) >> 16;
    uint32_t high = (factor >> 16) * v;
    return (int32_t)((low + high) >> 6);
}
static void compress(Sound *s, int32_t *samples, int count)
{
    if (!s->params.DrcPrm.iEnable) return;
    Compressor *d = &s->compressor;
    int segments = s->params.DrcPrm.SegNum;
    for (int i = 0; i < count; ++i) {
        int32_t level = level_db(samples[i]), out = 0;
        if (level <= d->x[0] - d->half[0]) out = add32(level, d->offset[0]);
        else if (level > d->x[segments] + d->half[segments])
            out = add32(cvt((float)(level - d->x[segments]) * d->slope[segments - 1] + (float)d->x[segments]), d->offset[segments]);
        else {
            int found = 0;
            for (int j = 0; j < segments; ++j) if (level > d->x[j] + d->half[j] && level <= d->x[j + 1] - d->half[j + 1]) {
                out = add32(cvt((float)(level - d->x[j]) * d->slope[j] + (float)d->x[j]), d->offset[j]); found = 1; break;
            }
            if (!found) for (int j = 0; j <= segments; ++j) if (level > d->x[j] - d->half[j] && level <= d->x[j] + d->half[j]) {
                int32_t delta = level - d->x[j];
                float left = (float)asr(delta - d->half[j], 8), right = (float)asr(delta + d->half[j], 8);
                float before = j ? d->slope[j - 1] : 1;
                float after = j == segments ? before : d->slope[j];
                float v = ((1.0f - before) * left) * left + ((after - 1.0f) * right) * right;
                out = add32(cvt(v * d->inverse[j] + (float)level), d->offset[j]); break;
            }
        }
        int32_t gain = sub32(out, level);
        int32_t smoothing = d->previous >= gain ? d->attack : d->release;
        d->previous = add32(asr(mul32(asr(add32(sub32(d->previous, gain), 2), 2), smoothing), 10), gain);
        int32_t bounded = d->previous < -3276800 ? -3276800 : d->previous > 3276800 ? 3276800 : d->previous;
        int32_t factor = exponential(asr(mul32(bounded, 236), 16));
        uint32_t value = samples[i] < 0 ? 0u - (uint32_t)samples[i] : (uint32_t)samples[i];
        uint32_t f = (uint32_t)factor;
        uint32_t product = (((value & 65535) * (f & 65535)) >> 10) + (((value & 65535) * (f >> 16)) << 6) +
            (((value >> 16) * (f & 65535)) << 6) + (((value >> 16) * (f >> 16)) << 6);
        samples[i] = signed_bits(samples[i] < 0 ? 0u - product : product);
    }
}

int IFLYTEK_AudioCreate(void *instance, int32_t *used_bytes)
{
    if (!instance || !used_bytes) return -1;
    memset(instance, 0, LSAUDIO_SOUND_INSTANCE_BYTES);
    ((Sound *)instance)->magic = SOUND_MAGIC;
    *used_bytes = LSAUDIO_SOUND_INSTANCE_BYTES;
    return 0;
}
int IFLYTEK_AudioInitial(void *instance)
{
    Sound *s = (Sound *)instance;
    if (!valid(s)) return -1;
    memset(s, 0, sizeof(*s)); s->magic = SOUND_MAGIC;
    IFLYTEK_StruAudioPrm p = defaults();
    return IFLYTEK_AudioSet(s, &p);
}
int IFLYTEK_AudioSet(void *instance, const IFLYTEK_StruAudioPrm *params)
{
    Sound *s = (Sound *)instance;
    if (!valid(s) || !params) return -1;
    for (int i = 0; i < 5; ++i) { int error = set_module(s, params, i); if (error) return error; }
    return 0;
}
int IFLYTEK_AudioGet(void *instance, IFLYTEK_StruAudioPrm *params)
{
    Sound *s = (Sound *)instance;
    if (!valid(s) || !params) return -1;
    memcpy(params, &s->params, sizeof(*params)); return 0;
}
int IFLYTEK_AudioReset(void *instance, int32_t algorithm)
{
    Sound *s = (Sound *)instance;
    if (!valid(s) || algorithm < 0 || algorithm > 4) return -1;
    IFLYTEK_StruAudioPrm p = defaults();
    return set_module(s, &p, algorithm);
}
int IFLYTEK_AudioDelete(void *instance) { return valid((Sound *)instance) ? 0 : -1; }
int IFLYTEK_AudioGetInfo(const char **info)
{
    if (!info) return -1;
    *info = "iFlyTek Arcs Audio Process V2.1"; return 0;
}
int IFLYTEK_SetAlgParam(void *instance, int32_t algorithm, const void *params)
{
    Sound *s = (Sound *)instance;
    if (!valid(s)) return -1;
    if (algorithm != 5) return LSAUDIO_SOUND_UNSUPPORTED;
    if (!params) return -503;
    const lsaudioLimiterPrm *p = (const lsaudioLimiterPrm *)params;
    if ((uint32_t)p->enable > 1 || !isfinite(p->sample_rate) || p->sample_rate < 8000 || p->sample_rate > 48000 ||
        !isfinite(p->lookahead_ms) || p->lookahead_ms < 0 || !isfinite(p->attack_ms) || p->attack_ms < 0 ||
        !isfinite(p->release_ms) || p->release_ms < 0 || !isfinite(p->threshold_db) || !isfinite(p->makeup_db) ||
        !isfinite(p->knee_db) || !isfinite(p->ratio) || p->ratio <= 0) return -1;
    float length = ceilf((float)((double)p->lookahead_ms * 0.001 * p->sample_rate));
    if (length > 256) return -1;
    Limiter *l = &s->limiter;
    memset(l, 0, sizeof(*l));
    l->enable = p->enable; l->length = length < 1 ? 1 : (int32_t)length; l->peak_index = -1;
    l->threshold = powf(10.0f, p->threshold_db / 20.0f);
    l->makeup = powf(10.0f, p->makeup_db / 20.0f);
    float rate = (float)cvt(p->sample_rate);
    l->attack = expf(-1.0f / ((float)((double)p->attack_ms * 0.001) * rate));
    l->release = expf(-1.0f / ((float)((double)p->release_ms * 0.001) * rate));
    return 0;
}
static void limit_samples(Limiter *l, int32_t *samples, int count)
{
    if (l->enable != 1) return;
    for (int i = 0; i < count; ++i) {
        l->samples[l->index] = (float)samples[i] * (1.0f / 32768.0f);
        float magnitude = fabsf(l->samples[l->index]);
        if (magnitude >= l->peak) { l->peak = magnitude; l->peak_index = l->index; }
        else if (l->peak_index == l->index) {
            l->peak = 0;
            for (int j = 0; j < l->length; ++j) if (fabsf(l->samples[j]) > l->peak) { l->peak = fabsf(l->samples[j]); l->peak_index = j; }
        }
        if (l->gain * l->peak > l->threshold)
            l->gain = (l->threshold / l->peak) * (1.0f - l->attack) + l->attack * l->gain;
        else l->gain = fminf(1, (1.0f - l->release) * (1.0f - l->gain) + l->gain);
        l->index = (l->index + 1) % l->length;
        int32_t value = cvt(((l->samples[l->index] * l->gain) * l->makeup) * 32768.0f);
        samples[i] = value > 32767 ? 32767 : value < -32768 ? -32768 : value;
    }
}
int IFLYTEK_AudioProcess(void *instance, const int32_t *input, int32_t *output, int32_t count)
{
    Sound *s = (Sound *)instance;
    if (!valid(s) || !input || !output || count < 1 || count > 64) return -1;
    int32_t samples[64], before_eq[64]; memcpy(samples, input, (size_t)count * sizeof(*input));
    for (int m = 0; m < 3; ++m) {
        if (m == 2) memcpy(before_eq, samples, (size_t)count * sizeof(*samples));
        int enabled = m == 0 ? s->params.BassBoostPrm.iEnable : m == 1 ? s->params.TrebleoostPrm.iEnable : s->params.PeqPrm.Enable;
        if (!enabled) continue;
        for (int i = 0; i < count; ++i) samples[i] = scale(samples[i], 16384.0f);
        if (m < 2) filter_samples(&s->filters[m], samples, count);
        else for (int f = 0; f < 10; ++f) if (s->params.PeqPrm.FilterPrm[f].FilterEnable) filter_samples(&s->filters[f + 2], samples, count);
        for (int i = 0; i < count; ++i) samples[i] = scale(samples[i], 1.0f / 16384.0f);
    }
    int processed = count / 8 * 8;
    compress(s, samples, processed);
    /* The reference ping-pongs between two buffers. DRC writes only eight
     * equal subframes; its unwritten tail retains the pre-EQ buffer values. */
    for (int i = processed; i < count; ++i) samples[i] = before_eq[i];
    if (s->params.GainPrm.iEnable) for (int i = 0; i < count; ++i) samples[i] = cvt((float)samples[i] * s->volume);
    limit_samples(&s->limiter, samples, count);
    memcpy(output, samples, (size_t)count * sizeof(*output));
    return 0;
}
