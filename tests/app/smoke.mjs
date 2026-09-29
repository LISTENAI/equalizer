import assert from 'node:assert/strict';
import { _electron } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import getDefaultConfig from '../../src/renderer/utils/config.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const directory = path.resolve(process.env.SMOKE_OUTPUT || path.join(root, 'artifacts/app-smoke', `${process.platform}-${process.arch}`, String(Date.now())));
await mkdir(directory, { recursive: true });
const executablePath = process.env.APP_EXECUTABLE || (process.platform === 'win32' ? path.join(root, 'dist/win-unpacked/LSAudio.exe') : process.platform === 'darwin' ? path.join(root, `dist/mac${process.arch === 'arm64' ? '-arm64' : ''}/LSAudio.app/Contents/MacOS/LSAudio`) : path.join(root, 'dist/linux-unpacked/lsaudio'));
const application = await _electron.launch({ executablePath, args: [`--user-data-dir=${path.join(directory, 'profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  env: { ...process.env, LSAUDIO_SMOKE: '1', ELECTRON_ENABLE_LOGGING: '1' }, timeout: 60000 });
const failures = [];
try {
  const page = await application.firstWindow(); page.on('pageerror', error => failures.push(error.message));
  await page.getByText('均衡器参数组', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await page.evaluate(() => window.appInfo.version), process.env.EXPECTED_APP_VERSION || pkg.version);
  const config = getDefaultConfig(16000);
  const result = await page.evaluate(async ({ config, directory }) => {
    const ipc = window.ipcRenderer;
    const eq = await ipc.invoke('eq-draw', config.eq, { startFreq: 20, endFreq: 7800, startGain: -30, endGain: 30, yNum: 315 });
    const drc = await ipc.invoke('drc-draw', config.drc, { WidthX: 315, HeightY: 315, startXGain: -100, endXGain: 0, startYGain: -100, endYGain: 0 });
    const created = await ipc.invoke('create-project', { pathStr: directory, name: '中文 工程', configJson: config, isSave: true });
    const saved = await ipc.invoke('save-project', { manifestJson: created.data.manifestJson, configJson: config });
    const binary = await ipc.invoke('write-bin', directory, '中文 参数.bin', config);
    const read = await ipc.invoke('read-bin', `${directory}/中文 参数.bin`);
    const params = await ipc.invoke('player-set-params', JSON.stringify(config));
    const stop = await ipc.invoke('player-stop');
    const serial = await ipc.invoke('sp-get-list');
    localStorage.setItem('release-smoke-pref', 'preserved');
    return { eq: { ret: eq.ret, count: eq.points.length }, drc: { ret: drc.ret, count: drc.points.length }, created: created.code, saved: saved.code, binary, read, params, stop, serial };
  }, { config, directory });
  assert.equal(result.eq.ret, 0); assert.equal(result.eq.count, 840);
  assert.equal(result.drc.ret, 0); assert.equal(result.drc.count, 315);
  assert.equal(result.created, 0); assert.equal(result.saved, 0); assert.equal(result.binary, 0);
  assert.equal(result.read.eq.filters.length, 10); assert.equal(result.read.drc.fs, 16000);
  assert.equal(result.params.code, 0); assert.equal(result.stop.code, 0);
  const project = JSON.parse(await readFile(path.join(directory, '中文 工程.lsaudio'), 'utf8'));
  assert.equal(project.manifestJson.version, 2);
  assert.deepEqual(project.configJson, config);
  await page.screenshot({ path: path.join(directory, 'main-window.png') });
  assert.deepEqual(failures, []);
  await writeFile(path.join(directory, 'result.json'), JSON.stringify({ platform: process.platform, arch: process.arch, version: pkg.version, passed: true, result }, null, 2));
  console.log('Packaged client smoke passed: UI, version, native libraries, Unicode project/bin, curves, DSP params and shutdown.');
} finally { await application.close(); }
