// import { TYPES } from '../utils/index';
// export const eMixin = {
//     data() {
//         return {
//             // voiceCheckable: false,
//             // voiceData: {}, // 低音/高音/输出 数据
//             // eqCheckable: false, // EQ bypass
//             // eqData: [], // EQ 数据
//             // drcCheckable: false, // drc bypass
//             // drcData: null, // drc 数据
//         };
//     },
//     methods: {
//         setInitData() {
//             TYPES.forEach((item) => {
//                 this.resetModalData(item);
//             });
//         },
//         resetModalData(type) {
//             const voiceData = JSON.parse(JSON.stringify(this.originVoiceType[type]));
//             console.log('reset', type, voiceData);
//             switch (type) {
//                 case 'eq':
//                     this.eqData = voiceData;
//                     this.eqCheckable = false;
//                     break;
//                 case 'drc':
//                     this.drcData = voiceData;
//                     this.drcCheckable = false;
//                     break;
//                 default: //'bass_boost'|'treble_boost'|'agc'
//                     voiceData.type = type;
//                     this.voiceData[type] = voiceData;
//                     this.voiceCheckable = false;
//                     this.enableVoice(type, false);
//                     break;
//             }
//         },
//     },
// };