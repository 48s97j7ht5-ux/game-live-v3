function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function distance(r,g,b,p){const rm=(r+p[0])/2,dr=r-p[0],dg=g-p[1],db=b-p[2];return(2+rm/256)*dr*dr+4*dg*dg+(2+(255-rm)/256)*db*db}
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');
    if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;
    function colors(){
      const hex=[...new Set((app.palette?.families||[]).flatMap(f=>f.shades||[]))];
      return hex.map(h=>({hex:h,rgb:rgb(h)}));
    }
    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}
    function applyMagic(){
      if(!original)capture();
      const pal=colors();if(!pal.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]===0)continue;
        let best=pal[0],score=Infinity;
        for(const c of pal){const q=distance(d[i],d[i+1],d[i+2],c.rgb);if(q<score){score=q;best=c}}
        d[i]=best.rgb[0];d[i+1]=best.rgb[1];d[i+2]=best.rgb[2];
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