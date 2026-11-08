'use strict';
// Пиксельные спрайты оружия и предметов (свои рисунки, строковые карты пикселей).

G.Sprites = (function () {
  var PAL = {
    k: '#14141c', d: '#2e323a', g: '#5a616c', l: '#9aa4b0', w: '#eef4f8', b: '#7a4f2a', B: '#4e3119',
    y: '#e8c23a', Y: '#a8861a', o: '#e07a1f', r: '#c0392b', R: '#7a1f1a', c: '#5fd3ff', C: '#2a7fa8',
    G: '#4f8f3f', n: '#2c5a26', t: '#c8a060', p: '#f1c9a5', u: '#3a5aa0', U: '#24386a', m: '#8a8a8a',
    s: '#bfe6ff', P: '#c050c0', e: '#d8d0c0', h: '#f0e6c8'
  };

  // Оружие: смотрит вправо, a = точка хвата
  var W = {
    knife:   { a: [1, 2], px: ['.kk.......', 'kBBkkkkk..', 'kBBklllllk', '.kk.kkwwk.', '....kkk...'] },
    bat:     { a: [2, 2], px: ['.kkk............', 'kBBBkkkkkkkk....', 'kBBBbbbbbbbtttkk', '.kkkkbbbbbbbbbbk', '.....kkkkkkkkkk.'] },
    pipe:    { a: [2, 1], px: ['kkkkkkkkkkkkkkk', 'kgmmmllllmmmmgk', 'kkkkkkkkkkkkkkk'] },
    knuckle: { a: [2, 2], px: ['.kkkk.', 'kylylk', 'kyyyyk', 'kYkkYk', '.kkkk.'] },
    machete: { a: [2, 2], px: ['.kk.............', 'kBBkkkkkkkkkkkk.', 'kBBklllllllllllk', 'kBBkgggggggllwk.', '.kk.kkkkkkkkkk..'] },
    sledge:  { a: [2, 3], px: ['.............kkkk', '............kgggk', '.kkkkkkkkkkkkglgk', 'kBbbbbbbbbbbkglgk', '.kkkkkkkkkkkkgggk', '............kgggk', '.............kkkk'] },
    taser:   { a: [3, 4], px: ['.kkkkkkkkk..', 'kyyyyyyyyykc', 'kyddddddyykc', '.kkkdbkkkkk.', '...kdbk.....', '...kkkk.....'] },
    pistol:  { a: [3, 4], px: ['.kkkkkkkkkk.', 'kgllllllllgk', 'kggggggggggk', '.kkkdBkkkkk.', '...kdBk.....', '...kkkk.....'] },
    sawn:    { a: [6, 3], px: ['.kkkkkkkkkkkkkkk', 'kbbbbbkllllllllk', 'kbbbbbkgggggggdk', '.kkkbbbkkkkkkkk.', '....kkkk........'] },
    smg:     { a: [5, 4], px: ['..kkkkkkkkkkkk.', 'kkglllllllllgkk', 'kdgggggggggggk.', 'kdkkkdgkkdkkk..', '.k..kdgk.kdk...', '....kddk..k....', '....kkkk.......'] },
    rifle:   { a: [7, 3], px: ['....kkkkkk..........', '...kcddddck..........', '.kkkkkkkkkkkkkkkkkkk.', 'kbbbbbbglllllllllllgk', 'kbbbbkkbbbbbkkkkkkkk.', '.kkkk..kkkkk.........'] },
    flamer:  { a: [5, 4], px: ['..kkkk...........', '.krrrrk..........', '.krRrrkkkkkkkkkk.', 'kgggggggllllllllo', 'kgddkkkgkkkkkkkk.', '.kddk.kk.........', '..kk.............'] },
    rocket:  { a: [7, 3], px: ['.kkkkkkkkkkkkkkkkk.', 'kGGGGGGGGGGGGGGGGGk', 'knnnnnnnnnnnnnnnnmk', '.kkkkkkdkkkkkkkkkk.', '......kdk..........', '......kkk..........'] },
    grenade: { a: [3, 4], px: ['..kk..', '.kgkk.', 'kGGGGk', 'kGnGnk', 'kGGGGk', 'kGnGnk', '.kkkk.'] },
    molotov: { a: [2, 6], px: ['..o..', '.kok.', '.kwk.', '.kgk.', 'kGGGk', 'kGsGk', 'kGGGk', 'kGGGk', '.kkk.'] },
    smoke:   { a: [3, 4], px: ['.kkkk.', 'kllllk', 'kmmmmk', 'kmddmk', 'kmmmmk', 'kmmmmk', '.kkkk.'] }
  };
  // Предметы 8–10 px
  var I = {
    burger:   ['..kkkk..', '.ktttttk', 'kttyttyk', 'kGGGGGGk', 'kRRRRRRk', 'kttttttk', '.kkkkkk.'],
    beer:     ['.kkkk.', 'kwwwwk', 'kyyyyk', 'kyYyyk', 'kyyyyk', 'kyyyyk', '.kkkk.'],
    medkit:   ['.kkkkkkk.', 'kwwwwwwwk', 'kwwwrwwwk', 'kwwrrrwwk', 'kwwwrwwwk', 'kwwwwwwwk', '.kkkkkkk.'],
    energy:   ['.kkkk.', 'kllllk', 'kGGGGk', 'kGyyGk', 'kGyGGk', 'kGGGGk', '.kkkk.'],
    shadowvial:['..kk..', '.kllk.', '..kk..', '.kPPk.', 'kPPPPk', 'kPwPPk', '.kkkk.'],
    armor:    ['.kk..kk.', 'kUUkkUUk', 'kUuuuuUk', 'kUuuuuUk', 'kUuuuuUk', '.kUUUUk.', '..kkkk..'],
    lockpick: ['.kk......', 'kyyk.....', 'kyykkkkk.', 'kyyklllk.', '.kk.kkkkk'],
    hackchip: ['.k.k.k.', 'kkkkkkk', 'kGGGGGk', 'kGcGcGk', 'kGGGGGk', 'kkkkkkk', '.k.k.k.'],
    c4:       ['.kkkkkkk.', 'krrkrrkck', 'krrkrrkck', 'kkkkkkkkk', 'kbbbbbbbk', '.kkkkkkk.'],
    ammo:     ['.kkkkkkk.', 'kbbbbbbbk', 'kbyykyybk', 'kbbbbbbbk', 'kBBBBBBBk', '.kkkkkkk.'],
    package:  ['.kkkkkkk.', 'ktttyttk.', 'ktttytttk', 'kyyyyyyyk', 'ktttytttk', '.kkkkkkk.'],
    docs:     ['.kkkkkk.', 'kyyyyyyk', 'kywwwwyk', 'kywmmwyk', 'kywwwwyk', 'kyyyyyyk', '.kkkkkk.'],
    blueprint:['.kkkkkk.', 'kuuuuuuk', 'kuwuuwuk', 'kuwwwwuk', 'kuuwuuuk', 'kuuuuuuk', '.kkkkkk.'],
    ingot:    ['..kkkkk..', '.kyhhhyk.', 'kyyyyyyyk', 'kYYYYYYYk', '.kkkkkkk.'],
    coin:     ['.kkk.', 'kyhyk', 'kyYyk', 'kyyyk', '.kkk.']
  };

  var cache = {};
  function build(rows) {
    var w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); });
    var cv = document.createElement('canvas'); cv.width = w; cv.height = rows.length;
    var x = cv.getContext('2d');
    rows.forEach(function (r, j) {
      for (var i = 0; i < r.length; i++) { var ch = r[i]; if (ch === '.' || !PAL[ch]) continue; x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); }
    });
    return cv;
  }
  function weapon(id) {
    if (!W[id]) return null;
    var k = 'w_' + id;
    if (!cache[k]) { cache[k] = build(W[id].px); cache[k].ax = W[id].a[0]; cache[k].ay = W[id].a[1]; }
    return cache[k];
  }
  function item(id) {
    var k = 'i_' + id;
    if (cache[k] !== undefined) return cache[k];
    if (I[id]) cache[k] = build(I[id]);
    else if (W[id]) cache[k] = weapon(id);
    else cache[k] = null;
    return cache[k];
  }
  // Увеличенная иконка для интерфейса (dataURL)
  var urls = {};
  function iconURL(id, scale) {
    scale = scale || 4;
    var k = id + '@' + scale;
    if (urls[k]) return urls[k];
    var s = item(id);
    if (!s) return null;
    var cv = document.createElement('canvas'); cv.width = s.width * scale; cv.height = s.height * scale;
    var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, cv.width, cv.height);
    urls[k] = cv.toDataURL();
    return urls[k];
  }
  function iconHTML(id, fallback, scale) {
    var u = iconURL(id, scale);
    return u ? '<img class="pxicon" src="' + u + '">' : (fallback || '');
  }
  return { weapon: weapon, item: item, iconURL: iconURL, iconHTML: iconHTML, PAL: PAL };
})();
