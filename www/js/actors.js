'use strict';
// Существа: игрок и NPC. ИИ — конечный автомат с восприятием (зрение/слух), A* и тактикой боя.

var actorId = 1;
G.Actor = function (role, x, y, opts) {
  var R = G.ROLES[role] || G.ROLES.civ;
  this.id = actorId++;
  this.role = role; this.R = R;
  this.x = x; this.y = y; this.vx = 0; this.vy = 0;
  this.r = R.turret ? 0.42 : 0.3;
  this.face = Math.random() * Math.PI * 2;
  this.hp = this.maxHp = R.hp; this.armor = R.armor || 0;
  this.fac = R.fac; this.name = R.name;
  this.speed = 3.2 * R.speed;
  this.color = R.color; this.hat = R.hat;
  this.weapon = { id: R.weapons[0], ammo: 999 };
  this.cd = 0; this.stun = 0; this.flash = 0; this.burn = 0;
  this.rel = 0;            // отношение к игроку: -2 враг, -1 раздражён, 0 нейтрален, 1 друг, 2 в отряде
  this.grudge = {};        // id -> true: личные враги
  this.state = 'idle'; this.stateT = 0;
  this.path = null; this.pathT = 0;
  this.target = null; this.lastSeen = null;
  this.percT = Math.random() * 0.3;
  this.home = null; this.post = null;
  this.money = 0; this.items = [];
  this.bark = null; this.barkT = 0;
  this.alive = true;
  this.walkPh = 0;
  if (opts) for (var k in opts) this[k] = opts[k];
};
var AP = G.Actor.prototype;

AP.say = function (text, t) { this.bark = text; this.barkT = t || 2.2; };
AP.sayFrom = function (key) { var arr = G.BARKS[key]; if (arr) this.say(arr[Math.floor(Math.random() * arr.length)]); };

AP.wdef = function () { return G.WEAPONS[this.weapon.id] || G.WEAPONS.fist; };

// Является ли other врагом для this
AP.isEnemy = function (o) {
  if (!o || !o.alive || o === this) return false;
  if (o.hidden) return false;
  if (this.isPlayer) return o.rel <= -2;
  if (this.disabled) return false;
  if (o.isPlayer) return this.rel <= -2;
  if (this.grudge[o.id]) return true;
  // отряд игрока
  if (this.rel >= 2) return o.rel <= -2 || (o.target && (o.target.isPlayer || o.target.rel >= 2) && o.state === 'combat');
  if (o.rel >= 2) return this.rel <= -2;
  var h = G.FAC_HOSTILE[this.fac];
  if (h && h[o.fac]) return true;
  return false;
};
AP.isAlly = function (o) {
  if (!o || o === this) return false;
  if (this.rel >= 2 && (o.isPlayer || o.rel >= 2)) return true;
  return o.fac === this.fac && !o.isPlayer && !this.isPlayer && !this.grudge[o.id];
};

AP.setState = function (s) { if (this.state !== s) { this.state = s; this.stateT = 0; this.path = null; } };

AP.makeHostile = function (to, game, quiet) {
  if (!this.alive || this.R.turret && this.disabled) return;
  if (to.isPlayer) {
    if (this.rel >= 2) { this.rel = -2; game.followers.splice(game.followers.indexOf(this), 1); }
    var was = this.rel; this.rel = -2;
    if (was > -2 && !quiet) this.sayFrom(this.coward() ? 'flee' : 'hostile');
  } else {
    this.grudge[to.id] = true;
  }
  if (this.coward()) { this.fleeFrom = to; this.setState('flee'); }
  else { this.target = to; this.lastSeen = { x: to.x, y: to.y }; this.setState('combat'); }
};
AP.coward = function () {
  var c = this.R.coward;
  if (this.R.turret) return false;
  if (this.hp < this.maxHp * 0.25 && c > 0.1) return true;
  return c >= 0.6 && this.weapon.id === 'fist';
};

// ---------- Восприятие ----------
AP.canSee = function (o, game) {
  if (!o.alive || o.hidden) return false;
  if (o.invis > 0 && G.dist(this.x, this.y, o.x, o.y) > 1.2) return false;
  var range = 9.5;
  if (o.isPlayer) { range *= game.player.stealthMul(); }
  var d = G.dist(this.x, this.y, o.x, o.y);
  if (d > range) return false;
  if (!this.R.turret && d > 1.5 && this.state !== 'combat' && this.state !== 'search') {
    var a = Math.atan2(o.y - this.y, o.x - this.x);
    if (Math.abs(G.angDiff(this.face, a)) > 1.25) return false;
  }
  return game.map.los(this.x, this.y, o.x, o.y);
};

AP.perceive = function (game) {
  var best = null, bd = 1e9, self = this;
  var list = game.actorsNear(this.x, this.y, 10);
  for (var i = 0; i < list.length; i++) {
    var o = list[i];
    if (!this.isEnemy(o)) continue;
    if (!this.canSee(o, game)) continue;
    var d = G.dist2(this.x, this.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (best) {
    if (this.state !== 'combat' && this.state !== 'flee') {
      if (this.coward()) { this.fleeFrom = best; this.setState('flee'); this.sayFrom('flee'); game.alertNearby(this, best); }
      else { this.setState('combat'); if (Math.random() < 0.5) this.sayFrom('hostile'); }
    }
    this.target = best; this.lastSeen = { x: best.x, y: best.y }; this.seenT = 0;
    if (this.home && this.home.private && this.home.alarmOn && !this.R.turret) game.tryAlarm(this, best);
    return;
  }
  // нарушение территории игроком
  var p = game.player;
  if (p.alive && this.home && this.home.private && this.rel < 1 && !this.R.turret && this.state !== 'combat' && this.state !== 'flee') {
    var pb = game.map.bAt(p.x, p.y);
    if (pb === this.home && this.canSee(p, game)) {
      if (this.state !== 'warn') { this.setState('warn'); this.sayFrom('warn'); if (this.rel > -1) this.rel = -1; }
    }
  }
  // турель стреляет по нарушителю
  if (this.R.turret && !this.disabled && p.alive && this.rel < 1) {
    var tb = game.map.bAt(p.x, p.y);
    if (tb && tb === this.home && this.canSee(p, game)) { this.rel = -2; this.target = p; this.setState('combat'); }
  }
  void self;
};

AP.hear = function (n, game) {
  if (!this.alive || this.R.turret || this.state === 'combat' || this.state === 'flee' || this.rel >= 2) return;
  if (n.src === this) return;
  if (this.coward() && n.loud) { this.fleeFrom = { x: n.x, y: n.y, alive: true }; this.setState('flee'); this.sayFrom('flee'); return; }
  this.investigate = { x: n.x, y: n.y };
  this.setState('investigate');
  if (Math.random() < 0.6) this.sayFrom('hear');
  void game;
};

// ---------- Движение ----------
AP.moveToward = function (tx, ty, spd, dt, game) {
  var dx = tx - this.x, dy = ty - this.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.05) return true;
  var s = Math.min(spd * dt, d);
  this.tryMove(dx / d * s, dy / d * s, game);
  this.face = Math.atan2(dy, dx);
  this.walkPh += s * 4;
  return d < 0.12;
};
AP.tryMove = function (mx, my, game) {
  var m = game.map, r = this.r;
  var nx = this.x + mx;
  if (!this.collides(nx, this.y, m, r)) this.x = nx;
  else this.bumpDoor(nx, this.y, game);
  var ny = this.y + my;
  if (!this.collides(this.x, ny, m, r)) this.y = ny;
  else this.bumpDoor(this.x, ny, game);
};
AP.collides = function (x, y, m, r) {
  var x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
    if (!m.passable(tx, ty, this)) return true;
  }
  return false;
};
AP.bumpDoor = function (x, y, game) {
  var m = game.map;
  var tx = Math.floor(x + Math.cos(this.face) * 0.35), ty = Math.floor(y + Math.sin(this.face) * 0.35);
  var d = m.doors[m.idx(tx, ty)];
  if (d && d.locked && !d.broken && this.isPlayer && !this.lockMsgT) {
    game.toast('Дверь заперта');
    this.lockMsgT = 1.5;
  }
};

AP.followPath = function (tx, ty, dt, game, spdMul) {
  this.pathT -= dt;
  var spd = this.speed * (spdMul || 1) * game.slowFactor(this);
  if (!this.path || this.pathT <= 0 || (this.pathGoal && G.dist2(this.pathGoal.x, this.pathGoal.y, tx, ty) > 4)) {
    if (game.pathBudget > 0) {
      game.pathBudget--;
      this.path = game.map.path(this.x, this.y, tx, ty, this) || [];
      this.pathGoal = { x: tx, y: ty };
      this.pathT = 0.6 + Math.random() * 0.4;
    }
  }
  if (!this.path) return false;
  if (!this.path.length) { return this.moveToward(tx, ty, spd, dt, game); }
  var wp = this.path[0];
  if (this.moveToward(wp.x, wp.y, spd, dt, game)) this.path.shift();
  // если застряли — пересчитаем
  return false;
};

// ---------- Бой ----------
AP.attackTarget = function (game, dt) {
  var t = this.target, w = this.wdef();
  var d = G.dist(this.x, this.y, t.x, t.y);
  var seen = this.canSee(t, game) || d < 1.2;
  if (seen) { this.lastSeen = { x: t.x, y: t.y }; this.seenT = 0; } else this.seenT = (this.seenT || 0) + dt;
  var want = Math.atan2(t.y - this.y, t.x - this.x);
  if (this.R.turret) {
    this.face += G.clamp(G.angDiff(this.face, want), -4 * dt, 4 * dt);
    if (seen && Math.abs(G.angDiff(this.face, want)) < 0.25 && this.cd <= 0) game.fire(this, this.face);
    if (!seen && this.seenT > 2) { this.setState('idle'); this.target = null; }
    return;
  }
  if (w.kind === 'melee') {
    if (d > w.range + 0.15 || !seen) this.followPath(seen ? t.x : this.lastSeen.x, seen ? t.y : this.lastSeen.y, dt, game, 1.1);
    else {
      this.face = want;
      if (this.cd <= 0 && this.reactT <= 0) game.fire(this, want);
    }
  } else {
    var ideal = Math.min(w.range * 0.6, 6);
    if (!seen || d > w.range * 0.9) this.followPath(seen ? t.x : this.lastSeen.x, seen ? t.y : this.lastSeen.y, dt, game, 1.05);
    else {
      this.face = want;
      // стрейф и удержание дистанции
      this.strafeT = (this.strafeT || 0) - dt;
      if (this.strafeT <= 0) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.8 + Math.random() * 1.2; }
      var sx = Math.cos(want + Math.PI / 2) * this.strafeDir, sy = Math.sin(want + Math.PI / 2) * this.strafeDir;
      var back = d < ideal - 1 ? -1 : d > ideal + 1 ? 1 : 0;
      var mx = sx * 0.6 + Math.cos(want) * back, my = sy * 0.6 + Math.sin(want) * back;
      var spd = this.speed * 0.7 * game.slowFactor(this) * dt;
      this.tryMove(mx * spd, my * spd, game);
      this.face = want;
      if (this.cd <= 0 && this.reactT <= 0) game.fire(this, want + (Math.random() - 0.5) * 0.12);
    }
  }
};

// ---------- Главный цикл ИИ ----------
AP.think = function (game, dt) {
  if (this.isPlayer) return;
  if (this.disabled) return;
  this.stateT += dt;
  this.reactT = (this.reactT === undefined ? 0.4 : this.reactT);
  this.percT -= dt;
  if (this.percT <= 0) { this.percT = 0.25; this.perceive(game); }
  var p = game.player;

  switch (this.state) {
    case 'idle': {
      this.reactT = 0.35 + Math.random() * 0.3;
      if (this.rel >= 2) { this.setState('follow'); break; }
      if (this.R.turret) { this.face += dt * 0.6; break; }
      if (this.post && G.dist(this.x, this.y, this.post.x, this.post.y) > 0.6) { this.followPath(this.post.x, this.post.y, dt, game, 0.7); break; }
      if (this.post && this.post.face !== undefined) this.face = this.post.face;
      if (this.patrol || this.wanderer) { if (this.stateT > 1 + Math.random() * 3) this.setState('wander'); }
      else if (this.stateT > 3 && Math.random() < 0.01) this.face += (Math.random() - 0.5) * 2;
      if (Math.random() < 0.0015 && G.dist(this.x, this.y, p.x, p.y) < 7) this.sayFrom(this.fac === 'cop' ? 'cop' : 'idle');
      break;
    }
    case 'wander': {
      if (!this.wanderGoal) {
        var area = this.patrol ? null : this.home;
        var c = area ? game.map.cellInRect(game.rng, { x: area.x + 1, y: area.y + 1, w: area.w - 2, h: area.h - 2 })
                     : game.map.randomCell(game.rng, function (x, y) { var t = game.map.get(x, y); return t === G.T.SIDE || t === G.T.STREET || t === G.T.GRASS; });
        if (c) { this.wanderGoal = { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 }; if (this.patrol) { var dd = G.dist(this.x, this.y, this.wanderGoal.x, this.wanderGoal.y); if (dd > 25) this.wanderGoal = null; } }
        if (!this.wanderGoal) { this.setState('idle'); break; }
      }
      this.followPath(this.wanderGoal.x, this.wanderGoal.y, dt, game, 0.55);
      if (G.dist(this.x, this.y, this.wanderGoal.x, this.wanderGoal.y) < 0.6 || this.stateT > 15) { this.wanderGoal = null; this.setState('idle'); }
      break;
    }
    case 'warn': {
      // требует уйти; если игрок не уходит — нападает
      var pb = game.map.bAt(p.x, p.y);
      this.face = Math.atan2(p.y - this.y, p.x - this.x);
      if (pb !== this.home || !p.alive) { this.setState('idle'); break; }
      if (G.dist(this.x, this.y, p.x, p.y) > 2) this.followPath(p.x, p.y, dt, game, 0.8);
      if (this.stateT > 4.5) { this.makeHostile(p, game); game.alertNearby(this, p); }
      break;
    }
    case 'investigate': {
      var g = this.investigate;
      if (!g) { this.setState('return'); break; }
      this.followPath(g.x, g.y, dt, game, 0.8);
      if (G.dist(this.x, this.y, g.x, g.y) < 1.2 || this.stateT > 9) { this.investigate = null; this.setState('search'); }
      break;
    }
    case 'search': {
      this.face += dt * 2.2;
      if (this.stateT > 3) { this.sayFrom('lost'); this.setState('return'); }
      break;
    }
    case 'return': {
      var hp = this.post || this.spawn;
      if (!hp || this.rel >= 2) { this.setState('idle'); break; }
      this.followPath(hp.x, hp.y, dt, game, 0.6);
      if (G.dist(this.x, this.y, hp.x, hp.y) < 0.8 || this.stateT > 20) this.setState('idle');
      break;
    }
    case 'combat': {
      var t = this.target;
      if (!t || !t.alive || !this.isEnemy(t)) {
        this.target = null;
        this.setState(this.rel >= 2 ? 'follow' : 'search');
        break;
      }
      this.reactT -= dt;
      this.attackTarget(game, dt);
      if (this.seenT > 6 && !this.R.turret) {
        this.investigate = this.lastSeen; this.target = null; this.setState('investigate');
        if (t.isPlayer && this.rel <= -2 && this.fac !== 'cop' && Math.random() < 0.4) this.rel = -1;
      }
      if (this.coward()) { this.fleeFrom = t; this.setState('flee'); this.sayFrom('flee'); }
      // отряд не убегает далеко от игрока
      if (this.rel >= 2 && G.dist(this.x, this.y, p.x, p.y) > 12) { this.target = null; this.setState('follow'); }
      break;
    }
    case 'flee': {
      var f = this.fleeFrom;
      if (!f || (f.alive === false) || this.stateT > 7) {
        if (this.stateT > 7 || !f || !f.alive) { this.fleeFrom = null; this.setState('return'); }
        break;
      }
      if (!this.fleeGoal || this.stateT % 2 < dt) {
        var ang = Math.atan2(this.y - f.y, this.x - f.x) + (Math.random() - 0.5) * 1.2;
        this.fleeGoal = { x: G.clamp(this.x + Math.cos(ang) * 10, 1, game.map.w - 2), y: G.clamp(this.y + Math.sin(ang) * 10, 1, game.map.h - 2) };
      }
      this.followPath(this.fleeGoal.x, this.fleeGoal.y, dt, game, 1.15);
      // пожаловаться полиции
      if (f.isPlayer && this.fac !== 'cop') {
        var cops = game.actorsNear(this.x, this.y, 6);
        for (var i = 0; i < cops.length; i++) if (cops[i].fac === 'cop' && cops[i].rel > -2 && cops[i].rel < 1) { cops[i].makeHostile(p, game); cops[i].say('Стоять, полиция!'); }
      }
      break;
    }
    case 'follow': {
      if (this.rel < 2) { this.setState('return'); break; }
      this.reactT = 0.2;
      var dp = G.dist(this.x, this.y, p.x, p.y);
      if (this.holdPos) { if (this.holdPos && G.dist(this.x, this.y, this.holdPos.x, this.holdPos.y) > 0.5) this.followPath(this.holdPos.x, this.holdPos.y, dt, game, 1); }
      else if (dp > 2.2) this.followPath(p.x, p.y, dt, game, dp > 6 ? 1.3 : 1.05);
      // атаковать врагов игрока
      if (p.lastAttacker && p.lastAttacker.alive && G.dist(this.x, this.y, p.lastAttacker.x, p.lastAttacker.y) < 10) {
        this.grudge[p.lastAttacker.id] = true; this.target = p.lastAttacker; this.setState('combat');
      }
      if (p.lastVictim && p.lastVictim.alive && p.lastVictim.rel <= -2 && G.dist(this.x, this.y, p.lastVictim.x, p.lastVictim.y) < 10) {
        this.target = p.lastVictim; this.setState('combat');
      }
      break;
    }
  }
};
