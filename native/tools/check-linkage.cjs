const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { libraryName } = require('../resources.cjs');
const root = path.resolve('native/build');
for (const name of ['eqdrc', 'eqdraw', 'soundeffect']) {
  const file = path.join(root, 'lib', libraryName(name));
  let output;
  if (process.platform === 'darwin') {
    output = execFileSync('otool', ['-L', file], { encoding: 'utf8' }).split('\n').slice(1).join('\n');
    const commands = execFileSync('otool', ['-l', file], { encoding: 'utf8' });
    if (!commands.includes('@loader_path')) throw new Error(`Missing loader-relative RPATH: ${file}`);
  } else if (process.platform === 'linux') {
    output = execFileSync('readelf', ['-d', file], { encoding: 'utf8' });
    if (!output.includes('$ORIGIN')) throw new Error(`Missing origin-relative RPATH: ${file}`);
  } else {
    const info = fs.readdirSync(path.join(root, 'CMakeFiles'), { recursive: true }).find(f => f.endsWith('CMakeCCompiler.cmake'));
    const contents = fs.readFileSync(path.join(root, 'CMakeFiles', info), 'utf8');
    const compiler = contents.match(/set\(CMAKE_C_COMPILER "([^"]+)"\)/)?.[1];
    output = execFileSync(path.join(path.dirname(compiler), 'dumpbin.exe'), ['/DEPENDENTS', file], { encoding: 'utf8' });
    if (/\b(?:VCRUNTIME|MSVCP|MSVCR)\d.*\.dll/i.test(output)) throw new Error(`Dynamic MSVC runtime dependency: ${file}`);
  }
  if (process.platform !== 'win32' && output.replaceAll('\\', '/').includes(root.replaceAll('\\', '/'))) throw new Error(`Build-machine absolute library dependency: ${file}`);
}
console.log('Native linkage: relative sibling loading and static MSVC runtime verified.');
