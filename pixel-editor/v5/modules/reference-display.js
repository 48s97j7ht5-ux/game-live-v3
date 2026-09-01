export default{
  id:'reference-display',
  mount(app){
    const ref=document.getElementById('ref');
    const opacity=document.getElementById('refOpacity');
    if(!ref)return;
    let raw=false;
    let dimAlpha=Math.max(0,Math.min(1,(+(opacity?.value??25))/100));
    function effectiveAlpha(){return raw?1:dimAlpha}
    function apply(){
      ref.style.opacity=String(effectiveAlpha());
      app.loupe?.draw();
      app.emit('reference:display',{raw,alpha:effectiveAlpha(),dimAlpha});
    }
    function setRaw(v){raw=!!v;apply()}
    function toggleRaw(){setRaw(!raw)}
    function setDimAlpha(v){dimAlpha=Math.max(0,Math.min(1,+v||0));apply()}
    app.on('reference:opacity',setDimAlpha);
    app.referenceDisplay={get raw(){return raw},get dimAlpha(){return dimAlpha},get alpha(){return effectiveAlpha()},setRaw,toggleRaw,setDimAlpha};
    apply();
  }
};
