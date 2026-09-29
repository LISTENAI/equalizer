#ifndef LSAUDIO_SOUNDEFFECT_H
#define LSAUDIO_SOUNDEFFECT_H
#include "lsaudio/eqdrc.h"
#if defined(_WIN32)
# if defined(LSAUDIO_SOUNDEFFECT_BUILD)
#  define LSAUDIO_SOUND_API __declspec(dllexport)
# else
#  define LSAUDIO_SOUND_API __declspec(dllimport)
# endif
#else
# define LSAUDIO_SOUND_API __attribute__((visibility("default")))
#endif
#ifdef __cplusplus
extern "C" {
#endif
#define LSAUDIO_SOUND_INSTANCE_BYTES 3508
#define LSAUDIO_SOUND_MAX_SAMPLES 64
#define LSAUDIO_SOUND_UNSUPPORTED (-1000)
/* Caller-owned, at least 3508 bytes, aligned for uint32_t. Opaque contents
 * belong to this implementation; never copy state between different DLLs. */
LSAUDIO_SOUND_API int IFLYTEK_AudioCreate(void *instance, int32_t *used_bytes);
LSAUDIO_SOUND_API int IFLYTEK_AudioInitial(void *instance);
LSAUDIO_SOUND_API int IFLYTEK_AudioSet(void *instance, const IFLYTEK_StruAudioPrm *params);
LSAUDIO_SOUND_API int IFLYTEK_AudioGet(void *instance, IFLYTEK_StruAudioPrm *params);
/* Supported frame sizes: 1 through 64. 16-bit PCM samples are carried in
 * int32 slots, exactly as the application's player. Prefer 64: the vendor
 * DRC wrapper processes only complete groups of 8 (see reconstruction notes). */
LSAUDIO_SOUND_API int IFLYTEK_AudioProcess(void *instance, const int32_t *input, int32_t *output, int32_t count);
LSAUDIO_SOUND_API int IFLYTEK_AudioReset(void *instance, int32_t algorithm);
LSAUDIO_SOUND_API int IFLYTEK_AudioDelete(void *instance);
LSAUDIO_SOUND_API int IFLYTEK_AudioGetInfo(const char **info);
/* Inferred 36-byte limiter ABI for algorithm 5. Times are milliseconds;
 * ratio and knee are accepted/stored by the vendor but not used by its
 * limiter processing path. Lookahead is bounded to 256 samples here. */
typedef struct {
    int32_t enable;
    float lookahead_ms, sample_rate, threshold_db, knee_db;
    float attack_ms, release_ms, ratio, makeup_db;
} lsaudioLimiterPrm;
LSAUDIO_SOUND_API int IFLYTEK_SetAlgParam(void *instance, int32_t algorithm, const void *params);
#ifdef __cplusplus
}
#endif
#endif
