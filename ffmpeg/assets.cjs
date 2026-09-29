const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const manifest = require('./manifest.json');
const projectRoot = path.resolve(__dirname, '..');

function getTarget(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!manifest.targets[key]) throw new Error(`Unsupported FFmpeg target: ${key}`);
  return key;
}
function cacheDirectory(target, root = path.join(projectRoot, '.cache', 'ffmpeg')) {
  if (!manifest.targets[target]) throw new Error(`Unsupported FFmpeg target: ${target}`);
  return path.join(root, manifest.release, target);
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function check(file, expected) {
  if (await digest(file) !== expected) throw new Error(`FFmpeg checksum mismatch: ${path.basename(file)}`);
}
async function checkArchitecture(file, target) {
  const handle = await fs.open(file, 'r');
  const header = Buffer.alloc(4096);
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  let found = 'unknown';
  if (header.toString('ascii', 0, 2) === 'MZ') {
    const pe = header.readUInt32LE(60);
    if (pe + 6 < header.length && header.readUInt32LE(pe) === 0x4550 && header.readUInt16LE(pe + 4) === 0x8664) found = 'win32-x64';
  } else if (header.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) {
    if (header[4] === 2 && header[5] === 1 && header.readUInt16LE(18) === 62) found = 'linux-x64';
  } else if (header.readUInt32LE(0) === 0xfeedfacf) {
    const cpu = header.readUInt32LE(4);
    if (cpu === 0x1000007) found = 'darwin-x64';
    if (cpu === 0x100000c) found = 'darwin-arm64';
  }
  if (found !== target) throw new Error(`FFmpeg architecture mismatch: expected ${target}, found ${found}`);
}
async function exists(file) { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function verifyDirectory(directory, target, { execute = target === `${process.platform}-${process.arch}` } = {}) {
  const entry = manifest.targets[target];
  if (!entry) throw new Error(`Unsupported FFmpeg target: ${target}`);
  const binary = path.join(directory, entry.executable);
  await Promise.all([
    check(binary, entry.binary.sha256), check(path.join(directory, 'LICENSE'), entry.license.sha256),
    check(path.join(directory, 'README'), entry.readme.sha256),
  ]);
  await checkArchitecture(binary, target);
  if (process.platform !== 'win32') await fs.access(binary, require('node:fs').constants.X_OK);
  let version;
  if (execute) {
    const { stdout } = await exec(binary, ['-version'], { windowsHide: true, timeout: 10000, maxBuffer: 65536 });
    version = stdout.split(/\r?\n/)[0];
    if (!new RegExp(`^ffmpeg version (?:n)?${manifest.version.replaceAll('.', '\\.')}\\b`).test(version)) throw new Error(`Unexpected FFmpeg version: ${version}`);
  }
  return { target, binary, version, release: manifest.release };
}
async function download(asset, destination, fetchImpl) {
  const response = await fetchImpl(asset.url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error(`FFmpeg download failed: HTTP ${response.status} (${asset.url})`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: 'wx' }));
  await check(destination, asset.sha256);
}
async function prepare({ target = getTarget(), cacheRoot, importDirectory, offline = process.env.LSAUDIO_FFMPEG_OFFLINE === '1', fetchImpl = fetch } = {}) {
  const directory = cacheDirectory(target, cacheRoot);
  const entry = manifest.targets[target];
  if (await exists(directory)) return verifyDirectory(directory, target);
  if (offline && !importDirectory) throw new Error(`FFmpeg cache missing for ${target}; run ffmpeg:prepare online or use --import <directory>`);
  const parent = path.dirname(directory);
  await fs.mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${target}-${randomUUID()}`);
  await fs.mkdir(temporary);
  try {
    if (importDirectory) {
      await verifyDirectory(path.resolve(importDirectory), target, { execute: false });
      for (const name of [entry.executable, 'LICENSE', 'README']) await fs.copyFile(path.join(importDirectory, name), path.join(temporary, name));
    } else {
      const archive = path.join(temporary, 'download.gz');
      const downloads = await Promise.allSettled([
        download(entry.archive, archive, fetchImpl),
        download(entry.license, path.join(temporary, 'LICENSE'), fetchImpl),
        download(entry.readme, path.join(temporary, 'README'), fetchImpl),
      ]);
      const failure = downloads.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      await pipeline(createReadStream(archive), createGunzip(), createWriteStream(path.join(temporary, entry.executable), { flags: 'wx' }));
      await fs.unlink(archive);
    }
    if (process.platform !== 'win32') await fs.chmod(path.join(temporary, entry.executable), 0o755);
    await verifyDirectory(temporary, target);
    try { await fs.rename(temporary, directory); }
    catch (error) {
      // Concurrent preparation may have published the same verified target.
      if (!await exists(directory)) throw error;
      await verifyDirectory(directory, target);
    }
    return verifyDirectory(directory, target);
  } finally {
    // temporary is an absolute, directly-created child of the cache release directory.
    if (path.dirname(path.resolve(temporary)) !== path.resolve(parent)) throw new Error('Invalid temporary cache path');
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
async function stage({ target, destination, ...options }) {
  const result = await prepare({ target, ...options });
  await fs.mkdir(destination, { recursive: true });
  for (const name of [manifest.targets[target].executable, 'LICENSE', 'README']) await fs.copyFile(path.join(path.dirname(result.binary), name), path.join(destination, name));
  if (process.platform !== 'win32') await fs.chmod(path.join(destination, manifest.targets[target].executable), 0o755);
  await fs.writeFile(path.join(destination, 'build-info.json'), JSON.stringify({ release: manifest.release, target, sha256: manifest.targets[target].binary.sha256 }) + '\n');
  return verifyDirectory(destination, target);
}
module.exports = { manifest, getTarget, cacheDirectory, check, checkArchitecture, verifyDirectory, prepare, stage };
