'use strict';
// Игрок: классы, инвентарь, способности, опыт.

G.input = { mx: 0, my: 0, ax: 0, ay: 0, aiming: false, aimMag: 0, fire: false };
G.MAX_SLOTS = 14;

G.newPlayerState = function (clsId) {
  var cls = G.CLASSES.filter(function (c) { return c.id === clsId; })[0];
  var st = { cls: clsId, hp: cls.hp, maxHp: cls.hp, armor: 0, inv: [], money: cls.money, xp: 0, level: 1, traits: {}, stats: { kills: 0, floors: 0 } };
  cls.start.forEach(function (s) {
    var id = s[0], n = s[1], w = G.WEAPONS[id];
    if (w && w.kind === 'gun') st.inv.push({ id: id, n: 1, ammo: n || w.ammo });
    else if (w && w.kind === 'melee') st.inv.push({ id: id, n: 1, dur: w.dur });
    else st.inv.push({ id: id, n: n || 1 });
  });
  return st;
};

G.makePlayer = function (st, x, y) {
  var cls = G.CLASSES.filter(function (c) { return c.id === st.cls; })[0];
  var p = new G.Actor('civ', x, y);
  p.isPlayer = true; p.cls = cls;
  p.name = cls.name; p.color = cls.color; p.hat = cls.hat; p.fac = 'player';
  p.maxHp = st.maxHp; p.hp = st.hp; p.armor = st.armor || 0;
  p.inv = st.inv.map(function (s) { return Object.assign({}, s); });
  p.money = st.money; p.xp = st.xp; p.level = st.level; p.traits = Object.assign({}, st.traits);
  p.pendingTraits = st.pendingTraits || 0;
  p.r = 0.3;
  p.abilityCd = 0; p.invis = 0; p.speedT = 0; p.drunk = 0; p.godT = 1.5; p.combatT = 0;
  p.rel = 0;
  for (var k in G.PlayerMethods) p[k] = G.PlayerMethods[k];
  p.equipBest();
  return p;
};

G.PlayerMethods = {
  snapshot: function (stats) {
    return { cls: this.cls.id, hp: this.hp, maxHp: this.maxHp, armor: this.armor, inv: this.inv.map(function (s) { return Object.assign({}, s); }).filter(function (s) { return !G.ITEMS[s.id] || !G.ITEMS[s.id].quest; }),
      money: this.money, xp: this.xp, level: this.level, traits: this.traits, stats: stats, pendingTraits: this.pendingTraits };
  },
  stealthMul: function () {
    var m = 1 / Math.sqrt(this.cls.stealth);
    if (this.traits.quiet) m *= 0.7;
    if (this.invis > 0) m *= 0.1;
    return m;
  },
  xpNext: function () { return 70 + this.level * 50; },
  gainXP: function (n, game) {
    this.xp += n;
    while (this.xp >= this.xpNext()) {
      this.xp -= this.xpNext(); this.level++; this.pendingTraits++;
      this.maxHp += 5; this.hp = Math.min(this.maxHp, this.hp + 20);
      G.Audio.sfx('levelup');
      game.toast('Новый уровень: ' + this.level + '!');
      game.float(this.x, this.y - 0.9, 'УРОВЕНЬ ' + this.level, '#7ff', 16);
    }
  },
  addItem: function (id, n, ammo, dur) {
    var w = G.WEAPONS[id];
    n = n || 1;
    if (w && w.kind === 'gun') {
      var have = this.inv.filter(function (s) { return s.id === id; })[0];
      if (have) { have.ammo += ammo || w.ammo; return true; }
      if (this.inv.length >= G.MAX_SLOTS) { G.game.toast('Сумка полна'); return false; }
      this.inv.push({ id: id, n: 1, ammo: ammo !== undefined ? ammo : w.ammo });
      if (this.weapon.id === 'fist' || G.WEAPONS[this.weapon.id].kind === 'melee') this.equip(this.inv[this.inv.length - 1]);
      return true;
    }
    if (w && w.kind === 'melee') {
      if (this.inv.length >= G.MAX_SLOTS) { G.game.toast('Сумка полна'); return false; }
      this.inv.push({ id: id, n: 1, dur: dur || w.dur });
      if (this.weapon.id === 'fist') this.equip(this.inv[this.inv.length - 1]);
      return true;
    }
    var st = this.inv.filter(function (s) { return s.id === id; })[0];
    if (st) { st.n += n; return true; }
    if (this.inv.length >= G.MAX_SLOTS) { G.game.toast('Сумка полна'); return false; }
    this.inv.push({ id: id, n: n });
    return true;
  },
  count: function (id) { var s = this.inv.filter(function (q) { return q.id === id; })[0]; return s ? s.n : 0; },
  take: function (id, n) {
    var s = this.inv.filter(function (q) { return q.id === id; })[0];
    if (!s || s.n < (n || 1)) return false;
    s.n -= (n || 1);
    if (s.n <= 0) this.removeItem(s);
    return true;
  },
  removeItem: function (slot) {
    var i = this.inv.indexOf(slot);
    if (i >= 0) this.inv.splice(i, 1);
    if (this.weapon === slot) this.equipBest();
  },
  weaponSlots: function () { return this.inv.filter(function (s) { return !!G.WEAPONS[s.id]; }); },
  equip: function (slot) { this.weapon = slot || { id: 'fist', n: 1 }; this.cd = Math.max(this.cd, 0.15); },
  equipBest: function () {
    if (!this.inv) { return; }
    var guns = this.inv.filter(function (s) { var w = G.WEAPONS[s.id]; return w && w.kind === 'gun' && s.ammo > 0; });
    var melee = this.inv.filter(function (s) { var w = G.WEAPONS[s.id]; return w && w.kind === 'melee'; });
    this.weapon = guns[0] || melee[0] || { id: 'fist', n: 1 };
  },
  cycleWeapon: function (dir) {
    var list = [{ id: 'fist', n: 1 }].concat(this.weaponSlots());
    var i = 0, self = this;
    list.forEach(function (s, k) { if (s === self.weapon || (s.id === 'fist' && self.weapon.id === 'fist')) i = k; });
    i = (i + (dir || 1) + list.length) % list.length;
    this.equip(list[i]);
    G.Audio.sfx('ui');
  },
  useItem: function (slot, game) {
    var it = G.ITEMS[slot.id], w = G.WEAPONS[slot.id];
    if (w) { this.equip(slot); return; }
    if (!it) return;
    if (it.heal) {
      if (this.hp >= this.maxHp) { game.toast('Здоровье и так полное'); return; }
      this.hp = Math.min(this.maxHp, this.hp + it.heal); G.Audio.sfx('eat');
      game.float(this.x, this.y - 0.6, '+' + it.heal, '#6f6');
      if (it.drunk) this.drunk = it.drunk;
    } else if (it.speed) { this.speedT = it.speed; G.Audio.sfx('ability'); }
    else if (it.invis) { this.invis = it.invis; G.Audio.sfx('ability'); }
    else if (it.armor) { this.armor = Math.min(80, this.armor + it.armor); G.Audio.sfx('pickup'); }
    else if (it.place) { game.placeC4(this); }
    else if (it.ammoPack) {
      var gun = (G.WEAPONS[this.weapon.id] && G.WEAPONS[this.weapon.id].kind === 'gun') ? this.weapon : this.inv.filter(function (s) { return G.WEAPONS[s.id] && G.WEAPONS[s.id].kind === 'gun'; })[0];
      if (!gun) { game.toast('Нет огнестрельного оружия'); return; }
      var add = Math.ceil(G.WEAPONS[gun.id].ammo * (this.traits.ammo ? 2 : 1));
      gun.ammo += add; game.toast(G.WEAPONS[gun.id].name + ': +' + add + ' патр.'); G.Audio.sfx('pickup');
    } else if (it.tool) { game.toast('Подойдите к замку или устройству и нажмите «Действие»'); return; }
    else if (it.quest) { game.toast(it.desc); return; }
    slot.n--;
    if (slot.n <= 0) this.removeItem(slot);
  },
  // Тратит инструмент (с учётом черты «Ловкие пальцы»)
  useTool: function (id) {
    if (this.traits.picker && Math.random() < 0.5) return true;
    return this.take(id, 1);
  },
  canHack: function () { return this.cls.id === 'hacker' || this.count('hackchip') > 0; },
  spendHack: function () { if (this.cls.id === 'hacker') return true; return this.useTool('hackchip'); },

  ability: function (game) {
    if (this.abilityCd > 0 || !this.alive) return;
    var id = this.cls.ability, self = this;
    if (id === 'ram') {
      this.ramT = 0.32; this.ramAng = this.face; this.ramHit = {}; this.abilityCd = 6; this.godT = 0.35;
      G.Audio.sfx('ability');
    } else if (id === 'hack') {
      var dev = G.Interact.nearestHackable(game, 8);
      if (!dev) { game.toast('Рядом нет устройств'); G.Audio.sfx('error'); return; }
      this.abilityCd = 1;
      G.UI.openHack(dev, true);
    } else if (id === 'cloak') {
      this.invis = 6; this.abilityCd = 18; G.Audio.sfx('ability');
      game.toast('Вы невидимы');
    } else if (id === 'focus') {
      game.focusT = 4; this.abilityCd = 20; G.Audio.sfx('ability');
    } else if (id === 'persuade') {
      var best = null, bd = 9;
      game.actors.forEach(function (a) {
        if (a.isPlayer || !a.alive || a.R.turret || a.R.boss || a.prisonerLocked) return;
        var d = G.dist2(self.x, self.y, a.x, a.y);
        if (d < bd) { bd = d; best = a; }
      });
      if (!best) { game.toast('Некого убеждать'); G.Audio.sfx('error'); return; }
      this.abilityCd = 8; G.Audio.sfx('ability');
      if (best.rel <= -2) {
        if (Math.random() < 0.5) { best.rel = 0; best.target = null; best.setState('return'); best.say('Ладно... живи.'); }
        else { best.say('Не заговаривай мне зубы!'); }
      } else if (best.rel < 1) { best.rel = 1; best.say('А ты ничего.'); game.float(best.x, best.y - 0.8, '♥', '#6f6', 16); }
      else if (best.rel === 1) { G.Interact.recruit(best, game); }
      else best.say('Я и так с тобой.');
    } else if (id === 'bomb') {
      game.throwObj(this, 'grenade', this.face, 6);
      this.abilityCd = 8;
    }
  },

  updatePlayer: function (dt, game) {
    if (!this.alive) return;
    var inp = G.input;
    ['cd', 'abilityCd', 'invis', 'speedT', 'drunk', 'godT', 'combatT', 'noAmmoT', 'lockMsgT'].forEach(function (k) {
      if (this[k] > 0) { this[k] -= dt; if (this[k] < 0) this[k] = 0; }
    }, this);
    if (this.traits.regen && this.combatT <= 0 && this.hp < this.maxHp) { this.regenAcc = (this.regenAcc || 0) + dt; if (this.regenAcc > 1) { this.regenAcc = 0; this.hp++; } }
    if (this.stun > 0) { this.stun -= dt; return; }
    if (this.cls.ability === 'bomb' && !this.bombRegen) this.bombRegen = 0;

    // Рывок-таран
    if (this.ramT > 0) {
      this.ramT -= dt;
      var sp = 15 * dt, m = game.map, self = this;
      var nx = Math.cos(this.ramAng) * sp, ny = Math.sin(this.ramAng) * sp;
      var tx = Math.floor(this.x + Math.cos(this.ramAng) * 0.5), ty = Math.floor(this.y + Math.sin(this.ramAng) * 0.5);
      var door = m.doors[m.idx(tx, ty)];
      if (door && !door.broken) { door.broken = true; door.locked = false; G.Audio.sfx('doorbreak'); game.noise(tx, ty, 9, this, true); game.crime(this, m.buildings[door.bid], 'break'); }
      if (m.get(tx, ty) === G.T.WINDOW) game.breakWindow(tx, ty, this);
      this.tryMove(nx, ny, game);
      game.actorsNear(this.x, this.y, 0.9).forEach(function (a) {
        if (a === self || self.ramHit[a.id] || a.rel >= 2) return;
        self.ramHit[a.id] = 1;
        game.damage(a, 22 * self.cls.melee, self, { kx: Math.cos(self.ramAng) * 12, ky: Math.sin(self.ramAng) * 12, stun: 1.2 });
      });
      if (Math.random() < 0.6) game.particles.push({ x: this.x, y: this.y, vx: 0, vy: 0, t: 0.25, max: 0.25, color: '#ddd', size: 5 });
      return;
    }

    var mag = Math.sqrt(inp.mx * inp.mx + inp.my * inp.my);
    this.moving = mag > 0.15;
    if (this.moving && this.hidden) this.unhide(game);
    if (this.moving) {
      var spd = 3.7 * this.cls.speed * (this.traits.fast ? 1.12 : 1) * (this.speedT > 0 ? 1.5 : 1) * Math.min(1, mag);
      this.moveAng = Math.atan2(inp.my, inp.mx);
      this.tryMove(Math.cos(this.moveAng) * spd * dt, Math.sin(this.moveAng) * spd * dt, game);
      this.walkPh += spd * dt * 4;
      this.stepT = (this.stepT || 0) - dt;
      if (this.stepT <= 0) { this.stepT = 0.32; G.Audio.sfx('step'); }
    }
    var w = this.wdef();
    if (inp.aiming && inp.aimMag > 0.2) {
      var ang = Math.atan2(inp.ay, inp.ax);
      ang = this.aimAssist(ang, game, w);
      this.face = ang;
      this.throwPower = G.clamp(inp.aimMag, 0.25, 1);
      if (inp.aimMag > 0.6 && this.cd <= 0 && w.kind !== 'throw') game.fire(this, this.face);
    } else if (inp.fire && this.cd <= 0) {
      // кнопка атаки: бьём ближайшего врага или в направлении взгляда
      var tgt = this.nearestEnemy(game, w.kind === 'melee' ? 2.2 : w.range || 8);
      if (tgt) this.face = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      this.throwPower = 0.8;
      game.fire(this, this.face);
    } else if (this.moving) this.face = this.moveAng;
  },
  aimAssist: function (ang, game, w) {
    if (w.kind === 'throw') return ang;
    var best = null, bd = 0.28;
    var range = w.kind === 'melee' ? 2.5 : (w.range || 8);
    var self = this;
    game.actorsNear(this.x, this.y, range).forEach(function (a) {
      if (a === self || !a.alive || a.rel > -2 || a.hidden) return;
      var an = Math.atan2(a.y - self.y, a.x - self.x);
      var d = Math.abs(G.angDiff(ang, an));
      if (d < bd && game.map.los(self.x, self.y, a.x, a.y)) { bd = d; best = an; }
    });
    return best === null ? ang : best;
  },
  nearestEnemy: function (game, range) {
    var best = null, bd = range * range, self = this;
    game.actorsNear(this.x, this.y, range).forEach(function (a) {
      if (a === self || !a.alive || a.rel > -2 || a.hidden) return;
      var d = G.dist2(self.x, self.y, a.x, a.y);
      if (d < bd && game.map.los(self.x, self.y, a.x, a.y)) { bd = d; best = a; }
    });
    return best;
  },
  releaseThrow: function (game) {
    var w = this.wdef();
    if (w.kind === 'throw' && this.cd <= 0) game.fire(this, this.face);
  },
  unhide: function (game) {
    this.hidden = false;
    if (this.hideFrom) { this.x = this.hideFrom.x; this.y = this.hideFrom.y; this.hideFrom = null; }
    void game;
  }
};
