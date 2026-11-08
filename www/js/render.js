'use strict';
// Отрисовка в стиле пиксель-арт: мир рисуется в низком разрешении (16 px на клетку)
// и увеличивается целым множителем без сглаживания. Ночное освещение, погода, эффекты.

G.Render = (function () {
  var TP = 16;                       // пикселей арта на клетку
  var cv, ctx, W, H, DPR, S = 4;     // S — масштаб пикселя арта на экране
  var lc, l, LW, LH;                 // низкое разрешение
  var lightCv, lx;
  var mapCv, mx, decalCv, dcx, builtFor = null, decalIdx = 0;
  var cam = { x: 0, y: 0 }, camTL = { x: 0, y: 0 }, ix = 0, iy = 0;
  var weather = [];
  var time = 0;

  var DIST = [
    { street: [43, 54, 64], side: [74, 79, 92], grass: [44, 72, 42], ambient: 'rgba(5,9,26,0.64)', lamp: 'rgba(255,205,130,', room: 'rgba(255,215,150,', weather: 'rain' },
    { street: [58, 51, 43], side: [92, 84, 72], grass: [74, 74, 44], ambient: 'rgba(24,11,2,0.56)', lamp: 'rgba(255,150,60,', room: 'rgba(255,190,120,', weather: 'ash' },
    { street: [47, 52, 60], side: [108, 113, 122], grass: [40, 86, 54], ambient: 'rgba(8,14,36,0.5)', lamp: 'rgba(205,228,255,', room: 'rgba(255,240,210,', weather: 'none' }
  ];
  var WALLS = {
    house: ['#5a4660', '#8a5a4a', '#6e463a'], shop: ['#3e5a52', '#4f7a62', '#3b5a48'], bar: ['#4a2e52', '#7a3a5a', '#5a2a44'],
    police: ['#2e3a5e', '#3e5a8a', '#2e4470'], rustbase: ['#5a3a2a', '#8a4a2a', '#6a3420'], neonbase: ['#4a2a5a', '#7a3a8a', '#5a2a6a'],
    warehouse: ['#454545', '#6a6a5a', '#525246'], lab: ['#5a6670', '#9aa8b4', '#7a8894'], bank: ['#6a5a3e', '#a8945e', '#86744a'], tower: ['#2a2a36', '#4a4a5e', '#36364a'],
    none: ['#1b1b22', '#2a2a32', '#222228']
  };
  var FLOOR = {
    wood: ['#7a5233', '#6a4529', '#86603c'], wood2: ['#6a3a3a', '#5a2e30', '#7a4644'], tile: ['#a8ab9e', '#8f9386', '#b8bbae'],
    tile2: ['#c9d6e0', '#aebccc', '#dde6ee'], concrete: ['#5e5e62', '#545458', '#68686c'], marble: ['#d8d0c2', '#c4baa8', '#e6e0d4']
  };
  var HAIR = ['#2a1c14', '#5a3a1e', '#c89a4a', '#1a1a1a', '#8a3a1a', '#d8d0c0', '#3a2a4a'];
  var SKIN = ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3a', '#f5d7bd'];

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    lc = document.createElement('canvas'); l = lc.getContext('2d');
    lightCv = document.createElement('canvas'); lx = lightCv.getContext('2d');
    resize();
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = Math.floor(window.innerWidth * DPR);
    H = cv.height = Math.floor(window.innerHeight * DPR);
    cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
    var tilesTall = window.innerHeight > window.innerWidth ? 12 : 8.6;
    S = Math.max(2, Math.round(H / (tilesTall * TP)));
    LW = Math.ceil(W / S) + 2; LH = Math.ceil(H / S) + 2;
    lc.width = LW; lc.height = LH; lightCv.width = LW; lightCv.height = LH;
    weather = [];
  }
  function hsh(x, y, k) { var h = (x * 374761393 + y * 668265263 + (k || 0) * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rgb(c, d) { return 'rgb(' + Math.max(0, Math.min(255, c[0] + d)) + ',' + Math.max(0, Math.min(255, c[1] + d)) + ',' + Math.max(0, Math.min(255, c[2] + d)) + ')'; }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16); if (hex.length === 4) n = parseInt(hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(G.clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255)); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function dist(m) { return DIST[Math.min(2, Math.floor((m.floor - 1) / 2))]; }

  // ---------- Статичный слой карты ----------
  function build(m) {
    builtFor = m;
    mapCv = document.createElement('canvas'); mapCv.width = m.w * TP; mapCv.height = m.h * TP; mx = mapCv.getContext('2d');
    decalCv = document.createElement('canvas'); decalCv.width = m.w * TP; decalCv.height = m.h * TP; dcx = decalCv.getContext('2d');
    decalIdx = 0;
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) tile(m, x, y);
    m.dirty = [];
    // источники света
    var D = dist(m);
    m.lights = [];
    m.buildings.forEach(function (b) {
      b.rooms.forEach(function (rm) { m.lights.push({ x: rm.x + rm.w / 2, y: rm.y + rm.h / 2, r: Math.max(rm.w, rm.h) * 0.62 + 1.6, c: D.room, a: 0.95, glow: 0.10 }); });
    });
    m.objects.forEach(function (o) {
      if (o.type === 'lamp') m.lights.push({ x: o.x + 0.5, y: o.y - 1.2, r: 4.6, c: D.lamp, a: 1, glow: 0.22, obj: o });
      if (o.type === 'vending') m.lights.push({ x: o.x + 0.5, y: o.y + 0.3, r: 1.8, c: 'rgba(255,90,110,', a: 0.7, glow: 0.18, obj: o });
      if (o.type === 'atm') m.lights.push({ x: o.x + 0.5, y: o.y + 0.3, r: 1.4, c: 'rgba(120,200,255,', a: 0.6, glow: 0.15, obj: o });
      if (o.type === 'terminal' || o.type === 'server') m.lights.push({ x: o.x + 0.5, y: o.y + 0.3, r: 1.4, c: 'rgba(80,255,150,', a: 0.6, glow: 0.15, obj: o });
    });
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) if (m.t[y * m.w + x] === G.T.WINDOW && m.get(x, y + 1) !== G.T.FLOOR) m.lights.push({ x: x + 0.5, y: y + 1.1, r: 1.6, c: D.room, a: 0.55, glow: 0.12, win: 1 });
  }

  function isW(v) { return v === G.T.WALL || v === G.T.BORDER || v === G.T.WINDOW; }
  function tile(m, x, y) {
    var c = mx, X = x * TP, Y = y * TP, v = m.get(x, y), D = dist(m), i, j, h;
    var b = m.buildings[m.bid[m.idx(x, y)]];
    var R = function (a, bb, w, hh, col) { c.fillStyle = col; c.fillRect(X + a, Y + bb, w, hh); };
    c.clearRect(X, Y, TP, TP);
    if (v === G.T.STREET) {
      R(0, 0, 16, 16, rgb(D.street, 0));
      for (i = 0; i < 9; i++) { h = hsh(x, y, i); R((h * 16) | 0, (hsh(y, x, i) * 16) | 0, 1, 1, rgb(D.street, h < 0.5 ? -8 : 7)); }
      if (hsh(x, y, 40) < 0.05) { R(3, 9, 7, 1, rgb(D.street, -14)); R(9, 7, 1, 3, rgb(D.street, -14)); }
      if (D.weather === 'rain' && hsh(x, y, 41) < 0.06) { R(2, 5, 10, 4, 'rgba(70,110,150,0.45)'); R(4, 6, 3, 1, 'rgba(180,210,255,0.5)'); }
      var road = m.get(x, y - 1) === G.T.STREET && m.get(x, y + 1) === G.T.STREET;
      if (x % 4 < 2 && road && m.get(x, y - 2) !== G.T.STREET && false) R(2, 7, 12, 2, '#cbb45a');
      if (hsh(x, y, 42) < 0.012) { R(4, 4, 8, 8, '#2a2f36'); R(5, 5, 6, 6, '#3d434c'); R(5, 7, 6, 1, '#2a2f36'); R(5, 9, 6, 1, '#2a2f36'); }
    } else if (v === G.T.SIDE) {
      R(0, 0, 16, 16, rgb(D.side, 0));
      R(0, 0, 16, 1, rgb(D.side, -16)); R(0, 8, 16, 1, rgb(D.side, -16)); R(0, 0, 1, 16, rgb(D.side, -16)); R(8, 0, 1, 8, rgb(D.side, -16)); R(4, 8, 1, 8, rgb(D.side, -16)); R(12, 8, 1, 8, rgb(D.side, -16));
      R(1, 1, 7, 1, rgb(D.side, 10)); R(9, 1, 7, 1, rgb(D.side, 10)); R(1, 9, 3, 1, rgb(D.side, 10)); R(5, 9, 7, 1, rgb(D.side, 10));
      for (i = 0; i < 3; i++) { h = hsh(x, y, i + 20); R((h * 15) | 0, (hsh(x, y, i + 30) * 15) | 0, 1, 1, rgb(D.side, -10)); }
      // бордюр со стороны дороги
      if (m.get(x, y + 1) === G.T.STREET) R(0, 14, 16, 2, rgb(D.side, -28));
      if (m.get(x, y - 1) === G.T.STREET) R(0, 0, 16, 1, rgb(D.side, 18));
    } else if (v === G.T.GRASS) {
      R(0, 0, 16, 16, rgb(D.grass, 0));
      for (i = 0; i < 14; i++) { h = hsh(x, y, i); var gx = (h * 16) | 0, gy = (hsh(y, x, i + 3) * 15) | 0; R(gx, gy, 1, 2, rgb(D.grass, h < 0.5 ? -14 : 16)); }
      if (hsh(x, y, 50) < 0.15) R((hsh(x, y, 51) * 14) | 0, (hsh(x, y, 52) * 14) | 0, 1, 1, hsh(x, y, 53) < 0.5 ? '#e8d24a' : '#e86a8a');
    } else if (v === G.T.FLOOR || v === G.T.DOOR || v === G.T.WINBROKEN || v === G.T.ELEV) {
      if (v === G.T.ELEV) {
        R(0, 0, 16, 16, '#3a3e46'); R(0, 0, 16, 1, '#555a64'); R(0, 0, 1, 16, '#555a64');
        for (i = 0; i < 4; i++) R(2 + i * 4, 2 + (i % 2) * 10, 1, 1, '#777');
        for (i = 0; i < 16; i += 4) { R(i, 15, 2, 1, '#e8c23a'); R(i + 2, 15, 2, 1, '#111'); }
      } else floorTile(m, b, x, y, R);
      if (v === G.T.WINBROKEN) {
        R(0, 0, 16, 2, b ? WALLS[b.type][0] : '#333'); R(0, 14, 16, 2, b ? WALLS[b.type][0] : '#333');
        for (i = 0; i < 6; i++) R((hsh(x, y, i) * 15) | 0, 3 + (hsh(y, x, i) * 10) | 0, 1, 1, '#cfefff');
      }
    } else if (v === G.T.RUBBLE) {
      R(0, 0, 16, 16, '#4a4846');
      for (i = 0; i < 9; i++) { h = hsh(x, y, i); var s = 1 + ((h * 3) | 0); R((h * 14) | 0, (hsh(y, x, i) * 14) | 0, s + 1, s, i % 2 ? '#6a6662' : '#3a3836'); }
    } else if (isW(v)) {
      wallTile(m, b, x, y, v, R);
      return;
    }
    // тени от стен
    if (isW(m.get(x, y - 1))) { R(0, 0, 16, 2, 'rgba(0,0,0,0.38)'); R(0, 2, 16, 2, 'rgba(0,0,0,0.18)'); }
    if (isW(m.get(x - 1, y))) R(0, 0, 2, 16, 'rgba(0,0,0,0.18)');
  }
  function floorTile(m, b, x, y, R) {
    var st = b ? b.def.floor : 'concrete', F = FLOOR[st] || FLOOR.concrete, i, h;
    if (st === 'wood' || st === 'wood2') {
      for (i = 0; i < 4; i++) {
        h = hsh(x, y, i);
        R(0, i * 4, 16, 4, F[h < 0.33 ? 0 : h < 0.66 ? 1 : 2]);
        R(0, i * 4 + 3, 16, 1, F[1]); R(0, i * 4 + 3, 16, 1, 'rgba(0,0,0,0.25)');
        var jx = ((hsh(y, i, x) * 16) | 0); R(jx, i * 4, 1, 3, 'rgba(0,0,0,0.3)');
        R((h * 12) | 0, i * 4 + 1, 3, 1, 'rgba(255,255,255,0.06)');
      }
    } else if (st === 'tile' || st === 'tile2' || st === 'marble') {
      for (i = 0; i < 4; i++) {
        var tx = (i % 2) * 8, ty = (i >> 1) * 8, alt = ((x * 2 + (i % 2)) + (y * 2 + (i >> 1))) % 2;
        R(tx, ty, 8, 8, F[alt ? 1 : 0]);
        R(tx, ty, 8, 1, F[2]); R(tx, ty, 1, 8, F[2]);
        R(tx, ty + 7, 8, 1, 'rgba(0,0,0,0.15)');
      }
      if (st === 'marble' && hsh(x, y, 9) < 0.5) { R(2, 3, 5, 1, 'rgba(120,110,100,0.35)'); R(6, 4, 4, 1, 'rgba(120,110,100,0.35)'); }
    } else {
      R(0, 0, 16, 16, F[0]);
      for (i = 0; i < 8; i++) { h = hsh(x, y, i); R((h * 16) | 0, (hsh(y, x, i) * 16) | 0, 1, 1, F[h < 0.5 ? 1 : 2]); }
      if (hsh(x, y, 60) < 0.12) R(3, 6, 6, 3, 'rgba(0,0,0,0.18)');
      R(0, 0, 16, 1, 'rgba(0,0,0,0.12)'); R(0, 0, 1, 16, 'rgba(0,0,0,0.12)');
    }
  }
  function wallTile(m, b, x, y, v, R) {
    var pal = WALLS[b ? b.type : 'none'] || WALLS.none, top = v === G.T.BORDER ? '#121218' : pal[0];
    var below = m.get(x, y + 1), face = !isW(below) && below !== G.T.DOOR;
    R(0, 0, 16, 16, top);
    // ободок верха
    if (!isW(m.get(x, y - 1)) && m.get(x, y - 1) !== G.T.DOOR) R(0, 0, 16, 1, shade(top, 0.35));
    if (!isW(m.get(x - 1, y)) && m.get(x - 1, y) !== G.T.DOOR) R(0, 0, 1, face ? 7 : 16, shade(top, 0.25));
    if (!isW(m.get(x + 1, y)) && m.get(x + 1, y) !== G.T.DOOR) R(15, 0, 1, face ? 7 : 16, shade(top, -0.35));
    R(1, 1, 14, 1, 'rgba(255,255,255,0.05)');
    if (face) {
      // лицевая грань из кирпича
      var brick = v === G.T.BORDER ? '#2a2a30' : pal[1], mortar = shade(brick, -0.35);
      R(0, 6, 16, 10, mortar);
      for (var row = 0; row < 3; row++) {
        var off = (row + y) % 2 ? 3 : 0;
        for (var bx = -off; bx < 16; bx += 6) {
          var w = Math.min(5, 16 - Math.max(0, bx)), x0 = Math.max(0, bx);
          if (w <= 0) continue;
          R(x0, 7 + row * 3, Math.min(5, bx + 5 - x0), 2, hsh(x * 7 + bx, y + row, 3) < 0.2 ? shade(brick, -0.12) : brick);
          R(x0, 7 + row * 3, Math.min(5, bx + 5 - x0), 1, shade(brick, 0.12));
        }
      }
      R(0, 6, 16, 1, 'rgba(0,0,0,0.45)');
      R(0, 15, 16, 1, shade(brick, -0.55));
      if (v === G.T.WINDOW) {
        R(3, 7, 10, 8, '#1a1a22');
        R(4, 8, 8, 6, b ? '#f2d488' : '#8fc8ee');
        R(4, 8, 8, 2, b ? '#ffe9b0' : '#c8ecff');
        R(7, 8, 1, 6, '#1a1a22'); R(4, 11, 8, 1, '#1a1a22');
        R(5, 9, 1, 1, '#fff');
        R(2, 15, 12, 1, '#9a9aa4');
      }
    } else if (v === G.T.WINDOW) {
      R(6, 1, 4, 14, '#1a1a22'); R(7, 1, 2, 14, b ? '#f2d488' : '#8fc8ee'); R(7, 3, 1, 3, '#fff');
    }
  }

  function bakeDecals(m) {
    while (decalIdx < m.decals.length) {
      var d = m.decals[decalIdx++], rr = G.RNG(d.seed || decalIdx * 77);
      var cx = d.x * TP, cy = d.y * TP, rad = d.r * TP, n = Math.max(4, (rad * rad * 0.9) | 0);
      for (var i = 0; i < n; i++) {
        var a = rr() * Math.PI * 2, q = Math.sqrt(rr()) * rad;
        var px = (cx + Math.cos(a) * q) | 0, py = (cy + Math.sin(a) * q * 0.7) | 0;
        if (d.type === 'blood') dcx.fillStyle = rr() < 0.5 ? 'rgba(120,10,16,0.85)' : 'rgba(90,6,12,0.85)';
        else dcx.fillStyle = 'rgba(15,12,10,' + (0.35 + rr() * 0.35) + ')';
        var sz = rr() < 0.25 ? 2 : 1;
        dcx.fillRect(px, py, sz, sz);
      }
    }
  }

  // ---------- Помощники рисования в низком разрешении ----------
  var OUT = '#101016';
  function box(x, y, w, h, col) { l.fillStyle = OUT; l.fillRect(x - 1, y - 1, w + 2, h + 2); l.fillStyle = col; l.fillRect(x, y, w, h); }
  function rect(x, y, w, h, col) { l.fillStyle = col; l.fillRect(x, y, w, h); }
  function A(x) { return Math.round(x * TP - ix); }
  function B(y) { return Math.round(y * TP - iy); }

  // ---------- Объекты ----------
  function drawObj(o, game) {
    var X = A(o.x), Y = B(o.y), t = game.time;
    var r = function (a, b, w, h, c) { rect(X + a, Y + b, w, h, c); };
    var bx = function (a, b, w, h, c) { box(X + a, Y + b, w, h, c); };
    var shadow = function (w) { l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X + 8 - w / 2, Y + 14, w, 2); };
    switch (o.type) {
      case 'safe':
        shadow(14); bx(2, 1, 12, 14, '#3b4250'); r(2, 1, 12, 2, '#5a6272');
        if (o.opened) { r(3, 3, 10, 11, '#121418'); r(4, 4, 3, 2, '#e8c23a'); r(1, 3, 2, 11, '#4c5566'); }
        else { r(3, 3, 10, 11, '#4c5566'); box(X + 6, Y + 6, 4, 4, '#c9ced6'); r(7, 7, 2, 2, '#6a7280'); r(11, 7, 1, 3, '#9aa4b0'); }
        break;
      case 'crate':
        shadow(14); bx(1, 3, 14, 12, '#8a5a2e'); r(1, 3, 14, 2, o.opened ? '#2a1a0e' : '#a8703a');
        r(1, 8, 14, 1, '#6a4422'); r(1, 12, 14, 1, '#6a4422'); r(3, 5, 1, 10, '#6a4422'); r(12, 5, 1, 10, '#6a4422');
        break;
      case 'wardrobe':
        shadow(14); bx(1, -7, 14, 22, '#5e3b20'); r(1, -7, 14, 2, '#7a5230'); r(8, -5, 1, 19, '#3a2412');
        r(6, 2, 1, 2, '#e8c23a'); r(10, 2, 1, 2, '#e8c23a'); if (o.opened) r(2, -4, 6, 17, '#1a120a');
        break;
      case 'terminal':
        shadow(14); bx(2, -3, 12, 11, '#2b3038'); r(3, -2, 10, 7, o.downloaded ? '#1f6a3a' : '#0d3a22');
        for (var k = 0; k < 3; k++) r(4, -1 + k * 2, 3 + ((hsh(k, (t * 2) | 0, o.x) * 6) | 0), 1, '#4dff9a');
        if (((t * 3) | 0) % 2) r(10, 3, 2, 1, '#4dff9a');
        bx(1, 9, 14, 4, '#3a3f48'); for (k = 0; k < 6; k++) r(2 + k * 2, 10, 1, 1, '#8a909a');
        break;
      case 'alarm': {
        var on = game.map.buildings[o.bid] && game.map.buildings[o.bid].alarmT > 0;
        bx(5, 1, 6, 6, '#d8d8d8'); r(6, 2, 4, 4, on && ((t * 8) | 0) % 2 ? '#ff4040' : '#b02020'); r(7, 2, 1, 1, '#fff');
        break;
      }
      case 'vent':
        bx(2, 2, 12, 12, '#3a3f44'); for (k = 0; k < 4; k++) r(3, 4 + k * 3, 10, 1, '#16181a');
        break;
      case 'trash':
        shadow(12); bx(3, 2, 10, 13, '#2f5a3a'); bx(2, 0, 12, 3, '#3e7049'); r(5, 4, 1, 10, '#244a2e'); r(8, 4, 1, 10, '#244a2e'); r(11, 4, 1, 10, '#244a2e'); r(4, 0, 4, 1, '#5a9068');
        break;
      case 'barrel':
        shadow(12); bx(3, 0, 10, 15, '#b0301e'); r(3, 0, 10, 2, '#d24a33'); r(3, 4, 10, 1, '#7a1f12'); r(3, 11, 10, 1, '#7a1f12');
        r(5, 6, 6, 4, '#e8c23a'); r(7, 7, 2, 2, '#111'); r(4, 2, 1, 12, 'rgba(255,255,255,0.18)');
        break;
      case 'counter':
        bx(0, 3, 16, 12, '#5a3e26'); r(0, 3, 16, 3, '#9a7048'); r(0, 3, 16, 1, '#b88a5c');
        r(2, 8, 5, 6, '#4a3220'); r(9, 8, 5, 6, '#4a3220');
        if (hsh(o.x, o.y, 1) < 0.4) { r(5, 1, 3, 3, '#e8e8e8'); r(6, 0, 1, 1, '#e8e8e8'); }
        break;
      case 'table':
        shadow(14); r(2, 11, 2, 4, '#3a2412'); r(12, 11, 2, 4, '#3a2412'); bx(1, 3, 14, 8, '#7a5233'); r(1, 3, 14, 2, '#96683f');
        if (hsh(o.x, o.y, 2) < 0.5) { box(X + 5, Y + 4, 2, 3, '#ddd'); } if (hsh(o.x, o.y, 3) < 0.4) box(X + 10, Y + 5, 3, 2, '#c84a3a');
        break;
      case 'bed':
        bx(1, 0, 14, 16, '#3d4f8a'); r(1, 0, 14, 1, '#6a4a2a'); bx(2, 1, 12, 4, '#e6e6ee'); r(1, 7, 14, 1, '#2e3c6a'); r(1, 6, 14, 1, '#5a6caa');
        break;
      case 'plant':
        shadow(8); bx(5, 9, 6, 6, '#8a4a2a'); r(5, 9, 6, 1, '#a85a32');
        rect(X + 4, Y + 1, 8, 8, '#2e6a32'); rect(X + 2, Y + 3, 4, 4, '#3c8040'); rect(X + 10, Y + 2, 4, 5, '#3c8040'); rect(X + 6, Y - 2, 4, 5, '#4a9a4e'); r(7, -1, 1, 1, '#7ac87a');
        break;
      case 'tree':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X - 3, Y + 12, 22, 4);
        bx(6, 3, 4, 12, '#5a3a1e'); r(6, 3, 1, 12, '#7a5230');
        var cy = Y - 12;
        rect(X - 4, cy + 2, 24, 12, '#24532a'); rect(X - 2, cy - 2, 20, 18, '#24532a'); rect(X + 1, cy - 4, 14, 22, '#24532a');
        rect(X - 2, cy + 1, 18, 10, '#2e6a32'); rect(X + 1, cy - 2, 12, 14, '#2e6a32');
        rect(X + 1, cy, 8, 5, '#3c8040'); rect(X + 3, cy - 2, 4, 2, '#4a9a4e');
        for (k = 0; k < 5; k++) r(-2 + (hsh(o.x, k, 1) * 18 | 0), -14 + (hsh(o.y, k, 2) * 16 | 0), 1, 1, '#5aae5a');
        break;
      case 'bush':
        rect(X, Y + 7, 16, 8, '#24532a'); rect(X + 2, Y + 4, 6, 6, '#2e6a32'); rect(X + 8, Y + 3, 6, 7, '#2e6a32'); rect(X + 4, Y + 5, 3, 2, '#3c8040'); rect(X + 10, Y + 4, 2, 2, '#3c8040');
        break;
      case 'bench':
        r(1, 10, 2, 5, '#2a2d33'); r(13, 10, 2, 5, '#2a2d33'); bx(0, 3, 16, 2, '#8a6036'); bx(0, 7, 16, 3, '#9a6a3c'); r(0, 7, 16, 1, '#b8844e');
        break;
      case 'lamp':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X + 4, Y + 13, 8, 2);
        bx(5, 12, 6, 3, '#2a2d33'); bx(7, -26, 2, 38, '#33373e'); bx(3, -28, 10, 3, '#3a3d44'); r(4, -25, 8, 1, '#fff3c0');
        break;
      case 'vending':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X + 1, Y + 13, 14, 3);
        bx(1, -10, 14, 25, '#a02a3a'); r(1, -10, 14, 2, '#c8404e'); bx(3, -7, 7, 13, '#15151c');
        for (k = 0; k < 4; k++) { r(4, -6 + k * 3, 2, 2, ['#e8c23a', '#4dff9a', '#5fd3ff', '#ff7a5a'][k]); r(7, -6 + k * 3, 2, 2, ['#5fd3ff', '#e8c23a', '#ff7a5a', '#4dff9a'][k]); }
        bx(11, -7, 2, 6, '#ddd'); bx(3, 8, 8, 3, '#111'); r(11, 1, 2, 2, ((t * 2) | 0) % 2 ? '#ff4' : '#884');
        break;
      case 'atm':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X + 2, Y + 13, 12, 3);
        bx(2, -8, 12, 23, '#3a5a8a'); r(2, -8, 12, 2, '#5a7aaa'); bx(4, -5, 8, 6, '#7fd0ff'); r(5, -4, 4, 1, '#fff');
        bx(4, 3, 8, 5, '#222'); for (k = 0; k < 6; k++) r(5 + (k % 3) * 2, 4 + (k / 3 | 0) * 2, 1, 1, '#aaa'); r(5, 10, 6, 1, '#111');
        break;
      case 'generator':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X, Y + 13, 16, 3);
        bx(0, -4, 16, 18, '#5a6a3a'); r(0, -4, 16, 2, '#7a8a50');
        for (k = 0; k < 4; k++) r(2, -1 + k * 2, 7, 1, '#3a4626');
        for (k = 0; k < 7; k++) r(1 + k * 2, 10, 2, 3, k % 2 ? '#111' : '#e8c23a');
        bx(11, -1, 3, 3, ((t * 6) | 0) % 2 ? '#ff3030' : '#601010');
        break;
      case 'server':
        l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(X + 1, Y + 13, 14, 3);
        bx(1, -13, 14, 27, '#22262c');
        for (k = 0; k < 6; k++) { r(2, -11 + k * 4, 12, 3, '#2e333a'); r(3, -10 + k * 4, 1, 1, hsh(k, (t * 5) | 0, o.x) < 0.5 ? '#4dff9a' : '#0a3a1a'); r(5, -10 + k * 4, 1, 1, hsh(k, (t * 4) | 0, 9) < 0.3 ? '#ffb030' : '#3a2a0a'); }
        break;
      case 'still':
        shadow(12); bx(2, 1, 10, 13, '#b0703a'); r(3, 2, 2, 10, '#d8945a'); r(2, 6, 10, 1, '#7a4a22');
        bx(12, -5, 2, 12, '#c8c8c8'); bx(12, 9, 3, 5, '#bfe6ff'); r(13, 11, 1, 2, '#e8c23a');
        if (Math.random() < 0.05) G.FX.dust(game, o.x + 0.4, o.y - 0.2, 1, 'rgba(220,220,220,');
        break;
      case 'elevator': {
        var open = game.canLeave(), col = open ? '#3fd16a' : '#e0b020';
        box(X, Y - 10, 32, 8, '#3a3e46'); rect(X + 2, Y - 8, 28, 4, '#1c1e24');
        rect(X + 4, Y - 7, 24, 2, col);
        rect(X + 15, Y - 9, 2, 2, ((t * 3) | 0) % 2 ? '#fff' : col);
        break;
      }
    }
    if (o.flash > 0) { o.flash -= 0.016; l.fillStyle = 'rgba(255,255,255,0.5)'; l.fillRect(X, Y, 16, 16); }
  }

  function drawDoor(m, d) {
    var X = A(d.x), Y = B(d.y), vertical = isW(m.get(d.x, d.y - 1)) || isW(m.get(d.x, d.y + 1));
    var b = m.buildings[d.bid], pal = WALLS[b ? b.type : 'none'];
    if (d.broken) { rect(X + 1, Y + 12, 5, 2, '#5a3a1e'); rect(X + 9, Y + 13, 4, 1, '#4a2e16'); rect(X + 6, Y + 10, 2, 1, '#6a4422'); return; }
    var open = d.openT > 0, door = d.locked ? '#6a3020' : '#8a5a30', dk = shade(door, -0.35);
    if (vertical) {
      rect(X, Y, 16, 1, pal[0]); rect(X, Y + 15, 16, 1, pal[0]);
      if (open) { box(X + 1, Y + 1, 2, 14, door); }
      else { box(X + 6, Y - 2, 4, 18, door); rect(X + 7, Y - 2, 1, 18, shade(door, 0.15)); rect(X + 9, Y + 6, 1, 2, d.locked ? '#ff3030' : '#e8c23a'); }
    } else {
      rect(X, Y - 2, 1, 18, pal[0]); rect(X + 15, Y - 2, 1, 18, pal[0]);
      if (open) { box(X + 1, Y - 2, 2, 17, door); rect(X + 3, Y + 14, 12, 1, 'rgba(0,0,0,0.3)'); }
      else {
        box(X + 1, Y - 3, 14, 18, door); rect(X + 1, Y - 3, 14, 1, shade(door, 0.2));
        box(X + 3, Y - 1, 10, 5, dk); box(X + 3, Y + 6, 10, 6, dk);
        rect(X + 12, Y + 5, 1, 2, '#e8c23a');
        if (d.locked) { rect(X + 7, Y + 4, 2, 2, ((time * 2) | 0) % 2 ? '#ff4040' : '#a01818'); }
      }
    }
  }

  // ---------- Персонажи ----------
  var parts = [];
  function part(x, y, w, h, c, noOut) { parts.push([x, y, w, h, c, noOut]); }
  function flushParts(ox, oy, dir, white) {
    var i, p;
    l.fillStyle = OUT;
    for (i = 0; i < parts.length; i++) { p = parts[i]; if (p[5]) continue; var px = dir > 0 ? p[0] : -p[0] - p[2]; l.fillRect(ox + px - 1, oy + p[1] - 1, p[2] + 2, p[3] + 2); }
    for (i = 0; i < parts.length; i++) { p = parts[i]; var qx = dir > 0 ? p[0] : -p[0] - p[2]; l.fillStyle = white ? '#fff' : p[4]; l.fillRect(ox + qx, oy + p[1], p[2], p[3]); }
    parts = [];
  }
  function drawWeaponSprite(id, hx, hy, ang, dir, swing) {
    var sp = G.Sprites.weapon(id); if (!sp) return;
    l.save(); l.translate(hx, hy); l.rotate(ang + swing);
    if (dir < 0) l.scale(1, -1);
    l.drawImage(sp, -sp.ax, -sp.ay);
    l.restore();
  }
  function charLook(a) {
    if (a.look) return a.look;
    var id = a.id;
    a.look = { skin: SKIN[a.isPlayer ? 0 : id % SKIN.length], hair: HAIR[(id * 7) % HAIR.length], pants: a.isPlayer ? '#2a2a3a' : ['#2a2a3a', '#3a3428', '#24304a', '#3a2a2a'][id % 4] };
    return a.look;
  }
  function drawChar(a, game, X, Y) {
    var look = charLook(a), t = game.time;
    var fx = Math.cos(a.face), fy = Math.sin(a.face);
    var dir = fx >= 0 ? 1 : -1, back = fy < -0.6, front = fy > 0.6;
    var walk = a.alive ? Math.sin(a.walkPh || 0) : 0;
    var l1 = walk > 0.35 ? -1 : 0, l2 = walk < -0.35 ? -1 : 0;
    var bob = (l1 || l2) ? -1 : 0;
    var body = a.color, white = a.flash > 0;
    // тень
    l.fillStyle = 'rgba(0,0,0,0.4)'; l.fillRect(X - 5, Y - 1, 10, 3); l.fillRect(X - 4, Y - 2, 8, 1);
    var w = a.wdef(), hasW = a.weapon.id !== 'fist';
    var swing = a.swingT > 0 ? (a.swingT / 0.18 - 0.5) * 2.2 * dir : 0;
    var hx = X + dir * 2 + Math.round(fx * 3), hy = Y - 8 + bob + Math.round(fy * 2);
    var weaponBehind = back;
    if (hasW && weaponBehind) drawWeaponSprite(a.weapon.id, hx, hy, a.face, dir, swing);
    // ноги
    part(-3, -4 + l1, 2, 3, look.pants); part(1, -4 + l2, 2, 3, look.pants);
    part(-3, -1 + l1, 2, 1, '#14141a', true); part(1, -1 + l2, 2, 1, '#14141a', true);
    // корпус
    part(-4, -10 + bob, 8, 6, body);
    part(2, -10 + bob, 2, 6, shade(body, -0.25), true);
    part(-4, -10 + bob, 8, 1, shade(body, 0.2), true);
    part(-4, -5 + bob, 8, 1, '#1e1e26', true);
    // голова
    var hyy = -16 + bob;
    part(-3, hyy, 7, 6, look.skin);
    if (back) part(-3, hyy, 7, 5, look.hair, true);
    else {
      part(-3, hyy, 7, 2, look.hair, true);
      part(-3, hyy + 2, 1, 2, look.hair, true);
      if (front) { part(-1, hyy + 3, 1, 1, '#111', true); part(1, hyy + 3, 1, 1, '#111', true); }
      else { part(1, hyy + 3, 1, 1, '#111', true); part(3, hyy + 3, 1, 1, '#111', true); }
    }
    hat(a.hat, body, hyy);
    flushParts(X, Y, dir, white);
    // оружие и кисть
    if (hasW && !weaponBehind) drawWeaponSprite(a.weapon.id, hx, hy, a.face, dir, swing);
    rect(hx - 1, hy - 1, 2, 2, white ? '#fff' : look.skin);
    if (!hasW && a.swingT > 0) { rect(hx + Math.round(fx * 3) - 1, hy + Math.round(fy * 3) - 1, 3, 3, look.skin); }
    // статусы
    if (a.stun > 0) for (var i = 0; i < 3; i++) { var an = t * 6 + i * 2.1; rect(X + Math.round(Math.cos(an) * 5), Y - 19 + Math.round(Math.sin(an) * 2), 1, 1, '#ffef5a'); }
  }
  function hat(h, body, y) {
    switch (h) {
      case 'cap': part(-3, y - 1, 7, 2, shade(body, -0.35)); part(2, y + 1, 3, 1, shade(body, -0.5), true); break;
      case 'police': part(-4, y - 2, 9, 3, '#1a2a6a'); part(-4, y + 1, 9, 1, '#0e1638', true); part(0, y - 1, 1, 1, '#e8c23a', true); break;
      case 'helmet': part(-4, y - 2, 9, 4, shade(body, -0.15)); part(-3, y - 2, 4, 1, shade(body, 0.25), true); break;
      case 'top': part(-3, y - 6, 7, 5, '#141418'); part(-4, y - 1, 9, 1, '#141418'); part(-3, y - 2, 7, 1, '#a02020', true); break;
      case 'band': part(-3, y + 1, 7, 1, '#d22', true); part(-4, y + 2, 1, 2, '#d22', true); break;
      case 'hood': part(-4, y - 1, 9, 4, shade(body, -0.2)); part(-4, y + 3, 1, 3, shade(body, -0.2)); part(4, y + 3, 1, 3, shade(body, -0.2)); break;
      case 'beret': part(-4, y - 1, 8, 2, '#7a1a1a'); part(-1, y - 2, 2, 1, '#7a1a1a', true); break;
      case 'goggles': part(-3, y + 2, 7, 1, '#2a2a2a', true); part(0, y + 2, 2, 1, '#7cf', true); part(3, y + 2, 1, 1, '#7cf', true); break;
      case 'mohawk': part(-1, y - 4, 2, 4, '#3ff'); break;
      case 'beanie': part(-3, y - 2, 7, 3, '#7a3a2a'); part(-3, y, 7, 1, '#5a2a1e', true); break;
      case 'crown': part(-3, y - 3, 7, 2, '#e8c23a'); part(-3, y - 5, 1, 2, '#e8c23a'); part(0, y - 5, 1, 2, '#e8c23a'); part(3, y - 5, 1, 2, '#e8c23a'); part(0, y - 3, 1, 1, '#d22', true); break;
    }
  }
  function drawTurret(a, X, Y) {
    l.fillStyle = 'rgba(0,0,0,0.4)'; l.fillRect(X - 6, Y + 3, 12, 3);
    box(X - 6, Y - 4, 12, 8, a.disabled ? '#3a3a40' : a.hacked ? '#2a6a4a' : '#5a5e6a');
    rect(X - 6, Y - 4, 12, 2, a.disabled ? '#4a4a50' : '#7a7e8a');
    l.save(); l.translate(X, Y - 3); l.rotate(a.face);
    l.fillStyle = OUT; l.fillRect(-1, -3, 11, 6); l.fillStyle = '#2e323a'; l.fillRect(0, -2, 9, 4); l.fillStyle = '#9aa4b0'; l.fillRect(0, -2, 9, 1);
    l.restore();
    box(X - 2, Y - 5, 4, 4, '#3a3e48');
    rect(X - 1, Y - 4, 2, 2, a.disabled ? '#222' : a.state === 'combat' ? '#ff3030' : a.hacked ? '#4dff9a' : '#ffc030');
    if (a.flash > 0) { l.fillStyle = 'rgba(255,255,255,0.7)'; l.fillRect(X - 6, Y - 4, 12, 8); }
  }
  function drawBody(a, X, Y) {
    var look = charLook(a), dir = a.id % 2 ? 1 : -1;
    parts = [];
    part(-7, -4, 4, 3, look.pants); part(-3, -5, 7, 5, shade(a.color, -0.2)); part(4, -6, 6, 6, look.skin); part(4, -6, 2, 6, look.hair, true);
    flushParts(X, Y + 1, dir, false);
  }

  // Пиксельные значки
  var GLYPH = {
    '!': ['1', '1', '1', '.', '1'], '?': ['111', '..1', '.11', '...', '.1.'],
    heart: ['11.11', '11111', '.111.', '..1..'], star: ['..1..', '11111', '.111.', '1.1.1'],
    down: ['11111', '.111.', '..1..']
  };
  function glyph(g, x, y, col) {
    var rows = GLYPH[g], i, j;
    l.fillStyle = OUT;
    for (j = 0; j < rows.length; j++) for (i = 0; i < rows[j].length; i++) if (rows[j][i] === '1') l.fillRect(x + i - 1, y + j - 1, 3, 3);
    l.fillStyle = col;
    for (j = 0; j < rows.length; j++) for (i = 0; i < rows[j].length; i++) if (rows[j][i] === '1') l.fillRect(x + i, y + j, 1, 1);
  }

  function drawOverhead(a, game) {
    if (!a.alive || a.isPlayer) return;
    var X = A(a.x), Y = B(a.y) + 5 - (a.R.boss ? 28 : a.role === 'bouncer' ? 22 : 20);
    if (a.R.turret) Y = B(a.y) - 10;
    if (a.hp < a.maxHp) {
      rect(X - 7, Y, 14, 3, OUT); rect(X - 6, Y + 1, 12, 1, '#3a1010');
      rect(X - 6, Y + 1, Math.max(1, Math.round(12 * a.hp / a.maxHp)), 1, a.rel <= -2 ? '#ff4a4a' : '#4adf5a');
    }
    var gx = X + 6, gy = Y - 6;
    if (a.rel >= 2) glyph('star', gx, gy, '#6cf');
    else if (a.rel === 1) glyph('heart', gx, gy, '#6f6');
    else if (a.rel <= -2 && a.state === 'combat') glyph('!', gx + 2, gy, '#ff4040');
    else if (a.rel === -1 || a.state === 'warn') glyph('?', gx + 1, gy, '#ffa030');
    else if (a.state === 'investigate' || a.state === 'search') glyph('?', gx + 1, gy, '#ffe070');
    else if (a.state === 'flee') glyph('!', gx + 2, gy, '#ffe070');
    if (a.mtarget && isActiveTarget(a, game)) glyph('down', X - 2, Y - 8 + Math.round(Math.sin(game.time * 6)), '#ffd84a');
    if (a.shopkeeper && a.rel > -2) { var cs = G.Sprites.item('coin'); l.drawImage(cs, X - 2, Y - 8); }
  }
  function isActiveTarget(a, game) {
    return game.missions.some(function (mi) {
      if (mi.done || mi.failed) return false;
      return mi.target === a || mi.holder === a || (mi.members && mi.members.indexOf(a) >= 0);
    });
  }

  // ---------- Частицы ----------
  function drawParticle(q) {
    var X = q.x * TP - ix, Y = q.y * TP - iy, k = Math.max(0, q.t / q.max);
    switch (q.type) {
      case 'light': return;
      case 'shell': rect(Math.round(X), Math.round(Y - (q.z || 0) * TP), ((q.rot | 0) % 2) ? 1 : 2, ((q.rot | 0) % 2) ? 2 : 1, q.t < 0.8 ? 'rgba(217,176,64,' + q.t + ')' : q.color); return;
      case 'chunk': rect(Math.round(X), Math.round(Y - (q.z || 0) * TP), q.size, q.size, q.glint && Math.random() < 0.2 ? '#fff' : q.color); return;
      case 'smoke': l.fillStyle = q.color + (k * 0.45) + ')'; l.beginPath(); l.arc(X, Y, q.size * (1.6 - k * 0.6), 0, 7); l.fill(); return;
      case 'fire': {
        var c = k > 0.75 ? '#fff6c0' : k > 0.5 ? '#ffd23a' : k > 0.25 ? '#ff7a1a' : '#a8281a';
        var s = Math.max(1, Math.round(q.size * (0.4 + k * 0.6)));
        rect(Math.round(X - s / 2), Math.round(Y - s / 2), s, s, c); return;
      }
      case 'flash': {
        var sz = q.size, ca = Math.cos(q.ang), sa = Math.sin(q.ang);
        l.fillStyle = q.color;
        for (var i = 0; i < sz; i++) l.fillRect(Math.round(X + ca * i), Math.round(Y + sa * i), 2, 2);
        l.fillRect(Math.round(X - sa * 2), Math.round(Y + ca * 2), 1, 1); l.fillRect(Math.round(X + sa * 2), Math.round(Y - ca * 2), 1, 1);
        l.fillStyle = '#fff'; l.fillRect(Math.round(X) - 1, Math.round(Y) - 1, 3, 3);
        return;
      }
      case 'ring': l.strokeStyle = 'rgba(255,230,170,' + k + ')'; l.lineWidth = 2; l.beginPath(); l.arc(X, Y, q.r * TP * (1.15 - k * 0.8), 0, 7); l.stroke(); return;
      case 'ball': l.fillStyle = 'rgba(255,220,150,' + (k * 0.55) + ')'; l.beginPath(); l.arc(X, Y, q.r * TP * (0.35 + (1 - k) * 0.45), 0, 7); l.fill(); return;
      default:
        l.globalAlpha = Math.min(1, k * 1.5);
        rect(Math.round(X), Math.round(Y - (q.z || 0) * TP), q.size > 2 ? 2 : 1, q.size > 2 ? 2 : 1, q.color);
        l.globalAlpha = 1;
    }
  }

  // ---------- Освещение ----------
  function lighting(game) {
    var m = game.map, D = dist(m), p = game.player;
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, LW, LH);
    lx.fillStyle = D.ambient; lx.fillRect(0, 0, LW, LH);
    var lights = [];
    var vx0 = ix / TP - 6, vx1 = (ix + LW) / TP + 6, vy0 = iy / TP - 6, vy1 = (iy + LH) / TP + 6;
    m.lights.forEach(function (L) {
      if (L.x < vx0 || L.x > vx1 || L.y < vy0 || L.y > vy1) return;
      if (L.obj && L.obj.dead) return;
      lights.push(L);
    });
    lights.push({ x: p.x, y: p.y - 0.3, r: 3.2, c: 'rgba(255,240,220,', a: 0.55, glow: 0 });
    lights.push({ x: m.elevX, y: m.elevY - 0.5, r: 2.6, c: game.canLeave() ? 'rgba(80,255,120,' : 'rgba(255,200,60,', a: 0.8, glow: 0.2 });
    game.map.buildings.forEach(function (b) { if (b.alarmT > 0 && ((game.time * 3) | 0) % 2) lights.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) * 0.7, c: 'rgba(255,40,40,', a: 0.5, glow: 0.18 }); });
    game.fires.forEach(function (f) { lights.push({ x: f.x, y: f.y, r: f.r * 2.4 + Math.random() * 0.4, c: 'rgba(255,140,40,', a: 0.95, glow: 0.3 }); });
    game.particles.forEach(function (q) { if (q.type === 'light') lights.push({ x: q.x, y: q.y, r: q.r, c: q.color, a: Math.min(1, q.t / q.max * 1.4), glow: 0.35 * q.t / q.max }); });
    game.projectiles.forEach(function (b) { if (b.wid === 'rocket' || b.wid === 'flamer') lights.push({ x: b.x, y: b.y, r: 1.4, c: 'rgba(255,160,60,', a: 0.6, glow: 0.2 }); });
    lx.globalCompositeOperation = 'destination-out';
    lights.forEach(function (L) {
      var X = L.x * TP - ix, Y = L.y * TP - iy, r = L.r * TP;
      var gr = lx.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, 'rgba(0,0,0,' + L.a + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + L.a * 0.6 + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = gr; lx.fillRect(X - r, Y - r, r * 2, r * 2);
    });
    l.drawImage(lightCv, 0, 0);
    // цветное свечение
    l.globalCompositeOperation = 'lighter';
    lights.forEach(function (L) {
      if (!L.glow) return;
      var X = L.x * TP - ix, Y = L.y * TP - iy, r = L.r * TP * 0.8;
      var gr = l.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, L.c + L.glow + ')'); gr.addColorStop(1, L.c + '0)');
      l.fillStyle = gr; l.fillRect(X - r, Y - r, r * 2, r * 2);
    });
    l.globalCompositeOperation = 'source-over';
  }

  function drawWeather(game, dt) {
    var D = dist(game.map);
    if (D.weather === 'none') return;
    var n = D.weather === 'rain' ? 110 : 40;
    while (weather.length < n) weather.push({ x: Math.random() * LW, y: Math.random() * LH, v: 0.7 + Math.random() * 0.6 });
    weather.forEach(function (w) {
      if (D.weather === 'rain') {
        w.y += 260 * w.v * dt; w.x -= 40 * w.v * dt;
        var wx = (ix + w.x) / TP, wy = (iy + w.y) / TP + 0.5, tt = game.map.get(Math.floor(wx), Math.floor(wy));
        if (tt !== G.T.FLOOR && tt !== G.T.DOOR && tt !== G.T.WALL && tt !== G.T.WINDOW) { l.fillStyle = 'rgba(170,200,255,0.32)'; l.fillRect(w.x | 0, w.y | 0, 1, 3); }
        if (w.y > LH) { if (Math.random() < 0.5) { l.fillStyle = 'rgba(190,215,255,0.4)'; l.fillRect(w.x | 0, (Math.random() * LH) | 0, 2, 1); } w.y = -4; w.x = Math.random() * (LW + 40); }
      } else {
        w.y -= 12 * w.v * dt; w.x += Math.sin(time + w.v * 9) * 8 * dt;
        l.fillStyle = w.v > 1.1 ? 'rgba(255,140,50,0.7)' : 'rgba(150,140,130,0.35)'; l.fillRect(w.x | 0, w.y | 0, 1, 1);
        if (w.y < 0) { w.y = LH; w.x = Math.random() * LW; }
      }
    });
  }

  // ---------- Главная функция ----------
  function draw(game, dt) {
    time += dt;
    var p = game.player, m = game.map;
    if (builtFor !== m) build(m);
    if (m.dirty && m.dirty.length) {
      for (var di = 0; di < m.dirty.length; di += 2) for (var dy = -1; dy <= 1; dy++) if (m.inb(m.dirty[di], m.dirty[di + 1] + dy)) tile(m, m.dirty[di], m.dirty[di + 1] + dy);
      m.dirty.length = 0;
    }
    bakeDecals(m);
    // камера с упреждением по прицелу
    var lead = (G.input.aiming && G.input.aimMag > 0.2) ? 1.6 : 0;
    var tx = p.x + Math.cos(p.face) * lead, ty = p.y - 0.3 + Math.sin(p.face) * lead;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    if (Math.abs(p.x - cam.x) > 10 || Math.abs(p.y - cam.y) > 10) { cam.x = p.x; cam.y = p.y; }
    var kick = game.kick || { x: 0, y: 0 };
    camTL.x = cam.x * TP - (W / S) / 2 + kick.x; camTL.y = cam.y * TP - (H / S) / 2 + kick.y;
    ix = Math.floor(camTL.x); iy = Math.floor(camTL.y);
    var frx = camTL.x - ix, fry = camTL.y - iy;

    l.imageSmoothingEnabled = false;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.fillStyle = '#0a0a10'; l.fillRect(0, 0, LW, LH);
    l.drawImage(mapCv, ix, iy, LW, LH, 0, 0, LW, LH);
    l.drawImage(decalCv, ix, iy, LW, LH, 0, 0, LW, LH);

    var x0 = ix / TP - 2, x1 = (ix + LW) / TP + 2, y0 = iy / TP - 2, y1 = (iy + LH) / TP + 3;
    var vis = function (x, y) { return x > x0 && x < x1 && y > y0 && y < y1; };
    // огонь на полу
    game.fires.forEach(function (f) { if (Math.random() < 0.7) G.FX.flame(game, f.x, f.y, f.r * 1.5); });
    // на полу: гильзы, трупы, подбираемое
    game.particles.forEach(function (q) { if (q.type === 'shell' && !q.grav) drawParticle(q); });
    game.actors.forEach(function (a) { if (!a.alive && !a.R.turret && vis(a.x, a.y)) drawBody(a, A(a.x), B(a.y)); });
    game.pickups.forEach(function (pk) {
      if (!vis(pk.x, pk.y)) return;
      var X = A(pk.x), Y = B(pk.y), bob = Math.round(Math.sin(game.time * 4 + pk.bob));
      rect(X - 3, Y + 2, 6, 1, 'rgba(0,0,0,0.35)');
      var sp = G.Sprites.item(pk.money ? 'coin' : pk.id);
      if (sp) {
        l.drawImage(sp, X - (sp.width >> 1), Y - sp.height + bob);
        if (pk.money && pk.money > 20) l.drawImage(sp, X - (sp.width >> 1) + 2, Y - sp.height + bob - 2);
        if (((game.time * 2 + pk.bob) | 0) % 3 === 0) rect(X + 2, Y - sp.height - 1 + bob, 1, 1, '#fff');
      }
    });
    // сортировка по глубине
    var list = [];
    m.objects.forEach(function (o) { if (vis(o.x, o.y)) list.push({ y: o.y + (G.OBJDEF[o.type].low ? 0.2 : 0.9), o: o }); });
    for (var k in m.doors) { var d = m.doors[k]; if (vis(d.x, d.y)) list.push({ y: d.y + 0.95, d: d }); }
    game.actors.forEach(function (a) { if (a.alive && vis(a.x, a.y)) list.push({ y: a.y + 0.3, a: a }); });
    game.bombs.forEach(function (b) { if (vis(b.x, b.y)) list.push({ y: b.y + 0.2, b: b }); });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (it) {
      if (it.o) drawObj(it.o, game);
      else if (it.d) drawDoor(m, it.d);
      else if (it.a) {
        var a = it.a, X = A(a.x), Y = B(a.y) + 5;
        if (a.isPlayer && a.hidden) return;
        if (a.R.turret && !a.isPlayer) { drawTurret(a, X, B(a.y) + 2); return; }
        var ghost = a.invis > 0;
        if (ghost) l.globalAlpha = a.isPlayer ? 0.45 : 0.15;
        var big = a.R.boss ? 1.6 : a.role === 'bouncer' ? 1.25 : 1;
        if (big > 1) { l.save(); l.translate(X, Y); l.scale(big, big); drawChar(a, game, 0, 0); l.restore(); }
        else drawChar(a, game, X, Y);
        l.globalAlpha = 1;
        if (a.burn > 0) for (var f = 0; f < 2; f++) G.FX.flame(game, a.x, a.y - 0.4, 0.5);
      } else if (it.b) {
        var b = it.b, bx = A(b.x), by = B(b.y), sp = G.Sprites.item(b.c4 ? 'c4' : b.id);
        rect(bx - 2, by + 1, 5, 1, 'rgba(0,0,0,0.4)');
        if (sp) {
          l.save(); l.translate(bx, by - Math.round((b.h || 0) * TP) - 3); if (!b.landed) l.rotate(game.time * 14);
          l.drawImage(sp, -(sp.width >> 1), -(sp.height >> 1)); l.restore();
        }
        if (b.landed && b.fuse > 0 && ((game.time * (b.fuse < 1 ? 16 : 6)) | 0) % 2) rect(bx, by - 8, 1, 1, '#ff3030');
      }
    });
    // снаряды
    game.projectiles.forEach(function (b) {
      if (b.w.fire) return;
      var X = b.x * TP - ix, Y = b.y * TP - iy - 6;
      if (b.wid === 'rocket') { var sp = G.Sprites.weapon('grenade'); l.save(); l.translate(X, Y); l.rotate(Math.atan2(b.vy, b.vx)); rect(-4, -1, 6, 3, '#4f8f3f'); rect(2, -1, 2, 3, '#c0392b'); l.restore(); void sp; if (Math.random() < 0.8) G.FX.dust(game, b.x, b.y - 0.35, 1, 'rgba(200,200,200,'); return; }
      var len = Math.min(10, Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 0.35), n = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      var ux = b.vx / n, uy = b.vy / n;
      for (var i = 0; i < len; i++) { l.fillStyle = i < 2 ? '#fff' : b.color; l.globalAlpha = 1 - i / len; l.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1); }
      l.globalAlpha = 1;
    });
    game.particles.forEach(function (q) { if (q.type === 'shell' && !q.grav) return; if (q.type !== 'fire' && q.type !== 'flash' && q.type !== 'ball') drawParticle(q); });
    l.globalCompositeOperation = 'lighter';
    game.particles.forEach(function (q) { if (q.type === 'fire' || q.type === 'flash' || q.type === 'ball') drawParticle(q); });
    l.globalCompositeOperation = 'source-over';
    // дым гранат
    game.smokes.forEach(function (sm) {
      var a = Math.min(1, sm.t / 2);
      for (var i = 0; i < 9; i++) {
        var ox = Math.cos(i * 1.7 + game.time * 0.4) * sm.r * 0.5, oy = Math.sin(i * 2.3 + game.time * 0.3) * sm.r * 0.4;
        l.fillStyle = 'rgba(190,190,198,' + a * 0.4 + ')';
        l.beginPath(); l.arc((sm.x + ox) * TP - ix, (sm.y + oy) * TP - iy, sm.r * TP * 0.55, 0, 7); l.fill();
      }
    });

    lighting(game);
    drawWeather(game, dt);

    // поверх света: значки, подсветка, прицел
    game.actors.forEach(function (a) { if (vis(a.x, a.y)) drawOverhead(a, game); });
    var it = game.interact;
    if (it && p.alive) {
      var cx, cy, hw = 9, hh = 11;
      if (it.kind === 'actor') { cx = A(it.a.x); cy = B(it.a.y) - 4; } else if (it.kind === 'obj') { cx = A(it.o.x) + 8; cy = B(it.o.y) + 6; } else if (it.kind === 'door') { cx = A(it.d.x) + 8; cy = B(it.d.y) + 6; } else { cx = A(it.x) + 8; cy = B(it.y) + 8; }
      var pulse = ((game.time * 4) | 0) % 2;
      var col = pulse ? '#ffffff' : '#ffd84a', e = hw + pulse;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        rect(cx + s[0] * e - (s[0] > 0 ? 2 : 0), cy + s[1] * (hh + pulse) - (s[1] > 0 ? 0 : 0), 3, 1, col);
        rect(cx + s[0] * e - (s[0] > 0 ? 0 : 0), cy + s[1] * (hh + pulse) - (s[1] > 0 ? 2 : 0), 1, 3, col);
      });
    }
    if (p.alive && G.input.aiming && G.input.aimMag > 0.2) {
      var w = p.wdef(), L = (w.kind === 'throw' ? (p.throwPower || 0.8) * w.range : w.kind === 'melee' ? w.range : Math.min(w.range, 6)) * TP;
      var sx0 = A(p.x), sy0 = B(p.y) - 6, ca = Math.cos(p.face), sa = Math.sin(p.face);
      for (var q = 10; q < L; q += 4) rect(Math.round(sx0 + ca * q), Math.round(sy0 + sa * q), 1, 1, w.kind === 'throw' ? 'rgba(255,210,90,0.8)' : 'rgba(255,90,90,0.7)');
      var ex = Math.round(sx0 + ca * L), ey = Math.round(sy0 + sa * L);
      rect(ex - 3, ey, 2, 1, '#ff5a5a'); rect(ex + 2, ey, 2, 1, '#ff5a5a'); rect(ex, ey - 3, 1, 2, '#ff5a5a'); rect(ex, ey + 2, 1, 2, '#ff5a5a');
    }

    // вывод на экран
    var shx = 0, shy = 0;
    if (game.shake > 0) { shx = Math.round((Math.random() - 0.5) * game.shake * 8) * S; shy = Math.round((Math.random() - 0.5) * game.shake * 8) * S; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a10'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(lc, 0, 0, LW, LH, Math.round(-frx * S) + shx, Math.round(-fry * S) + shy, LW * S, LH * S);
    overlay(game);
  }

  function screen(wx, wy) { return { x: (wx * TP - camTL.x) * S, y: (wy * TP - camTL.y) * S }; }

  function overlay(game) {
    var p = game.player;
    // реплики
    game.actors.forEach(function (a) {
      if (!a.bark || !a.alive) return;
      var s = screen(a.x, a.y - (a.R.boss ? 2.2 : 1.6));
      if (s.x < -200 || s.x > W + 200 || s.y < -50 || s.y > H + 50) return;
      bubble(a.bark, s.x, s.y, Math.min(1, a.barkT * 2));
    });
    game.texts.forEach(function (t) {
      var s = screen(t.x, t.y - 0.6), k = 1.1 - t.t;
      var pop = k < 0.12 ? 1 + (0.12 - k) * 4 : 1;
      ctx.globalAlpha = Math.min(1, t.t * 2);
      txt(t.text, s.x, s.y, Math.round(t.size * DPR * 1.15 * pop), t.color);
      ctx.globalAlpha = 1;
    });
    // экранные эффекты
    if (game.focusT > 0) { ctx.fillStyle = 'rgba(80,140,255,0.12)'; ctx.fillRect(0, 0, W, H); }
    if (p.invis > 0) { ctx.fillStyle = 'rgba(140,90,220,0.12)'; ctx.fillRect(0, 0, W, H); }
    if (p.hidden) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H); txt('В УКРЫТИИ', W / 2, H * 0.35, 18 * DPR, '#aaa'); }
    if (p.hurtT > 0) { ctx.fillStyle = 'rgba(255,0,0,' + p.hurtT * 0.6 + ')'; ctx.fillRect(0, 0, W, H); }
    var low = p.hp < p.maxHp * 0.3;
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.0);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, low ? 'rgba(140,0,0,' + (0.45 + Math.sin(time * 5) * 0.15) + ')' : 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // скан-линии для стиля
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (var y = 0; y < H; y += S * 2) ctx.fillRect(0, y, W, Math.max(1, S >> 1));
    drawArrows(game);
  }
  function bubble(s, x, y, a) {
    ctx.font = 'bold ' + Math.round(11 * DPR) + 'px "Trebuchet MS", sans-serif';
    var tw = Math.round(ctx.measureText(s).width + 12 * DPR), th = Math.round(20 * DPR), bx = Math.round(x - tw / 2), by = Math.round(y - th);
    var u = Math.max(2, Math.round(DPR * 1.5));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#101016'; ctx.fillRect(bx - u, by - u, tw + u * 2, th + u * 2);
    ctx.fillStyle = '#f4f0e6'; ctx.fillRect(bx, by, tw, th);
    ctx.fillStyle = '#101016'; ctx.fillRect(Math.round(x) - u * 2, by + th + u, u * 4, u); ctx.fillRect(Math.round(x) - u, by + th + u * 2, u * 2, u);
    ctx.fillStyle = '#f4f0e6'; ctx.fillRect(Math.round(x) - u, by + th, u * 2, u * 2);
    ctx.fillStyle = '#16161e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, by + th / 2 + 1);
    ctx.globalAlpha = 1;
  }
  function txt(s, x, y, size, color) {
    ctx.font = '900 ' + Math.round(size) + 'px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size * 0.28); ctx.strokeStyle = '#101016'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function drawArrows(game) {
    var pts = [];
    game.missions.forEach(function (mi) { G.missionMarkers(game, mi).forEach(function (q) { pts.push({ x: q.x, y: q.y, c: '#ffd84a' }); }); });
    if (game.canLeave()) pts.push({ x: game.map.elevX, y: game.map.elevY, c: '#3fd16a' });
    var margin = 30 * DPR;
    pts.forEach(function (q) {
      var s = screen(q.x, q.y);
      if (s.x > margin && s.x < W - margin && s.y > margin && s.y < H - margin) return;
      var ang = Math.atan2(s.y - H / 2, s.x - W / 2);
      var cx = G.clamp(W / 2 + Math.cos(ang) * (W / 2 - margin), margin, W - margin), cy = G.clamp(H / 2 + Math.sin(ang) * (H / 2 - margin), margin, H - margin);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      var u = 2 * DPR;
      ctx.fillStyle = '#101016'; ctx.beginPath(); ctx.moveTo(8 * u, 0); ctx.lineTo(-5 * u, -6 * u); ctx.lineTo(-5 * u, 6 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = q.c; ctx.beginPath(); ctx.moveTo(6 * u, 0); ctx.lineTo(-3.5 * u, -4.5 * u); ctx.lineTo(-3.5 * u, 4.5 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }

  // Мини-карта
  function drawMinimap(game, mc, full) {
    var m = game.map, c = mc.getContext('2d');
    var s = full ? Math.max(1, Math.floor(Math.min(mc.width / m.w, mc.height / m.h))) : 2;
    if (!full) { mc.width = m.w * s; mc.height = m.h * s; }
    var ox = full ? Math.floor((mc.width - m.w * s) / 2) : 0, oy = full ? Math.floor((mc.height - m.h * s) / 2) : 0;
    c.fillStyle = '#0c0c14'; c.fillRect(0, 0, mc.width, mc.height);
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) {
      var v = m.t[y * m.w + x];
      c.fillStyle = isW(v) ? '#8a86a0' : v === G.T.FLOOR || v === G.T.DOOR ? '#3a3850' : v === G.T.GRASS ? '#24442a' : v === G.T.ELEV ? (game.canLeave() ? '#3fd16a' : '#e0b020') : v === G.T.SIDE ? '#24242e' : '#1a1a22';
      c.fillRect(ox + x * s, oy + y * s, s, s);
    }
    var dot = function (x, y, col, r) { c.fillStyle = col; c.fillRect(ox + x * s - r, oy + y * s - r, r * 2, r * 2); };
    if (full) {
      c.font = 'bold ' + Math.max(9, s * 2.2) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      m.buildings.forEach(function (b) { if (b.type !== 'house') { c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(b.def.name, ox + (b.x + b.w / 2) * s, oy + (b.y + b.h / 2) * s); c.fillStyle = '#eee'; c.fillText(b.def.name, ox + (b.x + b.w / 2) * s, oy + (b.y + b.h / 2) * s); } });
    }
    game.actors.forEach(function (a) {
      if (!a.alive || a.isPlayer) return;
      if (a.rel >= 2) dot(a.x, a.y, '#6cf', s);
      else if (a.rel <= -2) dot(a.x, a.y, '#f44', s * 0.8);
      else if (full && a.fac === 'cop') dot(a.x, a.y, '#48f', s * 0.6);
    });
    game.missions.forEach(function (mi) { G.missionMarkers(game, mi).forEach(function (q) { dot(q.x, q.y, '#ffd84a', s * 1.2); }); });
    dot(game.player.x, game.player.y, '#fff', s * 1.4);
  }

  // Портрет для экрана выбора класса
  function portrait(canvas, cls) {
    var save = { l: l, ix: ix, iy: iy };
    var pc = document.createElement('canvas'); pc.width = 24; pc.height = 24;
    l = pc.getContext('2d'); l.imageSmoothingEnabled = false; ix = 0; iy = 0;
    var fake = { id: 0, isPlayer: true, alive: true, color: cls.color, hat: cls.hat, face: 0.35, walkPh: 0, weapon: { id: cls.start[0][0] }, flash: 0, stun: 0, swingT: 0,
      wdef: function () { return G.WEAPONS[this.weapon.id] || G.WEAPONS.fist; } };
    drawChar(fake, { time: 0 }, 11, 21);
    var c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#1d1d28'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(pc, 0, 0, 24, 24, 0, 0, canvas.width, canvas.height);
    l = save.l; ix = save.ix; iy = save.iy;
  }

  return { init: init, resize: resize, draw: draw, drawMinimap: drawMinimap, portrait: portrait, worldFromScreen: function (px, py) { return { x: (px * DPR / S + camTL.x) / TP, y: (py * DPR / S + camTL.y) / TP + 0.35 }; } };
})();
