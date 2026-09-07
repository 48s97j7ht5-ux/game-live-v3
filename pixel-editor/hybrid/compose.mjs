export function compose(manifest, variants, state) {
  const {width,height,regions,methods}=manifest;
  for(const key of ['base',...regions.map(r=>r.id)]) if(!Object.hasOwn(methods,state[key])) throw Error('Unknown method');
  const out=new Uint8ClampedArray(variants[state.base]);
  if(out.length!==width*height*4) throw Error('Wrong image size');
  for(const {id,rect:[x,y,w,h]} of regions){
    const src=variants[state[id]];
    for(let row=y;row<y+h;row++){
      const start=(row*width+x)*4;out.set(src.subarray(start,start+w*4),start);
    }
  }
  return out;
}
