// Aero Stream - partida do app: splash -> introdução -> login -> home -> sala. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, U = A.ui, T = A.T, API = A.api;
  const homeDados = { abrirSala, recarregar, sair, aba: null, convidado: null };
  A.homeDados = homeDados;
  A.loginDados = () => loginDados();

  async function recarregar() { await API.carregarEu(); U.reconstruir(); }

  async function sair() {
    await A.sala.fechar();
    await API.sair();
    homeDados.aba = null;
    U.ir('login', loginDados());
  }

  const loginDados = () => ({ continuar: proximo });

  // ---------- abrir uma sala (como host ou como participante) ----------
  async function abrirSala(d) {
    const S = A.sala, naSala = () => !!(U.telaAtual() && U.telaAtual().nome === 'sala');
    if (S.ativa) {
      if (naSala()) return;
      if (d.sala && d.sala === S.sala) { // a sala já está rodando (janelinha): só volta para ela
        U.pip.esconder();
        await U.ir('sala', {});
        if (d.papel === 'host' && d.iniciar && !S.local.tela) {
          try { await S.compartilhar({ fonteId: d.fonteId, fonte: d.fonte, modo: d.modo, preset: d.preset, audio: d.audio, apps: d.apps }); } catch (e) { if (e.name !== 'NotAllowedError') U.toast(e.message || String(e), { tipo: 'erro' }); }
        }
        return;
      }
      if (!(await U.confirmar(T('Você já está em uma sala. Sair dela para entrar nesta?', 'You are already in a room. Leave it to join this one?'), { sim: T('Trocar de sala', 'Switch room') }))) return;
      U.pip.esconder(); await S.fechar();
    }
    const carregando = U.toast(T('Entrando na sala...', 'Joining the room...'), { ms: 0, som: 'abrir' });
    try {
      if (d.papel === 'host') {
        let cods = { sala: d.sala, chave: d.chave }, tentativas = 0;
        for (;;) {
          try { await A.sala.abrir({ papel: 'host', ...cods }); break; }
          catch (e) { if (e.codigo === 'chave' && !d.retomar && ++tentativas < 4) { cods = A.sala.gerarCodigos(); continue; } throw e; } // código já em uso: sorteia outro
        }
        const c = A.cfg.v.host; c.sala = cods.sala; c.chave = cods.chave; A.cfg.salvar();
        if (d.iniciar) {
          try { await A.sala.compartilhar({ fonteId: d.fonteId, fonte: d.fonte, modo: d.modo, preset: d.preset, audio: d.audio, apps: d.apps }); }
          catch (e) { if (e.name !== 'NotAllowedError') U.toast(e.message || String(e), { tipo: 'erro' }); else U.toast(T('Você não escolheu uma tela. A sala está aberta: use o botão da barra para compartilhar.', 'No screen chosen. The room is open: use the bar button to share.'), { ms: 6000 }); }
        }
      } else await A.sala.abrir({ papel: 'membro', sala: d.sala, nome: d.nome });
      carregando.fechar();
      await U.ir('sala', { mostrarCodigos: d.papel === 'host' && !d.retomar });
    } catch (e) {
      carregando.fechar();
      U.toast(e.message || String(e), { tipo: 'erro', ms: 6000 });
      await A.sala.fechar();
    }
  }

  // ---------- fim da sala: volta para a home ----------
  const voltarHome = () => { const t = U.telaAtual(); if (t && t.nome === 'sala') { if (API.eu) U.ir('home', homeDados); else U.ir('login', loginDados()); } }; // convidado (sem conta) volta para a entrada
  A.evt.on('sala:fechada', () => { if (U.pip && U.pip.visivel) U.toast(T('A sala foi encerrada.', 'The room has ended.'), { som: 'sair', ms: 3000 }); });
  A.evt.on('sala:fechada', voltarHome);
  // transmitindo: o fundo animado (bolhas, aurora) para, caso o Aero apareça na captura (imagem difícil de comprimir)
  // (0.7.10) e assistindo também: num PC fraco a placa divide o tempo entre o desfoque do fundo e o vídeo
  const marcarTransmissao = () => { const on = !!(A.sala && A.sala.ativa && A.sala.local && (A.sala.local.tela || [...A.sala.remotas.values()].some((r) => r.tela))) || !!(A.chamada && A.chamada.compartilhando && A.chamada.compartilhando()) || !!(A.chamada && A.chamada.telaRemota && A.chamada.telaRemota()); document.documentElement.dataset.transmitindo = on ? '1' : '';
    // (0.9.6) quem só ASSISTE uma tela (sem compartilhar a sua): o fundo e os enfeites somem de vez, para o aparelho só receber e mostrar o vídeo
    const vendo = !!(A.sala && A.sala.ativa && A.sala.local && !A.sala.local.tela && [...A.sala.remotas.values()].some((r) => r.tela)) || !!(A.chamada && A.chamada.telaRemota && A.chamada.telaRemota() && !(A.chamada.compartilhando && A.chamada.compartilhando()));
    document.documentElement.dataset.assistindo = vendo ? '1' : ''; };
  // (0.6.9) o app vai fechar ou reiniciar: sai da sala e da chamada DIREITO (avisa o servidor e os outros). Antes a tela de quem compartilhava
  // continuava aparecendo para os outros, e ao voltar para a chamada a pessoa aparecia duas vezes
  let saiu = false;
  const sairDeTudo = () => {
    if (saiu) return; saiu = true;
    try { if (A.chamada && A.chamada.saidaRapida) A.chamada.saidaRapida(); } catch (e) { /* ok */ }
    try { if (A.sala && A.sala.saidaRapida) A.sala.saidaRapida(); } catch (e) { /* ok */ }
  };
  addEventListener('pagehide', sairDeTudo); addEventListener('beforeunload', sairDeTudo);
  // (0.7.1) celular com o teclado aberto: o app cabe só na parte visível da tela. O topo fica parado e só o chat e a barra de escrever
  // sobem (antes o iPhone empurrava a tela inteira para cima e o Android espremia tudo, com as abas em cima do teclado)
  if (window.visualViewport && A.plat.toque) {
    const vv = window.visualViewport, raiz = document.documentElement;
    let cheia = innerHeight;
    const medir = () => {
      const campo = document.activeElement && document.activeElement.matches('input, textarea, [contenteditable="true"]');
      if (!campo) cheia = Math.max(innerHeight, vv.height);
      const aberto = !!campo && cheia - vv.height > 120;
      raiz.toggleAttribute('data-teclado', aberto);
      if (aberto) { raiz.style.setProperty('--vv-h', vv.height + 'px'); raiz.style.setProperty('--vv-top', vv.offsetTop + 'px'); if (scrollY) scrollTo(0, 0); }
      else { raiz.style.removeProperty('--vv-h'); raiz.style.removeProperty('--vv-top'); }
    };
    vv.addEventListener('resize', medir); vv.addEventListener('scroll', medir);
    addEventListener('orientationchange', () => { cheia = 0; setTimeout(medir, 300); });
    document.addEventListener('focusin', () => setTimeout(medir, 50)); document.addEventListener('focusout', () => setTimeout(medir, 50));
  }
  if (window.aero && window.aero.aoSair) window.aero.aoSair(sairDeTudo);
  A.evt.on('sala:local', marcarTransmissao); A.evt.on('sala:fechada', marcarTransmissao); A.evt.on('chamada:tela', marcarTransmissao); A.evt.on('chamada:fim', marcarTransmissao); A.evt.on('sala:stream', marcarTransmissao); A.evt.on('sala:stream-fim', marcarTransmissao); // (0.6.8) compartilhando na chamada também
  A.evt.on('sala:fim', (m) => {
    const txt = { removido: T('Você foi removido da sala.', 'You were removed from the room.'), recusado: T('O host não aceitou sua entrada.', 'The host did not accept your request.'), rede: T('A conexão com a sala caiu.', 'The room connection dropped.'), 'outro-aparelho': T('Você entrou nesta sala por outro aparelho. Só um aparelho por conta fica na sala.', 'You joined this room from another device. Only one device per account stays in the room.') }[m.motivo] || m.msg;
    if (txt) U.toast(txt, { tipo: 'erro', ms: 6000 });
  });

  // ---------- fluxo de abertura ----------
  let euAdiantado = null; // (0.7.9) a conta já é buscada enquanto a abertura toca: ao entrar, a tela inicial aparece sem esperar a internet
  async function proximo() {
    if (!A.cfg.v.introFeita) return U.ir('intro', { continuar: proximo });
    if (!API.token || (A.plat.shell && !API.servidor)) return U.ir('login', loginDados());
    const adiantado = euAdiantado; euAdiantado = null;
    try {
      try { await (adiantado || API.carregarEu()); }
      catch (e) {
        // (0.8.7) sem internet ainda (o celular acabou de ligar, o Wi-Fi está voltando): espera e tenta de novo em vez de cair na tela de
        // entrar com a conta ainda guardada. Até ~40 s; volta antes se a internet voltar
        if (e.status !== 0 && !(e.status >= 500)) throw e;
        let ultimo = e;
        for (let i = 0; i < 8; i++) {
          await new Promise((ok) => { const t = setTimeout(fim, 1500 + i * 1000); function fim() { clearTimeout(t); removeEventListener('online', fim); ok(); } addEventListener('online', fim); });
          try { await API.carregarEu(); ultimo = null; break; } catch (e2) { ultimo = e2; if (e2.status !== 0 && !(e2.status >= 500)) break; }
        }
        if (ultimo) throw ultimo;
      }
    }
    catch (e) {
      // (0.8.6) a sessão guardada venceu (ex.: "Entrar rápido" numa conta salva há tempo, no celular): entra de novo sozinho com o código de
      // acesso guardado neste aparelho, em vez de voltar para a tela de entrar (e ficar nesse vai e volta toda vez que tocava na conta)
      let voltou = false;
      const troca = A.store.ler('aero-troca', ''); A.store.gravar('aero-troca', '');
      if (e.status === 401 && API.codigoAcesso()) {
        try { await API.entrar(API.codigoAcesso()); await API.carregarEu(); API.lembrarConta(); voltou = true; } catch (e2) { A.log.aviso('entrar de novo com a conta salva', String((e2 && e2.message) || e2)); }
      }
      if (!voltou) {
        if (e.status === 401) { API.definirToken(''); if (troca) API.esquecerToken && API.esquecerToken(troca); }
        const t = await U.ir('login', loginDados());
        if (e.status !== 401) U.toast(e.message, { tipo: 'erro' });
        else if (troca) U.toast(T('Essa conta precisa entrar de novo: digite o código de acesso dela.', 'This account needs to sign in again: type its access code.'), { tipo: 'erro', ms: 6000 });
        return t;
      }
    }
    A.hub.conectar();
    if (A.talk) A.talk.iniciar(); // Aero Talk: chaves deste aparelho (ponta a ponta) e a lista de conversas
    if (A.admin && API.eu.avisos) setTimeout(() => A.admin.verAvisos(), 1500); // respostas da equipe que chegaram com o app fechado
    await U.ir('home', homeDados, { zoom: true });
    if (A.legal) setTimeout(() => A.legal.conferir(), 700); // (1.0.2) quem ainda não aceitou os termos de serviço (conta de antes, ou termos novos)
    // (0.9.6) as salas acabaram: compartilhar a tela é só nas chamadas do Aero Talk. Links antigos (?sala=) só somem da barra
    if (new URLSearchParams(location.search).get('sala')) history.replaceState(null, '', location.pathname);
  }

  // Mede os quadros por segundo nos primeiros segundos. Se a versão completa estiver pesada (PC fraco, sem placa
  // de vídeo), oferece a otimizada em vez de deixar o app engasgando.
  // Navegador SEM aceleração de vídeo (Firefox com a opção desligada, máquina virtual, driver genérico): o vidro com desfoque e as bolhas
  // são desenhados pelo processador e cada clique demora (~1 s). Aí o app passa sozinho para a otimizada (uma vez) e avisa.
  const usarOtimizada = (motivo, por = 'fps') => {
    A.cfg.v.visual = 'lite'; A.cfg.salvar(); A.tema.aplicar(); A.store.gravar('aero-auto-lite', por);
    U.toast(motivo, { ms: 9000, acoes: [{ texto: T('Voltar à completa', 'Back to fancy'), tipo: 'sec', onclick: () => { A.cfg.v.visual = 'fancy'; A.cfg.salvar(); A.tema.aplicar(); A.store.gravar('aero-perf-ok', '1'); } }] });
  };
  function vigiarDesempenho() {
    // (0.7.9) a placa voltou: a versão otimizada que entrou por falta dela sai sozinha ('1' é de antes de guardar o motivo)
    const auto = A.store.ler('aero-auto-lite');
    if (A.plat.desktop && A.cfg.v.visual === 'lite' && (auto === 'gpu' || auto === '1') && !A.plat.semAceleracao()) { A.store.gravar('aero-auto-lite', null); A.cfg.v.visual = 'fancy'; A.cfg.salvar(); A.tema.aplicar(); }
    if (A.cfg.v.visual !== 'fancy' || A.store.ler('aero-perf-ok')) return;
    if (!A.store.ler('aero-auto-lite') && A.plat.semAceleracao()) {
      usarOtimizada(T('O seu navegador está sem aceleração de vídeo, então liguei a versão otimizada (mais leve e rápida). Dica: no Firefox, ative "Usar aceleração de hardware quando disponível".', 'Your browser has no hardware acceleration, so I switched to the optimized (lighter, faster) version. Tip: in Firefox, enable "Use hardware acceleration when available".'), 'gpu');
      return;
    }
    let quadros = 0, ini = 0;
    const passo = (t) => {
      if (!ini) ini = t;
      quadros++;
      if (t - ini < 3500) return requestAnimationFrame(passo);
      const fps = (quadros * 1000) / (t - ini);
      A.log.info('desempenho', fps.toFixed(1) + ' fps na abertura');
      if (fps < 18 && !document.hidden && !A.store.ler('aero-auto-lite')) usarOtimizada(T('A versão completa estava travando neste aparelho, então liguei a otimizada (mais leve).', 'The fancy version was stuttering on this device, so I switched to the optimized (lighter) one.'));
      else if (fps < 24 && !document.hidden) {
        U.toast(T('A versão completa está pesada neste aparelho. Trocar para a otimizada (mais leve)?', 'The fancy version is heavy on this device. Switch to the optimized (lighter) one?'), { ms: 0, som: 'abrir',
          acoes: [{ texto: T('Usar otimizada', 'Use optimized'), tipo: 'ok', onclick: () => { A.cfg.v.visual = 'lite'; A.cfg.salvar(); A.tema.aplicar(); } }, { texto: T('Manter', 'Keep'), tipo: 'sec', onclick: () => A.store.gravar('aero-perf-ok', '1') }] });
      } else A.store.gravar('aero-perf-ok', '1');
    };
    setTimeout(() => requestAnimationFrame(passo), 1500);
  }

  async function iniciar() {
    document.documentElement.lang = A.idioma();
    if (!A.cfg.v.visual) A.cfg.v.visual = A.plat.desktop || !(A.plat.celular || A.plat.fraco) ? 'fancy' : null; // null: pergunta na introdução
    A.tema.aplicar();
    A.som.preparar(); // o áudio já fica pronto antes da tela inicial: sem atraso no primeiro som
    U.montarFundo(); U.iniciarPausaFundo(); U.iniciarRelogioAnim(); U.iniciarParallax(); U.iniciarSons(); A.pad.iniciar(); vigiarDesempenho();
    if (A.discord) A.discord.iniciar();
    if (A.sistema) A.sistema.iniciar(); // atualização automática e o bug do kernel das placas AMD Polaris (sistema.js)
    A.pad.conectado() && A.log.info('controle detectado ao abrir');
    if (A.plat.desktop || A.plat.podeCompartilhar) A.gpu.agendar(); // teste da placa: guardado vale na hora; senão, só com o app parado (gpu.js)
    if (A.plat.desktop && window.aero.diagnostico) { // o app do PC avisa se o driver de vídeo falhou e ele mudou de modo sozinho
      window.aero.diagnostico().then((d) => { if (d.avisoGpu) U.toast(d.avisoGpu, { ms: 12000, som: 'erro' }); if (d.gpuModo) A.cfg.v.gpuModo = d.gpuModo; }).catch(() => {});
    }
    // Linux: o app do PC testa sozinho qual combinação faz a placa codificar. Se achou uma melhor que a atual, oferece reiniciar.
    if (A.plat.desktop && window.aero.gpu && window.aero.gpu.aoSonda) {
      window.aero.gpu.aoSonda((d) => {
        if (!d || !d.fim) return;
        A.evt.emit('placa:sonda', d);
        if (d.reiniciar) U.toast(T('Achei o jeito da sua placa de vídeo codificar o vídeo. Reinicie o app para usar.', 'Found how to make your graphics card encode video. Restart the app to use it.'), { tipo: 'ok', ms: 0, acoes: [{ texto: T('Reiniciar agora', 'Restart now'), onclick: () => window.aero.reiniciar() }, { texto: T('Depois', 'Later'), tipo: 'sec' }] });
        else if (!d.melhor) U.toast(T('Testei todas as combinações e o Chromium não conseguiu usar o codificador da sua placa. Abra Configurações > Placa de vídeo e mande o relatório de diagnóstico.', 'Tested every combination and Chromium could not use your GPU encoder. Open Settings > Graphics card and send the diagnostics report.'), { ms: 12000 });
      });
    }
    if (A.cfg.v.pularSplash && A.cfg.v.introFeita) return proximo();
    if (API.token && !(A.plat.shell && !API.servidor)) { euAdiantado = API.carregarEu(); euAdiantado.catch(() => {}); }
    U.ir('splash', { continuar: proximo });
  }

  window.addEventListener('load', () => iniciar().catch((e) => { A.log.erro('iniciar', e); document.body.append(A.h('pre', { class: 'selecionavel', estilo: { position: 'fixed', inset: '10px', 'z-index': 99, background: '#fff', color: '#900', padding: '12px', overflow: 'auto' } }, 'Erro ao iniciar:\n' + (e.stack || e))); }));
  // app do PC: fechar a janela pergunta "fechar para a bandeja" ou "fechar o Aero Stream" (com "lembrar e não perguntar de novo")
  if (window.aero && window.aero.bandeja) window.aero.bandeja.aoPerguntar(() => {
    const h = A.h;
    const lembrar = h('input', { type: 'checkbox' });
    U.modal(T('Fechar o Aero?', 'Close Aero?'), h('div', { class: 'col', estilo: { gap: '12px' } },
      h('p', { estilo: { margin: 0 } }, T('Na bandeja, o Aero continua aberto em segundo plano: chamadas e mensagens continuam chegando.', 'In the tray, Aero stays open in the background: calls and messages keep arriving.')),
      h('label', { class: 'linha', estilo: { gap: '8px' } }, lembrar, T('Lembrar e não perguntar novamente (dá para mudar em Configurações)', 'Remember and do not ask again (change it in Settings)'))),
    { largura: 480, acoes: [{ texto: T('Fechar para a bandeja', 'Close to tray'), tipo: 'sec', valor: 'bandeja' }, { texto: T('Fechar o Aero', 'Quit Aero'), tipo: 'perigo', valor: 'sair' }], aoFechar: (v) => { if (v) window.aero.bandeja.escolher(v, lembrar.checked); } });
  });
  A.iniciar = iniciar; A.proximo = proximo; A.abrirSala = abrirSala;
})();
