const fs = require('node:fs/promises');
const path = require('node:path');
const afterPack = require('./after-pack.cjs');
const { manifest, verifyDirectory } = require('./assets.cjs');
(async () => {
  const targets = process.argv.includes('--all') ? Object.keys(manifest.targets) : [`${process.platform}-${process.arch}`];
  for (const target of targets) {
    const [platform, arch] = target.split('-');
    const appOutDir = path.resolve(__dirname, '../artifacts/audio/packages', target);
    await afterPack({ electronPlatformName: platform, arch, appOutDir, packager: { appInfo: { productFilename: 'Smoke' } } });
    const resources = platform === 'darwin' ? path.join(appOutDir, 'Smoke.app/Contents/Resources/ffmpeg') : path.join(appOutDir, 'resources/ffmpeg');
    console.log(JSON.stringify({ event: 'ffmpeg-package-smoke', ...await verifyDirectory(resources, target) }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
