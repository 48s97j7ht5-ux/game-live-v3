export default{
  id:'mobile-layout',
  mount(app){
    const mq=matchMedia('(max-width:860px)');
    const body=document.body,side=document.querySelector('.side'),stage=document.querySelector('.stage'),bar=document.querySelector('.bar');
    const loupeCard=document.getElementById('loupe')?.closest('.card');
    const layersCard=document.getElementById('layers')?.closest('.card');
    const paletteCard=document.getElementById('palette')?.closest('.card');
    const toolsRow=document.getElementById('tools');
    if(!side||!stage||!loupeCard||!layersCard||!paletteCard||!toolsRow)return;

    const top=document.createElement('div');top.className='mobileTop';top.innerHTML='<button data-mob="undo">↶</button><div class="mobileLayerName">layer</div><button class="mobileColor" aria-label="Текущий цвет"></button><button data-mob="files">Files</button>';
    const layerBar=document.createElement('div');layerBar.className='mobileLoupeLayerBar';layerBar.innerHTML='<button data-mob="layers-top">▤ <span>Layers</span></button>';
    toolsRow.insertAdjacentElement('afterend',layerBar);
    const dock=document.createElement('div');dock.className='mobileDock';dock.innerHTML='<button data-tool="pencil">✏️<small>Pixel</small></button><button data-tool="eraser">⌫<small>Erase</small></button><button data-tool="picker">🎯<small>Pick</small></button><button data-tool="trace">🧬<small>Trace</small></button><button data-tool="hand">✋<small>Hand</small></button><button data-mob="palette">●<small>Color</small></button><button data-mob="preview">👁<small>Preview</small></button>';
    const scrim=document.createElement('div');scrim.className='mobileScrim';
    body.append(top,scrim,dock);

    let workspace='loupe',sheet=null;
    function activeName(){return app.state.layers?.[app.state.activeLayer]?.name||'layer'}
    function refreshTop(){const name=activeName();top.querySelector('.mobileLayerName').textContent=name;top.querySelector('.mobileColor').style.background=app.state.color||'#090404';layerBar.querySelector('span').textContent='Layers · '+name}
    function markTools(){dock.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('activeBtn',b.dataset.tool===app.state.activeTool))}
    function closeSheet(){if(sheet)sheet.classList.remove('mobileSheetOpen');sheet=null;scrim.classList.remove('show')}
    function openSheet(card){closeSheet();sheet=card;card.classList.add('mobileSheetOpen');scrim.classList.add('show')}
    function setWorkspace(mode){closeSheet();workspace=mode;body.dataset.mobileWorkspace=mode;const pb=dock.querySelector('[data-mob="preview"]');pb.classList.toggle('activeBtn',mode==='preview');pb.querySelector('small').textContent=mode==='preview'?'Loupe':'Preview';refreshTop()}
    function applyMode(){const on=mq.matches;body.classList.toggle('pixelLabMobile',on);top.hidden=!on;dock.hidden=!on;scrim.hidden=!on;layerBar.hidden=!on;if(on){setWorkspace('loupe');refreshTop();markTools()}else{closeSheet();delete body.dataset.mobileWorkspace}}

    dock.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{app.setTool(b.dataset.tool);markTools()});
    layerBar.querySelector('[data-mob="layers-top"]').onclick=()=>openSheet(layersCard);
    dock.querySelector('[data-mob="palette"]').onclick=()=>openSheet(paletteCard);
    dock.querySelector('[data-mob="preview"]').onclick=()=>setWorkspace(workspace==='preview'?'loupe':'preview');
    top.querySelector('[data-mob="undo"]').onclick=()=>app.history?.undo();
    top.querySelector('[data-mob="files"]').onclick=()=>openSheet(bar);
    top.querySelector('.mobileColor').onclick=()=>openSheet(paletteCard);
    scrim.onclick=closeSheet;
    app.on('tool:changed',()=>{markTools();refreshTop()});
    app.on('layers:active',refreshTop);app.on('layers:changed',refreshTop);app.on('color:changed',refreshTop);
    mq.addEventListener?.('change',applyMode);applyMode();
    app.mobileLayout={setWorkspace,openSheet,closeSheet};
  }
};