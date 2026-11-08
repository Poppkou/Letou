'use strict';
// Карта этажа: тайлы, здания, объекты, генерация, видимость, поиск пути.

var T = G.T = { STREET: 0, SIDE: 1, GRASS: 2, FLOOR: 3, WALL: 4, DOOR: 5, WINDOW: 6, RUBBLE: 7, ELEV: 8, WINBROKEN: 9, BORDER: 10 };

G.Map = function (w, h) {
  this.w = w; this.h = h;
  this.t = new Uint8Array(w * h);
  this.bid = new Int16Array(w * h).fill(-1);
  this.solid = new Uint8Array(w * h);   // твёрдые объекты
  this.objAt = {};                       // idx -> объект
  this.doors = {};                       // idx -> {locked, hp, openT, bid}
  this.buildings = [];
  this.objects = [];
  this.decals = [];
};
var MP = G.Map.prototype;
MP.idx = function (x, y) { return y * this.w + x; };
MP.inb = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
MP.get = function (x, y) { return this.inb(x, y) ? this.t[y * this.w + x] : T.BORDER; };
MP.set = function (x, y, v) { if (this.inb(x, y)) this.t[y * this.w + x] = v; };
MP.bAt = function (x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (!this.inb(x, y)) return null;
  var b = this.bid[y * this.w + x];
  return b >= 0 ? this.buildings[b] : null;
};
MP.isWallish = function (v) { return v === T.WALL || v === T.BORDER || v === T.WINDOW; };

// Блокирует ли клетка взгляд
MP.blocksSight = function (x, y) {
  var v = this.get(x, y);
  if (v === T.WALL || v === T.BORDER) return true;
  if (v === T.DOOR) { var d = this.doors[this.idx(x, y)]; return !(d && (d.openT > 0 || d.broken)); }
  return false;
};

// Можно ли пройти клетку конкретному существу (a может быть null — тогда «гость»)
MP.passable = function (x, y, a) {
  if (!this.inb(x, y)) return false;
  var i = y * this.w + x, v = this.t[i];
  if (this.solid[i]) return false;
  if (v === T.WALL || v === T.BORDER || v === T.WINDOW) return false;
  if (v === T.DOOR) {
    var d = this.doors[i];
    if (!d || d.broken || !d.locked) return true;
    if (a && !a.isPlayer && a.home && a.home.id === d.bid) return true; // у хозяев есть ключ
    if (a && a.keyAll) return true;
    return false;
  }
  return true;
};

// Прямая видимость (тайловый луч + дым)
MP.los = function (x0, y0, x1, y1) {
  var dx = x1 - x0, dy = y1 - y0;
  var len = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.ceil(len / 0.25);
  var lx = -1, ly = -1;
  for (var i = 1; i < steps; i++) {
    var px = x0 + dx * i / steps, py = y0 + dy * i / steps;
    var tx = Math.floor(px), ty = Math.floor(py);
    if (tx === lx && ty === ly) continue;
    lx = tx; ly = ty;
    if (this.blocksSight(tx, ty)) return false;
  }
  if (G.game && G.game.smokes.length) {
    for (var s = 0; s < G.game.smokes.length; s++) {
      var sm = G.game.smokes[s];
      if (segCircle(x0, y0, x1, y1, sm.x, sm.y, sm.r * 0.85)) return false;
    }
  }
  return true;
};
function segCircle(x0, y0, x1, y1, cx, cy, r) {
  var dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  var t = l2 ? ((cx - x0) * dx + (cy - y0) * dy) / l2 : 0;
  t = G.clamp(t, 0, 1);
  var px = x0 + dx * t, py = y0 + dy * t;
  return G.dist2(px, py, cx, cy) < r * r;
}

// A* по сетке, 8 направлений без срезания углов
MP.path = function (sx, sy, ex, ey, a, maxNodes) {
  sx = Math.floor(sx); sy = Math.floor(sy); ex = Math.floor(ex); ey = Math.floor(ey);
  if (!this.inb(ex, ey)) return null;
  if (sx === ex && sy === ey) return [];
  var w = this.w, self = this;
  maxNodes = maxNodes || 2500;
  var goal = ey * w + ex, start = sy * w + sx;
  var g = {}, came = {}, closed = {};
  var heap = new G.Heap();
  g[start] = 0; heap.push(start, 0);
  var n = 0, best = start, bestH = 1e9;
  var dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  var goalPass = this.passable(ex, ey, a);
  while (heap.size()) {
    var cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { best = goal; break; }
    if (++n > maxNodes) break;
    var cx = cur % w, cy = (cur - cx) / w;
    var h0 = Math.abs(cx - ex) + Math.abs(cy - ey);
    if (h0 < bestH) { bestH = h0; best = cur; }
    for (var d = 0; d < 8; d++) {
      var nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      var ni = ny * w + nx;
      if (closed[ni]) continue;
      var isGoal = ni === goal;
      if (!this.passable(nx, ny, a) && !(isGoal && !goalPass)) continue;
      if (isGoal && !goalPass) { /* дойдём до соседней клетки */ }
      if (d >= 4 && (!self.passable(cx + dirs[d][0], cy, a) || !self.passable(cx, cy + dirs[d][1], a))) continue;
      var ng = g[cur] + dirs[d][2];
      if (g[ni] === undefined || ng < g[ni]) {
        g[ni] = ng; came[ni] = cur;
        var hx = Math.abs(nx - ex), hy = Math.abs(ny - ey);
        heap.push(ni, ng + Math.max(hx, hy) + 0.414 * Math.min(hx, hy));
      }
    }
  }
  var out = [], c = best;
  if (c === start) return null;
  while (c !== start && c !== undefined) {
    var x = c % w; out.push({ x: x + 0.5, y: (c - x) / w + 0.5 });
    c = came[c];
  }
  out.reverse();
  if (!goalPass && out.length && best === goal) out.pop();
  return out;
};

// Случайная проходимая клетка с фильтром
MP.randomCell = function (rng, filter, tries) {
  tries = tries || 400;
  for (var i = 0; i < tries; i++) {
    var x = rng.int(1, this.w - 2), y = rng.int(1, this.h - 2);
    if (this.passable(x, y, null) && (!filter || filter(x, y))) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
};
MP.cellInRect = function (rng, r, filter) {
  for (var i = 0; i < 200; i++) {
    var x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1);
    var ii = this.idx(x, y);
    if ((this.t[ii] === T.FLOOR || this.t[ii] === T.STREET || this.t[ii] === T.SIDE || this.t[ii] === T.GRASS) && !this.solid[ii] && !this.objAt[ii] && (!filter || filter(x, y))) return { x: x, y: y };
  }
  return null;
};

MP.addObj = function (type, x, y, extra) {
  var def = G.OBJDEF[type];
  var o = { type: type, x: x, y: y, hp: def.hp || 0, bid: this.bid[this.idx(x, y)], items: [], money: 0 };
  if (extra) for (var k in extra) o[k] = extra[k];
  this.objects.push(o);
  var i = this.idx(x, y);
  this.objAt[i] = o;
  if (def.solid) this.solid[i] = 1;
  return o;
};
MP.removeObj = function (o) {
  var i = this.idx(o.x, o.y);
  if (this.objAt[i] === o) { delete this.objAt[i]; this.solid[i] = 0; }
  var k = this.objects.indexOf(o);
  if (k >= 0) this.objects.splice(k, 1);
  o.dead = true;
};

// Описание объектов
G.OBJDEF = {
  safe:     { name: 'Сейф', solid: 1, hp: 0, locked: 1 },
  crate:    { name: 'Ящик', solid: 1, hp: 25 },
  wardrobe: { name: 'Шкаф', solid: 1, hp: 30 },
  terminal: { name: 'Терминал', solid: 1, hp: 30 },
  alarm:    { name: 'Сигнализация', solid: 0, hp: 15, wall: 1 },
  vent:     { name: 'Вентиляция', solid: 0 },
  trash:    { name: 'Мусорный бак', solid: 1, hp: 0, hide: 1 },
  barrel:   { name: 'Бочка с топливом', solid: 1, hp: 12, explosive: 1 },
  counter:  { name: 'Прилавок', solid: 1, low: 1 },
  table:    { name: 'Стол', solid: 1, low: 1 },
  bed:      { name: 'Кровать', solid: 1, low: 1 },
  plant:    { name: 'Фикус', solid: 1, hp: 8 },
  tree:     { name: 'Дерево', solid: 1 },
  bush:     { name: 'Кусты', solid: 0, hide: 1 },
  bench:    { name: 'Скамейка', solid: 1, low: 1 },
  lamp:     { name: 'Фонарь', solid: 1 },
  vending:  { name: 'Автомат с едой', solid: 1, hp: 40 },
  atm:      { name: 'Банкомат', solid: 1, hp: 60 },
  generator:{ name: 'Генератор', solid: 1, hp: 90 },
  server:   { name: 'Сервер', solid: 1, hp: 70 },
  still:    { name: 'Самогонный аппарат', solid: 1, hp: 60 },
  elevator: { name: 'Лифт', solid: 0 },
  chains:   { name: 'Цепи', solid: 0 }
};

// ---------------- Генерация ----------------
G.generateFloor = function (floor, seed) {
  var rng = G.RNG(seed);
  var dist = G.DISTRICTS[Math.min(2, Math.floor((floor - 1) / 2))];
  var W = 78 + floor * 2, H = 58 + floor * 2;
  var m = new G.Map(W, H);
  m.floor = floor; m.district = dist; m.rng = rng;
  var x, y;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    m.t[y * W + x] = (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? T.BORDER : T.STREET;
  }
  // Рекурсивное деление на кварталы с улицами шириной 3
  var leaves = [];
  (function split(r, depth) {
    var canV = r.w >= 26, canH = r.h >= 22;
    if ((!canV && !canH) || (depth > 2 && rng.chance(0.25) && r.w < 34 && r.h < 30)) { leaves.push(r); return; }
    var vert = canV && (!canH || (r.w / r.h > 1.15) || (r.w / r.h > 0.85 && rng.chance(0.5)));
    var gap = 3;
    if (vert) {
      var sx = rng.int(r.x + 11, r.x + r.w - 11 - gap);
      split({ x: r.x, y: r.y, w: sx - r.x, h: r.h }, depth + 1);
      split({ x: sx + gap, y: r.y, w: r.x + r.w - sx - gap, h: r.h }, depth + 1);
    } else {
      var sy = rng.int(r.y + 10, r.y + r.h - 10 - gap);
      split({ x: r.x, y: r.y, w: r.w, h: sy - r.y }, depth + 1);
      split({ x: r.x, y: sy + gap, w: r.w, h: r.y + r.h - sy - gap }, depth + 1);
    }
  })({ x: 4, y: 4, w: W - 8, h: H - 8 }, 0);

  // Тротуары
  leaves.forEach(function (r) {
    for (var yy = r.y - 1; yy < r.y + r.h + 1; yy++) for (var xx = r.x - 1; xx < r.x + r.w + 1; xx++) {
      if (m.get(xx, yy) === T.STREET) m.set(xx, yy, T.SIDE);
    }
  });

  // Старт и лифт — в самых дальних кварталах
  leaves.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
  var startLeaf = leaves[0], elevLeaf = leaves[leaves.length - 1];
  var plots = [];
  leaves.forEach(function (r) {
    if (r === startLeaf || r === elevLeaf) return;
    var inner = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 };
    if (rng.chance(0.08)) { makePark(m, rng, r); return; }
    // делим большие участки на два здания
    if (inner.w >= 20 && rng.chance(0.7)) {
      var cut = rng.int(inner.x + 8, inner.x + inner.w - 9);
      plots.push({ x: inner.x, y: inner.y, w: cut - inner.x, h: inner.h });
      plots.push({ x: cut + 2, y: inner.y, w: inner.x + inner.w - cut - 2, h: inner.h });
    } else if (inner.h >= 18 && rng.chance(0.7)) {
      var cy = rng.int(inner.y + 7, inner.y + inner.h - 8);
      plots.push({ x: inner.x, y: inner.y, w: inner.w, h: cy - inner.y });
      plots.push({ x: inner.x, y: cy + 2, w: inner.w, h: inner.y + inner.h - cy - 2 });
    } else plots.push(inner);
  });
  // площадки старта и лифта
  makePlaza(m, rng, startLeaf);
  makePlaza(m, rng, elevLeaf);

  // Назначение типов зданий
  var need = ['shop', 'police', 'warehouse'];
  if (floor % 2 === 1 || floor >= 5) need.push('bar');
  if (dist.gangs) { need.push('rustbase'); need.push('neonbase'); }
  if (floor >= 3) need.push('lab');
  if (floor >= 5) need.push('bank');
  if (floor === G.MAX_FLOOR) need.unshift('tower');
  plots.sort(function (a, b) { return b.w * b.h - a.w * a.h; });
  var bigFirst = ['tower', 'rustbase', 'neonbase', 'warehouse', 'lab', 'bank', 'police'];
  var assign = [];
  need.sort(function (a, b) { return (bigFirst.indexOf(a) < 0 ? 99 : bigFirst.indexOf(a)) - (bigFirst.indexOf(b) < 0 ? 99 : bigFirst.indexOf(b)); });
  for (var i = 0; i < plots.length; i++) assign.push(i < need.length ? need[i] : 'house');
  plots.forEach(function (p, i) {
    if (p.w < 6 || p.h < 6) { makePark(m, rng, { x: p.x - 1, y: p.y - 1, w: p.w + 2, h: p.h + 2 }); return; }
    makeBuilding(m, rng, p, assign[i], floor);
  });

  // Лифт
  var ec = { x: elevLeaf.x + Math.floor(elevLeaf.w / 2) - 1, y: elevLeaf.y + Math.floor(elevLeaf.h / 2) - 1 };
  for (y = 0; y < 2; y++) for (x = 0; x < 2; x++) m.set(ec.x + x, ec.y + y, T.ELEV);
  m.elevator = m.addObj('elevator', ec.x, ec.y);
  m.elevX = ec.x + 1; m.elevY = ec.y + 1;
  m.startX = startLeaf.x + Math.floor(startLeaf.w / 2) + 0.5;
  m.startY = startLeaf.y + Math.floor(startLeaf.h / 2) + 0.5;
  m.leaves = leaves;

  // Уличный декор: мусорки, бочки, фонари, банкоматы
  var streetFilter = function (xx, yy) {
    return m.get(xx, yy) === T.SIDE && G.dist(xx, yy, m.startX, m.startY) > 4 && !nearDoor(m, xx, yy);
  };
  for (i = 0; i < 26 + floor * 2; i++) {
    var c = m.randomCell(rng, streetFilter);
    if (!c) continue;
    var kind = rng.pick(['trash', 'trash', 'trash', 'barrel', 'lamp', 'lamp', 'bush']);
    if (kind === 'trash') m.addObj('trash', Math.floor(c.x), Math.floor(c.y));
    else m.addObj(kind, Math.floor(c.x), Math.floor(c.y));
  }
  for (i = 0; i < 2; i++) {
    c = m.randomCell(rng, streetFilter);
    if (c) m.addObj(rng.chance(0.5) ? 'vending' : 'atm', Math.floor(c.x), Math.floor(c.y), { money: rng.int(20, 60) });
  }
  fixReachability(m);
  return m;
};

// Убирает мебель, которая отрезала часть карты от старта
function fixReachability(m) {
  for (var iter = 0; iter < 12; iter++) {
    var W = m.w, seen = new Uint8Array(W * m.h);
    var st = Math.floor(m.startY) * W + Math.floor(m.startX), q = [st]; seen[st] = 1;
    var open = function (x, y) { var v = m.get(x, y); return !m.solid[m.idx(x, y)] && v !== T.WALL && v !== T.BORDER && v !== T.WINDOW; };
    while (q.length) {
      var c = q.pop(), x = c % W, y = (c - x) / W;
      for (var d = 0; d < 4; d++) {
        var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d], ni = ny * W + nx;
        if (!seen[ni] && m.inb(nx, ny) && open(nx, ny)) { seen[ni] = 1; q.push(ni); }
      }
    }
    var removed = 0;
    for (var i = 0; i < W * m.h; i++) {
      var v = m.t[i];
      if (seen[i] || m.solid[i] || !(v === T.FLOOR || v === T.SIDE || v === T.STREET || v === T.GRASS)) continue;
      var cx = i % W, cy = (i - cx) / W;
      for (d = 0; d < 4; d++) {
        var ox = cx + [1, -1, 0, 0][d], oy = cy + [0, 0, 1, -1][d], o = m.objAt[m.idx(ox, oy)];
        if (o && G.OBJDEF[o.type].solid && seen[m.idx(ox + (ox - cx), oy + (oy - cy))] !== undefined) {
          // убираем, только если за объектом — достижимая клетка
          var bx = ox + (ox - cx), by = oy + (oy - cy);
          if (seen[m.idx(bx, by)] || iter > 4) { removeEverywhere(m, o); removed++; break; }
        }
      }
    }
    if (!removed) break;
  }
}
function removeEverywhere(m, o) {
  m.removeObj(o);
  m.buildings.forEach(function (b) { var k = b.objects.indexOf(o); if (k >= 0) b.objects.splice(k, 1); });
}

function nearDoor(m, x, y) {
  for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
    if (m.get(x + dx, y + dy) === T.DOOR) return true;
  }
  return false;
}

function makePark(m, rng, r) {
  for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) {
    if (m.get(x, y) === T.SIDE || m.get(x, y) === T.STREET) m.set(x, y, T.GRASS);
  }
  var n = Math.floor(r.w * r.h / 14);
  for (var i = 0; i < n; i++) {
    var c = m.cellInRect(rng, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 });
    if (c) m.addObj(rng.pick(['tree', 'tree', 'bush', 'bush', 'bench']), c.x, c.y);
  }
}
function makePlaza(m, rng, r) {
  for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) {
    if (m.get(x, y) === T.STREET) m.set(x, y, T.SIDE);
  }
  for (var i = 0; i < 4; i++) {
    var c = m.cellInRect(rng, { x: r.x, y: r.y, w: r.w, h: r.h }, function (xx, yy) {
      return Math.abs(xx - (r.x + r.w / 2)) > 2.5 || Math.abs(yy - (r.y + r.h / 2)) > 2.5;
    });
    if (c) m.addObj(rng.pick(['tree', 'bench', 'lamp']), c.x, c.y);
  }
}

function makeBuilding(m, rng, r, type, floor) {
  var def = G.BUILDINGS[type];
  var b = { id: m.buildings.length, type: type, def: def, x: r.x, y: r.y, w: r.w, h: r.h, rooms: [], doors: [], alarmOn: true, private: !!def.private, objects: [] };
  m.buildings.push(b);
  var x, y;
  for (y = r.y; y < r.y + r.h; y++) for (x = r.x; x < r.x + r.w; x++) {
    var edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
    m.set(x, y, edge ? T.WALL : T.FLOOR);
    m.bid[m.idx(x, y)] = b.id;
  }
  // Комнаты
  var rooms = [];
  (function split(rr, d) {
    var canV = rr.w >= 10, canH = rr.h >= 9;
    if ((!canV && !canH) || (d > 0 && rng.chance(0.3 + d * 0.2))) { rooms.push(rr); return; }
    var vert = canV && (!canH || rr.w > rr.h || rng.chance(0.5));
    var k, dy, dx;
    if (vert) {
      k = rng.int(rr.x + 4, rr.x + rr.w - 5);
      for (y = rr.y; y < rr.y + rr.h; y++) m.set(k, y, T.WALL);
      dy = rng.int(rr.y + 1, rr.y + rr.h - 2);
      addDoor(m, b, k, dy, false);
      split({ x: rr.x, y: rr.y, w: k - rr.x, h: rr.h }, d + 1);
      split({ x: k + 1, y: rr.y, w: rr.x + rr.w - k - 1, h: rr.h }, d + 1);
    } else {
      k = rng.int(rr.y + 4, rr.y + rr.h - 5);
      for (x = rr.x; x < rr.x + rr.w; x++) m.set(x, k, T.WALL);
      dx = rng.int(rr.x + 1, rr.x + rr.w - 2);
      addDoor(m, b, dx, k, false);
      split({ x: rr.x, y: rr.y, w: rr.w, h: k - rr.y }, d + 1);
      split({ x: rr.x, y: k + 1, w: rr.w, h: rr.y + rr.h - k - 1 }, d + 1);
    }
  })({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 0);
  // Чиним двери, которые перекрыли стены более поздних разрезов
  b.rooms = rooms;

  // Наружные двери
  var sides = rng.shuffle(['n', 's', 'w', 'e']);
  var nDoors = r.w * r.h > 120 ? 2 : 1;
  var lockedOuter = rng.chance(def.lockChance);
  for (var i = 0; i < nDoors; i++) {
    for (var tries = 0; tries < 20; tries++) {
      var s = sides[(i + tries) % 4], px, py, ix, iy;
      if (s === 'n' || s === 's') { px = rng.int(r.x + 2, r.x + r.w - 3); py = s === 'n' ? r.y : r.y + r.h - 1; ix = px; iy = s === 'n' ? py + 1 : py - 1; }
      else { py = rng.int(r.y + 2, r.y + r.h - 3); px = s === 'w' ? r.x : r.x + r.w - 1; iy = py; ix = s === 'w' ? px + 1 : px - 1; }
      var ox = px + (px - ix), oy = py + (py - iy);
      if (m.get(ix, iy) !== T.FLOOR) continue;
      var outside = m.get(ox, oy);
      if (outside !== T.SIDE && outside !== T.STREET && outside !== T.GRASS) continue;
      var d = addDoor(m, b, px, py, true);
      d.locked = lockedOuter && (type !== 'shop' && type !== 'bar');
      d.outX = ox; d.outY = oy;
      b.mainDoor = b.mainDoor || d;
      break;
    }
  }
  // Окна
  for (y = r.y; y < r.y + r.h; y++) for (x = r.x; x < r.x + r.w; x++) {
    var onEdge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
    var corner = (x === r.x || x === r.x + r.w - 1) && (y === r.y || y === r.y + r.h - 1);
    if (!onEdge || corner || m.get(x, y) !== T.WALL) continue;
    if (nearDoor(m, x, y)) continue;
    // окно только там, где внутри пол, а снаружи улица
    var inner = (x === r.x) ? m.get(x + 1, y) : (x === r.x + r.w - 1) ? m.get(x - 1, y) : (y === r.y) ? m.get(x, y + 1) : m.get(x, y - 1);
    if (inner !== T.FLOOR) continue;
    if ((x + y) % 4 === 0 && rng.chance(type === 'tower' || type === 'bank' ? 0.3 : 0.55)) m.set(x, y, T.WINDOW);
  }
  // внутренние двери, которые перекрыла более поздняя стена, — пробиваем проход
  b.doors.forEach(function (dd) {
    if (dd.outer) return;
    var vertWall = m.isWallish(m.get(dd.x, dd.y - 1)) && m.isWallish(m.get(dd.x, dd.y + 1));
    var sidesXY = vertWall ? [[dd.x - 1, dd.y], [dd.x + 1, dd.y]] : [[dd.x, dd.y - 1], [dd.x, dd.y + 1]];
    sidesXY.forEach(function (p) {
      var inside = p[0] > r.x && p[1] > r.y && p[0] < r.x + r.w - 1 && p[1] < r.y + r.h - 1;
      if (inside && m.get(p[0], p[1]) === T.WALL) m.set(p[0], p[1], T.FLOOR);
    });
  });
  furnish(m, rng, b, floor);
  return b;
}

function addDoor(m, b, x, y, outer) {
  m.set(x, y, T.DOOR);
  var d = { x: x, y: y, locked: false, hp: 40, openT: 0, bid: b.id, outer: outer };
  m.doors[m.idx(x, y)] = d;
  b.doors.push(d);
  return d;
}

function lootFor(rng, type, floor) {
  var pool = {
    house: ['burger', 'beer', 'lockpick', 'energy', 'knife', 'bat', 'ammo'],
    rustbase: ['bat', 'pipe', 'pistol', 'ammo', 'molotov', 'beer', 'medkit', 'grenade'],
    neonbase: ['knife', 'knuckle', 'smg', 'ammo', 'smoke', 'energy', 'medkit'],
    warehouse: ['c4', 'grenade', 'ammo', 'crowbar', 'pipe', 'sledge', 'medkit', 'armor'],
    lab: ['shadowvial', 'hackchip', 'medkit', 'energy', 'taser', 'flamer'],
    police: ['ammo', 'armor', 'pistol', 'taser', 'medkit', 'smoke', 'rifle'],
    bank: ['ingotless', 'armor', 'medkit', 'hackchip'],
    tower: ['medkit', 'armor', 'rocket', 'smg', 'shadowvial'],
    shop: ['burger', 'beer'], bar: ['beer', 'beer', 'burger']
  }[type] || ['burger'];
  var id = rng.pick(pool);
  if (!G.ITEMS[id] && !G.WEAPONS[id]) id = 'medkit';
  return id;
}
G.lootFor = lootFor;

function furnish(m, rng, b, floor) {
  var place = function (type, room, extra, filter) {
    var c = m.cellInRect(rng, { x: room.x, y: room.y, w: room.w, h: room.h }, function (x, y) {
      if (nearDoor(m, x, y)) return false;
      return !filter || filter(x, y);
    });
    if (!c) return null;
    var o = m.addObj(type, c.x, c.y, extra);
    b.objects.push(o);
    return o;
  };
  var against = function (x, y) { // у стены
    return m.isWallish(m.get(x - 1, y)) || m.isWallish(m.get(x + 1, y)) || m.isWallish(m.get(x, y - 1)) || m.isWallish(m.get(x, y + 1));
  };
  var rooms = b.rooms.slice().sort(function (a, c) { return c.w * c.h - a.w * a.h; });
  var main = rooms[0], back = rooms[rooms.length - 1];
  var t = b.type, i;
  var fill = function (o, n) { if (!o) return; for (var k = 0; k < n; k++) o.items.push({ id: lootFor(rng, t, floor), n: 1 }); };
  if (t === 'house') {
    rooms.forEach(function (rm) {
      if (rng.chance(0.6)) place('bed', rm, null, against);
      if (rng.chance(0.5)) fill(place('wardrobe', rm, null, against), rng.int(0, 2));
      if (rng.chance(0.3)) place('table', rm);
      if (rng.chance(0.3)) place('plant', rm, null, against);
    });
    if (rng.chance(0.15)) { var sf = place('safe', back, null, against); if (sf) { sf.money = rng.int(30, 90); fill(sf, 1); } }
  } else if (t === 'shop' || t === 'bar') {
    for (i = 0; i < Math.min(3, main.w - 3); i++) {
      var cx = main.x + 1 + i, cy = main.y + 1;
      if (!m.objAt[m.idx(cx, cy)] && m.get(cx, cy) === T.FLOOR) b.objects.push(m.addObj('counter', cx, cy));
    }
    b.counterPos = { x: main.x + 1.5, y: main.y + 0.5 + (main.h > 2 ? 0 : 0) };
    b.servePos = { x: main.x + 2.5, y: main.y + 0.5 };
    if (t === 'bar') for (i = 0; i < 3; i++) place('table', main);
    place('plant', main, null, against);
    place('alarm', main, null, against);
    if (rooms.length > 1) fill(place('crate', back, null, against), 2);
  } else if (t === 'police') {
    place('terminal', main, null, against);
    place('alarm', main, null, against);
    fill(place('crate', main, null, against), 2);
    if (rooms.length > 1) {
      b.cell = back;
      b.doors.forEach(function (dd) { if (!dd.outer && inRoomEdge(dd, back)) dd.locked = true; });
    }
  } else if (t === 'rustbase' || t === 'neonbase') {
    rooms.forEach(function (rm) {
      if (rng.chance(0.6)) place('table', rm);
      if (rng.chance(0.5)) place('barrel', rm, null, against);
      if (rng.chance(0.6)) fill(place('crate', rm, null, against), rng.int(1, 2));
    });
    if (t === 'rustbase') place('still', main, null, against);
    if (rng.chance(0.5)) { sf = place('safe', back, null, against); if (sf) { sf.money = rng.int(40, 120); fill(sf, 1); } }
    if (rooms.length > 1) b.cell = back;
  } else if (t === 'warehouse') {
    rooms.forEach(function (rm) {
      var n = Math.floor(rm.w * rm.h / 10);
      for (var k = 0; k < n; k++) { var cr = place('crate', rm); if (cr && rng.chance(0.4)) fill(cr, 1); }
      if (rng.chance(0.5)) place('barrel', rm, null, against);
    });
    place('generator', back, null, against);
    sf = place('safe', back, null, against); if (sf) { sf.money = rng.int(40, 100); fill(sf, 1); }
  } else if (t === 'lab') {
    place('terminal', main, null, against);
    place('server', back, null, against);
    place('alarm', main, null, against);
    rooms.forEach(function (rm) { if (rng.chance(0.6)) place('table', rm); });
    sf = place('safe', back, null, against); if (sf) { sf.money = rng.int(30, 80); fill(sf, 2); }
    b.turrets = 1 + (floor >= 4 ? 1 : 0);
  } else if (t === 'bank') {
    place('terminal', main, null, against);
    place('alarm', main, null, against);
    for (i = 0; i < 2; i++) { sf = place('safe', back, null, against); if (sf) { sf.money = rng.int(120, 220); } }
    place('plant', main, null, against);
    b.turrets = 2;
  } else if (t === 'tower') {
    place('terminal', main, null, against);
    place('alarm', main, null, against);
    sf = place('safe', back, null, against); if (sf) { sf.money = 250; fill(sf, 2); }
    rooms.forEach(function (rm) { place('plant', rm, null, against); });
    b.turrets = 3;
  }
  // Вентиляция: лаз с улицы внутрь
  if (b.private && rng.chance(0.55) && b.mainDoor) {
    var inside = place('vent', back);
    var outC = null;
    for (var tries = 0; tries < 60 && !outC; tries++) {
      var ox = rng.int(b.x - 1, b.x + b.w), oy = rng.int(b.y - 1, b.y + b.h);
      var tt = m.get(ox, oy);
      if ((tt === T.SIDE || tt === T.GRASS) && !m.objAt[m.idx(ox, oy)] && !nearDoor(m, ox, oy)) outC = { x: ox, y: oy };
    }
    if (inside && outC) {
      var outside = m.addObj('vent', outC.x, outC.y);
      inside.link = outside; outside.link = inside;
    } else if (inside) m.removeObj(inside);
  }
}
function inRoomEdge(d, rm) {
  return d.x >= rm.x - 1 && d.x <= rm.x + rm.w && d.y >= rm.y - 1 && d.y <= rm.y + rm.h;
}
