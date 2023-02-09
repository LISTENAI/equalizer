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
exports.iflytekEqDraw = exports.iflytekBinHandle = void 0;
const ffi = __importStar(require("ffi-napi"));
const ref = __importStar(require("ref-napi"));
const path_1 = require("path");
const stru_1 = require("./stru");
const stru_2 = require("./stru");
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
let binDllPath = (0, path_1.join)(__static, 'dlls');;
const isDevelopment = process.env.NODE_ENV !== "production";
if (isDevelopment) {
    binDllPath = binDllPath.replace('\\public\\', '\\');
} else {
    binDllPath = binDllPath.replace('\\resources\\app.asar\\', '\\');
}
const binDll = (0, path_1.join)(binDllPath, arch(), 'iflytekEqDrcDrawApi.dll');
console.log(binDll);
exports.iflytekBinHandle = new ffi.Library(binDll, {
    'writeToBinFile': ['int', ['string', ref.refType(stru_1.struAudioPrm)]],
});
const eqDrawDll = (0, path_1.join)(binDllPath, arch(), 'eqdrawDLL.dll');
exports.iflytekEqDraw = new ffi.Library(eqDrawDll, {
    // ====== EQ 绘图函数：函数调用前需要将参数pstEqPrmObj和XYData初始化赋值，并为 Y 申请好相应的空间 ======
    //int EqDraw(pstMonoEqPrm pstEqPrmObj, struUIXYInfo *XYData);
    'eqDrawPoints': [ref.refType(stru_1.struEqDrawResult), [ref.refType(stru_1.struMonoEqPrm), ref.refType(stru_1.struUIXYInfo)]],
    'freePoints': [ref.types.void, [ref.refType(stru_1.struEqDrawResult)]],
    'drcDrawPoints': [ref.refType(stru_2.struDrcDrawResult), [ref.refType(stru_2.struDrcPrm), ref.refType(stru_2.struUIDrcInfo)]],
    'freeDrcPoints': [ref.types.void, [ref.refType(stru_2.struDrcDrawResult)]],
});
