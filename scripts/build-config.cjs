const path = require('node:path');
const original = require('../package.json').build;
const config = structuredClone(original);
config.afterPack = path.join(__dirname, 'after-pack.cjs');
config.extraResources = [];
config.files = ['out/**', 'package.json', '!**/*.map', '!node_modules/koffi/{doc,src,vendor}/**', '!node_modules/@serialport/bindings-cpp/src/**'];
// electron-builder selects dependency prebuilds. Keep universal macOS serial
// bindings and all runtime JS loaders; never reuse the old Windows-only denylist.
config.asarUnpack = ['node_modules/**/*.node', 'node_modules/koffi/build/**'];
config.artifactName = 'LSAudio-${version}-${os}-${arch}.${ext}';
config.win.target = [{ target: 'nsis', arch: ['x64'] }];
config.win.artifactName = 'LSAudio-${version}-windows-${arch}-setup.${ext}';
config.mac = { icon: './public/icon.png', target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
  artifactName: 'LSAudio-${version}-macos-${arch}.${ext}', hardenedRuntime: false, notarize: false,
  sign: path.join(__dirname, 'adhoc-sign.cjs'), binaries: ['Contents/Resources/ffmpeg/ffmpeg'],
};
config.linux = { icon: './public/icon.png', target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
  artifactName: 'LSAudio-${version}-linux-${arch}.${ext}', category: 'AudioVideo',
  maintainer: 'ListenAI', synopsis: 'LSAudio audio device tuning client',
};
module.exports = config;
