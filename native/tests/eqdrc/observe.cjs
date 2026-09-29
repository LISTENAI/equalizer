const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const koffi = require('koffi');
const { SIZE, binCases, readCases, coordinateCases, coordinateSignatures, drawCases } = require('./cases.cjs');

function observe(libraryPath, includeDraw = false) {
  const lib = koffi.load(libraryPath);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsaudio-eqdrc-'));
  const file = path.join(dir, 'params.bin');
  try {
    const write = lib.func('int writeToBinFile(const char*, void*)');
    const read = lib.func('int readFromBinFile(const char*, void*)');
    const bin = binCases().map(({ id, data }) => {
      const input = Buffer.from(data);
      const writeRet = write(file, input);
      const fileHex = fs.readFileSync(file).toString('hex');
      const output = Buffer.alloc(SIZE, 0xcc);
      const readRet = read(file, output);
      return { id, writeRet, readRet, fileHex, outputHex: output.toString('hex'), inputUnchanged: input.equals(data) };
    });
    const reads = readCases().map(({ id, data }) => {
      fs.writeFileSync(file, data);
      const output = Buffer.alloc(SIZE, 0xa5);
      return { id, size: data.length, ret: read(file, output), outputHex: output.toString('hex') };
    });
    const buffer = Buffer.alloc(SIZE, 0xcc);
    const errors = {
      writeNullPath: write(null, buffer), writeNullTarget: write(file, null),
      writeBothNull: write(null, null), readNullPath: read(null, buffer),
      readNullTarget: read(file, null), readBothNull: read(null, null),
      readMissing: read(path.join(dir, 'missing.bin'), buffer),
      writeMissingParent: write(path.join(dir, 'missing', 'params.bin'), buffer),
      outputUnchanged: buffer.equals(Buffer.alloc(SIZE, 0xcc)),
    };
    const functions = Object.fromEntries(Object.entries(coordinateSignatures).map(([name, signature]) => [name, lib.func(signature)]));
    const coordinates = coordinateCases().map(({ id, name, ui, value }) => ({ id, value: name.startsWith('Eq') ? functions[name](value, ui) : functions[name](ui, value) }));
    const result = { bin, reads, errors, coordinates };
    if (includeDraw) {
      const eqDraw = lib.func('int EqDraw(void*, void*, void*)');
      const drcDraw = lib.func('int DrcDraw(void*, void*, void*, void*)');
      result.draw = drawCases().map(({ id, name, params: sourceParams, ui: sourceUi, count, initial = 0, nullparams, nullui, nulloutput }) => {
        const params = Buffer.from(sourceParams), ui = Buffer.from(sourceUi);
        const eq = name === 'EqDraw';
        const elementSize = eq ? 8 : 4;
        const storage = Buffer.alloc(count * elementSize + 32, 0xa5);
        const output = storage.subarray(16, storage.length - 16);
        for(let i=0;i<count;i++) eq ? output.writeDoubleLE(initial,i*8) : output.writeFloatLE(initial,i*4);
        const modifiedStorage = Buffer.alloc(144,0xa5);
        const modified = modifiedStorage.subarray(16,128);
        const input = nullparams ? null : params, info = nullui ? null : ui, target = nulloutput ? null : output;
        const ret = eq ? eqDraw(input, info, target) : drcDraw(input, info, target, modified);
        // Strings preserve non-finite observations instead of JSON's null.
        const values = Array.from({ length: count }, (_, i) => {
          const value = eq ? output.readDoubleLE(i * 8) : output.readFloatLE(i * 4);
          return Number.isFinite(value) ? value : String(value);
        });
        const guardsIntact = [storage.subarray(0,16),storage.subarray(-16),modifiedStorage.subarray(0,16),modifiedStorage.subarray(-16)].every(b=>b.every(v=>v===0xa5));
        if(!guardsIntact) throw new Error(`${id}: native output exceeded allocated bounds`);
        return { id, ret, values, paramsHex:params.toString('hex'),uiHex:ui.toString('hex'),guardsIntact, ...(eq ? {} : { modifiedHex: modified.toString('hex') }) };
      });
      const get = lib.func('int DrcDrawGet(void*, void*)');
      result.drawGet = ['copy', 'null-object', 'null-output', 'both-null'].map(id=>{
        const object = Buffer.from(Array.from({length:224},(_,i)=>(i*37+11)&255));
        const storage = Buffer.alloc(144,0xa5), output=storage.subarray(16,128);
        const ret = get(id==='null-object'||id==='both-null'?null:object,id==='null-output'||id==='both-null'?null:output);
        return {id,ret,outputHex:output.toString('hex'),objectHex:object.toString('hex'),guardsIntact:storage.subarray(0,16).every(v=>v===0xa5)&&storage.subarray(-16).every(v=>v===0xa5)};
      });
    }
    return result;
  } finally {
    lib.unload();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const [libraryPath, outputPath, mode] = process.argv.slice(2);
  const result = observe(libraryPath, mode === 'oracle' || mode === 'candidate');
  fs.writeFileSync(outputPath, JSON.stringify({
    schemaVersion: 1,
    caseHash: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'cases.cjs'), 'utf8').replace(/\r\n/g, '\n')).digest('hex'),
    observerHash: crypto.createHash('sha256').update(fs.readFileSync(__filename, 'utf8').replace(/\r\n/g, '\n')).digest('hex'),
    source: { filename: path.basename(libraryPath), sha256: crypto.createHash('sha256').update(fs.readFileSync(libraryPath)).digest('hex'), platform: process.platform, arch: process.arch },
    ...result,
  }, null, 2) + '\n');
}
module.exports = { observe };
