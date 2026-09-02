import{makeLayer,W,H}from'#pixel-app';

const MAX_ENTRIES=30;
const MAX_BYTES=24*1024*1024;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const imageBytes=image=>image?.data?.byteLength||0;

export function installHistory(app){
  function captureLayer(layer){
    return{id:layer.id,parentId:layer.parentId,name:layer.name,slot:layer.slot,z:layer.z,visible:layer.visible,locked:layer.locked,opacity:layer.opacity,itemMeta:clone(layer.itemMeta),data:layer.canvas.getContext('2d').getImageData(0,0,W,H)};
  }
  function snapshotBytes(snapshot){
    if(Number.isFinite(snapshot?.bytes))return snapshot.bytes;
    if(snapshot?.kind==='layer')return imageBytes(snapshot.layer?.data);
    const layers=Array.isArray(snapshot)?snapshot:snapshot?.layers||[];
    return layers.reduce((sum,layer)=>sum+imageBytes(layer?.data),0);
  }
  function remember(snapshot){
    snapshot.bytes=snapshotBytes(snapshot);
    const stack=app.state.undo;stack.push(snapshot);
    let total=stack.reduce((sum,item)=>sum+snapshotBytes(item),0);
    while(stack.length>MAX_ENTRIES||(total>MAX_BYTES&&stack.length>1)){
      total-=snapshotBytes(stack.shift());
    }
  }
  function pushLayer(layer=app.layers?.active()){
    if(!layer?.canvas)return false;
    remember({kind:'layer',activeId:app.layers?.active()?.id,layerId:layer.id,layer:captureLayer(layer)});
    return true;
  }
  function pushStructure(){
    remember({
      kind:'structure',
      activeId:app.layers?.active()?.id,
      groups:(app.state.layerGroups||[]).map(group=>clone(group)),
      layers:app.state.layers.map(captureLayer)
    });
    return true;
  }
  function restoreMeta(target,source){
    if(source.itemMeta==null)delete target.itemMeta;else target.itemMeta=clone(source.itemMeta);
  }
  function changed(){
    app.emit('layers:changed');app.emit('composite:dirty');
  }
  function undo(){
    const snapshot=app.state.undo.pop();if(!snapshot)return;
    if(snapshot.kind==='layer'){
      const target=app.state.layers.find(layer=>layer.id===snapshot.layerId);
      if(!target){app.emit('status','Отмена пропущена: слой больше не существует');return}
      target.canvas.getContext('2d').putImageData(snapshot.layer.data,0,0);restoreMeta(target,snapshot.layer);
      const restored=snapshot.activeId?app.state.layers.findIndex(layer=>layer.id===snapshot.activeId):-1;
      if(restored>=0)app.state.activeLayer=restored;
      changed();return;
    }
    const source=Array.isArray(snapshot)?{layers:snapshot,groups:app.state.layerGroups||[]}:snapshot;
    app.state.layerGroups=(source.groups||[]).map(group=>clone(group));
    app.state.layers=source.layers.map((item,index)=>{
      const layer=makeLayer(item.name,{id:item.id,parentId:item.parentId,slot:item.slot||item.id,z:Number.isFinite(item.z)?item.z:index*10,visible:item.visible,locked:item.locked,opacity:item.opacity});
      layer.canvas.getContext('2d').putImageData(item.data,0,0);restoreMeta(layer,item);return layer;
    });
    const restored=source.activeId?app.state.layers.findIndex(layer=>layer.id===source.activeId):-1;
    app.state.activeLayer=restored>=0?restored:Math.min(app.state.activeLayer,app.state.layers.length-1);
    app.layers?.validateStructure?.({repair:true,notify:true});changed();
  }
  app.history={push:pushLayer,pushLayer,pushStructure,undo,maxEntries:MAX_ENTRIES,maxBytes:MAX_BYTES};
}
