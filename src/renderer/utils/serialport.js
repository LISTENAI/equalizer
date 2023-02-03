const SerialPort = require('serialport');
import { parseData, buf2Hex, reciveDataDone } from '../utils/index';
const eventEmitter = require('events');
export default class SerialPortHandle {
    currentConnection = null;
    static type = '';//串口读取的数据种类
    static cacheData = [];//串口读取的数据缓冲
    static serialPorEmitter = new eventEmitter();
    static async getList() {
        return await SerialPort.list();
    }
    static open(portPath) {
        return new Promise((resolve, reject) => {
            const baud_rate = 115200;
            if (this.currentConnection) {
                this.currentConnection.close();
                this.clear();
            }
            console.log('open serialPort', portPath);
            const port = new SerialPort(portPath, {
                baudRate: baud_rate,
                autoOpen: false,
            });
            port.open((err) => {
                if (err) {
                    console.error(err);
                    const message = err.message || '串口连接失败';
                    if (message.includes('Access denied')) {
                        reject('串口已被其他程序打开，或访问串口被系统拒绝');
                    } else {
                        reject(message);
                    }
                }
            });
            port.on('open', () => {
                console.log(`串口连接成功`);
                this.currentConnection = port;
                resolve();
            });
            port.on('data', (buf) => {
                const str = buf && buf2Hex(buf).replace(/\s/g, '');
                this.cacheData.push(str);
                // console.log('串口收到的数据--->', buf2Hex(Buffer.from(this.cacheData.join(''), 'hex')));
                let isEnd = false;
                let all;
                let timeid = setInterval(() => {
                    if (!isEnd) {
                        const allData = Buffer.from(this.cacheData.join(''), 'hex');
                        const { code, data } = reciveDataDone(allData);
                        isEnd = code;
                        all = data;
                    } else {
                        clearInterval(timeid);
                        timeid = null;
                        this.read(all);
                        this.cacheData = [];
                    }
                }, 200);
            });

            port.on('error', (err) => {
                this.clear();
                this.serialPorEmitter.emit('SerialPort', { code: -1, data: { type: 'error' }, message: err.message || '请重新连接串口' });
            });
        });
    }
    static close() {
        const self = this;
        return new Promise((resolve, _reject) => {
            if (this.currentConnection) {
                this.currentConnection.close();
                this.currentConnection.on('close', function (err) {
                    if (err) {
                        reject(err.message || '串口关闭失败');
                    }
                    console.log('断开串口');
                    self.clear();
                    resolve();
                });
            }
            resolve();
        });
    }
    static write(data) {
        return new Promise((resolve, reject) => {
            const port = this.currentConnection;
            if (port) {
                port.write(data, (err) => {
                    if (err) {
                        reject(err.message || '串口写数据出错');
                    }
                });
                port.drain(err => {
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
    static read(data) {
        try {
            const res = parseData(data, this.type);
            // console.log('读取串口数据成功', JSON.stringify(res));
            this.serialPorEmitter.emit('SerialPort', res);
        } catch (error) {
            console.log(error);
        }
    }
    static clear() {
        this.currentConnection = null;
        this.cacheData = [];
    }
}