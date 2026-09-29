const assert = require('node:assert/strict');
const live = require('../../artifacts/reference.live.json');
const saved = require('./fixtures/reference.json');
assert.deepEqual(live, saved, 'Original DLL or observations changed since capture. Review before accepting a new baseline.');
console.log('Live original DLL matches committed observations, including all curve and DrcDrawGet cases.');
