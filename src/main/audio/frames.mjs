// Reblock a byte stream without relying on read()/data-event chunk sizes.
export async function* pcmFrames(pcm, frameBytes) {
  if (!Number.isInteger(frameBytes) || frameBytes < 2 || frameBytes % 2) throw new Error('frameBytes must be an even positive integer');
  let pending = Buffer.alloc(0);
  for await (const chunk of pcm) {
    let data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    let offset = 0;
    while (data.length - offset >= frameBytes) { yield data.subarray(offset, offset + frameBytes); offset += frameBytes; }
    pending = Buffer.from(data.subarray(offset));
  }
  if (pending.length % 2) throw new Error('Incomplete PCM sample');
  if (pending.length) yield pending;
}
