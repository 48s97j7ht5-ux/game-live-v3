import{W,H}from'../core/app.js';
export default{
  id:'mobile-preview-gestures',
  mount(app){
    const stage=document.querySelector('.stage'),board=document.getElementById('board'),paint=document.getElementById('paint'),ref=document.getElementById('ref'),overlay=document.getElementById('overlay');
    if(!stage||!board||!paint||!ref||!overlay)return;
    const pointers=new Map();
    let scale=2,startScale=2,startDist=0,startCenter=null,startScroll=null,panStart=null;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const isMobilePreview=()=>document.body.classList.contains('pixelLabMobile')&&document.body.dataset.mobileWorkspace==='preview';
    function applyScale(next,anchor){
      next=clamp(next,.5,8);
      const old=scale||1;
      const ax=anchor?.x??stage.clientWidth/2,ay=anchor?.y??stage.clientHeight/2;
      const contentX=(stage.scrollLeft+ax)/old,contentY=(stage.scrollTop+ay)/old;
      scale=next;
      board.style.width=W*scale+'px';board.style.height=H*scale+'px';
      [paint,ref,overlay].forEach(c=>{c.style.width=W*scale+'px';c.style.height=H*scale+'px'});
      stage.scrollLeft=contentX*scale-ax;stage.scrollTop=contentY*scale-ay;
      app.emit('preview:scale',scale);
    }
    function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
    function center(a,b){const r=stage.getBoundingClientRect();return{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top}}
    function down(e){
      if(!isMobilePreview())return;
      e.preventDefault();e.stopPropagation();stage.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===1){panStart={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop}}
      else if(pointers.size===2){const[a,b]=[...pointers.values()];startDist=dist(a,b);startScale=scale;startCenter=center(a,b);startScroll={left:stage.scrollLeft,top:stage.scrollTop};panStart=null}
    }
    function move(e){
      if(!isMobilePreview()||!pointers.has(e.pointerId))return;
      e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size>=2){const[a,b]=[...pointers.values()];const d=dist(a,b);if(startDist>0)applyScale(startScale*(d/startDist),startCenter)}
      else if(pointers.size===1&&panStart){stage.scrollLeft=panStart.left-(e.clientX-panStart.x);stage.scrollTop=panStart.top-(e.clientY-panStart.y)}
    }
    function up(e){
      if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);
      if(pointers.size===1){const p=[...pointers.values()][0];panStart={x:p.x,y:p.y,left:stage.scrollLeft,top:stage.scrollTop}}
      else if(!pointers.size){panStart=null;startDist=0}
    }
    stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
    app.on('mobile:workspace',mode=>{if(mode==='preview'){pointers.clear();panStart=null;applyScale(scale)}else pointers.clear()});
    app.mobilePreviewGestures={get scale(){return scale},setScale:v=>applyScale(v)};
  }
};