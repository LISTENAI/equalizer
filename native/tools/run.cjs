const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const build = path.join(root, 'native/build');
const artifacts = path.join(root, 'native/artifacts');
const modules = [
  { name: 'eqdrc', original: 'iflytekEqDrcDrawApi.dll', artifactDir: artifacts },
  { name: 'eqdraw', original: 'eqdrawDLL.dll', artifactDir: path.join(artifacts, 'eqdraw') },
  { name: 'soundeffect', original: 'SoundEffect.dll', artifactDir: path.join(artifacts, 'soundeffect') },
];
function libraryName(name) { return process.platform === 'win32' ? `${name}.dll` : process.platform === 'darwin' ? `lib${name}.dylib` : `lib${name}.so`; }
function run(command, args, timeout = 120000) {
  console.log('>', command, ...args);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status}, signal ${result.signal})`);
}
function configure() { run('cmake', ['--no-warn-unused-cli', '-S', 'native', '-B', 'native/build', '-DCMAKE_BUILD_TYPE=Release']); }
function compile() {
  configure(); run('cmake', ['--build', 'native/build', '--config', 'Release']);
  require('../resources.cjs').writeManifest(path.join(build, 'lib'));
}
function observe(module, library, dest, mode) { run(process.execPath, [`native/tests/${module.name}/observe.cjs`, library, dest, mode], 30000); }
function windowsOracle() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Oracle capture requires Windows x64. Portable tests use committed fixtures instead.');
}
try {
  const action = process.argv[2] || 'test';
  if (!['configure', 'build', 'test', 'capture', 'compare'].includes(action)) throw new Error(`Unknown action: ${action}`);
  const selection = process.argv[3];
  if (selection && !modules.some(m => m.name === selection)) throw new Error(`Unknown native module: ${selection}`);
  const selected = selection ? modules.filter(m => m.name === selection) : modules;
  fs.mkdirSync(artifacts, { recursive: true });
  for (const module of selected) fs.mkdirSync(module.artifactDir, { recursive: true });
  if (action === 'configure') configure();
  else if (action === 'build') compile();
  else if (action === 'capture') {
    windowsOracle();
    // Finish every capture before replacing any tracked fixture.
    for (const module of selected) observe(module, path.join(root, 'dlls/x64', module.original), path.join(module.artifactDir, 'reference.capture.json'), 'oracle');
    for (const module of selected) {
      const fixtures = path.join(root, `native/tests/${module.name}/fixtures/reference.json`);
      fs.mkdirSync(path.dirname(fixtures), { recursive: true });
      fs.copyFileSync(path.join(module.artifactDir, 'reference.capture.json'), fixtures);
    }
    console.log('Captured original DLL fixtures. Review the fixture diff before committing.');
  } else {
    compile();
    run('ctest', ['--test-dir', 'native/build', '-C', 'Release', '--output-on-failure']);
    if (action === 'compare') windowsOracle();
    for (const module of selected) {
      if (action === 'compare') observe(module, path.join(root, 'dlls/x64', module.original), path.join(module.artifactDir, 'reference.live.json'), 'oracle');
      observe(module, path.join(build, 'lib', libraryName(`lsaudio_${module.name}`)), path.join(module.artifactDir, 'candidate.json'), 'candidate');
      run(process.execPath, ['--test', `native/tests/${module.name}/compat.test.cjs`]);
      if (action === 'compare') run(process.execPath, [`native/tests/${module.name}/check-live.cjs`]);
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
