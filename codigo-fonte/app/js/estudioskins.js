// Aero - (1.0.0) O ESTÚDIO DE SKINS (Donator e Supporter): monta um .aer sem escrever código. Cores e fundo, o aviso de ligação
// (lugar, tamanho, cantos, fundo e as cores dos botões; atender e recusar nunca somem), os sons do app, uma fonte (arquivo ou uma
// instalada no PC, só se a licença dela deixa embutir), a animação das letras, o lugar da lista, a tela de boas-vindas e um CSS a mais.
// Tudo passa pelas mesmas travas de um .aer de fora (o Estúdio monta o arquivo e o abre como qualquer outro). Quem não tem o plano
// mexe em tudo e vê ao vivo (só ele vê), mas instalar e exportar ficam para o Donator.
(() => {
  'use strict';
  const A = window.Aero, T = A.T, h = A.h;
  const E = A.estudio || (A.estudio = {});
  const NIVEL = 3;
  const SONS = {
    click: ['Clique', 'Click'], hover: ['Passar o mouse', 'Hover'], foco: ['Foco num campo', 'Field focus'], 'menu-item': ['Item de menu', 'Menu item'],
    sucesso: ['Deu certo', 'Success'], erro: ['Erro', 'Error'], bolha: ['Bolha', 'Bubble'], abrir: ['Abrir', 'Open'], 'pop-abrir': ['Janelinha abrindo', 'Popup opening'],
    msg: ['Mensagem nova', 'New message'], estourar: ['Bolha estourando', 'Bubble pop'], grudar: ['Encaixar', 'Snap'], 'chamada-entrada': ['Ligação chegando', 'Incoming call'],
    'cham-entrou': ['Alguém entrou na chamada', 'Someone joined the call'], 'cham-entrei': ['Você entrou na chamada', 'You joined the call'],
    'tk-passar': ['Passar o mouse numa conversa', 'Hovering a chat'], 'tk-dm': ['Abrir uma conversa', 'Opening a DM'], 'tk-grupo': ['Abrir um grupo', 'Opening a group'],
    'menu-abrir': ['Menu abrindo', 'Menu opening'], 'menu-fechar': ['Menu fechando', 'Menu closing'], 'pop-fechar': ['Janelinha fechando', 'Popup closing'], fechar: ['Fechar', 'Close'],
  };
  const ANIMS = [['', 'Nenhuma', 'None'], ['onda', 'Onda', 'Wave'], ['pulo', 'Pulo', 'Bounce'], ['brilho', 'Brilho', 'Glow'], ['arcoiris', 'Arco-íris', 'Rainbow'], ['tremer', 'Tremer', 'Shake'], ['surgir', 'Surgir', 'Appear']];
  const CORES = [['cor', 'Cor principal', 'Main color'], ['cor2', 'Cor clara', 'Light color'], ['cor3', 'Cor escura', 'Dark color'], ['texto', 'Texto', 'Text'], ['fundo1', 'Fundo (em cima)', 'Background (top)'], ['fundo2', 'Fundo (embaixo)', 'Background (bottom)']];
  // pontos de partida (só mudam valores; nada aqui é código)
  const PRESETS = [
    ['limpo', T('Do zero', 'Blank'), {}],
    ['por-do-sol', T('Pôr do sol', 'Sunset'), { cores: { cor: '#ff7a45', cor2: '#ffc27a', cor3: '#e0532a', fundo1: '#ffb38a', fundo2: '#ffe3c2' }, letras: { anim: 'brilho', titulos: true, nomes: false } }],
    ['menta', T('Menta', 'Mint'), { cores: { cor: '#2fbf8f', cor2: '#8ff0cf', cor3: '#1f9a70', fundo1: '#b8f5e0', fundo2: '#effff8' } }],
    ['sakura', 'Sakura', { cores: { cor: '#e86a9a', cor2: '#ffc1d9', cor3: '#c94a7d', fundo1: '#ffd6e6', fundo2: '#fff6fa' }, letras: { anim: 'surgir', titulos: true, nomes: false } }],
    ['noite', T('Noite', 'Night'), { cores: { cor: '#7c5cff', cor2: '#b9a6ff', cor3: '#5a3fd6', texto: '#f1edff', fundo1: '#14112b', fundo2: '#2b1f55' } }],
    ['neon', 'Neon', { cores: { cor: '#ff2bd6', cor2: '#7af7ff', cor3: '#c400a8', texto: '#fbeaff', fundo1: '#1a0b2e', fundo2: '#3a0f5c' }, letras: { anim: 'arcoiris', titulos: false, nomes: true }, ligacao: { on: true, cor: '#1a0b2e', atender: '#39ff88', recusar: '#ff3b6b', raio: 30, anim: 'glitch' } }],
  ];
  const MARCA_CSS = '/* --- CSS a mais (Estúdio) --- */';
  const slug = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  const novo = () => ({
    id: '', nome: '', autor: (A.api && A.api.eu && A.api.eu.nome) || '', versao: '1', descricao: '',
    cores: {}, fundoImg: null,
    ligacao: { on: false, largura: 460, altura: 110, raio: 22, opacidade: 1, cor: '', atender: '', recusar: '', botoes: 48, img: null,
      posAtender: { x: 90, y: 50 }, posRecusar: { x: 78, y: 50 }, anim: '', imagens: [], foto: { x: 11.3, y: 50, tam: 64, forma: 'circulo' },
      nome: null, sub: null, onda: true, ondaCor: '' },
    sons: {}, fonte: null, fonteOnde: 'titulos',
    letras: { anim: '', titulos: true, nomes: false },
    regioes: { on: false, lista: 'esquerda', compacto: false },
    bv: { on: false, titulo: '', texto: '', cor: '', img: null },
    css: '',
  });

  // ---------- do estado para o arquivo ----------
  const extImg = (b) => (b.type === 'image/gif' ? 'gif' : 'webp');
  const bytes = async (b) => new Uint8Array(await b.arrayBuffer());
  const idDe = (st) => st.id || (st.id = ((slug(st.nome) || 'skin').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 7)).replace(/^-+/, ''));
  function cssDe(st) {
    const l = [];
    if (st.fundoImg) l.push('#fundo { background: var(--aer-img-fundo) center / cover no-repeat; }', '#fundo-img { visibility: hidden; }');
    if (st.fonte) {
      const fam = '"aer-principal"';
      if (st.fonteOnde === 'tudo') l.push(`body { --fonte: ${fam}, "Segoe UI", system-ui, sans-serif; font-family: var(--fonte); }`);
      else l.push(`h1, h2, h3, .nm { font-family: ${fam}, var(--fonte); }`);
    }
    const extra = String(st.css || '').trim();
    return l.join('\n') + (extra ? '\n' + MARCA_CSS + '\n' + extra : '');
  }
  async function montar(st) {
    const enc = new TextEncoder(), arq = [], sons = {}, fontes = {}, cam = {};
    const img = async (base, b) => { if (!b) return ''; const c = `imagens/${base}.${extImg(b)}`; arq.push([c, await bytes(b)]); return c; };
    if (st.fundoImg) await img('fundo', st.fundoImg);
    const cores = {}; for (const [k] of CORES) if (st.cores[k]) cores[k] = st.cores[k];
    if (Object.keys(cores).length) cam.cores = cores;
    if (st.ligacao.on) {
      const L = st.ligacao, r1 = (v) => Math.round(v * 10) / 10, imagens = [];
      for (const [n, im] of L.imagens.entries()) imagens.push({ src: await img('lig-' + (n + 1), im.blob), x: r1(im.x), y: r1(im.y), w: r1(im.w), r: Math.round(im.r), p: Math.round(im.p * 1000) / 1000, frente: !!im.frente });
      cam.ligacao = { largura: L.largura, altura: L.altura, raio: L.raio, opacidade: L.opacidade, cor: L.cor, atender: L.atender, recusar: L.recusar, botoes: L.botoes, fundo: await img('ligacao', L.img),
        livre: true, posAtender: { x: r1(L.posAtender.x), y: r1(L.posAtender.y) }, posRecusar: { x: r1(L.posRecusar.x), y: r1(L.posRecusar.y) }, anim: L.anim, imagens, foto: { x: r1(L.foto.x), y: r1(L.foto.y), tam: Math.round(L.foto.tam), forma: L.foto.forma === 'quadrado' ? 'quadrado' : 'circulo' },
        ...(L.nome && L.sub ? { nome: { x: r1(L.nome.x), y: r1(L.nome.y) }, sub: { x: r1(L.sub.x), y: r1(L.sub.y) } } : {}), onda: L.onda !== false, ondaCor: L.ondaCor || '' };
    }
    if (st.letras.anim) cam.letras = { ...st.letras };
    if (st.regioes.on) cam.regioes = { lista: st.regioes.lista, abas: 'topo', compacto: st.regioes.compacto };
    if (st.bv.on) cam.boasvindas = { titulo: st.bv.titulo, texto: st.bv.texto, cor: st.bv.cor, fundo: await img('boasvindas', st.bv.img) };
    for (const [nome, s] of Object.entries(st.sons)) { const c = `sons/${nome.replace(/[^a-z0-9_-]/g, '_')}.${s.ext}`; arq.push([c, await bytes(s.blob)]); sons[nome] = c; }
    if (st.fonte) { const c = 'fontes/principal.' + st.fonte.ext; arq.push([c, await bytes(st.fonte.blob)]); fontes.principal = c; }
    const man = { formato: 1, id: idDe(st), nome: st.nome || T('Minha skin', 'My skin'), autor: st.autor, versao: st.versao || '1', descricao: st.descricao, sons, fontes };
    const css = cssDe(st);
    return S().criarZip([['manifesto.json', enc.encode(JSON.stringify(man))], ['camadas.json', enc.encode(JSON.stringify(cam))], ...(css ? [['skin.css', enc.encode(css)]] : []), ...arq]);
  }
  // de uma skin instalada de volta para o Estúdio (só as feitas aqui voltam inteiras; as de fora voltam no que o Estúdio entende)
  function deSkin(p) {
    const st = novo(), m = p.manifesto, c = p.camadas || {}, a = p.arquivos || {};
    Object.assign(st, { id: m.id, nome: m.nome, autor: m.autor, versao: m.versao, descricao: m.descricao });
    if (c.cores) st.cores = { ...c.cores };
    for (const k of Object.keys(a)) if (/^imagens\/fundo\./.test(k)) st.fundoImg = a[k];
    if (c.ligacao) {
      const x = c.ligacao;
      for (const k of ['largura', 'altura', 'raio', 'opacidade', 'cor', 'atender', 'recusar', 'botoes', 'anim']) if (x[k] != null) st.ligacao[k] = x[k];
      if (x.livre && x.posAtender) st.ligacao.posAtender = { ...x.posAtender }; if (x.livre && x.posRecusar) st.ligacao.posRecusar = { ...x.posRecusar };
      st.ligacao.foto = x.foto ? { x: x.foto.x, y: x.foto.y, tam: x.foto.tam, forma: x.foto.forma === 'quadrado' ? 'quadrado' : 'circulo' } : { x: Math.round(5200 / (st.ligacao.largura || 460)) / 10, y: 50, tam: 64, forma: 'circulo' }; // sem foto: no lugar de sempre
      st.ligacao.nome = x.nome && x.sub ? { x: x.nome.x, y: x.nome.y } : null; st.ligacao.sub = x.nome && x.sub ? { x: x.sub.x, y: x.sub.y } : null;
      st.ligacao.onda = x.onda !== false; st.ligacao.ondaCor = x.ondaCor || '';
      st.ligacao.imagens = (x.imagens || []).filter((i) => a[i.src]).map((i) => ({ blob: a[i.src], x: i.x, y: i.y, w: i.w, r: i.r, p: i.p, frente: !!i.frente }));
      Object.assign(st.ligacao, { on: true, img: x.fundo ? a[x.fundo] || null : null });
    }
    if (c.letras) st.letras = { ...c.letras };
    if (c.regioes) st.regioes = { on: true, lista: c.regioes.lista, compacto: c.regioes.compacto };
    if (c.boasvindas) st.bv = { on: true, titulo: c.boasvindas.titulo, texto: c.boasvindas.texto, cor: c.boasvindas.cor, img: c.boasvindas.fundo ? a[c.boasvindas.fundo] || null : null };
    for (const [k, v] of Object.entries(m.sons || {})) if (a[v]) st.sons[k] = { blob: a[v], ext: v.split('.').pop(), nome: v.split('/').pop() };
    const f = Object.values(m.fontes || {})[0]; if (f && a[f]) st.fonte = { blob: a[f], ext: f.split('.').pop(), nome: Object.keys(m.fontes)[0] };
    const css = String(p.css || ''); const i = css.indexOf(MARCA_CSS);
    st.css = i >= 0 ? css.slice(i + MARCA_CSS.length).trim() : (/aer-img-fundo|aer-principal/.test(css) ? '' : css);
    if (/body \{ --fonte:/.test(css)) st.fonteOnde = 'tudo';
    return st;
  }
  const S = () => A.aer;

  // ---------- conferir os arquivos que a pessoa escolhe ----------
  const escolher = (accept) => new Promise((ok) => { const i = h('input', { type: 'file', accept }); i.onchange = () => ok(i.files[0] || null); i.click(); });
  const erro = (t) => { A.ui.toast(t, { tipo: 'erro' }); return null; };
  async function pegarImagem() {
    const f = await escolher('image/png,image/jpeg,image/webp,image/gif'); if (!f) return null;
    if (f.size > 3 * 1048576) return erro(T('A imagem passa de 3 MB.', 'The image is over 3 MB.'));
    try { const b = await S().recodificar(await bytes(f), f.name.toLowerCase()); if (!b || b.size > 3 * 1048576) return erro(T('A imagem ficou grande demais.', 'The image got too large.')); return b; } catch (e) { return erro(T('Não consegui abrir esta imagem.', 'Could not open this image.')); }
  }
  async function pegarSom() {
    const f = await escolher('audio/ogg,audio/mpeg,audio/wav,.ogg,.mp3,.wav'); if (!f) return null;
    const ext = (f.name.toLowerCase().match(/\.(ogg|mp3|wav)$/) || [])[1]; if (!ext) return erro(T('Use um som .ogg, .mp3 ou .wav.', 'Use an .ogg, .mp3 or .wav sound.'));
    if (f.size > 1048576) return erro(T('O som passa de 1 MB.', 'The sound is over 1 MB.'));
    return { blob: f, ext, nome: f.name.slice(0, 40) };
  }
  // a fonte: .woff2 (como está) ou .ttf/.otf (só se a licença deixa embutir)
  function conferirFonte(b, nome, blob) {
    const t = String.fromCharCode(b[0], b[1], b[2], b[3]);
    const ext = t === 'wOF2' ? 'woff2' : t === 'OTTO' ? 'otf' : t === 'true' || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) ? 'ttf' : t === 'ttcf' ? 'ttc' : '';
    if (!ext) return erro(T('Este arquivo não é uma fonte .woff2, .ttf ou .otf.', 'This file is not a .woff2, .ttf or .otf font.'));
    if (ext === 'ttc') return erro(T('Coleções de fontes (.ttc) não podem ser usadas.', 'Font collections (.ttc) cannot be used.'));
    if (b.length > (ext === 'woff2' ? 1 : 4) * 1048576) return erro(T('A fonte é grande demais.', 'The font is too large.'));
    if (ext !== 'woff2') { const ok = S().podeEmbutir(b); if (ok !== true) return erro(ok); }
    return { blob: new Blob([b], { type: 'font/' + ext }), ext, nome: String(nome || '').slice(0, 40) };
  }
  async function pegarFonte() { const f = await escolher('.woff2,.ttf,.otf,font/woff2,font/ttf,font/otf'); if (!f) return null; return conferirFonte(await bytes(f), f.name, f); }

  // ---------- a janela do Estúdio ----------
  E.abrirSkins = async (deId) => {
    const U = A.ui, X = A.extras, pode = () => !X || X.tem(NIVEL);
    let st = novo(), aba = 'basico', aoVivo = true, tPrevia = 0, ultimo = null, instalado = false, gen = 0;
    if (deId) { const p = await S().ler(deId); if (p) st = deSkin(p); }
    const corpo = h('div', { class: 'est-corpo' }), aviso = h('div', { class: 'peq est-erro', hidden: true });
    // a prévia ao vivo: monta o .aer de verdade e aplica (assim o que se vê é exatamente o que vai sair)
    const previa = () => { clearTimeout(tPrevia); tPrevia = setTimeout(async () => {
      const g = ++gen;
      try {
        const z = await montar(st), p = await S().abrir(await z.arrayBuffer()); if (g !== gen) return;
        ultimo = p; aviso.hidden = !p.tirados.length; aviso.textContent = p.tirados.length ? T('Partes do CSS tiradas pelas travas: ', 'CSS parts removed by the locks: ') + p.tirados.slice(0, 6).join(', ') : '';
        if (aoVivo) await S().aplicar(p);
      } catch (e) { if (g === gen) { aviso.hidden = false; aviso.textContent = e.message || String(e); } }
    }, 350); };
    const mudou = () => { previa(); if (aba === 'ligacao') desenharLig(); };

    // peças de formulário
    const linha = (rot, ...c) => h('div', { class: 'est-linha' }, h('span', { class: 'est-rot' }, rot), h('div', { class: 'est-ctl' }, ...c));
    const faixa = (rot, obj, k, min, max, passo, un = '') => { const v = h('span', { class: 'peq suave est-val' }, obj[k] + un); return linha(rot, A.ui.slider({ min, max, passo, valor: obj[k], oninput: (x) => { obj[k] = x; v.textContent = x + un; mudou(); } }), v); };
    const chave = (rot, obj, k, depois) => linha(rot, A.ui.chave(obj[k], (v) => { obj[k] = v; mudou(); depois && depois(); }));
    const texto = (rot, obj, k, max, multi) => { const i = h(multi ? 'textarea' : 'input', { class: 'campo', maxlength: max, rows: multi ? 3 : false }); i.value = obj[k] || ''; i.addEventListener('input', () => { obj[k] = i.value.slice(0, max); mudou(); }); return linha(rot, i); };
    const cor = (rot, obj, k, pad) => {
      const i = h('input', { type: 'color', value: obj[k] || pad }); i.disabled = !obj[k];
      i.addEventListener('input', () => { obj[k] = i.value.toLowerCase(); mudou(); });
      return linha(rot, A.ui.chave(!!obj[k], (v) => { obj[k] = v ? i.value.toLowerCase() : ''; i.disabled = !v; mudou(); }), i);
    };
    const imagem = (rot, get, set) => {
      const nome = h('span', { class: 'peq suave' }, get() ? T('Imagem escolhida', 'Image chosen') : T('Nenhuma', 'None'));
      return linha(rot, A.ui.btn(T('Escolher', 'Choose'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: async () => { const b = await pegarImagem(); if (b) { set(b); nome.textContent = T('Imagem escolhida', 'Image chosen'); mudou(); } } }),
        A.ui.btn('', { icone: 'fechar', tipo: 'sec', peq: true, redondo: true, titulo: T('Tirar', 'Remove'), onclick: () => { set(null); nome.textContent = T('Nenhuma', 'None'); mudou(); } }), nome);
    };
    const escolha = (rot, opcoes, valor, f) => { const s = h('select', { class: 'campo' }, ...opcoes.map(([v, pt, en]) => h('option', { value: v }, T(pt, en)))); s.value = valor; s.addEventListener('change', () => { f(s.value); mudou(); }); return linha(rot, s); };

    // ---------- o editor da tela de ligação: o aviso em tamanho de verdade (encolhido para caber), com os botões e as imagens que se
    // arrastam. Tudo em % do aviso, igual ao que o app usa depois; a prévia da animação usa as mesmas animações do app ----------
    const palco = h('div', { class: 'esk-palco' }), ctlImg = h('div', { class: 'col est-lig-ctl' });
    const urls = new Map(), urlDe = (b) => { if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); };
    const DUR = { glitch: 700, pulo: 700, piscar: 700 };
    let caixa = null, pecas = [], selImg = -1, tAnim = 0;
    const escalar = () => {
      if (!caixa) return; const L = st.ligacao, W = palco.clientWidth || 400, k = Math.min(1, (W - 24) / L.largura);
      caixa.style.transform = `scale(${k})`; caixa.style.left = Math.max(12, (W - L.largura * k) / 2) + 'px'; palco.style.height = Math.ceil(L.altura * k + 24) + 'px';
    };
    new ResizeObserver(escalar).observe(palco);
    // arrastar: guarda a distância do dedo até o centro, para a peça não pular
    const arrastavel = (el, obj, minX, maxX, minY, maxY, aoPegar, aoMover) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.button) return; e.preventDefault(); e.stopPropagation(); aoPegar && aoPegar();
        const r0 = caixa.getBoundingClientRect(), dx = (e.clientX - r0.left) / r0.width * 100 - obj.x, dy = (e.clientY - r0.top) / r0.height * 100 - obj.y;
        el.setPointerCapture(e.pointerId);
        const mover = (m) => { const r = caixa.getBoundingClientRect(); const lim = (v, a, b) => Math.min(b, Math.max(a, v));
          obj.x = lim((m.clientX - r.left) / r.width * 100 - dx, minX, maxX); obj.y = lim((m.clientY - r.top) / r.height * 100 - dy, minY, maxY);
          el.style.left = obj.x + '%'; el.style.top = obj.y + '%'; if (aoMover) aoMover(); };
        const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); el.removeEventListener('pointercancel', soltar); previa(); };
        el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
      });
    };
    function desenharLig() {
      const L = st.ligacao; clearTimeout(tAnim);
      caixa = h('div', { class: 'est-lig2', estilo: { width: L.largura + 'px', height: L.altura + 'px', 'border-radius': L.raio + 'px', opacity: L.opacidade } });
      caixa.append(h('div', { class: 'est-lig2-fundo', estilo: { background: (L.img ? `url("${urlDe(L.img)}") center / cover no-repeat, ` : '') + (L.cor || 'rgba(var(--vidro-rgb), .92)') } }));
      // (0.9.6) a foto de quem liga: arrasta para qualquer lugar, com tamanho e formato (círculo ou quadrado). O nome fica logo depois dela
      const F = L.foto, ft = S().tamFoto(L), av = h('div', { class: 'est-lig2-av' + (F.forma === 'quadrado' ? ' quadrado' : ''), titulo: T('Foto · arraste para mover', 'Photo · drag to move'),
        estilo: { left: F.x + '%', top: F.y + '%', width: ft + 'px', height: ft + 'px', margin: `${-ft / 2}px 0 0 ${-ft / 2}px`, ...(L.ondaCor ? { '--aer-lig-onda': L.ondaCor } : {}) } },
        L.onda !== false ? h('div', { class: 'tocando-ondas' }, h('i'), h('i'), h('i')) : null, U.avatar((A.api && A.api.eu) || { nome: '?' }, ft));
      const margens = () => { if (L.nome) return; txt.style.marginLeft = S().recuoNome(L) + 'px'; txt.style.marginRight = S().fimNome({ ...L, livre: true }) + 'px'; };
      arrastavel(av, F, 2, 98, 4, 96, null, () => margens());
      const tNome = h('b', { titulo: T('Nome · arraste para mover', 'Name · drag to move') }, T('Fulano', 'Someone')), tSub = h('div', { class: 'peq suave', titulo: T('Arraste para mover', 'Drag to move') }, T('Chamada de voz…', 'Voice call…'));
      const txt = h('div', { class: 'cresce est-lig2-txt' + (L.nome ? ' livre' : ''), estilo: L.nome ? {} : { 'margin-left': S().recuoNome(L) + 'px', 'margin-right': S().fimNome({ ...L, livre: true }) + 'px' } }, tNome, tSub);
      // (1.0.0) o nome e o "Chamada de voz…" se arrastam cada um para onde quiser; no primeiro arraste, os dois saem do lugar de sempre
      // exatamente de onde estavam (o outro não pula)
      const N = L.nome || { x: 0, y: 0 }, Sb = L.sub || { x: 0, y: 0 };
      const pos = (el, o) => { el.style.left = o.x + '%'; el.style.top = o.y + '%'; };
      const soltarTexto = () => {
        if (L.nome) return; const r = caixa.getBoundingClientRect(), de = (el, o) => { const q = el.getBoundingClientRect(); o.x = Math.round((q.left - r.left) / r.width * 1000) / 10; o.y = Math.round(((q.top + q.bottom) / 2 - r.top) / r.height * 1000) / 10; };
        de(tNome, N); de(tSub, Sb); L.nome = N; L.sub = Sb; txt.classList.add('livre'); txt.style.margin = '0'; pos(tNome, N); pos(tSub, Sb);
      };
      for (const [el, o] of [[tNome, N], [tSub, Sb]]) { el.addEventListener('pointerdown', (e) => { if (!e.button) soltarTexto(); }); arrastavel(el, o, 0, 92, 6, 94); if (L.nome) pos(el, o); }
      caixa.append(av, txt);
      const ims = L.imagens.map((im, i) => {
        const el = h('div', { class: 'est-lig2-img' + (im.frente ? ' frente' : '') + (i === selImg ? ' sel' : ''), titulo: T('Arraste para mover', 'Drag to move'), estilo: { left: im.x + '%', top: im.y + '%', width: im.w + '%', '--aer-r': im.r + 'deg' } },
          h('i', { estilo: { 'padding-top': im.p * 100 + '%', 'background-image': `url("${urlDe(im.blob)}")` } }));
        arrastavel(el, im, 0, 100, 0, 100, () => { if (selImg !== i) { selImg = i; caixa.querySelectorAll('.est-lig2-img').forEach((x, j) => x.classList.toggle('sel', j === i)); pintarCtlImg(); } });
        caixa.append(el); return el.firstChild;
      });
      const bt = (pos, cls, icone, corB, nome) => { const el = h('div', { class: 'est-lig2-bt ' + cls, role: 'img', 'aria-label': nome, titulo: nome + ' · ' + T('arraste para mover', 'drag to move'),
        estilo: { left: pos.x + '%', top: pos.y + '%', width: L.botoes + 'px', height: L.botoes + 'px', margin: `${-L.botoes / 2}px 0 0 ${-L.botoes / 2}px`, background: corB } }, A.icone(icone, Math.round(L.botoes * 0.42)));
        arrastavel(el, pos, 4, 96, 6, 94, null, () => margens()); caixa.append(el); return el; };
      const bR = bt(L.posRecusar, 'nao', 'desligarTel', L.recusar || 'var(--perigo, #e5484d)', T('Recusar', 'Decline'));
      const bA = bt(L.posAtender, 'ok', 'telefone', L.atender || 'var(--ok, #2fbf62)', T('Atender', 'Answer'));
      pecas = [av, txt, ...ims, bR, bA];
      palco.replaceChildren(caixa); escalar();
    }
    // a prévia da animação: entra, espera um pouco e sai (a mesma ao contrário)
    function tocarAnim() {
      const a = st.ligacao.anim; clearTimeout(tAnim); if (!a) { U.toast(T('Escolha uma animação primeiro.', 'Pick an animation first.')); return; }
      const d = DUR[a] || 500, els = pecas;
      els.forEach((el) => { el.style.animation = 'none'; }); void palco.offsetWidth;
      els.forEach((el, i) => { el.style.animation = `aerLigE-${a} ${d}ms cubic-bezier(.2,.8,.2,1) ${i * 70 + 120}ms both`; });
      tAnim = setTimeout(() => { els.forEach((el) => { el.style.animation = `aerLigS-${a} 420ms ease-in both`; });
        tAnim = setTimeout(() => { els.forEach((el) => { el.style.animation = ''; }); }, 1100); }, d + els.length * 70 + 1300);
    }
    async function addImagem() {
      const L = st.ligacao; if (L.imagens.length >= 6) return U.toast(T('Até 6 imagens.', 'Up to 6 images.'));
      const b = await pegarImagem(); if (!b) return;
      let p = 1; try { const bm = await createImageBitmap(b); p = Math.min(20, Math.max(0.05, bm.height / bm.width)); bm.close(); } catch (e) { /* fica quadrada */ }
      L.imagens.push({ blob: b, x: 50, y: 50, w: 24, r: 0, p, frente: false }); selImg = L.imagens.length - 1; pintarCtlImg(); mudou();
    }
    function pintarCtlImg() {
      const L = st.ligacao, im = L.imagens[selImg];
      const tiras = h('div', { class: 'est-lig-imgs' }, ...L.imagens.map((x, i) => h('button', { type: 'button', class: 'est-lig-mini' + (i === selImg ? ' sel' : ''), 'aria-label': T('Imagem ', 'Image ') + (i + 1),
        estilo: { 'background-image': `url("${urlDe(x.blob)}")` }, onclick: () => { selImg = i; pintarCtlImg(); desenharLig(); } })),
        L.imagens.length < 6 ? A.ui.btn(T('Adicionar imagem', 'Add image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => addImagem() }) : null);
      ctlImg.replaceChildren(tiras, ...(im ? [faixa(T('Tamanho da imagem', 'Image size'), im, 'w', 4, 100, 1, '%'), faixa(T('Girar', 'Rotate'), im, 'r', -180, 180, 1, '°'),
        chave(T('Na frente do nome', 'In front of the name'), im, 'frente'),
        linha('', A.ui.btn(T('Tirar esta imagem', 'Remove this image'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => { L.imagens.splice(selImg, 1); selImg = -1; pintarCtlImg(); mudou(); } }))] : []));
    }

    // ---------- as abas ----------
    const ABAS = {
      basico: () => {
        const preset = h('select', { class: 'campo' }, h('option', { value: '' }, T('Escolher...', 'Choose...')), ...PRESETS.map(([id, nome]) => h('option', { value: id }, nome)));
        preset.addEventListener('change', () => {
          const p = PRESETS.find((x) => x[0] === preset.value); if (!p) return; const base = { id: st.id, nome: st.nome, autor: st.autor, versao: st.versao, descricao: st.descricao };
          st = Object.assign(novo(), base); const d = p[2]; if (d.cores) st.cores = { ...d.cores }; if (d.letras) st.letras = { ...d.letras }; if (d.ligacao) Object.assign(st.ligacao, d.ligacao);
          pintar(); mudou();
        });
        const instaladas = h('select', { class: 'campo' }, h('option', { value: '' }, T('Escolher...', 'Choose...')));
        S().lista().then((l) => { for (const p of l) instaladas.append(h('option', { value: p.manifesto.id }, p.manifesto.nome)); });
        instaladas.addEventListener('change', async () => { const p = instaladas.value && (await S().ler(instaladas.value)); if (p) { st = deSkin(p); pintar(); mudou(); } });
        return [texto(T('Nome', 'Name'), st, 'nome', 40), texto(T('Autor', 'Author'), st, 'autor', 40), texto(T('Versão', 'Version'), st, 'versao', 12), texto(T('Descrição', 'Description'), st, 'descricao', 600, true),
          linha(T('Começar de um modelo', 'Start from a preset'), preset), linha(T('Editar uma instalada', 'Edit an installed one'), instaladas)];
      },
      cores: () => [
        h('p', { class: 'peq suave est-dica' }, T('As cores entram por cima das da Aparência só enquanto a skin estiver em uso.', 'Colors go over your Appearance colors only while the skin is in use.')),
        ...CORES.map(([k, pt, en]) => cor(T(pt, en), st.cores, k, k.startsWith('fundo') ? '#d8f3ff' : k === 'texto' ? '#0b3b5b' : '#2d9ee0')),
        imagem(T('Imagem de fundo', 'Background image'), () => st.fundoImg, (b) => { st.fundoImg = b; }),
      ],
      ligacao: () => {
        const L = st.ligacao; setTimeout(desenharLig); pintarCtlImg();
        return [chave(T('Mudar a tela de ligação', 'Change the call screen'), L, 'on'),
          h('p', { class: 'peq suave est-dica' }, T('Arraste a foto, o nome, o "Chamada de voz…", os botões de atender e recusar e as imagens para onde quiser. Os botões sempre ficam por cima de tudo.', 'Drag the photo, the name, the "Voice call…" text, the answer and decline buttons and the images wherever you want. The buttons always stay on top of everything.')),
          palco, ctlImg,
          escolha(T('Animação (entra e sai)', 'Animation (in and out)'), S().ANIM_LIG, L.anim, (v) => { L.anim = v; if (v) setTimeout(tocarAnim, 60); }),
          linha('', A.ui.btn(T('Ver animação', 'Play animation'), { icone: 'play', tipo: 'sec', peq: true, onclick: () => tocarAnim() })),
          faixa(T('Largura', 'Width'), L, 'largura', 300, 640, 10, 'px'), faixa(T('Altura', 'Height'), L, 'altura', 96, 360, 2, 'px'),
          faixa(T('Cantos', 'Corners'), L, 'raio', 0, 40, 1, 'px'), faixa(T('Opacidade', 'Opacity'), L, 'opacidade', 0.5, 1, 0.05),
          faixa(T('Tamanho dos botões', 'Button size'), L, 'botoes', 36, 72, 2, 'px'),
          linha(T('Nome', 'Name'), A.ui.btn(T('Voltar para o lado da foto', 'Back next to the photo'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: () => { if (!st.ligacao.nome) return; L.nome = null; L.sub = null; mudou(); } })),
          faixa(T('Tamanho da foto', 'Photo size'), L.foto, 'tam', 32, 160, 2, 'px'),
          chave(T('Ondas saindo da foto', 'Waves around the photo'), L, 'onda'),
          cor(T('Cor das ondas', 'Wave color'), L, 'ondaCor', '#2fbf62'),
          escolha(T('Formato da foto', 'Photo shape'), [['circulo', 'Círculo', 'Circle'], ['quadrado', 'Quadrado', 'Square']], L.foto.forma, (v) => { L.foto.forma = v; }),
          cor(T('Cor do fundo', 'Background color'), L, 'cor', '#1b2a3a'), cor(T('Botão de atender', 'Answer button'), L, 'atender', '#2fbf62'), cor(T('Botão de recusar', 'Decline button'), L, 'recusar', '#e5484d'),
          imagem(T('Imagem do fundo', 'Background image'), () => L.img, (b) => { L.img = b; })];
      },
      sons: () => [h('p', { class: 'peq suave est-dica' }, T('Cada som do app pode virar um arquivo seu (.ogg, .mp3 ou .wav, até 1 MB). O volume e o "sons desligados" continuam valendo.', 'Each app sound can become a file of yours (.ogg, .mp3 or .wav, up to 1 MB). Volume and "sounds off" still apply.')),
        ...Object.entries(SONS).map(([k, [pt, en]]) => {
          const nome = h('span', { class: 'peq suave est-val' }, st.sons[k] ? st.sons[k].nome : T('O do app', 'Default'));
          return linha(T(pt, en), A.ui.btn('', { icone: 'volume', tipo: 'sec', peq: true, redondo: true, titulo: T('Ouvir', 'Listen'), onclick: () => { if (st.sons[k]) { const a = new Audio(URL.createObjectURL(st.sons[k].blob)); a.volume = 0.6; a.onended = () => URL.revokeObjectURL(a.src); a.play().catch(() => {}); } else A.som.tocar(k); } }),
            A.ui.btn(T('Trocar', 'Replace'), { tipo: 'sec', peq: true, onclick: async () => { const s = await pegarSom(); if (s) { st.sons[k] = s; nome.textContent = s.nome; mudou(); } } }),
            A.ui.btn('', { icone: 'fechar', tipo: 'sec', peq: true, redondo: true, titulo: T('Voltar ao do app', 'Back to default'), onclick: () => { delete st.sons[k]; nome.textContent = T('O do app', 'Default'); mudou(); } }), nome);
        })],
      letras: () => {
        const nomeF = h('span', { class: 'peq suave est-val' }, st.fonte ? st.fonte.nome : T('A do app', 'Default'));
        const usar = (f) => { if (f) { st.fonte = f; nomeF.textContent = f.nome; mudou(); } };
        const busca = h('input', { class: 'campo', placeholder: T('Procurar nas fontes do PC...', 'Search PC fonts...') }), lista = h('div', { class: 'est-fontes' });
        let todas = null;
        const listar = () => { const q = busca.value.trim().toLowerCase(); lista.replaceChildren(...(todas || []).filter((f) => !q || f.family.toLowerCase().includes(q)).slice(0, 60).map((f) =>
          h('button', { type: 'button', class: 'est-fonte', estilo: { 'font-family': `"${f.family.replace(/["\\]/g, '')}"` }, onclick: async () => {
            try { const b = new Uint8Array(await (await f.blob()).arrayBuffer()); usar(conferirFonte(b, f.family)); } catch (e) { erro(T('Não consegui ler esta fonte.', 'Could not read this font.')); }
          } }, f.family))); };
        busca.addEventListener('input', listar);
        const doPc = window.queryLocalFonts ? A.ui.btn(T('Fontes do PC', 'PC fonts'), { icone: 'lupa', tipo: 'sec', peq: true, onclick: async () => {
          try { const l = await window.queryLocalFonts(), vistos = new Map(); for (const f of l) { const atual = vistos.get(f.family); if (!atual || /regular|normal/i.test(f.style)) vistos.set(f.family, f); } todas = [...vistos.values()].sort((a, b) => a.family.localeCompare(b.family)); busca.hidden = false; listar(); } catch (e) { erro(T('O sistema não deixou ver as fontes.', 'The system did not allow reading fonts.')); }
        } }) : null;
        busca.hidden = true;
        return [linha(T('Fonte', 'Font'), A.ui.btn(T('Arquivo', 'File'), { icone: 'pasta', tipo: 'sec', peq: true, onclick: async () => usar(await pegarFonte()) }), doPc,
          A.ui.btn('', { icone: 'fechar', tipo: 'sec', peq: true, redondo: true, titulo: T('Voltar à do app', 'Back to default'), onclick: () => { st.fonte = null; nomeF.textContent = T('A do app', 'Default'); mudou(); } }), nomeF),
          h('p', { class: 'peq suave est-dica' }, T('Fontes .ttf e .otf só entram se a licença delas deixa ir junto num arquivo (o Estúdio confere sozinho).', '.ttf and .otf fonts only go in if their license allows embedding (the Studio checks it).')),
          busca, lista,
          escolha(T('Onde usar', 'Where to use'), [['titulos', 'Títulos e nomes', 'Titles and names'], ['tudo', 'No app todo', 'Whole app']], st.fonteOnde, (v) => { st.fonteOnde = v; }),
          escolha(T('Animação das letras', 'Letter animation'), ANIMS, st.letras.anim, (v) => { st.letras.anim = v; }),
          chave(T('Nos títulos', 'On titles'), st.letras, 'titulos'), chave(T('Nos nomes', 'On names'), st.letras, 'nomes')];
      },
      layout: () => [chave(T('Mudar o lugar das partes', 'Change the layout'), st.regioes, 'on'),
        escolha(T('Lista de conversas', 'Chat list'), [['esquerda', 'À esquerda', 'Left'], ['direita', 'À direita', 'Right']], st.regioes.lista, (v) => { st.regioes.lista = v; }),
        chave(T('Compacto', 'Compact'), st.regioes, 'compacto'),
        h('h4', { class: 'est-sub' }, T('Tela de boas-vindas', 'Welcome screen')),
        chave(T('Mostrar ao abrir o app', 'Show when the app opens'), st.bv, 'on'), texto(T('Título', 'Title'), st.bv, 'titulo', 60), texto(T('Texto', 'Text'), st.bv, 'texto', 200, true),
        cor(T('Cor', 'Color'), st.bv, 'cor', '#ffffff'), imagem(T('Imagem', 'Image'), () => st.bv.img, (b) => { st.bv.img = b; }),
        linha('', A.ui.btn(T('Ver agora', 'Preview now'), { icone: 'olho', tipo: 'sec', peq: true, onclick: () => { if (ultimo) S().boasVindas(ultimo, document.body); } }))],
      // (1.0.3) as artes da 1.0.2 também nascem aqui: molduras da foto, anéis de voz e bolhas de arte, num pacote que vai para a Comunidade
      artes: () => {
        const v = A.cfg.v; const d = (v.estudioArtes && typeof v.estudioArtes === 'object') ? v.estudioArtes : (v.estudioArtes = { nome: '', molduras: [], aneis: [], bolhas: [] });
        for (const k of ['molduras', 'aneis', 'bolhas']) if (!Array.isArray(d[k])) d[k] = [];
        const guardar = () => { try { A.cfg.salvar(); } catch (e) { /* ok */ } pintar(); };
        const BA = A.bolhaArte;
        const nome = h('input', { class: 'campo', maxlength: 40, placeholder: T('Ex.: Coleção Sakura', 'E.g. Sakura collection') }); nome.value = d.nome || '';
        nome.addEventListener('input', () => { d.nome = nome.value.slice(0, 40); try { A.cfg.salvar(); } catch (e) { /* ok */ } });
        nome.addEventListener('keydown', (e) => e.stopPropagation());
        const fotos = (tipo) => BA && BA.estudioFotos(d.molduras, d.aneis, (mo, an) => { d.molduras = mo; d.aneis = an; guardar(); }, { tipo });
        const bolhas = () => BA && BA.estudio(d.bolhas, (b) => { d.bolhas = (b || []).filter((x) => x && x.arte); guardar(); });
        const qtd = (n, um, varios) => (n ? n + ' ' + (n === 1 ? um : varios) : T('Nenhuma ainda', 'None yet'));
        const cartao = (ic, tit, desc, n, ab) => h('div', { class: 'est-arte vidro interno' }, h('span', { class: 'est-arte-ic' }, A.icone(ic, 22)),
          h('div', { class: 'est-arte-txt' }, h('b', {}, tit), h('span', { class: 'peq suave' }, desc), h('small', { class: 'suave' }, n)),
          A.ui.btn(T('Abrir', 'Open'), { icone: 'lapis', tipo: 'sec', peq: true, onclick: ab }));
        const total = d.molduras.length + d.aneis.length + d.bolhas.length;
        const publicar = async () => {
          if (!total) { U.toast(T('Crie pelo menos uma moldura, anel ou bolha antes.', 'Make at least one frame, ring or bubble first.'), { tipo: 'erro' }); return; }
          const I = A.integ; if (!I) return;
          if (!I.publicarDoEstudio && A.abas && A.abas.integ) { try { A.abas.integ(h('div')); } catch (e) { /* ok */ } }
          if (!I.publicarDoEstudio) return;
          I.publicarDoEstudio({ nome: d.nome || ((d.molduras[0] || d.aneis[0] || d.bolhas[0]) || {}).nome || T('Minhas artes', 'My art'), molduras: d.molduras, aneis: d.aneis, bolhas: d.bolhas });
        };
        return [h('p', { class: 'peq suave est-dica' }, T('Desenhe molduras para a foto do perfil, anéis que aparecem em volta de quem fala na chamada e bolhas de conversa com a sua arte. Tudo fica guardado aqui até você publicar; publicado, qualquer pessoa usa de graça pelas Integrações.', 'Draw frames for profile photos, rings that show around whoever is talking in a call, and chat bubbles with your art. Everything stays saved here until you publish; once published, anyone can use them for free from Integrations.')),
          linha(T('Nome do pacote', 'Package name'), nome),
          h('div', { class: 'est-artes' },
            cartao('imagem', T('Molduras da foto', 'Photo frames'), T('Em volta da foto, no perfil e nas listas.', 'Around the photo, on the profile and in lists.'), qtd(d.molduras.length, T('moldura', 'frame'), T('molduras', 'frames')), () => fotos('mo')),
            cartao('mic', T('Anéis de voz', 'Voice rings'), T('Em volta da foto de quem fala na chamada.', 'Around the photo of whoever talks in a call.'), qtd(d.aneis.length, T('anel', 'ring'), T('anéis', 'rings')), () => fotos('an')),
            cartao('bolhas', T('Bolhas de arte', 'Art bubbles'), T('A bolha da conversa com moldura, fundo e personagens.', 'The chat bubble with frame, background and characters.'), qtd(d.bolhas.length, T('bolha', 'bubble'), T('bolhas', 'bubbles')), bolhas)),
          h('div', { class: 'linha est-artes-acoes' },
            A.ui.btn(T('Publicar na Comunidade', 'Publish to Community'), { icone: 'subir', peq: true, onclick: publicar }),
            total ? A.ui.btn(T('Começar de novo', 'Start over'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: async () => { if (!(await U.confirmar(T('Apagar as artes guardadas aqui?', 'Delete the art saved here?')))) return; v.estudioArtes = { nome: '', molduras: [], aneis: [], bolhas: [] }; guardar(); } }) : null),
          h('p', { class: 'peq suave est-dica' }, T('Publicar é do Supporter. As imagens vão para o servidor do Aero quando você salva no estúdio de cada uma.', 'Publishing is a Supporter perk. Images go to Aero\'s server when you save in each studio.'))];
      },
      css: () => { const i = h('textarea', { class: 'campo est-css selecionavel', rows: 12, spellcheck: 'false', placeholder: '.tk-lado { border-radius: 30px; }' }); i.value = st.css; i.addEventListener('input', () => { st.css = i.value.slice(0, 50000); mudou(); });
        return [h('p', { class: 'peq suave est-dica' }, T('Para quem sabe CSS. As mesmas travas das integrações: sem url(), sem esconder as partes de segurança, nada dentro das Configurações. As imagens da skin entram como var(--aer-img-fundo).', 'For people who know CSS. Same locks as integrations: no url(), no hiding safety parts, nothing inside Settings. Skin images come in as var(--aer-img-fundo).')), i];
      },
    };
    const NOMES = [['basico', T('Básico', 'Basics'), 'lapis'], ['cores', T('Cores', 'Colors'), 'oPaleta'], ['ligacao', T('Ligação', 'Call'), 'telefone'], ['sons', T('Sons', 'Sounds'), 'volume'], ['letras', T('Letras', 'Letters'), 'livro'], ['layout', T('Layout', 'Layout'), 'apps'], ['artes', T('Molduras e bolhas', 'Frames and bubbles'), 'imagem'], ['css', 'CSS', 'codigo']];
    function pintar() { corpo.replaceChildren(...ABAS[aba]()); }

    // ---------- guardar ----------
    const travado = () => { if (pode()) return false; A.ui.toast(T('Instalar e exportar skins do Estúdio é do Aero Bubble Donator.', 'Installing and exporting Studio skins is on Aero Bubble Donator.')); return true; };
    const pronto = async () => { clearTimeout(tPrevia); const z = await montar(st); return { z, p: await S().abrir(await z.arrayBuffer()) }; };
    const instalar = async () => {
      if (travado()) return;
      try { const { z, p } = await pronto(); p.verificado = false; p.doEstudio = 1; p.bruto = z; await S().guardar(p); instalado = true; await S().usar(p.manifesto.id); A.som.tocar('bolha-cresce'); U.toast(T('Skin instalada e em uso.', 'Skin installed and in use.'), { tipo: 'ok' }); janela.fechar(); }
      catch (e) { U.toast(e.message || String(e), { tipo: 'erro' }); }
    };
    const exportar = async () => {
      if (travado()) return;
      try { const { z, p } = await pronto(); const u = URL.createObjectURL(z); await U.baixar(u, (slug(p.manifesto.nome) || 'skin') + '.aer'); setTimeout(() => URL.revokeObjectURL(u), 30000); }
      catch (e) { U.toast(e.message || String(e), { tipo: 'erro' }); }
    };
    const vivo = h('div', { class: 'linha est-vivo' }, A.ui.chave(aoVivo, (v) => { aoVivo = v; if (v) previa(); else voltar(); }), h('span', { class: 'peq' }, T('Ver ao vivo no app', 'Live preview in the app')));
    const voltar = async () => { const id = A.cfg.v.skin; await S().aplicar(id ? await S().ler(id) : null); };

    const conteudo = h('div', { class: 'col est-skins', dados: { protegido: '1' } },
      X && X.faixaPrevia ? X.faixaPrevia(NIVEL) : null,
      U.seg(NOMES, aba, (v) => { aba = v; pintar(); }), corpo, aviso, vivo);
    pintar(); previa();
    const janela = U.modal(T('Estúdio de skins', 'Skin Studio'), conteudo, { largura: 720, classe: 'est-modal', aoFechar: () => { clearTimeout(tPrevia); gen++; clearTimeout(tAnim); urls.forEach((u) => URL.revokeObjectURL(u)); if (!instalado) voltar(); },
      acoes: [{ texto: T('Exportar .aer', 'Export .aer'), tipo: 'sec', icone: 'download', onclick: () => exportar() }, { texto: T('Instalar e usar', 'Install and use'), icone: 'ok', onclick: () => instalar() }] });
  };
})();
