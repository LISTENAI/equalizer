const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { valid } = require('./version.cjs');
const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', process.env.BEFORE_SHA, 'HEAD', '--', 'releases/acceptance'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const file of files) {
  const report = JSON.parse(fs.readFileSync(file));
  valid(report.tag?.slice(1));
  if (file !== `releases/acceptance/${report.tag}.json`) throw new Error('Acceptance file/tag mismatch');
  const directory = path.resolve('downloaded', report.tag); fs.mkdirSync(directory, { recursive: true });
  execFileSync('gh', ['release', 'download', report.tag, '-R', process.env.GITHUB_REPOSITORY, '--dir', directory], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/release/github.cjs', 'publish', report.tag, directory, file], { stdio: 'inherit' });
}
