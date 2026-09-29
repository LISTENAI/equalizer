// Explicit maintenance command. Review the resulting manifest before commit.
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const release = process.argv[2] || 'b6.1.1';
  const output = path.join(__dirname, 'manifest.json');
  let previous;
  try { previous = JSON.parse(await fs.readFile(output, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const versions = process.argv[3] ? JSON.parse(await fs.readFile(process.argv[3], 'utf8')) : {};
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
    const binary = asset(`ffmpeg-${target}`);
    const unchanged = previous?.release === release && previous.targets?.[target]?.binary?.sha256 === binary.sha256;
    const version = versions[target] ?? (unchanged ? previous.targets[target].version : undefined);
    // Release tags are distribution bundles, not a promise of one FFmpeg
    // version. Only reuse runtime-verified versions for identical bytes.
    if (typeof version !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(version)) {
      throw new Error(`Provide a verified runtime version for ${target} in the versions JSON argument`);
    }
    targets[target] = {
      version,
      executable: target.startsWith('win32') ? 'ffmpeg.exe' : 'ffmpeg',
      archive: asset(`ffmpeg-${target}.gz`),
      binary,
      license: asset(`${target}.LICENSE`),
      readme: asset(`${target}.README`),
    };
  }
  await fs.writeFile(output, JSON.stringify({
    schemaVersion: 2, release,
    source: 'https://github.com/eugeneware/ffmpeg-static', targets,
  }, null, 2) + '\n');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
