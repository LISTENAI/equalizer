const test = require('node:test');
const assert = require('node:assert/strict');
const reference = require('./fixtures/reference.json');
const candidate = require('../../artifacts/eqdraw/candidate.json');
const { provenance } = require('./observe.cjs');

test('wrapper fixture provenance and null release', () => {
  assert.equal(reference.schemaVersion, 1);
  assert.equal(reference.source.filename, 'eqdrawDLL.dll');
  for (const [key, value] of Object.entries(provenance())) {
    assert.equal(reference[key], value, `${key}: explicitly recapture the original wrapper after input/observer edits`);
    assert.equal(candidate[key], value);
  }
  assert.equal(candidate.nullFreeAccepted, true);
});

test(`${reference.cases.length} wrapper cases: counts, points, modified dots, errors and ABI`, t => {
  assert.equal(candidate.cases.length, reference.cases.length);
  let points = 0, nonFinite = 0, maxX = 0, maxY = 0;
  for (let i = 0; i < reference.cases.length; i++) {
    const a = candidate.cases[i], e = reference.cases[i];
    for (const key of ['id', 'ret', 'arr_size', 'dot_size', 'inputHex', 'uiHex', 'fs']) assert.equal(a[key], e[key], `${e.id}.${key}`);
    assert.deepEqual(a.dots, e.dots, `${e.id}.dots`);
    if (process.platform === 'win32' && process.arch === 'x64' && e.id.startsWith('Drc')) assert.equal(a.pointerAbiMatches, true, e.id);
    assert.equal(a.points.length, e.points.length);
    for (let j = 0; j < e.points.length; j++) {
      points++;
      for (let axis = 0; axis < 2; axis++) {
        const actual = a.points[j][axis], expected = e.points[j][axis];
        if (typeof expected === 'string') { nonFinite++; assert.equal(actual, expected, `${e.id}[${j}][${axis}]`); continue; }
        const tolerance = e.id.startsWith('Eq') ? (axis === 0 ? 1e-10 * Math.max(1, Math.abs(expected)) : 1e-8) : 2e-5;
        const error = Math.abs(actual - expected);
        assert.ok(typeof actual === 'number' && Number.isFinite(actual) && error <= tolerance, `${e.id}[${j}][${axis}]: ${actual} vs ${expected}`);
        if (axis === 0) maxX = Math.max(maxX, error); else maxY = Math.max(maxY, error);
      }
    }
  }
  t.diagnostic(`${points} points; ${nonFinite} non-finite values; max coordinate errors: X=${maxX}, Y=${maxY}`);
});
