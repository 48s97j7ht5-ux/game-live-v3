export function applyPatches(base,meta,mode,disabled=new Set()){
 if(!['base','outline','shape','both'].includes(mode))throw Error('Unknown mode');
 const out=new Uint8ClampedArray(base);
 // Shape first; never restore an outline pixel removed by a shape edit.
 for(const kind of ['shape','outline'])for(const p of meta.patches){
  if(p.kind!==kind||disabled.has(p.id)||(mode!==kind&&mode!=='both'))continue;
  const i=(p.y*meta.width+p.x)*4;
  if(kind==='outline'&&!out[i+3])continue;
  out.set(p.after,i);
 }
 return out;
}
