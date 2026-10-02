const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { signAsync } = require('@electron/osx-sign');
const { writeManifest } = require('../native/resources.cjs');
module.exports = async options => {
  await signAsync({ ...options, identity: '-', identityValidation: false, preAutoEntitlements: false,
    optionsForFile: file => ({ ...options.optionsForFile(file), hardenedRuntime: false }),
  });
  writeManifest(path.join(options.app, 'Contents/Resources/native'));
  const ffmpeg = path.join(options.app, 'Contents/Resources/ffmpeg');
  const metadata = JSON.parse(fs.readFileSync(path.join(ffmpeg, 'build-info.json')));
  metadata.sourceSha256 = metadata.sha256;
  metadata.sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ffmpeg, 'ffmpeg'))).digest('hex');
  metadata.signing = 'ad-hoc';
  fs.writeFileSync(path.join(ffmpeg, 'build-info.json'), JSON.stringify(metadata) + '\n');
  // Updating the resource manifest invalidates only the outer app signature.
  execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', '--preserve-metadata=entitlements', options.app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', options.app], { stdio: 'inherit' });
};
