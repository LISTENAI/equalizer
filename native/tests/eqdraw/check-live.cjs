const assert = require('node:assert/strict');
const live = require('../../artifacts/eqdraw/reference.live.json');
const saved = require('./fixtures/reference.json');
assert.deepEqual(live, saved, 'Original wrapper/core or observations changed. Review before accepting a new baseline.');
console.log('Live eqdrawDLL and its original core match committed wrapper observations.');
