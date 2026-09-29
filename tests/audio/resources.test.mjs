import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assets from '../../ffmpeg/assets.cjs';
import { resolveFfmpegPath } from '../../src/main/audio/ffmpeg-path.mjs';

test('four pinned target assets include binary/archive/source checksums', () => {
  assert.deepEqual(Object.keys(assets.manifest.targets).sort(), ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']);
  for (const item of Object.values(assets.manifest.targets)) for (const key of ['archive', 'binary', 'license', 'readme']) {
    assert.match(item[key].sha256, /^[a-f0-9]{64}$/);
    assert.ok(item[key].url.includes('/b6.1.1/'));
  }
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
