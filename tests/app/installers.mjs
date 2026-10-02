import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { names } = require('../../scripts/release/artifacts.cjs');
const { version } = require('../../package.json');
if (!process.env.CI) throw new Error('Installer tests run on disposable CI runners only');
const root = process.cwd();
const output = path.resolve('artifacts/installer-smoke'); mkdirSync(output, { recursive: true });
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });
const smoke = exe => run(process.execPath, ['tests/app/smoke.mjs'], { env: { ...process.env, APP_EXECUTABLE: exe, APPIMAGE_EXTRACT_AND_RUN: '1', DEBUG: 'pw:browser' } });
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
  // Run the actual AppImage using its supported extraction mode on CI.
  run('chmod', ['+x', files[0]]);
  smoke(files[0]);
  run('sudo', ['apt-get', 'install', '-y', files[1]]);
  try { smoke('/opt/LSAudio/lsaudio'); }
  finally { run('sudo', ['dpkg', '--remove', 'lsaudio']); }
} else {
  const installed = path.join(process.env.RUNNER_TEMP, 'LSAudio-installer-test');
  const baseline = path.resolve('.cache/upgrade-baseline/dist');
  const installer = readdirSync(baseline).find(name => name.endsWith('.exe') && name.includes('1.1.4'));
  if (!installer) throw new Error('Actual 1.1.4 baseline installer required');
  run(path.join(baseline, installer), ['/S', `/D=${installed}`]);
  const profile = path.join(output, 'upgrade-profile'), projects = path.join(output, 'upgrade-projects');
  run(process.execPath, ['tests/app/upgrade-seed.mjs'], { env: { ...process.env, APP_EXECUTABLE: path.join(installed, 'LSAudio.exe'), SMOKE_PROFILE: profile, UPGRADE_PROJECT_DIR: projects } });
  const projectFile = path.join(projects, '升级 基线.lsaudio');
  const before = readFileSync(projectFile, 'utf8');
  run(files[0], ['/S', `/D=${installed}`]);
  if (!existsSync(path.join(installed, 'LSAudio.exe'))) throw new Error('NSIS installation failed');
  run(process.execPath, ['tests/app/smoke.mjs'], { env: { ...process.env, APP_EXECUTABLE: path.join(installed, 'LSAudio.exe'), SMOKE_PROFILE: profile, SMOKE_UPGRADE: '1', SMOKE_UPGRADE_PROJECT: projectFile } });
  if (readFileSync(projectFile, 'utf8') !== before) throw new Error('Upgrade modified baseline project');
  const uninstaller = path.join(installed, 'Uninstall LSAudio.exe');
  run(uninstaller, ['/S', `_?=${installed}`]);
  // NSIS deletes the application before returning in _?= mode.
  if (existsSync(path.join(installed, 'LSAudio.exe'))) throw new Error('NSIS uninstallation failed');
}
writeFileSync(path.join(output, 'result.json'), JSON.stringify({ version, target: `${process.platform}-${process.arch}`, passed: true, scope: 'install/mount, launch actual artifact, project/bin and curves, uninstall/unmount; Windows actual 1.1.4 upgrade and preferences; physical hardware tracked separately' }, null, 2));
