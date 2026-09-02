const RU={
  hair_back:'Задние',
  hair_front:'Передние',
  body_base:'Цельное тело',
  body_legs:'Основа',
  body_torso:'Основа',
  body_arms:'Основа',
  body_details:'Свет и тени',
  head_base:'Основа головы',
  face_eyes:'Глаза',
  face_brows:'Брови',
  face_nose:'Нос',
  face_mouth:'Рот',
  underwear_top:'Верх',
  underwear_bottom:'Низ',
  hosiery_base:'Колготки / чулки',
  socks_base:'Носки / гольфы',
  undershirt_base:'Майка / нижний верх',
  clothes_upper_base:'Верх',
  clothes_lower_base:'Низ',
  clothes_onepiece_base:'Цельная вещь',
  clothes_midlayer_base:'Дополнительная',
  clothes_outerwear_base:'Верхняя одежда',
  footwear_base:'Обувь',
  headwear_base:'Головной убор',
  eyewear_base:'Очки',
  ear_accessories_base:'Серьги',
  neck_accessories_base:'Украшение / шарф',
  handwear_base:'Перчатки',
  wrist_accessories_base:'Часы / браслет',
  accessories_front:'Прочее',
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
