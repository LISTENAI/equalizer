#ifndef LSAUDIO_EQDRAW_H
#define LSAUDIO_EQDRAW_H

#include "lsaudio/eqdrc.h"

#if defined(_WIN32)
# if defined(LSAUDIO_EQDRAW_BUILD)
#  define LSAUDIO_EQDRAW_API __declspec(dllexport)
# else
#  define LSAUDIO_EQDRAW_API __declspec(dllimport)
# endif
#else
# define LSAUDIO_EQDRAW_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define LSAUDIO_EQ_POINTS_MAX 1024
#define LSAUDIO_DRC_POINTS_MAX 315

typedef struct {
    int32_t ret;
    int32_t arr_size;
    double points[LSAUDIO_EQ_POINTS_MAX][2];
} eqDrawResult;

typedef struct {
    int32_t ret;
    int32_t arr_size;
    int32_t dot_size;
    double points[LSAUDIO_DRC_POINTS_MAX][2];
    float fs;
    struDrcDot dots[7];
} drcDrawResult;

/* Results are owned by the caller and must be released with the matching
 * free function from THIS library. Allocation failure returns NULL.
 * Other errors return an allocated result with ret < 0 and zero counts.
 * Spare points and error payloads are initialized to zero. */
LSAUDIO_EQDRAW_API eqDrawResult *eqDrawPoints(const struMonoEqPrm *params, struUIXYInfo *ui);

/* By VALUE, as declared in the original header. Windows x64 happens to pass
 * this large struct via a pointer. FFI callers must use a real by-value struct
 * declaration to work on other platforms; do not generalize that ABI detail. */
LSAUDIO_EQDRAW_API drcDrawResult *drcDrawPoints(struDrcPrm params, const struUIDrcInfo *ui);
LSAUDIO_EQDRAW_API void freePoints(eqDrawResult *result);
LSAUDIO_EQDRAW_API void freeDrcPoints(drcDrawResult *result);

#ifdef __cplusplus
}
#endif
#endif
