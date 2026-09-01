export default{
  id:'loupe-reference',
  mount(app){
    const ref=document.getElementById('ref');
    const opacity=document.getElementById('refOpacity');
    function drawReference(info){
      if(!info||!ref||app.referenceVisibility?.visible===false)return;
      const {ctx,s,h,CELL}=info;
      const alpha=Math.max(0,Math.min(1,(+(opacity?.value??25))/100));
      if(alpha<=0)return;
      const x0=app.state.cx-h,y0=app.state.cy-h;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(ref,x0,y0,s,s,0,0,s*CELL,s*CELL);
      ctx.restore();
    }
    app.on('loupe:background',drawReference);
    app.on('reference:changed',()=>app.loupe?.draw());
    app.on('reference:opacity',()=>app.loupe?.draw());
    app.on('reference:visibility',()=>app.loupe?.draw());
    app.loupeReference={redraw:()=>app.loupe?.draw()};
  }
};