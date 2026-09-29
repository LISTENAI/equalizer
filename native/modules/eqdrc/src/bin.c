#include "lsaudio/eqdrc.h"
#include <float.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>

_Static_assert(CHAR_BIT == 8 && sizeof(float) == 4 && FLT_RADIX == 2 &&
               FLT_MANT_DIG == 24 && FLT_MAX_EXP == 128, "IEEE binary32 required");
_Static_assert(sizeof(struFilterPrm) == 20, "filter ABI mismatch");
_Static_assert(sizeof(struMonoEqPrm) == 204, "EQ ABI mismatch");
_Static_assert(sizeof(struDrcPrm) == 112, "DRC ABI mismatch");
_Static_assert(sizeof(IFLYTEK_StruAudioPrm) == 360, "audio ABI mismatch");
_Static_assert(sizeof(struUIXYInfo) == 40 && sizeof(double) == 8 && DBL_MANT_DIG == 53, "EQ UI ABI mismatch");
_Static_assert(sizeof(struUIDrcInfo) == 24, "DRC UI ABI mismatch");
_Static_assert(offsetof(IFLYTEK_StruAudioPrm, PeqPrm) == 32, "EQ offset mismatch");
_Static_assert(offsetof(IFLYTEK_StruAudioPrm, DrcPrm) == 236, "DRC offset mismatch");
_Static_assert(offsetof(IFLYTEK_StruAudioPrm, GainPrm) == 348, "gain offset mismatch");

/* Copy object representations, not floating point values: NaNs, signed zero
 * and arbitrary legacy payload bits must survive without normalization. */
static void encode_word(uint8_t *out, const void *field)
{
    uint32_t bits;
    memcpy(&bits, field, 4);
    out[0] = (uint8_t)bits;
    out[1] = (uint8_t)(bits >> 8);
    out[2] = (uint8_t)(bits >> 16);
    out[3] = (uint8_t)(bits >> 24);
}

static void decode_word(void *field, const uint8_t *in)
{
    uint32_t bits = (uint32_t)in[0] | ((uint32_t)in[1] << 8) |
                    ((uint32_t)in[2] << 16) | ((uint32_t)in[3] << 24);
    memcpy(field, &bits, 4);
}

/* All numeric members are 32-bit words except the explicit byte fields at
 * offset 32 and the first four bytes of each filter. The asserted ABI lets
 * us visit their representations without unaligned casts or aliasing. */
static int is_byte_word(size_t offset)
{
    return offset == 32 || (offset >= 36 && offset < 236 && (offset - 36) % 20 == 0);
}

int lsaudio_audio_encode(const IFLYTEK_StruAudioPrm *target, uint8_t *data, size_t size)
{
    uint8_t encoded[LSAUDIO_AUDIO_BIN_SIZE];
    const uint8_t *object = (const uint8_t *)target;
    if (!target || !data) return IFLYTEK_BIN_TARGET_NULL;
    if (size != LSAUDIO_AUDIO_BIN_SIZE) return LSAUDIO_BIN_SIZE_ERR;
    for (size_t i = 0; i < sizeof(encoded); i += 4) {
        if (is_byte_word(i)) memcpy(encoded + i, object + i, 4);
        else encode_word(encoded + i, object + i);
    }
    memcpy(data, encoded, sizeof(encoded));
    return IFLYTEK_BIN_OK;
}

int lsaudio_audio_decode(const uint8_t *data, size_t size, IFLYTEK_StruAudioPrm *target)
{
    IFLYTEK_StruAudioPrm decoded;
    uint8_t *object = (uint8_t *)&decoded;
    if (!target || !data) return IFLYTEK_BIN_TARGET_NULL;
    if (size != LSAUDIO_AUDIO_BIN_SIZE) return LSAUDIO_BIN_SIZE_ERR;
    for (size_t i = 0; i < sizeof(decoded); i += 4) {
        if (is_byte_word(i)) memcpy(object + i, data + i, 4);
        else decode_word(object + i, data + i);
    }
    memcpy(target, &decoded, sizeof(decoded));
    return IFLYTEK_BIN_OK;
}

int writeToBinFile(const char *path, const IFLYTEK_StruAudioPrm *target)
{
    uint8_t bytes[LSAUDIO_AUDIO_BIN_SIZE];
    FILE *file;
    size_t written;
    int closed;
    if (!path) return IFLYTEK_BIN_FILE_PATH_NULL;
    if (!target) return IFLYTEK_BIN_TARGET_NULL;
    file = fopen(path, "wb");
    if (!file) return IFLYTEK_BIN_WRITE_FILE_ERR;
    lsaudio_audio_encode(target, bytes, sizeof(bytes));
    written = fwrite(bytes, 1, sizeof(bytes), file);
    closed = fclose(file);
    return written == sizeof(bytes) && closed == 0 ? IFLYTEK_BIN_OK : IFLYTEK_BIN_WRITE_FILE_ERR;
}

int readFromBinFile(const char *path, IFLYTEK_StruAudioPrm *target)
{
    uint8_t bytes[LSAUDIO_AUDIO_BIN_SIZE];
    FILE *file;
    int failed, closed;
    if (!path) return IFLYTEK_BIN_FILE_PATH_NULL;
    if (!target) return IFLYTEK_BIN_TARGET_NULL;
    file = fopen(path, "rb");
    if (!file) return IFLYTEK_BIN_READ_FILE_ERR;
    lsaudio_audio_encode(target, bytes, sizeof(bytes));
    /* The reference opens its input in Windows text mode. Emulate that
     * explicitly even on POSIX rather than inheriting host stdio behavior. */
    for (size_t i = 0; i < sizeof(bytes); ++i) {
        int c = fgetc(file);
        if (c == EOF || c == 0x1a) break;
        if (c == '\r') {
            int next = fgetc(file);
            if (next == '\n') c = '\n';
            else if (next != EOF) (void)ungetc(next, file);
        }
        bytes[i] = (uint8_t)c;
    }
    failed = ferror(file);
    closed = fclose(file);
    if (failed || closed != 0) return IFLYTEK_BIN_READ_FILE_ERR;
    return lsaudio_audio_decode(bytes, sizeof(bytes), target);
}
