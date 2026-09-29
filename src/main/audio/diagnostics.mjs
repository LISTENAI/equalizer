import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function persistAudioFailure(directory, record) {
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true });
  const temporary = path.join(root, `audio-error-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(record, null, 2));
    await rename(temporary, path.join(root, 'audio-last-error.json'));
  } finally { await rm(temporary, { force: true }); }
}
