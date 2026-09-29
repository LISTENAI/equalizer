const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const reference = require('./fixtures/reference.json');
const candidate = require('../../artifacts/candidate.json');

test('fixture provenance and case definitions match this run', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'cases.cjs'), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  const observerHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'observe.cjs'), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(reference.schemaVersion, 1);
  assert.equal(reference.source.filename, 'iflytekEqDrcDrawApi.dll');
  assert.equal(reference.caseHash, hash, 'Inputs changed; explicitly recapture original DLL fixtures.');
  assert.equal(candidate.caseHash, hash);
  assert.equal(reference.observerHash, observerHash, 'Observer changed; explicitly recapture original DLL fixtures.');
  assert.equal(candidate.observerHash, observerHash);
});
function compareRecords(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i], e = expected[i];
    assert.equal(a.id, e.id);
    for (const key of Object.keys(e)) {
      if (key.endsWith('Hex') && a[key] !== e[key]) {
        const ab = Buffer.from(a[key], 'hex'), eb = Buffer.from(e[key], 'hex');
        const offset = eb.findIndex((byte, j) => byte !== ab[j]);
        assert.fail(`${e.id} ${key}: first different byte at ${offset}, lengths ${ab.length}/${eb.length}`);
      }
      assert.equal(a[key], e[key], `${e.id}.${key}`);
    }
  }
}
test(`${reference.bin.length} binary cases: exact write/read observations and input immutability`, () => {
  compareRecords(candidate.bin, reference.bin);
});
test('short reads, trailing bytes and error return compatibility', () => {
  compareRecords(candidate.reads, reference.reads);
  assert.deepEqual(candidate.errors, reference.errors);
});
test(`${reference.coordinates.length} coordinate cases: exact integer results and bounded numeric error`, () => {
  assert.equal(candidate.coordinates.length, reference.coordinates.length);
  for (let i = 0; i < reference.coordinates.length; i++) {
    const expected = reference.coordinates[i], actual = candidate.coordinates[i];
    assert.equal(actual.id, expected.id);
    const integer = /EqCalc(FreqToX|GainToY)|DrcCalcDbTo/.test(expected.id);
    const tolerance = integer ? 0 : expected.id.startsWith('Eq') ? 1e-10 * Math.max(1, Math.abs(expected.value)) : 2e-5;
    assert.ok(Number.isFinite(actual.value) && Math.abs(actual.value - expected.value) <= tolerance, `${expected.id}: actual=${actual.value}, expected=${expected.value}, tolerance=${tolerance}`);
  }
});

test(`${reference.draw.length} complete curves: values, errors, mutations and output bounds`, t => {
  let eqError = 0, drcError = 0, samples = 0, nonFinite = 0;
  assert.equal(candidate.draw.length, reference.draw.length);
  for (let i = 0; i < reference.draw.length; i++) {
    const expected = reference.draw[i], actual = candidate.draw[i];
    assert.equal(actual.id, expected.id);
    assert.equal(actual.ret, expected.ret, `${expected.id}: return code`);
    assert.equal(actual.paramsHex, expected.paramsHex, `${expected.id}: input parameters`);
    assert.equal(actual.uiHex, expected.uiHex, `${expected.id}: UI mutation`);
    assert.equal(actual.modifiedHex, expected.modifiedHex, `${expected.id}: modified DRC parameters`);
    assert.equal(actual.guardsIntact, true, `${expected.id}: output bounds`);
    assert.equal(actual.values.length, expected.values.length);
    for (let j = 0; j < expected.values.length; j++) {
      const a = actual.values[j], e = expected.values[j];
      samples++;
      if (typeof e === 'string') {
        nonFinite++;
        assert.equal(a, e, `${expected.id}[${j}]: non-finite classification`);
      }
      else {
        if (expected.id.startsWith('Eq')) eqError = Math.max(eqError, Math.abs(a - e));
        else drcError = Math.max(drcError, Math.abs(a - e));
        const tolerance = expected.id.startsWith('Eq') ? 1e-8 : 2e-5;
        assert.ok(typeof a === 'number' && Number.isFinite(a) && Math.abs(a - e) <= tolerance,
          `${expected.id}[${j}]: actual=${a}, expected=${e}, tolerance=${tolerance}`);
      }
    }
  }
  t.diagnostic(`${samples} samples; ${nonFinite} non-finite classifications; max errors: EQ=${eqError} dB, DRC=${drcError} dB`);
});

test('DrcDrawGet copies the modified structure and checks null arguments', () => {
  compareRecords(candidate.drawGet, reference.drawGet);
});
