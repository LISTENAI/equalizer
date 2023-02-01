import {eqDrawPoints} from '../../libs/index';
export default (ipcMain) => {
    ipcMain.handle('eq-draw', (_e, eqData, chartConf) => eqDrawPoints(eqData, chartConf));
}






// export const eqDrawPoints = (eqData: {
//     enable: Boolean;
//     filters: Array<IFilter>;
// }, chartConf: IChartConf) => {
//     
//     const monoEqPrm = new struMonoEqPrm({
//         Enable: Number(eqData.enable),
//         FilterPrm: filterprms
//     })
//     const xyData = new struUIXYInfo({
//         startFreq: chartConf.startFreq,
//         endFreq: chartConf.endFreq,
//         startGain: chartConf.startGain,
//         endGain: chartConf.endGain,
//         xNum: 840,
//         yNum: chartConf.yNum
//     });
//     let eqdrawdata = (iflytekEqDraw.eqDrawPoints(monoEqPrm.ref(), xyData.ref())).deref();

//     const json: {
//         [key: string]: any
//     } = {
//         ret: eqdrawdata.ret,
//         arr_size: eqdrawdata.arr_size,
//         points: []
//     }
//     for (let i = 0; i < eqdrawdata.arr_size; i++) {
//         json.points.push([parseFloat((eqdrawdata.points)[i][0].toFixed(6)), parseFloat((eqdrawdata.points)[i][1].toFixed(6))])
//     }
    
//     return JSON.parse(JSON.stringify(json)) 
// }