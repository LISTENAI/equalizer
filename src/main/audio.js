import { ipcMain, dialog, BrowserWindow } from 'electron';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg-7';
const stream = require('stream');


let ffmpegPath = join(__static, 'ffmpeg.exe');
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
  ffmpegPath = ffmpegPath.replace('\\public\\', '\\ffmpeg\\');
} else {
  ffmpegPath = ffmpegPath.replace('\\resources\\app.asar\\', '\\');
}

//tell the ffmpeg package where it can find the needed binaries.
console.log('Using ffmpeg at: ', ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to push chunks of chunkSize from buffer to stream
// returns a Buffer containing the remaining bytes that weren't pushed
function pushChunks(buffer, stream, chunkSize) {
  var offset = 0,
    size = buffer.length;

  while (size >= chunkSize) {
    stream.push(buffer.slice(offset, offset + chunkSize));
    offset += chunkSize;
    size -= chunkSize;
  }

  return buffer.slice(offset, offset + size);
}

function FixedChunkSizeTransform(chunkSize) {
  chunkSize = chunkSize || 8192;

  var buffer = new Buffer(chunkSize),
    bufferOffset = 0;

  var chunker = new stream.Transform({ objectMode: true });

  chunker._transform = function (chunk, encoding, done) {
    // If we have data in the buffer, try to fill it up to chunkSize.
    if (bufferOffset != 0) {
      var bytesNeeded = chunkSize - bufferOffset;
      // If we have enough bytes in this chunk to get buffer up to chunkSize,
      // fill in buffer, push it, and reset its offset.
      // Otherwise, just copy the entire chunk in to buffer.
      if (chunk.length >= bytesNeeded) {
        chunk.copy(buffer, bufferOffset, 0, bytesNeeded);
        this.push(buffer);
        bufferOffset = 0;
        chunk = chunk.slice(0, chunk.length - bytesNeeded);
      } else {
        chunk.copy(buffer, bufferOffset);
        bufferOffset += chunk.length;
      }
    }

    // If there's nothing in the buffer, push the chunk.
    if (bufferOffset == 0) {
      var remainingChunk = pushChunks(chunk, this, chunkSize);
      // If there are bytes left over, put them in the buffer.
      if (remainingChunk.length) {
        remainingChunk.copy(buffer, bufferOffset);
        bufferOffset += remainingChunk.length;
      }
    }

    done();
  };

  chunker._flush = function (done) {
    if (bufferOffset) {
      this.push(buffer.slice(0, bufferOffset));
      done();
    }
  };

  return chunker;
}

function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export default () => {
  ipcMain.handle('open-audio', async () => {
    const result = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), {
      filters: [
        {
          name: '音頻',
          extensions: ['mp3', 'wav', 'pcm'],
        },
      ],
      properties: ['openFile'],
    });
    return { code: 0, data: result };
  });
  let handleProcess = null;
  ipcMain.handle('decode-audio-cancel', (e, data) => {
    if (handleProcess != null) {
      handleProcess.kill();
      handleProcess = null;

      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.send('decode-audio-end');
      console.log('send audio-end by cancel');
    }
  });
  ipcMain.handle('decode-audio', async (e, data) => {
    const { file } = data;

    try {
      const perSize = 640;
      const pushStream = new stream.PassThrough();
      const readable = new stream.Readable({
        highWaterMark: perSize,
      }).wrap(pushStream);
      let current = ffmpeg(file)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .toFormat('wav')
        .on('end', () => {
          console.log('decode end');
          if (handleProcess == current) {
            handleProcess = null;
          }
          window.webContents.send('decode-audio-end');
        })
        .on('error', function (err, stdout, stderr) {
          console.log('Cannot process audio: ' + err.message);
        })
        .on('stderr', function (stderrLine) {
          // console.log('Stderr output: ' + stderrLine);
        });

      current.pipe(pushStream, { end: true });
      handleProcess = current;
      const sleepMs = 1000 / ((32 * 1024) / perSize);
      let window = BrowserWindow.getAllWindows()[0];
      readable.on('readable', async () => {
        let chunk;
        while (null !== (chunk = readable.read(4096))) {
          // console.log(`Read ${chunk.length} bytes of data...`);

          if (handleProcess == current) {
            setTimeout(() => {
              window.webContents.send('decode-audio-data', {
                data: chunk,
              });
            });
            await sleep(125);
          }
        }
      });
    } catch (error) {
      console.error(error);
    }
  });
};
