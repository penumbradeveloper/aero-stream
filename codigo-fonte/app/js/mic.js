// Aero Stream - microfone com tratamento: filtro de graves, supressão de ruído (filtro espectral + porta, com potência ajustável),
// sensibilidade, volume e escolha do dispositivo. O que sai daqui é uma trilha única e estável: trocar de
// microfone ou mexer nos ajustes NÃO renegocia a conexão (a trilha enviada continua a mesma). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  const cfg = () => A.cfg.v.audio.mic;

  const M = (A.mic = { ativo: false, saida: null, db: -90, dbSaida: -90, limiarAtual: null, aberto: true, _c: null });

  // Mapas dos controles para números reais (funções puras, testáveis)
  // sensibilidade 0..100 -> limiar da porta em dB (mais sensível = abre com som mais baixo)
  // (1.0.3) faixa maior (-22 a -68 dB; o 50 continua -45) e, com o supressor, também uma margem acima do ruído de fundo medido:
  // 100 abre com 3 dB acima do ruído, 50 com 8 dB, 0 só com 13 dB acima. Assim o controle muda algo em qualquer microfone e em qualquer quarto
  M.limiarDb = (sens) => -22 - A.limitar(sens, 0, 100) * 0.46;
  M.margemDb = (sens) => 3 + (100 - A.limitar(sens, 0, 100)) * 0.1;
  // potência 0..100 -> quanto a porta fechada abaixa o som (dB)
  // (0.8.4) bem mais forte: 60 -> 68 dB, e de 95 para cima a porta fechada fica muda
  M.reducaoDb = (forca) => 20 + A.limitar(forca, 0, 100) * 0.8;
  M.dbParaGanho = (db) => Math.pow(10, db / 20);

  M.dispositivos = async () => {
    try {
      const l = await navigator.mediaDevices.enumerateDevices();
      return { entradas: l.filter((d) => d.kind === 'audioinput'), saidas: l.filter((d) => d.kind === 'audiooutput') };
    } catch (e) { return { entradas: [], saidas: [] }; }
  };

  // (1.0.2) fonte de fora (o celular como microfone, celmic.js): enquanto estiver viva, é ela que entra no lugar do microfone do PC.
  // Vai uma CÓPIA da trilha: trocar de volta para o microfone do PC para a cópia, nunca a conexão com o celular
  M.externa = null;
  const externaViva = () => !!(M.externa && M.externa.getAudioTracks().some((t) => t.readyState === 'live'));
  M.usandoExterna = () => externaViva();
  M.usarExterna = async (stream) => { M.externa = stream || null; A.evt.emit('mic:fonte'); if (M.ativo) await M.reiniciar(); };

  async function obter() {
    if (externaViva()) return new MediaStream(M.externa.getAudioTracks().map((t) => t.clone()));
    const c = cfg();
    const audio = { echoCancellation: !!c.eco, noiseSuppression: !!c.supressao, autoGainControl: !!c.agc, channelCount: 1 };
    const dev = A.cfg.v.audio.entrada;
    if (dev) audio.deviceId = { exact: dev }; // "exact": usa ESTE microfone (com "ideal" o navegador podia ficar no padrão do sistema)
    // (1.0.2) eco "de tudo": também tira o som do sistema que volta pela caixa (jogo, vídeo). Onde o navegador não sabe, volta ao eco comum
    if (c.eco && M._ecoTudo !== false) {
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: { ...audio, echoCancellation: 'all' }, video: false }); if (M._ecoTudo == null) { M._ecoTudo = true; A.log.info && A.log.info('microfone: cancelamento de eco do sistema inteiro'); } return st; }
      catch (e) { if (e && (e.name === 'TypeError' || e.name === 'OverconstrainedError' && /echo/i.test(e.constraint || ''))) M._ecoTudo = false; else if (!(dev && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError'))) M._ecoTudo = false; }
    }
    try { return await navigator.mediaDevices.getUserMedia({ audio, video: false }); }
    catch (e) {
      if (dev && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) { A.log.aviso('microfone escolhido não encontrado; usando o padrão', dev); if (A.ui && A.ui.toast) A.ui.toast(A.T('O microfone escolhido não foi encontrado (desconectado?). Usando o padrão do sistema por enquanto.', 'The chosen microphone was not found (unplugged?). Using the system default for now.'), { ms: 5000 }); delete audio.deviceId; return navigator.mediaDevices.getUserMedia({ audio, video: false }); } // o dispositivo salvo sumiu
      throw e;
    }
  }

  function ligarFonte(bruto) {
    const c = M._c;
    if (c.fonte) { try { c.fonte.disconnect(); } catch (e) { /* ok */ } }
    if (c.bruto && c.bruto !== bruto) c.bruto.getTracks().forEach((t) => t.stop());
    c.bruto = bruto;
    c.fonte = c.ctx.createMediaStreamSource(bruto);
    c.fonte.connect(c.hpf);
    bruto.getAudioTracks().forEach((t) => { t.onended = () => { if (M.ativo && c === M._c) A.evt.emit('mic:perdido'); }; });
  }

  // Liga o microfone e devolve um MediaStream com UMA trilha de áudio já tratada
  M.iniciar = () => { if (M.ativo) return Promise.resolve(M.saida); return M._ini || (M._ini = iniciar().finally(() => { M._ini = null; })); }; // duas chamadas juntas: um microfone só
  const iniciar = async () => {
    const bruto = await obter();
    const ctx = A.som.destravar() || A.som.ctx;
    if (!ctx) { M.ativo = true; M.saida = bruto; M._c = { semProcessamento: true, bruto }; return bruto; } // navegador sem Web Audio: manda cru
    const c = (M._c = { ctx, bruto: null, fonte: null, portaAberta: true, ultimoSom: 0, timer: 0 });
    c.hpf = ctx.createBiquadFilter(); c.hpf.type = 'highpass'; c.hpf.frequency.value = 85; c.hpf.Q.value = 0.7;
    c.analise = ctx.createAnalyser(); c.analise.fftSize = 1024; c.analise.smoothingTimeConstant = 0;
    c.atraso = ctx.createDelay(0.2); c.atraso.delayTime.value = 0.02; // olha 20 ms à frente: a porta abre ANTES do começo da fala
    c.porta = ctx.createGain(); c.porta.gain.value = 1;
    c.vol = ctx.createGain(); c.vol.gain.value = A.limitar(cfg().ganho, 0, 200) / 100;
    c.ptt = ctx.createGain(); c.ptt.gain.value = pttAberto() ? 1 : 0; // (1.0.6) apertar para falar: fechado enquanto a tecla está solta
    c.destino = ctx.createMediaStreamDestination();
    c.analiseSaida = ctx.createAnalyser(); c.analiseSaida.fftSize = 1024; c.analiseSaida.smoothingTimeConstant = 0; // (1.0.3) o que sai de verdade (o medidor mostra o efeito da supressão)
    // (0.8.4) supressão na thread de áudio: tira o ruído de dentro da fala e continua agindo com o app minimizado ou atrás de um jogo.
    // Sem AudioWorklet: a porta antiga (relógio da interface)
    try {
      if (!ctx.audioWorklet) throw new Error('sem AudioWorklet');
      if (!ctx._supressorAero) ctx._supressorAero = ctx.audioWorklet.addModule('js/supressor.worklet.js');
      await ctx._supressorAero;
      c.sup = new AudioWorkletNode(ctx, 'supressor-aero', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      c.sup.port.onmessage = (e) => { if (M._c === c && e.data) { M.aberto = !!e.data.aberto && pttAberto(); if (typeof e.data.limiar === 'number') M.limiarAtual = e.data.limiar; } };
    } catch (e) { ctx._supressorAero = null; c.sup = null; A.log.aviso('supressão de ruído: sem AudioWorklet, usando a porta simples', e && e.message); }
    if (c.sup) { c.hpf.connect(c.analise); c.hpf.connect(c.sup); c.sup.connect(c.vol); }
    else { c.hpf.connect(c.analise); c.hpf.connect(c.atraso); c.atraso.connect(c.porta); c.porta.connect(c.vol); }
    c.vol.connect(c.ptt); c.ptt.connect(c.destino); c.ptt.connect(c.analiseSaida);
    if (M._c !== c) { try { c.sup && c.sup.disconnect(); } catch (e) { /* ok */ } bruto.getTracks().forEach((t) => t.stop()); return M.saida; } // parou enquanto carregava
    ligarFonte(bruto);
    c.buf = new Float32Array(c.analise.fftSize);
    c.timer = setInterval(laco, 16);
    M.ativo = true; M.saida = c.destino.stream;
    return M.saida;
  };

  // A porta de ruído: fecha quando só tem ruído de fundo, abre quando alguém fala
  function laco() {
    const c = M._c; if (!c || !c.analise) return;
    c.analise.getFloatTimeDomainData(c.buf);
    let soma = 0; for (let i = 0; i < c.buf.length; i++) soma += c.buf[i] * c.buf[i];
    const db = 10 * Math.log10(soma / c.buf.length + 1e-12);
    M.db = Math.max(db, M.db - 1.2); // o medidor desce devagar
    if (c.analiseSaida) { c.analiseSaida.getFloatTimeDomainData(c.buf); let s2 = 0; for (let i = 0; i < c.buf.length; i++) s2 += c.buf[i] * c.buf[i]; M.dbSaida = Math.max(10 * Math.log10(s2 / c.buf.length + 1e-12), M.dbSaida - 1.2); }
    const cf = cfg(), agora = performance.now();
    if (c.sup) { // o trabalho é do supressor: aqui só os ajustes (mandados quando mudam)
      const ch = (cf.supressao ? 1 : 0) + '|' + cf.forca + '|' + cf.sens + '|' + (cf.eco ? 1 : 0);
      if (ch !== c.ajustes) { c.ajustes = ch; c.sup.port.postMessage({ p: { ligado: !!cf.supressao, forca: A.limitar(+cf.forca || 0, 0, 100), limiar: M.limiarDb(cf.sens), margem: M.margemDb(cf.sens), eco: !!cf.eco } }); }
      // (1.0.2) anti-eco: o supressor recebe o quanto está tocando agora (as vozes e as transmissões que saem da caixa). Som no microfone que
      // só acompanha o que está tocando é eco, e não abre a porta (a sua voz por cima continua abrindo)
      if (cf.eco && (c.nRef = (c.nRef || 0) + 1) % 3 === 0) {
        const an = A.sala && A.sala.analisador;
        let ref = -90;
        if (an && an.context === c.ctx) { const b = c.bufRef || (c.bufRef = new Float32Array(an.fftSize)); an.getFloatTimeDomainData(b); let s2 = 0; for (let i = 0; i < b.length; i++) s2 += b[i] * b[i]; ref = 10 * Math.log10(s2 / b.length + 1e-12); }
        if (Math.abs(ref - (c.refAnt == null ? -999 : c.refAnt)) > 1 || ref > -80) { c.refAnt = ref; c.sup.port.postMessage({ ref }); }
      }
      return;
    }
    let alvo = 1;
    if (cf.supressao && !document.hidden) { // janela escondida: o navegador atrasa este relógio, então a porta fica aberta
      const limiar = M.limiarDb(cf.sens); M.limiarAtual = limiar;
      if (db > limiar) c.ultimoSom = agora;
      c.portaAberta = agora - c.ultimoSom < 220; // segura 220 ms depois da última sílaba (sem cortar o final das palavras)
      alvo = c.portaAberta ? 1 : M.dbParaGanho(-M.reducaoDb(cf.forca));
    } else c.portaAberta = true;
    const atual = c.porta.gain.value;
    if (Math.abs(atual - alvo) > 0.002) c.porta.gain.setTargetAtTime(alvo, c.ctx.currentTime, alvo > atual ? 0.006 : 0.07);
    M.aberto = c.portaAberta && pttAberto();
  }

  // Ajustes que valem na hora (volume). Os da porta são lidos a cada ciclo.
  M.atualizar = () => {
    const c = M._c; if (!c || !c.vol) return;
    c.vol.gain.setTargetAtTime(A.limitar(cfg().ganho, 0, 200) / 100, c.ctx.currentTime, 0.03);
  };

  // Pega o microfone de novo (mudou dispositivo, eco, ruído do navegador ou controle automático de ganho)
  M.reiniciar = async () => {
    if (!M.ativo || !M._c || M._c.semProcessamento) return;
    const bruto = await obter();
    ligarFonte(bruto);
  };

  M.mudo = (mudo) => { if (M.saida) M.saida.getAudioTracks().forEach((t) => { t.enabled = !mudo; }); };

  M.parar = () => {
    const c = M._c;
    clearInterval(c && c.timer);
    if (c) {
      try { c.fonte && c.fonte.disconnect(); c.hpf && c.hpf.disconnect(); c.sup && c.sup.disconnect(); c.atraso && c.atraso.disconnect(); c.porta && c.porta.disconnect(); c.vol && c.vol.disconnect(); c.ptt && c.ptt.disconnect(); c.analiseSaida && c.analiseSaida.disconnect(); } catch (e) { /* ok */ }
      c.bruto && c.bruto.getTracks().forEach((t) => t.stop());
      if (c.destino) c.destino.stream.getTracks().forEach((t) => t.stop());
    }
    M.ativo = false; M.saida = null; M._c = null; M.db = -90; M.dbSaida = -90; M.limiarAtual = null;
  };

  // ---------- (1.0.6) apertar para falar ----------
  // Ligado: o microfone só manda som enquanto o atalho (uma tecla ou um botão do mouse) está apertado, na sala e na chamada. Com a janela do
  // Aero em foco o próprio app ouve o atalho; no app do PC um auxiliar ouve também com o Aero em segundo plano (Windows e Linux)
  const nomesMouse = { 1: ['Botão do meio', 'Middle button'], 3: ['Mouse 4', 'Mouse 4'], 4: ['Mouse 5', 'Mouse 5'] };
  M.nomeAtalho = (at) => { if (!at) return A.T('Nenhum', 'None'); if (Number.isInteger(at.botao)) { const n = nomesMouse[at.botao]; return n ? A.T(n[0], n[1]) : 'Mouse ' + (at.botao + 1); } return at.nome || at.code || '?'; };
  const pttLigado = () => !!(cfg().ptt && cfg().pttAtalho);
  let local = false, global = false, globalAtivo = false;
  function pttAberto() { return !pttLigado() || local || global; }
  M.pttLigado = pttLigado; M.pttApertado = () => local || global;
  function aplicarPtt() {
    const c = M._c, ab = pttAberto();
    if (c && c.ptt) c.ptt.gain.setTargetAtTime(ab ? 1 : 0, c.ctx.currentTime, ab ? 0.004 : 0.03); // abre na hora; fecha sem estalo
    if (!ab) M.aberto = false;
    A.evt.emit('mic:ptt', ab);
  }
  const mesmaTecla = (at, e) => at && !Number.isInteger(at.botao) && at.code === e.code;
  const mesmoBotao = (at, e) => at && Number.isInteger(at.botao) && at.botao === e.button;
  const pondo = () => document.documentElement.dataset.gravandoAtalho === '1'; // a tela de escolher o atalho está ouvindo: não conta
  const mudarLocal = (v) => { if (local === v) return; local = v; aplicarPtt(); };
  addEventListener('keydown', (e) => { if (pttLigado() && !pondo() && !e.repeat && mesmaTecla(cfg().pttAtalho, e)) mudarLocal(true); }, true);
  addEventListener('keyup', (e) => { if (pttLigado() && mesmaTecla(cfg().pttAtalho, e)) mudarLocal(false); }, true);
  addEventListener('pointerdown', (e) => { if (pttLigado() && !pondo() && mesmoBotao(cfg().pttAtalho, e)) { mudarLocal(true); if (e.button > 2) e.preventDefault(); } }, true);
  addEventListener('pointerup', (e) => { if (pttLigado() && mesmoBotao(cfg().pttAtalho, e)) { mudarLocal(false); if (e.button > 2) e.preventDefault(); } }, true);
  addEventListener('mouseup', (e) => { if (pttLigado() && mesmoBotao(cfg().pttAtalho, e) && e.button > 2) e.preventDefault(); }, true); // os botões de lado não voltam página
  addEventListener('blur', () => { if (!globalAtivo) mudarLocal(false); else if (local) { local = false; aplicarPtt(); } });
  // o auxiliar do PC: liga/desliga junto com a opção; devolve por que não deu (ex.: "permissao" no Linux)
  const nativo = () => (window.aero && window.aero.ptt) || null;
  if (nativo()) nativo().aoMudar((v) => { if (global === v) return; global = v; aplicarPtt(); });
  M.pttGlobal = async () => {
    const N = nativo(); if (!N) return { ok: false, motivo: 'sem-app' };
    if (!pttLigado()) { globalAtivo = false; global = false; try { await N.parar(); } catch (e) { /* ok */ } aplicarPtt(); return { ok: true, desligado: true }; }
    let r; try { r = await N.ligar(cfg().pttAtalho); } catch (e) { r = { ok: false, motivo: 'falhou' }; }
    globalAtivo = !!(r && r.ok); M.pttMotivo = globalAtivo ? '' : (r && r.motivo) || 'falhou';
    if (!globalAtivo && A.log) A.log.info('apertar para falar: só com o Aero em foco (' + M.pttMotivo + ')');
    return r;
  };
  M.pttLiberar = async () => { const N = nativo(); if (!N) return { ok: false }; const r = await N.liberar(); return r && r.ok ? M.pttGlobal() : r; };
  M.pttAplicar = () => { local = false; global = false; aplicarPtt(); return M.pttGlobal(); };
  setTimeout(() => { if (pttLigado()) M.pttGlobal(); }, 1500);


  M.nivel = () => A.limitar((M.db + 70) / 60, 0, 1);
  M.nivelSaida = () => A.limitar((M.dbSaida + 70) / 60, 0, 1);
})();
