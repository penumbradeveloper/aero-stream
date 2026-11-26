// Aero Stream - o receptor de vídeo (quem ASSISTE a uma tela, na sala e na chamada). Criado por Ryan Victtor.
//
// Todo vídeo de tela passa por um worker antes do decodificador do navegador, com dois trabalhos:
//  - ORDEM DO QUADRO INTEIRO: o WebRTC entrega o quadro inteiro do H.264 com a imagem (IDR) ANTES dos cabeçalhos (SPS e PPS). O FFmpeg do WebCodecs
//    recusa esse quadro, e o decodificador de placa do Chromium (o de todo PC com Windows) monta a imagem com os cabeçalhos antigos ou
//    espera o próximo quadro inteiro: era a tela verde ou preta. Aqui os cabeçalhos voltam para a frente. Barato: só mexe no quadro inteiro.
//  - DECODIFICADOR PRÓPRIO (o "reserva"): quando o decodificador do navegador falha (verde) ou não dá conta (a fila cresce: com o processador no
//    limite chegava a 4 s de atraso, a "câmera lenta"), o vídeo vai para o WebCodecs aqui no worker, SEM reiniciar o app. Ele nunca acumula fila:
//    passou de 2 quadros esperando, pula até o próximo quadro inteiro (no mesmo teste, 0,5 s no lugar de 4 s). O navegador continua recebendo
//    um quadrinho minúsculo no lugar de cada quadro: assim os reenvios, as estatísticas e os avisos dele seguem funcionando como sempre.
(() => {
  const A = window.Aero;
  function trabalhador() {
    const MINI = Uint8Array.from(atob('AAAAAWdCwArd7ARAAAADAEAAAAMAg8SJ4AAAAAFozg/IAAABZYiEOiYoDg=='), (c) => c.charCodeAt(0)); // H.264 de um quadro 16x16 cinza
    const miniBuf = () => { const c = new ArrayBuffer(MINI.length); new Uint8Array(c).set(MINI); return c; };
    let modo = 'passa', placa = false, acel = 'no-preference', dec = null, esperando = true, ultPedido = 0, tr = null, log2 = 0, numAnt = -1, fila = [], filaT = 0;
    let st = { q: 0, ms: 0, desc: 0, w: 0, h: 0, err: 0 };
    const tot = { ent: 0, sai: 0 }; // (1.0.4) para a página conferir se o decodificador próprio está soltando imagem
    const inicio = new Map();
    // onde começa cada unidade (NAL) do quadro: [início com o código, tipo]
    const unidades = (d) => { const o = []; for (let i = 0; i + 3 < d.length; i++) if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1) { o.push([i > 0 && d[i - 1] === 0 ? i - 1 : i, d[i + 3] & 31, i + 3]); i += 2; } return o; };
    function ordenar(d) {
      const u = unidades(d), pos = (t) => u.findIndex((x) => x[1] === t), idr = pos(5), sps = pos(7), pps = pos(8);
      if (idr < 0 || sps < 0 || pps < 0 || (sps < idr && pps < idr)) return null; // já está certo (ou nem tem cabeçalho)
      const pedacos = u.map((x, k) => [x[1], d.subarray(x[0], k + 1 < u.length ? u[k + 1][0] : d.length)]), o = new Uint8Array(d.length); let n = 0;
      for (const [t, p] of pedacos) if (t === 7 || t === 8) { o.set(p, n); n += p.length; }
      for (const [t, p] of pedacos) if (t !== 7 && t !== 8) { o.set(p, n); n += p.length; }
      return o;
    }
    // leitor de bits, sem os bytes de proteção (00 00 03) do começo da unidade
    function bits(d, ini) {
      const b = []; for (let i = ini; i < d.length && b.length < 96; i++) { if (i >= ini + 2 && d[i] === 3 && d[i - 1] === 0 && d[i - 2] === 0) continue; b.push(d[i]); }
      let p = 0; const u1 = () => { const v = ((b[p >> 3] || 0) >> (7 - (p & 7))) & 1; p++; return v; }, u = (n) => { let v = 0; while (n-- > 0) v = v * 2 + u1(); return v; };
      const ue = () => { let z = 0; while (z < 32 && p < b.length * 8 && !u1()) z++; return 2 ** z - 1 + u(z); };
      return { u, ue };
    }
    function lerSps(d, ini) { // só até o tamanho do número do quadro
      const r = bits(d, ini), perfil = r.u(8); r.u(16); r.ue();
      if ([100, 110, 122, 244, 44, 83, 86, 118, 128].includes(perfil)) { if (r.ue() === 3) r.u(1); r.ue(); r.ue(); r.u(1); if (r.u(1)) return 0; } // (matriz própria no SPS: nenhum codificador daqui usa)
      return r.ue() + 4;
    }
    const numeroDe = (d, ini) => { const r = bits(d, ini); r.ue(); r.ue(); r.ue(); return r.u(log2); };
    const codecDe = (d, u) => { const s = u.find((x) => x[1] === 7); return s ? 'avc1.' + [d[s[2] + 1], d[s[2] + 2], d[s[2] + 3]].map((x) => x.toString(16).padStart(2, '0')).join('') : null; };
    function pedir() { const t = performance.now(); if (t - ultPedido < 900) return; ultPedido = t; if (tr && tr.sendKeyFrameRequest) tr.sendKeyFrameRequest().catch(() => {}); }
    function abrir(codec) {
      inicio.clear(); // (os quadros do decodificador antigo não saem mais: não podem contar como "esperando")
      try {
        dec = new VideoDecoder({
          output: (v) => { tot.sai++; const t0 = inicio.get(v.timestamp); inicio.delete(v.timestamp); if (t0) st.ms += performance.now() - t0; st.q++; st.w = v.displayWidth; st.h = v.displayHeight; postMessage({ t: 'quadro', v }, [v]); },
          error: (e) => { st.err++; inicio.clear(); postMessage({ t: 'erro', msg: e && e.message }); dec = null; esperando = true; pedir(); },
        });
        dec.configure({ codec, optimizeForLatency: true, hardwareAcceleration: placa ? acel : 'prefer-software' });
      } catch (e) { dec = null; postMessage({ t: 'erro', msg: String(e) }); }
    }
    let ts = 0;
    function decodificar(d, key) {
      const t = (ts += 16667); inicio.set(t, performance.now()); if (inicio.size > 240) inicio.clear();
      try { dec.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: t, data: d })); } catch (e) { dec = null; esperando = true; pedir(); }
    }
    // a próxima imagem na ordem. Um quadro pode chegar fora de ordem (o pacote perdido foi reenviado): espera ~35 ms por ele; não veio, recomeça num quadro inteiro
    function andar() {
      for (;;) {
        const i = fila.findIndex((f) => f.n === (numAnt + 1) % 2 ** log2 || f.n === numAnt);
        if (i < 0) break;
        const [f] = fila.splice(i, 1); numAnt = f.n; decodificar(f.d, false);
      }
      fila = fila.filter((f) => ((f.n - numAnt + 2 ** log2) % 2 ** log2) < 2 ** (log2 - 1));
      clearTimeout(filaT);
      if (fila.length) filaT = setTimeout(() => { fila = []; esperando = true; st.desc++; pedir(); }, 35);
    }
    function proprio(f, d0) {
      tot.ent++;
      const key = f.type === 'key', d = key ? ordenar(d0) || d0 : d0;
      if (esperando && !key) { st.desc++; pedir(); return; }
      if (key) {
        const u = unidades(d), s = u.find((x) => x[1] === 7), idr = u.find((x) => x[1] === 5), codec = codecDe(d, u);
        if (!s || !idr) { pedir(); return; }
        log2 = lerSps(d, s[2] + 1) || log2;
        if (!log2) { esperando = true; return; }
        if (!dec || dec.state === 'closed') { if (!codec) return; abrir(codec); if (!dec) return; }
        fila = []; clearTimeout(filaT); esperando = false; numAnt = 0;
        decodificar(d, true); return;
      }
      if (!dec) { esperando = true; pedir(); return; }
      // nunca acumula fila: é ela que vira câmera lenta. (0.8.4) Mas uma RAJADA de quadros (o PC de quem transmite deu uma engasgada com o jogo e
      // soltou vários de uma vez) enche a fila por um instante sem atraso nenhum: a 120 fps, 7 quadros são 58 ms. Jogar tudo fora ali e esperar
      // um quadro inteiro era um engasgo a mais (e o aviso de "PC lento" derrubava a tela para 30 fps à toa). Só conta o que espera mais de 150 ms
      if (dec.decodeQueueSize > 6) {
        const velho = inicio.values().next().value, espera = velho ? performance.now() - velho : 0;
        if (espera > 150 || dec.decodeQueueSize > 24) { st.desc++; esperando = true; fila = []; inicio.clear(); postMessage({ t: 'atras', ms: Math.round(espera) }); pedir(); return; }
      }
      const u = unidades(d), v = u.find((x) => x[1] === 1 || x[1] === 5); if (!v) return;
      const n = numeroDe(d, v[2] + 1);
      if (fila.length > 8) { fila = []; esperando = true; st.desc++; pedir(); return; }
      fila.push({ n, d }); andar();
    }
    self.onmessage = (e) => {
      const m = e.data || {};
      if (m.t === 'proprio') {
        modo = 'proprio'; placa = !!m.placa; esperando = true;
        if (dec) { try { dec.close(); } catch (er) { /* ok */ } dec = null; } // (trocou de placa para processador: reabre no próximo quadro inteiro)
        // (1.0.0) com a placa: pede o decodificador DELA de verdade quando ela tem um (o "sem preferência" podia cair no processador)
        if (placa) VideoDecoder.isConfigSupported({ codec: 'avc1.42e01f', hardwareAcceleration: 'prefer-hardware' }).then((r) => { acel = r && r.supported ? 'prefer-hardware' : 'no-preference'; }).catch(() => {});
        pedir();
      }
      // (1.0.4) volta para o decodificador do navegador (o próprio não soltou imagem neste aparelho)
      else if (m.t === 'passa') { modo = 'passa'; esperando = true; fila = []; clearTimeout(filaT); inicio.clear(); if (dec) { try { dec.close(); } catch (er) { /* ok */ } dec = null; } ultPedido = 0; pedir(); }
      else if (m.t === 'saude') postMessage({ t: 'saude', ...tot });
      else if (m.t === 'est') { postMessage({ t: 'est', ...st }); st = { ...st, q: 0, ms: 0 }; }
      else if (m.t === 'inteiro') { ultPedido = 0; pedir(); }
    };
    self.onrtctransform = (ev) => {
      tr = ev.transformer;
      tr.readable.pipeThrough(new TransformStream({
        transform(f, saida) {
          if (f.type === 'empty') { saida.enqueue(f); return; }
          if (modo === 'passa' && f.type !== 'key') { saida.enqueue(f); return; }
          const h264 = /h264/i.test((f.getMetadata() || {}).mimeType || 'h264');
          if (!h264) { saida.enqueue(f); return; }
          const d = new Uint8Array(f.data);
          if (modo === 'passa') { const o = ordenar(d); if (o) f.data = o.buffer; saida.enqueue(f); return; }
          proprio(f, d);
          f.data = miniBuf(); saida.enqueue(f);
        },
      })).pipeTo(tr.writable).catch(() => { /* a conexão fechou */ });
    };
  }
  const url = () => R._url || (R._url = URL.createObjectURL(new Blob(['(' + trabalhador.toString() + ')()'], { type: 'text/javascript' })));
  const controles = new WeakMap(), vivos = new Set();
  // fechar a conexão não avisa a trilha nem o worker: quem confere é este relógio (só roda com vídeo recebido)
  let relogio = 0;
  const conferir = () => {
    for (const ctl of vivos) if (ctl.receiver.track.readyState === 'ended') { vivos.delete(ctl); ctl.w.terminate(); try { if (ctl.gerador) ctl.gerador.stop(); } catch (e) { /* ok */ } }
    if (!vivos.size) { clearInterval(relogio); relogio = 0; }
  };
  const R = (A.receptor = {
    disponivel: () => typeof RTCRtpScriptTransform === 'function' && typeof Worker === 'function',
    // (1.0.0) este aparelho decodifica H.264 na placa pelo WebCodecs? (uma vez só)
    temPlaca: () => R._placa || (R._placa = (typeof VideoDecoder === 'function' ? VideoDecoder.isConfigSupported({ codec: 'avc1.42e01f', hardwareAcceleration: 'prefer-hardware' }).then((r) => !!(r && r.supported)).catch(() => false) : Promise.resolve(false))),
    podeProprio: () => typeof VideoDecoder === 'function' && typeof MediaStreamTrackGenerator === 'function' && typeof VideoFrame === 'function',
    _vivos: () => vivos.size, // (para os testes)
    de: (receiver) => (receiver && controles.get(receiver)) || null,
    // (1.0.3) pede um quadro inteiro a quem envia pelo próprio WebRTC (RTCP PLI). O codificador de lá só solta o próximo quadro inteiro: sem
    // desligar e religar o envio (era isso que congelava a tela por um instante, e às vezes por segundos com o codificador da placa)
    pedirInteiro: (receiver) => { const c = receiver && controles.get(receiver); if (!c) return false; try { c.w.postMessage({ t: 'inteiro' }); return true; } catch (e) { return false; } },
    // liga o worker neste receptor de vídeo (pode chamar mais de uma vez: a mesma conexão renegocia)
    ligar(receiver) {
      if (!receiver || !R.disponivel()) return null;
      const ja = controles.get(receiver); if (ja) return ja;
      let w;
      try { w = new Worker(url()); receiver.transform = new RTCRtpScriptTransform(w, {}); } catch (e) { A.log.aviso('receptor de vídeo:', e); if (w) w.terminate(); return null; }
      const ctl = { w, receiver, proprio: false, atras: 0, est: { fps: 0, ms: 0, desc: 0, w: 0, h: 0 }, gerador: null, escritor: null };
      w.onmessage = (e) => {
        const m = e.data || {};
        if (m.t === 'quadro') { const es = ctl.escritor; if (!es || es.desiredSize <= 0) { m.v.close(); return; } ctl.escritos++; es.write(m.v).catch(() => {}); }
        else if (m.t === 'saude') vigiar(m);
        else if (m.t === 'atras') ctl.atras++;
        else if (m.t === 'erro') A.log.aviso('decodificador próprio:', m.msg);
        else if (m.t === 'est') ctl.est = { fps: m.q, ms: m.q ? Math.round((m.ms / m.q) * 10) / 10 : 0, desc: m.desc, w: m.w, h: m.h };
      };
      // (1.0.4) VIGIA DO DECODIFICADOR PRÓPRIO: chegam quadros e nenhuma imagem sai dele (o decodificador deste aparelho não aceitou o vídeo,
      // ou a imagem não chega na tela) por 2,5 s: volta para o do navegador, que estava mostrando a imagem. Antes a tela ficava parada no
      // primeiro quadro até sair da sala. Nessa conexão ele não liga de novo
      ctl.escritos = 0;
      let saude = null, saudeT = 0;
      const vigiar = (m) => {
        if (!ctl.proprio) return;
        const agora = performance.now();
        if (!saude || ctl.escritos > saude.esc) { saude = { ent: m.ent, esc: ctl.escritos, t: agora }; return; }
        if (m.ent - saude.ent >= 20 && agora - saude.t > 2500) voltar('nenhuma imagem saiu dele em ' + Math.round((agora - saude.t) / 100) / 10 + ' s');
      };
      const voltar = (motivo) => {
        if (!ctl.proprio) return;
        clearInterval(saudeT); saudeT = 0; ctl.proprio = false; ctl.falhou = true; saude = null;
        const st = ctl.stream, g = ctl.gerador;
        try { if (st && g) { st.removeTrack(g); if (ctl.velha && ctl.velha.readyState === 'live' && !st.getVideoTracks().includes(ctl.velha)) st.addTrack(ctl.velha); } } catch (e) { /* ok */ }
        try { if (ctl.escritor) ctl.escritor.releaseLock(); } catch (e) { /* ok */ }
        try { if (g) g.stop(); } catch (e) { /* ok */ }
        ctl.gerador = null; ctl.escritor = null;
        w.postMessage({ t: 'passa' });
        A.log.aviso('receptor de vídeo: decodificador próprio desligado (' + motivo + '), volta o do navegador');
      };
      ctl.voltar = voltar;
      ctl.medir = () => { if (ctl.proprio) w.postMessage({ t: 'est' }); return ctl.est; };
      // passa para o decodificador próprio. A trilha nova entra no MESMO pacote de vídeo (stream), então quem já mostra esse pacote não muda nada.
      // placa: true deixa o navegador escolher (a placa, se tiver); false vai direto para o processador (a placa deste PC já mostrou imagem verde)
      ctl.usarProprio = (stream, { placa = false } = {}) => {
        // (1.0.0) já está no próprio pela placa e a imagem ficou verde: passa para o processador (antes ficava preso no verde)
        if (ctl.proprio && ctl.placa && !placa) { ctl.placa = false; w.postMessage({ t: 'proprio', placa: false }); A.log.aviso('receptor de vídeo: decodificador próprio passa para o processador'); return true; }
        if (ctl.proprio || ctl.falhou || !R.podeProprio() || !stream) return false;
        const velha = stream.getVideoTracks()[0]; if (!velha) return false;
        // (1.0.3) a escrita fica aqui na página: mandar a trilha para o worker funcionou no Linux, mas no Windows (decodificador da placa) a
        // imagem não chegava na tela (preta, ou parada no primeiro quadro)
        try { ctl.gerador = new MediaStreamTrackGenerator({ kind: 'video' }); ctl.escritor = ctl.gerador.writable.getWriter(); } catch (e) { A.log.aviso('decodificador próprio:', e); return false; }
        ctl.proprio = true; ctl.placa = placa; ctl.stream = stream; ctl.velha = velha; ctl.escritos = 0; saude = null;
        clearInterval(saudeT); saudeT = setInterval(() => { if (!ctl.proprio) { clearInterval(saudeT); return; } try { w.postMessage({ t: 'saude' }); } catch (e) { clearInterval(saudeT); } }, 1000);
        stream.removeTrack(velha); stream.addTrack(ctl.gerador);
        velha.addEventListener('ended', () => { clearInterval(saudeT); try { if (ctl.gerador) ctl.gerador.stop(); } catch (e) { /* ok */ } }, { once: true });
        w.postMessage({ t: 'proprio', placa });
        A.log.aviso('receptor de vídeo: decodificador próprio ligado (' + (placa ? 'automático' : 'processador') + ')');
        return true;
      };
      controles.set(receiver, ctl); vivos.add(ctl);
      if (!relogio) relogio = setInterval(conferir, 3000);
      return ctl;
    },
  });
})();
