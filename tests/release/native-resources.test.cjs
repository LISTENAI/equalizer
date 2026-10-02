const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeManifest, libraryName } = require('../../native/resources.cjs');
test('startup resource guard rejects absent, corrupt and wrong-architecture resources', async t => {
  const { verifyNativeResources, nativeDirectory } = await import('../../src/libs/native-runtime.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsaudio-native-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(nativeDirectory({ packaged: true, resourcesPath: root }), path.join(root, 'native'));
  assert.throws(() => verifyNativeResources(root), /清单/);
  for (const name of ['eqdrc', 'eqdraw', 'soundeffect']) fs.writeFileSync(path.join(root, libraryName(name)), name);
  writeManifest(root); assert.equal(Object.keys(verifyNativeResources(root)).length, 3);
  assert.throws(() => verifyNativeResources(root, process.platform, process.arch === 'x64' ? 'arm64' : 'x64'));
  fs.appendFileSync(path.join(root, libraryName('eqdrc')), 'corrupt'); assert.throws(() => verifyNativeResources(root), /校验/);
  fs.unlinkSync(path.join(root, libraryName('eqdrc'))); assert.throws(() => verifyNativeResources(root), /缺少/);
});
