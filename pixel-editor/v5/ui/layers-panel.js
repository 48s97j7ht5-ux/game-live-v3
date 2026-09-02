export default{ id:'layers-panel',mount(app){
  const box=document.getElementById('layers');
  const buttons={add:document.getElementById('newLayer'),duplicate:document.getElementById('dupLayer'),remove:document.getElementById('delLayer'),merge:document.getElementById('mergeDown')};
  function label(name){return app.layerLabels?.get(name)||name}
  function depthStyle(row,depth){const indent=depth*10;row.style.marginLeft=indent+'px';row.style.width=`calc(100% - ${indent}px)`}
  function emitChanged(){app.emit('layers:changed');app.emit('composite:dirty')}
  function groupRow(group,depth){
    const row=document.createElement('div');row.className='layer layerGroup';depthStyle(row,depth);
    const vis=document.createElement('button');vis.textContent=group.visible?'👁':'○';vis.title=group.visible?'Скрыть группу':'Показать группу';vis.onclick=e=>{e.stopPropagation();group.visible=!group.visible;render();emitChanged()};
    const lock=document.createElement('button');lock.textContent=group.locked?'🔒':'🔓';lock.title=group.locked?'Разблокировать группу':'Заблокировать группу';lock.onclick=e=>{e.stopPropagation();group.locked=!group.locked;render();app.emit('layers:changed')};
    const name=document.createElement('div');name.className='layerName layerGroupName';name.textContent=(group.expanded?'▾ ':'▸ ')+group.name;name.title=group.name;
    const op=document.createElement('input');op.type='range';op.min=0;op.max=100;op.value=Math.round(group.opacity*100);op.title='Прозрачность группы';op.oninput=e=>{group.opacity=e.target.value/100;app.emit('composite:dirty')};
    row.onclick=e=>{if(!['BUTTON','INPUT'].includes(e.target.tagName)){group.expanded=!group.expanded;render()}};
    row.append(vis,lock,name,op);return row;
  }
  function layerRow(layer,depth){
    const i=app.state.layers.indexOf(layer),row=document.createElement('div');row.className='layer layerLeaf'+(i===app.state.activeLayer?' active':'');depthStyle(row,depth);
    if(!app.layers.isVisible(layer))row.classList.add('layerInheritedHidden');
    if(app.layers.isLocked(layer)&&!layer.locked)row.classList.add('layerInheritedLocked');
    row.onclick=e=>{if(!['BUTTON','INPUT'].includes(e.target.tagName)){app.layers.setActive(i);render();app.emit('composite:dirty')}};
    const vis=document.createElement('button');vis.textContent=layer.visible?'👁':'○';vis.title=layer.visible?'Скрыть слой':'Показать слой';vis.onclick=e=>{e.stopPropagation();layer.visible=!layer.visible;render();app.emit('composite:dirty')};
    const lock=document.createElement('button');lock.textContent=layer.locked?'🔒':'🔓';lock.title=layer.locked?'Разблокировать слой':'Заблокировать слой';lock.onclick=e=>{e.stopPropagation();layer.locked=!layer.locked;render();app.emit('layers:changed')};
    const name=document.createElement('div');name.className='layerName';name.textContent=label(layer.name);name.title=app.layers.pathLabel(layer);
    const load=document.createElement('button');load.className='layerPngButton';load.textContent='📥';load.title='Загрузить PNG в этот слой';load.setAttribute('aria-label','Загрузить PNG · '+app.layers.pathLabel(layer));load.onclick=e=>{e.stopPropagation();app.layerPngIO?.openFor(layer.id)};
    const save=document.createElement('button');save.className='layerPngButton';save.textContent='📤';save.title='Сохранить PNG этого слоя';save.setAttribute('aria-label','Сохранить PNG · '+app.layers.pathLabel(layer));save.onclick=e=>{e.stopPropagation();app.layerPngIO?.save(layer.id)};
    const op=document.createElement('input');op.type='range';op.min=0;op.max=100;op.value=Math.round(layer.opacity*100);op.title='Прозрачность слоя';op.oninput=e=>{layer.opacity=e.target.value/100;app.emit('composite:dirty')};
    row.append(vis,lock,name,load,save,op);return row;
  }
  function renderGroup(group,depth){
    box.appendChild(groupRow(group,depth));if(!group.expanded)return;
    app.state.layers.filter(layer=>layer.parentId===group.id).forEach(layer=>box.appendChild(layerRow(layer,depth+1)));
    app.state.layerGroups.filter(child=>child.parentId===group.id).forEach(child=>renderGroup(child,depth+1));
  }
  function render(){
    box.innerHTML='';
    app.state.layerGroups.filter(group=>group.parentId===null).forEach(group=>renderGroup(group,0));
  }
  buttons.add.onclick=()=>{app.history.push();app.layers.add();render()};
  buttons.duplicate.onclick=()=>{app.history.push();app.layers.duplicate();render()};
  buttons.remove.onclick=()=>{app.history.push();app.layers.remove();render()};
  buttons.merge.onclick=()=>{app.history.push();app.layers.mergeDown();render()};
  app.on('layers:changed',render);app.on('layers:active',render);render();
}};
