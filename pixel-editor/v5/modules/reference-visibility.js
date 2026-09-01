export default{
  id:'reference-visibility',
  mount(app){
    const ref=document.getElementById('ref');
    if(!ref)return;
    let visible=true;
    function apply(){
      ref.style.visibility=visible?'visible':'hidden';
      app.loupe?.draw();
      app.backgroundToggle?.renderMask?.();
      app.emit('reference:visibility',visible);
    }
    function setVisible(v){visible=!!v;apply()}
    function toggle(){setVisible(!visible)}
    app.referenceVisibility={get visible(){return visible},setVisible,toggle};
    apply();
  }
};