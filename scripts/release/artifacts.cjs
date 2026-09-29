const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { valid } = require('./version.cjs');
const targets = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function names(version, target) {
  valid(version);
  const prefix = `LSAudio-${version}`;
  const map = { 'win32-x64': [`${prefix}-windows-x64-setup.exe`], 'darwin-x64': [`${prefix}-macos-x64.dmg`], 'darwin-arm64': [`${prefix}-macos-arm64.dmg`], 'linux-x64': [`${prefix}-linux-x64.AppImage`, `${prefix}-linux-x64.deb`] };
  if (!map[target]) throw new Error(`Unsupported target: ${target}`);
  return map[target];
}
function record(directory, output) {
  const version = require('../../package.json').version;
  const target = `${process.platform}-${process.arch}`;
  fs.mkdirSync(output, { recursive: true });
  const files = names(version, target).map(name => {
    const file = path.join(directory, name);
    if (!fs.statSync(file).size) throw new Error(`Empty artifact: ${name}`);
    fs.copyFileSync(file, path.join(output, name));
    return { name, sha256: hash(file), bytes: fs.statSync(file).size };
  });
  const ffmpeg = require('../../ffmpeg/manifest.json');
  const compilerFile = fs.readdirSync('native/build/CMakeFiles', { recursive: true }).find(name => name.endsWith('CMakeCCompiler.cmake'));
  const compiler = fs.readFileSync(path.join('native/build/CMakeFiles', compilerFile), 'utf8');
  const compilerId = compiler.match(/set\(CMAKE_C_COMPILER_ID "([^"]+)"\)/)?.[1];
  const compilerVersion = compiler.match(/set\(CMAKE_C_COMPILER_VERSION "([^"]+)"\)/)?.[1];
  const ffmpegExecutable = path.join(require('../../ffmpeg/assets.cjs').cacheDirectory(target), ffmpeg.targets[target].executable);
  const ffmpegActualVersion = execFileSync(ffmpegExecutable, ['-version'], { encoding: 'utf8', windowsHide: true }).split('\n')[0];
  const manifest = { schemaVersion: 1, version, target, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runId: process.env.GITHUB_RUN_ID || 'local', runAttempt: process.env.GITHUB_RUN_ATTEMPT || '1',
    toolchain: { node: process.version, electron: require('electron/package.json').version, builder: require('electron-builder/package.json').version, cmake: execFileSync('cmake', ['--version'], { encoding: 'utf8' }).split('\n')[0], compiler: { id: compilerId, version: compilerVersion } },
    ffmpeg: { ...ffmpeg.targets[target], actualVersion: ffmpegActualVersion }, signing: process.platform === 'darwin' ? 'ad-hoc; not notarized' : 'unsigned', files };
  fs.writeFileSync(path.join(output, `manifest-${target}.json`), JSON.stringify(manifest, null, 2) + '\n');
}
function aggregate(input, output, version, commit, runId) {
  valid(version);
  const manifests = targets.map(target => JSON.parse(fs.readFileSync(path.join(input, `manifest-${target}.json`))));
  for (const [i, m] of manifests.entries()) {
    if (m.schemaVersion !== 1 || m.target !== targets[i] || m.version !== version || m.commit !== commit || m.runId !== runId) throw new Error('Build manifest provenance mismatch');
    if (JSON.stringify(m.files.map(f => f.name).sort()) !== JSON.stringify(names(version, m.target).sort())) throw new Error('Incomplete target assets');
    for (const file of m.files) {
      const source = path.join(input, file.name);
      if (hash(source) !== file.sha256 || fs.statSync(source).size !== file.bytes || file.bytes === 0) throw new Error(`Artifact checksum mismatch: ${file.name}`);
    }
  }
  fs.mkdirSync(output, { recursive: true });
  const files = manifests.flatMap(m => m.files).sort((a,b) => a.name.localeCompare(b.name));
  for (const file of files) fs.copyFileSync(path.join(input, file.name), path.join(output, file.name));
  fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify({ schemaVersion: 1, version, commit, runId, targets: manifests }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), [...files.map(f => `${f.sha256}  ${f.name}`), `${hash(path.join(output, 'build-manifest.json'))}  build-manifest.json`].join('\n') + '\n');
}
if (require.main === module) {
  const [command, input = 'dist', output = 'artifacts/release'] = process.argv.slice(2);
  if (command === 'record') record(input, output);
  else if (command === 'aggregate') aggregate(input, output, require('../../package.json').version, process.env.GITHUB_SHA, process.env.GITHUB_RUN_ID);
  else throw new Error('Usage: artifacts.cjs record|aggregate input output');
}
module.exports = { names, hash, aggregate, targets };
