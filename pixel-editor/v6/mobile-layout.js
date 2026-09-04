export default{
  id:'mobile-layout-v6',
  mount(app){
    const mq=matchMedia('(max-width:860px)');
    const body=document.body;
    const stage=document.querySelector('.stage');
    const side=document.querySelector('.side');
    const layersCard=document.querySelector('.layersCard');
    const paletteCard=document.querySelector('.paletteCard');
    const loupeCard=document.querySelector('.loupeCard');
    const controlsCard=document.querySelector('.controlsCard');
    const viewCard=document.querySelector('.viewCard');
    const filesPanel=app.mobileFiles?.panel||document.querySelector('.bar');
    if(!stage||!side||!layersCard||!paletteCard||!loupeCard)return;

    const shell=document.createElement('div');
    shell.className='v6MobileShell';
    shell.innerHTML=`
      <div class="v6Topbar">
        <button data-v6="undo" aria-label="Undo">↶</button>
        <button class="v6LayerTitle" data-v6="layers" aria-label="Layers">Layer</button>
        <button data-v6="ref" aria-label="Reference">👁</button>
        <button data-v6="bg" aria-label="Background">▦</button>
        <button data-v6="files" aria-label="Files">•••</button>
      </div>
      <div class="v6PaletteRail"><div class="v6PaletteHost"></div></div>
      <div class="v6CanvasTools">
        <button data-v6="fit">⌖</button>
        <button data-v6="zoomOut">−</button>
        <button data-v6="zoomIn">＋</button>
      </div>
      <div class="v6LayersRail"><div class="v6LayersHost"></div></div>
      <div class="v6Dock">
        <button data-tool="pencil">✏️<small>Pixel</small></button>
        <button data-tool="eraser">⌫<small>Erase</small></button>
        <button data-tool="picker">🎯<small>Pick</small></button>
        <button data-tool="trace">✂️<small>Trace</small></button>
        <button data-tool="hand">✋<small>Move</small></button>
        <button data-v6="loupe">🔬<small>Loupe</small></button>
        <button data-v6="more">⚙️<small>More</small></button>
      </div>
      <div class="v6Scrim"></div>
    `;
    body.appendChild(shell);

    const top=shell.querySelector('.v6Topbar');
    const dock=shell.querySelector('.v6Dock');
    const paletteHost=shell.querySelector('.v6PaletteHost');
    const layersHost=shell.querySelector('.v6LayersHost');
    const scrim=shell.querySelector('.v6Scrim');

    const paletteEl=document.getElementById('palette');
    const layersEl=document.getElementById('layers');
    const paletteHome={parent:paletteEl.parentNode,next:paletteEl.nextSibling};
    const layersHome={parent:layersEl.parentNode,next:layersEl.nextSibling};
    let openSheet=null;

    function activeName(){const layer=app.layers?.active?.();return layer?app.layers.pathLabel(layer):'Layer'}
    function refresh(){
      top.querySelector('.v6LayerTitle').textContent=activeName();
      dock.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('activeBtn',b.dataset.tool===app.state.activeTool));
      const rb=top.querySelector('[data-v6="ref"]');
      const visible=app.referenceVisibility?.visible!==false;
      rb.classList.toggle('activeBtn',visible);rb.textContent=visible?'👁':'○';
      const bb=top.querySelector('[data-v6="bg"]');
      const magenta=app.backgroundToggle?.mode==='magenta';bb.classList.toggle('activeBtn',magenta);bb.textContent=magenta?'🟪':'▦';
    }
    function restoreNode(el,home){if(home.next&&home.next.parentNode===home.parent)home.parent.insertBefore(el,home.next);else home.parent.appendChild(el)}
    function closeSheet(){if(!openSheet)return;openSheet.classList.remove('v6SheetOpen');openSheet=null;scrim.classList.remove('show')}
    function showSheet(card){closeSheet();openSheet=card;card.classList.add('v6SheetOpen');scrim.classList.add('show')}
    function mountMobile(){
      body.classList.add('pixelLabV6Mobile');
      paletteHost.appendChild(paletteEl);
      layersHost.appendChild(layersEl);
      refresh();
      app.state.viewMode='composite';app.emit('composite:dirty');
    }
    function unmountMobile(){
      body.classList.remove('pixelLabV6Mobile');
      closeSheet();
      restoreNode(paletteEl,paletteHome);restoreNode(layersEl,layersHome);
      app.state.viewMode='composite';app.emit('composite:dirty');
    }
    function applyMode(){mq.matches?mountMobile():unmountMobile()}

    dock.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{app.setTool(b.dataset.tool);refresh()});
    top.querySelector('[data-v6="undo"]').onclick=()=>app.history?.undo();
    top.querySelector('[data-v6="layers"]').onclick=()=>showSheet(layersCard);
    top.querySelector('[data-v6="ref"]').onclick=()=>{app.referenceVisibility?.toggle();refresh()};
    top.querySelector('[data-v6="bg"]').onclick=()=>{app.backgroundToggle?.toggle();refresh()};
    top.querySelector('[data-v6="files"]').onclick=()=>showSheet(filesPanel);
    dock.querySelector('[data-v6="loupe"]').onclick=()=>showSheet(loupeCard);
    dock.querySelector('[data-v6="more"]').onclick=()=>showSheet(controlsCard||viewCard||filesPanel);
    shell.querySelector('[data-v6="zoomIn"]').onclick=()=>{const z=document.getElementById('zoom');if(!z)return;z.value=Math.min(+z.max,+z.value+1);z.dispatchEvent(new Event('input',{bubbles:true}))};
    shell.querySelector('[data-v6="zoomOut"]').onclick=()=>{const z=document.getElementById('zoom');if(!z)return;z.value=Math.max(+z.min,+z.value-1);z.dispatchEvent(new Event('input',{bubbles:true}))};
    shell.querySelector('[data-v6="fit"]').onclick=()=>{const z=document.getElementById('zoom');if(!z)return;z.value=1;z.dispatchEvent(new Event('input',{bubbles:true}));stage.scrollTo?.({left:0,top:0,behavior:'smooth'})};
    scrim.onclick=closeSheet;
    app.mobileFiles?.closeButton?.addEventListener('click',closeSheet);
    app.on('tool:changed',refresh);app.on('layers:active',refresh);app.on('layers:changed',refresh);app.on('reference:visibility',refresh);app.on('background:changed',refresh);
    mq.addEventListener?.('change',applyMode);applyMode();
    app.mobileLayout={openSheet:showSheet,closeSheet};
  }
};
