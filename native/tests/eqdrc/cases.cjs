// Inputs are independent of both implementations. Change IDs/version when
// changing their meaning so old oracle observations cannot silently pass.
const SIZE = 360;
const fields = [];
function field(name, offset, type, value) { fields.push({ name, offset, type, value }); }
for (const [name, base] of [['bass', 0], ['treble', 16]]) {
  field(`${name}.enable`, base, 'i32', 1);
  field(`${name}.fs`, base + 4, 'f32', 16000);
  field(`${name}.gain`, base + 8, 'f32', -6.25);
  field(`${name}.freq`, base + 12, 'f32', 1234.5);
}
field('eq.enable', 32, 'u8', 1);
for (let i = 0; i < 10; i++) {
  const base = 36 + i * 20;
  field(`eq.${i}.enable`, base, 'u8', 1);
  field(`eq.${i}.type`, base + 1, 'u8', 4);
  for (const [name, offset, value] of [['fs', 4, 16000], ['q', 8, 1.25], ['gain', 12, -7.5], ['freq', 16, 2345]]) {
    field(`eq.${i}.${name}`, base + offset, 'f32', value);
  }
}
for (const [name, offset, type, value] of [
  ['enable', 0, 'i32', 1], ['fs', 4, 'f32', 16000], ['attack', 8, 'f32', 0.03125],
  ['release', 12, 'f32', 0.5], ['type', 16, 'i32', 1], ['rms', 20, 'f32', 0.0625], ['segments', 24, 'i32', 3],
]) field(`drc.${name}`, 236 + offset, type, value);
for (let i = 0; i < 7; i++) {
  for (const [name, offset, value] of [['x', 0, -70 + i * 10], ['y', 4, -60 + i * 8], ['w', 8, 2.5]]) {
    field(`drc.dot.${i}.${name}`, 264 + i * 12 + offset, 'f32', value);
  }
}
field('gain.enable', 348, 'i32', 1);
field('gain.fs', 352, 'f32', 16000);
field('gain.volume', 356, 'f32', -13.75);

function baseline() {
  const bytes = Buffer.alloc(SIZE);
  for (const o of [4, 20, 240, 352]) bytes.writeFloatLE(48000, o);
  bytes.writeFloatLE(120, 12); bytes.writeFloatLE(6000, 28);
  for (let i = 0; i < 10; i++) {
    const base = 36 + i * 20;
    bytes[base + 1] = 2;
    bytes.writeFloatLE(48000, base + 4);
    bytes.writeFloatLE(0.707, base + 8);
    bytes.writeFloatLE(1000, base + 16);
  }
  bytes.writeFloatLE(0.01, 244); bytes.writeFloatLE(0.1, 248);
  bytes.writeFloatLE(0.02, 256); bytes.writeInt32LE(1, 260);
  bytes.writeFloatLE(-100, 264); bytes.writeFloatLE(-100, 268);
  return bytes;
}

function binCases() {
  const cases = [{ id: 'default', data: baseline() }];
  for (const f of fields) {
    const data = baseline();
    if (f.type === 'u8') data[f.offset] = f.value;
    else if (f.type === 'i32') data.writeInt32LE(f.value, f.offset);
    else data.writeFloatLE(f.value, f.offset);
    cases.push({ id: `field:${f.name}`, data });
  }
  const reserved = [33, 34, 35];
  for (let i = 0; i < 10; i++) reserved.push(38 + i * 20, 39 + i * 20);
  for (const offset of reserved) {
    const data = baseline(); data[offset] = 0xa5;
    cases.push({ id: `reserved:${offset}`, data });
  }
  for (const fill of [0, 0x55, 0xaa, 0xff]) cases.push({ id: `fill:${fill}`, data: Buffer.alloc(SIZE, fill) });
  let seed = 0x6a09e667;
  for (let n = 0; n < 8; n++) {
    const data = Buffer.alloc(SIZE);
    for (let i = 0; i < SIZE; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed >>> 24;
    }
    cases.push({ id: `bits:${n}`, data });
  }
  return cases;
}

function eqUi(values) {
  const data = Buffer.alloc(40);
  values.slice(0, 4).forEach((x, i) => data.writeDoubleLE(x, i * 8));
  data.writeInt32LE(values[4], 32); data.writeInt32LE(values[5], 36);
  return data;
}
function drcUi(values) {
  const data = Buffer.alloc(24);
  data.writeInt32LE(values[0], 0); data.writeInt32LE(values[1], 4);
  values.slice(2).forEach((x, i) => data.writeFloatLE(x, 8 + i * 4));
  return data;
}
const coordinateSignatures = {
  EqCalcXToFreq: 'double EqCalcXToFreq(int, void*)',
  EqCalcYToGain: 'double EqCalcYToGain(int, void*)',
  EqCalcFreqToX: 'int EqCalcFreqToX(double, void*)',
  EqCalcGainToY: 'int EqCalcGainToY(double, void*)',
  DrcCalcXToDb: 'float DrcCalcXToDb(void*, int)',
  DrcCalcYToDb: 'float DrcCalcYToDb(void*, int)',
  DrcCalcDbToX: 'int DrcCalcDbToX(void*, float)',
  DrcCalcDbToY: 'int DrcCalcDbToY(void*, float)',
};
function coordinateCases() {
  const cases = [];
  const pixels = n => [-2, -1, 0, 1, 2, Math.floor(n / 2), n - 2, n - 1, n, n + 1];
  const ratios = [-0.15, -0.05, 0, 0.001, 0.05, 0.125, 0.45, 0.5, 0.55, 0.95, 0.999, 1, 1.05, 1.15];
  const add = (name, ui, values, config) => values.forEach((value, i) => cases.push({ id: `${name}:${config}:${i}`, name, ui, value }));
  [[20, 20000, -30, 30, 11, 7], [20, 24000, -12, 12, 840, 315], [37, 7351, -19.5, 17.25, 127, 203], [20, 20000, -30, 30, 2, 2]].forEach((v, config) => {
    const ui = eqUi(v);
    add('EqCalcXToFreq', ui, pixels(v[4]), config);
    add('EqCalcYToGain', ui, pixels(v[5]), config);
    add('EqCalcFreqToX', ui, ratios.map(r => v[0] * (v[1] / v[0]) ** r), config);
    add('EqCalcGainToY', ui, ratios.map(r => v[2] + (v[3] - v[2]) * r), config);
  });
  [[11, 7, -100, 0, -100, 0], [315, 315, -100, 0, -100, 0], [128, 203, -90, -5, -80, -2], [10, 10, -100, 0, -100, 0]].forEach((v, config) => {
    const ui = drcUi(v);
    add('DrcCalcXToDb', ui, pixels(v[0]), config);
    add('DrcCalcYToDb', ui, pixels(v[1]), config);
    add('DrcCalcDbToX', ui, ratios.map(r => v[2] + (v[3] - v[2]) * r), config);
    add('DrcCalcDbToY', ui, ratios.map(r => v[4] + (v[5] - v[4]) * r), config);
  });
  return cases;
}

function drawCases() {
  const cases = [];
  for (const fs of [16000, 48000]) {
    for (const type of [0, 1, 2, 3, 4, 5]) {
      const params = baseline().subarray(32, 236);
      params[0] = 1; params[4] = 1; params[5] = type;
      for (let i = 0; i < 10; i++) params.writeFloatLE(fs, 8 + 20 * i);
      params.writeFloatLE(6, 16);
      cases.push({ id: `EqDraw:${fs}:type${type}`, name: 'EqDraw', params, ui: eqUi([20, fs === 16000 ? 7800 : 20000, -30, 30, 33, 61]), count: 33 });
    }
  }
  for (const width of [0, 6, 20]) {
    const params = baseline().subarray(236, 348);
    params.writeInt32LE(1, 0); params.writeInt32LE(2, 24);
    [[-100, -100, 0], [-30, -30, width], [0, -15, 0]].forEach((dot, i) => dot.forEach((v, j) => params.writeFloatLE(v, 28 + i * 12 + j * 4)));
    cases.push({ id: `DrcDraw:knee${width}`, name: 'DrcDraw', params, ui: drcUi([33, 61, -100, 0, -100, 0]), count: 33 });
  }
  // Parameter grid plus deterministic combinations; inputs never depend on
  // the candidate C implementation or its computed coefficients.
  const eq = (id, change = () => {}, uiChange = () => {}, count = 65) => {
    const params = baseline().subarray(32, 236);
    params[0] = params[4] = 1;
    const ui = eqUi([20, 20000, -30, 30, count, 61]);
    change(params); uiChange(ui);
    const item = { id: `EqDraw:${id}`, name: 'EqDraw', params, ui, count };
    cases.push(item); return item;
  };
  for (const rate of [16000, 48000]) for (let type = 0; type < 5; type++) {
    for (const frequency of [20, 1000, rate === 16000 ? 7999 : 20000]) {
      for (const q of [0.3, 0.707, 30]) for (const gain of [-30, 0, 30]) {
        eq(`grid:${rate}:${type}:${frequency}:${q}:${gain}`, p => {
          for (let i = 0; i < 10; i++) p.writeFloatLE(rate, 8 + i * 20);
          p[5] = type; p.writeFloatLE(q, 12); p.writeFloatLE(gain, 16); p.writeFloatLE(frequency, 20);
        }, ui => ui.writeDoubleLE(rate === 16000 ? 8000 : 24000, 8));
      }
    }
  }
  for (const rate of [16000, 48000]) for (const type of [0, 1, 2, 3, 4]) {
    eq(`nyquist:${rate}:${type}`, p => {
      for (let i = 0; i < 10; i++) p.writeFloatLE(rate, 8 + i * 20);
      p[5] = type; p.writeFloatLE(rate / 2, 20);
    });
  }
  let seed = 0x12345678;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let n = 0; n < 24; n++) eq(`cascade:${n}`, p => {
    for (let i = 0; i < 10; i++) {
      const o = 4 + i * 20;
      p[o] = n % 3 === 0 ? 1 : Number(random() > 0.3);
      p[o + 1] = Math.floor(random() * 5);
      p.writeFloatLE(0.3 + random() * 8, o + 8);
      p.writeFloatLE(-15 + random() * 30, o + 12);
      p.writeFloatLE(100 + random() * 12000, o + 16);
    }
  }, () => {}, n % 2 === 0 ? 129 : 33);
  eq('disabled', p => { p[0] = 0; }).initial = 2.5;
  eq('no-active-filters', p => { p[4] = 0; }).initial = 2.5;
  eq('accumulates', p => p.writeFloatLE(6, 16)).initial = 2.5;
  eq('zero-start', () => {}, ui => ui.writeDoubleLE(0, 0));
  eq('above-nyquist', () => {}, ui => ui.writeDoubleLE(30000, 8));
  eq('two-points', () => {}, () => {}, 2);
  eq('1024-points', () => {}, () => {}, 1024);
  eq('mixed-rates-first-disabled', p => { p[4] = 0; p.writeFloatLE(16000, 8); p[24] = 1; p[25] = 1; });
  const invalidEq = [
    ['enable', p => { p[0] = 2; }], ['filter-enable', p => { p[4] = 2; }],
    ['type', p => { p[5] = 5; }], ['disabled-type', p => { p[24] = 0; p[25] = 5; }],
    ['rate', p => p.writeFloatLE(44100, 8)], ['q-low', p => p.writeFloatLE(0.29, 12)],
    ['q-high', p => p.writeFloatLE(30.01, 12)], ['gain-low', p => p.writeFloatLE(-30.01, 16)],
    ['gain-high', p => p.writeFloatLE(30.01, 16)], ['freq-low', p => p.writeFloatLE(19, 20)],
    ['freq-high', p => p.writeFloatLE(20001, 20)],
  ];
  for (const [id, change] of invalidEq) eq(`error:${id}`, change).initial = 7;
  for (const [id, offset, value, type] of [
    ['x-zero',32,0,'i'], ['y-zero',36,0,'i'], ['x-negative',32,-1,'i'],
    ['negative-start',0,-1,'d'], ['reversed-frequency',0,30000,'d'],
    ['equal-frequency',8,20,'d'], ['reversed-gain',16,31,'d'], ['equal-gain',16,30,'d'],
  ]) eq(`error:${id}`, () => {}, ui => type === 'i' ? ui.writeInt32LE(value,offset) : ui.writeDoubleLE(value,offset)).initial = 7;
  for (const argument of ['params','ui','output']) eq(`null:${argument}`)[`null${argument}`] = true;

  const drc = (id, change = () => {}, uiChange = () => {}, count = 129) => {
    const params = baseline().subarray(236,348);
    params.writeInt32LE(1,0); params.writeInt32LE(2,24);
    [[-100,-100,0],[-30,-30,6],[0,-15,0]].forEach((dot,i)=>dot.forEach((v,j)=>params.writeFloatLE(v,28+i*12+j*4)));
    const ui = drcUi([count,315,-100,0,-100,0]);
    change(params); uiChange(ui);
    const item = { id:`DrcDraw:${id}`,name:'DrcDraw',params,ui,count };
    cases.push(item); return item;
  };
  for(const segments of [2,3,4,5,6]) for(const w of [0,0.01,6,20,100]) for(const rate of [16000,48000]) {
    drc(`grid:${segments}:${w}:${rate}`,p=>{
      p.writeFloatLE(rate,4); p.writeInt32LE(segments,24);
      for(let i=0;i<=segments;i++) {
        const x=i===segments?0:-100+i*100/segments;
        p.writeFloatLE(x,28+i*12); p.writeFloatLE(-100+Math.pow(i/segments,0.8)*90,32+i*12); p.writeFloatLE(w,36+i*12);
      }
    });
  }
  for(const count of [3,33,315,511,512,513,1024]) drc(`block-size:${count}`,()=>{},()=>{},count);
  drc('disabled',p=>p.writeInt32LE(0,0));
  drc('rms-and-timing',p=>{p.writeInt32LE(1,16);p.writeFloatLE(0.1,8);p.writeFloatLE(1,12);p.writeFloatLE(0.1,20);});
  drc('duplicate-x',p=>p.writeFloatLE(-100,40));
  drc('negative-w',p=>p.writeFloatLE(-6,48));
  drc('positive-middle-y',p=>p.writeFloatLE(10,44));
  drc('positive-first-y',p=>p.writeFloatLE(1,32));
  drc('narrow-ui',()=>{},ui=>{ui.writeFloatLE(-50,8);ui.writeFloatLE(-5,12);});
  drc('disabled-repair',p=>{p.writeInt32LE(0,0);p.writeFloatLE(96000,4);p.writeFloatLE(-120,28);p.writeFloatLE(-120,40);p.writeFloatLE(-5,52);p.writeFloatLE(100,48);});
  const invalidDrc = [
    ['enable',0,2,'i'], ['rate',4,44100,'f'], ['release-low',12,-0.01,'f'], ['release-high',12,1.01,'f'],
    ['attack-low',8,-0.01,'f'], ['attack-high',8,0.11,'f'], ['rms-low',20,-0.01,'f'], ['rms-high',20,0.11,'f'],
    ['type',16,2,'i'], ['segments-low',24,1,'i'], ['segments-high',24,7,'i'],
    ['start-x',28,-99,'f'], ['end-x',52,-1,'f'], ['middle-x',40,-110,'f'],
    ['start-y',32,-101,'f'], ['end-y',56,1,'f'], ['end-y-low',56,-101,'f'],
  ];
  for (const [id,offset,value,type] of invalidDrc) drc(`error:${id}`,p=>type==='i'?p.writeInt32LE(value,offset):p.writeFloatLE(value,offset)).initial=7;
  for (const [id,offset,value,type] of [
    ['width',0,2,'i'],['height',4,2,'i'],['start-x',8,-101,'f'],['end-x',12,1,'f'],
    ['reverse-x',8,0,'f'],['start-y',16,-101,'f'],['end-y',20,1,'f'],['reverse-y',16,0,'f'],
  ]) drc(`error:ui-${id}`,()=>{},ui=>type==='i'?ui.writeInt32LE(value,offset):ui.writeFloatLE(value,offset)).initial=7;
  // Null params / modified are dereferenced by the vendor; test our defined
  // safe behavior in C instead of crashing a shared observation batch.
  for (const argument of ['ui','output']) drc(`null:${argument}`)[`null${argument}`]=true;
  return cases;
}

function readCases() {
  const cases = [];
  for (const size of [0, 1, 4, 32, 36, 100, 235, 236, 348, 359, 360, 361, 720]) {
    cases.push({ id: `length:${size}`, data: Buffer.alloc(size, 0x55) });
    cases.push({ id: `pattern:${size}`, data: Buffer.from(Array.from({ length: size }, (_, i) => (i * 37 + 11) & 255)) });
  }
  for (const hex of ['010d0a020d030a04', '010d0d0a02', '010d1a02', '1a0102', '010d', '010d0a']) {
    cases.push({ id: `text:${hex}`, data: Buffer.from(hex, 'hex') });
  }
  for (const offset of [0, 1, 358, 359, 360]) {
    for (const [name, special] of [['crlf', [13, 10]], ['ctrlz', [26]]]) {
      cases.push({ id: `${name}:${offset}`, data: Buffer.concat([Buffer.alloc(offset, 0x55), Buffer.from(special), Buffer.alloc(400, 0x66)]) });
    }
  }
  return cases;
}

module.exports = { SIZE, fields, binCases, readCases, coordinateCases, coordinateSignatures, drawCases };
