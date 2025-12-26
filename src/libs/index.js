import koffi from 'koffi';
import { iflytekEqDraw, iflytekBinHandle } from './capi.js';
import { POINTS_X_DEFAULT, struAudioPrm } from './stru.js';

const POINTS_X_NUM = POINTS_X_DEFAULT; // keep original fixed resolution used by native lib

function buildFilterPrms(filters) {
    const filterPrms = [];
    filters.forEach((filter, idx) => {
        // support both object form and array form
        const params = Array.isArray(filter)
            ? {
                FilterEnable: filter[0],
                FilterType: filter[1],
                fSampleRateHz: filter[2],
                fQ: filter[3],
                fDbGain: filter[4],
                fFreqHz: filter[5],
            }
            : {
                FilterEnable: filter.enable,
                FilterType: filter.type,
                fSampleRateHz: filter.dSampleRateHz,
                fQ: filter.q,
                fDbGain: filter.gain,
                fFreqHz: filter.fc,
            };
        filterPrms[idx] = params;
    });
    return filterPrms;
}

function parsePointsFromResult(result, arrKey = 'points') {
    const list = [];
    for (let i = 0; i < result.arr_size; i++) {
        list.push([parseFloat(result[arrKey][i][0].toFixed(6)), parseFloat(result[arrKey][i][1].toFixed(6))]);
    }
    return list;
}

function parseDotsFromResult(result) {
    const list = [];
    for (let i = 0; i < result.dot_size; i++) {
        list.push([parseFloat(result.dots[i].X.toFixed(0)), parseFloat(result.dots[i].Y.toFixed(0)), parseFloat(result.dots[i].W.toFixed(0))]);
    }
    return list;
}

export const eqDrawPoints = (eqData, chartConf) => {
    const filterprms = buildFilterPrms(eqData && eqData.filters);
    const monoEqPrm = {
        Enable: Number(eqData && eqData.enable),
        FilterPrm: filterprms
    };
    const xyData = {
        startFreq: chartConf.startFreq,
        endFreq: chartConf.endFreq,
        startGain: chartConf.startGain,
        endGain: chartConf.endGain,
        xNum: POINTS_X_NUM,
        yNum: chartConf.yNum
    };
    const raw = iflytekEqDraw.eqDrawPoints(monoEqPrm, xyData);
    const json = {
        ret: raw.ret,
        arr_size: raw.arr_size,
        points: parsePointsFromResult(raw, 'points')
    };
    const data = JSON.parse(JSON.stringify(json));
    return data;
};

export const drcDrawPoints = (drcData, chartConf) => {
    const dotPrms = [];
    (drcData && drcData.dots || []).forEach((dot, idx) => {
        dotPrms[idx] = { X: dot[0], Y: dot[1], W: dot[2] };
    });
    const monoDrcPrm = {
        iEnable: Number(drcData && drcData.enable),
        Fs: drcData && drcData.fs,
        At: drcData && drcData.at,
        Rt: drcData && drcData.rt,
        Type: drcData && drcData.mode,
        RmsTime: drcData && drcData.rms,
        SegNum: drcData && drcData.seg,
        Dot: dotPrms
    };
    const xyData = {
        WidthX: chartConf.WidthX,
        HeightY: chartConf.HeightY,
        startXGain: chartConf.startXGain,
        endXGain: chartConf.endXGain,
        startYGain: chartConf.startYGain,
        endYGain: chartConf.endYGain
    };
    const raw = iflytekEqDraw.drcDrawPoints(monoDrcPrm, xyData);
    const json = {
        ret: raw.ret,
        arr_size: raw.arr_size,
        dot_size: raw.dot_size,
        points: parsePointsFromResult(raw, 'points'),
        dots: parseDotsFromResult(raw)
    };
    const data = JSON.parse(JSON.stringify(json));
    return data;
};

export const writeToBinFile = (binfile, audioConf) => {
    const bassBoost = audioConf && audioConf.bass_boost && {
        iEnable: Number(audioConf.bass_boost.enable),
        fFs: audioConf.bass_boost.fs,
        fDbGain: audioConf.bass_boost.gain,
        fFreqHz: audioConf.bass_boost.freq,
    };
    const trebleoost = audioConf && audioConf.treble_boost && {
        iEnable: Number(audioConf.treble_boost.enable),
        fFs: audioConf.treble_boost.fs,
        fDbGain: audioConf.treble_boost.gain,
        fFreqHz: audioConf.treble_boost.freq,
    };
    const filterprms = buildFilterPrms(audioConf && audioConf.eq && audioConf.eq.filters);
    const monoEqPrm = audioConf && audioConf.eq && {
        Enable: Number(audioConf.eq.enable),
        FilterPrm: filterprms
    };
    const dots = [];
    (audioConf && audioConf.drc && audioConf.drc.dots || []).forEach((dot, idx) => {
        dots[idx] = { X: dot[0], Y: dot[1], W: dot[2] };
    });
    const drc = audioConf && audioConf.drc && {
        iEnable: Number(audioConf.drc.enable),
        Fs: audioConf.drc.fs,
        At: audioConf.drc.at,
        Rt: audioConf.drc.rt,
        Type: audioConf.drc.mode,
        RmsTime: audioConf.drc.rms,
        SegNum: audioConf.drc.seg,
        Dot: dots
    };
    const gain = audioConf && audioConf.agc && {
        iEnable: Number(audioConf.agc.enable),
        dSampleRate: audioConf.agc.sr,
        dVolume: audioConf.agc.vol
    };
    const audioPrm = {
        BassBoostPrm: bassBoost,
        TrebleoostPrm: trebleoost,
        PeqPrm: monoEqPrm,
        DrcPrm: drc,
        GainPrm: gain
    };
    return iflytekBinHandle.writeToBinFile(binfile, audioPrm);
};

const parseAudioPrm = (audioPrm) => {
    const filters = (audioPrm?.PeqPrm?.FilterPrm || []).map((filter) => ([
        filter.FilterEnable,
        filter.FilterType,
        filter.fSampleRateHz,
        filter.fQ,
        filter.fDbGain,
        filter.fFreqHz,
    ]));

    const dotsRaw = audioPrm?.DrcPrm?.Dot || [];
    const dotCount = ((audioPrm?.DrcPrm?.SegNum || 0) + 1) || dotsRaw.length;
    const dots = [];
    for (let i = 0; i < Math.min(dotCount, dotsRaw.length); i++) {
        const dot = dotsRaw[i];
        dots.push([dot.X, dot.Y, dot.W]);
    }

    return {
        bass_boost: {
            enable: Boolean(audioPrm?.BassBoostPrm?.iEnable),
            fs: audioPrm?.BassBoostPrm?.fFs,
            gain: audioPrm?.BassBoostPrm?.fDbGain,
            freq: audioPrm?.BassBoostPrm?.fFreqHz,
        },
        treble_boost: {
            enable: Boolean(audioPrm?.TrebleoostPrm?.iEnable),
            fs: audioPrm?.TrebleoostPrm?.fFs,
            gain: audioPrm?.TrebleoostPrm?.fDbGain,
            freq: audioPrm?.TrebleoostPrm?.fFreqHz,
        },
        eq: {
            enable: Boolean(audioPrm?.PeqPrm?.Enable),
            filters,
        },
        drc: {
            enable: Boolean(audioPrm?.DrcPrm?.iEnable),
            fs: audioPrm?.DrcPrm?.Fs,
            at: audioPrm?.DrcPrm?.At,
            rt: audioPrm?.DrcPrm?.Rt,
            mode: audioPrm?.DrcPrm?.Type,
            rms: audioPrm?.DrcPrm?.RmsTime,
            seg: audioPrm?.DrcPrm?.SegNum,
            dots,
        },
        agc: {
            enable: Boolean(audioPrm?.GainPrm?.iEnable),
            sr: audioPrm?.GainPrm?.dSampleRate,
            vol: audioPrm?.GainPrm?.dVolume,
        },
    };
};

export const readFromBinFile = (binfile) => {
    const audioPrmPtr = koffi.alloc(struAudioPrm, koffi.sizeof(struAudioPrm));
    const ret = iflytekBinHandle.readFromBinFile(binfile, audioPrmPtr);
    if (ret !== 0) {
        return null;
    }
    const audioPrm = koffi.decode(audioPrmPtr, struAudioPrm);
    return parseAudioPrm(audioPrm);
};
