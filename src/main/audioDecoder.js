import { app } from 'electron';
import path from 'node:path';
import { createPcmService } from './audio/pcm-source.mjs';
import { resolveFfmpegPath } from './audio/ffmpeg-path.mjs';
import { persistAudioFailure } from './audio/diagnostics.mjs';
const service = createPcmService({
  getFfmpegPath: () => resolveFfmpegPath({ packaged: app.isPackaged, appRoot: app.getAppPath(), resourcesPath: process.resourcesPath, override: process.env.FFMPEG_PATH }),
  logger: event => {
    if (event.event === 'audio-decode-failed') {
      const record = { at: new Date().toISOString(), ...event };
      console.error(record);
      const directory = path.join(app.getPath('userData'), 'diagnostics');
      void persistAudioFailure(directory, record)
        .catch(error => console.error({ event: 'audio-diagnostic-write-failed', message: error.message }));
    }
  },
});
export const openPcmSource = service.openPcmSource;
export const closePcmSources = () => service.close();
