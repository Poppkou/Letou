'use strict';
// Эффекты: вспышки, гильзы, искры, кровь, пыль, взрывы, стекло, свет. Координаты — в клетках.

G.FX = (function () {
  var R = Math.random;
  function P(g, o) { if (g.particles.length < 700) g.particles.push(o); return o; }
  function light(g, x, y, r, color, t) { return P(g, { type: 'light', x: x, y: y, r: r, color: color, t: t, max: t }); }

  function muzzle(g, a, ang, wid) {
    var w = G.WEAPONS[wid];
    var len = { rifle: 0.9, sawn: 0.75, smg: 0.7, rocket: 0.85 }[wid] || 0.62;
    var x = a.x + Math.cos(ang) * len, y = a.y - 0.42 + Math.sin(ang) * len;
    if (wid === 'flamer') return;
    if (wid === 'taser') { P(g, { type: 'flash', x: x, y: y, ang: ang, t: 0.06, max: 0.06, color: '#9ff', size: 3 }); light(g, x, y, 1.5, 'rgba(120,220,255,', 0.08); return; }
    var big = wid === 'sawn' || wid === 'rifle' || wid === 'rocket';
    P(g, { type: 'flash', x: x, y: y, ang: ang, t: 0.05, max: 0.05, color: '#fff3b0', size: big ? 6 : 4 });
    light(g, x, y, big ? 3.2 : 2.2, 'rgba(255,210,120,', 0.07);
    for (var i = 0; i < (big ? 5 : 2); i++) {
      var s = 2 + R() * 3, an = ang + (R() - 0.5) * 0.6;
      P(g, { type: 'smoke', x: x, y: y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 0.3, t: 0.5 + R() * 0.4, max: 0.9, size: 2 + R() * 2, color: 'rgba(200,200,200,' });
    }
    if (w.kind === 'gun' && wid !== 'rocket') shell(g, a, ang, wid === 'sawn');
  }
  function shell(g, a, ang, red) {
    var side = ang + Math.PI / 2 * (Math.cos(ang) >= 0 ? -1 : 1);
    P(g, { type: 'shell', x: a.x, y: a.y, z: 0.5, vx: Math.cos(side) * (1.5 + R()), vy: Math.sin(side) * (1.5 + R()) * 0.5, vz: 2.5 + R(), t: 4, max: 4, color: red ? '#c0392b' : '#d9b040', rot: R() * 6, grav: 1 });
  }
  function sparks(g, x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var an = R() * Math.PI * 2, s = 2 + R() * 5;
      P(g, { type: 'px', x: x, y: y, z: 0.4, vx: Math.cos(an) * s, vy: Math.sin(an) * s, vz: 1 + R() * 3, t: 0.25 + R() * 0.3, max: 0.5, color: color || (R() < 0.5 ? '#ffe08a' : '#fff'), grav: 1 });
    }
    light(g, x, y, 1.2, 'rgba(255,220,140,', 0.06);
  }
  function blood(g, x, y, ang, n) {
    for (var i = 0; i < n; i++) {
      var an = ang + (R() - 0.5) * 1.6, s = 1.5 + R() * 4;
      P(g, { type: 'px', x: x, y: y, z: 0.5, vx: Math.cos(an) * s, vy: Math.sin(an) * s, vz: 1 + R() * 2.5, t: 1, max: 1, color: R() < 0.6 ? '#a3141c' : '#6e0b10', grav: 1, stain: 1 });
    }
  }
  function splat(g, x, y, size) { g.map.decals.push({ x: x, y: y, r: size, type: 'blood', seed: (R() * 1e6) | 0 }); }
  function dust(g, x, y, n, color) {
    for (var i = 0; i < (n || 2); i++) {
      P(g, { type: 'smoke', x: x + (R() - 0.5) * 0.3, y: y + (R() - 0.5) * 0.15, vx: (R() - 0.5) * 0.8, vy: -0.2 - R() * 0.3, t: 0.35 + R() * 0.3, max: 0.65, size: 1.5 + R() * 1.5, color: color || 'rgba(170,165,150,' });
    }
  }
  function debris(g, x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var an = R() * Math.PI * 2, s = 1.5 + R() * 4;
      P(g, { type: 'chunk', x: x, y: y, z: 0.4, vx: Math.cos(an) * s, vy: Math.sin(an) * s, vz: 2 + R() * 3, t: 1.6 + R(), max: 2.6, color: color, size: 1 + (R() * 2 | 0), grav: 1 });
    }
  }
  function glass(g, x, y) {
    for (var i = 0; i < 14; i++) {
      var an = R() * Math.PI * 2, s = 1 + R() * 4;
      P(g, { type: 'chunk', x: x, y: y, z: 0.6, vx: Math.cos(an) * s, vy: Math.sin(an) * s, vz: 1 + R() * 3, t: 2.5, max: 2.5, color: R() < 0.5 ? '#bfe6ff' : '#e8f8ff', size: 1, grav: 1, glint: 1 });
    }
  }
  function explosion(g, x, y, r) {
    light(g, x, y, r * 3.2, 'rgba(255,170,80,', 0.45);
    P(g, { type: 'ring', x: x, y: y, r: r, t: 0.3, max: 0.3 });
    P(g, { type: 'ball', x: x, y: y, r: r * 0.9, t: 0.22, max: 0.22 });
    for (var i = 0; i < 28; i++) {
      var an = R() * Math.PI * 2, s = 1 + R() * 5 * r / 2;
      P(g, { type: 'fire', x: x, y: y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, t: 0.25 + R() * 0.4, max: 0.65, size: 2 + R() * 4 });
    }
    for (i = 0; i < 16; i++) {
      an = R() * Math.PI * 2; s = 0.5 + R() * 2;
      P(g, { type: 'smoke', x: x + Math.cos(an) * r * 0.4, y: y + Math.sin(an) * r * 0.4, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 0.6, t: 1.2 + R() * 1.2, max: 2.4, size: 4 + R() * 5, color: 'rgba(60,58,56,' });
    }
    debris(g, x, y, '#555', 10);
    sparks(g, x, y, 14);
    g.map.decals.push({ x: x, y: y, r: r * 0.65, type: 'scorch', seed: (R() * 1e6) | 0 });
    g.hitStop = Math.max(g.hitStop || 0, 0.07);
  }
  function flame(g, x, y, s) {
    P(g, { type: 'fire', x: x + (R() - 0.5) * s, y: y + (R() - 0.5) * s * 0.6, vx: (R() - 0.5) * 0.5, vy: -1.2 - R(), t: 0.4 + R() * 0.3, max: 0.7, size: 2 + R() * 3 });
  }

  // Физика частиц
  function update(g, dt) {
    var list = g.particles;
    for (var i = list.length - 1; i >= 0; i--) {
      var q = list[i];
      q.t -= dt;
      if (q.vx !== undefined) {
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.grav) {
          q.z += q.vz * dt; q.vz -= 12 * dt;
          if (q.z <= 0) {
            q.z = 0;
            if (q.stain) { if (R() < 0.35) splat(g, q.x, q.y, 0.08 + R() * 0.1); q.t = 0; }
            else { q.vz = -q.vz * 0.35; q.vx *= 0.5; q.vy *= 0.5; if (Math.abs(q.vz) < 0.6) { q.vz = 0; q.vx = 0; q.vy = 0; q.grav = 0; } }
          }
          if (q.rot !== undefined) q.rot += q.vx * dt * 6;
        } else if (q.type === 'smoke' || q.type === 'fire') { q.vx *= 0.94; q.vy *= 0.94; }
        else { q.vx *= 0.9; q.vy *= 0.9; }
      }
      if (q.t <= 0) list.splice(i, 1);
    }
  }
  return { muzzle: muzzle, shell: shell, sparks: sparks, blood: blood, splat: splat, dust: dust, debris: debris, glass: glass, explosion: explosion, flame: flame, light: light, update: update };
})();
