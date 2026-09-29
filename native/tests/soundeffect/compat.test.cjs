const test=require('node:test'),assert=require('node:assert/strict');
const reference=require('./fixtures/reference.json'),candidate=require('../../artifacts/soundeffect/candidate.json');
const {provenance}=require('./observe.cjs');
test('SoundEffect fixture provenance, ABI size and version',()=>{
  assert.equal(reference.schemaVersion,1);assert.equal(reference.source.filename,'SoundEffect.dll');
  for(const [key,value] of Object.entries(provenance())){assert.equal(reference[key],value,`${key}: recapture the original DLL explicitly`);assert.equal(candidate[key],value);}
  assert.deepEqual(candidate.info,reference.info);
});
test(`${reference.cases.length} audio scenarios: exact PCM and state transitions`,t=>{
  assert.equal(candidate.cases.length,reference.cases.length);
  let samples=0,frames=0;
  for(let i=0;i<reference.cases.length;i++){
    const a=candidate.cases[i],e=reference.cases[i];
    for(const key of ['id','createRet','usedBytes','initRet','initial','invalid','deleteRet'])assert.deepEqual(a[key],e[key],`${e.id}.${key}`);
    assert.equal(a.steps.length,e.steps.length);
    for(let j=0;j<e.steps.length;j++){
      const actual=a.steps[j],expected=e.steps[j];
      assert.equal(actual.operation,expected.operation,`${e.id}:${j}`);
      if(expected.operation==='process'){
        assert.deepEqual(actual.returns,expected.returns,`${e.id}:${j} process return codes`);
        const ab=Buffer.from(actual.pcmHex,'hex'),eb=Buffer.from(expected.pcmHex,'hex');
        assert.equal(ab.length,eb.length);
        for(let k=0;k<eb.length;k+=4)assert.equal(ab.readInt32LE(k),eb.readInt32LE(k),`${e.id}:${j} sample ${k/4}`);
        samples+=eb.length/4;frames+=expected.returns.length;
      }else assert.deepEqual(actual,expected,`${e.id}:${j} parameters/return`);
    }
  }
  t.diagnostic(`${samples} PCM samples in ${frames} frames matched exactly; tolerance=0 integer samples`);
});
