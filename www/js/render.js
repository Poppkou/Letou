'use strict';
// Отрисовка: процедурный пиксель-арт без внешних картинок.

G.Render = (function () {
  var cv, ctx, W, H, DPR, TS = 32, cam = { x: 0, y: 0 };
  var FLOORS = {
    wood: ['#6e4c2e', '#5f4026'], wood2: ['#5a3a3a', '#4c3030'], tile: ['#9aa39a', '#88918a'],
    tile2: ['#c9d3dc', '#b5c0ca'], concrete: ['#5b5b5e', '#545457'], marble: ['#d6cfc2', '#c7bfb0']
  };
  var SKIN = ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3a', '#f5d7bd'];

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = Math.floor(window.innerWidth * DPR);
    H = cv.height = Math.floor(window.innerHeight * DPR);
    cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
    var tilesTall = window.innerHeight > window.innerWidth ? 15 : 12;
    TS = Math.max(24, Math.round(H / tilesTall));
  }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function sx(x) { return Math.round((x - cam.x) * TS + W / 2); }
  function sy(y) { return Math.round((y - cam.y) * TS + H / 2); }
  function worldFromScreen(px, py) { return { x: (px * DPR - W / 2) / TS + cam.x, y: (py * DPR - H / 2) / TS + cam.y }; }

  function draw(game, dt) {
    var p = game.player, m = game.map;
    cam.x += (p.x - cam.x) * Math.min(1, dt * 8);
    cam.y += (p.y - cam.y) * Math.min(1, dt * 8);
    if (Math.abs(p.x - cam.x) > 8 || Math.abs(p.y - cam.y) > 8) { cam.x = p.x; cam.y = p.y; }
    var shx = 0, shy = 0;
    if (game.shake > 0) { shx = (Math.random() - 0.5) * game.shake * 12 * DPR; shy = (Math.random() - 0.5) * game.shake * 12 * DPR; }
    ctx.setTransform(1, 0, 0, 1, shx, shy);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#121216'; ctx.fillRect(-20, -20, W + 40, H + 40);

    var x0 = Math.floor(cam.x - W / 2 / TS) - 1, x1 = Math.ceil(cam.x + W / 2 / TS) + 1;
    var y0 = Math.floor(cam.y - H / 2 / TS) - 1, y1 = Math.ceil(cam.y + H / 2 / TS) + 2;
    var x, y, dist = m.district;
    // пол
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      if (!m.inb(x, y)) continue;
      var v = m.t[y * m.w + x], px = sx(x), py = sy(y), h = hash(x, y);
      if (v === G.T.WALL || v === G.T.BORDER || v === G.T.WINDOW) continue;
      if (v === G.T.STREET) {
        ctx.fillStyle = dist.street; ctx.fillRect(px, py, TS + 1, TS + 1);
        if (h < 0.08) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + TS * 0.2, py + TS * 0.3, TS * 0.4, TS * 0.25); }
        if ((x % 6 === 0) && m.get(x, y - 1) === G.T.STREET && m.get(x, y + 1) === G.T.STREET && m.get(x - 1, y) === G.T.STREET) { ctx.fillStyle = 'rgba(230,210,120,0.25)'; ctx.fillRect(px + TS * 0.1, py + TS * 0.46, TS * 0.8, TS * 0.08); }
      } else if (v === G.T.SIDE) {
        ctx.fillStyle = dist.side; ctx.fillRect(px, py, TS + 1, TS + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py, TS, Math.max(1, TS * 0.05)); ctx.fillRect(px, py, Math.max(1, TS * 0.05), TS);
      } else if (v === G.T.GRASS) {
        ctx.fillStyle = dist.grass; ctx.fillRect(px, py, TS + 1, TS + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (var g = 0; g < 3; g++) { var hh = hash(x * 3 + g, y * 7 - g); ctx.fillRect(px + hh * TS * 0.9, py + hash(y + g, x) * TS * 0.9, TS * 0.08, TS * 0.16); }
      } else if (v === G.T.FLOOR || v === G.T.DOOR || v === G.T.WINBROKEN) {
        var b = m.buildings[m.bid[y * m.w + x]];
        var fl = FLOORS[b ? b.def.floor : 'concrete'] || FLOORS.concrete;
        ctx.fillStyle = (b && (b.def.floor === 'tile' || b.def.floor === 'tile2' || b.def.floor === 'marble')) ? fl[(x + y) & 1] : fl[0];
        ctx.fillRect(px, py, TS + 1, TS + 1);
        if (b && (b.def.floor === 'wood' || b.def.floor === 'wood2')) { ctx.fillStyle = fl[1]; for (var s = 0; s < 3; s++) ctx.fillRect(px, py + Math.round(TS * (s / 3)), TS, Math.max(1, TS * 0.04)); }
        if (b && b.def.floor === 'concrete' && h < 0.2) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px + h * TS * 3, py + TS * 0.5, TS * 0.3, TS * 0.05); }
        if (v === G.T.WINBROKEN) { ctx.fillStyle = '#aee0ff'; for (var k = 0; k < 4; k++) ctx.fillRect(px + hash(x + k, y) * TS, py + hash(y + k, x) * TS, TS * 0.1, TS * 0.1); }
      } else if (v === G.T.RUBBLE) {
        ctx.fillStyle = '#4c4a48'; ctx.fillRect(px, py, TS + 1, TS + 1);
        ctx.fillStyle = '#6a6662'; for (k = 0; k < 4; k++) ctx.fillRect(px + hash(x + k * 2, y) * TS * 0.8, py + hash(y * 3 + k, x) * TS * 0.8, TS * 0.18, TS * 0.14);
      } else if (v === G.T.ELEV) {
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(px, py, TS + 1, TS + 1);
        ctx.fillStyle = game.canLeave() ? '#3fd16a' : '#e0b020';
        for (k = 0; k < 4; k++) { ctx.save(); ctx.beginPath(); ctx.rect(px, py, TS, TS); ctx.clip(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillRect(-TS + k * TS * 0.5, -TS, TS * 0.18, TS * 3); ctx.restore(); }
      }
    }
    // следы
    m.decals.forEach(function (d) {
      if (d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) return;
      ctx.fillStyle = d.type === 'blood' ? 'rgba(110,10,10,0.55)' : 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(sx(d.x), sy(d.y), d.r * TS, d.r * TS * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    });
    // стены (псевдо-3/4: верх + лицевая грань)
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      v = m.get(x, y);
      if (v !== G.T.WALL && v !== G.T.BORDER && v !== G.T.WINDOW && v !== G.T.DOOR) continue;
      px = sx(x); py = sy(y);
      if (v === G.T.DOOR) { drawDoor(m, x, y, px, py); continue; }
      var below = m.get(x, y + 1), front = !(below === G.T.WALL || below === G.T.BORDER || below === G.T.WINDOW || below === G.T.DOOR);
      ctx.fillStyle = v === G.T.BORDER ? '#1b1b20' : '#2e2d36';
      ctx.fillRect(px, py - TS * 0.35, TS + 1, TS + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, py - TS * 0.35, TS, Math.max(1, TS * 0.06));
      if (front) {
        var bb = m.buildings[m.bid[y * m.w + x]];
        ctx.fillStyle = bb ? wallColor(bb.type) : '#444';
        ctx.fillRect(px, py + TS * 0.25, TS + 1, TS * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (var bx = 0; bx < 3; bx++) ctx.fillRect(px + ((bx + (y & 1) * 0.5) * TS / 3), py + TS * 0.25, 1, TS * 0.42);
        ctx.fillRect(px, py + TS * 0.45, TS, 1);
      }
      if (v === G.T.WINDOW) {
        ctx.fillStyle = '#9fd8ff'; ctx.globalAlpha = 0.8;
        var vertical = m.isWallish(m.get(x, y - 1)) && m.isWallish(m.get(x, y + 1));
        if (vertical) ctx.fillRect(px + TS * 0.38, py - TS * 0.3, TS * 0.24, TS * 0.95);
        else ctx.fillRect(px + 2, py - TS * 0.1, TS - 4, TS * 0.3);
        ctx.globalAlpha = 1;
      }
    }
    // объекты
    m.objects.forEach(function (o) {
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) return;
      drawObj(o, sx(o.x), sy(o.y), game);
    });
    // подбираемое
    game.pickups.forEach(function (pk) {
      var bob = Math.sin(game.time * 4 + pk.bob) * TS * 0.05;
      var X = sx(pk.x), Y = sy(pk.y) + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(X, sy(pk.y) + TS * 0.18, TS * 0.18, TS * 0.07, 0, 0, 7); ctx.fill();
      if (pk.money) { ctx.fillStyle = '#e8c23a'; ctx.beginPath(); ctx.arc(X, Y, TS * 0.13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff2a0'; ctx.fillRect(X - TS * 0.04, Y - TS * 0.08, TS * 0.05, TS * 0.12); }
      else { emoji((G.ITEMS[pk.id] || G.WEAPONS[pk.id]).icon, X, Y, TS * 0.42); }
    });
    // огонь
    game.fires.forEach(function (f) {
      ctx.fillStyle = 'rgba(255,120,30,' + (0.18 + Math.random() * 0.1) + ')';
      ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), f.r * TS, 0, 7); ctx.fill();
    });
    // существа по глубине
    var list = game.actors.filter(function (a) { return a.x > x0 - 1 && a.x < x1 + 1 && a.y > y0 - 1 && a.y < y1 + 1; });
    list.sort(function (a, b) { return (a.alive ? 1 : 0) - (b.alive ? 1 : 0) || a.y - b.y; });
    list.forEach(function (a) { drawActor(a, game); });
    // снаряды
    game.projectiles.forEach(function (b) {
      ctx.strokeStyle = b.color; ctx.lineWidth = Math.max(2, TS * 0.07);
      if (b.w.fire) { ctx.fillStyle = Math.random() < 0.5 ? '#ff8a2a' : '#ffd36a'; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), TS * (0.12 + Math.random() * 0.12), 0, 7); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(sx(b.x), sy(b.y)); ctx.lineTo(sx(b.x - b.vx * 0.025), sy(b.y - b.vy * 0.025)); ctx.stroke();
    });
    game.bombs.forEach(function (b) {
      var X = sx(b.x), Y = sy(b.y) - (b.h || 0) * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx(b.x), sy(b.y) + TS * 0.1, TS * 0.12, TS * 0.05, 0, 0, 7); ctx.fill();
      emoji(b.c4 ? '🧨' : G.WEAPONS[b.id].icon, X, Y, TS * 0.4);
      if (b.landed && b.fuse > 0 && Math.floor(game.time * 8) % 2) { ctx.fillStyle = '#f33'; ctx.beginPath(); ctx.arc(X, Y - TS * 0.2, TS * 0.06, 0, 7); ctx.fill(); }
    });
    // частицы
    game.particles.forEach(function (q) {
      var a = Math.max(0, q.t / q.max);
      if (q.ring) { ctx.strokeStyle = 'rgba(255,200,90,' + a + ')'; ctx.lineWidth = TS * 0.25 * a; ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), q.ring * TS * (1 - a * 0.7), 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,240,180,' + a * 0.6 + ')'; ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), q.ring * TS * 0.6 * a, 0, 7); ctx.fill(); return; }
      ctx.globalAlpha = a; ctx.fillStyle = q.color;
      var s = q.size * DPR * (q.flash ? 2 : 1);
      ctx.fillRect(sx(q.x) - s / 2, sy(q.y) - s / 2, s, s);
      ctx.globalAlpha = 1;
    });
    // дым
    game.smokes.forEach(function (sm) {
      var a = Math.min(1, sm.t / 2) * 0.85;
      for (var i = 0; i < 6; i++) {
        var ox = Math.cos(i + game.time * 0.3) * sm.r * 0.4, oy = Math.sin(i * 2 + game.time * 0.25) * sm.r * 0.4;
        ctx.fillStyle = 'rgba(200,200,205,' + a * 0.35 + ')';
        ctx.beginPath(); ctx.arc(sx(sm.x + ox), sy(sm.y + oy), sm.r * TS * 0.7, 0, 7); ctx.fill();
      }
    });
    // подсветка цели взаимодействия
    var it = game.interact;
    if (it && p.alive) {
      var ix, iy;
      if (it.kind === 'actor') { ix = it.a.x; iy = it.a.y; } else if (it.kind === 'obj') { ix = it.o.x + 0.5; iy = it.o.y + 0.5; } else if (it.kind === 'door') { ix = it.d.x + 0.5; iy = it.d.y + 0.5; } else { ix = it.x + 0.5; iy = it.y + 0.5; }
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(game.time * 6) * 0.3) + ')'; ctx.lineWidth = 2 * DPR;
      ctx.setLineDash([4 * DPR, 3 * DPR]); ctx.beginPath(); ctx.arc(sx(ix), sy(iy), TS * 0.55, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    // прицел
    if (p.alive && G.input.aiming && G.input.aimMag > 0.2) {
      var w = p.wdef(), len = w.kind === 'throw' ? (p.throwPower || 0.8) * w.range : w.kind === 'melee' ? w.range : Math.min(w.range, 7);
      ctx.strokeStyle = w.kind === 'throw' ? 'rgba(255,200,80,0.6)' : 'rgba(255,80,80,0.45)'; ctx.lineWidth = 2 * DPR;
      ctx.setLineDash([6 * DPR, 6 * DPR]); ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(p.x + Math.cos(p.face) * len), sy(p.y + Math.sin(p.face) * len)); ctx.stroke(); ctx.setLineDash([]);
      if (w.kind === 'throw') { ctx.beginPath(); ctx.arc(sx(p.x + Math.cos(p.face) * len), sy(p.y + Math.sin(p.face) * len), (w.explode || w.firebomb || w.smoke || 1) * TS, 0, 7); ctx.stroke(); }
    }
    // реплики и значки
    list.forEach(function (a) { drawOverhead(a, game); });
    game.texts.forEach(function (t) {
      ctx.globalAlpha = Math.min(1, t.t * 2);
      text(t.text, sx(t.x), sy(t.y), t.size * DPR, t.color, true);
      ctx.globalAlpha = 1;
    });
    // экранные эффекты
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = dist.tint; ctx.fillRect(0, 0, W, H);
    if (game.focusT > 0) { ctx.fillStyle = 'rgba(80,140,255,0.13)'; ctx.fillRect(0, 0, W, H); }
    if (p.invis > 0) { ctx.fillStyle = 'rgba(120,80,200,0.12)'; ctx.fillRect(0, 0, W, H); }
    if (p.hidden) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); }
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, p.hp < p.maxHp * 0.3 ? 'rgba(120,0,0,0.55)' : 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawArrows(game);
  }

  function wallColor(type) {
    return { house: '#7a5a48', shop: '#4a6a5a', bar: '#5a3a5a', police: '#3a4a7a', rustbase: '#7a4a2a', neonbase: '#6a3a7a', warehouse: '#5a5a50', lab: '#7a8a96', bank: '#8a7a5a', tower: '#3a3a4a' }[type] || '#555';
  }

  function drawDoor(m, x, y, px, py) {
    var d = m.doors[m.idx(x, y)];
    var vertical = m.isWallish(m.get(x, y - 1)) || m.get(x, y - 1) === G.T.DOOR;
    if (d && d.broken) { ctx.fillStyle = '#4a3420'; ctx.fillRect(px + TS * 0.1, py + TS * 0.7, TS * 0.3, TS * 0.12); return; }
    var open = d && d.openT > 0;
    ctx.fillStyle = d && d.locked ? '#5a2e1e' : '#7a5230';
    if (open) {
      if (vertical) ctx.fillRect(px, py, TS, TS * 0.12); else ctx.fillRect(px, py, TS * 0.12, TS);
    } else {
      if (vertical) ctx.fillRect(px + TS * 0.35, py - TS * 0.1, TS * 0.3, TS * 1.1);
      else { ctx.fillRect(px, py - TS * 0.3, TS + 1, TS * 0.95); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + TS * 0.48, py - TS * 0.3, 2, TS * 0.95); }
      if (d && d.locked) { ctx.fillStyle = '#e33'; ctx.beginPath(); ctx.arc(px + TS * 0.5, py + TS * 0.25, TS * 0.08, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#e8c23a'; ctx.fillRect(px + TS * 0.6, py + TS * 0.2, TS * 0.07, TS * 0.07); }
    }
  }

  function drawObj(o, px, py, game) {
    var t = o.type, S = TS;
    var box = function (c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(px + x * S, py + y * S, w * S, h * S); };
    ctx.globalAlpha = 1;
    switch (t) {
      case 'safe': box('#2f3640', 0.12, -0.05, 0.76, 0.85); box('#4a5562', 0.18, 0.0, 0.64, 0.72); ctx.fillStyle = o.opened ? '#3a3' : '#cdd'; ctx.beginPath(); ctx.arc(px + S / 2, py + S * 0.36, S * 0.12, 0, 7); ctx.fill(); break;
      case 'crate': box('#8a6236', 0.1, 0.05, 0.8, 0.8); box('#6a4826', 0.1, 0.42, 0.8, 0.07); box('#6a4826', 0.46, 0.05, 0.07, 0.8); if (o.opened) box('rgba(0,0,0,0.35)', 0.1, 0.05, 0.8, 0.8); break;
      case 'wardrobe': box('#5e3d22', 0.08, -0.3, 0.84, 1.1); box('#7a5230', 0.13, -0.25, 0.35, 0.95); box('#7a5230', 0.52, -0.25, 0.35, 0.95); break;
      case 'terminal': box('#333a40', 0.1, -0.1, 0.8, 0.9); box(o.downloaded ? '#3a6' : (Math.floor(game.time * 3) % 2 ? '#2ee88a' : '#1fae66'), 0.18, -0.02, 0.64, 0.4); box('#222', 0.18, 0.5, 0.64, 0.18); break;
      case 'alarm': box('#ccc', 0.32, 0.15, 0.36, 0.36); ctx.fillStyle = '#d22'; ctx.beginPath(); ctx.arc(px + S / 2, py + S * 0.33, S * 0.12, 0, 7); ctx.fill(); break;
      case 'vent': box('#3a3f44', 0.12, 0.12, 0.76, 0.76); for (var i = 0; i < 4; i++) box('#1c1f22', 0.18, 0.2 + i * 0.16, 0.64, 0.07); break;
      case 'trash': box('#2f5a3a', 0.15, 0.0, 0.7, 0.85); box('#244a2e', 0.1, -0.05, 0.8, 0.18); break;
      case 'barrel': box('#b0301e', 0.2, 0.0, 0.6, 0.85); box('#e8c23a', 0.2, 0.3, 0.6, 0.08); box('#801f12', 0.2, 0.0, 0.6, 0.1); break;
      case 'counter': box('#5a4632', 0, 0.1, 1.02, 0.7); box('#7a6448', 0, 0.05, 1.02, 0.2); break;
      case 'table': box('#7a5a3a', 0.08, 0.15, 0.84, 0.6); box('#5a4028', 0.12, 0.7, 0.1, 0.2); box('#5a4028', 0.78, 0.7, 0.1, 0.2); break;
      case 'bed': box('#5a6aa0', 0.05, 0.05, 0.9, 0.9); box('#eee', 0.12, 0.08, 0.76, 0.22); break;
      case 'plant': box('#6a4a2a', 0.32, 0.5, 0.36, 0.35); ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(px + S / 2, py + S * 0.32, S * 0.3, 0, 7); ctx.fill(); break;
      case 'tree': ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px + S / 2, py + S * 0.85, S * 0.45, S * 0.15, 0, 0, 7); ctx.fill(); box('#5a3a1e', 0.42, 0.3, 0.16, 0.55); ctx.fillStyle = '#2e6a32'; ctx.beginPath(); ctx.arc(px + S / 2, py - S * 0.05, S * 0.55, 0, 7); ctx.fill(); ctx.fillStyle = '#3c8040'; ctx.beginPath(); ctx.arc(px + S * 0.4, py - S * 0.15, S * 0.3, 0, 7); ctx.fill(); break;
      case 'bush': ctx.fillStyle = '#2f6a34'; ctx.beginPath(); ctx.arc(px + S * 0.35, py + S * 0.55, S * 0.32, 0, 7); ctx.arc(px + S * 0.65, py + S * 0.5, S * 0.32, 0, 7); ctx.fill(); break;
      case 'bench': box('#7a5a3a', 0.02, 0.35, 0.96, 0.25); box('#444', 0.08, 0.6, 0.08, 0.2); box('#444', 0.84, 0.6, 0.08, 0.2); break;
      case 'lamp': box('#333', 0.44, -0.6, 0.12, 1.4); box('#ffe9a0', 0.32, -0.7, 0.36, 0.14); ctx.fillStyle = 'rgba(255,230,150,0.08)'; ctx.beginPath(); ctx.arc(px + S / 2, py + S / 2, S * 2.2, 0, 7); ctx.fill(); break;
      case 'vending': box('#a02a3a', 0.1, -0.35, 0.8, 1.15); box('#ffd', 0.18, -0.25, 0.4, 0.6); box('#222', 0.64, -0.2, 0.18, 0.3); break;
      case 'atm': box('#3a5a8a', 0.15, -0.3, 0.7, 1.1); box('#9cf', 0.25, -0.2, 0.5, 0.3); box('#222', 0.3, 0.3, 0.4, 0.06); break;
      case 'generator': box('#5a6a3a', 0.02, -0.1, 0.96, 0.95); box('#e8c23a', 0.1, 0.1, 0.25, 0.25); box('#333', 0.45, 0.0, 0.45, 0.7); if (Math.floor(game.time * 6) % 2) box('#f33', 0.15, 0.55, 0.1, 0.1); break;
      case 'server': box('#22262c', 0.1, -0.35, 0.8, 1.2); for (i = 0; i < 5; i++) box(Math.random() < 0.5 ? '#2e8' : '#0a4', 0.2, -0.25 + i * 0.2, 0.08, 0.06); break;
      case 'still': box('#b08040', 0.2, 0.0, 0.6, 0.8); box('#ccc', 0.35, -0.3, 0.1, 0.35); box('#ccc', 0.45, -0.3, 0.35, 0.08); break;
      case 'elevator': break;
    }
    if (o.flash > 0) { o.flash -= 0.016; box('rgba(255,255,255,0.5)', 0, 0, 1, 1); }
  }

  function drawActor(a, game) {
    var X = sx(a.x), Y = sy(a.y), S = TS;
    if (a.isPlayer && a.hidden) { ctx.globalAlpha = 0.35; }
    if (!a.alive) {
      ctx.save(); ctx.translate(X, Y); ctx.rotate(a.id % 2 ? 1.4 : -1.4);
      ctx.fillStyle = shade(a.color, -0.3); ctx.fillRect(-S * 0.2, -S * 0.3, S * 0.4, S * 0.55);
      ctx.fillStyle = SKIN[a.id % SKIN.length]; ctx.beginPath(); ctx.arc(0, -S * 0.36, S * 0.15, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    if (a.invis > 0) ctx.globalAlpha = a.isPlayer ? 0.4 : 0.15;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(X, Y + S * 0.28, S * 0.3, S * 0.11, 0, 0, 7); ctx.fill();
    if (a.R.turret && !a.isPlayer) {
      ctx.fillStyle = a.disabled ? '#444' : a.hacked ? '#2a6' : '#556';
      ctx.fillRect(X - S * 0.32, Y - S * 0.2, S * 0.64, S * 0.5);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(a.face);
      ctx.fillStyle = '#222'; ctx.fillRect(0, -S * 0.07, S * 0.5, S * 0.14);
      ctx.restore();
      ctx.fillStyle = a.disabled ? '#333' : (a.state === 'combat' ? '#f22' : '#fc3'); ctx.beginPath(); ctx.arc(X, Y, S * 0.1, 0, 7); ctx.fill();
      if (a.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X - S * 0.32, Y - S * 0.2, S * 0.64, S * 0.5); }
      ctx.globalAlpha = 1; return;
    }
    var sc = a.R.boss ? 1.25 : (a.role === 'bouncer' ? 1.12 : 1);
    ctx.save(); ctx.translate(X, Y); ctx.scale(sc, sc);
    var walk = Math.sin(a.walkPh || 0);
    // ноги
    ctx.fillStyle = '#222';
    ctx.fillRect(-S * 0.15, S * 0.08 + walk * S * 0.05, S * 0.11, S * 0.2);
    ctx.fillRect(S * 0.04, S * 0.08 - walk * S * 0.05, S * 0.11, S * 0.2);
    // тело
    var body = a.flash > 0 ? '#fff' : a.color;
    ctx.fillStyle = body; roundRect(-S * 0.2, -S * 0.2, S * 0.4, S * 0.34, S * 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-S * 0.2, S * 0.04, S * 0.4, S * 0.08);
    // оружие и рука
    var fx = Math.cos(a.face), fy = Math.sin(a.face);
    var w = a.wdef();
    ctx.save(); ctx.rotate(a.face);
    var swing = a.swingT > 0 ? (a.swingT / 0.18 - 0.5) * 1.6 : 0;
    ctx.rotate(swing);
    if (a.weapon.id !== 'fist') drawWeapon(a.weapon.id, w, S);
    ctx.fillStyle = SKIN[a.id % SKIN.length]; ctx.beginPath(); ctx.arc(S * 0.24, S * 0.05, S * 0.07, 0, 7); ctx.fill();
    ctx.restore();
    // голова
    var hy = -S * 0.32;
    ctx.fillStyle = a.flash > 0 ? '#fff' : SKIN[a.isPlayer ? 0 : a.id % SKIN.length];
    ctx.beginPath(); ctx.arc(0, hy, S * 0.17, 0, 7); ctx.fill();
    // глаза в сторону взгляда
    if (fy > -0.5) { ctx.fillStyle = '#111'; ctx.fillRect(fx * S * 0.07 - S * 0.07, hy - S * 0.01, S * 0.04, S * 0.05); ctx.fillRect(fx * S * 0.07 + S * 0.03, hy - S * 0.01, S * 0.04, S * 0.05); }
    drawHat(a.hat, a.color, S, hy);
    ctx.restore();
    if (a.stun > 0) { ctx.fillStyle = '#ff4'; for (var i = 0; i < 3; i++) { var an = game.time * 5 + i * 2.1; ctx.fillRect(X + Math.cos(an) * S * 0.25, Y - S * 0.6 + Math.sin(an) * S * 0.08, S * 0.06, S * 0.06); } }
    if (a.burn > 0) { ctx.fillStyle = 'rgba(255,120,30,0.7)'; ctx.beginPath(); ctx.arc(X, Y - S * 0.1, S * (0.25 + Math.random() * 0.1), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawWeapon(id, w, S) {
    if (w.kind === 'melee') {
      var len = { knife: 0.25, bat: 0.55, pipe: 0.55, knuckle: 0.12, machete: 0.5, sledge: 0.6 }[id] || 0.3;
      ctx.fillStyle = id === 'bat' ? '#c8a060' : id === 'knife' || id === 'machete' ? '#ccd' : '#888';
      ctx.fillRect(S * 0.22, -S * 0.04, S * len, S * 0.07);
      if (id === 'sledge') { ctx.fillStyle = '#555'; ctx.fillRect(S * (0.22 + len - 0.1), -S * 0.12, S * 0.14, S * 0.24); }
    } else if (w.kind === 'gun') {
      var L = { pistol: 0.3, taser: 0.28, sawn: 0.42, smg: 0.42, rifle: 0.62, flamer: 0.5, rocket: 0.6 }[id] || 0.35;
      ctx.fillStyle = id === 'taser' ? '#e8c23a' : id === 'flamer' ? '#a33' : id === 'rocket' ? '#4a5a3a' : '#2a2a2a';
      ctx.fillRect(S * 0.16, -S * 0.05, S * L, S * (id === 'rocket' ? 0.14 : 0.09));
    } else {
      ctx.font = Math.round(S * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(w.icon, S * 0.32, 0);
    }
  }

  function drawHat(hat, color, S, hy) {
    switch (hat) {
      case 'cap': ctx.fillStyle = shade(color, -0.25); ctx.fillRect(-S * 0.18, hy - S * 0.18, S * 0.36, S * 0.1); ctx.fillRect(-S * 0.05, hy - S * 0.12, S * 0.26, S * 0.05); break;
      case 'police': ctx.fillStyle = '#1a2a6a'; ctx.fillRect(-S * 0.19, hy - S * 0.22, S * 0.38, S * 0.12); ctx.fillStyle = '#e8c23a'; ctx.fillRect(-S * 0.03, hy - S * 0.2, S * 0.06, S * 0.06); break;
      case 'helmet': ctx.fillStyle = shade(color, -0.1); ctx.beginPath(); ctx.arc(0, hy - S * 0.04, S * 0.19, Math.PI, 0); ctx.fill(); break;
      case 'top': ctx.fillStyle = '#111'; ctx.fillRect(-S * 0.13, hy - S * 0.42, S * 0.26, S * 0.26); ctx.fillRect(-S * 0.2, hy - S * 0.17, S * 0.4, S * 0.05); break;
      case 'band': ctx.fillStyle = '#d22'; ctx.fillRect(-S * 0.17, hy - S * 0.1, S * 0.34, S * 0.06); break;
      case 'hood': ctx.fillStyle = shade(color, -0.2); ctx.beginPath(); ctx.arc(0, hy - S * 0.02, S * 0.2, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); break;
      case 'beret': ctx.fillStyle = '#6a1a1a'; ctx.beginPath(); ctx.ellipse(-S * 0.03, hy - S * 0.14, S * 0.18, S * 0.08, -0.2, 0, 7); ctx.fill(); break;
      case 'goggles': ctx.fillStyle = '#333'; ctx.fillRect(-S * 0.17, hy - S * 0.08, S * 0.34, S * 0.05); ctx.fillStyle = '#7cf'; ctx.fillRect(-S * 0.12, hy - S * 0.1, S * 0.08, S * 0.08); ctx.fillRect(S * 0.04, hy - S * 0.1, S * 0.08, S * 0.08); break;
      case 'mohawk': ctx.fillStyle = '#3ff'; ctx.fillRect(-S * 0.04, hy - S * 0.3, S * 0.08, S * 0.16); break;
      case 'beanie': ctx.fillStyle = '#7a3a2a'; ctx.beginPath(); ctx.arc(0, hy - S * 0.05, S * 0.18, Math.PI, 0); ctx.fill(); break;
      case 'crown': ctx.fillStyle = '#e8c23a'; ctx.beginPath(); ctx.moveTo(-S * 0.16, hy - S * 0.12); ctx.lineTo(-S * 0.16, hy - S * 0.3); ctx.lineTo(-S * 0.08, hy - S * 0.2); ctx.lineTo(0, hy - S * 0.34); ctx.lineTo(S * 0.08, hy - S * 0.2); ctx.lineTo(S * 0.16, hy - S * 0.3); ctx.lineTo(S * 0.16, hy - S * 0.12); ctx.fill(); break;
    }
  }

  function drawOverhead(a, game) {
    if (!a.alive) return;
    var X = sx(a.x), Y = sy(a.y) - TS * (a.R.boss ? 0.95 : 0.75);
    if (a.isPlayer) return drawBark(a, X, Y - TS * 0.2);
    if (!a.R.turret && a.hp < a.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X - TS * 0.3, Y, TS * 0.6, TS * 0.07);
      ctx.fillStyle = a.rel <= -2 ? '#e33' : '#3c3'; ctx.fillRect(X - TS * 0.3, Y, TS * 0.6 * Math.max(0, a.hp / a.maxHp), TS * 0.07);
    }
    var icon = null, col = '#fff';
    if (a.rel >= 2) { icon = '★'; col = '#6cf'; }
    else if (a.rel === 1) { icon = '♥'; col = '#6f6'; }
    else if (a.rel <= -2 && a.state === 'combat') { icon = '!'; col = '#f44'; }
    else if (a.rel === -1 || a.state === 'warn') { icon = '?'; col = '#fa3'; }
    else if (a.state === 'investigate' || a.state === 'search') { icon = '?'; col = '#ff8'; }
    else if (a.state === 'flee') { icon = '!'; col = '#ff8'; }
    if (icon) text(icon, X + TS * 0.35, Y - TS * 0.05, 14 * DPR, col, true);
    if (a.mtarget && isActiveTarget(a, game)) {
      var bob = Math.sin(game.time * 5) * TS * 0.06;
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath(); ctx.moveTo(X - TS * 0.13, Y - TS * 0.35 + bob); ctx.lineTo(X + TS * 0.13, Y - TS * 0.35 + bob); ctx.lineTo(X, Y - TS * 0.15 + bob); ctx.fill();
    }
    if (a.shopkeeper && a.rel > -2) text('🛒', X, Y - TS * 0.25, 12 * DPR, '#fff', false);
    drawBark(a, X, Y - TS * 0.35);
  }
  function isActiveTarget(a, game) {
    return game.missions.some(function (mi) {
      if (mi.done || mi.failed) return false;
      return mi.target === a || mi.holder === a || (mi.members && mi.members.indexOf(a) >= 0);
    });
  }
  function drawBark(a, X, Y) {
    if (!a.bark) return;
    ctx.font = 'bold ' + Math.round(11 * DPR) + 'px sans-serif';
    var tw = ctx.measureText(a.bark).width + 10 * DPR, th = 18 * DPR;
    ctx.globalAlpha = Math.min(1, a.barkT * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(X - tw / 2, Y - th, tw, th, 5 * DPR); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X - 4 * DPR, Y); ctx.lineTo(X + 4 * DPR, Y); ctx.lineTo(X, Y + 5 * DPR); ctx.fill();
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.bark, X, Y - th / 2);
    ctx.globalAlpha = 1;
  }

  function drawArrows(game) {
    var pts = [];
    game.missions.forEach(function (mi) { G.missionMarkers(game, mi).forEach(function (q) { pts.push({ x: q.x, y: q.y, c: '#ffd84a' }); }); });
    if (game.canLeave()) pts.push({ x: game.map.elevX, y: game.map.elevY, c: '#3fd16a', elev: true });
    var margin = 34 * DPR;
    pts.forEach(function (q) {
      var X = (q.x - cam.x) * TS + W / 2, Y = (q.y - cam.y) * TS + H / 2;
      if (X > margin && X < W - margin && Y > margin && Y < H - margin) return;
      var ang = Math.atan2(Y - H / 2, X - W / 2);
      var cx = W / 2 + Math.cos(ang) * (W / 2 - margin), cy = H / 2 + Math.sin(ang) * (H / 2 - margin);
      cx = G.clamp(cx, margin, W - margin); cy = G.clamp(cy, margin, H - margin);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = q.c; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2 * DPR;
      ctx.beginPath(); ctx.moveTo(12 * DPR, 0); ctx.lineTo(-7 * DPR, -8 * DPR); ctx.lineTo(-7 * DPR, 8 * DPR); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (q.elev) text('🛗', cx, cy - 16 * DPR, 12 * DPR, '#fff', false);
    });
  }

  function text(s, x, y, size, color, outline) {
    ctx.font = 'bold ' + Math.round(size) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (outline) { ctx.lineWidth = 3 * DPR; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function emoji(e, x, y, size) {
    ctx.font = Math.round(size) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(e, x, y);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16); if (hex.length === 4) n = parseInt(hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(G.clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255)); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  // Мини-карта
  function drawMinimap(game, mc, full) {
    var m = game.map, c = mc.getContext('2d');
    var s = full ? Math.floor(Math.min(mc.width / m.w, mc.height / m.h)) : 2;
    if (!full) { mc.width = m.w * s; mc.height = m.h * s; }
    var ox = full ? Math.floor((mc.width - m.w * s) / 2) : 0, oy = full ? Math.floor((mc.height - m.h * s) / 2) : 0;
    c.fillStyle = '#111'; c.fillRect(0, 0, mc.width, mc.height);
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) {
      var v = m.t[y * m.w + x];
      c.fillStyle = v === G.T.WALL || v === G.T.BORDER || v === G.T.WINDOW ? '#777' : v === G.T.FLOOR || v === G.T.DOOR ? '#3a3a44' : v === G.T.GRASS ? '#264a2a' : v === G.T.ELEV ? (game.canLeave() ? '#3fd16a' : '#e0b020') : '#222';
      c.fillRect(ox + x * s, oy + y * s, s, s);
    }
    var dot = function (x, y, col, r) { c.fillStyle = col; c.fillRect(ox + x * s - r, oy + y * s - r, r * 2, r * 2); };
    if (full) {
      c.font = 'bold ' + Math.max(9, s * 2.2) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ddd';
      m.buildings.forEach(function (b) { if (b.type !== 'house') c.fillText(b.def.name, ox + (b.x + b.w / 2) * s, oy + (b.y + b.h / 2) * s); });
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

  return { init: init, resize: resize, draw: draw, drawMinimap: drawMinimap, worldFromScreen: worldFromScreen, get TS() { return TS; } };
})();
