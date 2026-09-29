#include "lsaudio/eqdrc.h"
#include <stdio.h>
#include <string.h>

/* Do not use assert(): Release builds define NDEBUG. */
#define CHECK(condition) do { if (!(condition)) { \
    fprintf(stderr, "line %d: %s\n", __LINE__, #condition); return 1; \
} } while (0)

int main(void)
{
    IFLYTEK_StruAudioPrm params = {0}, decoded;
    uint8_t bytes[LSAUDIO_AUDIO_BIN_SIZE], again[LSAUDIO_AUDIO_BIN_SIZE];
    params.BassBoostPrm.iEnable = 1;
    params.BassBoostPrm.fFs = 48000.0f;
    params.PeqPrm.FilterPrm[9].fQ = 0.5f;
    params.DrcPrm.Dot[6].Y = -6.0f;
    params.GainPrm.dVolume = -12.0f;
    CHECK(lsaudio_audio_encode(&params, bytes, sizeof(bytes)) == 0);
    CHECK(bytes[0] == 1 && bytes[1] == 0);
    CHECK(bytes[4] == 0x00 && bytes[5] == 0x80 && bytes[6] == 0x3b && bytes[7] == 0x47);
    CHECK(bytes[226] == 0 && bytes[227] == 0x3f); /* last filter Q */
    CHECK(bytes[342] == 0xc0 && bytes[343] == 0xc0); /* last dot Y */
    CHECK(bytes[358] == 0x40 && bytes[359] == 0xc1);
    CHECK(lsaudio_audio_decode(bytes, sizeof(bytes), &decoded) == 0);
    CHECK(decoded.BassBoostPrm.fFs == 48000.0f && decoded.GainPrm.dVolume == -12.0f);
    for (size_t i = 0; i < sizeof(bytes); ++i) bytes[i] = (uint8_t)(i * 37 + 11);
    CHECK(lsaudio_audio_decode(bytes, sizeof(bytes), &decoded) == 0);
    CHECK(lsaudio_audio_encode(&decoded, again, sizeof(again)) == 0);
    CHECK(memcmp(bytes, again, sizeof(bytes)) == 0);
    memset(&params, 0xa5, sizeof(params));
    memcpy(&decoded, &params, sizeof(params));
    CHECK(lsaudio_audio_decode(bytes, 359, &params) == LSAUDIO_BIN_SIZE_ERR);
    CHECK(lsaudio_audio_decode(bytes, 361, &params) == LSAUDIO_BIN_SIZE_ERR);
    CHECK(memcmp(&params, &decoded, sizeof(params)) == 0);
    memset(again, 0xcc, sizeof(again));
    CHECK(lsaudio_audio_encode(&params, again, 0) == LSAUDIO_BIN_SIZE_ERR);
    CHECK(again[0] == 0xcc && again[359] == 0xcc);
    CHECK(lsaudio_audio_decode(NULL, 360, &params) == IFLYTEK_BIN_TARGET_NULL);
    CHECK(lsaudio_audio_encode(NULL, again, 360) == IFLYTEK_BIN_TARGET_NULL);
    CHECK(lsaudio_audio_decode(bytes, 360, NULL) == IFLYTEK_BIN_TARGET_NULL);
    CHECK(lsaudio_audio_encode(&params, NULL, 360) == IFLYTEK_BIN_TARGET_NULL);
    puts("strict codec, field offsets, reserved bytes and error atomicity: passed");
    return 0;
}
