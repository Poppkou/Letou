'use strict';
// Генератор заданий этажа и проверка их выполнения.

G.MISSION_TYPES = ['kill', 'steal', 'rescue', 'destroy', 'hack', 'deliver', 'clear'];

G.makeMissions = function (game) {
  var m = game.map, rng = game.rng, floor = game.floor;
  var count = floor === 1 ? 2 : 3;
  if (floor === G.MAX_FLOOR) count = 2;
  var types = rng.shuffle(G.MISSION_TYPES.slice());
  var used = {};
  var reward = function () { return 45 + floor * 15 + rng.int(0, 20); };
  var where = function (b) { return b.def.name; };
  var bOf = function (list) {
    var c = m.buildings.filter(function (b) { return list.indexOf(b.type) >= 0 && !used[b.id]; });
    return c.length ? rng.pick(c) : null;
  };
  var builders = {
    kill: function () {
      var b = bOf(['rustbase', 'neonbase', 'lab', 'bank', 'house', 'warehouse']);
      if (!b) return null;
      var role = b.type === 'rustbase' ? 'rust' : b.type === 'neonbase' ? 'neon' : b.type === 'lab' ? 'scientist' : b.type === 'house' || b.type === 'bank' ? 'rich' : 'guard';
      var title = { rust: 'Главарь Ржавых', neon: 'Главарь Неоновых', scientist: 'Профессор Мрак', rich: 'Ростовщик Шило', guard: 'Начальник склада' }[role];
      var c = m.cellInRect(rng, rng.pick(b.rooms));
      if (!c) return null;
      var a = game.spawn(role, c.x + 0.5, c.y + 0.5, { home: b });
      a.name = title; a.mtarget = true;
      if (role === 'rust' || role === 'neon' || role === 'guard') { a.hp = a.maxHp = Math.round(a.maxHp * 2.2); a.weapon = { id: floor >= 3 ? 'smg' : 'pistol', ammo: 999 }; a.armor = 20; }
      a.money += 40;
      used[b.id] = 1;
      return { type: 'kill', text: 'Устранить: ' + title + ' (' + where(b) + ')', target: a, b: b };
    },
    steal: function () {
      var b = bOf(['warehouse', 'lab', 'bank', 'police', 'rustbase', 'neonbase']);
      var item = rng.pick(['docs', 'blueprint', 'ingot']);
      if (b) {
        var safe = b.objects.filter(function (o) { return o.type === 'safe'; })[0] || b.objects.filter(function (o) { return o.type === 'crate' || o.type === 'wardrobe'; })[0];
        if (safe) { safe.items.push({ id: item, n: 1 }); safe.questItem = item; used[b.id] = 1;
          return { type: 'steal', text: 'Украсть: ' + G.ITEMS[item].name + ' (' + G.OBJDEF[safe.type].name.toLowerCase() + ', ' + where(b) + ')', item: item, obj: safe, b: b }; }
      }
      // в кармане у охранника / богача
      var holders = game.actors.filter(function (a) { return a.alive && !a.isPlayer && (a.role === 'guard' || a.role === 'rich' || a.role === 'cop') && !a.mtarget; });
      if (!holders.length) return null;
      var h = rng.pick(holders); h.items.push({ id: item, n: 1 }); h.mtarget = true;
      return { type: 'steal', text: 'Добыть: ' + G.ITEMS[item].name + ' (у ' + h.name.toLowerCase() + 'а ' + h.npcName + ')', item: item, holder: h };
    },
    rescue: function () {
      var b = bOf(['police', 'rustbase', 'neonbase']);
      if (!b || b.rooms.length < 2) return null;
      var cell = b.cell || b.rooms[b.rooms.length - 1];
      var c = m.cellInRect(rng, cell);
      if (!c) return null;
      var a = game.spawn('prisoner', c.x + 0.5, c.y + 0.5, { home: null });
      a.name = 'Пленник ' + a.npcName; a.prisonerLocked = true; a.disabled = true; a.mtarget = true; a.rel = 1;
      // запереть камеру
      b.doors.forEach(function (d) { if (!d.outer && d.x >= cell.x - 1 && d.x <= cell.x + cell.w && d.y >= cell.y - 1 && d.y <= cell.y + cell.h) d.locked = true; });
      used[b.id] = 1;
      return { type: 'rescue', text: 'Вызволить пленника (' + where(b) + ') и довести до лифта', target: a, b: b };
    },
    destroy: function () {
      var b = bOf(['warehouse', 'lab', 'rustbase']);
      if (!b) return null;
      var o = b.objects.filter(function (q) { return q.type === 'generator' || q.type === 'server' || q.type === 'still'; })[0];
      if (!o) return null;
      used[b.id] = 1;
      return { type: 'destroy', text: 'Уничтожить: ' + G.OBJDEF[o.type].name + ' (' + where(b) + ')', obj: o, b: b };
    },
    hack: function () {
      var b = bOf(['lab', 'police', 'bank', 'tower']);
      if (!b) return null;
      var o = b.objects.filter(function (q) { return q.type === 'terminal'; })[0];
      if (!o) return null;
      o.missionData = true; used[b.id] = 1;
      return { type: 'hack', text: 'Скачать данные с терминала (' + where(b) + ')', obj: o, b: b };
    },
    deliver: function () {
      var cands = game.actors.filter(function (a) { return a.alive && a.home && (a.home.type === 'house' || a.home.type === 'bar') && !a.mtarget && !a.R.turret && !a.shopkeeper; });
      if (!cands.length) return null;
      var a = rng.pick(cands); a.mtarget = true; a.recipient = true;
      game.player.addItem('package', 1);
      return { type: 'deliver', text: 'Доставить посылку: ' + a.npcName + ' (' + where(a.home) + ')', target: a, b: a.home };
    },
    clear: function () {
      var b = bOf(['rustbase', 'neonbase']);
      if (!b) return null;
      var fac = b.type === 'rustbase' ? 'rust' : 'neon';
      var members = game.actors.filter(function (a) { return a.alive && a.fac === fac && (a.home === b || a.gang === b); });
      if (members.length < 3) return null;
      members.forEach(function (a) { a.mtarget = true; });
      used[b.id] = 1;
      return { type: 'clear', text: 'Разгромить банду ' + (fac === 'rust' ? 'Ржавых' : 'Неоновых') + ' (' + members.length + ' чел.)', members: members, b: b };
    }
  };
  if (floor === G.MAX_FLOOR) {
    var tower = m.buildings.filter(function (b) { return b.type === 'tower'; })[0];
    if (tower) {
      var rm = tower.rooms[tower.rooms.length - 1];
      var c = m.cellInRect(rng, rm) || m.cellInRect(rng, tower.rooms[0]);
      var boss = game.spawn('boss', c.x + 0.5, c.y + 0.5, { home: tower });
      boss.post = { x: boss.x, y: boss.y }; boss.mtarget = true; boss.weapon = { id: 'smg', ammo: 999 };
      used[tower.id] = 1;
      game.missions.push({ type: 'kill', text: 'Свергнуть Хозяина Города (Башня)', target: boss, b: tower, reward: 300, boss: true });
    }
  }
  for (var i = 0; i < types.length && game.missions.length < count + (floor === G.MAX_FLOOR ? 1 : 0); i++) {
    var mi = builders[types[i]]();
    if (mi) { mi.reward = mi.reward || reward(); game.missions.push(mi); }
  }
};

G.checkMissions = function (game) {
  var p = game.player, m = game.map;
  game.missions.forEach(function (mi) {
    if (mi.done || mi.failed) return;
    var ok = false, fail = false;
    switch (mi.type) {
      case 'kill': ok = !mi.target.alive; break;
      case 'steal': ok = p.count(mi.item) > 0; break;
      case 'rescue':
        if (!mi.target.alive) fail = true;
        else if (!mi.target.prisonerLocked && G.dist(mi.target.x, mi.target.y, m.elevX, m.elevY) < 3.5) ok = true;
        break;
      case 'destroy': ok = !!mi.obj.dead; break;
      case 'hack': ok = !!mi.obj.downloaded; if (mi.obj.dead && !ok) fail = true; break;
      case 'deliver': ok = !!mi.delivered; if (!mi.target.alive && !ok) fail = true; break;
      case 'clear': ok = mi.members.every(function (a) { return !a.alive; }); break;
    }
    if (ok) {
      mi.done = true;
      p.money += mi.reward;
      p.gainXP(60, game);
      G.Audio.sfx('mission');
      game.toast('✔ Задание выполнено: +' + mi.reward + '₽');
      if (mi.type === 'rescue') { mi.target.say('Спасибо! Дальше я сам.'); G.Interact.dismiss(mi.target, game); }
      if (mi.type === 'steal') { p.take(mi.item, 1); }
      if (game.canLeave()) game.toast('Лифт открыт — все задания закрыты');
    } else if (fail) {
      mi.failed = true;
      game.toast('✖ Задание провалено');
      G.Audio.sfx('error');
      if (game.canLeave()) game.toast('Лифт открыт');
    }
  });
};

// Где показывать метки задания
G.missionMarkers = function (game, mi) {
  var out = [];
  if (mi.done || mi.failed) return out;
  switch (mi.type) {
    case 'kill': case 'deliver': if (mi.target.alive) out.push({ x: mi.target.x, y: mi.target.y }); break;
    case 'rescue':
      if (mi.target.prisonerLocked) out.push({ x: mi.target.x, y: mi.target.y });
      else out.push({ x: game.map.elevX, y: game.map.elevY });
      break;
    case 'steal':
      if (mi.obj && !mi.obj.opened && !mi.obj.dead) out.push({ x: mi.obj.x + 0.5, y: mi.obj.y + 0.5 });
      else if (mi.holder && mi.holder.alive && mi.holder.items.some(function (i) { return i.id === mi.item; })) out.push({ x: mi.holder.x, y: mi.holder.y });
      else game.pickups.forEach(function (pk) { if (pk.id === mi.item) out.push({ x: pk.x, y: pk.y }); });
      break;
    case 'destroy': case 'hack': out.push({ x: mi.obj.x + 0.5, y: mi.obj.y + 0.5 }); break;
    case 'clear': mi.members.forEach(function (a) { if (a.alive) out.push({ x: a.x, y: a.y }); }); break;
  }
  return out;
};
