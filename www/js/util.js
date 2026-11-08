'use strict';
// Общие утилиты. Все модули складывают своё в глобальный объект G.
var G = window.G = {};

G.RNG = function (seed) {
  var s = seed >>> 0;
  var r = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = function (a, b) { return a + Math.floor(r() * (b - a + 1)); };
  r.range = function (a, b) { return a + r() * (b - a); };
  r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
  r.chance = function (p) { return r() < p; };
  r.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  return r;
};

G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
G.lerp = function (a, b, t) { return a + (b - a) * t; };
G.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
G.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
G.angDiff = function (a, b) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
G.fmt = function (str, obj) {
  return str.replace(/\{(\w+)\}/g, function (m, k) { return obj[k] !== undefined ? obj[k] : m; });
};

// Небольшая двоичная куча для A*
G.Heap = function () { this.a = []; };
G.Heap.prototype.push = function (node, pri) {
  var a = this.a; a.push([pri, node]);
  var i = a.length - 1;
  while (i > 0) {
    var p = (i - 1) >> 1;
    if (a[p][0] <= a[i][0]) break;
    var t = a[p]; a[p] = a[i]; a[i] = t; i = p;
  }
};
G.Heap.prototype.pop = function () {
  var a = this.a; var top = a[0]; var last = a.pop();
  if (a.length) {
    a[0] = last; var i = 0;
    for (;;) {
      var l = i * 2 + 1, r = l + 1, m = i;
      if (l < a.length && a[l][0] < a[m][0]) m = l;
      if (r < a.length && a[r][0] < a[m][0]) m = r;
      if (m === i) break;
      var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
    }
  }
  return top[1];
};
G.Heap.prototype.size = function () { return this.a.length; };

G.store = {
  get: function (k, d) { try { var v = localStorage.getItem('kv_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('kv_' + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem('kv_' + k); } catch (e) {} }
};
