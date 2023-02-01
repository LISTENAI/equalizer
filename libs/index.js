"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eqDrawPoints = void 0;
const iflytekEqDrcDraw_1 = require("./libIflytekEqDrcDraw/iflytekEqDrcDraw");
const struUIXYInfo_1 = require("./libIflytekEqDrcDraw/struUIXYInfo");
const struMonoEqPrm_1 = require("./libIflytekEqDrcDraw/struMonoEqPrm");
const struFilterUIPrm_1 = require("./libIflytekEqDrcDraw/struFilterUIPrm");
const eqDrawPoints = (eqData, chartConf) => {
    const filterprms = new struMonoEqPrm_1.arrayStruFilterUIPrm();
    eqData.filters.forEach((filter, index) => {
        filterprms[index] = new struFilterUIPrm_1.struFilterUIPrm({
            FilterEnable: filter.enable,
            FilterType: filter.type,
            fSampleRateHz: filter.dSampleRateHz,
            fQ: filter.q,
            fDbGain: filter.gain,
            fFreqHz: filter.fc,
        });
    });
    const monoEqPrm = new struMonoEqPrm_1.struMonoEqPrm({
        Enable: Number(eqData.enable),
        FilterPrm: filterprms
    });
    const xyData = new struUIXYInfo_1.struUIXYInfo({
        startFreq: chartConf.startFreq,
        endFreq: chartConf.endFreq,
        startGain: chartConf.startGain,
        endGain: chartConf.endGain,
        xNum: 840,
        yNum: chartConf.yNum
    });
    let eqdrawdata = (iflytekEqDrcDraw_1.iflytekEqDraw.eqDrawPoints(monoEqPrm.ref(), xyData.ref())).deref();
    const json = {
        ret: eqdrawdata.ret,
        arr_size: eqdrawdata.arr_size,
        points: []
    };
    for (let i = 0; i < eqdrawdata.arr_size; i++) {
        json.points.push([parseFloat((eqdrawdata.points)[i][0].toFixed(6)), parseFloat((eqdrawdata.points)[i][1].toFixed(6))]);
    }
    const data = JSON.parse(JSON.stringify(json));
    iflytekEqDrcDraw_1.iflytekEqDraw.freePoints(eqdrawdata.ref());
    return data;
};
exports.eqDrawPoints = eqDrawPoints;
