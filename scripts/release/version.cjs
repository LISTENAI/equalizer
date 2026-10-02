const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const semver = require('semver');
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
function valid(version) { if (!pattern.test(version)) throw new Error('Version must be X.Y.Z or X.Y.Z-beta.N'); return version; }
function notes(version, text = fs.readFileSync('CHANGELOG.md', 'utf8')) {
  text = text.replace(/\r\n/g, '\n');
  const section = text.split(`## ${version}\n`)[1]?.split('\n## ')[0];
  if (!section || /待填写|TODO/.test(section)) throw new Error('Missing or unfinished release notes');
  for (const heading of ['功能变化', '修复', '兼容性', '已知问题', '平台状态']) if (!section.includes(`### ${heading}`)) throw new Error(`Missing changelog section: ${heading}`);
  return section.trim();
}
function verify({ tag, master = 'refs/remotes/github/master' } = {}) {
  const pkg = JSON.parse(fs.readFileSync('package.json'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json'));
  valid(pkg.version);
  if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('Lockfile version mismatch');
  notes(pkg.version);
  if (tag) {
    if (tag !== `v${pkg.version}`) throw new Error('Tag version mismatch');
    const sha = git('rev-parse', `${tag}^{commit}`);
    if (sha !== git('rev-parse', 'HEAD')) throw new Error('Tag does not point to checked-out commit');
    git('merge-base', '--is-ancestor', sha, master);
    const previous = JSON.parse(git('show', `${sha}^1:package.json`)).version;
    if (!semver.gt(pkg.version, previous)) throw new Error('Release commit must increase the product version');
  }
  return pkg.version;
}
function prepare(version) {
  valid(version);
  if (git('status', '--porcelain')) throw new Error('Prepare requires a clean checkout');
  const pkg = JSON.parse(fs.readFileSync('package.json'));
  if (!semver.gt(version, pkg.version)) throw new Error('Version must increase');
  if (git('tag', '--list', `v${version}`)) throw new Error('Version tag already exists');
  const lock = JSON.parse(fs.readFileSync('package-lock.json'));
  const old = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8').replace(/\r\n/g, '\n') : '# 更新日志\n';
  if (old.includes(`## ${version}\n`)) throw new Error('Changelog version already exists');
  pkg.version = lock.version = lock.packages[''].version = version;
  const entry = `## ${version}\n\n${['功能变化', '修复', '兼容性', '已知问题', '平台状态'].map(h => `### ${h}\n\n- 待填写`).join('\n\n')}\n\n`;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  fs.writeFileSync('CHANGELOG.md', '# 更新日志\n\n' + entry + old.replace(/^# 更新日志\s*/, ''));
  console.log(`Prepared ${version}; complete CHANGELOG.md and open a version PR. No tag was created.`);
}
if (require.main === module) {
  try {
    const [command, version] = process.argv.slice(2);
    if (command === 'prepare') prepare(version);
    else if (command === 'verify') console.log(`Verified ${verify({ tag: process.env.RELEASE_TAG, master: process.env.RELEASE_MASTER })}`);
    else throw new Error('Usage: version.cjs prepare <version> | verify');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { valid, notes, verify, prepare };
