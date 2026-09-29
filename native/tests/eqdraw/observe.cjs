const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const koffi = require('koffi');
const { wrapperCases } = require('./cases.cjs');

function textHash(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
}
function binaryHash(filename) { return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'); }
function provenance() {
  return {
    caseHash: textHash(path.join(__dirname, 'cases.cjs')),
    coreCaseHash: textHash(path.join(__dirname, '../eqdrc/cases.cjs')),
    observerHash: textHash(__filename),
  };
}
function number(value) { return Number.isFinite(value) ? value : String(value); }

function observe(libraryPath, mode) {
  const lib = koffi.load(libraryPath);
  const dot = koffi.struct('WrapperDrcDot', { X: 'float', Y: 'float', W: 'float' });
  const paramsType = koffi.struct('WrapperDrcParams', {
    iEnable: 'int32_t', Fs: 'float', At: 'float', Rt: 'float', Type: 'int32_t',
    RmsTime: 'float', SegNum: 'int32_t', Dot: koffi.array(dot, 7),
  });
  const eqDraw = lib.func('void* eqDrawPoints(void*, void*)');
  const drcDraw = lib.func('void* drcDrawPoints(WrapperDrcParams, void*)');
  const pointerDrc = process.platform === 'win32' && process.arch === 'x64' ? lib.func('void* drcDrawPoints(void*, void*)') : null;
  const freeEq = lib.func('void freePoints(void*)');
  const freeDrc = lib.func('void freeDrcPoints(void*)');
  function unpack(pointer, eq) {
    if (!pointer) throw new Error('Native wrapper returned NULL');
    const ret = koffi.decode(pointer, 'int32_t');
    const count = koffi.decode(pointer, 4, 'int32_t');
    const dotCount = eq ? undefined : koffi.decode(pointer, 8, 'int32_t');
    if (count < 0 || count > (eq ? 1024 : 315) || (!eq && (dotCount < 0 || dotCount > 7))) throw new Error('Native wrapper returned out-of-range counts');
    const output = { ret, arr_size: count, ...(eq ? {} : { dot_size: dotCount }), points: [] };
    // The vendor leaves unused capacity, padding and failure fs/dots
    // uninitialized. Never read or serialize those unspecified bytes.
    if (count) {
      const values = koffi.decode(pointer, eq ? 8 : 16, koffi.array('double', count * 2));
      for (let i = 0; i < count; i++) output.points.push([number(values[i * 2]), number(values[i * 2 + 1])]);
    }
    if (!eq && ret >= 0) {
      output.fs = number(koffi.decode(pointer, 5056, 'float'));
      output.dots = dotCount ? koffi.decode(pointer, 5060, koffi.array(dot, dotCount)).map(d => [number(d.X), number(d.Y), number(d.W)]) : [];
    }
    return output;
  }
  try {
    const cases = wrapperCases().map(c => {
      const eq = c.name === 'EqDraw';
      const params = Buffer.from(c.params), ui = Buffer.from(c.ui);
      const input = c.nullparams ? null : params;
      let pointer = eq ? eqDraw(input, ui) : drcDraw(koffi.decode(params, paramsType), ui);
      let output;
      try { output = unpack(pointer, eq); } finally { if (pointer) (eq ? freeEq : freeDrc)(pointer); }
      let pointerAbiMatches;
      if (!eq && pointerDrc) {
        const pointerInput = Buffer.from(c.params), pointerUi = Buffer.from(c.ui);
        pointer = pointerDrc(pointerInput, pointerUi);
        try {
          pointerAbiMatches = JSON.stringify(unpack(pointer, false)) === JSON.stringify(output) && pointerInput.equals(params) && pointerUi.equals(ui);
          if (!pointerAbiMatches) throw new Error(`${c.id}: Windows x64 pointer and by-value ABI disagree`);
        } finally { if (pointer) freeDrc(pointer); }
      }
      return { id: c.id, ...output, inputHex: params.toString('hex'), uiHex: ui.toString('hex'), ...(pointerAbiMatches === undefined ? {} : { pointerAbiMatches }) };
    });
    freeEq(null); freeDrc(null);
    const coreName = mode === 'oracle' ? 'iflytekEqDrcDrawApi.dll' : process.platform === 'win32' ? 'lsaudio_eqdrc.dll' : process.platform === 'darwin' ? 'liblsaudio_eqdrc.dylib' : 'liblsaudio_eqdrc.so';
    return {
      schemaVersion: 1, ...provenance(),
      source: { filename: path.basename(libraryPath), sha256: binaryHash(libraryPath), coreSha256: binaryHash(path.join(path.dirname(libraryPath), coreName)), platform: process.platform, arch: process.arch },
      nullFreeAccepted: true, cases,
    };
  } finally { lib.unload(); }
}
if (require.main === module) {
  const [library, output, mode] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(observe(path.resolve(library), mode), null, 2) + '\n');
}
module.exports = { provenance };
