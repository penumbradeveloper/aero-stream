// Aero Stream - (0.9.5) bolhas de arte: o estúdio onde artistas montam bolhas de conversa com a própria arte (PNG, JPG, WebP ou GIF) e
// o desenho delas no chat. A bolha é feita de partes:
//  - moldura: a arte vira a própria bolha. O artista marca os cantos e só o meio estica (border-image), então ela serve em qualquer tamanho;
//  - fundo: uma arte dentro da bolha, atrás do texto (cobrindo, ajustada ou repetida);
//  - personagens: até 3 artes presas num canto ou lado da bolha, saindo dela o quanto o artista quiser (o app abre espaço em volta, então
//    nunca ficam por cima de outra mensagem);
//  - cores: fundo, letra (sempre legível), contorno, cantos e espaço interno.
// Nada disso é código nem CSS de fora: são números, cores, escolhas de listas e o código (hash) de imagens guardadas no servidor do Aero
// (reconferidas aqui antes de desenhar). Os GIFs têm uma versão parada, usada no modo otimizado e por quem desligar as animações.
(() => {
  'use strict';
  const A = window.Aero, { h, T } = A;
  const BA = (A.bolhaArte = {});
  const U = () => A.ui;
  const HASH = /^[0-9a-f]{32}$/, COR6 = /^#[0-9a-f]{6}$/i;
  const CANTOS = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'], ZONAS = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
  const MAX = 4 * 1048576, LADO = 1600, MAX_BOLHAS = 6;
  const POS = { tl: 'left top', t: 'center top', tr: 'right top', l: 'left center', c: 'center', r: 'right center', bl: 'left bottom', b: 'center bottom', br: 'right bottom' };
  const inteiro = (v, a, z, p) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(a, Math.min(z, Math.round(+v))) : p);
  const umDe = (v, l, p) => (l.includes(v) ? v : p);

  // ---------- as imagens ----------
  // as do estúdio, antes de irem para o servidor (só na memória): id -> { blob, poster, url, purl }
  const locais = new Map(); let nLocal = 0;
  const imgOk = (x, local) => {
    if (!x || typeof x !== 'object') return null;
    const loc = local && typeof x.l === 'string' && locais.has(x.l);
    if (!HASH.test(x.h) && !loc) return null;
    const o = { w: inteiro(x.w, 1, LADO, 1), a: inteiro(x.a, 1, LADO, 1) };
    if (loc) o.l = x.l; else o.h = x.h;
    if (!loc && HASH.test(x.p)) o.p = x.p;
    return o;
  };
  const temParada = (i) => !!(i && (i.p || (i.l && locais.get(i.l) && locais.get(i.l).purl)));
  const servidor = () => String((A.api && A.api.servidor) || '').replace(/["\\\s]/g, '');
  const urlDe = (i, parada) => {
    if (!i) return '';
    if (i.l) { const x = locais.get(i.l); return x ? (parada && x.purl ? x.purl : x.url) : ''; }
    return servidor() + '/api/integ-arte/' + (parada && i.p ? i.p : i.h);
  };
  const css = (u) => (u ? 'url("' + u + '")' : 'none');

  // ---------- a conferência (a mesma do servidor) ----------
  BA.validar = (a, local) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
    const o = { v: 1 };
    const m = a.moldura && typeof a.moldura === 'object' ? a.moldura : null, mi = m && imgOk(m.img, local);
    if (mi) { const c = Array.isArray(m.corte) ? m.corte : []; o.moldura = { img: mi, corte: [0, 1, 2, 3].map((i) => inteiro(c[i], 0, Math.floor((i % 2 ? mi.w : mi.a) / 2), 0)), escala: inteiro(m.escala, 10, 300, 100), rep: umDe(m.rep, ['esticar', 'repetir', 'arredondar'], 'esticar') }; }
    const f = a.fundo && typeof a.fundo === 'object' ? a.fundo : null, fi = f && imgOk(f.img, local);
    if (fi) o.fundo = { img: fi, modo: umDe(f.modo, ['cobrir', 'repetir', 'ajustar'], 'cobrir'), pos: umDe(f.pos, ZONAS, 'c'), tam: inteiro(f.tam, 10, 300, 100), opac: inteiro(f.opac, 0, 100, 100) };
    const pers = (Array.isArray(a.pers) ? a.pers : []).slice(0, 3).map((x) => {
      const pi = x && typeof x === 'object' && imgOk(x.img, local); if (!pi) return null;
      return { img: pi, canto: umDe(x.canto, CANTOS, 'tr'), alt: inteiro(x.alt, 16, 140, 56), sai: inteiro(x.sai, 0, 100, 50), x: inteiro(x.x, -50, 50, 0), y: inteiro(x.y, -50, 50, 0), camada: umDe(x.camada, ['frente', 'atras'], 'frente'), onde: umDe(x.onde, ['todas', 'primeira'], 'todas') };
    }).filter(Boolean);
    if (pers.length) o.pers = pers;
    const c = a.cor && typeof a.cor === 'object' ? a.cor : {};
    o.cor = { fundo: COR6.test(c.fundo) ? c.fundo.toLowerCase() : '', opac: inteiro(c.opac, 0, 100, 85), texto: COR6.test(c.texto) ? c.texto.toLowerCase() : '' };
    o.contorno = !!a.contorno; o.cantos = inteiro(a.cantos, 0, 30, 16); o.espaco = inteiro(a.espaco, 0, 30, 0);
    if (!o.moldura && !o.fundo && !o.pers && !o.cor.fundo) return null;
    return o;
  };

  // ---------- o que quem vê escolheu (Aparência > Bolhas de conversa) ----------
  const pref = () => (A.cfg.v.bolhaArte = { ver: true, animar: true, ...(A.cfg.v.bolhaArte || {}) });
  BA.pref = (k) => pref()[k];
  BA.mudarPref = (k, v) => { pref()[k] = !!v; A.cfg.salvar(); A.evt.emit('talk:bolha', null); };

  // ---------- o desenho ----------
  const claro = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55; };
  const VARS = ['--ba-f', '--ba-t', '--ba-ts', '--ba-r', '--ba-e', '--ba-lt', '--ba-lr', '--ba-lb', '--ba-ll', '--ba-mo', '--ba-mop', '--ba-cs', '--ba-rep', '--ba-fu', '--ba-fup', '--ba-fs', '--ba-fr', '--ba-fp', '--ba-fo', '--ba-mt', '--ba-mr', '--ba-mb', '--ba-ml', '--ba-minw', '--ba-minh'];
  BA.limpar = (el) => {
    if (!el || !el.dataset || !el.dataset.ba) return;
    delete el.dataset.ba; for (const v of VARS) el.style.removeProperty(v);
    el.querySelectorAll('.ba-pe').forEach((x) => x.remove());
  };
  // devolve false quando a bolha não vale (aí fica a padrão)
  BA.aplicar = (el, bc, op = {}) => {
    BA.limpar(el);
    const a = bc && bc.m === 'arte' ? BA.validar(bc.a, op.local) : null; if (!a) return false;
    const meu = op.forcar || el.classList.contains('eu') || el.classList.contains('cx-compor');
    if (!meu && !pref().ver) return false;
    const parada = !meu && !pref().animar;
    const set = (k, v) => el.style.setProperty(k, v);
    el.dataset.bc = 'arte'; el.dataset.ba = parada ? 'parada' : '1';
    for (const v of ['--bc', '--bcf', '--bcg']) el.style.removeProperty(v);
    const c = a.cor;
    if (c.fundo) set('--ba-f', 'color-mix(in srgb, ' + c.fundo + ' ' + c.opac + '%, transparent)');
    const txt = c.texto || (c.fundo && c.opac >= 50 ? (claro(c.fundo) ? '#151515' : '#ffffff') : '');
    if (txt) set('--ba-t', txt);
    // o campo de escrever: só as cores (pelas mesmas variáveis das bolhas do app)
    if (el.classList.contains('cx-compor')) { if (c.fundo) set('--bc', c.fundo); if (txt) set('--bcf', txt); }
    if (a.contorno) { const base = txt || (document.documentElement.dataset.tema === 'escuro' ? '#ffffff' : '#151515'), o = claro(base) ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.92)'; set('--ba-ts', '0 0 2px ' + o + ', 0 0 2px ' + o + ', 0 1px 3px ' + o); }
    set('--ba-r', a.cantos + 'px'); set('--ba-e', a.espaco + 'px');
    if (a.moldura) {
      const m = a.moldura, k = m.escala / 100, [t, r, b, l] = m.corte, px = (n) => Math.round(n * k) + 'px';
      set('--ba-lt', px(t)); set('--ba-lr', px(r)); set('--ba-lb', px(b)); set('--ba-ll', px(l));
      set('--ba-mo', css(urlDe(m.img))); if (temParada(m.img)) set('--ba-mop', css(urlDe(m.img, true)));
      set('--ba-cs', t + ' ' + r + ' ' + b + ' ' + l); set('--ba-rep', { esticar: 'stretch', repetir: 'repeat', arredondar: 'round' }[m.rep]);
    }
    if (a.fundo) {
      const f = a.fundo;
      set('--ba-fu', css(urlDe(f.img))); if (temParada(f.img)) set('--ba-fup', css(urlDe(f.img, true)));
      set('--ba-fs', f.modo === 'cobrir' ? 'cover' : f.modo === 'ajustar' ? 'contain' : Math.max(8, Math.round((f.img.w * f.tam) / 100)) + 'px auto');
      set('--ba-fr', f.modo === 'repetir' ? 'repeat' : 'no-repeat'); set('--ba-fp', POS[f.pos]); set('--ba-fo', String(f.opac / 100));
    }
    // os personagens: presos à bolha do texto; o espaço que sai dela vira margem (nada fica por cima de outra mensagem)
    const alvo = el.classList.contains('cx-msg') ? [...el.querySelectorAll('.cx-txt:not(.so-figurinha)')].pop() : null;
    if (alvo && a.pers) {
      const junto = el.classList.contains('junto');
      let mt = 0, mr = 0, mb = 0, ml = 0, minw = 0, minh = 0;
      for (const p of a.pers) {
        if (p.onde === 'primeira' && junto) continue;
        const AL = p.alt, W = Math.max(8, Math.round(Math.min(AL * 3, 280, (AL * p.img.w) / p.img.a))), s = p.sai / 100, ox = Math.round((W * p.x) / 100), oy = Math.round((AL * p.y) / 100);
        const k = p.canto, ve = k === 'l' || k === 'r' ? 'm' : k[0], ho = k.length === 2 ? k[1] : k === 'l' || k === 'r' ? k : 'c';
        const st = { width: W + 'px', height: AL + 'px' }; let tx = '0px', ty = '0px';
        if (ve === 't') { st.top = Math.round(-s * AL + oy) + 'px'; mt = Math.max(mt, s * AL - oy); }
        else if (ve === 'b') { st.bottom = Math.round(-s * AL - oy) + 'px'; mb = Math.max(mb, s * AL + oy); }
        else { st.top = '50%'; ty = 'calc(-50% + ' + oy + 'px)'; minh = Math.max(minh, AL + 2 * Math.abs(oy)); }
        if (ho === 'l') { st.left = Math.round(-s * W + ox) + 'px'; ml = Math.max(ml, s * W - ox); }
        else if (ho === 'r') { st.right = Math.round(-s * W - ox) + 'px'; mr = Math.max(mr, s * W + ox); }
        else { st.left = '50%'; tx = 'calc(-50% + ' + ox + 'px)'; minw = Math.max(minw, W + 2 * Math.abs(ox)); }
        st.transform = 'translate(' + tx + ', ' + ty + ')';
        const i = h('i', { class: 'ba-pe' + (p.camada === 'atras' ? ' atras' : ''), 'aria-hidden': 'true', estilo: st });
        i.style.setProperty('--i', css(urlDe(p.img))); if (temParada(p.img)) i.style.setProperty('--ip', css(urlDe(p.img, true)));
        alvo.append(i);
      }
      const pxs = (n) => Math.max(0, Math.ceil(n)) + 'px';
      set('--ba-mt', pxs(mt)); set('--ba-mr', pxs(mr)); set('--ba-mb', pxs(mb)); set('--ba-ml', pxs(ml)); set('--ba-minw', pxs(minw)); set('--ba-minh', pxs(minh));
    }
    return true;
  };

  // uma conversinha de mentira com a bolha (no estúdio, na página da integração e na Aparência)
  BA.previa = (bc, op = {}) => {
    const eu = (A.api && A.api.eu) || { nome: T('Você', 'You') };
    const textos = op.textos || [T('Oi! Olha a minha bolha nova 🫧', 'Hi! Look at my new bubble 🫧'), T('Ela se adapta ao tamanho da mensagem: numa mensagem comprida como esta, só o meio da arte estica.', 'It adapts to the message size: in a long message like this one, only the middle of the art stretches.'), 'ok!'];
    const caixa = h('div', { class: 'ba-chat' + (op.classe ? ' ' + op.classe : '') });
    textos.forEach((t, i) => {
      const junto = i > 0;
      const m = h('div', { class: 'cx-msg' + (junto ? ' junto' : '') }, junto ? h('span', { class: 'cx-av-vazio' }) : U().avatar(eu, 34),
        h('div', { class: 'cx-conteudo' }, junto ? null : h('div', { class: 'cx-cab' }, h('b', {}, eu.apelido || eu.nome || T('Você', 'You'))), h('div', { class: 'cx-bal' }, h('div', { class: 'cx-txt' }, h('span', {}, t)))));
      if (!BA.aplicar(m, bc, { forcar: true, local: op.local })) U().aplicarBolha(m, null);
      caixa.append(m);
    });
    return caixa;
  };

  // ---------- as bolhas de arte das integrações instaladas (para escolher na Aparência) ----------
  BA.instaladas = () => {
    const v = (A.cfg.v && A.cfg.v.integ) || {}, out = [];
    for (const [chave, x] of Object.entries(v)) {
      if (!x || !x.pac || !x.com || !/^com-c-[a-f0-9]{10}$/.test(chave)) continue;
      for (const b of x.pac.bolhas || []) { const a = b && BA.validar(b.arte); if (a) out.push({ ig: x.com.id, b: b.id, nome: b.nome, de: x.pac.nome, a }); }
    }
    return out;
  };
  // usar uma bolha de arte: o servidor pega a arte do pacote publicado (nunca a que veio daqui)
  BA.usar = async (ig, b) => {
    const API = A.api, eu = API.eu || {}, cs = eu.bc && eu.bc.cs ? eu.bc.cs : undefined;
    const r = await API.salvarPerfil({ bc: { m: 'arte', ig, b, cs } });
    if (API.eu) API.eu.bc = r.bc || null;
    A.evt.emit('perfil'); A.evt.emit('talk:bolha', API.eu && API.eu.codigo);
    return r.bc;
  };

  // ---------- as imagens do estúdio ----------
  const gifAnimado = (b) => { let n = 0; for (let i = 0; i + 2 < b.length; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04 && ++n > 1) return true; return false; };
  const webpAnimado = (b) => b.length > 21 && String.fromCharCode(b[12], b[13], b[14], b[15]) === 'VP8X' && !!(b[20] & 0x02);
  const codificar = async (bmp, k, q = 0.92) => {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const em = (tipo, qq) => new Promise((r) => c.toBlob(r, tipo, qq));
    let b = await em('image/webp', q); if (!b || b.type !== 'image/webp') b = await em('image/png');
    if (b && b.size > MAX) b = (await em('image/webp', 0.72)) || b;
    return b;
  };
  // a imagem que o artista escolheu: as paradas são redesenhadas (sai qualquer coisa escondida no arquivo e fica mais leve); os GIFs e
  // WebPs animados vão como estão, com uma versão parada (o 1º quadro) para o modo otimizado
  async function prepararImagem(f) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) throw new Error(T('Use PNG, JPG, WebP ou GIF.', 'Use PNG, JPG, WebP or GIF.'));
    if (f.size > 40 * 1048576) throw new Error(T('Imagem grande demais.', 'Image too large.'));
    const bytes = new Uint8Array(await f.slice(0, Math.min(f.size, MAX + 1)).arrayBuffer());
    const animada = f.type === 'image/gif' ? gifAnimado(bytes) : f.type === 'image/webp' ? webpAnimado(bytes) : false;
    let bmp; try { bmp = await createImageBitmap(f); } catch (e) { throw new Error(T('Não consegui abrir essa imagem.', 'Could not open this image.')); }
    if (animada) {
      if (f.size > MAX) throw new Error(T('Imagem animada grande demais (até 4 MB).', 'Animated image too large (up to 4 MB).'));
      if (bmp.width > LADO || bmp.height > LADO) throw new Error(T('A imagem animada pode ter até 1600 × 1600 pixels.', 'The animated image can be up to 1600 × 1600 pixels.'));
      return { blob: f, poster: await codificar(bmp, 1), w: bmp.width, a: bmp.height };
    }
    const k = Math.min(1, LADO / Math.max(bmp.width, bmp.height));
    const blob = await codificar(bmp, k);
    if (!blob || blob.size > MAX) throw new Error(T('Imagem grande demais (até 4 MB).', 'Image too large (up to 4 MB).'));
    return { blob, w: Math.max(1, Math.round(bmp.width * k)), a: Math.max(1, Math.round(bmp.height * k)) };
  }
  const escolherImagem = () => new Promise((ok) => {
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.remove(); if (!f) { ok(null); return; }
      try {
        const x = await prepararImagem(f), id = 'l' + ++nLocal;
        locais.set(id, { blob: x.blob, poster: x.poster || null, url: URL.createObjectURL(x.blob), purl: x.poster ? URL.createObjectURL(x.poster) : '' });
        ok({ l: id, w: x.w, a: x.a });
      } catch (e) { U().toast(e.message, { tipo: 'erro' }); ok(null); }
    });
    document.body.append(inp); inp.click();
  });
  async function subir(blob) {
    const r = await fetch(servidor() + '/api/integ/arte', { method: 'POST', headers: { Authorization: 'Bearer ' + A.api.token, 'Content-Type': blob.type || 'image/png' }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || T('Não consegui enviar a imagem.', 'Could not upload the image.'));
    return d;
  }
  // manda as imagens novas e troca pelo código delas no servidor
  async function enviarImagens(arte) {
    const feitas = new Map();
    const uma = async (i) => {
      if (!i || !i.l) return i;
      if (!feitas.has(i.l)) {
        const x = locais.get(i.l); if (!x) throw new Error(T('Uma imagem se perdeu. Escolha de novo.', 'An image got lost. Pick it again.'));
        const d = await subir(x.blob), o = { h: d.h, w: d.w, a: d.a };
        if (x.poster) o.p = (await subir(x.poster)).h;
        feitas.set(i.l, o);
      }
      return feitas.get(i.l);
    };
    if (arte.moldura) arte.moldura.img = await uma(arte.moldura.img);
    if (arte.fundo) arte.fundo.img = await uma(arte.fundo.img);
    for (const p of arte.pers || []) p.img = await uma(p.img);
    return arte;
  }

  // (estúdio) o brilho médio de um pedaço da imagem local (0..1), ou null se for quase toda transparente: serve para escolher
  // sozinho uma letra clara ou escura que dê para ler em cima da arte
  async function brilho(i, corte) {
    const x = i && i.l && locais.get(i.l); if (!x) return null;
    try {
      const bmp = await createImageBitmap(x.poster || x.blob), [t, r, b, l] = corte || [0, 0, 0, 0];
      const sw = Math.max(1, bmp.width - l - r), sh = Math.max(1, bmp.height - t - b);
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, l, t, sw, sh, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data; let soma = 0, peso = 0;
      for (let k = 0; k < d.length; k += 4) { const al = d[k + 3] / 255; soma += al * (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; peso += al; }
      return peso < 256 * 0.3 ? null : soma / peso;
    } catch (e) { return null; }
  }
  // se a pessoa não escolheu a cor da letra, usa clara ou escura conforme o miolo da arte
  async function letraAuto(a, img, corte) {
    if (!a.cor || a.cor.texto) return false;
    const v = await brilho(img, corte); if (v == null) return false;
    a.cor.texto = v > 0.55 ? '#151515' : '#ffffff'; return true;
  }

  // ---------- o estúdio ----------
  // bolhas: as do pacote (as de CSS ficam como estão). aoSalvar(lista nova) com as imagens já no servidor
  BA.estudio = (bolhas, aoSalvar) => {
    const css0 = (bolhas || []).filter((b) => b && !b.arte);
    const lista = (bolhas || []).filter((b) => b && b.arte).map((b) => ({ id: b.id, nome: b.nome, arte: JSON.parse(JSON.stringify(b.arte)) }));
    const nova = () => ({ id: '', nome: T('Minha bolha', 'My bubble'), arte: { cor: { fundo: '#2d9ee0', opac: 85, texto: '' }, contorno: false, cantos: 16, espaco: 0 } });
    if (!lista.length) lista.push(nova());
    let sel = 0;
    const atual = () => lista[sel];
    const abas = h('div', { class: 'ba-abas' }), palco = h('div', { class: 'ba-palco' }), ctrl = h('div', { class: 'ba-ctrl' });
    const pintarPrevia = () => {
      const a = atual().arte;
      palco.replaceChildren(BA.previa({ m: 'arte', a }, { local: true }),
        BA.validar(a, true) ? null : h('p', { class: 'peq suave' }, T('Escolha uma moldura, um fundo, um personagem ou uma cor de fundo.', 'Pick a frame, a background, a character or a background color.')));
    };
    const pintarAbas = () => abas.replaceChildren(...lista.map((b, i) => h('button', { type: 'button', class: 'ba-aba' + (i === sel ? ' sel' : ''), onclick: () => { sel = i; tudo(); } }, b.nome || T('Sem nome', 'Untitled'))),
      lista.length + css0.length < MAX_BOLHAS ? U().btn(T('Nova bolha', 'New bubble'), { icone: 'mais', tipo: 'sec', peq: true, onclick: () => { lista.push(nova()); sel = lista.length - 1; tudo(); } }) : null);
    // peças dos controles
    const linha = (rot, ctl) => h('label', { class: 'ba-linha' }, h('span', {}, rot), ctl);
    const barra = (rot, min, max, get, put, un = '') => {
      const v = h('small', { class: 'suave ba-val' }, get() + un);
      const s = U().slider({ min, max, valor: get(), oninput: (n) => { put(n); v.textContent = n + un; pintarPrevia(); } });
      return h('label', { class: 'ba-linha' }, h('span', {}, rot), s, v);
    };
    const seg = (ops, get, put, refazer) => U().seg(ops, get(), (v) => { put(v); pintarPrevia(); if (refazer) pintarCtrl(); });
    const grade = (lista9, get, put) => {
      const g = h('div', { class: 'ba-grade', role: 'radiogroup' });
      const pintarG = () => g.replaceChildren(...ZONAS.map((z) => lista9.includes(z) ? h('button', { type: 'button', class: z === get() ? 'sel' : '', 'aria-label': z, onclick: () => { put(z); pintarG(); pintarPrevia(); } }) : h('span')));
      pintarG(); return g;
    };
    const mini = (img) => h('span', { class: 'ba-mini', estilo: { 'background-image': css(urlDe(img)) } });
    const secao = (tit, dica, ...filhos) => h('section', { class: 'ba-sec vidro interno' }, h('h4', {}, tit), dica ? h('p', { class: 'peq suave' }, dica) : null, ...filhos);
    const trocar = (aplicar) => async () => { const i = await escolherImagem(); if (i) { aplicar(i); tudo(); } };
    // o fatiador da moldura: a arte com as 4 linhas de corte (só o meio entre elas estica)
    const fatiador = (m) => {
      const caixa = h('div', { class: 'ba-fatia' }, h('img', { src: urlDe(m.img), alt: '', draggable: 'false' }));
      const linhas = ['t', 'r', 'b', 'l'].map((k) => { const l = h('i', { class: 'ba-corte ' + k }); caixa.append(l); return l; });
      const pos = () => { const [t, r, b, l] = m.corte; linhas[0].style.top = (t / m.img.a) * 100 + '%'; linhas[1].style.right = (r / m.img.w) * 100 + '%'; linhas[2].style.bottom = (b / m.img.a) * 100 + '%'; linhas[3].style.left = (l / m.img.w) * 100 + '%'; };
      pos(); caixa.pos = pos; return caixa;
    };
    function pintarCtrl() {
      const b = atual(), a = b.arte;
      a.cor = a.cor || { fundo: '', opac: 85, texto: '' };
      const nome = h('input', { class: 'campo', type: 'text', maxlength: '30', value: b.nome || '', placeholder: T('Nome da bolha', 'Bubble name') });
      nome.addEventListener('input', () => { b.nome = nome.value.slice(0, 30); pintarAbas(); });
      nome.addEventListener('keydown', (e) => e.stopPropagation());
      // moldura
      const m = a.moldura;
      const secMoldura = secao(T('Moldura', 'Frame'), T('A sua arte vira a bolha. Arraste as linhas de corte até as bordas da arte: os cantos ficam do jeito que estão e só o meio estica, então a bolha serve para qualquer mensagem.', 'Your art becomes the bubble. Move the cut lines to the edges of the art: the corners stay as they are and only the middle stretches, so it fits any message.'),
        h('div', { class: 'linha ba-botoes' }, U().btn(m ? T('Trocar imagem', 'Change image') : T('Escolher imagem', 'Pick image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: trocar((i) => {
          const c = Math.round(Math.min(i.w, i.a) / 3);
          a.moldura = { img: i, corte: [c, c, c, c], escala: Math.max(10, Math.min(100, Math.round((24 / Math.max(1, c)) * 100))), rep: 'esticar' };
          if (a.cor && !a.cor.texto) a.cor.opac = 0;
          letraAuto(a, i, a.moldura.corte).then((sim) => { if (sim) tudo(); });
        }) }), m ? U().btn(T('Tirar', 'Remove'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => { delete a.moldura; tudo(); } }) : null));
      if (m) {
        const f = fatiador(m), mexe = (i) => (n) => { m.corte[i] = n; f.pos(); };
        const lado = (i) => Math.floor((i % 2 ? m.img.w : m.img.a) / 2);
        secMoldura.append(f,
          barra(T('Corte em cima', 'Top cut'), 0, lado(0), () => m.corte[0], mexe(0), 'px'), barra(T('Corte à direita', 'Right cut'), 0, lado(1), () => m.corte[1], mexe(1), 'px'),
          barra(T('Corte embaixo', 'Bottom cut'), 0, lado(2), () => m.corte[2], mexe(2), 'px'), barra(T('Corte à esquerda', 'Left cut'), 0, lado(3), () => m.corte[3], mexe(3), 'px'),
          barra(T('Tamanho da borda', 'Border size'), 10, 300, () => m.escala, (n) => { m.escala = n; }, '%'),
          linha(T('O meio', 'The middle'), seg([['esticar', T('Estica', 'Stretch')], ['repetir', T('Repete', 'Repeat')], ['arredondar', T('Repete inteiro', 'Repeat whole')]], () => m.rep, (v) => { m.rep = v; })));
      }
      // fundo
      const fu = a.fundo;
      const secFundo = secao(T('Fundo', 'Background'), T('Uma arte dentro da bolha, atrás do texto.', 'Art inside the bubble, behind the text.'),
        h('div', { class: 'linha ba-botoes' }, U().btn(fu ? T('Trocar imagem', 'Change image') : T('Escolher imagem', 'Pick image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: trocar((i) => { a.fundo = { img: i, modo: 'cobrir', pos: 'c', tam: 100, opac: 100 }; if (!a.moldura) letraAuto(a, i).then((sim) => { if (sim) tudo(); }); }) }),
          fu ? U().btn(T('Tirar', 'Remove'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => { delete a.fundo; tudo(); } }) : null));
      if (fu) secFundo.append(
        linha(T('Jeito', 'Fit'), seg([['cobrir', T('Cobrir', 'Cover')], ['ajustar', T('Inteira', 'Whole')], ['repetir', T('Estampa', 'Pattern')]], () => fu.modo, (v) => { fu.modo = v; }, true)),
        linha(T('Posição', 'Position'), grade(ZONAS, () => fu.pos, (z) => { fu.pos = z; })),
        fu.modo === 'repetir' ? barra(T('Tamanho', 'Size'), 10, 300, () => fu.tam, (n) => { fu.tam = n; }, '%') : null,
        barra(T('Opacidade', 'Opacity'), 0, 100, () => fu.opac, (n) => { fu.opac = n; }, '%'));
      // personagens
      a.pers = a.pers || [];
      const secPers = secao(T('Personagens e enfeites', 'Characters and stickers'), T('Até 3 artes presas na bolha (num canto ou lado), saindo dela o quanto você quiser. O app abre espaço em volta, então elas nunca ficam por cima de outra mensagem.', 'Up to 3 pieces of art attached to the bubble (a corner or a side), sticking out as much as you like. The app makes room around it, so they never cover another message.'));
      a.pers.forEach((p, i) => {
        secPers.append(h('div', { class: 'ba-pers' },
          h('div', { class: 'linha ba-botoes' }, mini(p.img), h('b', { class: 'cresce' }, T('Personagem ', 'Character ') + (i + 1)),
            U().btn('', { icone: 'imagem', tipo: 'sec', peq: true, redondo: true, titulo: T('Trocar imagem', 'Change image'), onclick: trocar((im) => { p.img = im; }) }),
            U().btn('', { icone: 'lixo', tipo: 'sec', peq: true, redondo: true, titulo: T('Tirar', 'Remove'), onclick: () => { a.pers.splice(i, 1); tudo(); } })),
          linha(T('Onde', 'Where'), grade(CANTOS, () => p.canto, (z) => { p.canto = z; })),
          barra(T('Tamanho', 'Size'), 16, 140, () => p.alt, (n) => { p.alt = n; }, 'px'),
          barra(T('Quanto sai da bolha', 'How far it sticks out'), 0, 100, () => p.sai, (n) => { p.sai = n; }, '%'),
          barra(T('Ajuste para o lado', 'Nudge sideways'), -50, 50, () => p.x, (n) => { p.x = n; }),
          barra(T('Ajuste para cima/baixo', 'Nudge up/down'), -50, 50, () => p.y, (n) => { p.y = n; }),
          linha(T('Camada', 'Layer'), seg([['frente', T('Na frente', 'In front')], ['atras', T('Atrás da bolha', 'Behind the bubble')]], () => p.camada, (v) => { p.camada = v; })),
          linha(T('Aparece', 'Shows on'), seg([['todas', T('Todas as mensagens', 'Every message')], ['primeira', T('Só na primeira da sequência', 'Only the first in a row')]], () => p.onde, (v) => { p.onde = v; }))));
      });
      if (a.pers.length < 3) secPers.append(U().btn(T('Adicionar personagem', 'Add character'), { icone: 'mais', tipo: 'sec', peq: true, onclick: trocar((i) => { a.pers.push({ img: i, canto: 'tr', alt: 56, sai: 50, x: 0, y: 0, camada: 'frente', onde: 'primeira' }); }) }));
      // cores
      const c = a.cor;
      const corF = h('input', { type: 'color', class: 'bc-cor', value: c.fundo || '#2d9ee0' }), corT = h('input', { type: 'color', class: 'bc-cor', value: c.texto || '#ffffff' });
      corF.addEventListener('input', () => { c.fundo = corF.value; pintarPrevia(); });
      corT.addEventListener('input', () => { c.texto = corT.value; pintarPrevia(); });
      const secCores = secao(T('Cores e texto', 'Colors and text'), T('A letra sempre fica legível: sem uma cor escolhida, o app usa clara ou escura conforme o fundo.', 'The text always stays readable: without a chosen color, the app picks light or dark to match the background.'),
        linha(T('Cor do fundo', 'Background color'), h('div', { class: 'linha' }, U().chave(!!c.fundo, (v) => { c.fundo = v ? corF.value : ''; pintarPrevia(); }), corF)),
        barra(T('Força da cor', 'Color strength'), 0, 100, () => c.opac, (n) => { c.opac = n; }, '%'),
        linha(T('Cor da letra', 'Text color'), h('div', { class: 'linha' }, U().chave(!!c.texto, (v) => { c.texto = v ? corT.value : ''; pintarPrevia(); }), corT)),
        linha(T('Contorno na letra', 'Text outline'), U().chave(!!a.contorno, (v) => { a.contorno = v; pintarPrevia(); })),
        barra(T('Cantos', 'Corners'), 0, 30, () => a.cantos, (n) => { a.cantos = n; }, 'px'),
        barra(T('Espaço em volta do texto', 'Space around the text'), 0, 30, () => a.espaco, (n) => { a.espaco = n; }, 'px'));
      const apagar = lista.length > 1 || (bolhas || []).some((x) => x && x.arte) ? U().btn(T('Apagar esta bolha', 'Delete this bubble'), { icone: 'lixo', tipo: 'perigo', peq: true, onclick: () => { lista.splice(sel, 1); if (!lista.length) lista.push(nova()); sel = 0; tudo(); } }) : null;
      ctrl.replaceChildren(linha(T('Nome', 'Name'), nome), secMoldura, secFundo, secPers, secCores, apagar);
    }
    function tudo() { pintarAbas(); pintarCtrl(); pintarPrevia(); }
    tudo();
    let salvando = false;
    const md = U().modal(T('Estúdio de bolhas', 'Bubble studio'), h('div', { class: 'ba-est' },
      h('p', { class: 'peq suave' }, T('Monte bolhas de conversa com a sua arte (PNG, JPG, WebP ou GIF, até 4 MB e 1600 × 1600). Quem usar a sua bolha aparece assim para todo mundo nas conversas.', 'Build chat bubbles with your art (PNG, JPG, WebP or GIF, up to 4 MB and 1600 × 1600). Whoever uses your bubble shows up like this to everyone in chats.')),
      abas, h('div', { class: 'ba-corpo' }, h('div', { class: 'ba-palco-fixo' }, palco), ctrl)),
    { largura: 980, classe: 'ba-modal', acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Salvar no pacote', 'Save to package'), tipo: 'ok', onclick: async () => {
      if (salvando) return;
      const usadas = new Set(css0.map((b) => b.id)), prontas = [];
      for (const b of lista) if (!BA.validar(b.arte, true)) { U().toast(T('A bolha "' + b.nome + '" está vazia: escolha uma moldura, um fundo, um personagem ou uma cor.', 'The bubble "' + b.nome + '" is empty: pick a frame, a background, a character or a color.'), { tipo: 'erro', ms: 5000 }); return; }
      salvando = true;
      try {
        for (const b of lista) {
          const arte = await enviarImagens(BA.validar(b.arte, true));
          let id = b.id || String(b.nome || 'bolha').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 14) || 'bolha';
          if (usadas.has(id)) { let n = 2; while (usadas.has(id.slice(0, 17) + '-' + n)) n++; id = id.slice(0, 17) + '-' + n; }
          usadas.add(id);
          const ok = BA.validar(arte); if (!ok) throw new Error(T('Não consegui preparar a bolha "' + b.nome + '".', 'Could not prepare the bubble "' + b.nome + '".'));
          prontas.push({ id, nome: (b.nome || id).slice(0, 30), arte: ok });
        }
        aoSalvar([...css0, ...prontas]); md.fechar(true);
        U().toast(T('Bolhas salvas no pacote. Publique para todo mundo poder usar.', 'Bubbles saved to the package. Publish so everyone can use them.'), { tipo: 'ok', ms: 4000 });
      } catch (e) { U().toast(e.message, { tipo: 'erro', ms: 5000 }); }
      salvando = false;
    } }] });
    return md;
  };

  // ---------- a vitrine (página da integração): as bolhas de arte dela, com "Usar" ----------
  BA.vitrine = (ig, bolhas, usar) => {
    const artes = (bolhas || []).map((b) => ({ ...b, a: b && BA.validar(b.arte) })).filter((b) => b.a);
    if (!artes.length) return null;
    const grade = h('div', { class: 'ba-vitrine' });
    const pintar = () => {
      const eu = (A.api && A.api.eu && A.api.eu.bc) || {};
      grade.replaceChildren(...artes.map((b) => {
        const usando = eu.m === 'arte' && eu.ig === ig && eu.b === b.id;
        return h('div', { class: 'ba-cartao vidro interno' }, BA.previa({ m: 'arte', a: b.a }, { textos: [T('Oi! 🫧', 'Hi! 🫧'), T('Assim fica uma mensagem maior.', 'This is a longer message.')] }),
          h('div', { class: 'linha entre' }, h('b', {}, b.nome), usando ? h('span', { class: 'ig-selo ok' }, T('Em uso', 'In use'))
            : U().btn(T('Usar', 'Use'), { icone: 'ok', peq: true, onclick: async (e) => { const bt = e.currentTarget; bt.disabled = true; try { await usar(b); pintar(); } catch (er) { U().toast(er.message, { tipo: 'erro' }); bt.disabled = false; } } })));
      }));
    };
    pintar();
    return h('section', { class: 'vidro pad' }, h('h3', {}, A.icone('bolhas', 16), T('Bolhas de conversa', 'Chat bubbles')),
      h('p', { class: 'peq suave' }, T('Use uma delas e todo mundo vê as suas mensagens assim.', 'Use one and everyone sees your messages like this.')), grade);
  };
})();
