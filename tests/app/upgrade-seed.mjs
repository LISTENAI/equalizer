import { _electron } from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import getDefaultConfig from '../../src/renderer/utils/config.js';
const directory = process.env.UPGRADE_PROJECT_DIR;
mkdirSync(directory, { recursive: true });
const app = await _electron.launch({ executablePath: process.env.APP_EXECUTABLE, args: [`--user-data-dir=${process.env.SMOKE_PROFILE}`], timeout: 60000 });
try {
  const page = await app.firstWindow(); await page.getByText('均衡器参数组', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.appInfo.version), '1.1.4');
  const result = await page.evaluate(async ({ config, directory }) => {
    localStorage.setItem('release-upgrade-pref', 'from-1.1.4');
    return window.ipcRenderer.invoke('create-project', { pathStr: directory, name: '升级 基线', configJson: config, isSave: true });
  }, { config: getDefaultConfig(16000), directory });
  assert.equal(result.code, 0);
} finally { await app.close(); }
