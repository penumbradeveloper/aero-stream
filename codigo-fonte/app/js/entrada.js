// Aero Stream - controle remoto (modo jogo). Quem assiste joga na máquina de quem transmite:
//  - CONTROLE: vários controles ao mesmo tempo (jogador 1, 2, 3, 4);
//  - MOUSE e TECLADO: uma pessoa por vez controla o mouse/teclado de verdade; as outras aparecem como CURSORES EMULADOS
//    (coloridos, com nome, só indicam). Quando alguém usa o mouse de verdade, o cursor emulado dele some.
//  - MOUSE COMO NO PARSEC (0.5.9-3): o mouse de quem controla move o cursor DO SISTEMA de quem transmite, na mesma posição da imagem
//    (posição absoluta). Se o dono do PC mexe no mouse dele, o dele tem prioridade e o cursor colorido de quem controla aparece; quando
//    o dono para, o cursor do sistema volta para a posição de quem controla. Jogo com a mira presa (cursor escondido/preso): o mouse de
//    quem controla fica preso na janela e manda movimento relativo (no Windows isso é detectado sozinho; em qualquer um, Ctrl+Shift+M).
// Os eventos vão direto de um computador para o outro (DataChannel, sem passar pelo servidor). A sala (servidor) só decide
// quem pode (pedido, aprovação, pausa). Modo LOCK (cadeado): esconde a interface, bloqueia atalhos e captura mouse/teclado/controle;
// ao sair do lock o controle fica PAUSADO (não desconectado). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h;
  // (0.7.6) de onde vem quem controla quem: a sala (o padrão) ou a chamada do Aero Talk (chamada.js). Os dois falam a mesma língua:
  // id, participantes, participante(id), eu(), meuCtl(), enviarDC(id, msg), pausarControle(), pedirReal(), local { tela, modo, superficie }
  // e os eventos "<prefixo>dc", "ctl", "ctl-meu", "saiu", "input-fim", "local", "fechada"
  let S = A.sala;

  const E = (A.entrada = { lock: false, dono: null, cap: null, cursores: new Map(), slots: [null, null, null, null], meuSlot: new Map(), pos: new Map() });
  const emit = (n, d) => A.evt.emit('entrada:' + n, d);
  const nativo = () => (window.aero && window.aero.entrada) || null;

  // Cor padrão de cada pessoa (se não escolheu): vem do id, sempre vistosa
  E.corDe = (p) => {
    if (p && /^#[0-9a-f]{6}$/i.test(p.cor || '')) return p.cor;
    let x = 0; for (const c of String((p && p.id) || '?')) x = (x * 31 + c.charCodeAt(0)) % 360;
    return A.tema.hsl(x, 80, 55);
  };
  E.CORES = ['#e5473b', '#f0902a', '#e8c21a', '#3fae2a', '#1fb6a6', '#2d7fe0', '#8a63e0', '#e0559c'];

  // =====================================================================================
  // LADO DE QUEM ASSISTE (envia)
  // =====================================================================================
  let escT = 0, escCont = 0, rafMouse = 0, rafPad = 0, dx = 0, dy = 0, ultMv = null, blocoSelStart = 0;
  const padsEnv = new Map(); // indice -> { chave, t }
  const teclasAbertas = new Set(), botoesAbertos = new Set();
  let overlay = null, videoAlvo = null;

  const meu = () => { const c = S.meuCtl(); return c && c.dono ? c : null; };
  const perm = () => (S.eu() || {}).perm || {};
  const env = (obj, rapido) => { if (E.pausaLocal) return; const c = meu(); if (c && c.st === 'ativo') S.enviarDC(c.dono, obj, { rapido }); };
  // PAUSA local (quem controla): clicou na bolha ou em qualquer parte da interface -> o mouse/teclado/controle param de ir para o
  // computador do amigo (e o que estava apertado é solto). Clicar de novo na tela volta.
  E.pausaLocal = false;
  let avisoPausa = null;
  function pausarLocal(on) {
    if (on === E.pausaLocal) return;
    if (on) soltarTudoLocal();
    E.pausaLocal = on;
    if (on) { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } else aplicarImersivo(); // pausado: o teclado volta a ser seu
    teclasDoJogo();
    if (on && !avisoPausa) { avisoPausa = h('div', { class: 'pausa-input', role: 'status' }, '⏸ ', A.T('Controle pausado — clique na tela para voltar', 'Control paused — click the screen to resume')); document.body.append(avisoPausa); }
    if (!on && avisoPausa) { avisoPausa.remove(); avisoPausa = null; }
    emit('pausa', on);
  }
  E.pausarLocal = pausarLocal;
  // (0.7.9) o Esc é do jogo: no app do PC ele nem chega ao Chromium, que soltaria o mouse e sairia da tela cheia (o main.js manda ele para cá)
  const teclasDoJogo = () => { if (window.aero && window.aero.teclasDoJogo) window.aero.teclasDoJogo(!!E.lock && !E.pausaLocal, !!E.lock && !E.pausaLocal && E.imersivo()); }; // (1.0.3) e se o modo imersivo está ligado (KDE: os atalhos do sistema vão para o amigo)
  if (window.aero && window.aero.aoEscDoJogo) window.aero.aoEscDoJogo((baixo) => { if (!E.lock || E.pausaLocal) return; const c = meu(); if (!c || c.st !== 'ativo' || !c.real || !perm().teclado) return; if (baixo) { teclasAbertas.add('Escape'); env({ t: 'kd', c: 'Escape', k: 'Escape' }); } else { teclasAbertas.delete('Escape'); env({ t: 'ku', c: 'Escape' }); } });
  // (0.7.9) Ctrl + Alt + F12 abre a bolha e pausa; Ctrl + Alt + F11 larga o controle na hora. No Linux o sistema pega Ctrl + Alt + F1 a F12 para trocar
  // de terminal e a tecla nem chega aqui: com o Shift junto ele deixa passar
  const LINUX = /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);
  E.atalhoBolha = () => (LINUX ? 'Ctrl + Alt + Shift + F12' : 'Ctrl + Alt + F12');
  E.atalhoFechar = () => (LINUX ? 'Ctrl + Alt + Shift + F11' : 'Ctrl + Alt + F11');
  const comboTecla = (e) => (e.ctrlKey && e.altKey && (e.code === 'F12' || e.code === 'F11') ? e.code : '');
  function fecharInput() { const ctx = E.contexto(); soltarTudoLocal(); if (E.lock) E.sairLock('fechar'); if (ctx && ctx.sairControle) ctx.sairControle(); }
  E.fecharInput = fecharInput;
  // com a bolha aberta o jogo está pausado e o teclado é seu: os mesmos atalhos continuam valendo
  document.addEventListener('keydown', (e) => {
    if (E.lock || e.repeat || !meu()) return;
    const k = comboTecla(e); if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (k === 'F11') fecharInput(); else A.evt.emit('pad:combo-cadeado');
  }, true);

  // (0.7.2) MODO IMERSIVO (como no Parsec): enquanto você está no jogo do amigo, a tecla Super/Windows, Alt+Tab, Alt+F4 e os outros atalhos
  // NÃO agem no seu computador: vão só para o dele. O navegador só deixa segurar esses atalhos em tela cheia, então o modo imersivo põe a
  // tela cheia junto. Pausar (Ctrl+Alt+F12, a bolha ou o combo do controle) devolve o teclado para você
  E.imersivo = () => !!(A.cfg.v.entrada || {}).imersivo;
  E.definirImersivo = (on) => { const c = A.cfg.v.entrada || (A.cfg.v.entrada = {}); c.imersivo = !!on; A.cfg.salvar(); emit('imersivo', !!on); if (!on) soltarImersivo(); teclasDoJogo(); };
  let cheiaPorImersivo = false;
  function aplicarImersivo() {
    if (!E.lock || E.pausaLocal || !E.imersivo() || !navigator.keyboard || !navigator.keyboard.lock) return;
    const travar = () => navigator.keyboard.lock().catch((e) => A.log.aviso('modo imersivo: teclado', e && e.message));
    if (document.fullscreenElement) { travar(); return; }
    const r = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (r && r.then) r.then(() => { cheiaPorImersivo = true; travar(); }, (e) => A.log.aviso('modo imersivo: tela cheia', e && e.message)); else travar();
  }
  function soltarImersivo() {
    if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    if (cheiaPorImersivo && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    cheiaPorImersivo = false;
  }
  E.podeEntrar = () => { const c = meu(); return !!c && c.st !== 'pedindo'; };

  // modo MIRA: o jogo do amigo prendeu o cursor -> o mouse fica preso aqui e vai como movimento relativo; fora dela, posição absoluta
  E.mira = false; let miraManual = null; // null: segue o que o computador do amigo diz; true/false: escolhido com Ctrl+Shift+M
  let miraHost = false;
  // (0.6.0) modo "cursor do host" (padrão): o seu cursor some e o seu mouse move o cursor de quem transmite (movimento relativo, como no
  // Parsec), então os dois nunca ficam em lugares diferentes. Quando quem transmite usa o próprio mouse, o seu cursor reaparece e para de
  // controlar até ele parar. "Livre" é o jeito antigo: o seu cursor aponta direto na tela do amigo.
  E.modoMouse = () => { miraManual = null; aplicarMira(true); if (E.lock) env({ t: 'modo', rel: E.relativo() ? 1 : 0 }); };
  E.relativo = () => ((A.cfg.v.entrada || {}).mouseModo || 'host') === 'host';
  function aplicarMira(silencioso) {
    const on = miraManual === null ? (miraHost || (E.relativo() && !E.hostOcupado)) : miraManual;
    if (on === E.mira) return;
    E.mira = on; emit('mira', on);
    if (!E.lock) return;
    if (on) capturarMouse(); else if (document.pointerLockElement) document.exitPointerLock();
    if (silencioso || (E.relativo() && !miraHost && miraManual === null)) return;
    A.ui.toast(on ? A.T('Mira presa: o mouse fica preso na tela do jogo (Esc solta).', 'Aim lock: the mouse stays locked to the game (Esc releases).') : A.T('Mouse livre: o seu mouse aponta direto na tela do amigo.', 'Free mouse: your mouse points straight at your friend\'s screen.'), { ms: 2500 });
  }

  E.entrarLock = (video) => {
    const c = meu(); if (!c || c.st === 'pedindo') return false;
    if (E.lock) return true;
    videoAlvo = video || videoAlvo;
    E.pausaLocal = false;
    E.lock = true; E.dono = c.dono;
    document.documentElement.dataset.lock = '1';
    if (c.st === 'pausado') S.pausarControle(false); // "retomar"
    const p = perm(); if (p.mouse || p.teclado) S.pedirReal(true);
    document.addEventListener('keydown', aoTecla, true); document.addEventListener('keyup', aoTecla, true);
    document.addEventListener('mousedown', aoBotao, true); document.addEventListener('mouseup', aoBotao, true);
    document.addEventListener('mousemove', aoMouse, true); document.addEventListener('wheel', aoRoda, { capture: true, passive: false });
    document.addEventListener('contextmenu', bloquear, true); document.addEventListener('pointerlockchange', aoPointerLock);
    document.addEventListener('visibilitychange', aoVisibilidade);
    teclasDoJogo();
    saidaHold = 1; // se entrou pelo combo do controle, ele ainda está apertado: só vale para sair depois de soltar
    clearInterval(rafPad); rafPad = setInterval(laco, 4); // (0.7.6) ~250 vezes por segundo, fora do ritmo da tela: num PC fraco com o vídeo pesando, o ritmo da tela caía e o controle atrasava junto
    aplicarMira(true); env({ t: 'modo', rel: E.relativo() ? 1 : 0 });
    if (E.mira) capturarMouse(); // fora da mira (modo livre) o mouse NÃO fica preso: ele aponta direto na tela do amigo (posição absoluta)
    aplicarImersivo(); // (0.7.2) modo imersivo: os atalhos do sistema vão só para o PC do amigo
    emit('lock', true);
    return true;
  };

  E.sairLock = (motivo = '') => {
    if (!E.lock) return;
    E.lock = false; clearTimeout(escT); escT = 0; clearTimeout(voltaTrava); toquePendente = false;
    teclasDoJogo();
    delete document.documentElement.dataset.lock;
    document.removeEventListener('keydown', aoTecla, true); document.removeEventListener('keyup', aoTecla, true);
    document.removeEventListener('mousedown', aoBotao, true); document.removeEventListener('mouseup', aoBotao, true);
    document.removeEventListener('mousemove', aoMouse, true); document.removeEventListener('wheel', aoRoda, true);
    document.removeEventListener('contextmenu', bloquear, true); document.removeEventListener('pointerlockchange', aoPointerLock);
    document.removeEventListener('visibilitychange', aoVisibilidade);
    clearInterval(rafPad); cancelAnimationFrame(rafMouse); rafMouse = 0; dx = dy = 0; ultMv = null;
    soltarTudoLocal();
    if (document.pointerLockElement) document.exitPointerLock();
    soltarImersivo();
    if (meu()) S.pausarControle(true); // PAUSA: o pedido continua valendo, é só voltar ao cadeado
    if (avisoPausa) { avisoPausa.remove(); avisoPausa = null; } E.pausaLocal = false;
    emit('lock', false, motivo);
    A.evt.emit('entrada:lock-fim', motivo);
  };

  // Solta tudo que ficou apertado (tecla, botão do mouse, controles) para nada ficar "preso" no jogo
  function soltarTudoLocal() {
    for (const c of teclasAbertas) env({ t: 'ku', c });
    for (const b of botoesAbertos) env({ t: 'mb', b, d: 0 });
    teclasAbertas.clear(); botoesAbertos.clear();
    env({ t: 'rel' });
    padsEnv.clear();
  }
  const aoVisibilidade = () => { if (document.hidden) soltarTudoLocal(); };

  // (0.7.2) prender o mouse precisa de um clique/tecla AGORA (o navegador recusa depois). Antes o 1º pedido era "sem aceleração", que o
  // Linux não aceita: a recusa chegava atrasada, o 2º pedido já saía sem o clique e também era recusado (o mouse ficava solto na sua tela).
  // Agora o app lembra o que este computador aceita e já pede do jeito certo, dentro do clique
  let semCru = LINUX, pedindoTrava = false; // (1.0.2) o Linux não aceita o "sem aceleração": já pede do jeito que funciona (o 1º pedido não se perde)
  function capturarMouse() {
    if (!perm().mouse || !videoAlvo || !videoAlvo.requestPointerLock || E.mouseCapturado() || pedindoTrava) return;
    const pedir = (cru) => { const r = videoAlvo.requestPointerLock(cru ? { unadjustedMovement: true } : undefined); return r && r.then ? r : Promise.resolve(); };
    pedindoTrava = true;
    let p;
    try { p = pedir(!semCru); } catch (e) { pedindoTrava = false; return; }
    p.then(() => { pedindoTrava = false; }, (e) => {
      pedindoTrava = false;
      if (!semCru && e && e.name === 'NotSupportedError') { semCru = true; try { pedir(false).catch(() => {}); } catch (x) { /* precisa de um clique */ } }
    });
  }
  E.capturarMouse = capturarMouse; // chamado com um clique do usuário (o navegador exige)
  // (0.8.5) o Esc é do jogo e não pausa nada. Onde o app não consegue pegar o Esc antes do Chromium (Wayland, ou no navegador), ele solta o
  // mouse sozinho: aqui o Esc vai para o jogo mesmo assim e o mouse volta a ficar preso logo depois (o Chromium só deixa após ~1,25 s), sem clique
  let voltaTrava = 0, toquePendente = false;
  function aoPointerLock() {
    const preso = document.pointerLockElement === videoAlvo;
    emit('mouse', preso);
    if (preso) { toquePendente = false; return; }
    if (!E.lock || !E.mira || E.pausaLocal || !document.hasFocus()) return;
    const c = meu();
    if (c && c.st === 'ativo' && c.real && perm().teclado && !teclasAbertas.has('Escape')) { env({ t: 'kd', c: 'Escape', k: 'Escape' }); setTimeout(() => env({ t: 'ku', c: 'Escape' }), 40); }
    // (1.0.2) o mouse volta sozinho, sem aviso nem clique: tenta logo que o Chromium deixa (~1,3 s) e mais algumas vezes se não pegar
    clearTimeout(voltaTrava);
    const tentar = (n) => {
      voltaTrava = setTimeout(() => {
        if (!E.lock || !E.mira || E.pausaLocal || E.mouseCapturado() || !document.hasFocus()) return;
        if (window.aero && window.aero.toqueTrava) { toquePendente = true; window.aero.toqueTrava(); } else capturarMouse();
        if (n < 8) tentar(n + 1);
      }, n ? 400 : 1300);
    };
    tentar(0);
  }
  E.mouseCapturado = () => !!videoAlvo && document.pointerLockElement === videoAlvo;

  const bloquear = (e) => { e.preventDefault(); e.stopPropagation(); };

  function aoTecla(e) {
    if (!E.lock) return;
    const baixo = e.type === 'keydown';
    const atalho = comboTecla(e);
    if (atalho) {
      e.preventDefault(); e.stopPropagation();
      if (baixo && !e.repeat) { if (atalho === 'F11') fecharInput(); else { soltarTudoLocal(); emit('bolha'); } }
      return;
    }
    if (E.pausaLocal) return; // pausado: o teclado é da interface (dá para digitar no chat)
    if (e.code === 'F24' && toquePendente) { e.preventDefault(); e.stopPropagation(); if (baixo) capturarMouse(); else toquePendente = false; return; } // o "toque" do app para prender o mouse de novo
    if (e.code === 'KeyM' && e.ctrlKey && e.shiftKey) { // liga/desliga a mira à mão (jogos no Linux, ou se a detecção errar)
      e.preventDefault(); e.stopPropagation();
      if (baixo && !e.repeat) { miraManual = !E.mira; aplicarMira(); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (baixo && E.mira && !E.mouseCapturado()) capturarMouse(); // uma tecla também vale como "clique" para prender o mouse
    if (e.repeat) return;
    const c = meu();
    if (!c || c.st !== 'ativo' || !c.real || !perm().teclado) return;
    if (baixo) { teclasAbertas.add(e.code); env({ t: 'kd', c: e.code, k: e.key }); } else { teclasAbertas.delete(e.code); env({ t: 'ku', c: e.code }); }
  }
  function aoBotao(e) {
    if (!E.lock) return;
    if (!E.mouseCapturado() && !(videoAlvo && videoAlvo.contains(e.target))) { if (e.type === 'mousedown') pausarLocal(true); return; } // clicou na interface: pausa
    e.preventDefault(); e.stopPropagation();
    if (E.pausaLocal) { if (e.type === 'mousedown') pausarLocal(false); return; } // clicou de novo na tela: volta (esse clique não vai para o jogo)
    if (E.mira && !E.mouseCapturado() && e.type === 'mousedown') capturarMouse(); // (1.0.2) na mira, o clique com o mouse solto prende E vai para o jogo (nada fica parado)
    if (!perm().mouse) return;
    const baixo = e.type === 'mousedown';
    if (baixo) botoesAbertos.add(e.button); else botoesAbertos.delete(e.button);
    env({ t: 'mb', b: e.button, d: baixo ? 1 : 0 });
  }
  function aoMouse(e) {
    if (!E.lock || !perm().mouse || E.pausaLocal) return;
    // o deslocamento vai sempre junto: o computador do amigo usa a POSIÇÃO no dia a dia e o DESLOCAMENTO quando um botão está segurado
    // (câmera arrastando com o botão direito, no Roblox) ou quando o jogo prende o mouse (shiftlock, mira): jogos leem movimento relativo
    if (E.mouseCapturado()) { dx += e.movementX || 0; dy += e.movementY || 0; }
    // (0.7.2) na mira com o mouse SOLTO nada vai: antes ia assim mesmo, e o seu cursor andava pela sua tela, batia nos cantos e ia para a
    // sua barra de tarefas enquanto mexia no jogo do amigo. Solto (depois de um Esc), ele volta a ficar preso sozinho logo em seguida
    else if (!E.mira && videoAlvo && videoAlvo.contains(e.target)) {
      const r = conteudoDoVideo(videoAlvo);
      if (r) { const x = A.limitar((e.clientX - r.x) / r.w, 0, 1), y = A.limitar((e.clientY - r.y) / r.h, 0, 1); ultMv = { x, y, dx: (ultMv ? ultMv.dx : 0) + (e.movementX || 0), dy: (ultMv ? ultMv.dy : 0) + (e.movementY || 0) }; }
    }
    if (!rafMouse) rafMouse = requestAnimationFrame(() => {
      rafMouse = 0;
      if (dx || dy) { env({ t: 'mr', dx: Math.round(dx), dy: Math.round(dy) }, true); dx = dy = 0; }
      if (ultMv) { env({ t: 'mv', x: +ultMv.x.toFixed(4), y: +ultMv.y.toFixed(4), dx: Math.round(ultMv.dx), dy: Math.round(ultMv.dy) }, true); ultMv = null; }
    });
  }
  function aoRoda(e) {
    if (!E.lock || E.pausaLocal) return;
    e.preventDefault();
    if (!perm().mouse) return;
    env({ t: 'mw', dx: Math.sign(e.deltaX) * (Math.abs(e.deltaX) > 0), dy: Math.sign(e.deltaY) * (Math.abs(e.deltaY) > 0) });
  }

  // Onde está a imagem de verdade dentro do <video> (object-fit: contain deixa faixas pretas)
  function conteudoDoVideo(v) {
    const r = v.getBoundingClientRect(), vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh || !r.width) return null;
    const esc = Math.min(r.width / vw, r.height / vh), w = vw * esc, hh = vh * esc;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - hh) / 2, w, h: hh };
  }
  E.conteudoDoVideo = conteudoDoVideo;

  // Controles: manda o estado de cada um (só quando muda, mais um "estou aqui" a cada 120 ms)
  let saidaHold = 0; // marca o combo apertado (para não repetir enquanto segura)
  let padSeq = 0; const padSessao = Math.random().toString(36).slice(2, 8); // (o número recomeça se o app reabrir: a sessão diferencia)
  function laco() {
    if (!E.lock) { clearInterval(rafPad); rafPad = 0; return; }
    if (!perm().gamepad) return;
    if (!A.focado() || E.pausaLocal) { if (padsEnv.size) soltarTudoLocal(); return; } // outra janela na frente (ou pausado): o controle não vai para o jogo do amigo
    const c = meu(); if (!c || c.st !== 'ativo') return;
    const agora = performance.now();
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    let comboBolha = false, comboMenu = false;
    for (const g of pads) {
      const n = A.controles.normalizar(g);
      const a = n.a.map((v) => Math.round(v * 127)), lt = Math.round(n.lt * 255), rt = Math.round(n.rt * 255);
      const k = n.b + '|' + a.join(',') + '|' + lt + '|' + rt;
      const ant = padsEnv.get(g.index);
      if (!ant || ant.k !== k || agora - ant.t > 120) {
        const m = { t: 'pad', i: g.index, b: n.b, a, lt, rt, s: ++padSeq, z: padSessao };
        padsEnv.set(g.index, { k, t: agora, b: n.b }); env(m, true);
        // (0.7.6) botão mudou: vai também pelo canal que reenvia o que se perde (o rápido não reenvia: um toque curto podia sumir numa perda de pacote)
        if (ant && ant.b !== n.b) env(m);
      }
      // (0.7.9) START + SELECT + RB: abre a bolha e pausa; START + SELECT + LB: abre os botões da tela e pausa
      if ((n.b & (1 << 8)) && (n.b & (1 << 9))) { if (n.b & (1 << 5)) comboBolha = true; if (n.b & (1 << 4)) comboMenu = true; }
    }
    for (const i of [...padsEnv.keys()]) if (!pads.some((g) => g.index === i)) { padsEnv.delete(i); env({ t: 'padx', i }); }
    if (comboBolha || comboMenu) { if (!saidaHold) { saidaHold = agora; if (comboMenu) E.sairLock('pad'); else { soltarTudoLocal(); emit('bolha'); } } } else saidaHold = 0; // na hora (sem segurar); só vale de novo depois de soltar
  }

  // =====================================================================================
  // LADO DE QUEM TRANSMITE (recebe e aplica)
  // =====================================================================================
  const contagem = new Map(); // viewerId -> { n, t } limite de mensagens por segundo
  const segurando = new Map(); // viewerId -> { teclas:Set, botoes:Set, vivo:t }
  let sujo = false, tickCursor = 0, tickGer = 0, pingN = 0;

  const ehDono = () => !!S.local.tela && S.local.modo === 'jogo';
  const relDe = new Set(); // quem controla no modo "cursor do host" (relativo)
  const preparados = new Set(); // quem já teve o teclado/mouse virtual preparado
  // PRIORIDADE DO HOST: quando a pessoa deste computador mexe no mouse ou no teclado DE VERDADE, quem controla de longe fica em espera
  // (o cursor colorido continua aparecendo, mas nada é injetado; o que ele estava apertando é solto). 1 s parado e o controle volta.
  E.hostAtivo = false;
  let hostAte = 0;
  function avisarHost(on) { for (const q of S.participantes) if (q.id !== S.id && ctlDe(q.id)) S.enviarDC(q.id, { t: 'host', on: on ? 1 : 0 }); emit('host', on); }
  function hostMexeu() {
    hostAte = performance.now() + 1000;
    if (E.hostAtivo) return;
    E.hostAtivo = true; sujo = true; // o cursor colorido de quem controla aparece enquanto o dono usa o mouse dele
    const n = nativo();
    for (const st of segurando.values()) { if (n) { for (const c of st.teclas) n.tecla(c, 0); for (const b of st.botoes) n.botao(b, 0); } st.teclas.clear(); st.botoes.clear(); }
    avisarHost(true);
  }
  E._hostMexeu = hostMexeu; // para os testes
  // o dono parou: o cursor do sistema volta para onde está o mouse de quem controla (fora da mira)
  function hostParou() {
    E.hostAtivo = false; sujo = true; avisarHost(false);
    const n = nativo(); if (!n || !n.mouseAbs || E.miraLocal || !telaInteira()) return;
    for (const [id, p] of E.pos) { const q = ctlDe(id); if (q && q.ctl.real && (q.perm || {}).mouse) { if (!relDe.has(id)) n.mouseAbs(p.x, p.y); break; } }
  }
  E._hostParou = hostParou;
  // Windows: um jogo escondeu/prendeu o cursor -> quem controla passa para a mira (movimento relativo, mouse preso)
  E.miraLocal = false;
  function miraMudou(on) {
    E.miraLocal = !!on;
    for (const q of S.participantes) if (q.id !== S.id && ctlDe(q.id)) S.enviarDC(q.id, { t: 'mira', on: on ? 1 : 0 });
  }
  E._miraMudou = miraMudou;
  // VÁRIAS PESSOAS NO CONTROLE: quem mexeu primeiro enquanto os outros estavam parados manda; os outros esperam até ele ficar 0,7 s
  // parado (o cursor colorido deles continua aparecendo). O dono do PC continua acima de todos (hostAtivo).
  const ARBITRO_MS = 700;
  let quemManda = null; // { id, ate }
  function ganhou(de, st) {
    const agora = performance.now();
    if (quemManda && quemManda.id !== de && agora < quemManda.ate) return false;
    if (quemManda && quemManda.id !== de) { const n = nativo(), ant = segurando.get(quemManda.id); if (n && ant) { for (const c of ant.teclas) n.tecla(c, 0); for (const b of ant.botoes) n.botao(b, 0); ant.teclas.clear(); ant.botoes.clear(); } sujo = true; }
    quemManda = { id: de, ate: agora + ARBITRO_MS }; void st;
    return true;
  }
  E._quemManda = () => quemManda && quemManda.id;
  const ctlDe = (id) => { const p = S.participante(id); return p && p.ctl && p.ctl.dono === S.id && p.ctl.st === 'ativo' ? p : null; };

  E.capacidades = async () => {
    const n = nativo();
    if (!n || !n.disponivel) return { mouse: false, teclado: false, gamepad: false, motivo: A.plat.desktop ? 'indisponivel' : 'navegador' };
    try { return await n.disponivel(); } catch (e) { return { mouse: false, teclado: false, gamepad: false, motivo: 'erro' }; }
  };

  // Avisa quem transmite (uma vez por motivo) quando este computador ainda não consegue receber teclado, mouse ou controle dos amigos,
  // dizendo o que fazer. No navegador não há o que consertar (o site não pode controlar o computador), então ali fica em silêncio.
  const avisados = new Set();
  const COMO_CONSERTAR = {
    'permissao-uinput': ['O Linux não deixa o Aero criar teclado, mouse e controle virtuais. Libere o /dev/uinput (passo a passo no LEIA-ME, "Linux: entrada remota").', 'Linux is not letting Aero create virtual keyboard, mouse and gamepad. Allow /dev/uinput (steps in the README, "Linux: remote input").'],
    'sem-uinput': ['O módulo uinput do Linux não está ativo. Rode "sudo modprobe uinput" (veja o LEIA-ME, "Linux: entrada remota").', 'The Linux uinput module is not loaded. Run "sudo modprobe uinput" (see the README, "Linux: remote input").'],
    python: ['A entrada remota no Linux precisa do Python 3 instalado (sudo apt install python3).', 'Remote input on Linux needs Python 3 installed (sudo apt install python3).'],
    'sem-compilador': ['Não achei o compilador do .NET Framework do Windows, então teclado e mouse remotos ficam desligados. Veja o LEIA-ME.', 'Could not find the Windows .NET Framework compiler, so remote keyboard and mouse are off. See the README.'],
    'gamepad-precisa-vigem': ['Mouse e teclado dos amigos funcionam. Para controles (gamepad) no Windows instale o ViGEmBus e coloque o ViGEmClient.dll na pasta "nativo" (veja o LEIA-ME).', 'Friends\' mouse and keyboard work. For gamepads on Windows install ViGEmBus and put ViGEmClient.dll in the "nativo" folder (see the README).'],
    'sem-vigem-dll': ['O ViGEmBus está instalado, mas falta o arquivo ViGEmClient.dll do app. Baixe o Aero de novo pelo site (o instalador e o portátil já trazem esse arquivo).', 'ViGEmBus is installed, but the app is missing ViGEmClient.dll. Download Aero again from the site (the installer and portable include it).'],
    'vigem-sem-conexao': ['O ViGEmBus está instalado, mas não respondeu. Reinicie o computador uma vez (o Windows termina de ligar o driver) e os controles dos amigos passam a funcionar.', 'ViGEmBus is installed but did not respond. Restart the computer once (Windows finishes enabling the driver) and friends\' gamepads will work.'],
  };
  // (0.8.0) o ViGEmBus é instalado uma vez no sistema: depois de instalado por aqui o app nunca mais oferece instalar
  // (se o Windows ainda não ligou o driver, o caso é "reiniciar o computador", não instalar de novo)
  const vigemJaInstalado = () => { const e = A.cfg.v.entrada; return !!(e && e.vigemInstalado); };
  const podeOferecerVigem = () => { const e = A.cfg.v.entrada || {}; return !e.vigemInstalado && !(e.vigemDispensado && Date.now() - e.vigemDispensado < 30 * 86400000); };
  E.avisarCapacidade = async () => {
    try {
      if (!A.plat.desktop) return null;
      const c = await E.capacidades();
      const motivo = c && c.motivo;
      if (!motivo || avisados.has(motivo)) return c;
      avisados.add(motivo);
      const cfgE = A.cfg.v.entrada || (A.cfg.v.entrada = {});
      // (0.5.9-7) o mesmo aviso não volta a cada transmissão: no máximo uma vez a cada 3 dias (o de instalar continua com o "Agora não" de 30 dias)
      const vistos = cfgE.avisosVistos || (cfgE.avisosVistos = {});
      // (0.7.2) o do ViGEmBus também: antes ele era exceção e voltava toda vez que o app abria (fechar o aviso no X não contava)
      if (vistos[motivo] && Date.now() - vistos[motivo] < (motivo === 'gamepad-precisa-vigem' ? 7 : 3) * 86400000) return c;
      vistos[motivo] = Date.now(); A.cfg.salvar();
      if (motivo === 'gamepad-precisa-vigem' && vigemJaInstalado()) return c; // (0.8.0) já foi instalado por este app: não pede de novo
      if (motivo === 'gamepad-precisa-vigem' && cfgE.vigemDispensado && Date.now() - cfgE.vigemDispensado < 30 * 86400000) return c; // disse "Agora não": não pergunta de novo por 30 dias
      const msg = COMO_CONSERTAR[motivo];
      const n = nativo();
      if (motivo === 'gamepad-precisa-vigem' && n && n.instalarVigem) { // o ViGEmBus vem junto com o app do Windows: um clique instala
        E.oferecerVigem();
      } else if ((motivo === 'permissao-uinput' || motivo === 'sem-uinput') && n && n.liberarUinput) { // (1.0.3) Linux: um clique libera (a senha do sistema)
        E.oferecerUinput();
      } else if (msg) A.ui.toast(A.T(msg[0], msg[1]), { tipo: 'erro', ms: 14000 });
      else if (!c.mouse && !c.teclado && !c.gamepad) A.ui.toast(A.T('Este computador não conseguiu ligar o controle remoto (' + motivo + '). Veja o LEIA-ME ou copie o relatório de diagnóstico.', 'This computer could not enable remote input (' + motivo + '). See the README or copy the diagnostic report.'), { tipo: 'erro', ms: 12000 });
      return c;
    } catch (e) { return null; }
  };

  // (0.7.8) oferece instalar o driver de controles virtuais (também quando um amigo aperta o controle sem ele, e nas Configurações)
  E.instalarVigem = async () => {
    const n = nativo(); if (!n || !n.instalarVigem) return { ok: false };
    A.ui.toast(A.T('Preparando o driver de controles... o Windows vai pedir permissão.', 'Preparing the gamepad driver... Windows will ask for permission.'), { ms: 5000 });
    const r = await n.instalarVigem().catch(() => ({ ok: false }));
    if (r.ok) { const cfgE = A.cfg.v.entrada || (A.cfg.v.entrada = {}); cfgE.vigemInstalado = Date.now(); A.cfg.salvar(); }
    const c = r.ok ? await E.capacidades() : null;
    if (r.ok && c && !c.gamepad) { const m = COMO_CONSERTAR['vigem-sem-conexao']; A.ui.toast(A.T(m[0], m[1]), { ms: 14000 }); }
    else A.ui.toast(r.ok ? A.T('ViGEmBus instalado! Os controles dos amigos já funcionam.', 'ViGEmBus installed! Friends\' gamepads work now.') : A.T('Não consegui instalar o ViGEmBus (' + (r.motivo || r.codigo || '?') + ').', 'Could not install ViGEmBus (' + (r.motivo || r.codigo || '?') + ').'), { tipo: r.ok ? 'ok' : 'erro', ms: 9000 });
    if (r.ok && c) { semPadAvisados.clear(); for (const p of S.participantes) if (p.ctl && p.ctl.dono === S.id && p.ctl.st === 'ativo') S.enviarDC(p.id, { t: 'cap', ...c }); }
    return r;
  };
  // (1.0.3) Linux: em vez de mandar ler o LEIA-ME, o botão libera o /dev/uinput (o sistema pede a senha uma vez) e o controle já passa a valer
  E.liberarUinput = async () => {
    const n = nativo(); if (!n || !n.liberarUinput) return { ok: false };
    const r = await n.liberarUinput().catch(() => ({ ok: false }));
    const c = r.ok ? await E.capacidades() : null, ok = !!(c && (c.mouse || c.teclado));
    if (r.motivo !== 'cancelado') A.ui.toast(ok ? A.T('Pronto! Os amigos já podem controlar o seu computador no modo jogo.', 'Done! Friends can now control your computer in game mode.') : A.T('Não consegui liberar o controle remoto. Reiniciar o computador costuma resolver.', 'Could not enable remote control. Restarting the computer usually fixes it.'), { tipo: ok ? 'ok' : 'erro', ms: 9000 });
    if (ok) { avisados.delete('permissao-uinput'); avisados.delete('sem-uinput'); for (const p of S.participantes) if (p.ctl && p.ctl.dono === S.id && p.ctl.st === 'ativo') S.enviarDC(p.id, { t: 'cap', ...c }); A.evt.emit('entrada:liberada', c); }
    return { ok };
  };
  E.oferecerUinput = () => A.ui.toast(A.T('Para os amigos controlarem o seu computador no modo jogo, o Linux precisa liberar o teclado e o mouse virtuais (pede a sua senha uma vez).', 'For friends to control your computer in game mode, Linux needs to allow the virtual keyboard and mouse (asks for your password once).'), { ms: 0, acoes: [{ texto: A.T('Liberar', 'Allow'), tipo: 'ok', onclick: () => E.liberarUinput() }, { texto: A.T('Agora não', 'Not now'), tipo: 'sec' }] });
  E.oferecerVigem = () => A.ui.toast(A.T('Mouse e teclado dos amigos já funcionam. Para os controles (gamepad) dos amigos, falta instalar o ViGEmBus (o Windows pede permissão uma vez).', 'Friends\' mouse and keyboard already work. For friends\' gamepads, ViGEmBus needs to be installed (Windows asks for permission once).'), { ms: 0, acoes: [{ texto: A.T('Instalar agora', 'Install now'), tipo: 'ok', onclick: () => E.instalarVigem() }, { texto: A.T('Agora não', 'Not now'), tipo: 'sec', onclick: () => { const cfgE = A.cfg.v.entrada; cfgE.vigemDispensado = Date.now(); A.cfg.salvar(); } }] });
  // (0.7.8) o amigo apertou o controle e este PC não tem como criar um controle virtual: antes não acontecia nada, sem aviso para ninguém.
  // Agora os dois ficam sabendo (uma vez por pessoa), mesmo que o aviso já tenha sido dispensado
  const semPadAvisados = new Set();
  async function padSemDriver(de) {
    if (semPadAvisados.has(de)) return; semPadAvisados.add(de);
    const c = await E.capacidades(); if (!c || c.gamepad) return;
    S.enviarDC(de, { t: 'semPad', motivo: c.motivo || '' });
    const msg = COMO_CONSERTAR[c.motivo], n = nativo();
    if (c.motivo === 'gamepad-precisa-vigem' && n && n.instalarVigem) { if (podeOferecerVigem()) E.oferecerVigem(); }
    else if (msg) A.ui.toast(A.T(msg[0], msg[1]), { tipo: 'erro', ms: 14000 });
  }

  function aoDC({ de, dados }) {
    let m; try { m = JSON.parse(dados); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'cur') { aplicarCursores(m.c || []); return; }          // posições dos cursores (vem de quem transmite)
    if (m.t === 'cap') { E.cap = m; emit('cap', m); return; }
    if (m.t === 'semPad') { A.ui.toast(A.T('O seu controle não chegou: o computador de quem transmite ainda não tem o driver de controles. Já pedimos para instalar. O mouse e o teclado funcionam.', 'Your gamepad did not get through: the host\'s computer does not have the gamepad driver yet. We asked them to install it. Mouse and keyboard work.'), { tipo: 'erro', ms: 9000 }); return; }
    if (m.t === 'slot') { emit('slot', m); return; }
    if (m.t === 'hc') { E.cursorHost = { de, x: A.limitar(+m.x || 0, 0, 1), y: A.limitar(+m.y || 0, 0, 1), v: !!m.v, t: performance.now() }; emit('cursores', E.cursores); return; } // o cursor de quem transmite (KDE)
    if (m.t === 'mira') { miraHost = !!m.on; aplicarMira(); return; } // o jogo do amigo prendeu/soltou o cursor
    if (m.t === 'host') { // quem transmite está usando o próprio mouse/teclado: o seu fica em espera (aparece só o seu cursor colorido)
      const on = !!m.on; if (on === !!E.hostOcupado) return; E.hostOcupado = on; emit('host-ocupado', on); aplicarMira(true); // o seu cursor aparece (ou volta a sumir)
      if (on && E.lock && Date.now() - (E._avisoHost || 0) > 8000) { E._avisoHost = Date.now(); A.ui.toast(A.T('Quem transmite está usando o mouse e o teclado agora: o seu controle volta assim que ele parar.', 'The host is using their mouse and keyboard now: your control comes back as soon as they stop.'), { ms: 3000 }); }
      return;
    }
    if (!ehDono()) return;
    const p = ctlDe(de); if (!p) return;
    // proteção: no máximo 800 mensagens por segundo de cada pessoa
    const agora = performance.now(), ct = contagem.get(de) || { n: 0, t: agora };
    if (agora - ct.t > 1000) { ct.n = 0; ct.t = agora; }
    if (++ct.n > 800) { contagem.set(de, ct); return; }
    contagem.set(de, ct);
    const st = segurando.get(de) || { teclas: new Set(), botoes: new Set(), vivo: agora };
    st.vivo = agora; segurando.set(de, st);
    const pr = p.perm || {}, n = nativo();
    const ehEntrada = /^(mr|mv|mb|mw|kd|ku)$/.test(m.t);
    const real = !!p.ctl.real && !E.hostAtivo && (!ehEntrada || ganhou(de, st)); // o host tem prioridade; entre os amigos, quem mexeu primeiro
    if (real && n && n.preparar && !preparados.has(de)) { preparados.add(de); n.preparar(); }
    switch (m.t) {
      case 'pad': if (pr.gamepad) aplicarPad(de, m); if (n && n.instalarVigem) padSemDriver(de); break;
      case 'padx': liberarPad(de, m.i); break;
      case 'rel': soltarTudo(de); break;
      case 'modo': if (m.rel) relDe.add(de); else relDe.delete(de); break; // (0.6.0) move o cursor daqui (relativo): nunca puxar o cursor para a posição dele
      // como o Parsec: quem está com o mouse de verdade mexe o cursor do computador, e TODO MUNDO vê esse cursor desenhado com a cor e o
      // nome da pessoa (no Wayland a captura nem traz o cursor do sistema). Os outros aparecem só como cursores que indicam.
      case 'mr': if (!pr.mouse) break; if (real && n) n.mouseRel(+m.dx || 0, +m.dy || 0); moverCursor(de, { dx: +m.dx || 0, dy: +m.dy || 0 }); break;
      case 'mv': {
        if (!pr.mouse) break;
        // botão segurado (arrastar a câmera) ou jogo com o mouse preso: o jogo precisa de movimento RELATIVO; no resto, a posição exata
        const relativo = E.miraLocal || st.botoes.size > 0 || !telaInteira();
        if (real && n) { if (relativo) { if ((m.dx | 0) || (m.dy | 0)) n.mouseRel(A.limitar(m.dx | 0, -2000, 2000), A.limitar(m.dy | 0, -2000, 2000)); } else if (n.mouseAbs) n.mouseAbs(A.limitar(m.x, 0, 1), A.limitar(m.y, 0, 1)); }
        moverCursor(de, { x: A.limitar(m.x, 0, 1), y: A.limitar(m.y, 0, 1) });
        break;
      }
      case 'mb': {
        if (!pr.mouse) break;
        const b = A.limitar(m.b | 0, 0, 4);
        if (real && n) {
          if (m.d) st.botoes.add(b); else st.botoes.delete(b);
          n.botao(b, m.d ? 1 : 0);
          if (!m.d && !st.botoes.size && !E.miraLocal && !relDe.has(de) && telaInteira() && n.mouseAbs) { const p0 = E.pos.get(de); if (p0) n.mouseAbs(p0.x, p0.y); } // soltou: o cursor volta ao lugar exato
        }
        if (m.d) pingCursor(de); // o clique aparece para todos (uma onda no cursor)
        break;
      }
      case 'mw': if (pr.mouse && real && n) n.roda(m.dx | 0, m.dy | 0); break;
      case 'kd': case 'ku': {
        if (!pr.teclado || !real || !n || typeof m.c !== 'string' || m.c.length > 24) break;
        if (m.t === 'kd') st.teclas.add(m.c); else st.teclas.delete(m.c);
        n.tecla(m.c, m.t === 'kd' ? 1 : 0);
        break;
      }
      default: break;
    }
  }

  // ----- controles virtuais (jogador 1 a 4) -----
  const padUlt = new Map(); // de|i -> último número aplicado (a mesma mensagem chega pelos dois canais; a mais velha não desfaz a nova)
  function aplicarPad(de, m) {
    const i = m.i | 0;
    if (typeof m.s === 'number') { const k = de + '|' + i, u = padUlt.get(k); if (u && u.z === m.z && m.s <= u.s) return; padUlt.set(k, { s: m.s, z: m.z }); }
    let slot = E.slots.findIndex((s) => s && s.de === de && s.i === i);
    // (0.7.4) o controle da pessoa voltou (outro número no Windows depois de desligar/religar, ou depois de ficar parado): usa o MESMO
    // controle virtual que já estava com ela, que o jogo ainda conhece
    if (slot < 0) { slot = E.slots.findIndex((s) => s && s.de === de && s.solto); if (slot >= 0) { E.slots[slot].i = i; S.enviarDC(de, { t: 'slot', i, slot }); } }
    if (slot < 0) {
      slot = E.slots.findIndex((s) => !s);
      if (slot < 0) return; // já tem 4 jogadores
      E.slots[slot] = { de, i, t: performance.now() };
      S.enviarDC(de, { t: 'slot', i, slot });
      emit('slots', E.slots);
    }
    E.slots[slot].t = performance.now(); E.slots[slot].solto = false;
    const n = nativo();
    if (n && n.pad) n.pad(slot, { b: m.b | 0, a: (m.a || []).slice(0, 4).map((v) => A.limitar(v | 0, -127, 127)), lt: A.limitar(m.lt | 0, 0, 255), rt: A.limitar(m.rt | 0, 0, 255) });
  }
  // (0.7.4) parado, janela sem foco, pausa, controle desligado: o controle virtual NÃO some, só fica solto (nada apertado). Antes ele era
  // removido do sistema depois de 5 s sem mexer (ou ao trocar de janela): o jogo perdia o controle e só voltava saindo e entrando na sala.
  // Ele só é removido de verdade quando a pessoa sai, perde a permissão ou a transmissão acaba
  function liberarPad(de, i, remover) {
    const slot = E.slots.findIndex((s) => s && s.de === de && s.i === (i | 0));
    if (slot < 0) return;
    const n = nativo();
    if (remover) { E.slots[slot] = null; if (n && n.padSair) n.padSair(slot); else if (n && n.pad) n.pad(slot, { b: 0, a: [0, 0, 0, 0], lt: 0, rt: 0 }); emit('slots', E.slots); return; }
    if (E.slots[slot].solto) return;
    E.slots[slot].solto = true;
    if (n && n.pad) n.pad(slot, { b: 0, a: [0, 0, 0, 0], lt: 0, rt: 0 });
  }

  // Solta tudo de uma pessoa (pausou, saiu, perdeu a permissão, o canal caiu)
  function soltarTudo(de, remover) {
    const n = nativo(), st = segurando.get(de);
    if (st && n) { for (const c of st.teclas) n.tecla(c, 0); for (const b of st.botoes) n.botao(b, 0); }
    segurando.delete(de);
    if (remover) for (const k of [...padUlt.keys()]) if (k.startsWith(de + '|')) padUlt.delete(k);
    E.slots.forEach((s, i) => { if (s && s.de === de) liberarPad(de, s.i, remover); });
    if (E.pos.delete(de)) { sujo = true; }
  }
  E.soltarTudo = soltarTudo;

  // a posição absoluta só vale para a tela inteira (numa janela o ponto do vídeo não é o ponto da tela). Sem saber (portal do Wayland), é a tela.
  const telaInteira = () => !['window', 'browser'].includes(S.local.superficie || '');

  // ----- cursores desenhados (o de quem controla e os que só indicam) -----
  function moverCursor(de, d) {
    const cfg = A.cfg.v.entrada; const pr = ctlDe(de);
    if (cfg.mostrarCursores === false && !(pr && pr.ctl.real)) return; // o de quem está no controle aparece sempre
    const p = E.pos.get(de) || { x: 0.5, y: 0.5, ping: 0 };
    const vt = S.local.tela && S.local.tela.getVideoTracks()[0], set = (vt && vt.getSettings()) || {};
    const W = set.width || 1920, H = set.height || 1080;
    if ('x' in d) { p.x = d.x; p.y = d.y; } else { p.x = A.limitar(p.x + d.dx / W, 0, 1); p.y = A.limitar(p.y + d.dy / H, 0, 1); }
    E.pos.set(de, p); sujo = true;
  }
  function pingCursor(de) { const p = E.pos.get(de); if (p) { p.ping = ++pingN; sujo = true; } }

  function difundirCursores() {
    if (!sujo) return; sujo = false;
    // todos com permissão de mouse aparecem; o 5º valor diz se é quem está com o mouse de verdade (desenhado mais forte)
    // o de quem está com o mouse de verdade só aparece quando o dono está usando o mouse dele (fora disso, o cursor do sistema é o dele)
    const lista = [];
    const todos = [];
    for (const [id, p] of E.pos) { const pr = ctlDe(id); if (!pr || !(pr.perm || {}).mouse) continue; const item = [id, +p.x.toFixed(4), +p.y.toFixed(4), p.ping || 0, pr.ctl.real ? 1 : 0]; todos.push(item); if (pr.ctl.real && !E.hostAtivo && quemManda && quemManda.id === id && performance.now() < quemManda.ate + 4000) continue; lista.push(item); }
    const msg = { t: 'cur', c: lista };
    // na tela de quem transmite, os mesmos cursores aparecem POR CIMA de tudo (fora do Aero), no computador inteiro
    const glob = window.aero && window.aero.cursoresGlobais;
    if (glob && ehDono()) {
      // no computador de quem transmite: o cursor de TODO MUNDO, por cima de tudo (até com o Aero minimizado)
      // (1.0.4) quem está com o mouse de verdade É o cursor do sistema: o colorido dele só aparece quando o dono mexe no próprio mouse (antes
      // ficava sempre por cima do cursor de verdade, e parecia que o cursor de quem controla mandava mais que o do dono)
      const l = todos.filter(([id, , , , real]) => !(real && !E.hostAtivo && (!quemManda || quemManda.id === id))).map(([id, x, y, ping]) => { const q = S.participante(id); return q ? { id, x, y, ping, cor: E.corDe(q), nome: q.nome } : null; }).filter(Boolean);
      const k = JSON.stringify(l); if (k !== E._globAnt) { E._globAnt = k; glob(l).catch(() => {}); }
    }
    S.participantes.forEach((q) => { if (q.id !== S.id) S.enviarDC(q.id, msg, { rapido: true }); });
    aplicarCursores(lista, true);
  }

  // ----- desenho dos cursores (todos veem) -----
  function aplicarCursores(lista, local) {
    const novo = new Map();
    for (const [id, x, y, ping, real] of lista) novo.set(id, { x, y, ping, real: !!real });
    for (const [id, c] of novo) { const a = E.cursores.get(id); c.pingVisto = a ? a.pingVisto : 0; }
    E.cursores = novo;
    emit('cursores', novo);
  }

  // Camada de cursores sobre um <video>: devolve { el, desenhar }. O dono do vídeo chama desenhar() quando algo muda.
  E.camada = (video) => {
    const el = h('div', { class: 'cursores', 'aria-hidden': 'true' });
    const nos = new Map();
    let noHost = null;
    const desenhar = () => {
      const r = conteudoDoVideo(video), caixa = video.getBoundingClientRect();
      const hc = E.cursorHost && E.cursorHost.v && performance.now() - E.cursorHost.t < 15000 ? E.cursorHost : null;
      if (!r || (!E.cursores.size && !hc)) { for (const [id, n] of nos) { n.remove(); nos.delete(id); } if (noHost) { noHost.remove(); noHost = null; } return; }
      // o cursor de quem transmite (a seta branca de sempre), quando a captura não traz o cursor
      if (hc) {
        if (!noHost) { noHost = h('div', { class: 'cursor cursor-host' }); noHost.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 2.6c-.5-.4-1.2 0-1.2.6v16.6c0 .7.8 1 1.3.5l4.1-4.1 2.9 6.6c.2.4.7.6 1.1.4l2.4-1.1c.4-.2.6-.7.4-1.1l-2.9-6.5 5.7-.4c.7 0 1-.9.4-1.3z"/></svg>'; el.append(noHost); }
        noHost.style.left = (hc.x * 100).toFixed(2) + '%'; noHost.style.top = (hc.y * 100).toFixed(2) + '%';
      } else if (noHost) { noHost.remove(); noHost = null; }
      el.style.left = r.x - caixa.left + 'px'; el.style.top = r.y - caixa.top + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
      for (const [id, n] of nos) if (!E.cursores.has(id)) { n.remove(); nos.delete(id); }
      for (const [id, c] of E.cursores) {
        const p = S.participante(id); if (!p) continue;
        let n = nos.get(id);
        if (!n) {
          n = h('div', { class: 'cursor' }); n.seta = h('i'); n.nome = h('span'); n.append(n.seta, n.nome); el.append(n); nos.set(id, n);
          // seta arredondada, com contorno branco e sombra, na cor da pessoa
          n.seta.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 2.6c-.5-.4-1.2 0-1.2.6v16.6c0 .7.8 1 1.3.5l4.1-4.1 2.9 6.6c.2.4.7.6 1.1.4l2.4-1.1c.4-.2.6-.7.4-1.1l-2.9-6.5 5.7-.4c.7 0 1-.9.4-1.3z"/></svg>';
        }
        n.style.setProperty('--c', E.corDe(p)); n.nome.textContent = p.nome; n.classList.toggle('real', !!c.real); // quem está no controle: cursor mais forte
        n.style.left = (c.x * 100).toFixed(2) + '%'; n.style.top = (c.y * 100).toFixed(2) + '%';
        if (c.ping && c.ping !== c.pingVisto) { c.pingVisto = c.ping; n.classList.remove('clique'); void n.offsetWidth; n.classList.add('clique'); }
      }
    };
    const off = A.evt.on('entrada:cursores', desenhar);
    return { el, desenhar, limpar: off };
  };

  // =====================================================================================
  // vida da sala: liga/desliga tudo
  // =====================================================================================
  const off = [];
  const pre = () => S.prefixo || 'sala:';
  function zerar() { if (E.lock) E.sairLock('sala'); E.pos.clear(); E.cursores = new Map(); E.cursorHost = null; E.slots = [null, null, null, null]; miraHost = false; miraManual = null; E.mira = false; }
  E.contexto = () => S;
  E.usar = (ctx) => {
    const novo = ctx || A.sala; if (novo === S) return;
    for (const id of new Set([...segurando.keys(), ...E.slots.filter(Boolean).map((x) => x.de)])) soltarTudo(id, true);
    zerar(); E.parar(); relDe.clear(); preparados.clear(); contagem.clear();
    S = novo; E.iniciar(); emit('estado');
  };
  E.iniciar = () => {
    const P = pre();
    off.push(A.evt.on(P + 'dc', aoDC));
    const nat = nativo(); if (nat && nat.aoHost) off.push(nat.aoHost(hostMexeu));
    if (nat && nat.aoMira) off.push(nat.aoMira(miraMudou));
    // KDE (Wayland): a captura não leva o cursor; o app do PC conta onde ele está e todo mundo que assiste desenha por cima do vídeo
    if (nat && nat.aoCursorHost) off.push(nat.aoCursorHost((c) => {
      if (!ehDono()) return;
      const msg = { t: 'hc', x: +c.x.toFixed(4), y: +c.y.toFixed(4), v: c.dentro ? 1 : 0 };
      for (const q of S.participantes) if (q.id !== S.id) S.enviarDC(q.id, msg, { rapido: true });
    }));
    // anuncia o que este computador consegue fazer assim que alguém vira controlador
    off.push(A.evt.on(P + 'ctl', async ({ p, antes, depois }) => {
      if (!ehDono()) return;
      if (depois && depois.dono === S.id && depois.st === 'ativo') { const c = await E.capacidades(); S.enviarDC(p.id, { t: 'cap', ...c }); if (E.miraLocal) S.enviarDC(p.id, { t: 'mira', on: 1 }); }
      // perdeu o controle: solta tudo, mas o controle virtual dela fica (só sai quando ela sai da sala). A transmissão reiniciada devolve o
      // controle sozinha, e o jogo continua vendo o MESMO controle (um novo, o jogo aberto não reconhece)
      if (!depois || (depois.st !== 'ativo' && depois.st !== 'pausado')) soltarTudo(p.id);
      else if (depois.st !== 'ativo' || (antes && antes.real && !depois.real)) soltarTudo(p.id);
    }));
    off.push(A.evt.on(P + 'saiu', (p) => { soltarTudo(p.id, true); relDe.delete(p.id); }));
    off.push(A.evt.on(P + 'input-fim', () => { if (E.lock) E.sairLock('fim'); }));
    off.push(A.evt.on(P + 'ctl-meu', ({ depois }) => {
      if (!depois && E.lock) E.sairLock('fim');
      // (0.7.8) jogando, mas a sala diz outra coisa (o "retomar" se perdeu numa queda): sem isto a tela continuava e nada chegava ao jogo
      if (depois && E.lock && depois.st === 'pausado') S.pausarControle(false);
      else if (depois && E.lock && depois.st === 'ativo' && !depois.real && (perm().mouse || perm().teclado)) S.pedirReal(true);
      emit('estado');
    }));
    // (0.7.6) a transmissão parou ou foi reiniciada (ex.: trocou a resolução): SOLTA os controles virtuais, mas não os remove. Removidos, o
    // controle de quem joga voltava como um aparelho NOVO, que o jogo aberto não reconhecia (o teclado continuava, o controle parava)
    off.push(A.evt.on(P + 'local', (d) => { if (d.tela === false) { for (const id of new Set([...segurando.keys(), ...E.slots.filter(Boolean).map((x) => x.de)])) soltarTudo(id); E.pos.clear(); if (window.aero && window.aero.cursoresGlobais && E._globAnt !== '[]') { E._globAnt = '[]'; window.aero.cursoresGlobais([]).catch(() => {}); } } }));
    off.push(A.evt.on(P + 'fechada', zerar));
    // (0.8.3) 30 vezes por segundo só com alguém na sala (ou algo apertado / o mouse do host em uso); fora disso, 2 vezes por segundo (antes
    // acordava 30 vezes por segundo o tempo todo, mesmo sem sala)
    clearTimeout(tickCursor); const ger = ++tickGer;
    const tick = () => {
      if (ger !== tickGer) return;
      difundirCursores();
      const agora = performance.now();
      if (E.hostAtivo && agora > hostAte) hostParou(); // (antes num relógio próprio de 200 ms)
      // rede de segurança: ninguém falou em 6 s e ainda tem algo apertado -> solta
      for (const [id, st] of segurando) if (agora - st.vivo > 6000 && (st.teclas.size || st.botoes.size)) soltarTudo(id);
      E.slots.forEach((s) => { if (s && agora - s.t > 5000) liberarPad(s.de, s.i); });
      const ativo = E.hostAtivo || sujo || segurando.size || E.pos.size || E.slots.some(Boolean) || (S.participantes && S.participantes.length > 1);
      if (ger === tickGer) tickCursor = setTimeout(tick, ativo ? 33 : 500);
    };
    tickCursor = setTimeout(tick, 33);
  };
  E.parar = () => { off.splice(0).forEach((f) => f()); clearTimeout(tickCursor); tickCursor = 0; tickGer++; };
  E.iniciar();
})();
