// Aero Stream - núcleo da sala (v0.4). Todos conversam com todos (malha WebRTC) e QUALQUER UM pode compartilhar a tela.
// Usa o padrão "perfect negotiation": se duas pessoas começam a compartilhar ao mesmo tempo, o conflito se resolve sozinho.
// A sala persiste no servidor: se o host cair, ela continua; ele volta com o "código de retorno".
// Novidades da 0.4: fps estrito (estabilizador que só reduz a RESOLUÇÃO, nunca o fps), codec pelo teste da placa,
// captura sem eco/espelho, mixer de áudio (voz x transmissões x saída), microfone tratado e pedidos de controle remoto.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, API = A.api, H = A.hub;
  const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const emit = (n, d) => A.evt.emit('sala:' + n, d);

  const S = (A.sala = {});
  const zerar = () => {
    Object.assign(S, {
      ativa: false, status: 'fechada', papel: null, sala: '', chave: '', ws: null, id: null, hostId: null, hostOnline: false,
      admitido: false, participantes: [], pendentes: [], peers: new Map(), remotas: new Map(), chat: [], naoLidas: 0, chatAberto: false,
      local: { tela: null, mic: null, micMudo: false, modo: 'tela', preset: null, superficie: '', fonte: null, protegida: false, audioNativo: false, somTela: true, nativo: false },
      estat: {}, envio: null, foco: null, encerrando: false, ice: [], tentativas: 0, refeitos: {}, nomeConvidado: 'Visitante', mudos: new Set(),
      retomada: null, _filaCtl: [], _reatouEm: {}, _ultimoPong: 0, _abertura: null, _pingT: null, _statsT: null, _reconT: null, _pedidos: {},
    });
  };
  zerar();
  S.zerar = zerar;
  // (0.7.6) o modo jogo na chamada do Aero Talk é o da sala: a mesma captura, a mesma taxa e o mesmo codificador por pessoa. Cada pessoa da
  // chamada vira um "peer" daqui (veja chamada.js), e o resto do código não precisa saber de onde ela veio
  S.peersChamada = new Map();
  const todosPeers = () => [...S.peers.values(), ...S.peersChamada.values()];
  S.gerarCodigos = () => {
    const r = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => ALF[x % 32]).join('');
    return { sala: r(6), chave: r(4) + '-' + r(4) };
  };
  const eu = () => S.participantes.find((p) => p.id === S.id) || null;
  S.eu = eu;
  S.participante = (id) => S.participantes.find((p) => p.id === id) || null;
  const enviar = (o) => { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); };
  S.enviar = enviar;

  // ---------- conexão com a sala ----------
  S.abrir = async ({ papel, sala, chave, nome }) => {
    if (S.ativa) await S.fechar();
    zerar();
    Object.assign(S, { papel, sala: String(sala).toUpperCase(), chave: chave || '', nomeConvidado: nome || 'Visitante', status: 'conectando', ativa: true });
    S.ice = await API.ice();
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { /* iOS 16.4+ */ }
    return new Promise((resolve, reject) => { S._abertura = { resolve, reject }; conectar(); });
  };

  async function conectar() {
    const q = new URLSearchParams({ papel: papel2(), sala: S.sala });
    if (S.papel === 'host') q.set('chave', S.chave);
    if (API.token) {
      const sala = S.sala;
      try { q.set('ticket', await API.ticketWs()); } catch (e) {
        if (S.sala !== sala || !S.ativa || S.encerrando) return;
        if (!S._abertura) { reconectar(); return; }
        const a = S._abertura; S._abertura = null; S.ativa = false; a.reject(Object.assign(new Error(A.T('Não consegui conectar à sala.', 'Could not connect to the room.')), { codigo: 'rede' })); return;
      }
      if (S.sala !== sala || !S.ativa || S.encerrando) return;
    } else q.set('nome', S.nomeConvidado);
    if (S.retomada) { q.set('retomar', S.retomada.id); q.set('seg', S.retomada.seg); } // volta com o mesmo id: o vídeo não precisa ser refeito
    const ws = new WebSocket(`${API.wsBase()}/ws?${q}`);
    S.ws = ws;
    ws.onopen = () => {
      clearInterval(S._pingT); S._ultimoPong = Date.now();
      // Conexão "morta mas aberta" (comum em rotas longas, Wi-Fi trocando, celular): sem resposta ao ping por 45 s, reconecta na hora
      // em vez de esperar o sistema perceber (o que pode levar minutos).
      S._pingT = setInterval(() => {
        if (S.ws !== ws) return;
        if (Date.now() - S._ultimoPong > 45000) { A.log.aviso('sala: servidor sem resposta, reconectando'); S.ws = null; clearInterval(S._pingT); try { ws.close(); } catch (e) { /* ok */ } if (!S.encerrando) reconectar(); return; }
        if (ws.readyState === 1) ws.send('ping');
      }, 15000);
    };
    ws.onmessage = (ev) => { S._ultimoPong = Date.now(); if (ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } try { aoMensagem(m); } catch (e) { A.log.erro('sala msg', e); } };
    ws.onclose = () => {
      if (S.ws !== ws) return;
      clearInterval(S._pingT);
      if (S.encerrando) return;
      if (S._abertura) { const a = S._abertura; S._abertura = null; S.ativa = false; a.reject(Object.assign(new Error(A.T('Não consegui conectar à sala.', 'Could not connect to the room.')), { codigo: 'rede' })); return; }
      reconectar();
    };
  }
  const papel2 = () => (S.papel === 'host' ? 'host' : 'membro');

  // As conexões diretas (vídeo, voz) NÃO são fechadas aqui: elas não passam pelo servidor e quase sempre continuam funcionando durante
  // uma queda do servidor da sala. Com o segredo de retomada a pessoa volta com o mesmo id e nada pisca; se o id mudar, aí sim são refeitas.
  // Tenta por uns 4 minutos (amigos em outro continente às vezes perdem a rota por dezenas de segundos).
  function reconectar() {
    if (S.tentativas >= 30) { emit('fim', { motivo: 'rede' }); S.fechar(); return; }
    S.status = 'reconectando'; emit('estado');
    clearTimeout(S._reconT);
    S._reconT = setTimeout(conectar, Math.min(8000, 800 * ++S.tentativas));
    if (S.tentativas === 2) API.ice(true).then((l) => { if (l && l.length) S.ice = l; }).catch(() => {}); // credenciais do TURN novas para o que for refeito
  }
  // a internet voltou: não espera o próximo intervalo
  addEventListener('online', () => { if (S.ativa && S.status === 'reconectando' && !S.encerrando) { clearTimeout(S._reconT); conectar(); } });

  function aoMensagem(m) {
    switch (m.tipo) {
      case 'erro': {
        if (m.codigo === 'chat' || m.codigo === 'input') { emit('aviso', m); return; }
        const a = S._abertura; S._abertura = null; S.encerrando = true; S.ativa = false;
        if (a) a.reject(Object.assign(new Error(m.msg), { codigo: m.codigo }));
        else { emit('fim', { motivo: m.codigo, msg: m.msg }); S.ativa = true; S.fechar(); } // (fechar: limpa vídeo, voz e controle e volta ao menu)
        return;
      }
      case 'aguardando': S.status = 'aguardando'; emit('aguardando'); resolverAbertura('aguardando'); return;
      case 'aprovado': S.status = 'ativa'; S.tentativas = 0; emit('aprovado'); resolverAbertura('aprovado'); return;
      case 'recusado': case 'removido': S.encerrando = true; emit('fim', { motivo: m.tipo }); S.fechar(); return;
      case 'sala': aplicarSnapshot(m); return;
      case 'retomada': S.retomada = { id: m.id, seg: m.seg }; return;
      case 'pedido':
        if (S.autoAprovar && m.codigo && S.autoAprovar.has(m.codigo)) { enviar({ tipo: 'aprovar', id: m.id }); return; } // chamada do Aero Talk: quem foi chamado entra direto
        emit('pedido', m); return;
      case 'input-pedido': emit('input-pedido', m); return;
      case 'input-fim': emit('input-fim', m); return;
      case 'sinal': receberSinal(m.de, m.dados); return;
      case 'digitando': emit('digitando', m); return;
      case 'chat': { const c = { ...m }; delete c.tipo; S.chat.push(c); if (S.chat.length > 300) S.chat.shift(); if (!S.chatAberto && m.de !== S.id) S.naoLidas++; emit('chat', c); return; }
      case 'chat-hist': S.chat = (m.msgs || []).slice(-300); emit('chat-hist'); return;
      case 'chat-editado': { const c = S.chat.find((x) => x.id === m.id); if (c) { c.texto = m.texto; c.editado = m.editado; emit('chat-mudou', c); } return; }
      case 'chat-reagido': { const c = S.chat.find((x) => x.id === m.id); if (c) { c.rea = m.rea || {}; emit('chat-mudou', c); } return; }
      case 'chat-apagado': { const k = S.chat.findIndex((x) => x.id === m.id); if (k >= 0) { const [c] = S.chat.splice(k, 1); emit('chat-apagado', c); } return; }
    }
  }
  const resolverAbertura = (v) => { if (S._abertura) { const a = S._abertura; S._abertura = null; a.resolve(v); } };

  function aplicarSnapshot(snap) {
    const antes = new Map(S.participantes.map((p) => [p.id, p]));
    // a retomada não deu (demorou demais). (0.7.8) Conta como entrar de novo: sem isso quem transmite não reavisava que estava no ar, e quem assiste
    // ficava sem imagem e sem o botão do controle
    if (S.id && snap.voce !== S.id) { A.log.aviso('sala: voltei com outro id, refazendo as conexões'); fecharPeers(); S.admitido = false; }
    S.id = snap.voce; S.hostId = snap.host; S.hostOnline = snap.hostOnline;
    const pendAntes = S.pendentes;
    S.participantes = snap.participantes; S.pendentes = snap.pendentes || []; S.lider = snap.lider || null; // líder: quem aprova os pedidos (o host ou, sem ele, quem entrou logo depois)
    for (const q of pendAntes) if (!S.pendentes.some((x) => x.id === q.id)) emit('pedido-fim', q); // alguém decidiu (aprovou/recusou/desistiu): o aviso some
    const primeira = !S.admitido && S.participantes.some((p) => p.id === S.id);
    // (0.7.6) voltou de uma queda: o host não recebe "aprovado" de novo, e ficava "reconectando" para sempre (e as tentativas nunca zeravam)
    if (S.admitido && S.status === 'reconectando' && S.participantes.some((p) => p.id === S.id)) { S.status = 'ativa'; S.tentativas = 0; }
    if (primeira) {
      S.admitido = true; S.status = 'ativa'; S.tentativas = 0; resolverAbertura(S.papel === 'host' ? 'host' : 'aprovado');
      clearInterval(S._statsT); S._statsT = setInterval(medirTudo, 1000);
      if (S.local.tela) enviar({ tipo: 'comp', ativo: true, modo: S.local.modo }); // voltou de uma queda: avisa de novo
      if (S.micLigado()) enviar({ tipo: 'mic', ativo: true });
      if (A.cfg.v.entrada.cor) enviar({ tipo: 'cursor', cor: A.cfg.v.entrada.cor });
      H.anunciarSala(S.sala, !!S.local.tela); // (0.5.9-5) quem está numa sala (host ou não) aparece "em sala" para os amigos, que podem pedir para entrar
    }
    if (!S.admitido) return;
    for (const o of S._filaCtl.splice(0)) enviar(o); // (0.7.8) o que foi pedido com a sala fora do ar
    for (const p of S.participantes) {
      if (p.id === S.id) continue;
      const a = antes.get(p.id);
      if (!a) emit('entrou', p);
      else {
        if (!a.comp && p.comp) emit('comp-inicio', p);
        if (a.comp && !p.comp) { limparRemotas(p.id, true); emit('comp-fim', p); }
        if (a.modo !== p.modo) peerReceptores(p.id);
      }
      if (!S.peers.has(p.id) && !p.ausente) criarPeer(p.id); // ausente = caiu há pouco: a conexão dele (se ainda existir) fica como está
    }
    for (const [id, p] of antes) {
      if (id === S.id || S.participantes.some((x) => x.id === id)) continue;
      emit('saiu', p); fecharPeer(id);
    }
    // mudanças no controle remoto (pedidos, aprovação, pausa...)
    const meuAntes = antes.get(S.id), meuAgora = eu();
    if (meuAntes && meuAgora && JSON.stringify(meuAntes.ctl) !== JSON.stringify(meuAgora.ctl)) emit('ctl-meu', { antes: meuAntes.ctl, depois: meuAgora.ctl });
    for (const p of S.participantes) {
      const a = antes.get(p.id);
      if (a && JSON.stringify(a.ctl) !== JSON.stringify(p.ctl) && p.id !== S.id) emit('ctl', { p, antes: a.ctl, depois: p.ctl });
    }
    S.peers.forEach(ajustarReceptores);
    emit('estado');
  }

  // ---------- controle remoto: o que a sala sabe (os eventos em si vão direto, ver entrada.js) ----------
  S.meuCtl = () => (eu() || {}).ctl || null;
  S.pedidosParaMim = () => S.participantes.filter((p) => p.ctl && p.ctl.st === 'pedindo' && p.id !== S.id && (p.ctl.dono === S.id || S.papel === 'host'));
  S.controladores = (donoId = S.id) => S.participantes.filter((p) => p.ctl && p.ctl.dono === donoId && p.ctl.st !== 'pedindo');
  // (0.7.8) com a sala reconectando o pedido se perdia calado (clicar em "controle" ou voltar ao jogo não fazia nada): fica guardado até ela voltar
  const enviarCtl = (o) => { if (S.ws && S.ws.readyState === 1) enviar(o); else S._filaCtl.push(o); };
  S.pedirControle = (donoId) => enviarCtl({ tipo: 'input', acao: 'pedir', dono: donoId });
  S.decidirControle = (id, acao) => enviarCtl({ tipo: 'input', acao, id }); // 'aprovar' | 'negar' | 'revogar'
  S.pausarControle = (pausar) => enviarCtl({ tipo: 'input', acao: pausar ? 'pausar' : 'retomar' });
  S.sairControle = () => enviarCtl({ tipo: 'input', acao: 'sair' });
  S.pedirReal = (ativo) => enviarCtl({ tipo: 'input', acao: 'real', ativo: !!ativo });
  S.regras = (id, regra) => enviar({ tipo: 'perm', id, perm: regra.perm, livre: regra.livre });
  S.definirCursor = (cor) => { A.cfg.v.entrada.cor = cor || ''; A.cfg.salvar(); enviar({ tipo: 'cursor', cor: cor || '' }); };

  // ---------- malha de conexões diretas (perfect negotiation) ----------
  const rotuloSinal = (d) => (d.descricao ? 'desc:' + d.descricao.type : d.candidato ? 'cand' : d.qualidade ? 'qualidade' : '?');
  const sinal = (para, dados) => { const pc = S.peersChamada.get(para); if (pc) { pc.sinal(dados); return; } A.log.info('sinal>', para, rotuloSinal(dados)); enviar({ tipo: 'sinal', para, dados }); };

  // relay: só pelo TURN. Usado quando a conexão direta já falhou duas vezes (redes com NAT simétrico, operadoras com CGNAT, firewall de
  // empresa): ir direto ao servidor de retransmissão poupa mais tentativas que não iam dar certo.
  function criarPeer(id, { relay = false } = {}) {
    const pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2, iceTransportPolicy: relay && API.turn ? 'relay' : 'all' });
    const peer = { id, pc, relay: relay && !!API.turn, criadoEm: Date.now(), iniciou: false, vigia: 0, polite: S.id > id, fazendoOferta: false, ignorarOferta: false, pend: [], fila: Promise.resolve(), senders: new Map(), dc: null, dcRapido: null, pedido: 'auto', ult: null, est: { escala: 1, ruim: 0, bom: 0, ultimaMud: 0, piso: 1, pisoAte: 0 } };
    S.peers.set(id, peer);
    A.log.info('peer criado', id, peer.polite ? 'educado' : 'direto', 'eu=' + S.id);
    pc.onicecandidate = (e) => { if (e.candidate) sinal(id, { candidato: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); else A.log.info('ice: fim dos candidatos', id); };
    pc.onicegatheringstatechange = () => A.log.info('ice gathering', id, pc.iceGatheringState);
    pc.oniceconnectionstatechange = () => A.log.info('ice conexão', id, pc.iceConnectionState);
    pc.onnegotiationneeded = async () => {
      A.log.info('negociação necessária', id, pc.signalingState);
      try {
        peer.fazendoOferta = true;
        await pc.setLocalDescription();
        sinal(id, { descricao: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      } catch (e) { A.log.aviso('negociar', e); } finally { peer.fazendoOferta = false; }
    };
    pc.ontrack = (e) => aoTrack(peer, e);
    pc.ondatachannel = (e) => ligarDC(peer, e.channel);
    pc.onconnectionstatechange = () => {
      emit('conexao', { id, estado: pc.connectionState });
      clearTimeout(peer.oscila);
      if (pc.connectionState === 'connected') { clearTimeout(peer.vigia); S.refeitos[id] = 0; }
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch (e) { /* sem suporte */ } }
      // "disconnected" costuma ser uma rota oscilando (outro continente, Wi-Fi fraco). Se não voltar sozinho em poucos segundos, renegocia
      // a rota (ICE restart) SEM derrubar o vídeo: quem puxa a conexão tenta primeiro, o outro lado depois, para não brigarem.
      if (pc.connectionState === 'disconnected') {
        peer.oscila = setTimeout(() => {
          if (S.peers.get(id) !== peer || pc.connectionState !== 'disconnected') return;
          A.log.aviso('conexão oscilando: renegociando a rota', id);
          try { pc.restartIce(); } catch (e) { /* sem suporte */ }
        }, peer.polite ? 7000 : 3500);
      }
    };
    pc.onsignalingstatechange = () => { A.log.info('signaling', id, pc.signalingState); if (pc.signalingState === 'stable') aplicarQualidade(peer); };
    // Quem tem o menor id puxa a primeira negociação e já manda o que tem. Quem tem o maior id ("educado") ESPERA a
    // primeira oferta antes de adicionar suas trilhas: duas ofertas ao mesmo tempo, no meio da coleta de endereços
    // de rede, deixavam o Chrome sem candidatos (a conexão ficava parada para sempre).
    // Dois canais de dados: 'aero' (confiável, em ordem: teclas, botões, avisos) e 'aero-in' (sem retransmissão: movimento e controle,
    // onde o dado mais novo vale mais que o antigo e esperar atrasaria tudo).
    if (!peer.polite) {
      ligarDC(peer, pc.createDataChannel('aero'));
      ligarDC(peer, pc.createDataChannel('aero-in', { ordered: false, maxRetransmits: 0 }));
      peer.iniciou = true; adicionarLocais(peer);
    }
    vigiar(peer);
    return peer;
  }

  function receberSinal(de, dados) {
    let peer = S.peers.get(de);
    if (!peer) { if (!S.participantes.some((p) => p.id === de)) { A.log.aviso('sinal< descartado (participante desconhecido)', de, rotuloSinal(dados)); return; } peer = criarPeer(de); }
    A.log.info('sinal<', de, rotuloSinal(dados));
    peer.fila = peer.fila.then(() => tratarSinal(peer, dados)).catch((e) => A.log.aviso('sinal', e));
  }

  async function tratarSinal(peer, d) {
    const pc = peer.pc;
    if (d.descricao) {
      const colisao = d.descricao.type === 'offer' && (peer.fazendoOferta || pc.signalingState !== 'stable');
      peer.ignorarOferta = !peer.polite && colisao;
      if (peer.ignorarOferta) { A.log.info('oferta ignorada (conflito)', peer.id); return; }
      await pc.setRemoteDescription({ type: d.descricao.type, sdp: S._somMusica(S._taxaInicial(d.descricao.sdp, taxaInicialKbps()), midsSomTela(pc)) });
      for (const c of peer.pend.splice(0)) { try { await pc.addIceCandidate(c); } catch (e) { if (!peer.ignorarOferta) A.log.aviso('ice', e); } }
      if (d.descricao.type === 'offer') {
        await pc.setLocalDescription();
        sinal(peer.id, { descricao: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      }
      if (!peer.iniciou) { peer.iniciou = true; adicionarLocais(peer); } // primeira negociação feita: agora o educado também envia
    } else if (d.candidato) {
      if (!pc.remoteDescription) { peer.pend.push(d.candidato); return; }
      try { await pc.addIceCandidate(d.candidato); } catch (e) { if (!peer.ignorarOferta) throw e; }
    } else if (d.reiniciar) {
      if (Date.now() - peer.criadoEm < 2500) return; // esta conexão já é nova: o outro lado refez enquanto eu também refazia
      A.log.aviso('o outro lado pediu para refazer a conexão', peer.id);
      recriar(peer.id, { relay: !!d.relay });
    } else if (d.decod === 'lento') {
      // (0.7.6) quem assiste avisou que o PC dele não está dando conta de decodificar (PC fraco, sem placa): só a qualidade DESSA pessoa baixa
      // (um degrau por aviso; quem assiste avisa de novo depois de 8 s se ainda não der conta)
      decodDescer(peer, Number(d.h) || 0, d.ms, d.impl);
    } else if (d.tela) {
      // (0.7.9) o tamanho da tela de quem assiste: mandar mais do que ela mostra só pesa no PC dele, sem imagem melhor nenhuma
      const l = Number(d.tela.l) || 0, a = Number(d.tela.a) || 0; if (!(l >= 320 && a >= 240)) return;
      if (peer.telaV && peer.telaV.l === l && peer.telaV.a === a && peer.telaV.c === !!d.tela.c) return;
      peer.telaV = { l, a, c: !!d.tela.c }; A.log.info('tela de quem assiste', peer.id, l + 'x' + a);
      aplicarQualidade(peer);
    } else if (d.verde) {
      atenderVerde(peer);
    } else if (d.qualidade) {
      peer.pedido = 'auto'; // (0.5.9-5) quem assiste não escolhe mais a resolução: vale só a que o host escolheu (versões antigas ainda mandam o pedido)
      aplicarQualidade(peer);
    } else if (d.codecFalhou && !peer.codecForcado && d.motivo === 'manual') {
      // (0.6.0) só quando a PESSOA pede ("Imagem com defeito? Trocar formato"): a troca automática para VP8 (codificado pelo processador)
      // derrubava o fps em jogos pesados e ficava alternando entre a placa e o processador
      // quem assiste recebe os dados mas não consegue decodificar nenhuma imagem (tela preta): alguns decodificadores do Windows recusam o
      // H.264 que a placa (VA-API) faz. Para essa pessoa, a transmissão passa a ir em VP8, que todo computador decodifica.
      A.log.aviso('tela preta do outro lado (' + d.codecFalhou + '): mandando em VP8 para', peer.id);
      forcarVp8(peer);
      emit('aviso', { msg: d.motivo === 'perda' || d.motivo === 'manual' ? A.T('A imagem de uma pessoa estava falhando com o codec da placa; para ela a transmissão foi trocada para VP8.', 'Someone\'s picture was glitching with the GPU codec; for them the stream switched to VP8.') : A.T('Uma pessoa não conseguia ver a sua tela com o codec da placa; para ela a transmissão foi trocada para VP8.', 'Someone could not see your screen with the GPU codec; for them the stream switched to VP8.') });
    }
  }

  // Começar NÍTIDO: o WebRTC começa em ~0,3 Mbps e vai subindo; nesse começo o codificador (principalmente o do processador) reduz muito a
  // resolução e a imagem fica feia por vários segundos. "x-google-start-bitrate" diz ao Chrome de onde começar. Se a rede não aguentar,
  // o controle de congestionamento desce sozinho em poucos centésimos.
  const taxaInicialKbps = () => { const p = S.local.preset; const alvo = p && p.mbps > 0 ? p.mbps : 12; return Math.round(A.limitar(alvo * 0.6, 2.5, 12) * 1000); };
  // (0.5.9-7) piso da taxa: quando a imagem mexe muito de repente (virar a câmera no jogo, um vídeo), a estimativa de banda do WebRTC
  // despencava e o vídeo caía para 1-5 fps por alguns segundos. Com um piso (metade da inicial, entre 1,5 e 6 Mbps) ele não afunda tanto;
  // rede que não aguenta ainda faz o controle de congestionamento agir.
  const minKbps = (kbps) => Math.round(A.limitar(kbps * 0.5, 1500, 6000));
  S._taxaInicial = (sdp, kbps) => {
    if (!sdp || !kbps) return sdp;
    const linhas = sdp.split(/\r?\n/); let video = false; const pts = new Set(), comFmtp = new Set();
    for (const l of linhas) {
      if (l.startsWith('m=')) video = l.startsWith('m=video');
      const m = video && /^a=rtpmap:(\d+) (H264|VP8|VP9|AV1|H265)\/90000/i.exec(l); if (m) pts.add(m[1]);
    }
    if (!pts.size) return sdp;
    video = false; const saida = [];
    for (const l of linhas) {
      if (l.startsWith('m=')) video = l.startsWith('m=video');
      const f = video && /^a=fmtp:(\d+) (.*)$/.exec(l);
      if (f && pts.has(f[1])) { comFmtp.add(f[1]); saida.push((/x-google-start-bitrate/.test(l) ? l : l + ';x-google-start-bitrate=' + kbps) + (/x-google-min-bitrate/.test(l) ? '' : ';x-google-min-bitrate=' + minKbps(kbps))); continue; }
      saida.push(l);
      const r = video && /^a=rtpmap:(\d+) /.exec(l);
      if (r && pts.has(r[1]) && !linhas.some((x) => x.startsWith('a=fmtp:' + r[1] + ' '))) saida.push('a=fmtp:' + r[1] + ' x-google-start-bitrate=' + kbps + ';x-google-min-bitrate=' + minKbps(kbps)); // VP8 não tem linha fmtp: cria uma
    }
    return saida.join('\r\n');
  };

  // (0.9.6) som da tela em estéreo e com qualidade de música. O padrão do WebRTC é feito para voz (mono, ~32 kbps): música e jogo chegavam
  // abafados. Só as faixas do som da tela ganham estéreo e 128 kbps (o microfone continua como voz). Quem decide o formato do Opus é o lado que
  // recebe (stereo=1 na descrição dele); aqui quem transmite marca isso na descrição que recebe, só nas seções do som da tela.
  const OPUS_MUSICA = { stereo: '1', 'sprop-stereo': '1', maxaveragebitrate: '128000', maxplaybackrate: '48000' };
  const midsSomTela = (pc) => {
    const tela = S.local.tela, sons = tela ? tela.getAudioTracks() : [];
    if (!sons.length) return [];
    return pc.getTransceivers().filter((t) => t.mid != null && t.sender && t.sender.track && sons.includes(t.sender.track)).map((t) => String(t.mid));
  };
  S._somMusica = (sdp, mids) => {
    if (!sdp || !mids || !mids.length) return sdp;
    const secoes = sdp.split(/\r?\n(?=m=)/);
    return secoes.map((sec) => {
      if (!sec.startsWith('m=audio')) return sec;
      const mid = (/\r?\na=mid:(\S+)/.exec(sec) || [])[1];
      if (!mid || !mids.includes(mid)) return sec;
      const pt = (/\r?\na=rtpmap:(\d+) opus\/48000/i.exec(sec) || [])[1];
      if (!pt) return sec;
      return sec.replace(new RegExp('(\\r?\\na=fmtp:' + pt + ' )([^\\r\\n]*)'), (_, ini, params) => {
        const mapa = new Map(params.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf('='); return i < 0 ? [x, ''] : [x.slice(0, i), x.slice(i + 1)]; }));
        for (const [k, v] of Object.entries(OPUS_MUSICA)) mapa.set(k, v);
        return ini + [...mapa].map(([k, v]) => (v === '' ? k : k + '=' + v)).join(';');
      });
    }).join('\r\n');
  };

  function ligarDC(peer, ch) {
    if (ch.label === 'aero-in') peer.dcRapido = ch; else peer.dc = ch;
    ch.onmessage = (e) => emit('dc', { de: peer.id, dados: e.data, canal: ch.label });
    ch.onopen = () => emit('dc-aberto', { id: peer.id, canal: ch.label });
  }
  // rapido: true usa o canal sem retransmissão (movimento, controle). Se ele ainda não abriu, cai no canal confiável.
  S.enviarDC = (id, obj, { rapido = false } = {}) => {
    const p = S.peers.get(id); if (!p) return false;
    const ch = rapido && p.dcRapido && p.dcRapido.readyState === 'open' ? p.dcRapido : p.dc;
    if (!ch || ch.readyState !== 'open') return false;
    try { ch.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); return true; } catch (e) { return false; }
  };
  S.dcAberto = (id) => { const p = S.peers.get(id); return !!(p && p.dc && p.dc.readyState === 'open'); };

  function fecharPeer(id) {
    const p = S.peers.get(id); if (!p) return;
    clearTimeout(p.vigia); clearTimeout(p.oscila);
    S.peers.delete(id);
    if (A.kms) for (const s of p.senders.values()) A.kms.soltarSender(s); // (0.7.6) a transformação da captura direta sai junto (antes ficava pedindo quadro inteiro à placa)
    p.pc.onconnectionstatechange = null; p.pc.onnegotiationneeded = null; p.pc.ontrack = null;
    try { p.pc.close(); } catch (e) { /* já fechou */ }
    limparRemotas(id, false);
    delete S.estat[id];
  }
  function fecharPeers() { [...S.peers.keys()].forEach(fecharPeer); }

  // Vigia: se a conexão direta não completar em 9 s, refaz do zero (até 3 vezes). Cura qualquer travada de ICE.
  function vigiar(peer) {
    clearTimeout(peer.vigia);
    peer.vigia = setTimeout(() => {
      if (S.peers.get(peer.id) !== peer || peer.pc.connectionState === 'connected') return;
      const n = (S.refeitos[peer.id] = (S.refeitos[peer.id] || 0) + 1);
      const nome = (S.participante(peer.id) || {}).nome || '?';
      if (n > 4) {
        const msg = API.turn
          ? A.T('Não consegui conectar com ' + nome + ', nem pelo servidor de retransmissão (TURN). A internet de um de vocês pode estar bloqueando chamadas de vídeo (rede de empresa/escola, VPN ou firewall). Tente outra rede ou desligue a VPN.', 'Could not connect with ' + nome + ', not even through the relay server (TURN). One of your networks may be blocking video calls (work/school network, VPN or firewall). Try another network or turn off the VPN.')
          : A.T('Não consegui conectar com ' + nome + '. O servidor está sem o retransmissor (TURN' + (API.turnErro ? ': ' + API.turnErro : '') + '), e as redes de vocês não deixam a conexão direta. Quem cuida do servidor precisa conferir o TURN.', 'Could not connect with ' + nome + '. The server has no relay (TURN' + (API.turnErro ? ': ' + API.turnErro : '') + ') and your networks block a direct connection. The server owner needs to check TURN.');
        emit('aviso', { msg }); return;
      }
      A.log.aviso('conexão não completou: refazendo', peer.id, 'tentativa ' + n + (n >= 2 && API.turn ? ' (só pelo TURN)' : ''));
      sinal(peer.id, { reiniciar: true, relay: n >= 2 });
      recriar(peer.id, { relay: n >= 2 });
    }, (peer.polite ? 14000 : 9000) + (peer.relay ? 4000 : 0)); // quem puxa a conexão vigia primeiro; pelo TURN de outro continente demora um pouco mais
  }
  function recriar(id, opts) {
    const antigo = S.peers.get(id);
    if (antigo) fecharPeer(id);
    if (S.participante(id)) criarPeer(id, opts);
  }
  // (0.7.8) a imagem de quem transmite não apareceu aqui (ou o canal do controle caiu): primeiro procura o vídeo que a conexão já recebe e a
  // tela perdeu; se não houver, refaz só a conexão com essa pessoa (a transmissão e os outros que assistem não mudam). No máximo a cada 20 s.
  S.reatar = (id, refazer) => {
    const peer = S.peers.get(id);
    if (!refazer && peer) {
      for (const t of peer.pc.getTransceivers()) {
        const tr = t.receiver && t.receiver.track;
        if (!tr || tr.kind !== 'video' || tr.readyState !== 'live' || !/recv/.test(t.currentDirection || '')) continue;
        const stream = new MediaStream([tr]);
        S.remotas.set(stream.id, { id: stream.id, peerId: id, stream, tela: true, gain: null, reatada: true });
        A.log.aviso('sala: imagem recuperada da conexão', id); emit('stream', S.remotas.get(stream.id)); return true;
      }
    }
    if (Date.now() - (S._reatouEm[id] || 0) < 20000) return false;
    S._reatouEm[id] = Date.now();
    A.log.aviso('sala: refazendo a conexão com', id); sinal(id, { reiniciar: true }); recriar(id);
    return false;
  };

  // ---------- o que eu envio ----------
  const streamsLocais = () => [S.local.tela, S.local.mic].filter(Boolean);
  // (0.7.3) MODO JOGO: o som da tela vai num "pacote" (MediaStream) separado do vídeo. Juntos, quem assiste sincroniza o vídeo com o som
  // (como num filme): com a internet oscilando, a fila do som cresce e o VÍDEO espera por ela, e os comandos pareciam atrasados (o mouse
  // chegava na hora, mas a imagem mostrava depois). Separado, o vídeo sai assim que chega. Quem assiste fica sabendo qual pacote é o som
  // da tela pelo canal de dados ("somTela") e o toca no volume das transmissões, como antes. Fora do modo jogo nada muda (som sincronizado).
  let somSolo = null;
  const streamPara = (t, stream) => {
    if (stream !== S.local.tela || t.kind !== 'audio' || S.local.modo !== 'jogo') return stream;
    if (!somSolo) somSolo = new MediaStream();
    return somSolo;
  };
  const avisarSomSolo = (peerId) => { if (somSolo && S.local.tela) S.enviarDC(peerId, { t: 'somTela', id: somSolo.id }); };
  A.evt.on('sala:dc-aberto', ({ id, canal }) => { if (canal === 'aero') avisarSomSolo(id); });
  setInterval(() => { if (somSolo && S.local.tela) for (const id of S.peers.keys()) avisarSomSolo(id); }, 3000); // de novo de vez em quando: quem entrou no meio ou perdeu o aviso
  function adicionarLocais(peer) {
    if (peer.polite && !peer.iniciou) return;
    for (const stream of streamsLocais()) {
      for (const t of stream.getTracks()) {
        if (peer.senders.has(t.id)) continue;
        const sender = peer.pc.addTrack(t, streamPara(t, stream));
        peer.senders.set(t.id, sender);
        if (t.kind === 'audio' && somSolo && stream === S.local.tela) avisarSomSolo(peer.id);
        if (t.kind === 'video' && A.kms && A.kms.ehTrilha(t)) { A.kms.prepararSender(sender, peer.pc.getTransceivers().find((x) => x.sender === sender)); aplicarQualidade(peer); }
        else if (t.kind === 'video') {
          const tr = peer.pc.getTransceivers().find((x) => x.sender === sender);
          if (tr) A.codec.preferir(tr, { pref: peer.codecForcado || A.gpu.codecAtual(), soH264: peer.codecForcado !== 'vp8' && A.gpu.usaPlaca(), soBase: peer.codecForcado === 'h264-base' }); // H.264 High/Main = codificador da PLACA (Baseline seria o do processador); (0.6.0) com a placa escolhida, só H.264: nunca cai para o VP8 do processador
          aplicarQualidade(peer); // fps, taxa e resolução já na 1ª imagem (não espera o ciclo de estatísticas)
        } else A.codec.somRobusto(peer.pc.getTransceivers().find((x) => x.sender === sender)); // (0.6.9) som com redundância
      }
    }
  }
  function removerLocais(stream) {
    for (const peer of S.peers.values()) {
      for (const t of stream.getTracks()) { const s = peer.senders.get(t.id); if (s) { if (A.kms) A.kms.soltarSender(s); try { peer.pc.removeTrack(s); } catch (e) { /* já removido */ } peer.senders.delete(t.id); } }
    }
  }

  // ---------- captura da tela ----------
  const desktop = () => !!(window.aero && window.aero.escolherFonte);
  const supNome = (tipo) => (tipo === 'janela' ? 'window' : tipo === 'tela' ? 'monitor' : '');

  // (1.0.0) fps FIXO: a captura do Chromium só manda quadro quando a tela muda (tela parada = 1-5 fps, e o fps escolhido "não valia"). Com o
  // mínimo igual ao escolhido, o próprio Chromium repete o último quadro no ritmo pedido. (getDisplayMedia não aceita "min": vai depois)
  function fixarRitmo(vt, p) {
    if (!vt || !vt.applyConstraints || !p || !(p.fps > 0)) return;
    const tam = { width: { max: p.larg }, height: { max: p.alt } };
    // (1.0.0) o mínimo vai até 60: repetir quadro a 120 fps dobrava o trabalho da placa aqui e o de quem assiste (a tela dela ficava lenta)
    vt.applyConstraints({ ...tam, frameRate: { min: Math.min(p.fps, 60), ideal: p.fps, max: p.fps } })
      .catch(() => vt.applyConstraints({ ...tam, frameRate: { ideal: p.fps, max: p.fps } }).catch(() => {}));
  }
  async function capturarTela({ fonteId, fonte, preset, audio, camera }) {
    const cfg = A.cfg.v.host;
    if (camera) { // chamada de vídeo do Aero Talk: a câmera vai pelo mesmo caminho da tela
      const p = preset || { larg: 1280, alt: 720, fps: 30 };
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: p.larg }, height: { ideal: p.alt }, frameRate: { ideal: p.fps } }, audio: false });
      S.local.superficie = 'camera'; S.local.fonte = null; S.local.camera = true;
      return st;
    }
    S.local.camera = false;
    if (desktop() && fonteId) await window.aero.escolherFonte(fonteId);
    // O app não aparece na própria transmissão (espelho infinito = imagem "derretendo"): Windows/macOS pelo Electron; Linux/KDE pelo KWin.
    // Quem decide é a opção "Incluir a janela do Aero na transmissão" (antes isso seguia, por engano, a opção do SOM do Aero).
    S.local.protegida = false;
    if (desktop() && window.aero.protegerJanela && !cfg.incluirApp) { try { const r = await window.aero.protegerJanela(true); S.local.protegida = !!(r && r.eficaz); } catch (e) { /* ok */ } }
    const p = preset || { larg: 1920, alt: 1080, fps: 60 };
    const video = { width: { max: p.larg }, height: { max: p.alt }, frameRate: { ideal: p.fps, max: p.fps }, cursor: 'always' };
    // No app do PC fora do Windows o som NUNCA vem pela captura do Chromium (o app captura o som por aplicativo à parte). Pedir som aqui e o
    // Electron não entregar faz versões novas do Electron recusarem a captura inteira; então nem pede.
    const pcSemSomNaCaptura = desktop() && !/Windows/i.test(navigator.userAgent);
    const som = audio && !pcSemSomNaCaptura ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: semAero(), channelCount: 2 } : false;
    const extras = { selfBrowserSurface: cfg.incluirApp ? 'include' : 'exclude', surfaceSwitching: 'include', systemAudio: som ? 'include' : 'exclude', windowAudio: som ? 'window' : 'exclude', restrictOwnAudio: cfg.semEco !== false, monitorTypeSurfaces: 'include' };
    const gdm = (o) => navigator.mediaDevices.getDisplayMedia(o);
    let stream;
    try { stream = await gdm({ video, audio: som, ...extras }); }
    catch (e) {
      // No app do PC, "AbortError" pode ser: (1) a pessoa cancelou o seletor do sistema, (2) o seletor falhou sozinho, ou (3) a tela foi escolhida mas o
      // Chromium não começou a captura com essas opções. O app do PC conta o que aconteceu; nunca reabre o seletor do sistema à toa.
      if (e.name === 'AbortError' && desktop()) {
        const uc = window.aero.ultimaCaptura ? await window.aero.ultimaCaptura().catch(() => null) : null;
        if (uc && uc.resultado === 'ok' && window.aero.reusarFonte) {
          A.log.aviso('captura: tela escolhida mas a captura não começou; tentando de novo com opções mínimas', e.message);
          await window.aero.reusarFonte(); // a próxima captura usa a MESMA tela já escolhida (o seletor do sistema não abre de novo)
          try { stream = await gdm({ video: { frameRate: { ideal: p.fps } }, audio: false }); }
          catch (e2) { await window.aero.reusarFonte(); try { stream = await gdm({ video: true, audio: false }); } catch (e3) { throw Object.assign(new Error(A.T('A tela foi escolhida, mas o Chromium não conseguiu começar a captura (', 'The screen was chosen, but Chromium could not start capturing (') + (e3.message || e3.name) + A.T('). Mande o relatório de diagnóstico.', '). Send the diagnostics report.')), { name: 'ErroCaptura' }); } }
        } else if (uc && uc.resultado === 'falhou') {
          const det = (uc.tentativas || []).map((t) => t.erro).filter(Boolean).slice(-1)[0] || '';
          throw Object.assign(new Error(A.T('O seletor de telas do sistema (portal) falhou antes de abrir' + (det ? ': ' + det : '') + '. No KDE, rode no terminal: systemctl --user restart xdg-desktop-portal xdg-desktop-portal-kde pipewire e tente de novo. Se continuar, mande o relatório de diagnóstico.', 'The system screen picker (portal) failed before opening' + (det ? ': ' + det : '') + '. On KDE run: systemctl --user restart xdg-desktop-portal xdg-desktop-portal-kde pipewire and try again. If it persists, send the diagnostics report.')), { name: 'ErroPortal' });
        } else throw Object.assign(new Error('cancelado'), { name: 'NotAllowedError' });
      } else {
        if (e.name === 'NotAllowedError') throw e;
        try { stream = await gdm({ video, audio: som }); } // navegador que não conhece as opções novas
        catch (e2) { if (som && e2.name !== 'NotAllowedError') stream = await gdm({ video, audio: false }); else throw e2; } // sem som do sistema neste computador
      }
    }
    const vt = stream.getVideoTracks()[0];
    fixarRitmo(vt, p);
    const set = (vt.getSettings && vt.getSettings()) || {};
    S.local.superficie = set.displaySurface || (fonte ? supNome(fonte.tipo) : '') || '';
    S.local.fonte = fonte || null;
    return stream;
  }

  // Som do computador: o do navegador (já vem na captura) ou o nativo do app do PC (por aplicativo, sem o som do próprio Aero)
  async function prepararAudio(stream, { audio, apps }) {
    S.local.audioNativo = false; S.local.somTela = !!audio;
    if (!audio || !A.captura) return;
    const aviso = (pt, en) => emit('aviso', { msg: A.T(pt, en) });
    try {
      const janela = S.local.fonte && S.local.fonte.tipo === 'janela';
      const especifico = !!(apps && apps.length) || janela; // aplicativos escolhidos ou uma janela: o som não pode "vazar" o resto do computador
      // a janela que está sendo transmitida o app do PC já sabe (inclusive a escolhida no seletor do sistema): ela entra sozinha, e os marcados se somam
      const r = await A.captura.iniciarAudio({ ids: apps || [], excluirAero: semAero(), excluirDiscord: semDiscord(), janela: null });
      if (r && r.cancelado) return; // outra captura tomou o lugar desta
      if (r && r.track) {
        stream.getAudioTracks().forEach((t) => { stream.removeTrack(t); t.stop(); }); // o nativo substitui o do navegador (que traria o som do próprio Aero)
        stream.addTrack(r.track); S.local.audioNativo = true;
        if (r.aviso === 'janela-som-geral') A.log.info('som: janela sem programa reconhecido, enviando o som do computador (menos o Aero)');
        if (r.aviso === 'janela-sem-pid') aviso('Não consegui descobrir qual programa é essa janela. Por segurança, o som dela não está sendo enviado. Use "Compartilhar > Aplicativos com som" para escolher.', 'Could not tell which program that window belongs to. For safety, its sound is not being sent. Use "Share > Apps with sound" to choose.');
      } else if (A.plat.desktop && /Windows/i.test(navigator.userAgent) && stream.getAudioTracks().length && (semAero() || semDiscord())) {
        // o som por aplicativo não ligou (o ajudante falhou ou o Windows é antigo demais). O som que sobra é o do Chromium, com o computador
        // INTEIRO (a voz de quem está na chamada, tocada pelo Aero, voltava para ele: o cancelamento de eco da 0.6.3 não tirou). Com "não captar
        // o som do Aero" marcado, a tela vai sem som; o motivo fica no log (relatório de diagnóstico)
        A.log.aviso('som da tela: captura por aplicativo indisponível (' + (A.captura.ultimoErro || 'sem suporte') + ')');
        if (semAero()) {
          stream.getAudioTracks().forEach((x) => { stream.removeTrack(x); x.stop(); }); S.local.somTela = false;
          aviso('Não consegui separar o som do Aero do resto neste computador. Para ninguém ouvir a própria voz de volta, a tela está indo sem som. Para enviar o som do computador inteiro mesmo assim, desligue "Não captar o som do Aero". (O motivo fica no relatório de diagnóstico.)', 'Could not separate Aero sound from the rest on this computer. So nobody hears their own voice back, the screen is going without sound. To send the whole computer sound anyway, turn off "Do not capture Aero sound". (The reason is in the diagnostic report.)');
        } else if (semDiscord() && !S._avisouSomWin) { S._avisouSomWin = true; aviso('Não consegui separar o som de cada programa neste computador: a tela vai com o som do computador inteiro, e o som do Discord pode ir junto.', 'Could not separate each program\'s sound on this computer: the screen goes with the whole computer sound, and Discord sound may go along.'); }
      } else if (especifico && A.plat.desktop && /Windows/i.test(navigator.userAgent) && stream.getAudioTracks().length) {
        // Windows 10 não separa o som por aplicativo (só o 11): manda o som do computador (sem o do próprio Aero) em vez de mandar mudo
        aviso('O Windows 10 não consegue separar o som de um só aplicativo, então a transmissão leva o som do computador inteiro. No Windows 11 dá para escolher os aplicativos.', 'Windows 10 cannot isolate a single app\'s sound, so the stream carries the whole computer\'s sound. On Windows 11 you can pick apps.');
      } else if (especifico && A.plat.desktop) {
        // pediu só alguns aplicativos (ou uma janela) e este computador não consegue separar: não manda o som do computador inteiro
        stream.getAudioTracks().forEach((t) => { stream.removeTrack(t); t.stop(); }); S.local.somTela = false;
        aviso('Este computador não consegue enviar o som só desse(s) aplicativo(s). Para os amigos não ouvirem o resto, a transmissão está sem som. Compartilhe a tela inteira para enviar o som do sistema.', 'This computer cannot send sound from only those app(s). So friends do not hear everything else, the stream has no sound. Share the whole screen to send system sound.');
      }
    } catch (e) { A.log.aviso('audio nativo', e); }
  }

  // (0.6.0) duas escolhas separadas: tirar o som do próprio Aero (vozes dos amigos, sons do app) e tirar o som do Discord
  const semAero = () => { const h = A.cfg.v.host; return h.semEcoAero !== undefined ? h.semEcoAero !== false : h.semEco !== false; };
  const semDiscord = () => { const h = A.cfg.v.host; return h.semEcoDiscord !== undefined ? h.semEcoDiscord !== false : h.semEco !== false; };
  S.semAero = semAero; S.semDiscord = semDiscord;
  // A captura entrega imagem de verdade? No Wayland (PipeWire) acontece de a 2ª captura da mesma sessão do app vir PRETA: o portal entrega
  // um fluxo sem nenhum quadro. Espera o 1º quadro por até 3 s.
  const chegaImagem = (stream, ms = 3000) => new Promise((ok) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream;
    let feito = false; const fim = (r) => { if (feito) return; feito = true; clearTimeout(t); try { v.pause(); v.srcObject = null; } catch (e) { /* ok */ } ok(r); };
    const t = setTimeout(() => fim(false), ms);
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => fim(true)); else v.addEventListener('loadeddata', () => fim(true), { once: true });
    v.play().catch(() => {});
  });
  S._chegaImagem = chegaImagem; // para os testes
  // a captura da tela (com o seletor do app do PC e o som por aplicativo) também serve às chamadas do Aero Talk
  S.capturarTela = capturarTela; S.prepararAudioTela = prepararAudio;

  async function capturarImagem(opts) {
    // (0.7.4) MODO JOGO no Linux: a imagem vem direto da placa (veja kms.js). Sem ela (não instalada, falhou), a captura normal de sempre
    // (0.7.13) só no modo jogo: a captura direta pega a tela inteira sem perguntar, e no Compartilhar a pessoa escolhe a tela ou a janela (seletor do sistema)
    let stream = null; S.local.kms = false;
    if (!opts.camera && opts.modo === 'jogo' && !opts.semKms && !S._semKms && A.kms && (await A.kms.disponivel())) {
      S._kmsPedido = kmsPedido(opts.preset);
      stream = await A.kms.iniciar({ preset: S._kmsPedido }).catch((e) => { A.log.aviso('captura direta', e); return null; });
      if (stream) {
        const inf = A.kms.info() || {};
        S.local.kms = true; S.local.superficie = 'monitor'; S.local.fonte = null; S.local.protegida = false;
        S.local.capLarg = inf.larg || 0; S.local.capAlt = inf.alt || 0;
      }
    }
    if (!stream) stream = await capturarTela(opts);
    if (desktop() && !opts.camera && !S.local.kms && !(await chegaImagem(stream))) {
      // sem nenhum quadro: fecha esta captura POR COMPLETO (libera a sessão do portal) e pede uma nova uma vez
      A.log.aviso('captura: nenhum quadro em 3 s, pedindo uma captura nova');
      stream.getTracks().forEach((t) => t.stop());
      if (window.aero.gpu && window.aero.gpu.transmitindo) await window.aero.gpu.transmitindo(false).catch(() => {}); // o app do PC esquece a fonte antiga
      emit('aviso', { msg: A.T('A captura veio sem imagem (o seletor do sistema às vezes faz isso). Escolha a tela ou janela de novo.', 'The capture came with no image (the system picker sometimes does that). Choose the screen or window again.') });
      stream = await capturarTela(opts);
      if (!(await chegaImagem(stream, 4000))) {
        stream.getTracks().forEach((t) => t.stop());
        throw Object.assign(new Error(A.T('A captura continua sem imagem. Feche e abra o Aero; se continuar, rode no terminal: systemctl --user restart xdg-desktop-portal xdg-desktop-portal-kde pipewire', 'The capture still has no image. Close and reopen Aero; if it persists, run in a terminal: systemctl --user restart xdg-desktop-portal xdg-desktop-portal-kde pipewire')), { name: 'ErroCaptura' });
      }
    }
    return stream;
  }
  S.compartilhar = async (opts) => {
    if (S.local.tela) return S.local.tela;
    S._optsComp = opts;
    const stream = await capturarImagem(opts);
    await prepararAudio(stream, { audio: opts.audio, apps: opts.apps });
    const vt = stream.getVideoTracks()[0];
    vt.contentHint = 'motion'; // prioriza movimento fluido em vez de nitidez parada
    if (!S.local.kms) vt.addEventListener('ended', () => S.pararCompartilhar()); // (a captura direta avisa pelo "kms:fim" e volta para a normal)
    S.local.tela = stream; S.local.modo = opts.modo === 'jogo' ? 'jogo' : 'tela'; S.local.preset = opts.preset || null;
    S.peers.forEach(adicionarLocais);
    if (desktop() && window.aero.gpu && window.aero.gpu.transmitindo) window.aero.gpu.transmitindo(true).catch(() => {}); // bilhete de segurança (veja main.js)
    enviar({ tipo: 'comp', ativo: true, modo: S.local.modo });
    H.anunciarSala(S.sala, true);
    A.som.tocar('compartilhar');
    emit('local', { tela: true });
    if (S.local.modo === 'jogo' && A.entrada && A.entrada.avisarCapacidade) A.entrada.avisarCapacidade(); // se este PC não aceita controle remoto, diz o que fazer
    return stream;
  };

  // (0.7.6) a tela da chamada, nos dois modos: a mesma imagem de S.compartilhar; quem liga cada pessoa é a chamada (S.peersChamada)
  S.compartilharChamada = async (opts) => {
    const modo = opts.modo === 'jogo' ? 'jogo' : 'tela', stream = await capturarImagem({ ...opts, modo });
    stream.getVideoTracks()[0].contentHint = 'motion';
    S.local.tela = stream; S.local.modo = modo; S.local.preset = opts.preset || null; S.local.naChamada = true;
    return stream;
  };
  S.pararChamada = () => {
    if (!S.local.naChamada) return;
    const kms = S.local.kms;
    Object.assign(S.local, { naChamada: false, tela: null, modo: 'tela', preset: null, kms: false, capAlt: 0, capLarg: 0 });
    if (kms && A.kms) A.kms.parar();
  };
  S.novoPeerChamada = (id, pc, extras) => { const peer = { id, pc, criadoEm: Date.now(), iniciou: true, pend: [], senders: new Map(), pedido: 'auto', ult: null, est: { escala: 1, ruim: 0, bom: 0 }, ...extras }; S.peersChamada.set(id, peer); return peer; };
  S.sinalDaChamada = (peer, d) => { if (d && (d.decod || d.tela || d.codecFalhou || d.verde)) tratarSinal(peer, d); };
  S.aplicarQualidadePeer = (peer) => aplicarQualidade(peer);
  S.medirJogo = () => medirTudo();

  S.pararCompartilhar = () => {
    const s = S.local.tela; if (!s) return;
    S.local.tela = null; S.local.capAlt = 0; S.local.capLarg = 0; somSolo = null;
    removerLocais(s); s.getTracks().forEach((t) => t.stop());
    if (S.local.kms && A.kms) A.kms.parar(); S.local.kms = false;
    if (desktop() && window.aero.gpu && window.aero.gpu.transmitindo) window.aero.gpu.transmitindo(false).catch(() => {});
    if (A.captura) A.captura.pararAudio();
    if ((A.cfg.v.host.appsCaptura || []).length) { A.cfg.v.host.appsCaptura = []; A.cfg.salvar(); } // ao parar de transmitir, a escolha de aplicativos volta ao padrão
    if (desktop() && window.aero.protegerJanela && S.local.protegida) window.aero.protegerJanela(false).catch(() => {});
    S.local.protegida = false; S.local.audioNativo = false; S.envio = null;
    enviar({ tipo: 'comp', ativo: false });
    H.anunciarSala(S.sala, false);
    emit('local', { tela: false });
  };

  // Trocar de tela/janela sem derrubar a transmissão (as conexões continuam: só a imagem muda)
  S.trocarFonte = async ({ fonteId, fonte }) => {
    const s = S.local.tela; if (!s) return;
    // a captura direta é sempre a tela inteira: escolher uma tela/janela passa para a captura normal (as conexões continuam)
    if (S.local.kms) return reiniciarCompartilhar({ fonteId, fonte, semKms: true });
    const antigo = s.getVideoTracks()[0];
    const novoStream = await capturarTela({ fonteId, fonte, preset: S.local.preset, audio: false });
    const nv = novoStream.getVideoTracks()[0];
    nv.contentHint = 'motion';
    nv.addEventListener('ended', () => S.pararCompartilhar());
    for (const peer of S.peers.values()) {
      const sender = peer.senders.get(antigo.id);
      if (sender) { try { await sender.replaceTrack(nv); } catch (e) { A.log.aviso('trocar fonte', e); } peer.senders.delete(antigo.id); peer.senders.set(nv.id, sender); }
    }
    s.removeTrack(antigo); s.addTrack(nv); antigo.stop();
    S.local.capAlt = 0; S.local.capLarg = 0; // tela nova: o tamanho real vem de novo pelas estatísticas
    S.aplicarQualidadeTodos();
    // trocou de tela/janela: o som acompanha (janela nova = o aplicativo dela + os marcados; tela = os marcados ou tudo)
    if (S.local.audioNativo && S.local.somTela) S.definirAppsCaptura(A.cfg.v.host.appsCaptura || []).catch(() => {});
    emit('local', { tela: true, trocou: true });
  };

  // refaz a transmissão com as mesmas opções (usado quando a captura direta para ou não serve mais): para e começa de novo, sem sair da sala
  async function reiniciarCompartilhar(extra) {
    const o = { ...(S._optsComp || {}), ...(extra || {}) };
    S.pararCompartilhar();
    try { await S.compartilhar(o); } catch (e) { A.log.aviso('voltar para a captura normal', e); emit('aviso', { msg: A.T('A captura direta parou e não consegui voltar para a captura normal: compartilhe a tela de novo.', 'Direct capture stopped and I could not switch back to normal capture: share your screen again.') }); }
  }
  A.evt.on('kms:fim', ({ trilha }) => {
    if (!S.local.kms || !S.local.tela || !S.local.tela.getVideoTracks().includes(trilha)) return;
    S._semKms = true; // nesta sessão do app fica na captura normal (não fica alternando)
    if (S.local.naChamada) { A.evt.emit('chamada:kms-fim'); return; }
    emit('aviso', { msg: A.T('A captura direta da placa parou. A transmissão continua pela captura normal.', 'Direct GPU capture stopped. The stream continues with normal capture.') });
    reiniciarCompartilhar();
  });

  // As opções da transmissão valem NA HORA (antes só na próxima transmissão, e parecia que não faziam nada)
  S.aplicarJanelaNaCaptura = async () => {
    if (!S.local.tela || !desktop() || !window.aero.protegerJanela) return;
    const esconder = !A.cfg.v.host.incluirApp;
    try { const r = await window.aero.protegerJanela(esconder); S.local.protegida = esconder && !!(r && r.eficaz); } catch (e) { /* ok */ }
    emit('local', { protegida: S.local.protegida });
  };
  S.aplicarSomDoAero = () => (S.local.tela && S.local.somTela && A.captura ? S.definirAppsCaptura(A.cfg.v.host.appsCaptura || []).catch(() => false) : Promise.resolve(false));

  // Escolher quais aplicativos têm o som enviado (só no app do PC)
  S.definirAppsCaptura = async (ids) => {
    A.cfg.v.host.appsCaptura = ids.slice(0, 32); A.cfg.salvar();
    const s = S.local.tela; if (!s || !A.captura || !S.local.somTela) return false;
    const r = await A.captura.iniciarAudio({ ids, excluirAero: semAero(), excluirDiscord: semDiscord(), janela: null });
    if (!r || !r.track) return false;
    const antigo = s.getAudioTracks()[0];
    for (const peer of S.peers.values()) {
      const sender = antigo ? peer.senders.get(antigo.id) : null;
      if (sender) { await sender.replaceTrack(r.track).catch(() => {}); peer.senders.delete(antigo.id); peer.senders.set(r.track.id, sender); }
      else { const sd = peer.pc.addTrack(r.track, streamPara(r.track, s)); peer.senders.set(r.track.id, sd); avisarSomSolo(peer.id); }
    }
    if (antigo) { s.removeTrack(antigo); antigo.stop(); }
    s.addTrack(r.track); S.local.audioNativo = true;
    emit('local', { audio: true });
    return true;
  };
  S.alternarSomTela = (ligar) => { const s = S.local.tela; if (!s) return; S.local.somTela = !!ligar; s.getAudioTracks().forEach((t) => { t.enabled = !!ligar; }); emit('local', { audio: !!ligar }); };

  // A prévia do que EU estou transmitindo. Se eu compartilho a tela inteira e o Aero Stream aparece nela (não foi escondido da captura),
  // mostrar a prévia criaria o "espelho infinito". Regra: 'sempre' mostra, 'nunca' esconde, 'auto' esconde só nesse caso.
  S.previewSeguro = () => {
    const modo = A.cfg.v.host.preview;
    // (0.7.4) captura direta: aqui só existe o quadrinho que marca o ritmo (cinza). (0.7.6) Com "Sempre mostrar", a prévia é a imagem da
    // placa decodificada aqui (kms.js); no automático e no "Nunca" ela fica escondida (a tela inteira viraria espelho)
    if (S.local.kms) { const p = A.kms && A.kms.previa(); return modo === 'sempre' && !!p; } // (previa() também fecha o decodificador quando a opção sai do "Sempre")
    if (modo === 'sempre') return true;
    if (modo === 'nunca') return false;
    if (S.local.superficie === 'monitor' && !S.local.protegida) return false;
    return true;
  };

  // o que aparece na SUA prévia: a própria captura, ou (captura direta) a imagem da placa decodificada aqui
  S.streamPrevia = () => (S.local.kms ? (A.kms && A.kms.previa()) || S.local.tela : S.local.tela);
  S.trocarModo = (modo) => {
    if (!S.local.tela) return;
    S.local.modo = modo === 'jogo' ? 'jogo' : 'tela';
    enviar({ tipo: 'comp', ativo: true, modo: S.local.modo });
    emit('local', { modo: S.local.modo });
    if (S.local.modo === 'jogo' && A.entrada && A.entrada.avisarCapacidade) A.entrada.avisarCapacidade();
  };

  // ---------- microfone (liga uma vez; depois só muta, sem renegociar nada) ----------
  S.micLigado = () => !!S.local.mic && !S.local.micMudo;
  S.mic = async (ligar) => {
    if (ligar) {
      if (!S.local.mic) {
        const stream = await A.mic.iniciar();
        S.local.mic = stream; S.peers.forEach(adicionarLocais);
      }
      S.local.micMudo = false; A.mic.mudo(false);
      enviar({ tipo: 'mic', ativo: true }); A.som.tocar('mic-on'); emit('local', { mic: true });
    } else {
      if (!S.local.mic) return;
      S.local.micMudo = true; A.mic.mudo(true);
      enviar({ tipo: 'mic', ativo: false }); A.som.tocar('mic-off'); emit('local', { mic: false });
    }
  };
  S.reiniciarMic = async () => { if (S.local.mic) await A.mic.reiniciar(); };

  // ---------- qualidade: fps estrito ----------
  // Limites que cada espectador pode pedir (computador fraco pede "leve")
  // (só se o PRÓPRIO espectador pedir "leve" no aparelho dele; o host nunca é limitado)
  const LIMITES = { leve: { fps: 30, mbps: 3, alt: 720 } };
  const ALT_MIN = 360;
  // (0.7.6) os degraus de tamanho quando uma pessoa recebe menos (a internet ou o PC dela): o fps fica, o tamanho desce
  const ESCADA_ALT = [2160, 1440, 1080, 900, 720, 540, 432, 360];
  // bits por pixel que o H.264 da placa precisa para não pixelar no movimento (abaixo disso, vale mais um tamanho menor e nítido)
  const BPP_LIMPO = 0.08;
  const altParaBanda = (larg0, alt0, fps, kbps) => { // o maior degrau (até o escolhido) que cabe na internet dessa pessoa
    for (const a of [alt0, ...ESCADA_ALT.filter((x) => x < alt0)]) if ((((larg0 * a) / alt0) * a * fps * BPP_LIMPO) / 1000 <= kbps) return a;
    return ESCADA_ALT[ESCADA_ALT.length - 1];
  };
  // Taxa automática pela quantidade de pixels por segundo (H.264 da placa, ~0,1 bit por pixel): 1080p60 ≈ 12 Mbps, 1440p60 ≈ 22, 1080p120 ≈ 25, 4K60 ≈ 50.
  // É o TETO: o controle de congestionamento do WebRTC sobe até ele se a internet deixar, e desce sozinho se não deixar.
  const taxaAuto = (larg, alt, fps) => A.limitar(Math.round((larg * alt * fps * 0.1) / 1e5) / 10, 4, 80);
  function alvoDe(peer) {
    const p = S.local.preset || { larg: 1920, alt: 1080, fps: 60, mbps: 0 };
    const lim = LIMITES[peer.pedido] || { fps: 999, mbps: 999, alt: 99999 };
    const st0 = (S.local.tela && S.local.tela.getVideoTracks()[0] && S.local.tela.getVideoTracks()[0].getSettings()) || {};
    // tamanho REAL da captura: no PipeWire (Wayland) o getSettings() pode dizer um tamanho provisório até chegarem os primeiros quadros;
    // o que a estatística "media-source" mede vale mais (sem isso a taxa automática ficava presa no piso de 4 Mbps)
    const st = S.local.capAlt ? { width: S.local.capLarg, height: S.local.capAlt } : st0;
    const alt = Math.min(p.alt, lim.alt, st.height || 99999);
    const larg = st.height ? Math.round((st.width || 1920) * (alt / st.height)) : p.larg;
    // (0.7.6) captura direta: o H.264 da placa em taxa constante precisa de mais bits que o do Chromium para a mesma nitidez (com 6 Mbps em
    // 1080p60 o jogo ficava pixelado). A placa codifica de graça, então vale no mínimo a taxa automática; quem limita é a internet (medirTudo)
    const ik = S.local.kms && A.kms && A.kms.info(); // (o tamanho da trilha é o do quadrinho de 16x16: vale o da placa)
    // (0.7.6) e 1,5x a automática (mínimo 6 Mbps): em taxa constante a placa não guarda bits para a cena rápida, e o jogo pixelava no movimento
    // (720p30 tinha só 4 Mbps). Continua sendo só o teto: a taxa de verdade segue o que a internet de quem assiste aguenta
    // (0.7.6) e cada pessoa tem o seu codificador: internet que não aguenta o tamanho escolhido recebe um tamanho menor e nítido no MESMO
    // fps (altBanda); PC que não dá conta de decodificar, idem (decodAlt). Só para essa pessoa
    // (0.7.9) e nunca maior que a tela dessa pessoa: 1080p num monitor 1366x768 pesa o dobro e não mostra um ponto a mais
    const altO = (ik && ik.alt) || st.height || 0, largO = (ik && ik.larg) || st.width || 0;
    const altTela = peer.telaV && altO && largO ? Math.max(360, Math.min(peer.telaV.a, Math.round((peer.telaV.l * altO) / largO))) : 99999;
    const altK = ik ? Math.min(ik.alt || alt, peer.altBanda || 99999, peer.decodAlt || 99999, altTela) : 0;
    const largK = ik && ik.alt ? Math.round(((ik.larg || larg) * altK) / ik.alt) : 0;
    const mbps = ik ? Math.max(p.mbps || 0, 6, Math.min(80, taxaAuto(largK, altK, p.fps) * 1.5)) : p.mbps > 0 ? p.mbps : taxaAuto(larg, alt, p.fps);
    // (0.7.10) a internet nunca derruba o fps, em nenhum modo: quem desce é o tamanho (altBanda). Só o PC que não decodifica, veja decodDescer
    // (1.0.0) ...a não ser que, no fps escolhido, a internet dessa pessoa só aguente menos de 720p: aí o fps DELA desce (60, depois 30) e a imagem
    // fica nítida (120 fps em 432p era borrão). Só para essa pessoa
    const fps = Math.min(p.fps, lim.fps, peer.decodFps || 999, peer.bandaFps || 999);
    // (0.7.2) a placa parou de codificar (o processador assumiu): no máximo 720p até ela voltar, senão o processador engasga tudo
    // (0.7.6) o PC de quem assiste não dá conta de decodificar: no máximo 720p SÓ para essa pessoa (na captura direta não existe: a imagem da
    // placa é uma só para todos e a sua transmissão nunca muda por causa de alguém)
    // (1.0.0) e nunca muito acima do que a internet dessa pessoa aguenta (o teto de 25 Mbps com 3 Mbps de internet enchia a fila: o codificador da
    // placa passa do alvo nas cenas que mexem). 30% de folga para o WebRTC ainda conseguir medir que a internet melhorou
    const tetoBanda = peer.bandaTeto > 0 ? Math.max(1.2, (peer.bandaTeto * 1.3) / 1000) : 999;
    const taxa = Math.min(mbps, lim.mbps, peer.telaV && peer.telaV.c ? 8 : 999, tetoBanda) * (peer.freio || 1); // (freio: a fila na internet dessa pessoa, veja frearAtraso; celular: até 8 Mb/s)
    if (ik) return { fps, mbps: taxa, alt: altK };
    return { fps, mbps: taxa, alt: Math.min(peer.semPlaca ? Math.min(alt, 720) : alt, peer.altBanda || 99999, peer.decodAlt || 99999, altTela) };
  }
  // (0.7.9) PC que não dá conta de decodificar: desce o tamanho. Mais baixo que 540p não adianta: a imagem ficava em 360p e o tempo de decodificação
  // nem mudava (22 ms em 1080p, 43 ms em 432p). (0.7.10) o fps só cai depois de chegar em 540p: antes ele caía para 30 já em 720p
  function decodDescer(peer, h, ms, impl) {
    if (!(h > 0) || Date.now() - (peer.decodEm || 0) < 3000) return false; // o aviso pode ser de antes da última troca
    const a = alvoDe(peer), o = { alt: peer.decodAlt || 0, fps: peer.decodFps || 0 };
    // (0.8.4) quem assiste decodifica cada quadro em bem menos que o tempo dele (2 ms com 8 ms de folga a 120 fps): o PC dá conta, o que encheu a
    // fila foi uma rajada (da internet ou do jogo aqui). Derrubar para 30 fps por isso era a tela "a uns 20 fps". Versões antigas ainda avisam assim
    const msQ = Number(ms), folga = 1000 / Math.max(30, a.fps || 60);
    if (msQ > 0 && msQ < folga * 0.5) { if (Date.now() - (peer.ignorouDecod || 0) < 60000) return false; peer.ignorouDecod = Date.now(); A.log.info('aviso de decodificação ignorado (o PC de quem assiste dá conta)', peer.id, h + 'p', msQ + ' ms por quadro'); return false; }
    if (h > 720) peer.decodAlt = Math.max(720, ESCADA_ALT.find((x) => x < h) || 720);
    else if (h > 540) peer.decodAlt = 540;
    else if (a.fps > 30) peer.decodFps = 30;
    else return false;
    // subiu há pouco e não aguentou: espera o dobro antes de tentar de novo (até 10 min)
    peer.decodEspera = peer.decodEm && peer.decodSubiu >= peer.decodEm && Date.now() - peer.decodSubiu < 45000 ? Math.min(600000, (peer.decodEspera || 30000) * 2) : peer.decodEspera || 30000;
    (peer.decodPilha || (peer.decodPilha = [])).push(o); peer.decodEm = Date.now();
    A.log.aviso('o PC de quem assiste não está dando conta de decodificar', peer.id, h + 'p', (ms || '?') + ' ms por quadro', impl || '', '- só para essa pessoa: ' + (peer.decodAlt || h) + 'p ' + (peer.decodFps || a.fps) + ' fps');
    aplicarQualidade(peer);
    return true;
  }
  // (0.7.9) a qualidade volta sozinha um degrau de cada vez: antes, um aperto de poucos segundos deixava a pessoa em 360p até o fim da chamada
  function decodSubir(peer) {
    if (!(peer.decodPilha && peer.decodPilha.length) || Date.now() - (peer.decodEm || 0) < (peer.decodEspera || 30000)) return false;
    const o = peer.decodPilha.pop(); peer.decodAlt = o.alt; peer.decodFps = o.fps; peer.decodSubiu = peer.decodEm = Date.now();
    A.log.info('quem assiste aguentou: qualidade sobe um degrau', peer.id, (o.alt || 'sem limite de ') + 'p', (o.fps || 'sem limite de ') + ' fps');
    aplicarQualidade(peer);
    return true;
  }
  // (0.7.10) a imagem chega verde para essa pessoa. 1º aviso: um quadro inteiro; 2º: o H.264 Baseline, feito pela mesma placa (o VP8 seria pelo
  // processador de quem transmite). A captura direta só faz o H.264 dela: ali vale o quadro inteiro. O resto é o receptor de quem assiste
  function atenderVerde(peer) {
    peer.verdes = (peer.verdes || 0) + 1; peer.mandouQuadro = 0;
    if (peer.verdes === 1 || S.local.kms || peer.codecForcado || peer.baseNoProcessador || !A.gpu.usaPlaca()) { quadroInteiro(peer); return; }
    peer.codecForcado = 'h264-base'; peer.baseCpuN = 0; A.log.aviso('imagem verde para', peer.id, ': H.264 Baseline só para essa pessoa');
    if (peer.aoBase) { peer.aoBase(); return; }
    for (const tr of peer.pc.getTransceivers()) if (tr.sender && tr.sender.track && tr.sender.track.kind === 'video') A.codec.preferir(tr, { pref: 'h264-base', soH264: true, soBase: true });
    if (peer.pc.onnegotiationneeded) peer.pc.onnegotiationneeded();
  }
  // o vídeo dessa pessoa passa para o decodificador próprio (veja receptor.js). false: não dá neste navegador
  function receptorProprio(peer, opts) {
    const st = peer.telaStream ? peer.telaStream() : ([...S.remotas.values()].find((x) => x.peerId === peer.id && x.tela) || {}).stream;
    const rx = st && peer.pc.getReceivers().find((x) => x.track && x.track.kind === 'video' && A.receptor && A.receptor.de(x) && (st.getVideoTracks().includes(x.track) || A.receptor.de(x).proprio));
    const ctl = rx && A.receptor.de(rx); if (!ctl) return false;
    return ctl.proprio || ctl.usarProprio(st, opts);
  }
  // (1.0.0) o tamanho em que a tela dessa pessoa aparece aqui (o maior vídeo visível com ela, em pontos CSS, sem as faixas pretas).
  // achou = false: nenhum vídeo com essa tela (o decodificador próprio usa outro stream): vale o tamanho do monitor, como antes
  function tamVisto(peer) {
    const st = peer.telaStream ? peer.telaStream() : ([...S.remotas.values()].find((x) => x.peerId === peer.id && x.tela) || {}).stream;
    if (!st) return null;
    const trs = st.getVideoTracks(); let l = 0, a = 0, achou = false;
    for (const v of document.querySelectorAll('video')) {
      const so = v.srcObject; if (!so || !(so === st || (so.getVideoTracks && so.getVideoTracks().some((t) => trs.includes(t))))) continue;
      achou = true;
      const r = v.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      if (getComputedStyle(v).visibility === 'hidden') continue;
      const vw = v.videoWidth || 16, vh = v.videoHeight || 9, ca = Math.min(r.height, (r.width * vh) / vw);
      if (ca > a) { a = ca; l = (ca * vw) / vh; }
    }
    return { achou, l, a };
  }
  S._tamVisto = tamVisto;
  S.receptorProprio = (peerId, opts) => { const p = S.peers.get(peerId) || S.peersChamada.get(peerId); return !!p && receptorProprio(p, opts); };
  S.avisarVerde = (peerId) => sinal(peerId, { verde: 1 });
  S._alvoDe = alvoDe; S._escalaPar = escalaPar; S._taxaAuto = taxaAuto; S._decodDescer = decodDescer; S._decodSubir = decodSubir; // expostos para os testes
  // (0.7.11) a placa só codifica largura e altura pares. 1080p reduzido para 768p pela altura dava 1365x768 (e 480p dava 853x480): o Chrome passava
  // esse vídeo para o processador. O WebRTC arredonda para o inteiro mais próximo, então procura a escala mais próxima em que os dois lados saem pares
  function escalaPar(larg, alt, esc) {
    if (!(larg > 0 && alt > 0)) return esc;
    for (let h = Math.floor(alt / esc / 2) * 2; h >= 2 && h > alt / esc - 16; h -= 2) {
      const l0 = Math.round((larg * h) / alt / 2) * 2;
      for (const l of [l0, l0 - 2, l0 + 2]) {
        const de = Math.max(larg / (l + 0.5), alt / (h + 0.5)), ate = Math.min(larg / (l - 0.5), alt / (h - 0.5));
        if (l < 2 || de >= ate || ate <= 1) continue;
        return esc > de && esc < ate ? esc : Math.max(1, (de + ate) / 2);
      }
    }
    return esc;
  }
  // (0.6.1) quem assiste pediu um quadro inteiro (a imagem dele quebrou com uma perda): só a trilha dessa pessoa é religada num instante e o
  // codificador recomeça com um quadro inteiro. No máximo a cada 2,5 s por pessoa
  // religa o codificador de vídeo dessa pessoa (o Chrome cria um novo e tenta a placa de novo)
  async function recriarCodificador(peer) {
    if (peer.religando) return;
    for (const sender of peer.senders.values()) {
      if (!sender.track || sender.track.kind !== 'video') continue;
      const p = sender.getParameters(); if (!p.encodings || !p.encodings[0]) continue;
      peer.religando = true;
      try { p.encodings[0].active = false; await sender.setParameters(p); } catch (e) { /* ok */ } finally {
        for (let n = 0; n < 3; n++) { try { const p2 = sender.getParameters(); p2.encodings[0].active = true; await sender.setParameters(p2); break; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } }
        peer.religando = false;
      }
    }
  }
  function forcarVp8(peer, motivo) {
    if (peer.codecForcado) return;
    if (S.local.kms) { A.log.aviso('captura direta: a troca para VP8 não existe (a placa faz H.264)', peer.id, motivo || ''); return; }
    peer.codecForcado = 'vp8';
    // (0.7.8) o VP8 sai pelo PROCESSADOR: num jogo pesado ele ocupa todos os núcleos e leva junto a internet e o som (o "ms" subindo quando o
    // jogo mexe e o som pipocado, que continuava depois de fechar o jogo). Por isso a troca automática é sempre provisória: tenta a placa de novo
    if (motivo) {
      A.log.aviso('o codificador não fez nenhum quadro para', peer.id, '(' + motivo + '): mandando em VP8 por enquanto');
      peer.vp8Auto = (peer.vp8Auto || 0) + 1;
      clearTimeout(peer.tVoltaPlaca); peer.tVoltaPlaca = setTimeout(() => voltarPlaca(peer), Math.min(600000, VOLTA_PLACA_MS * 2 ** (peer.vp8Auto - 1)));
    }
    if (peer.aoVp8) { peer.aoVp8(); return; }
    for (const tr of peer.pc.getTransceivers()) if (tr.sender && tr.sender.track && tr.sender.track.kind === 'video') A.codec.preferir(tr, { pref: 'vp8' });
    if (peer.pc.onnegotiationneeded) peer.pc.onnegotiationneeded();
  }
  const VOLTA_PLACA_MS = 45000;
  function voltarPlaca(peer) {
    if (peer.codecForcado !== 'vp8' || !peer.vp8Auto || peer.pc.connectionState === 'closed') return;
    peer.codecForcado = null; peer.zerado = 0; A.log.info('tentando a placa de novo para', peer.id);
    formatoDaPlaca(peer);
  }
  function formatoDaPlaca(peer) {
    if (peer.aoPlaca) { peer.aoPlaca(); return; }
    for (const tr of peer.pc.getTransceivers()) if (tr.sender && tr.sender.track && tr.sender.track.kind === 'video') A.codec.preferir(tr, { pref: A.gpu.codecAtual(), soH264: A.gpu.usaPlaca() });
    if (peer.pc.onnegotiationneeded) peer.pc.onnegotiationneeded();
  }
  S._voltarPlaca = voltarPlaca; // exposto para os testes
  async function quadroInteiro(peer) {
    if (!peer || Date.now() - (peer.mandouQuadro || 0) < 12000) return; peer.mandouQuadro = Date.now();
    for (const sender of peer.senders.values()) {
      if (!sender.track || sender.track.kind !== 'video') continue;
      try {
        if (typeof sender.generateKeyFrame === 'function') { await sender.generateKeyFrame(); continue; }
        const p = sender.getParameters(); if (!p.encodings || !p.encodings.length) continue;
        p.encodings[0].active = false; peer.religando = true;
        try { await sender.setParameters(p); } finally {
          // (0.7.2) religar SEMPRE (antes, se este passo falhasse, a tela ficava desligada para essa pessoa: "0×0 · 0 fps")
          for (let n = 0; n < 3; n++) { try { const p2 = sender.getParameters(); if (p2.encodings && p2.encodings[0]) { p2.encodings[0].active = true; await sender.setParameters(p2); } break; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } }
          peer.religando = false;
        }
      } catch (e) { /* tenta no próximo pedido */ }
    }
  }
  A.evt.on('sala:dc', ({ de, dados }) => { if (typeof dados !== 'string' || dados.length > 40 || !dados.includes('"quadro"') || !S.local.tela) return; let m; try { m = JSON.parse(dados); } catch (e) { return; } if (m && m.t === 'quadro') quadroInteiro(S.peers.get(de)); });
  function aplicarQualidade(peer) {
    if (!S.local.preset) return;
    // (0.7.8) um ajuste de cada vez: dois ao mesmo tempo no mesmo envio dão erro no navegador e o último se perdia (arrastar o deslizante, por exemplo)
    if (peer.aplicando) { peer.reaplicar = true; return; }
    const envios = [];
    for (const sender of peer.senders.values()) {
      if (!sender.track || sender.track.kind !== 'video') continue;
      try {
        const alvo = alvoDe(peer);
        const par = sender.getParameters();
        if (!par.encodings || !par.encodings.length) par.encodings = [{}];
        const e = par.encodings[0];
        // (0.7.2) nunca deixa o vídeo desligado nem com valores que travam o codificador (taxa 0, escala inválida): era o "0×0 · 0 fps"
        if (!peer.religando) e.active = true;
        e.maxBitrate = Math.round(Math.max(0.3, Number(alvo.mbps) || 0.3) * 1e6);
        if (peer.ultimoAlvo !== alvo.mbps + '|' + alvo.alt + '|' + alvo.fps) { peer.ultimoAlvo = alvo.mbps + '|' + alvo.alt + '|' + alvo.fps; A.log.info('qualidade', peer.id, alvo.mbps + ' Mbps', alvo.alt + 'p', alvo.fps + ' fps', 'captura ' + (S.local.capLarg || '?') + 'x' + (S.local.capAlt || '?')); }
        if (A.kms && A.kms.ehTrilha(sender.track)) { // captura direta: o quadrinho só marca o ritmo; quem decide o tamanho é a placa
          A.kms.ajustar(sender, { alt: alvo.alt, fps: alvo.fps }); // (0.7.6) o canal (codificador) dessa pessoa
          e.maxFramerate = Math.max(alvo.fps, 60) * 2; e.scaleResolutionDownBy = 1; e.priority = 'high'; e.networkPriority = 'high';
          // (0.7.14) sem a adaptação do WebRTC: com 'maintain-resolution' ele ia cortando o ritmo do quadrinho com o tempo (8 de 30 fps saindo,
          // com a placa entregando 30) e só voltava ao normal quando a pessoa saía e entrava. O tamanho e o fps de cada pessoa já são decididos
          // aqui (o canal dela na placa); a transmissão do host não muda
          par.degradationPreference = S._semAdaptar === false ? 'maintain-framerate' : 'maintain-framerate-and-resolution';
          envios.push(sender.setParameters(par).catch((er) => { // navegador antigo sem o valor: 'maintain-framerate' (o quadrinho de 16x16 não tem como diminuir)
            if (S._semAdaptar !== false && /degradation|enum|TypeError/i.test(String(er && (er.name + er.message)))) { S._semAdaptar = false; aplicarQualidade(peer); } else A.log.aviso('setParameters', er); }));
          continue;
        }
        e.maxFramerate = alvo.fps;
        const ajustes = (sender.track.getSettings && sender.track.getSettings()) || {};
        const origem = ajustes.height || alvo.alt;
        const esc = (origem / (alvo.alt || origem)) * (peer.est.escala || 1);
        e.scaleResolutionDownBy = Number.isFinite(esc) ? escalaPar(ajustes.width, ajustes.height, Math.min(Math.max(1, esc), Math.max(1, origem / 144))) : 1; // no mínimo 144p
        e.priority = 'high'; e.networkPriority = 'high';
        // (0.7.10) o tamanho é decidido aqui (alvoDe e estabilizar), por pessoa. Com 'maintain-framerate' o WebRTC reduzia por conta própria: 1080p
        // com a placa e a internet sobrando saía em 960x540, e continuava assim. No processador ele continua reduzindo, para o PC de quem transmite não travar
        // (1.0.0) na placa ele pode descartar quadros quando a internet dessa pessoa não aguenta (sem isso a fila passava de 1 s e a imagem
        // virava borrão: o "4 pixels"). O fps de cada pessoa é decidido aqui (alvoDe); a captura e os outros não mudam
        par.degradationPreference = A.gpu.usaPlaca() ? 'maintain-resolution' : 'maintain-framerate';
        envios.push(sender.setParameters(par).catch((er) => A.log.aviso('setParameters', er)));
      } catch (e) { A.log.aviso('qualidade', e); }
    }
    if (envios.length) { peer.aplicando = true; Promise.all(envios).then(() => { peer.aplicando = false; if (peer.reaplicar) { peer.reaplicar = false; aplicarQualidade(peer); } }); }
  }
  S.aplicarQualidadeTodos = () => todosPeers().forEach(aplicarQualidade);
  // o que pedir à placa: só a resolução e o fps que VOCÊ escolheu (nada automático muda a sua transmissão: ela é a mesma para todo mundo)
  const kmsPedido = (p) => ({ alt: (p && p.alt) || 1080, fps: (p && p.fps) || 60 });
  function trocarKms() {
    clearTimeout(S._kmsT);
    S._kmsT = setTimeout(async () => { // (o deslizante muda várias vezes seguidas: espera parar)
      if (!S.local.kms || !A.kms) return;
      const alvo = kmsPedido(S.local.preset), ant = S._kmsPedido || {};
      if (alvo.alt === ant.alt && alvo.fps === ant.fps) return;
      S._kmsPedido = alvo;
      if (await A.kms.trocar(alvo)) { const i = A.kms.info() || {}; S.local.capLarg = i.larg || 0; S.local.capAlt = i.alt || 0; todosPeers().forEach((pe) => { pe.ultimoAlvo = ''; }); S.aplicarQualidadeTodos(); }
    }, 700);
  }
  // (0.7.8) arrastar o deslizante chamava isto a cada 20 ms e cada chamada mexia na captura e nos codificadores de todo mundo: agora no máximo a
  // cada 250 ms, e o último valor sempre vale
  S.atualizarPreset = (p) => {
    S.local.preset = p;
    clearTimeout(S._presetT);
    const resto = 250 - (Date.now() - (S._presetEm || 0));
    if (resto <= 0) aplicarPreset(); else S._presetT = setTimeout(aplicarPreset, resto);
  };
  function aplicarPreset() {
    const p = S.local.preset; if (!p) return;
    S._presetEm = Date.now();
    if (S.local.kms) { trocarKms(); S.aplicarQualidadeTodos(); return; } // captura direta: quem muda tamanho e ritmo é a placa
    const vt = S.local.tela && S.local.tela.getVideoTracks()[0];
    if (vt) fixarRitmo(vt, p);
    todosPeers().forEach((pe) => { pe.est.escala = 1; pe.est.ruim = 0; pe.est.bom = 0; });
    S.aplicarQualidadeTodos();
  }
  // "Imagem com defeito?": quem assiste pede que a transmissão para ele vá em VP8 (o mesmo formato das chamadas do Aero Talk)
  S.pedirOutroFormato = (peerId) => { const peer = S.peers.get(peerId); if (peer) peer.avisouCodec = true; sinal(peerId, { codecFalhou: (peer && peer.codecRecebido) || 'manual', motivo: 'manual' }); };
  S.pedirQualidade = (peerId, nivel) => { S._pedidos[peerId] = nivel; sinal(peerId, { qualidade: nivel }); };

  // O estabilizador: o fps é sagrado. Se o codificador não aguenta (CPU/placa no limite), diminui a RESOLUÇÃO em degraus;
  // quando fica folgado por muito tempo, sobe de novo (sem oscilar: lembra o ponto onde deu problema).
  function estabilizar(peer, s) {
    if (!S.local.preset || !s) return;
    if (S.local.kms) return; // captura direta: a taxa segue o WebRTC (medirTudo) e a placa não troca de codificador
    // (0.7.2) A PLACA PAROU DE CODIFICAR no meio da transmissão (jogo pesado enchendo a memória de vídeo, como na tela de carregamento do
    // Cyberpunk): o Chrome passa sozinho para o processador, na resolução cheia, e tudo trava. Agora: cai para 720p enquanto durar, tenta
    // voltar para a placa a cada 20 s (religando o codificador) e fica registrado no relatório de diagnóstico
    if (s.impl) {
      const agora = Date.now();
      if (s.hw) { peer.eraHw = true; peer.semPlacaN = 0; if (peer.semPlaca && agora >= (peer.placaVolta || 0)) { A.log.aviso('a placa voltou a codificar para', peer.id, '(' + s.impl + ')'); peer.semPlaca = 0; peer.placaSubiu = agora; aplicarQualidade(peer); } }
      else if (peer.codecForcado === 'h264-base') { // nesta placa o Baseline saiu pelo processador: desfaz (a transmissão não pode pesar para ajudar uma pessoa)
        if (++peer.baseCpuN >= 3) { peer.baseNoProcessador = true; peer.codecForcado = null; A.log.aviso('o H.264 Baseline saiu pelo processador para', peer.id, '- voltando ao da placa'); formatoDaPlaca(peer); }
      } else if (peer.eraHw && !peer.codecForcado) { // em VP8 de propósito o processador é o esperado
        // (0.7.4) o Chrome passa um instante para o processador quando o codificador é refeito (troca de resolução): só conta depois de
        // 3 medições seguidas, e a 1ª tentativa de voltar para a placa é logo (4 s), não depois de 20 s jogando no processador
        peer.semPlacaN = (peer.semPlacaN || 0) + 1;
        if (peer.semPlacaN < 3) { /* espera confirmar */ }
        else if (!peer.semPlaca) {
          // (0.7.11) subiu há pouco e caiu de novo: fica em 720p e espera o dobro antes de tentar (até 10 min). Antes ficava nesse vaivém a cada 4 s
          peer.placaEspera = agora - (peer.placaSubiu || 0) < 15000 ? Math.min(600000, (peer.placaEspera || 15000) * 2) : 0;
          peer.placaVolta = agora + peer.placaEspera; peer.semPlaca = agora; peer.tentouPlaca = agora - 16000;
          A.log.aviso('a placa parou de codificar para', peer.id, '- agora: ' + s.impl + ' (memória de vídeo cheia pelo jogo?). Baixando para 720p'); aplicarQualidade(peer);
        }
        else if (agora - (peer.tentouPlaca || 0) > 20000) { peer.tentouPlaca = agora; recriarCodificador(peer); }
      }
    }
    // (0.7.2) tela travada em "0×0 · 0 fps" para uma pessoa com a captura rodando: 1º religa e pede um quadro inteiro; continuando parada,
    // o codificador da placa não está conseguindo fazer o vídeo para ela: passa essa pessoa para VP8 (o mesmo das chamadas, que todo
    // computador faz e decodifica). Antes ficava assim para sempre (o amigo no Windows não via a tela)
    // (0.7.8) um instante sem quadro (jogo carregando, tela trocando de tamanho) não é o codificador quebrado: bastavam 7 s para ir ao VP8 e
    // nunca mais voltar. Agora: 7 s refaz o codificador da placa; o VP8 só depois de 20 s com a captura entregando quadros, e por pouco tempo
    if (peer.pc.connectionState === 'connected' && S.local.capAlt > 0 && !s.fps && !s.w) {
      peer.zerado = (peer.zerado || 0) + 1;
      if (peer.zerado === 3) { A.log.aviso('nada sai para', peer.id, '(0 fps) - religando o vídeo'); peer.mandouQuadro = 0; aplicarQualidade(peer); quadroInteiro(peer); }
      if (peer.zerado === 7 && !peer.codecForcado) { A.log.aviso('nada sai para', peer.id, '- refazendo o codificador'); recriarCodificador(peer); }
      if (peer.zerado >= 20 && s.captura > 0 && !peer.codecForcado) forcarVp8(peer, 'zerado');
    } else peer.zerado = 0;
    // (0.7.2) vigia: o vídeo para essa pessoa ficou desligado (sem ninguém religando)? Liga de novo
    if (!peer.religando) for (const sender of peer.senders.values()) { if (!sender.track || sender.track.kind !== 'video') continue; try { const e = (sender.getParameters().encodings || [])[0]; if (e && e.active === false) { A.log.aviso('vídeo desligado para', peer.id, '- religando'); aplicarQualidade(peer); } } catch (e) { /* ok */ } }
    const est = peer.est, agora = Date.now(), alvo = alvoDe(peer);
    if (!peer.inicioEnv && s.fps > 0) peer.inicioEnv = agora;
    const aquecendo = !peer.inicioEnv || agora - peer.inicioEnv < 10000;
    const cpu = s.motivo === 'cpu';
    // compara com o que a CAPTURA entrega (tela parada ou monitor de 60 Hz com 120 pedido não é culpa do codificador e não pode derrubar a resolução)
    const ref = s.captura > 0 ? Math.min(alvo.fps, s.captura) : alvo.fps;
    const atrasado = s.fps > 0 && s.fps < ref * 0.9, banda = s.motivo === 'bandwidth';
    // (0.5.9-7) limitado pela BANDA também baixa a resolução (antes só CPU): com a placa codificando (NVIDIA no Windows), o codificador não
    // reduz a imagem sozinho e jogava quadros fora (1-5 fps quando a tela mexia). O fps é sagrado: resolução cai primeiro, e mais rápido.
    const desabou = s.fps > 0 && s.fps < ref * 0.5;
    // (0.7.4) nos primeiros 10 s o WebRTC ainda está medindo a internet (diz "bandwidth" até a banda subir) e a captura está começando
    // (poucos fps): baixar a resolução aí refazia o codificador da placa à toa e, com o jogo enchendo a memória dela, ele caía no
    // processador (OpenH264) e a tela ficava travando. E com a placa codificando, só a banda (sem CPU) precisa de mais certeza
    const precisa = banda && s.hw && !cpu ? 5 : 3;
    if (!aquecendo && atrasado && (cpu || !s.hw || banda)) est.ruim += desabou ? 2 : 1; else est.ruim = Math.max(0, est.ruim - 1);
    if (est.ruim >= precisa && agora - est.ultimaMud > (desabou ? 1500 : 4000)) {
      const origem = (S.local.tela && S.local.tela.getVideoTracks()[0].getSettings().height) || alvo.alt;
      const maxEscala = Math.max(1, origem / ALT_MIN);
      const nova = Math.min(maxEscala, est.escala * (desabou ? 1.5 : 1.25));
      if (nova > est.escala + 0.001) {
        est.piso = est.escala; est.pisoAte = agora + 120000; est.escala = nova; est.ultimaMud = agora;
        A.log.info('estabilizador: resolução menor', peer.id, 'x' + nova.toFixed(2), 'fps', s.fps, 'alvo', alvo.fps, s.motivo);
        aplicarQualidade(peer); emit('estabilizador', { id: peer.id, escala: nova, queda: true });
      }
      est.ruim = 0;
    }
    if (s.fps >= ref * 0.97 && s.motivo === 'none') est.bom++; else est.bom = 0;
    if (est.bom >= 25 && est.escala > 1 && agora - est.ultimaMud > 8000) {
      const minimo = agora < est.pisoAte ? est.piso : 1; // não volta para o ponto que acabou de dar problema
      const nova = Math.max(minimo, est.escala / 1.25);
      if (nova < est.escala - 0.001) { est.escala = nova; est.ultimaMud = agora; aplicarQualidade(peer); emit('estabilizador', { id: peer.id, escala: nova, queda: false }); }
      est.bom = 0;
    }
  }
  S._estabilizar = estabilizar; // exposto para os testes
  // (0.7.8) o freio de atraso. O "ms" subindo quando a imagem mexe é fila: mexeu, a imagem pede mais bits do que a saída de internet aguenta, os
  // pacotes esperam e o som (que vai junto) chega picotado. O tempo de ida e volta subiu bem acima do normal: baixa a taxa SÓ dessa pessoa (a
  // captura, o fps e o que os outros recebem não mudam) e devolve aos poucos quando a fila esvazia
  function frearAtraso(peer, rtt) {
    if (rtt == null || !S.local.tela) return;
    const atraso = peer.rttBase == null ? 0 : rtt - peer.rttBase;
    if (peer.rttBase == null || rtt < peer.rttBase) peer.rttBase = rtt; else if (atraso < 100) peer.rttBase += (rtt - peer.rttBase) * 0.02;
    peer.atrasoN = atraso > 150 ? (peer.atrasoN || 0) + 1 : 0;
    peer.limpoN = atraso < 50 ? (peer.limpoN || 0) + 1 : 0;
    const antes = peer.freio || 1; let novo = antes;
    if (peer.atrasoN >= (atraso > 300 ? 1 : 2) && Date.now() - (peer.freouEm || 0) >= 2000) { novo = Math.max(0.3, antes * 0.7); peer.freouEm = Date.now(); peer.atrasoN = 0; }
    else if (antes < 1 && peer.limpoN >= 6) { novo = Math.min(1, antes * 1.15); peer.limpoN = 0; }
    if (novo === antes) return;
    if (antes === 1) A.log.info('fila na internet até', peer.id, rtt + ' ms (normal ' + Math.round(peer.rttBase) + ' ms): menos taxa só para essa pessoa');
    peer.freio = novo; aplicarQualidade(peer);
  }
  S._frearAtraso = frearAtraso; // exposto para os testes

  // ---------- o que eu recebo ----------
  function aoTrack(peer, e) {
    const stream = e.streams[0] || new MediaStream([e.track]);
    let r = S.remotas.get(stream.id);
    if (!r) { r = { id: stream.id, peerId: peer.id, stream, tela: false, gain: null }; S.remotas.set(stream.id, r); }
    r.tela = stream.getVideoTracks().length > 0;
    if (r.tela) for (const [sid, x] of [...S.remotas]) if (x.reatada && x.peerId === peer.id) { S.remotas.delete(sid); if (S.foco === sid) S.foco = null; } // o vídeo de verdade voltou
    r.somTela = !r.tela && somTelaDe.get(peer.id) === stream.id; // (0.7.3) o som da tela que veio separado (modo jogo)
    ajustarReceptor(peer, e.receiver);
    if (e.track.kind === 'video' && A.receptor) A.receptor.ligar(e.receiver);
    stream.onremovetrack = () => { if (!stream.getTracks().length) { desligarAudio(r); S.remotas.delete(stream.id); if (S.foco === stream.id) S.foco = null; emit('stream-fim', r); } };
    if (stream.getAudioTracks().length) ligarAudio(r);
    emit('stream', r);
  }
  // (0.7.3) quem transmite em modo jogo diz qual pacote é o som da tela: ele toca no volume das transmissões (e não como microfone)
  const somTelaDe = new Map(); // peerId -> id do pacote do som da tela
  A.evt.on('sala:dc', ({ de, dados }) => {
    if (typeof dados !== 'string' || !dados.includes('"somTela"')) return;
    let m; try { m = JSON.parse(dados); } catch (e) { return; }
    if (!m || m.t !== 'somTela' || typeof m.id !== 'string' || m.id.length > 80) return;
    somTelaDe.set(de, m.id);
    const r = S.remotas.get(m.id);
    if (r && r.peerId === de && !r.tela && !r.somTela) { desligarAudio(r); r.somTela = true; ligarAudio(r); }
  });
  function limparRemotas(peerId, soTela) {
    for (const [sid, r] of [...S.remotas]) {
      if (r.peerId !== peerId || (soTela && !r.tela && !r.somTela)) continue;
      desligarAudio(r); S.remotas.delete(sid); if (S.foco === sid) S.foco = null; emit('stream-fim', r);
    }
  }
  // Modo jogo: buffer mínimo (menos atraso). Compartilhar: um pouco de buffer evita travadinhas.
  function ajustarReceptor(peer, receptor) {
    const part = S.participante(peer.id), jogo = part && part.modo === 'jogo';
    // (0.5.9-6) jogo: 8 ms, não zero. Com zero o Chrome liga o "modo sem espera" e descarta todo quadro que chega um pouco fora do ritmo:
    // o vídeo de quem assiste caía para 40-50 fps. 8 ms (menos de meio quadro a 60 fps) absorve essa variação.
    // (0.6.0) transmissão normal: o buffer volta a ser o automático do WebRTC (ele aumenta sozinho quando a internet oscila). Com 15 ms fixos
    // qualquer variação deixava o vídeo atrasar e depois "correr" (o efeito câmera lenta) e o som saía do compasso. Só o modo jogo usa o mínimo.
    // (1.0.0) só quem CONTROLA a tela fica com o mínimo. Quem só assiste (nos dois modos) ganha 0,2 s de folga, como um vídeo: a internet
    // oscilando deixa de virar travadinha (o WebRTC ainda aumenta sozinho se precisar). A mesma regra da chamada (veja folgaTela)
    const ms = S.folgaTela(jogo, (() => { const c = S.meuCtl(); return !!(c && c.dono === peer.id && c.st !== 'pedindo'); })());
    try { if ('jitterBufferTarget' in receptor) receptor.jitterBufferTarget = ms; } catch (e) { /* navegador sem suporte */ }
    try { if ('playoutDelayHint' in receptor) receptor.playoutDelayHint = ms / 1000; } catch (e) { /* idem */ }
  }
  S.folgaTela = (jogo, controlando) => (jogo && controlando ? 8 : 200);
  function ajustarReceptores(peer) { peer.pc.getReceivers().forEach((r) => r.track && r.track.kind === 'video' && ajustarReceptor(peer, r)); }
  const peerReceptores = (id) => { const p = S.peers.get(id); if (p) ajustarReceptores(p); };

  // ---------- áudio: três volumes (geral, vozes, transmissões) e a saída escolhida, por Web Audio ----------
  // No iPhone o volume do <video> não funciona; por isso o som passa pelo Web Audio. Vozes (microfones dos amigos) e
  // transmissões (som das telas) têm barramentos separados: dá para baixar o jogo do amigo sem perder a conversa.
  S.volume = 1;
  const g100 = (v) => A.limitar(v, 0, 200) / 100;
  const ctxAudio = () => {
    const c = A.som.destravar() || A.som.ctx;
    if (!c) return null;
    if (!S.saida || S.saida.context !== c) {
      S.saida = c.createGain(); S.saida.gain.value = S.volume;
      S.busVoz = c.createGain(); S.busTrans = c.createGain();
      S.busVoz.gain.value = g100(A.cfg.v.audio.voz); S.busTrans.gain.value = g100(A.cfg.v.audio.trans);
      S.busVoz.connect(S.saida); S.busTrans.connect(S.saida);
      S.analisador = c.createAnalyser(); S.analisador.fftSize = 512; S.saida.connect(S.analisador); S.saida.connect(c.destination); S._rota = 'ctx';
      if (A.cfg.v.audio.saida) aplicarSaida(A.cfg.v.audio.saida);
    }
    return c;
  };
  // Saída escolhida no app (fone, caixa, headset...): 1º muda a saída do próprio Web Audio (setSinkId) e CONFERE se mudou; se o navegador
  // não mudar (ou não souber), o som passa por um elemento de áudio com a saída escolhida. Nunca fica no "padrão do sistema" calado.
  async function aplicarSaida(id) {
    const c = A.som.ctx; if (!c || !S.saida) return false;
    id = id || '';
    let ok = false;
    if (c.setSinkId) { try { await c.setSinkId(id); ok = (c.sinkId || '') === id || (typeof c.sinkId === 'object' && !id); } catch (e) { A.log.aviso('setSinkId do Web Audio', e); } }
    const usarElemento = !ok && id && window.HTMLMediaElement && HTMLMediaElement.prototype.setSinkId;
    if (usarElemento) {
      if (!S._elSaida || S._elSaida.ctx !== c) { S._destSaida = c.createMediaStreamDestination(); S._elSaida = new Audio(); S._elSaida.ctx = c; S._elSaida.srcObject = S._destSaida.stream; }
      try { await S._elSaida.setSinkId(id); if (S._rota !== 'el') { try { S.saida.disconnect(c.destination); } catch (e) { /* ok */ } S.saida.connect(S._destSaida); S._rota = 'el'; } S._elSaida.play().catch(() => {}); ok = true; } catch (e) { A.log.aviso('setSinkId do elemento', e); }
    } else if (S._rota === 'el') { try { S.saida.disconnect(S._destSaida); } catch (e) { /* ok */ } S.saida.connect(c.destination); S._rota = 'ctx'; if (S._elSaida) S._elSaida.pause(); }
    S.saidaAtual = ok ? id : '';
    return ok;
  }
  S._aplicarSaida = aplicarSaida;
  function ligarAudio(r) {
    if (r.gain || !r.stream.getAudioTracks().length) return;
    const c = ctxAudio(); if (!c) return;
    try {
      r.fonte = c.createMediaStreamSource(r.stream); r.gain = c.createGain();
      r.fonte.connect(r.gain); r.gain.connect(r.tela || r.somTela ? S.busTrans : S.busVoz);
      if (!r.tela && !r.somTela) { r.medidor = c.createAnalyser(); r.medidor.fftSize = 2048; r.fonte.connect(r.medidor); } // nível do microfone de cada pessoa (antes do volume que você escolheu)
      // o Chrome só entrega o áudio de uma stream remota ao Web Audio se um elemento de mídia também a consome
      r.chamariz = new Audio(); r.chamariz.srcObject = r.stream; r.chamariz.muted = true; r.chamariz.play().catch(() => {});
    } catch (e) { A.log.aviso('audio', e); }
    atualizarGanhos();
  }
  function desligarAudio(r) { try { r.fonte && r.fonte.disconnect(); r.gain && r.gain.disconnect(); r.medidor = null; r.chamariz && (r.chamariz.srcObject = null); } catch (e) { /* ok */ } r.gain = null; }
  function atualizarGanhos() {
    for (const r of S.remotas.values()) {
      if (!r.gain) continue;
      const foco = r.somTela && S.remotas.get(S.foco); // o som da tela separado segue a tela dessa pessoa: toca só com ela em foco
      const mudo = S.mudos.has(r.peerId) || (r.tela && S.foco !== r.id) || (r.somTela && !(foco && foco.tela && foco.peerId === r.peerId));
      r.gain.gain.value = mudo ? 0 : r.tela || r.somTela ? 1 : S.volumePessoa(r.peerId) / 100;
    }
  }
  S.definirVolume = (v) => { S.volume = A.limitar(v, 0, 1); if (S.saida) S.saida.gain.value = S.volume; };
  S.definirVolumeVoz = (v) => { A.cfg.v.audio.voz = A.limitar(v, 0, 200); ctxAudio(); if (S.busVoz) S.busVoz.gain.value = g100(A.cfg.v.audio.voz); A.cfg.salvar(); };
  S.definirVolumeTrans = (v) => { A.cfg.v.audio.trans = A.limitar(v, 0, 200); ctxAudio(); if (S.busTrans) S.busTrans.gain.value = g100(A.cfg.v.audio.trans); A.cfg.salvar(); };
  S.saidaSuportada = () => !!((window.AudioContext && AudioContext.prototype.setSinkId) || (window.HTMLMediaElement && HTMLMediaElement.prototype.setSinkId));
  S.definirSaida = async (id) => {
    A.cfg.v.audio.saida = id || ''; A.cfg.salvar();
    ctxAudio();
    const ok = await aplicarSaida(id || '');
    if (!ok && id) throw new Error(A.T('Não consegui usar essa saída de som.', 'Could not use that sound output.'));
  };
  // Volume do microfone de CADA pessoa, só para você (0 a 200%). Fica guardado pela conta dela (vale nas próximas salas também).
  const chavePessoa = (peerId) => { const p = S.participante(peerId); return p ? (p.tag ? 'tag:' + String(p.tag).toLowerCase() : 'nome:' + p.nome) : 'id:' + peerId; };
  S.volumePessoa = (peerId) => { const v = (A.cfg.v.audio.vozes || {})[chavePessoa(peerId)]; return v == null ? 100 : A.limitar(v, 0, 200); };
  S.definirVolumePessoa = (peerId, v) => { A.cfg.v.audio.vozes = A.cfg.v.audio.vozes || {}; A.cfg.v.audio.vozes[chavePessoa(peerId)] = A.limitar(Math.round(v), 0, 200); A.cfg.salvar(); atualizarGanhos(); };
  S.nivelPessoa = (peerId) => { // 0..1: o quanto o microfone da pessoa está "falando" agora
    let m = 0;
    for (const r of S.remotas.values()) {
      if (r.peerId !== peerId || r.tela || !r.medidor) continue;
      const d = new Uint8Array(r.medidor.fftSize); r.medidor.getByteTimeDomainData(d); let s2 = 0; for (const v of d) { const x = (v - 128) / 128; s2 += x * x; }
      m = Math.max(m, Math.sqrt(s2 / d.length));
    }
    return Math.min(1, m * 4);
  };
  S.mudar = (peerId, mudo) => { if (mudo) S.mudos.add(peerId); else S.mudos.delete(peerId); atualizarGanhos(); };
  S.focar = (streamId) => { S.foco = streamId; atualizarGanhos(); emit('foco', streamId); };
  S.reativarAudio = () => { ctxAudio(); S.remotas.forEach(ligarAudio); atualizarGanhos(); };
  // Som de fora da sala (chamadas do Aero Talk) no MESMO caminho: volume geral, vozes/transmissões e a saída escolhida valem igual.
  // Devolve { medidor, gain, parar }; o volume de cada pessoa fica guardado pelo código da conta dela.
  S.audioExterno = (stream, { tela = false, codigo = '' } = {}) => {
    const c = ctxAudio(); if (!c || !stream.getAudioTracks().length) return null;
    try {
      const fonte = c.createMediaStreamSource(stream), gain = c.createGain(), medidor = c.createAnalyser();
      medidor.fftSize = 512; fonte.connect(gain); fonte.connect(medidor); gain.connect(tela ? S.busTrans : S.busVoz);
      const chamariz = new Audio(); chamariz.srcObject = stream; chamariz.muted = true; chamariz.play().catch(() => {}); // o Chrome só solta o áudio remoto com um elemento consumindo
      const k = 'cod:' + codigo, vozes = A.cfg.v.audio.vozes || {};
      gain.gain.value = tela || !codigo || vozes[k] == null ? 1 : A.limitar(vozes[k], 0, 200) / 100;
      return {
        medidor, gain,
        volume: (v) => { if (v == null) return Math.round(gain.gain.value * 100); gain.gain.value = A.limitar(v, 0, 200) / 100; if (codigo && !tela) { A.cfg.v.audio.vozes = A.cfg.v.audio.vozes || {}; A.cfg.v.audio.vozes[k] = Math.round(v); A.cfg.salvar(); } },
        parar: () => { try { fonte.disconnect(); gain.disconnect(); } catch (e) { /* ok */ } chamariz.srcObject = null; },
      };
    } catch (e) { A.log.aviso('audio externo', e); return null; }
  };
  S.nivelAudio = () => { if (!S.analisador) return 0; const d = new Uint8Array(S.analisador.fftSize); S.analisador.getByteTimeDomainData(d); let s = 0; for (const v of d) { const x = (v - 128) / 128; s += x * x; } return Math.sqrt(s / d.length); };

  // ---------- estatísticas: ping, caminho, fps e taxa de cada conexão (a cada 1 s) ----------
  async function medirTudo() {
    let envio = null;
    if (S.local.kms && A.kms) A.kms.medir();
    for (const peer of todosPeers()) {
      if (peer.pc.connectionState !== 'connected') continue;
      try {
        const rel = await peer.pc.getStats();
        const e = { rtt: null, caminho: '', fps: 0, kbps: 0, impl: '', w: 0, h: 0, perda: 0, jitter: 0, congelou: 0 };
        let sel = null, env = null, fonteV = null, remoto = null; const envs = [], fontes = [];
        rel.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) sel = rel.get(r.selectedCandidatePairId); });
        if (!sel) rel.forEach((r) => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) sel = r; });
        if (sel) {
          if (sel.currentRoundTripTime != null) e.rtt = Math.round(sel.currentRoundTripTime * 1000);
          const l = rel.get(sel.localCandidateId), rm = rel.get(sel.remoteCandidateId);
          e.caminho = (l && l.candidateType === 'relay') || (rm && rm.candidateType === 'relay') ? 'rele' : 'direto';
        }
        rel.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            e.fps = r.framesPerSecond || 0; e.w = r.frameWidth || 0; e.h = r.frameHeight || 0;
            e.congelou = r.freezeCount || 0;
            e.jitter = r.jitterBufferEmittedCount ? Math.round((r.jitterBufferDelay / r.jitterBufferEmittedCount) * 1000) : 0;
            const perdidos = r.packetsLost || 0, total = perdidos + (r.packetsReceived || 0);
            e.perda = total ? Math.round((perdidos / total) * 1000) / 10 : 0;
            if (peer.ult && peer.ult.t && r.timestamp > peer.ult.t) e.kbps = ((r.bytesReceived - peer.ult.b) * 8) / (r.timestamp - peer.ult.t);
            // tela preta: chegam dados (mais de 300 KB) há mais de 6 s e nenhuma imagem foi decodificada: pede outro codec ao host (uma vez)
            // (0.6.0) não troca mais o formato sozinho: mostra para quem assiste o botão "Trocar formato" (a escolha é da pessoa)
            if (!peer.avisouSemImagem && (r.framesDecoded || 0) === 0 && (r.bytesReceived || 0) > 300000) {
              peer.semImagemDesde = peer.semImagemDesde || Date.now();
              if (Date.now() - peer.semImagemDesde > 6000) { peer.avisouSemImagem = true; emit('sem-imagem', { id: peer.id }); A.log.aviso('nenhuma imagem decodificada de', peer.id); }
            } else if ((r.framesDecoded || 0) > 0) { peer.semImagemDesde = 0; if (peer.avisouSemImagem === true) { peer.avisouSemImagem = 'voltou'; emit('imagem-voltou', { id: peer.id }); } }
            // IMAGEM "DERRETENDO": o H.264 (codificado pela placa de quem transmite) não se recupera bem de pacote perdido: cada perda borra
            // a tela até o próximo quadro inteiro (pior no decodificador da NVIDIA e em internet de longe). O VP8 (o mesmo das chamadas do Aero
            // Talk, que funcionam) detecta a perda e pede um quadro novo na hora. Perda de 0,5% ou mais por 3 medições seguidas no H.264: pede VP8.
            const cod = r.codecId && rel.get(r.codecId);
            peer.codecRecebido = cod ? cod.mimeType : '';
            // (0.6.1) perdeu pacote no H.264: pede ao host um quadro inteiro (no máximo a cada 3 s). Sem isso a imagem ficava derretida até
            // o próximo quadro inteiro, que o codificador da placa pode demorar muito para mandar
            const perd = r.packetsLost || 0;
            // (1.0.3) pelo próprio WebRTC (RTCP PLI) quando o receptor da tela existe: sem religar o envio de quem transmite (a cada 8 s no máximo: o quadro inteiro é grande)
            if (/h264/i.test(peer.codecRecebido) && peer.perdAnt != null && perd - peer.perdAnt >= 8) {
              const rx = A.receptor && peer.pc.getReceivers().find((x) => x.track && x.track.kind === 'video' && A.receptor.de(x));
              if (rx && Date.now() - (peer.pediuQuadro || 0) > 8000) { peer.pediuQuadro = Date.now(); A.receptor.pedirInteiro(rx); }
              else if (!rx && Date.now() - (peer.pediuQuadro || 0) > 15000) { peer.pediuQuadro = Date.now(); S.enviarDC(peer.id, { t: 'quadro' }); } // (0.6.8) só perda de verdade, no máximo a cada 15 s
            }
            peer.perdAnt = perd;
            // (0.7.6) o MEU PC não dá conta de decodificar (mais de 12 ms por quadro, ou mais de 8% dos quadros jogados fora) por 5 s acima de 720p:
            // avisa o host uma vez, e ele baixa a qualidade só para mim (a transmissão dele não muda)
            // (0.7.8) também a FILA crescendo (quadros esperando mais de 50 ms): é a "câmera lenta" de um PC que recebe mais do que mostra. A perda da
            // internet só desculpa os quadros jogados fora: decodificar devagar não tem a ver com ela. Reage em 3 s e repete a cada 8 s, para não
            // passar meio minuto em câmera lenta até chegar no tamanho que o PC aguenta
            // (0.7.9) na decodificação pela placa esse tempo é a fila interna dela (2 ou 3 quadros), não o trabalho: 43 ms a 60 fps sem perder nenhum
            // quadro. Ali só vale o que ficou para trás. No processador, o tempo de um quadro tem de caber no ritmo. E a fila de 50 ms é o normal
            // com a placa (o WebRTC soma esse tempo ao atraso): só acima de 120 ms é fila de verdade
            const dA = peer.decAnt, fd = r.framesDecoded || 0, fr = r.framesReceived || 0, td = r.totalDecodeTime || 0, fdr = r.framesDropped || 0, jd = r.jitterBufferDelay || 0, je = r.jitterBufferEmittedCount || 0;
            const ctlR = A.receptor && peer.pc.getReceivers().map((x) => x.track && x.track.kind === 'video' && A.receptor.de(x)).find((c) => c);
            if (ctlR && ctlR.proprio) { // o decodificador próprio: os números de verdade são os dele (o navegador só vê o quadrinho)
              const i = ctlR.medir(); e.fps = i.fps; e.w = i.w; e.h = i.h; e.decMs = i.ms; e.impl = 'decodificador próprio';
              // (0.8.4) uma vez só pode ser rajada da internet ou do PC de quem transmite: só avisa com fila de verdade em 2 medições seguidas
              peer.atrasN = ctlR.atras > (peer.atrasAnt || 0) ? (peer.atrasN || 0) + 1 : 0;
              if (peer.atrasN >= 2 && i.h > 360 && Date.now() - (peer.avisouDecod || 0) > 3000) { peer.atrasN = 0; peer.avisouDecod = Date.now(); A.log.aviso('meu PC não está dando conta de decodificar', i.h + 'p', i.ms + ' ms', 'decodificador próprio'); sinal(peer.id, { decod: 'lento', h: i.h, ms: i.ms, impl: 'proprio' }); }
              peer.atrasAnt = ctlR.atras;
            } else if (dA && fd > dA.f) {
              const ms = ((td - dA.t) / (fd - dA.f)) * 1000, desc = (fdr - dA.d) / Math.max(1, fd - dA.f + fdr - dA.d), fila = je > dA.je ? ((jd - dA.jd) / (je - dA.je)) * 1000 : 0;
              const impl = r.decoderImplementation || '', naPlaca = /External|D3D|Vaapi|VideoToolbox|MediaCodec/i.test(impl), quadroMs = 1000 / Math.max(10, r.framesPerSecond || 60);
              const recebidos = fr - (dA.r || 0), atras = recebidos > 0 && (recebidos - (fd - dA.f) - (fdr - dA.d)) / recebidos > 0.1;
              peer.decLento = e.h > 360 && ((!naPlaca && ms > quadroMs * 0.85) || atras || fila > 120 || (e.perda < 1 && desc > 0.08)) ? (peer.decLento || 0) + 1 : 0;
              e.decMs = Math.round(ms * 10) / 10;
              // (1.0.0) o navegador decodifica pelo PROCESSADOR, mas a placa deste aparelho decodifica H.264: passa já para ela (como um vídeo do
              // YouTube, quem assiste só gasta internet). Sem esperar ficar lento. Uma vez por conexão
              if (!naPlaca && impl && e.h > 0 && ctlR && !ctlR.proprio && !peer.testouPlaca && /h264/i.test(peer.codecRecebido) && A.receptor.temPlaca) {
                peer.testouPlaca = true;
                A.receptor.temPlaca().then((tem) => { if (tem && !ctlR.proprio && receptorProprio(peer, { placa: true })) A.log.info('decodificação passa para a placa deste aparelho (o navegador usava o processador:', impl + ')'); });
              }
              // (0.7.10) e no processador, com H.264, a fila passa para o decodificador próprio: ele não acumula atraso. O aviso segue para o tamanho descer
              if (peer.decLento >= 3 && !naPlaca && ctlR && /h264/i.test(peer.codecRecebido)) receptorProprio(peer, { placa: true });
              if (peer.decLento >= 3 && Date.now() - (peer.avisouDecod || 0) > 3000) { peer.avisouDecod = Date.now(); peer.decLento = 0; A.log.aviso('meu PC não está dando conta de decodificar', e.h + 'p', e.decMs + ' ms', impl); sinal(peer.id, { decod: 'lento', h: e.h, ms: e.decMs, impl }); }
            }
            peer.decAnt = { f: fd, r: fr, t: td, d: fdr, jd, je };
            // (0.7.9) conta para quem transmite o tamanho da minha tela (em pontos de verdade, deitada). Repete a cada 30 s: a janela pode ir para
            // outro monitor, e quem transmite perde o dado se reiniciar a tela
            // (1.0.0) e, melhor ainda, o tamanho em que a imagem aparece AQUI: numa janela pequena, no quadradinho ou com o app minimizado, mandar
            // 1080p só fazia este PC decodificar pixels que ninguém vê. Ficou maior (tela cheia): avisa na hora; menor: depois de 3 s igual
            { const dp = window.devicePixelRatio || 1, lM = Math.round(Math.max(screen.width, screen.height) * dp), aM = Math.round(Math.min(screen.width, screen.height) * dp);
              const vis = tamVisto(peer), agora = Date.now();
              let l = lM, a = aM;
              if (vis && vis.achou) {
                if (document.hidden || !(vis.a > 0)) { l = 640; a = 360; } // ninguém olhando: o mínimo, volta no próximo segundo quando aparecer
                else { const alvoA = ESCADA_ALT.slice().reverse().find((x) => x >= vis.a * dp) || aM; a = Math.min(aM, alvoA); l = Math.min(lM, Math.max(640, Math.round((a * vis.l) / vis.a))); }
              }
              const tl = l + 'x' + a, maior = !peer.telaAvisada || a > (peer.telaAvisadaA || 0);
              if (tl !== peer.telaCand) { peer.telaCand = tl; peer.telaCandEm = agora; }
              const firme = maior || agora - peer.telaCandEm >= 3000;
              if ((peer.telaAvisada !== tl && firme) || agora - (peer.telaAvisadaEm || 0) > 30000) { peer.telaAvisada = tl; peer.telaAvisadaA = a; peer.telaAvisadaEm = agora; sinal(peer.id, { tela: { l, a, c: A.plat.celular ? 1 : 0 } }); } }
            peer.ult = { b: r.bytesReceived, t: r.timestamp };
          }
          if (r.type === 'outbound-rtp' && r.kind === 'video') envs.push(r);
          if (r.type === 'media-source' && r.kind === 'video') fontes.push(r);
          if (r.type === 'remote-inbound-rtp' && r.kind === 'video') remoto = r;
        });
        // (0.7.6) depois de reiniciar a tela a conexão guarda também o envio da trilha antiga (parado): vale o da trilha que está indo agora
        { const atuais = new Set([...peer.senders.values()].map((x) => x.track && x.track.id).filter(Boolean));
          const daAtual = (r) => { const f = r.mediaSourceId && rel.get(r.mediaSourceId); return !!(f && atuais.has(f.trackIdentifier)); };
          env = envs.find(daAtual) || envs.filter((r) => r.active !== false).sort((a, b) => (b.framesEncoded || 0) - (a.framesEncoded || 0))[0] || null;
          fonteV = (env && env.mediaSourceId && rel.get(env.mediaSourceId)) || fontes.find((f) => atuais.has(f.trackIdentifier)) || fontes[0] || null; }
        // (0.7.2) captura lenta (a placa no limite com o jogo): registra no relatório, para dar para saber depois de onde veio o travamento
        if (fonteV && fonteV.framesPerSecond != null && S.local.preset) {
          // (0.7.4) compara com o fps que está sendo pedido agora (com "30 fps nítidos" a captura entrega 30 de propósito: não é lentidão)
          const alvoFps = Math.max(1, ...todosPeers().map((p) => alvoDe(p).fps)) || S.local.preset.fps || 60, lenta = fonteV.framesPerSecond < alvoFps * 0.55;
          S.local.capLenta = lenta ? (S.local.capLenta || 0) + 1 : 0;
          // (0.8.4) o fps que a captura entrega de verdade (o maior dos últimos 10 s): o jogo a 40 fps não gera 120 quadros, então cada quadro leva os bits
          // dos que não existem
          const hist = S.local.capFpsHist || (S.local.capFpsHist = []); if (Date.now() - (S.local.capFpsEm || 0) > 900) { S.local.capFpsEm = Date.now(); hist.push(fonteV.framesPerSecond || 0); if (hist.length > 10) hist.shift(); }
          if (S.local.capLenta === 5) A.log.aviso('captura lenta: ' + Math.round(fonteV.framesPerSecond) + ' de ' + alvoFps + ' fps (' + fonteV.width + 'x' + fonteV.height + ') - a placa de vídeo pode estar no limite com o jogo');
        }
        if (!S.local.kms && fonteV && fonteV.height > 0 && (fonteV.height !== S.local.capAlt || fonteV.width !== S.local.capLarg)) {
          S.local.capAlt = fonteV.height; S.local.capLarg = fonteV.width; S.aplicarQualidadeTodos(); // o tamanho real da captura chegou (ou mudou): refaz a taxa
        }
        if (env) {
          // fps de verdade que saiu daqui: o do navegador, ou calculado pela contagem de quadros codificados
          let fpsEnv = env.framesPerSecond || 0;
          const qEnv = env.framesEncoded;
          if (peer.ultEnv && env.timestamp > peer.ultEnv.t) { const calc = ((qEnv - peer.ultEnv.q) * 1000) / (env.timestamp - peer.ultEnv.t); if (!fpsEnv || Math.abs(calc - fpsEnv) > 8) fpsEnv = calc; e.kbps = ((env.bytesSent - peer.ultEnv.b) * 8) / (env.timestamp - peer.ultEnv.t); }
          peer.ultEnv = { q: qEnv, t: env.timestamp, b: env.bytesSent };
          const hw = env.powerEfficientEncoder === true || /MediaFoundation|VideoToolbox|VAAPI|Vaapi|NVENC|AMF|D3D12|ExternalEncoder|VideoEncodeAccelerator/i.test(env.encoderImplementation || '');
          const s = { banda: sel && sel.availableOutgoingBitrate ? Math.round(sel.availableOutgoingBitrate / 1000) : 0, fps: Math.round(fpsEnv * 10) / 10, motivo: env.qualityLimitationReason || 'none', impl: env.encoderImplementation || '', hw, w: env.frameWidth || 0, h: env.frameHeight || 0, captura: fonteV ? Math.round((fonteV.framesPerSecond || 0) * 10) / 10 : 0, kbps: e.kbps, perda: remoto && remoto.fractionLost != null ? Math.round(remoto.fractionLost * 1000) / 10 : 0, escala: peer.est.escala };
          decodSubir(peer);
          // (0.7.6) o tamanho que a internet dessa pessoa aguenta sem pixelar (no mesmo fps), em qualquer modo. A estimativa do WebRTC começa baixa e
          // sobe nos primeiros segundos: só conta depois de 10 s. Desce depois de 6 s abaixo; sobe depois de 12 s com folga; no máximo 1 troca a cada 10 s
          { const ik = S.local.kms && (A.kms.info() || {}), base = ik || { alt: S.local.capAlt || 0, larg: S.local.capLarg || 0 };
            if (base.alt && Date.now() - peer.criadoEm > 10000 && s.banda > 0) {
              // (0.8.4) o tamanho que cabe é calculado com o fps que SAI de verdade (no máximo o escolhido, no mínimo 30): com o jogo rodando a 38 fps e a
              // conta feita para 120, cada quadro ganhava um terço dos bits que podia e a imagem caía para 360p com a internet sobrando
              const fpsEsc = (S.local.preset && S.local.preset.fps) || base.fps || 60, hist = !ik && S.local.capFpsHist, fpsReal = hist && hist.length >= 5 ? Math.max(...hist) : 0;
              const fpsP = fpsReal > 0 ? Math.min(fpsEsc, Math.max(30, fpsReal)) : fpsEsc, atual = peer.altBanda || base.alt;
              // (1.0.0) o fps dessa pessoa: o maior (escolhido, 60, 30) em que a imagem cabe em pelo menos 720p na internet dela
              const fpsDe = (kb) => { const nit = Math.min(720, base.alt); for (const f of [fpsP, 60, 30]) if (f <= fpsP && altParaBanda(base.larg, base.alt, f, kb) >= nit) return f; return Math.min(30, fpsP); };
              const fpsAtual = peer.bandaFps || fpsP, fpsCabe = fpsDe(s.banda), cabe = altParaBanda(base.larg, base.alt, fpsCabe, s.banda);
              const fpsCabeF = fpsDe(s.banda / 1.15), cabeF = altParaBanda(base.larg, base.alt, fpsCabeF, s.banda / 1.15);
              peer.bandaMenor = cabe < atual || fpsCabe < fpsAtual ? (peer.bandaMenor || 0) + 1 : 0;
              peer.bandaMaior = (cabe > atual || fpsCabe > fpsAtual) && (cabeF > atual || fpsCabeF > fpsAtual) && cabeF >= Math.min(atual, cabe) && fpsCabeF >= Math.min(fpsAtual, fpsCabe) ? (peer.bandaMaior || 0) + 1 : 0;
              // o teto de taxa acompanha a internet dela (refaz no máximo a cada 5 s, e só com mudança de 25% ou mais)
              if (!(peer.bandaTeto > 0) || (Math.abs(s.banda - peer.bandaTeto) / peer.bandaTeto > 0.25 && Date.now() - (peer.bandaTetoEm || 0) > 5000)) { peer.bandaTeto = s.banda; peer.bandaTetoEm = Date.now(); aplicarQualidade(peer); }
              // (0.8.4) cada troca de tamanho refaz o codificador (um quadro inteiro, um engasgo). Subiu e caiu de novo em menos de 30 s: a próxima
              // subida espera o dobro (até 2 min), e volta ao normal depois de 3 min sem trocar. Antes ia de 432p a 804p e voltava a cada 15 s
              if (Date.now() - (peer.trocouAlt || 0) > 180000) peer.bandaEspera = 12;
              if (Date.now() - (peer.trocouAlt || 0) > 10000 && (peer.bandaMenor >= 6 || peer.bandaMaior >= (peer.bandaEspera || 12))) {
                const desce = peer.bandaMenor >= 6;
                if (desce && peer.subiuBandaEm && Date.now() - peer.subiuBandaEm < 30000) peer.bandaEspera = Math.min(120, (peer.bandaEspera || 12) * 2);
                if (!desce) peer.subiuBandaEm = Date.now();
                const fpsNovo = desce ? fpsCabe : fpsCabe > fpsAtual ? fpsCabe : fpsAtual;
                const nova = fpsNovo !== fpsAtual ? cabe : desce ? cabe : ESCADA_ALT.filter((a) => a > atual && a <= cabe).pop() || cabe;
                peer.altBanda = nova >= base.alt ? 0 : nova; peer.bandaFps = fpsNovo >= fpsP ? 0 : fpsNovo; peer.trocouAlt = Date.now(); peer.bandaMenor = peer.bandaMaior = 0;
                A.log.info('internet até', peer.id, s.banda + ' kbps -> ' + alvoDe(peer).alt + 'p ' + alvoDe(peer).fps + ' fps (só para essa pessoa)');
                aplicarQualidade(peer);
              }
            } }
          if (S.local.kms) { // captura direta: os números são os da placa, não os do quadrinho
            const inf = A.kms.info() || {}, sdK = [...peer.senders.values()].find((x) => A.kms.ehTrilha(x.track)), ck = (sdK && A.kms.canalDe(sdK)) || {};
            Object.assign(s, { impl: 'KMS + VA-API (captura direta)', hw: true, w: ck.larg || inf.larg || 0, h: ck.alt || inf.alt || 0, captura: inf.fps || 0, canal: ck.id, alvoKbps: Math.max(env.targetBitrate ? Math.round(env.targetBitrate / 1000) : 0, Math.round(s.banda * 0.85)) }); // o alvo do WebRTC segue o que já se manda; a banda estimada diz até onde dá para subir
            if (s.alvoKbps && sdK) A.kms.taxaAlvo(s.alvoKbps, alvoDe(peer).mbps * 1000, sdK); // (0.7.6) a taxa do canal DESSA pessoa
            // (0.7.6) o Chromium às vezes começa o quadrinho na metade do ritmo (31 de 60 fps, comum depois de reiniciar a tela ou de a
            // conexão voltar) e só sai disso quando o codificador é reconfigurado: 3 s abaixo de 75% do canal, reconfigura (no máximo a cada 5 s)
            const fpsCanal = Math.min(ck.fps || inf.fps || 0, ck.fpsMed || 999);
            peer.kmsLento = fpsCanal && s.fps < fpsCanal * 0.75 ? (peer.kmsLento || 0) + 1 : 0;
            if (peer.kmsLento >= 3 && Date.now() - (peer.kmsCutucou || 0) > 5000) {
              peer.kmsCutucou = Date.now(); peer.kmsLento = 0; A.log.info('captura direta: ' + s.fps + ' de ' + fpsCanal + ' fps saindo para', peer.id, '(' + s.motivo + ', entrada ' + Math.round((fonteV && fonteV.framesPerSecond) || 0) + ' fps) - reconfigurando o codificador');
              for (const sd of peer.senders.values()) if (A.kms.ehTrilha(sd.track)) { try { const par = sd.getParameters(); const e0 = par.encodings && par.encodings[0]; if (e0) { e0.maxFramerate = e0.maxFramerate === 121 ? 120 : 121; sd.setParameters(par).catch(() => {}); } } catch (er) { /* ok */ } }
            }
          }
          e.env = s; e.impl = s.impl;
          frearAtraso(peer, e.rtt);
          estabilizar(peer, s);
          if (!envio || s.fps > envio.fps) envio = { ...s, peers: 0 };
        }
        S.estat[peer.id] = e;
      } catch (err) { /* conexão fechando */ }
    }
    // Linux: a placa deveria estar codificando; se o Chromium caiu no codificador do processador (driver sem H.264, VA-API recusado), avisa UMA vez e diz o que fazer
    const rg = A.gpu && A.gpu.resultado;
    if (envio && envio.impl && !envio.hw && rg && rg.linux && rg.hw && !S._avisouCpu && ![...S.peers.values()].some((p) => p.eraHw)) { // a placa já codificou: é a queda passageira tratada acima
      S._avisouCpu = true; A.log.aviso('placa nao codificou', envio.impl);
      emit('aviso', { msg: A.T('Atenção: quem está codificando é o PROCESSADOR (' + envio.impl + '), não a placa. Veja Configurações > Placa de vídeo > "Verificar a codificação por hardware" e me mande o relatório de diagnóstico.', 'Heads up: the CPU (' + envio.impl + ') is encoding, not the GPU. See Settings > Graphics card > "Check hardware encoding" and send me the diagnostics report.') });
    }
    if (envio) { envio.alvo = S.local.preset ? S.local.preset.fps : 0; envio.peers = todosPeers().filter((p) => p.ultEnv).length; S.envio = envio; } else if (!S.local.tela) S.envio = null;
    emit('estat', S.estat);
  }

  // ---------- chat, moderação ----------
  // texto + (opcional) imagem já enviada e resposta a outra mensagem
  S.avisarDigitando = () => enviar({ tipo: 'digitando' });
  S.chatEnviar = (texto, { img = '', resp = '' } = {}) => { texto = String(texto || '').trim(); if (texto || img) { enviar({ tipo: 'chat', texto, img: img || undefined, resp: resp || undefined }); A.som.tocar('chat-envio'); } };
  S.chatEditar = (id, texto) => enviar({ tipo: 'chat-editar', id, texto: String(texto || '') });
  S.chatApagar = (id) => enviar({ tipo: 'chat-apagar', id });
  S.chatReagir = (id, e) => enviar({ tipo: 'chat-reagir', id, e });
  S.chatImgUrl = (img) => `${API.servidor}/api/sala/${encodeURIComponent(S.sala)}/img/${img}`;
  // a imagem vai para o servidor da sala (só quem está dentro pode mandar) e volta um id para a mensagem
  S.chatImagem = async (blob) => {
    if (!S.retomada) throw new Error(A.T('Ainda conectando à sala.', 'Still connecting to the room.'));
    const r = await fetch(`${API.servidor}/api/sala/${encodeURIComponent(S.sala)}/img?id=${encodeURIComponent(S.retomada.id)}&seg=${encodeURIComponent(S.retomada.seg)}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.img) throw new Error(d.erro === 'grande' ? A.T('Arquivo grande demais (máximo 1,9 MB na sala).', 'File too large (max 1.9 MB in the room).') : A.T('Não consegui enviar o arquivo.', 'Could not send the file.'));
    return d.img;
  };
  S.chatVisto = (aberto) => { S.chatAberto = !!aberto; if (aberto) S.naoLidas = 0; };
  S.aprovar = (id) => enviar({ tipo: 'aprovar', id });
  S.recusar = (id) => enviar({ tipo: 'recusar', id });
  S.moderar = (id, acao) => enviar({ tipo: 'moderar', id, acao });

  // ---------- encerrar ----------
  // (0.6.9) o app está fechando: tudo síncrono (não dá tempo de esperar nada). Para a captura e sai de propósito (o servidor não guarda o lugar)
  S.saidaRapida = () => {
    if (!S.ativa) return;
    try { if (S.local && S.local.tela) S.local.tela.getTracks().forEach((t) => t.stop()); } catch (e) { /* ok */ }
    for (const peer of (S.peers || new Map()).values()) { try { peer.pc.close(); } catch (e) { /* ok */ } }
    const w = S.ws; if (w) { w.onclose = null; try { if (w.readyState === 1) w.send(JSON.stringify({ tipo: 'sair' })); w.close(1000, 'sair'); } catch (e) { /* ok */ } }
  };
  S.fechar = async () => {
    if (!S.ativa && !S.ws) return;
    S.encerrando = true;
    clearInterval(S._pingT); clearInterval(S._statsT); clearTimeout(S._reconT);
    const tinhaTela = !!S.local.tela, protegida = S.local.protegida;
    if (tinhaTela && desktop() && window.aero.gpu && window.aero.gpu.transmitindo) window.aero.gpu.transmitindo(false).catch(() => {});
    for (const s of [S.local.tela, S.local.mic]) s && s.getTracks().forEach((t) => t.stop());
    if (S.local.mic) A.mic.parar();
    if (tinhaTela && A.captura) A.captura.pararAudio();
    if (protegida && desktop() && window.aero.protegerJanela) window.aero.protegerJanela(false).catch(() => {});
    fecharPeers();
    S.remotas.forEach(desligarAudio);
    const w = S.ws; S.ws = null;
    if (w) { w.onclose = null; try { if (w.readyState === 1) w.send(JSON.stringify({ tipo: 'sair' })); w.close(1000, 'sair'); } catch (e) { /* ok */ } } // "sair": o servidor não guarda o lugar
    S.retomada = null; S.autoAprovar = null;
    if (S._abertura) { const a = S._abertura; S._abertura = null; a.reject(Object.assign(new Error('fechada'), { codigo: 'fechada' })); }
    H.anunciarSala(null, false);
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* ok */ }
    const eraAtiva = S.ativa;
    const guardar = { saida: S.saida, busVoz: S.busVoz, busTrans: S.busTrans, analisador: S.analisador, volume: S.volume };
    zerar(); Object.assign(S, guardar);
    if (eraAtiva) emit('fechada');
  };
})();
