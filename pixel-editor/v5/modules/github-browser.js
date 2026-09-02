const supported=name=>/\.(glitem|glproject|pixelproject)$/i.test(name||'');
const prettySize=size=>size<1024?`${size||0} Б`:size<1024*1024?`${Math.ceil(size/1024)} КБ`:`${(size/1024/1024).toFixed(1)} МБ`;

export default{
  id:'github-browser',
  mount(app){
    const scrim=document.createElement('div');scrim.className='githubBrowserScrim';
    const panel=document.createElement('section');panel.className='githubBrowserPanel card';panel.setAttribute('aria-label','Проводник GitHub');
    panel.innerHTML=`
      <div class="githubBrowserHead"><b>GitHub · game-live-v3</b><button data-gb="close">✕</button></div>
      <div class="githubBrowserPlaces">
        <button data-gb-place="">🏠 Репозиторий</button><button data-gb-place="game-assets/items">📦 Items</button><button data-gb-place="game-assets/projects">🗂 Projects</button>
      </div>
      <div class="githubBrowserPath"><button data-gb="up">⬆️</button><input data-gb="path" aria-label="Путь GitHub"><button data-gb="go">Открыть</button><button data-gb="refresh">↻</button></div>
      <div class="githubBrowserList" data-gb="list"></div>
      <div class="githubBrowserSave">
        <label>Имя файла<input data-gb="name" aria-label="Имя файла GitHub"></label>
        <button data-gb="save-item">💾 Активный слой → .glitem</button>
        <button data-gb="save-project">💾 Проект → .glproject</button>
      </div>
      <div class="small" data-gb="note">Папка создастся при первом сохранении файла.</div>`;
    document.body.append(scrim,panel);
    const list=panel.querySelector('[data-gb="list"]'),pathInput=panel.querySelector('[data-gb="path"]'),nameInput=panel.querySelector('[data-gb="name"]');
    let currentPath='game-assets',busy=false;

    function close(){panel.classList.remove('show');scrim.classList.remove('show')}
    function setBusy(value){busy=value;panel.classList.toggle('busy',value);panel.querySelectorAll('button,input').forEach(node=>node.disabled=value)}
    function message(text){list.replaceChildren();const node=document.createElement('div');node.className='githubBrowserEmpty';node.textContent=text;list.appendChild(node)}
    async function run(action){if(busy)return false;setBusy(true);try{return await action()}catch(error){app.emit('status','Ошибка GitHub: '+error.message);message('Ошибка: '+error.message);return false}finally{setBusy(false)}}
    async function refresh(next=currentPath){
      return run(async()=>{
        currentPath=app.githubStorage.repoPath(next);pathInput.value=currentPath;message('Загрузка…');
        const entries=await app.githubStorage.listDirectory(currentPath);list.replaceChildren();
        if(!entries.length){message('Папка пока пустая или ещё не создана');return entries}
        for(const entry of entries){
          const button=document.createElement('button');button.className='githubBrowserEntry '+(entry.type==='dir'?'folder':'file');
          const name=document.createElement('span');name.textContent=(entry.type==='dir'?'📁 ':'📄 ')+entry.name;button.appendChild(name);
          if(entry.type!=='dir'){const size=document.createElement('small');size.textContent=prettySize(entry.size);button.appendChild(size);if(!supported(entry.name))button.classList.add('unsupported')}
          button.onclick=()=>entry.type==='dir'?refresh(entry.path):openFile(entry);list.appendChild(button);
        }
        return entries;
      });
    }
    async function openFile(entry){
      if(!supported(entry.name)){app.emit('status','Этот тип файла редактор не открывает');return false}
      if(/\.(glproject|pixelproject)$/i.test(entry.name)&&!confirm(`Открыть проект ${entry.name}? Текущий проект будет заменён.`))return false;
      return run(async()=>{message(`Открываю ${entry.name}…`);await app.githubStorage.loadFromPath(entry.path);close();return true});
    }
    function defaultName(kind){
      if(kind==='project')return'kat-base.glproject';
      const layer=app.layers.active(),id=layer?.itemMeta?.id||layer?.id||'item';return`${id}.glitem`;
    }
    async function save(kind){
      const proposed=nameInput.value.trim()||defaultName(kind);
      const saved=await run(()=>kind==='item'?app.githubStorage.saveItemTo(currentPath,proposed):app.githubStorage.saveProjectTo(currentPath,proposed));
      if(saved){nameInput.value=saved.split('/').pop();await refresh(currentPath)}return saved;
    }
    function open(kind='browse'){
      if(!app.githubStorage?.connected){app.emit('status','Сначала подключите .gltoken');return false}
      app.mobileLayout?.closeSheet?.();panel.classList.add('show');scrim.classList.add('show');
      if(kind==='project')currentPath='game-assets/projects';else if(kind==='item'){const slot=app.layers.active()?.slot||'items';currentPath=`game-assets/items/${slot}`}else currentPath=currentPath||'game-assets';
      nameInput.value=defaultName(kind==='project'?'project':'item');refresh(currentPath);return true;
    }

    panel.querySelector('[data-gb="close"]').onclick=close;scrim.onclick=close;
    panel.querySelector('[data-gb="up"]').onclick=()=>{const parts=currentPath.split('/').filter(Boolean);parts.pop();refresh(parts.join('/'))};
    panel.querySelector('[data-gb="go"]').onclick=()=>refresh(pathInput.value);
    panel.querySelector('[data-gb="refresh"]').onclick=()=>refresh(currentPath);
    pathInput.onkeydown=event=>{if(event.key==='Enter')refresh(pathInput.value)};
    panel.querySelectorAll('[data-gb-place]').forEach(button=>button.onclick=()=>refresh(button.dataset.gbPlace));
    panel.querySelector('[data-gb="save-item"]').onclick=()=>save('item');panel.querySelector('[data-gb="save-project"]').onclick=()=>save('project');
    document.getElementById('githubFiles')?.addEventListener('click',()=>open());
    app.githubBrowser={open,close,refresh,get path(){return currentPath}};
  }
};
