// Aero Stream - temas (v2). Você escolhe UMA cor (HEX) e o resto da paleta sai sozinho, SEMPRE no mesmo matiz:
// gradiente do fundo, bolhas, vidro, botões e texto. No modo avançado cada parte pode ter a sua própria cor.
// Tudo é validado e limitado: nenhum valor estranho consegue quebrar a interface. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;

  // ---------- cores (funções puras, testáveis) ----------
  function validarHex(s) {
    if (typeof s !== 'string') return null;
    let h = s.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
  }
  const hexParaRgb = (hex) => { const h = validarHex(hex) || '#2d9ee0'; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  function rgbParaHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslParaRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = A.limitar(s, 0, 100) / 100; l = A.limitar(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  const rgbParaHex = (rgb) => '#' + rgb.map((v) => A.limitar(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const hsl = (h, s, l) => rgbParaHex(hslParaRgb(h, s, l));
  function luminancia([r, g, b]) {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contraste(hexA, hexB) {
    const a = luminancia(hexParaRgb(hexA)), b = luminancia(hexParaRgb(hexB));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  // Escurece/clareia um texto até ter contraste legível (>= 4.5) com o fundo
  function garantirContraste(hTxt, sTxt, lTxt, fundoHex, direcao) {
    let l = lTxt;
    for (let i = 0; i < 60 && contraste(hsl(hTxt, sTxt, l), fundoHex) < 4.5; i++) l += direcao;
    return hsl(hTxt, sTxt, A.limitar(l, 0, 100));
  }

  // Cores dos botões: o gradiente tem 3 tons e o texto precisa ser legível (>= 3.5) em todos eles.
  function botoes(H, S, L) {
    const tons = (l) => [hsl(H, S, l + 12), hsl(H, S, l), hsl(H, S, l - 12)];
    const minimo = (txt, l) => Math.min(...tons(l).map((c) => contraste(txt, c)));
    let melhor = null;
    for (const txt of ['#ffffff', '#06202f']) {
      let l = A.limitar(L, 0, 100), passos = 0;
      const dir = txt === '#ffffff' ? -1 : 1;
      while (minimo(txt, l) < 3.5 && passos < 50 && l + dir >= 0 && l + dir <= 100) { l += dir * 2; passos++; }
      const m = minimo(txt, l);
      const custo = Math.abs(l - L) * (txt === '#ffffff' ? 0.4 : 1) + (txt === '#ffffff' ? 0 : 10) + (m < 3.5 ? 100 : 0);
      if (!melhor || custo < melhor.custo) melhor = { txt, l, m, custo };
    }
    const t = tons(melhor.l);
    return { c1: t[0], c2: t[1], c3: t[2], texto: melhor.txt, minimo: melhor.m };
  }

  // A partir de UMA cor, gera todas as outras. Todo o resto fica a no máximo ~12° do matiz escolhido
  // (antes, as bolhas de uma interface azul ficavam alaranjadas porque o matiz "andava" 30-48°).
  const COR_PADRAO = '#2d9ee0';
  function paleta(hexEntrada, escuro, destaqueHex) {
    const [r, g, b] = hexParaRgb(hexEntrada);
    const [H, S0, L0] = rgbParaHsl(r, g, b);
    // (0.8.3) a cor escolhida vale exatamente como é: antes a saturação tinha mínimo de 38% (preto e branco, sem matiz = 0°, viravam
    // vermelho) e o claro/escuro era preso numa faixa estreita (um verde escuro e um verde claro davam o mesmo verde). Agora a
    // saturação e o claro/escuro da cor escolhida passam para o fundo, as bolhas e os botões; só o texto é ajustado para dar leitura.
    const S = S0, L = L0;
    const k = Math.min(1, S0 / 60); // cinza escolhido = paleta cinza; cor viva = paleta viva
    const dl = L0 - 50; // quanto a cor é mais clara (+) ou mais escura (-) que o meio
    const p = { h: Math.round(H), escuro: !!escuro };
    p.cor = rgbParaHex([r, g, b]);
    p.cor2 = hsl(H, S, Math.min(97, L + 16));
    p.cor3 = hsl(H, S, Math.max(3, L - 14));
    p.acento = hsl(H + 8 * k, S, A.limitar(L + 4, 3, 97));
    if (escuro) {
      const lb = A.limitar(17 + dl * 0.22, 5, 30);
      p.bg1 = hsl(H, 30 * k, lb); p.bg2 = hsl(H + 5 * k, 28 * k, lb - 5); p.bg3 = hsl(H + 10 * k, 26 * k, lb - 8);
      p.texto = garantirContraste(H, 22 * k, 93, p.bg2, 1);
      p.suave = garantirContraste(H, 14 * k, 70, p.bg2, 1);
      const lbol = A.limitar(56 + dl * 0.4, 30, 82);
      p.bolhaA = hsl(H, 70 * k, lbol + 6); p.bolhaB = hsl(H + 10 * k, 68 * k, lbol - 6);
      p.vidroRgb = hslParaRgb(H, 26 * k, A.limitar(20 + dl * 0.2, 6, 32)).join(',');
    } else {
      const lb = A.limitar(80 + dl * 0.5, 52, 96);
      p.bg1 = hsl(H, 78 * k, lb); p.bg2 = hsl(H + 5 * k, 72 * k, Math.min(97, lb + 10)); p.bg3 = hsl(H + 10 * k, 62 * k, Math.min(98, lb + 13));
      p.texto = garantirContraste(H, 60 * k, 14, p.bg2, -1);
      p.suave = garantirContraste(H, 30 * k, 38, p.bg2, -1);
      const lbol = A.limitar(68 + dl * 0.4, 38, 90);
      p.bolhaA = hsl(H, 85 * k, lbol + 4); p.bolhaB = hsl(H + 10 * k, 80 * k, lbol - 4);
      p.vidroRgb = '255,255,255';
    }
    // botões: usam a cor de destaque, se o usuário escolheu uma
    let Hb = H, Sb = S, Lb = L;
    const d = validarHex(destaqueHex);
    // (0.5.9-7) a cor escolhida vale como está: antes a saturação tinha mínimo de 38%, e o branco (sem matiz = 0°, vermelho) virava vermelho
    // nos botões e rosa nos controles deslizantes. Cinzas e branco continuam cinzas e branco; só o claro/escuro é ajustado para dar leitura.
    if (d) { const [dr, dg, db] = hexParaRgb(d); const [dh, ds, dl] = rgbParaHsl(dr, dg, db); Hb = dh; Sb = A.limitar(ds, 0, 100); Lb = dl; p.cor = d; p.cor2 = hsl(Hb, Sb, Math.min(96, Lb + 12)); p.cor3 = hsl(Hb, Sb, Math.max(3, Lb - 14)); }
    const bt = botoes(Hb, Sb, Lb);
    p.btn1 = bt.c1; p.btn2 = bt.c2; p.btn3 = bt.c3; p.textoCor = bt.texto; p.contrasteBotao = bt.minimo;
    return p;
  }

  // Cor principal de uma imagem: a cor mais "viva" que mais aparece (ignora cinzas e transparentes)
  function corDaImagem(rgba) {
    const baldes = Array.from({ length: 24 }, () => ({ peso: 0, r: 0, g: 0, b: 0 }));
    let mr = 0, mg = 0, mb = 0, n = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) continue;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      mr += r; mg += g; mb += b; n++;
      const [h, s, l] = rgbParaHsl(r, g, b);
      if (s < 18 || l < 12 || l > 92) continue;
      const w = (s / 100) * (1 - Math.abs(l - 52) / 60) + 0.02;
      const k = baldes[Math.floor(h / 15) % 24];
      k.peso += w; k.r += r * w; k.g += g * w; k.b += b * w;
    }
    if (!n) return { hex: '#2d9ee0', luz: 0.5 };
    const luz = luminancia([mr / n, mg / n, mb / n]);
    const melhor = baldes.reduce((a, c) => (c.peso > a.peso ? c : a), baldes[0]);
    if (melhor.peso < 0.5) { const [h, sat] = rgbParaHsl(mr / n, mg / n, mb / n); return { hex: hsl(sat < 10 ? 210 : h, 28, 50), luz }; }
    const [h, s, l] = rgbParaHsl(melhor.r / melhor.peso, melhor.g / melhor.peso, melhor.b / melhor.peso);
    return { hex: hsl(h, Math.max(s, 45), A.limitar(l, 38, 62)), luz };
  }

  // ---------- limites: nenhum valor sai disto (nem de um arquivo salvo corrompido) ----------
  const LIM = {
    vidro: [0, 100], desfoqueUI: [0, 40], desfoqueFundo: [0, 40], desfoqueBolhas: [0, 40], raio: [0, 36],
    fundoAngulo: [0, 360], vidroAngulo: [0, 360], fundoX: [0, 100], fundoY: [0, 100],
    bolhasAngulo: [0, 360], bolhasQtd: [0, 30], bolhasTam: [40, 360], bolhasVel: [0, 100], bolhasOpac: [10, 100],
  };
  const MODOS_BOLHA = ['subir', 'descer', 'esq', 'dir', 'parado'];
  const MAX_IMG = 2.2e6, MAX_IMG_BOLHA = 6e5;

  function sanear(t) {
    const p = A.cfg.padrao().tema;
    const o = { ...p, ...(t || {}) };
    o.escuro = !!o.escuro;
    o.cor = validarHex(o.cor) || p.cor;
    const num = (v, k) => (v !== '' && v !== null && v !== undefined && Number.isFinite(+v) ? A.limitar(v, LIM[k][0], LIM[k][1]) : p[k]);
    for (const k of Object.keys(LIM)) o[k] = num(o[k], k);
    o.bolhasQtd = Math.round(o.bolhasQtd); o.bolhasTam = Math.round(o.bolhasTam);
    o.bolhas = o.bolhas !== false; o.parallax = o.parallax !== false; o.avancado = !!o.avancado;
    o.bolhasGradiente = o.bolhasGradiente !== false;
    o.anim = ['total', 'reduzida', 'nenhuma'].includes(o.anim) ? o.anim : 'total';
    o.fundoForma = o.fundoForma === 'radial' ? 'radial' : 'linear';
    o.bolhasModo = MODOS_BOLHA.includes(o.bolhasModo) ? o.bolhasModo : 'subir';
    const imgOk = (s, max) => typeof s === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= max;
    o.fundoTipo = ['gradiente', 'solido', 'imagem'].includes(o.fundoTipo) ? o.fundoTipo : 'gradiente';
    if (o.fundoTipo === 'imagem' && !imgOk(o.imagem, MAX_IMG)) o.fundoTipo = 'gradiente';
    if (o.fundoTipo !== 'imagem') o.imagem = null;
    if (!imgOk(o.bolhasImagem, MAX_IMG_BOLHA)) o.bolhasImagem = null;
    const cores = Array.isArray(o.fundoCores) ? o.fundoCores : [];
    o.fundoCores = [0, 1, 2].map((i) => validarHex(cores[i]) || '');
    for (const k of ['bolhasCor1', 'bolhasCor2', 'destaque', 'hudCor', 'hudTexto', 'textoCor', 'molduraCor']) o[k] = validarHex(o[k]) || '';
    // (0.8.3) layout
    o.vidroTipo = ['auto', 'solido', 'gradiente', 'imagem'].includes(o.vidroTipo) ? o.vidroTipo : 'auto';
    const vc = Array.isArray(o.vidroCores) ? o.vidroCores : [];
    o.vidroCores = [0, 1, 2].map((i) => validarHex(vc[i]) || '');
    if (!imgOk(o.vidroImagem, MAX_IMG)) o.vidroImagem = null;
    if (o.vidroTipo === 'imagem' && !o.vidroImagem) o.vidroTipo = 'auto';
    // (0.9.5) papel de parede animado (GIF/WebP): o arquivo fica só neste aparelho (IndexedDB); "imagem" é o quadro parado de reserva
    const refOk = (r) => typeof r === 'string' && /^aero-arq:[a-f0-9]{24}$/.test(r);
    if (!refOk(o.imagemAnim) || !o.imagem) o.imagemAnim = null;
    if (!refOk(o.vidroAnim) || !o.vidroImagem) o.vidroAnim = null;
    o.fonte = Object.prototype.hasOwnProperty.call(FONTES, o.fonte) ? o.fonte : 'padrao';
    o.moldura = o.moldura !== false;
    delete o.desfoque; delete o.fundo; // nomes antigos (v0.3)
    return o;
  }

  // (0.8.3) fontes do app inteiro (só fontes do sistema: nada é baixado de fora)
  const FONTES = {
    padrao: '',
    sistema: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif',
    arredondada: '"Nunito", "Varela Round", "Quicksand", "Comfortaa", ui-rounded, "SF Pro Rounded", "Segoe UI", sans-serif',
    serifa: 'Georgia, "Times New Roman", "DejaVu Serif", serif',
    elegante: '"Palatino Linotype", "Book Antiqua", Palatino, "URW Palladio L", serif',
    mono: '"Cascadia Code", "JetBrains Mono", Consolas, "DejaVu Sans Mono", ui-monospace, monospace',
    maquina: '"Courier New", "Cascadia Code", ui-monospace, monospace',
    estreita: '"Bahnschrift", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", sans-serif',
    verdana: 'Verdana, Tahoma, "DejaVu Sans", sans-serif',
    manuscrita: '"Segoe Print", "Comic Neue", "Comic Sans MS", "Chalkboard SE", cursive',
  };
  const misturar = (c, a) => `color-mix(in srgb, ${c} calc(${a} * 100%), transparent)`;
  // ---------- (0.9.5) arquivos animados do papel de parede: guardados só neste aparelho ----------
  const ARQ = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((ok, no) => { const r = indexedDB.open('aero-arq', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => { dbp = null; no(r.error); }; }));
    const op = (modo, fn) => db().then((d) => new Promise((ok, no) => { const tx = d.transaction('f', modo), st = tx.objectStore('f'); let res; const q = fn(st); if (q) q.onsuccess = () => { res = q.result; }; tx.oncomplete = () => ok(res); tx.onerror = tx.onabort = () => no(tx.error); }));
    return {
      por: (id, v) => op('readwrite', (st) => st.put(v, id)),
      ler: (id) => op('readonly', (st) => st.get(id)),
      chaves: () => op('readonly', (st) => st.getAllKeys()),
      tirar: (id) => op('readwrite', (st) => st.delete(id)),
    };
  })();
  const urls = new Map(); // id -> { url, poster } | 'carregando' | 'falhou'
  const idDe = (ref) => ref.slice(9);
  // a URL do arquivo animado, se já estiver pronta (e for do mesmo papel de parede); senão começa a carregar e reaplica o tema
  function animUrl(t, ref, poster) {
    if (!ref || !poster || A.cfg.v.visual === 'lite' || t.anim === 'nenhuma' || !window.indexedDB) return null;
    const id = idDe(ref), x = urls.get(id);
    if (x && typeof x === 'object') return x.poster === poster ? x.url : null;
    if (x) return null;
    urls.set(id, 'carregando');
    ARQ.ler(id).then((r) => {
      if (!r || !(r.blob instanceof Blob)) { urls.set(id, 'falhou'); return; }
      urls.set(id, { url: URL.createObjectURL(r.blob), poster: r.poster });
      if (r.poster === poster) aplicar();
    }).catch(() => urls.set(id, 'falhou'));
    return null;
  }
  // apaga os animados que nenhum papel de parede usa mais
  async function limparArqs() {
    try {
      const t = A.cfg.v.tema || {}, usados = new Set([t.imagemAnim, t.vidroAnim].filter(Boolean).map(idDe));
      for (const k of await ARQ.chaves()) if (!usados.has(k)) { await ARQ.tirar(k); const x = urls.get(k); if (x && x.url) URL.revokeObjectURL(x.url); urls.delete(k); }
    } catch (e) { A.log && A.log.aviso && A.log.aviso('papel animado: limpeza falhou'); }
  }
  // a amostra do papel de parede nas Configurações: a animação também, quando der
  const urlFundoAgora = (t) => (t.fundoTipo === 'imagem' && t.imagem ? animUrl(t, t.imagemAnim, t.imagem) || t.imagem : '');

  // (0.8.3) o padrão do vidro: cor sólida, degradê de até 3 cores ou imagem própria (na frente do papel de parede)
  function vidroCSS(t) {
    const a = 'var(--vidro-a)';
    if (t.vidroTipo === 'imagem' && t.vidroImagem) return `linear-gradient(rgba(var(--vidro-rgb), calc(${a} * .35)), rgba(var(--vidro-rgb), calc(${a} * .35))), url("${animUrl(t, t.vidroAnim, t.vidroImagem) || t.vidroImagem}") center / cover`;
    const cs = t.vidroCores.filter(Boolean);
    if (!cs.length) return '';
    if (t.vidroTipo === 'solido') return misturar(cs[0], a);
    if (t.vidroTipo === 'gradiente') return cs.length === 1 ? misturar(cs[0], a) : `linear-gradient(${t.vidroAngulo}deg, ${cs.map((c, i) => misturar(c, a) + ' ' + Math.round((i / (cs.length - 1)) * 100) + '%').join(', ')})`;
    return '';
  }
  // HUD (botões selecionados, abas, interruptores): três tons a partir de uma cor
  function tonsHud(hex) {
    const [h, s0, l] = rgbParaHsl(...hexParaRgb(hex));
    // (1.0.2) o branco (e as cores bem claras) ficam brancos de verdade: antes o lado claro parava em 92% e o escuro descia 14%, e o botão branco virava cinza
    return [hsl(h, s0, A.limitar(l + 14, 0, 100)), hex, hsl(h, s0, A.limitar(l - (l > 85 ? 6 : 14), 6, 100))];
  }

  // CSS do fundo (gradiente, cor sólida ou imagem), a partir da paleta e das cores escolhidas
  // (0.8.3) as cores do fundo: se o usuário escolheu alguma, as vazias repetem as dele (nenhuma cor de fora entra); sem nenhuma, o padrão
  function coresFundo(t, p) {
    const u = t.fundoCores || [];
    if (!u.some(Boolean)) return [p.bg1, p.bg2, p.bg3];
    return [0, 1, 2].map((i) => u[i] || u[i - 1] || u[i + 1] || u[i - 2] || u[i + 2]);
  }
  function fundoCSS(t, p) {
    const c = coresFundo(t, p);
    if (t.fundoTipo === 'solido') return t.fundoCores[0] || (t.fundoCores.some(Boolean) ? c[0] : p.bg2);
    if (t.fundoForma === 'radial') return `radial-gradient(circle at ${t.fundoX}% ${t.fundoY}%, ${c[0]} 0%, ${c[1]} 55%, ${c[2]} 100%)`;
    return `linear-gradient(${t.fundoAngulo}deg, ${c[0]} 0%, ${c[1]} 55%, ${c[2]} 100%)`;
  }

  // ---------- aplicar na página ----------
  // Só mexe em variáveis CSS: a página inteira muda de uma vez, sem recriar elementos (sem piscar).
  // (1.0.2) "Cores avançadas" desligado = o app volta ao automático nessas partes (a cor de destaque, o layout, a fonte, a moldura, o fundo
  // personalizado e as bolhas). O que você escolheu continua guardado: ligar de novo traz tudo de volta
  const AVANCADAS = ['destaque', 'vidroTipo', 'vidroCores', 'vidroAngulo', 'vidroImagem', 'vidroAnim', 'hudCor', 'hudTexto', 'textoCor', 'fonte', 'moldura', 'molduraCor',
    'fundoForma', 'fundoAngulo', 'fundoX', 'fundoY', 'fundoCores', 'bolhasCor1', 'bolhasCor2', 'bolhasGradiente', 'bolhasAngulo', 'bolhasImagem', 'bolhasQtd', 'bolhasTam',
    'bolhasVel', 'bolhasModo', 'bolhasOpac', 'desfoqueBolhas'];
  function efetivo(t) {
    if (!t || t.avancado) return t;
    const pd = A.cfg.padrao().tema, o = { ...t };
    for (const k of AVANCADAS) if (k in pd) o[k] = Array.isArray(pd[k]) ? [...pd[k]] : pd[k];
    if (o.fundoTipo !== 'imagem') o.fundoTipo = 'gradiente'; // o papel de parede (imagem) fica fora das avançadas
    return o;
  }
  function aplicar(tema) {
    const salvo = sanear(tema || A.cfg.v.tema);
    A.cfg.v.tema = salvo;
    const t = efetivo(salvo);
    const p = paleta(t.cor, t.escuro, t.destaque);
    // (0.8.3) a cor principal é SÓ do layout (painéis, HUD, botões): o fundo, a aurora, as bolhas do fundo e as bolhas dos amigos
    // usam sempre a paleta padrão do app, não importa a cor escolhida
    const pf = paleta(COR_PADRAO, t.escuro);
    // (0.8.3) as manchas que se mexem no degradê (aurora) usam só as cores 1, 2 e 3 do fundo: nenhuma cor de fora aparece nele
    const fc = coresFundo(t, pf);
    const root = document.documentElement, s = root.style;
    const v = {
      '--h': p.h, '--cor': p.cor, '--cor-2': p.cor2, '--cor-3': p.cor3, '--acento': p.acento, '--bg-1': p.bg1, '--bg-2': p.bg2, '--bg-3': p.bg3,
      '--texto': p.texto, '--suave': p.suave, '--texto-cor': p.textoCor, '--btn-1': p.btn1, '--btn-2': p.btn2, '--btn-3': p.btn3, '--bolha-a': p.bolhaA, '--bolha-b': p.bolhaB,
      '--b1': t.bolhasCor1 || pf.bolhaA, '--b2': t.bolhasCor2 || pf.bolhaB, '--amb-a': fc[2], '--amb-b': fc[1], '--amb-cor': fc[0], '--bang': t.bolhasAngulo + 'deg', '--bopac': (t.bolhasOpac / 100).toFixed(2),
      '--blur': t.desfoqueUI + 'px', '--blur-img': t.desfoqueFundo + 'px', '--blur-bolhas': t.desfoqueBolhas + 'px',
      '--raio': t.raio + 'px', '--raio-p': Math.round(t.raio * 0.55) + 'px', '--raio-g': Math.round(t.raio * 1.5) + 'px',
      '--vidro-a': (t.vidro / 100).toFixed(3), '--vidro-f': (t.vidro / 100 + (1 - t.vidro / 100) * 0.5 * (A.limitar(+t.desfoqueUI || 0, 0, 40) / 40)).toFixed(3), '--vidro-rgb': p.vidroRgb, '--fundo-css': fundoCSS(t, pf),
    };
    // (0.8.3) layout personalizado
    if (t.vidroTipo !== 'auto' && t.vidroTipo !== 'imagem' && t.vidroCores[0]) v['--vidro-rgb'] = hexParaRgb(t.vidroCores[0]).join(', ');
    if (t.hudCor) { const [a1, a2, a3] = tonsHud(t.hudCor); v['--btn-1'] = a1; v['--btn-2'] = a2; v['--btn-3'] = a3; }
    if (t.hudTexto) v['--texto-cor'] = t.hudTexto;
    else if (t.hudCor) v['--texto-cor'] = contraste(t.hudCor, '#ffffff') >= contraste(t.hudCor, '#10202c') ? '#ffffff' : '#10202c'; // legível sozinho
    // (0.8.7) o texto em cima da cor principal (destaques, abas escolhidas): branco ou escuro, o que for legível
    v['--sobre-cor'] = contraste(p.cor, '#ffffff') >= contraste(p.cor, '#10202c') ? '#ffffff' : '#10202c';
    if (t.textoCor) { v['--texto'] = t.textoCor; v['--suave'] = `color-mix(in srgb, ${t.textoCor} 68%, transparent)`; }
    const vpad = vidroCSS(t);
    if (vpad) s.setProperty('--vidro-pad', vpad); else s.removeProperty('--vidro-pad');
    if (FONTES[t.fonte]) s.setProperty('--fonte', FONTES[t.fonte]); else s.removeProperty('--fonte');
    if (t.molduraCor) s.setProperty('--moldura-cor', t.molduraCor); else s.removeProperty('--moldura-cor');
    root.dataset.vidro = vpad ? 'pad' : '';
    root.dataset.moldura = t.moldura ? '1' : '0';
    root.dataset.molduraCor = t.molduraCor ? '1' : '';
    for (const [k, val] of Object.entries(v)) s.setProperty(k, String(val));
    root.dataset.tema = t.escuro ? 'escuro' : 'claro';
    root.dataset.anim = t.anim;
    root.dataset.fundo = t.fundoTipo;
    root.dataset.bolhas = t.bolhas && t.bolhasQtd > 0 ? '1' : '0';
    root.dataset.parallax = t.parallax ? '1' : '0';
    root.dataset.barra = t.barra === 'doca' ? 'doca' : 'bolha'; // (0.8.7) jeito da barra das abas: bolha do perfil (padrão) ou doca
    root.dataset.doca = ['cima', 'esquerda', 'direita'].includes(t.doca) ? t.doca : 'baixo';
    root.dataset.bmodo = t.bolhasModo;
    root.dataset.bdesf = +t.desfoqueBolhas > 0 ? '1' : '0'; // (0.5.9-8) desfoque 0 = sem filtro nenhum (um "blur(0px)" por bolha custava caro)
    root.dataset.fdesf = +t.desfoqueFundo > 0 ? '1' : '0';
    root.dataset.desfui = +t.desfoqueUI > 0 ? '1' : '0'; // (0.6.0) desfoque da interface: com 0 os painéis ficam foscos e leves; acima disso, vidro desfocado de verdade // (0.5.9-9) idem para a imagem de fundo
    root.dataset.visual = A.cfg.v.visual === 'lite' ? 'lite' : 'fancy';
    root.dataset.celular = A.plat.celular ? '1' : '0'; // (0.9.0) celular: vidro sem desfoque de verdade (o que mais pesava na rolagem do perfil e do Aero Talk)
    // chats: tamanho do texto e das fotos (Configurações > Chats)
    const ch = A.cfg.v.chat || {}, fotos = { enorme: 58, grande: 44, normal: 34, pequena: 24 };
    s.setProperty('--cx-escala', String(Math.max(0.8, Math.min(1.6, (+ch.fonte || 100) / 100))));
    s.setProperty('--cx-av', (fotos[ch.foto] || 34) + 'px');
    root.dataset.cxFotos = ch.foto === 'nao' ? '0' : '1';
    // (0.9.1) o lado das suas mensagens: o escolhido em Configurações > Chats; sem escolha, à direita no celular e à esquerda no computador
    root.dataset.cxlado = ['direita', 'esquerda', 'todasdir', 'invertido'].includes(ch.lado) ? ch.lado : A.plat.celular ? 'direita' : 'esquerda';
    // (1.0.2) quem mostra o nome e a foto nas mensagens: todos, só o seu, só o dos outros ou ninguém (sem escolha: como o lado manda)
    for (const [k, d] of [['nomes', 'cxnome'], ['fotosLado', 'cxav']]) { if (['todos', 'meu', 'outros', 'nenhum'].includes(ch[k])) root.dataset[d] = ch[k]; else delete root.dataset[d]; }
    const img = document.getElementById('fundo-img');
    if (img) {
      const url = t.fundoTipo === 'imagem' ? `url("${animUrl(t, t.imagemAnim, t.imagem) || t.imagem}")` : 'none';
      if (img.dataset.url !== url) { img.dataset.url = url; img.style.backgroundImage = url; }
    }
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', p.bg2);
    A.evt.emit('tema', t);
    return p;
  }

  // Assinatura do que exige RECRIAR as bolhas (cores e desfoque não exigem: são só variáveis CSS)
  const assinaturaBolhas = (t) => [t.bolhas, t.bolhasQtd, t.bolhasTam, t.bolhasVel, t.bolhasModo, t.bolhasImagem ? t.bolhasImagem.length : 0, t.bolhasGradiente].join('|');

  // ---------- imagens ----------
  const abrirImagem = async (arquivo) => {
    if (!arquivo || !/^image\//.test(arquivo.type)) throw new Error(A.T('Escolha um arquivo de imagem.', 'Choose an image file.'));
    const url = URL.createObjectURL(arquivo);
    try {
      return { url, img: await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(A.T('Não consegui abrir essa imagem.', 'Could not open this image.'))); i.src = url; }) };
    } catch (e) { URL.revokeObjectURL(url); throw e; }
  };

  // Lê um arquivo de imagem, reduz (para caber no armazenamento) e acha a cor principal dele
  async function imagemDeFundo(arquivo) {
    const { url, img } = await abrirImagem(arquivo);
    try {
      const esc = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * esc)); c.height = Math.max(1, Math.round(img.naturalHeight * esc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let dataUrl = c.toDataURL('image/jpeg', 0.78);
      if (dataUrl.length > 1.6e6) dataUrl = c.toDataURL('image/jpeg', 0.55); // cabe no armazenamento do aparelho
      const m = document.createElement('canvas'); m.width = 48; m.height = 48;
      const mg = m.getContext('2d', { willReadFrequently: true }); mg.drawImage(img, 0, 0, 48, 48);
      const { hex, luz } = corDaImagem(mg.getImageData(0, 0, 48, 48).data);
      // (0.9.5) GIF/WebP animado: o arquivo inteiro vai para o armazenamento do aparelho; o JPEG acima vira o quadro parado de reserva
      let anim = null;
      if (window.indexedDB && A.ui && A.ui.animada && (await A.ui.animada(arquivo))) {
        if (arquivo.size > 30 * 1024 * 1024) throw new Error(A.T('Imagem animada grande demais (máximo 30 MB).', 'Animated image too large (max 30 MB).'));
        const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
        await ARQ.por(id, { blob: arquivo.slice(0, arquivo.size, arquivo.type), poster: dataUrl });
        anim = 'aero-arq:' + id;
      }
      return { dataUrl, hex, luz, anim };
    } finally { URL.revokeObjectURL(url); }
  }

  // PNG da bolha (com transparência): reduz para no máximo 256 px
  async function imagemDeBolha(arquivo) {
    const { url, img } = await abrirImagem(arquivo);
    try {
      for (const lado of [256, 160, 96]) {
        const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * esc)); c.height = Math.max(1, Math.round(img.naturalHeight * esc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL('image/png');
        if (d.length <= MAX_IMG_BOLHA) return d;
      }
      throw new Error(A.T('Essa imagem é pesada demais para ser uma bolha.', 'This image is too heavy to be a bubble.'));
    } finally { URL.revokeObjectURL(url); }
  }

  A.tema = { AVANCADAS, efetivo, FONTES, COR_PADRAO, validarHex, hexParaRgb, rgbParaHsl, hslParaRgb, hsl, contraste, paleta, corDaImagem, sanear, aplicar, imagemDeFundo, limparArqs, urlFundoAgora, imagemDeBolha, fundoCSS, assinaturaBolhas, LIM, MODOS_BOLHA };
})();
