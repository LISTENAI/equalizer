const fs = require('node:fs');
const path = require('node:path');
const ffmpeg = require('../ffmpeg/after-pack.cjs');
const { stageNative } = require('../native/resources.cjs');
module.exports = async context => {
  await ffmpeg(context);
  const arch = typeof context.arch === 'string' ? context.arch : ['ia32', 'x64', 'arm', 'arm64', 'universal'][context.arch];
  const platform = context.electronPlatformName;
  const resources = platform === 'darwin' ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app/Contents/Resources`) : path.join(context.appOutDir, 'resources');
  await stageNative(path.join(resources, 'native'), platform, arch);
  const licenses = path.join(resources, 'licenses'); fs.mkdirSync(licenses, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../native/third_party/cmsis-dsp/LICENSE.txt'), path.join(licenses, 'CMSIS-DSP-LICENSE.txt'));
  fs.copyFileSync(path.join(__dirname, '../native/third_party/cmsis-dsp/UPSTREAM.md'), path.join(licenses, 'CMSIS-DSP-SOURCE.md'));
};
