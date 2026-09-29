const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { signAsync } = require('@electron/osx-sign');
const { writeManifest } = require('../native/resources.cjs');
module.exports = async options => {
  await signAsync({ ...options, identity: '-', identityValidation: false, preAutoEntitlements: false,
    optionsForFile: file => ({ ...options.optionsForFile(file), hardenedRuntime: false }),
  });
  writeManifest(path.join(options.app, 'Contents/Resources/native'));
  // Updating the resource manifest invalidates only the outer app signature.
  execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', '--preserve-metadata=entitlements', options.app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', options.app], { stdio: 'inherit' });
};
