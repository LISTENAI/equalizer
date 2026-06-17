//默认参数

export default function getDefaultConfig(fs) {
    return {
        "drc": {
            "enable": false,
            "fs": fs,
            "at": 0.1,
            "rt": 0.5,
            "mode": 1,
            "rms": 0.1,
            "seg": 4,
            "dots": [
                [
                    -100,
                    -100,
                    3
                ],
                [
                    -75,
                    -75,
                    3
                ],
                [
                    -50,
                    -50,
                    3
                ],
                [
                    -25,
                    -25,
                    3
                ],
                [
                    0,
                    0,
                    3
                ]
            ]
        },
        "eq": {
            "enable": false,
            "filters": [
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    26
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    40
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    63
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    80
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    125
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    250
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    500
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    1000
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    2000
                ],
                [
                    0,
                    3,
                    fs,
                    0.707,
                    0,
                    2500
                ]
            ]
        },
        "agc": {
            "enable": false,
            "sr": fs,
            "vol": 0
        },
        "bass_boost": {
            "enable": false,
            "fs": fs,
            "gain": 0.000,
            "freq": 200.000
        },
        "treble_boost": {
            "enable": false,
            "fs": fs,
            "gain": 0.000,
            "freq": 1000.000
        },
        "howling_level": {
            "enable": false,
            "level": 0
        }
    };
}
