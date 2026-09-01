import{describeColor,paletteMatchScore}from'../core/color-metrics.js';
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');
    if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;
    function colors(){
      const rows=[];
      for(const family of app.palette?.families||[]){
        for(const hex of family.shades||[]){
          const [r,g,b]=rgb(hex);
          rows.push({hex,family:family.id,...describeColor(r,g,b)});
        }
      }
      const seen=new Set();
      return rows.filter(c=>!seen.has(c.hex)&&(seen.add(c.hex),true));
    }
    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}
    function applyMagic(){
      if(!original)capture();
      const pal=colors();if(!pal.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]===0)continue;
        const source=describeColor(d[i],d[i+1],d[i+2]);
        let best=pal[0],score=Infinity;
        for(const c of pal){
          const q=paletteMatchScore(source,c);
          if(q<score){score=q;best=c}
        }
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