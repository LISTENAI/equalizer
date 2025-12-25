import { EventEmitter } from 'eventemitter3';

const { ipcRenderer } = window;

class Action {
  static OpenSerial = 'sp-open';
  static CloseSerial = 'sp-close';
  static WriteSerial = 'sp-write';
  static VerifyConnection = 'sp-verify-connection';
  static SendAudioFile = 'sp-send-audio-file';
  static CancelAudioFile = 'sp-cancel-audio-file';
}

class _SerialPortProxy {
  emitter = new EventEmitter();

  mount() {
    ipcRenderer.addListener('sp-sample-rate', (e, args) => {
      this.emitter.emit('sp-sample-rate', args);
    });
    ipcRenderer.addListener('sp-eq-params', (e, args) => {
      console.log('sp-eq-params', args);
      this.emitter.emit('sp-eq-params', args);
    });
    ipcRenderer.addListener('sp-update-audio-state', (e, args) => {
      this.emitter.emit('sp-update-audio-state', args);
    });
  }
  unmount() {
    this.close();
    ipcRenderer.removeAllListeners('sp-sample-rate');
    ipcRenderer.removeAllListeners('sp-eq-params');
    ipcRenderer.removeAllListeners('sp-update-audio-state');
  }

  on(event, listener) {
    this.emitter.on(event, listener);
  }

  off(event, listener) {
    this.emitter.off(event, listener);
  }

  open(params) {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.OpenSerial + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.OpenSerial, params);
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.CloseSerial + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.CloseSerial);
    });
  }

  verifyConnection() {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.VerifyConnection + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.VerifyConnection);
    });
  }

  write(params) {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.WriteSerial + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.WriteSerial, params);
    });
  }

  playAudioFile(args) {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.SendAudioFile + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.SendAudioFile, args);
    });
  }

  cancelAudioFile() {
    return new Promise((resolve, reject) => {
      const resultEvent = Action.CancelAudioFile + '-result';
      const resultListener = (e, data) => {
        resolve(data);
        ipcRenderer.removeAllListeners(resultEvent);
      };
      ipcRenderer.addListener(resultEvent, resultListener);
      ipcRenderer.invoke(Action.CancelAudioFile);
    });
  }
}

export const SerialPortProxy = new _SerialPortProxy();

export async function getList() {
  return new Promise((resolve) => {
    ipcRenderer.once('sp-get-list-result', (e, data) => {
      resolve(data);
    });
    ipcRenderer.invoke('sp-get-list');
  });
}
