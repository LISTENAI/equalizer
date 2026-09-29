# CMSIS-DSP FFT subset

Source: https://github.com/ARM-software/CMSIS-DSP/tree/3a04f817a4380c00ff51f9bcdc6c4e4bb7a18b80

Version: v1.14.4. License: Apache-2.0 (see LICENSE.txt).

Reproduce with `node native/tools/vendor-cmsis.cjs`. Normal builds are offline.
Only the forward 4096-point real transform and its tables are included.

Modifications: static helper functions; minimal local types; only needed tables;
uint64 table bits converted to round-trip decimal doubles to avoid strict-aliasing
and endian assumptions; bit reversal swaps doubles directly.
No vendor DLL bytes or disassembled instructions are shipped as code.

## Source SHA-256

- Source/TransformFunctions/arm_cfft_f64.c: d39a6b00e18bb738031788dbd05fb75b2b416618be6a105944b2ec3afed23a95
- Source/TransformFunctions/arm_rfft_fast_f64.c: c0a7380343eb944d01a27d44d19800b9b71332ed217786227bdd595eebf92937
- Source/CommonTables/arm_common_tables.c: c54cce284a74c2b02d12d9db2f7ea48f6b0eb09f07bd4de8e86baaf18ecd339a
- LICENSE.txt: b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1
