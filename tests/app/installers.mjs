import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { names } = require('../../scripts/release/artifacts.cjs');
const { version } = require('../../package.json');
if (!process.env.CI) throw new Error('Installer tests run on disposable CI runners only');
const root = process.cwd();
const output = path.resolve('artifacts/installer-smoke'); mkdirSync(output, { recursive: true });
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });
const smoke = exe => run(process.execPath, ['tests/app/smoke.mjs'], { env: { ...process.env, APP_EXECUTABLE: exe } });
const files = names(version, `${process.platform}-${process.arch}`).map(n => path.resolve('dist', n));
if (process.platform === 'darwin') {
  const mount = path.join(output, 'mounted'); mkdirSync(mount, { recursive: true });
  run('hdiutil', ['attach', files[0], '-nobrowse', '-readonly', '-mountpoint', mount]);
  try {
    const app = path.join(output, 'LSAudio.app');
    run('ditto', [path.join(mount, 'LSAudio.app'), app]);
    run('codesign', ['--verify', '--deep', '--strict', app]);
    smoke(path.join(app, 'Contents/MacOS/LSAudio'));
  } finally { run('hdiutil', ['detach', mount]); }
} else if (process.platform === 'linux') {
  // Extraction avoids requiring FUSE in containers; execute the shipped AppRun.
  run('chmod', ['+x', files[0]]);
  run(files[0], ['--appimage-extract'], { cwd: output });
  smoke(path.join(output, 'squashfs-root/AppRun'));
  run('sudo', ['apt-get', 'install', '-y', files[1]]);
  try { smoke('/opt/LSAudio/lsaudio'); }
  finally { run('sudo', ['dpkg', '--remove', 'lsaudio']); }
} else {
  const installed = path.join(process.env.RUNNER_TEMP, 'LSAudio-installer-test');
  run(files[0], ['/S', `/D=${installed}`]);
  if (!existsSync(path.join(installed, 'LSAudio.exe'))) throw new Error('NSIS installation failed');
  smoke(path.join(installed, 'LSAudio.exe'));
  const uninstaller = path.join(installed, 'Uninstall LSAudio.exe');
  run(uninstaller, ['/S', `_?=${installed}`]);
  // NSIS deletes the application before returning in _?= mode.
  if (existsSync(path.join(installed, 'LSAudio.exe'))) throw new Error('NSIS uninstallation failed');
}
writeFileSync(path.join(output, 'result.json'), JSON.stringify({ version, target: `${process.platform}-${process.arch}`, passed: true, scope: 'install/mount, launch actual artifact, project/bin and curves, uninstall/unmount; physical hardware and upgrade acceptance tracked separately' }, null, 2));
