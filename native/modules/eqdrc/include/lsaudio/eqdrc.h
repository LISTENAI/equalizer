#ifndef LSAUDIO_EQDRC_H
#define LSAUDIO_EQDRC_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
# if defined(LSAUDIO_EQDRC_BUILD)
#  define LSAUDIO_API __declspec(dllexport)
# else
#  define LSAUDIO_API __declspec(dllimport)
# endif
#else
# define LSAUDIO_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define LSAUDIO_AUDIO_BIN_SIZE 360
#define IFLYTEK_BIN_OK 0
#define IFLYTEK_BIN_FILE_PATH_NULL (-1)
#define IFLYTEK_BIN_TARGET_NULL (-2)
#define IFLYTEK_BIN_WRITE_FILE_ERR (-3)
#define IFLYTEK_BIN_READ_FILE_ERR (-4)
#define LSAUDIO_BIN_SIZE_ERR (-5)

/* Explicit reserved bytes preserve the observed Windows ABI and file bytes.
 * The file codec still converts each numeric field to/from little endian. */
typedef struct {
    int32_t iEnable;
    float fFs, fDbGain, fFreqHz;
} struBassBoostPrm;
typedef struBassBoostPrm struTrebleBoostPrm;

typedef struct {
    uint8_t FilterEnable, FilterType, reserved[2];
    float fSampleRateHz, fQ, fDbGain, fFreqHz;
} struFilterPrm;

typedef struct {
    uint8_t Enable, reserved[3];
    struFilterPrm FilterPrm[10];
} struMonoEqPrm;

typedef struct { float X, Y, W; } struDrcDot;
typedef struct {
    int32_t iEnable;
    float Fs, At, Rt;
    int32_t Type;
    float RmsTime;
    int32_t SegNum;
    struDrcDot Dot[7];
} struDrcPrm;
typedef struct {
    struDrcPrm pstDrcPrm;
    struDrcPrm ModifiedDrcPrm;
} struDrcPrm2;
typedef struct {
    int32_t iEnable;
    float dSampleRate, dVolume;
} struGainPrm;
typedef struct {
    struBassBoostPrm BassBoostPrm;
    struTrebleBoostPrm TrebleoostPrm; /* spelling is part of the vendor ABI */
    struMonoEqPrm PeqPrm;
    struDrcPrm DrcPrm;
    struGainPrm GainPrm;
} IFLYTEK_StruAudioPrm;

typedef struct {
    double startFreq, endFreq, startGain, endGain;
    int32_t xNum, yNum;
} struUIXYInfo;
typedef struct {
    int32_t WidthX, HeightY;
    float startXGain, endXGain, startYGain, endYGain;
} struUIDrcInfo;

/* Strict, exact-length codecs for new callers. No output changes on errors. */
LSAUDIO_API int lsaudio_audio_encode(const IFLYTEK_StruAudioPrm *target, uint8_t *data, size_t size);
LSAUDIO_API int lsaudio_audio_decode(const uint8_t *data, size_t size, IFLYTEK_StruAudioPrm *target);

/* Legacy compatibility: Windows text-mode reads (CTRL-Z ends input, CRLF
 * becomes LF), short reads succeed and retain the unread suffix; trailing
 * bytes are ignored. Use the strict binary decoder for new callers. */
LSAUDIO_API int writeToBinFile(const char *path, const IFLYTEK_StruAudioPrm *target);
LSAUDIO_API int readFromBinFile(const char *path, IFLYTEK_StruAudioPrm *target);

/* Valid finite UI ranges only: dimensions > 1, increasing ranges and
 * positive EQ frequencies. Values outside a valid range are extrapolated. */
LSAUDIO_API double EqCalcYToGain(int y, const struUIXYInfo *ui);
LSAUDIO_API int EqCalcGainToY(double gain, const struUIXYInfo *ui);
LSAUDIO_API int EqCalcFreqToX(double frequency, const struUIXYInfo *ui);
/* Like EqDraw, this function changes startFreq=0 to 1e-6. */
LSAUDIO_API double EqCalcXToFreq(int x, struUIXYInfo *ui);
LSAUDIO_API float DrcCalcYToDb(const struUIDrcInfo *ui, int y);
LSAUDIO_API float DrcCalcXToDb(const struUIDrcInfo *ui, int x);
LSAUDIO_API int DrcCalcDbToY(const struUIDrcInfo *ui, float gain);
LSAUDIO_API int DrcCalcDbToX(const struUIDrcInfo *ui, float gain);

/* Caller provides at least xNum doubles / WidthX floats. EqDraw accumulates
 * into Y; initialize it to zero for a fresh curve. startFreq=0 becomes 1e-6. */
LSAUDIO_API int EqDraw(const struMonoEqPrm *params, struUIXYInfo *ui, double *y);
LSAUDIO_API int DrcDraw(const struDrcPrm *params, const struUIDrcInfo *ui, float *y, struDrcPrm *modified);
LSAUDIO_API int DrcDrawGet(const struDrcPrm2 *object, struDrcPrm *params);
#ifdef __cplusplus
}
#endif
#endif
