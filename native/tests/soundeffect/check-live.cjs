const assert=require('node:assert/strict');
assert.deepEqual(require('../../artifacts/soundeffect/reference.live.json'),require('./fixtures/reference.json'),'Original SoundEffect outputs changed; inspect the difference before replacing fixtures.');
console.log('Live SoundEffect.dll matches saved audio and lifecycle observations.');
