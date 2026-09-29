// Recreate mathematical lookup tables; no binary extraction or network access.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../modules/soundeffect/src');
fs.mkdirSync(dir, { recursive: true });
function table(type, name, values) {
  const lines = [];
  for (let i = 0; i < values.length; i += 8) lines.push('    ' + values.slice(i, i + 8).join(', ') + ',');
  return `static const ${type} ${name}[${values.length}] = {\n${lines.join('\n')}\n};\n`;
}
const log = Array.from({ length: 1024 }, (_, i) => (Math.round(Math.fround(Math.log(0.5 + i / 2048)) * 1e6) / 1e6).toFixed(6) + 'f');
const expFraction = Array.from({ length: 257 }, (_, i) => Math.round(65535 * Math.exp(-i / 256)));
const expInteger = Array.from({ length: 11 }, (_, i) => Math.round(65536 * Math.exp(i - 5)));
fs.writeFileSync(path.join(dir, 'tables.inc'), '/* Generated mathematical tables: node native/tools/generate-sound-tables.cjs. */\n' +
  table('float', 'log_fraction', log) + table('uint16_t', 'exp_fraction', expFraction) + table('uint32_t', 'exp_integer', expInteger));
