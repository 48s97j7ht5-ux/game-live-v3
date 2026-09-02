import{W,H}from'#pixel-app';
export default{ id:'loupe-overlay',mount(app){
  const canvas=document.getElementById('overlay'),ctx=canvas.getContext('2d'),sizeSel=document.getElementById('loupeSize');
  canvas.width=W;canvas.height=H;
  function draw(){
    const s=+sizeSel.value,h=Math.floor(s/2),x=app.state.cx-h,y=app.state.cy-h;
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.strokeStyle='cyan';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,s-1,s-1);
    ctx.fillStyle='rgba(0,255,255,.95)';ctx.fillRect(app.state.cx,app.state.cy,1,1);
    ctx.restore();
  }
  app.on('composite:rendered',draw);app.on('layers:active',draw);app.on('loupe:moved',draw);app.on('loupe:size',draw);
  app.loupeOverlay={draw};draw();
}};
