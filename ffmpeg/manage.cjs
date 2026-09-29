const { getTarget, cacheDirectory, prepare, verifyDirectory } = require('./assets.cjs');
async function main() {
  const [command = 'prepare', ...args] = process.argv.slice(2);
  const options = {};
  let all = false, platform = process.platform, arch = process.arch;
  for (let i = 0; i < args.length; ++i) {
    const name = args[i];
    if (name === '--all') all = true;
    else if (name === '--offline') options.offline = true;
    else if (['--platform', '--arch', '--import', '--cache-root'].includes(name)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
      if (name === '--platform') platform = value;
      if (name === '--arch') arch = value;
      if (name === '--import') options.importDirectory = value;
      if (name === '--cache-root') options.cacheRoot = value;
    } else throw new Error(`Unknown option: ${name}`);
  }
  if (!['prepare', 'verify'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const targets = all ? Object.keys(require('./manifest.json').targets) : [getTarget(platform, arch)];
  for (const target of targets) {
    const result = command === 'prepare' ? await prepare({ ...options, target }) : await verifyDirectory(cacheDirectory(target, options.cacheRoot), target);
    console.log(JSON.stringify({ event: `ffmpeg-${command}`, ...result }));
  }
}
main().catch(error => { console.error(JSON.stringify({ event: 'ffmpeg-resource-failed', message: error.message })); process.exitCode = 1; });
