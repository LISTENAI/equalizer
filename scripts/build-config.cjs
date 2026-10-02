const path = require('node:path');
const fs = require('node:fs');
const original = require('../package.json').build;
const config = structuredClone(original);
config.afterPack = path.join(__dirname, 'after-pack.cjs');
config.extraResources = [];
config.files = ['out/**', 'package.json', '!**/*.map', '!node_modules/koffi/{doc,src,vendor}/**', '!node_modules/@serialport/bindings-cpp/src/**'];
// Select native bindings for this native runner. macOS serialport ships a
// universal directory whose name is not just darwin-x64 or darwin-arm64.
const selections = [
  ['koffi/build/koffi', name => name === `${process.platform}_${process.arch}`],
  ['@serialport/bindings-cpp/prebuilds', name => name === (process.platform === 'darwin' ? 'darwin-x64+arm64' : `${process.platform}-${process.arch}`)],
  ['@echogarden/audio-io/addons/bin', name => name.startsWith(`${{ win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform]}-${process.arch}-`)],
];
for (const [directory, keep] of selections) {
  for (const entry of fs.readdirSync(path.join(__dirname, '../node_modules', directory), { withFileTypes: true })) {
    if (!keep(entry.name)) config.files.push(`!node_modules/${directory}/${entry.name}${entry.isDirectory() ? '/**' : ''}`);
  }
}
config.asarUnpack = ['node_modules/**/*.node', 'node_modules/koffi/build/**'];
config.artifactName = 'LSAudio-${version}-${os}-${arch}.${ext}';
config.win.target = [{ target: 'nsis', arch: ['x64'] }];
config.win.artifactName = 'LSAudio-${version}-windows-${arch}-setup.${ext}';
config.mac = { icon: './public/icon512.png', target: [{ target: 'dmg', arch: [process.arch] }],
  artifactName: 'LSAudio-${version}-macos-${arch}.${ext}', hardenedRuntime: false, notarize: false,
  sign: path.join(__dirname, 'adhoc-sign.cjs'), binaries: ['Contents/Resources/ffmpeg/ffmpeg'],
};
config.linux = { icon: './public/icon512.png', target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
  artifactName: 'LSAudio-${version}-linux-x64.${ext}', category: 'AudioVideo',
  maintainer: 'ListenAI', synopsis: 'LSAudio audio device tuning client',
};
module.exports = config;
