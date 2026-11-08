'use strict';
// Запуск, игровой цикл, переходы между этажами, сохранение.

G.main = (function () {
  var last = 0, hudT = 0, running = false;

  function startFloor(state, floor, seed) {
    G.UI.hide('title'); G.UI.hide('modal');
    G.UI.show('hud'); G.UI.show('controls');
    G.UI.paused = false;
    new G.Game(state, floor, seed);
    G.store.set('save', { state: state, floor: floor, seed: seed });
    G.Audio.start();
    var g = G.game;
    G.UI.toast('Этаж ' + floor + ' · ' + g.map.district.name);
    g.missions.forEach(function (mi) { G.UI.toast('• ' + mi.text); });
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function newRun(clsId) {
    var st = G.newPlayerState(clsId);
    startFloor(st, 1, (Math.random() * 1e9) | 0);
  }
  function continueRun() {
    var s = G.store.get('save', null);
    if (!s) return G.UI.titleScreen();
    startFloor(s.state, s.floor, s.seed);
  }
  function nextFloor() {
    var g = G.game, p = g.player;
    G.Audio.sfx('elevator');
    g.stats.floors++;
    var done = g.missions.filter(function (m) { return m.done; }).length;
    if (g.floor >= G.MAX_FLOOR) {
      G.store.set('best', G.MAX_FLOOR); G.store.set('won', G.store.get('won', 0) + 1); G.store.del('save');
      G.UI.gameOver(true); return;
    }
    var bonus = done === g.missions.length ? 25 + g.floor * 10 : 0;
    p.money += bonus;
    var hpGain = Math.round(p.maxHp * 0.2); p.hp = Math.min(p.maxHp, p.hp + hpGain);
    var state = p.snapshot(g.stats);
    var nf = g.floor + 1;
    G.store.set('best', Math.max(G.store.get('best', 0), nf));
    var summary = 'Заданий выполнено: ' + done + '/' + g.missions.length + (bonus ? ' · премия за чистую работу +' + bonus + '₽' : '') +
      '<br>Отдых в лифте: +' + hpGain + ' здоровья.' + (g.followers.length ? '<br>Наёмники остались на этаже.' : '') +
      '<br>Следующий: этаж ' + nf + ' — ' + G.DISTRICTS[Math.min(2, Math.floor((nf - 1) / 2))].name + '.';
    G.UI.floorDone(summary, function () {
      var go = function () { startFloor(p.snapshot(g.stats), nf, (Math.random() * 1e9) | 0); };
      if (p.pendingTraits > 0) G.UI.openTraitChoice(go); else go();
    });
    void state;
  }
  function toTitle() { G.Audio.stop(); G.game = null; G.UI.titleScreen(); }

  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    var g = G.game;
    if (!g) return;
    if (!G.UI.paused && !g.over) {
      g.update(dt);
      g.interact = g.findInteract();
      if (g.player.pendingTraits > 0 && !g.traitHinted) { g.traitHinted = true; G.UI.toast('⭐ Новая черта ждёт выбора — кнопка ⭐'); }
    }
    G.Render.draw(g, G.UI.paused ? 0 : dt);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; G.UI.updateHUD(); }
    if (g.over === 'dead' && !g.overShown) {
      g.overShown = true; G.store.del('save');
      setTimeout(function () { G.UI.gameOver(false); }, 1200);
    }
  }

  function boot() {
    G.Render.init(document.getElementById('game'));
    window.addEventListener('resize', function () { G.Render.resize(); });
    G.UI.setupControls();
    G.UI.setupKeyboard();
    if (G.store.get('lefty', false)) document.body.classList.add('lefty');
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { G.Audio.suspend(true); if (G.game && !G.UI.paused) G.UI.openModal('Пауза', function (b) { var x = document.createElement('button'); x.className = 'opt'; x.textContent = '▶ Продолжить'; x.onclick = function () { G.UI.closeModal(); }; b.appendChild(x); }); }
      else G.Audio.suspend(false);
    });
    document.addEventListener('touchstart', function () { G.Audio.init(); }, { once: true });
    G.UI.titleScreen();
    if (location.hash === '#dev') window.kv = G;
  }
  window.addEventListener('load', boot);

  return { newRun: newRun, continueRun: continueRun, nextFloor: nextFloor, toTitle: toTitle };
})();
