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
exports.iflytekEqDraw = exports.iflytekEqDrcDraw = void 0;
const ffi = __importStar(require("ffi-napi"));
const struMonoEqPrm_1 = require("./struMonoEqPrm");
const struUIXYInfo_1 = require("./struUIXYInfo");
const ref = __importStar(require("ref-napi"));
const path_1 = require("path");
const struUIDrcInfo_1 = require("./struUIDrcInfo");
const struDrcPrm_1 = require("./struDrcPrm");
const struEqDrawResult_1 = require("./struEqDrawResult");
const ArrayType = require('ref-array-di')(ref);
const arch = function () {
    switch (process.arch) {
        case "ia32":
            return 'x86';
        case "x64":
            return 'x64';
        default:
            throw new Error('Arch not supported!');
    }
};
const dllfile = (0, path_1.join)(__dirname, '..', 'libs', arch(), 'iflytekEqDrcDrawApi.dll');
exports.iflytekEqDrcDraw = new ffi.Library(dllfile, {
    // ====== EQ 绘图函数：函数调用前需要将参数pstEqPrmObj和XYData初始化赋值，并为 Y 申请好相应的空间 ======
    //int EqDraw(pstMonoEqPrm pstEqPrmObj, struUIXYInfo *XYData, double *Y);
    // 'EqDraw': [ 'int', [ pstMonoEqPrm, ref.refType(struUIXYInfo), ref.refType(ref.types.double) ] ],
    // 'EqDraw': [ 'int', [ ref.refType(struMonoEqPrm), ref.refType(struUIXYInfo), ref.refType(ref.types.double) ] ],
    'EqDraw': ['int', [ref.refType(struMonoEqPrm_1.struMonoEqPrm), ref.refType(struUIXYInfo_1.struUIXYInfo), ref.refType(ArrayType(ref.types.double))]],
    // ====== 横坐标 和 频率 相互转换函数 ======
    //double EqCalcXToFreq(int x, struUIXYInfo *XYData);
    'EqCalcXToFreq': ['double', ['int', ref.refType(struUIXYInfo_1.struUIXYInfo)]],
    //int EqCalcFreqToX(double fFreq, struUIXYInfo *XYData);
    'EqCalcFreqToX': ['double', ['double', ref.refType(struUIXYInfo_1.struUIXYInfo)]],
    // ====== y坐标点 和 增益 相互转换函数 ======
    //double EqCalcYToGain(int y, struUIXYInfo &XYData);
    'EqCalcYToGain': ['double', ['int', struUIXYInfo_1.struUIXYInfo]],
    //int EqCalcGainToY(double fdBGain, struUIXYInfo *XYData);
    'EqCalcGainToY': ['double', ['double', ref.refType(struUIXYInfo_1.struUIXYInfo)]],
    // ====== DRC接口 ======
    //float DrcCalcYToDb(struUIDrcInfo* XYData, int y);
    'DrcCalcYToDb': ['float', [ref.refType(struUIDrcInfo_1.struUIDrcInfo), 'int']],
    //int DrcCalcDbToY(struUIDrcInfo* XYData, float fdBGain);
    'DrcCalcDbToY': ['int', [ref.refType(struUIDrcInfo_1.struUIDrcInfo), 'float']],
    //int DrcCalcDbToX(struUIDrcInfo* XYData, float fdBGain);
    'DrcCalcDbToX': ['int', [ref.refType(struUIDrcInfo_1.struUIDrcInfo), 'float']],
    //float DrcCalcXToDb(struUIDrcInfo* XYData, int x);
    'DrcCalcXToDb': ['float', [ref.refType(struUIDrcInfo_1.struUIDrcInfo), 'int']],
    //void DrcDraw(struDrcPrm * pstDrcPrm, struUIDrcInfo* XYData, float* Y);
    'DrcDraw': [ref.types.void, [ref.refType(struDrcPrm_1.struDrcPrm), ref.refType(struUIDrcInfo_1.struUIDrcInfo), ref.refType(ref.types.float)]]
});
const eqDrawDll = (0, path_1.join)(__dirname, '..', 'libs', arch(), 'eqdrawDLL.dll');
exports.iflytekEqDraw = new ffi.Library(eqDrawDll, {
    // ====== EQ 绘图函数：函数调用前需要将参数pstEqPrmObj和XYData初始化赋值，并为 Y 申请好相应的空间 ======
    //int EqDraw(pstMonoEqPrm pstEqPrmObj, struUIXYInfo *XYData);
    'eqDrawPoints': [ref.refType(struEqDrawResult_1.struEqDrawResult), [ref.refType(struMonoEqPrm_1.struMonoEqPrm), ref.refType(struUIXYInfo_1.struUIXYInfo)]],
    'freePoints': [ref.types.void, [ref.refType(struEqDrawResult_1.struEqDrawResult)]],
});
