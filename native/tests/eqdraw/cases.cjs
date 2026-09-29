const { drawCases } = require('../eqdrc/cases.cjs');

function wrapperCases() {
  const cases = drawCases().filter(c => {
    if (c.nullui || c.nulloutput) return false;
    if (c.name === 'EqDraw') {
      const count = c.ui.readInt32LE(32);
      return count >= 0 && count <= 1024 && count !== 1;
    }
    return !c.nullparams && c.ui.readInt32LE(0) >= 0 && c.ui.readInt32LE(0) <= 315;
  }).map(c => ({ ...c, params: Buffer.from(c.params), ui: Buffer.from(c.ui) }));
  const eq = cases.find(c => c.id === 'EqDraw:48000:type2');
  for (const count of [840, 1023, 1024]) {
    const ui = Buffer.from(eq.ui); ui.writeInt32LE(count, 32);
    cases.push({ ...eq, id: `EqDraw:wrapper-count:${count}`, params: Buffer.from(eq.params), ui });
  }
  const drc = cases.find(c => c.id === 'DrcDraw:knee6');
  const zeroUi = Buffer.from(eq.ui); zeroUi.writeDoubleLE(0, 0);
  const disabledEq = Buffer.from(eq.params); disabledEq[0] = 0;
  cases.push({ ...eq, id: 'EqDraw:disabled-zero-start', params: disabledEq, ui: zeroUi });
  for (const count of [0, 1, 314, 315]) {
    const ui = Buffer.from(drc.ui); ui.writeInt32LE(count, 0);
    cases.push({ ...drc, id: `DrcDraw:wrapper-count:${count}`, params: Buffer.from(drc.params), ui });
  }
  for (const segments of [0, 1]) {
    const params = Buffer.from(drc.params);
    params.writeInt32LE(0, 0); params.writeInt32LE(segments, 24);
    cases.push({ ...drc, id: `DrcDraw:disabled-original-dot-count:${segments}`, params, ui: Buffer.from(drc.ui) });
  }
  return cases;
}
module.exports = { wrapperCases };
