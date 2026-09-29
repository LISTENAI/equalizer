import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';

export const PCM_FORMAT = Object.freeze({ sampleRate: 16000, channels: 1, sampleBytes: 2, codec: 'pcm_s16le', format: 's16le' });
export class AudioDecodeError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'AudioDecodeError'; this.code = code; this.details = details; }
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // Both promises remain awaitable; failures cannot become unhandled while
  // a caller is still awaiting the other half of the session contract.
  promise.catch(() => {});
  return { promise, resolve, reject };
}
export function buildDecodeArgs(filePath) {
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', filePath, '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-acodec', PCM_FORMAT.codec, '-ar', String(PCM_FORMAT.sampleRate), '-ac', String(PCM_FORMAT.channels), '-f', PCM_FORMAT.format, 'pipe:1'];
}

export function createPcmService({ getFfmpegPath, spawnProcess = spawn, logger = () => {}, killTimeoutMs = 1000 } = {}) {
  const active = new Set();
  function openPcmSource(filePath) {
    const ready = deferred(), done = deferred(), childClosed = deferred();
    let child, input, carry = Buffer.alloc(0), bytes = 0, stderr = Buffer.alloc(0);
    let closed = false, outputFinished = false, outputEnded = false, cancelled = false, settling = false, settled = false;
    let exitCode = 0, exitSignal = null, cancelPromise, termination;
    const pcm = new Transform({
      highWaterMark: 64 * 1024,
      transform(chunk, encoding, callback) {
        const buffer = carry.length ? Buffer.concat([carry, chunk]) : chunk;
        const length = buffer.length - buffer.length % PCM_FORMAT.sampleBytes;
        carry = Buffer.from(buffer.subarray(length));
        if (length) { bytes += length; this.push(buffer.subarray(0, length)); ready.resolve(); }
        callback();
      },
      flush(callback) {
        callback(carry.length ? new AudioDecodeError('INVALID_PCM', 'PCM 数据长度不是完整采样') : null);
      },
    });
    function report(event, details = {}) {
      try { logger({ event, pid: child?.pid, bytes, ...details }); } catch { /* Diagnostics must not break stream cleanup. */ }
    }
    async function terminate() {
      if (termination) return termination;
      termination = (async () => {
        input?.destroy();
        if (!child || closed) return;
        child.kill('SIGTERM');
        let timer;
        const finished = await Promise.race([
          childClosed.promise.then(() => true),
          new Promise(resolve => { timer = setTimeout(() => resolve(false), killTimeoutMs); }),
        ]);
        clearTimeout(timer);
        if (!finished && !closed) {
          child.kill('SIGKILL');
          const forced = await Promise.race([
            childClosed.promise.then(() => true),
            new Promise(resolve => { timer = setTimeout(() => resolve(false), killTimeoutMs); }),
          ]);
          clearTimeout(timer);
          if (!forced) throw new AudioDecodeError('CANCEL_TIMEOUT', '音频解码进程未能退出');
        }
      })();
      return termination;
    }
    async function fail(error) {
      if (settling || settled || cancelled) return;
      settling = true;
      const failure = error instanceof AudioDecodeError ? error : new AudioDecodeError('DECODE_FAILED', '音频解码失败');
      ready.reject(failure);
      pcm.destroy(failure);
      try { await terminate(); } catch (cleanupError) { failure.details.cleanup = cleanupError.code; }
      settled = true;
      report('audio-decode-failed', { code: failure.code, message: failure.message, ...failure.details });
      done.reject(failure);
    }
    function maybeComplete() {
      if (settled || settling || cancelled || !closed || !outputFinished) return;
      if (exitCode !== 0) {
        const diagnostic = stderr.toString('utf8').replaceAll(filePath, '[input]');
        const noAudio = /matches no streams|does not contain any stream|no audio/i.test(diagnostic);
        void fail(new AudioDecodeError(noAudio ? 'NO_AUDIO' : 'DECODE_FAILED', noAudio ? '文件中没有可用音轨' : '音频解码失败', { exitCode, exitSignal, stderr: diagnostic }));
      } else if (!bytes) void fail(new AudioDecodeError('NO_AUDIO', '文件中没有可播放的音频数据'));
      else if (outputEnded) { settled = true; report('audio-decode-completed'); done.resolve({ status: 'completed', bytes }); }
    }
    pcm.on('error', error => { if (!cancelled) void fail(error); });
    pcm.once('finish', () => { outputFinished = true; maybeComplete(); });
    pcm.once('end', () => { outputEnded = true; maybeComplete(); });
    pcm.once('close', () => {
      if (!outputEnded && !cancelled && !settling && !settled) void fail(new AudioDecodeError('STREAM_CLOSED', '音频流提前关闭'));
    });
    const session = {
      pcm, ready: ready.promise, done: done.promise,
      cancel() {
        if (cancelPromise) return cancelPromise;
        cancelPromise = (async () => {
          if (settled) return;
          cancelled = true;
          ready.reject(new AudioDecodeError('CANCELLED', '音频任务已取消'));
          pcm.destroy();
          try {
            await terminate();
            if (!settling) { settled = true; report('audio-decode-cancelled'); done.resolve({ status: 'cancelled', bytes }); }
            else await done.promise.catch(() => {});
          } catch (error) { settled = true; report('audio-decode-failed', { code: error.code }); done.reject(error); throw error; }
        })();
        return cancelPromise;
      },
    };
    active.add(session);
    done.promise.finally(() => active.delete(session)).catch(() => {});
    void (async () => {
      try {
        if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new AudioDecodeError('INVALID_INPUT', '请选择本地音频文件');
        let info;
        try { info = await stat(filePath); } catch { throw new AudioDecodeError('INPUT_UNREADABLE', '音频文件不存在或无法读取'); }
        if (!info.isFile()) throw new AudioDecodeError('INVALID_INPUT', '音频来源不是文件');
        if (cancelled) return;
        if (path.extname(filePath).toLowerCase() === '.pcm') {
          if (info.size % 2) throw new AudioDecodeError('INVALID_PCM', '裸 PCM 文件必须包含完整的 16 位采样');
          input = createReadStream(filePath, { highWaterMark: 64 * 1024 });
          input.once('end', () => { closed = true; maybeComplete(); });
        } else {
          const executable = await getFfmpegPath();
          try { await access(executable, process.platform === 'win32' ? constants.F_OK : constants.X_OK); }
          catch { throw new AudioDecodeError('FFMPEG_UNAVAILABLE', 'FFmpeg 不存在或不可执行，请检查应用资源'); }
          if (cancelled) return;
          child = spawnProcess(executable, buildDecodeArgs(filePath), { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
          child.once('error', () => { void fail(new AudioDecodeError('FFMPEG_START_FAILED', '无法启动 FFmpeg 解码进程')); });
          child.stderr.on('data', chunk => {
            stderr = Buffer.from(Buffer.concat([stderr, chunk]).subarray(-16 * 1024));
          });
          child.stderr.on('error', () => {});
          child.once('close', (code, signal) => {
            closed = true; exitCode = code; exitSignal = signal; childClosed.resolve(); maybeComplete();
          });
          input = child.stdout;
          report('audio-decode-started');
        }
        input.on('error', error => { void fail(error); });
        input.pipe(pcm);
      } catch (error) { await fail(error); }
    })();
    return session;
  }
  return {
    openPcmSource,
    async close() { await Promise.all([...active].map(session => session.cancel())); },
    get activeCount() { return active.size; },
  };
}
