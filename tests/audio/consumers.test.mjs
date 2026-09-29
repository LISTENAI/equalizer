import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { createPcmService } from '../../src/main/audio/pcm-source.mjs';
import { PcmPlayer } from '../../src/main/audio/playback.mjs';
import { SerialAudioSender, waitForAudioAck } from '../../src/main/audio/serial-audio.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { const end = Date.now() + 3000; while (!predicate()) { if (Date.now() > end) throw new Error('Timed out waiting for test state'); await new Promise(r => setTimeout(r, 2)); } }
async function setup(t, sampleCount = 70) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsaudio-consumer-'));
  const pcm = Buffer.alloc(sampleCount * 2); for (let i = 0; i < sampleCount; ++i) pcm.writeInt16LE(i % 30000 + 1, i * 2);
  const file = path.join(dir, 'input.pcm'); await writeFile(file, pcm);
  const service = createPcmService();
  t.after(async () => { await service.close(); await rm(dir, { recursive: true, force: true }); });
  return { pcm, file, service };
}
test('playback uses buffer offsets, pads DSP tail only, drains and disposes once', async t => {
  const { pcm, file, service } = await setup(t);
  const played = [], frames = [], states = []; let disposed = 0;
  const player = new PcmPlayer({ openPcmSource: service.openPcmSource, bufferDuration: 1, maxBufferedSamples: 64,
    processFrame(frame) { frames.push(Buffer.from(frame)); const backing = Buffer.alloc(132, 0x55); frame.copy(backing, 2); return backing.subarray(2, 130); },
    createAudioOutput: async (_config, handler) => {
      const timer = setInterval(() => { const output = new Int16Array(20); handler(output); played.push(...output); }, 2);
      return { async dispose() { disposed++; clearInterval(timer); } };
    }, onState: state => states.push(state),
  });
  t.after(() => player.stop());
  await player.play(file); await until(() => disposed === 1);
  assert.deepEqual(played.slice(0, 70), Array.from({ length: 70 }, (_, i) => pcm.readInt16LE(i * 2)));
  assert.ok(played.slice(70).every(v => v === 0));
  assert.equal(frames.length, 2); assert.ok(frames[1].subarray(12).every(v => v === 0));
  assert.deepEqual(states.map(s => s.isPlaying), [true, false]);
});
test('rapid replacement during device creation disposes old output and ignores old callbacks', async t => {
  const { file, service } = await setup(t, 10000); const callbacks = [], disposed = [], states = [];
  let release;
  const player = new PcmPlayer({ openPcmSource: service.openPcmSource, processFrame: b => Buffer.from(b), onState: s => states.push(s),
    createAudioOutput: async (_config, handler) => {
      const id = callbacks.length; callbacks.push(handler);
      if (id === 0) await new Promise(resolve => { release = resolve; });
      return { async dispose() { disposed.push(id); } };
    },
  });
  t.after(() => player.stop());
  const first = player.play(file); first.catch(() => {}); await until(() => callbacks.length === 1);
  const second = player.play(file); release();
  await assert.rejects(first, e => e.code === 'CANCELLED'); await second;
  const stale = new Int16Array(64).fill(123); callbacks[0](stale);
  assert.ok(stale.every(v => v === 0)); assert.deepEqual(disposed, [0]);
  assert.equal(states.at(-1).isPlaying, true); assert.ok(player.current.queue.length <= 3200);
  await player.stop(); assert.deepEqual(disposed, [0, 1]);
});
test('output creation errors propagate and leave no active source', async t => {
  const { file, service } = await setup(t, 10000);
  const player = new PcmPlayer({ openPcmSource: service.openPcmSource, processFrame: b => b, createAudioOutput: async () => { throw new Error('device unavailable'); } });
  await assert.rejects(player.play(file), /device unavailable/); assert.equal(service.activeCount, 0); assert.equal(player.current, null);
});
test('serial sender waits each ACK, preserves short tail, and ends exactly once', async t => {
  const { pcm, file, service } = await setup(t, 1301); const frames = [], states = []; let pending = 0, maximum = 0;
  const sender = new SerialAudioSender({ openPcmSource: service.openPcmSource, isConnected: () => true, onState: s => states.push(s),
    writeFrame: async frame => { pending++; maximum = Math.max(maximum, pending); frames.push({ ...frame, data: Buffer.from(frame.data) }); await new Promise(r => setTimeout(r, 3)); pending--; },
  });
  t.after(() => sender.stop());
  await sender.start(file); await until(() => sender.current === null);
  assert.equal(maximum, 1); assert.deepEqual(frames.map(f => f.flag), [0xf0, 0xf1, 0xf1, 0xf2]);
  assert.deepEqual(frames.map(f => f.data.length), [1280, 1280, 42, 0]);
  assert.deepEqual(Buffer.concat(frames.map(f => f.data)), pcm); assert.deepEqual(frames.map(f => f.order), [0, 1, 2, 3]);
  assert.deepEqual(states.map(s => s.isPlaying), [true, false]);
});
test('ACK timeout and abort remove only the current waiter; stale frame IDs are ignored', async () => {
  const emitter = new EventEmitter(); const unrelated = () => {}; emitter.on('write-audio-finish', unrelated);
  let sent = false;
  const waiting = waitForAudioAck({ emitter, order: 3, send: async () => { sent = true; }, timeoutMs: 20 });
  emitter.emit('write-audio-finish', { id: 2 });
  await assert.rejects(waiting, /超时/); assert.ok(sent); assert.deepEqual(emitter.listeners('write-audio-finish'), [unrelated]);
  const abort = new AbortController();
  const cancelled = waitForAudioAck({ emitter, order: 4, send: async () => {}, signal: abort.signal }); abort.abort();
  await assert.rejects(cancelled, e => e.code === 'CANCELLED'); assert.deepEqual(emitter.listeners('write-audio-finish'), [unrelated]);
  const success = waitForAudioAck({ emitter, order: 65537, send: async () => {} }); await tick(); emitter.emit('write-audio-finish', { id: 1 }); await success;
});
test('serial cancellation during ACK sends one terminal frame; disconnect stops consumption', async t => {
  const { file, service } = await setup(t, 5000);
  for (const disconnected of [false, true]) {
    let connected = true; const frames = [], states = [];
    const sender = new SerialAudioSender({ openPcmSource: service.openPcmSource, isConnected: () => connected, onState: s => states.push(s),
      writeFrame: async (frame, signal) => {
        frames.push(frame.flag);
        if (frame.flag !== 0xf2) await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
          if (signal.aborted) reject(new Error('cancelled'));
        });
      },
    });
    await sender.start(file); await until(() => frames.length > 0);
    if (disconnected) { connected = false; await sender.disconnect(); } else await sender.stop();
    assert.deepEqual(frames, disconnected ? [0xf0] : [0xf0, 0xf2]); assert.equal(sender.current, null);
    assert.equal(states.at(-1).isPlaying, false); if (disconnected) assert.match(states.at(-1).message, /断开/);
  }
});
