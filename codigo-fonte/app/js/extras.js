// Aero - (1.0.0) EXTRAS DO AERO BUBBLE (o lado do app). Tudo que já existia continua grátis e igual: aqui só entra o que é a mais.
// Níveis: 1 Standard, 2 Plus, 3 Donator, 4 Supporter. O servidor (servidor/src/extras.js) é quem confere e quem decide o que os
// outros veem; o app só mostra, trava com o selo do plano e deixa ver uma PRÉVIA na sua própria tela (sem pop-up, sem aviso).
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const X = (A.extras = {});
  X.PLANOS = { 1: ['standard', 'Standard'], 2: ['plus', 'Plus'], 3: ['donator', 'Donator'], 4: ['supporter', 'Supporter'] };
  const NIVEL_SELO = { standard: 1, plus: 2, donator: 3, supporter: 4, dev: 4 };
  // (1.0.0) desenvolvedor = sem restrição nenhuma (nível 4), mesmo quando a resposta do servidor ainda não traz o "nivel"
  X.nivel = () => {
    const eu = A.api && A.api.eu; if (!eu) return 0;
    if (eu.cargo === 'dev' || (Array.isArray(eu.sl) && eu.sl.includes('dev'))) return 4;
    const b = eu.bolha; if (!b) return 0;
    if (+b.nivel > 0) return +b.nivel;
    return ({ standard: 1, plus: 2, donator: 3, supporter: 4 })[b.plano] || 0;
  };
  X.nivelDeSelos = (sl) => (Array.isArray(sl) ? sl.reduce((n, s) => Math.max(n, NIVEL_SELO[s] || 0), 0) : 0);
  X.tem = (n) => !n || X.nivel() >= n;

  // ----- os catálogos (os mesmos ids do servidor) -----
  // (0.9.6) refeitos: cada um faz o que o nome diz e nenhum repete um que já existe (Arco-íris, Entardecer, Nebulosa e Ouro líquido saíram)
  X.EFEITOS_NOME = [['cromado', 'Cromado', 'Chrome', 1, 2], ['vitral', 'Vitral', 'Stained glass', 2, 3], ['digitar', 'Máquina de escrever', 'Typewriter', 2, 2],
    ['eletrico', 'Elétrico', 'Electric', 3, 3], ['tinta', 'Tinta escorrendo', 'Dripping paint', 3, 1], ['fumaca', 'Fumaça', 'Smoke', 3, 2], ['pulsar', 'Batimento', 'Heartbeat', 3, 2],
    ['magma', 'Magma', 'Magma', 4, 2], ['cometa', 'Cometa', 'Comet', 4, 2]];
  X.CORES_NOME = { cromado: ['#8fd4ff', '#3b2560'], vitral: ['#e5473b', '#2d9ee0', '#f5c542'], digitar: ['#2d9ee0', '#1fbf6a'], eletrico: ['#7fe7ff', '#3b5bff', '#eafcff'], tinta: ['#e5473b'], fumaca: ['#7d8fa3', '#b8c4d2'], pulsar: ['#ff4f7a', '#ff9ab5'], magma: ['#ff6a1f', '#2a1d1a'], cometa: ['#ffffff', '#5f8fe0'] };
  // (1.0.0) os ids ficam (quem já escolheu não perde nada), mas Anel virou Corações, Dupla virou Aura, Giro virou Órbita e Faíscas virou Neon
  X.MOLDURAS = [['anel', 'Corações', 'Hearts', 1], ['pontilhada', 'Pontilhada', 'Dotted', 1], ['dupla', 'Aura', 'Aura', 2], ['estrelas', 'Estrelas', 'Stars', 2],
    ['giro', 'Órbita', 'Orbit', 3], ['pulso', 'Pulso', 'Pulse', 3], ['faiscas', 'Neon', 'Neon', 3], ['bolhas', 'Bolhas', 'Bubbles', 3],
    ['galaxia', 'Galáxia', 'Galaxy', 4], ['prisma', 'Prisma', 'Prism', 4], ['coroa', 'Coroa', 'Crown', 4]];
  X.ABERTURAS = [['surgir', 'Surgir', 'Rise', 3], ['zoom', 'Zoom', 'Zoom', 3], ['brilho', 'Brilho', 'Shine', 3], ['confete', 'Confete', 'Confetti', 3], ['cortina', 'Cortina', 'Curtain', 4], ['holograma', 'Holograma', 'Hologram', 4]];
  // (1.0.0) o que cada cor pinta, nos efeitos em que isso não é óbvio (o Elétrico tem a cor dos raios separada da do nome)
  X.ROTULOS_CORES = () => ({ eletrico: [T('Nome', 'Name'), T('Brilho', 'Glow'), T('Raios', 'Bolts')] });
  X.ACESSORIOS_MAX = (n) => (n >= 4 ? 8 : n >= 3 ? 3 : 0);
  X.EMOJIS_ACESSORIO = ['👑', '🎩', '🧢', '🎀', '🕶️', '🎧', '⭐', '✨', '💖', '🌸', '🍀', '🔥', '❄️', '🌙', '☁️', '🦋', '🐾', '🎮', '🎵', '💎', '🌈', '⚡', '🍓', '🐱'];
  X.MOV_ACESSORIO = [['', 'Parado', 'Still'], ['flutua', 'Flutua', 'Float'], ['gira', 'Gira', 'Spin'], ['pisca', 'Pisca', 'Twinkle'], ['balanca', 'Balança', 'Sway']];
  X.ANEIS = [['cor', 'Cor própria', 'Own color', 2], ['onda', 'Onda', 'Wave', 3], ['chama', 'Chama', 'Flame', 3], ['brilho', 'Brilho', 'Glow', 3], ['arco', 'Arco-íris', 'Rainbow', 4], ['eletrico', 'Elétrico', 'Electric', 4],
    ['equalizador', 'Equalizador', 'Equalizer', 3], ['sonar', 'Sonar', 'Sonar', 3], ['notas', 'Notas', 'Notes', 3], ['orbita', 'Órbita', 'Orbit', 4], ['aurora', 'Aurora', 'Aurora', 4], ['coracoes', 'Corações', 'Hearts', 4]];
  X.SONS_ENTRAR = [['sino', 'Sino', 'Bell', 3], ['gota', 'Gota', 'Drop', 3], ['acorde', 'Acorde', 'Chord', 3], ['estrela', 'Estrela', 'Star', 3], ['portal', 'Portal', 'Portal', 3], ['harpa', 'Harpa', 'Harp', 3]];
  X.MOLDURAS_CAMERA = [['neon', 'Neon', 'Neon', 3], ['vidro', 'Vidro', 'Glass', 3], ['polaroid', 'Polaroid', 'Polaroid', 3], ['fita', 'Fita', 'Tape', 3], ['holograma', 'Holograma', 'Hologram', 4], ['coracao', 'Coração', 'Heart', 4]];
  // (1.0.0) quantas cores cada moldura da câmera usa (mín., máx.) e as de fábrica; o holograma aceita de 2 a 6
  X.CORES_CAMERA = { neon: [1, 1, ['#7fd3ff']], vidro: [1, 1, ['#ffffff']], polaroid: [1, 1, ['#f7f4ec']], fita: [2, 2, ['#ffd36e', '#ff9ad5']], holograma: [2, 6, ['#ff9ad5', '#9ad8ff', '#b5ff9a', '#fff59a']], coracao: [1, 1, ['#ff7ad9']] };
  X.coresCamera = (mc) => { const [mi, ma, pad] = X.CORES_CAMERA[mc && mc.t] || [2, 2, ['#7fd3ff', '#ff7ad9']]; const c = (mc && mc.c && mc.c.length ? mc.c : pad).slice(0, ma); while (c.length < mi) c.push(pad[c.length] || pad[pad.length - 1]); return c.length ? c : pad.slice(); };
  // as variáveis que o CSS da moldura usa: --c1, --c2 e --cg (todas as cores, para o degradê do holograma)
  X.pintarCamera = (el, mc) => { const c = X.coresCamera(mc); el.style.setProperty('--c1', c[0]); el.style.setProperty('--c2', c[1] || c[0]); el.style.setProperty('--cg', [...c, c[0]].join(', ')); };
  // os efeitos novos entram na mesma lista do editor de nome (depois dos 21 de sempre)
  if (A.ui && A.ui.EFEITOS_NOME) { for (const [id, pt, en, , n] of X.EFEITOS_NOME) if (!A.ui.EFEITOS_NOME.some((x) => x[0] === id)) A.ui.EFEITOS_NOME.push([id, pt, en, n]); Object.assign(A.ui.CORES_NOME_PADRAO, X.CORES_NOME); }
  const nivelEm = (lista, id) => ((lista.find((x) => x[0] === id) || [])[3] || 0);
  X.nivelEfeito = (id) => nivelEm(X.EFEITOS_NOME, id);

  // ----- o selo do plano e a prévia -----
  X.selo = (n) => { const p = X.PLANOS[n]; return p ? h('span', { class: 'px-selo px-' + p[0], title: T('Aero Bubble ', 'Aero Bubble ') + p[1] }, p[1]) : null; };
  // abre a página Apoio nas Configurações (sem fechar o que você estava fazendo: o editor continua aberto por cima)
  X.verPlanos = () => { A.cfg.v.cfgPagina = 'apoio'; A.cfg.salvar(); A.evt.emit('abrir-config'); if (A.cfgPagina) A.cfgPagina('apoio'); };
  // a faixa embaixo de uma escolha travada: "Prévia: só você vê. Disponível no Donator" + o botão para ver os planos
  X.faixaPrevia = (n) => (X.tem(n) ? null : h('div', { class: 'px-previa' }, h('span', {}, T('Prévia: só você está vendo. Disponível no ', 'Preview: only you can see it. Available on ')), X.selo(n),
    h('button', { type: 'button', class: 'px-ver', onclick: (e) => { e.stopPropagation(); X.verPlanos(); } }, T('Ver planos', 'See plans'))));
  // uma grade de escolhas com selo: as travadas também dá para clicar (vira prévia)
  // (1.0.0) ouvir: escolher NUNCA toca som; a prévia é só o alto-falante pequeno no canto de cima de cada opção
  X.altoFalante = (fn) => {
    const b = h('span', { class: 'px-ouvir', role: 'button', tabindex: '0', title: T('Ouvir', 'Listen'), 'aria-label': T('Ouvir', 'Listen') }, A.icone('volume', 14));
    const ir = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    b.addEventListener('click', ir); b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') ir(e); });
    return b;
  };
  X.grade = (lista, atual, escolher, { nenhum = true, desenho, ouvir } = {}) => h('div', { class: 'px-grade' + (ouvir ? ' px-grade-som' : '') },
    nenhum ? h('button', { type: 'button', class: 'px-op' + (!atual ? ' sel' : ''), onclick: () => escolher('') }, h('span', { class: 'px-op-amostra px-nada' }, '∅'), h('small', {}, T('Nenhum', 'None'))) : null,
    // (1.0.0) a prévia animada (aberturas) toca ao entrar com o mouse em qualquer parte do botão (antes só em cima do desenho, e falhava)
    // e ao chegar nele pelo teclado ou controle
    ...lista.map(([id, pt, en, n]) => h('button', { type: 'button', class: 'px-op' + (atual === id ? ' sel' : '') + (X.tem(n) ? '' : ' preso'), onclick: () => escolher(id),
      onpointerenter: (e) => { const a = e.currentTarget.querySelector('.px-abm-caixa'); if (a && a._tocar) a._tocar(); }, onfocus: (e) => { const a = e.currentTarget.querySelector('.px-abm-caixa'); if (a && a._tocar && e.currentTarget.matches(':focus-visible')) a._tocar(); } },
      desenho ? desenho(id) : null, h('small', {}, T(pt, en)), X.tem(n) ? null : X.selo(n), ouvir ? X.altoFalante(() => ouvir(id)) : null)));

  // ----- no perfil -----
  // a moldura em volta da foto (no cartão e no mini perfil): fica por cima da foto, sem mudar o tamanho de nada
  X.moldura = (alvo, mo, c1, c2) => {
    if (!alvo) return;
    alvo.querySelectorAll(':scope > .px-mo').forEach((e) => e.remove());
    if (!mo || !mo.t) return;
    // (1.0.2) a de um artista da Comunidade: uma imagem em volta da foto (na frente dela ou atrás)
    if (mo.t === 'arte') { const el = A.bolhaArte && A.bolhaArte.foto(mo.a, false, { meu: !!(A.api && A.api.eu && alvo.dataset.cod === A.api.eu.codigo) }); if (!el) return; alvo.classList.add('px-mo-alvo'); if (el.classList.contains('atras')) alvo.prepend(el); else alvo.append(el); return; }
    const c = mo.c || [];
    const pd = { anel: ['#ff4f7a', '#ffb3c8'], faiscas: ['#ff3fd2', '#38e8ff'] }[mo.t] || []; // (1.0.0) Corações e Neon nascem nas cores deles (a pessoa ainda pode trocar)
    const el = h('i', { class: 'px-mo px-mo-' + mo.t, 'aria-hidden': 'true', estilo: { '--m1': c[0] || pd[0] || c1 || '#7fd3ff', '--m2': c[1] || pd[1] || c2 || '#9b6cff' } });
    // (1.0.0) as peças de cada moldura: a luz do letreiro, as estrelas, as fagulhas, as bolhas e o feixe (cada uma no seu lugar e no seu tempo)
    const p = (a, d, s) => h('i', { class: 'px-p', estilo: { '--a': a + 'deg', '--d': d + 's', ...(s ? { '--s': s + 'px' } : {}) } });
    if (mo.t === 'pontilhada') for (let i = 0; i < 16; i++) el.append(p(i * 22.5, (i * 0.1).toFixed(2)));
    if (mo.t === 'estrelas') [[18, 0, 9], [78, 0.9, 6], [132, 1.7, 8], [196, 0.4, 7], [252, 1.3, 9], [312, 2.1, 6]].forEach(([a, d, s]) => el.append(p(a, d, s)));
    if (mo.t === 'anel') [[0, 0, 2], [52, 1.1, 0], [118, 0.5, 1], [176, 2.1, 0], [236, 1.6, 2], [300, 0.8, 1], [334, 2.6, 0]].forEach(([a, d, s]) => { const r = (a * Math.PI) / 180;
      el.append(h('i', { class: 'px-h', estilo: { '--x': (50 + 50 * Math.sin(r)).toFixed(1) + '%', '--y': (50 - 50 * Math.cos(r)).toFixed(1) + '%', '--d': d + 's', '--s': 6 + s * 2 + 'px', ...(s === 1 ? { '--c': 'var(--m1)' } : {}) } })); });
    if (mo.t === 'dupla') el.append(h('i', { class: 'px-aura' }));
    // a órbita em duas metades: a de trás some onde passa atrás da foto e a da frente passa por cima (a lua vai junto nas duas)
    if (mo.t === 'giro') ['px-orb-t', 'px-orb-f'].forEach((c) => el.append(h('i', { class: 'px-orbm ' + c }, h('i', { class: 'px-orb' }), h('i', { class: 'px-lua-x' }, h('i', { class: 'px-lua' })))));
    if (mo.t === 'galaxia') { [[20, 0, 1, 0], [64, 0.7, 0, 3], [108, 1.4, 2, 0], [150, 0.3, 0, -2], [196, 1.1, 1, 2], [238, 1.7, 0, 0], [282, 0.5, 2, -1], [322, 1.2, 0, 3], [350, 0.9, 1, -2]].forEach(([a, d, s, o]) => { const e = p(a, d); e.style.setProperty('--s', 1.5 + s + 'px'); e.style.setProperty('--o', o + 'px'); el.append(e); }); el.append(h('i', { class: 'px-cadente' })); }
    if (mo.t === 'bolhas') [['-3%', 0, 7], ['103%', 0.6, 6], ['2%', 1.3, 5], ['98%', 1.9, 8], ['-1%', 2.5, 6], ['101%', 2.9, 5]].forEach(([x, d, s]) => el.append(h('i', { class: 'px-b', estilo: { '--x': x, '--d': d + 's', '--s': s + 'px' } })));
    if (mo.t === 'coroa') el.append(h('i', { class: 'px-luz' }));
    // a coroa desenhada (ouro com pedras nas cores da pessoa), reta no alto da foto
    if (mo.t === 'coroa') el.append(h('b', { class: 'px-coroa' }, h('i', { class: 'px-cr' }, ...[['28.8%', '85%', '11%', 'var(--m2)'], ['50%', '85%', '11%', 'var(--m1)'], ['71.2%', '85%', '11%', 'var(--m2)'], ['50%', '50%', '14%', 'var(--m1)']].map(([x, y, g, c]) => h('i', { estilo: { '--x': x, '--y': y, '--g': g, '--c': c } })))));
    alvo.classList.add('px-mo-alvo'); alvo.append(el);
  };
  // os acessórios: emojis soltos no cartão (x e y em % do cartão)
  // (1.0.0) ou uma imagem/GIF que a pessoa enviou (a.i), servida pelo servidor só enquanto o plano dela cobre
  X.urlAcessorio = (codigo, i) => (A.api && codigo && /^[0-9a-f]{10}$/.test(i || '') ? `${A.api.servidor}/api/acessorio/${encodeURIComponent(codigo)}/${i}` : '');
  X.acessorios = (cartao, ac, codigo) => {
    if (!cartao) return;
    cartao.querySelectorAll(':scope > .px-ac, :scope > .perfil-corpo > .px-ac').forEach((e) => e.remove());
    // (1.0.2) camadas: a ordem da lista é a ordem de pintura (o último fica por cima). Os "atrás da foto" (a.z) entram no corpo do cartão,
    // antes do conteúdo: ficam na frente do fundo e do banner, mas atrás da foto, da moldura, do nome e dos widgets
    const corpo = cartao.querySelector(':scope > .perfil-corpo'), conteudo = corpo && corpo.querySelector(':scope > .pf-conteudo');
    for (const a of Array.isArray(ac) ? ac : []) {
      const el = X.pecaAcessorio(a, codigo, a.s + 'px'); if (!el) continue;
      if (a.z === 'atras' && conteudo) corpo.insertBefore(el, conteudo); else cartao.append(el);
    }
  };
  // um acessório desenhado (emoji ou imagem/GIF), no lugar (x, y em %), tamanho, giro, movimento e espelho dele
  X.pecaAcessorio = (a, codigo, tamanho) => {
    const url = a.i ? X.urlAcessorio(codigo, a.i) : '';
    if (a.i && !url) return null;
    if (!a.i && !a.e) return null;
    const img = url ? h('img', { src: url, alt: '', draggable: 'false', decoding: 'async', loading: 'lazy' }) : null;
    if (img) img.addEventListener('error', () => img.parentNode && img.parentNode.remove());
    return h('span', { class: 'px-ac' + (img ? ' px-ac-img' : '') + (a.m ? ' px-ac-' + a.m : '') + (a.z === 'atras' ? ' px-ac-atras' : '') + (a.f ? ' px-ac-espelho' : ''), 'aria-hidden': 'true', estilo: { left: a.x + '%', top: a.y + '%', 'font-size': tamanho, '--r': (a.r || 0) + 'deg' } }, img || (a.f ? h('b', {}, a.e) : a.e)); // (1.0.2) espelhado: só o desenho vira (por dentro), o lugar não muda
  };

  // ----- (1.0.2) a tela da sua chamada: cor, imagem de fundo, bolhas e acessórios. Só na SUA tela (fica neste aparelho, ninguém mais vê) -----
  // a cor é grátis; a imagem de fundo também (como o fundo do app); os acessórios seguem os do cartão (Donator até 3, Supporter até 8)
  X.chamTela = () => { const c = A.cfg.v; if (!c.chamTela || typeof c.chamTela !== 'object') c.chamTela = { c: [], f: [], q: [], imagem: null, escuro: 35, bolhas: true, ac: [] }; return c.chamTela; };
  const COR_OK = /^#[0-9a-f]{6}$/i;
  const cores = (l) => (Array.isArray(l) ? l : []).filter((x) => COR_OK.test(x || '')).slice(0, 2);
  X.fundoChamada = (t) => {
    const luz = cores(t.c), base = cores(t.f);
    let cor = '';
    if (base.length) { // (1.0.2) o fundo da chamada com cor própria: as luzes (as suas ou as do Aero) se apagam nele, de cima para baixo
      const c1 = luz[0] || '#1283c2', c2 = luz[1] || (luz[0] ? c1 : '#0a4f7e'), b1 = base[0], b2 = base[1] || base[0];
      cor = `radial-gradient(ellipse 95% 60% at 50% -8%, color-mix(in srgb, ${c1} 72%, #fff) 0%, ${c1} 26%, color-mix(in srgb, ${c2} 60%, transparent) 50%, transparent 74%), linear-gradient(180deg, ${b1}, ${b2})`;
    } else if (luz.length) {
      const c1 = luz[0], c2 = luz[1] || c1;
      cor = `radial-gradient(ellipse 95% 60% at 50% -8%, color-mix(in srgb, ${c1} 72%, #fff) 0%, ${c1} 26%, color-mix(in srgb, ${c2} 62%, #000) 50%, color-mix(in srgb, ${c2} 28%, #000) 72%, #020d18 100%)`;
    }
    const img = typeof t.imagem === 'string' && t.imagem.startsWith('data:image/') ? t.imagem : '';
    if (!img) return cor;
    const e = Math.max(0, Math.min(85, +t.escuro || 0)) / 100;
    return `linear-gradient(rgba(2,10,18,${e}), rgba(2,10,18,${e})), url("${img}") center / cover no-repeat` + (cor ? ', ' + cor : ', #020d18');
  };
  X.pintarTelaChamada = (el, t, previa) => {
    if (!el) return; t = t || X.chamTela();
    const f = X.fundoChamada(t);
    if (f) el.style.setProperty('--cham-fundo', f); else el.style.removeProperty('--cham-fundo');
    el.classList.toggle('cham-tela-propria', !!f);
    // (1.0.2) o fundo atrás da foto de cada pessoa (o quadro de quem está sem câmera)
    const q = cores(t.q);
    if (q.length) el.style.setProperty('--cham-quadro', `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${q[0]} 70%, #fff), ${q[0]} 45%, color-mix(in srgb, ${q[1] || q[0]} 55%, #000))`); else el.style.removeProperty('--cham-quadro');
    el.classList.toggle('cham-quadro-proprio', !!q.length);
    if (t.c && COR_OK.test(t.c[0] || '')) el.style.setProperty('--cv', t.c[0]); else el.style.removeProperty('--cv');
    el.classList.toggle('cham-sem-bolhas', t.bolhas === false);
    el.querySelectorAll(':scope > .cham-acs').forEach((x) => x.remove());
    const max = X.ACESSORIOS_MAX(previa ? Math.max(X.nivel(), 3) : X.nivel());
    const acs = (Array.isArray(t.ac) ? t.ac : []).slice(0, max);
    if (!acs.length) return;
    const cod = A.api && A.api.eu ? A.api.eu.codigo : '';
    const tras = h('div', { class: 'cham-acs cham-acs-tras', 'aria-hidden': 'true' }), frente = h('div', { class: 'cham-acs cham-acs-frente', 'aria-hidden': 'true' });
    // o tamanho acompanha a largura da tela (cqw): a prévia pequena fica igualzinha à chamada aberta
    for (const a of acs) { const p = X.pecaAcessorio({ ...a, z: '' }, cod, 'calc(' + (+a.s || 32) * 0.06 + 'cqw)'); if (p) (a.z === 'atras' ? tras : frente).append(p); }
    if (tras.childNodes.length) el.prepend(tras);
    if (frente.childNodes.length) el.append(frente);
  };
  let tSalvarTela = 0;
  const mudouTela = () => { clearTimeout(tSalvarTela); tSalvarTela = setTimeout(() => A.cfg.salvar(), 400); A.evt.emit('chamTela'); };
  A.evt.on('chamTela', () => document.querySelectorAll('.cham-janela').forEach((el) => X.pintarTelaChamada(el)));
  X.secaoChamada = () => {
    const U = A.ui, t = X.chamTela(); if (!Array.isArray(t.ac)) t.ac = [];
    const caixa = h('div', { class: 'col', estilo: { gap: '12px' } });
    const eu = A.api && A.api.eu;
    const tile = (p, nome) => h('div', { class: 'chp-tile' }, h('div', { class: 'chp-quadro' }, p ? U.avatar(p, 40) : h('span', { class: 'chp-av' })), h('small', {}, nome));
    const previa = h('div', { class: 'cham-previa', 'aria-hidden': 'true' },
      h('div', { class: 'cham-ceu' }, h('i'), h('i'), h('i'), h('i'), h('i')),
      h('div', { class: 'chp-cab' }, h('b', {}, T('Sua chamada', 'Your call')), h('small', {}, '12:34')),
      h('div', { class: 'chp-pessoas' }, tile(null, T('Amigo', 'Friend')), tile(eu, T('Você', 'You'))),
      h('div', { class: 'chp-barra' }, h('i'), h('i'), h('i'), h('i', { class: 'chp-fim' }), h('i'), h('i')));
    const pintarPrevia = () => X.pintarTelaChamada(previa, t, true);
    // as gotinhas de cor guardam em t.c; para os dois fundos, um "c" que lê e grava no campo certo (t.f ou t.q)
    const campo = (k) => ({ get c() { return Array.isArray(t[k]) ? t[k] : []; }, set c(v) { t[k] = v; } });
    const pintar = () => { pintarPrevia(); mudouTela(); };
    const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    const estado = h('small', { class: 'suave' });
    arq.addEventListener('change', async () => {
      const f = arq.files && arq.files[0]; arq.value = ''; if (!f) return;
      estado.textContent = T('Preparando a imagem...', 'Preparing the image...');
      try { const r = await A.tema.imagemDeFundo(f); t.imagem = r.dataUrl; estado.textContent = ''; A.som.tocar('bolha'); refazer(); pintar(); }
      catch (e) { estado.textContent = e.message || T('Não deu para abrir essa imagem.', 'Could not open this image.'); }
    });
    function refazer() {
      const n = X.nivel(), nAc = X.ACESSORIOS_MAX(Math.max(n, 3)), acs = t.ac;
      caixa.replaceChildren(previa,
        h('small', { class: 'suave' }, T('Só a sua tela muda: quem está na chamada com você continua vendo a dele.', 'Only your screen changes: the others keep seeing their own.')),
        h('div', { class: 'rot' }, T('Luzes', 'Lights')),
        linhaCores(t, (re) => { if (re) refazer(); pintar(); }, { min: 1, max: 2, padrao: ['#1283c2', '#0a4f7e'], rotPadrao: T('Cor padrão', 'Default color') }),
        h('div', { class: 'rot' }, T('Fundo da chamada', 'Call background')),
        linhaCores(campo('f'), (re) => { if (re) refazer(); pintar(); }, { min: 1, max: 2, padrao: ['#0a2a44', '#020d18'], rotPadrao: T('Fundo padrão', 'Default background') }),
        h('div', { class: 'rot' }, T('Fundo das fotos', 'Photo background')),
        linhaCores(campo('q'), (re) => { if (re) refazer(); pintar(); }, { min: 1, max: 2, padrao: ['#2f7fb8', '#0a2a44'], rotPadrao: T('Fundo padrão', 'Default background') }),
        h('div', { class: 'rot' }, T('Imagem de fundo', 'Background image')),
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'center' } },
          U.btn(t.imagem ? T('Trocar a imagem', 'Change image') : T('Escolher imagem', 'Choose image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arq.click() }),
          t.imagem ? U.btn(T('Tirar a imagem', 'Remove image'), { tipo: 'sec', peq: true, onclick: () => { t.imagem = null; refazer(); pintar(); } }) : null, estado, arq),
        t.imagem ? h('label', { class: 'col', estilo: { gap: '4px' } }, h('small', { class: 'suave' }, T('Escurecer a imagem (para os nomes e botões ficarem legíveis)', 'Darken the image (keeps names and buttons readable)')),
          U.slider({ valor: t.escuro == null ? 35 : t.escuro, min: 0, max: 85, passo: 1, oninput: (v) => { t.escuro = +v; pintar(); } })) : null,
        h('div', { class: 'linha entre', estilo: { gap: '10px', 'align-items': 'center' } }, h('span', {}, T('Bolhas subindo no fundo', 'Bubbles rising in the background')), U.chave(t.bolhas !== false, (v) => { t.bolhas = !!v; pintar(); })),
        h('div', { class: 'rot' }, T('Acessórios na tela', 'Screen accessories')),
        X.listaAcessorios(acs, { refazer, pintar, tamMax: 200, camadas: [['atras', T('Atrás das pessoas', 'Behind people')], ['', T('Na frente de tudo', 'In front of everything')]] }),
        acs.length < nAc ? U.btn(T('Pôr um acessório', 'Add an accessory'), { tipo: 'sec', peq: true, icone: 'mais', onclick: () => { acs.push({ e: X.EMOJIS_ACESSORIO[acs.length % X.EMOJIS_ACESSORIO.length], x: 12 + (acs.length * 19) % 76, y: 14, s: 48, r: 0, m: '', z: 'atras' }); refazer(); pintar(); } }) : null,
        acs.length ? X.faixaPrevia(3) : h('small', { class: 'suave' }, T('Acessórios: até 3 no Donator e até 8 no Supporter.', 'Accessories: up to 3 on Donator and up to 8 on Supporter.')),
        (t.c && t.c.length) || (t.f && t.f.length) || (t.q && t.q.length) || t.imagem || t.bolhas === false || acs.length ? h('div', {}, U.btn(T('Voltar ao padrão', 'Reset to default'), { tipo: 'sec', peq: true, onclick: () => { t.c = []; t.f = []; t.q = []; t.imagem = null; t.escuro = 35; t.bolhas = true; t.ac.length = 0; refazer(); pintar(); } })) : null);
      pintarPrevia();
    }
    refazer();
    return caixa;
  };
  // (1.0.0) escolher o acessório: um emoji (a mesma grade da personalização da digitação, com busca) ou uma imagem/GIF do computador
  X.escolherAcessorio = (ancora, a, pronto) => {
    const U = A.ui;
    let pop = null, aba = a.i ? 'img' : 'emoji';
    const corpo = h('div', { class: 'col px-ac-pop' });
    const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    const estado = h('div', { class: 'peq suave' });
    arq.addEventListener('change', async () => {
      const f = arq.files && arq.files[0]; arq.value = ''; if (!f) return;
      if (f.size > 8 * 1048576) { estado.textContent = T('Imagem grande demais (máximo 8 MB).', 'Image too large (max 8 MB).'); return; }
      estado.textContent = T('Enviando...', 'Uploading...');
      try { const r = await A.api.subirImagem('acessorio', f); delete a.e; a.i = r.id; A.som.tocar('bolha'); pronto(); if (pop && pop.fechar) pop.fechar(); }
      catch (e) { estado.textContent = e.message; }
    });
    const pintar = () => {
      const seg = U.seg([['emoji', 'Emoji', 'emoji'], ['img', T('Imagem ou GIF', 'Image or GIF'), 'imagem']], aba, (v) => { aba = v; pintar(); });
      if (aba === 'emoji') {
        const grade = A.gradeEmojis ? A.gradeEmojis({ aoEscolher: (e) => { delete a.i; a.e = e; pronto(); if (pop && pop.fechar) pop.fechar(); } }) : h('div');
        corpo.replaceChildren(seg, h('div', { class: 'dg-ind-grade' }, grade));
        if (grade.focar) setTimeout(() => grade.focar(), 50);
      } else {
        const atual = a.i && A.api && A.api.eu ? X.urlAcessorio(A.api.eu.codigo, a.i) : '';
        corpo.replaceChildren(seg,
          h('div', { class: 'px-ac-envio' }, atual ? h('img', { src: atual, alt: '' }) : A.icone('imagem', 28),
            h('div', { class: 'col', estilo: { gap: '6px', 'min-width': '0' } },
              h('small', { class: 'suave' }, T('PNG, JPG, WEBP ou GIF animado, até 8 MB. Com fundo transparente fica melhor.', 'PNG, JPG, WEBP or animated GIF, up to 8 MB. Looks best with a transparent background.')),
              U.btn(atual ? T('Trocar a imagem', 'Change image') : T('Escolher do computador', 'Choose from computer'), { icone: 'pasta', peq: true, onclick: () => arq.click() }))),
          estado, arq);
      }
    };
    pintar();
    pop = U.popover(ancora, corpo, { largura: 360, titulo: T('Acessório', 'Accessory') });
  };
  // a animação quando abrem o seu perfil (só uma vez, ao abrir; com "menos animações" não roda)
  // (1.0.0) refeitas com a Web Animations API: não brigam com as animações do próprio cartão (borda do apoio, efeitos do nome), esperam o
  // cartão estar na tela (o editor desenha a prévia no quadro seguinte) e mexem só em scale/translate/opacity, que a placa de vídeo faz sozinha.
  // As peças (luz, cortina, confete, linhas do holograma) ficam numa camada por cima do cartão e somem no fim.
  const SUAVE = 'cubic-bezier(.22,1,.36,1)', MOLA = 'cubic-bezier(.34,1.56,.64,1)', CAI = 'cubic-bezier(.55,0,.85,.4)';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ABERTURA = {
    surgir({ c, av, linhas, an, peca, W, H, c1 }) {
      an(c, [{ opacity: 0, translate: `0 ${Math.round(H * 0.09)}px`, scale: '.96', filter: 'blur(6px)' }, { opacity: 1, translate: '0 0', scale: '1', filter: 'blur(0px)' }], { duration: 760, easing: SUAVE });
      const luz = peca('px-ab-luz', { background: `radial-gradient(60% 45% at 50% 100%, ${c1}, transparent 70%)` });
      an(luz, [{ opacity: 0.9, translate: '0 40%' }, { opacity: 0, translate: '0 -30%' }], { duration: 1000, easing: SUAVE });
      if (av) an(av, [{ opacity: 0, scale: '.4' }, { opacity: 1, scale: '1.08', offset: 0.7 }, { opacity: 1, scale: '1' }], { duration: 640, delay: 170, easing: 'ease-out' });
      linhas.forEach((l, i) => an(l, [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], { duration: 520, delay: 280 + i * 70, easing: SUAVE }));
      void W;
    },
    zoom({ c, av, an, peca, W, H, c1 }) {
      an(c, [{ opacity: 0, scale: '.55' }, { opacity: 1, scale: '1.035', offset: 0.62 }, { opacity: 1, scale: '1' }], { duration: 780, easing: 'cubic-bezier(.2,.9,.3,1)' });
      const d = Math.hypot(W, H);
      const anel = peca('px-ab-anel', { width: d + 'px', height: d + 'px', left: (W - d) / 2 + 'px', top: (H - d) / 2 + 'px', 'border-color': c1 });
      an(anel, [{ opacity: 0.95, scale: '0.05' }, { opacity: 0, scale: '1.1' }], { duration: 900, delay: 160, easing: SUAVE });
      const flash = peca('px-ab-luz', { background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,.95), transparent 55%)' });
      an(flash, [{ opacity: 0, scale: '.3' }, { opacity: 0.85, scale: '.9', offset: 0.3 }, { opacity: 0, scale: '1.6' }], { duration: 820, delay: 120, easing: 'ease-out' });
      if (av) an(av, [{ scale: '.7' }, { scale: '1.12', offset: 0.6 }, { scale: '1' }], { duration: 700, delay: 220, easing: 'ease-out' });
    },
    brilho({ c, an, peca, W, H, mini }) {
      an(c, [{ opacity: 0, filter: 'brightness(1.7) saturate(1.3)' }, { opacity: 1, filter: 'brightness(1.7) saturate(1.3)', offset: 0.25 }, { opacity: 1, filter: 'brightness(1) saturate(1)' }], { duration: 900, easing: 'ease-out' });
      [[0, 0.42, 0.95], [240, 0.18, 0.8]].forEach(([atraso, larg, forca]) => {
        const faixa = peca('px-ab-faixa', { width: Math.max(W, H) * larg + 'px', '--f': forca });
        an(faixa, [{ translate: `${-W * 0.9}px 0`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { translate: `${W * 1.6}px 0`, opacity: 0 }], { duration: 1050, delay: 120 + atraso, easing: 'cubic-bezier(.45,0,.25,1)' });
      });
      const n = mini ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const t = mini ? rnd(7, 11) : rnd(12, 24);
        const e = peca('px-ab-estrela', { left: rnd(8, 88) + '%', top: rnd(8, 82) + '%', width: t + 'px', height: t + 'px' });
        an(e, [{ opacity: 0, scale: '0', rotate: '0deg' }, { opacity: 1, scale: '1', rotate: '90deg', offset: 0.45 }, { opacity: 0, scale: '0', rotate: '180deg' }], { duration: 760, delay: 300 + i * 110, easing: 'ease-in-out' });
      }
      void H;
    },
    confete({ c, av, an, peca, W, H, c1, c2, mini }) {
      an(c, [{ opacity: 0, scale: '.9' }, { opacity: 1, scale: '1.025', offset: 0.6 }, { opacity: 1, scale: '1' }], { duration: 520, easing: 'ease-out' });
      if (av) an(av, [{ scale: '1' }, { scale: '1.12', offset: 0.35 }, { scale: '.97', offset: 0.65 }, { scale: '1' }], { duration: 700, delay: 140, easing: 'ease-in-out' });
      const cores = [c1, c2, '#ffd23f', '#ff5c8a', '#3ee8b5', '#5aa9ff', '#b98cff', '#ffffff'];
      const n = mini ? 16 : 54, esc = mini ? 0.5 : 1.35;
      for (let i = 0; i < n; i++) {
        const daEsq = i % 2 === 0, forma = i % 3;
        const w = (forma === 2 ? 4 : forma === 1 ? 7 : 6) * esc, hh = (forma === 2 ? 14 : forma === 1 ? 7 : 10) * esc;
        const e = peca('px-ab-confete' + (forma === 1 ? ' bola' : ''), { left: daEsq ? '4%' : '96%', width: w + 'px', height: hh + 'px', background: cores[i % cores.length] });
        const vx = (daEsq ? 1 : -1) * W * rnd(0.12, 0.62), topo = -H * rnd(0.5, 0.95), giro = rnd(360, 900) * (Math.random() < 0.5 ? -1 : 1), dur = rnd(1300, 1900);
        an(e, [
          { translate: '0 0', rotate: '0deg', opacity: 1, easing: 'cubic-bezier(.15,.75,.35,1)' },
          { translate: `${vx * 0.65}px ${topo}px`, rotate: giro * 0.4 + 'deg', opacity: 1, offset: 0.38, easing: CAI },
          { translate: `${vx}px ${H * 0.12}px`, rotate: giro + 'deg', opacity: 0 },
        ], { duration: dur, delay: rnd(0, 220) });
      }
    },
    cortina({ c, an, peca, W, c1, c2 }) {
      an(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
      an(c, [{ scale: '1.04' }, { scale: '1' }], { duration: 1200, delay: 200, easing: SUAVE });
      const pano = `linear-gradient(180deg, rgba(255,255,255,.18), transparent 30%, rgba(0,0,0,.25)), repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0, rgba(255,255,255,.12) ${W * 0.035}px, rgba(0,0,0,.28) ${W * 0.07}px), linear-gradient(90deg, ${c2}, ${c1})`;
      ['esq', 'dir'].forEach((lado, i) => {
        const p = peca('px-ab-pano ' + lado, { background: pano });
        an(p, [{ scale: '1 1', translate: '0 0' }, { scale: '1 1', translate: '0 0', offset: 0.18 }, { scale: '.12 1', translate: `${i ? 6 : -6}% 0` }], { duration: 1150, easing: 'cubic-bezier(.65,0,.35,1)' });
        an(p, [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1150 });
      });
      const bambinela = peca('px-ab-bambinela', { background: `linear-gradient(180deg, ${c2}, color-mix(in srgb, ${c2} 70%, #000))` });
      an(bambinela, [{ translate: '0 0' }, { translate: '0 0', offset: 0.45 }, { translate: '0 -110%' }], { duration: 1150, easing: 'cubic-bezier(.65,0,.35,1)' });
    },
    holograma({ c, av, an, peca, H }) {
      an(c, [
        { opacity: 0, filter: 'hue-rotate(80deg) saturate(1.6) drop-shadow(5px 0 0 rgba(255,0,200,.75)) drop-shadow(-5px 0 0 rgba(0,240,255,.75))', translate: '0 0' },
        { opacity: 0.75, translate: '-3px 0', offset: 0.15 },
        { opacity: 0.35, translate: '3px 0', offset: 0.28 },
        { opacity: 0.9, translate: '-1px 0', offset: 0.42 },
        { opacity: 0.6, translate: '1px 0', offset: 0.52 },
        { opacity: 1, filter: 'hue-rotate(0deg) saturate(1) drop-shadow(0 0 0 rgba(255,0,200,0)) drop-shadow(0 0 0 rgba(0,240,255,0))', translate: '0 0' },
      ], { duration: 1250, easing: 'ease-out' });
      const linhas = peca('px-ab-linhas');
      an(linhas, [{ opacity: 0.85, backgroundPosition: '0 0' }, { opacity: 0.6, offset: 0.6 }, { opacity: 0, backgroundPosition: '0 40px' }], { duration: 1300, easing: 'linear' });
      const barra = peca('px-ab-scan');
      an(barra, [{ translate: '0 -30px', opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { translate: `0 ${H + 30}px`, opacity: 0 }], { duration: 1100, delay: 80, easing: 'cubic-bezier(.45,0,.55,1)' });
      if (av) an(av, [{ opacity: 0, scale: '1.15', filter: 'blur(3px)' }, { opacity: 1, scale: '1', filter: 'blur(0px)' }], { duration: 700, delay: 420, easing: SUAVE });
    },
  };
  X.abertura = (cartao, ab, { mini = false } = {}) => {
    if (!cartao || !ab || !ABERTURA[ab] || !cartao.animate || document.documentElement.dataset.anim === 'nenhuma') return;
    let n = 0;
    const ir = () => {
      if (!cartao.isConnected || !cartao.offsetWidth) { if (++n < 90) requestAnimationFrame(ir); return; }
      if (cartao._abFim) cartao._abFim();
      const camada = h('i', { class: 'px-ab-camada', 'aria-hidden': 'true' }); cartao.append(camada);
      const anims = [];
      const an = (el, kf, o) => { const a = el.animate(kf, { fill: 'both', ...o }); anims.push(a); return a; };
      const peca = (cls, estilo) => { const e = h('i', { class: cls, estilo: estilo || {} }); camada.append(e); return e; };
      const cs = getComputedStyle(cartao), cor = (v, d) => (/^[#a-z0-9(),.\s%-]+$/i.test(cs.getPropertyValue(v).trim()) && cs.getPropertyValue(v).trim()) || d;
      const av = cartao.querySelector('.perfil-av, .pxm-av');
      const linhas = [...cartao.querySelectorAll('.perfil-nome, .perfil-linha, .perfil-bio, .pxm-l')].slice(0, 6);
      try { ABERTURA[ab]({ c: cartao, av, linhas, an, peca, W: cartao.offsetWidth, H: cartao.offsetHeight, c1: cor('--c1', '#7fd3ff'), c2: cor('--c2', '#9b6cff'), mini }); }
      catch (_) { /* navegador sem alguma propriedade: fica sem a animação */ }
      const fim = () => { if (cartao._abFim !== fim) return; cartao._abFim = null; anims.forEach((a) => a.cancel()); camada.remove(); };
      cartao._abFim = fim;
      Promise.all(anims.map((a) => a.finished)).then(fim, () => {});
    };
    ir();
  };
  // (1.0.0) a prévia de cada animação na escolha: um cartãozinho que roda a animação ao aparecer e de novo ao passar o mouse
  X.amostraAbertura = (id, c1, c2) => {
    const el = h('span', { class: 'px-op-amostra px-abm-caixa' }, h('span', { class: 'px-abm', estilo: { '--c1': c1 || '#7fd3ff', '--c2': c2 || '#9b6cff' } }, h('i', { class: 'pxm-av' }), h('i', { class: 'pxm-l' }), h('i', { class: 'pxm-l curta' })));
    const card = el.firstChild, tocar = () => X.abertura(card, id, { mini: true });
    el._tocar = tocar; // quem toca é o botão da escolha inteiro (X.grade)
    // na primeira vez que a escolha aparece na tela, todas tocam uma depois da outra; depois, ao passar o mouse (ou tocar, no celular)
    if (!X._abVistas && window.IntersectionObserver) {
      const ordem = X.ABERTURAS.findIndex((x) => x[0] === id);
      const io = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting)) return; io.disconnect(); X._abVistas = true; setTimeout(tocar, 150 + ordem * 260); });
      io.observe(el);
    }
    return el;
  };
  // o que um perfil mostra: o servidor já filtrou dos outros; o seu (que vem inteiro) é filtrado aqui pelo seu plano de agora
  X.filtrar = (p, souEu) => {
    if (!souEu) return p;
    const n = X.nivel(), o = { ...p };
    if (o.mo && nivelEm(X.MOLDURAS, o.mo.t) > n) delete o.mo;
    if (o.ab && nivelEm(X.ABERTURAS, o.ab) > n) delete o.ab;
    if (o.ac && n < 3) delete o.ac;
    if (o.nm && X.nivelEfeito(o.nm.e) > n) o.nm = { ...o.nm, e: 'solido', c: (o.nm.c || []).slice(0, 1) };
    return o;
  };

  // ----- (1.0.0) os modelos novos de bolha de conversa (os 11 de antes seguem grátis) -----
  X.BOLHAS = [['cristal', 'Cristal', 'Crystal', 3], ['holografico', 'Holográfico', 'Holographic', 3], ['vaporwave', 'Vaporwave', 'Vaporwave', 3], ['doce', 'Doce', 'Candy', 3], ['galaxia', 'Galáxia', 'Galaxy', 4], ['lava', 'Lava', 'Lava', 4]];
  X.nivelBolha = (m) => nivelEm(X.BOLHAS, m);
  if (A.ui && A.ui.MODELOS_BOLHA) {
    const U = A.ui;
    for (const [id, pt, en] of X.BOLHAS) if (!U.MODELOS_BOLHA.some((x) => x[0] === id)) U.MODELOS_BOLHA.push([id, pt, en]);
    Object.assign(U.CORES_BOLHA, { cristal: ['#bfe9ff', '#0b3b5b'], holografico: ['#d9c8ff', '#2a1b4d'], vaporwave: ['#ff71ce', '#ffffff'], doce: ['#ffb3d9', '#5a1f3f'], galaxia: ['#3b1d6e', '#ffffff'], lava: ['#ff5a1f', '#fff3d6'] });
    // a SUA bolha com o plano vencido volta a ser a padrão (fica guardada: renovou, volta). A dos outros já vem filtrada do servidor.
    const aplicar = U.aplicarBolha;
    U.aplicarBolha = (el, bc) => aplicar(el, bc && A.api && A.api.eu && bc === A.api.eu.bc && X.nivelBolha(bc.m) > X.nivel() ? null : bc);
  }

  // ----- os sons de entrar na chamada (sintetizados, como todos os sons do Aero) -----
  if (A.som && A.som.registrar) {
    const { nota, blup, brilho, sopro, N } = A.som.pecas;
    A.som.registrar('entrar-sino', (b, t) => { [N.do6, N.mi6, N.sol6].forEach((f, i) => nota(b, f, t + i * 0.09, 0.6, { vol: 0.12, harm: 0.4, rev: 0.6 })); });
    A.som.registrar('entrar-gota', (b, t) => { nota(b, 420, t, 0.18, { vol: 0.16, glide: 1300, rev: 0.5 }); blup(b, 1319, t + 0.12, 0.25, 0.09); });
    A.som.registrar('entrar-acorde', (b, t) => { [N.do6, N.mi6, N.sol6, N.do7].forEach((f) => nota(b, f, t, 0.7, { vol: 0.07, tipo: 'triangle', harm: 0.3, rev: 0.6, ataque: 0.03 })); });
    A.som.registrar('entrar-estrela', (b, t) => { [N.sol6, N.do7, N.mi7].forEach((f, i) => nota(b, f, t + i * 0.05, 0.3, { vol: 0.08, rev: 0.7 })); brilho(b, t + 0.1, 0.05, 0.3); });
    A.som.registrar('entrar-portal', (b, t) => { sopro(b, t, 0.45, 300, 3200, 0.12, 1.6); nota(b, 220, t, 0.5, { vol: 0.1, glide: 880, rev: 0.7, ataque: 0.1 }); nota(b, N.la6, t + 0.38, 0.3, { vol: 0.08, harm: 0.3 }); });
    A.som.registrar('entrar-harpa', (b, t) => { [N.sol5, N.si5, N.re6, N.sol6, N.si5 * 2].forEach((f, i) => nota(b, f, t + i * 0.045, 0.5, { vol: 0.08, tipo: 'triangle', harm: 0.2, rev: 0.6, ataque: 0.002 })); });
  }

  // ----- a aba "Extras" do editor de perfil -----
  // as cores de um enfeite. Sem "spec", duas cores (como sempre). Com spec { min, max, padrao, rotPadrao }: mostra quantas o enfeite usa e,
  // quando aceita várias, dá para pôr (+) e tirar (×) cores, sem passar do mínimo. Mexer numa cor só repinta (não refaz a lista: senão o
  // seletor de cor fechava no meio)
  // (1.0.2) as cores que você pôs em cada parte (moldura, anel, moldura da câmera) ficam lembradas neste aparelho: trocar de modelo, tirar
  // e pôr de novo ou abrir o editor outro dia volta com elas
  const MEM_CORES = 'coresExtras';
  const memCores = (k) => { const m = A.cfg.v[MEM_CORES]; return m && Array.isArray(m[k]) ? m[k].slice() : null; };
  let tMemCores = 0;
  const guardarCores = (k, c) => { A.cfg.v[MEM_CORES] = { ...(A.cfg.v[MEM_CORES] || {}), [k]: (c || []).slice(0, 8) }; clearTimeout(tMemCores); tMemCores = setTimeout(() => A.cfg.salvar(), 400); };
  const linhaCores = (obj, pintar, spec, lembrar) => {
    const mi = spec ? spec.min : 2, ma = spec ? spec.max : 2, pad = spec ? spec.padrao : ['#7fd3ff', '#9b6cff'];
    const atual = (obj.c && obj.c.length ? obj.c : pad).slice(0, ma); while (atual.length < mi) atual.push(pad[atual.length] || pad[pad.length - 1]);
    const ler = () => inps.map((x) => x.value);
    const por = (l) => { obj.c = l; if (lembrar) lembrar(l); };
    const inps = atual.map((c, i) => { const inp = h('input', { type: 'color', class: 'perfil-cor', value: c, 'aria-label': T('Cor ', 'Color ') + (i + 1) }); inp.addEventListener('input', () => { por(ler()); pintar(); }); return inp; });
    const pecas = inps.map((inp, i) => (atual.length > mi ? h('span', { class: 'px-cor-item' }, inp, h('button', { type: 'button', class: 'px-cor-tirar', title: T('Tirar esta cor', 'Remove this color'), 'aria-label': T('Tirar a cor ', 'Remove color ') + (i + 1), onclick: () => { const l = ler(); l.splice(i, 1); por(l); pintar(true); } }, '×')) : inp));
    const mais = atual.length < ma ? h('button', { type: 'button', class: 'px-cor-mais', title: T('Pôr mais uma cor', 'Add a color'), 'aria-label': T('Pôr mais uma cor', 'Add a color'), onclick: () => { const l = ler(); l.push(pad[l.length] || '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')); por(l); pintar(true); } }, '+') : null;
    return h('div', { class: 'linha px-cores', estilo: { gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' } }, ...pecas, mais,
      h('button', { type: 'button', class: 'px-ver', onclick: () => { por([]); pintar(true); } }, spec && spec.rotPadrao ? spec.rotPadrao : T('Cores do perfil', 'Profile colors')));
  };
  // (1.0.2) a lista de acessórios do editor (emoji, imagem ou GIF; lugar, tamanho, giro, movimento, camada, espelho e ordem). Serve ao
  // cartão do perfil e à tela de chamada. o: { refazer, pintar, camadas: [[valor, rótulo], ...] }
  X.listaAcessorios = (acs, o) => {
    // (1.0.2) a lista mostra de cima para baixo como as camadas: o do alto fica na frente dos outros (por dentro, o último da lista guardada)
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= acs.length) return; [acs[i], acs[j]] = [acs[j], acs[i]]; A.som.tocar('click'); o.refazer(); o.pintar(); };
    const camada = (a, i) => {
      const sobe = A.ui.btn('', { icone: 'subir', tipo: 'sec', peq: true, redondo: true, titulo: T('Pôr na frente dos outros acessórios', 'Bring in front of other accessories'), onclick: () => mover(i, 1) });
      const desce = A.ui.btn('', { icone: 'descer', tipo: 'sec', peq: true, redondo: true, titulo: T('Pôr atrás dos outros acessórios', 'Send behind other accessories'), onclick: () => mover(i, -1) });
      sobe.disabled = i === acs.length - 1; desce.disabled = i === 0;
      return h('div', { class: 'px-ac-camada' }, h('small', {}, T('Camada', 'Layer')),
        A.ui.seg(o.camadas || [['', T('Na frente da foto', 'In front of photo')], ['atras', T('Atrás da foto', 'Behind photo')]], a.z === 'atras' ? 'atras' : '', (v) => { if (v) a.z = v; else delete a.z; o.pintar(); }),
        h('button', { type: 'button', class: 'px-ver px-ac-esp' + (a.f ? ' on' : ''), 'aria-pressed': a.f ? 'true' : 'false', title: T('Virar o acessório como num espelho', 'Flip the accessory like a mirror'), onclick: (e) => { if (a.f) delete a.f; else a.f = 1; e.currentTarget.classList.toggle('on', !!a.f); e.currentTarget.setAttribute('aria-pressed', a.f ? 'true' : 'false'); A.som.tocar('click'); o.pintar(); } }, '⇋ ' + T('Espelhar', 'Mirror')),
        acs.length > 1 ? h('span', { class: 'px-ac-ordem' }, sobe, desce) : null);
    };
    return h('div', { class: 'col', estilo: { gap: '8px' } }, ...acs.map((a, i) => [a, i]).reverse().map(([a, i]) => h('div', { class: 'px-ac-ed' },
      h('button', { type: 'button', class: 'campo px-ac-esc', title: T('Trocar o acessório (emoji, imagem ou GIF)', 'Change the accessory (emoji, image or GIF)'), onclick: (ev) => X.escolherAcessorio(ev.currentTarget, a, () => { o.refazer(); o.pintar(); }) },
        a.i && A.api && A.api.eu ? h('img', { src: X.urlAcessorio(A.api.eu.codigo, a.i), alt: '' }) : h('span', {}, a.e || '✨'), A.icone('seta', 12)),
      ...[['x', T('Lado', 'Side'), 0, 100], ['y', T('Altura', 'Height'), 0, 100], ['s', T('Tamanho', 'Size'), 16, o.tamMax || 96], ['r', T('Giro', 'Turn'), -180, 180]].map(([k, r, mi, ma]) => h('label', { class: 'px-ac-sl' }, h('small', {}, r), A.ui.slider({ valor: a[k], min: mi, max: ma, passo: 1, oninput: (v) => { a[k] = +v; o.pintar(); } }))),
      h('select', { class: 'campo', onchange: (e) => { a.m = e.target.value; o.pintar(); } }, ...X.MOV_ACESSORIO.map(([v, pt, en]) => h('option', { value: v, selected: (a.m || '') === v }, T(pt, en)))),
      h('button', { type: 'button', class: 'px-ver', onclick: () => { acs.splice(i, 1); o.refazer(); o.pintar(); } }, T('Tirar', 'Remove')), camada(a, i))));
  };
  X.abaPerfil = (st, pintar, { rot, dica }) => {
    const caixa = h('div', { class: 'col', estilo: { gap: '10px' } });
    // as cores lembradas começam pelas que estão salvas no perfil (se ainda não havia nada lembrado)
    for (const k of ['mo', 'an', 'mc']) if (st[k] && st[k].c && st[k].c.length && !memCores(k)) guardarCores(k, st[k].c);
    const lembradas = (k) => memCores(k) || (st[k] && st[k].c) || [];
    // o anel guarda a lista inteira: escolher um anel de 2 cores depois do Arco-íris (até 8) não apaga as outras do Arco-íris
    const lembrarAnel = (l) => { const m = memCores('an') || []; guardarCores('an', l.length && l.length >= X.MAX_CORES_ANEL(st.an && st.an.t) && m.length > l.length ? [...l, ...m.slice(l.length)] : l); };
    let amostrasMo = [];
    const pintarMo = (a, id) => X.moldura(a, { t: id, c: (st.mo && st.mo.c) || lembradas('mo') }, st.cor1 || '#2d9ee0', st.cor2 || '#7fd3ff');
    const amostraMo = (id) => h('span', { class: 'px-op-amostra' }, (() => { const a = h('span', { class: 'avatar', estilo: { '--t': '34px' } }); pintarMo(a, id); amostrasMo.push([a, id]); return a; })());
    // a prévia do editor é redesenhada no quadro seguinte: espera o cartão novo para tocar nele
    const tocarPrevia = () => setTimeout(() => { const c = document.querySelector('.perfil-previa .perfil-cartao'); if (c && st.ab) X.abertura(c, st.ab); }, 80);
    // (1.0.2) as molduras e os anéis das integrações da Comunidade que você instalou (de graça para todos, como as bolhas de arte)
    const gradeArtistas = (anel, atual, escolher) => {
      const l = A.bolhaArte ? A.bolhaArte.fotosInstaladas(anel) : []; if (!l.length) return null;
      const sel = atual && atual.t === 'arte' ? atual.ig + '/' + atual.id : '';
      const amostra = (x) => { if (anel) return X.amostraAnel('arte', null, { ig: x.ig, id: x.id, a: x.a }); const av = h('span', { class: 'avatar', estilo: { '--t': '34px' } }); X.moldura(av, { t: 'arte', a: x.a }); return h('span', { class: 'px-op-amostra' }, av); };
      const porId = new Map(l.map((x) => [x.ig + '/' + x.id, x]));
      return h('div', { class: 'col', estilo: { gap: '4px' } }, h('small', { class: 'suave' }, T('De artistas (Integrações)', 'By artists (Integrations)')),
        X.grade(l.map((x) => [x.ig + '/' + x.id, x.nome, x.nome, 0]), sel, (k) => { const x = porId.get(k); escolher(x ? { t: 'arte', ig: x.ig, id: x.id, n: x.nome, a: x.a } : null); }, { nenhum: false, desenho: (k) => amostra(porId.get(k)) }));
    };
    function refazer() {
      const n = X.nivel(), nAc = X.ACESSORIOS_MAX(Math.max(n, 3)), niv = (l, id) => nivelEm(l, id);
      const acs = st.ac || (st.ac = []); amostrasMo = [];
      const lAc = X.listaAcessorios(acs, { refazer, pintar });
      caixa.replaceChildren(
        rot(T('Moldura da foto', 'Photo frame')), X.grade(X.MOLDURAS, st.mo && st.mo.t, (id) => { st.mo = id ? { t: id, c: lembradas('mo') } : null; refazer(); pintar(); }, { desenho: amostraMo }),
        gradeArtistas(false, st.mo, (x) => { st.mo = x; refazer(); pintar(); }),
        st.mo && st.mo.t !== 'arte' ? linhaCores(st.mo, (re) => { if (re) refazer(); else amostrasMo.forEach(([a, id]) => pintarMo(a, id)); pintar(); }, null, (l) => guardarCores('mo', l)) : null, st.mo && st.mo.t !== 'arte' ? X.faixaPrevia(niv(X.MOLDURAS, st.mo.t)) : null,
        rot(T('Animação ao abrirem seu perfil', 'Animation when your profile opens')), X.grade(X.ABERTURAS, st.ab, (id) => { st.ab = id || ''; refazer(); pintar(); if (id) tocarPrevia(); }, { desenho: (id) => X.amostraAbertura(id, st.cor1, st.cor2) }),
        st.ab ? h('div', { class: 'linha', estilo: { gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' } }, A.ui.btn(T('Ver no meu cartão', 'Play on my card'), { icone: 'play', tipo: 'sec', peq: true, onclick: tocarPrevia }), X.faixaPrevia(niv(X.ABERTURAS, st.ab))) : null,
        rot(T('Acessórios no cartão', 'Card accessories')), lAc,
        acs.length < nAc ? A.ui.btn(T('Pôr um acessório', 'Add an accessory'), { tipo: 'sec', peq: true, icone: 'mais', onclick: () => { acs.push({ e: X.EMOJIS_ACESSORIO[acs.length % X.EMOJIS_ACESSORIO.length], x: 80, y: 12, s: 32, r: 0, m: '' }); refazer(); pintar(); } }) : null,
        acs.length ? X.faixaPrevia(3) : dica(T('Até 3 no Donator e até 8 no Supporter.', 'Up to 3 on Donator and up to 8 on Supporter.')),
        rot(T('Na chamada', 'In calls')),
        h('small', { class: 'suave' }, T('Anel quando você fala', 'Ring when you speak')), X.grade(X.ANEIS, st.an && st.an.t, (id) => { st.an = id ? { t: id, c: lembradas('an').slice(0, X.MAX_CORES_ANEL(id)) } : null; refazer(); pintar(); }, { desenho: (id) => X.amostraAnel(id, st.an && st.an.c) }),
        gradeArtistas(true, st.an, (x) => { st.an = x; refazer(); pintar(); }),
        st.an && st.an.t !== 'arte' ? linhaCores(st.an, (re) => { if (re) refazer(); else caixa.querySelectorAll('.px-anel-am').forEach((el) => X.coresAnel(el, st.an.t, st.an.c)); pintar(); }, { min: 2, max: X.MAX_CORES_ANEL(st.an.t), padrao: X.CORES_ANEL[st.an.t] || X.CORES_ANEL.padrao, rotPadrao: T('Cores do anel', 'Ring colors') }, lembrarAnel) : null, st.an && st.an.t !== 'arte' ? X.faixaPrevia(niv(X.ANEIS, st.an.t)) : null,
        h('small', { class: 'suave' }, T('Som quando você entra (quem não quiser ouvir desliga)', 'Sound when you join (anyone can turn it off)')), X.grade(X.SONS_ENTRAR, st.se, (id) => { st.se = id || ''; refazer(); }, { desenho: () => h('span', { class: 'px-op-amostra' }, '🔔'), ouvir: (id) => A.som.tocar('entrar-' + id) }),
        st.se ? X.faixaPrevia(niv(X.SONS_ENTRAR, st.se)) : null,
        h('small', { class: 'suave' }, T('Moldura da sua câmera (desenhada na tela de quem assiste)', 'Your camera frame (drawn on the viewer\'s screen)')), X.grade(X.MOLDURAS_CAMERA, st.mc && st.mc.t, (id) => { st.mc = id ? { t: id, c: lembradas('mc').slice(0, X.CORES_CAMERA[id] ? X.CORES_CAMERA[id][1] : 2) } : null; refazer(); }, { desenho: (id) => { const am = h('span', { class: 'px-cam-am px-cam-' + id, 'data-mc': id }); X.pintarCamera(am, st.mc && st.mc.t === id ? st.mc : { t: id }); return h('span', { class: 'px-op-amostra' }, am); } }),
        st.mc ? linhaCores(st.mc, (re) => { if (re) return refazer(); const am = caixa.querySelector('.px-cam-am[data-mc="' + st.mc.t + '"]'); if (am) X.pintarCamera(am, st.mc); }, { min: X.CORES_CAMERA[st.mc.t] ? X.CORES_CAMERA[st.mc.t][0] : 2, max: X.CORES_CAMERA[st.mc.t] ? X.CORES_CAMERA[st.mc.t][1] : 2, padrao: X.coresCamera({ t: st.mc.t }), rotPadrao: T('Cores de fábrica', 'Default colors') }, (l) => guardarCores('mc', l)) : null, st.mc ? X.faixaPrevia(niv(X.MOLDURAS_CAMERA, st.mc.t)) : null,
        h('small', { class: 'suave' }, T('Cartão de ligação: a imagem que aparece no aviso de quem você liga', 'Call card: the image shown when you call someone')),
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'center' } },
          st.clLocal || (st.cl && st.clV) ? h('span', { class: 'px-cl-am', estilo: { 'background-image': `url("${st.clLocal || X.urlLigacao(A.api.eu.codigo, st.clV)}")` } }) : null,
          A.ui.btn(T('Escolher imagem ou GIF', 'Pick an image or GIF'), { tipo: 'sec', peq: true, icone: 'imagem', onclick: () => { const i = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' }); i.onchange = () => { const f = i.files && i.files[0]; if (!f) return; if (f.size > 20 * 1048576) { A.ui.toast(T('Imagem grande demais (máximo 20 MB).', 'Image too large (max 20 MB).'), { tipo: 'erro' }); return; } st.clNovo = f; st.clLocal = URL.createObjectURL(f); st.cl = true; refazer(); }; i.click(); } }),
          st.cl ? A.ui.btn(T('Tirar', 'Remove'), { tipo: 'sec', peq: true, onclick: () => { st.cl = false; st.clNovo = null; st.clLocal = ''; refazer(); } }) : null),
        st.cl ? X.faixaPrevia(3) : null,
        dica(T('Tudo aqui é a mais do Aero Bubble: o resto do perfil continua grátis. Se o plano acabar, suas escolhas ficam guardadas e voltam quando renovar.', 'Everything here is an Aero Bubble extra: the rest of the profile stays free. If your plan ends, your choices are kept and come back when you renew.')));
    }
    refazer();
    return caixa;
  };
  // o que vai para o servidor ao salvar (o servidor confere o plano de novo)
  X.paraSalvar = (st) => ({ mo: st.mo || null, ab: st.ab || '', ac: st.ac || [], an: st.an || null, se: st.se || '', mc: st.mc || null, cl: !!st.cl });
  X.estadoDe = (eu) => ({ mo: eu.mo ? { ...eu.mo, c: (eu.mo.c || []).slice() } : null, ab: eu.ab || '', ac: (eu.ac || []).map((a) => ({ ...a })), an: eu.an ? { ...eu.an, c: (eu.an.c || []).slice() } : null, se: eu.se || '', mc: eu.mc ? { ...eu.mc, c: (eu.mc.c || []).slice() } : null, cl: !!eu.cl, clV: eu.clV || 0, clNovo: null, clLocal: '' });

  // ----- emojis próprios (Plus 10, Donator 30 com animados, Supporter 100) -----
  X.maxEmojis = (n = X.nivel()) => (n >= 4 ? 100 : n >= 3 ? 30 : n >= 2 ? 10 : 0);
  let emCache = null;
  X.emojis = {
    listar: async () => emCache || (emCache = await A.api.req('emojis')),
    criar: async (f, nome) => {
      let corpo = f, tipo = f.type;
      if (f.type !== 'image/gif' || X.nivel() < 3) { // todos no mesmo tamanho (128x128, sem distorcer, fundo transparente)
        const bmp = await createImageBitmap(f); const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
        const e = Math.min(128 / bmp.width, 128 / bmp.height); cv.getContext('2d').drawImage(bmp, (128 - bmp.width * e) / 2, (128 - bmp.height * e) / 2, bmp.width * e, bmp.height * e);
        corpo = await new Promise((ok) => cv.toBlob(ok, 'image/webp', 0.92)); tipo = 'image/webp';
      } else if (f.size > 512 * 1024) throw new Error(T('GIF grande demais para emoji (máximo 512 KB).', 'GIF too large for an emoji (max 512 KB).'));
      const r = await fetch(`${A.api.servidor}/api/emojis?n=${encodeURIComponent(nome)}`, { method: 'POST', headers: { Authorization: 'Bearer ' + A.api.token, 'Content-Type': tipo }, body: corpo });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || T('Não consegui criar o emoji.', 'Could not create the emoji.'));
      emCache = { emojis: d.emojis, codigo: d.codigo };
    },
    apagar: async (id) => { const d = await A.api.req('emojis/' + id, null, 'DELETE'); if (emCache) emCache.emojis = d.emojis || []; },
    token: (cod, e) => `<em:${cod}:${e.id}:${e.n}>`,
    url: (cod, id) => `${A.api.servidor}/api/emoji/${cod}/${id}`,
  };
  X.emojisCache = () => { if (!emCache && X.maxEmojis() > 0) X.emojis.listar().catch(() => {}); return emCache; }; // (1.0.2) a busca com ":" no chat
  // ao enviar: cada :nome: de um emoji seu vira o emoji (digitado à mão ou escolhido no painel)
  X.trocarEmojis = (t) => {
    if (X.maxEmojis() === 0) return t;
    if (!emCache) { X.emojis.listar().catch(() => {}); return t; }
    const l = emCache.emojis || []; if (!l.length || t.indexOf(':') < 0) return t;
    return t.replace(/:([a-z0-9_]{2,24}):/g, (m0, n) => { const e = l.find((x) => x.n === n); return e ? X.emojis.token(emCache.codigo, e) : m0; });
  };
  A.evt.on('hub:eu', () => { if (!emCache && X.maxEmojis() > 0) X.emojis.listar().catch(() => {}); });
  // a seção "Seus emojis" no painel de emojis do chat
  X.secaoEmojis = (inserir) => {
    const caixa = h('div', { class: 'px-emojis' });
    const pintar = async () => {
      const n = X.nivel(), max = X.maxEmojis(n);
      if (!max) { caixa.replaceChildren(h('div', { class: 'cx-emoji-tit px-emojis-tit' }, T('Seus emojis', 'Your emojis'), X.selo(2)), h('div', { class: 'peq suave px-emojis-dica' }, T('Crie emojis seus e use no meio do texto. ', 'Make your own emojis and use them inline. '), h('button', { type: 'button', class: 'px-ver', onclick: X.verPlanos }, T('Ver planos', 'See plans')))); return; }
      let d; try { d = await X.emojis.listar(); } catch (e) { caixa.replaceChildren(); return; }
      const arq = h('input', { type: 'file', accept: n >= 3 ? 'image/png,image/webp,image/jpeg,image/gif' : 'image/png,image/webp,image/jpeg', hidden: true });
      arq.addEventListener('change', async () => {
        const f = arq.files[0]; arq.value = ''; if (!f) return;
        const sug = (f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 24) || 'emoji').padEnd(2, '_');
        const campo = h('input', { class: 'campo', value: sug, maxlength: 24, autocomplete: 'off', spellcheck: 'false' });
        campo.addEventListener('input', () => { campo.value = campo.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
        const ok = await A.ui.confirmar(h('div', { class: 'col', estilo: { gap: '8px' } }, h('p', { estilo: { margin: 0 } }, T('Nome do emoji (aparece como :nome:)', 'Emoji name (shows as :name:)')), campo), { sim: T('Criar', 'Create'), titulo: T('Novo emoji', 'New emoji') });
        if (!ok) return;
        try { await X.emojis.criar(f, campo.value); A.som.tocar('sucesso'); pintar(); } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); }
      });
      const lista = d.emojis || [];
      const gradeE = h('div', { class: 'px-emojis-grade' });
      const tit = A.ui.tituloRecolhe ? A.ui.tituloRecolhe('emj-seus', T('Seus emojis', 'Your emojis'), (rec) => { gradeE.hidden = rec; }, h('small', { class: 'suave' }, lista.length + '/' + max)) : h('div', { class: 'cx-emoji-tit px-emojis-tit' }, T('Seus emojis', 'Your emojis'));
      tit.classList.add('px-emojis-tit');
      caixa.replaceChildren(arq, tit, gradeE);
      gradeE.append( ...lista.map((e) => {
          const b = h('button', { type: 'button', class: 'px-emoji-b', title: ':' + e.n + ':', onclick: () => inserir(':' + e.n + ':') }, h('img', { src: X.emojis.url(d.codigo, e.id), alt: ':' + e.n + ':', loading: 'lazy', draggable: 'false' }));
          b.addEventListener('contextmenu', (ev) => { ev.preventDefault(); A.ui.menuContexto(ev, [{ texto: T('Apagar emoji', 'Delete emoji'), icone: 'lixo', perigo: true, onclick: async () => { try { await X.emojis.apagar(e.id); pintar(); } catch (er) { A.ui.toast(er.message, { tipo: 'erro' }); } } }]); });
          return b;
        }), lista.length < max ? h('button', { type: 'button', class: 'px-emoji-b px-emoji-mais', title: T('Criar emoji', 'Create emoji'), onclick: () => arq.click() }, '+') : '');
    };
    pintar();
    return caixa;
  };

  // ----- fundo por conversa (só você vê, guardado neste aparelho): Plus imagem, Donator e Supporter GIF ou vídeo -----
  const idb = () => new Promise((ok, falha) => { const r = indexedDB.open('aero-extras', 1); r.onupgradeneeded = () => r.result.createObjectStore('fundos'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
  const idbFazer = async (modo, f) => { const db = await idb(); return new Promise((ok, falha) => { const tx = db.transaction('fundos', modo), st = tx.objectStore('fundos'), r = f(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => falha(tx.error); }); };
  const urls = new Map(); // cid -> url (blob:) já aberta
  X.fundoConversa = {
    ler: async (cid) => { try { return await idbFazer('readonly', (st) => st.get(cid)); } catch (e) { return null; } },
    // põe o fundo atrás das mensagens (some se o plano não cobre mais: fica guardado e volta ao renovar)
    aplicar: async (cid, alvo) => {
      if (!alvo) return;
      alvo.querySelectorAll(':scope > .px-fc').forEach((e) => e.remove()); alvo.classList.remove('px-com-fc');
      const d = await X.fundoConversa.ler(cid); if (!d || !d.blob) return;
      const video = /^video\//.test(d.blob.type), gif = d.blob.type === 'image/gif';
      if (!X.tem(video || gif ? 3 : 2)) return;
      let u = urls.get(cid); if (!u || u.blob !== d.blob) { if (u) URL.revokeObjectURL(u.url); u = { url: URL.createObjectURL(d.blob), blob: d.blob }; urls.set(cid, u); }
      const midia = video ? h('video', { src: u.url, muted: true, autoplay: true, loop: true, playsinline: true }) : h('img', { src: u.url, alt: '', draggable: 'false' });
      if (video) { midia.muted = true; midia.play().catch(() => {}); }
      alvo.classList.add('px-com-fc');
      alvo.prepend(h('div', { class: 'px-fc', 'aria-hidden': 'true', estilo: { '--px-fc-escuro': (d.escuro ?? 35) / 100, '--px-fc-blur': (d.blur ?? 0) + 'px' } }, midia));
    },
    editar: async (cid, aoMudar) => {
      const atual = await X.fundoConversa.ler(cid) || { escuro: 35, blur: 0 };
      const st = { blob: atual.blob || null, escuro: atual.escuro ?? 35, blur: atual.blur ?? 0 };
      const prev = h('div', { class: 'px-fc-prev' });
      const pintar = () => { prev.replaceChildren(); if (!st.blob) { prev.append(h('span', { class: 'suave peq' }, T('Sem fundo: o chat fica como sempre.', 'No background: the chat looks as usual.'))); return; } const u = URL.createObjectURL(st.blob), v = /^video\//.test(st.blob.type); const m = v ? h('video', { src: u, muted: true, autoplay: true, loop: true, playsinline: true }) : h('img', { src: u, alt: '' }); prev.append(m, h('i', { estilo: { background: `rgba(0,0,0,${st.escuro / 100})`, 'backdrop-filter': `blur(${st.blur}px)` } })); faixa.replaceChildren(...[X.faixaPrevia(v || st.blob.type === 'image/gif' ? 3 : 2)].filter(Boolean)); };
      const faixa = h('div', {});
      const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm', hidden: true });
      arq.addEventListener('change', () => { const f = arq.files[0]; arq.value = ''; if (!f) return; if (f.size > 40 * 1048576) { A.ui.toast(T('Arquivo grande demais (máximo 40 MB).', 'File too large (max 40 MB).'), { tipo: 'erro' }); return; } st.blob = f; pintar(); });
      const corpo = h('div', { class: 'col', estilo: { gap: '10px' } }, arq, prev, faixa,
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, A.ui.btn(T('Escolher imagem, GIF ou vídeo', 'Pick an image, GIF or video'), { tipo: 'sec', peq: true, icone: 'imagem', onclick: () => arq.click() }), A.ui.btn(T('Tirar o fundo', 'Remove background'), { tipo: 'sec', peq: true, onclick: () => { st.blob = null; pintar(); } })),
        h('div', {}, h('small', { class: 'suave' }, T('Escurecer', 'Darken')), A.ui.slider({ valor: st.escuro, min: 0, max: 85, passo: 1, oninput: (v) => { st.escuro = +v; pintar(); } })),
        h('div', {}, h('small', { class: 'suave' }, T('Desfocar', 'Blur')), A.ui.slider({ valor: st.blur, min: 0, max: 20, passo: 1, oninput: (v) => { st.blur = +v; pintar(); } })),
        h('div', { class: 'peq suave' }, T('Só você vê, e fica só neste aparelho. Imagem: Plus. GIF e vídeo: Donator e Supporter.', 'Only you see it, and it stays on this device. Image: Plus. GIF and video: Donator and Supporter.')));
      pintar();
      A.ui.modal(T('Fundo desta conversa', 'Background for this chat'), corpo, { largura: 460, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Salvar', 'Save'), valor: true }], aoFechar: async (v) => {
        if (!v) return;
        const precisa = st.blob ? (/^video\//.test(st.blob.type) || st.blob.type === 'image/gif' ? 3 : 2) : 0;
        if (precisa && !X.tem(precisa)) { X.verPlanos(); return; }
        try { if (st.blob) await idbFazer('readwrite', (s2) => s2.put({ blob: st.blob, escuro: st.escuro, blur: st.blur }, cid)); else await idbFazer('readwrite', (s2) => s2.delete(cid)); } catch (e) { A.ui.toast(T('Não consegui guardar o fundo.', 'Could not save the background.'), { tipo: 'erro' }); return; }
        if (aoMudar) aoMudar();
      } });
    },
  };
  // ----- (1.0.0) os toques de chamada novos (os 4 de antes seguem grátis): Standard +2, Plus +4, Donator todos + um toque por amigo, Supporter o seu próprio -----
  // [id, pt, en, nível, repete a cada ms]
  X.TOQUES = [['sinos', 'Sinos', 'Bells', 1, 3200], ['cristais', 'Cristais', 'Crystals', 1, 3000], ['pingos', 'Pingos', 'Droplets', 2, 3000], ['harpa', 'Harpa', 'Harp', 2, 3600],
    ['retro', 'Retrô', 'Retro', 2, 2800], ['lounge', 'Lounge', 'Lounge', 2, 4000], ['aurora', 'Aurora', 'Aurora', 3, 4200], ['orbita', 'Órbita', 'Orbit', 3, 3600]];
  if (A.som && A.som.registrar) {
    const { nota, blup, brilho, sopro, N } = A.som.pecas, R = (id, fn) => A.som.registrar('toque-x-' + id, fn);
    R('sinos', (b, t) => { [N.sol6, N.mi6, N.do6, N.sol5].forEach((f, i) => { nota(b, f, t + i * 0.22, 1, { vol: 0.1, harm: 0.5, rev: 0.7 }); nota(b, f * 2.76, t + i * 0.22, 0.3, { vol: 0.02 }); }); });
    R('cristais', (b, t) => { [N.do7, N.sol6, N.mi7, N.do7, N.sol7].forEach((f, i) => nota(b, f, t + i * 0.1, 0.45, { vol: 0.08, harm: 0.4, rev: 0.75 })); });
    R('pingos', (b, t) => { [700, 900, 1150, 900, 1400].forEach((f, i) => blup(b, f, t + i * 0.13, 0.22, 0.13)); });
    // (1.0.0) harpa de verdade: cordas dedilhadas (subida rápida e uma resposta mais grave), cada corda com o seu brilho
    R('harpa', (b, t) => {
      const corda = (f, at, v) => { nota(b, f, at, 1.4, { vol: v, tipo: 'triangle', rev: 0.7, ataque: 0.004 }); nota(b, f * 2, at, 0.5, { vol: v * 0.3, rev: 0.4, ataque: 0.003 }); };
      [N.do5, N.re5, N.mi5, N.sol5, N.la5, N.do6, N.re6, N.mi6].forEach((f, i) => corda(f, t + i * 0.055, 0.075));
      [N.sol5, N.mi5, N.do5].forEach((f, i) => corda(f, t + 0.75 + i * 0.12, 0.06));
      corda(N.do4, t + 0.75, 0.05);
    });
    // (1.0.0) retrô de verdade: um videogame de 8 bits (onda quadrada seca, arpejo rápido e o baixo em onda triangular, sem eco)
    R('retro', (b, t) => {
      const q = 0.085, bip = (f, i, d = 0.07, v = 0.045) => nota(b, f, t + i * q, d, { vol: v, tipo: 'square', rev: 0, ataque: 0.001 });
      [N.do6, N.mi6, N.sol6, N.do7, N.sol6, N.mi6, N.fa6, N.la6, N.do7, N.fa7, N.do7, N.la6].forEach((f, i) => bip(f, i));
      bip(N.sol6, 12, 0.07); bip(N.si6, 13, 0.07); bip(N.re7, 14, 0.07); bip(N.sol7, 15, 0.22, 0.04);
      [[N.do3, 0], [N.do4, 2], [N.fa3, 4], [N.fa4, 6], [N.sol3, 8], [N.sol4, 10], [N.do4, 12]].forEach(([f, i]) => nota(b, f, t + i * q * 1.333, 0.16, { vol: 0.09, tipo: 'triangle', rev: 0, ataque: 0.002 }));
    });
    R('lounge', (b, t) => { [[220, 0, 1.4], [277, 0, 1.4], [330, 0, 1.4], [415, 0.5, 1]].forEach(([f, d, dur]) => nota(b, f, t + d, dur, { vol: 0.06, rev: 0.7, ataque: 0.05 })); });
    // (1.0.0) aurora repaginada: um acorde que acende devagar (sem o vento e sem o chiado do fim) e uma melodia de sinos suaves por cima
    R('aurora', (b, t) => {
      const { colchao } = A.som.pecas;
      [N.la3, N.mi4, N.sol4, N.si4, N.re5].forEach((f, i) => colchao(b, f, t + i * 0.04, 2.6, 0.022, { tipo: 'sine', ataque: 0.7, queda: 1.1, rev: 0.8 }));
      [[N.mi6, 0.35], [N.si5, 0.6], [N.re6, 0.85], [N.la5, 1.1], [N.si5, 1.5], [N.mi6, 1.75], [N.la6, 2.0]].forEach(([f, d]) => nota(b, f, t + d, 1.1, { vol: 0.06, rev: 0.75, ataque: 0.012, harm: 0.15 }));
    });
    R('orbita', (b, t) => { [500, 750, 1000, 1500].forEach((f, i) => nota(b, f, t + i * 0.12, 0.5, { vol: 0.07, glide: f * 1.5, rev: 0.7 })); nota(b, 110, t, 0.9, { vol: 0.08, rev: 0.4 }); });
  }
  const ID_TOQUE = '__toque'; // o toque próprio (Supporter): um arquivo de som, guardado neste aparelho como os fundos
  let audioToque = null, urlToque = null;
  X.pararToque = () => { if (audioToque) { try { audioToque.pause(); } catch (e) { /* ok */ } audioToque = null; } };
  X.nivelToque = (id) => (id === 'proprio' ? 4 : nivelEm(X.TOQUES, id));
  // quem está ligando decide o toque: o do amigo (Donator), o seu escolhido; o que o plano não cobre mais toca o padrão de antes
  X.toqueDe = (codigo) => {
    const porAmigo = X.tem(3) && codigo ? (A.cfg.v.toquesAmigo || {})[codigo] : '';
    const id = porAmigo || A.cfg.v.toqueExtra || '';
    return id && X.tem(X.nivelToque(id)) ? id : '';
  };
  // toca (e repete) um toque dos extras; devolve false quando não há nenhum (o chamada.js toca o de antes)
  X.tocarToque = async (id, repetir) => {
    if (!id) return false;
    if (id === 'proprio') {
      const d = await X.fundoConversa.ler(ID_TOQUE); if (!d || !d.blob) return false;
      X.pararToque(); if (urlToque) URL.revokeObjectURL(urlToque); urlToque = URL.createObjectURL(d.blob);
      audioToque = new Audio(urlToque); audioToque.loop = true; audioToque.volume = A.limitar(A.cfg.v.som.volume, 0, 100) / 100;
      try { const sid = A.cfg.v.audio && A.cfg.v.audio.saida; if (sid && audioToque.setSinkId) audioToque.setSinkId(sid).catch(() => {}); } catch (e) { /* ok */ }
      audioToque.play().catch(() => {}); return true;
    }
    const t = X.TOQUES.find((x) => x[0] === id); if (!t) return false;
    repetir('toque-x-' + id, t[4]); return true;
  };
  X.guardarToqueProprio = async (f) => { if (f) await idbFazer('readwrite', (s2) => s2.put({ blob: f, nome: f.name }, ID_TOQUE)); else await idbFazer('readwrite', (s2) => s2.delete(ID_TOQUE)); };
  // a escolha do toque nas Configurações (embaixo do toque de antes): com o selo, o travado só toca a prévia
  X.secaoToques = () => {
    const caixa = h('div', { class: 'px-toques' }), faixa = h('div', {});
    const arq = h('input', { type: 'file', accept: 'audio/*', hidden: true });
    let nomeProprio = '';
    X.fundoConversa.ler(ID_TOQUE).then((d) => { nomeProprio = (d && d.nome) || ''; pintar(); });
    arq.addEventListener('change', async () => { const f = arq.files[0]; arq.value = ''; if (!f) return; if (f.size > 4 * 1048576) { A.ui.toast(T('Arquivo grande demais (máximo 4 MB).', 'File too large (max 4 MB).'), { tipo: 'erro' }); return; }
      try { await X.guardarToqueProprio(f); nomeProprio = f.name; A.cfg.v.toqueExtra = 'proprio'; A.cfg.salvar(); pintar(); } catch (e) { A.ui.toast(T('Não consegui guardar o toque.', 'Could not save the ringtone.'), { tipo: 'erro' }); } });
    const ouvir = (id) => { X.pararToque(); if (id === 'proprio') { X.tocarToque('proprio', () => {}); setTimeout(X.pararToque, 4000); } else A.som.tocar('toque-x-' + id); };
    const pintar = () => {
      const atual = A.cfg.v.toqueExtra || '';
      const l = X.TOQUES.map(([id, pt, en, n]) => [id, pt, en, n]).concat([['proprio', nomeProprio || 'Meu toque', nomeProprio || 'My ringtone', 4]]);
      caixa.replaceChildren(X.grade(l, atual, (id) => {
        faixa.replaceChildren();
        if (!id) { A.cfg.v.toqueExtra = ''; A.cfg.salvar(); pintar(); return; }
        const n = X.nivelToque(id);
        if (!X.tem(n)) { faixa.replaceChildren(X.faixaPrevia(n) || ''); return; }
        if (id === 'proprio' && !nomeProprio) { arq.click(); return; }
        A.cfg.v.toqueExtra = id; A.cfg.salvar(); pintar();
      }, { desenho: (id) => h('span', { class: 'px-op-amostra' }, id === 'proprio' ? '🎵' : '🔔'), ouvir: (id) => { if (id !== 'proprio' || nomeProprio) ouvir(id); } }), faixa, arq,
      X.tem(4) ? h('div', { class: 'linha', estilo: { gap: '8px', 'margin-top': '6px' } }, A.ui.btn(nomeProprio ? T('Trocar meu toque', 'Change my ringtone') : T('Escolher meu toque', 'Pick my ringtone'), { tipo: 'sec', peq: true, onclick: () => arq.click() })) : null);
    };
    pintar();
    return h('div', {}, h('div', { class: 'peq suave', estilo: { margin: '6px 0' } }, T('Toques do Aero Bubble (no lugar do toque acima):', 'Aero Bubble ringtones (instead of the one above):')), caixa);
  };
  // o toque de um amigo (Donator e Supporter): no menu da conversa
  X.editarToqueAmigo = (codigo, nome) => {
    const m = A.cfg.v.toquesAmigo || {};
    const l = X.TOQUES.map(([id, pt, en]) => [id, pt, en, 3]);
    const faixa = h('div', {}, X.faixaPrevia(3) || '');
    let esc = m[codigo] || '';
    const grade = () => X.grade(l, esc, (id) => { esc = id; caixa.replaceChildren(grade()); }, { desenho: () => h('span', { class: 'px-op-amostra' }, '🔔'), ouvir: (id) => A.som.tocar('toque-x-' + id) });
    const caixa = h('div', {}, grade());
    A.ui.modal(T('Toque de ', 'Ringtone for ') + nome, h('div', { class: 'col', estilo: { gap: '10px' } }, caixa, faixa, h('div', { class: 'peq suave' }, T('Quando essa pessoa te ligar, toca este. Fica neste aparelho.', 'When this person calls you, this one plays. Stays on this device.'))), { largura: 460, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Salvar', 'Save'), valor: true }], aoFechar: (v) => {
      if (!v) return;
      if (!X.tem(3)) { X.verPlanos(); return; }
      const n = { ...(A.cfg.v.toquesAmigo || {}) }; if (esc) n[codigo] = esc; else delete n[codigo]; A.cfg.v.toquesAmigo = n; A.cfg.salvar();
    } });
  };
  // ----- (1.0.0) na chamada: o anel de quem fala, a moldura da câmera e o som de entrar (desenhados em quem vê; nada passa pela transmissão) -----
  X.extrasDe = (cod) => {
    const eu = A.api && A.api.eu;
    if (eu && cod === eu.codigo) { const n = X.nivel(), o = {}; if (eu.an && nivelEm(X.ANEIS, eu.an.t) <= n) o.an = eu.an; if (eu.mc && nivelEm(X.MOLDURAS_CAMERA, eu.mc.t) <= n) o.mc = eu.mc; if (eu.se && nivelEm(X.SONS_ENTRAR, eu.se) <= n) o.se = eu.se; return o; }
    const p = A.talk && A.talk.pessoaDe ? A.talk.pessoaDe(cod) : null;
    return (p && p.extra) || {};
  };
  // marca o elemento (a janelinha da pessoa ou a bolinha na faixa da chamada) com o anel e a moldura dela
  X.marcarChamada = (el, cod) => {
    if (!el) return el;
    const e = X.extrasDe(cod);
    if (e.an && e.an.t) { el.dataset.an = e.an.t; X.coresAnel(el, e.an.t, e.an.c); } else { delete el.dataset.an; delete el.dataset.anc; }
    if (e.mc && e.mc.t) { el.dataset.mc = e.mc.t; X.pintarCamera(el, e.mc); } else delete el.dataset.mc;
    const av = el.querySelector('.avatar'); X.anelFx(av, e.an && e.an.t, e.an); if (av) av._cod = cod; // (1.0.2) o volume da voz dela chega por esse código
    if (av && av.dataset.an && el.classList.contains('falando') !== av.classList.contains('an-on')) X.fala(el, el.classList.contains('falando'));
    return el;
  };
  // (1.0.1) o anel de fala é desenhado com peças próprias (<b class="px-fx"> com <i> dentro), atrás da foto. Cada anel diz as peças dele;
  // as barrinhas do equalizador ganham altura e ritmo próprios (sempre os mesmos para a mesma barra)
  // (1.0.1) as cores do anel: as escolhidas valem em TODOS. Sem escolher, cada anel tem as cores dele (data-anc marca quando a pessoa escolheu)
  // (1.0.2) o anel brinca com a VOZ: o volume de quem fala chega por X.volume e mexe em tudo. Chama, Elétrico, Onda, Aurora, Arco-íris, Sonar,
  // Corações e Notas são desenhados num canvas a cada quadro (a forma deforma com a voz; raios, faíscas, notas e corações nascem conforme o
  // volume); os outros crescem, brilham e aceleram com ele (--v e a velocidade das animações). O Arco-íris aceita de 2 a 8 cores (padrão:
  // as do espectro) e, quanto mais alto, mais cores aparecem e mais rápido ele gira
  X.ESPECTRO = ['#ff3b3b', '#ff9a1f', '#ffe53b', '#3ee06a', '#2fd3ff', '#3d6bff', '#a34dff'];
  X.CORES_ANEL = { padrao: ['#5ef08a', '#7fd3ff'], chama: ['#ff7a1f', '#ffd23f'], eletrico: ['#7fe7ff', '#2a7bff'], arco: X.ESPECTRO, aurora: ['#5ef08a', '#9b6cff'],
    coracoes: ['#ff6fae', '#ff9ad0'], notas: ['#ffd23f', '#ff7ad9'], sonar: ['#3ef0ff', '#7fd3ff'], orbita: ['#7fd3ff', '#ff7ad9'] };
  X.MAX_CORES_ANEL = (t) => (t === 'arco' ? 8 : 2);
  X.coresAnel = (el, t, c) => {
    if (!el) return; c = (c || []).filter(Boolean); const pad = X.CORES_ANEL[t] || X.CORES_ANEL.padrao;
    const l = (c.length ? c : pad).slice(0, X.MAX_CORES_ANEL(t));
    el.style.setProperty('--a1', l[0] || pad[0]); el.style.setProperty('--a2', l[1] || pad[1] || l[0]); el.style.setProperty('--an-cores', l.join(' '));
    if (c.length) el.dataset.anc = '1'; else delete el.dataset.anc;
    el.querySelectorAll('.avatar[data-an]').forEach((av) => { if (av._vz) { av._vz.cores = null; if (!vivos.has(av) && av._vz.amostra) parado(av); } });
  };
  const FX_ANEL = { cor: ['fx-halo', 'fx-anel fx-tubo', 'fx-anel fx-reflexo'], onda: ['fx-tela'], chama: ['fx-tela'],
    brilho: ['fx-halo', 'fx-anel fx-fio', 'fx-estrela', 'fx-estrela', 'fx-estrela', 'fx-estrela', 'fx-estrela'], arco: ['fx-tela', 'fx-anel fx-reflexo'], eletrico: ['fx-tela'],
    equalizador: ['fx-anel fx-base', ...Array(32).fill('fx-barra')], sonar: ['fx-tela', 'fx-anel fx-fio'], notas: ['fx-halo', 'fx-anel fx-fio', 'fx-tela'],
    orbita: ['fx-trilho', 'fx-lua', 'fx-lua', 'fx-anel fx-fio'], aurora: ['fx-tela'], coracoes: ['fx-halo', 'fx-anel fx-tubo', 'fx-anel fx-reflexo', 'fx-tela'] };
  const sorteio = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
  X.anelFx = (av, t, an) => {
    if (!av) return;
    let fx = av.querySelector(':scope > .px-fx');
    // (1.0.2) o anel de um artista da Comunidade: a imagem dele em volta da foto, crescendo com a voz (--v) o quanto o artista escolheu
    if (t === 'arte') {
      const chave = an && an.ig + '/' + an.id + '/' + (an.v || 0);
      if (fx && fx.dataset.t === 'arte' && fx.dataset.k === chave) return;
      const pc = an && A.bolhaArte && A.bolhaArte.foto(an.a, true, { meu: !!(A.api && A.api.eu && av.dataset.cod === A.api.eu.codigo) });
      if (fx) fx.remove();
      if (!pc) { delete av.dataset.an; av.classList.remove('an-on', 'an-sai'); return; }
      av.dataset.an = 'arte';
      fx = h('b', { class: 'px-fx px-fx-arte' + (pc.classList.contains('atras') ? '' : ' frente'), 'aria-hidden': 'true' }, pc); fx.dataset.t = 'arte'; fx.dataset.k = chave;
      if (pc.classList.contains('atras')) av.prepend(fx); else av.append(fx);
      return;
    }
    if (!t || !FX_ANEL[t]) { if (fx) fx.remove(); delete av.dataset.an; av.classList.remove('an-on', 'an-sai'); return; }
    av.dataset.an = t;
    if (fx && fx.dataset.t === t) return;
    if (fx) fx.remove();
    if (av._vz) { av._vz.p = []; av._vz.w = 0; av._vz.cores = null; }
    const pecas = FX_ANEL[t], total = {}, conta = {};
    for (const c of pecas) { const b = c.split(' ')[0]; total[b] = (total[b] || 0) + 1; }
    fx = h('b', { class: 'px-fx', 'aria-hidden': 'true' }, ...pecas.map((c) => {
      const b = c.split(' ')[0], k = (conta[b] = (conta[b] ?? -1) + 1), i = h(b === 'fx-tela' ? 'canvas' : 'i', { class: c });
      i.style.setProperty('--k', k); i.style.setProperty('--n', total[b]);
      if (b === 'fx-barra') { i.style.setProperty('--h', (0.45 + 0.55 * sorteio(k + 1)).toFixed(2)); i.style.setProperty('--d', (0.3 + 0.32 * sorteio(k + 7)).toFixed(2) + 's'); }
      return i;
    }));
    fx.dataset.t = t;
    av.prepend(fx); // primeiro filho: fica atrás da foto
  };
  // quem fala: acende o anel na hora e, quando a pessoa se cala, ele sai suave (meio segundo) e PARA. A classe "falando" segue como antes
  X.fala = (el, on) => {
    if (!el) return; on = !!on;
    el.classList.toggle('falando', on);
    const av = el.querySelector('.avatar[data-an]'); if (!av) return;
    if (on) { clearTimeout(av._anSai); av.classList.remove('an-sai'); if (!av.classList.contains('an-on')) { av.classList.add('an-on'); ligar(av); } return; }
    if (!av.classList.contains('an-on')) return;
    av.classList.remove('an-on'); av.classList.add('an-sai'); clearTimeout(av._anSai);
    av._anSai = setTimeout(() => av.classList.remove('an-sai'), 480);
  };
  // o volume de quem fala (0 a 1), por código da pessoa: a chamada manda a cada medida; a janelinha e a bolha da faixa leem daqui
  const VOZ = new Map();
  X.volume = (cod, v) => { if (cod) VOZ.set(cod, { v: v > 0 ? Math.min(1, v) : 0, em: performance.now() }); };
  const vivos = new Set(); let laco = 0;
  X._aneisVivos = () => vivos.size; // (1.0.2) para o relatório de desempenho
  const leve = () => document.documentElement.dataset.visual === 'lite';
  const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aleat = Math.random;
  const ruido = (x) => Math.sin(x) * 0.5 + Math.sin(x * 2.17 + 1.3) * 0.3 + Math.sin(x * 3.71 + 2.1) * 0.2;
  const sorteia = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  // uma voz de mentira (a prévia e a faixa de chamadas de outros, onde o volume não chega): sílabas, pausas e trechos mais altos
  const vozFalsa = (t, s) => { const a = 0.5 + 0.5 * Math.sin(t * 8.1 + s), b = 0.5 + 0.5 * Math.sin(t * 2.3 + s * 2.7), c = 0.5 + 0.5 * Math.sin(t * 0.63 + s * 1.3); return Math.min(1, a * (0.3 + 0.7 * b) * (0.35 + 0.9 * c) * 1.3); };
  // cores: qualquer cor CSS vira [r, g, b] para o canvas misturar
  let _cc = null;
  const rgb = (c) => { _cc = _cc || document.createElement('canvas').getContext('2d'); _cc.fillStyle = '#000'; _cc.fillStyle = c; const s = _cc.fillStyle; if (s[0] === '#') return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); return (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
  const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  const BR = [255, 255, 255], PR = [0, 0, 0];
  const css = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, al)).toFixed(3)})`;
  const estado = (av) => av._vz || (av._vz = { v: 0, t: aleat() * 100, s: aleat() * 10, p: [], ult: 0, quadro: 0, cores: null, w: 0, rate: 1 });
  const lerCores = (av, s) => {
    const cs = getComputedStyle(av), a1 = cs.getPropertyValue('--a1').trim() || '#5ef08a', a2 = cs.getPropertyValue('--a2').trim() || a1;
    const l = cs.getPropertyValue('--an-cores').trim().split(/\s+/).filter(Boolean);
    s.cores = { a1: rgb(a1), a2: rgb(a2), lista: (l.length ? l : [a1, a2]).map(rgb) };
  };
  const linha = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
  // corações e notas: nascem conforme o volume (mais alto = mais e mais rápidos), sobem balançando e somem
  const CORACAO = typeof Path2D !== 'undefined' ? new Path2D('M12 21.2 4.3 13.9C1.8 11.5 1.9 7.4 4.6 5.3c2.3-1.8 5.5-1.3 7.4.9 1.9-2.2 5.1-2.7 7.4-.9 2.7 2.1 2.8 6.2.3 8.6Z') : null;
  const NOTAS = typeof Path2D === 'undefined' ? [] : [
    (() => { const p = new Path2D('M11.4 17.6V2.6h1.9c.4 2.6 2.2 3.7 4 4.9 1.9 1.3 3 3.6 2 6.6-.3-2.6-2.2-4.2-5.9-4.6v8.1Z'); p.ellipse(8.6, 18.2, 4.4, 3.3, -0.38, 0, 7); return p; })(),
    (() => { const p = new Path2D('M7.9 18.3V5.2L21.2 2.6v13.8h-1.8V7.1L9.7 9v9.3Z'); p.ellipse(5.6, 18.6, 3.7, 2.8, -0.38, 0, 7); p.ellipse(17.4, 16.4, 3.7, 2.8, -0.38, 0, 7); return p; })()];
  const vidro = (c, forma, col) => {
    const g = c.createLinearGradient(0, 2, 0, 22); g.addColorStop(0, css(mix(col, BR, 0.55))); g.addColorStop(0.5, css(col)); g.addColorStop(1, css(mix(col, PR, 0.22)));
    c.fillStyle = g; c.fill(forma); c.lineWidth = 0.9; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(forma);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(8, 7.5, 3, 1.7, -0.6, 0, 7); c.fill();
  };
  const particulas = (c, o, R, s, dt, k, deLado, desenha) => {
    const v = s.v; s.carga = (s.carga || 0) + dt * (0.6 + 12 * Math.pow(v, 1.25));
    while (s.carga >= 1) {
      s.carga -= 1; if (s.p.length >= 30) continue;
      const a = deLado ? (aleat() < 0.5 ? Math.PI : 0) + (aleat() - 0.5) * 1.1 : -Math.PI / 2 + (aleat() - 0.5) * Math.PI * 1.5;
      s.p.push({ x: o + Math.cos(a) * R * 1.05, y: o + Math.sin(a) * R * 1.05, vx: Math.cos(a) * R * (0.3 + 0.6 * aleat()) * (0.7 + v), vy: -R * (0.6 + 2 * v) * (0.7 + 0.6 * aleat()),
        vida: 0, max: 1 + 0.7 * aleat(), tam: R * (0.24 + 0.16 * aleat()) * (0.8 + 0.5 * v), gira: (aleat() - 0.5) * 0.9, fase: aleat() * 6, tipo: aleat() < 0.5 ? 0 : 1, col: aleat() < 0.6 });
    }
    for (let i = s.p.length - 1; i >= 0; i--) {
      const p = s.p[i]; p.vida += dt; if (p.vida >= p.max) { s.p.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(p.vida * 5 + p.fase) * R * 0.4) * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.2, dt);
      const q = p.vida / p.max, sc = q < 0.15 ? 0.3 + (q / 0.15) * 0.85 : 1.15 - 0.3 * q;
      c.save(); c.globalAlpha = q > 0.6 ? (1 - q) / 0.4 : 1; c.translate(p.x, p.y); c.rotate(p.gira * Math.sin(p.vida * 3 + p.fase)); c.scale((sc * p.tam) / 24, (sc * p.tam) / 24); c.translate(-12, -12);
      desenha(c, p, p.col ? k.a1 : k.a2); c.restore();
    }
  };
  // (1.0.2) relâmpago: o caminho entorta num ponto perto do meio, e cada metade entorta de novo, cada vez menos (dá o zigue-zague
  // irregular de um raio de verdade, nunca uma linha reta); galhos saem pelo caminho, menores e mais fracos, sempre para fora da foto
  const semente = (n) => () => { n = (n + 0x6d2b79f5) | 0; let x = Math.imul(n ^ (n >>> 15), 1 | n); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const entorta = (a, b, rnd, desvio, voltas) => {
    let pts = [a, b];
    for (let n = 0; n < voltas; n++, desvio *= 0.55) {
      const nv = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, d = (rnd() - 0.5) * 2 * desvio, m = 0.3 + rnd() * 0.4;
        nv.push([p[0] + dx * m - (dy / L) * d, p[1] + dy * m + (dx / L) * d], q);
      }
      pts = nv;
    }
    return pts;
  };
  const novoRaio = (o, R, v, fino, k) => {
    const rnd = semente((aleat() * 4294967296) | 0), a = rnd() * Math.PI * 2, voltas = fino ? 5 : 4, ramos = [];
    const pol = (an, r) => [o + Math.cos(an) * r, o + Math.sin(an) * r];
    let pts;
    if (rnd() < 0.3 + 0.45 * v) { // salta para fora
      const L = R * (0.18 + (0.2 + 0.6 * rnd()) * (0.35 + 0.65 * v));
      pts = entorta(pol(a, R * 1.04), pol(a + (rnd() - 0.5) * 0.6, Math.min(R * 1.9, R * 1.05 + L)), rnd, L * 0.28, voltas);
    } else { // corre rente ao anel: o ângulo anda e só a distância entorta (para fora, nunca para dentro da foto)
      const ab = (0.25 + rnd() * 0.55) * (0.6 + 0.7 * v) * (rnd() < 0.5 ? -1 : 1), n = 1 << voltas, off = new Array(n + 1).fill(0);
      for (let pa = n, d = R * (0.05 + 0.08 * v); pa > 1; pa >>= 1, d *= 0.58) for (let i = pa / 2; i < n; i += pa) off[i] = (off[i - pa / 2] + off[i + pa / 2]) / 2 + (rnd() - 0.5) * 2 * d;
      pts = off.map((x, i) => { const u = i / n; return pol(a + ab * u, Math.max(R * 1.01, R * 1.06 + Math.sin(u * Math.PI) * R * 0.05 * (1 + v) + x)); });
    }
    ramos.push({ pts, n: 0, ini: 0 });
    const galhos = (pai, nivel) => {
      const qts = nivel ? (rnd() < 0.4 ? 1 : 0) : Math.floor(rnd() * (1.5 + 2.5 * v)), len = pai.pts.length;
      for (let gq = 0; gq < qts; gq++) {
        const i = 1 + Math.floor(rnd() * len * 0.7), p = pai.pts[i], q = pai.pts[Math.min(len - 1, i + 2)]; if (!p || p === q) continue;
        const fora = Math.atan2(p[1] - o, p[0] - o); let an = Math.atan2(q[1] - p[1], q[0] - p[0]) + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.6);
        const df = ((an - fora + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (Math.abs(df) > 1.2) an = fora + Math.sign(df) * 1.2;
        const L = R * (0.07 + rnd() * 0.2) * (nivel ? 0.55 : 1) * (0.6 + 0.6 * v);
        const r = { pts: entorta(p, [p[0] + Math.cos(an) * L, p[1] + Math.sin(an) * L], rnd, L * 0.3, Math.max(2, voltas - 2 - nivel)), n: nivel + 1, ini: pai.ini + (1 - pai.ini) * (i / (len - 1)) };
        ramos.push(r); if (nivel < 1) galhos(r, nivel + 1);
      }
    };
    galhos(ramos[0], 0);
    return { ramos, vida: 0, cresce: 0.02 + 0.04 * rnd(), max: 0.16 + 0.3 * rnd() + 0.1 * v, volta: rnd() < 0.45 ? 0.3 + 0.35 * rnd() : 9, sem: rnd() * 1000,
      gr: 0.6 + 0.6 * rnd(), forca: 0.7 + 0.3 * Math.max(v, rnd()), col: mix(k.a1, k.a2, rnd()) };
  };
  const DESENHO = {
    // Onda: três ondas de luz líquida em volta da foto; o volume estica e deforma as ondas (calado, quase um anel liso)
    onda(c, o, R, s, dt, k, fino) {
      const v = s.v, t = s.t, N = 96; c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
      [[k.a1, 0, 1, 1], [k.a2, 2.4, -1, 0.85], [mix(k.a1, BR, 0.55), 4.1, 1.5, 0.6]].forEach(([col, fa, dir, esc], j) => {
        const amp = R * (0.04 + 0.24 * v) * esc, pts = [];
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          const f = 0.55 + 0.45 * (Math.sin(a * 3 + t * 2.6 * dir + fa) * 0.5 + Math.sin(a * 2 - t * 1.7 * dir + fa * 1.7) * 0.3 + Math.sin(a * 5 + t * 3.9 + fa) * 0.2) + v * 0.18 * Math.sin(a * 7 - t * 8 * dir + fa);
          const r = R * 1.02 + amp * Math.max(0, f);
          pts.push([o + Math.cos(a) * r, o + Math.sin(a) * r]);
        }
        const g = c.createRadialGradient(o, o, R * 0.95, o, o, R * 1.08 + amp * 1.4); g.addColorStop(0, css(col, 0.55)); g.addColorStop(1, css(col, 0));
        linha(c, pts); c.closePath(); c.fillStyle = g; c.fill();
        c.lineWidth = Math.max(1.2, R * 0.05); c.strokeStyle = css(mix(col, BR, 0.25), 0.95);
        if (fino) { c.shadowBlur = R * 0.3; c.shadowColor = css(col, 0.9); }
        c.stroke(); c.shadowBlur = 0;
        if (!j) { const h2 = c.createLinearGradient(0, o - R * 1.5, 0, o); h2.addColorStop(0, 'rgba(255,255,255,.85)'); h2.addColorStop(1, 'rgba(255,255,255,0)'); c.lineWidth = Math.max(0.8, R * 0.018); c.strokeStyle = h2; c.stroke(); }
      });
    },
    // Aurora: véus de luz em volta da foto; com a voz eles ondulam, crescem e soltam cortinas de luz para fora
    aurora(c, o, R, s, dt, k, fino) {
      const v = s.v, t = s.t, N = 72; c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
      if (fino) c.filter = `blur(${(R * 0.05).toFixed(1)}px)`;
      [k.a1, k.a2, mix(k.a1, k.a2, 0.5), mix(k.a2, BR, 0.35)].forEach((col, i) => {
        const giro = t * (0.3 + 0.12 * i) * (i % 2 ? -1 : 1) + i * 1.7, al = 0.3 + 0.6 * v;
        const g = c.createConicGradient(giro, o, o);
        [[0, 0], [0.16, al], [0.34, al * 0.15], [0.58, al * 0.9], [0.8, al * 0.2], [1, 0]].forEach(([p, a]) => g.addColorStop(p, css(col, a)));
        const raio = (a) => R * (1.1 + 0.07 * i) + R * (0.03 + 0.2 * v) * ruido(a * 2 + t * (1.1 + 0.3 * i) + i * 2);
        const pts = []; for (let n = 0; n <= N; n++) { const a = (n / N) * Math.PI * 2, r = raio(a); pts.push([o + Math.cos(a) * r, o + Math.sin(a) * r]); }
        linha(c, pts); c.closePath(); c.strokeStyle = g; c.lineWidth = R * (0.1 + 0.2 * v); c.stroke();
        if (v > 0.04) { // as cortinas: raios de luz saindo da fita, mais longos com a voz
          c.beginPath();
          for (let n = 0; n < 26; n++) { const a = (n / 26) * Math.PI * 2 + giro * 0.2 + i * 0.4, r = raio(a), l = R * (0.04 + 0.34 * v) * (0.3 + 0.7 * (0.5 + 0.5 * ruido(a * 4 + t * 2.2 + i))); c.moveTo(o + Math.cos(a) * r, o + Math.sin(a) * r); c.lineTo(o + Math.cos(a) * (r + l), o + Math.sin(a) * (r + l)); }
          c.globalAlpha = 0.4; c.lineWidth = R * 0.11; c.stroke(); c.globalAlpha = 1;
        }
      });
      c.filter = 'none';
    },
    // Chama: calado é uma brasa fraca em volta da foto; falando, pega fogo: as labaredas crescem (mais para cima) e soltam faíscas
    chama(c, o, R, s, dt, k, fino) {
      const v = s.v, t = s.t, f = 0.08 + 0.92 * v, N = 110, brasa = 1 - Math.min(1, v * 3);
      c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
      { // a brasa: um brilho baixo e quente colado na foto, que pulsa devagar (sempre aceso; com a voz o fogo cresce por cima)
        const g = c.createRadialGradient(o, o, R * 0.98, o, o, R * (1.3 + 0.2 * f)), b = 0.45 + 0.2 * Math.sin(t * 2.1) + 0.1 * Math.sin(t * 5.3);
        g.addColorStop(0, css(mix(k.a2, BR, 0.2), b)); g.addColorStop(0.35, css(k.a1, b * 0.7)); g.addColorStop(1, css(mix(k.a1, PR, 0.5), 0)); c.fillStyle = g; c.beginPath(); c.arc(o, o, R * 1.5, 0, 7); c.fill();
      }
      const fora = mix(k.a1, PR, 0.35 * brasa), meio = mix(mix(k.a1, k.a2, 0.65), PR, 0.25 * brasa), dentro = mix(k.a2, BR, 0.55);
      [[fora, 1, 0.85], [meio, 0.66, 0.9], [dentro, 0.38, 0.95]].forEach(([col, esc, al], j) => {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2, cima = Math.max(0, -Math.sin(a));
          let l = 0.5 + 0.5 * Math.sin(a * 9 + t * (5 + j) + ruido(a * 3 - t * 4 + j) * 2.2); l = l * l * (0.55 + 0.45 * (0.5 + 0.5 * ruido(a * 5 + t * 7.3 + j * 2)));
          const hh = R * esc * (0.14 + 0.85 * f * (0.3 + 0.7 * l) * (0.6 + 0.8 * cima)) * (0.85 + 0.15 * Math.sin(t * 11 + a * 4 + j));
          const r = R * 0.97 + hh * 0.75;
          const x = Math.cos(a) * r, y = Math.sin(a) * r - hh * 0.45 * (0.3 + cima), d = Math.hypot(x, y) || 1, e = 0.9 * R * Math.tanh((d - R) / (0.9 * R)); // a ponta das labaredas encolhe suave antes da borda do desenho (não sai cortada reta)
          pts.push([o + (x / d) * (R + e), o + (y / d) * (R + e)]);
        }
        const g = c.createRadialGradient(o, o - R * 0.15, R * 0.9, o, o - R * 0.25, R * (1.15 + 1.1 * f * esc));
        const brilho = al * (0.45 + 0.55 * f) * (brasa > 0.5 ? 0.75 + 0.25 * Math.sin(t * 3 + j) : 1);
        g.addColorStop(0, css(col, brilho)); g.addColorStop(0.55, css(col, brilho * 0.8)); g.addColorStop(1, css(col, 0));
        linha(c, pts); c.closePath(); c.fillStyle = g;
        if (fino && !j) { c.shadowBlur = R * (0.15 + 0.35 * f); c.shadowColor = css(k.a1, 0.8); }
        c.fill(); c.shadowBlur = 0;
      });
      // faíscas: poucas na brasa, muitas com a voz alta
      s.carga = (s.carga || 0) + dt * (2 + 45 * Math.pow(v, 1.5));
      while (s.carga >= 1) { s.carga -= 1; if (s.p.length >= 60) continue; const a = -Math.PI / 2 + (aleat() - 0.5) * Math.PI * 1.5; s.p.push({ x: o + Math.cos(a) * R * (1.05 + 0.3 * f * aleat()), y: o + Math.sin(a) * R * (1.05 + 0.3 * f * aleat()), vx: Math.cos(a) * R * 0.3, vy: -R * (0.5 + 2.4 * v) * (0.6 + 0.6 * aleat()), vida: 0, max: 0.4 + 0.7 * aleat() * (0.4 + v), tam: R * (0.025 + 0.035 * aleat()), fase: aleat() * 6 }); }
      for (let i = s.p.length - 1; i >= 0; i--) {
        const p = s.p[i]; p.vida += dt; if (p.vida >= p.max) { s.p.splice(i, 1); continue; }
        p.x += (p.vx + Math.sin(p.vida * 9 + p.fase) * R * 0.5) * dt; p.y += p.vy * dt; const q = p.vida / p.max;
        c.fillStyle = css(mix(mix(k.a2, BR, 0.6), k.a1, q), 1 - q); c.beginPath(); c.arc(p.x, p.y, p.tam * (1 - q * 0.5), 0, 7); c.fill();
      }
    },
    // Elétrico: relâmpagos de verdade, cada um com forma própria (zigue-zague irregular e galhos). Uns correm rente ao anel, outros
    // saltam para fora; nascem um a um, crescem da raiz para a ponta, apagam tremendo e às vezes reacendem. Mais alto = mais e mais longe
    eletrico(c, o, R, s, dt, k, fino) {
      const v = s.v, t = s.t; c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
      const zum = (0.3 + 0.45 * v) * (0.8 + 0.2 * Math.sin(t * 47) * Math.sin(t * 13)); // o fio do anel zumbe baixinho
      if (fino) { c.shadowBlur = R * 0.15; c.shadowColor = css(k.a1, zum); }
      c.strokeStyle = css(mix(k.a1, BR, 0.3), zum); c.lineWidth = Math.max(0.8, R * 0.03); c.beginPath(); c.arc(o, o, R * 1.05, 0, 7); c.stroke(); c.shadowBlur = 0;
      s.carga = (s.carga || 0) + dt * (1.6 + 18 * Math.pow(v, 1.3));
      while (s.carga >= 1) { s.carga -= 1; if (s.p.length < 3 + 9 * v) s.p.push(novoRaio(o, R, v, fino, k)); }
      for (let i = s.p.length - 1; i >= 0; i--) {
        const p = s.p[i]; p.vida += dt; if (p.vida >= p.max) { s.p.splice(i, 1); continue; }
        const g = Math.min(1, p.vida / p.cresce), q = Math.max(0, (p.vida - p.cresce) / (p.max - p.cresce));
        let al = g < 1 ? 1 : Math.pow(1 - q, 1.5);
        if (q > p.volta && q < p.volta + 0.15) al = Math.max(al, 0.9 * (1 - (q - p.volta) / 0.15)); // reacende uma vez
        al *= p.forca * (0.65 + 0.35 * sorteia(p.sem + Math.floor(p.vida * 50)));
        const [ox, oy] = p.ramos[0].pts[0], gl = c.createRadialGradient(ox, oy, 0, ox, oy, R * 0.2 * p.gr); // clarão onde o raio sai do anel
        gl.addColorStop(0, css(mix(p.col, BR, 0.5), al * 0.6)); gl.addColorStop(1, css(p.col, 0)); c.fillStyle = gl; c.beginPath(); c.arc(ox, oy, R * 0.2 * p.gr, 0, 7); c.fill();
        for (const r of p.ramos) {
          const f = Math.min(1, (g - r.ini) / (1 - r.ini)); if (!(f > 0)) continue;
          const pts = f < 1 ? r.pts.slice(0, Math.max(2, Math.ceil(f * r.pts.length))) : r.pts, a = al * Math.pow(0.62, r.n), w = p.gr * Math.pow(0.6, r.n);
          linha(c, pts);
          if (fino && r.n < 2) { c.shadowBlur = R * (r.n ? 0.12 : 0.22); c.shadowColor = css(p.col, a); }
          c.strokeStyle = css(p.col, a * 0.45); c.lineWidth = R * 0.1 * w; c.stroke(); c.shadowBlur = 0;
          c.strokeStyle = css(mix(p.col, BR, 0.55), a); c.lineWidth = R * 0.04 * w; c.stroke();
          c.strokeStyle = css(BR, a * 0.95); c.lineWidth = Math.max(0.6, R * 0.015 * w); c.stroke();
        }
      }
    },
    // Arco-íris: um anel de vidro com as cores escolhidas (2 a 8; padrão, o espectro). Baixo mostra poucas cores; alto, todas, girando mais rápido
    arco(c, o, R, s, dt, k, fino) {
      const v = s.v, L = k.lista, n = L.length; s.giro = (s.giro || 0) + dt * (0.5 + 6 * v);
      const vis = Math.min(n, 1.5 + (n - 1.5) * Math.min(1, v * 1.2)), pesos = L.map((_, i) => Math.max(0, Math.min(1, vis - i))), tot = pesos.reduce((a, b) => a + b, 0);
      const g = c.createConicGradient(s.giro, o, o); let ac = 0, ult = L[0];
      pesos.forEach((p, i) => { if (!p) return; const l = p / tot; g.addColorStop(ac + l * 0.2, css(L[i])); g.addColorStop(ac + l * 0.8, css(L[i])); ac += l; ult = L[i]; });
      const ponta = css(mix(ult, L[0], 0.5)); g.addColorStop(0, ponta); g.addColorStop(1, ponta);
      if (fino) { c.filter = `blur(${(R * 0.1).toFixed(1)}px)`; c.globalAlpha = 0.45 + 0.5 * v; c.strokeStyle = g; c.lineWidth = R * (0.12 + 0.22 * v); c.beginPath(); c.arc(o, o, R * (1.2 + 0.06 * v), 0, 7); c.stroke(); c.filter = 'none'; c.globalAlpha = 1; }
      c.strokeStyle = g; c.lineWidth = R * 0.11; c.beginPath(); c.arc(o, o, R * 1.15, 0, 7); c.stroke(); // o tubo fica debaixo do reflexo de vidro (1,1 a 1,2 do raio)
      c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = Math.max(0.6, R * 0.012); c.beginPath(); c.arc(o, o, R * 1.1, 0, 7); c.stroke();
    },
    // Sonar: nada gira; cada sílaba solta um "ping" que se espalha em volta (mais forte e mais longe quanto mais alto) e acende pontinhos no caminho
    sonar(c, o, R, s, dt, k, fino) {
      const v = s.v, sobe = v - (s.vAnt ?? v); s.vAnt = v; s.carga = (s.carga || 0) + dt * (0.35 + 2.6 * v);
      if ((s.carga >= 1 || (sobe > 0.03 && s.carga > 0.3)) && s.p.length < 8) { s.carga = 0; s.p.push({ vida: 0, f: 0.35 + 0.65 * v, pontos: [0, 1, 2].map(() => ({ a: aleat() * Math.PI * 2, d: R * (1.2 + 0.5 * aleat()) })) }); }
      const g = c.createRadialGradient(o, o, R, o, o, R * (1.2 + 0.25 * v)); g.addColorStop(0, css(k.a1, 0.2 + 0.5 * v)); g.addColorStop(1, css(k.a1, 0));
      c.fillStyle = g; c.beginPath(); c.arc(o, o, R * 1.5, 0, 7); c.fill();
      c.globalCompositeOperation = 'lighter';
      for (let i = s.p.length - 1; i >= 0; i--) {
        const p = s.p[i]; p.vida += dt; const dur = 1 + 0.6 * p.f, q = p.vida / dur; if (q >= 1) { s.p.splice(i, 1); continue; }
        const r = R * 1.04 + R * (0.3 + 0.6 * p.f) * (1 - Math.pow(1 - q, 2.4)), al = Math.pow(1 - q, 1.3) * (0.45 + 0.55 * p.f);
        if (fino) { c.shadowBlur = R * 0.25; c.shadowColor = css(k.a1, al); }
        c.strokeStyle = css(mix(k.a1, BR, 0.35), al); c.lineWidth = Math.max(1, R * (0.09 * (1 - q) + 0.02)); c.beginPath(); c.arc(o, o, r, 0, 7); c.stroke(); c.shadowBlur = 0;
        c.strokeStyle = css(k.a2, al * 0.45); c.lineWidth = Math.max(0.6, R * 0.025); c.beginPath(); c.arc(o, o, r * 0.92, 0, 7); c.stroke();
        for (const b of p.pontos) { const a2 = Math.max(0, 1 - Math.abs(r - b.d) / (R * 0.22)) * al * 1.6; if (a2 < 0.02) continue; c.fillStyle = css(mix(k.a2, BR, 0.4), a2); c.beginPath(); c.arc(o + Math.cos(b.a) * b.d, o + Math.sin(b.a) * b.d, R * 0.06, 0, 7); c.fill(); }
      }
    },
    coracoes(c, o, R, s, dt, k) { particulas(c, o, R, s, dt, k, false, (cx, p, col) => vidro(cx, CORACAO, col)); },
    notas(c, o, R, s, dt, k) { particulas(c, o, R, s, dt, k, true, (cx, p, col) => vidro(cx, NOTAS[p.tipo], col)); },
  };
  function passo(av, agora, s, dt) {
    const fx = av.querySelector(':scope > .px-fx'); if (!fx) return;
    let alvo = 0;
    if (s.fixo != null) alvo = s.fixo;
    else if (av.classList.contains('an-on')) { const e = av._cod && VOZ.get(av._cod); alvo = e && agora - e.em < 700 ? e.v : vozFalsa(s.t, s.s); }
    s.v += (alvo - s.v) * (1 - Math.pow(alvo > s.v ? 0.002 : 0.1, dt)); s.t += dt; // sobe rápido, desce devagar
    if (Math.abs(s.v - (s.vCss ?? -1)) > 0.01) { fx.style.setProperty('--v', s.v.toFixed(3)); s.vCss = s.v; }
    if (++s.quadro % 6 === 0) { // as animações em CSS aceleram com a voz (sem pular: a velocidade muda onde a animação está)
      const r = +(0.55 + 1.3 * s.v).toFixed(2);
      if (Math.abs(r - s.rate) > 0.04) { s.rate = r; for (const a of fx.getAnimations({ subtree: true })) if (a.effect && a.effect.target !== fx) a.updatePlaybackRate(r); }
    }
    const cv = fx.querySelector(':scope > canvas'), desenho = DESENHO[av.dataset.an]; if (!cv || !desenho) return;
    if (!s.cores || s.quadro % 30 === 1) lerCores(av, s);
    if (!s.w || s.quadro % 30 === 1) { const w = cv.clientWidth; if (!w) return; const px = Math.min(leve() ? 320 : 640, Math.round(w * Math.min(1.5, devicePixelRatio || 1))); /* (a foto grande do palco pede mais pontos) */ if (cv.width !== px) cv.width = cv.height = px; s.w = w; s.k = px / w; }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none'; c.shadowBlur = 0;
    c.clearRect(0, 0, cv.width, cv.height); c.setTransform(s.k, 0, 0, s.k, 0, 0);
    // nada é pintado dentro da foto (sem foto, a inicial e o fundo do avatar ficam à vista; o que nasce no anel sai de trás dela)
    c.save(); c.beginPath(); c.rect(0, 0, s.w, s.w); c.arc(s.w / 2, s.w / 2, s.w / 4 * 0.985, 0, Math.PI * 2, true); c.clip('evenodd');
    desenho(c, s.w / 2, s.w / 4, s, dt, s.cores, !leve()); c.restore();
  }
  function rodar(agora) {
    laco = 0;
    for (const av of vivos) {
      const s = estado(av);
      if (!av.isConnected || !(av.classList.contains('an-on') || av.classList.contains('an-sai')) || (s.amostra && !s.tocando)) { vivos.delete(av); s.ult = 0; if (s.amostra && av.isConnected) parado(av); continue; }
      // (1.0.2) com o Aero na frente, o anel anda no ritmo do monitor (liso, 120 Hz ou mais); na versão otimizada, 20 por segundo; com o
      // Aero atrás de outra janela (no jogo), 12 por segundo, para deixar a placa livre para o jogo
      const minimo = !A.naFrente() ? 80 : leve() ? 48 : 0;
      if (minimo && s.ult && agora - s.ult < minimo) continue;
      const dt = s.ult ? Math.min(0.1, (agora - s.ult) / 1000) : 1 / 60; s.ult = agora;
      passo(av, agora, s, dt);
    }
    if (vivos.size) laco = requestAnimationFrame(rodar);
  }
  function ligar(av) { if (!av || !av.dataset.an) return; if (calmo()) { parado(av); return; } vivos.add(av); if (!laco) laco = requestAnimationFrame(rodar); }
  // um quadro parado e bonito (a prévia em repouso e quem pediu para reduzir movimento): simula um pouco de fala e desenha
  function parado(av, tentativa = 0) {
    const s = estado(av); if (!av.isConnected) { if (tentativa < 40) requestAnimationFrame(() => parado(av, tentativa + 1)); return; }
    s.p = []; s.fixo = 0.65; s.v = 0.65; s.t = 3.3; s.carga = 0;
    for (let i = 0; i < 24; i++) passo(av, performance.now(), s, 1 / 16);
    s.fixo = null;
  }
  // a amostra na grade do editor: a sua foto pequena num círculo de chamada, com o anel parado; com o mouse ou o teclado em cima ele "fala"
  X.amostraAnel = (id, cores, an) => {
    const eu = A.api && A.api.eu, av = eu && A.ui && A.ui.avatar ? A.ui.avatar(eu, 28) : h('span', { class: 'avatar', estilo: { '--ah': '205' } });
    const caixa = h('span', { class: 'px-anel-am' }, av);
    X.coresAnel(caixa, id, cores);
    X.anelFx(av, id, an); av.classList.add('an-on');
    const s = estado(av); s.amostra = true;
    const tocar = (on) => { s.tocando = on; if (on) ligar(av); };
    setTimeout(() => { const op = caixa.closest('.px-op') || caixa; op.addEventListener('pointerenter', () => tocar(true)); op.addEventListener('pointerleave', () => tocar(false)); op.addEventListener('focusin', () => tocar(true)); op.addEventListener('focusout', () => tocar(false)); }, 0);
    parado(av);
    return h('span', { class: 'px-op-amostra' }, caixa);
  };
  // o som de quem entrou: o dela (se ela tem e você não desligou) ou o de sempre
  X.somEntrou = (cod) => { const e = X.extrasDe(cod); const s = A.cfg.v.somEntrarOutros !== false && e.se ? 'entrar-' + e.se : ''; return s && A.som.tem(s) ? s : 'cham-entrou'; };
  // ===== (1.0.0) no app: ícone da janela e da bandeja, pacotes de sons e ícone de pasta =====
  // (1.0.0) ícones do Aero: cada um é um desenho próprio (não é o mesmo logo com outra cor), feito em SVG aqui e convertido em PNG para a
  // janela e a bandeja. SVG em data: não "suja" o canvas (o PNG da pasta do app, aberto como file://, sujava e a troca não acontecia)
  X.ICONES = [['balao', 'Balão de conversa', 'Chat bubble', 1], ['ao-vivo', 'Ao vivo', 'Live', 1], ['ceu', 'Céu', 'Sky', 2], ['pixel', 'Pixel', 'Pixel', 2],
    ['aquario', 'Aquário', 'Aquarium', 3], ['neon', 'Neon', 'Neon', 3], ['entardecer', 'Entardecer', 'Sunset', 3], ['aurora', 'Aurora', 'Aurora', 4]];
  const LETRA = (cx, cy, s, cor, larg) => `<path d="M${cx - 112 * s} ${cy + 176 * s} L${cx} ${cy - 176 * s} L${cx + 112 * s} ${cy + 176 * s}" fill="none" stroke="${cor}" stroke-width="${larg || 70 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const BRILHO = (cx, cy, rx, ry, op = 0.8) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#rf)" opacity="${op}" transform="rotate(-24 ${cx} ${cy})"/>`;
  const DEFS = `<linearGradient id="rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
    <filter id="sb" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#04182f" flood-opacity=".45"/></filter>
    <filter id="sp" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#04182f" flood-opacity=".4"/></filter>`;
  const DESENHOS = {
    // o Aero Talk: um balão de conversa de vidro verde-água com o A dentro
    balao: () => `<defs>${DEFS}<linearGradient id="g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#d8fff0"/><stop offset=".35" stop-color="#5fe3bf"/><stop offset="1" stop-color="#0b7f8f"/></linearGradient>
      <clipPath id="c"><path id="b" d="M332 170H692A200 200 0 0 1 892 370V560A200 200 0 0 1 692 760H500L318 900L346 760H332A200 200 0 0 1 132 560V370A200 200 0 0 1 332 170Z"/></clipPath></defs>
      <g filter="url(#sb)"><use href="#b" fill="url(#g)"/></g><g clip-path="url(#c)">${BRILHO(400, 290, 250, 120, 0.85)}</g>
      <use href="#b" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="10"/>
      <g filter="url(#sp)">${LETRA(512, 470, 0.86, '#fff')}</g>
      <g filter="url(#sp)"><circle cx="846" cy="160" r="54" fill="url(#g)"/><ellipse cx="830" cy="142" rx="24" ry="14" fill="#fff" opacity=".85" transform="rotate(-30 830 142)"/></g>`,
    // a transmissão: uma tela de vidro escuro com a bolha do Aero e o ponto vermelho de "ao vivo"
    'ao-vivo': () => `<defs>${DEFS}<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4f8f"/><stop offset="1" stop-color="#0a1630"/></linearGradient>
      <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#9fb6cc"/></linearGradient>
      <radialGradient id="e" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#e9fdff"/><stop offset=".3" stop-color="#8ff0ee"/><stop offset=".65" stop-color="#1fb8d8"/><stop offset="1" stop-color="#0a5aa8"/></radialGradient>
      <radialGradient id="v" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff8a95"/><stop offset=".55" stop-color="#ff3b4f"/><stop offset="1" stop-color="#ff3b4f" stop-opacity="0"/></radialGradient>
      <clipPath id="c"><rect x="132" y="180" width="760" height="500" rx="70"/></clipPath></defs>
      <g filter="url(#sb)"><path d="M440 690H584L606 800H418Z" fill="url(#m)"/><rect x="330" y="790" width="364" height="44" rx="22" fill="url(#m)"/>
      <rect x="132" y="180" width="760" height="500" rx="70" fill="url(#t)" stroke="url(#m)" stroke-width="26"/></g>
      <g clip-path="url(#c)">${BRILHO(330, 230, 330, 90, 0.35)}</g>
      <g filter="url(#sp)"><circle cx="512" cy="440" r="170" fill="url(#e)"/></g>${BRILHO(462, 350, 110, 62, 0.8)}
      ${LETRA(512, 450, 0.55, '#fff')}<circle cx="800" cy="262" r="58" fill="url(#v)"/><circle cx="800" cy="262" r="26" fill="#ff3b4f"/>`,
    // o céu de vidro: o fundo de céu com nuvem e a bolha flutuando (o "Frutiger Aero" de verdade)
    ceu: () => `<defs>${DEFS}<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9be8"/><stop offset=".6" stop-color="#8fd6ff"/><stop offset="1" stop-color="#e9fbff"/></linearGradient>
      <radialGradient id="e" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9f4ff" stop-opacity=".9"/><stop offset="1" stop-color="#5bc2f0" stop-opacity=".75"/></radialGradient>
      <linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6ecfb"/></linearGradient>
      <clipPath id="c"><rect x="96" y="96" width="832" height="832" rx="200"/></clipPath></defs>
      <g filter="url(#sb)"><rect x="96" y="96" width="832" height="832" rx="200" fill="url(#s)"/></g>
      <g clip-path="url(#c)"><path d="M60 930C60 820 150 760 250 790C280 690 420 660 490 740C560 660 720 690 740 800C840 770 960 830 960 930Z" fill="url(#n)"/>${BRILHO(360, 200, 300, 80, 0.45)}</g>
      <rect x="96" y="96" width="832" height="832" rx="200" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="10"/>
      <g filter="url(#sp)"><circle cx="512" cy="460" r="230" fill="url(#e)"/></g>${BRILHO(450, 350, 140, 78, 0.9)}
      <circle cx="512" cy="460" r="228" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="7"/>${LETRA(512, 470, 0.72, '#1777c4')}
      <circle cx="792" cy="250" r="34" fill="url(#e)" stroke="#fff" stroke-width="4"/><circle cx="250" cy="300" r="22" fill="url(#e)" stroke="#fff" stroke-width="3"/>`,
    // o videogame: a bolha e o A feitos de quadradinhos (8 bits)
    pixel: () => {
      const P = 32, out = [], CORES = ['#0b3f86', '#1679c9', '#2fb7e6', '#8ff0ee', '#e9fdff'];
      const dLinha = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - vx * t, py - ay - vy * t); };
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const cx = x + 0.5, cy = y + 0.5, d = Math.hypot(cx - 16, cy - 16.5); let cor = '';
        if (d <= 11.2) {
          const l = Math.hypot(cx - 11, cy - 10) / 17; cor = CORES[Math.max(0, Math.min(3, 3 - Math.floor(l * 4.2)))];
          if (d > 10.2) cor = '#06275a';
          if (Math.hypot(cx - 10.5, cy - 10.5) < 1.6 || (Math.abs(cx - 13.5) < 0.6 && Math.abs(cy - 8.5) < 0.6)) cor = CORES[4];
          if (Math.min(dLinha(cx, cy, 11.5, 22, 16, 10), dLinha(cx, cy, 20.5, 22, 16, 10)) < 1.05) cor = '#ffffff';
        } else if (Math.hypot(cx - 26.5, cy - 5.5) < 2.6) cor = Math.hypot(cx - 26, cy - 5) < 1 ? CORES[4] : CORES[2];
        else if (Math.hypot(cx - 29, cy - 10) < 1.4) cor = CORES[2];
        if (cor) out.push(`<rect x="${x * P}" y="${y * P}" width="${P}" height="${P}" fill="${cor}"/>`);
      }
      return `<defs>${DEFS}</defs><g filter="url(#sp)" shape-rendering="crispEdges">${out.join('')}</g>`;
    },
    // o aquário: metade da bolha com água, ondinha, bolhas subindo e um peixinho
    aquario: () => `<defs>${DEFS}<radialGradient id="e" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#f4feff"/><stop offset=".6" stop-color="#bfeaf6"/><stop offset="1" stop-color="#7fc9e4"/></radialGradient>
      <linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fc4e8"/><stop offset="1" stop-color="#063e8a"/></linearGradient>
      <clipPath id="c"><circle cx="512" cy="520" r="320"/></clipPath></defs>
      <g filter="url(#sb)"><circle cx="512" cy="520" r="320" fill="url(#e)"/></g>
      <g clip-path="url(#c)"><path d="M150 520C230 470 310 470 390 520S550 570 630 520S790 470 880 520V860H150Z" fill="url(#a)"/>
      <path d="M150 520C230 470 310 470 390 520S550 570 630 520S790 470 880 520" fill="none" stroke="#e9fdff" stroke-width="12" stroke-opacity=".8"/>
      <path d="M640 690C680 650 740 650 770 690C740 730 680 730 640 690Z" fill="#ff9a3c"/><path d="M640 690L600 660V720Z" fill="#ff7a1f"/><circle cx="740" cy="684" r="7" fill="#3a1500"/>
      <circle cx="300" cy="700" r="16" fill="none" stroke="#e9fdff" stroke-width="6" opacity=".8"/><circle cx="330" cy="630" r="10" fill="none" stroke="#e9fdff" stroke-width="5" opacity=".8"/><circle cx="310" cy="580" r="7" fill="#e9fdff" opacity=".8"/>
      ${BRILHO(410, 330, 190, 100, 0.85)}</g><circle cx="512" cy="520" r="318" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="8"/>
      <g filter="url(#sp)">${LETRA(512, 470, 0.78, '#fff')}</g>`,
    // o neon: uma placa escura com a bolha, o anel e o A em tubos de luz
    neon: () => `<defs>${DEFS}<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1145"/><stop offset="1" stop-color="#07051a"/></linearGradient>
      <filter id="luz" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#sb)"><rect x="96" y="96" width="832" height="832" rx="200" fill="url(#f)"/></g>
      <rect x="96" y="96" width="832" height="832" rx="200" fill="none" stroke="#6b4cff" stroke-opacity=".5" stroke-width="8"/>
      <g filter="url(#luz)"><circle cx="512" cy="520" r="250" fill="none" stroke="#3ff2ff" stroke-width="26"/>
      <g transform="rotate(-16 512 520)"><path d="M140 520A372 92 0 0 0 884 520" fill="none" stroke="#b26cff" stroke-width="22" stroke-linecap="round"/></g>
      ${LETRA(512, 500, 0.72, '#ff4fd8', 40)}</g>
      <circle cx="780" cy="250" r="30" fill="none" stroke="#3ff2ff" stroke-width="12" filter="url(#luz)"/>`,
    // o entardecer: o pôr do sol no mar visto dentro da bolha, com o A em silhueta
    entardecer: () => `<defs>${DEFS}<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a9a"/><stop offset=".45" stop-color="#ff6a6a"/><stop offset=".62" stop-color="#ffc36b"/><stop offset=".63" stop-color="#2a6fb0"/><stop offset="1" stop-color="#0d2a5c"/></linearGradient>
      <radialGradient id="sol" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".6" stop-color="#ffd36b"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/></radialGradient>
      <clipPath id="c"><circle cx="512" cy="520" r="320"/></clipPath></defs>
      <g filter="url(#sb)"><circle cx="512" cy="520" r="320" fill="url(#s)"/></g>
      <g clip-path="url(#c)"><circle cx="512" cy="600" r="150" fill="url(#sol)"/><rect x="150" y="603" width="740" height="320" fill="url(#s)" opacity=".001"/>
      <rect x="180" y="604" width="664" height="320" fill="#1d4f8f"/>
      <g fill="#ffd36b" opacity=".85"><rect x="430" y="630" width="164" height="10" rx="5"/><rect x="455" y="665" width="114" height="9" rx="4.5"/><rect x="478" y="700" width="68" height="8" rx="4"/></g>
      ${BRILHO(400, 320, 200, 100, 0.55)}</g><circle cx="512" cy="520" r="318" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="8"/>
      ${LETRA(512, 470, 0.8, '#2a1240')}`,
    // a aurora: a noite estrelada dentro da bolha, com as cortinas de luz e o anel dourado
    aurora: () => `<defs>${DEFS}<radialGradient id="n" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#14306a"/><stop offset="1" stop-color="#020817"/></radialGradient>
      <linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b26cff" stop-opacity="0"/><stop offset=".35" stop-color="#b26cff" stop-opacity=".7"/><stop offset=".7" stop-color="#3dffb0" stop-opacity=".9"/><stop offset="1" stop-color="#3dffb0" stop-opacity="0"/></linearGradient>
      <linearGradient id="ou" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe7a8"/><stop offset=".5" stop-color="#fff8e0"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
      <filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
      <clipPath id="c"><circle cx="512" cy="520" r="300"/></clipPath><clipPath id="fr"><rect x="0" y="520" width="1024" height="504"/></clipPath><clipPath id="tr"><rect x="0" y="0" width="1024" height="520"/></clipPath></defs>
      <g transform="rotate(-16 512 520)"><ellipse cx="512" cy="520" rx="462" ry="112" fill="none" stroke="url(#ou)" stroke-opacity=".55" stroke-width="24" clip-path="url(#tr)"/></g>
      <g filter="url(#sb)"><circle cx="512" cy="520" r="300" fill="url(#n)"/></g>
      <g clip-path="url(#c)"><g filter="url(#bl)"><path d="M180 330C300 260 380 420 520 330S760 250 860 360L860 640C740 560 640 700 520 610S300 560 180 650Z" fill="url(#au)"/>
      <path d="M220 420C340 380 420 500 560 430S780 380 840 460L840 600C720 560 640 650 540 590S330 560 220 610Z" fill="url(#au)" opacity=".7"/></g>
      <g fill="#fff"><circle cx="330" cy="300" r="5"/><circle cx="650" cy="270" r="4"/><circle cx="740" cy="400" r="5"/><circle cx="280" cy="520" r="3.5"/><circle cx="700" cy="690" r="4"/><circle cx="420" cy="740" r="3.5"/></g>
      ${BRILHO(424, 350, 200, 120, 0.35)}</g><circle cx="512" cy="520" r="298" fill="none" stroke="#cfe8ff" stroke-opacity=".7" stroke-width="7"/>
      <g filter="url(#sp)">${LETRA(512, 525, 1, '#fff')}</g>
      <g transform="rotate(-16 512 520)" filter="url(#sp)"><ellipse cx="512" cy="520" rx="462" ry="112" fill="none" stroke="url(#ou)" stroke-width="24" stroke-linecap="round" clip-path="url(#fr)"/></g>`,
  };
  X.svgIcone = (id) => (DESENHOS[id] ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${DESENHOS[id]()}</svg>` : '');
  X.iconeAtual = '';
  X.desenharIcone = async (id, tam = 256) => {
    const svg = X.svgIcone(id); if (!svg) return '';
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const cv = document.createElement('canvas'); cv.width = cv.height = tam; cv.getContext('2d').drawImage(img, 0, 0, tam, tam);
      return cv.toDataURL('image/png');
    } catch (e) { A.log.aviso('ícone do app', e && e.message); return ''; }
  };
  X.aplicarIcone = async () => {
    const id = A.cfg.v.iconeApp || '', ic = X.ICONES.find((x) => x[0] === id), ok = ic && X.tem(ic[3]);
    X.iconeAtual = ok ? await X.desenharIcone(id) : '';
    try { if (window.aero && window.aero.iconeApp) await window.aero.iconeApp(X.iconeAtual ? { png: X.iconeAtual } : null); } catch (e) { A.log.aviso('ícone do app', e && e.message); }
    A.evt.emit('talk:naoLidas'); // o selo de não lidas é redesenhado em cima do ícone novo
  };

  // pacotes de sons da interface (Plus: Cristal; Donator e Supporter: todos). Trocam os sons do dia a dia (cliques, passar o mouse, menus, janelas, conversas); os de chamada continuam os de sempre
  X.PACOTES = [['cristal', 'Cristal', 'Crystal', 2], ['madeira', 'Madeira', 'Wood', 3], ['retro', 'Retrô', 'Retro', 3], ['espaco', 'Espaço', 'Space', 3]];
  if (A.som && A.som.registrar) {
    const { nota, blup, brilho, sopro, N } = A.som.pecas;
    const P = {
      cristal: { f: (b, t, f, d = 0.2, v = 0.08) => { nota(b, f, t, d, { vol: v, harm: 0.4, rev: 0.6 }); }, base: 1568 },
      madeira: { f: (b, t, f, d = 0.08, v = 0.12) => { nota(b, f * 0.5, t, d, { vol: v, tipo: 'triangle', ataque: 0.002 }); }, base: 1200 },
      retro: { f: (b, t, f, d = 0.06, v = 0.045) => { nota(b, f * 0.5, t, d, { vol: v, tipo: 'square', ataque: 0.001 }); }, base: 1400 },
      espaco: { f: (b, t, f, d = 0.18, v = 0.06) => { nota(b, f * 0.6, t, d, { vol: v, glide: f, rev: 0.7 }); }, base: 1100 },
    };
    for (const [id, p] of Object.entries(P)) {
      const R = (nome, fn) => A.som.registrar('px-' + id + ':' + nome, fn), b0 = p.base;
      R('click', (b, t) => p.f(b, t, b0));
      R('hover', (b, t) => p.f(b, t, b0 * 1.5, 0.05, 0.025));
      R('foco', (b, t) => p.f(b, t, b0 * 1.5, 0.05, 0.025));
      R('menu-item', (b, t) => p.f(b, t, b0 * 1.33, 0.05, 0.03));
      R('sucesso', (b, t) => [1, 1.26, 1.5].forEach((k, i) => p.f(b, t + i * 0.07, b0 * k)));
      R('erro', (b, t) => [1, 0.84].forEach((k, i) => p.f(b, t + i * 0.1, b0 * 0.6 * k, 0.15)));
      R('bolha', (b, t) => p.f(b, t, b0 * 0.9, 0.1));
      R('abrir', (b, t) => [1, 1.5].forEach((k, i) => p.f(b, t + i * 0.05, b0 * k, 0.12)));
      R('pop-abrir', (b, t) => p.f(b, t, b0 * 1.2, 0.1));
      R('msg', (b, t) => [1.5, 2].forEach((k, i) => p.f(b, t + i * 0.08, b0 * k, 0.25)));
      R('estourar', (b, t) => p.f(b, t, b0 * 0.75, 0.08));
      R('grudar', (b, t) => [1.2, 1].forEach((k, i) => p.f(b, t + i * 0.05, b0 * k, 0.08)));
      // (1.0.0) o resto do dia a dia também no estilo do pacote, cada um com o seu jeito: passar numa conversa é mais agudo que o
      // passar comum, abrir uma DM são duas notas subindo e um grupo, três; o que abre sobe e o que fecha desce
      const seq = (ks, gap, d, v) => (b, t) => ks.forEach((k, i) => p.f(b, t + i * gap, b0 * k, d, v));
      R('tk-passar', seq([2, 2.5], 0.02, 0.04, 0.02));
      R('tk-dm', seq([1, 1.26], 0.06, 0.12));
      R('tk-grupo', seq([1, 1.26, 1.5], 0.05, 0.14));
      R('menu-abrir', seq([0.8, 1.2], 0.04, 0.08));
      R('menu-fechar', seq([1.2, 0.8], 0.04, 0.08));
      R('pop-fechar', seq([0.9], 0, 0.08));
      R('fechar', seq([1.5, 1], 0.05, 0.12));
      R('mini-abrir', seq([1.33, 1.78], 0.035, 0.06));
      R('mini-fechar', seq([1.78, 1.33], 0.035, 0.06));
      R('janela-abrir', seq([0.75, 1, 1.5], 0.06, 0.16));
      R('janela-fechar', seq([1.5, 1, 0.75], 0.05, 0.12));
      R('perfil-abrir', seq([1, 1.33, 2], 0.05, 0.16));
      R('perfil-fechar', seq([2, 1.33, 1], 0.05, 0.12));
      R('pasta-abrir', seq([0.84, 1.12], 0.06, 0.12));
      R('pasta-fechar', seq([1.12, 0.84], 0.06, 0.12));
      R('bolha-cresce', seq([0.67, 1], 0.06, 0.12));
      R('bolha-estoura', seq([1.1], 0, 0.05));
      R('desgrudar', seq([1, 1.33], 0.04, 0.06));
      R('mirar', seq([1.78], 0, 0.04, 0.02));
      R('chat-envio', seq([1, 1.5], 0.04, 0.1));
      R('chat-recebido', seq([2, 1.5], 0.12, 0.25));
    }
    void blup; void brilho; void sopro; void N;
  }
  if (A.som) A.som.pacote = () => { const id = A.cfg.v.pacoteSons || '', pk = X.PACOTES.find((x) => x[0] === id); return pk && X.tem(pk[3]) ? 'px-' + id : ''; };

  // ícone de pasta: um emoji no lugar da pastinha (Standard) que se mexe (Donator)
  X.iconePasta = (p, previa) => {
    const n = X.nivel(), em = p.em && (previa || n >= 1) ? p.em : '', ani = em && p.ani && (previa || n >= 3);
    return em ? h('span', { class: 'tk-pasta-ic px-pasta-em' + (ani ? ' px-pasta-anim' : '') }, em) : h('span', { class: 'tk-pasta-ic' }, A.icone('pasta', 18));
  };
  X.editorIconePasta = (ler, mudar) => {
    const caixa = h('div', { class: 'px-pasta-ed' }), faixa = h('div', {});
    const pintar = () => {
      const v = ler();
      caixa.replaceChildren(h('div', { class: 'px-pasta-ems' }, h('button', { type: 'button', class: 'px-op' + (!v.em ? ' sel' : ''), onclick: () => { mudar({ em: '', ani: false }); pintar(); } }, A.icone('pasta', 16)),
        ...X.EMOJIS_ACESSORIO.concat(['📁', '🎓', '💼', '🏠', '🎨', '🍕']).map((e) => h('button', { type: 'button', class: 'px-op' + (v.em === e ? ' sel' : '') + (X.tem(1) ? '' : ' preso'), onclick: () => { mudar({ ...ler(), em: e }); pintar(); } }, e))),
      h('label', { class: 'linha', estilo: { gap: '8px', 'margin-top': '6px' } }, A.ui.chave(!!v.ani, (x) => { mudar({ ...ler(), ani: x }); pintar(); }), h('span', {}, T('Animar o ícone', 'Animate the icon')), X.tem(3) ? null : X.selo(3)));
      faixa.replaceChildren((v.em && !X.tem(1) ? X.faixaPrevia(1) : v.ani && !X.tem(3) ? X.faixaPrevia(3) : null) || '');
    };
    pintar();
    return h('div', {}, h('label', { class: 'rot', estilo: { 'margin-top': '12px' } }, T('Ícone', 'Icon'), ' ', X.tem(1) ? null : X.selo(1)), caixa, faixa);
  };

  // a seção nas Configurações > Aparência
  X.secaoApp = () => {
    const corpo = h('div', { class: 'col', estilo: { gap: '8px' } }), faixa = h('div', {});
    const amostras = new Map();
    const pintar = () => {
      faixa.replaceChildren();
      const escolher = (chave, lista, depois) => (id) => {
        const it = lista.find((x) => x[0] === id), n = it ? it[3] : 0;
        if (id && !X.tem(n)) { faixa.replaceChildren(X.faixaPrevia(n) || ''); return; }
        A.cfg.v[chave] = id; A.cfg.salvar(); depois(); pintar();
      };
      corpo.replaceChildren(
        h('small', { class: 'suave' }, T('Ícone do Aero (janela e bandeja)', 'Aero icon (window and tray)')),
        X.grade(X.ICONES, A.cfg.v.iconeApp || '', escolher('iconeApp', X.ICONES, X.aplicarIcone), { desenho: (id) => { const im = h('img', { class: 'px-ic-am', alt: '' }); const ja = amostras.get(id); if (ja) im.src = ja; else X.desenharIcone(id, 64).then((u) => { amostras.set(id, u); im.src = u; }); return im; } }),
        h('small', { class: 'suave' }, T('Sons do app (cliques, avisos e menus)', 'App sounds (clicks, alerts and menus)')),
        X.grade(X.PACOTES, A.cfg.v.pacoteSons || '', escolher('pacoteSons', X.PACOTES, () => {}), { desenho: () => h('span', { class: 'px-op-amostra' }, '🎛️'), ouvir: (id) => { const pk = A.som.pacote; A.som.pacote = () => 'px-' + id; try { A.som.tocar('click'); setTimeout(() => { A.som.pacote = () => 'px-' + id; A.som.tocar('sucesso'); A.som.pacote = pk; }, 220); } finally { A.som.pacote = pk; } } }),
        faixa);
    };
    pintar();
    return corpo;
  };
  // o plano chegou ou mudou: o que depende dele se ajusta sozinho
  const aplicarTudo = () => { X.aplicarIcone(); };
  A.evt.on('hub:eu', aplicarTudo); A.evt.on('bolha', aplicarTudo); A.evt.on('prefs:aplicadas', aplicarTudo); // (0.9.7) o ícone também segue a conta
  X.urlLigacao = (codigo, v) => (v ? `${A.api.servidor}/api/ligacao/${encodeURIComponent(codigo)}?v=${v}` : null);
})();
