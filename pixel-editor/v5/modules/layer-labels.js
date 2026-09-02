const RU={
  hair_back:'Задние',
  hair_front:'Передние',
  body_legs:'Основа',
  body_torso:'Основа',
  body_arms:'Основа',
  head_base:'Основа головы',
  face_eyes:'Глаза',
  face_brows:'Брови',
  face_nose:'Нос',
  face_mouth:'Рот',
  underwear_base:'Основа',
  clothes_upper_base:'Основа',
  clothes_lower_base:'Основа',
  clothes_onepiece_base:'Основа',
  clothes_outerwear_base:'Основа',
  footwear_base:'Основа',
  accessories_base:'Основа',
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
