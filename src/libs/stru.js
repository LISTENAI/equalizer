"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.struEqDrawResult = exports.struUIXYInfo = exports.struAudioPrm = exports.struMonoEqPrm = exports.StruFiltersPrm = exports.struFilterPrm = exports.struGainPrm = exports.struTrebleBoostPrm = exports.struBassBoostPrm = exports.struDrcPrm = exports.struDots = exports.struDrcDot = void 0;
const ref = __importStar(require("ref-napi"));
const StructType = require('ref-struct-di')(ref);
const ArrayType = require('ref-array-di')(ref);
// === drc 结构体 ===
exports.struDrcDot = StructType({
    X: ref.types.float,
    Y: ref.types.float,
    W: ref.types.float
});
exports.struDots = ArrayType(exports.struDrcDot, 6); //TODO: length should be dynamically defined in variable file
exports.struDrcPrm = StructType({
    iEnable: ref.types.int,
    Fs: ref.types.float,
    At: ref.types.float,
    Rt: ref.types.float,
    Type: ref.types.int,
    RmsTime: ref.types.float,
    SegNum: ref.types.int,
    Dot: exports.struDots
});
// === 低音增强结构体 ===
exports.struBassBoostPrm = StructType({
    iEnable: ref.types.int,
    fFs: ref.types.float,
    fDbGain: ref.types.float,
    fFreqHz: ref.types.float,
});
// === 高音增强结构体 ===
exports.struTrebleBoostPrm = StructType({
    iEnable: ref.types.int,
    fFs: ref.types.float,
    fDbGain: ref.types.float,
    fFreqHz: ref.types.float,
});
// === 增益输出结构体 ===
exports.struGainPrm = StructType({
    iEnable: ref.types.int,
    dSampleRate: ref.types.float,
    dVolume: ref.types.float
});
// === eq 结构体 ===
exports.struFilterPrm = StructType({
    FilterEnable: ref.types.uchar,
    FilterType: ref.types.uchar,
    fSampleRateHz: ref.types.float,
    fQ: ref.types.float,
    fDbGain: ref.types.float,
    fFreqHz: ref.types.float
});
exports.StruFiltersPrm = ArrayType(exports.struFilterPrm, 10);
exports.struMonoEqPrm = StructType({
    Enable: ref.types.int,
    FilterPrm: exports.StruFiltersPrm
});
// === 下行音频 结构体 ===
exports.struAudioPrm = StructType({
    BassBoostPrm: exports.struBassBoostPrm,
    TrebleoostPrm: exports.struTrebleBoostPrm,
    PeqPrm: exports.struMonoEqPrm,
    DrcPrm: exports.struDrcPrm,
    GainPrm: exports.struGainPrm
});
// === 曲线图 结构体 ===
exports.struUIXYInfo = StructType({
    startFreq: ref.types.double,
    endFreq: ref.types.double,
    startGain: ref.types.double,
    endGain: ref.types.double,
    xNum: ref.types.int,
    yNum: ref.types.int
});
const point = ArrayType(ref.types.double, 2);
const points = ArrayType(point, 1024);
exports.struEqDrawResult = StructType({
    ret: ref.types.int,
    arr_size: ref.types.int,
    points: points
});
