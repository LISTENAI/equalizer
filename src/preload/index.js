import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  addListener: (channel, listener) =>
    ipcRenderer.addListener(channel, listener),
  once: (channel, listener) => ipcRenderer.once(channel, listener),
  removeListener: (channel, listener) =>
    ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  off: (channel, listener) => ipcRenderer.off(channel, listener),
});

contextBridge.exposeInMainWorld('appInfo', {
  version: process.env.VUE_APP_VERSION,
});
