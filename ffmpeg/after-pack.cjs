const path = require('node:path');
const { stage } = require('./assets.cjs');
module.exports = async function afterPack(context) {
  // electron-builder's Arch enum: ia32=0, x64=1, armv7l=2, arm64=3, universal=4.
  const arch = typeof context.arch === 'string' ? context.arch : ['ia32', 'x64', 'arm', 'arm64', 'universal'][context.arch];
  const platform = context.electronPlatformName;
  const resources = platform === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  await stage({ target: `${platform}-${arch}`, destination: path.join(resources, 'ffmpeg') });
};
