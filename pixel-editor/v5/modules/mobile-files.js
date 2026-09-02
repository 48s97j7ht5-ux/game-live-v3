export default{
  id:'mobile-files',
  mount(app){
    const panel=document.createElement('div');
    panel.className='mobileFilesPanel card';
    panel.innerHTML=`
      <div class="mobileFilesHead"><b>Файлы</b><button data-files="close">✕</button></div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Проект</div>
        <button data-files="project-open">📂 Продолжить проект</button>
        <button data-files="project-save">💾 Сохранить проект</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Игровой элемент</div>
        <button data-files="item-open">📦 Загрузить .glitem</button>
        <button data-files="item-save">💾 Сохранить слой как .glitem</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">GitHub</div>
        <div class="small" data-files="github-state">Не подключён</div>
        <button data-files="github-help">1. Получить токен GitHub</button>
        <button data-files="github-make-key">2. Создать .gltoken</button>
        <button data-files="github-connect">🔑 Подключить .gltoken</button>
        <button data-files="github-browser">📂 Проводник GitHub</button>
        <button data-files="github-save-project">☁️ Сохранить проект в GitHub</button>
        <button data-files="github-save-item">☁️ Сохранить активный .glitem в GitHub</button>
        <button data-files="github-disconnect">Отключить GitHub</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Открыть изображение</div>
        <button data-files="sprite">🖼️ Открыть composite</button>
        <button data-files="ref">🧷 Открыть подложку</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Экспорт PNG</div>
        <button data-files="export">💾 Сохранить composite</button>
        <button data-files="export-layer">📄 Сохранить активный слой</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">История</div>
        <button data-files="undo">↶ Undo</button>
      </div>`;
    document.body.appendChild(panel);
    const click=id=>document.getElementById(id)?.click();
    panel.querySelector('[data-files="project-open"]').onclick=()=>app.projectIO?.openPicker();
    panel.querySelector('[data-files="project-save"]').onclick=()=>app.projectIO?.save();
    panel.querySelector('[data-files="item-open"]').onclick=()=>app.glItemIO?.openPicker();
    panel.querySelector('[data-files="item-save"]').onclick=()=>app.glItemIO?.save().catch(error=>app.emit('status','Ошибка .glitem: '+error.message));
    panel.querySelector('[data-files="github-help"]').onclick=()=>app.githubStorage?.openTokenPage();
    panel.querySelector('[data-files="github-make-key"]').onclick=()=>app.githubStorage?.makeTokenFile().catch(error=>app.emit('status','Ошибка GitHub: '+error.message));
    panel.querySelector('[data-files="github-connect"]').onclick=()=>app.githubStorage?.openTokenPicker();
    panel.querySelector('[data-files="github-browser"]').onclick=()=>app.githubBrowser?.open();
    panel.querySelector('[data-files="github-save-project"]').onclick=()=>app.githubStorage?.saveProject().catch(error=>app.emit('status','Ошибка GitHub: '+error.message));
    panel.querySelector('[data-files="github-save-item"]').onclick=()=>app.githubStorage?.saveItem().catch(error=>app.emit('status','Ошибка GitHub: '+error.message));
    panel.querySelector('[data-files="github-disconnect"]').onclick=()=>app.githubStorage?.disconnect();
    panel.querySelector('[data-files="sprite"]').onclick=()=>click('spriteFile');
    panel.querySelector('[data-files="ref"]').onclick=()=>click('refFile');
    panel.querySelector('[data-files="export"]').onclick=()=>click('export');
    panel.querySelector('[data-files="export-layer"]').onclick=()=>click('exportLayer');
    panel.querySelector('[data-files="undo"]').onclick=()=>app.history?.undo();
    app.mobileFiles={panel,closeButton:panel.querySelector('[data-files="close"]')};
  }
};
