export default{
  id:'active-layer-grid',
  mount(app){
    function drawEdges(info){
      const layer=app.layers?.active?.();
      if(!layer||!info)return;
      const {ctx,s,h,CELL}=info;
      const x0=app.state.cx-h,y0=app.state.cy-h;
      const lctx=layer.canvas.getContext('2d',{willReadFrequently:true});
      const img=lctx.getImageData(x0,y0,s,s).data;
      const filled=(x,y)=>{
        if(x<0||y<0||x>=s||y>=s)return false;
        return img[(y*s+x)*4+3]>0;
      };
      ctx.save();
      ctx.strokeStyle='rgba(125,225,255,.95)';
      ctx.lineWidth=2;
      ctx.lineCap='butt';
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        if(!filled(x,y))continue;
        const px=x*CELL,py=y*CELL;
        if(!filled(x,y-1)){ctx.beginPath();ctx.moveTo(px,py+.5);ctx.lineTo(px+CELL,py+.5);ctx.stroke()}
        if(!filled(x+1,y)){ctx.beginPath();ctx.moveTo(px+CELL-.5,py);ctx.lineTo(px+CELL-.5,py+CELL);ctx.stroke()}
        if(!filled(x,y+1)){ctx.beginPath();ctx.moveTo(px,py+CELL-.5);ctx.lineTo(px+CELL,py+CELL-.5);ctx.stroke()}
        if(!filled(x-1,y)){ctx.beginPath();ctx.moveTo(px+.5,py);ctx.lineTo(px+.5,py+CELL);ctx.stroke()}
      }
      ctx.restore();
    }
    app.on('loupe:drawn',drawEdges);
    app.on('layers:active',()=>app.loupe?.draw());
    app.on('layers:changed',()=>app.loupe?.draw());
    app.activeLayerGrid={redraw:()=>app.loupe?.draw()};
  }
};