"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeToBinFile = exports.drcDrawPoints = exports.eqDrawPoints = void 0;
const capi_1 = require("./capi");
const stru_1 = require("./stru");
const stru_2 = require("./stru");
const stru_3 = require("./stru");
const stru_4 = require("./stru");
const eqDrawPoints = (eqData, chartConf) => {
    const filterprms = new stru_1.StruFiltersPrm();
    eqData.filters.forEach((filter, index) => {
        filterprms[index] = new stru_1.struFilterPrm({
            FilterEnable: filter.enable,
            FilterType: filter.type,
            fSampleRateHz: filter.dSampleRateHz,
            fQ: filter.q,
            fDbGain: filter.gain,
            fFreqHz: filter.fc,
        });
    });
    const monoEqPrm = new stru_1.struMonoEqPrm({
        Enable: Number(eqData.enable),
        FilterPrm: filterprms
    });
    const xyData = new stru_1.struUIXYInfo({
        startFreq: chartConf.startFreq,
        endFreq: chartConf.endFreq,
        startGain: chartConf.startGain,
        endGain: chartConf.endGain,
        xNum: 840,
        yNum: chartConf.yNum
    });
    let eqdrawdata = (capi_1.iflytekEqDraw.eqDrawPoints(monoEqPrm.ref(), xyData.ref())).deref();
    const json = {
        ret: eqdrawdata.ret,
        arr_size: eqdrawdata.arr_size,
        points: []
    };
    for (let i = 0; i < eqdrawdata.arr_size; i++) {
        json.points.push([parseFloat((eqdrawdata.points)[i][0].toFixed(6)), parseFloat((eqdrawdata.points)[i][1].toFixed(6))]);
    }
    const data = JSON.parse(JSON.stringify(json));
    capi_1.iflytekEqDraw.freePoints(eqdrawdata.ref());
    return data;
};
exports.eqDrawPoints = eqDrawPoints;
const drcDrawPoints = (drcData, chartConf) => {
    const dotprms = new stru_3.struDots();
    drcData.dots.forEach((dot, index) => {
        dotprms[index] = new stru_3.struDrcDot({
            X: dot[0],
            Y: dot[1],
            W: dot[2]
        });
    });
    const monoDrcPrm = new stru_3.struDrcPrm({
        iEnable: Number(drcData.enable),
        Fs: drcData.fs,
        At: drcData.at,
        Rt: drcData.rt,
        Type: drcData.mode,
        RmsTime: drcData.rms,
        SegNum: drcData.seg,
        Dot: dotprms
    });
    const xyData = new stru_3.struUIDrcInfo({
        WidthX: chartConf.WidthX,
        HeightY: chartConf.HeightY,
        startXGain: chartConf.startXGain,
        endXGain: chartConf.endXGain,
        startYGain: chartConf.startYGain,
        endYGain: chartConf.endYGain
    });
    let drcDrawdata = (capi_1.iflytekEqDraw.drcDrawPoints(monoDrcPrm.ref(), xyData.ref())).deref();
    const json = {
        ret: drcDrawdata.ret,
        arr_size: drcDrawdata.arr_size,
        dot_size: drcDrawdata.dot_size,
        points: [],
        dots: []
    };
    for (let i = 0; i < drcDrawdata.arr_size; i++) {
        json.points.push([parseFloat((drcDrawdata.points)[i][0].toFixed(6)), parseFloat((drcDrawdata.points)[i][1].toFixed(6))]);
    }
    for (let i = 0; i < drcDrawdata.dot_size; i++) {
        json.dots.push([parseFloat((drcDrawdata.dots)[i].X.toFixed(0)), parseFloat((drcDrawdata.dots)[i].Y.toFixed(0)), parseFloat((drcDrawdata.dots)[i].W.toFixed(0))]);
    }
    const data = JSON.parse(JSON.stringify(json));
    capi_1.iflytekEqDraw.freeDrcPoints(drcDrawdata.ref());
    return data;
};
exports.drcDrawPoints = drcDrawPoints;
const writeToBinFile = (binfile, audioConf) => {
    const bassBoost = audioConf.bass_boost && new stru_2.struBassBoostPrm({
        iEnable: Number(audioConf.bass_boost.enable),
        fFs: audioConf.bass_boost.fs,
        fDbGain: audioConf.bass_boost.gain,
        fFreqHz: audioConf.bass_boost.freq,
    });
    const trebleoost = audioConf.treble_boost && new stru_2.struTrebleBoostPrm({
        iEnable: Number(audioConf.treble_boost.enable),
        fFs: audioConf.treble_boost.fs,
        fDbGain: audioConf.treble_boost.gain,
        fFreqHz: audioConf.treble_boost.freq,
    });
    const filterprms = audioConf.eq && new stru_1.StruFiltersPrm();
    audioConf.eq && audioConf.eq.filters.forEach((filter, index) => {
        filterprms[index] = new stru_1.struFilterPrm({
            FilterEnable: filter.enable,
            FilterType: filter.type,
            fSampleRateHz: filter.dSampleRateHz,
            fQ: filter.q,
            fDbGain: filter.gain,
            fFreqHz: filter.fc,
        });
    });
    const monoEqPrm = audioConf.eq && new stru_1.struMonoEqPrm({
        Enable: Number(audioConf.eq.enable),
        FilterPrm: filterprms
    });
    const dots = new stru_3.struDots();
    audioConf.drc && audioConf.drc.dots.forEach((dot, index) => {
        dots[index] = new stru_3.struDrcDot({
            X: dot[0],
            Y: dot[1],
            W: dot[2]
        });
    });
    const drc = audioConf.drc && new stru_3.struDrcPrm({
        iEnable: Number(audioConf.drc.enable),
        Fs: audioConf.drc.fs,
        At: audioConf.drc.at,
        Rt: audioConf.drc.rt,
        Type: audioConf.drc.mode,
        RmsTime: audioConf.drc.rms,
        SegNum: audioConf.drc.seg,
        Dot: dots
    });
    const gain = audioConf.agc && new stru_2.struGainPrm({
        iEnable: Number(audioConf.agc.enable),
        dSampleRate: audioConf.agc.sr,
        dVolume: audioConf.agc.vol
    });
    const audioPrm = new stru_4.struAudioPrm({
        BassBoostPrm: bassBoost,
        TrebleoostPrm: trebleoost,
        PeqPrm: monoEqPrm,
        DrcPrm: drc,
        GainPrm: gain
    });
    const res = capi_1.iflytekBinHandle.writeToBinFile(binfile, audioPrm.ref());
    return res;
};
exports.writeToBinFile = writeToBinFile;
