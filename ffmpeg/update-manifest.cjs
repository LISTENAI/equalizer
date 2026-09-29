// Explicit maintenance command. Review the resulting manifest before commit.
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const release = process.argv[2] || 'b6.1.1';
  const response = await fetch(`https://api.github.com/repos/eugeneware/ffmpeg-static/releases/tags/${release}`);
  if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);
  const data = await response.json();
  function asset(name) {
    const entry = data.assets.find(a => a.name === name);
    if (!entry?.digest?.startsWith('sha256:')) throw new Error(`Missing upstream SHA-256: ${name}`);
    return { url: entry.browser_download_url, sha256: entry.digest.slice(7), size: entry.size };
  }
  const targets = {};
  for (const target of ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64']) {
    targets[target] = {
      executable: target.startsWith('win32') ? 'ffmpeg.exe' : 'ffmpeg',
      archive: asset(`ffmpeg-${target}.gz`),
      binary: asset(`ffmpeg-${target}`),
      license: asset(`${target}.LICENSE`),
      readme: asset(`${target}.README`),
    };
  }
  await fs.writeFile(path.join(__dirname, 'manifest.json'), JSON.stringify({
    schemaVersion: 1, release, version: release.slice(1),
    source: 'https://github.com/eugeneware/ffmpeg-static', targets,
  }, null, 2) + '\n');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
