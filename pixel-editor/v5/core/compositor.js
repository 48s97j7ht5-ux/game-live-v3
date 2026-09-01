import{W,H}from'./app.js';
export function installCompositor(app){
  const paint=document.getElementById('paint'),pc=paint.getContext('2d',{willReadFrequently:true});paint.width=W;paint.height=H;pc.imageSmoothingEnabled=false;
  function drawLayer(l,alpha=1){if(!l?.visible)return;pc.save();pc.globalAlpha=l.opacity*alpha;pc.drawImage(l.canvas,0,0);pc.restore()}
  app.compositor={canvas:paint,ctx:pc,render(){
    pc.clearRect(0,0,W,H);
    const mode=app.state.viewMode,active=app.state.activeLayer,layers=app.state.layers;
    if(mode==='solo'){drawLayer(layers[active]);}
    else if(mode==='underlay'){
      layers.forEach((l,i)=>{if(i!==active)drawLayer(l,.2)});
      drawLayer(layers[active],1);
    }else layers.forEach(l=>drawLayer(l,1));
    app.emit('composite:rendered')
  }};
  app.on('composite:dirty',()=>app.compositor.render());app.on('layers:changed',()=>app.compositor.render());app.compositor.render();
}