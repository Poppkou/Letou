'use strict';
// Интерфейс: экраны, HUD, сенсорные стики и кнопки, меню, магазин, сумка, клавиатура.

G.UI = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var paused = false, modal = null;
  var toastT = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function toast(msg) {
    var t = $('toast');
    var line = el('div', 'toastline', msg);
    t.appendChild(line);
    while (t.children.length > 3) t.removeChild(t.firstChild);
    setTimeout(function () { line.classList.add('fade'); setTimeout(function () { if (line.parentNode) line.parentNode.removeChild(line); }, 400); }, 2600);
    void toastT;
  }

  // ---------- Модальные окна ----------
  function openModal(title, bodyBuilder, opts) {
    opts = opts || {};
    paused = true;
    var m = $('modal');
    m.innerHTML = '';
    var box = el('div', 'mbox' + (opts.wide ? ' wide' : ''));
    var head = el('div', 'mhead');
    head.appendChild(el('div', 'mtitle', title));
    if (!opts.noClose) { var x = el('button', 'mclose', '✕'); x.onclick = function () { G.Audio.sfx('ui'); closeModal(); }; head.appendChild(x); }
    box.appendChild(head);
    var body = el('div', 'mbody');
    bodyBuilder(body);
    box.appendChild(body);
    m.appendChild(box);
    show('modal');
    modal = opts.name || 'modal';
  }
  function closeModal() { hide('modal'); paused = false; modal = null; G.input.fire = false; }

  function optionList(body, opts) {
    opts.forEach(function (o) {
      var b = el('button', 'opt', o.label);
      b.onclick = function () { G.Audio.sfx('ui'); if (!o.keep) closeModal(); o.fn(); if (o.keep && modal === 'interact') refreshInteract(); updateHUD(); };
      body.appendChild(b);
    });
  }

  var lastTarget = null;
  function openInteract(target) {
    var g = G.game;
    var opts = G.Interact.options(target, g);
    if (!opts.length) return;
    lastTarget = target;
    var title = target.kind === 'actor' ? (target.a.mtarget && target.a.name.indexOf('«') < 0 ? target.a.name : target.a.name + ' ' + target.a.npcName) :
      target.kind === 'obj' ? G.OBJDEF[target.o.type].name : target.kind === 'door' ? 'Запертая дверь' : 'Окно';
    openModal(title, function (body) {
      if (target.kind === 'actor') {
        var a = target.a, rel = ['враг', 'раздражён', 'нейтрален', 'друг', 'в отряде'][a.rel + 2];
        body.appendChild(el('div', 'msub', 'Отношение: <b>' + rel + '</b>' + (a.R.turret ? '' : ' · Здоровье ' + Math.ceil(a.hp) + '/' + a.maxHp)));
      }
      optionList(body, opts);
    }, { name: 'interact' });
  }
  function refreshInteract() { if (lastTarget) { closeModal(); openInteract(lastTarget); } }

  function openHack(dev, remote) {
    var g = G.game;
    var opts = G.Interact.hackOptions(dev, g);
    if (!opts.length) { toast('Взламывать нечего'); return; }
    var name = dev.kind === 'door' ? 'Электрозамок' : dev.kind === 'turret' ? 'Турель' : G.OBJDEF[dev.o.type].name;
    openModal('💻 ' + name + (remote ? ' (удалённо)' : ''), function (body) { optionList(body, opts); });
  }

  function openShop(keeper) {
    var g = G.game, p = g.player;
    var type = keeper.shopkeeper;
    if (!keeper.stock) {
      var pool = G.SHOP_STOCK[type].slice();
      var r = G.RNG(keeper.id * 31 + g.seed);
      r.shuffle(pool);
      keeper.stock = type === 'bar' ? pool.slice(0, 5) : pool.slice(0, 7 + Math.min(4, g.floor));
      if (type === 'shop' && keeper.stock.indexOf('lockpick') < 0) keeper.stock.push('lockpick');
      if (type === 'shop' && keeper.stock.indexOf('medkit') < 0) keeper.stock.push('medkit');
    }
    var price = function (id) {
      var base = (G.ITEMS[id] || G.WEAPONS[id]).price;
      var k = 1 + (g.floor - 1) * 0.06;
      if (p.traits.haggler) k *= 0.75;
      if (keeper.rel >= 1) k *= 0.9;
      return Math.round(base * k);
    };
    openModal('🛒 ' + (type === 'bar' ? 'Бар' : 'Лавка') + ' · у вас ' + p.money + '₽', function (body) {
      var grid = el('div', 'shopgrid');
      keeper.stock.forEach(function (id) {
        var d = G.ITEMS[id] || G.WEAPONS[id];
        var c = el('button', 'shopitem');
        var desc = d.desc || weaponDesc(d);
        c.innerHTML = '<span class="si-icon">' + G.Sprites.iconHTML(id, d.icon, 3) + '</span><span class="si-name">' + d.name + '</span><span class="si-desc">' + desc + '</span><span class="si-price">' + price(id) + '₽</span>';
        c.onclick = function () {
          if (!G.Interact.pay(g, price(id))) return;
          if (!p.addItem(id, 1)) { p.money += price(id); return; }
          toast('Куплено: ' + d.name);
          closeModal(); openShop(keeper);
        };
        grid.appendChild(c);
      });
      body.appendChild(grid);
    }, { wide: true });
  }
  function weaponDesc(w) {
    if (w.kind === 'melee') return 'Ближний бой · урон ' + w.dmg;
    if (w.kind === 'gun') return 'Урон ' + w.dmg + (w.pellets ? '×' + w.pellets : '') + ' · патр. ' + w.ammo;
    return 'Метательное';
  }

  function openBag() {
    var g = G.game, p = g.player;
    openModal('🎒 Сумка (' + p.inv.length + '/' + G.MAX_SLOTS + ')', function (body) {
      var stats = el('div', 'msub', 'Здоровье ' + Math.ceil(p.hp) + '/' + p.maxHp + ' · Броня ' + Math.ceil(p.armor) + ' · ' + p.money + '₽ · Уровень ' + p.level);
      body.appendChild(stats);
      var tr = Object.keys(p.traits);
      if (tr.length) body.appendChild(el('div', 'msub', 'Черты: ' + tr.map(function (id) { return G.TRAITS.filter(function (t) { return t.id === id; })[0].name; }).join(', ')));
      var grid = el('div', 'shopgrid');
      var all = [{ id: 'fist', n: 1, fist: true }].concat(p.inv);
      all.forEach(function (slot) {
        var d = G.ITEMS[slot.id] || G.WEAPONS[slot.id];
        var c = el('div', 'shopitem' + (p.weapon === slot || (slot.fist && p.weapon.id === 'fist') ? ' equipped' : ''));
        var cnt = slot.ammo !== undefined ? slot.ammo + ' патр.' : slot.dur !== undefined ? 'прочн. ' + slot.dur : slot.n > 1 ? '×' + slot.n : '';
        c.innerHTML = '<span class="si-icon">' + G.Sprites.iconHTML(slot.id, d.icon, 3) + '</span><span class="si-name">' + d.name + '</span><span class="si-desc">' + (d.desc || weaponDesc(d)) + '</span><span class="si-price">' + cnt + '</span>';
        var row = el('div', 'si-btns');
        if (G.WEAPONS[slot.id]) {
          var eb = el('button', 'sbtn', 'Взять'); eb.onclick = function () { p.equip(slot.fist ? null : slot); closeModal(); updateHUD(); }; row.appendChild(eb);
        } else if (!(G.ITEMS[slot.id] || {}).quest) {
          var ub = el('button', 'sbtn', 'Применить'); ub.onclick = function () { p.useItem(slot, g); closeModal(); updateHUD(); }; row.appendChild(ub);
        }
        if (!slot.fist && !(G.ITEMS[slot.id] || {}).quest) {
          var db = el('button', 'sbtn dim', 'Выбросить'); db.onclick = function () {
            p.removeItem(slot); g.dropItem(p.x, p.y + 0.8, slot.id, slot.n, null, slot.ammo); closeModal(); openBag();
          }; row.appendChild(db);
        }
        c.appendChild(row);
        grid.appendChild(c);
      });
      body.appendChild(grid);
    }, { wide: true });
  }

  function openMissions() {
    var g = G.game;
    openModal('📋 Задания · этаж ' + g.floor + ' · ' + g.map.district.name, function (body) {
      g.missions.forEach(function (mi) {
        body.appendChild(el('div', 'mission' + (mi.done ? ' done' : mi.failed ? ' failed' : ''), (mi.done ? '✔ ' : mi.failed ? '✖ ' : '• ') + mi.text + ' <span class="rw">' + mi.reward + '₽</span>'));
      });
      body.appendChild(el('div', 'msub', g.canLeave() ? 'Все задания закрыты — идите к лифту (зелёная стрелка).' : 'Жёлтые стрелки по краям экрана указывают на цели.'));
      var mc = document.createElement('canvas');
      mc.className = 'bigmap';
      mc.width = Math.min(900, window.innerWidth * 1.6); mc.height = Math.min(600, window.innerHeight * 1.1);
      body.appendChild(mc);
      G.Render.drawMinimap(g, mc, true);
    }, { wide: true });
  }

  function openTraitChoice(after) {
    var g = G.game, p = g.player;
    var r = G.RNG(Date.now() & 0xffff);
    var pool = G.TRAITS.filter(function (t) { return !p.traits[t.id]; });
    r.shuffle(pool);
    openModal('⭐ Уровень ' + p.level + ': выберите черту', function (body) {
      pool.slice(0, 3).forEach(function (t) {
        var b = el('button', 'opt trait', '<b>' + t.name + '</b><br><small>' + t.desc + '</small>');
        b.onclick = function () {
          p.traits[t.id] = true; p.pendingTraits--;
          if (t.id === 'tough') { p.maxHp += 25; p.hp += 25; }
          G.Audio.sfx('levelup'); closeModal();
          if (p.pendingTraits > 0) openTraitChoice(after); else if (after) after();
        };
        body.appendChild(b);
      });
    }, { noClose: true });
  }

  function openPause() {
    openModal('Пауза', function (body) {
      optionList(body, [
        { label: '▶ Продолжить', fn: function () {} },
        { label: '📋 Задания и карта', fn: function () { openMissions(); } },
        { label: '❓ Как играть', fn: function () { openHelp(true); } },
        { label: '🔊 Звук', fn: function () { openSettings(true); } },
        { label: '🏠 В главное меню', fn: function () { G.main.toTitle(); } }
      ]);
    });
  }

  function openSettings(inGame) {
    openModal('Звук', function (body) {
      [['sfx', 'Эффекты'], ['music', 'Музыка']].forEach(function (k) {
        var row = el('label', 'slider', k[1] + ' ');
        var s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 1; s.step = 0.05; s.value = G.Audio.settings[k[0]];
        s.oninput = function () { G.Audio.setVolume(k[0], parseFloat(s.value)); };
        row.appendChild(s); body.appendChild(row);
      });
      var lh = el('label', 'slider', 'Левша (стики наоборот) ');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!G.store.get('lefty', false);
      cb.onchange = function () { G.store.set('lefty', cb.checked); document.body.classList.toggle('lefty', cb.checked); };
      lh.appendChild(cb); body.appendChild(lh);
      if (inGame) optionList(body, [{ label: 'Готово', fn: function () {} }]);
    });
  }

  function openHelp(inGame) {
    openModal('Как играть', function (body) {
      body.appendChild(el('div', 'help', G.HELP_HTML));
      if (inGame) optionList(body, [{ label: 'Понятно', fn: function () {} }]);
    }, { wide: true });
  }

  // ---------- Экраны ----------
  function titleScreen() {
    paused = true;
    hide('hud'); hide('controls'); hide('modal');
    var t = $('title'); t.innerHTML = '';
    t.appendChild(el('div', 'logo', 'КВАРТАЛЫ'));
    t.appendChild(el('div', 'tagline', 'roguelike-песочница · 6 этажей · свобода решений'));
    var save = G.store.get('save', null);
    var best = G.store.get('best', 0);
    var col = el('div', 'tbtns');
    if (save) { var c = el('button', 'big', '▶ Продолжить (этаж ' + save.floor + ')'); c.onclick = function () { G.Audio.init(); G.main.continueRun(); }; col.appendChild(c); }
    var n = el('button', 'big', '✚ Новая игра'); n.onclick = function () { G.Audio.init(); G.Audio.sfx('ui'); classScreen(); }; col.appendChild(n);
    var h = el('button', '', '❓ Как играть'); h.onclick = function () { G.Audio.init(); openHelp(); }; col.appendChild(h);
    var s = el('button', '', '🔊 Настройки'); s.onclick = function () { G.Audio.init(); openSettings(); }; col.appendChild(s);
    t.appendChild(col);
    if (best) t.appendChild(el('div', 'tagline small', 'Рекорд: этаж ' + best + (G.store.get('won', 0) ? ' · Город освобождён ' + G.store.get('won', 0) + ' раз' : '')));
    show('title');
  }
  function classScreen() {
    var t = $('title'); t.innerHTML = '';
    t.appendChild(el('div', 'logo small', 'Кто вы?'));
    var grid = el('div', 'classgrid');
    G.CLASSES.forEach(function (c) {
      var card = el('button', 'classcard');
      var cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
      G.Render.portrait(cv, c);
      card.appendChild(cv);
      card.appendChild(el('div', 'cname', c.name));
      card.appendChild(el('div', 'cdesc', c.desc));
      card.appendChild(el('div', 'cab', '✦ ' + c.abilityName + ': ' + c.abilityDesc));
      card.appendChild(el('div', 'cstat', '❤ ' + c.hp + ' · 💰 ' + c.money + ' · ' + c.start.map(function (s) { var d = G.ITEMS[s[0]] || G.WEAPONS[s[0]]; return G.Sprites.iconHTML(s[0], d.icon, 2); }).join(' ')));
      card.onclick = function () { G.Audio.sfx('ui'); G.main.newRun(c.id); };
      grid.appendChild(card);
    });
    t.appendChild(grid);
    var back = el('button', '', '← Назад'); back.onclick = titleScreen; t.appendChild(back);
  }
  function drawPortrait(cv, c) {
    var x = cv.getContext('2d');
    x.fillStyle = '#1d1d24'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = c.color; x.fillRect(18, 30, 28, 24);
    x.fillStyle = '#f1c9a5'; x.beginPath(); x.arc(32, 22, 11, 0, 7); x.fill();
    x.fillStyle = '#111'; x.fillRect(27, 21, 3, 3); x.fillRect(34, 21, 3, 3);
    var hats = { band: function () { x.fillStyle = '#d22'; x.fillRect(21, 15, 22, 4); }, hood: function () { x.fillStyle = '#1a8a5a'; x.beginPath(); x.arc(32, 21, 13, Math.PI, 0); x.fill(); },
      cap: function () { x.fillStyle = '#334'; x.fillRect(21, 10, 22, 6); x.fillRect(32, 14, 14, 3); }, beret: function () { x.fillStyle = '#6a1a1a'; x.beginPath(); x.ellipse(30, 12, 12, 5, -0.2, 0, 7); x.fill(); },
      top: function () { x.fillStyle = '#111'; x.fillRect(24, -2, 16, 14); x.fillRect(19, 11, 26, 3); }, goggles: function () { x.fillStyle = '#333'; x.fillRect(21, 17, 22, 3); x.fillStyle = '#7cf'; x.fillRect(24, 15, 6, 6); x.fillRect(34, 15, 6, 6); } };
    if (hats[c.hat]) hats[c.hat]();
  }

  function floorDone(summary, next) {
    paused = true;
    openModal('🛗 Этаж пройден', function (body) {
      body.appendChild(el('div', 'msub', summary));
      optionList(body, [{ label: 'Дальше ▶', fn: next }]);
    }, { noClose: true });
  }
  function gameOver(won) {
    var g = G.game;
    hide('controls');
    openModal(won ? '👑 Город свободен!' : '💀 Вы погибли', function (body) {
      body.appendChild(el('div', 'msub', won ? 'Хозяин Города свергнут. Кварталы вздохнули свободнее.' : 'Этаж ' + g.floor + ' · ' + g.map.district.name));
      body.appendChild(el('div', 'msub', 'Повержено: ' + g.stats.kills + ' · Уровень: ' + g.player.level + ' · Денег: ' + g.player.money + '₽'));
      optionList(body, [
        { label: '✚ Новая игра', fn: function () { classScreen(); show('title'); } },
        { label: '🏠 Главное меню', fn: function () { titleScreen(); } }
      ]);
    }, { noClose: true });
  }

  // ---------- HUD ----------
  function updateHUD() {
    var g = G.game; if (!g) return;
    var p = g.player;
    $('hpbar').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('hptext').textContent = Math.ceil(Math.max(0, p.hp)) + '/' + p.maxHp + (p.armor > 0 ? ' 🛡' + Math.ceil(p.armor) : '');
    $('xpbar').style.width = (p.xp / p.xpNext() * 100) + '%';
    $('money').textContent = p.money + '₽';
    var mins = (22 * 60 + Math.floor(g.time / 2)) % 1440;
    $('floorlbl').textContent = 'ЭТАЖ ' + g.floor + ' · УР ' + p.level;
    $('clock').textContent = '☾ ' + (mins / 60 | 0) + ':' + ('0' + mins % 60).slice(-2);
    $('distname').textContent = g.map.district.name;
    var w = p.wdef();
    $('wpn').innerHTML = '<span class="wi">' + G.Sprites.iconHTML(p.weapon.id, w.icon, 3) + '</span><span class="wn">' + w.name + '</span><span class="wa">' + (p.weapon.ammo !== undefined ? p.weapon.ammo : p.weapon.n > 1 && w.kind === 'throw' ? '×' + p.weapon.n : p.weapon.dur !== undefined ? '⚒' + p.weapon.dur : '') + '</span>';
    var ab = $('btnAbility');
    var cdMax = { ram: 6, hack: 1, cloak: 18, focus: 20, persuade: 8, bomb: 8 }[p.cls.ability];
    ab.style.setProperty('--cd', (p.abilityCd / cdMax * 100) + '%');
    ab.querySelector('.lbl').textContent = p.cls.abilityName;
    var ml = $('missionlist'); var html = '';
    g.missions.forEach(function (mi) { html += '<div class="' + (mi.done ? 'done' : mi.failed ? 'failed' : '') + '">' + (mi.done ? '✔ ' : mi.failed ? '✖ ' : '• ') + mi.text + '</div>'; });
    if (g.canLeave()) html += '<div class="go">🛗 Лифт открыт</div>';
    if (ml.innerHTML !== html) ml.innerHTML = html;
    var it = g.interact, act = $('btnAction');
    var label = '…';
    if (it) label = it.kind === 'actor' ? (it.a.shopkeeper ? 'Торговать' : it.a.prisonerLocked ? 'Освободить' : 'Говорить') : it.kind === 'obj' ? G.OBJDEF[it.o.type].name : it.kind === 'door' ? 'Замок' : 'Окно';
    act.querySelector('.lbl').textContent = label;
    act.classList.toggle('dim', !it);
    $('pt').textContent = p.pendingTraits > 0 ? '⭐' : '';
    $('btnTrait').classList.toggle('hidden', !(p.pendingTraits > 0));
    // мини-карта раз в 0.5 с
    var now = performance.now();
    if (!updateHUD.mt || now - updateHUD.mt > 500) { updateHUD.mt = now; G.Render.drawMinimap(g, $('minimap'), false); }
    var dangerEl = $('danger'); dangerEl.textContent = g.danger ? '⚠ ' + g.danger : '';
  }

  // ---------- Сенсорное управление ----------
  function setupControls() {
    var sticks = {};
    function makeStick(zoneId, baseId, knobId, onMove, onEnd, onTap) {
      var zone = $(zoneId), base = $(baseId), knob = $(knobId);
      var st = { id: null, ox: 0, oy: 0, t0: 0, moved: false };
      var R = function () { return base.offsetWidth * 0.45; };
      zone.addEventListener('touchstart', function (e) {
        if (st.id !== null) return;
        var t = e.changedTouches[0]; st.id = t.identifier; st.t0 = performance.now(); st.moved = false;
        st.ox = t.clientX; st.oy = t.clientY;
        base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px'; base.classList.add('active');
        knob.style.transform = 'translate(-50%,-50%)';
        e.preventDefault();
      }, { passive: false });
      zone.addEventListener('touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i]; if (t.identifier !== st.id) continue;
          var dx = t.clientX - st.ox, dy = t.clientY - st.oy, r = R();
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 8) st.moved = true;
          if (d > r) { dx = dx / d * r; dy = dy / d * r; }
          knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
          onMove(dx / r, dy / r);
        }
        e.preventDefault();
      }, { passive: false });
      var end = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier !== st.id) continue;
          st.id = null; base.classList.remove('active');
          knob.style.transform = 'translate(-50%,-50%)';
          if (!st.moved && performance.now() - st.t0 < 250 && onTap) onTap();
          onEnd();
        }
      };
      zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
      return st;
    }
    sticks.move = makeStick('zoneL', 'stickL', 'knobL', function (x, y) { G.input.mx = x; G.input.my = y; }, function () { G.input.mx = 0; G.input.my = 0; });
    sticks.aim = makeStick('zoneR', 'stickR', 'knobR', function (x, y) {
      G.input.ax = x; G.input.ay = y; G.input.aimMag = Math.sqrt(x * x + y * y); G.input.aiming = true;
    }, function () {
      var g = G.game;
      if (g && G.input.aimMag > 0.3) g.player.releaseThrow(g);
      G.input.aiming = false; G.input.aimMag = 0;
    }, function () { // короткий тап — атака
      G.input.fire = true; setTimeout(function () { G.input.fire = false; }, 60);
    });
    var hold = function (id, down, up) {
      var b = $(id);
      b.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
      b.addEventListener('touchend', function (e) { e.preventDefault(); if (up) up(); }, { passive: false });
      b.addEventListener('mousedown', function (e) { e.preventDefault(); down(); });
      b.addEventListener('mouseup', function () { if (up) up(); });
    };
    hold('btnAttack', function () { G.input.fire = true; }, function () { G.input.fire = false; });
    hold('btnAction', function () { doAction(); });
    hold('btnAbility', function () { var g = G.game; if (g && !paused) { g.player.ability(g); } });
    hold('btnBag', function () { if (!paused) openBag(); });
    hold('wpn', function () { var g = G.game; if (g && !paused) { g.player.cycleWeapon(1); updateHUD(); } });
    hold('btnPause', function () { if (!paused) openPause(); });
    hold('missionbox', function () { if (!paused) openMissions(); });
    hold('minimapwrap', function () { if (!paused) openMissions(); });
    hold('btnTrait', function () { if (!paused) openTraitChoice(); });
  }
  function doAction() {
    var g = G.game; if (!g || paused) return;
    var p = g.player;
    if (p.hidden) { p.unhide(g); return; }
    if (g.interact) openInteract(g.interact);
    else if (G.WEAPONS[p.weapon.id].kind === 'throw') g.fire(p, p.face);
  }

  // ---------- Клавиатура и мышь (для ПК) ----------
  function setupKeyboard() {
    var keys = {};
    var upd = function () {
      G.input.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      G.input.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      var l = Math.sqrt(G.input.mx * G.input.mx + G.input.my * G.input.my); if (l > 1) { G.input.mx /= l; G.input.my /= l; }
    };
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true; upd();
      var g = G.game; if (!g) return;
      if (e.code === 'Escape') { if (paused && modal) closeModal(); else if (!paused) openPause(); }
      if (paused) return;
      if (e.code === 'KeyE' || e.code === 'Space') doAction();
      if (e.code === 'KeyQ') g.player.ability(g);
      if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); openBag(); }
      if (e.code === 'KeyM') openMissions();
      if (e.code === 'KeyR') { g.player.cycleWeapon(1); updateHUD(); }
      if (e.code === 'KeyT' && g.player.pendingTraits > 0) openTraitChoice();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; upd(); });
    var cv = $('game');
    cv.addEventListener('mousemove', function (e) {
      var g = G.game; if (!g) return;
      var w = G.Render.worldFromScreen(e.clientX, e.clientY);
      var dx = w.x - g.player.x, dy = w.y - g.player.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      G.input.ax = dx / d; G.input.ay = dy / d;
      var wd = g.player.wdef();
      G.input.aimMag = wd.kind === 'throw' ? G.clamp(d / wd.range, 0.25, 1) : (G.input.mouseDown ? 1 : 0.5);
      G.input.aiming = true;
    });
    cv.addEventListener('mousedown', function () { G.input.mouseDown = true; G.input.aimMag = 1; });
    cv.addEventListener('mouseup', function () {
      G.input.mouseDown = false; G.input.aimMag = 0.5;
      var g = G.game; if (g && !paused) g.player.releaseThrow(g);
    });
  }

  return {
    toast: toast, openModal: openModal, closeModal: closeModal, openInteract: openInteract, openHack: openHack, openShop: openShop, openBag: openBag,
    openMissions: openMissions, openTraitChoice: openTraitChoice, titleScreen: titleScreen, classScreen: classScreen, floorDone: floorDone, gameOver: gameOver,
    updateHUD: updateHUD, setupControls: setupControls, setupKeyboard: setupKeyboard, show: show, hide: hide,
    nextFloor: function () { G.main.nextFloor(); },
    get paused() { return paused; }, set paused(v) { paused = v; }
  };
})();

G.HELP_HTML = [
  '<h3>Цель</h3><p>Подняться через 6 этажей города (Трущобы → Промзона → Верхний город) и свергнуть Хозяина Города. На каждом этаже есть задания; лифт откроется, когда все они выполнены (или провалены).</p>',
  '<h3>Управление (телефон, держите горизонтально)</h3><ul>',
  '<li><b>Левая половина экрана</b> — стик движения (появляется там, где коснулись).</li>',
  '<li><b>Правая половина экрана</b> — стик прицела: отклоните сильнее — стрельба/удар. Есть мягкий автоприцел. Короткий тап — удар по ближайшему врагу.</li>',
  '<li><b>Метательное</b> (граната, коктейль, дым): отклоните стик — сила броска зависит от отклонения, отпустите — бросок.</li>',
  '<li><b>✋ Действие</b> — говорить, торговать, подкупать, нанимать, обыскивать, взламывать, прятаться, лезть в вентиляцию, вызвать лифт.</li>',
  '<li><b>⚔</b> — удар/выстрел в ближайшего врага. <b>✦</b> — способность класса. <b>🎒</b> — сумка. Плашка оружия — сменить оружие.</li>',
  '<li>Тап по списку заданий или мини-карте — большая карта.</li></ul>',
  '<h3>ПК</h3><p>WASD — ходьба, мышь — прицел/стрельба, E/Пробел — действие, Q — способность, R — сменить оружие, Tab — сумка, M — карта, Esc — пауза.</p>',
  '<h3>Как устроен город</h3><ul>',
  '<li><b>Отношения.</b> Значки над головами: ♥ друг, ★ в отряде, ? раздражён/насторожен, ! враг. Подкуп делает другом, найм — бойцом отряда (до 4).</li>',
  '<li><b>Частная территория.</b> Войдёте в чужой дом, логово или склад — хозяева потребуют уйти, а потом нападут. Друзья не против.</li>',
  '<li><b>Преступления.</b> Разбить окно, украсть, взломать, ударить — если это видят хозяева или полиция, они станут врагами. Невидимым и спрятавшимся всё сходит с рук.</li>',
  '<li><b>Шум.</b> Выстрелы, взрывы и битое стекло слышно далеко — NPC придут проверить.</li>',
  '<li><b>Сигнализация.</b> Если охрана заметит врага, включится тревога: поднимутся все в здании, придёт полиция. Взломайте терминал, чтобы её отключить.</li>',
  '<li><b>Банды.</b> Ржавые и Неоновые воюют между собой. Бейте одних — другие станут дружелюбнее.</li>',
  '<li><b>Пути внутрь:</b> дверь, отмычка, взлом, выбитая дверь, разбитое окно, вентиляция с улицы, взрывчатка сквозь стену.</li></ul>'
].join('');
