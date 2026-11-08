'use strict';
// Звук: синтезированные эффекты и процедурная музыка (Web Audio, без файлов).
G.Audio = (function () {
  var ctx = null, master, sfxBus, musBus, noiseBuf;
  var settings = G.store.get('audio', { sfx: 0.8, music: 0.55 });
  var music = { on: false, step: 0, next: 0, intensity: 0, targetInt: 0, dist: null, seed: 1, pattern: null };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = settings.music * 0.5; musBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(tick, 25);
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, vol, bus, t) {
    if (!ctx) return;
    t = t || ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, q, bus, t, type) {
    if (!ctx) return;
    t = t || ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain(); env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  var last = {};
  function sfx(name, vol) {
    if (!ctx) return;
    var now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return;
    last[name] = now;
    vol = vol === undefined ? 1 : vol;
    switch (name) {
      case 'pistol': noise(0.12, 0.6 * vol, 1800, 0.8); tone('square', 300, 60, 0.08, 0.25 * vol); break;
      case 'smg': noise(0.07, 0.45 * vol, 2200, 0.8); tone('square', 260, 80, 0.05, 0.15 * vol); break;
      case 'shotgun': noise(0.3, 0.8 * vol, 900, 0.6); tone('sawtooth', 160, 40, 0.2, 0.3 * vol); break;
      case 'rifle': noise(0.25, 0.8 * vol, 1400, 0.5); tone('square', 500, 50, 0.15, 0.3 * vol); break;
      case 'taser': tone('sawtooth', 1200, 1800, 0.12, 0.15 * vol); noise(0.1, 0.2 * vol, 5000, 3); break;
      case 'flame': noise(0.1, 0.12 * vol, 600, 0.5, null, null, 'lowpass'); break;
      case 'rocket': noise(0.4, 0.4 * vol, 500, 0.5); tone('sawtooth', 200, 600, 0.3, 0.12 * vol); break;
      case 'swing': noise(0.1, 0.25 * vol, 1200, 2); break;
      case 'hit': tone('square', 180, 70, 0.08, 0.35 * vol); noise(0.06, 0.3 * vol, 700, 1); break;
      case 'hurt': tone('sawtooth', 300, 120, 0.15, 0.3 * vol); break;
      case 'die': tone('triangle', 400, 60, 0.45, 0.35 * vol); break;
      case 'explode': noise(0.9, 1.0 * vol, 200, 0.4, null, null, 'lowpass'); tone('sine', 90, 30, 0.6, 0.6 * vol); break;
      case 'glass': for (var i = 0; i < 4; i++) tone('sine', 2000 + Math.random() * 2500, 1500, 0.12, 0.08 * vol, null, now + i * 0.03); noise(0.15, 0.3 * vol, 4000, 1); break;
      case 'door': tone('square', 90, 70, 0.07, 0.15 * vol); break;
      case 'doorbreak': noise(0.3, 0.6 * vol, 300, 0.7); tone('square', 120, 40, 0.2, 0.3 * vol); break;
      case 'coin': tone('square', 988, 988, 0.06, 0.12 * vol); tone('square', 1319, 1319, 0.15, 0.12 * vol, null, now + 0.06); break;
      case 'pickup': tone('triangle', 500, 900, 0.1, 0.25 * vol); break;
      case 'hack': for (i = 0; i < 5; i++) tone('square', 600 + Math.random() * 900, 600, 0.05, 0.08 * vol, null, now + i * 0.06); break;
      case 'unlock': tone('square', 700, 700, 0.05, 0.12 * vol); tone('square', 1050, 1050, 0.08, 0.12 * vol, null, now + 0.07); break;
      case 'alarm': for (i = 0; i < 6; i++) tone('square', i % 2 ? 880 : 660, i % 2 ? 880 : 660, 0.18, 0.12 * vol, null, now + i * 0.2); break;
      case 'ui': tone('triangle', 660, 660, 0.05, 0.12 * vol); break;
      case 'error': tone('square', 200, 150, 0.15, 0.15 * vol); break;
      case 'levelup': [523, 659, 784, 1047].forEach(function (f, k) { tone('square', f, f, 0.12, 0.12 * vol, null, now + k * 0.09); }); break;
      case 'mission': [392, 523, 659, 784].forEach(function (f, k) { tone('triangle', f, f, 0.2, 0.2 * vol, null, now + k * 0.1); }); break;
      case 'ability': tone('sine', 300, 1200, 0.25, 0.2 * vol); break;
      case 'eat': noise(0.08, 0.2 * vol, 900, 2); noise(0.08, 0.2 * vol, 900, 2, null, now + 0.12); break;
      case 'stun': tone('sine', 900, 300, 0.3, 0.12 * vol); break;
      case 'elevator': tone('sine', 220, 440, 0.8, 0.2 * vol); break;
      case 'step': noise(0.03, 0.03 * vol, 400, 1); break;
    }
  }

  // ---------- Музыка ----------
  // Процедурный секвенсор: бас + ударные + аккорды + мелодия; в бою интенсивнее.
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function makePattern(dist, seed) {
    var r = G.RNG(seed);
    var sc = dist.music.scale, root = dist.music.root;
    var deg = function (d) { var o = Math.floor(d / sc.length); return root + sc[((d % sc.length) + sc.length) % sc.length] + o * 12; };
    var prog = [0, r.pick([3, 4, 5]), r.pick([2, 5, 6]), r.pick([4, 1, 3])];
    var bass = [], lead = [], kick = [], snare = [], hat = [];
    for (var i = 0; i < 16; i++) {
      bass.push(i % 4 === 0 || r.chance(0.3) ? (r.chance(0.8) ? 0 : r.pick([2, 4])) : null);
      kick.push(i % 4 === 0 || (i % 8 === 6 && r.chance(0.5)));
      snare.push(i % 8 === 4);
      hat.push(i % 2 === 0 || r.chance(0.3));
    }
    for (i = 0; i < 64; i++) lead.push(r.chance(0.35) ? r.int(4, 11) : null);
    return { prog: prog, deg: deg, bass: bass, lead: lead, kick: kick, snare: snare, hat: hat, bpm: dist.music.bpm };
  }
  function setDistrict(dist, seed) {
    music.dist = dist; music.pattern = makePattern(dist, seed || 1); music.step = 0;
  }
  function start() { if (!ctx) return; music.on = true; music.next = ctx.currentTime + 0.1; }
  function stop() { music.on = false; }
  function setIntensity(v) { music.targetInt = v; }

  function tick() {
    if (!ctx || !music.on || !music.pattern || ctx.state !== 'running') return;
    music.intensity += (music.targetInt - music.intensity) * 0.05;
    var p = music.pattern, spb = 60 / (p.bpm * (1 + music.intensity * 0.12)) / 4;
    while (music.next < ctx.currentTime + 0.12) {
      var s = music.step, t = music.next, i = s % 16, bar = Math.floor(s / 16) % 4;
      var chordRoot = p.prog[bar];
      var I = music.intensity;
      if (p.bass[i] !== null) tone(I > 0.5 ? 'sawtooth' : 'triangle', mtof(p.deg(chordRoot + p.bass[i]) - 12), mtof(p.deg(chordRoot + p.bass[i]) - 12), spb * 1.6, 0.22, musBus, t);
      if (p.kick[i]) { tone('sine', 120, 40, 0.18, 0.5, musBus, t); }
      if (p.snare[i] && (I > 0.2 || bar % 2 === 1)) noise(0.12, 0.18 + I * 0.15, 1500, 0.7, musBus, t);
      if (p.hat[i] && I > 0.35) noise(0.03, 0.06, 8000, 1, musBus, t, 'highpass');
      if (i === 0) { // аккорд-пэд
        [0, 2, 4].forEach(function (k) { tone('triangle', mtof(p.deg(chordRoot + k)), mtof(p.deg(chordRoot + k)), spb * 14, 0.035, musBus, t); });
      }
      var ln = p.lead[s % 64];
      if (ln !== null && (I > 0.1 || s % 128 >= 64)) tone('square', mtof(p.deg(chordRoot + ln)), mtof(p.deg(chordRoot + ln)), spb * 1.5, 0.045 + I * 0.03, musBus, t);
      music.step++;
      music.next += spb;
    }
  }

  function setVolume(kind, v) {
    settings[kind] = v; G.store.set('audio', settings);
    if (!ctx) return;
    if (kind === 'sfx') sfxBus.gain.value = v; else musBus.gain.value = v * 0.5;
  }
  function suspend(on) { if (!ctx) return; if (on) ctx.suspend(); else ctx.resume(); }

  return { init: init, sfx: sfx, setDistrict: setDistrict, start: start, stop: stop, setIntensity: setIntensity, setVolume: setVolume, settings: settings, suspend: suspend };
})();
