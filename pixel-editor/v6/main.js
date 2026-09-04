import{PixelLabApp}from'#pixel-app';
import{installLayers}from'../v5/core/layers.js?v=20260902-core-fix2';
import{installHistory}from'../v5/core/history.js?v=20260902-core-fix2';
import{installCompositor}from'../v5/core/compositor.js?v=20260902-core-fix2';
import pencil from'../v5/tools/pencil.js?v=20260902-core-fix2';
import eraser from'../v5/tools/eraser.js?v=20260902-core-fix2';
import picker from'../v5/tools/picker.js?v=20260902-core-fix2';
import hand from'../v5/tools/hand.js?v=20260902-core-fix2';
import trace from'../v5/tools/trace.js?v=20260902-core-fix2';
import loupe from'../v5/ui/loupe.js?v=20260902-core-fix2';
import layersPanel from'../v5/ui/layers-panel.js?v=20260902-core-fix2';
import palette from'../v5/ui/palette.js?v=20260902-core-fix2';
import viewModes from'../v5/modules/view-modes.js?v=20260902-core-fix2';
import io from'../v5/modules/io.js?v=20260902-remove-kat1';
import projectIO from'../v5/modules/project-io.js?v=20260902-core-fix2';
import layerPngIO from'../v5/modules/layer-png-io.js?v=20260902-core-fix2';
import glItemIO from'../v5/modules/glitem-io.js?v=20260902-core-fix2';
import githubStorage from'../v5/modules/github-storage.js?v=20260902-core-fix2';
import githubBrowser from'../v5/modules/github-browser.js?v=20260902-core-fix2';
import viewport from'../v5/modules/viewport.js?v=20260902-core-fix2';
import loupeOverlay from'../v5/modules/loupe-overlay.js?v=20260902-core-fix2';
import loupeReference from'../v5/modules/loupe-reference.js?v=20260902-core-fix2';
import activeLayerGrid from'../v5/modules/active-layer-grid.js?v=20260902-core-fix2';
import layerLabels from'../v5/modules/layer-labels.js?v=20260902-remove-kat1';
import mobileFiles from'../v5/modules/mobile-files.js?v=20260902-remove-kat1';
import mobilePreviewGestures from'../v5/modules/mobile-preview-gestures.js?v=20260902-core-fix2';
import referenceVisibility from'../v5/modules/reference-visibility.js?v=20260902-core-fix2';
import referenceDisplay from'../v5/modules/reference-display.js?v=20260902-core-fix2';
import referenceMagic from'../v5/modules/reference-magic.js?v=20260902-core-fix2';
import referenceToBody from'../v5/modules/reference-to-body.js?v=20260902-core-fix2';
import backgroundToggle from'../v5/modules/background-toggle.js?v=20260902-core-fix2';
import mobileLayout from'./mobile-layout.js?v=20260904-v6';

const app=new PixelLabApp();
window.pixelLab=app;
installLayers(app);
installHistory(app);
installCompositor(app);
[pencil,eraser,picker,hand,trace].forEach(t=>app.registerTool(t));
[layerLabels,layerPngIO,glItemIO,viewport,layersPanel,palette,viewModes,referenceVisibility,referenceDisplay,referenceMagic,referenceToBody,backgroundToggle,loupeReference,loupe,loupeOverlay,activeLayerGrid,io,projectIO,githubStorage,githubBrowser,mobileFiles,mobilePreviewGestures,mobileLayout].forEach(m=>app.registerModule(m));

const tools=document.getElementById('tools');
for(const t of app.tools.values()){
  const b=document.createElement('button');
  b.textContent=t.label;
  b.dataset.tool=t.id;
  b.onclick=()=>app.setTool(t.id);
  tools.appendChild(b);
}
function markTool(id){[...tools.children].forEach(b=>b.classList.toggle('activeBtn',b.dataset.tool===id))}
app.on('tool:changed',markTool);
markTool(app.state.activeTool);
document.getElementById('undo').onclick=()=>app.history.undo();
const status=document.getElementById('status');
app.on('status',s=>status.textContent=s);
const validation=app.state.layerValidation;
status.textContent=validation?.repaired?'Структура слоёв восстановлена: '+validation.issues.join('; '):'V6 mobile interface ready · V5 core reused';
