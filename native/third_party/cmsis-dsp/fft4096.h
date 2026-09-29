#ifndef LSAUDIO_FFT4096_H
#define LSAUDIO_FFT4096_H
/* 4096 doubles per buffer; input is modified, output uses packed RFFT layout. */
void lsaudio_rfft4096(double *input, double *output);
#endif
