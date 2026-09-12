import assert from'node:assert/strict';
import{cleanSprite}from'../pixel-editor/v5/modules/ai-clean-core.mjs';

const width=12,height=12,data=new Uint8ClampedArray(width*height*4);
for(let y=3;y<=8;y++)for(let x=3;x<=8;x++){
  const i=(y*width+x)*4;data[i]=x*20;data[i+1]=y*19;data[i+2]=(x+y)*11;data[i+3]=x===3?90:255;
}
const isolated=(1*width+1)*4;data[isolated]=255;data[isolated+3]=255;
const hole=(5*width+5)*4;data[hole+3]=0;
const original=new Uint8ClampedArray(data),mask={width,height,data:new Float32Array(width*height).fill(1)};
const result=cleanSprite({width,height,data},{strength:45,paletteLimit:8,neuralMask:mask});

assert.deepEqual(data,original,'source must stay untouched');
assert.equal(result.data[isolated+3],0,'isolated pixel must be removed');
assert.equal(result.data[hole+3],255,'one-pixel hole must be filled');
assert.ok(result.stats.afterColors<=8,'palette limit must be respected');
assert.ok(result.stats.neuralApplied,'valid neural mask must be used');
for(let i=3;i<result.data.length;i+=4)assert.ok(result.data[i]===0||result.data[i]===255,'alpha must be binary');

const badMask={width,height,data:new Float32Array(width*height)};
const fallback=cleanSprite({width,height,data},{strength:45,paletteLimit:false,neuralMask:badMask});
assert.equal(fallback.stats.neuralApplied,false,'low-recall mask must be rejected');
assert.ok(fallback.data.some((value,index)=>index%4===3&&value===255),'fallback must preserve the sprite');
console.log('AI Clean core OK');
