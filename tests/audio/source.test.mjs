import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Readable, PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createPcmService, buildDecodeArgs } from '../../src/main/audio/pcm-source.mjs';
import { pcmFrames } from '../../src/main/audio/frames.mjs';
const fake = fileURLToPath(new URL('./fake-ffmpeg.cjs', import.meta.url));
async function fixture(t, suffix = '.wav') {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-source-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, `中文 音频${suffix}`); await writeFile(file, Buffer.from([1, 2, 3, 4])); return file;
}
function service(t, mode, extra = {}) {
  const result = createPcmService({ getFfmpegPath: () => process.execPath, spawnProcess: (_binary, _args, options) => spawn(process.execPath, [fake, mode], options), ...extra });
  t.after(() => result.close()); return result;
}
async function collect(pcm) { const parts = []; for await (const part of pcm) parts.push(part); return Buffer.concat(parts); }

test('explicit argument array selects one audio stream and never invokes a shell', () => {
  const name = path.resolve('中文 ; $(echo nope).mp3'); const args = buildDecodeArgs(name);
  assert.equal(args[args.indexOf('-i') + 1], name); assert.equal(args[args.indexOf('-map') + 1], '0:a:0');
  assert.ok(args.includes('-nostdin')); assert.equal(args.at(-1), 'pipe:1');
});
test('raw PCM is case insensitive and does not require FFmpeg', async t => {
  const file = await fixture(t, '.PCM'); const s = service(t, 'fail', { getFfmpegPath: () => { throw new Error('must not resolve FFmpeg'); } });
  const source = s.openPcmSource(file); await source.ready;
  assert.deepEqual(await collect(source.pcm), Buffer.from([1, 2, 3, 4])); assert.equal((await source.done).status, 'completed');
  assert.equal(s.activeCount, 0);
});
test('fragmented stdout preserves every sample; pauses are not EOF', async t => {
  const file = await fixture(t);
  for (const mode of ['split', 'delayed', 'noisy']) {
    const source = service(t, mode).openPcmSource(file); await source.ready;
    assert.deepEqual(await collect(source.pcm), Buffer.from([1, 2, 3, 4])); await source.done;
  }
});
test('invalid/empty input and decoder failures reject both contracts without hanging', async t => {
  const file = await fixture(t);
  for (const [mode, code] of [['fail', 'DECODE_FAILED'], ['no-audio', 'NO_AUDIO'], ['empty', 'NO_AUDIO']]) {
    const source = service(t, mode).openPcmSource(file);
    await assert.rejects(source.ready, e => e.code === code);
    await assert.rejects(source.done, e => e.code === code);
  }
  const raw = await fixture(t, '.pcm'); await writeFile(raw, Buffer.from([1]));
  const source = service(t, 'split').openPcmSource(raw);
  await assert.rejects(source.ready, e => e.code === 'INVALID_PCM'); await assert.rejects(source.done);
});
test('missing input, missing executable and truncated output are explicit failures', async t => {
  const file = await fixture(t);
  const missing = service(t, 'split').openPcmSource(`${file}.missing`);
  await assert.rejects(missing.ready, e => e.code === 'INPUT_UNREADABLE'); await assert.rejects(missing.done);
  const unavailable = service(t, 'split', { getFfmpegPath: () => `${file}.missing` }).openPcmSource(file);
  await assert.rejects(unavailable.ready, e => e.code === 'FFMPEG_UNAVAILABLE'); await assert.rejects(unavailable.done);
  const truncated = service(t, 'truncated').openPcmSource(file);
  const reading = collect(truncated.pcm); reading.catch(() => {});
  await assert.rejects(truncated.done, e => e.code === 'INVALID_PCM'); await assert.rejects(reading);
});
test('cancel before startup and during decode is idempotent and cleans up all sessions', async t => {
  const file = await fixture(t); const s = service(t, 'hang');
  const a = s.openPcmSource(file); const first = a.cancel(); assert.equal(a.cancel(), first); await first;
  assert.equal((await a.done).status, 'cancelled'); await assert.rejects(a.ready, e => e.code === 'CANCELLED');
  const b = s.openPcmSource(file); await new Promise(r => setTimeout(r, 100)); await s.close();
  assert.equal((await b.done).status, 'cancelled'); assert.equal(s.activeCount, 0);
});
test('cancel escalates if a child ignores graceful termination', async t => {
  const file = await fixture(t), signals = []; let started;
  const startup = new Promise(r => { started = r; });
  const s = service(t, 'hang', { killTimeoutMs: 10, spawnProcess() {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = signal => { signals.push(signal); if (signal === 'SIGKILL') queueMicrotask(() => child.emit('close', null, signal)); return true; };
    started(); return child;
  } });
  const source = s.openPcmSource(file); await startup; await source.cancel();
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']); assert.equal((await source.done).status, 'cancelled');
});
test('reblocking handles arbitrary byte boundaries and preserves short final frames', async () => {
  const data = Buffer.from(Array.from({ length: 2602 }, (_, i) => i % 256));
  const parts = [data.subarray(0, 1), data.subarray(1, 300), data.subarray(300, 1501), data.subarray(1501)];
  const output = []; for await (const frame of pcmFrames(Readable.from(parts), 1280)) output.push(frame);
  assert.deepEqual(output.map(b => b.length), [1280, 1280, 42]); assert.deepEqual(Buffer.concat(output), data);
});
