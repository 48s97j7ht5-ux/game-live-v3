const REPOSITORY='48s97j7ht5-ux/game-live-v3';
const BRANCH='main';
const API='https://api.github.com';
const TOKEN_FORMAT='game-live-github-token';
const TOKEN_VERSION=1;
const TOKEN_URL='https://github.com/settings/personal-access-tokens/new?name=Game%20Live%20Editor&description=Save%20Game%20Live%20assets%20from%20the%20mobile%20editor&target_name=48s97j7ht5-ux&expires_in=90&contents=write';

const safePart=value=>String(value||'item').trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||'item';
const download=(blob,name)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};

function bytesBase64(bytes){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('не удалось подготовить файл'));reader.readAsDataURL(new Blob([bytes]))});
}

function githubError(status,message=''){
  if(status===401)return new Error('GitHub не принял токен');
  if(status===403)return new Error('токену не хватает разрешения Contents: Read and write');
  if(status===404)return new Error('репозиторий не найден или токен не имеет к нему доступа');
  return new Error(`GitHub ответил ${status}${message?' · '+message:''}`);
}

export function tokenDocument(token){return{format:TOKEN_FORMAT,version:TOKEN_VERSION,repository:REPOSITORY,token}}
export function itemPath(manifest){return`game-assets/items/${safePart(manifest?.slot)}/${safePart(manifest?.id)}.glitem`}
export function projectPath(name){return`game-assets/projects/${safePart(name)}.glproject`}

export default{
  id:'github-storage',
  mount(app){
    const input=document.getElementById('githubTokenFile');
    const connectButton=document.getElementById('githubConnect');
    const projectButton=document.getElementById('githubSaveProject');
    const itemButton=document.getElementById('githubSaveItem');
    let token=null,projectName='';

    function setState(connected){
      if(connectButton)connectButton.textContent=connected?'GitHub ✓':'GitHub key';
      document.querySelectorAll('[data-files="github-state"]').forEach(node=>node.textContent=connected?'Подключён · ключ только в памяти':'Не подключён');
      app.emit('github:connection',connected);
    }
    async function api(path,options={},key=token){
      if(!key)throw new Error('сначала подключите .gltoken');
      const response=await fetch(API+path,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${key}`,'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})}});
      let body=null;try{body=await response.json()}catch{}
      if(!response.ok)throw githubError(response.status,body?.message);return body;
    }
    async function validateToken(key){
      const repo=await api(`/repos/${REPOSITORY}`,{},key);
      if(repo?.full_name?.toLowerCase()!==REPOSITORY.toLowerCase())throw new Error('токен подключён не к тому репозиторию');return true;
    }
    async function connectKey(key){
      const clean=String(key||'').trim();if(!clean.startsWith('github_pat_'))throw new Error('нужен Fine-grained token, начинающийся с github_pat_');
      await validateToken(clean);token=clean;setState(true);app.emit('status','GitHub подключён · ключ хранится только до закрытия вкладки');return true;
    }
    async function makeTokenFile(){
      const value=prompt('Вставьте Fine-grained token GitHub. Он должен начинаться с github_pat_');if(value==null)return false;
      await connectKey(value);
      const document=tokenDocument(token);download(new Blob([JSON.stringify(document,null,2)],{type:'application/json'}),'game-live.gltoken');
      app.emit('status','.gltoken создан и GitHub подключён');return true;
    }
    async function loadTokenFile(file){
      if(!file)return false;if(file.size>16384)throw new Error('.gltoken слишком большой');
      let document;try{document=JSON.parse(await file.text())}catch{throw new Error('не удалось прочитать .gltoken')}
      if(document?.format!==TOKEN_FORMAT||document?.version!==TOKEN_VERSION||document?.repository!==REPOSITORY)throw new Error('это не ключ Game Live для нужного репозитория');
      return connectKey(document.token);
    }
    function openTokenPicker(){if(input){input.value='';input.click()}}
    function openTokenPage(){window.open(TOKEN_URL,'_blank','noopener')}
    function disconnect(){token=null;setState(false);app.emit('status','GitHub отключён, ключ удалён из памяти')}
    async function put(path,bytes,message){
      let sha;try{sha=(await api(`/repos/${REPOSITORY}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`))?.sha}catch(error){if(!/не найден/.test(error.message))throw error}
      const body={message,content:await bytesBase64(bytes),branch:BRANCH};if(sha)body.sha=sha;
      return api(`/repos/${REPOSITORY}/contents/${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }
    async function saveItem(){
      if(!token)throw new Error('сначала подключите .gltoken');const item=await app.glItemIO?.build();if(!item)return false;
      const path=itemPath(item.manifest);await put(path,item.bytes,`Save ${item.manifest.id} game item`);app.mobileLayout?.closeSheet?.();app.emit('status',`GitHub сохранён · ${path}`);return path;
    }
    async function saveProject(){
      if(!token)throw new Error('сначала подключите .gltoken');if(!projectName){const value=prompt('Имя проекта в GitHub','kat-base');if(value==null)return false;projectName=safePart(value)}
      const project=app.projectIO?.serialize();if(!project)throw new Error('проект пока не готов к сохранению');
      const path=projectPath(projectName),bytes=new TextEncoder().encode(JSON.stringify(project));await put(path,bytes,`Save ${projectName} editor project`);app.mobileLayout?.closeSheet?.();app.emit('status',`GitHub сохранён · ${path}`);return path;
    }
    const safely=action=>()=>action().catch(error=>app.emit('status','Ошибка GitHub: '+error.message));
    if(input)input.onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(file)safely(()=>loadTokenFile(file))()};
    if(connectButton)connectButton.onclick=openTokenPicker;
    if(projectButton)projectButton.onclick=safely(saveProject);
    if(itemButton)itemButton.onclick=safely(saveItem);
    app.githubStorage={openTokenPage,makeTokenFile,openTokenPicker,loadTokenFile,disconnect,saveItem,saveProject,get connected(){return!!token},repository:REPOSITORY};setState(false);
  }
};
