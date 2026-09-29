export function processDspFrame(api, instance, frame) {
  if (!Buffer.isBuffer(frame) || frame.length !== 128) throw new Error('音频算法需要完整的 64 点 PCM 帧');
  const input = Buffer.alloc(64 * 4), output = Buffer.alloc(64 * 4);
  for (let i = 0; i < 64; ++i) input.writeInt32LE(frame.readInt16LE(i * 2), i * 4);
  const result = api.audioProcess(instance, input, output, 64);
  if (result < 0) throw new Error(`音频处理失败: ${result}`);
  const pcm = Buffer.alloc(128);
  for (let i = 0; i < 64; ++i) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, output.readInt32LE(i * 4))), i * 2);
  return pcm;
}
