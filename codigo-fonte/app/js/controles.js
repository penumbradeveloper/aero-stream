// Aero Stream - controles (gamepads): desenhos (Xbox, PlayStation, Switch Pro e genérico 1-2-3-4), remapeamento de botões,
// calibração dos analógicos e o desenho interativo que acende o que você aperta. Tudo que o app entende de controle passa
// por aqui: a navegação nos menus (nav.js) e o controle remoto enviado para o jogo (entrada.js). A tela "Controles"
// (tela()) é separada das Configurações: enquanto remapeia ou calibra, liga A.pad.captura e o resto do app ignora o controle.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;

  // Posições "padrão" (as mesmas do navegador): 0 baixo, 1 direita, 2 esquerda, 3 cima, 4 L1, 5 R1, 6 L2, 7 R2, 8 voltar, 9 iniciar,
  // 10 clique do analógico esquerdo, 11 do direito, 12-15 direcional, 16 botão central
  const SLOTS = ['baixo', 'dir', 'esq', 'cima', 'l1', 'r1', 'l2', 'r2', 'sel', 'start', 'l3', 'r3', 'dcima', 'dbaixo', 'desq', 'ddir', 'home'];
  const NOMES_SLOT = { baixo: 'a', dir: 'b', esq: 'x', cima: 'y', l1: 'lb', r1: 'rb', l2: 'lt', r2: 'rt', sel: 'voltar', start: 'start', l3: 'l3', r3: 'r3', dcima: 'cima', dbaixo: 'baixo', desq: 'esq', ddir: 'dir', home: 'home' };

  // Quatro desenhos de controle (mais o "Automático", que escolhe pelo nome que o navegador informa). Cada um diz o nome de cada posição,
  // a cor dos botões de rosto e QUAL posição confirma/volta (Xbox, PlayStation e genérico confirmam embaixo; Nintendo confirma à direita).
  // As posições dos botões de rosto são sempre: 0 embaixo, 1 direita, 2 esquerda, 3 em cima.
  const XBOX_COR = ['#3fae2a', '#e5473b', '#2d7fe0', '#f0b400']; // A B X Y
  const PS_COR = ['#5b8def', '#e5533d', '#e060a8', '#3fb08a'];   // ✕ ○ □ △
  const NIN_COR = ['#9aa6b2', '#9aa6b2', '#9aa6b2', '#9aa6b2'];
  const NUM_COR = { 1: '#5b8def', 2: '#3fae2a', 3: '#e5473b', 4: '#f0b400' };
  const L = (nome, rot, cor, extra = {}) => ({ nome, rot, cor, confirmar: 0, voltar: 1, ...extra });
  const COMUM = ['↑', '↓', '←', '→'];
  const horario = () => (cfg().sentido !== 'anti');
  const LAYOUTS = {
    xbox: L('Xbox', ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', ...COMUM, 'Xbox'], XBOX_COR, { familia: 'xbox' }),
    dualsense: L('PlayStation', ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', ...COMUM, 'PS'], PS_COR, { familia: 'ps' }),
    switchpro: L('Nintendo Switch Pro', ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', ...COMUM, 'Home'], NIN_COR, { familia: 'nintendo', confirmar: 1, voltar: 0 }),
    // Genérico: 1 fica no lugar do Y (em cima) e a numeração gira para a direita (horário) ou para a esquerda (anti-horário)
    generico: {
      confirmar: 0, voltar: 1, familia: 'num',
      get nome() { return T('Genérico (1 2 3 4)', 'Generic (1 2 3 4)'); },
      get rot() { return [...(horario() ? ['3', '2', '4', '1'] : ['3', '4', '2', '1']), 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', ...COMUM, 'Home']; },
      get cor() { return this.rot.slice(0, 4).map((n) => NUM_COR[n]); },
    },
  };
  const ORDEM_LAYOUTS = ['xbox', 'dualsense', 'switchpro', 'generico'];
  // Nomes de desenhos da versão 0.4.0 que não existem mais (o 8BitDo usa o desenho do Xbox; Xbox 360 e Xbox One viraram um só)
  const MIGRA = { xbox360: 'xbox', '8bitdo-x': 'xbox', '8bitdo-s': 'switchpro', num1234h: 'generico', num1234a: 'generico' };

  const cfg = () => {
    const c = A.cfg.v.controles;
    if (c.layout in MIGRA) { if (c.layout === 'num1234a') c.sentido = 'anti'; c.layout = MIGRA[c.layout]; }
    if (c.layout !== 'auto' && !LAYOUTS[c.layout]) c.layout = 'auto';
    if (c.sentido !== 'anti') c.sentido = 'horario';
    return c;
  };
  const chave = (g) => (g && g.id ? g.id.slice(0, 80) : 'generico');

  // Descobre o desenho pelo nome/IDs que o navegador informa
  function detectar(g) {
    const id = ((g && g.id) || '').toLowerCase();
    // "Wireless Controller" é o nome que o navegador dá ao DualShock/DualSense, mas o do Xbox é "Xbox Wireless Controller": o fabricante decide
    if (/054c|dualsense|dualshock|playstation|sony|\bps[345]\b/.test(id) || (/wireless controller/.test(id) && !/xbox|045e|xinput|8bitdo|2dc8|057e|nintendo|switch/.test(id))) return 'dualsense';
    if (/8bitdo|2dc8/.test(id)) return /switch|057e/.test(id) ? 'switchpro' : 'xbox'; // o 8BitDo no modo normal usa o desenho do Xbox
    if (/057e|pro controller|switch|nintendo|joy-?con/.test(id)) return 'switchpro';
    if (/xbox|045e|xinput|x360|028e/.test(id)) return 'xbox';
    return g && g.mapping === 'standard' ? 'xbox' : 'generico';
  }
  function layoutId(g) { const l = cfg().layout; return l && l !== 'auto' && LAYOUTS[l] ? l : detectar(g); }
  const layoutDe = (g) => LAYOUTS[layoutId(g)];

  // Botões fora do padrão (controle genérico, sem "standard"): ordem comum dos HID
  const HEURISTICA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  // Aplica zona morta circular e calibração a um par de eixos
  function eixo(x, y, c, zona) {
    const cx = c ? c.cx : 0, cy = c ? c.cy : 0, ex = c ? c.ex : 1, ey = c ? c.ey : 1;
    let nx = (x - cx) / (x >= cx ? ex : (c ? c.fx : 1)), ny = (y - cy) / (y >= cy ? ey : (c ? c.fy : 1));
    nx = A.limitar(nx, -1, 1); ny = A.limitar(ny, -1, 1);
    const m = Math.hypot(nx, ny);
    if (m <= zona) return [0, 0];
    const k = Math.min(1, (m - zona) / (1 - zona)) / m;
    return [nx * k, ny * k];
  }

  // Estado "de verdade" de um controle: já com remapeamento, calibração e zona morta aplicados.
  // b = máscara de bits das 17 posições; a = [LX, LY, RX, RY] entre -1 e 1; lt/rt entre 0 e 1.
  // Controle estilo Xbox SEM o mapeamento "standard" do navegador (comum no Linux por Bluetooth: Xbox, 8BitDo...): o navegador entrega
  // na ordem do kernel. Botões: A B X Y LB RB View Menu Guia LS RS. Eixos: LX LY LT RX RY RT e o direcional como eixos 6/7.
  // Antes isso caía na ordem "genérica": gatilhos, analógico direito e direcional saíam trocados.
  const EVDEV_XBOX = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 8, 7: 9, 8: 16, 9: 10, 10: 11 };
  const gatilhoNeg = new Map(); // id -> o gatilho já mostrou valor negativo (vai de -1 a 1, solto = -1)
  // (o driver xpad do Xbox entrega 11 botões; com 13 ou mais é o formato HID abaixo, que tem os "buracos" C e Z)
  const ehEvdevXbox = (g) => g.mapping !== 'standard' && g.buttons.length >= 10 && g.buttons.length <= 12 && g.axes.length >= 6 && g.axes.length <= 8 && /xbox|045e|xinput|8bitdo|2dc8|x-?input/i.test(g.id || '');
  // (0.5.9-7) controles por Bluetooth no Linux (8BitDo Ultimate 2 e outros) sem o mapeamento "standard" do navegador chegam em dois formatos:
  //  - HID genérico: A B C X Y Z LB RB LT RT Select Start Guia LS RS (C e Z são "buracos" que não existem no controle);
  //  - driver da Nintendo (modo Switch / Pro Controller): B A X Y Captura L R ZL ZR - + Home LS RS e o direcional como 4 botões.
  // Antes os dois caíam na ordem do Xbox: só os analógicos funcionavam direito e os botões saíam trocados ou mortos.
  const HID_CZ = { 0: 0, 1: 1, 3: 2, 4: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 16, 13: 10, 14: 11 };
  const NINTENDO_EVDEV = { 0: 0, 1: 1, 2: 3, 3: 2, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 16, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 };
  const ehNintendoEvdev = (g) => g.mapping !== 'standard' && g.buttons.length >= 17 && g.buttons.length <= 20 && /057e|nintendo|pro controller|joy-?con|switch/i.test(g.id || '');
  const ehHidCZ = (g) => g.mapping !== 'standard' && g.buttons.length >= 13 && g.buttons.length <= 16 && !ehNintendoEvdev(g);
  const avisados = new Set();
  const registrar = (g, formato) => { const k = g.id + '|' + formato; if (avisados.has(k)) return; avisados.add(k); A.log.info('controle', formato, g.id, 'mapeamento=' + (g.mapping || 'nenhum'), g.buttons.length + ' botões', g.axes.length + ' eixos'); };
  function gatilho(g, v) {
    v = +v || 0; const k = chave(g);
    if (v < -0.2) gatilhoNeg.set(k, true);
    return gatilhoNeg.get(k) ? A.limitar((v + 1) / 2, 0, 1) : A.limitar(v, 0, 1);
  }

  function lerEstado(g) {
    const k = chave(g), mapa = cfg().mapa[k] || {}, cal = cfg().cal[k] || {};
    const zona = A.limitar(cfg().zona, 0, 50) / 100;
    if (ehEvdevXbox(g)) {
      let b = 0;
      for (let i = 0; i < g.buttons.length; i++) {
        const bt = g.buttons[i]; const slot = i in mapa ? mapa[i] : EVDEV_XBOX[i];
        if (slot === null || slot === undefined || slot < 0 || slot > 16) continue;
        if (bt.pressed || bt.value > 0.5) b |= 1 << slot;
      }
      const ax = g.axes, lt = gatilho(g, ax[2]), rt = gatilho(g, ax[5]);
      if (lt > 0.35) b |= 1 << 6; if (rt > 0.35) b |= 1 << 7;
      if (ax.length >= 8) { if (ax[6] < -0.5) b |= 1 << 14; if (ax[6] > 0.5) b |= 1 << 15; if (ax[7] < -0.5) b |= 1 << 12; if (ax[7] > 0.5) b |= 1 << 13; }
      const [lx, ly] = eixo(ax[0] || 0, ax[1] || 0, cal.l, zona);
      const [rx, ry] = eixo(ax[3] || 0, ax[4] || 0, cal.r, zona);
      return { b, a: [lx, ly, rx, ry], lt, rt };
    }
    if (!(Object.keys(mapa).length) && (ehNintendoEvdev(g) || ehHidCZ(g))) { // sem remapeamento manual: usa o formato reconhecido
      const nin = ehNintendoEvdev(g), tab = nin ? NINTENDO_EVDEV : HID_CZ; registrar(g, nin ? 'nintendo-evdev' : 'hid-cz');
      let b = 0, lt = 0, rt = 0;
      for (let i = 0; i < g.buttons.length; i++) {
        const bt = g.buttons[i], slot = tab[i]; if (slot === undefined) continue;
        const valor = bt.value || (bt.pressed ? 1 : 0);
        if (slot === 6) lt = Math.max(lt, valor); else if (slot === 7) rt = Math.max(rt, valor);
        if (bt.pressed || valor > 0.5) b |= 1 << slot;
      }
      const ax = g.axes;
      // HID: o direcional vem como os 2 últimos eixos (-1, 0 ou 1); os gatilhos analógicos, quando existem, nos eixos 4 e 5
      if (!nin && ax.length >= 6) {
        const hx = ax[ax.length - 2], hy = ax[ax.length - 1];
        if (hx < -0.5) b |= 1 << 14; if (hx > 0.5) b |= 1 << 15; if (hy < -0.5) b |= 1 << 12; if (hy > 0.5) b |= 1 << 13;
        if (ax.length >= 8) { lt = Math.max(lt, gatilho(g, ax[4])); rt = Math.max(rt, gatilho(g, ax[5])); if (lt > 0.35) b |= 1 << 6; if (rt > 0.35) b |= 1 << 7; }
      }
      const [lx, ly] = eixo(ax[0] || 0, ax[1] || 0, cal.l, zona);
      const [rx, ry] = eixo(ax[2] || 0, ax[3] || 0, cal.r, zona);
      return { b, a: [lx, ly, rx, ry], lt, rt };
    }
    let b = 0, lt = 0, rt = 0;
    const padrao = g.mapping === 'standard' || g.buttons.length >= 17;
    if (!padrao) registrar(g, 'generico');
    for (let i = 0; i < g.buttons.length; i++) {
      const bt = g.buttons[i];
      const valor = bt.value || (bt.pressed ? 1 : 0);
      let slot = i in mapa ? mapa[i] : (padrao ? i : HEURISTICA[i]);
      if (slot === null || slot === undefined || slot < 0 || slot > 16) continue;
      if (slot === 6) lt = Math.max(lt, valor); else if (slot === 7) rt = Math.max(rt, valor);
      if (bt.pressed || valor > (slot === 6 || slot === 7 ? 0.35 : 0.5)) b |= 1 << slot;
    }
    // controle genérico com direcional em "hat" (eixo 9)
    if (!padrao && g.axes.length >= 10) {
      const v = g.axes[9];
      if (v < 1.5) { const passo = Math.round((v + 1) * 3.5); const dirs = [[12], [12, 15], [15], [13, 15], [13], [13, 14], [14], [12, 14]][A.limitar(passo, 0, 7)]; dirs.forEach((s) => { b |= 1 << s; }); }
    }
    const ax = g.axes;
    const [lx, ly] = eixo(ax[0] || 0, ax[1] || 0, cal.l, zona);
    const [rx, ry] = eixo(ax[2] || 0, ax[3] || 0, cal.r, zona);
    return { b, a: [lx, ly, rx, ry], lt, rt };
  }
  // (0.7.7) Controle genérico (PS2 e parecidos) com o modo analógico desligado: as setinhas chegam como o analógico esquerdo, mesmo o aparelho
  // se dizendo XInput, e no jogo viravam andar. Só um direcional pula do zero exato para o fim do curso sem nada no meio; analógico de verdade
  // passa pelo caminho. Um valor intermediário devolve o analógico na hora e vale por 30 s (nesse tempo o modo analógico está ligado).
  const ANALOGICO_MS = 30000;
  const esquerdo = new Map(); // índice|id -> { dig, repouso, ana }
  const noFim = (v) => Math.abs(v) > 0.99, noZero = (v) => Math.abs(v) < 0.01;
  function direcionalNoAnalogico(g, n) {
    const x = g.axes[0] || 0, y = g.axes[1] || 0, k = g.index + '|' + g.id, agora = performance.now();
    const st = esquerdo.get(k) || { dig: false, repouso: false, ana: -ANALOGICO_MS };
    esquerdo.set(k, st);
    if (!(noFim(x) || noZero(x)) || !(noFim(y) || noZero(y))) { st.dig = false; st.repouso = false; st.ana = agora; return n; }
    if (noZero(x) && noZero(y)) { st.dig = false; st.repouso = true; return n; }
    if (!st.dig) { st.dig = st.repouso && agora - st.ana > ANALOGICO_MS; st.repouso = false; }
    if (!st.dig) return n;
    registrar(g, 'direcional-no-analogico');
    let b = n.b;
    if (x < -0.5) b |= 1 << 14; if (x > 0.5) b |= 1 << 15; if (y < -0.5) b |= 1 << 12; if (y > 0.5) b |= 1 << 13;
    return { ...n, b, a: [0, 0, n.a[2], n.a[3]] };
  }
  const normalizar = (g) => direcionalNoAnalogico(g, lerEstado(g));
  const apertado = (n, slot) => !!(n.b & (1 << SLOTS.indexOf(slot)));

  // ---------- lista de controles conectados (com índice estável por aparelho) ----------
  const lerPads = () => (navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []);

  // ---------- calibração: gira os analógicos, guardamos o centro e o alcance de cada lado ----------
  function calibrarPar(amostras) {
    // amostras: [[x, y], ...] durante a rotação; o centro vem das primeiras amostras (soltas)
    if (amostras.length < 20) return null;
    const ini = amostras.slice(0, 8), cx = ini.reduce((s, p) => s + p[0], 0) / ini.length, cy = ini.reduce((s, p) => s + p[1], 0) / ini.length;
    let minx = 0, maxx = 0, miny = 0, maxy = 0;
    for (const [x, y] of amostras) { minx = Math.min(minx, x - cx); maxx = Math.max(maxx, x - cx); miny = Math.min(miny, y - cy); maxy = Math.max(maxy, y - cy); }
    const lim = (v) => A.limitar(Math.abs(v), 0.5, 1.2);
    return { cx, cy, ex: lim(maxx), fx: lim(minx), ey: lim(maxy), fy: lim(miny) };
  }

  // ---------- desenho do controle ----------
  // Todas as peças usam o MESMO nome de posição do resto do app (SLOTS): 'baixo', 'dir', 'esq', 'cima', 'l1', 'r1', 'l2', 'r2'...
  // Xbox, Switch Pro e genérico: analógico esquerdo em cima e direcional embaixo. PlayStation: o contrário (os dois analógicos embaixo).
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, ...filhos) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); filhos.forEach((f) => f && e.append(f)); return e; };
  const CORPO = 'M120 66 C88 66 68 88 60 128 L38 224 C32 252 50 274 78 272 C102 270 114 254 124 238 L134 232 L346 232 L356 238 C366 254 378 270 402 272 C430 274 448 252 442 224 L420 128 C412 88 392 66 360 66 Z';
  function desenhar(id) {
    const lay = LAYOUTS[id] || LAYOUTS.xbox, rot = lay.rot, ps = lay.familia === 'ps';
    const svg = el('svg', { viewBox: '0 0 480 290', class: 'pad-svg', role: 'group', 'aria-label': lay.nome });
    const txt = (x, y, t, tam = 12) => { const e = el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': tam, class: 'rot' }); e.textContent = t; return e; };
    // cada peça clicável é um grupo com nome (para o leitor de tela), foco (para o controle navegar até ela) e a posição em data-s
    const parte = (slot, forma, rotulo) => {
      const g = el('g', { 'data-s': slot, class: 'pt', tabindex: '0', role: 'button', 'aria-label': rot[SLOTS.indexOf(slot)] || slot });
      g.append(forma); if (rotulo) g.append(rotulo); return g;
    };
    svg.append(el('path', { class: 'corpo', d: CORPO }));
    // gatilhos (L2/R2) e ombros (L1/R1)
    const gat = (slot, x) => parte(slot, el('rect', { x, y: 12, width: 84, height: 28, rx: 11, class: 'bt' }), txt(x + 42, 26, rot[SLOTS.indexOf(slot)], 12));
    const omb = (slot, x) => parte(slot, el('rect', { x, y: 44, width: 96, height: 17, rx: 8, class: 'bt' }), txt(x + 48, 52.5, rot[SLOTS.indexOf(slot)], 10));
    svg.append(gat('l2', 90), gat('r2', 306), omb('l1', 84), omb('r1', 300)); // gatilho centrado em cima do ombro
    // direcional
    const dpad = (cx, cy) => {
      const g = el('g', { class: 'dpad' });
      g.append(el('rect', { x: cx - 10, y: cy - 10, width: 20, height: 20, class: 'base' }));
      g.append(parte('dcima', el('rect', { x: cx - 11, y: cy - 31, width: 22, height: 21, rx: 5, class: 'bt' }), txt(cx, cy - 20.5, '↑', 12)),
        parte('dbaixo', el('rect', { x: cx - 11, y: cy + 10, width: 22, height: 21, rx: 5, class: 'bt' }), txt(cx, cy + 20.5, '↓', 12)),
        parte('desq', el('rect', { x: cx - 31, y: cy - 11, width: 21, height: 22, rx: 5, class: 'bt' }), txt(cx - 20.5, cy, '←', 12)),
        parte('ddir', el('rect', { x: cx + 10, y: cy - 11, width: 21, height: 22, rx: 5, class: 'bt' }), txt(cx + 20.5, cy, '→', 12)));
      return g;
    };
    // analógico: a base fica parada, a bolinha anda com o analógico de verdade
    const stick = (slot, cx, cy) => {
      const g = el('g', { 'data-s': slot, class: 'pt', tabindex: '0', role: 'button', 'aria-label': rot[SLOTS.indexOf(slot)] });
      g.append(el('circle', { cx, cy, r: 33, class: 'base' }), el('circle', { cx, cy, r: 21, class: 'bt stick', 'data-cx': cx, 'data-cy': cy }));
      const t = txt(cx, cy, rot[SLOTS.indexOf(slot)], 11); t.setAttribute('class', 'rot stick-txt'); t.dataset.cx = cx; t.dataset.cy = cy; g.append(t);
      return g;
    };
    // botões de rosto: 0 embaixo, 1 direita, 2 esquerda, 3 em cima
    const fx = 348, fy = 128, o = 29, r = 16; // grupo inteiro dentro do corpo (antes o de cima furava a borda), na altura do analógico esquerdo
    const rosto = (i, x, y) => parte(['baixo', 'dir', 'esq', 'cima'][i], el('circle', { cx: x, cy: y, r, class: 'bt face', style: `--cor-b:${lay.cor[i]}` }), txt(x, y, rot[i], rot[i].length > 1 ? 11 : 14));
    svg.append(rosto(0, fx, fy + o), rosto(1, fx + o, fy), rosto(2, fx - o, fy), rosto(3, fx, fy - o));
    if (ps) svg.append(dpad(136, 128), stick('l3', 190, 194), stick('r3', 296, 194));
    else svg.append(stick('l3', 136, 128), dpad(190, 194), stick('r3', 296, 194));
    // centrais
    svg.append(parte('sel', el('rect', { x: 189, y: 106, width: 36, height: 15, rx: 7.5, class: 'bt' })), parte('start', el('rect', { x: 255, y: 106, width: 36, height: 15, rx: 7.5, class: 'bt' })), parte('home', el('circle', { cx: 240, cy: 86, r: 13, class: 'bt' })));
    svg.append(txt(207, 134, rot[8], 10), txt(273, 134, rot[9], 10));
    return svg;
  }

  // Acende o desenho conforme o que está apertado (o "botão colorido ao pressionar")
  function acender(svg, n) {
    for (const g of svg.querySelectorAll('[data-s]')) {
      const slot = g.dataset.s, i = SLOTS.indexOf(slot);
      let on = !!(n.b & (1 << i));
      if (slot === 'l2') on = n.lt > 0.35; if (slot === 'r2') on = n.rt > 0.35;
      g.classList.toggle('on', on);
    }
    const mover = (nome, ix, iy) => { const e = svg.querySelectorAll(nome)[ix === 0 ? 0 : 1]; if (e) { e.setAttribute('cx', +e.dataset.cx + n.a[ix] * 10); e.setAttribute('cy', +e.dataset.cy + n.a[iy] * 10); } };
    mover('circle.stick', 0, 1); mover('circle.stick', 2, 3);
    svg.querySelectorAll('text.stick-txt').forEach((t, k) => { const ix = k === 0 ? 0 : 2; t.setAttribute('x', +t.dataset.cx + n.a[ix] * 10); t.setAttribute('y', +t.dataset.cy + n.a[ix + 1] * 10); });
  }

  // ---------- TELA "Controles": desenho, remapeamento, calibração e tipo de controle ----------
  // Tela própria (não fica dentro das Configurações): enquanto a pessoa REMAPEIA ou CALIBRA, o resto do app ignora o controle por completo
  // (A.pad.captura); fora disso o controle navega normalmente e o B sai da tela.
  // Linux: o controle está ligado mas o kernel não o entrega como controle de jogo (ex.: 8BitDo Ultimate 2 em certos modos)
  async function semDriver() {
    const f = window.aero && window.aero.controlesSemDriver; if (!f) return null;
    const l = await f().catch(() => []); if (!l || !l.length) return null;
    return h('div', { class: 'tk-chave', estilo: { 'margin-top': '8px' } }, h('b', {}, T('Achei ', 'Found ') + l.map((x) => x.nome).join(', ') + T(', mas o Linux não o entrega como controle de jogo', ', but Linux does not expose it as a game controller')),
      h('div', { class: 'peq' }, T('Ele aparece só como "aparelho HID", então nenhum programa (nem o Aero, nem o navegador) consegue ler os botões. Coloque o controle no modo X-input/Xbox: em muitos 8BitDo é segurar X e apertar Start para ligar (ou usar o receptor USB dele). Depois desconecte e conecte de novo.', 'It shows up only as a "HID device", so no program (not Aero, not the browser) can read its buttons. Put the controller in X-input/Xbox mode: on many 8BitDo pads hold X and press Start to turn it on (or use its USB receiver). Then reconnect it.')));
  }

  function tela(el0, dados = {}) {
    const U = A.ui;
    const lista = h('div', { class: 'col', estilo: { gap: '6px' } });
    const grade = h('div', { class: 'layouts' });
    const palco = h('div', { class: 'pad-palco' });
    const estado = h('div', { class: 'ctl-estado', role: 'status', 'aria-live': 'polite' });
    const btnCancelar = U.btn(T('Cancelar', 'Cancel'), { tipo: 'sec', peq: true, onclick: () => cancelar() });
    btnCancelar.hidden = true;
    const sentidoBloco = h('label', { class: 'caixa-linha' });
    let svg = null, idLayout = null, raf = 0, remap = null, calib = null, padSel = null, tempo = 0;
    const offs = [];

    const pads = () => lerPads();
    const atual = () => { const l = pads(); return l.find((g) => g.index === padSel) || l[0] || null; };
    const nomeSlot = (slot) => (LAYOUTS[idLayout] || LAYOUTS.xbox).rot[SLOTS.indexOf(slot)];
    const dizer = (t) => { estado.textContent = t || ''; };
    // enquanto isto for verdade o resto do app NÃO enxerga o controle (nem navegar, nem voltar, nem rolar)
    const captura = (v) => { A.pad.captura = !!v; if (A.pad.atualizarLegenda) A.pad.atualizarLegenda(); };

    function pintarLista() {
      lista.textContent = '';
      const l = pads();
      if (!l.length) {
        lista.append(h('div', { class: 'suave peq' }, T('Nenhum controle detectado. Conecte um e aperte um botão.', 'No controller detected. Plug one in and press a button.')));
        semDriver().then((x) => { if (x && !pads().length) lista.append(x); });
      }
      l.forEach((g) => lista.append(h('button', { type: 'button', class: 'pad-item' + (atual() === g ? ' sel' : ''), onclick: () => { cancelar(); padSel = g.index; pintarLista(); montarSvg(true); } },
        A.icone('controle', 22), h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, g.id.replace(/\s*\(.*$/, '').slice(0, 48) || 'Controle'), h('div', { class: 'peq suave' }, `#${g.index} · ${g.buttons.length} ${T('botões', 'buttons')} · ${LAYOUTS[layoutId(g)].nome}`)))));
    }
    function pintarLayouts() {
      grade.textContent = '';
      const sel = cfg().layout || 'auto';
      const card = (id, nome, sub, extra) => h('button', { type: 'button', class: 'layout-card' + (sel === id ? ' sel' : ''), 'aria-pressed': String(sel === id), onclick: () => { cancelar(); cfg().layout = id; A.cfg.salvar(); pintarLayouts(); pintarLista(); montarSvg(true); } }, extra, h('div', { class: 'nm' }, nome), sub ? h('div', { class: 'peq suave' }, sub) : null);
      grade.append(card('auto', T('Automático', 'Automatic'), T('pelo nome do controle', 'by controller name'), h('div', { class: 'mini-faces' }, ...['#9aa6b2', '#9aa6b2', '#9aa6b2', '#9aa6b2'].map((c) => h('i', { estilo: { background: c } })))));
      ORDEM_LAYOUTS.forEach((id) => { const lay = LAYOUTS[id]; grade.append(card(id, lay.nome, null, h('div', { class: 'mini-faces' }, ...lay.cor.map((c, i) => h('i', { estilo: { background: c }, title: lay.rot[i] }, lay.rot[i]))))); });
      pintarSentido();
    }
    // a caixinha do sentido da numeração só aparece quando o desenho em uso é o genérico
    function pintarSentido() {
      const g = atual(), id = g ? layoutId(g) : (cfg().layout !== 'auto' ? cfg().layout : 'xbox');
      sentidoBloco.hidden = id !== 'generico';
      sentidoBloco.textContent = '';
      const cx = h('input', { type: 'checkbox' }); cx.checked = cfg().sentido !== 'anti';
      cx.addEventListener('change', () => { cancelar(); cfg().sentido = cx.checked ? 'horario' : 'anti'; A.cfg.salvar(); A.som.tocar('click'); pintarLayouts(); montarSvg(true); });
      sentidoBloco.append(cx, h('span', {}, T('Numeração em sentido horário', 'Numbers go clockwise')), h('span', { class: 'peq suave' }, T(' (o 1 fica em cima; desmarque para anti-horário)', ' (1 is on top; untick for counter-clockwise)')));
    }
    function montarSvg(forcar) {
      const g = atual();
      const id = g ? layoutId(g) : (cfg().layout !== 'auto' ? cfg().layout : 'xbox');
      if (!forcar && svg && idLayout === id) return;
      idLayout = id; palco.textContent = ''; svg = desenhar(id); palco.append(svg);
      svg.addEventListener('click', (e) => { const p = e.target.closest && e.target.closest('[data-s]'); if (!p) return; if (remap === p.dataset.s) cancelar(); else iniciarRemap(p.dataset.s); });
      svg.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.s) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
      if (!g) dizer(T('Conecte um controle e aperte um botão para testar. Toque em um botão do desenho para remapear.', 'Plug in a controller and press a button to test. Tap a button on the drawing to remap it.'));
      else if (!remap && !calib) dizer(T('Aperte botões e mexa os analógicos: o desenho acende. Para trocar um botão, toque nele e aperte o botão físico.', 'Press buttons and move the sticks: the drawing lights up. To change a button, tap it and press the physical button.'));
    }

    // --- remapear: escolhe a posição no desenho e aperta o botão físico que deve fazer aquilo ---
    let brutoAntes = null;
    function iniciarRemap(slot) {
      const g = atual(); if (!g) { dizer(T('Conecte um controle primeiro.', 'Connect a controller first.')); return; }
      calib = null; remap = slot; brutoAntes = g.buttons.map((b) => b.pressed || b.value > 0.5);
      svg.querySelectorAll('.esperando').forEach((x) => x.classList.remove('esperando'));
      const p = svg.querySelector(`[data-s="${slot}"]`); p && p.classList.add('esperando');
      captura(true); btnCancelar.hidden = false;
      dizer(T(`Aperte no controle o botão que deve ser "${nomeSlot(slot)}"... (Esc cancela)`, `Press the controller button that should be "${nomeSlot(slot)}"... (Esc cancels)`));
      clearTimeout(tempo); tempo = setTimeout(() => { if (remap === slot) { cancelar(); dizer(T('Tempo esgotado: nada foi alterado.', 'Timed out: nothing was changed.')); } }, 12000);
    }
    function cancelar(mensagem) {
      clearTimeout(tempo);
      const tinha = remap !== null || calib !== null;
      remap = null; calib = null;
      if (svg) svg.querySelectorAll('.esperando').forEach((x) => x.classList.remove('esperando'));
      btnCancelar.hidden = true; captura(false);
      if (tinha && mensagem) dizer(mensagem);
    }
    function checarRemap(g) {
      if (remap === null) return;
      for (let i = 0; i < g.buttons.length; i++) {
        const agora = g.buttons[i].pressed || g.buttons[i].value > 0.5;
        if (agora && !brutoAntes[i]) {
          const k = chave(g), alvo = remap, mapa = (cfg().mapa[k] = cfg().mapa[k] || {});
          mapa[i] = SLOTS.indexOf(alvo); A.cfg.salvar(); A.som.tocar('sucesso');
          cancelar(T('Botão ', 'Button ') + i + T(' agora é "', ' is now "') + nomeSlot(alvo) + '"');
          return;
        }
      }
      brutoAntes = g.buttons.map((b) => b.pressed || b.value > 0.5);
    }

    // --- calibrar: segura solto por 1 s, depois gira os dois analógicos por 4 s ---
    function iniciarCalibracao() {
      const g = atual(); if (!g) { dizer(T('Conecte um controle primeiro.', 'Connect a controller first.')); return; }
      cancelar(); calib = { fase: 'solto', t0: performance.now(), l: [], r: [] }; captura(true); btnCancelar.hidden = false;
      dizer(T('Solte os analógicos...', 'Release both sticks...'));
    }
    function passoCalibracao(g, agora) {
      if (!calib) return;
      const p = [[g.axes[0] || 0, g.axes[1] || 0], [g.axes[2] || 0, g.axes[3] || 0]];
      calib.l.push(p[0]); calib.r.push(p[1]);
      if (calib.fase === 'solto') {
        if (agora - calib.t0 > 900) { calib.fase = 'girar'; calib.t1 = agora; dizer(T('Agora gire os dois analógicos até as bordas, várias vezes...', 'Now rotate both sticks to the edges, a few times...')); }
      } else {
        const resta = Math.max(0, 4 - (agora - calib.t1) / 1000);
        dizer(T('Girando... ', 'Rotating... ') + resta.toFixed(0) + ' s');
        if (resta <= 0) {
          const cl = calibrarPar(calib.l), cr = calibrarPar(calib.r), k = chave(g);
          cfg().cal[k] = { l: cl, r: cr }; A.cfg.salvar(); A.som.tocar('sucesso');
          cancelar(T('Pronto! Analógicos calibrados.', 'Done! Sticks calibrated.'));
        }
      }
    }

    function laco() {
      const g = atual();
      if (g && svg) { checarRemap(g); passoCalibracao(g, performance.now()); acender(svg, normalizar(g)); }
      raf = requestAnimationFrame(laco);
    }

    const zonaNum = h('b', {}, cfg().zona + '%');
    const zona = U.slider({ min: 0, max: 40, valor: cfg().zona, oninput: (v) => { cfg().zona = v; zonaNum.textContent = v + '%'; A.cfg.salvar(); } });
    const sair = () => { cancelar(); if (dados.voltar) dados.voltar(); else U.ir('home', { ...(A.homeDados || {}), aba: 'config' }); };

    // (0.6.0) para quem está no controle: segurar A por 1 s sai daqui (a bolha enche enquanto segura). Com o mouse é só clicar.
    const segurarA = h('button', { type: 'button', class: 'segurar-a', title: T('Segure A por 1 segundo para sair', 'Hold A for 1 second to leave'), onclick: sair },
      h('span', { class: 'segurar-a-bola' }, 'A'), h('span', { class: 'segurar-a-txt' }, T('Segure para sair', 'Hold to leave')));
    const offSeg = A.evt.on('pad:segurar-a', (pr) => { if (!segurarA.isConnected) { if (typeof offSeg === 'function') offSeg(); return; } segurarA.style.setProperty('--p', pr); segurarA.classList.toggle('segurando', pr > 0); });
    const topo = h('div', { class: 'topo vidro' },
      U.btn(T('Voltar', 'Back'), { icone: 'voltar', tipo: 'sec', onclick: sair }), segurarA,
      h('div', { class: 'cab', estilo: { margin: '0' } }, h('h2', {}, T('Controles', 'Controllers')), h('span', { class: 'suave' }, T('Testar, remapear e calibrar', 'Test, remap and calibrate'))));
    const esquerda = h('section', { class: 'vidro pad ctl-esq' },
      h('h3', {}, T('Controles conectados', 'Connected controllers')), lista,
      h('h3', { estilo: { 'margin-top': '14px' } }, T('Tipo de controle', 'Controller type')),
      h('div', { class: 'peq suave', estilo: { margin: '2px 0 8px' } }, T('Escolha o desenho do seu controle: ele define os nomes dos botões e qual botão confirma e qual volta.', 'Pick your controller layout: it sets button names and which button confirms or goes back.')),
      grade, sentidoBloco,
      h('div', { class: 'linha entre', estilo: { 'margin-top': '14px' } }, h('span', {}, T('Zona morta dos analógicos', 'Stick dead zone')), zonaNum), zona);
    const direita = h('section', { class: 'vidro pad ctl-dir' },
      h('h3', {}, T('Testar e remapear', 'Test and remap')), palco, estado,
      h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '8px', 'margin-top': '10px' } }, btnCancelar,
        U.btn(T('Calibrar analógicos', 'Calibrate sticks'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: iniciarCalibracao }),
        U.btn(T('Restaurar botões', 'Reset buttons'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: () => { const g = atual(); cancelar(); if (g) { delete cfg().mapa[chave(g)]; delete cfg().cal[chave(g)]; A.cfg.salvar(); dizer(T('Mapeamento e calibração restaurados.', 'Mapping and calibration restored.')); } } })));
    el0.append(h('div', { class: 'home col', estilo: { height: '100%', 'min-height': 0 } }, topo, h('div', { class: 'conteudo' }, h('div', { class: 'ctl-corpo painel' }, esquerda, direita))));

    pintarLista(); pintarLayouts(); montarSvg(true); laco();
    const refaz = () => { cancelar(); pintarLista(); pintarLayouts(); montarSvg(true); };
    offs.push(A.evt.on('pad:conectou', refaz), A.evt.on('pad:desconectou', refaz));
    // Esc cancela o remapeamento (sem sair da tela); fora dele, o Esc sai
    const tecla = (e) => { if (e.key !== 'Escape') return; if (remap !== null || calib !== null) { e.preventDefault(); e.stopPropagation(); cancelar(T('Cancelado: nada foi alterado.', 'Cancelled: nothing was changed.')); } else if (!document.querySelector('#modais .fundo-modal')) sair(); };
    document.addEventListener('keydown', tecla, true);
    offs.push(() => document.removeEventListener('keydown', tecla, true));
    return { voltar: sair, limpar() { cancelar(); clearTimeout(tempo); cancelAnimationFrame(raf); offs.forEach((f) => f()); captura(false); } };
  }

  A.controles = { SLOTS, NOMES_SLOT, LAYOUTS, ORDEM_LAYOUTS, detectar, layoutId, layoutDe, normalizar, apertado, eixo, calibrarPar, desenhar, acender, tela, chave };
})();
