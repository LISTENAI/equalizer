const TYPES_HEX = {
  'drc': 0x01,
  'eq': 0x02,
  'agc': 0x03,
  'bass_boost': 0x04,
  'treble_boost': 0x05,
};
export const FilterType = {
  'LowPass': 0,
  'HighPass': 1,
  'Peak': 2,
  'LowShef': 3,
  'HighShelf': 4,
};
export const TYPES = ['drc', 'eq', 'agc', 'bass_boost', 'treble_boost'];

const createHeader = (dataLen) => {
  //帧的总长度
  const frameLen = (dataLen + 10).toString(16).padStart(4, '0');
  let frameLen_l = 0x00,
    frameLen_h = 0x00;
  if (frameLen.length === 4) {
    frameLen_l = parseInt(frameLen.substring(2, 4), 16);
    frameLen_h = parseInt(frameLen.substring(0, 2), 16);
  }

  const head = [0x58, 0x46, frameLen_l, frameLen_h, 0x01];

  let sum = 0x00;
  head.forEach(item => sum += item);
  const verify = 256 - sum % 256;
  head.push(verify);

  return head;
};

const createData = (cmd, data) => {
  const buf = [0xF0, 0x00, cmd];
  if (data) {
    if (typeof data === 'object') {
      buf.push(...data);
    } else {
      buf.push(data);
    }
  }

  let sum = 0x00;
  buf.forEach(item => { sum += item; });

  const verify = 256 - sum % 256;
  buf.push(verify);
  return buf;
};

export const buf2Hex = (buf) => {
  return Array.from(buf, (byte) => {
    return `${('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase()}`;
  }).join(' ');
};

Array.prototype.writeInt = function (data) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeInt32LE(parseInt(Number(data)), 0);
  for (let i = 0; i < buf.length; i++) {
    this.push(buf[i]);
  }
};

Array.prototype.writeFloat = function (data) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeFloatLE(data, 0);
  for (let i = 0; i < buf.length; i++) {
    this.push(buf[i]);
  }
};


export const checkConnect = () => {
  return new Uint8Array([
    ...createHeader(0),
    ...createData(0x01)
  ]);

};

export const setParams = (type, data) => {
  // console.log(type, data);
  let buf;
  let data_buf = new Array();
  data_buf.push(TYPES_HEX[type]);
  switch (type) {
    case 'drc':
      data_buf.writeInt(data.enable);
      data_buf.writeFloat(data.fs);
      data_buf.writeFloat(data.at);
      data_buf.writeFloat(data.rt);
      data_buf.writeInt(data.mode);
      data_buf.writeFloat(data.rms);
      data_buf.writeInt(data.seg);
      data.dots && data.dots.forEach(dot => {
        data_buf.writeFloat(dot[0]);
        data_buf.writeFloat(dot[1]);
        data_buf.writeFloat(dot[2]);
      });
      break;
    case 'eq':
      data_buf.writeInt(data.enable);
      data.filters && data.filters.forEach(filter => {
        data_buf.writeInt(filter[0]);
        data_buf.writeInt(filter[1]);
        data_buf.writeFloat(filter[2]);
        data_buf.writeFloat(filter[3]);
        data_buf.writeFloat(filter[4]);
        data_buf.writeFloat(filter[5]);
      });
      break;
    case 'agc':
      data_buf.writeInt(data.enable);
      data_buf.writeFloat(data.sr);
      data_buf.writeFloat(data.vol);
      // data.mono_gains && data.mono_gains.forEach(gain => {
      //   data_buf.writeInt(gain[0]);
      //   data_buf.writeFloat(gain[1]);
      // });
      break;
    case 'bass_boost':
      data_buf.writeInt(data.enable);
      data_buf.writeFloat(data.fs);
      data_buf.writeFloat(data.gain);
      data_buf.writeFloat(data.freq);
      break;
    case 'treble_boost':
      data_buf.writeInt(data.enable);
      data_buf.writeFloat(data.fs);
      data_buf.writeFloat(data.gain);
      data_buf.writeFloat(data.freq);
      break;
    default:
      break;
  }
  buf = new Uint8Array([
    ...createHeader(data_buf.length),
    ...createData(0x03, data_buf)
  ]);
  return buf;
};

export const getParams = (type) => {
  return new Uint8Array([
    ...createHeader(1),
    ...createData(0x04, [TYPES_HEX[type]])
  ]);
};
//查询的参数
export const reciveDataDone = (buf) => {
  // console.log('buf--->', buf2Hex(buf));
  let offset = 0;
  let bufLen = 0;
  let data = [];
  let isEnd = true;
  while (buf.length > offset) {
    // head start with: 0x58 0x46
    if (buf.readInt16LE(offset) === 18008) {
      bufLen = buf.readInt16LE(offset + 2);//第一帧长度
      const dataBuf = buf.subarray(offset, offset + bufLen);
      isEnd = dataBuf.length === bufLen;
      data.push(dataBuf);
      offset += bufLen;
    } else {
      break;
    }
  }
  // console.log('data--->', data);
  return {
    code: isEnd,
    data
  };

};
// 58 46 0B 00 00 57 FF 00 F1 00 10
export const parseData = (data, bufType) => {
  // const data = [];
  // let offset = 0;
  // while (buf.length > offset) {
  //   // head start with: 0x58 0x46
  //   if (buf.readInt16LE(offset) === 18008) {
  //     const len = buf.readInt16LE(offset + 2);//命令帧长度
  //     data.push(buf.subarray(offset, offset + len));
  //     offset += len;
  //   } else {
  //     break;
  //   }
  // }
  let res_code = -1;
  let res_data = {
    type: '',
    data: {}
  };
  //0xFF 0x00 0x01 
  data.forEach(buf => {
    const data_buf = buf.subarray(6, buf.length);
    // 响应帧: 0xff=255  0x00 
    if (data_buf.readInt16LE(0) === 255) {
      if (data_buf.readUInt8(2) === 241) {
        // 返回状态: 0xf1 = 241
        res_code = data_buf.readInt8(3);
        // if (bufType && bufType !== 'connect') res_data.type = bufType;
        //这里有问题 获取eq曲线的时候code返回-1 要排查以下
        // ---------测试代码待固件提供删除以下，释放上面---------
        res_data.type = bufType;
        // ---------测试代码待固件提供删除以下，释放上面---------
      } else if (data_buf.readUInt8(2) === 1) {
        // 返回采样率: 0x01 = 1 收到采样率之后才判定连接成功
        //0xff 0x00 0x01 采样率（四个字节）
        res_data.type = 'connect';
        const fs = parseFloat(data_buf.readFloatLE(3).toFixed(3));
        console.log('采样率是', fs);
        res_data.data = { fs };
      } else if (data_buf.readUInt8(2) === 242) {
        // 返回参数: 0xf2 = 242
        const type = TYPES[data_buf.readInt8(3) - 1];
        res_data.type = `${type}`;
        // console.log('parseData-->', type);
        switch (type) {
          case 'drc':
            res_data.data = parseDrc(data_buf.subarray(4, data_buf.length - 1));
            break;
          case 'eq':
            res_data.data = parseEq(data_buf.subarray(4, data_buf.length - 1));
            break;
          case 'agc':
            res_data.data = parseAgc(data_buf.subarray(4, data_buf.length - 1));
            break;
          case 'bass_boost':
            res_data.data = parseBassBoost(data_buf.subarray(4, data_buf.length - 1));
            break;
          case 'treble_boost':
            res_data.data = parseTrebleBoost(data_buf.subarray(4, data_buf.length - 1));
            break;
          default:
            res_data.data = {};
            break;
        }
      }
    }
  });
  return {
    code: res_code,
    data: res_data
  };
};

const parseDrc = (buf) => {
  let data = {};
  data.enable = Boolean(buf.readInt32LE(0 * 4));
  data.fs = parseFloat(buf.readFloatLE(1 * 4).toFixed(3));
  data.at = parseFloat(buf.readFloatLE(2 * 4).toFixed(3));
  data.rt = parseFloat(buf.readFloatLE(3 * 4).toFixed(3));
  data.mode = buf.readInt32LE(4 * 4);
  data.rms = parseFloat(buf.readFloatLE(5 * 4).toFixed(3));
  data.seg = buf.readInt32LE(6 * 4);
  data.dots = [];
  let offset = 7 * 4;
  while (buf.length > offset) {
    data.dots.push([
      parseFloat(buf.readFloatLE(offset).toFixed(3)),
      parseFloat(buf.readFloatLE(offset + 4).toFixed(3)),
      parseFloat(buf.readFloatLE(offset + 8).toFixed(3)),
    ]);
    offset += 12;
  }
  return data;
};

const parseEq = (buf) => {
  // console.log('buf--->', buf2Hex(buf));
  let data = {};
  data.enable = Boolean(buf.readInt32LE(0 * 4));
  data.filters = [];
  let offset = 1 * 4;
  while (buf.length > offset) {
    // data.filters.push(
    //   {
    //     enable: buf.readInt32LE(offset),
    //     type: buf.readInt32LE(offset + 4),
    //     dSampleRateHz: parseFloat(buf.readFloatLE(offset + 8).toFixed(3)),
    //     q: parseFloat(buf.readFloatLE(offset + 12).toFixed(3)),
    //     gain: parseFloat(buf.readFloatLE(offset + 16).toFixed(3)),
    //     fc: parseFloat(buf.readFloatLE(offset + 20).toFixed(3)),
    //   }
    // );
    data.filters.push(
      [
        buf.readInt32LE(offset),
        buf.readInt32LE(offset + 4),
        parseFloat(buf.readFloatLE(offset + 8).toFixed(3)),
        parseFloat(fixedNumber(buf.readFloatLE(offset + 12), 3)),
        parseFloat(buf.readFloatLE(offset + 16).toFixed(3)),
        parseFloat(buf.readFloatLE(offset + 20).toFixed(3)),
      ]
    );
    offset += 24;
  }
  return data;
};

const parseAgc = (buf) => {
  let data = {};
  data.enable = Boolean(buf.readInt32LE(0 * 4));
  data.sr = parseFloat(buf.readFloatLE(1 * 4).toFixed(3));
  data.vol = parseFloat(buf.readFloatLE(2 * 4).toFixed(3));
  // data.mono_gains = [];
  // let offset = 3 * 4;
  // while (buf.length > offset) {
  //   data.mono_gains.push([
  //     Boolean(buf.readInt32LE(offset)),
  //     parseFloat(buf.readFloatLE(offset + 4).toFixed(3)),
  //   ]);
  //   offset += 8;
  // }
  return data;
};

const parseBassBoost = (buf) => {
  let data = {};
  data.enable = Boolean(buf.readInt32LE(0));
  data.fs = buf.readFloatLE(4).toFixed(3);
  data.gain = buf.readFloatLE(8).toFixed(3);
  data.freq = buf.readFloatLE(12).toFixed(3);
  return data;
};

const parseTrebleBoost = (buf) => {
  let data = {};
  data.enable = Boolean(buf.readInt32LE(0));
  data.fs = buf.readFloatLE(4).toFixed(3);
  data.gain = buf.readFloatLE(8).toFixed(3);
  data.freq = buf.readFloatLE(12).toFixed(3);
  return data;
};

const fixedNumber = (num, i) => {
  let temp = Number(num);
  temp = Math.floor(temp * 1000) / 1000;
  temp = temp.toFixed(i);
  return temp;
};

// // 58 46 0A 00 01 57 F0 00 01 0F
// console.log('checkConnect =>', checkConnect());

// // 58 46 6F 00 01 F2 F0 00 03 01 01 00 00 00 00 00 7A 46 CD CC 4C 3D CD CC 4C 3E 00 00 00 00 00 00 80 3F 03 00 00 00 00 00 80 BF 00 00 80 BF 00 00 80 3F 00 00 00 C0 00 00 00 C0 00 00 00 40 00 00 40 C0 00 00 40 C0 00 00 40 40 00 00 80 C0 00 00 80 C0 00 00 80 40 00 00 A0 C0 00 00 A0 C0 00 00 A0 40 00 00 C0 C0 00 00 C0 C0 00 00 C0 40 E7
// console.log('drc =>', setParams('drc', {
//   enable: true,
//   fs: 16000.0,
//   at: 0.05,
//   rt: 0.2,
//   mode: 0,
//   rms: 1.0,
//   seg: 3,
//   dots: [
//     [-1.0, -1.0, 1.0],
//     [-2.0, -2.0, 2.0],
//     [-3.0, -3.0, 3.0],
//     [-4.0, -4.0, 4.0],
//     [-5.0, -5.0, 5.0],
//     [-6.0, -6.0, 6.0],
//   ]
// }));

// // 58 46 FF 00 01 62
//    F0 00 03 02 01 00
//    00 00 00 00 00 00 00 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 01 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 02 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 03 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 04 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 04 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 03 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 02 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 01 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 00 00 00 00 00 00 00 00 00 00 7A 46 00 00 80 3F 00 00 80 3F 00 00 C8 42 26
// console.log('eq =>', setParams('eq', {
//   enable: true,
//   filters: [
//     [0, 0, 16000.0, 1.0, 1.0, 100.0],
//     [0, 1, 16000.0, 1.0, 1.0, 100.0],
//     [0, 2, 16000.0, 1.0, 1.0, 100.0],
//     [0, 3, 16000.0, 1.0, 1.0, 100.0],
//     [0, 4, 16000.0, 1.0, 1.0, 100.0],
//     [0, 4, 16000.0, 1.0, 1.0, 100.0],
//     [0, 3, 16000.0, 1.0, 1.0, 100.0],
//     [0, 2, 16000.0, 1.0, 1.0, 100.0],
//     [0, 1, 16000.0, 1.0, 1.0, 100.0],
//     [0, 0, 16000.0, 1.0, 1.0, 100.0],
//   ]
// }));

// // 58 46 27 00 01 3A F0 00 03 03 01 00 00 00 00 00 7A 46 00 00 20 C1 01 00 00 00 00 00 A8 C1 01 00 00 00 00 00 B0 C1 8C
// console.log('agc =>', setParams('agc', {
//   enable: true,
//   sr: 16000.0,
//   vol: -10.0,
//   mono_gains: [
//     [true, -21.0],
//     [true, -22.0]
//   ]
// }));

// // 58 46 17 00 01 4A F0 00 03 04 01 00 00 00 00 00 80 3F 00 00 C8 42 3F
// console.log('bass_boost =>', setParams('bass_boost', {
//   enable: true,
//   gain: 1.0,
//   freq: 100.0
// }));

// // 58 46 17 00 01 4A F0 00 03 05 01 00 00 00 00 00 80 3F 00 00 C8 42 3E
// console.log('treble_boost =>', setParams('treble_boost', {
//   enable: true,
//   gain: 1.0,
//   freq: 100.0
// }));


// console.log(getParams('drc'));
// console.log(getParams('eq'));
// console.log(getParams('agc'));
// console.log(getParams('bass_boost'));
// console.log(getParams('treble_boost'));

// export default {
//   createHeader,
//   createData,
//   checkConnect,
//   setParams,
//   getParams,
//   parseData
// }