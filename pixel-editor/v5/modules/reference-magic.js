function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function linear(v){const c=v/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function oklab(r,g,b){
  const R=linear(r),G=linear(g),B=linear(b);
  const l=.4122214708*R+.5363325363*G+.0514459929*B;
  const m=.2119034982*R+.6806995451*G+.1073969566*B;
  const s=.0883024619*R+.2817188376*G+.6299787005*B;
  const L=Math.cbrt(Math.max(0,l)),M=Math.cbrt(Math.max(0,m)),S=Math.cbrt(Math.max(0,s));
  return{
    L:.2104542553*L+.7936177850*M-.0040720468*S,
    a:1.9779984951*L-2.4285922050*M+.4505937099*S,
    b:.0259040371*L+.7827717662*M-.8086757660*S
  };
}
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');
    if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;

    function colors(){
      const rows=[],seen=new Set();
      for(const family of app.palette?.families||[]){
        for(const hex of family.shades||[]){
          if(seen.has(hex))continue;seen.add(hex);
          const [r,g,b]=rgb(hex);rows.push({hex,r,g,b,lab:oklab(r,g,b)});
        }
      }
      return rows;
    }
    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}
    function nearest(source,pal){
      const lab=oklab(source[0],source[1],source[2]);
      let best=pal[0],score=Infinity;
      for(const c of pal){
        const dL=(lab.L-c.lab.L)*2.35,da=lab.a-c.lab.a,db=lab.b-c.lab.b;
        const q=dL*dL+da*da+db*db;
        if(q<score){score=q;best=c}
      }
      return best;
    }
    function applyMagic(){
      if(!original)capture();
      const pal=colors();if(!pal.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data;
      const cache=new Map();
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]===0)continue;
        const key=(d[i]<<16)|(d[i+1]<<8)|d[i+2];
        let best=cache.get(key);
        if(!best){best=nearest([d[i],d[i+1],d[i+2]],pal);cache.set(key,best)}
        d[i]=best.r;d[i+1]=best.g;d[i+2]=best.b;
      }
      ctx.putImageData(out,0,0);refreshViews();
    }
    function restore(){if(original)ctx.putImageData(original,0,0);refreshViews()}
    function setEnabled(next){enabled=!!next;if(enabled)applyMagic();else restore()}
    function toggle(){setEnabled(!enabled)}
    app.on('reference:changed',()=>{capture();if(enabled)applyMagic();else refreshViews()});
    app.referenceMagic={get enabled(){return enabled},toggle,setEnabled,apply:applyMagic,restore};
  }
};