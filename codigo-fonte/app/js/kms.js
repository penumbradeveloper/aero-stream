// Aero Stream - captura direta da placa no MODO JOGO (Linux), como o Sunshine. Criado por Ryan Victtor.
//
// Por que: a captura normal do Linux pede a imagem ao KWin (portal + PipeWire), que a monta de novo e entrega copiada. Com o jogo usando a
// placa toda, o KWin fica sem vez e a transmissão caía para 30 fps. Aqui o app do PC lê o quadro que já está na tela (KMS), converte e
// codifica na própria placa (VA-API) e só os bytes codificados chegam a esta interface (veja desktop/captura/aero-kms.c).
//
// Como entra na conexão: uma trilha de vídeo de 16x16 (um quadrinho para cada quadro da placa) vai para o WebRTC como sempre, e o
// a transformação (trabalhador, abaixo) troca os bytes de cada quadrinho codificado pelos do quadro de verdade. Quem assiste recebe H.264 normal: nada muda do lado dele.
// A taxa acompanha o que o WebRTC calcula que a internet aguenta (targetBitrate), como o codificador do próprio Chromium faria.
//
// (0.7.6) UM CODIFICADOR POR PESSOA ("canais", até 8): a tela é lida uma vez e cada canal tem o seu tamanho, ritmo e taxa. Quem tem as
// mesmas configurações divide um canal (o codificador da placa tem limite: o da RX 580 faz ~70 quadros 1080p por segundo no total); quem
// precisa de menos (internet ruim, PC fraco) ganha o seu, menor. A imagem de quem transmite e a dos outros nunca mudam por causa de alguém.
//
// Se algo falhar (não instalado, sem permissão, o programa parou), a transmissão usa a captura normal: nunca fica sem imagem.
(() => {
  const A = window.Aero;
  const K = (A.kms = {});
  const nativo = () => (window.aero && window.aero.kms) || null;
  let trilha = null, escritor = null, tela = null, info = null, offQ = null, offF = null;
  const workers = new Map(); // sender -> Worker
  const canalDe = new Map(); // sender -> número do canal
  const pedidoDe = new Map(); // sender -> { kbps, teto } (a taxa que a internet dessa pessoa aguenta)
  // número -> { alt, fps, kbps, ultTaxa, ultIdr, idrT, desde, q (quadros neste segundo), fpsMed, lento }
  const canais = new Map();
  let base = { alt: 1080, fps: 60 }, ultU = -1, semCanalNovoAte = 0, orcamento = 0;
  let ignorarFimAte = 0, quadrosSeg = 0, bytesSeg = 0, med = { fps: 0, kbps: 0 }, tMed = 0;

  K.ligada = () => A.cfg.v.host.capturaDireta !== false;
  K.ativa = () => !!trilha;
  K.ehTrilha = (t) => !!trilha && t === trilha;
  K.info = () => (info ? { ...info, alvoFps: info.fps, ...med } : null); // fps = o medido agora; alvoFps = o pedido

  let cacheEstado = null;
  K.estado = async (forcar) => {
    const n = nativo(); if (!n) return { suportado: false, motivo: 'sem-app' };
    if (cacheEstado && !forcar) return cacheEstado;
    try { cacheEstado = await n.estado(!!forcar); } catch (e) { cacheEstado = { suportado: false, motivo: 'erro' }; }
    return cacheEstado;
  };
  K.instalar = async () => { const n = nativo(); if (!n) return { ok: false }; const r = await n.instalar(); cacheEstado = null; return r; };
  K.desinstalar = async () => { const n = nativo(); if (!n) return { ok: false }; const r = await n.desinstalar(); cacheEstado = null; return r; };
  // dá para usar AGORA? (Linux, app do PC, ligada nas configurações, programa instalado e o navegador com as peças necessárias)
  K.disponivel = async () => {
    if (!nativo() || !K.ligada() || !/Linux|Windows/i.test(navigator.userAgent)) return false;
    if (typeof MediaStreamTrackGenerator !== 'function' || typeof RTCRtpScriptTransform !== 'function' || typeof VideoFrame !== 'function') return false;
    const e = await K.estado();
    return !!(e && e.pronto);
  };

  // ---------- a transformação (roda num worker; vai como Blob porque o app do PC abre por file://, onde o Chromium não carrega worker de arquivo) ----------
  //
  // O Chromium continua achando que transmite um vídeo de 16x16 (um quadro minúsculo para cada quadro da placa). Logo depois de ele codificar
  // esse quadrinho, esta transformação troca os bytes pelos do quadro de verdade (H.264 da placa). O resto é a conexão de sempre: empacotamento,
  // reenvio de pacotes perdidos, controle da banda e o decodificador de quem assiste (que não precisa mudar nada).
  //
  // Regras para nunca mandar imagem quebrada:
  //  - começa (e recomeça) sempre num quadro inteiro; os pedaços que chegam antes disso são jogados fora
  //  - o Chromium pediu um quadro inteiro (quem assiste perdeu algo: o quadrinho dele sai "inteiro") -> pede um à placa
  //  - um quadrinho foi descartado pelo Chromium: a fila cresce; com mais de 3 na fila, recomeça num quadro inteiro (no máximo ~50 ms atrasado)
  function trabalhador() {
    let fila = [], esperandoInteiro = true, primeiro = true, quemEspera = null, ultT = 0, ultPedido = 0;
    const st = { enviados: 0, descartados: 0, inteiros: 0, pedidos: 0 };
    // (0.7.6) a conexão está puxando quadros agora? Parada (ainda conectando, internet caída, codificador pausado) não pede quadro inteiro
    // à placa: antes cada pessoa nessa situação pedia um a cada 4 quadros, e a imagem de TODO MUNDO ficava pixelada e engasgada
    const puxando = () => performance.now() - ultT < 300;
    // pedido de quadro inteiro; enquanto ele não chega, pede de novo (a cada 250 ms): um pedido perdido deixava a tela preta para sempre
    function pedir(motivo) { const agora = performance.now(); if (agora - ultPedido < 250) return; ultPedido = agora; st.pedidos++; postMessage({ t: 'idr', motivo }); }
    function recomecar(motivo) { esperandoInteiro = true; fila = []; if (puxando()) pedir(motivo); }

    function chegou(q) {
      if (esperandoInteiro) { if (!q.c) { st.descartados++; if (puxando()) pedir('esperando'); return; } esperandoInteiro = false; fila = []; }
      fila.push(q);
      if (fila.length > 3) { st.descartados += fila.length; recomecar('fila'); return; }
      if (quemEspera) { const f = quemEspera; quemEspera = null; f(); }
    }

    self.onmessage = (e) => { const m = e.data; if (m && m.t === 'q') chegou(m); else if (m && m.t === 'est') postMessage({ t: 'est', ...st, fila: fila.length }); else if (m && m.t === 'canal') recomecar('canal'); };

    // espera o quadro da placa por até 12 ms (normalmente ele chega antes do quadrinho)
    const esperar = () => new Promise((ok) => { const t = setTimeout(() => { quemEspera = null; ok(); }, 12); quemEspera = () => { clearTimeout(t); ok(); }; });

    self.onrtctransform = (ev) => {
      const tr = ev.transformer;
      tr.readable.pipeThrough(new TransformStream({
        async transform(quadro, saida) {
          const voltou = !puxando(); ultT = performance.now();
          if (quadro.type === 'key') { if (!primeiro) recomecar('pedido'); primeiro = false; }
          else if (voltou && !primeiro) recomecar('voltou'); // a conexão voltou a puxar (a internet voltou): recomeça num quadro inteiro
          if (esperandoInteiro) pedir('esperando');
          if (!fila.length && !esperandoInteiro) await esperar();
          const q = fila.shift();
          if (!q) return; // sem quadro da placa para este quadrinho: não manda nada
          quadro.data = q.d.byteOffset === 0 && q.d.byteLength === q.d.buffer.byteLength ? q.d.buffer : q.d.slice().buffer;
          if (q.c) st.inteiros++;
          st.enviados++;
          saida.enqueue(quadro);
        },
      })).pipeTo(tr.writable).catch(() => { /* a conexão fechou */ });
    };
  }
  const urlTrabalhador = () => K._url || (K._url = URL.createObjectURL(new Blob(['(' + trabalhador.toString() + ')()'], { type: 'text/javascript' })));

  // pedidos muito juntos viram um só, mas nenhum se perde (o de agora sai assim que der)
  // (por canal: o quadro inteiro de uma pessoa não pesa na imagem das outras)
  function pedirInteiro(id) {
    if (id == null) { for (const k of canais.keys()) pedirInteiro(k); return; }
    const c = canais.get(id); if (!c) return;
    const agora = performance.now(), falta = 120 - (agora - (c.ultIdr || 0));
    if (falta > 0) { if (!c.idrT) c.idrT = setTimeout(() => { c.idrT = 0; pedirInteiro(id); }, falta); return; }
    c.ultIdr = agora; const n = nativo(); if (n) n.idr(id);
  }

  // ---------- (0.7.6) os canais ----------
  const mesmo = (c, o) => c.alt === o.alt && c.fps === o.fps;
  // quanto a placa codifica (pixels por segundo). O orçamento começa no canal principal + 30% (a RX 580 faz ~1,3x um 1080p60) e diminui
  // se a placa engasgar: um canal a mais nunca pode derrubar o ritmo de quem já assiste
  const px = (o) => { const a = Math.min(o.alt, (info && info.alt) || o.alt), l = info && info.alt ? (info.larg * a) / info.alt : (a * 16) / 9; return l * a * Math.min(o.fps, base.fps); };
  const total = (fora) => { let t = 0; for (const [id, c] of canais) if (id !== fora) t += px(c); return t; };
  const cabe = (o, fora) => total(fora) + px(o) <= (orcamento || px(base) * 1.3);
  const usado = (id) => { for (const v of canalDe.values()) if (v === id) return true; return false; };
  function abrirCanal(id, o, kbps) {
    const n = nativo(); const c = { alt: o.alt, fps: o.fps, kbps: kbps || 2000, ultTaxa: 0, ultIdr: 0, idrT: 0, desde: performance.now(), q: 0, fpsMed: 0, lento: 0 };
    canais.set(id, c); if (n && n.canal) n.canal(id, { alt: c.alt, fps: c.fps, kbps: c.kbps });
    A.log.info('captura direta: canal ' + id + ' ' + c.alt + 'p ' + c.fps + ' fps');
    return c;
  }
  function fecharCanal(id) {
    const c = canais.get(id); if (!c) return;
    clearTimeout(c.idrT); canais.delete(id);
    const n = nativo(); if (n && n.fecharCanal) n.fecharCanal(id);
  }
  // ninguém mais no canal: fecha (a placa para de codificá-lo). Fica um só se a prévia precisar dele
  function talvezFechar(id) { if (usado(id) || !canais.has(id)) return; if (previa && canais.size === 1) return; fecharCanal(id); }
  // o canal de onde a prévia tira a imagem: o maior que estiver aberto
  const canalPrevia = () => { let m = null; for (const [id, c] of canais) if (m == null || c.alt > canais.get(m).alt) m = id; return m; };
  let ultPrevia = null;

  // ---------- (0.7.6) a SUA prévia na captura direta ----------
  // Aqui só existe o quadrinho cinza que marca o ritmo. Com "Sempre mostrar" a prévia nas Configurações, os mesmos quadros que vão para quem
  // assiste são decodificados AQUI (pela placa, com o WebCodecs) e viram uma trilha só para você. Nada muda para quem assiste.
  // Com o Aero em segundo plano (você no jogo) nada é decodificado: a prévia volta num quadro inteiro quando você volta para o Aero.
  let previa = null; // { gerador, escritor, dec, stream, esperando }
  const querPrevia = () => A.cfg.v.host.preview === 'sempre';
  const previaVisivel = () => !document.hidden && document.hasFocus();
  // "avc1.PPCCLL" do próprio SPS (perfil, restrições e nível que a placa usou)
  function codecDoSps(d) {
    for (let i = 0; i + 7 < d.length; i++) if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1 && (d[i + 3] & 31) === 7) return 'avc1.' + [d[i + 4], d[i + 5], d[i + 6]].map((x) => x.toString(16).padStart(2, '0')).join('');
    return null;
  }
  function abrirPrevia() {
    if (previa || typeof VideoDecoder !== 'function') return previa;
    try {
      const gerador = new MediaStreamTrackGenerator({ kind: 'video' }), escritor = gerador.writable.getWriter();
      previa = { gerador, escritor, dec: null, stream: new MediaStream([gerador]), esperando: true, ts: 0 };
    } catch (e) { previa = null; }
    return previa;
  }
  function fecharPrevia() {
    const p = previa; previa = null; if (!p) return;
    try { if (p.dec && p.dec.state !== 'closed') p.dec.close(); } catch (e) { /* ok */ }
    try { p.escritor.close().catch(() => {}); } catch (e) { /* ok */ }
    try { p.gerador.stop(); } catch (e) { /* ok */ }
  }
  function decodificar(c, d) {
    const p = previa; if (!p) return;
    if (!previaVisivel()) { p.esperando = true; return; }
    if (p.esperando) { if (!c) { pedirInteiro(canalPrevia()); return; } p.esperando = false; }
    if (!p.dec || p.dec.state === 'closed') {
      const codec = codecDoSps(d); if (!codec) { p.esperando = true; return; }
      p.dec = new VideoDecoder({
        output: (vf) => { if (previa !== p || p.escritor.desiredSize <= 0) { vf.close(); return; } p.escritor.write(vf).catch(() => {}); },
        error: (e) => { A.log.aviso('prévia da captura direta:', e && e.message); if (previa === p) { p.dec = null; p.esperando = true; } },
      });
      try { p.dec.configure({ codec, optimizeForLatency: true }); } catch (e) { p.dec = null; return; }
    }
    if (p.dec.decodeQueueSize > 2 && !c) return; // a placa não deu conta (raro): pula até o próximo quadro inteiro
    try { p.dec.decode(new EncodedVideoChunk({ type: c ? 'key' : 'delta', timestamp: (p.ts += 16667), data: d })); } catch (e) { p.esperando = true; }
  }
  // a trilha da prévia (ou null: sem "Sempre mostrar", ou navegador sem WebCodecs)
  K.previa = () => {
    if (!trilha || !querPrevia()) { fecharPrevia(); for (const id of [...canais.keys()]) talvezFechar(id); return null; }
    const p = abrirPrevia(); if (p && !canais.size) abrirCanal(0, base);
    if (p && p.esperando) pedirInteiro(canalPrevia()); return p ? p.stream : null;
  };
  addEventListener('focus', () => { if (previa) { previa.esperando = true; pedirInteiro(canalPrevia()); } });

  // liga a captura direta e devolve um MediaStream com a trilha (ou null, e a transmissão usa a captura normal)
  K.iniciar = async ({ preset } = {}, teste) => {
    K.parar();
    const n = nativo(); if (!n) return null;
    const p = preset || { alt: 1080, fps: 60 };
    try {
      trilha = new MediaStreamTrackGenerator({ kind: 'video' });
      escritor = trilha.writable.getWriter();
    } catch (e) { A.log.aviso('captura direta: navegador sem as peças', e); trilha = null; return null; }
    tela = new OffscreenCanvas(16, 16); const cx = tela.getContext('2d'); cx.fillStyle = '#808080'; cx.fillRect(0, 0, 16, 16); // sempre igual: o quadrinho não pede quadro inteiro sozinho
    let ts = 0; ultU = -1;
    base = { alt: p.alt || 1080, fps: p.fps || 60 };
    canais.clear(); canalDe.clear(); orcamento = 0; semCanalNovoAte = 0;
    offQ = n.aoQuadro((q) => {
      if (!trilha) return;
      const d = q.d instanceof Uint8Array ? q.d : new Uint8Array(q.d), k = q.k | 0;
      for (const [sd, w] of workers) if (canalDe.get(sd) === k) w.postMessage({ t: 'q', c: !!q.c, d });
      const ca = canais.get(k); if (ca) ca.q++;
      if (previa) { const cp = canalPrevia(); if (cp !== ultPrevia) { ultPrevia = cp; previa.esperando = true; } if (k === cp) decodificar(!!q.c, d); }
      bytesSeg += d.byteLength;
      // (0.7.6) o horário em que a placa CAPTUROU o quadro (µs), não um passo fixo de 16,667 ms: com o passo fixo, cada engasgo do PC (o jogo
      // segurando a placa) ou o ritmo da placa um pouco diferente de 60 desalinhava o relógio do vídeo, e quem assiste acumulava atraso
      // ("câmera lenta") e depois pulava para alcançar ("travando"). Um quadrinho por captura (os canais da mesma captura vêm com a mesma hora)
      if (+q.u > 0 && +q.u === ultU) return;
      ultU = +q.u || -1; quadrosSeg++;
      const u = +q.u > 0 ? +q.u : Math.round(performance.now() * 1000);
      ts = u > ts ? u : ts + 1;
      try { const vf = new VideoFrame(tela, { timestamp: ts }); escritor.write(vf).catch(() => {}); } catch (e) { /* trilha fechada */ }
    });
    // (ignorarFimAte: o programa antigo saindo numa troca de resolução não é "a captura parou")
    offF = n.aoFim((motivo) => { if (!trilha || performance.now() < ignorarFimAte) return; A.log.aviso('captura direta parou:', motivo); A.evt.emit('kms:fim', { motivo, trilha }); if (trilha) K.parar(); }); // a sala volta para a captura normal
    // (0.7.6) enquanto liga, o "parou" é do programa ANTERIOR saindo (o app recarregou ou voltou para a sala e ligou de novo): antes esse aviso
    // derrubava o programa novo e a transmissão caía para a captura normal. Se o novo falhar, a resposta abaixo já diz
    ignorarFimAte = Infinity;
    const r = await n.iniciar({ fps: p.fps || 60, altura: p.alt || 1080, kbps: 2000, teste: !!teste }).catch((e) => ({ ok: false, erro: e.message }));
    ignorarFimAte = performance.now() + 500;
    if (!r || !r.ok) { A.log.aviso('captura direta indisponível:', (r && r.erro) || '?'); K.parar(); return null; }
    info = { larg: r.larg, alt: r.alt, fps: r.fps };
    // o canal 0 já nasce com o programa. Começa baixo: a estimativa de banda do WebRTC começa baixa e sobe em 1-3 s (acima dela, os quadros atrasam na fila)
    canais.set(0, { alt: base.alt, fps: base.fps, kbps: 2000, ultTaxa: 0, ultIdr: 0, idrT: 0, desde: performance.now(), q: 0, fpsMed: 0, lento: 0 });
    A.log.info('captura direta da placa ligada: ' + r.larg + 'x' + r.alt + ' ' + r.fps + ' fps (KMS + VA-API, sem cópia)');
    return new MediaStream([trilha]);
  };

  // (0.7.6) outra resolução ou outro fps NO MEIO da transmissão: só o programa da placa recomeça; a trilha, as conexões, quem está no
  // controle e os controles virtuais continuam (antes a troca não valia: a placa seguia em 1080p60)
  K.trocar = async ({ alt, fps }) => {
    const n = nativo(); if (!trilha || !n) return false;
    ignorarFimAte = Infinity;
    const c0 = canais.get(0) || canais.values().next().value;
    const r = await n.iniciar({ fps: fps || 60, altura: alt || 1080, kbps: (c0 && c0.kbps) || 2000 }).catch((e) => ({ ok: false, erro: e.message }));
    ignorarFimAte = performance.now() + 500;
    if (!trilha) return false;
    if (!r || !r.ok) { A.log.aviso('captura direta: não deu para trocar', (r && r.erro) || '?'); const t = trilha; A.evt.emit('kms:fim', { motivo: 'trocar', trilha: t }); K.parar(); return false; }
    info = { larg: r.larg, alt: r.alt, fps: r.fps };
    // o programa recomeçou só com o canal 0 (no tamanho novo): todo mundo volta para ele, e a sala ajusta cada pessoa de novo (ajustar)
    base = { alt: alt || 1080, fps: fps || 60 }; orcamento = 0;
    for (const c of canais.values()) clearTimeout(c.idrT);
    canais.clear(); canais.set(0, { alt: base.alt, fps: base.fps, kbps: (c0 && c0.kbps) || 2000, ultTaxa: 0, ultIdr: 0, idrT: 0, desde: performance.now(), q: 0, fpsMed: 0, lento: 0 });
    for (const [sd, w] of workers) { canalDe.set(sd, 0); w.postMessage({ t: 'canal' }); }
    pedirInteiro(0);
    A.log.info('captura direta trocada: ' + r.larg + 'x' + r.alt + ' ' + r.fps + ' fps');
    return true;
  };

  K.parar = () => {
    fecharPrevia();
    if (offQ) offQ(); if (offF) offF(); offQ = offF = null;
    for (const w of workers.values()) w.terminate();
    workers.clear(); canalDe.clear(); pedidoDe.clear();
    for (const c of canais.values()) clearTimeout(c.idrT);
    canais.clear();
    const n = nativo(); if (trilha && n) n.parar().catch(() => {});
    try { if (escritor) escritor.close().catch(() => {}); } catch (e) { /* ok */ }
    try { if (trilha) trilha.stop(); } catch (e) { /* ok */ }
    trilha = null; escritor = null; info = null; tela = null;
  };

  // uma conexão nova recebe a trilha: só H.264 (é o que a placa faz), sem o "descritor de dependências" (quem assiste lê o tipo de cada
  // quadro do próprio H.264, e não do quadrinho) e com a transformação que troca os bytes
  K.prepararSender = (sender, tr) => {
    if (!tr || workers.has(sender)) return;
    try {
      const caps = (RTCRtpSender.getCapabilities('video') || { codecs: [] }).codecs;
      const h264 = caps.filter((c) => /h264/i.test(c.mimeType) && /packetization-mode=1/.test(c.sdpFmtpLine || ''));
      const ordem = (c) => (/profile-level-id=4d/.test(c.sdpFmtpLine) ? 0 : /profile-level-id=64/.test(c.sdpFmtpLine) ? 1 : 2); // a placa faz Main
      const extras = caps.filter((c) => /rtx|red|ulpfec/i.test(c.mimeType));
      if (h264.length) tr.setCodecPreferences([...h264.sort((a, b) => ordem(a) - ordem(b)), ...extras]);
    } catch (e) { A.log.aviso('captura direta: codec', e); }
    try {
      if (tr.getHeaderExtensionsToNegotiate) {
        const ex = tr.getHeaderExtensionsToNegotiate().map((x) => (/dependency-descriptor|generic-frame-descriptor|video-layers-allocation/.test(x.uri) && x.direction !== 'stopped' ? { ...x, direction: 'stopped' } : x));
        tr.setHeaderExtensionsToNegotiate(ex);
      }
    } catch (e) { A.log.aviso('captura direta: extensões', e); }
    const w = new Worker(urlTrabalhador());
    w.onmessage = (e) => { const m = e.data || {}; if (m.t === 'idr') pedirInteiro(canalDe.get(sender)); else if (m.t === 'est') { K._est = m; K._ests.set(sender, m); } };
    try { sender.transform = new RTCRtpScriptTransform(w, {}); } catch (e) { A.log.aviso('captura direta: transformação', e); w.terminate(); return; }
    workers.set(sender, w);
    canalDe.set(sender, entrar(base, null));
    pedirInteiro(canalDe.get(sender)); // quem chegou começa num quadro inteiro
  };
  K.soltarSender = (sender) => {
    const w = workers.get(sender); if (!w) return;
    w.terminate(); workers.delete(sender); K._ests.delete(sender); pedidoDe.delete(sender);
    const id = canalDe.get(sender); canalDe.delete(sender); talvezFechar(id);
  };
  K._ests = new Map();

  // o canal para essas configurações: um que já existe igual (divide), ou um novo (se a placa tiver folga e houver número livre)
  function entrar(o, kbps) {
    for (const [id, c] of canais) if (mesmo(c, o)) return id;
    const livre = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !canais.has(i));
    if (livre != null && (!canais.size || (performance.now() > semCanalNovoAte && cabe(o)))) { abrirCanal(livre, o, kbps); return livre; }
    // sem folga: o maior canal que já existe (a pessoa recebe a imagem de sempre; nada muda para os outros)
    return canalPrevia() ?? (abrirCanal(0, o, kbps), 0);
  }

  // (0.7.6) o tamanho e o ritmo que ESSA pessoa deve receber (a sala decide: a internet e o PC dela). Nunca acima do que você escolheu
  K.ajustar = (sender, { alt, fps } = {}) => {
    if (!workers.has(sender) || !trilha) return;
    const o = { alt: Math.min(base.alt, Math.max(144, Math.round(alt || base.alt))), fps: Math.min(base.fps, Math.max(10, Math.round(fps || base.fps))) };
    const id = canalDe.get(sender), c = canais.get(id);
    if (c && mesmo(c, o)) return;
    const igual = [...canais].find(([, x]) => mesmo(x, o));
    let novo;
    if (!igual && c && ![...canalDe].some(([sd, v]) => v === id && sd !== sender)) {
      if (px(o) > px(c) && !cabe(o, id)) return; // aumentar este canal passaria do que a placa aguenta
      // sozinha no canal: o próprio canal muda (a placa refaz só esse codificador)
      c.alt = o.alt; c.fps = o.fps; c.desde = performance.now(); c.lento = 0;
      const n = nativo(); if (n && n.canal) n.canal(id, { alt: c.alt, fps: c.fps, kbps: c.kbps });
      A.log.info('captura direta: canal ' + id + ' agora ' + c.alt + 'p ' + c.fps + ' fps');
      novo = id;
    } else {
      novo = igual ? igual[0] : entrar(o, c && c.kbps);
      if (novo === id) return;
      canalDe.set(sender, novo); talvezFechar(id);
    }
    workers.get(sender).postMessage({ t: 'canal' }); // recomeça num quadro inteiro do canal novo
    pedirInteiro(novo);
  };
  // o canal dessa pessoa (para as estatísticas)
  K.canalDe = (sender) => { const id = canalDe.get(sender), c = canais.get(id); if (!c) return null; const larg = info && info.alt ? Math.round((info.larg * Math.min(c.alt, info.alt)) / info.alt) & ~1 : 0; return { id, alt: Math.min(c.alt, (info && info.alt) || c.alt), larg, fps: c.fps, fpsMed: c.fpsMed, kbps: c.kbps }; };
  K.canais = () => [...canais].map(([id, c]) => ({ id, alt: c.alt, fps: c.fps, kbps: c.kbps, fpsMed: c.fpsMed, pessoas: [...canalDe.values()].filter((v) => v === id).length }));

  // a taxa de cada canal acompanha o que o WebRTC acha que a internet DE CADA PESSOA aguenta (num canal dividido, a menor entre elas).
  // Cair é na hora; subir, aos poucos
  K.taxaAlvo = (kbps, tetoKbps, sender) => {
    const n = nativo(); if (!trilha || !n || !(kbps > 0)) return;
    if (sender) pedidoDe.set(sender, { kbps, teto: tetoKbps }); else for (const sd of workers.keys()) pedidoDe.set(sd, { kbps, teto: tetoKbps });
    const agora = performance.now();
    for (const [id, c] of canais) {
      let k = Infinity;
      for (const [sd, v] of canalDe) if (v === id) { const p = pedidoDe.get(sd); if (p) k = Math.min(k, Math.min(p.teto > 0 ? p.teto : 50000, Math.max(500, Math.round(p.kbps * 0.92)))); }
      if (!Number.isFinite(k)) continue;
      const caiu = k < c.kbps * 0.8, subiu = k > c.kbps * 1.25; // os mesmos limites do aero-kms (abaixo disso ele ignora)
      if ((caiu && agora - c.ultTaxa > 250) || (subiu && agora - c.ultTaxa > 2000)) { c.kbps = k; c.ultTaxa = agora; n.taxa(k, id); }
    }
  };
  // números ao vivo (1x por segundo, chamado pelas estatísticas da sala)
  K.medir = () => {
    const agora = performance.now(), dt = (agora - (tMed || agora - 1000)) / 1000; tMed = agora;
    med = { fps: Math.round((quadrosSeg / dt) * 10) / 10, kbps: (bytesSeg * 8) / dt / 1000 }; quadrosSeg = 0; bytesSeg = 0;
    // a placa não está dando conta de todos os canais (algum saindo abaixo de 85% do ritmo por 3 s): o canal mais novo é desfeito e quem
    // estava nele volta para o maior (que é o de sempre). Por 2 min não abre canal novo
    for (const c of canais.values()) { c.fpsMed = Math.round((c.q / dt) * 10) / 10; c.q = 0; c.lento = agora - c.desde > 3000 && c.fpsMed < c.fps * 0.85 ? c.lento + 1 : 0; }
    if (canais.size > 1 && [...canais.values()].some((c) => c.lento >= 3)) {
      const maior = canalPrevia(); const [idNovo] = [...canais].filter(([id]) => id !== maior).sort((a, b) => b[1].desde - a[1].desde)[0];
      A.log.aviso('captura direta: a placa não dá conta de ' + canais.size + ' canais (' + K.canais().map((c) => c.alt + 'p' + c.fps + ': ' + c.fpsMed).join(', ') + ') - juntando');
      semCanalNovoAte = agora + 120000; orcamento = total(idNovo) + px(canais.get(idNovo)) * 0.5; // o orçamento fica entre o que deu e o que não deu
      for (const [sd, v] of canalDe) if (v === idNovo) { canalDe.set(sd, maior); const w = workers.get(sd); if (w) w.postMessage({ t: 'canal' }); }
      fecharCanal(idNovo); pedirInteiro(maior);
      for (const c of canais.values()) { c.lento = 0; c.desde = agora; }
    }
    for (const w of workers.values()) w.postMessage({ t: 'est' });
    return med;
  };
  // o bloco da aba Transmitir: ligar/desligar e instalar (uma vez, com a senha do sistema)
  K.painel = () => {
    const h = A.h, U = A.ui, T = A.T;
    const txt = h('div', { class: 'peq suave' }), acoes = h('div', { class: 'linha', estilo: { 'margin-top': '8px', gap: '8px', 'flex-wrap': 'wrap' } });
    const chave = U.chave(K.ligada(), (v) => { A.cfg.v.host.capturaDireta = v; A.cfg.salvar(); pintar(); });
    const FALTA = { gcc: T('o compilador (gcc)', 'the compiler (gcc)'), ffmpeg: T('o ffmpeg com VA-API', 'ffmpeg with VA-API'), pkexec: 'pkexec (polkit)', placa: T('uma placa de vídeo com saída ligada', 'a GPU with a connected output') };
    async function pintar(forcar) {
      acoes.textContent = '';
      const e = await K.estado(forcar);
      if (!K.ligada()) { txt.textContent = T('Desligada: o modo jogo usa a captura normal (portal do sistema).', 'Off: game mode uses normal capture (system portal).'); return; }
      if (e.windows && !e.pronto) txt.textContent = T('Experimental. O Aero baixa uma vez o FFmpeg oficial (110 MB, sem pedir senha) e testa a sua placa. Se algo falhar, a captura normal assume sozinha.', 'Experimental. Aero downloads the official FFmpeg once (110 MB, no password) and tests your GPU. If anything fails, normal capture takes over on its own.');
      else if (e.pronto) txt.textContent = T('Pronta: no modo jogo a imagem vem direto da placa (sem cópia), com menos atraso e mais fps. Se algo falhar, a captura normal assume sozinha.', 'Ready: in game mode the picture comes straight from the GPU (no copies), with less delay and more fps. If anything fails, normal capture takes over on its own.');
      else if (!e.suportado) txt.textContent = T('Este computador não tem: ', 'This computer is missing: ') + (e.faltando || []).map((f) => FALTA[f] || f).join(', ') + '.';
      else txt.textContent = e.instalado ? T('Precisa ser atualizada (versão nova do Aero). Leva alguns segundos e pede a senha do sistema.', 'Needs an update (new Aero version). Takes a few seconds and asks for the system password.') : T('Precisa ser instalada uma vez: o Aero compila um programa pequeno e o sistema pede a sua senha para dar a ele a permissão de ler a tela (a mesma do Sunshine).', 'Needs a one-time install: Aero builds a small program and the system asks for your password to let it read the screen (the same permission Sunshine uses).');
      if (e.suportado && !e.pronto) acoes.append(U.btn(e.instalado ? T('Atualizar', 'Update') : T('Instalar', 'Install'), { icone: 'download', peq: true, onclick: async (ev) => {
        const b = ev.currentTarget; b.disabled = true; txt.textContent = e.windows ? T('Baixando e testando a placa... (pode levar alguns minutos)', 'Downloading and testing the GPU... (may take a few minutes)') : T('Compilando e instalando... (o sistema vai pedir a senha)', 'Building and installing... (the system will ask for the password)');
        const r = await K.instalar().catch((x) => ({ ok: false, erro: x.message }));
        if (!r.ok) U.toast(r.motivo === 'cancelado' ? T('Instalação cancelada.', 'Install cancelled.') : T('Não deu para instalar: ', 'Could not install: ') + (r.erro || r.motivo || '?'), { tipo: 'erro', ms: 9000 });
        else U.toast(T('Captura direta pronta. Vale na próxima transmissão em modo jogo.', 'Direct capture ready. Applies to the next game-mode stream.'), { tipo: 'ok' });
        pintar(true);
      } }));
      if (e.instalado) acoes.append(U.btn(T('Remover', 'Remove'), { tipo: 'sec', peq: true, onclick: async () => { await K.desinstalar(); pintar(true); } }));
    }
    pintar();
    return h('div', { class: 'col', estilo: { gap: '6px' } }, h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, T('Captura direta da placa (modo jogo)', 'Direct GPU capture (game mode)'))), chave), txt, acoes);
  };
  K._workers = workers; // para os testes
  K._previa = () => previa && { esperando: previa.esperando, dec: previa.dec && previa.dec.state, fila: previa.dec && previa.dec.decodeQueueSize, foco: document.hasFocus(), oculto: document.hidden };
})();
