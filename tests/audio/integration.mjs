import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assets from '../../ffmpeg/assets.cjs';
import { createPcmService, buildDecodeArgs } from '../../src/main/audio/pcm-source.mjs';
const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const ffmpeg = (await assets.verifyDirectory(assets.cacheDirectory(assets.getTarget()), assets.getTarget())).binary;

function wave(pcm, rate = 16000, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
function tone(rate, samples, channels = 1) {
  const pcm = Buffer.alloc(samples * channels * 2);
  for (let i = 0; i < samples; ++i) for (let c = 0; c < channels; ++c) pcm.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 1000 * i / rate)), (i * channels + c) * 2);
  return pcm;
}
async function decode(file, executable = ffmpeg) {
  const service = createPcmService({ getFfmpegPath: () => executable });
  const source = service.openPcmSource(file);
  try { await source.ready; const parts = []; for await (const part of source.pcm) parts.push(part); await source.done; return Buffer.concat(parts); }
  finally { await service.close(); }
}
function compare(a, b) {
  let different = 0, maximum = 0, sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 2) { const delta = a.readInt16LE(i) - b.readInt16LE(i); if (delta) different++; maximum = Math.max(maximum, Math.abs(delta)); sum += delta * delta; }
  return { samplesOld: a.length / 2, samplesNew: b.length / 2, differingSamples: different, maxDifference: maximum, rmse: Math.sqrt(sum / (length / 2)) };
}

test('real FFmpeg decodes supported formats, preserves PCM, and validates resampling', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-integration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pcm = tone(16000, 32137), input = path.join(dir, '中文 空格.wav');
  await writeFile(input, wave(pcm));
  const raw = path.join(dir, '中文.PCM'); await writeFile(raw, pcm);
  assert.deepEqual(await decode(raw), pcm); assert.deepEqual(await decode(input), pcm);
  const files = { wav: input };
  for (const [extension, codec, format] of [['mp3', 'libmp3lame', 'mp3'], ['flac', 'flac', 'flac'], ['aac', 'aac', 'adts'], ['m4a', 'aac', 'ipod'], ['ogg', 'libvorbis', 'ogg']]) {
    const output = path.join(dir, `fixture.${extension}`); files[extension] = output;
    await exec(ffmpeg, ['-nostdin', '-v', 'error', '-i', input, '-c:a', codec, '-f', format, output], { windowsHide: true });
    const decoded = await decode(output);
    assert.equal(decoded.length % 2, 0);
    if (extension === 'flac') assert.deepEqual(decoded, pcm);
    else {
      assert.ok(Math.abs(decoded.length - pcm.length) <= 8192, `${extension}: unexpected padding/duration`);
      let energy = 0; for (let i = 0; i < decoded.length; i += 2) energy += decoded.readInt16LE(i) ** 2;
      const rms = Math.sqrt(energy / (decoded.length / 2)); assert.ok(rms > 7500 && rms < 9500, `${extension}: RMS=${rms}`);
    }
  }
  const stereo = path.join(dir, '44100 stereo.wav'); files.resample = stereo;
  await writeFile(stereo, wave(tone(44100, 44100, 2), 44100, 2));
  const resampled = await decode(stereo); assert.equal(resampled.length, 32000);
  let positiveCrossings = 0;
  for (let i = 2; i < resampled.length; i += 2) if (resampled.readInt16LE(i - 2) <= 0 && resampled.readInt16LE(i) > 0) positiveCrossings++;
  assert.ok(positiveCrossings >= 999 && positiveCrossings <= 1001);
  const invalid = path.join(dir, 'invalid.mp3'); await writeFile(invalid, 'not audio');
  await assert.rejects(decode(invalid), e => e.code === 'DECODE_FAILED');
  const video = path.join(dir, 'video only.mkv');
  await exec(ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=16x16:duration=0.1', '-an', '-c:v', 'ffv1', video], { windowsHide: true });
  await assert.rejects(decode(video), e => e.code === 'NO_AUDIO');
  const legacy = process.env.FFMPEG_LEGACY_PATH;
  if (legacy) {
    const observations = {};
    for (const [name, file] of Object.entries(files)) observations[name] = compare(await decode(file, legacy), await decode(file));
    const report = { platform: process.platform, arch: process.arch, oldVersion: (await exec(legacy, ['-version'], { windowsHide: true })).stdout.split(/\r?\n/)[0], newVersion: (await exec(ffmpeg, ['-version'], { windowsHide: true })).stdout.split(/\r?\n/)[0], observations };
    await mkdir(path.join(root, 'artifacts/audio'), { recursive: true });
    await writeFile(path.join(root, 'artifacts/audio/ffmpeg-migration.json'), JSON.stringify(report, null, 2));
    t.diagnostic(JSON.stringify(report));
  }
});

test('verified caches work offline and packaging selects the requested target', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-pack-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = assets.getTarget();
  const offline = await assets.prepare({ target, offline: true, fetchImpl: () => { throw new Error('Unexpected network'); } });
  assert.equal(offline.binary, ffmpeg);
  const imported = await assets.prepare({ target, cacheRoot: path.join(dir, 'imported'), importDirectory: path.dirname(ffmpeg), offline: true });
  assert.notEqual(imported.binary, ffmpeg);
  const { default: afterPack } = await import('../../ffmpeg/after-pack.cjs');
  await afterPack({ electronPlatformName: process.platform, arch: process.arch, appOutDir: dir, packager: { appInfo: { productFilename: 'Audio Smoke' } } });
  const resources = process.platform === 'darwin' ? path.join(dir, 'Audio Smoke.app/Contents/Resources') : path.join(dir, 'resources');
  const staged = await assets.verifyDirectory(path.join(resources, 'ffmpeg'), target);
  const info = JSON.parse(await readFile(path.join(resources, 'ffmpeg/build-info.json'), 'utf8')); assert.equal(info.target, target);
  const bad = path.join(dir, 'cached-bad'); await mkdir(bad);
  await writeFile(path.join(bad, 'LICENSE'), 'bad');
  await assert.rejects(assets.prepare({ target, cacheRoot: path.join(dir, 'bad-import'), importDirectory: bad, offline: true }));
  assert.equal(assets.verifyVersion(staged.version, target), assets.manifest.targets[target].version);
  assert.equal(info.version, assets.manifest.targets[target].version);
});
