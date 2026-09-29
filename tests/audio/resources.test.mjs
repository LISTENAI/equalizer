import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assets from '../../ffmpeg/assets.cjs';
import { resolveFfmpegPath } from '../../src/main/audio/ffmpeg-path.mjs';

test('four pinned target assets include binary/archive/source checksums', () => {
  assert.equal(assets.manifest.schemaVersion, 2);
  assert.deepEqual(Object.keys(assets.manifest.targets).sort(), ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']);
  for (const item of Object.values(assets.manifest.targets)) for (const key of ['archive', 'binary', 'license', 'readme']) {
    assert.match(item[key].sha256, /^[a-f0-9]{64}$/);
    assert.ok(item[key].url.includes('/b6.1.1/'));
  }
});
test('bundle release tags do not override the actual pinned platform versions', () => {
  const cases = [
    ['win32-x64', 'ffmpeg version 6.1.1-essentials_build-www.gyan.dev Copyright', '6.1.1'],
    ['darwin-x64', 'ffmpeg version n6.1.1 Copyright', '6.1.1'],
    ['darwin-arm64', 'ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers', '6.0'],
    ['linux-x64', 'ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/ Copyright', '7.0.2'],
  ];
  for (const [target, banner, expected] of cases) assert.equal(assets.verifyVersion(banner, target), expected);
  for (const banner of ['ffmpeg version 6.1.10 Copyright', 'ffmpeg version 6.1.1.2 Copyright', 'ffmpeg version 6.0 Copyright', 'invalid']) {
    assert.throws(() => assets.verifyVersion(banner, 'win32-x64'), /Unexpected FFmpeg version/);
  }
  assert.throws(() => assets.verifyVersion('ffmpeg version 6.1.1 Copyright', 'darwin-arm64'), /Unexpected FFmpeg version/);
  assert.throws(() => assets.verifyVersion('ffmpeg version 6.1.1 Copyright', 'linux-x64'), /Unexpected FFmpeg version/);
});
test('runtime paths use injected roots and target; packaged apps ignore overrides', () => {
  const root = path.resolve('fixture root 中文'), resources = path.join(root, 'resources');
  for (const target of Object.keys(assets.manifest.targets)) {
    const [platform, arch] = target.split('-');
    const result = resolveFfmpegPath({ packaged: true, appRoot: root, resourcesPath: resources, platform, arch, override: path.join(root, 'wrong') });
    assert.equal(result, path.join(resources, 'ffmpeg', assets.manifest.targets[target].executable));
    assert.equal(resolveFfmpegPath({ packaged: false, appRoot: root, platform, arch }), path.join(root, '.cache/ffmpeg/b6.1.1', target, assets.manifest.targets[target].executable));
  }
  assert.throws(() => resolveFfmpegPath({ packaged: false, appRoot: root, override: 'relative' }), /absolute/);
  assert.throws(() => assets.getTarget('win32', 'arm64'), /Unsupported/);
});
test('checksum corruption and wrong target architecture fail explicitly', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-resource-'));
  try {
    const file = path.join(dir, 'ffmpeg');
    const bytes = Buffer.alloc(4096); bytes.writeUInt32LE(0xfeedfacf); bytes.writeUInt32LE(0x100000c, 4);
    await writeFile(file, bytes);
    await assets.checkArchitecture(file, 'darwin-arm64');
    await assert.rejects(assets.checkArchitecture(file, 'darwin-x64'), /architecture mismatch/);
    await assets.check(file, createHash('sha256').update(bytes).digest('hex'));
    await assert.rejects(assets.check(file, '0'.repeat(64)), /checksum mismatch/);
    await assert.rejects(assets.prepare({ cacheRoot: dir, target: 'linux-x64', offline: true }), /cache missing/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('failed or corrupt downloads never publish a partial cache', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-download-'));
  try {
    for (const fetchImpl of [async () => new Response('failed', { status: 503 }), async () => new Response('corrupted')]) {
      await assert.rejects(assets.prepare({ cacheRoot: dir, target: 'linux-x64', fetchImpl }), /download failed|checksum mismatch/);
      assert.deepEqual(await readdir(path.join(dir, 'b6.1.1')), []);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
