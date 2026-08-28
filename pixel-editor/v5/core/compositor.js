import{W,H}from'./app.js';
export function installCompositor(app){
  const paint=document.getElementById('paint'),pc=paint.getContext('2d',{willReadFrequently:true});paint.width=W;paint.height=H;pc.imageSmoothingEnabled=false;
  app.compositor={canvas:paint,ctx:pc,render(){pc.clearRect(0,0,W,H);const mode=app.state.viewMode,active=app.state.activeLayer;app.state.layers.forEach((l,i)=>{if(!l.visible)return;if(mode==='solo'&&i!==active)return;pc.save();pc.globalAlpha=l.opacity*(mode==='underlay'&&i!==active?.2:1);pc.drawImage(l.canvas,0,0);pc.restore()});app.emit('composite:rendered')}};
  app.on('composite:dirty',()=>app.compositor.render());app.on('layers:changed',()=>app.compositor.render());app.compositor.render();
}