function params(rate = 16000) {
  const b = Buffer.alloc(360);
  for (const offset of [4,20,240,352]) b.writeFloatLE(rate, offset);
  b.writeFloatLE(120,12); b.writeFloatLE(6000,28);
  for(let i=0;i<10;i++) {
    const o=36+i*20; b[o+1]=2;
    b.writeFloatLE(rate,o+4); b.writeFloatLE(0.707,o+8); b.writeFloatLE(1000,o+16);
  }
  b.writeFloatLE(0.005,244); b.writeFloatLE(0.1,248); b.writeFloatLE(0.02,256); b.writeInt32LE(2,260);
  [[-100,-100,0],[-30,-30,6],[0,-15,0]].forEach((d,i)=>d.forEach((v,j)=>b.writeFloatLE(v,264+i*12+j*4)));
  return b;
}
function signal(kind, length=512, rate=16000) {
  let seed=0x1234abcd;
  return Array.from({length},(_,i)=>{
    if(kind==='silence')return 0;
    if(kind==='impulse')return i===0?16000:0;
    if(kind==='edges')return [-32768,32767,-1,0,1,-1000,1000,0][i%8];
    if(kind==='tone')return Math.round(12000*Math.sin(2*Math.PI*1000*i/rate));
    if(kind==='step')return (i%2?-1:1)*(i<length/4?64:i<length/2?20000:i<3*length/4?500:0);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return (seed>>>17)-16384;
  });
}
function soundCases() {
  const cases=[];
  const add=(id,p,samples=signal('noise'),extra={})=>cases.push({id,steps:[{set:p},{process:samples}],...extra});
  cases.push({id:'initial-defaults',steps:[{process:signal('edges')}]});
  for(const kind of ['silence','impulse','edges','tone','step','noise'])add(`bypass:${kind}`,params(),signal(kind));
  for(const rate of [8000,16000,44100,48000])for(const gain of [-100,-12,-6,0,6,30,100]) {
    const p=params(rate);p.writeInt32LE(1,348);p.writeFloatLE(gain,356);add(`gain:${rate}:${gain}`,p,signal('edges'));
  }
  for(const rate of [16000,48000])for(let type=0;type<5;type++)for(const frequency of [100,1000,rate===16000?7000:18000])for(const q of [0.3,0.707,10])for(const gain of [-12,12]) {
    const p=params(rate);p[32]=p[36]=1;p[37]=type;p.writeFloatLE(q,44);p.writeFloatLE(gain,48);p.writeFloatLE(frequency,52);
    add(`eq:${rate}:${type}:${frequency}:${q}:${gain}`,p,[...signal('impulse'),...signal('noise')]);
  }
  for(const rate of [16000,48000])for(const module of [0,1])for(const frequency of [120,1000,6000])for(const gain of [-12,0,12,40]) {
    const p=params(rate);const base=module*16;p.writeInt32LE(1,base);p.writeFloatLE(gain,base+8);p.writeFloatLE(frequency,base+12);
    add(`boost:${rate}:${module}:${frequency}:${gain}`,p,[...signal('impulse'),...signal('noise')]);
  }
  for(const rate of [16000,48000])for(const segments of [2,3,6])for(const attack of [0,0.005,0.1])for(const width of [0,6]) {
    const p=params(rate);p.writeInt32LE(1,236);p.writeFloatLE(attack,244);p.writeInt32LE(segments,260);
    for(let i=0;i<=segments;i++) {
      p.writeFloatLE(i===segments?0:-100+i*100/segments,264+i*12);
      p.writeFloatLE(-100+90*i/segments,268+i*12);p.writeFloatLE(width,272+i*12);
    }
    add(`drc:${rate}:${segments}:${attack}:${width}`,p,[...signal('step',2048),...signal('noise')]);
  }
  for(const type of [0,1]) {
    const p=params();p.writeInt32LE(1,236);p.writeInt32LE(type,252);add(`drc-detector:${type}`,p,signal('step',4096));
  }
  for(let n=0;n<10;n++) {
    const p=params();p.writeInt32LE(1,0);p.writeFloatLE(6,8);p.writeInt32LE(1,16);p.writeFloatLE(-3,24);
    p[32]=1;
    for(let i=0;i<10;i++){const o=36+i*20;p[o]=1;p[o+1]=(i+n)%5;p.writeFloatLE(.707,o+8);p.writeFloatLE((i%2?3:-3),o+12);p.writeFloatLE(100+i*600,o+16);}
    p.writeInt32LE(1,236);p.writeInt32LE(1,348);p.writeFloatLE(-6,356);
    add(`combined:${n}`,p,[...signal('impulse'),...signal('noise'),...signal('step',1024)]);
  }
  for(const count of [1,2,3,4,7,8,9,15,16,24,31,32,40,48,56,63,64]) {
    const p=params();p[32]=p[36]=1;p.writeFloatLE(6,48);p.writeInt32LE(1,236);
    add(`frames:${count}`,p,signal('noise',count*16),{frameSize:count});
  }
  const changed=params();changed[32]=changed[36]=1;changed.writeFloatLE(6,48);changed.writeInt32LE(1,236);
  changed.writeInt32LE(1,0);changed.writeFloatLE(6,8);changed.writeInt32LE(1,16);changed.writeFloatLE(-3,24);
  changed.writeInt32LE(1,348);changed.writeFloatLE(-6,356);
  cases.push({id:'in-place',inPlace:true,steps:[{set:changed},{process:signal('noise')}]});
  cases.push({id:'set-during-playback',steps:[{set:changed},{process:signal('noise')},{set:changed},{process:signal('noise')},{set:params()},{process:signal('noise')}]});
  for(const module of [0,1,2,3,4])cases.push({id:`reset:${module}`,steps:[{set:changed},{process:signal('noise')},{reset:module},{process:signal('noise')}]});
  for(const [name,offset,value,type] of [
    ['bass-enable',0,2,'i'],['bass-rate',4,7999,'f'],['bass-gain',8,101,'f'],['bass-freq',12,8001,'f'],
    ['treble-enable',16,2,'i'],['treble-rate',20,48001,'f'],['treble-gain',24,-101,'f'],['treble-freq',28,-1,'f'],
    ['eq-enable',32,2,'i'],['eq-type',37,5,'u8'],['eq-rate',40,7999,'f'],['eq-q',44,0.29,'f'],['eq-gain',48,31,'f'],['eq-freq',52,20001,'f'],
    ['drc-enable',236,2,'i'],['drc-rate',240,7999,'f'],['drc-attack',244,0.11,'f'],['drc-release',248,1.01,'f'],
    ['drc-type',252,2,'i'],['drc-segments',260,1,'i'],['drc-x',264,-101,'f'],['drc-y',268,1,'f'],['drc-width',272,21,'f'],
    ['gain-enable',348,2,'i'],['gain-rate',352,48001,'f'],['gain-db',356,101,'f'],
  ]) {
    const p=Buffer.from(changed);
    if(type==='i')p.writeInt32LE(value,offset);else if(type==='u8')p[offset]=value;else p.writeFloatLE(value,offset);
    cases.push({id:`error:${name}`,steps:[{set:p}]});
  }
  for(const rate of [16000,48000])for(const delay of [0,1,5])for(const attack of [0,0.01,10]) {
    const limiter=Buffer.alloc(36);limiter.writeInt32LE(1,0);
    [delay,rate,-6,4,attack,150,4,0].forEach((v,i)=>limiter.writeFloatLE(v,4+i*4));
    cases.push({id:`limiter:${rate}:${delay}:${attack}`,steps:[{set:params(rate)},{limiter},{process:[...signal('edges'),...signal('step',2048),...signal('silence')]}]});
  }
  const limiter=Buffer.alloc(36);limiter.writeInt32LE(1,0);
  [1,16000,-12,4,1,100,4,6].forEach((v,i)=>limiter.writeFloatLE(v,4+i*4));
  const off=Buffer.from(limiter);off.writeInt32LE(0,0);
  cases.push({id:'limiter-switch',steps:[{set:params()},{limiter},{process:signal('noise')},{limiter:off},{process:signal('noise')},{limiter},{process:signal('noise')}]});
  cases.push({id:'reinitialize',steps:[{set:changed},{limiter},{process:signal('noise')},{initial:true},{process:signal('edges')}]});
  for(const frequency of [8000,16000,20000])for(let type=0;type<5;type++) {
    const p=params();p[32]=p[36]=1;p[37]=type;p.writeFloatLE(frequency,52);
    add(`eq-nyquist:${frequency}:${type}`,p,signal('edges'));
  }
  return cases;
}
module.exports={soundCases,params,signal};
