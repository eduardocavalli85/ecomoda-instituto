/*!
 * Gerador de QR Code (modo byte, correção de erros M, versões 1-20).
 * Implementação própria para o projeto EcoModa, sem dependências. Licença MIT.
 * Uso: const m = EcoQR.matrix("texto"); EcoQR.toSVG("texto", {size: 220});
 */
(function (root) {
  "use strict";
  var RS_M = [[1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32], [2, 67, 43], [4, 43, 27], [4, 49, 31], [2, 60, 38, 2, 61, 39], [3, 58, 36, 2, 59, 37], [4, 69, 43, 1, 70, 44], [1, 80, 50, 4, 81, 51], [6, 58, 36, 2, 59, 37], [8, 59, 37, 1, 60, 38], [4, 64, 40, 5, 65, 41], [5, 65, 41, 5, 66, 42], [7, 73, 45, 3, 74, 46], [10, 74, 46, 1, 75, 47], [9, 69, 43, 4, 70, 44], [3, 70, 44, 11, 71, 45], [3, 67, 41, 13, 68, 42]];
  var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];

  var EXP = [], LOG = [];
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

  function rsRemainder(data, n) {
    var g = [1], i, j;
    for (i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
      g = ng;
    }
    var r = data.concat(new Array(n).fill(0));
    for (i = 0; i < data.length; i++) {
      var c = r[i];
      if (c) for (j = 1; j < g.length; j++) r[i + j] ^= mul(g[j], c);
    }
    return r.slice(data.length);
  }

  function utf8(str) { return Array.prototype.slice.call(new TextEncoder().encode(str)); }

  function blocksFor(v) {
    var row = RS_M[v - 1], out = [];
    for (var i = 0; i < row.length; i += 3)
      for (var k = 0; k < row[i]; k++) out.push({ total: row[i + 1], data: row[i + 2] });
    return out;
  }

  function pickVersion(len) {
    for (var v = 1; v <= 20; v++) {
      var cap = blocksFor(v).reduce(function (s, b) { return s + b.data; }, 0);
      var need = 4 + (v < 10 ? 8 : 16) + len * 8;
      if (need <= cap * 8) return v;
    }
    throw new Error("Texto grande demais para o QR (máx. ~ 600 bytes)");
  }

  function bchDigit(d) { var n = 0; while (d) { n++; d >>>= 1; } return n; }
  function formatBits(mask) {
    var d = (0 << 3) | mask, r = d << 10, G = 0x537;
    while (bchDigit(r) - bchDigit(G) >= 0) r ^= G << (bchDigit(r) - bchDigit(G));
    return ((d << 10) | r) ^ 0x5412;
  }
  function versionBits(v) {
    var r = v << 12, G = 0x1f25;
    while (bchDigit(r) - bchDigit(G) >= 0) r ^= G << (bchDigit(r) - bchDigit(G));
    return (v << 12) | r;
  }

  function encodeData(bytes, v) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var blocks = blocksFor(v), cap = blocks.reduce(function (s, b) { return s + b.data; }, 0) * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; cw.push(x); }
    for (var pad = 0; cw.length < cap / 8; pad++) cw.push(pad % 2 ? 0x11 : 0xec);
    // blocos + interleave
    var off = 0, dBlocks = [], eBlocks = [];
    blocks.forEach(function (b) {
      var d = cw.slice(off, off + b.data); off += b.data;
      dBlocks.push(d); eBlocks.push(rsRemainder(d, b.total - b.data));
    });
    var out = [], maxD = Math.max.apply(null, dBlocks.map(function (d) { return d.length; }));
    for (i = 0; i < maxD; i++) dBlocks.forEach(function (d) { if (i < d.length) out.push(d[i]); });
    for (i = 0; i < eBlocks[0].length; i++) eBlocks.forEach(function (e) { out.push(e[i]); });
    return out;
  }

  function build(v, data, mask, test) {
    var n = 17 + 4 * v, m = [], fn = [], r, c;
    for (r = 0; r < n; r++) { m.push(new Array(n).fill(null)); fn.push(new Array(n).fill(false)); }
    function set(r, c, val) { m[r][c] = val; fn[r][c] = true; }
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    var pos = ALIGN[v - 1];
    pos.forEach(function (pr) { pos.forEach(function (pc) {
      if (fn[pr][pc]) return;
      for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++)
        set(pr + r, pc + c, r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
    }); });
    for (var i = 8; i < n - 8; i++) { if (!fn[6][i]) set(6, i, i % 2 === 0); if (!fn[i][6]) set(i, 6, i % 2 === 0); }
    // reservar áreas de formato
    for (i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
    for (i = 0; i < 8; i++) { if (!fn[8][n - 1 - i]) set(8, n - 1 - i, false); if (!fn[n - 1 - i][8]) set(n - 1 - i, 8, false); }
    set(n - 8, 8, true);
    if (v >= 7) {
      var vb = versionBits(v);
      for (i = 0; i < 18; i++) { var bit = ((vb >> i) & 1) === 1; set(Math.floor(i / 3), i % 3 + n - 11, bit); set(i % 3 + n - 11, Math.floor(i / 3), bit); }
    }
    // dados em zigue-zague
    var bitIdx = 0, up = true;
    for (c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (var k = 0; k < n; k++) {
        r = up ? n - 1 - k : k;
        for (var d = 0; d < 2; d++) {
          var cc = c - d; if (fn[r][cc]) continue;
          var bit = bitIdx < data.length * 8 ? ((data[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1 : false;
          bitIdx++;
          var inv = false;
          switch (mask) {
            case 0: inv = (r + cc) % 2 === 0; break;
            case 1: inv = r % 2 === 0; break;
            case 2: inv = cc % 3 === 0; break;
            case 3: inv = (r + cc) % 3 === 0; break;
            case 4: inv = (Math.floor(r / 2) + Math.floor(cc / 3)) % 2 === 0; break;
            case 5: inv = ((r * cc) % 2) + ((r * cc) % 3) === 0; break;
            case 6: inv = (((r * cc) % 2) + ((r * cc) % 3)) % 2 === 0; break;
            case 7: inv = (((r * cc) % 3) + ((r + cc) % 2)) % 2 === 0; break;
          }
          m[r][cc] = inv ? !bit : bit;
        }
      }
      up = !up;
    }
    var fb = formatBits(mask);
    for (i = 0; i < 15; i++) {
      var b = ((fb >> i) & 1) === 1;
      if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[n - 15 + i][8] = b;
      if (i < 8) m[8][n - i - 1] = b; else if (i < 9) m[8][15 - i - 1 + 1] = b; else m[8][15 - i - 1] = b;
    }
    m[n - 8][8] = true;
    return m;
  }

  function penalty(m) {
    var n = m.length, p = 0, r, c, k;
    for (var pass = 0; pass < 2; pass++) {
      for (r = 0; r < n; r++) {
        var run = 1;
        for (c = 1; c < n; c++) {
          var a = pass ? m[c][r] : m[r][c], b = pass ? m[c - 1][r] : m[r][c - 1];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
    }
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) {
      var s = m[r][c] + m[r + 1][c] + m[r][c + 1] + m[r + 1][c + 1];
      if (s === 0 || s === 4) p += 3;
    }
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (r = 0; r < n; r++) for (c = 0; c <= n - 11; c++) {
      var h1 = true, h2 = true, v1 = true, v2 = true;
      for (k = 0; k < 11; k++) {
        if ((m[r][c + k] ? 1 : 0) !== pat1[k]) h1 = false;
        if ((m[r][c + k] ? 1 : 0) !== pat2[k]) h2 = false;
        if ((m[c + k][r] ? 1 : 0) !== pat1[k]) v1 = false;
        if ((m[c + k][r] ? 1 : 0) !== pat2[k]) v2 = false;
      }
      if (h1 || h2) p += 40; if (v1 || v2) p += 40;
    }
    var dark = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) dark++;
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  function matrix(text) {
    var bytes = utf8(text), v = pickVersion(bytes.length), data = encodeData(bytes, v);
    var best = null, bestP = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var m = build(v, data, mask), p = penalty(m);
      if (p < bestP) { bestP = p; best = m; }
    }
    return best;
  }

  function toSVG(text, opt) {
    opt = opt || {};
    var m = matrix(text), n = m.length, q = 4, size = opt.size || 220;
    var d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) d += "M" + (c + q) + " " + (r + q) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * q) + " " + (n + 2 * q) + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + (opt.label || "QR Code") + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#111"/></svg>';
  }

  root.EcoQR = { matrix: matrix, toSVG: toSVG };
})(typeof window !== "undefined" ? window : globalThis);
