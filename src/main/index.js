import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { nativeDirectory, verifyNativeResources } from '../libs/native-runtime.mjs';

let runtime;
let shutdownComplete = false, shutdown;
app.on('before-quit', event => {
  if (shutdownComplete || !runtime) return;
  event.preventDefault();
  shutdown ||= (async () => {
    const results = await Promise.allSettled([runtime.stopPlayer(), runtime.stopSerialAudio(), runtime.closePcmSources()]);
    for (const result of results) if (result.status === 'rejected') console.error({ event: 'audio-shutdown-failed', message: result.reason?.message });
    shutdownComplete = true; app.quit();
  })();
});
async function createWindow() {
  const window = new BrowserWindow({
    height: 640, width: 1320, minHeight: 640, minWidth: 1320, frame: false, show: false,
    useContentSize: true,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true },
  });
  window.once('ready-to-show', () => window.show());
  runtime.IpcMainHandle(window);
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await window.loadFile(path.join(__dirname, '../renderer/index.html'));
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  else if (runtime) void Promise.allSettled([runtime.stopPlayer(), runtime.stopSerialAudio()]);
});
app.on('activate', () => { if (runtime && BrowserWindow.getAllWindows().length === 0) void createWindow().catch(startupFailure); });
function startupFailure(error) {
  console.error({ event: 'startup-failed', message: error.message });
  if (!process.env.LSAUDIO_SMOKE) dialog.showErrorBox('LSAudio 无法启动', error.message);
  app.exit(1);
}
app.whenReady().then(async () => {
  verifyNativeResources(nativeDirectory({ packaged: app.isPackaged, appRoot: app.getAppPath(), resourcesPath: process.resourcesPath }));
  // Dynamic imports keep native-load errors inside the visible startup handler.
  const [ipc, player, serial, audio] = await Promise.all([import('./ipcMain'), import('./player'), import('./serialport'), import('./audioDecoder')]);
  runtime = { IpcMainHandle: ipc.IpcMainHandle, stopPlayer: player.stopPlayer, stopSerialAudio: serial.stopSerialAudio, closePcmSources: audio.closePcmSources };
  await createWindow();
}).catch(startupFailure);
if (!app.isPackaged) {
  if (process.platform === 'win32') process.on('message', data => { if (data === 'graceful-exit') app.quit(); });
  else process.on('SIGTERM', () => app.quit());
}
