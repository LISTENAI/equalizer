const { existsSync } = require('fs');

if (!existsSync('./ffmpeg/ffmpeg.exe')) {
    throw new Error('Missing ./ffmpeg/ffmpeg.exe');
}
