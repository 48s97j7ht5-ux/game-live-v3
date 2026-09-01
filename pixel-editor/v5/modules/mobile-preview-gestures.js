import{W,H}from'../core/app.js';
export default{
  id:'mobile-preview-gestures',
  mount(app){
    const stage=document.querySelector('.stage'),board=document.getElementById('board'),paint=document.getElementById('paint'),ref=document.getElementById('ref'),overlay=document.getElementById('overlay');
    if(!stage||!board||!paint||!ref||!overlay)return;
    const pointers=new Map();
    let scale=2,pinch=null,pan=null,tap=null,hadPinch=false;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const isMobilePreview=()=>document.body.classList.contains('pixelLabMobile')&&document.body.dataset.mobileWorkspace==='preview';
    const point=e=>({x:e.clientX,y:e.clientY});
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    function localCenter(a,b){const r=stage.getBoundingClientRect();return{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top}}
    function renderScale(next){
      scale=clamp(next,.5,8);
      board.style.width=W*scale+'px';board.style.height=H*scale+'px';
      [paint,ref,overlay].forEach(c=>{c.style.width=W*scale+'px';c.style.height=H*scale+'px'});
      app.emit('preview:scale',scale);
    }
    function beginPinch(){
      if(pointers.size<2)return;
      const[a,b]=[...pointers.values()].slice(0,2),c=localCenter(a,b),d=dist(a,b);
      if(!d)return;
      pinch={startDist:d,startScale:scale,worldX:(stage.scrollLeft+c.x)/scale,worldY:(stage.scrollTop+c.y)/scale};
      pan=null;hadPinch=true;
    }
    function updatePinch(){
      if(!pinch||pointers.size<2)return;
      const[a,b]=[...pointers.values()].slice(0,2),c=localCenter(a,b),d=dist(a,b);
      const next=clamp(pinch.startScale*(d/pinch.startDist),.5,8);
      renderScale(next);
      stage.scrollLeft=pinch.worldX*scale-c.x;
      stage.scrollTop=pinch.worldY*scale-c.y;
    }
    function moveLoupeToTap(clientX,clientY){
      const r=board.getBoundingClientRect();
      if(!r.width||!r.height)return;
      app.state.cx=clamp(Math.floor((clientX-r.left)*W/r.width),0,W-1);
      app.state.cy=clamp(Math.floor((clientY-r.top)*H/r.height),0,H-1);
      app.loupe?.draw();
      app.emit('loupe:moved',{x:app.state.cx,y:app.state.cy});
    }
    function down(e){
      if(!isMobilePreview())return;
      e.preventDefault();e.stopPropagation();
      stage.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId,point(e));
      if(pointers.size===1){hadPinch=false;tap={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};pan={id:e.pointerId,x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop}}
      else if(pointers.size===2){if(tap)tap.moved=true;beginPinch()}
    }
    function move(e){
      if(!isMobilePreview()||!pointers.has(e.pointerId))return;
      e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,point(e));
      if(pointers.size>=2){updatePinch();return}
      if(pan&&pan.id===e.pointerId){
        const dx=e.clientX-pan.x,dy=e.clientY-pan.y;
        if(Math.hypot(dx,dy)>6&&tap)tap.moved=true;
        stage.scrollLeft=pan.left-dx;stage.scrollTop=pan.top-dy;
      }
    }
    function up(e){
      if(!pointers.has(e.pointerId))return;
      const wasTap=tap&&tap.id===e.pointerId&&!tap.moved&&!hadPinch;
      const tx=e.clientX,ty=e.clientY;
      pointers.delete(e.pointerId);
      if(wasTap)moveLoupeToTap(tx,ty);
      if(pointers.size>=2)beginPinch();
      else if(pointers.size===1){const[id,p]=[...pointers.entries()][0];pinch=null;pan={id,x:p.x,y:p.y,left:stage.scrollLeft,top:stage.scrollTop};tap=null}
      else{pinch=null;pan=null;tap=null;hadPinch=false}
    }
    stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
    app.on('mobile:workspace',mode=>{pointers.clear();pinch=null;pan=null;tap=null;hadPinch=false;if(mode==='preview')renderScale(scale)});
    app.mobilePreviewGestures={get scale(){return scale},setScale:v=>renderScale(v)};
  }
};