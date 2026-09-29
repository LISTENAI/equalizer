import { PCM_FORMAT, AudioDecodeError } from './pcm-source.mjs';
import { pcmFrames } from './frames.mjs';

class SampleQueue {
  constructor(maxSamples) { this.maxSamples = maxSamples; this.chunks = []; this.length = 0; this.offset = 0; this.waiter = null; this.closed = false; }
  async push(samples) {
    while (!this.closed && this.length + samples.length > this.maxSamples) await new Promise(resolve => { this.waiter = resolve; });
    if (this.closed) throw new AudioDecodeError('CANCELLED', '试听已停止');
    this.chunks.push(samples); this.length += samples.length;
  }
  readInto(output) {
    output.fill(0);
    let written = 0;
    while (written < output.length && this.chunks.length) {
      const first = this.chunks[0];
      const count = Math.min(first.length - this.offset, output.length - written);
      output.set(first.subarray(this.offset, this.offset + count), written);
      written += count; this.offset += count; this.length -= count;
      if (this.offset === first.length) { this.chunks.shift(); this.offset = 0; }
    }
    if (this.waiter) { const wake = this.waiter; this.waiter = null; wake(); }
    return written;
  }
  close() { this.closed = true; this.chunks = []; this.length = 0; this.waiter?.(); this.waiter = null; }
}

export class PcmPlayer {
  constructor({ openPcmSource, createAudioOutput, processFrame, onState = () => {}, bufferDuration = 100, maxBufferedSamples = 3200 }) {
    Object.assign(this, { openPcmSource, createAudioOutput, processFrame, onState, bufferDuration, maxBufferedSamples });
    this.current = null; this.epoch = 0; this.tail = Promise.resolve();
  }
  enqueue(operation) { const result = this.tail.then(operation); this.tail = result.catch(() => {}); return result; }
  interrupt(session) {
    if (!session) return;
    session.cancelled = true; session.queue.close(); clearTimeout(session.drainTimer);
    session.source.cancel().catch(error => { session.error ||= error; });
  }
  async cleanup(session) {
    if (!session) return;
    if (session.cleanup) return session.cleanup;
    this.interrupt(session);
    session.cleanup = (async () => {
      const cancel = session.source.cancel();
      const device = await session.devicePromise?.catch(() => null);
      const results = await Promise.allSettled([device?.dispose(), cancel, session.pump]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    })();
    return session.cleanup;
  }
  async finish(session, error) {
    session.error ||= error;
    let cleanupError;
    try { await this.cleanup(session); } catch (failure) { cleanupError = failure; session.error ||= failure; }
    finally {
      if (this.current === session) {
        this.current = null;
        this.onState({ isPlaying: false, ...(session.started && session.error ? { message: session.error.message } : {}) });
      }
    }
    if (cleanupError) throw cleanupError;
  }
  armDrain(session) {
    if (!session.completed || session.queue.length || session.cancelled || !session.started || session.drainTimer) return;
    // Account for synchronous priming callbacks and one device buffer of margin.
    const wait = Math.max(0, session.lastAudioAt - Date.now()) + this.bufferDuration;
    session.drainTimer = setTimeout(() => { void this.finish(session).catch(() => {}); }, wait);
  }
  play(filePath) {
    const epoch = ++this.epoch;
    this.interrupt(this.current);
    return this.enqueue(async () => {
      await this.finishCurrent();
      if (epoch !== this.epoch) throw new AudioDecodeError('CANCELLED', '试听已取消');
      const session = { source: this.openPcmSource(filePath), queue: new SampleQueue(this.maxBufferedSamples), cancelled: false, completed: false, started: false, nextAudioAt: Date.now(), lastAudioAt: Date.now() };
      this.current = session;
      session.pump = (async () => {
        try {
          for await (const frame of pcmFrames(session.source.pcm, 128)) {
            if (session.cancelled) break;
            const padded = Buffer.alloc(128); frame.copy(padded);
            let output = this.processFrame(padded);
            if (!Buffer.isBuffer(output) || output.length < 128) throw new Error('音频算法未返回完整的 64 点帧');
            if (output.byteOffset % 2) output = Buffer.from(output);
            const samples = new Int16Array(output.buffer, output.byteOffset, frame.length / 2);
            await session.queue.push(samples);
          }
          const result = await session.source.done;
          if (result.status === 'completed' && !session.cancelled) { session.completed = true; this.armDrain(session); }
        } catch (error) {
          if (!session.cancelled) { session.error = error; void this.finish(session, error).catch(() => {}); }
        }
      })();
      try {
        await session.source.ready;
        if (session.cancelled || this.current !== session) throw session.error || new AudioDecodeError('CANCELLED', '试听已取消');
        session.devicePromise = this.createAudioOutput({ channelCount: PCM_FORMAT.channels, sampleRate: PCM_FORMAT.sampleRate, bufferDuration: this.bufferDuration }, output => {
          output.fill(0);
          if (session.cancelled || this.current !== session) return;
          const written = session.queue.readInto(output);
          session.nextAudioAt = Math.max(Date.now(), session.nextAudioAt) + output.length / PCM_FORMAT.sampleRate * 1000;
          if (written) session.lastAudioAt = session.nextAudioAt;
          this.armDrain(session);
        });
        await session.devicePromise;
        if (session.cancelled || epoch !== this.epoch) throw session.error || new AudioDecodeError('CANCELLED', '试听已取消');
        session.started = true;
        this.onState({ isPlaying: true }); this.armDrain(session);
      } catch (error) { await this.finish(session, error); throw error; }
    });
  }
  async finishCurrent() { if (this.current) await this.finish(this.current); }
  stop() { ++this.epoch; this.interrupt(this.current); return this.enqueue(() => this.finishCurrent()); }
}
