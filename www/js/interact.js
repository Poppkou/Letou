'use strict';
// Меню взаимодействия: NPC, объекты, двери, окна. Взлом, подкуп, найм, карманы.

G.Interact = (function () {
  function scale(game) { return 1 + (game.floor - 1) * 0.15; }
  function bribeCost(a, game) {
    var base = { cop: 60, supercop: 90, guard: 50, bouncer: 40, rust: 35, neon: 35, shop: 30, bartender: 30, scientist: 25, rich: 45 }[a.role] || 20;
    var p = game.player, k = scale(game);
    if (p.traits.connected) k *= 0.6;
    if (p.cls.id === 'baron') k *= 0.7;
    return Math.round(base * k);
  }
  function hireCost(a, game) {
    var base = { rust: 60, neon: 60, guard: 80, bum: 15, worker: 35, bouncer: 90 }[a.role];
    if (!base) return 0;
    var p = game.player, k = scale(game);
    if (p.traits.connected) k *= 0.6;
    if (p.cls.id === 'baron') k *= 0.7;
    if (a.rel >= 1) k *= 0.7;
    return Math.round(base * k);
  }
  function recruit(a, game) {
    if (game.followers.length >= 4) { game.toast('Отряд полон (макс. 4)'); return false; }
    a.rel = 2; a.home = null; a.post = null; a.patrol = false; a.wanderer = false; a.holdPos = null;
    a.setState('follow');
    a.sayFrom('hire');
    if (game.followers.indexOf(a) < 0) game.followers.push(a);
    game.float(a.x, a.y - 0.8, '★', '#6cf', 16);
    return true;
  }
  function dismiss(a, game) {
    var i = game.followers.indexOf(a); if (i >= 0) game.followers.splice(i, 1);
    a.rel = 1; a.holdPos = null; a.setState('idle'); a.spawn = { x: a.x, y: a.y };
  }
  function pay(game, n) {
    var p = game.player;
    if (p.money < n) { game.toast('Не хватает денег (' + n + '₽)'); G.Audio.sfx('error'); return false; }
    p.money -= n; G.Audio.sfx('coin'); return true;
  }
  function seenBy(a, game) { return a.canSee(game.player, game) && a.state !== 'stunned'; }

  function openContainer(o, game, silent) {
    var p = game.player, b = game.map.buildings[o.bid] || null;
    var got = [];
    o.items.slice().forEach(function (it) {
      if (p.addItem(it.id, it.n)) { got.push((G.ITEMS[it.id] || G.WEAPONS[it.id]).name); o.items.splice(o.items.indexOf(it), 1); }
    });
    if (o.money) { p.money += o.money; got.push(o.money + '₽'); o.money = 0; }
    o.opened = true;
    if (got.length) { game.toast('Найдено: ' + got.join(', ')); G.Audio.sfx('pickup'); }
    else if (!silent) game.toast('Пусто');
    if (b && b.private) game.crime(p, b, 'steal');
    G.checkMissions(game);
  }

  function hackables(game) {
    var out = [];
    game.map.objects.forEach(function (o) {
      if (o.dead) return;
      if (o.type === 'terminal' || (o.type === 'safe' && !o.opened) || o.type === 'atm' || o.type === 'alarm' || o.type === 'vending') out.push({ kind: 'obj', o: o, x: o.x + 0.5, y: o.y + 0.5 });
    });
    game.actors.forEach(function (a) { if (a.alive && a.R.turret && !a.hacked) out.push({ kind: 'turret', a: a, x: a.x, y: a.y }); });
    for (var k in game.map.doors) { var d = game.map.doors[k]; if (d.locked && !d.broken) out.push({ kind: 'door', d: d, x: d.x + 0.5, y: d.y + 0.5 }); }
    return out;
  }
  function nearestHackable(game, r) {
    var p = game.player, best = null, bd = r * r;
    hackables(game).forEach(function (h) { var d = G.dist2(p.x, p.y, h.x, h.y); if (d < bd) { bd = d; best = h; } });
    return best;
  }

  // Варианты взлома устройства
  function hackOptions(dev, game) {
    var p = game.player, opts = [];
    var spend = function (fn) { return function () { if (!p.spendHack()) { game.toast('Нужен хак-чип'); return; } G.Audio.sfx('hack'); fn(); var b = dev.o ? game.map.buildings[dev.o.bid] : dev.a ? dev.a.home : null; if (b && b.private) game.crime(p, b, 'hack'); }; };
    if (dev.kind === 'door') {
      opts.push({ label: '🔓 Отпереть дверь', fn: spend(function () { dev.d.locked = false; G.Audio.sfx('unlock'); game.toast('Дверь отперта'); }) });
    } else if (dev.kind === 'turret') {
      var t = dev.a;
      opts.push({ label: '⛔ Отключить турель', fn: spend(function () { t.disabled = true; t.hacked = true; game.toast('Турель отключена'); }) });
      opts.push({ label: '🔁 Перепрограммировать (за вас)', fn: spend(function () {
        t.hacked = true; t.rel = 2; t.fac = 'player'; t.target = null; t.setState('idle');
        game.ownersOf(t.home).forEach(function (o) { t.grudge[o.id] = true; });
        game.toast('Турель теперь стреляет по вашим врагам');
      }) });
    } else {
      var o = dev.o, b = game.map.buildings[o.bid];
      if (o.type === 'terminal') {
        if (o.missionData && !o.downloaded) opts.push({ label: '💾 Скачать данные (задание)', fn: spend(function () { o.downloaded = true; game.toast('Данные скачаны'); G.checkMissions(game); }) });
        if (b) {
          opts.push({ label: '🔓 Открыть все двери здания', fn: spend(function () { b.doors.forEach(function (d) { d.locked = false; }); b.objects.forEach(function (q) { if (q.type === 'safe') q.unlocked = true; }); game.toast('Двери и сейфы здания открыты'); }) });
          opts.push({ label: '🔕 Отключить сигнализацию и турели', fn: spend(function () { b.alarmOn = false; game.actors.forEach(function (a) { if (a.R.turret && a.home === b && !a.hacked) { a.disabled = true; a.hacked = true; } }); game.toast('Охранные системы отключены'); }) });
          opts.push({ label: '🔁 Турели — против хозяев', fn: spend(function () {
            var owners = game.ownersOf(b);
            game.actors.forEach(function (a) { if (a.R.turret && a.home === b) { a.hacked = true; a.disabled = false; a.rel = 2; a.fac = 'player'; owners.forEach(function (ow) { a.grudge[ow.id] = true; }); } });
            game.toast('Турели обращены против хозяев');
          }) });
        }
      } else if (o.type === 'safe') {
        opts.push({ label: '🔓 Взломать сейф', fn: spend(function () { openContainer(o, game); }) });
      } else if (o.type === 'atm') {
        opts.push({ label: '💳 Выпотрошить банкомат', fn: spend(function () { var n = game.rng.int(40, 90); p.money += n; game.toast('+' + n + '₽'); G.Audio.sfx('coin'); game.map.removeObj(o); game.map.addObj('atm', o.x, o.y).hp = 1; }) });
      } else if (o.type === 'alarm') {
        opts.push({ label: '🔕 Отключить сигнализацию', fn: spend(function () { if (b) b.alarmOn = false; game.toast('Сигнализация отключена'); }) });
      } else if (o.type === 'vending') {
        opts.push({ label: '🍔 Бесплатный обед', fn: spend(function () { game.dropItem(o.x + 0.5, o.y + 1.2, 'burger', 2, null); game.dropItem(o.x + 0.5, o.y + 1.2, 'energy', 1, null); }) });
      }
    }
    return opts;
  }

  function objectHasOptions(o, game) {
    if (o.dead) return false;
    var t = o.type;
    if (t === 'safe') return !o.opened;
    if (t === 'crate' || t === 'wardrobe') return !o.opened;
    return ['terminal', 'alarm', 'vent', 'trash', 'bush', 'vending', 'atm', 'elevator'].indexOf(t) >= 0 && !(t === 'vent' && !o.link);
  }

  function options(target, game) {
    var p = game.player, opts = [], m = game.map;
    if (target.kind === 'actor') {
      var a = target.a;
      if (a.R.turret) {
        if (!a.hacked && p.canHack()) hackOptions({ kind: 'turret', a: a }, game).forEach(function (o) { opts.push(o); });
        return opts;
      }
      if (a.prisonerLocked) {
        opts.push({ label: '⛓ Освободить', fn: function () {
          a.prisonerLocked = false; a.disabled = false; a.rel = 1; recruit(a, game); a.say('Спасибо! Выведи меня отсюда.');
        } });
        return opts;
      }
      if (a.recipient && p.count('package') > 0) {
        opts.push({ label: '📦 Отдать посылку', fn: function () {
          p.take('package', 1); a.say('Наконец-то! Держи.'); a.recipient = false; a.rel = 1;
          game.missions.forEach(function (mi) { if (mi.type === 'deliver' && mi.target === a) mi.delivered = true; });
          G.checkMissions(game);
        } });
      }
      if (a.shopkeeper && a.rel > -2) opts.push({ label: '🛒 Торговать', fn: function () { G.UI.openShop(a); }, keep: true });
      if (a.rel >= 2) {
        if (a.holdPos) opts.push({ label: '➡ За мной', fn: function () { a.holdPos = null; a.say('Иду.'); } });
        else opts.push({ label: '✋ Жди здесь', fn: function () { a.holdPos = { x: a.x, y: a.y }; a.say('Стою.'); } });
        opts.push({ label: '👋 Распустить', fn: function () { dismiss(a, game); a.say('Бывай.'); } });
        return opts;
      }
      opts.push({ label: '💬 Поговорить', fn: function () { talk(a, game); } });
      if (a.rel < 1) {
        var bc = bribeCost(a, game);
        opts.push({ label: '💰 Подкупить — ' + bc + '₽', fn: function () {
          if (!pay(game, bc)) return;
          a.rel = 1; if (a.state === 'warn' || a.state === 'investigate') a.setState('return');
          a.sayFrom('bribe'); game.float(a.x, a.y - 0.8, '♥', '#6f6', 16);
        } });
      }
      var hc = hireCost(a, game);
      if (hc && a.rel >= 0) opts.push({ label: '🤝 Нанять — ' + hc + '₽', fn: function () { if (game.followers.length >= 4) { game.toast('Отряд полон'); return; } if (!pay(game, hc)) return; recruit(a, game); } });
      if (!a.shopkeeper && (a.money > 0 || a.items.length)) {
        opts.push({ label: '🤏 Обчистить карманы', fn: function () { pickpocket(a, game); } });
      }
      return opts;
    }
    if (target.kind === 'door') {
      var d = target.d;
      if (p.count('lockpick') > 0) opts.push({ label: '🗝 Вскрыть отмычкой', fn: function () { p.useTool('lockpick'); d.locked = false; G.Audio.sfx('unlock'); game.toast('Замок вскрыт'); suspicious(game, m.buildings[d.bid]); } });
      if (p.canHack()) opts.push({ label: '💾 Взломать электрозамок', fn: hackOptions({ kind: 'door', d: d }, game)[0].fn });
      if (p.cls.id === 'brute') opts.push({ label: '💪 Выбить плечом', fn: function () { game.hitDoor(d, 999, p); } });
      if (!opts.length) opts.push({ label: 'Заперто. Нужна отмычка, взлом или сила (бейте дверь оружием)', fn: function () {} });
      return opts;
    }
    if (target.kind === 'window') {
      opts.push({ label: '🪟 Разбить окно', fn: function () { game.breakWindow(target.x, target.y, p); } });
      return opts;
    }
    var o = target.o, t = o.type, b = m.buildings[o.bid];
    if (t === 'elevator') {
      if (game.canLeave()) opts.push({ label: '🛗 Подняться на следующий этаж', fn: function () { G.UI.nextFloor(); } });
      else {
        var left = game.missions.filter(function (mi) { return !mi.done && !mi.failed; }).length;
        opts.push({ label: 'Лифт заблокирован: осталось заданий — ' + left, fn: function () {} });
      }
      return opts;
    }
    if (t === 'crate' || t === 'wardrobe') opts.push({ label: '🔍 Обыскать', fn: function () { openContainer(o, game); } });
    if (t === 'safe') {
      if (o.unlocked) opts.push({ label: '🔓 Открыть сейф', fn: function () { openContainer(o, game); } });
      if (p.count('lockpick') > 0) opts.push({ label: '🗝 Вскрыть отмычкой', fn: function () { p.useTool('lockpick'); G.Audio.sfx('unlock'); openContainer(o, game); } });
      if (p.canHack()) opts.push({ label: '💾 Взломать', fn: hackOptions({ kind: 'obj', o: o }, game)[0].fn });
      if (p.count('c4') > 0) opts.push({ label: '🧨 Заложить взрывчатку', fn: function () { p.take('c4', 1); game.placeC4(p); } });
      if (opts.length === 0) opts.push({ label: 'Нужна отмычка, хак-чип или взрывчатка', fn: function () {} });
    }
    if (t === 'terminal' || t === 'alarm' || t === 'atm') {
      if (p.canHack()) hackOptions({ kind: 'obj', o: o }, game).forEach(function (q) { opts.push(q); });
      else if (t === 'terminal' && o.missionData && !o.downloaded) opts.push({ label: '💾 Скачать данные (вручную)', fn: function () { o.downloaded = true; G.Audio.sfx('hack'); game.toast('Данные скачаны'); suspicious(game, b); G.checkMissions(game); } });
      else opts.push({ label: 'Нужен хак-чип', fn: function () {} });
      if (t === 'alarm' && b && b.alarmOn) opts.push({ label: '🔨 Сорвать (громко)', fn: function () { game.hitObject(o, 999, p); } });
    }
    if (t === 'vent' && o.link) opts.push({ label: '🕳 Пролезть в вентиляцию', fn: function () {
      p.x = o.link.x + 0.5; p.y = o.link.y + 0.5; G.Audio.sfx('door'); game.float(p.x, p.y - 0.6, '...', '#aaa');
      // выталкиваем на свободную клетку
      var dirs = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, -1]];
      for (var i = 0; i < dirs.length; i++) { var nx = o.link.x + dirs[i][0], ny = o.link.y + dirs[i][1]; if (m.passable(nx, ny, p) && !m.objAt[m.idx(nx, ny)]) { p.x = nx + 0.5; p.y = ny + 0.5; break; } }
    } });
    if (t === 'trash' || t === 'bush') opts.push({ label: '🙈 Спрятаться', fn: function () {
      p.hideFrom = { x: p.x, y: p.y }; p.hidden = true; p.x = o.x + 0.5; p.y = o.y + 0.5;
      if (t === 'bush') p.hideFrom = null;
      game.actors.forEach(function (a) { if (a.target === p && a.state === 'combat') { a.investigate = { x: p.x, y: p.y }; a.target = null; a.setState('investigate'); } });
      game.toast('Вы спрятались. Двиньтесь, чтобы выйти');
    } });
    if (t === 'vending') {
      [['burger', 20], ['energy', 30], ['beer', 12]].forEach(function (q) {
        opts.push({ label: G.ITEMS[q[0]].icon + ' ' + G.ITEMS[q[0]].name + ' — ' + q[1] + '₽', fn: function () { if (pay(game, q[1])) p.addItem(q[0], 1); }, keep: true });
      });
      if (p.canHack()) hackOptions({ kind: 'obj', o: o }, game).forEach(function (q) { opts.push(q); });
    }
    return opts;
  }

  function suspicious(game, b) { if (b && b.private) game.crime(game.player, b, 'break'); }

  function talk(a, game) {
    var p = game.player;
    if (a.rel <= -1) { a.say(a.home && game.map.bAt(p.x, p.y) === a.home ? 'Пошёл вон отсюда!' : 'Не о чем нам говорить.'); return; }
    var hints = [];
    game.missions.forEach(function (mi) { if (!mi.done && !mi.failed && mi.b) hints.push('Слыхал про ' + mi.b.def.name.toLowerCase() + '? Туда лучше не соваться.'); });
    if (game.map.buildings.some(function (b) { return b.type === 'shop'; })) hints.push('В лавке можно купить отмычки.');
    hints.push('Лифт наверх откроется, когда сделаешь все дела.');
    if (a.fac === 'rust') hints.push('Неоновые — крысы. Увидишь — бей.');
    if (a.fac === 'neon') hints.push('Ржавые совсем обнаглели.');
    if (a.fac === 'cop') hints.push('Будешь буянить — посажу.');
    a.say(Math.random() < 0.6 ? game.rng.pick(hints) : game.rng.pick(G.BARKS.idle), 3.2);
  }

  function pickpocket(a, game) {
    var p = game.player;
    var an = Math.atan2(p.y - a.y, p.x - a.x);
    var behind = Math.abs(G.angDiff(a.face, an)) > 1.6;
    var ch = p.cls.id === 'thief' ? (behind ? 0.95 : 0.65) : (behind ? 0.55 : 0.15);
    if (p.invis > 0) ch = 1;
    if (a.state === 'combat') ch *= 0.3;
    if (Math.random() < ch) {
      var got = [];
      if (a.money > 0) { p.money += a.money; got.push(a.money + '₽'); a.money = 0; }
      a.items.slice().forEach(function (it) { if (p.addItem(it.id, it.n)) { got.push((G.ITEMS[it.id] || G.WEAPONS[it.id]).name); a.items.splice(a.items.indexOf(it), 1); } });
      game.toast(got.length ? 'Украдено: ' + got.join(', ') : 'Карманы пусты');
      G.Audio.sfx('coin');
      G.checkMissions(game);
      // свидетели
      game.actors.forEach(function (o) { if (o !== a && o.alive && !o.isPlayer && (o.fac === 'cop' || o.fac === a.fac) && o.rel < 1 && G.dist(o.x, o.y, p.x, p.y) < 8 && o.canSee(p, game)) { o.sayFrom('stolen'); o.makeHostile(p, game); } });
    } else {
      a.sayFrom('stolen');
      a.makeHostile(p, game);
      game.alertNearby(a, p);
      game.crime(p, a.home, 'steal');
    }
  }

  return { options: options, objectHasOptions: objectHasOptions, hackOptions: hackOptions, nearestHackable: nearestHackable, recruit: recruit, dismiss: dismiss, openContainer: openContainer, pay: pay, bribeCost: bribeCost };
})();
