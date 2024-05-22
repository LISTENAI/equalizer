const { copyFileSync, existsSync, mkdirSync } = require('fs');

if (!existsSync('./dist_electron')) {
    mkdirSync('./dist_electron')
}
copyFileSync('./ffmpeg/ffmpeg.exe', './dist_electron/ffmpeg.exe');
