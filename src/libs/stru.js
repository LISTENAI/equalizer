import koffi from 'koffi';

// Constants (keep in sync with native expectations)
export const POINTS_X_DEFAULT = 840; // default number of points for EQ drawing
export const DRC_POINTS_MAX = 315; // max number of points for DRC drawing

// === DRC (Dynamic Range Compression) structures ===
/**
 * Single DRC control point
 * @property {float} X
 * @property {float} Y
 * @property {float} W
 */
export const struDrcDot = koffi.struct('struDrcDot', {
    X: 'float',
    Y: 'float',
    W: 'float'
});

// Fixed-length array of DRC points (native expects length 7)
export const struDots = koffi.array('struDrcDot', 7);

/**
 * Full DRC parameter structure. Field order and types must match native layout.
 */
export const struDrcPrm = koffi.struct('struDrcPrm', {
    iEnable: 'int',
    Fs: 'float',
    At: 'float',
    Rt: 'float',
    Type: 'int',
    RmsTime: 'float',
    SegNum: 'int',
    Dot: struDots
});

// === 低音增强结构体 ===
export const struBassBoostPrm = koffi.struct('struBassBoostPrm', {
    iEnable: 'int',
    fFs: 'float',
    fDbGain: 'float',
    fFreqHz: 'float',
});

// === 高音增强结构体 ===
export const struTrebleBoostPrm = koffi.struct('struTrebleBoostPrm', {
    iEnable: 'int',
    fFs: 'float',
    fDbGain: 'float',
    fFreqHz: 'float',
});

// === 增益输出结构体 ===
export const struGainPrm = koffi.struct('struGainPrm', {
    iEnable: 'int',
    dSampleRate: 'float',
    dVolume: 'float'
});

// === EQ 结构体 ===
export const struFilterPrm = koffi.struct('struFilterPrm', {
    FilterEnable: 'uint8',
    FilterType: 'uint8',
    fSampleRateHz: 'float',
    fQ: 'float',
    fDbGain: 'float',
    fFreqHz: 'float'
});
export const StruFiltersPrm = koffi.array('struFilterPrm', 10);
export const struMonoEqPrm = koffi.struct('struMonoEqPrm', {
    Enable: 'uint8',
    FilterPrm: StruFiltersPrm
});

// === 下行音频 结构体 ===
export const struAudioPrm = koffi.struct('struAudioPrm', {
    BassBoostPrm: struBassBoostPrm,
    TrebleoostPrm: struTrebleBoostPrm, // note: native struct uses TrebleoostPrm (with extra 'o')
    PeqPrm: struMonoEqPrm,
    DrcPrm: struDrcPrm,
    GainPrm: struGainPrm
});

// === EQ 曲线图 结构体 ===
export const struUIXYInfo = koffi.struct('struUIXYInfo', {
    startFreq: 'double',
    endFreq: 'double',
    startGain: 'double',
    endGain: 'double',
    xNum: 'int',
    yNum: 'int'
});
export const struUIDrcInfo = koffi.struct('struUIDrcInfo', {
    WidthX: 'int',
    HeightY: 'int',
    startXGain: 'float',
    endXGain: 'float',
    startYGain: 'float',
    endYGain: 'float'
});
const point = koffi.array('double', 2);
const points = koffi.array(point, 840);
const drcPoints = koffi.array(point, 315);
export const struEqDrawResult = koffi.struct('struEqDrawResult', {
    ret: 'int',
    arr_size: 'int',
    points: points
});
export const struDrcDrawResult = koffi.struct('struDrcDrawResult', {
    ret: 'int',
    arr_size: 'int',
    dot_size: 'int',
    points: drcPoints,
    fs: 'float',
    dots: struDots
});