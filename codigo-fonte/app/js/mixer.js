// Aero Stream - painéis que abrem na seta de cada botão da barra da sala: SOM (saída, volume geral, vozes, transmissões e o volume
// de cada aplicativo), MICROFONE (dispositivo, supressão de ruído, sensibilidade, volume, medidor) e COMPARTILHAR (trocar de tela,
// modo, som, aplicativos com som, qualidade ao vivo e opções avançadas). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T, S = A.sala;
  const M = (A.mixer = {});

  const titulo = (txt, desc) => h('div', { class: 'pop-sec' }, h('b', {}, txt), desc ? h('span', { class: 'peq suave' }, desc) : null);
  const nota = (txt) => h('div', { class: 'peq suave pop-nota' }, txt);
  const linhaOpc = (rot, controle, desc) => h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, rot), desc ? h('div', { class: 'peq suave' }, desc) : null), controle);
  function deslizante(rot, { min = 0, max = 100, valor, fmt = (x) => x + '%', aoMudar, desc }) {
    const v = h('b', {}, fmt(valor));
    const s = U.slider({ min, max, valor, oninput: (x) => { v.textContent = fmt(x); aoMudar(x); } });
    const c = h('div', { class: 'desliz' }, h('div', { class: 'linha entre' }, h('span', {}, rot), v), s, desc ? h('div', { class: 'peq suave' }, desc) : null);
    c.slider = s; c.rotulo = v; c.fmt = fmt;
    c.definir = (x) => { s.atualizar(x); v.textContent = fmt(x); };
    return c;
  }
  const selectDe = (opcoes, valor, aoMudar, rot) => {
    const s = h('select', { class: 'campo', 'aria-label': rot }, opcoes.map(([v, r]) => h('option', { value: v }, r)));
    s.value = valor; if (s.value !== valor && opcoes.length) s.value = opcoes[0][0];
    s.addEventListener('change', () => aoMudar(s.value));
    return s;
  };
  const rotuloDisp = (d, i, padrao) => d.label || `${padrao} ${i + 1}`;

  // ===========================================================================================
  // SOM: saída + volumes + aplicativos
  // ===========================================================================================
  M.audio = (ancora) => {
    const cfg = A.cfg.v.audio;
    const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
    let vivo = true, timer = 0;

    // --- saída ---
    const selSaida = h('select', { class: 'campo', 'aria-label': T('Saída de som', 'Sound output') });
    const boxSaida = h('div', { class: 'col', estilo: { gap: '6px' } }, titulo(T('Saída de som', 'Sound output')), selSaida);
    if (!S.saidaSuportada()) { selSaida.hidden = true; boxSaida.append(nota(T('Este navegador não deixa o site escolher a saída. Troque pelo menu do sistema.', 'This browser does not let a site pick the output. Change it in the system menu.'))); }
    else {
      A.mic.dispositivos().then(({ saidas }) => {
        if (!vivo) return;
        selSaida.append(h('option', { value: '' }, T('Padrão do sistema', 'System default')), ...saidas.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => h('option', { value: d.deviceId }, rotuloDisp(d, i, T('Saída', 'Output')))));
        selSaida.value = cfg.saida || ''; if (selSaida.value !== (cfg.saida || '')) selSaida.value = '';
      });
      selSaida.addEventListener('change', async () => {
        try { await S.definirSaida(selSaida.value); A.som.tocar('click'); } catch (e) { U.toast(T('Não consegui usar essa saída.', 'Could not use that output.'), { tipo: 'erro' }); selSaida.value = ''; }
      });
    }

    // --- volumes ---
    const geral = deslizante(T('Volume geral', 'Master volume'), { valor: Math.round(S.volume * 100), aoMudar: (x) => { S.definirVolume(x / 100); S.reativarAudio(); A.evt.emit('mixer:volume'); } });
    const voz = deslizante(T('Vozes dos amigos', 'Friends\' voices'), { max: 200, valor: cfg.voz, aoMudar: (x) => S.definirVolumeVoz(x), desc: T('Só o microfone das pessoas.', 'Only people\'s microphones.') });
    const trans = deslizante(T('Som das transmissões', 'Stream sound'), { max: 200, valor: cfg.trans, aoMudar: (x) => S.definirVolumeTrans(x), desc: T('Jogos, vídeos e músicas compartilhados.', 'Shared games, videos and music.') });

    // --- aplicativos (só no app do PC) ---
    const appsBox = h('div', { class: 'col', estilo: { gap: '8px' } }), lista = h('div', { class: 'apps-lista' });
    const linhas = new Map();
    const manual = U.chave(cfg.appsManual, (v) => { cfg.appsManual = v; A.cfg.salvar(); lista.classList.toggle('desativada', !v); linhas.forEach((l) => { l.slider.disabled = !v; }); if (v) atualizarApps(true); });
    const cabApps = h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Volume de aplicativos manuais', 'Manual app volumes')), h('div', { class: 'peq suave' }, T('Deixa você ajustar cada aplicativo daqui. Desligado, o Aero não mexe em nenhum.', 'Lets you adjust each app from here. Off, Aero touches none of them.'))), manual);
    lista.classList.toggle('desativada', !cfg.appsManual);
    appsBox.append(titulo(T('Aplicativos', 'Applications')), cabApps, lista);
    appsBox.hidden = true;

    let ultimo = 0;
    function linhaApp(a) {
      const ic = a.icone ? h('img', { src: a.icone, alt: '', draggable: 'false' }) : h('span', {}, a.nome.charAt(0).toUpperCase());
      const av = h('div', { class: 'app-ic', estilo: { '--ah': (a.nome.length * 47) % 360 } }, ic);
      const v = h('b', { class: 'app-v' }, a.volume + '%');
      const s = U.slider({ min: 0, max: 100, valor: a.volume, oninput: (x) => {
        v.textContent = x + '%'; cfg.appsVol[a.nome] = x;
        const agora = performance.now(); if (agora - ultimo > 60) { ultimo = agora; A.captura.definirVolume(a.id, x); } l.ultimoQuery = agora;
      }, onchange: (x) => { A.captura.definirVolume(a.id, x); A.cfg.salvar(); } });
      s.disabled = !cfg.appsManual; s.setAttribute('aria-label', a.nome);
      const mudo = U.btn('', { icone: a.mudo ? 'mudo' : 'volume', tipo: 'sec', redondo: true, peq: true, titulo: T('Silenciar', 'Mute'), onclick: () => { l.mudo = !l.mudo; A.captura.definirMudo(a.id, l.mudo); mudo.replaceChildren(A.icone(l.mudo ? 'mudo' : 'volume', 18)); } });
      const el = h('div', { class: 'app-linha' }, av, h('div', { class: 'cresce' }, h('div', { class: 'linha entre' }, h('span', { class: 'app-nome' }, a.nome), v), s), mudo);
      const l = { el, slider: s, v, mudo: a.mudo, ultimoQuery: 0 };
      return l;
    }
    async function atualizarApps(forcar) {
      if (!vivo) return;
      const apps = await A.captura.listar();
      if (!vivo) return;
      const ids = new Set(apps.map((a) => a.id));
      for (const [id, l] of linhas) if (!ids.has(id)) { l.el.remove(); linhas.delete(id); }
      for (const a of apps) {
        let l = linhas.get(a.id);
        if (!l) { l = linhaApp(a); linhas.set(a.id, l); lista.append(l.el); }
        const arrastando = document.activeElement === l.slider || performance.now() - l.ultimoQuery < 800;
        if (cfg.appsManual && cfg.appsVol[a.nome] != null && Math.abs(a.volume - cfg.appsVol[a.nome]) > 1 && !arrastando) { A.captura.definirVolume(a.id, cfg.appsVol[a.nome]); a.volume = cfg.appsVol[a.nome]; }
        if (!arrastando) { l.slider.atualizar(a.volume); l.v.textContent = a.volume + '%'; }
      }
      if (!apps.length && !lista.querySelector('.vazio')) lista.append(h('div', { class: 'peq suave vazio' }, T('Nenhum aplicativo tocando som agora.', 'No application playing sound right now.')));
      else if (apps.length) lista.querySelectorAll('.vazio').forEach((x) => x.remove());
    }
    (async () => {
      if (!A.plat.desktop) { appsBox.hidden = false; appsBox.replaceChildren(titulo(T('Aplicativos', 'Applications')), nota(T('O volume por aplicativo funciona no app do PC. No navegador, o site não consegue enxergar os outros aplicativos.', 'Per-app volume works in the desktop app. A browser tab cannot see other applications.'))); return; }
      const cap = await A.captura.disponivel();
      if (!vivo) return;
      appsBox.hidden = false;
      if (!cap.volume) { appsBox.replaceChildren(titulo(T('Aplicativos', 'Applications')), nota(T('O volume por aplicativo ainda não está disponível neste sistema.', 'Per-app volume is not available on this system yet.'))); return; }
      await atualizarApps();
      timer = setInterval(atualizarApps, 1500);
    })();

    corpo.append(boxSaida, titulo(T('Volumes', 'Volumes')), geral, voz, trans, appsBox);
    const p = U.popover(ancora, corpo, { largura: 380, titulo: T('Som', 'Sound'), aoFechar: () => { vivo = false; clearInterval(timer); } });
    return p;
  };

  // ===========================================================================================
  // MICROFONE
  // ===========================================================================================
  // ctx (opcional): de quem é o microfone. Padrão: a sala. A chamada do Aero Talk passa { ligado, alternar, reiniciar }.
  M.mic = (ancora, ctx) => {
    const X = ctx || { ligado: () => S.micLigado(), alternar: () => S.mic(!S.micLigado()), reiniciar: () => S.reiniciarMic() };
    const cfg = A.cfg.v.audio, mc = cfg.mic;
    const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
    let vivo = true, raf = 0;
    const salvar = () => A.cfg.salvar();

    const selDev = h('select', { class: 'campo', 'aria-label': T('Microfone', 'Microphone') });
    A.mic.dispositivos().then(({ entradas }) => {
      if (!vivo) return;
      selDev.append(h('option', { value: '' }, T('Padrão do sistema', 'System default')), ...entradas.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => h('option', { value: d.deviceId }, rotuloDisp(d, i, T('Microfone', 'Microphone')))));
      selDev.value = cfg.entrada || ''; if (selDev.value !== (cfg.entrada || '')) selDev.value = '';
      // (1.0.2) o celular como microfone (integração): aparece junto dos outros; sem celular conectado, escolher abre o pareamento
      if (A.celmic && A.celmic.ligada()) { selDev.append(h('option', { value: 'aero:celular' }, A.celmic.rotulo())); if (A.mic.usandoExterna()) selDev.value = 'aero:celular'; }
    });
    selDev.addEventListener('change', async () => {
      if (selDev.value === 'aero:celular') {
        if (A.celmic.conectado()) { try { await A.celmic.usar(true); } catch (e) { U.toast(T('Não consegui usar esse microfone.', 'Could not use that microphone.'), { tipo: 'erro' }); } }
        else { selDev.value = A.mic.usandoExterna() ? 'aero:celular' : cfg.entrada || ''; p.fechar(); A.celmic.abrir(); }
        return;
      }
      if (A.mic.externa) A.mic.externa = null; // voltou para um microfone do PC
      cfg.entrada = selDev.value; salvar();
      try { await X.reiniciar(); } catch (e) { U.toast(T('Não consegui usar esse microfone.', 'Could not use that microphone.'), { tipo: 'erro' }); }
    });

    const forca = deslizante(T('Potência da supressão', 'Suppression strength'), { valor: mc.forca, aoMudar: (x) => { mc.forca = x; salvar(); } });
    const sens = deslizante(T('Sensibilidade', 'Sensitivity'), { valor: mc.sens, aoMudar: (x) => { mc.sens = x; salvar(); marcar(); }, desc: T('Mais alto: o microfone abre com sons mais baixinhos.', 'Higher: the mic opens with quieter sounds.') });
    const vol = deslizante(T('Volume do microfone', 'Microphone volume'), { max: 200, valor: mc.ganho, aoMudar: (x) => { mc.ganho = x; salvar(); A.mic.atualizar(); } });
    const supr = U.chave(mc.supressao, (v) => { mc.supressao = v; salvar(); forca.classList.toggle('desativada', !v); });
    forca.classList.toggle('desativada', !mc.supressao);
    const eco = U.chave(mc.eco, async (v) => { mc.eco = v; salvar(); try { await X.reiniciar(); } catch (e) { /* ok */ } });
    const agc = U.chave(mc.agc, async (v) => { mc.agc = v; salvar(); try { await X.reiniciar(); } catch (e) { /* ok */ } });

    // medidor: a barra mostra o nível; o risco, o limiar da sensibilidade; a cor, se a porta está aberta
    const barra = h('i', { class: 'nivel-barra' }), risco = h('i', { class: 'nivel-risco' });
    const medidor = h('div', { class: 'nivel', role: 'img', 'aria-label': T('Nível do microfone', 'Microphone level') }, barra, risco);
    const estado = h('div', { class: 'peq suave' });
    const marcar = () => { risco.style.left = A.limitar(((A.mic.limiarDb(mc.sens) + 70) / 60) * 100, 0, 100) + '%'; risco.hidden = !mc.supressao; };
    marcar();
    const laco = () => {
      if (!vivo) return;
      if (A.mic.ativo) {
        barra.style.transform = `scaleX(${A.mic.nivel().toFixed(3)})`;
        barra.classList.toggle('fechada', !!mc.supressao && !A.mic.aberto);
        estado.textContent = !X.ligado() ? T('Microfone mudo', 'Microphone muted') : mc.supressao ? (A.mic.aberto ? T('Captando voz', 'Picking up voice') : T('Ruído de fundo suprimido', 'Background noise suppressed')) : T('Captando', 'Picking up');
      } else { barra.style.transform = 'scaleX(0)'; estado.textContent = T('Ligue o microfone para ver o nível.', 'Turn the microphone on to see the level.'); }
      raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    const ligar = U.btn(X.ligado() ? T('Silenciar', 'Mute') : T('Ligar o microfone', 'Turn mic on'), { icone: X.ligado() ? 'micOff' : 'mic', tipo: 'sec', peq: true, onclick: async () => { try { await X.alternar(); } catch (e) { U.toast(T('Não consegui usar o microfone.', 'Could not use the microphone.'), { tipo: 'erro' }); } p.fechar(); } });

    corpo.append(titulo(T('Dispositivo', 'Device')), selDev, medidor, estado,
      linhaOpc(T('Supressão de ruído', 'Noise suppression'), supr, T('Corta teclado, ventilador e ruído de fundo.', 'Cuts keyboard, fan and background noise.')), forca, sens, vol,
      h('details', { class: 'mais' }, h('summary', {}, T('Mais opções', 'More options')), linhaOpc(T('Cancelamento de eco', 'Echo cancellation'), eco, T('Use com alto-falante. Com fone, pode desligar.', 'Use with speakers. With headphones you can turn it off.')), linhaOpc(T('Ganho automático', 'Automatic gain'), agc)), ligar);
    const p = U.popover(ancora, corpo, { largura: 360, titulo: T('Microfone', 'Microphone'), aoFechar: () => { vivo = false; cancelAnimationFrame(raf); } });
    return p;
  };

  // ===========================================================================================
  // OPÇÕES AVANÇADAS DA TRANSMISSÃO (usadas aqui e na aba Transmitir)
  // ===========================================================================================
  M.avancadoHost = () => {
    const c = A.cfg.v.host, salvar = () => A.cfg.salvar();
    // (0.6.0) só duas escolhas, e nada troca sozinho: placa de vídeo (H.264 pela placa, o padrão) ou processador (VP8)
    const caixa = h('div', { class: 'col', estilo: { gap: '8px' } },
      linhaOpc(T('Quem codifica o vídeo', 'Who encodes the video'), U.seg([['gpu', T('Placa de vídeo', 'Graphics card')], ['cpu', T('Processador', 'Processor')]], A.gpu.codificador(), (v) => { c.codificador = v; salvar(); }), T('Placa de vídeo é o recomendado (mais fps e menos peso no jogo). Vale na próxima transmissão.', 'Graphics card is recommended (more fps, less load on the game). Applies to the next stream.')),
      linhaOpc(T('Não captar o som do Aero', 'Do not capture Aero sound'), U.chave(S.semAero(), (v) => { c.semEcoAero = v; salvar(); if (A.sala && A.sala.aplicarSomDoAero) A.sala.aplicarSomDoAero(); }), T('Evita eco: quem assiste não ouve a própria voz de volta nem os sons do app.', 'Avoids echo: viewers do not hear their own voice back nor the app sounds.')),
      linhaOpc(T('Não captar o som do Discord', 'Do not capture Discord sound'), U.chave(S.semDiscord(), (v) => { c.semEcoDiscord = v; salvar(); if (A.sala && A.sala.aplicarSomDoAero) A.sala.aplicarSomDoAero(); }), T('Quem assiste não ouve as vozes da sua call do Discord.', 'Viewers do not hear the voices from your Discord call.')),
      linhaOpc(T('Minha prévia da transmissão', 'My stream preview'), selectDe([['auto', T('Automática (esconde se causaria espelho)', 'Automatic (hides if it would mirror)')], ['sempre', T('Sempre mostrar', 'Always show')], ['nunca', T('Nunca mostrar', 'Never show')]], c.preview, (v) => { c.preview = v; salvar(); A.evt.emit('sala:local', {}); }, T('Prévia', 'Preview')), T('Se você compartilha a tela inteira e o Aero aparece nela, a prévia viraria um espelho infinito.', 'If you share the whole screen and Aero shows up in it, the preview would become an infinite mirror.')),
      linhaOpc(T('Incluir a janela do Aero na transmissão', 'Include the Aero window in the stream'), U.chave(!!c.incluirApp, (v) => { c.incluirApp = v; salvar(); if (A.sala && A.sala.aplicarJanelaNaCaptura) A.sala.aplicarJanelaNaCaptura(); }), T('Normalmente fica escondida de quem assiste.', 'Normally hidden from viewers.')));
    return caixa;
  };

  // ===========================================================================================
  // APLICATIVOS COM SOM (escolher de quais aplicativos sai o som da transmissão) - usado aqui e na aba Transmitir
  // ===========================================================================================
  // (0.7.3) aoMudar: quem usa a lista fora da sala (a chamada do Aero Talk) refaz o próprio som; sem ele, é o som da sala
  M.appsCaptura = ({ aoMudar } = {}) => {
    const c = A.cfg.v.host;
    let vivo = true, timer = 0;
    const appsBox = h('div', { class: 'col', estilo: { gap: '6px' } }), appsLista = h('div', { class: 'apps-lista marcar' });
    appsBox.hidden = true;
    const escolhidos = new Set(c.appsCaptura || []);
    const aplicarApps = async () => {
      const ids = [...escolhidos];
      if (aoMudar) { try { await aoMudar(ids); } catch (e) { A.log.aviso('apps', e); } return; }
      try { const ok = await S.definirAppsCaptura(ids); if (S.local.tela && ok === false && ids.length) U.toast(T('Não consegui captar só esses aplicativos neste sistema.', 'Could not capture only those apps on this system.')); } catch (e) { A.log.aviso('apps', e); }
    };
    let aplicando = 0;
    async function pintarApps() {
      if (!vivo) return;
      const apps = await A.captura.listar();
      if (!vivo) return;
      appsLista.textContent = '';
      if (!apps.length) appsLista.append(h('div', { class: 'peq suave' }, T('Nenhum aplicativo tocando som agora.', 'No application playing sound right now.')));
      apps.forEach((a) => {
        const caixa = h('input', { type: 'checkbox', 'aria-label': a.nome }); caixa.checked = escolhidos.has(a.id) || escolhidos.has(a.nome);
        caixa.addEventListener('change', () => {
          if (caixa.checked) escolhidos.add(a.id); else { escolhidos.delete(a.id); escolhidos.delete(a.nome); }
          c.appsCaptura = [...escolhidos].slice(0, 32); A.cfg.salvar();
          clearTimeout(aplicando); aplicando = setTimeout(aplicarApps, 350);
        });
        appsLista.append(h('label', { class: 'app-linha marcavel' }, caixa, h('div', { class: 'app-ic', estilo: { '--ah': (a.nome.length * 47) % 360 } }, a.icone ? h('img', { src: a.icone, alt: '', draggable: 'false' }) : h('span', {}, a.nome.charAt(0).toUpperCase())), h('span', { class: 'cresce app-nome' }, a.nome)));
      });
    }
    (async () => {
      if (!A.plat.desktop) return;
      const cap = await A.captura.disponivel();
      if (!vivo) return;
      appsBox.hidden = false;
      appsBox.append(titulo(T('Aplicativos com som', 'Apps with sound'), cap.captura ? T('Nenhum marcado = o computador inteiro (menos o Aero e o microfone). Compartilhando uma janela: o som dela entra sozinho e os marcados se somam. Ao parar de transmitir, volta ao padrão.', 'None checked = the whole computer (except Aero and the mic). Sharing a window: its sound goes in automatically and checked apps add to it. When you stop sharing, it goes back to default.') : ''));
      if (!cap.captura) { appsBox.append(nota(T('Escolher aplicativos ainda não está disponível neste sistema. O som do computador inteiro continua sendo compartilhado.', 'Choosing apps is not available on this system yet. The whole computer sound is still shared.'))); return; }
      appsBox.append(appsLista);
      await pintarApps();
      timer = setInterval(() => { if (!appsLista.querySelector('input:focus')) pintarApps(); }, 2500);
    })();
    return { el: appsBox, parar: () => { vivo = false; clearInterval(timer); clearTimeout(aplicando); } };
  };

  // ===========================================================================================
  // COMPARTILHAR
  // ===========================================================================================
  M.compartilhar = (ancora, ctx) => {
    const c = A.cfg.v.host;
    const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
    let vivo = true;
    const comp = !!S.local.tela;

    // --- estado e fonte ---
    const status = h('div', { class: 'linha' }, h('i', { class: 'pt-estado' + (comp ? ' on' : '') }), h('b', {}, comp ? T('Transmitindo agora', 'Sharing now') : T('Você não está compartilhando', 'You are not sharing')),
      h('span', { class: 'peq suave cresce', estilo: { 'text-align': 'right' } }, comp && S.local.fonte ? S.local.fonte.nome : comp ? ({ monitor: T('tela inteira', 'whole screen'), window: T('uma janela', 'a window'), browser: T('uma aba', 'a tab') }[S.local.superficie] || '') : ''));
    const trocar = U.btn(comp ? T('Trocar tela ou janela', 'Switch screen or window') : T('Compartilhar agora', 'Share now'), { icone: comp ? 'atualizar' : 'enviarTela', onclick: async () => {
      try {
        if (!comp) { p.fechar(); await ctx.alternar(); return; }
        let fonte = { id: null };
        if (A.plat.desktop) { fonte = await U.escolherFonte(); if (!fonte) return; }
        await S.trocarFonte({ fonteId: fonte.id, fonte: fonte.id ? fonte : null });
        p.fechar();
      } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') U.toast(e.message || String(e), { tipo: 'erro' }); }
    } });

    // --- modo ---
    const desc = h('div', { class: 'peq suave' });
    const textoModo = (m) => { desc.textContent = m === 'jogo' ? T('Jogo: deixa os amigos jogarem na sua máquina e prioriza o menor atraso.', 'Game: lets friends play on your machine and prioritizes the lowest delay.') : T('Compartilhar: só mostra a sua tela.', 'Share: just shows your screen.'); };
    const modoAtual = comp ? S.local.modo : c.modo;
    textoModo(modoAtual);
    const modo = U.seg([['tela', T('Compartilhar', 'Share'), 'tela'], ['jogo', T('Jogo', 'Game'), 'controle']], modoAtual, (v) => { c.modo = v; A.cfg.salvar(); textoModo(v); if (S.local.tela) S.trocarModo(v); });

    // --- som ---
    const somOn = comp ? S.local.somTela : c.audio;
    const som = U.chave(somOn, (v) => { c.audio = v; A.cfg.salvar(); if (S.local.tela) { if (v && !S.local.tela.getAudioTracks().length) U.toast(T('Esta fonte não tem som para compartilhar.', 'This source has no sound to share.')); S.alternarSomTela(v); } });

    // --- aplicativos com som (app do PC) ---
    const apps = M.appsCaptura(), appsBox = apps.el;

    // --- qualidade ao vivo ---
    const aplicarQ = () => { if (S.local.tela) S.atualizarPreset(A.gpu.presetUsuario()); };
    const vivoInfo = h('div', { class: 'peq suave selecionavel' });
    const pintarInfo = () => {
      const e = S.envio;
      vivoInfo.textContent = !S.local.tela ? T('Os números ao vivo aparecem quando você estiver transmitindo.', 'Live numbers show up while you are sharing.')
        : !e ? T('Medindo...', 'Measuring...') : `${T('Captura', 'Capture')} ${e.captura || '?'} · ${T('enviando', 'sending')} ${Math.round(e.fps)}/${e.alvo || '?'} fps · ${e.w}×${e.h} · ${(e.kbps / 1000).toFixed(1)} Mbps · ${e.hw ? 'GPU' : 'CPU'}${e.impl ? ' (' + e.impl + ')' : ''}`;
    };
    pintarInfo();
    const off = A.evt.on('sala:estat', () => vivo && pintarInfo());

    corpo.append(status, trocar, titulo(T('Modo', 'Mode')), modo, desc, linhaOpc(T('Compartilhar o som', 'Share sound'), som), appsBox,
      titulo(T('Qualidade', 'Quality')), ...A.gpu.seletoresQualidade(aplicarQ), vivoInfo,
      h('details', { class: 'mais' }, h('summary', {}, T('Avançado', 'Advanced')), M.avancadoHost()));
    const p = U.popover(ancora, corpo, { largura: 400, titulo: T('Compartilhar', 'Share'), aoFechar: () => { vivo = false; apps.parar(); off(); } });
    return p;
  };
})();
