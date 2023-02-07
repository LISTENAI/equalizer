"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeToBinFile = exports.eqDrawPoints = void 0;
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
        xNum: 1024,
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
const writeToBinFile = (binfile, audioConf) => {
    const bassBoost = new stru_2.struBassBoostPrm({
        iEnable: Number(audioConf.bass_boost.enable),
        fFs: audioConf.bass_boost.fs,
        fDbGain: audioConf.bass_boost.gain,
        fFreqHz: audioConf.bass_boost.freq,
    });
    const trebleoost = new stru_2.struTrebleBoostPrm({
        iEnable: Number(audioConf.treble_boost.enable),
        fFs: audioConf.treble_boost.fs,
        fDbGain: audioConf.treble_boost.gain,
        fFreqHz: audioConf.treble_boost.freq,
    });
    const filterprms = new stru_1.StruFiltersPrm();
    audioConf.eq.filters.forEach((filter, index) => {
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
        Enable: Number(audioConf.eq.enable),
        FilterPrm: filterprms
    });
    const dots = new stru_3.struDots();
    audioConf.drc.dots.forEach((dot, index) => {
        dots[index] = new stru_3.struDrcDot({
            X: dot[0],
            Y: dot[1],
            W: dot[2]
        });
    });
    const drc = new stru_3.struDrcPrm({
        iEnable: Number(audioConf.drc.enable),
        Fs: audioConf.drc.fs,
        At: audioConf.drc.at,
        Rt: audioConf.drc.rt,
        Type: audioConf.drc.mode,
        RmsTime: audioConf.drc.rms,
        SegNum: audioConf.drc.seg,
        Dot: dots
    });
    const gain = new stru_2.struGainPrm({
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
