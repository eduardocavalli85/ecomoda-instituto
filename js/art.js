/**
 * Ilustrações procedurais das peças: silhueta preenchida com retalhos.
 * Determinístico por id da peça (mesmo desenho sempre), sem imagens externas.
 */
(function () {
  function rng(seedStr) {
    var h = 1779033703 ^ seedStr.length;
    for (var i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    var a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Silhuetas em viewBox 0 0 200 240
  var SHAPES = {
    tote: { d: "M38 90 L162 90 L174 222 Q174 228 168 228 L32 228 Q26 228 26 222 Z",
            extra: '<path d="M70 90 C70 40 130 40 130 90" fill="none" stroke-width="9" stroke-linecap="round" class="strap"/>' },
    blusa: { d: "M70 30 Q100 52 130 30 L172 56 L152 100 L136 90 L136 214 L64 214 L64 90 L48 100 L28 56 Z" },
    saia: { d: "M64 40 L136 40 L142 62 L176 220 Q100 236 24 220 L58 62 Z" },
    necessaire: { d: "M24 90 Q24 76 38 76 L162 76 Q176 76 176 90 L176 178 Q176 192 162 192 L38 192 Q24 192 24 178 Z",
                  extra: '<path d="M30 100 L170 100" stroke-dasharray="5 4" stroke-width="3" class="zip"/><rect x="92" y="94" width="16" height="14" rx="3" class="pull"/>' },
    faixa: { d: "M14 120 Q60 70 100 100 Q140 130 186 84 L190 128 Q146 176 100 146 Q60 120 18 168 Z" },
    colete: { d: "M66 28 L96 28 L100 70 L104 28 L134 28 L168 70 L156 112 L156 212 L44 212 L44 112 L32 70 Z" },
  };

  function drawPiece(p, opts) {
    opts = opts || {};
    var rand = rng(p.id), shape = SHAPES[p.forma] || SHAPES.tote, pal = p.paleta, uid = "c" + p.id.replace(/\W/g, "");
    var cells = "", x, y, w, h, cols = 5 + Math.floor(rand() * 3), cw = 200 / cols;
    for (y = 0; y < 240; y += h) {
      h = 28 + Math.floor(rand() * 26);
      for (x = 0; x < 200; x += w) {
        w = cw * (0.8 + rand() * 0.9);
        var col = pal[Math.floor(rand() * pal.length)];
        var tilt = (rand() - 0.5) * 6;
        cells += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + (w + 0.6).toFixed(1) + '" height="' + (h + 0.6) + '" fill="' + col + '" transform="rotate(' + tilt.toFixed(1) + ' ' + (x + w / 2).toFixed(0) + ' ' + (y + h / 2) + ')"/>';
        if (rand() > 0.55) cells += '<rect x="' + (x + 5).toFixed(1) + '" y="' + (y + 5) + '" width="' + Math.max(w - 10, 4).toFixed(1) + '" height="' + Math.max(h - 10, 4) + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.3" stroke-dasharray="4 3" transform="rotate(' + tilt.toFixed(1) + ' ' + (x + w / 2).toFixed(0) + ' ' + (y + h / 2) + ')"/>';
      }
    }
    var strap = pal[1];
    return '<svg class="piece-art" viewBox="0 0 200 240" role="img" aria-label="' + (opts.alt || p.nome) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="' + uid + '"><path d="' + shape.d + '"/></clipPath></defs>' +
      '<style>.strap{stroke:' + strap + '}.zip{stroke:rgba(255,255,255,.8)}.pull{fill:' + pal[0] + '}</style>' +
      (shape.extra && p.forma === "tote" ? shape.extra : "") +
      '<g clip-path="url(#' + uid + ')">' + cells + '</g>' +
      '<path d="' + shape.d + '" fill="none" stroke="rgba(35,31,27,.35)" stroke-width="2"/>' +
      (shape.extra && p.forma === "necessaire" ? shape.extra : "") +
      '</svg>';
  }

  window.EcoArt = { drawPiece: drawPiece };
})();
