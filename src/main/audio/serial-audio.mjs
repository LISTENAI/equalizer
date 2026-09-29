import { AudioDecodeError } from './pcm-source.mjs';
import { pcmFrames } from './frames.mjs';

export function waitForAudioAck({ emitter, send, order, signal, matches = () => true, timeoutMs = 1500 }) {
  return new Promise((resolve, reject) => {
    let finished = false, acknowledged = false, sent = false;
    const cleanup = () => { clearTimeout(timer); emitter.removeListener('write-audio-finish', onAck); signal?.removeEventListener('abort', onAbort); };
    const finish = error => { if (finished) return; finished = true; cleanup(); error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve(); };
    const onAck = ack => { if (ack?.id !== (order & 0xffff) || !matches(ack)) return; acknowledged = true; if (sent) finish(); };
    const onAbort = () => finish(new AudioDecodeError('CANCELLED', '串口音频发送已取消'));
    const timer = setTimeout(() => finish(new Error('等待串口音频确认超时')), timeoutMs);
    emitter.on('write-audio-finish', onAck);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }
    Promise.resolve().then(() => { if (!finished) return send(); }).then(() => { sent = true; if (acknowledged) finish(); }, finish);
  });
}

export class SerialAudioSender {
  constructor({ openPcmSource, writeFrame, isConnected, onState = () => {} }) {
    Object.assign(this, { openPcmSource, writeFrame, isConnected, onState });
    this.current = null; this.epoch = 0; this.tail = Promise.resolve();
  }
  enqueue(operation) { const result = this.tail.then(operation); this.tail = result.catch(() => {}); return result; }
  interrupt(s) { if (s) { s.cancelled = true; s.abort.abort(); s.source.cancel().catch(error => { s.error ||= error; }); } }
  async end(s) {
    if (!s.started || s.ended || !this.isConnected()) return;
    s.ended = true;
    await this.writeFrame({ data: Buffer.alloc(0), order: s.order, flag: 0xf2 });
  }
  async cleanup(s) {
    if (!s) return;
    if (s.cleanup) return s.cleanup;
    this.interrupt(s);
    s.cleanup = (async () => {
      const results = await Promise.allSettled([s.source.cancel(), s.task]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) s.error ||= failure.reason;
      let endError;
      try { await this.end(s); } catch (error) { endError = error; s.error ||= error; }
      if (this.current === s) { this.current = null; this.onState({ isPlaying: false, ...(s.error && !s.cancelledByUser ? { message: s.error.message } : {}) }); }
      if (failure) throw failure.reason;
      if (endError) throw endError;
    })();
    return s.cleanup;
  }
  start(filePath) {
    const epoch = ++this.epoch; this.interrupt(this.current);
    return this.enqueue(async () => {
      await this.cleanup(this.current);
      if (epoch !== this.epoch) throw new AudioDecodeError('CANCELLED', '串口音频发送已取消');
      if (!this.isConnected()) throw new Error('请先打开串口');
      const s = { source: this.openPcmSource(filePath), abort: new AbortController(), order: 0, started: false, ended: false };
      this.current = s;
      try {
        await s.source.ready;
        if (s.cancelled || epoch !== this.epoch) throw new AudioDecodeError('CANCELLED', '串口音频发送已取消');
        this.onState({ isPlaying: true });
        s.task = (async () => {
          try {
            for await (const frame of pcmFrames(s.source.pcm, 1280)) {
              if (s.cancelled) break;
              const flag = s.started ? 0xf1 : 0xf0; s.started = true;
              await this.writeFrame({ data: frame, order: s.order, flag }, s.abort.signal); s.order++;
            }
            await s.source.done;
            if (!s.cancelled) await this.end(s);
          } catch (error) { if (!s.cancelled) s.error = error; }
          finally { queueMicrotask(() => { void this.cleanup(s).catch(() => {}); }); }
        })();
      } catch (error) { await this.cleanup(s); throw error; }
    });
  }
  stop() { ++this.epoch; if (this.current) this.current.cancelledByUser = true; this.interrupt(this.current); return this.enqueue(() => this.cleanup(this.current)); }
  disconnect() { if (this.current) this.current.error = new Error('串口设备已断开'); this.interrupt(this.current); return this.enqueue(() => this.cleanup(this.current)); }
}
