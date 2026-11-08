'use strict';
// Мир этажа: спавн, бой, снаряды, взрывы, шум, преступления, задания, взаимодействия.

G.Game = function (playerState, floor, seed) {
  G.game = this;
  this.floor = floor;
  this.seed = seed;
  this.rng = G.RNG(seed * 7 + 13);
  this.map = G.generateFloor(floor, seed);
  this.actors = []; this.followers = [];
  this.projectiles = []; this.particles = []; this.texts = []; this.smokes = []; this.fires = []; this.pickups = []; this.bombs = [];
  this.missions = [];
  this.time = 0; this.shake = 0; this.focusT = 0; this.alarmT = 0;
  this.pathBudget = 6;
  this.stats = playerState.stats || { kills: 0, floors: 0, money: 0 };
  this.player = G.makePlayer(playerState, this.map.startX, this.map.startY);
  this.actors.push(this.player);
  this.populate();
  G.makeMissions(this);
  G.Audio.setDistrict(this.map.district, seed);
};
var GP = G.Game.prototype;

GP.slowFactor = function () { return 1; };
GP.toast = function (msg) { if (G.UI) G.UI.toast(msg); };
GP.float = function (x, y, text, color, size) { this.texts.push({ x: x, y: y, text: text, color: color || '#fff', t: 1.1, size: size || 13 }); };

GP.actorsNear = function (x, y, r) {
  var out = [], r2 = r * r;
  for (var i = 0; i < this.actors.length; i++) {
    var a = this.actors[i];
    if (a.alive && G.dist2(x, y, a.x, a.y) <= r2) out.push(a);
  }
  return out;
};
GP.ownersOf = function (b) { return this.actors.filter(function (a) { return a.alive && a.home === b && !a.R.turret; }); };

// ---------- Заселение ----------
GP.spawn = function (role, x, y, opts) {
  var a = new G.Actor(role, x, y, opts);
  var R = a.R;
  a.money = this.rng.int(R.money[0], R.money[1]);
  a.weapon = { id: this.rng.pick(R.weapons), ammo: 999 };
  a.spawn = { x: x, y: y };
  a.npcName = G.NAMES[this.rng.int(0, G.NAMES.length - 1)];
  var hpMul = 1 + (this.floor - 1) * 0.08;
  a.hp = a.maxHp = Math.round(R.hp * hpMul);
  if (R.strength) a.strength = R.strength;
  if (this.player && this.player.traits && this.player.traits.charm && (a.fac === 'civ' || a.fac === 'shop')) a.rel = 1;
  if (this.rng.chance(0.25)) a.items.push({ id: this.rng.pick(['burger', 'beer', 'lockpick', 'energy', 'ammo']), n: 1 });
  this.actors.push(a);
  return a;
};

GP.populate = function () {
  var m = this.map, rng = this.rng, self = this, dist = m.district;
  m.buildings.forEach(function (b) {
    var def = b.def;
    var roles = def.owner.slice();
    if (b.type === 'rustbase' || b.type === 'neonbase') for (var k = 0; k < Math.floor(self.floor / 2); k++) roles.push(b.type === 'rustbase' ? 'rust' : 'neon');
    if (b.type === 'house' && rng.chance(0.4)) roles.push('civ');
    if (b.type === 'bar') { roles.push(rng.pick(dist.civ)); roles.push(rng.pick(dist.civ)); }
    if (b.type === 'tower') roles.push('guard', 'guard');
    if (b.type === 'police' && self.floor >= 3) roles.push('supercop');
    roles.forEach(function (role, i) {
      var c, post = null;
      if ((b.type === 'shop' || b.type === 'bar') && i === 0 && b.servePos) { c = { x: Math.floor(b.servePos.x), y: Math.floor(b.servePos.y) }; }
      else if (role === 'bouncer' && b.mainDoor) {
        var d = b.mainDoor; var ix = d.x - (d.outX - d.x), iy = d.y - (d.outY - d.y);
        c = { x: ix, y: iy };
        // вышибала стоит рядом с входом, не в проходе
        var alt = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var q = 0; q < 4; q++) { var ax = ix + alt[q][0], ay = iy + alt[q][1]; if (m.passable(ax, ay) && m.bid[m.idx(ax, ay)] === b.id && !(ax === d.x && ay === d.y)) { c = { x: ax, y: ay }; break; } }
      } else {
        var room = rng.pick(b.rooms);
        c = m.cellInRect(rng, room);
      }
      if (!c) return;
      var guardy = role === 'guard' || role === 'bouncer' || role === 'cop' || role === 'supercop' || (b.type === 'shop' || b.type === 'bar') && i === 0;
      var a = self.spawn(role, c.x + 0.5, c.y + 0.5, { home: b });
      if (guardy) { post = { x: c.x + 0.5, y: c.y + 0.5 }; a.post = post; }
      else a.wanderer = rng.chance(0.6);
      if (b.type === 'shop' || b.type === 'bar') { if (i === 0) { a.shopkeeper = b.type; a.post.face = Math.PI / 2; } }
    });
    // турели
    for (var t = 0; t < (b.turrets || 0); t++) {
      var rm = b.rooms[(t + 1) % b.rooms.length];
      var c2 = m.cellInRect(rng, rm, function (x, y) { return m.isWallish(m.get(x - 1, y)) || m.isWallish(m.get(x + 1, y)) || m.isWallish(m.get(x, y - 1)) || m.isWallish(m.get(x, y + 1)); });
      if (!c2) continue;
      var tu = self.spawn('turret', c2.x + 0.5, c2.y + 0.5, { home: b });
      tu.post = { x: tu.x, y: tu.y }; tu.speed = 0;
      tu.weapon = { id: self.floor >= 4 ? 'smg' : 'pistol', ammo: 999 };
      m.solid[m.idx(c2.x, c2.y)] = 1;
    }
  });
  // улица: прохожие, бродяги, патрули, банды на своей территории
  var streetCell = function () {
    return m.randomCell(rng, function (x, y) {
      var t = m.get(x, y);
      return (t === G.T.SIDE || t === G.T.STREET || t === G.T.GRASS) && G.dist(x, y, m.startX, m.startY) > 8;
    });
  };
  var n = 10 + this.floor * 2, c, i;
  for (i = 0; i < n; i++) { c = streetCell(); if (c) { var a = this.spawn(rng.pick(dist.civ), c.x, c.y); a.wanderer = true; a.patrol = true; } }
  for (i = 0; i < dist.cops + Math.floor(this.floor / 2); i++) {
    c = streetCell(); if (!c) continue;
    var cop = this.spawn(this.floor >= 5 && rng.chance(0.4) ? 'supercop' : 'cop', c.x, c.y); cop.patrol = true; cop.wanderer = true;
  }
  if (dist.gangs) {
    m.buildings.forEach(function (b) {
      if (b.type !== 'rustbase' && b.type !== 'neonbase') return;
      for (var k = 0; k < 2 + Math.floor(self.floor / 2); k++) {
        var cc = m.randomCell(rng, function (x, y) { var t = m.get(x, y); return (t === G.T.SIDE || t === G.T.STREET) && G.dist(x, y, b.x + b.w / 2, b.y + b.h / 2) < 12 && G.dist(x, y, m.startX, m.startY) > 8; });
        if (cc) { var g = self.spawn(b.type === 'rustbase' ? 'rust' : 'neon', cc.x, cc.y); g.gang = b; g.post = { x: cc.x, y: cc.y }; }
      }
    });
  }
};

// ---------- Шум, тревога ----------
GP.noise = function (x, y, r, src, loud) {
  if (r <= 0) return;
  if (src && src.isPlayer) r *= (src.cls.id === 'thief' ? 0.8 : 1);
  var list = this.actorsNear(x, y, r);
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a === src || a.isPlayer) continue;
    // за стенами слышно хуже
    if (!this.map.los(a.x, a.y, x, y) && G.dist(a.x, a.y, x, y) > r * 0.6) continue;
    a.hear({ x: x, y: y, src: src, loud: loud }, this);
  }
};
GP.alertNearby = function (src, threat) {
  var list = this.actorsNear(src.x, src.y, 8);
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a === src || a.isPlayer || a.R.turret) continue;
    if (a.fac === src.fac && a.rel < 1 && (a.canSee(src, this) || a.canSee(threat, this))) {
      if (threat.isPlayer) { if (a.rel > -2) a.makeHostile(threat, this); }
      else a.makeHostile(threat, this);
    }
  }
};
GP.tryAlarm = function (a, threat) {
  var b = a.home;
  if (!b || !b.alarmOn || b.alarmT > 0) return;
  var alarm = b.objects.filter(function (o) { return o.type === 'alarm' && !o.dead; })[0];
  if (!alarm) return;
  b.alarmT = 12;
  G.Audio.sfx('alarm');
  this.toast('🚨 ' + b.def.name + ': тревога!');
  this.float(alarm.x + 0.5, alarm.y, 'ТРЕВОГА', '#f44', 16);
  var self = this;
  this.actors.forEach(function (o) {
    if (!o.alive || o.isPlayer) return;
    if (o.home === b && o.rel < 1) { if (threat.isPlayer) o.makeHostile(threat, self, true); else o.makeHostile(threat, self); }
    if (o.fac === 'cop' && threat.isPlayer && G.dist(o.x, o.y, b.x, b.y) < 30 && o.state !== 'combat') { o.investigate = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; o.setState('investigate'); }
  });
};

// ---------- Атака ----------
GP.fire = function (a, ang) {
  var w = a.wdef(), id = a.weapon.id;
  if (a.isPlayer) {
    if (w.kind === 'gun' && a.weapon.ammo <= 0) { if (!a.noAmmoT) { this.toast('Нет патронов'); G.Audio.sfx('error'); a.noAmmoT = 1; } a.cd = 0.3; return; }
    a.hidden = false;
    if (a.invis > 0 && w.kind !== 'melee') a.invis = 0;
  }
  a.cd = w.cd * (a.drunk > 0 ? 1.2 : 1) * (a.isPlayer ? 1 : (w.kind === 'gun' ? 2.0 : 1.3));
  a.face = ang;
  var self = this;
  if (w.kind === 'melee') {
    a.swingT = 0.18;
    G.Audio.sfx('swing', a.isPlayer ? 1 : 0.6);
    var hit = false;
    var list = this.actorsNear(a.x, a.y, w.range + 0.6);
    list.forEach(function (t) {
      if (t === a || (a.isPlayer && t.rel >= 2) || (!a.isPlayer && a.isAlly(t))) return;
      var d = G.dist(a.x, a.y, t.x, t.y);
      if (d > w.range + t.r) return;
      var an = Math.atan2(t.y - a.y, t.x - a.x);
      if (Math.abs(G.angDiff(ang, an)) > w.arc / 2 && d > 0.5) return;
      var dmg = w.dmg * (a.strength || 1);
      if (a.isPlayer) { dmg *= a.cls.melee * (a.traits.heavy ? 1.3 : 1); }
      // удар в спину / из невидимости
      var unaware = t.state !== 'combat' && !(t.target === a);
      var behind = Math.abs(G.angDiff(t.face, an)) < 1.2;
      if (unaware && (behind || (a.invis > 0))) {
        var mul = w.sneak || 2; if (a.isPlayer && a.cls.id === 'thief') mul += 1;
        dmg *= mul;
        if (a.isPlayer) self.float(t.x, t.y - 0.6, 'КРИТ!', '#ff4', 14);
      }
      self.damage(t, dmg, a, { kx: Math.cos(an) * (w.knock || 2), ky: Math.sin(an) * (w.knock || 2) });
      hit = true;
    });
    // объекты и двери перед собой
    var fx = a.x + Math.cos(ang) * 0.8, fy = a.y + Math.sin(ang) * 0.8;
    var tx = Math.floor(fx), ty = Math.floor(fy), m = this.map;
    var o = m.objAt[m.idx(tx, ty)];
    if (o && G.OBJDEF[o.type].hp) { this.hitObject(o, w.dmg * (a.strength || 1) * (a.isPlayer ? a.cls.melee : 1), a); hit = true; }
    var door = m.doors[m.idx(tx, ty)];
    if (door && !door.broken && a.isPlayer) { this.hitDoor(door, w.dmg * (w.door || 1) * (a.cls.id === 'brute' ? 2 : 1), a); hit = true; }
    if (m.get(tx, ty) === G.T.WINDOW && a.isPlayer) { this.breakWindow(tx, ty, a); hit = true; }
    if (hit) { G.Audio.sfx('hit'); }
    this.noise(a.x, a.y, w.noise, a, false);
    if (a.isPlayer && hit && a.weapon.dur !== undefined) {
      a.weapon.dur--;
      if (a.weapon.dur <= 0) { this.toast(w.name + ' сломалась'); a.removeItem(a.weapon); a.equipBest(); }
    }
    return;
  }
  if (w.kind === 'throw') {
    if (a.isPlayer) { a.weapon.n--; if (a.weapon.n <= 0) { a.removeItem(a.weapon); a.equipBest(); } }
    var dist = a.isPlayer ? (a.throwPower || 0.8) * w.range : Math.min(w.range, G.dist(a.x, a.y, a.target.x, a.target.y));
    this.throwObj(a, id, ang, dist);
    return;
  }
  // огнестрел
  if (a.isPlayer) a.weapon.ammo--;
  var spread = w.spread;
  if (a.isPlayer) spread *= (1 / a.cls.acc) * (a.traits.aim ? 0.65 : 1) * (a.drunk > 0 ? 1.8 : 1);
  else spread *= 1.6;
  var pellets = w.pellets || 1;
  for (var i = 0; i < pellets; i++) {
    var aa = ang + (Math.random() - 0.5) * 2 * spread;
    var sp = w.speed * (0.9 + Math.random() * 0.2);
    this.projectiles.push({
      x: a.x + Math.cos(ang) * 0.4, y: a.y + Math.sin(ang) * 0.4,
      vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp,
      dmg: w.dmg, owner: a, life: w.life || (w.range / w.speed + 0.1), color: w.color, w: w, wid: id
    });
  }
  var snd = { pistol: 'pistol', smg: 'smg', sawn: 'shotgun', rifle: 'rifle', taser: 'taser', flamer: 'flame', rocket: 'rocket' }[id] || 'pistol';
  G.Audio.sfx(snd, a.isPlayer ? 1 : 0.55);
  if (w.kind === 'gun' && id !== 'flamer' && id !== 'taser') this.particles.push({ x: a.x + Math.cos(ang) * 0.55, y: a.y + Math.sin(ang) * 0.55, t: 0.06, max: 0.06, color: '#ffe9a0', size: 6, flash: 1 });
  this.noise(a.x, a.y, w.noise, a, w.noise > 8);
  if (a.isPlayer) this.shake = Math.max(this.shake, id === 'sawn' || id === 'rifle' || id === 'rocket' ? 0.25 : 0.08);
};

GP.throwObj = function (a, id, ang, dist) {
  this.bombs.push({ x: a.x, y: a.y, sx: a.x, sy: a.y, tx: a.x + Math.cos(ang) * dist, ty: a.y + Math.sin(ang) * dist, t: 0, dur: 0.35 + dist * 0.06, id: id, owner: a, landed: false, fuse: G.WEAPONS[id].fuse || 0 });
  G.Audio.sfx('swing');
};
GP.placeC4 = function (a) {
  this.bombs.push({ x: a.x, y: a.y, sx: a.x, sy: a.y, tx: a.x, ty: a.y, t: 1, dur: 1, id: 'c4', owner: a, landed: true, fuse: 3, c4: true });
  this.toast('Взрывчатка заложена — отойдите!');
};

GP.hitDoor = function (d, dmg, a) {
  d.hp -= dmg;
  G.Audio.sfx('door');
  this.noise(d.x + 0.5, d.y + 0.5, 6, a, false);
  if (d.hp <= 0) {
    d.broken = true; d.locked = false;
    G.Audio.sfx('doorbreak');
    this.noise(d.x + 0.5, d.y + 0.5, 9, a, true);
    this.burst(d.x + 0.5, d.y + 0.5, '#7a5230', 8);
    this.crime(a, this.map.buildings[d.bid], 'break');
  }
};
GP.breakWindow = function (x, y, a) {
  var m = this.map;
  if (m.get(x, y) !== G.T.WINDOW) return;
  m.set(x, y, G.T.WINBROKEN);
  G.Audio.sfx('glass');
  this.burst(x + 0.5, y + 0.5, '#bfe6ff', 10);
  this.noise(x + 0.5, y + 0.5, 8, a, true);
  if (a && a.isPlayer) this.crime(a, m.buildings[m.bid[m.idx(x, y)]], 'break');
};

// Преступление на виду: хозяева и полиция, которые это видят, становятся враждебными
GP.crime = function (p, b, kind) {
  if (!p || !p.isPlayer) return;
  var self = this;
  this.actors.forEach(function (o) {
    if (!o.alive || o.isPlayer || o.rel >= 1 || o.R.turret) return;
    var owner = b && o.home === b;
    var cop = o.fac === 'cop';
    if (!owner && !cop) return;
    if (G.dist(o.x, o.y, p.x, p.y) > 10) return;
    if (!o.canSee(p, self)) return;
    if (kind === 'steal') o.sayFrom('stolen');
    o.makeHostile(p, self);
  });
};

GP.hitObject = function (o, dmg, a) {
  if (o.dead) return;
  o.hp -= dmg;
  o.flash = 0.1;
  this.burst(o.x + 0.5, o.y + 0.5, '#999', 3);
  if (o.hp > 0) return;
  var m = this.map, b = m.buildings[o.bid] || null, self = this;
  if (o.type === 'barrel') { m.removeObj(o); this.explode(o.x + 0.5, o.y + 0.5, 2.0, a, 40); return; }
  m.removeObj(o);
  this.burst(o.x + 0.5, o.y + 0.5, '#888', 12);
  G.Audio.sfx('doorbreak', 0.6);
  o.items.forEach(function (it) { self.dropItem(o.x + 0.5, o.y + 0.5, it.id, it.n, b); });
  if (o.money) this.dropMoney(o.x + 0.5, o.y + 0.5, o.money, b);
  if (o.type === 'vending') { this.dropItem(o.x + 0.5, o.y + 0.5, 'burger', 2, b); this.dropItem(o.x + 0.5, o.y + 0.5, 'energy', 1, b); }
  if (o.type === 'atm') this.dropMoney(o.x + 0.5, o.y + 0.5, this.rng.int(40, 90), b);
  if (o.type === 'generator' || o.type === 'server' || o.type === 'still') { this.explode(o.x + 0.5, o.y + 0.5, 1.4, a, 15); }
  if (o.type === 'terminal' && b) { b.alarmOn = false; }
  if (o.type === 'alarm' && b) { b.alarmOn = false; }
  this.noise(o.x + 0.5, o.y + 0.5, 8, a, true);
  if (a && a.isPlayer) this.crime(a, b, 'break');
  G.checkMissions(this);
};

GP.burst = function (x, y, color, n, speed) {
  for (var i = 0; i < n; i++) {
    var an = Math.random() * Math.PI * 2, s = (speed || 3) * (0.3 + Math.random());
    this.particles.push({ x: x, y: y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, t: 0.4 + Math.random() * 0.4, max: 0.8, color: color, size: 2 + Math.random() * 3 });
  }
};

GP.explode = function (x, y, r, a, dmg) {
  dmg = dmg || 60;
  G.Audio.sfx('explode');
  this.shake = Math.max(this.shake, 0.6);
  this.particles.push({ x: x, y: y, t: 0.35, max: 0.35, ring: r, color: '#ffb347' });
  for (var i = 0; i < 26; i++) {
    var an = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
    this.particles.push({ x: x, y: y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, t: 0.3 + Math.random() * 0.5, max: 0.8, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd36a', size: 3 + Math.random() * 5 });
  }
  this.map.decals.push({ x: x, y: y, r: r * 0.6, type: 'scorch' });
  var self = this, m = this.map;
  this.actorsNear(x, y, r + 0.4).forEach(function (t) {
    var d = G.dist(x, y, t.x, t.y);
    var k = 1 - d / (r + 0.4);
    var dd = dmg * (0.4 + 0.6 * k);
    if (t.isPlayer && (t.traits.blast || t.cls.id === 'bomber')) dd *= 0.5;
    var an = Math.atan2(t.y - y, t.x - x);
    self.damage(t, dd, a, { kx: Math.cos(an) * 9, ky: Math.sin(an) * 9, explosion: true });
  });
  // стены, двери, окна, объекты
  var R = Math.ceil(r);
  for (var ty = Math.floor(y) - R; ty <= Math.floor(y) + R; ty++) for (var tx = Math.floor(x) - R; tx <= Math.floor(x) + R; tx++) {
    if (!m.inb(tx, ty)) continue;
    var d2 = G.dist(x, y, tx + 0.5, ty + 0.5);
    if (d2 > r) continue;
    var v = m.get(tx, ty);
    if (v === G.T.WINDOW) this.breakWindow(tx, ty, a);
    var door = m.doors[m.idx(tx, ty)];
    if (door) { door.broken = true; door.locked = false; }
    if (v === G.T.WALL && d2 < r * 0.75) { m.set(tx, ty, G.T.RUBBLE); this.burst(tx + 0.5, ty + 0.5, '#777', 4); }
    var o = m.objAt[m.idx(tx, ty)];
    if (o && o.type === 'safe' && !o.opened) { o.opened = true; o.items.forEach(function (it) { self.dropItem(o.x + 0.5, o.y + 1, it.id, it.n, m.buildings[o.bid]); }); o.items = []; if (o.money) { this.dropMoney(o.x + 0.5, o.y + 1, o.money, m.buildings[o.bid]); o.money = 0; } }
    else if (o && G.OBJDEF[o.type].hp) this.hitObject(o, dmg, a);
  }
  this.noise(x, y, 18, a, true);
  if (a && a.isPlayer) this.crime(a, m.bAt(x, y), 'break');
};

GP.damage = function (t, dmg, a, o) {
  if (!t.alive) return;
  o = o || {};
  if (t.isPlayer && t.godT > 0) return;
  if (t.R.turret && t.disabled) return;
  if (t.armor > 0) { var ab = Math.min(t.armor, dmg * 0.6); t.armor -= ab; dmg -= ab; }
  dmg = Math.max(1, Math.round(dmg));
  t.hp -= dmg;
  t.flash = 0.12;
  if (o.kx && !t.R.turret) { t.kx = (t.kx || 0) + o.kx; t.ky = (t.ky || 0) + o.ky; }
  this.float(t.x, t.y - 0.5, '-' + dmg, t.isPlayer ? '#ff5a5a' : '#fff', 12);
  this.burst(t.x, t.y, t.R.turret ? '#ccc' : '#a01818', 4, 2);
  if (o.stun) { t.stun = Math.max(t.stun, o.stun); G.Audio.sfx('stun'); }
  if (o.burn) t.burn = Math.max(t.burn, 3);
  if (t.isPlayer) { G.Audio.sfx('hurt'); this.shake = Math.max(this.shake, 0.2); if (a && a !== t) t.lastAttacker = a; t.combatT = 4; }
  if (a && a !== t) this.relations(t, a);
  if (t.hp <= 0) this.kill(t, a);
};

GP.relations = function (t, a) {
  var p = this.player, self = this;
  if (t.isPlayer) return;
  if (a.isPlayer) {
    p.lastVictim = t; p.combatT = 4;
    if (t.rel >= 2) return; // свои
    var wasHostile = t.rel <= -2;
    t.makeHostile(a, this);
    if (!wasHostile) {
      // свидетели
      this.actors.forEach(function (o) {
        if (!o.alive || o.isPlayer || o === t || o.rel >= 1 || o.R.turret) return;
        if (G.dist(o.x, o.y, t.x, t.y) > 10) return;
        if (!(o.canSee(a, self) || o.canSee(t, self))) return;
        if (o.fac === t.fac || o.fac === 'cop' || (t.home && o.home === t.home)) { if (o.rel > -2) o.makeHostile(a, self); }
        else if (o.coward() && o.state !== 'flee') { o.fleeFrom = a; o.setState('flee'); o.sayFrom('flee'); }
      });
    }
    return;
  }
  // NPC против NPC (или отряд)
  if (t.isAlly(a) && t.rel < 2) return;
  if (!t.isEnemy(a)) { var wasEnemy = false; t.makeHostile(a, this); void wasEnemy; }
  else if (t.state !== 'combat' && !t.coward()) { t.target = a; t.setState('combat'); }
  // полиция вмешивается в драки, если жертва не нападала первой
  if (a.fac !== 'cop' && !a.grudge[t.id] && a.rel < 2) {
    this.actorsNear(t.x, t.y, 9).forEach(function (o) {
      if (o.fac === 'cop' && o !== a && o.alive && o.canSee(a, self)) o.grudge[a.id] = true;
    });
  }
};

GP.kill = function (t, a) {
  t.alive = false; t.hp = 0; t.state = 'dead'; t.deadT = 0;
  if (t.isPlayer) { G.Audio.sfx('die'); this.over = 'dead'; return; }
  G.Audio.sfx('die', 0.7);
  this.burst(t.x, t.y, '#8a1010', 14, 3);
  this.map.decals.push({ x: t.x, y: t.y, r: 0.45, type: 'blood' });
  var fi = this.followers.indexOf(t); if (fi >= 0) this.followers.splice(fi, 1);
  if (t.R.turret) { this.map.solid[this.map.idx(Math.floor(t.x), Math.floor(t.y))] = 0; this.explode(t.x, t.y, 1.0, a, 10); }
  var p = this.player;
  var byPlayer = a && (a.isPlayer || a.rel >= 2);
  var money = t.money;
  if (byPlayer && p.traits.scavenger) money *= 2;
  if (money > 0) this.dropMoney(t.x, t.y, money, null);
  var self = this;
  t.items.forEach(function (it) { self.dropItem(t.x + 0.2, t.y, it.id, it.n, null); });
  if (!t.R.turret && t.weapon.id !== 'fist' && this.rng.chance(0.4)) {
    var w = G.WEAPONS[t.weapon.id];
    this.dropItem(t.x - 0.2, t.y + 0.1, t.weapon.id, 1, null, w.kind === 'gun' ? Math.ceil(w.ammo / 2) : undefined);
  }
  if (byPlayer) {
    this.stats.kills++;
    p.gainXP(t.R.boss ? 300 : t.R.turret ? 15 : 12 + Math.round(t.maxHp / 6), this);
    if (p.traits.vampire) p.hp = Math.min(p.maxHp, p.hp + 6);
    // враги моих врагов
    var rival = t.fac === 'rust' ? 'neon' : t.fac === 'neon' ? 'rust' : null;
    if (rival) this.actors.forEach(function (o) { if (o.alive && o.fac === rival && o.rel < 1 && o.rel > -2) o.rel = Math.min(1, o.rel + 1); });
  }
  G.checkMissions(this);
};

GP.dropMoney = function (x, y, n, b) {
  this.pickups.push({ x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, money: Math.round(n), b: b, bob: Math.random() * 6 });
};
GP.dropItem = function (x, y, id, n, b, ammo) {
  var pk = { x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, id: id, n: n || 1, b: b, bob: Math.random() * 6 };
  var w = G.WEAPONS[id];
  if (w && w.kind === 'gun') pk.ammo = ammo !== undefined ? ammo : w.ammo;
  if (w && w.dur) pk.dur = w.dur;
  this.pickups.push(pk);
};

// ---------- Обновление ----------
GP.update = function (dt) {
  if (this.over) return;
  this.time += dt;
  this.pathBudget = 8;
  var p = this.player, m = this.map, self = this;
  if (this.focusT > 0) this.focusT -= dt;
  var slow = this.focusT > 0 ? 0.35 : 1;

  p.updatePlayer(dt, this);

  for (var i = 0; i < this.actors.length; i++) {
    var a = this.actors[i];
    if (!a.alive) { a.deadT += dt; continue; }
    var adt = (a.isPlayer || a.rel >= 2) ? dt : dt * slow;
    if (a.barkT > 0) { a.barkT -= dt; if (a.barkT <= 0) a.bark = null; }
    if (a.flash > 0) a.flash -= dt;
    if (a.swingT > 0) a.swingT -= adt;
    if (a.burn > 0) { a.burn -= adt; a.burnTick = (a.burnTick || 0) - adt; if (a.burnTick <= 0) { a.burnTick = 0.5; this.damage(a, a.isPlayer && (p.traits.blast || p.cls.id === 'bomber') ? 2 : 4, null); if (Math.random() < 0.5) this.burst(a.x, a.y, '#ff8a2a', 2); } }
    if (a.kx || a.ky) {
      a.tryMove(a.kx * adt, a.ky * adt, this);
      a.kx *= Math.pow(0.002, adt); a.ky *= Math.pow(0.002, adt);
      if (Math.abs(a.kx) < 0.05 && Math.abs(a.ky) < 0.05) a.kx = a.ky = 0;
    }
    if (a.isPlayer) continue;
    if (a.cd > 0) a.cd -= adt;
    if (a.stun > 0) { a.stun -= adt; continue; }
    a.think(this, adt);
    // двери открываются, когда рядом кто-то есть
    var di = m.idx(Math.floor(a.x + Math.cos(a.face) * 0.5), Math.floor(a.y + Math.sin(a.face) * 0.5));
    var dd = m.doors[di]; if (dd && m.passable(dd.x, dd.y, a)) { if (dd.openT <= 0) G.Audio.sfx('door', 0.3); dd.openT = 0.6; }
  }
  // мягкое расталкивание
  for (i = 0; i < this.actors.length; i++) {
    var A = this.actors[i]; if (!A.alive || A.R.turret) continue;
    for (var j = i + 1; j < this.actors.length; j++) {
      var B = this.actors[j]; if (!B.alive || B.R.turret) continue;
      var dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      if (d < rr) {
        var push = (rr - d) * 0.5, ux = dx / d * push, uy = dy / d * push;
        if (!A.isPlayer || true) A.tryMove(-ux, -uy, this);
        B.tryMove(ux, uy, this);
      }
    }
  }
  for (var k in m.doors) { var door = m.doors[k]; if (door.openT > 0) door.openT -= dt; }
  // двери около игрока
  var pdi = m.idx(Math.floor(p.x + Math.cos(p.moveAng || 0) * 0.55), Math.floor(p.y + Math.sin(p.moveAng || 0) * 0.55));
  var pd = m.doors[pdi]; if (pd && m.passable(pd.x, pd.y, p) && p.moving) { if (pd.openT <= 0) G.Audio.sfx('door', 0.5); pd.openT = 0.6; }
  m.buildings.forEach(function (b) { if (b.alarmT > 0) b.alarmT -= dt; });

  this.updateProjectiles(dt, slow);
  this.updateBombs(dt);
  // огонь
  for (i = this.fires.length - 1; i >= 0; i--) {
    var f = this.fires[i]; f.t -= dt;
    if (Math.random() < dt * 20) this.particles.push({ x: f.x + (Math.random() - 0.5) * f.r * 1.6, y: f.y + (Math.random() - 0.5) * f.r * 1.6, vx: 0, vy: -1.5, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffcc4a', size: 4 });
    this.actorsNear(f.x, f.y, f.r).forEach(function (t) { t.burn = Math.max(t.burn, 2); if (f.owner && f.owner !== t && !t.isPlayer && t.rel < 2 && !t.grudge[f.owner.id] && f.owner.isPlayer) self.relations(t, f.owner); });
    if (f.t <= 0) this.fires.splice(i, 1);
  }
  for (i = this.smokes.length - 1; i >= 0; i--) { this.smokes[i].t -= dt; if (this.smokes[i].t <= 0) this.smokes.splice(i, 1); }
  for (i = this.particles.length - 1; i >= 0; i--) {
    var q = this.particles[i]; q.t -= dt;
    if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; }
    if (q.t <= 0) this.particles.splice(i, 1);
  }
  for (i = this.texts.length - 1; i >= 0; i--) { this.texts[i].t -= dt; this.texts[i].y -= dt * 0.8; if (this.texts[i].t <= 0) this.texts.splice(i, 1); }
  if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
  // подбор
  for (i = this.pickups.length - 1; i >= 0; i--) {
    var pk = this.pickups[i];
    if (G.dist(p.x, p.y, pk.x, pk.y) < 0.6 && p.alive && !p.hidden) {
      if (pk.money) { p.money += pk.money; this.float(p.x, p.y - 0.6, '+' + pk.money + '₽', '#ffd84a'); G.Audio.sfx('coin'); }
      else { if (!p.addItem(pk.id, pk.n, pk.ammo, pk.dur)) continue; this.float(p.x, p.y - 0.6, (G.ITEMS[pk.id] || G.WEAPONS[pk.id]).name, '#9f9'); G.Audio.sfx('pickup'); }
      if (pk.b) this.crime(p, pk.b, 'steal');
      this.pickups.splice(i, 1);
      G.checkMissions(this);
    }
  }
  // интенсивность музыки
  var danger = 0;
  for (i = 0; i < this.actors.length; i++) { var e = this.actors[i]; if (e.alive && e.state === 'combat' && e.target === p && G.dist(e.x, e.y, p.x, p.y) < 14) danger++; }
  this.danger = danger;
  G.Audio.setIntensity(Math.min(1, danger * 0.35));
  // отряд у лифта для спасения
  G.checkMissions(this);
};

GP.updateProjectiles = function (dt, slow) {
  var m = this.map, self = this;
  for (var i = this.projectiles.length - 1; i >= 0; i--) {
    var b = this.projectiles[i];
    var pdt = (b.owner && (b.owner.isPlayer || b.owner.rel >= 2)) ? dt : dt * slow;
    b.life -= pdt;
    var steps = 3, dead = false;
    for (var s = 0; s < steps && !dead; s++) {
      b.x += b.vx * pdt / steps; b.y += b.vy * pdt / steps;
      var tx = Math.floor(b.x), ty = Math.floor(b.y), v = m.get(tx, ty);
      if (v === G.T.WINDOW && b.wid !== 'flamer') { this.breakWindow(tx, ty, b.owner); b.vx *= 0.8; b.vy *= 0.8; }
      if (m.blocksSight(tx, ty)) {
        var door = m.doors[m.idx(tx, ty)];
        if (door && b.owner && b.owner.isPlayer) this.hitDoor(door, b.dmg * 0.5, b.owner);
        dead = true; break;
      }
      var o = m.objAt[m.idx(tx, ty)];
      if (o && G.OBJDEF[o.type].solid && !G.OBJDEF[o.type].low) {
        if (G.OBJDEF[o.type].hp) this.hitObject(o, b.dmg, b.owner);
        dead = true; break;
      }
      var list = this.actorsNear(b.x, b.y, 0.6);
      for (var j = 0; j < list.length; j++) {
        var t = list[j];
        if (t === b.owner || t.hidden) continue;
        if (b.owner && !b.owner.isPlayer && b.owner.isAlly(t)) continue;
        if (b.owner && b.owner.isPlayer && t.rel >= 2) continue;
        if (b.owner && b.owner.rel >= 2 && (t.isPlayer || t.rel >= 2)) continue;
        if (G.dist2(b.x, b.y, t.x, t.y) < t.r * t.r * 1.3) {
          var w = b.w;
          if (w.explode) { this.explode(b.x, b.y, w.explode, b.owner, 55); dead = true; break; }
          var dmg = b.dmg;
          if (b.owner && b.owner.isPlayer && b.owner.focus) dmg *= 1;
          this.damage(t, dmg, b.owner, { kx: b.vx / 22 * (w.knock || 1.5), ky: b.vy / 22 * (w.knock || 1.5), stun: w.stun, burn: w.fire });
          if (!w.fire) { dead = true; break; }
        }
      }
    }
    if (dead && b.w.explode) this.explode(b.x - b.vx * 0.01, b.y - b.vy * 0.01, b.w.explode, b.owner, 55);
    if (b.w.fire && Math.random() < 0.15) this.particles.push({ x: b.x, y: b.y, vx: 0, vy: -1, t: 0.3, max: 0.3, color: '#ff9a3a', size: 5 });
    if (b.w.explode && Math.random() < 0.6) this.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0.4, max: 0.4, color: '#aaa', size: 4 });
    if (dead || b.life <= 0) {
      if (!dead && b.w.explode) this.explode(b.x, b.y, b.w.explode, b.owner, 55);
      if (b.w.fire && Math.random() < 0.1) this.fires.push({ x: b.x, y: b.y, r: 0.5, t: 1.5, owner: b.owner });
      this.projectiles.splice(i, 1);
    }
  }
  void self;
};

GP.updateBombs = function (dt) {
  var m = this.map;
  for (var i = this.bombs.length - 1; i >= 0; i--) {
    var b = this.bombs[i];
    if (!b.landed) {
      b.t += dt;
      var k = Math.min(1, b.t / b.dur);
      var nx = G.lerp(b.sx, b.tx, k), ny = G.lerp(b.sy, b.ty, k);
      if (m.blocksSight(Math.floor(nx), Math.floor(ny)) || m.get(Math.floor(nx), Math.floor(ny)) === G.T.WINDOW) { b.landed = true; }
      else { b.x = nx; b.y = ny; }
      b.h = Math.sin(k * Math.PI) * 0.8;
      if (k >= 1) b.landed = true;
      if (b.landed) {
        b.h = 0;
        var w = G.WEAPONS[b.id];
        if (b.id === 'molotov') { this.fires.push({ x: b.x, y: b.y, r: w.firebomb, t: 5, owner: b.owner }); G.Audio.sfx('glass'); this.noise(b.x, b.y, 6, b.owner, true); this.bombs.splice(i, 1); continue; }
        if (b.id === 'smoke') { this.smokes.push({ x: b.x, y: b.y, r: w.smoke, t: 9 }); G.Audio.sfx('flame'); this.bombs.splice(i, 1); continue; }
      }
      continue;
    }
    b.fuse -= dt;
    if (b.fuse <= 0) {
      var R = b.c4 ? 2.6 : G.WEAPONS[b.id].explode;
      this.explode(b.x, b.y, R, b.owner, b.c4 ? 90 : 60);
      this.bombs.splice(i, 1);
    }
  }
};

// ---------- Взаимодействия ----------
GP.findInteract = function () {
  var p = this.player, m = this.map, best = null, bd = 1e9;
  var fx = p.x + Math.cos(p.face) * 0.3, fy = p.y + Math.sin(p.face) * 0.3;
  var consider = function (obj, x, y, range) {
    var d = G.dist(fx, fy, x, y);
    if (d < range && d < bd) { bd = d; best = obj; }
  };
  this.actors.forEach(function (a) {
    if (a.isPlayer || !a.alive) return;
    if (a.rel <= -2 && a.state === 'combat') return;
    consider({ kind: 'actor', a: a }, a.x, a.y, a.shopkeeper ? 2.8 : 1.5);
  });
  var x0 = Math.floor(p.x) - 2, y0 = Math.floor(p.y) - 2;
  for (var y = y0; y <= y0 + 4; y++) for (var x = x0; x <= x0 + 4; x++) {
    if (!m.inb(x, y)) continue;
    var i = m.idx(x, y), o = m.objAt[i];
    if (o && G.Interact.objectHasOptions(o, this)) consider({ kind: 'obj', o: o }, x + 0.5, y + 0.5, o.type === 'elevator' ? 2.2 : 1.4);
    var d = m.doors[i];
    if (d && d.locked && !d.broken) consider({ kind: 'door', d: d }, x + 0.5, y + 0.5, 1.4);
    if (m.t[i] === G.T.WINDOW) consider({ kind: 'window', x: x, y: y }, x + 0.5, y + 0.5, 1.3);
  }
  return best;
};

// ---------- Переход между этажами ----------
GP.canLeave = function () {
  return this.missions.every(function (mi) { return mi.done || mi.failed; });
};
