const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),koffi=require('koffi');
const {soundCases}=require('./cases.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
function provenance(){return{caseHash:sourceHash(path.join(__dirname,'cases.cjs')),observerHash:sourceHash(__filename)}}
function observe(library) {
  const lib=koffi.load(path.resolve(library));
  const create=lib.func('int IFLYTEK_AudioCreate(void*,void*)'),init=lib.func('int IFLYTEK_AudioInitial(void*)');
  const set=lib.func('int IFLYTEK_AudioSet(void*,void*)'),get=lib.func('int IFLYTEK_AudioGet(void*,void*)');
  const audioProcess=lib.func('int IFLYTEK_AudioProcess(void*,void*,void*,int)'),reset=lib.func('int IFLYTEK_AudioReset(void*,int)');
  const del=lib.func('int IFLYTEK_AudioDelete(void*)'),info=lib.func('int IFLYTEK_AudioGetInfo(_Out_ const char**)');
  const setAlg=lib.func('int IFLYTEK_SetAlgParam(void*,int,void*)');
  const infoOut=[null],infoRet=info(infoOut);
  function guard(buffer){return buffer.subarray(0,16).every(x=>x===0xa5)&&buffer.subarray(-16).every(x=>x===0xa5)}
  const cases=soundCases().map(c=>{
    const storage=Buffer.alloc(3508+32,0xa5),instance=storage.subarray(16,-16);instance.fill(0);
    const size=Buffer.alloc(4),createRet=create(instance,size),initRet=init(instance);
    if(size.readInt32LE()>instance.length||!guard(storage))throw new Error(`${c.id}: instance bounds`);
    const snapshot=()=>{const output=Buffer.alloc(392,0xa5),target=output.subarray(16,-16);const ret=get(instance,target);if(!guard(output))throw new Error('get bounds');return {ret,hex:target.toString('hex')}};
    const initial=snapshot();
    const steps=c.steps.map(step=>{
      if(step.initial)return{operation:'initial',ret:init(instance),params:snapshot()};
      if(step.limiter){const p=Buffer.from(step.limiter);return{operation:'limiter',ret:setAlg(instance,5,p),inputUnchanged:p.equals(step.limiter),params:snapshot()};}
      if(step.set){const p=Buffer.from(step.set);const ret=set(instance,p);return{operation:'set',ret,inputUnchanged:p.equals(step.set),params:snapshot()};}
      if(step.reset!==undefined)return{operation:'reset',ret:reset(instance,step.reset),params:snapshot()};
      const frames=[],pcm=[],frameSize=c.frameSize||64;
      for(let i=0;i<step.process.length;i+=frameSize){
        const inputStore=Buffer.alloc(frameSize*4+32,0xa5),input=inputStore.subarray(16,-16);
        for(let j=0;j<frameSize;j++)input.writeInt32LE(step.process[i+j],j*4);
        const before=Buffer.from(input);
        const outputStore=c.inPlace?inputStore:Buffer.alloc(frameSize*4+32,0xa5),output=outputStore.subarray(16,-16);
        frames.push(audioProcess(instance,input,output,frameSize));
        if(!guard(inputStore)||!guard(outputStore)||(!c.inPlace&&!input.equals(before)))throw new Error(`${c.id}: process bounds/input mutation`);
        pcm.push(Buffer.from(output));
      }
      return{operation:'process',returns:frames,pcmHex:Buffer.concat(pcm).toString('hex')};
    });
    const invalid=[0,65,-1].map(n=>{const out=Buffer.alloc(256,0xa5);const ret=audioProcess(instance,Buffer.alloc(256),out,n);return{n,ret,unchanged:out.every(x=>x===0xa5)}});
    const deleteRet=del(instance);
    if(!guard(storage))throw new Error(`${c.id}: instance bounds`);
    return{id:c.id,createRet,usedBytes:size.readInt32LE(),initRet,initial,steps,invalid,deleteRet};
  });
  lib.unload();
  return{schemaVersion:1,...provenance(),source:{filename:path.basename(library),sha256:hash(library),platform:process.platform,arch:process.arch},info:{ret:infoRet,text:infoOut[0]},cases};
}
if(require.main===module){const [library,output]=process.argv.slice(2);fs.writeFileSync(output,JSON.stringify(observe(library),null,2)+'\n');}
module.exports={provenance};
