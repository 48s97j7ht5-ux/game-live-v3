import{W,H}from'#pixel-app';
export function installCompositor(app){
  const paint=document.getElementById('paint'),pc=paint.getContext('2d',{willReadFrequently:true});paint.width=W;paint.height=H;pc.imageSmoothingEnabled=false;
  function drawLayer(layer,alpha=1){if(!app.layers?.isVisible(layer))return;pc.save();pc.globalAlpha=app.layers.effectiveOpacity(layer)*alpha;pc.drawImage(layer.canvas,0,0);pc.restore()}
  app.compositor={canvas:paint,ctx:pc,render(){
    pc.clearRect(0,0,W,H);
    const mode=app.state.viewMode,active=app.layers.active(),layers=app.layers.renderLayers();
    if(mode==='solo'){drawLayer(active);}
    else if(mode==='underlay'){
      layers.forEach(layer=>{if(layer!==active)drawLayer(layer,.2)});
      drawLayer(active,1);
    }else layers.forEach(layer=>drawLayer(layer,1));
    app.emit('composite:rendered');
  }};
  let renderQueued=false;
  function scheduleRender(){
    if(renderQueued)return;renderQueued=true;
    queueMicrotask(()=>{renderQueued=false;app.compositor.render()});
  }
  app.on('composite:dirty',scheduleRender);app.on('layers:changed',scheduleRender);app.compositor.render();
}
