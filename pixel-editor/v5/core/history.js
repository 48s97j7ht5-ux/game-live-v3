import{makeLayer,W,H}from'./app.js?v=20260902-layer-schema1';
export function installHistory(app){
  app.history={
    push(){
      const activeId=app.layers?.active()?.id;
      app.state.undo.push({
        activeId,
        groups:(app.state.layerGroups||[]).map(g=>({...g})),
        layers:app.state.layers.map(l=>({id:l.id,parentId:l.parentId,name:l.name,slot:l.slot,z:l.z,visible:l.visible,locked:l.locked,opacity:l.opacity,data:l.canvas.getContext('2d').getImageData(0,0,W,H)}))
      });
      if(app.state.undo.length>30)app.state.undo.shift();
    },
    undo(){
      const snapshot=app.state.undo.pop();if(!snapshot)return;
      const source=Array.isArray(snapshot)?{layers:snapshot,groups:app.state.layerGroups||[]}:snapshot;
      app.state.layerGroups=(source.groups||[]).map(g=>({...g}));
      app.state.layers=source.layers.map((x,index)=>{const l=makeLayer(x.name,{id:x.id,parentId:x.parentId,slot:x.slot||x.id,z:Number.isFinite(x.z)?x.z:index*10,visible:x.visible,locked:x.locked,opacity:x.opacity});l.canvas.getContext('2d').putImageData(x.data,0,0);return l});
      const restored=source.activeId?app.state.layers.findIndex(l=>l.id===source.activeId):-1;
      app.state.activeLayer=restored>=0?restored:Math.min(app.state.activeLayer,app.state.layers.length-1);
      app.layers?.validateStructure?.({repair:true,notify:true});
      app.emit('layers:changed');app.emit('composite:dirty');
    }
  };
}
