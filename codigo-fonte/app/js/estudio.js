// Aero Stream - (0.8.7) as "Cenas" das configurações (o Estúdio de skins é outro: estudioskins.js): cada seção ganha uma cena de vidro que mostra do que ela trata, a conta vira uma
// carteirinha, e todo seletor de cor do app (input de cor) abre a "Aquarela": um anel de cores com uma gota no meio, em vez da caixinha
// do sistema. Os controles continuam os mesmos (só ganham roupa nova). Criado por Ryan Victtor.
(() => {
  const A = window.Aero, T = A.T, h = A.h;
  const E = (A.estudio = {});

  // ---------- as cenas ----------
  // cada uma é feita só de peças (i) que o CSS desenha e anima; com as animações desligadas, ficam paradas
  const pecas = (n, cls = '') => Array.from({ length: n }, (_, i) => h('i', { class: 'p' + (i + 1) + (cls ? ' ' + cls : '') }));
  const CENAS = {
    chats: () => [h('i', { class: 'bal b1' }), h('i', { class: 'bal b2' }), h('i', { class: 'bal b3' })],
    som: () => [h('i', { class: 'falante' }), ...pecas(3, 'onda')],
    teclas: () => pecas(3, 'tecla'),
    digitando: () => [h('i', { class: 'bal' }, h('b'), h('b'), h('b'))],
    globo: () => [h('i', { class: 'orbe-g' }, h('b', { class: 'm1' }), h('b', { class: 'm2' }), h('b', { class: 'eq' }))],
    atualizar: () => [h('i', { class: 'orbe-g' }, h('b', { class: 'giro' }, A.icone('atualizar', 30)))],
    controle: () => [h('i', { class: 'pad' }, A.icone('controle', 40)), ...pecas(2, 'brilho')],
    placa: () => [h('i', { class: 'chip' }, h('b')), ...pecas(4, 'pino')],
    aparelhos: () => [h('i', { class: 'monitor' }), h('i', { class: 'fone' }), ...pecas(3, 'pulso')],
    ligar: () => [h('i', { class: 'orbe-g' }, h('b', { class: 'arco' }), h('b', { class: 'haste' }))],
    bandeja: () => [h('i', { class: 'janela' }), h('i', { class: 'barra' }, h('b'))],
    privacidade: () => [h('i', { class: 'escudo' }, A.icone('cadeado', 26)), h('i', { class: 'varre' })],
    conta: () => [h('i', { class: 'cartao' }, h('b', { class: 'foto' }), h('b', { class: 'l1' }), h('b', { class: 'l2' }), h('b', { class: 'chip' }))],
    feedback: () => [h('i', { class: 'envelope' }), h('i', { class: 'coracao' }, A.icone('coracao', 16))],
  };
  // título da seção → cena e uma frase curta
  const QUAIS = [
    [['Chats'], 'chats', T('O tamanho das conversas', 'How big chats look')],
    [['Versão e som', 'Version and sound'], 'som', T('Visual e sons do app', 'App look and sounds')],
    [['Sons de digitação', 'Typing sounds'], 'teclas', T('O clique de cada tecla', 'Every key click')],
    [['Indicador de digitação', 'Typing indicator'], 'digitando', T('O que aparece quando você escreve', 'What shows while you type')],
    [['Geral', 'General'], 'globo', T('Idioma e abertura', 'Language and startup')],
    [['Atualizações', 'Updates'], 'atualizar', T('Sempre na versão nova', 'Always up to date')],
    [['Controles', 'Controllers'], 'controle', T('Testar, remapear e calibrar', 'Test, remap and calibrate')],
    [['Placa de vídeo', 'Graphics card'], 'placa', T('Quem codifica o seu vídeo', 'What encodes your video')],
    [['Aparelhos conectados', 'Connected devices'], 'aparelhos', T('Onde a sua conta está aberta', 'Where you are signed in')],
    [['Iniciar com o sistema', 'Start with the system'], 'ligar', T('Abrir junto com o computador', 'Open with your computer')],
    [['Ao fechar a janela', 'When closing the window'], 'bandeja', T('Sair ou ficar na bandeja', 'Quit or stay in the tray')],
    [['Privacidade', 'Privacy'], 'privacidade', T('Quem vê o quê', 'Who sees what')],
    [['Conta e diagnóstico', 'Account and diagnostics'], 'conta', T('E-mail, código e relatório', 'E-mail, code and report')],
    [['Feedback'], 'feedback', T('Fale direto com o criador', 'Talk to the creator')],
  ];
  E.cena = (tipo) => (CENAS[tipo] ? h('div', { class: 'cena cena-' + tipo, 'aria-hidden': 'true' }, ...CENAS[tipo]()) : null);

  // a carteirinha da conta: foto, nome, # e um holograma que brilha ao passar o mouse
  function carteirinha() {
    const eu = A.api && A.api.eu; if (!eu) return null;
    const c = h('div', { class: 'carteirinha', 'aria-hidden': 'true' },
      h('div', { class: 'cart-topo' }, h('b', {}, 'Aero'), h('span', {}, T('carteirinha', 'member card'))),
      h('div', { class: 'cart-meio' }, A.ui.avatar({ nome: eu.nome, codigo: eu.codigo, av: eu.av }, 58), h('div', { class: 'cart-tx' }, h('b', { dados: { nomeCod: eu.codigo } }, eu.nome), h('span', {}, '#' + eu.tag), h('small', {}, 'v' + A.versao))),
      h('i', { class: 'cart-chip' }), h('i', { class: 'cart-holo' }));
    c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--hx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); c.style.setProperty('--hy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); });
    return c;
  }

  // veste as seções de uma tela de configurações: troca o título por um cabeçalho com a cena
  E.vestir = (raiz) => {
    [...(raiz.matches && raiz.matches('section') ? [raiz] : []), ...raiz.querySelectorAll('section')].forEach((sec) => {
      const t = sec.querySelector(':scope > h3'); if (!t || sec.dataset.vestida) return;
      const q = QUAIS.find(([nomes]) => nomes.includes(t.textContent.trim())); if (!q) return;
      sec.dataset.vestida = q[1]; sec.classList.add('estacao', 'estacao-' + q[1]);
      t.style.margin = '0';
      sec.insertBefore(h('div', { class: 'estacao-cab' }, E.cena(q[1]), h('div', { class: 'estacao-tit' }, t, h('small', {}, q[2]))), sec.firstChild);
      if (q[1] === 'conta') { const c = carteirinha(); if (c) sec.insertBefore(c, sec.children[1] || null); }
    });
  };

  // ---------- a Aquarela: o seletor de cor ----------
  const hexDe = (hh, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };
  const hslDe = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return [205, 75, 53];
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let hh = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh = (hh * 60 + 360) % 360; }
    return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)];
  };
  const RECENTES = 'aquarelaRecentes';
  const recentes = () => { try { return (A.cfg.v[RECENTES] || []).filter((x) => /^#[0-9a-f]{6}$/i.test(x)).slice(0, 7); } catch (e) { return []; } };
  let aberta = null;
  function fechar(guardar = true) {
    if (!aberta) return;
    const { pop, inp, inicial, offs } = aberta; aberta = null;
    offs.forEach((f) => f());
    pop.classList.add('saindo'); setTimeout(() => pop.remove(), 180);
    if (guardar && inp.value !== inicial) {
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      A.cfg.v[RECENTES] = [inp.value, ...recentes().filter((x) => x !== inp.value)].slice(0, 7); A.cfg.salvar();
    }
    if (document.activeElement && pop.contains(document.activeElement)) inp.focus({ preventScroll: true });
  }
  function abrir(inp) {
    if (aberta && aberta.inp === inp) { fechar(); return; }
    fechar();
    let [hh, s, l] = hslDe(inp.value);
    const inicial = inp.value;
    const conta = h('i', { class: 'aq-conta' }), gota = h('div', { class: 'aq-gota' }), hex = h('input', { class: 'aq-hex', maxlength: 7, spellcheck: 'false', 'aria-label': T('Código da cor', 'Color code') });
    const anel = h('div', { class: 'aq-anel', role: 'slider', tabindex: '0', 'aria-label': T('Tom', 'Hue'), 'aria-valuemin': '0', 'aria-valuemax': '359' }, conta, gota);
    const faixa = (rot, min, max, v, on) => { const r = h('input', { type: 'range', min, max, value: v, class: 'aq-faixa', 'aria-label': rot }); r.addEventListener('input', () => on(+r.value)); return r; };
    const fViv = faixa(T('Vivacidade', 'Vividness'), 0, 100, s, (x) => { s = x; mudou(); });
    const fLuz = faixa(T('Luz', 'Light'), 4, 96, l, (x) => { l = x; mudou(); });
    const gotas = h('div', { class: 'aq-recentes' }, ...recentes().map((c) => { const b = h('button', { type: 'button', class: 'aq-rec', title: c, estilo: { '--c': c } }); b.addEventListener('click', () => { [hh, s, l] = hslDe(c); fViv.value = s; fLuz.value = l; mudou(c); }); return b; }));
    const meio = h('button', { type: 'button', class: 'aq-meio', title: T('Vivacidade e luz no meio', 'Vividness and light to the middle'), 'aria-label': T('Vivacidade e luz no meio', 'Vividness and light to the middle'), onclick: () => { s = 50; l = 50; fViv.value = s; fLuz.value = l; mudou(); } }, A.icone('atualizar', 15));
    const pop = h('div', { class: 'aquarela vidro', role: 'dialog', 'aria-label': T('Escolher cor', 'Pick a color') }, anel,
      h('label', { class: 'aq-lin' }, h('span', {}, T('Vivacidade', 'Vividness')), fViv), h('label', { class: 'aq-lin' }, h('span', {}, T('Luz', 'Light')), fLuz),
      h('div', { class: 'aq-pe' }, meio, hex, gotas));
    let giro = hh;
    function pintar(valor) {
      const c = valor || hexDe(hh, s, l);
      pop.style.setProperty('--aq', c); pop.style.setProperty('--aq-h', hh); pop.style.setProperty('--aq-s', s + '%'); pop.style.setProperty('--aq-l', l + '%');
      giro += ((((hh - giro) % 360) + 540) % 360) - 180; // a gota aponta para a bolinha, sempre pelo caminho mais curto
      conta.style.transform = 'rotate(' + giro + 'deg)'; pop.style.setProperty('--aq-gira', giro + 'deg'); anel.setAttribute('aria-valuenow', String(hh));
      if (document.activeElement !== hex) hex.value = c;
      return c;
    }
    // (0.8.7) escolhendo devagar, a gota do meio pingava a cada passinho (piscava muito): agora ela só pinga quando você para, e o resto
    // do app recebe a cor nova no máximo uma vez por quadro
    let tPinga = 0, rafCor = 0;
    function mudou(valor) {
      const c = pintar(valor);
      if (inp.value !== c) { inp.value = c; if (!rafCor) rafCor = requestAnimationFrame(() => { rafCor = 0; inp.dispatchEvent(new Event('input', { bubbles: true })); }); }
      clearTimeout(tPinga); tPinga = setTimeout(() => { gota.classList.remove('pinga'); void gota.offsetWidth; gota.classList.add('pinga'); }, 220);
    }
    const peloPonto = (e) => { const r = anel.getBoundingClientRect(); hh = Math.round((Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI + 360) % 360); mudou(); };
    anel.addEventListener('pointerdown', (e) => { if (e.target === gota) return; e.preventDefault(); anel.setPointerCapture(e.pointerId); peloPonto(e); const mv = (ev) => peloPonto(ev); anel.addEventListener('pointermove', mv); anel.addEventListener('pointerup', () => anel.removeEventListener('pointermove', mv), { once: true }); });
    anel.addEventListener('keydown', (e) => { const d = { ArrowRight: 6, ArrowUp: 6, ArrowLeft: -6, ArrowDown: -6 }[e.key]; if (d) { e.preventDefault(); hh = (hh + d + 360) % 360; mudou(); } });
    gota.addEventListener('click', () => fechar());
    hex.addEventListener('input', () => { const v = hex.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { const c = (v[0] === '#' ? v : '#' + v).toLowerCase(); [hh, s, l] = hslDe(c); fViv.value = s; fLuz.value = l; mudou(c); } });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } });
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    // perto do campo, sem sair da tela
    (inp.closest('.fundo-modal, .gaveta') || document.body).append(pop);
    const r = inp.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2, y = r.bottom + 10;
    if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 10);
    x = Math.max(8, Math.min(innerWidth - pw - 8, x));
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    pintar(inp.value);
    const fora = (e) => { if (!pop.contains(e.target) && e.target !== inp) fechar(); };
    const rolar = (e) => { if (!pop.contains(e.target)) fechar(); };
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
    addEventListener('scroll', rolar, true); addEventListener('resize', rolar);
    aberta = { pop, inp, inicial, offs: [() => document.removeEventListener('pointerdown', fora, true), () => removeEventListener('scroll', rolar, true), () => removeEventListener('resize', rolar)] };
    anel.focus({ preventScroll: true });
  }
  // qualquer input de cor do app abre a Aquarela (o valor e os eventos "input"/"change" são os mesmos de antes)
  document.addEventListener('click', (e) => {
    const inp = e.target && e.target.closest ? e.target.closest('input[type=color]') : null;
    if (!inp || inp.disabled) return;
    e.preventDefault(); abrir(inp);
  }, true);
  A.evt && A.evt.on && A.evt.on('modal:fechou', () => fechar());
})();
