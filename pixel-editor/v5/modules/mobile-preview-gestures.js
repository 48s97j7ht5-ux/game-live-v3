import{W,H}from'../core/app.js';
export default{
  id:'mobile-preview-gestures',
  mount(app){
    const stage=document.querySelector('.stage'),board=document.getElementById('board'),paint=document.getElementById('paint'),ref=document.getElementById('ref'),overlay=document.getElementById('overlay');
    if(!stage||!board||!paint||!ref||!overlay)return;
    const pointers=new Map();
    let scale=2,offsetX=0,offsetY=0,pinch=null,pan=null,tap=null,hadPinch=false;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const isMobilePreview=()=>document.body.classList.contains('pixelLabMobile')&&document.body.dataset.mobileWorkspace==='preview';
    const point=e=>({x:e.clientX,y:e.clientY});
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    function localCenter(a,b){const r=stage.getBoundingClientRect();return{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top}}
    function basePos(){return{x:board.offsetLeft||0,y:board.offsetTop||0}}
    function applyTransform(){board.style.transform=`translate3d(${offsetX}px,${offsetY}px,0)`}
    function renderScale(next){
      scale=clamp(next,.5,8);
      board.style.width=W*scale+'px';board.style.height=H*scale+'px';
      board.querySelectorAll('canvas').forEach(c=>{c.style.width=W*scale+'px';c.style.height=H*scale+'px'});
      applyTransform();
      app.emit('preview:scale',scale);
    }
    function beginPinch(){
      if(pointers.size<2)return;
      const[a,b]=[...pointers.values()].slice(0,2),c=localCenter(a,b),d=dist(a,b),base=basePos();
      if(!d)return;
      pinch={startDist:d,startScale:scale,worldX:(c.x-base.x-offsetX)/scale,worldY:(c.y-base.y-offsetY)/scale};
      pan=null;hadPinch=true;
    }
    function updatePinch(){
      if(!pinch||pointers.size<2)return;
      const[a,b]=[...pointers.values()].slice(0,2),c=localCenter(a,b),d=dist(a,b),base=basePos();
      const next=clamp(pinch.startScale*(d/pinch.startDist),.5,8);
      scale=next;
      offsetX=c.x-base.x-pinch.worldX*scale;
      offsetY=c.y-base.y-pinch.worldY*scale;
      renderScale(scale);
    }
    function moveLoupeToTap(clientX,clientY){
      const r=board.getBoundingClientRect();
      if(!r.width||!r.height)return;
      app.state.cx=clamp(Math.floor((clientX-r.left)*W/r.width),0,W-1);
      app.state.cy=clamp(Math.floor((clientY-r.top)*H/r.height),0,H-1);
      app.loupe?.draw();
      app.emit('loupe:moved',{x:app.state.cx,y:app.state.cy});
      const tool=app.activeTool();
      if(tool?.id==='picker')tool.apply(app,app.state.cx,app.state.cy);
    }
    function down(e){
      if(!isMobilePreview())return;
      e.preventDefault();e.stopPropagation();stage.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId,point(e));
      if(pointers.size===1){hadPinch=false;tap={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};pan={id:e.pointerId,x:e.clientX,y:e.clientY,offsetX,offsetY}}
      else if(pointers.size===2){if(tap)tap.moved=true;beginPinch()}
    }
    function move(e){
      if(!isMobilePreview()||!pointers.has(e.pointerId))return;
      e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,point(e));
      if(pointers.size>=2){updatePinch();return}
      if(pan&&pan.id===e.pointerId){
        const dx=e.clientX-pan.x,dy=e.clientY-pan.y;
        if(Math.hypot(dx,dy)>6&&tap)tap.moved=true;
        offsetX=pan.offsetX+dx;offsetY=pan.offsetY+dy;applyTransform();
      }
    }
    function up(e){
      if(!pointers.has(e.pointerId))return;
      const wasTap=tap&&tap.id===e.pointerId&&!tap.moved&&!hadPinch,tx=e.clientX,ty=e.clientY;
      pointers.delete(e.pointerId);
      if(wasTap)moveLoupeToTap(tx,ty);
      if(pointers.size>=2)beginPinch();
      else if(pointers.size===1){const[id,p]=[...pointers.entries()][0];pinch=null;pan={id,x:p.x,y:p.y,offsetX,offsetY};tap=null}
      else{pinch=null;pan=null;tap=null;hadPinch=false}
    }
    stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
    app.on('mobile:workspace',mode=>{pointers.clear();pinch=null;pan=null;tap=null;hadPinch=false;if(mode==='preview'){stage.scrollLeft=0;stage.scrollTop=0;renderScale(scale)}});
    app.mobilePreviewGestures={get scale(){return scale},get offset(){return{x:offsetX,y:offsetY}},setScale:v=>renderScale(v),setOffset:(x,y)=>{offsetX=x;offsetY=y;applyTransform()}};
  }
};