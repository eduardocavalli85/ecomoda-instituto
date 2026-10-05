/**
 * Instituto EcoModa: loja com rastreabilidade por peça (SPA sem build).
 * Camadas: store (estado/localStorage) → regras (frete, impacto) → views (HTML) → roteador.
 */
(function () {
  "use strict";
  var CFG = window.ECOMODA_CONFIG, DATA = window.ECOMODA_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- utilidades ---------- */
  var brl = function (n) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var num = function (n, d) { return n.toLocaleString("pt-BR", { maximumFractionDigits: d == null ? 0 : d }); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var artesaDe = function (id) { return DATA.artesas.filter(function (a) { return a.id === id; })[0]; };
  var pecaDe = function (id) { return DATA.pecas.filter(function (p) { return p.id === id; })[0]; };
  var iniciais = function (n) { return n.split(" ").filter(function (w) { return w.length > 3; }).slice(0, 2).map(function (s) { return s[0].toUpperCase(); }).join(""); };

  /* ---------- store (localStorage com fallback em memória) ---------- */
  var mem = {};
  var store = {
    get: function (k, def) { try { var v = localStorage.getItem("ecomoda." + k); return v ? JSON.parse(v) : def; } catch (e) { return mem[k] !== undefined ? mem[k] : def; } },
    set: function (k, v) { try { localStorage.setItem("ecomoda." + k, JSON.stringify(v)); } catch (e) { mem[k] = v; } },
  };
  var getCart = function () { return store.get("cart", []); };
  var getOrders = function () { return store.get("orders", []); };
  function pruneCart() {
    var lim = CFG.reservaMinutos * 60000, now = Date.now(), c = getCart();
    var keep = c.filter(function (i) { return now - i.ts < lim && !vendida(i.id); });
    if (keep.length !== c.length) { store.set("cart", keep); toast("Algumas peças saíram do carrinho (reserva expirada ou vendida)."); }
    return keep;
  }
  function vendida(id) { return getOrders().some(function (o) { return o.status !== "cancelado" && o.itens.indexOf(id) >= 0; }); }
  var noCarrinho = function (id) { return getCart().some(function (i) { return i.id === id; }); };

  /* ---------- regras de negócio ---------- */
  function impacto(p) {
    return { kg: p.kg, agua: p.kg * CFG.impacto.aguaLitrosPorKg, co2: p.kg * CFG.impacto.co2KgPorKg, horas: p.horas, artesa: p.preco * p.parteArtesa };
  }
  function somaImpacto(ps) {
    return ps.reduce(function (s, p) { var i = impacto(p); return { kg: s.kg + i.kg, agua: s.agua + i.agua, co2: s.co2 + i.co2, horas: s.horas + i.horas, artesa: s.artesa + i.artesa }; }, { kg: 0, agua: 0, co2: 0, horas: 0, artesa: 0 });
  }
  function calcFrete(cep, ids, subtotal) {
    var d = String(cep || "").replace(/\D/g, "");
    if (d.length !== 8) return null;
    var z = CFG.frete.zonas[d[0]];
    if (!z) return null;
    var valor = z.valor + Math.max(ids.length - 1, 0) * CFG.frete.adicionalPorPeca;
    var gratis = subtotal >= CFG.frete.gratisAcimaDe;
    return { zona: z.nome, prazo: z.prazo, valor: gratis ? 0 : valor, gratis: gratis };
  }
  function novoId() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return "EM" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  var linkPeca = function (id) { return location.href.split("#")[0] + "#/peca/" + id; };

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  /* ---------- componentes ---------- */
  function badge(p) {
    if (vendida(p.id)) return '<span class="badge sold">Vendida</span>';
    if (noCarrinho(p.id)) return '<span class="badge mine">No seu carrinho</span>';
    return '<span class="badge">Peça única</span>';
  }
  function card(p) {
    var a = artesaDe(p.artesa), v = vendida(p.id), c = noCarrinho(p.id);
    return '<article class="card' + (v ? " is-sold" : "") + '">' +
      '<a class="card-art" href="#/peca/' + p.id + '" aria-label="Ver a história de ' + esc(p.nome) + '">' + EcoArt.drawPiece(p) + badge(p) + "</a>" +
      '<div class="card-body"><p class="muted small">' + esc(p.categoria) + " · " + p.id + "</p>" +
      '<h3><a href="#/peca/' + p.id + '">' + esc(p.nome) + "</a></h3>" +
      '<p class="by"><span class="avatar" aria-hidden="true">' + iniciais(a.nome) + "</span> Feita por <strong>" + esc(a.nome.split(" ")[0]) + "</strong> · " + num(p.horas, 1) + " h de trabalho</p>" +
      '<div class="card-foot"><strong class="price">' + brl(p.preco) + "</strong>" +
      (v ? '<button class="btn small" disabled>Indisponível</button>' :
        c ? '<button class="btn small ghost" data-remove="' + p.id + '">Remover</button>' :
        '<button class="btn small primary" data-add="' + p.id + '">Adicionar</button>') + "</div></div></article>";
  }
  function metric(valor, rotulo, icone) {
    return '<div class="metric"><span class="m-ico" aria-hidden="true">' + icone + '</span><strong>' + valor + "</strong><span>" + rotulo + "</span></div>";
  }
  function impactoHTML(i) {
    return '<div class="metrics">' +
      metric(num(i.kg, 2) + " kg", "de tecido que não virou lixo", "♻") +
      metric(num(i.agua) + " L", "de água poupados*", "💧") +
      metric(num(i.co2, 1) + " kg", "de CO₂e evitados*", "🌱") + "</div>";
  }
  var NOTA_IMPACTO = '<p class="muted small">* Estimativas com fatores médios por kg de tecido (ver README). O Instituto publica a metodologia para evitar greenwashing.</p>';

  /* ---------- views ---------- */
  function viewHome() {
    var ps = DATA.pecas, disp = ps.filter(function (p) { return !vendida(p.id); });
    var tot = somaImpacto(ps);
    var hero = [ps[0], ps[1], ps[8]].map(function (p, i) { return '<div class="hero-piece p' + i + '">' + EcoArt.drawPiece(p) + "</div>"; }).join("");
    var cats = ["Todas"].concat(DATA.categorias).map(function (c, i) { return '<button class="chip' + (i === 0 ? " on" : "") + '" data-cat="' + c + '">' + c + "</button>"; }).join("");
    var artesas = DATA.artesas.map(function (a) {
      var n = ps.filter(function (p) { return p.artesa === a.id; }).length;
      return '<article class="artesa"><span class="avatar big" aria-hidden="true">' + iniciais(a.nome) + "</span><div><h3>" + esc(a.nome) + '</h3><p class="muted small">' + esc(a.especialidade) + " · " + a.anos + " anos no Instituto · " + n + " peças</p><p>" + esc(a.bio) + "</p></div></article>";
    }).join("");
    return '<section class="hero wrap"><div class="hero-copy"><p class="eyebrow">Moda autoral · upcycling · impacto social</p>' +
      "<h1>Cada peça tem rosto, nome e história.</h1>" +
      "<p class=\"lead\">Roupas e acessórios únicos, feitos por mulheres artesãs com tecidos que seriam descartados. Escolha a peça, veja <strong>quem a fez</strong> e o <strong>impacto real</strong> da sua compra, e pague por PIX em poucos cliques.</p>" +
      '<p><a class="btn primary" href="#pecas" data-scroll="pecas">Ver peças disponíveis</a> <a class="btn ghost" href="#como" data-scroll="como">Como funciona a rastreabilidade</a></p></div>' +
      '<div class="hero-art" aria-hidden="true">' + hero + "</div></section>" +
      '<section class="stats"><div class="wrap stats-in">' +
      '<div><strong>' + disp.length + "</strong><span>peças únicas disponíveis</span></div>" +
      "<div><strong>" + num(tot.kg, 1) + " kg</strong><span>de tecido salvos do descarte</span></div>" +
      "<div><strong>" + DATA.artesas.length + "</strong><span>artesãs com nome e história</span></div>" +
      "<div><strong>45%</strong><span>do preço vai direto para quem fez</span></div></div></section>" +
      '<section id="como" class="wrap section"><h2>Transparência que dá para conferir</h2>' +
      '<p class="lead narrow">Marcas de fast-fashion lançam coleções “verdes” sem provar nada. Aqui, cada peça carrega uma etiqueta com QR Code que leva para a página dela.</p>' +
      '<ol class="steps"><li><span>1</span><h3>Escaneie a etiqueta</h3><p>O QR Code costurado na peça abre esta página, no celular, na feira ou na loja.</p></li>' +
      '<li><span>2</span><h3>Conheça quem fez</h3><p>Nome, história e especialidade da artesã, mais as horas de trabalho dedicadas à peça.</p></li>' +
      '<li><span>3</span><h3>Veja os números</h3><p>Origem do tecido, quilos reaproveitados, água e CO₂ estimados e quanto da sua compra chega à artesã.</p></li></ol></section>' +
      '<section id="pecas" class="wrap section"><div class="sec-head"><h2>Peças únicas</h2><div class="tools"><div class="chips" role="group" aria-label="Filtrar por categoria">' + cats + "</div>" +
      '<label class="sel"><span class="sr">Ordenar</span><select id="sort"><option value="">Ordenar: destaque</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option><option value="impacto">Maior impacto</option></select></label></div></div>' +
      '<div class="grid" id="grid">' + ps.map(card).join("") + "</div></section>" +
      '<section id="artesas" class="wrap section"><h2>Quem faz cada peça</h2><div class="artesas">' + artesas + "</div></section>" +
      '<section class="wrap section"><h2>Selo verde x prova real</h2><div class="compare"><div><h3>Greenwashing</h3><ul><li>“Coleção consciente” sem números</li><li>Ninguém sabe quem costurou</li><li>Origem do tecido desconhecida</li></ul></div>' +
      '<div class="good"><h3>EcoModa</h3><ul><li>Kg de tecido, água e CO₂ por peça</li><li>Artesã com nome e história</li><li>Origem do tecido e divisão do preço</li></ul></div></div></section>';
  }

  function viewCheckout() {
    var ids = pruneCart().map(function (i) { return i.id; });
    if (!ids.length) return '<section class="wrap section narrow"><h1>Seu carrinho está vazio</h1><p class="lead">Escolha uma peça única para continuar.</p><a class="btn primary" href="#pecas">Ver peças</a></section>';
    var ps = ids.map(pecaDe), sub = ps.reduce(function (s, p) { return s + p.preco; }, 0);
    var rows = ps.map(function (p) { return '<li><span class="thumb">' + EcoArt.drawPiece(p) + "</span><span>" + esc(p.nome) + "<br><small class=\"muted\">" + p.id + "</small></span><strong>" + brl(p.preco) + "</strong></li>"; }).join("");
    return '<section class="wrap section checkout"><div><h1>Finalizar compra</h1>' +
      '<form id="form" novalidate autocomplete="on">' +
      '<fieldset><legend>Seus dados</legend>' +
      field("nome", "Nome completo", "text", "name") + '<div class="two">' + field("email", "E-mail", "email", "email") + field("tel", "WhatsApp", "tel", "tel", "(41) 90000-0000") + "</div></fieldset>" +
      '<fieldset><legend>Entrega</legend><div class="two">' + field("cep", "CEP", "text", "postal-code", "00000-000") + '<p id="freteInfo" class="muted frete-info" aria-live="polite">Informe o CEP para calcular o frete.</p></div>' +
      field("rua", "Endereço", "text", "address-line1") + '<div class="three">' + field("numero", "Número", "text", "off") + field("cidade", "Cidade", "text", "address-level2") + field("uf", "UF", "text", "address-level1") + "</div></fieldset>" +
      '<fieldset><legend>Pagamento</legend><p class="pay"><span class="pix-logo">PIX</span> Você recebe o QR Code e o código “copia e cola” logo após confirmar o pedido.</p></fieldset>' +
      '<button class="btn primary big" type="submit">Confirmar pedido e gerar PIX</button></form></div>' +
      '<aside class="summary"><h2>Resumo</h2><ul class="lines">' + rows + "</ul>" +
      '<dl><div><dt>Subtotal</dt><dd>' + brl(sub) + '</dd></div><div><dt>Frete</dt><dd id="sFrete">a calcular</dd></div><div class="total"><dt>Total</dt><dd id="sTotal">' + brl(sub) + "</dd></div></dl>" +
      '<p class="muted small">Frete grátis acima de ' + brl(CFG.frete.gratisAcimaDe) + ". Peças únicas ficam reservadas por " + CFG.reservaMinutos + " minutos.</p></aside></section>";
  }
  function field(id, label, type, ac, ph) {
    return '<label class="f" for="' + id + '"><span>' + label + '</span><input id="' + id + '" name="' + id + '" type="' + type + '" autocomplete="' + ac + '" ' + (ph ? 'placeholder="' + ph + '" ' : "") + 'required><em class="err" id="e-' + id + '"></em></label>';
  }

  function viewPedido(id) {
    var o = getOrders().filter(function (x) { return x.id === id; })[0];
    if (!o) return '<section class="wrap section narrow"><h1>Pedido não encontrado</h1><p class="lead">Os pedidos desta demonstração ficam salvos apenas neste navegador.</p><a class="btn primary" href="#/">Voltar à loja</a></section>';
    var ps = o.itens.map(pecaDe), imp = somaImpacto(ps);
    var pix = EcoPix.gerarPix(CFG.pix, o.total, o.id);
    var msg = encodeURIComponent("Olá! Fiz o pedido " + o.id + " (" + brl(o.total) + ") e estou enviando o comprovante do PIX.");
    var stLabel = { aguardando_pagamento: "Aguardando pagamento", pago: "Pagamento confirmado", enviado: "Enviado", cancelado: "Cancelado" }[o.status];
    return '<section class="wrap section order"><p class="eyebrow">Pedido ' + o.id + '</p><h1>Obrigada, ' + esc(o.cliente.nome.split(" ")[0]) + "!</h1>" +
      '<p class="lead">Status: <span class="status s-' + o.status + '">' + stLabel + "</span></p>" +
      '<div class="order-grid"><div class="pixbox"><h2>Pague com PIX</h2><div class="qr">' + EcoQR.toSVG(pix, { size: 220, label: "QR Code do PIX do pedido " + o.id }) + "</div>" +
      '<p class="amount">' + brl(o.total) + '</p><label class="f"><span>PIX copia e cola</span><textarea id="pixcode" readonly rows="4">' + pix + '</textarea></label>' +
      '<p><button class="btn primary" id="copy">Copiar código</button> <a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + CFG.loja.whatsapp + "?text=" + msg + '">Enviar comprovante</a></p>' +
      '<p class="muted small">Ambiente de demonstração: a chave PIX é fictícia e nenhum pagamento real é processado.</p></div>' +
      '<div><div class="cert"><p class="eyebrow">Certificado de impacto</p><h2>Sua compra em números</h2>' + impactoHTML(imp) +
      "<p><strong>" + brl(imp.artesa) + "</strong> deste pedido vão direto para as artesãs: " + num(imp.horas, 1) + " horas de trabalho justo.</p>" + NOTA_IMPACTO +
      '<ul class="lines">' + ps.map(function (p) { var a = artesaDe(p.artesa); return "<li><span class=\"thumb\">" + EcoArt.drawPiece(p) + "</span><span>" + esc(p.nome) + "<br><small class=\"muted\">Feita por " + esc(a.nome) + "</small></span><strong>" + brl(p.preco) + "</strong></li>"; }).join("") + "</ul>" +
      '<dl><div><dt>Frete (' + esc(o.freteZona) + ')</dt><dd>' + (o.frete ? brl(o.frete) : "Grátis") + '</dd></div><div class="total"><dt>Total</dt><dd>' + brl(o.total) + '</dd></div></dl></div>' +
      '<p><button class="btn ghost" onclick="window.print()">Imprimir certificado</button> <a class="btn ghost" href="#/">Continuar comprando</a></p></div></div></section>';
  }

  function viewPainel() {
    var os = getOrders(), ativos = os.filter(function (o) { return o.status !== "cancelado"; });
    var pagos = os.filter(function (o) { return o.status === "pago" || o.status === "enviado"; });
    var receita = pagos.reduce(function (s, o) { return s + o.total - o.frete; }, 0);
    var imp = somaImpacto([].concat.apply([], pagos.map(function (o) { return o.itens.map(pecaDe); })));
    var linhas = os.slice().reverse().map(function (o) {
      return "<tr><td data-l=\"Pedido\"><strong>" + o.id + "</strong><br><small class=\"muted\">" + new Date(o.criadoEm).toLocaleString("pt-BR") + "</small></td>" +
        "<td data-l=\"Cliente\">" + esc(o.cliente.nome) + "<br><small class=\"muted\">" + esc(o.cliente.tel) + "</small></td>" +
        "<td data-l=\"Peças\">" + o.itens.join(", ") + "</td><td data-l=\"Total\">" + brl(o.total) + "</td>" +
        "<td data-l=\"Status\"><select data-order=\"" + o.id + "\" aria-label=\"Status do pedido " + o.id + "\">" +
        ["aguardando_pagamento", "pago", "enviado", "cancelado"].map(function (s) { return '<option value="' + s + '"' + (s === o.status ? " selected" : "") + ">" + { aguardando_pagamento: "Aguardando pagamento", pago: "Pago", enviado: "Enviado", cancelado: "Cancelado" }[s] + "</option>"; }).join("") + "</select></td>" +
        '<td data-l="Ver"><a href="#/pedido/' + o.id + '">abrir</a></td></tr>';
    }).join("");
    var estoque = DATA.pecas.map(function (p) {
      return "<tr><td data-l=\"Código\">" + p.id + "</td><td data-l=\"Peça\">" + esc(p.nome) + "</td><td data-l=\"Artesã\">" + esc(artesaDe(p.artesa).nome) + "</td><td data-l=\"Preço\">" + brl(p.preco) + "</td><td data-l=\"Situação\">" + (vendida(p.id) ? '<span class="status s-pago">Vendida</span>' : '<span class="status s-enviado">Disponível</span>') + "</td></tr>";
    }).join("");
    return '<section class="wrap section"><p class="eyebrow">Painel da Sofia · demonstração</p><h1>Pedidos e estoque</h1>' +
      '<p class="lead narrow">Tudo o que hoje consome horas no Instagram acontece sozinho: a peça some da vitrine quando vendida, o frete é calculado e o PIX já sai com o valor certo. Aqui a equipe só acompanha e confirma.</p>' +
      '<div class="kpis"><div><strong>' + ativos.length + "</strong><span>pedidos ativos</span></div><div><strong>" + brl(receita) + "</strong><span>vendido (pago)</span></div><div><strong>" + brl(imp.artesa) + "</strong><span>repassado às artesãs</span></div><div><strong>" + num(imp.kg, 1) + " kg</strong><span>de tecido reaproveitado</span></div></div>" +
      '<div class="sec-head"><h2>Pedidos</h2><button class="btn ghost small" id="csv">Exportar CSV</button></div>' +
      (linhas ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Cliente</th><th>Peças</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' + linhas + "</tbody></table></div>" : '<p class="empty">Nenhum pedido ainda. Faça uma compra na loja para ver o fluxo completo.</p>') +
      '<div class="sec-head"><h2>Estoque (peças únicas)</h2></div><div class="tablewrap"><table class="tbl"><thead><tr><th>Código</th><th>Peça</th><th>Artesã</th><th>Preço</th><th>Situação</th></tr></thead><tbody>' + estoque + "</tbody></table></div>" +
      '<p><button class="btn ghost small" id="reset">Limpar dados da demonstração</button></p></section>';
  }

  /* ---------- modal da peça ---------- */
  function openPeca(id) {
    var p = pecaDe(id), dlg = $("#modal");
    if (!p) { location.hash = "#/"; return; }
    var a = artesaDe(p.artesa), i = impacto(p), v = vendida(id), c = noCarrinho(id);
    var oficina = 0.3, inst = Math.round((1 - p.parteArtesa - oficina) * 100);
    $("#modal-body").innerHTML =
      '<div class="m-art">' + EcoArt.drawPiece(p) + badge(p) + "</div>" +
      '<div class="m-info"><p class="muted small">' + esc(p.categoria) + " · código " + p.id + "</p><h2 id=\"modal-title\">" + esc(p.nome) + "</h2>" +
      '<p class="price big">' + brl(p.preco) + "</p><p>" + esc(p.desc) + "</p>" +
      (v ? '<button class="btn" disabled>Esta peça única já foi vendida</button>' : c ? '<button class="btn ghost" data-remove="' + id + '">Remover do carrinho</button> <a class="btn primary" href="#/checkout">Finalizar</a>' : '<button class="btn primary big" data-add="' + id + '">Adicionar ao carrinho</button>') +
      '<h3>Quem fez</h3><div class="who"><span class="avatar big" aria-hidden="true">' + iniciais(a.nome) + "</span><div><strong>" + esc(a.nome) + ", " + a.idade + ' anos</strong><br><span class="muted small">' + esc(a.especialidade) + " · " + a.anos + " anos no Instituto</span><p>" + esc(a.bio) + "</p></div></div>" +
      "<h3>De onde veio o tecido</h3><p>" + esc(p.tecido) + ".</p>" +
      "<h3>Impacto desta peça</h3>" + impactoHTML(i) + NOTA_IMPACTO +
      "<h3>Para onde vai o seu dinheiro</h3>" +
      '<div class="split" role="img" aria-label="Divisão do preço"><span style="width:' + p.parteArtesa * 100 + '%" class="s1">Artesã ' + Math.round(p.parteArtesa * 100) + '%</span><span style="width:' + oficina * 100 + '%" class="s2">Oficina 30%</span><span style="width:' + inst + '%" class="s3">Projeto ' + inst + "%</span></div>" +
      "<p class=\"small muted\">" + brl(i.artesa) + " desta peça vão direto para " + esc(a.nome.split(" ")[0]) + " (" + num(p.horas, 1) + " h de trabalho).</p>" +
      '<h3>Etiqueta da peça</h3><div class="tag"><div class="qr sm">' + EcoQR.toSVG(linkPeca(id), { size: 110, label: "QR Code da peça " + id }) + "</div><p class=\"small muted\">Este QR Code vai costurado na etiqueta física: quem escaneia chega nesta página, na feira ou depois da compra.</p></div></div>";
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
    dlg.scrollTop = 0;
  }
  function closeModal() { var d = $("#modal"); if (d.open) d.close(); }

  /* ---------- carrinho (gaveta) ---------- */
  function renderCart() {
    var c = pruneCart(), ps = c.map(function (i) { return pecaDe(i.id); }), sub = ps.reduce(function (s, p) { return s + p.preco; }, 0);
    $("#cartCount").textContent = c.length;
    $("#cartCount").hidden = !c.length;
    var left = c.length ? Math.max(0, CFG.reservaMinutos * 60 - Math.floor((Date.now() - Math.min.apply(null, c.map(function (i) { return i.ts; }))) / 1000)) : 0;
    $("#cartBody").innerHTML = c.length ?
      '<ul class="lines">' + ps.map(function (p) { return '<li><span class="thumb">' + EcoArt.drawPiece(p) + "</span><span>" + esc(p.nome) + '<br><small class="muted">Feita por ' + esc(artesaDe(p.artesa).nome.split(" ")[0]) + '</small></span><span><strong>' + brl(p.preco) + '</strong><br><button class="link" data-remove="' + p.id + '">remover</button></span></li>'; }).join("") + "</ul>" +
      '<p class="reserva" id="timer">Peças reservadas por mais ' + String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0") + "</p>" +
      '<p class="subtotal"><span>Subtotal</span><strong>' + brl(sub) + "</strong></p><a class=\"btn primary big\" href=\"#/checkout\" data-close>Ir para o pagamento</a>" :
      '<p class="empty">Seu carrinho está vazio.<br>Cada peça é única: quando alguém compra, ela sai da vitrine.</p>';
  }
  function openCart(open) {
    var d = $("#drawer"); d.classList.toggle("open", open); d.setAttribute("aria-hidden", String(!open));
    $("#scrim").classList.toggle("on", open); if (open) { renderCart(); $("#drawerClose").focus(); }
  }

  /* ---------- ações ---------- */
  function add(id) {
    if (vendida(id)) return toast("Essa peça única já foi vendida.");
    var c = getCart(); if (c.some(function (i) { return i.id === id; })) return;
    c.push({ id: id, ts: Date.now() }); store.set("cart", c);
    if ($("#modal").open) { closeModal(); history.replaceState(null, "", "#/"); } // o <dialog> fica acima da gaveta
    refresh(); toast("Adicionada ao carrinho. Reservada por " + CFG.reservaMinutos + " minutos."); openCart(true);
  }
  function remove(id) { store.set("cart", getCart().filter(function (i) { return i.id !== id; })); refresh(); }
  function refresh() {
    renderCart();
    var g = $("#grid"); if (g) applyGrid();
    var m = $("#modal"); if (m.open) openPeca(location.hash.split("/")[2]);
  }

  var catAtual = "Todas";
  function applyGrid() {
    var sort = ($("#sort") || {}).value || "", ps = DATA.pecas.filter(function (p) { return catAtual === "Todas" || p.categoria === catAtual; });
    if (sort === "menor") ps.sort(function (a, b) { return a.preco - b.preco; });
    if (sort === "maior") ps.sort(function (a, b) { return b.preco - a.preco; });
    if (sort === "impacto") ps.sort(function (a, b) { return b.kg - a.kg; });
    $("#grid").innerHTML = ps.map(card).join("");
  }

  function setupCheckout() {
    var f = $("#form"); if (!f) return;
    var ids = getCart().map(function (i) { return i.id; }), sub = ids.map(pecaDe).reduce(function (s, p) { return s + p.preco; }, 0), frete = null;
    var cep = $("#cep");
    function upd() {
      frete = calcFrete(cep.value, ids, sub);
      $("#freteInfo").textContent = frete ? frete.zona + " · " + frete.prazo + " · " + (frete.gratis ? "frete grátis" : brl(frete.valor)) : (cep.value.replace(/\D/g, "").length === 8 ? "Não atendemos esse CEP ainda." : "Informe o CEP para calcular o frete.");
      $("#sFrete").textContent = frete ? (frete.gratis ? "Grátis" : brl(frete.valor)) : "a calcular";
      $("#sTotal").textContent = brl(sub + (frete ? frete.valor : 0));
    }
    cep.addEventListener("input", function () {
      var d = cep.value.replace(/\D/g, "").slice(0, 8); cep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; upd();
      if (d.length === 8) { // preenchimento opcional via ViaCEP (API pública, sem chave); falha silenciosa
        var ctl = window.AbortController ? new AbortController() : null; var to = setTimeout(function () { ctl && ctl.abort(); }, 4000);
        fetch("https://viacep.com.br/ws/" + d + "/json/", ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); }).then(function (j) {
          if (j && !j.erro) { if (!$("#rua").value) $("#rua").value = j.logradouro || ""; if (!$("#cidade").value) $("#cidade").value = j.localidade || ""; if (!$("#uf").value) $("#uf").value = j.uf || ""; }
        }).catch(function () {}).then(function () { clearTimeout(to); });
      }
    });
    $("#tel").addEventListener("input", function (e) {
      var d = e.target.value.replace(/\D/g, "").slice(0, 11);
      e.target.value = d.length > 6 ? "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4) : d.length > 2 ? "(" + d.slice(0, 2) + ") " + d.slice(2) : d;
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = {}, ok = true;
      ["nome", "email", "tel", "cep", "rua", "numero", "cidade", "uf"].forEach(function (k) { v[k] = f[k].value.trim(); $("#e-" + k).textContent = ""; });
      function bad(k, m) { $("#e-" + k).textContent = m; if (ok) f[k].focus(); ok = false; }
      if (v.nome.split(" ").filter(Boolean).length < 2) bad("nome", "Informe nome e sobrenome.");
      if (!/^\S+@\S+\.\S+$/.test(v.email)) bad("email", "E-mail inválido.");
      if (v.tel.replace(/\D/g, "").length < 10) bad("tel", "Informe DDD e número.");
      if (!frete) bad("cep", "CEP inválido ou fora da área de entrega.");
      ["rua", "numero", "cidade"].forEach(function (k) { if (!v[k]) bad(k, "Obrigatório."); });
      if (!/^[A-Za-z]{2}$/.test(v.uf)) bad("uf", "UF com 2 letras.");
      if (!ok) return;
      pruneCart(); var cur = getCart().map(function (i) { return i.id; });
      if (cur.length !== ids.length) { toast("Seu carrinho mudou. Revise antes de continuar."); return route(); }
      var id = novoId(), orders = getOrders();
      orders.push({ id: id, itens: cur, cliente: v, subtotal: sub, frete: frete.valor, freteZona: frete.zona, total: sub + frete.valor, status: "aguardando_pagamento", criadoEm: Date.now() });
      store.set("orders", orders); store.set("cart", []); renderCart();
      location.hash = "#/pedido/" + id;
    });
  }

  function csv() {
    var linhas = [["pedido", "data", "cliente", "whatsapp", "cidade", "uf", "pecas", "subtotal", "frete", "total", "status"]].concat(getOrders().map(function (o) {
      return [o.id, new Date(o.criadoEm).toISOString(), o.cliente.nome, o.cliente.tel, o.cliente.cidade, o.cliente.uf, o.itens.join(" "), o.subtotal, o.frete, o.total, o.status];
    }));
    var txt = linhas.map(function (r) { return r.map(function (c) { c = String(c); if (/^[=+\-@]/.test(c)) c = "'" + c; return '"' + c.replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv" })); a.download = "pedidos-ecomoda.csv"; a.click();
  }

  /* ---------- roteador ---------- */
  var viewKey = "";
  function route() {
    var h = location.hash.replace(/^#\/?/, ""), parts = h.split("/"), app = $("#app");
    var nav = parts[0];
    $$(".nav a[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === (nav === "painel" ? "painel" : "loja")); });
    if (nav === "checkout" || nav === "pedido" || nav === "painel") {
      closeModal(); var key = h;
      app.innerHTML = nav === "checkout" ? viewCheckout() : nav === "pedido" ? viewPedido(parts[1]) : viewPainel();
      viewKey = key; window.scrollTo(0, 0); if (nav === "checkout") setupCheckout();
      document.title = { checkout: "Finalizar compra", pedido: "Pedido " + (parts[1] || ""), painel: "Painel" }[nav] + " · EcoModa";
      return;
    }
    if (viewKey !== "home") { app.innerHTML = viewHome(); viewKey = "home"; window.scrollTo(0, 0); }
    document.title = "Instituto EcoModa · moda sustentável com rastreabilidade";
    if (nav === "peca" && parts[1]) { openPeca(parts[1]); document.title = (pecaDe(parts[1]) || { nome: "Peça" }).nome + " · EcoModa"; } else closeModal();
  }

  /* ---------- eventos globais ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-add],[data-remove],[data-cat],[data-scroll],[data-close],#copy,#csv,#reset");
    if (!t) return;
    if (t.hasAttribute("data-add")) add(t.getAttribute("data-add"));
    else if (t.hasAttribute("data-remove")) remove(t.getAttribute("data-remove"));
    else if (t.hasAttribute("data-cat")) { catAtual = t.getAttribute("data-cat"); $$(".chip").forEach(function (c) { c.classList.toggle("on", c === t); }); applyGrid(); }
    else if (t.hasAttribute("data-scroll")) { e.preventDefault(); var el = document.getElementById(t.getAttribute("data-scroll")); el && el.scrollIntoView({ behavior: "smooth" }); }
    else if (t.hasAttribute("data-close")) openCart(false);
    else if (t.id === "copy") { var ta = $("#pixcode"); ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.resolve(document.execCommand("copy"))).then(function () { toast("Código PIX copiado!"); }).catch(function () { toast("Selecione e copie o código manualmente."); }); }
    else if (t.id === "csv") csv();
    else if (t.id === "reset") { if (confirm("Apagar pedidos e carrinho salvos neste navegador?")) { store.set("orders", []); store.set("cart", []); route(); renderCart(); } }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "sort") applyGrid();
    var oid = e.target.getAttribute && e.target.getAttribute("data-order");
    if (oid) { var os = getOrders(); os.forEach(function (o) { if (o.id === oid) o.status = e.target.value; }); store.set("orders", os); route(); toast("Pedido atualizado."); }
  });
  $("#cartBtn").addEventListener("click", function () { openCart(true); });
  $("#drawerClose").addEventListener("click", function () { openCart(false); });
  $("#scrim").addEventListener("click", function () { openCart(false); });
  $("#modalClose").addEventListener("click", function () { location.hash = "#/"; });
  $("#modal").addEventListener("click", function (e) { if (e.target === this) location.hash = "#/"; });
  $("#modal").addEventListener("cancel", function (e) { e.preventDefault(); location.hash = "#/"; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") openCart(false); });
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", function () { renderCart(); route(); });
  setInterval(function () { if ($("#drawer").classList.contains("open") || getCart().length) renderCart(); }, 1000);

  $("#year").textContent = new Date().getFullYear();
  renderCart(); route();
})();
