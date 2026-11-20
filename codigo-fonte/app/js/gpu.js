// Aero Stream - teste real da placa de vídeo (v2).
// A estimativa do navegador (mediaCapabilities) mentia sobre a RX 580. Aqui o app CODIFICA vídeo de verdade por
// ~2 segundos e mede: se foi pela GPU (powerEfficientEncoder) e quantos quadros por segundo saíram, usando EXATAMENTE
// o mesmo perfil de codec que a transmissão vai usar (H.264 High/Main = hardware; Baseline = processador).
// O resultado decide o modo (resolução x fps) e o codec do modo Automático. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, T = (pt, en) => A.T(pt, en);
  const VERSAO_ALG = 7; // mudou o algoritmo: o resultado guardado de versões antigas é descartado

  // Do mais exigente ao mais leve. Prioriza fluidez (fps) antes de resolução.
  const MODOS = [
    { id: '1080p60', larg: 1920, alt: 1080, fps: 60, mbps: 8 },
    { id: '720p60', larg: 1280, alt: 720, fps: 60, mbps: 5 },
    { id: '1080p30', larg: 1920, alt: 1080, fps: 30, mbps: 6 },
    { id: '720p30', larg: 1280, alt: 720, fps: 30, mbps: 3 },
    { id: '480p30', larg: 854, alt: 480, fps: 30, mbps: 1.5 },
  ];
  const SEGURO = MODOS[3]; // se nada puder ser medido, 720p30 é o modo que funciona em quase tudo
  const PREFS_HW = ['h264-alto', 'h264-main'];
  const PREFS_SW = ['vp8', 'h264-base'];
  const MARGEM = 0.92; // "fluido" = pelo menos 92% do fps pedido

  // Codifica um vídeo sintético (canvas) entre dois peers na mesma página e lê as estatísticas do codificador
  async function medir(m, { pref = 'auto', aquecer = 700, janela = 1500 } = {}) {
    const cv = document.createElement('canvas'); cv.width = m.larg; cv.height = m.alt;
    const g = cv.getContext('2d');
    let n = 0;
    const desenhar = () => { // imagem que muda o tempo todo (mais difícil de comprimir que uma cor lisa)
      n++; g.fillStyle = `hsl(${(n * 3) % 360} 70% 45%)`; g.fillRect(0, 0, m.larg, m.alt);
      g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) g.fillRect((n * 9 + i * 101) % m.larg, (i * 57 + n * 4) % m.alt, 80, 80);
    };
    desenhar();
    const timer = setInterval(desenhar, 1000 / m.fps);
    const stream = cv.captureStream(m.fps);
    const a = new RTCPeerConnection(), b = new RTCPeerConnection();
    const limpar = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); try { a.close(); b.close(); } catch (e) { /* ok */ } };
    try {
      a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
      b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
      const sender = a.addTrack(stream.getVideoTracks()[0], stream);
      A.codec.preferir(a.getTransceivers()[0], { pref });
      await a.setLocalDescription(await a.createOffer());
      await b.setRemoteDescription(a.localDescription);
      await b.setLocalDescription(await b.createAnswer());
      await a.setRemoteDescription(b.localDescription);
      try { const p = sender.getParameters(); p.encodings = [{ maxBitrate: m.mbps * 1e6, maxFramerate: m.fps }]; await sender.setParameters(p); } catch (e) { /* alguns navegadores recusam antes de conectar */ }
      for (let i = 0; i < 40 && a.connectionState !== 'connected'; i++) await A.esperar(100);
      if (a.connectionState !== 'connected') return { ok: false, motivo: 'sem-conexao' };
      await A.esperar(aquecer);
      const ler = async () => {
        let s = null, codec = '';
        const rel = await a.getStats();
        rel.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') s = r; });
        if (s && s.codecId) { const c = rel.get(s.codecId); if (c) codec = c.mimeType + (c.sdpFmtpLine && /profile-level-id=(\w{2})/.test(c.sdpFmtpLine) ? ' ' + /profile-level-id=(\w{2})/.exec(c.sdpFmtpLine)[1] : ''); }
        return s ? { quadros: s.framesEncoded, t: s.timestamp, impl: s.encoderImplementation || '', hw: s.powerEfficientEncoder, w: s.frameWidth, h: s.frameHeight, codec } : null;
      };
      const s1 = await ler(); await A.esperar(janela); const s2 = await ler();
      if (!s1 || !s2 || s2.t <= s1.t) return { ok: false, motivo: 'sem-estatisticas' };
      const fps = ((s2.quadros - s1.quadros) * 1000) / (s2.t - s1.t);
      // Hardware = o navegador diz que é "eficiente em energia", ou o nome do codificador é de GPU
      const hw = s2.hw === true || /MediaFoundation|VideoToolbox|VAAPI|VaapiVideo|NVENC|AMF|D3D12|ExternalEncoder|VideoEncodeAccelerator/i.test(s2.impl);
      return { ok: true, fps, hw, impl: s2.impl, codec: s2.codec, w: s2.w, h: s2.h };
    } catch (e) {
      A.log.aviso('teste gpu ' + m.id, e);
      return { ok: false, motivo: String(e.message || e) };
    } finally { limpar(); }
  }

  const fluido = (r, m) => !!(r && r.ok && r.fps >= m.fps * MARGEM);

  // Roda a sequência de testes e devolve { testes, melhor, pref, hw }
  async function sequencia(medirFn) {
    const testes = [];
    const tentar = async (m, pref) => {
      const r = await medirFn(m, { pref });
      testes.push({ id: m.id, pref, fps_alvo: m.fps, ...r });
      A.log.info('gpu', m.id, pref, JSON.stringify(r));
      return r;
    };
    let escolha = null;
    // 1) hardware: do modo mais exigente ao mais leve, com o perfil High e depois o Main
    let hwExiste = true;
    for (const m of MODOS) {
      if (escolha || !hwExiste) break;
      let algumHw = false;
      for (const pref of PREFS_HW) {
        const r = await tentar(m, pref);
        if (!r.ok) { if (r.motivo === 'sem-conexao') hwExiste = false; continue; }
        if (r.hw) algumHw = true;
        if (r.hw && fluido(r, m)) { escolha = { m, pref, hw: true }; break; }
      }
      if (!escolha && !algumHw) hwExiste = false; // nenhum perfil usou a placa neste modo: não há codificação por hardware
    }
    // 2) sem hardware: processador, tentando 720p60 antes de cair para 30 fps
    if (!escolha) {
      const swModos = MODOS.filter((m) => m.alt <= 720);
      for (const m of swModos) {
        if (escolha) break;
        for (const pref of PREFS_SW) {
          const r = await tentar(m, pref);
          if (fluido(r, m)) { escolha = { m, pref, hw: !!r.hw }; break; }
          if (!r.ok && r.motivo === 'sem-conexao') break;
        }
      }
    }
    if (!escolha) escolha = { m: MODOS.find((x) => x.id === '480p30') || SEGURO, pref: 'vp8', hw: false };
    return { testes, melhor: escolha.m, pref: escolha.pref, hw: escolha.hw };
  }

  const G = (A.gpu = { resultado: null, testando: false, MODOS, SEGURO, medir, sequencia, fluido });

  // Resolução nativa da tela (até 4K), no FPS que a pessoa escolher, taxa automática pelo tamanho real da captura: é o "Automático" quando a placa codifica.
  // (0.6.0) o Automático vai até 1080p (como o Discord). Em 1440p/4K o Chromium copia e converte cada quadro inteiro pelo processador antes
  // de codificar, e num jogo pesado isso disputa com o jogo e derruba o fps. 2K e 4K continuam disponíveis para quem escolher.
  const NATIVA = { id: 'nativa', larg: 3840, alt: 1080, fps: 60, mbps: 0, nativa: true }; // largura folgada: ultrawide (2560x1080, 3840x1080) fica nativo

  // LINUX (0.5): a placa codifica pelo VA-API (só codificação; a decodificação por hardware fica desligada no app do PC) e NADA é codificado ao abrir:
  // a placa só trabalha quando você transmite. O Automático já é resolução nativa + H.264 High (o perfil que vai para a placa).
  function resultadoLinux(i0) {
    const placa = i0.gpuModo !== 'software' && i0.gpuModo !== 'semgpu';
    return { testes: [], melhor: placa ? NATIVA : MODOS[1], pref: placa ? 'h264-alto' : 'vp8', hw: placa, semTeste: true, linux: true, codec: placa ? 'video/H264' : '', impl: '', quando: Date.now() };
  }

  // "Verificar a placa": pergunta ao PRÓPRIO Chromium se o codificador H.264 por hardware existe (sem codificar nada) e, de quebra, codifica 2 s
  // de teste. Atenção: fora de uma captura de tela o Chromium ESCONDE o nome do codificador nas estatísticas (privacidade), então o teste
  // sozinho não prova nada; quem decide é a lista de perfis do codificador por hardware e o WebCodecs com "prefer-hardware".
  G.verificar = async () => {
    if (G.testando) return null;
    G.testando = true;
    try {
      // App do PC no Linux: o teste de verdade roda em cópias escondidas do app, uma por combinação de opções (veja desktop/perfis.js)
      if (window.aero && window.aero.gpu && window.aero.gpu.sondar) {
        const i0 = A.infoPC ? await A.infoPC() : {};
        if (i0.so === 'Linux') {
          const r = await window.aero.gpu.sondar({});
          const atual = (r && r.resultados || []).find((x) => x.id === r.atual);
          const hw = !!(atual && atual.placa);
          G.verificacao = { ok: !!(r && r.ok), hw, melhor: r && r.melhor, reiniciar: !!(r && r.reiniciar), impl: atual ? atual.impl : '', resultados: r && r.resultados, quando: Date.now() };
          if (G.resultado && G.resultado.linux) { G.resultado = { ...G.resultado, hw, impl: G.verificacao.impl, verificado: true }; A.evt.emit('gpu', G.resultado); }
          return G.verificacao;
        }
      }
      let perfis = null, wc = null;
      try { if (window.aero && window.aero.gpu && window.aero.gpu.codifica) perfis = await window.aero.gpu.codifica(); } catch (e) { /* ok */ }
      try {
        if (window.VideoEncoder && VideoEncoder.isConfigSupported) {
          const c = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1920, height: 1080, framerate: 60, bitrate: 12e6, hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' });
          wc = !!(c && c.supported);
        }
      } catch (e) { wc = false; }
      const r = await medir({ id: '720p30', larg: 1280, alt: 720, fps: 30, mbps: 4 }, { pref: 'h264-alto', aquecer: 900, janela: 1200 });
      const hw = !!((perfis && perfis.h264) || wc || (r.ok && r.hw));
      G.verificacao = { ok: true, hw, perfis: perfis && perfis.perfis, webcodecs: wc, teste: r, impl: r.impl || (hw ? 'VA-API (placa)' : ''), quando: Date.now() };
      if (G.resultado && G.resultado.linux) { G.resultado = { ...G.resultado, hw, impl: G.verificacao.impl, verificado: true }; A.evt.emit('gpu', G.resultado); }
      return G.verificacao;
    } finally { G.testando = false; }
  };

  G.testar = async ({ forcar = false, soCache = false } = {}) => {
    // (0.7.1) pedido de verificar (forcar) com o teste da abertura ainda rodando: espera ele acabar e verifica de novo (antes era ignorado)
    if (G.testando && forcar) { for (let n = 0; G.testando && n < 600; n++) await new Promise((r) => setTimeout(r, 100)); }
    if (G.testando) return G.resultado;
    if (A.plat.desktop && window.aero && window.aero.info) {
      const i0 = A.infoPC ? await A.infoPC() : {};
      if (i0.so === 'Linux') { G.resultado = resultadoLinux(i0); A.evt.emit('gpu', G.resultado); return G.resultado; }
    }
    // O resultado só vale para o MESMO navegador, a MESMA versão do app e o MESMO conjunto de flags da placa (se qualquer um mudou, testa de novo)
    const inf = A.infoPC ? await A.infoPC() : {};
    // (a versão do app NÃO entra: o teste codifica vídeo por vários segundos e refazê-lo a cada atualização deixava o app lento ao abrir)
    const chave = `${VERSAO_ALG}|${(navigator.userAgent.match(/Chrome\/[\d.]+|Version\/[\d.]+/) || ['?'])[0]}|${inf.flagsId || ''}`;
    const c = A.cfg.v.gpuCache;
    if (!forcar && c && c.chave === chave && Date.now() - c.quando < 30 * 86400000) { G.resultado = c.resultado; A.evt.emit('gpu', G.resultado); return G.resultado; }
    if (soCache) return null;
    if (!window.RTCPeerConnection || !HTMLCanvasElement.prototype.captureStream) { G.resultado = { testes: [], melhor: SEGURO, pref: 'auto', hw: false, codec: '', erro: 'sem-webrtc' }; return G.resultado; }
    // App do PC no Windows/macOS: pergunta ao Chromium se existe o codificador H.264 POR HARDWARE (NVIDIA NVENC, AMD, Intel). O teste por
    // estatística não enxergava a placa (fora de uma captura de tela o Chromium esconde o nome do codificador): uma RTX 3070 acabava
    // transmitindo pelo processador, em resolução baixa e travando. Com a placa confirmada: resolução nativa em H.264 pela placa.
    if (A.plat.desktop && window.VideoEncoder && VideoEncoder.isConfigSupported) {
      try {
        const c = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1920, height: 1080, framerate: 60, bitrate: 12e6, hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' });
        if (c && c.supported) {
          G.resultado = { testes: [], melhor: NATIVA, pref: 'h264-alto', hw: true, codec: 'video/H264', impl: 'placa (WebCodecs)', semTeste: true, quando: Date.now() };
          A.cfg.v.gpuCache = { chave, quando: Date.now(), resultado: G.resultado }; A.cfg.salvar();
          A.evt.emit('gpu', G.resultado); return G.resultado;
        }
      } catch (e) { /* segue para o teste */ }
    }
    G.testando = true; A.evt.emit('gpu', null);
    try {
      const r = await sequencia(medir);
      const ok = r.testes.find((t) => t.ok && t.pref === r.pref && t.id === r.melhor.id) || r.testes.find((t) => t.ok);
      G.resultado = { ...r, codec: (ok && ok.codec) || '', impl: (ok && ok.impl) || '', quando: Date.now() };
      A.cfg.v.gpuCache = { chave, quando: Date.now(), resultado: G.resultado }; A.cfg.salvar();
    } catch (e) { A.log.erro('teste gpu', e); G.resultado = { testes: [], melhor: SEGURO, pref: 'auto', hw: false, codec: '', erro: String(e.message || e) }; }
    G.testando = false;
    A.evt.emit('gpu', G.resultado);
    return G.resultado;
  };

  // Ao abrir: com o resultado guardado, vale na hora (nada roda). Sem ele, o teste (que codifica vídeo por alguns segundos e pesa)
  // espera o app ficar parado: janela em foco, fora de sala e de chamada, sem cliques há alguns segundos. Abrir a aba Transmitir
  // ou começar a transmitir antes disso roda o teste na hora (G.testar).
  G.agendar = () => {
    let ultimoUso = performance.now(), feito = false;
    const mexeu = () => { ultimoUso = performance.now(); };
    ['pointerdown', 'keydown', 'wheel'].forEach((e) => addEventListener(e, mexeu, { passive: true, capture: true }));
    const ocupado = () => !A.focado() || (A.sala && A.sala.ativa) || document.querySelector('.cham-janela') || performance.now() - ultimoUso < 8000;
    const tentar = () => {
      if (feito || G.resultado || G.testando) return;
      if (ocupado()) { setTimeout(tentar, 5000); return; }
      feito = true; G.testar().catch((e) => A.log.erro('gpu', e));
    };
    // primeiro só o resultado guardado (rápido); o teste de verdade, se precisar, fica para depois
    G.testar({ soCache: true }).then((r) => { if (!r) setTimeout(tentar, 20000); }).catch(() => setTimeout(tentar, 20000));
  };

  // Modos escolhidos à mão (o "Automático" vem do teste acima)
  // (0.5.9-7) a altura manda e a largura acompanha a tela: num monitor ultrawide (21:9, 32:9) "1440p" sai 3440x1440 (não espremido em 2560).
  // Por isso a largura máxima é folgada. Novos: 2K (1440p) e 4K (2160p).
  G.PRESETS = {
    leve: { larg: 2560, alt: 720, fps: 30, mbps: 3 },
    equilibrado: { larg: 3840, alt: 1080, fps: 60, mbps: 8 },
    alta: { larg: 3840, alt: 1080, fps: 60, mbps: 16 },
    '2k': { larg: 5120, alt: 1440, fps: 60, mbps: 24 },
    '4k': { larg: 7680, alt: 2160, fps: 60, mbps: 40 },
  };

  // O que o modo "Automático" usa
  G.preset = () => {
    const r = G.resultado;
    // quando a PLACA codifica (Windows/Linux no app do PC): resolução nativa, sem limite; quando é o processador, o modo que o teste provou fluido
    const m = r && (r.hw || (r.linux && r.melhor && r.melhor.nativa)) && A.plat.desktop ? NATIVA : (r && r.melhor) || SEGURO;
    return { larg: m.larg, alt: m.alt, fps: m.fps, mbps: m.mbps, id: m.id, nativa: !!m.nativa };
  };
  // (0.7.10) a qualidade é uma escolha só, com a mesma lista na sala e no Aero Talk: resolução e fps prontos, e a taxa sempre automática pelo
  // tamanho (a largura é folgada: num monitor ultrawide "1440p" sai 3440x1440). Sem escolha, vale o Automático da placa ou do teste
  G.RESOLUCOES = [480, 720, 1080, 1440, 2160]; G.FPS = [30, 60, 120, 240];
  // (0.7.14) acima de 1080p 60 fps é do Aero Bubble Donator (a escolha fica guardada: volta a valer quando o plano estiver ativo)
  const dev = () => !!(A.api && A.api.eu && A.api.eu.cargo === 'dev'); // (1.0.0) desenvolvedor: sem teto nenhum
  G.altaLiberada = () => dev() || !!(A.api && A.api.eu && A.api.eu.bolha && A.api.eu.bolha.alta);
  // (0.8.1) o teto pelo plano: 0 = até 1080p 60; 1 (Donator) = até 1440p 60 e 120 fps até 1080p; 2 (Supporter) = sem limite
  G.nivelTx = () => { if (dev()) return 2; const b = A.api && A.api.eu && A.api.eu.bolha; return !b ? 0 : Number.isInteger(b.tx) ? b.tx : b.alta ? 2 : 0; };
  G.maxRes = (n = G.nivelTx()) => (n >= 2 ? 2160 : n === 1 ? 1440 : 1080);
  G.maxFps = (alt, n = G.nivelTx()) => (n >= 2 ? 240 : n === 1 ? (alt <= 1080 ? 120 : 60) : 60);
  G.presetUsuario = () => {
    const c = A.cfg.v.host, base = G.preset(), livre = G.altaLiberada();
    let alt = G.RESOLUCOES.includes(+c.res) ? +c.res : base.alt;
    let fps = G.FPS.includes(+c.fps) ? +c.fps : +c.fps > 0 ? G.FPS.filter((x) => x <= +c.fps).pop() || 30 : base.fps;
    if (!livre || G.nivelTx() < 2) { alt = Math.min(alt, G.maxRes()); fps = Math.min(fps, G.maxFps(alt)); }
    return { ...base, larg: G.RESOLUCOES.includes(+c.res) ? Math.round((alt * 32) / 9) : base.larg, alt, fps, mbps: 0 };
  };
  // os dois seletores (sala, chamada e configurações usam estes). aoMudar: a escolha nova já está guardada
  G.seletoresQualidade = (aoMudar) => {
    const c = A.cfg.v.host, U = A.ui, p = G.presetUsuario(), mudar = (k, v) => { c[k] = +v; A.cfg.salvar(); if (aoMudar) aoMudar(); };
    const nome = (x) => (x === 2160 ? '4K' : x + 'p'), n = G.nivelTx(), mr = G.maxRes(n), mf = G.maxFps(0, n), cad = (ok, t) => (ok ? t : t + ' 🔒');
    // (0.7.14) o que o plano não cobre aparece com o cadeado e explica onde liberar (Donator: até 1440p 60 e 120 fps até 1080p; Supporter: tudo)
    const pedirBolha = () => U.toast(n >= 1 ? T('4K e 240 fps são do Aero Bubble Supporter (no Donator: até 1440p 60 fps e 120 fps até 1080p). Veja em Configurações > Apoie.', '4K and 240 fps are part of Aero Bubble Supporter (Donator: up to 1440p 60 fps and 120 fps up to 1080p). See Settings > Support.')
      : T('Acima de 1080p 60 fps é do Aero Bubble Donator e Supporter. Veja em Configurações > Apoie.', 'Above 1080p 60 fps is part of Aero Bubble Donator and Supporter. See Settings > Support.'));
    const segs = {}, voltar = (k, atual) => segs[k].querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', (k === 'res' ? G.RESOLUCOES : G.FPS)[i] === atual));
    const mudarCom = (k) => (v) => {
      if (+v > (k === 'res' ? mr : mf)) { pedirBolha(); const q = G.presetUsuario(); voltar(k, k === 'res' ? q.alt : q.fps); return; }
      // no Donator, 1440p vai até 60 fps: o outro seletor acompanha a escolha nova
      if (n === 1 && k === 'fps' && +v > 60 && +c.res > 1080) c.res = 1080;
      if (n === 1 && k === 'res' && +v > 1080 && +c.fps > 60) c.fps = 60;
      mudar(k, v);
      const q = G.presetUsuario(); voltar('res', q.alt); voltar('fps', q.fps);
    };
    segs.res = U.seg(G.RESOLUCOES.map((x) => [String(x), cad(x <= mr, nome(x))]), String(p.alt), mudarCom('res'));
    segs.fps = U.seg(G.FPS.map((x) => [String(x), cad(x <= mf, x + ' fps')]), String(p.fps), mudarCom('fps'));
    segs.res.classList.add('seg-qual'); segs.fps.classList.add('seg-qual'); // (1.0.0) quebra a linha em vez de cortar o 4K em painéis estreitos
    return [segs.res, segs.fps];
  };
  // O codec que a transmissão usa: o escolhido à mão, ou o que o teste provou ser o mais rápido neste computador
  // (0.6.0) a pessoa escolhe: placa de vídeo ou processador. Nada troca sozinho no meio da transmissão (antes o app alternava entre o
  // codificador da placa e o VP8 do processador, e cada troca derrubava o fps).
  G.codificador = () => { const h = A.cfg.v.host; if (h.codificador === 'cpu' || h.codificador === 'gpu') return h.codificador; return h.codec === 'vp8' || h.codec === 'h264-base' ? 'cpu' : 'gpu'; };
  G.usaPlaca = () => G.codificador() === 'gpu';

  // (0.7.7) IMAGEM VERDE (quem assiste): o decodificador da placa de alguns PCs mostra uma memória vazia (Y, U e V zerados) e por cima só o que mudou:
  // RGB 0,77,0 (BT.709) ou 0,135,0 (BT.601). Primeiro um quadro inteiro, depois o H.264 mais simples (Baseline) só para essa pessoa
  // (0.7.10) e, continuando verde, o decodificador próprio (receptor.js), na hora e sem reiniciar. O aviso de trocar o app inteiro para o
  // processador só aparece onde esse decodificador não existe: era ele que deixava a imagem da pessoa presa em 30 fps
  G._amostraVerde = null; // (para os testes)
  const vigia = {};
  // (1.0.3) a amostra da imagem (32x18 pontos) é feita em segundo plano: o navegador reduz o quadro (createImageBitmap) e só os 32x18 pontos
  // são lidos. Antes, ler o quadro inteiro de um vídeo 1080p parava a interface ~8 ms, duas vezes (verde e preto) a cada 2 s. Quem pergunta
  // recebe a amostra mais recente (de no máximo uns 4 s) e a próxima já é pedida; o verde e o preto usam a mesma amostra
  const desenhar = (fonte) => {
    const c = vigia.c || (vigia.c = Object.assign(document.createElement('canvas'), { width: 32, height: 18 })), g = vigia.g || (vigia.g = c.getContext('2d', { willReadFrequently: true }));
    g.drawImage(fonte, 0, 0, 32, 18); return g.getImageData(0, 0, 32, 18).data;
  };
  const WIN = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent || '');
  const pontos = (video) => {
    if (!video || !video.videoWidth || video.readyState < 2) return null;
    const agora = performance.now(), a = vigia.a;
    const fresca = a && a.v === video && agora - a.t < 4500 ? a.d : null;
    if (a && a.v === video && agora - a.t < 400) return fresca; // (a mesma vez: verde e preto juntos)
    // no Windows a amostra reduzida pela placa (createImageBitmap) pode vir preta com o vídeo decodificado pela placa, e uma imagem
    // "preta" fazia o Aero pedir para quem envia refazer o envio da tela: lá a leitura continua direto do vídeo
    if (typeof createImageBitmap !== 'function' || WIN) { try { const d = desenhar(video); vigia.a = { v: video, t: agora, d }; return d; } catch (e) { return null; } }
    if (!vigia.pedindo) {
      vigia.pedindo = true;
      createImageBitmap(video, { resizeWidth: 32, resizeHeight: 18, resizeQuality: 'low' })
        .then((bm) => { try { vigia.a = { v: video, t: performance.now(), d: desenhar(bm) }; } finally { bm.close(); } })
        .catch(() => {}).finally(() => { vigia.pedindo = false; });
    }
    return fresca;
  };
  const fracaoVerde = (video) => {
    const d = pontos(video); if (!d) return 0;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 12 && d[i + 2] < 12 && d[i + 1] > 60 && d[i + 1] < 170) n++;
    return n / (32 * 18);
  };
  G.imagemVerde = (video) => (G._amostraVerde ? G._amostraVerde() : fracaoVerde(video) >= 0.9);
  // (0.7.9) só parte da imagem verde: o que se mexe aparece e o resto fica verde. A falha é a mesma e, esperando a tela inteira, nada era pedido a quem envia
  G.verdeParcial = (video) => (G._amostraVerde ? G._amostraVerde() : fracaoVerde(video) >= 0.3);
  // (0.7.8) a imagem toda preta (a tela preta com os quadros chegando)
  G.imagemPreta = (video) => {
    const d = pontos(video); if (!d) return false;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 8 && d[i + 1] < 8 && d[i + 2] < 8) n++;
    return n >= 32 * 18 * 0.98;
  };
  let trocouDecodificador = false;
  G.decodificadorFalhou = async () => {
    if (trocouDecodificador) return; trocouDecodificador = true;
    const modo = A.cfg.v.gpuModo;
    A.log.aviso('imagem verde ou preta: o decodificador da placa deste PC falhou (modo ' + modo + ')');
    if (!window.aero || !window.aero.definirGpuModo || modo === 'software' || modo === 'semgpu') return;
    A.cfg.v.gpuModo = 'software'; A.cfg.salvar();
    await window.aero.definirGpuModo('software');
    if (await A.ui.confirmar(A.T('A placa de vídeo deste PC não conseguiu mostrar a imagem (tela verde ou preta). O vídeo agora será decodificado pelo processador. Reiniciar o app para aplicar?', 'This PC\'s graphics card could not show the picture (green or black screen). Video will now be decoded by the processor. Restart the app to apply?'), { sim: A.T('Reiniciar', 'Restart') })) window.aero.reiniciar();
  };
  // chamada 1x por segundo com o vídeo na tela. avisar(n): 1º aviso = quadro inteiro, 2º = Baseline. reserva(): liga o decodificador próprio
  G.vigiarVerde = (st, video, avisar, reserva) => {
    if (!G.verdeParcial(video)) { st.limpo = (st.limpo || 0) + 1; if (st.limpo >= 10) st.n = 0; return; } // (0.7.9) a imagem que pisca verde também conta: só 10 s limpos zeram
    st.limpo = 0; st.n = (st.n || 0) + 1;
    if (st.n === 2 || st.n === 4) avisar();
    if (st.n === 6 && !(reserva && reserva()) && G.imagemVerde(video)) G.decodificadorFalhou();
  };
  G.codecAtual = () => (G.usaPlaca() ? 'h264-alto' : 'vp8');
})();
