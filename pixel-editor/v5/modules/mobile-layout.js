export default{
  id:'mobile-layout',
  mount(app){
    const mq=matchMedia('(max-width:860px)');
    const body=document.body,side=document.querySelector('.side'),stage=document.querySelector('.stage'),bar=document.querySelector('.bar');
    const loupeCard=document.getElementById('loupe')?.closest('.card');
    const layersCard=document.getElementById('layers')?.closest('.card');
    const paletteCard=document.getElementById('palette')?.closest('.card');
    const toolsRow=document.getElementById('tools');
    const filesPanel=app.mobileFiles?.panel||bar;
    if(!side||!stage||!loupeCard||!layersCard||!paletteCard||!toolsRow)return;

    const top=document.createElement('div');top.className='mobileTop';top.innerHTML='<button data-mob="undo">↶</button><button class="mobileLayerName" data-mob="layers-top" aria-label="Выбрать слой">Слой</button><button data-mob="ref" aria-label="Показать или скрыть подложку">👁 Ref</button><button data-mob="bg" aria-label="Переключить фон">🟪</button><button data-mob="files">Файлы</button>';
    const quick=document.createElement('div');quick.className='mobileQuick';quick.innerHTML='<button data-quick="magic" aria-label="Подогнать подложку под палитру">✨ Magic</button>';
    const dock=document.createElement('div');dock.className='mobileDock';dock.innerHTML='<button data-tool="pencil">✏️<small>Pixel</small></button><button data-tool="eraser">⌫<small>Erase</small></button><button data-tool="picker">🎯<small>Pick</small></button><button data-tool="trace">🧬<small>Trace</small></button><button data-tool="hand">✋<small>Hand</small></button><button data-mob="palette">●<small>Color</small></button><button data-mob="preview">👁<small>Preview</small></button>';
    const scrim=document.createElement('div');scrim.className='mobileScrim';
    body.append(top,quick,scrim,dock);

    let workspace='loupe',sheet=null,portal=null;
    function activeName(){const raw=app.state.layers?.[app.state.activeLayer]?.name||'layer';return app.layerLabels?.get(raw)||raw}
    function refreshTop(){top.querySelector('.mobileLayerName').textContent=activeName()}
    function markTools(){dock.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('activeBtn',b.dataset.tool===app.state.activeTool))}
    function refreshBg(){const b=top.querySelector('[data-mob="bg"]');if(!b)return;const magenta=app.backgroundToggle?.mode==='magenta';b.classList.toggle('activeBtn',magenta);b.textContent=magenta?'🟪':'⬛'}
    function refreshRef(){const b=top.querySelector('[data-mob="ref"]');if(!b)return;const visible=app.referenceVisibility?.visible!==false;b.classList.toggle('activeBtn',visible);b.textContent=visible?'👁 Ref':'○ Ref'}
    function refreshMagic(){const b=quick.querySelector('[data-quick="magic"]');if(!b)return;const on=app.referenceMagic?.enabled===true;b.classList.toggle('activeBtn',on);b.textContent=on?'✨ Magic ON':'✨ Magic'}
    function restorePortal(){if(!portal)return;const{card,parent,next}=portal;if(next&&next.parentNode===parent)parent.insertBefore(card,next);else parent.appendChild(card);portal=null}
    function closeSheet(){if(sheet)sheet.classList.remove('mobileSheetOpen');restorePortal();sheet=null;scrim.classList.remove('show')}
    function openSheet(card){closeSheet();if(mq.matches&&card!==filesPanel&&card.parentNode!==body){portal={card,parent:card.parentNode,next:card.nextSibling};body.appendChild(card)}sheet=card;card.classList.add('mobileSheetOpen');scrim.classList.add('show')}
    function setWorkspace(mode){
      closeSheet();workspace=mode;body.dataset.mobileWorkspace=mode;
      app.state.viewMode=mode==='preview'?'composite':'underlay';
      app.emit('composite:dirty');
      const pb=dock.querySelector('[data-mob="preview"]');pb.classList.toggle('activeBtn',mode==='preview');pb.querySelector('small').textContent=mode==='preview'?'Loupe':'Preview';
      refreshTop();refreshBg();refreshRef();refreshMagic();app.emit('mobile:workspace',mode)
    }
    function applyMode(){const on=mq.matches;body.classList.toggle('pixelLabMobile',on);top.hidden=!on;quick.hidden=!on;dock.hidden=!on;scrim.hidden=!on;if(on){setWorkspace('loupe');refreshTop();markTools();refreshBg();refreshRef();refreshMagic()}else{closeSheet();delete body.dataset.mobileWorkspace;app.state.viewMode='composite';app.emit('composite:dirty');app.emit('mobile:workspace','desktop')}}

    dock.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{app.setTool(b.dataset.tool);markTools()});
    top.querySelector('[data-mob="layers-top"]').onclick=()=>openSheet(layersCard);
    top.querySelector('[data-mob="ref"]').onclick=()=>{app.referenceVisibility?.toggle();refreshRef()};
    top.querySelector('[data-mob="bg"]').onclick=()=>{app.backgroundToggle?.toggle();refreshBg()};
    quick.querySelector('[data-quick="magic"]').onclick=()=>{app.referenceMagic?.toggle();refreshMagic()};
    dock.querySelector('[data-mob="palette"]').onclick=()=>openSheet(paletteCard);
    dock.querySelector('[data-mob="preview"]').onclick=()=>setWorkspace(workspace==='preview'?'loupe':'preview');
    top.querySelector('[data-mob="undo"]').onclick=()=>app.history?.undo();
    top.querySelector('[data-mob="files"]').onclick=()=>openSheet(filesPanel);
    app.mobileFiles?.closeButton?.addEventListener('click',closeSheet);
    scrim.onclick=closeSheet;
    app.on('tool:changed',()=>{markTools();refreshTop()});
    app.on('layers:active',refreshTop);app.on('layers:changed',refreshTop);app.on('background:changed',refreshBg);app.on('reference:visibility',refreshRef);app.on('reference:magic',refreshMagic);
    mq.addEventListener?.('change',applyMode);applyMode();
    app.mobileLayout={setWorkspace,openSheet,closeSheet};
  }
};