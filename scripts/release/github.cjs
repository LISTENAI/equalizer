const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { verify, notes } = require('./version.cjs');
const { hash, names, targets } = require('./artifacts.cjs');
const repository = process.env.GITHUB_REPOSITORY || 'LISTENAI/equalizer';
function gh(...args) { return execFileSync('gh', args, { encoding: 'utf8' }).trim(); }
function api(route) { return JSON.parse(gh('api', `repos/${repository}/${route}`)); }
function release(tag) {
  const result = spawnSync('gh', ['api', `repos/${repository}/releases/tags/${tag}`], { encoding: 'utf8' });
  if (result.status === 0) return JSON.parse(result.stdout);
  if (/HTTP 404/.test(result.stderr)) return null;
  throw new Error(result.stderr);
}
function assertDraft(existing, sha) {
  if (existing && (!existing.draft || existing.target_commitish !== sha)) throw new Error('Only a draft of the same commit may be updated');
}
function assets(directory, version, sha) {
  const expected = [...targets.flatMap(t => names(version, t)), 'build-manifest.json', 'SHA256SUMS.txt'].sort();
  if (JSON.stringify(fs.readdirSync(directory).sort()) !== JSON.stringify(expected)) throw new Error('Release must contain exactly five installers, checksums and build manifest');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'build-manifest.json')));
  if (manifest.version !== version || manifest.commit !== sha || manifest.targets?.length !== 4) throw new Error('Release manifest mismatch');
  if (JSON.stringify(manifest.targets.map(m => m.target).sort()) !== JSON.stringify([...targets].sort())) throw new Error('Duplicate or missing build target');
  for (const record of manifest.targets) {
    if (record.version !== version || record.commit !== sha || record.runId !== manifest.runId || JSON.stringify(record.files.map(f => f.name).sort()) !== JSON.stringify(names(version, record.target).sort())) throw new Error('Target manifest mismatch');
    for (const file of record.files) if (hash(path.join(directory, file.name)) !== file.sha256 || fs.statSync(path.join(directory, file.name)).size !== file.bytes) throw new Error('Target artifact mismatch');
  }
  const checksums = fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
  if (checksums.length !== 6) throw new Error('Incomplete checksums');
  const checked = new Set();
  for (const line of checksums) {
    const [digest, name] = line.split('  ');
    if (!expected.includes(name) || name === 'SHA256SUMS.txt' || checked.has(name) || hash(path.join(directory, name)) !== digest) throw new Error('Invalid release checksum');
    checked.add(name);
  }
  return expected;
}
function draft(tag, directory) {
  if (!JSON.parse(gh('api', `repos/${repository}`)).private) throw new Error('This release workflow requires a private repository');
  const version = verify({ tag, master: 'refs/remotes/origin/master' });
  const sha = gh('api', `repos/${repository}/git/ref/tags/${tag}`, '--jq', '.object.sha');
  const files = assets(directory, version, sha);
  const previous = release(tag); assertDraft(previous, sha);
  const notesFile = path.join(directory, '..', 'release-notes.md');
  fs.writeFileSync(notesFile, notes(version) + '\n\n签名状态：Windows/Linux 未签名；macOS 仅 ad-hoc 签名，未公证。无客户端在线更新。\n');
  if (!previous) gh('release', 'create', tag, '-R', repository, '--verify-tag', '--target', sha, '--draft', '--title', `LSAudio ${version}`, '--notes-file', notesFile, '--latest=false', ...(version.includes('-beta.') ? ['--prerelease'] : []));
  gh('release', 'upload', tag, '-R', repository, ...files.map(f => path.join(directory, f)), '--clobber');
  console.log(`Draft ${tag} assembled; acceptance is required before publication.`);
}
const acceptanceItems = ['windows-install-upgrade-uninstall', 'macos-x64-dmg', 'macos-arm64-dmg', 'linux-appimage-deb', 'actual-playback', 'device-parameter-read-write', 'device-audio-send', 'installation-prompts-known-issues'];
function checkAcceptance(report, tag, sha, digest) {
  if (report.tag !== tag || report.commit !== sha || report.manifestSha256 !== digest) throw new Error('Acceptance does not match these exact artifacts');
  for (const key of acceptanceItems) {
    const item = report.checks?.[key];
    if (item?.status !== 'passed' || !item.evidence?.trim() || !item.tester?.trim() || !Number.isFinite(Date.parse(item.date))) throw new Error(`Acceptance pending: ${key}`);
  }
}
function publish(tag, directory, evidence) {
  const existing = release(tag);
  if (!existing?.draft) throw new Error('A draft is required; published releases are immutable');
  const sha = gh('api', `repos/${repository}/git/ref/tags/${tag}`, '--jq', '.object.sha');
  assertDraft(existing, sha);
  const version = tag.slice(1);
  const expected = assets(directory, version, sha);
  if (JSON.stringify(existing.assets.map(a => a.name).sort()) !== JSON.stringify(expected)) throw new Error('Remote draft attachments differ');
  // Downloaded assets are the publication input, not a fresh local rebuild.
  checkAcceptance(JSON.parse(fs.readFileSync(evidence)), tag, sha, hash(path.join(directory, 'build-manifest.json')));
  gh('release', 'edit', tag, '-R', repository, '--draft=false', `--prerelease=${version.includes('-beta.')}`, `--latest=${!version.includes('-beta.')}`);
}
function tag(version) {
  if (verify() !== version) throw new Error('Version mismatch');
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Tag creation requires a clean checkout');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const previous = JSON.parse(execFileSync('git', ['show', `${sha}^1:package.json`], { encoding: 'utf8' })).version;
  if (!require('semver').gt(version, previous)) throw new Error('Release commit must increase the product version');
  execFileSync('git', ['fetch', 'github', 'master'], { stdio: 'inherit' });
  execFileSync('git', ['merge-base', '--is-ancestor', sha, 'refs/remotes/github/master'], { stdio: 'inherit' });
  const checks = api(`commits/${sha}/check-runs?per_page=100`).check_runs;
  for (const name of ['client (windows-latest, win32-x64)', 'client (macos-15-intel, darwin-x64)', 'client (macos-15, darwin-arm64)', 'client (ubuntu-24.04, linux-x64)']) {
    if (!checks.some(c => c.name === name && c.status === 'completed' && c.conclusion === 'success' && c.app.slug === 'github-actions')) throw new Error(`Required check missing: ${name}`);
  }
  const prs = api(`commits/${sha}/pulls`);
  let approved = false;
  for (const pr of prs.filter(p => p.merged_at && p.base.ref === 'master' && p.merge_commit_sha === sha)) {
    const files = api(`pulls/${pr.number}/files?per_page=100`);
    const reviews = api(`pulls/${pr.number}/reviews?per_page=100`);
    const latest = new Map(); for (const review of reviews) if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) latest.set(review.user.login, review.state === 'APPROVED' && review.commit_id !== pr.head.sha ? 'STALE' : review.state);
    if (files.some(f => f.filename === 'CHANGELOG.md') && files.some(f => f.filename === 'package.json') && [...latest.values()].includes('APPROVED') && ![...latest.values()].includes('CHANGES_REQUESTED')) approved = true;
  }
  if (!approved) throw new Error('A reviewed and merged version PR is required');
  const tagName = `v${version}`;
  // GitHub CLI credentials (not the workflow GITHUB_TOKEN) make this push
  // trigger the tag workflow. Never move an existing tag.
  if (execFileSync('git', ['ls-remote', '--tags', 'github', `refs/tags/${tagName}`], { encoding: 'utf8' }).trim()) throw new Error('Tag already exists');
  execFileSync('git', ['tag', tagName, sha], { stdio: 'inherit' });
  execFileSync('git', ['push', 'github', `refs/tags/${tagName}`], { stdio: 'inherit' });
}
if (require.main === module) {
  const [command, value, directory, evidence] = process.argv.slice(2);
  if (command === 'draft') draft(value, directory);
  else if (command === 'publish') publish(value, directory, evidence);
  else if (command === 'tag') tag(value);
  else throw new Error('Usage: github.cjs draft <tag> <assets> | publish <tag> <downloaded-assets> <acceptance.json> | tag <version>');
}
module.exports = { assertDraft, assets, checkAcceptance, acceptanceItems };
