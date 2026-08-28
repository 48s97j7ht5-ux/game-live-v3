import{makeLayer,W,H}from'./app.js';
export function installHistory(app){
  app.history={
    push(){app.state.undo.push(app.state.layers.map(l=>({name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,data:l.canvas.getContext('2d').getImageData(0,0,W,H)})));if(app.state.undo.length>30)app.state.undo.shift()},
    undo(){const s=app.state.undo.pop();if(!s)return;app.state.layers=s.map(x=>{const l=makeLayer(x.name);l.visible=x.visible;l.locked=x.locked;l.opacity=x.opacity;l.canvas.getContext('2d').putImageData(x.data,0,0);return l});app.state.activeLayer=Math.min(app.state.activeLayer,app.state.layers.length-1);app.emit('layers:changed');app.emit('composite:dirty')}
  };
}