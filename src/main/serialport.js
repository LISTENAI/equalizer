import { BrowserWindow, ipcMain } from 'electron';
import EventEmitter from 'events';
import { createReadStream } from 'fs';
import { SerialPort } from 'serialport';
import { PassThrough, Readable } from 'stream';
import { decoder } from './audioDecoder';

let handlingPort = null;
let handlingPortName = null;
let handlingSampleRate = null;
let currentDecoder = null;
let currentReadable = null;

function send(eventName, args) {
  const windows = BrowserWindow.getAllWindows();
  if (windows && windows.length > 0) {
    windows[0].webContents.send(eventName, args);
  }
}

function createHeader(dataLen) {
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
  head.forEach((item) => (sum += item));
  const verify = 256 - (sum % 256);
  head.push(verify);

  return head;
}

function createData(cmd, data) {
  const buf = [0xf0, 0x00, cmd];
  if (data) {
    if (typeof data === 'object') {
      buf.push(...data);
    } else {
      buf.push(data);
    }
  }

  let sum = 0x00;
  buf.forEach((item) => {
    sum += item;
  });

  const verify = 256 - (sum % 256);
  buf.push(verify);
  return buf;
}

function getPcmFrame(data, order, startFlag) {
  const lengthArray = new Uint32Array([data.length]);
  const lengthUint8Array = new Uint8Array(lengthArray.buffer);

  const orderArray = new Uint16Array([order]);
  const orderUint8Array = new Uint8Array(orderArray.buffer);

  return new Uint8Array([
    ...createHeader(
      5 + orderUint8Array.length + lengthUint8Array.length + data.length
    ),
    ...createData(0x5b, [
      0,
      0,
      0x10,
      0x01,
      startFlag,
      ...orderUint8Array,
      ...lengthUint8Array,
      ...data,
    ]),
  ]);
}

function writeData(data) {
  return new Promise((resolve, reject) => {
    const port = handlingPort;
    if (port) {
      port.write(data, (err) => {
        if (err) {
          reject(err.message || '串口写数据出错');
        }
      });
      port.drain((err) => {
        if (err) {
          reject(err.message || '串口写数据出错');
        } else {
          // console.log('发送完成！', buf2Hex(Buffer.from(data, 'hex')));
          resolve();
        }
      });
    } else {
      reject('请先打开串口');
    }
  });
}

const FRAME_HEADER_LENGTH = 6;
const FRAME_TAG_LOW = 0x58;
const FRAME_TAG_HIGH = 0x46;
const FRAME_TYPE_CMD = 0xf0;
const EQ_TYPES = ['UNKNOWN', 'drc', 'eq', 'agc', 'bass_boost', 'treble_boost'];
let frameCnt = 0;

let cacheData = Buffer.from('');

function makeFrameData(type, cmd, data) {
  return new Uint8Array([type, 0, cmd, ...data]);
}
function makeCmdFrameData(cmd, data) {
  return makeFrameData(FRAME_TYPE_CMD, cmd, data);
}

function createLengthBuffer(length) {
  const lengthBuffer = new Uint16Array([length]).buffer;
  return new Uint8Array(lengthBuffer);
}

function createFrameHeader(order, frameLength) {
  const lengthArray = createLengthBuffer(frameLength);
  const array = new Uint8Array([
    FRAME_TAG_LOW,
    FRAME_TAG_HIGH,
    ...lengthArray,
    order,
    0,
  ]);
  let checksum = 0;
  for (let i = 0; i < array.length; i++) {
    checksum += array[i];
    checksum = checksum % 256;
  }
  array[array.length - 1] = 256 - checksum;
  return array;
}

function getNoDataFrame(type) {
  const frameData = makeCmdFrameData(type, new Uint8Array());
  const frameLength = FRAME_HEADER_LENGTH + frameData.length + 1; // 最后一位校验值
  const header = createFrameHeader(frameCnt++, frameLength);

  if (!checkHeaderSum(header)) {
    return false;
  }

  const fullFrame = new Uint8Array([...header, ...frameData, 0]);
  let checksum = 0;
  for (let i = header.length; i < fullFrame.length; i++) {
    checksum += fullFrame[i];
    checksum = checksum % 256;
  }
  fullFrame[fullFrame.length - 1] = 256 - checksum;

  if (!isAvailableFrame(fullFrame)) {
    return false;
  }
  return fullFrame;
}

function checkHeaderSum(array) {
  let checksum = 0;
  for (let i = 0; i < FRAME_HEADER_LENGTH; i++) {
    checksum += array[i];
  }
  return checksum % 256 === 0;
}

function isAvailableFrame(buffer) {
  let checksum = 0;
  for (let i = FRAME_HEADER_LENGTH; i < buffer.length; i++) {
    checksum += buffer[i];
    checksum = checksum % 256;
  }
  if (checksum % 256 !== 0) {
    console.error(
      `帧校验 ${buffer[4]} 失败，结果： ${checksum % 256}，长度: ${
        buffer.length
      }`
    );
    return false;
  }
  return true;
}

function parseToFrame(buffer) {
  return {
    id: new Date().getTime().toString() + Math.random(),
    type: buffer[FRAME_HEADER_LENGTH],
    address: buffer[FRAME_HEADER_LENGTH + 1],
    command: buffer[FRAME_HEADER_LENGTH + 2],
    data: buffer.subarray(FRAME_HEADER_LENGTH + 3, buffer.length - 1), // 最后一位校验值不计入 data
  };
}

function resolveBuffer(buffer) {
  // 校验帧
  const array = new Uint8Array(buffer);
  for (let index = 0; index < array.length - 1; index++) {
    if (index < array.length - 1) {
      if (array[index] == FRAME_TAG_LOW && array[index + 1] == FRAME_TAG_HIGH) {
        // 可能是一个帧
        if (index + FRAME_HEADER_LENGTH < array.length) {
          if (!checkHeaderSum(array.subarray(index, index + 6))) {
            // 校验帧头
            return null;
          }

          const frameLength = Buffer.from(array.subarray(index + 2, index + 4));
          const length = frameLength.readUInt16LE(0);

          if (index + length <= array.length) {
            const frameBuffer = array.subarray(index, index + length);
            if (isAvailableFrame(frameBuffer)) {
              return { frameBuffer, index };
            }
          } else {
            return null;
          }
        } else {
          return null;
        }
      }
    }
  }
  return null;
}

const fixedNumber = (num, i) => {
  let temp = Number(num);
  temp = Math.floor(temp * 1000) / 1000;
  temp = temp.toFixed(i);
  return temp;
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
    data.filters.push([
      buf.readInt32LE(offset),
      buf.readInt32LE(offset + 4),
      parseFloat(buf.readFloatLE(offset + 8).toFixed(3)),
      parseFloat(fixedNumber(buf.readFloatLE(offset + 12), 3)),
      parseFloat(buf.readFloatLE(offset + 16).toFixed(3)),
      parseFloat(buf.readFloatLE(offset + 20).toFixed(3)),
    ]);
    offset += 24;
  }
  return data;
};
function parseDrc(buf) {
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
}
function dispatchFrame(frame) {
  try {
    switch (frame.command) {
      case 0xf1: // 每次命令的响应
        const result = Buffer.from(frame.data).readUInt8(0);
        console.log('命令结果', result);
        break;
      case 0x01: // 采样率返回
        if (frame.data.length >= 4) {
          send('sp-sample-rate', {
            sampleRate: Buffer.from(frame.data).readFloatLE(0),
          });
        } else {
          send('sp-sample-rate', {
            sampleRate: -1,
          });
        }
        break;
      case 0xf2: // 均衡器参数
        {
          const params = {};
          const type = frame.data[0];
          switch (EQ_TYPES[type]) {
            case 'drc':
              params['drc'] = parseDrc(Buffer.from(frame.data.subarray(1)));
              break;
            case 'eq':
              params['eq'] = parseEq(Buffer.from(frame.data.subarray(1)));
              break;
            case 'agc':
              params['agc'] = parseAgc(Buffer.from(frame.data.subarray(1)));
              break;
            case 'bass_boost':
              params['bass_boost'] = parseBassBoost(
                Buffer.from(frame.data.subarray(1))
              );
              break;
            case 'treble_boost':
              params['treble_boost'] = parseTrebleBoost(
                Buffer.from(frame.data.subarray(1))
              );
              break;
            default:
              break;
          }
          send('sp-eq-params', params);
        }
        break;
      case 0x54: // 工作状态
        {
          const type = frame.data[0];
          if (type == 0x5b) {
            // 流式音频状态
            //   console.log(frame.data)
            const id = Buffer.from(frame.data.subarray(1, 3)).readUInt16LE(0);
            const length = Buffer.from(frame.data.subarray(3, 7)).readUInt32LE(
              0
            );
            const state = frame.data[7];
            const freeBytes = Buffer.from(
              frame.data.subarray(8, 10)
            ).readUInt16LE(0);
            const remainDuration = Buffer.from(
              frame.data.subarray(10, 12)
            ).readUInt16LE(0);
            const adviceSleep = Buffer.from(
              frame.data.subarray(12, 14)
            ).readUInt16LE(0);
            emitter.emit('write-audio-finish');
            //   console.log(
            //     'audio result. id: ',
            //     id,
            //     'length: ',
            //     length,
            //     'state: ',
            //     state,
            //     'freeBytes: ',
            //     freeBytes,
            //     'remainDuration: ',
            //     remainDuration,
            //     'adviceSleep: ',
            //     adviceSleep
            //   );
          }
        }
        break;
      case 0x50: // 系统工作状态
        const status = frame.data[0];
        switch (status) {
          case 0x11:
            console.log('系统状态: 播放开始');
            break;
          case 0x12:
            console.log('系统状态: 播放开始');
            break;
          case 0xf2:
            console.log('系统状态: 系统错误');
            break;
          default:
            console.log('系统状态:', '0x' + status.toString(16));
            break;
        }
        break;
      default:
        console.log('unrecognized command', frame.command, frame.data.length);
        break;
    }
  } catch (e) {
    console.warn('error while command is', frame.command.toString(16));
    console.warn('error while data is', frame.data);
    console.error(e);
  }
}

const emitter = new EventEmitter();
function writeAudio(data) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject('等待写音频结果超时');
      emitter.removeAllListeners('write-audio-finish', listener);
    }, 1500);
    const listener = () => {
      clearTimeout(timeoutId);
      emitter.removeListener('write-audio-finish', listener);
      resolve();
    };
    emitter.addListener('write-audio-finish', listener);
    writeData(data)
      .then(() => {})
      .catch((err) => {
        emitter.removeAllListeners('write-audio-finish');
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

export default () => {
  ipcMain.handle('sp-open', (e, data) => {
    if (handlingPort != null) {
      send('sp-open-result', {
        code: -2,
        message: '当前或其他串口已打开，请重试',
      });
      return;
    }
    const { port, baudRate } = data;
    const instance = new SerialPort({
      path: port,
      baudRate,
      autoOpen: false,
    });
    handlingPort = instance;
    instance.on('data', (data) => {
      cacheData = Buffer.concat([cacheData, data]);
      let result = resolveBuffer(cacheData);
      while (result) {
        if (result.index !== 0) {
          console.warn(`存在${result.index}字节数据被丢弃`);
        }
        const frame = parseToFrame(result.frameBuffer);
        try {
          dispatchFrame(frame);
        } catch (err) {
          console.error(err);
        }

        cacheData = Buffer.from(
          cacheData.subarray(result.index + result.frameBuffer.length)
        );

        result = resolveBuffer(cacheData);
      }
    });
    instance.open((err) => {
      if (err) {
        if (handlingPort == instance) {
          handlingPort = null;
        }
        console.error(err);

        const message = err.message || '串口连接失败';
        if (message.includes('Access denied')) {
          send('sp-open-result', {
            code: -1,
            message: '串口已被其他程序打开，或访问串口被系统拒绝',
          });
        } else {
          send('sp-open-result', {
            code: -1,
            message,
          });
        }
      } else {
        send('sp-open-result', {
          code: 0,
        });
      }
    });
  });
  ipcMain.handle('sp-verify-connection', async (e, data) => {
    if (handlingPort == null) {
      send('sp-verify-connection-result', {
        code: -1,
        message: '未连接',
      });
      return;
    }
    const frame = getNoDataFrame(0x01);

    if (frame) {
      try {
        await writeData(frame);
        send('sp-verify-connection-result', {
          code: 0,
        });
      } catch (err) {
        send('sp-verify-connection-result', {
          code: -1,
          message: err,
        });
      }
    } else {
      send('sp-verify-connection-result', {
        code: -1,
        message: '生成帧数据错误',
      });
    }
  });
  ipcMain.handle('sp-close', (e, data) => {
    if (handlingPort == null) {
      send('sp-close-result', {
        code: -1,
        message: '未连接',
      });
      return;
    }
    handlingPort.close((err) => {
      handlingPort = null;
      if (err) {
        send('sp-close-result', {
          code: -1,
          message: err,
        });
      } else {
        send('sp-close-result', {
          code: 0,
        });
      }
    });
  });
  ipcMain.handle('sp-write', (e, data) => {
    if (handlingPort == null) {
      send('sp-write-result', {
        code: -1,
        message: '未连接',
      });
      return;
    }
    handlingPort.write(data, (err) => {
      if (err) {
        send('sp-write-result', {
          code: -1,
          message: err,
        });
      } else {
        send('sp-write-result', {
          code: 0,
        });
      }
    });
  });
  ipcMain.handle('sp-cancel-audio-file', async (e) => {
    let handled = false;
    if (currentDecoder) {
      handled = true;
      currentDecoder.kill();
      currentDecoder = null;
    }
    if (currentReadable) {
      handled = true;
      currentReadable.close();
      currentReadable = null;
    }
    if (handled) {
      try {
        await writeAudio(getPcmFrame([], 0, 0xf2));
      } catch (err) {
        console.error(err);
      }
      send('sp-update-audio-state', { isPlaying: false });
    }
  });
  ipcMain.handle('sp-send-audio-file', async (e, args) => {
    const fileName = args.file;
    const highWaterMark = 1280;
    let first = false;
    let order = 0;
    if (fileName.endsWith('.pcm')) {
      const stream = createReadStream(fileName, {
        highWaterMark,
      });
      const readable = new Readable({
        highWaterMark,
      }).wrap(stream);
      currentReadable = readable;
      send('sp-update-audio-state', { isPlaying: true });
      for await (const chunk of readable) {
        if (currentReadable != readable) {
          if (!readable.closed) {
            readable.close();
          }
          break;
        }
        // await sleep(sleepMs);
        const frame = getPcmFrame(chunk, order, !first ? 0xf0 : 0xf1);
        first = true;
        try {
          await writeAudio(frame);
        } catch (e) {
          console.error(e);
          break;
        }
        order++;
      }
      if (currentReadable == readable) {
        try {
          await writeAudio(getPcmFrame([], order, 0xf2));
        } catch (e) {
          console.error(e);
        }
        if (!readable.closed) {
          readable.close();
        }
        currentReadable = null;
        send('sp-update-audio-state', { isPlaying: false });
      }
    } else {
      const pushStream = new PassThrough();
      const readable = new Readable({
        highWaterMark,
      }).wrap(pushStream);
      let current = decoder(fileName)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .toFormat('s16le')
        .on('error', function (err, stdout, stderr) {
          console.log('Cannot process audio: ' + err.message);
        })
        .on('stderr', function (stderrLine) {
          // console.log('Stderr output: ' + stderrLine);
        });
      currentDecoder = current;
      current.pipe(pushStream, { end: true });
      readable.on('readable', async () => {
        let chunk;
        let lastAvailable = 0;
        // const ouptut = createWriteStream("./output.pcm"); // log audio pcm

        send('sp-update-audio-state', { isPlaying: true });

        while (
          null !== (chunk = readable.read(highWaterMark)) &&
          currentDecoder == current
        ) {
          // console.log(`Read ${chunk.length} bytes of data...`);
          // ouptut.write(chunk);
          lastAvailable = chunk.length;

          // await sleep(sleepMs);
          const frame = getPcmFrame(chunk, order, !first ? 0xf0 : 0xf1);

          first = true;
          try {
            //   console.log('write frame', frame.length);
            //   await writeData(frame);
            await writeAudio(frame);
          } catch (e) {
            console.error(e);
            break;
          }
          order++;
        }
        if (lastAvailable == 0) return; // readable 可能会触发 2 次，这种情况下前一次无数据，要忽略
        if (currentDecoder == current) {
          try {
            await writeAudio(getPcmFrame([], order, 0xf2));
          } catch (e) {
            console.error(e);
          }
          currentDecoder = null;

          send('sp-update-audio-state', { isPlaying: false });
        }
      });
    }
  });
};
