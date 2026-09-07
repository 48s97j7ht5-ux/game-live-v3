const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PNG}=require('pngjs');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
function image(w,h,fn){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),(y*w+x)*4);return {width:w,height:h,data};}
(async()=>{
  const {reconstruct,detectGrid}=await import(pathToFileURL(path.join(root,'pixel-editor/png-lab/engine.mjs')));
  // A regression for upstream two_stage_pack: hidden RGB must NEVER change
  // a visible output pixel. Transparent centres outweighed opaque borders.
  const a=image(16,16,(x,y)=>x%4>0&&x%4<3&&y%4>0&&y%4<3?[0,0,0,0]:[240,100,80,255]);
  const b=image(16,16,(x,y)=>x%4>0&&x%4<3&&y%4>0&&y%4<3?[0,255,0,0]:[240,100,80,255]);
  const params={width:4,height:4,colors:48,coverage:.5};
  const ra=reconstruct(a,params),rb=reconstruct(b,params);
  assert.deepEqual(ra.data,rb.data);assert.deepEqual([...ra.data.slice(0,4)],[240,100,80,255]);
  assert.deepEqual(a.data,image(16,16,(x,y)=>x%4>0&&x%4<3&&y%4>0&&y%4<3?[0,0,0,0]:[240,100,80,255]).data);
  const transparent=reconstruct(image(16,16,()=>[251,12,59,0]),params);
  assert.equal(transparent.data.some(Boolean),false);
  // Non-integer cells and uniform semi-transparent coverage use area weights.
  const semi=image(17,23,()=>[80,170,210,128]);
  assert.equal(reconstruct(semi,{width:7,height:9,colors:16,coverage:.5}).data[3],255);
  assert.equal(reconstruct(semi,{width:7,height:9,colors:16,coverage:.7}).data[3],0);
  const palette=[[24,29,35,255],[225,112,85,255],[245,229,178,255],[50,130,110,255]];
  const native=image(32,40,(x,y)=>palette[((x*7+y*11)^(x*y))%4]);
  const enlarged=image(128,160,(x,y)=>[...native.data.slice((Math.floor(y/4)*32+Math.floor(x/4))*4,(Math.floor(y/4)*32+Math.floor(x/4))*4+4)]);
  const detected=detectGrid(enlarged);assert.equal(detected.width,32);assert.equal(detected.height,40);
  assert.deepEqual(reconstruct(enlarged,{width:32,height:40,colors:16,coverage:.5}).data,native.data);
  assert.throws(()=>reconstruct(native,{width:513,height:40}));
  const kat=PNG.sync.read(fs.readFileSync(path.join(root,'pixel-editor/png-lab/assets/kat-original.png')));
  const start=performance.now();const r=reconstruct(kat,{width:139,height:208,colors:48,coverage:.5});
  assert(r.colors<=48);assert.equal(r.data.length,139*208*4);
  assert(new Set(Array.from(r.data).filter((_,i)=>i%4===3)).size<=2);
  for(let i=3;i<r.data.length;i+=4)assert(r.data[i]===0||r.data[i]===255);
  if(process.env.LAB_PREVIEW_DIR){fs.mkdirSync(process.env.LAB_PREVIEW_DIR,{recursive:true});for(const [name,data]of [['restored',r.data],['nearest',r.nearest]]){const p=new PNG({width:r.width,height:r.height});p.data=Buffer.from(data);fs.writeFileSync(path.join(process.env.LAB_PREVIEW_DIR,name+'.png'),PNG.sync.write(p));}}
  console.log('PASS hidden RGB invariance, alpha coverage, immutable input, palette, exact-grid recovery, limits and Kat',JSON.stringify({ms:Math.round(performance.now()-start),katDetection:detectGrid(kat)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
