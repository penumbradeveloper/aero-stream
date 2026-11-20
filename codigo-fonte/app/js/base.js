// Aero Stream - base compartilhada por todas as telas (PC, site e APK).
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = (window.Aero = window.Aero || {});
  A.versao = '0.9.7';
  A.autor = 'Ryan Victtor';

  // ---------- plataforma ----------
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  A.plat = {
    desktop: !!window.aero,                                              // dentro do app do PC (Electron)
    apk: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
    ios, android: /Android/.test(ua),
    toque: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches),
    fraco: (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4,
    // a página é desenhada pelo processador? (sem WebGL, ou WebGL por software: llvmpipe, SwiftShader, "Basic Render Driver"...)
    semAceleracao: () => {
      if (A._semAcel !== undefined) return A._semAcel;
      let r = true;
      try {
        const c = document.createElement('canvas'), gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: true }) || c.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true });
        if (gl) {
          const i = gl.getExtension('WEBGL_debug_renderer_info');
          const nome = String(i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
          r = /llvmpipe|softpipe|swiftshader|software|basic render|microsoft basic|mesa offscreen/i.test(nome);
          const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
        }
      } catch (e) { r = false; }
      return (A._semAcel = r);
    },
  };
  A.plat.shell = A.plat.desktop || A.plat.apk || location.protocol === 'file:'; // precisa saber o endereço do servidor
  A.plat.podeCompartilhar = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  A.plat.camera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); // chamada de vídeo do Aero Talk (também no APK, que não compartilha a tela)
  A.plat.celular = A.plat.ios || A.plat.android || (A.plat.toque && innerWidth < 820);

  // O append nativo escreve a palavra "null" na tela quando recebe null/undefined (ex.: ícone opcional ausente).
  // Aqui ele passa a ignorar esses valores: some a classe inteira de defeito, em todas as telas.
  for (const metodo of ['append', 'prepend', 'replaceChildren']) {
    const nativo = Element.prototype[metodo];
    Element.prototype[metodo] = function (...nos) { return nativo.apply(this, nos.filter((n) => n != null && n !== false)); };
  }

  // ---------- utilidades ----------
  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  A.limitar = (v, mi, ma) => Math.min(ma, Math.max(mi, Number.isFinite(+v) ? +v : mi));
  A.esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Cria elementos sem innerHTML: nomes e mensagens de outras pessoas nunca viram código.
  A.h = (tag, attrs, ...filhos) => {
    const e = document.createElement(tag);
    // (0.9.7) toda imagem decodifica fora do quadro: a rolagem não espera foto/emoji abrir para desenhar o próximo quadro
    if (tag === 'img') e.decoding = 'async';
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'dados') Object.entries(v).forEach(([a, b]) => { e.dataset[a] = b; });
      else if (k === 'estilo') Object.entries(v).forEach(([a, b]) => e.style.setProperty(a, b));
      else e.setAttribute(k, v === true ? '' : v);
    });
    filhos.flat(9).forEach((f) => { if (f != null && f !== false) e.append(f); });
    return e;
  };

  // ---------- eventos internos ----------
  const ouvintes = {};
  A.evt = {
    on(n, f) { (ouvintes[n] ||= new Set()).add(f); return () => ouvintes[n].delete(f); },
    emit(n, d) { (ouvintes[n] || []).forEach((f) => { try { f(d); } catch (e) { A.log.erro('evento ' + n, e); } }); },
    // (1.0.2) ouvinte preso a um pedaço da tela: sai sozinho quando o pedaço sai da página (antes, cada conversa aberta deixava ouvintes
    // para trás, e eles seguravam o chat antigo inteiro na memória: o app ia ficando pesado com o tempo)
    vivo(el, n, f) { const off = A.evt.on(n, f); presos.push({ el, off, t: Date.now() }); if (!varrendo) varrendo = setInterval(varrerPresos, 15000); return off; },
  };
  const presos = []; let varrendo = 0;
  function varrerPresos() {
    const agora = Date.now();
    for (let i = presos.length - 1; i >= 0; i--) {
      const p = presos[i];
      if (p.el.isConnected) { p.visto = true; continue; }
      if (p.visto || agora - p.t > 60000) { p.off(); presos.splice(i, 1); } // saiu da tela (ou nunca entrou em 1 minuto)
    }
    if (!presos.length) { clearInterval(varrendo); varrendo = 0; }
  }

  // ---------- log (para o relatório de diagnóstico) ----------
  const linhas = [];
  const guardar = (nivel, args) => {
    const txt = args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'object' ? (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })() : String(a))).join(' ');
    // (0.9.1) quebra de linha vinda de fora (nome, mensagem do servidor) não cria linha falsa no relatório
    linhas.push(`${new Date().toISOString().slice(11, 23)} ${nivel} ${txt.replace(/[\r\n\u2028\u2029]+/g, ' ⏎ ').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')}`.slice(0, 600));
    if (linhas.length > 400) linhas.shift();
  };
  A.log = {
    info: (...a) => { guardar('INFO', a); },
    aviso: (...a) => { guardar('WARN', a); console.warn(...a); },
    erro: (...a) => { guardar('ERRO', a); console.error(...a); },
    linhas: () => linhas.slice(),
  };
  window.addEventListener('error', (e) => { if (!/ResizeObserver loop/.test(e.message || '')) guardar('ERRO', [e.message, `${e.filename || ''}:${e.lineno || ''}`]); }); // (esse aviso é inofensivo)
  window.addEventListener('unhandledrejection', (e) => guardar('ERRO', ['promessa:', e.reason]));

  // ---------- configuração (salva no aparelho) ----------
  const PADRAO = {
    idioma: null, pularSplash: false, visual: null, // visual: 'fancy' | 'lite'
    // (0.8.7) estas eram guardadas mas sumiam ao abrir o app de novo (só fica o que está aqui): integrações instaladas, o aviso da
    // Comunidade, a câmera, a última página das Configurações, quem entra sem pedir, o modo pequeno da chamada, o volume da Música junto,
    // as reações recentes, o tom de pele e o aviso de outras conversas
    integ: {}, integAviso: 0, camera: '', cfgPagina: '', chamLivre: {}, salaLivre: {}, chamPequena: '', musicaVol: 60, reacoesRecentes: [], tomPele: '', avisoConversa: true,
    ultAba: '', chamadaTela: '', chamadaModo: '', chamadaRes: 0, chamadaFps: 0,
    tema: {
      escuro: false, cor: '#2d9ee0', vidro: 72, desfoqueUI: 16, desfoqueFundo: 0, raio: 22, anim: 'total', parallax: true, bolhas: true, barra: 'bolha', doca: 'baixo',
      fundoTipo: 'gradiente', imagem: null, avancado: false, fundoForma: 'linear', fundoAngulo: 160, fundoX: 30, fundoY: 20, fundoCores: ['', '', ''],
      bolhasCor1: '', bolhasCor2: '', bolhasGradiente: true, bolhasAngulo: 135, bolhasImagem: null, bolhasQtd: 12, bolhasTam: 190, bolhasVel: 60,
      bolhasModo: 'subir', bolhasOpac: 100, desfoqueBolhas: 0, destaque: '',
      // (0.8.3) layout: cor e padrão do vidro (como o fundo), cor e texto da HUD, cor do texto, fonte e a moldura líquida das embeds
      vidroTipo: 'auto', vidroCores: ['', '', ''], vidroAngulo: 160, vidroImagem: null, imagemAnim: null, vidroAnim: null, hudCor: '', hudTexto: '', textoCor: '', fonte: 'padrao',
      moldura: true, molduraCor: '',
    },
    som: { ativo: true, volume: 65 },
    digitar: { tema: 'nenhum', volume: 70 }, // (0.8.2) sons de digitação (digitar.js)
    audio: { voz: 100, trans: 100, saida: '', entrada: '', mic: { supressao: true, forca: 60, sens: 50, ganho: 100, eco: true, agc: true }, appsManual: false, appsVol: {}, vozes: {} },
    arranjo: { topo: 'cima', lado: 'esquerda', perfil: 'cima', filtro: 'todas' }, // (0.7.14) arranjo.js
    controles: { layout: 'auto', mapa: {}, zona: 15, cal: {}, sentido: 'horario' },
    discord: { ativo: true, appId: '' },
    ouvir: { ativo: true }, // (1.0.0) "Ouvindo agora": os amigos veem a música que toca neste PC (ouvindo.js)
    gpuModo: 'auto', gpuCache: null,
    host: { sala: '', chave: '', fps: 0, mbps: 0, preset: 'auto', modo: 'tela', audio: true, codec: 'auto', codificador: '', semEco: true, preview: 'auto', incluirApp: false, appsCaptura: [], capturaDireta: true },
    entrada: { cor: '', lockAuto: true, mostrarCursores: true, vigemDispensado: 0, avisosVistos: {} },
    toque: 'classico', // (0.5.9-7) toque de chamada: 'classico' (Vidro, o padrão), 'novo' (Bolhas), 'marimba' ou 'brisa'. Antes não estava aqui e a escolha se perdia
    volMusica: 0.45,
    volMidia: 0.55, // (0.5.9-8) volume dos áudios e vídeos do chat (lembrado) // (0.5.9-7) volume da música dos perfis (antes não estava aqui e se perdia ao fechar o app)
    chamTela: { c: [], f: [], q: [], imagem: null, escuro: 35, bolhas: true, ac: [] }, // (1.0.2) a tela da sua chamada (extras.js): cor, imagem, bolhas e acessórios
    chat: { fonte: 100, foto: 'normal', lado: '' }, // (1.0.2) lado: '' (automático), 'esquerda' ou 'direita' // (0.5.9-6) tamanho das mensagens (%) e das fotos nos chats ('grande', 'normal', 'pequena' ou 'nao')
    atualizar: { auto: true, novidades: false, vista: '' }, // (0.5.9-6) procurar atualização a cada minuto e perguntar antes de instalar; (1.0.0) mostrar as novidades depois de atualizar e a última versão aberta
    introFeita: false,
    // (0.9.7) do Aero Bubble e das skins: também se perdiam ao reiniciar (não estavam aqui)
    iconeApp: '', pacoteSons: '', toqueExtra: '', toquesAmigo: {}, somEntrarOutros: true, skin: '', bolhaArte: null, camAjuste: null, sincronizar: true, sincPartes: {},
  };
  const mesclar = (base, extra) => {
    const out = Array.isArray(base) ? [] : {};
    for (const k of Object.keys(base)) {
      const b = base[k], e = extra && extra[k];
      // objeto vazio no padrão ({} = lista livre, ex.: volume de cada aplicativo): vale o que foi guardado como está (antes era descartado)
      out[k] = b && typeof b === 'object' && !Array.isArray(b) ? (!Object.keys(b).length ? (e && typeof e === 'object' && !Array.isArray(e) ? e : {}) : mesclar(b, e && typeof e === 'object' ? e : {})) : e === undefined ? b : e;
    }
    // (1.0.2) o que foi guardado e não está no padrão continua guardado (antes sumia ao abrir o app de novo: o lado das suas mensagens,
    // o modo do mouse na sala, a atividade de jogo...). Só para objetos comuns; o padrão continua valendo para o que falta
    if (!Array.isArray(base) && extra && typeof extra === 'object' && !Array.isArray(extra)) for (const k of Object.keys(extra)) if (!(k in out) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') out[k] = extra[k];
    return out;
  };
  // token, código de acesso e contas lembradas: no app do Windows ficam cifrados pelo sistema (veja 'cofre-local' em desktop/main.js)
  const SELADAS = new Set(['aero-token', 'aero-acesso', 'aero-contas']);
  const cofre = () => { try { return (typeof window !== 'undefined' && window.aero && window.aero.cofreLocal) || null; } catch (e) { return null; } };
  const ler = (k, padrao = '') => {
    try {
      const v = localStorage.getItem(k) || '';
      if (v.startsWith('ak1:')) { const c = cofre(); return (c && c.abrir(v.slice(4))) || padrao; } // não abriu: fica guardado, só não usa agora
      return v || padrao;
    } catch (e) { return padrao; }
  };
  const gravar = (k, v) => {
    try {
      if (v === null || v === '' || v === undefined) { localStorage.removeItem(k); return true; }
      let s = String(v);
      if (SELADAS.has(k)) { const c = cofre(), f = c && c.fechar(s); if (f) s = 'ak1:' + f; }
      localStorage.setItem(k, s); return true;
    } catch (e) { A.log.aviso('storage cheio', k); return false; }
  };
  A.store = { ler, gravar };
  if (cofre()) for (const k of SELADAS) { const v = ler(k); try { if (v && !localStorage.getItem(k).startsWith('ak1:')) gravar(k, v); } catch (e) { /* ok */ } } // o que já estava aberto passa a ficar cifrado
  // o app está na frente e com foco? (fora disso o controle não comanda nada: nem o menu, nem o jogo do amigo)
  A.focado = () => !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
  // (1.0.2) o Aero está na frente para o VISUAL (animações no ritmo do monitor)? O foco que o navegador informa às vezes vem errado (no
  // Wayland o app em uso aparecia "sem foco" e tudo ficava no ritmo econômico): conta também o evento de foco da janela e quem está
  // mexendo no app agora (mouse, teclado, rodinha nos últimos 10 s). O controle continua usando só A.focado (nunca comanda o jogo errado)
  let focoEvt = null, ultInter = 0, frenteAnt = null, tFrente = 0;
  A.naFrente = () => !document.hidden && (A.focado() || focoEvt === true || performance.now() - ultInter < 10000);
  const verFrente = () => { const f = A.naFrente(); if (f !== frenteAnt) { frenteAnt = f; A.evt.emit('frente', f); } };
  addEventListener('focus', () => { focoEvt = true; verFrente(); });
  addEventListener('blur', () => { focoEvt = false; verFrente(); });
  document.addEventListener('visibilitychange', verFrente);
  const mexeu = () => { const t = performance.now(); if (t - ultInter < 500 && frenteAnt) return; ultInter = t; verFrente(); clearTimeout(tFrente); tFrente = setTimeout(verFrente, 10100); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(ev, mexeu, { capture: true, passive: true });
  let cfgV;
  try {
    const bruto = JSON.parse(ler('aero-cfg', '{}')) || {};
    const t0 = bruto.tema && typeof bruto.tema === 'object' ? bruto.tema : null;
    if (t0) { // formato antigo (v0.3): "desfoque" virou "desfoqueUI" e "fundo" virou "fundoTipo"
      if (t0.desfoque !== undefined && t0.desfoqueUI === undefined) t0.desfoqueUI = t0.desfoque;
      if (t0.fundo === 'imagem' && t0.fundoTipo === undefined) t0.fundoTipo = 'imagem';
    }
    delete bruto.modo; // o "modo de uso" (host/client) foi removido
    cfgV = mesclar(PADRAO, bruto);
    // (0.9.7) o que foi guardado e não está no padrão continua (antes era jogado fora ao abrir o app e a escolha "não salvava")
    for (const k of Object.keys(bruto || {})) if (!(k in cfgV) && bruto[k] !== undefined) cfgV[k] = bruto[k];
  } catch (e) { cfgV = mesclar(PADRAO, {}); }
  A.cfg = {
    get v() { return cfgV; },
    salvar() { return gravar('aero-cfg', JSON.stringify(cfgV)); },
    padrao: () => mesclar(PADRAO, {}),
    restaurarTema() { cfgV.tema = mesclar(PADRAO, {}).tema; this.salvar(); },
  };

  // ---------- idiomas (T('português', 'english')) ----------
  A.idioma = () => cfgV.idioma || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en');
  A.T = (pt, en) => (A.idioma() === 'en' ? en : pt);
  A.setIdioma = (l) => { cfgV.idioma = l; A.cfg.salvar(); document.documentElement.lang = l; A.evt.emit('idioma', l); };

  A.fmtDuracao = (ms) => {
    const s = Math.floor((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
    if (m > 0) return `${m} min`;
    return `${s} s`;
  };

  // ---------- ícones (traço arredondado, estilo vidro) ----------
  const I = {
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>',
    volume1: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    volume0: '<path d="M11 5 6 9H2v6h4l5 4V5z"/>',
    mudo: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    chat: '<path d="M3 7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H9.5L5 17.5V13.4A4 4 0 0 1 3 10z"/><circle cx="18.6" cy="16.6" r="2.6"/><circle cx="20.6" cy="21.4" r="1"/>', // (0.8.7) o do Aero: um balão e as bolhas subindo
    pessoas: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="7.6" r="2.6"/><path d="M17.6 13.2A5 5 0 0 1 21.5 18"/>',
    convidar: '<circle cx="9.5" cy="8" r="3.8"/><path d="M2.5 20.5a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>', // (1.0.2) convidar pessoas: pessoinha com + (o + sozinho é das integrações)
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/><path d="M10.2 6.3a2 2 0 0 1 1.4-.9" opacity=".55"/>',
    tela: '<rect x="2.5" y="3.5" width="19" height="13" rx="3"/><path d="M9 20.5h6M12 16.5v4"/><path d="M6 7.6a2.4 2.4 0 0 1 1.6-1.4" opacity=".55"/>',
    enviarTela: '<rect x="2.5" y="3.5" width="19" height="13" rx="3"/><path d="M9 20.5h6M12 16.5v4"/><path d="M12 13V7.6M9.5 10.1 12 7.6l2.5 2.5"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    micOff: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="m3 3 18 18"/>',
    ajustes: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    expandir: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    enviar: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    fechar: '<path d="M18 6 6 18M6 6l12 12"/>',
    presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    coracao: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/><path d="M5.6 8a2.6 2.6 0 0 1 2-1.8" opacity=".55"/>',
    pix: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="m8 12 4-4 4 4-4 4z"/>',
    cartao: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    cafe: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
    externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    xlogo: '<path d="M4 4l16 16M20 4 4 20" stroke-width="2.4"/>',
    discord: '<path stroke="none" fill="currentColor" d="M5.2 6.6C7.3 5.4 9.6 4.8 12 4.8s4.7.6 6.8 1.8c1.8 2.7 2.7 5.8 2.6 9.3-1.7 1.4-3.6 2.4-5.7 3l-1.2-2c-.8.3-1.6.4-2.5.4s-1.7-.1-2.5-.4l-1.2 2c-2.1-.6-4-1.6-5.7-3-.1-3.5.8-6.6 2.6-9.3z"/><ellipse stroke="none" fill="#5865f2" cx="9" cy="12.4" rx="1.6" ry="1.8"/><ellipse stroke="none" fill="#5865f2" cx="15" cy="12.4" rx="1.6" ry="1.8"/>',
    telefone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    videoOff: '<path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5 0h3a2 2 0 0 1 2 2v3.3l1 1L22 8v8"/><path d="m2 2 20 20"/>',
    minimizar: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
    menos: '<path d="M5 12h14"/>',
    desligarTel: '<path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 4.2 2 2 0 0 1 5.1 2h3a2 2 0 0 1 2 1.7"/><path d="M22 2 2 22"/>',
    video: '<path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
    clipe: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    emoji: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    responder: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    lixo: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    musica: '<path d="M10 18V4.5c2.6.4 4.7 1.8 5.6 4.1"/><circle cx="7" cy="18" r="3"/><circle cx="17.8" cy="14.2" r="1.7"/><circle cx="20.2" cy="10.4" r="1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    grupo: '<circle cx="12" cy="8" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M7 20v-1a5 5 0 0 1 10 0v1"/><path d="M1.5 19v-.5A3.5 3.5 0 0 1 5 15M22.5 19v-.5A3.5 3.5 0 0 0 19 15"/>',
    windows: '<path d="M3 5.5 10.5 4.4v7.1H3zM12 4.2 21 3v8.5h-9zM3 13h7.5v7.1L3 19zM12 13h9v8l-9-1.2z" fill="currentColor" stroke="none"/>',
    linux: '<ellipse stroke="none" fill="#1d2b38" cx="12" cy="14.6" rx="6.2" ry="7"/><circle stroke="none" fill="#1d2b38" cx="12" cy="7.4" r="4.6"/><ellipse stroke="none" fill="#fff" cx="12" cy="15.4" rx="4" ry="5.2"/><circle stroke="none" fill="#fff" cx="10.5" cy="7" r="1.3"/><circle stroke="none" fill="#fff" cx="13.5" cy="7" r="1.3"/><circle stroke="none" fill="#1d2b38" cx="10.7" cy="7.2" r=".6"/><circle stroke="none" fill="#1d2b38" cx="13.3" cy="7.2" r=".6"/><path stroke="none" fill="#f5a623" d="M10.4 9.1h3.2L12 11z"/><ellipse stroke="none" fill="#f5a623" cx="8.6" cy="21.3" rx="2.6" ry="1.1"/><ellipse stroke="none" fill="#f5a623" cx="15.4" cy="21.3" rx="2.6" ry="1.1"/>',
    android: '<path stroke="none" fill="#3ddc84" d="M6 11a6 6 0 0 1 12 0z"/><rect stroke="none" fill="#3ddc84" x="6" y="12" width="12" height="8" rx="2"/><rect stroke="none" fill="#3ddc84" x="3" y="12" width="2.2" height="6" rx="1.1"/><rect stroke="none" fill="#3ddc84" x="18.8" y="12" width="2.2" height="6" rx="1.1"/><circle stroke="none" fill="#fff" cx="9.6" cy="8.4" r=".9"/><circle stroke="none" fill="#fff" cx="14.4" cy="8.4" r=".9"/><path d="M8 5 6.8 3.2M16 5l1.2-1.8" stroke="#3ddc84" stroke-width="1.4"/>',
    arrastar: '<circle cx="9" cy="6" r="1.6" fill="currentColor"/><circle cx="15" cy="6" r="1.6" fill="currentColor"/><circle cx="9" cy="12" r="1.6" fill="currentColor"/><circle cx="15" cy="12" r="1.6" fill="currentColor"/><circle cx="9" cy="18" r="1.6" fill="currentColor"/><circle cx="15" cy="18" r="1.6" fill="currentColor"/>',
    pontos: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    estrela: '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8l-5.3 2.8 1-6-4.4-4.2 6-.9z"/><circle cx="20" cy="3.8" r="1"/><circle cx="4" cy="20" r=".8" fill="currentColor"/>',
    lapis: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    celular: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', // (1.0.2) celular como microfone
    lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M7.6 9a3.2 3.2 0 0 1 2-2" opacity=".55"/>',
    pino: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v8"/>',
    bandeira: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    encaminhar: '<path d="m15 17 5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
    controle: '<path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.3a2.6 2.6 0 0 1-4.4 1L14.6 16H9.4l-1.8 1.7a2.6 2.6 0 0 1-4.4-1l-1-3.3A5 5 0 0 1 7 7z"/><path d="M7.5 10.3v3.4M5.8 12h3.4"/><circle cx="15.8" cy="10.8" r=".9" fill="currentColor"/><circle cx="17.8" cy="13" r=".9" fill="currentColor"/>',
    sol: '<circle cx="12" cy="12" r="4.3"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/><circle cx="5.6" cy="5.6" r=".9" fill="currentColor"/><circle cx="18.4" cy="5.6" r=".9" fill="currentColor"/><circle cx="5.6" cy="18.4" r=".9" fill="currentColor"/><circle cx="18.4" cy="18.4" r=".9" fill="currentColor"/>',
    lua: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z"/><circle cx="17" cy="5.6" r="1.3"/><circle cx="20.3" cy="9" r=".7" fill="currentColor"/>',
    imagem: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    atualizar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    espelhar: '<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>',
    virar: '<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/>',
    girar: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    bolhas: '<circle cx="9" cy="14" r="6"/><circle cx="17.5" cy="7.5" r="3.5"/><circle cx="18" cy="17" r="2"/>',
    jogo: '<path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.3a2.6 2.6 0 0 1-4.4 1L14.6 16H9.4l-1.8 1.7a2.6 2.6 0 0 1-4.4-1l-1-3.3A5 5 0 0 1 7 7z"/><path d="M7.5 10.3v3.4M5.8 12h3.4"/><circle cx="15.8" cy="10.8" r=".9" fill="currentColor"/><circle cx="17.8" cy="13" r=".9" fill="currentColor"/>',
    coroa: '<path d="m2 7 4 5 6-8 6 8 4-5-2 12H4z"/>',
    sinal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4"/>',
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    escudo: '<path d="M12 2.8 19.5 6v5.5c0 4.6-3.2 8-7.5 9.7-4.3-1.7-7.5-5.1-7.5-9.7V6z"/><path d="M8.6 9.4a3.4 3.4 0 0 1 2.4-2.5" opacity=".55"/>',
    casa: '<path d="M4 10.5 12 4l8 6.5V18.5a2.5 2.5 0 0 1-2.5 2.5H15v-5.5H9V21H6.5A2.5 2.5 0 0 1 4 18.5z"/><circle cx="18" cy="4.6" r="1.4"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>', // (1.0.0) entrar em outro aparelho
    play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
    painel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    chevron: '<path d="m18 15-6-6-6 6"/>',
    parar: '<rect width="12" height="12" x="6" y="6" rx="2" fill="currentColor"/>',
    fones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="13.5" width="5" height="7.5" rx="2.5"/><rect x="16.5" y="13.5" width="5" height="7.5" rx="2.5"/>',
    cadeado: '<rect x="4" y="10.5" width="16" height="11" rx="3.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.8" r="1.4"/>',
    seta: '<path d="m6 9 6 6 6-6"/>',
    setaD: '<path d="m9 18 6-6-6-6"/>',
    setaE: '<path d="m15 18-6-6 6-6"/>',
    setaC: '<path d="m18 15-6-6-6 6"/>',
    compacto: '<circle cx="12" cy="10" r="4"/><circle cx="17.5" cy="15.5" r="2.2" fill="currentColor"/><path d="M5 20a7 7 0 0 1 9-4.5"/>',
    voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    cadeadoAberto: '<rect x="4" y="10.5" width="16" height="11" rx="3.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.8-1.3"/><circle cx="12" cy="15.8" r="1.4"/>',
    pip: '<path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/><rect width="10" height="7" x="12" y="13" rx="2"/>',
    cursor: '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
    teclado: '<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
    rato: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',
    apps: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    janela: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4M2 8h20M6 4v4"/>',
    atencao: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    sino: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.8 1.8H4.7z"/><path d="M10 21h4"/><path d="M9.3 9.6a3 3 0 0 1 1.8-1.9" opacity=".55"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    check2: '<path d="m2.5 12.5 4.5 4.5 9.5-9.5"/><path d="m11 16.5.5.5 9.5-9.5"/>',
    zoomMais: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    zoomMenos: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    pausa: '<path d="M8 5v14M16 5v14"/>',
    sinoOff: '<path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M2 2l20 20"/>',
    bloquear: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    gif: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 10H8.5A1.5 1.5 0 0 0 7 11.5v1A1.5 1.5 0 0 0 8.5 14H10v-2M13 10v4M16 14v-4h2.5M16 12h2"/>',
    figurinha: '<path d="M15 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7l8-8V6a3 3 0 0 0-3-3z"/><path d="M13 21v-5a3 3 0 0 1 3-3h5M8.5 10h.01M14.5 10h.01M8.5 14.5s1 1.5 3 1.5"/>',
    lixoBolha: '<circle cx="12" cy="12" r="8"/><path d="M9 9l6 6M15 9l-6 6"/>',
    codigo: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="m13.5 4-3 16"/>',
    pasta: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2.2 2.2h7.2A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    subir: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    descer: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    alfinete: '<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
    marcar: '<path d="M4 12h10M4 6h16M4 18h7M17 15l3 3-3 3"/>',
    alto: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    // (0.8.7) os ícones das abas: desenho próprio do Aero, feitos para ficar dentro dos orbes de vidro (A.orbe)
    oConexoes: '<circle cx="7.2" cy="14.6" r="4.4" fill="currentColor" fill-opacity=".22"/><circle cx="16.6" cy="7.6" r="3.3" fill="currentColor" fill-opacity=".22"/><circle cx="18.2" cy="17.8" r="2"/><path d="M5.1 12.6a2.6 2.6 0 0 1 1.9-1.2M15.2 6.3a1.8 1.8 0 0 1 1.2-.6" stroke-width="1.5"/><path d="M10.8 11.9l2.7-2M11.6 16.2l4.6 1.1" stroke-dasharray=".1 2.7"/>',
    oTalk: '<path d="M9 6.6A3.6 3.6 0 0 1 12.6 3h5A3.4 3.4 0 0 1 21 6.4v2.8a3.4 3.4 0 0 1-3.4 3.4h-.4v2.6l-2.7-2.6" opacity=".72"/><path d="M3 12.8A4.6 4.6 0 0 1 7.6 8.2h2.8a4.6 4.6 0 0 1 0 9.2H8.3L4.6 20.6v-3.9A4.6 4.6 0 0 1 3 12.8z" fill="currentColor" fill-opacity=".24"/><path d="M6.6 12.8h.01M9 12.8h.01M11.4 12.8h.01" stroke-width="2.4"/>',
    oTransmitir: '<rect x="2.5" y="3.8" width="19" height="13.2" rx="3.2" fill="currentColor" fill-opacity=".18"/><path d="M8.4 21h7.2M12 17v4"/><circle cx="12" cy="10.4" r="1.7" fill="currentColor" stroke="none"/><path d="M8.7 7.3a4.5 4.5 0 0 0 0 6.2M15.3 7.3a4.5 4.5 0 0 1 0 6.2"/>',
    oConfig: '<path d="M5.4 18.9A8.6 8.6 0 1 1 18.6 18.9" stroke-dasharray=".1 3.05" stroke-width="2.3"/><circle cx="12" cy="13" r="5" fill="currentColor" fill-opacity=".22"/><path d="M12 13l2.7-2.7"/>',
    oInteg: '<path d="M10 5V4a2 2 0 0 1 4 0v1h3.5A1.5 1.5 0 0 1 19 6.5V10h1a2 2 0 0 1 0 4h-1v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1a2 2 0 0 0-4 0v1H6.5A1.5 1.5 0 0 1 5 17.5V14h1a2 2 0 0 0 0-4H5V6.5A1.5 1.5 0 0 1 6.5 5z" fill="currentColor" fill-opacity=".22"/>', // (0.8.7) Integrações
    oPaleta: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.9-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" fill="currentColor" fill-opacity=".2"/><circle cx="7.6" cy="11" r="1.4" fill="currentColor"/><circle cx="10" cy="7.2" r="1.4" fill="currentColor"/><circle cx="14.6" cy="7.2" r="1.4" fill="currentColor"/>',
    oEscudo: '<path d="M12 2.6 20 6v5.4c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" fill="currentColor" fill-opacity=".2"/><path d="M12 2.6v18.8M4 6l8 5.6L20 6" stroke-width="1.4" opacity=".75"/>',
    // (0.8.0) cheios, para as bolinhas brilhantes (estilo Aero): Spotify, Apple
    livro: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8" opacity=".6"/>', // (0.9.0) livros do Mural
    disco: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5" opacity=".6"/>', // (0.8.7) álbum
    letterboxd: '<circle stroke="none" fill="#ff8000" cx="5.5" cy="12" r="3.6"/><circle stroke="none" fill="#00e054" cx="12" cy="12" r="3.6"/><circle stroke="none" fill="#40bcf4" cx="18.5" cy="12" r="3.6"/>', // (0.8.7) widget do Letterboxd
    spotify: '<circle stroke="none" fill="currentColor" cx="12" cy="12" r="9.5"/><path d="M6.8 9.4c3.6-1.1 7.6-.8 10.6 1M7.4 12.4c2.9-.8 6-.5 8.5.9M8 15.2c2.3-.6 4.6-.4 6.5.7" stroke="#1db954" stroke-width="1.9"/>',
    apple: '<path stroke="none" fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-3.7zM14.2 5.8c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/>',
  };
  A.icone = (nome, tam = 22) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tam); s.setAttribute('height', tam);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ic ic-' + nome); s.innerHTML = I[nome] || ''; // conteúdo fixo do código, nunca de usuários
    return s;
  };
  A.icones = Object.keys(I);
  // (0.8.7) orbe de vidro (estilo Aero) com um ícone dentro; a cor vem do CSS (.orbe-<nome>)
  A.orbe = (nome, tam = 34) => {
    const o = document.createElement('span');
    o.className = 'orbe orbe-' + nome; o.style.setProperty('--ot', tam + 'px'); o.setAttribute('aria-hidden', 'true');
    o.append(A.icone(nome, Math.round(tam * .62)));
    return o;
  };


  // ---------- escolha de codec de vídeo ----------
  // IMPORTANTE: no Chromium, o perfil H.264 "Constrained Baseline" (42e01f) usa o codificador de SOFTWARE (OpenH264)
  // "por razões históricas". Os perfis Main (4d) e High (64) usam o codificador da PLACA DE VÍDEO. Por isso o High vem
  // primeiro: era essa a causa do fps baixo em placas AMD, NVIDIA e Intel (todas caíam em CPU, ~55 Mpixels/s).
  A.codec = {
    ler(c) {
      const mime = c.mimeType, f = c.sdpFmtpLine || '';
      if (mime !== 'video/H264') return { tipo: { 'video/VP8': 'vp8', 'video/VP9': 'vp9', 'video/AV1': 'av1' }[mime] || 'outro' };
      const m = /profile-level-id=([0-9a-f]{6})/i.exec(f);
      const pid = m ? m[1].toLowerCase() : '42001f';
      const perfil = { '42': 'base', '4d': 'main', '58': 'base', '64': 'alto' }[pid.slice(0, 2)] || 'outro';
      return { tipo: 'h264', perfil, nivel: parseInt(pid.slice(4, 6), 16), restrito: (parseInt(pid.slice(2, 4), 16) & 0x0c) === 0x0c, modo1: /packetization-mode=1/.test(f), pid };
    },
    ORDENS: {
      auto: ['alto', 'main', 'base', 'vp8', 'vp9', 'av1'],
      'h264-alto': ['alto', 'main', 'base', 'vp8', 'vp9', 'av1'],
      'h264-main': ['main', 'alto', 'base', 'vp8', 'vp9', 'av1'],
      'h264-base': ['base', 'main', 'alto', 'vp8', 'vp9', 'av1'],
      vp8: ['vp8', 'alto', 'main', 'base', 'vp9', 'av1'],
      vp9: ['vp9', 'alto', 'main', 'base', 'vp8', 'av1'],
    },
    ordenar(codecs, { pref = 'auto' } = {}) {
      const ordem = A.codec.ORDENS[pref] || A.codec.ORDENS.auto;
      const chave = (c) => {
        const d = A.codec.ler(c);
        if (d.tipo === 'outro') return [99, 0];
        if (d.tipo === 'h264') {
          if (d.perfil === 'outro') return [90, 0];
          const r = ordem.indexOf(d.perfil);
          if (!d.modo1) return [80 + r, 0];
          return [r < 0 ? 50 : r, (d.restrito ? 0 : 1000) - d.nivel];
        }
        const r = ordem.indexOf(d.tipo);
        return [r < 0 ? 60 : r, 0];
      };
      return codecs.map((c, i) => [c, i, chave(c)]).sort((a, b) => a[2][0] - b[2][0] || a[2][1] - b[2][1] || a[1] - b[1]).map((x) => x[0]);
    },
    preferir(transceiver, opts) {
      try {
        if (!transceiver.setCodecPreferences || !window.RTCRtpSender || !RTCRtpSender.getCapabilities) return;
        let lista = A.codec.ordenar(RTCRtpSender.getCapabilities('video').codecs, opts);
        if (opts && opts.soH264) { // vídeo vindo do codificador da placa é sempre H.264 (mantém retransmissão/FEC, tira VP8/VP9/AV1)
          const so = lista.filter((c) => { const t = A.codec.ler(c).tipo; return t === 'h264' || t === 'outro'; });
          if (so.some((c) => c.mimeType === 'video/H264')) lista = so;
        }
        if (opts && opts.soBase) { const so = lista.filter((c) => { const d = A.codec.ler(c); return d.tipo === 'outro' || (d.tipo === 'h264' && d.perfil === 'base'); }); if (so.some((c) => c.mimeType === 'video/H264')) lista = so; } // (0.7.10) o H.264 mais simples: quase todo decodificador aceita
        if (opts && opts.semH264) { const sem = lista.filter((c) => A.codec.ler(c).tipo !== 'h264'); if (sem.length) lista = sem; } // (0.7.6) na chamada quem responde também prefere H.264: sai da lista
        transceiver.setCodecPreferences(lista);
      } catch (e) { A.log.aviso('codec', e); }
    },
    // (0.6.9) som com redundância (RED): cada pacote leva também uma cópia do anterior. Se um pacote se perde, o seguinte cobre o buraco na
    // hora (sem esperar reenvio): a voz e o som da tela não somem num tropeço da internet. Quem não suporta, negocia o Opus normal.
    somRobusto(transceiver) {
      try {
        if (!transceiver || !transceiver.setCodecPreferences || !window.RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
        const cs = RTCRtpReceiver.getCapabilities('audio').codecs, red = cs.filter((c) => /audio\/red/i.test(c.mimeType));
        if (!red.length) return;
        transceiver.setCodecPreferences([...red, ...cs.filter((c) => !/audio\/red/i.test(c.mimeType))]);
      } catch (e) { /* navegador sem suporte: fica o Opus normal */ }
    },
  };
})();
