import{makeLayer,W,H}from'./app.js';
export function installLayers(app){
  const api={
    init(names=['body_base','body_details','face_eyes','face_brows','face_nose','face_mouth','hair_back','onepiece','hair_front']){app.state.layers=names.map(makeLayer);app.state.activeLayer=0;app.emit('layers:changed')},
    active(){return app.state.layers[app.state.activeLayer]},
    add(name='layer_'+(app.state.layers.length+1)){app.state.layers.push(makeLayer(name));app.state.activeLayer=app.state.layers.length-1;app.emit('layers:changed');app.emit('composite:dirty')},
    duplicate(){const src=this.active();if(!src)return;const n=makeLayer(src.name+'_copy');n.visible=src.visible;n.locked=src.locked;n.opacity=src.opacity;n.canvas.getContext('2d').drawImage(src.canvas,0,0);app.state.layers.splice(app.state.activeLayer+1,0,n);app.state.activeLayer++;app.emit('layers:changed');app.emit('composite:dirty')},
    remove(){if(app.state.layers.length<=1)return;app.state.layers.splice(app.state.activeLayer,1);app.state.activeLayer=Math.max(0,app.state.activeLayer-1);app.emit('layers:changed');app.emit('composite:dirty')},
    mergeDown(){const i=app.state.activeLayer;if(i<=0)return;const top=app.state.layers[i],down=app.state.layers[i-1],ctx=down.canvas.getContext('2d');ctx.save();ctx.globalAlpha=top.opacity;ctx.drawImage(top.canvas,0,0);ctx.restore();app.state.layers.splice(i,1);app.state.activeLayer--;app.emit('layers:changed');app.emit('composite:dirty')},
    setActive(i){const next=Math.max(0,Math.min(app.state.layers.length-1,i));if(next===app.state.activeLayer){app.emit('layers:active',next);return}app.state.activeLayer=next;app.emit('layers:active',next);app.emit('composite:dirty')},
    importCanvas(canvas,name='composite_import'){const l=makeLayer(name);l.canvas.getContext('2d').drawImage(canvas,0,0,W,H);app.state.layers.push(l);app.state.activeLayer=app.state.layers.length-1;app.emit('layers:changed');app.emit('composite:dirty')}
  };
  app.layers=api;api.init();
}