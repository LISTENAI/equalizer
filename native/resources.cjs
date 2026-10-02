const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkArchitecture } = require('../ffmpeg/assets.cjs');
const modules = ['eqdrc', 'eqdraw', 'soundeffect'];
function libraryName(name, platform = process.platform) {
  return platform === 'win32' ? `lsaudio_${name}.dll` : platform === 'darwin' ? `liblsaudio_${name}.dylib` : `liblsaudio_${name}.so`;
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function writeManifest(directory, platform = process.platform, arch = process.arch) {
  const files = Object.fromEntries(modules.map(name => { const file = libraryName(name, platform); return [file, hash(path.join(directory, file))]; }));
  const manifest = { schemaVersion: 1, platform, arch, files };
  fs.writeFileSync(path.join(directory, 'native-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
async function stageNative(directory, platform, arch) {
  if (platform !== process.platform || arch !== process.arch) throw new Error('Native libraries must be built on the matching platform/architecture');
  const source = path.join(__dirname, 'build/lib');
  const metadata = JSON.parse(fs.readFileSync(path.join(source, 'native-manifest.json'), 'utf8'));
  if (metadata.platform !== platform || metadata.arch !== arch) throw new Error('Native build target mismatch');
  fs.mkdirSync(directory, { recursive: true });
  for (const name of modules) {
    const file = libraryName(name, platform);
    if (hash(path.join(source, file)) !== metadata.files[file]) throw new Error(`Stale native manifest: ${file}`);
    await checkArchitecture(path.join(source, file), `${platform}-${arch}`);
    fs.copyFileSync(path.join(source, file), path.join(directory, file));
    if (platform !== 'win32') fs.chmodSync(path.join(directory, file), 0o755);
  }
  return writeManifest(directory, platform, arch);
}
module.exports = { libraryName, writeManifest, stageNative };
