const RU={
  body_base:'Тело',
  body_details:'Детали тела',
  face_eyes:'Глаза',
  face_brows:'Брови',
  face_nose:'Нос',
  face_mouth:'Рот',
  hair_back:'Волосы сзади',
  onepiece:'Одежда',
  hair_front:'Волосы спереди',
  kat_v1_1_composite:'Кэт V1.1',
  composite_import:'Импорт'
};
export default{
  id:'layer-labels',
  mount(app){
    app.layerLabels={
      get(name){
        if(RU[name])return RU[name];
        if(/^layer_\d+$/.test(name))return 'Слой '+name.split('_')[1];
        if(name.endsWith('_copy'))return this.get(name.slice(0,-5))+' копия';
        return name;
      },
      dictionary:RU
    };
  }
};
