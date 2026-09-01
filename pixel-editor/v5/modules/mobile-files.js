export default{
  id:'mobile-files',
  mount(app){
    const panel=document.createElement('div');
    panel.className='mobileFilesPanel card';
    panel.innerHTML=`
      <div class="mobileFilesHead"><b>Файлы</b><button data-files="close">✕</button></div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Открыть</div>
        <button data-files="sprite">🖼️ Открыть composite</button>
        <button data-files="ref">🧷 Открыть подложку</button>
        <button data-files="kat">👤 Загрузить Kat V1.1</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">Сохранить</div>
        <button data-files="export">💾 Сохранить composite</button>
        <button data-files="export-layer">📄 Сохранить активный слой</button>
      </div>
      <div class="mobileFilesSection"><div class="mobileFilesTitle">История</div>
        <button data-files="undo">↶ Undo</button>
      </div>`;
    document.body.appendChild(panel);
    const click=id=>document.getElementById(id)?.click();
    panel.querySelector('[data-files="sprite"]').onclick=()=>click('spriteFile');
    panel.querySelector('[data-files="ref"]').onclick=()=>click('refFile');
    panel.querySelector('[data-files="kat"]').onclick=()=>click('loadKat');
    panel.querySelector('[data-files="export"]').onclick=()=>click('export');
    panel.querySelector('[data-files="export-layer"]').onclick=()=>click('exportLayer');
    panel.querySelector('[data-files="undo"]').onclick=()=>app.history?.undo();
    app.mobileFiles={panel,closeButton:panel.querySelector('[data-files="close"]')};
  }
};