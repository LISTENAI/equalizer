const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { valid, notes } = require('../../scripts/release/version.cjs');
const { aggregate, hash, names, targets } = require('../../scripts/release/artifacts.cjs');
const { assets, assertDraft, checkAcceptance, acceptanceItems } = require('../../scripts/release/github.cjs');
test('only canonical stable and beta versions are accepted', () => {
  for (const v of ['1.2.0', '1.2.0-beta.1']) assert.equal(valid(v), v);
  for (const v of ['v1.2.0', '01.2.0', '1.2', '1.2.0-beta.0', '1.2.0-rc.1', '1.2.0+dirty']) assert.throws(() => valid(v));
  assert.throws(() => notes('1.2.0', '## 1.2.0\nTODO'));
});
test('all four exact-commit builds and all five nonempty installers are required', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsaudio-release-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'input'), output = path.join(root, 'output'); fs.mkdirSync(input);
  const version = '1.2.0-beta.1', commit = 'a'.repeat(40), runId = '12';
  const records = targets.map(target => {
    const files = names(version, target).map(name => { const file = path.join(input, name); fs.writeFileSync(file, `fixture:${target}`); return { name, sha256: hash(file), bytes: fs.statSync(file).size }; });
    return { schemaVersion: 1, target, version, commit, runId, files };
  });
  const save = () => records.forEach(m => fs.writeFileSync(path.join(input, `manifest-${m.target}.json`), JSON.stringify(m))); save();
  aggregate(input, output, version, commit, runId); assert.equal(assets(output, version, commit).length, 7);
  records[0].commit = 'b'.repeat(40); save(); assert.throws(() => aggregate(input, output, version, commit, runId), /provenance/);
  records[0].commit = commit; save();
  fs.appendFileSync(path.join(input, records[0].files[0].name), 'corrupt'); assert.throws(() => aggregate(input, output, version, commit, runId), /checksum/);
  fs.unlinkSync(path.join(input, 'manifest-darwin-arm64.json')); assert.throws(() => aggregate(input, output, version, commit, runId));
  fs.writeFileSync(path.join(output, 'unexpected.exe'), 'extra'); assert.throws(() => assets(output, version, commit), /exactly/);
});
test('published releases and drafts for another commit are immutable', () => {
  assert.doesNotThrow(() => assertDraft({ draft: true, target_commitish: 'a' }, 'a'));
  assert.throws(() => assertDraft({ draft: false, target_commitish: 'a' }, 'a'));
  assert.throws(() => assertDraft({ draft: true, target_commitish: 'b' }, 'a'));
});
test('acceptance must refer to exact manifest and every real hardware result', () => {
  const report = { tag: 'v1.2.0-beta.1', commit: 'sha', manifestSha256: 'hash', checks: Object.fromEntries(acceptanceItems.map(k => [k, { status: 'passed', evidence: 'test log', tester: 'tester', date: '2026-09-29' }])) };
  assert.doesNotThrow(() => checkAcceptance(report, report.tag, 'sha', 'hash'));
  assert.throws(() => checkAcceptance(report, report.tag, 'sha', 'other'));
  report.checks['device-audio-send'].status = 'pending'; assert.throws(() => checkAcceptance(report, report.tag, 'sha', 'hash'), /device-audio-send/);
});
