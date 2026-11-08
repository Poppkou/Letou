'use strict';
// Все игровые данные: оружие, предметы, классы, роли NPC, черты, районы.

// kind: melee | gun | throw
G.WEAPONS = {
  fist:    { name: 'Кулаки', kind: 'melee', dmg: 6, cd: 0.35, range: 0.95, arc: 1.4, knock: 2, noise: 3, price: 0, icon: '✊' },
  knife:   { name: 'Заточка', kind: 'melee', dmg: 11, cd: 0.30, range: 0.95, arc: 1.1, knock: 1, noise: 2, dur: 60, sneak: 3, price: 35, icon: '🔪' },
  bat:     { name: 'Бита', kind: 'melee', dmg: 15, cd: 0.55, range: 1.25, arc: 1.6, knock: 5, noise: 4, dur: 45, price: 40, icon: '🏏' },
  pipe:    { name: 'Труба', kind: 'melee', dmg: 18, cd: 0.65, range: 1.25, arc: 1.5, knock: 5, noise: 5, dur: 55, price: 45, icon: '🔧' },
  knuckle: { name: 'Кастет', kind: 'melee', dmg: 10, cd: 0.25, range: 0.95, arc: 1.2, knock: 3, noise: 3, dur: 120, price: 30, icon: '👊' },
  machete: { name: 'Мачете', kind: 'melee', dmg: 24, cd: 0.5, range: 1.3, arc: 1.5, knock: 3, noise: 3, dur: 50, price: 80, icon: '🗡' },
  sledge:  { name: 'Кувалда', kind: 'melee', dmg: 34, cd: 1.0, range: 1.4, arc: 1.7, knock: 10, noise: 7, dur: 40, door: 3, price: 90, icon: '🔨' },

  taser:   { name: 'Шокер', kind: 'gun', dmg: 3, cd: 0.8, range: 6, ammo: 8, spread: 0.04, speed: 14, noise: 2, stun: 3, color: '#7df', price: 60, icon: '⚡' },
  pistol:  { name: 'Пистолет', kind: 'gun', dmg: 12, cd: 0.32, range: 11, ammo: 18, spread: 0.07, speed: 22, noise: 11, color: '#ffd76a', price: 70, icon: '🔫' },
  sawn:    { name: 'Обрез', kind: 'gun', dmg: 7, pellets: 6, cd: 0.85, range: 6, ammo: 8, spread: 0.32, speed: 18, noise: 13, knock: 4, color: '#ffb35a', price: 100, icon: '💥' },
  smg:     { name: 'ПП «Шмель»', kind: 'gun', dmg: 7, cd: 0.085, range: 10, ammo: 60, spread: 0.14, speed: 22, noise: 12, color: '#ffe08a', price: 150, icon: '🔫' },
  rifle:   { name: 'Винтовка', kind: 'gun', dmg: 34, cd: 1.0, range: 16, ammo: 10, spread: 0.015, speed: 34, noise: 15, knock: 4, color: '#fff2b0', price: 170, icon: '🎯' },
  flamer:  { name: 'Огнемёт', kind: 'gun', dmg: 2, cd: 0.05, range: 4, ammo: 120, spread: 0.25, speed: 8, life: 0.45, noise: 6, fire: 1, color: '#ff7a2a', price: 180, icon: '🔥' },
  rocket:  { name: 'Ракетница', kind: 'gun', dmg: 10, cd: 1.3, range: 14, ammo: 3, spread: 0.02, speed: 11, noise: 14, explode: 2.4, color: '#ddd', price: 220, icon: '🚀' },

  grenade: { name: 'Граната', kind: 'throw', dmg: 0, cd: 0.8, range: 8, ammo: 1, explode: 2.3, fuse: 1.3, noise: 0, price: 50, icon: '💣' },
  molotov: { name: 'Коктейль', kind: 'throw', dmg: 0, cd: 0.8, range: 7, ammo: 1, firebomb: 1.8, noise: 4, price: 40, icon: '🍾' },
  smoke:   { name: 'Дымовуха', kind: 'throw', dmg: 0, cd: 0.8, range: 8, ammo: 1, smoke: 2.6, noise: 2, price: 30, icon: '☁️' }
};

// Расходники и инструменты. use: что делает при применении
G.ITEMS = {
  burger:   { name: 'Бургер', desc: 'Восстанавливает 25 здоровья.', heal: 25, price: 20, icon: '🍔' },
  beer:     { name: 'Пиво', desc: '+12 здоровья, но рука дрожит 10 с.', heal: 12, drunk: 10, price: 12, icon: '🍺' },
  medkit:   { name: 'Аптечка', desc: 'Восстанавливает 70 здоровья.', heal: 70, price: 70, icon: '🩹' },
  energy:   { name: 'Энергетик', desc: 'Скорость +50% на 12 с.', speed: 12, price: 30, icon: '🥤' },
  shadowvial:{ name: 'Сыворотка-тень', desc: 'Невидимость на 12 с.', invis: 12, price: 110, icon: '🧪' },
  armor:    { name: 'Бронежилет', desc: 'Даёт 40 брони.', armor: 40, price: 90, icon: '🦺' },
  lockpick: { name: 'Отмычка', desc: 'Вскрывает запертую дверь или сейф.', tool: 'lock', price: 25, icon: '🗝' },
  hackchip: { name: 'Хак-чип', desc: 'Позволяет один раз взломать устройство.', tool: 'hack', price: 40, icon: '💾' },
  c4:       { name: 'Взрывчатка', desc: 'Закладка: взрыв через 3 с, ломает стены.', place: 1, price: 80, icon: '🧨' },
  ammo:     { name: 'Патроны', desc: 'Пополняет обойму текущего огнестрела.', ammoPack: 1, price: 30, icon: '📦' },
  package:  { name: 'Посылка', desc: 'Её нужно доставить адресату.', quest: 1, icon: '📦' },
  docs:     { name: 'Компромат', desc: 'Папка с бумагами для заказчика.', quest: 1, icon: '📁' },
  blueprint:{ name: 'Чертежи', desc: 'Секретные чертежи. Заказчик ждёт.', quest: 1, icon: '📐' },
  ingot:    { name: 'Слиток', desc: 'Тяжёлый и блестящий.', quest: 1, icon: '🥇' }
};

// Классы игрока — все оригинальные
G.CLASSES = [
  { id: 'brute', name: 'Кувалда', color: '#c44', hat: 'band', desc: 'Здоровяк из доков. Много здоровья, сильные удары, ломает двери плечом.',
    hp: 130, speed: 1.0, melee: 1.4, acc: 0.85, stealth: 0.6, money: 30,
    start: [['pipe'], ['burger', 2]], ability: 'ram',
    abilityName: 'Таран', abilityDesc: 'Рывок вперёд: сбивает с ног всех на пути и выбивает двери.' },
  { id: 'hacker', name: 'Глитч', color: '#2bd18f', hat: 'hood', desc: 'Сетевой взломщик. Хакает терминалы, турели, двери и сигнализации на расстоянии.',
    hp: 75, speed: 1.05, melee: 0.8, acc: 1.0, stealth: 0.9, money: 60,
    start: [['taser'], ['energy', 1]], ability: 'hack',
    abilityName: 'Удалённый взлом', abilityDesc: 'Взламывает ближайшее устройство в радиусе 8 клеток.' },
  { id: 'thief', name: 'Тень', color: '#6a6aff', hat: 'cap', desc: 'Карманница и взломщица. Тихая, быстрая, удары в спину втрое сильнее.',
    hp: 80, speed: 1.15, melee: 1.0, acc: 0.9, stealth: 1.4, money: 40,
    start: [['knife'], ['lockpick', 3]], ability: 'cloak',
    abilityName: 'Тень', abilityDesc: 'Невидимость на 6 секунд. Атака из невидимости — крит.' },
  { id: 'merc', name: 'Ворона', color: '#333', hat: 'beret', desc: 'Наёмница. Метко стреляет и может замедлить время.',
    hp: 100, speed: 1.0, melee: 1.0, acc: 1.3, stealth: 0.8, money: 30,
    start: [['pistol', 36], ['sawn', 8], ['armor', 1]], ability: 'focus',
    abilityName: 'Боевой транс', abilityDesc: 'Мир замедляется на 4 секунды.' },
  { id: 'baron', name: 'Барон', color: '#d4a017', hat: 'top', desc: 'Делец. Богат, подкупает дешевле, умеет убеждать и вербовать.',
    hp: 85, speed: 1.0, melee: 0.9, acc: 0.9, stealth: 0.9, money: 220,
    start: [['knuckle']], ability: 'persuade',
    abilityName: 'Убеждение', abilityDesc: 'Ближайший NPC становится другом; друг — вступает в отряд.' },
  { id: 'bomber', name: 'Фитиль', color: '#e07a1f', hat: 'goggles', desc: 'Подрывник. Гранаты сами собираются в кармане, взрывы ранят его вдвое слабее.',
    hp: 95, speed: 1.0, melee: 1.0, acc: 0.95, stealth: 0.7, money: 30,
    start: [['bat'], ['grenade', 2], ['c4', 1]], ability: 'bomb',
    abilityName: 'Самодельная бомба', abilityDesc: 'Бросает бесплатную гранату.' }
];

// Роли NPC
// fac: фракция; coward: склонность бежать; private: владелец здания
G.ROLES = {
  civ:      { name: 'Житель', hp: 40, fac: 'civ', coward: 0.9, speed: 0.85, weapons: ['fist'], color: '#8a9bb0', hat: 'none', money: [3, 15] },
  worker:   { name: 'Работяга', hp: 55, fac: 'civ', coward: 0.6, speed: 0.85, weapons: ['fist', 'pipe'], color: '#a77b4b', hat: 'helmet', money: [5, 20] },
  rich:     { name: 'Богач', hp: 40, fac: 'civ', coward: 1, speed: 0.8, weapons: ['fist'], color: '#f2f2f2', hat: 'top', money: [30, 80] },
  shop:     { name: 'Торговец', hp: 70, fac: 'shop', coward: 0.3, speed: 0.8, weapons: ['sawn'], color: '#3f8f4f', hat: 'cap', money: [20, 50] },
  bartender:{ name: 'Бармен', hp: 60, fac: 'shop', coward: 0.4, speed: 0.8, weapons: ['bat'], color: '#7a3f8f', hat: 'none', money: [15, 40] },
  bouncer:  { name: 'Вышибала', hp: 110, fac: 'shop', coward: 0, speed: 0.85, weapons: ['fist'], strength: 1.8, color: '#222', hat: 'none', money: [10, 20] },
  cop:      { name: 'Патрульный', hp: 75, fac: 'cop', coward: 0, speed: 0.95, weapons: ['pistol'], color: '#2a4fbf', hat: 'police', money: [5, 25] },
  supercop: { name: 'Спецназ', hp: 120, fac: 'cop', coward: 0, speed: 1.0, weapons: ['smg'], color: '#14245c', hat: 'helmet', money: [10, 30], armor: 40 },
  rust:     { name: '«Ржавый»', hp: 55, fac: 'rust', coward: 0.15, speed: 0.95, weapons: ['bat', 'knife', 'pistol', 'pipe'], color: '#b5461e', hat: 'band', money: [5, 30] },
  neon:     { name: '«Неоновый»', hp: 55, fac: 'neon', coward: 0.15, speed: 0.95, weapons: ['knife', 'bat', 'pistol', 'knuckle'], color: '#d63fd0', hat: 'mohawk', money: [5, 30] },
  guard:    { name: 'Охранник', hp: 80, fac: 'guard', coward: 0, speed: 0.95, weapons: ['pistol', 'smg'], color: '#4b5a3a', hat: 'cap', money: [10, 30], armor: 15 },
  scientist:{ name: 'Лаборант', hp: 35, fac: 'lab', coward: 1, speed: 0.85, weapons: ['fist'], color: '#e8f4ff', hat: 'none', money: [10, 30] },
  bum:      { name: 'Бродяга', hp: 30, fac: 'bum', coward: 0.7, speed: 0.75, weapons: ['fist', 'knife'], color: '#6b6150', hat: 'beanie', money: [0, 4] },
  prisoner: { name: 'Пленник', hp: 50, fac: 'civ', coward: 1, speed: 0.95, weapons: ['fist'], color: '#d8c47a', hat: 'none', money: [0, 0] },
  boss:     { name: 'Хозяин Города', hp: 380, fac: 'boss', coward: 0, speed: 0.9, weapons: ['smg'], color: '#111', hat: 'crown', money: [300, 300], armor: 80, boss: 1 },
  turret:   { name: 'Турель', hp: 90, fac: 'guard', coward: 0, speed: 0, weapons: ['smg'], color: '#556', hat: 'none', money: [0, 0], turret: 1 }
};

// Кто кого ненавидит изначально (между NPC)
G.FAC_HOSTILE = {
  rust: { neon: 1 }, neon: { rust: 1 },
  boss: {}, cop: {}, guard: {}, civ: {}, shop: {}, lab: {}, bum: {}
};

// Черты (выдаются при повышении уровня)
G.TRAITS = [
  { id: 'tough', name: 'Толстая шкура', desc: '+25 к максимуму здоровья.' },
  { id: 'fast', name: 'Быстрые ноги', desc: '+12% к скорости бега.' },
  { id: 'aim', name: 'Твёрдая рука', desc: 'Разброс при стрельбе −35%.' },
  { id: 'heavy', name: 'Тяжёлый удар', desc: '+30% урона в ближнем бою.' },
  { id: 'quiet', name: 'Тихий шаг', desc: 'NPC замечают вас на 30% ближе.' },
  { id: 'connected', name: 'Связи', desc: 'Подкуп и найм на 40% дешевле.' },
  { id: 'vampire', name: 'Жажда', desc: '+6 здоровья за каждого поверженного врага.' },
  { id: 'haggler', name: 'Торгаш', desc: 'Цены в магазинах −25%.' },
  { id: 'picker', name: 'Ловкие пальцы', desc: 'Отмычки и хак-чипы не тратятся с шансом 50%.' },
  { id: 'regen', name: 'Регенерация', desc: 'Вне боя восстанавливается 1 здоровье в секунду.' },
  { id: 'blast', name: 'Огнеупорный', desc: 'Взрывы и огонь наносят вам вдвое меньше урона.' },
  { id: 'charm', name: 'Обаяние', desc: 'Жители и торговцы сразу относятся к вам дружелюбно.' },
  { id: 'scavenger', name: 'Падальщик', desc: 'С поверженных падает вдвое больше денег.' },
  { id: 'ammo', name: 'Запасливый', desc: 'Пачки патронов дают вдвое больше.' }
];

// Районы: по два этажа на район
G.DISTRICTS = [
  { name: 'Трущобы', floors: [1, 2], street: '#3a3a40', side: '#55535a', grass: '#3e5a32', tint: 'rgba(40,20,60,0.10)',
    music: { bpm: 96, root: 45, scale: [0, 3, 5, 7, 10] },
    civ: ['civ', 'civ', 'bum', 'worker'], gangs: true, cops: 2 },
  { name: 'Промзона', floors: [3, 4], street: '#3b3934', side: '#5e5a50', grass: '#4a4a30', tint: 'rgba(60,40,0,0.10)',
    music: { bpm: 108, root: 43, scale: [0, 2, 3, 7, 8] },
    civ: ['worker', 'worker', 'civ', 'bum'], gangs: true, cops: 3 },
  { name: 'Верхний город', floors: [5, 6], street: '#34383f', side: '#6b7078', grass: '#2f5a3a', tint: 'rgba(0,40,80,0.10)',
    music: { bpm: 118, root: 48, scale: [0, 2, 3, 5, 7, 9, 10] },
    civ: ['rich', 'civ', 'rich'], gangs: false, cops: 5 }
];
G.MAX_FLOOR = 6;

// Типы зданий
// owner: роль хозяина, private: вход без спроса — нарушение
G.BUILDINGS = {
  house:    { name: 'Жилой дом', floor: 'wood', owner: ['civ'], private: 1, lockChance: 0.3 },
  shop:     { name: 'Лавка', floor: 'tile', owner: ['shop'], private: 0, lockChance: 0 },
  bar:      { name: 'Бар «Подвал»', floor: 'wood2', owner: ['bartender', 'bouncer'], private: 0, lockChance: 0 },
  police:   { name: 'Участок', floor: 'tile2', owner: ['cop', 'cop'], private: 1, lockChance: 0.5 },
  rustbase: { name: 'Логово Ржавых', floor: 'concrete', owner: ['rust', 'rust', 'rust'], private: 1, lockChance: 0.4 },
  neonbase: { name: 'Логово Неоновых', floor: 'concrete', owner: ['neon', 'neon', 'neon'], private: 1, lockChance: 0.4 },
  warehouse:{ name: 'Склад', floor: 'concrete', owner: ['guard', 'worker'], private: 1, lockChance: 0.8 },
  lab:      { name: 'Лаборатория', floor: 'tile2', owner: ['scientist', 'scientist', 'guard'], private: 1, lockChance: 0.7 },
  bank:     { name: 'Банк', floor: 'marble', owner: ['guard', 'guard', 'rich'], private: 1, lockChance: 0.6 },
  tower:    { name: 'Башня Хозяина', floor: 'marble', owner: ['guard', 'guard', 'guard'], private: 1, lockChance: 1 }
};

G.SHOP_STOCK = {
  shop: ['burger', 'medkit', 'lockpick', 'hackchip', 'ammo', 'armor', 'knife', 'bat', 'pistol', 'grenade', 'molotov', 'smoke', 'energy', 'c4', 'sawn', 'smg', 'machete', 'shadowvial', 'rifle', 'flamer', 'rocket', 'sledge', 'taser'],
  bar: ['beer', 'beer', 'burger', 'energy', 'molotov', 'knuckle']
};

// Реплики NPC
G.BARKS = {
  warn: ['Эй! Тебе сюда нельзя!', 'Частная территория. Вон!', 'Ты что тут забыл?', 'Считаю до трёх...'],
  hostile: ['Ну всё, тебе конец!', 'Бей его!', 'Сам напросился!', 'Получай!', 'Стоять!'],
  flee: ['Помогите!', 'Не трогай меня!', 'Полиция!!', 'Аааа!'],
  hear: ['Что это было?', 'Кто здесь?', 'Хм?', 'Показалось?'],
  lost: ['Ушёл...', 'Ладно, проехали.', 'В следующий раз.'],
  bribe: ['Приятно иметь дело.', 'Я ничего не видел.', 'Заходи, если что.'],
  hire: ['Я с тобой.', 'Веди, босс.', 'Кого бить?'],
  idle: ['Ну и денёк.', 'Где мои ключи...', 'Опять дождь.', 'Слышал про лифт? Говорят, ведёт наверх.', 'Хозяин Города опять поднял налоги.', 'Ржавые с Неоновыми опять сцепились.'],
  cop: ['Проходим, не задерживаемся.', 'Документы в порядке?', 'Тихо сегодня.'],
  stolen: ['Вор!', 'Положи на место!', 'Это моё!']
};

G.NAMES = ['Гоша', 'Люба', 'Сёма', 'Нина', 'Жора', 'Вера', 'Толик', 'Зина', 'Митя', 'Ася', 'Борис', 'Капа', 'Лёва', 'Рита', 'Фёдор', 'Тома', 'Кеша', 'Даша', 'Гена', 'Оля'];
