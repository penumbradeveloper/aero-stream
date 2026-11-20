// Aero Stream - (1.0.2) Celular como microfone: a integração oficial "celmic". O PC liga um servidor só na rede local (desktop/celmic.js),
// mostra um QR code e um código curto; o celular (no mesmo Wi-Fi) abre a página, o PC confirma ("Permitir o celular X?") e o áudio do
// microfone dele chega por WebRTC, só pela rede local. Ele vira uma fonte de microfone da chamada (no seletor do microfone, junto dos outros),
// passando pelo mesmo tratamento do microfone do PC (mic.js). O servidor desliga quando a integração é desligada ou a chamada termina.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  const { h, T } = A, U = A.ui;
  const nat = window.aero && window.aero.celMic;
  const C = (A.celmic = {});
  let info = { ligado: false }, pc = null, stream = null, sink = null, nome = '', janela = null, pedidoJan = null, quedaT = 0;

  C.disponivel = !!nat; // só no app do PC (o navegador não abre servidor)
  C.ligada = () => !!nat && !!(A.integ && A.integ.ligada('celmic'));
  C.emChamada = () => !!(A.chamada && A.chamada.ativa);
  C.conectado = () => !!(stream && stream.getAudioTracks().some((t) => t.readyState === 'live') && pc && pc.connectionState === 'connected');
  C.rotulo = () => (C.conectado() ? T('Celular: ', 'Phone: ') + nome + ' (Wi-Fi)' : T('Celular pelo Wi-Fi (conectar...)', 'Phone over Wi-Fi (connect...)'));
  const avisar = () => { A.evt.emit('celmic:estado', { conectado: C.conectado(), usando: A.mic.usandoExterna() }); pintar(); };
  C.usar = async (on) => { if (on && !C.conectado()) return; await A.mic.usarExterna(on ? stream : null); avisar(); };

  // a mesma trava do PC: só uma oferta com UMA trilha de áudio (sem vídeo, sem canal de dados)
  const soAudio = (sdp) => {
    if (typeof sdp !== 'string' || sdp.length < 20 || sdp.length > 16000 || !sdp.startsWith('v=0')) return false;
    const l = sdp.split(/\r?\n/), ms = l.filter((x) => x.startsWith('m='));
    return ms.length === 1 && /^m=audio \d+ (UDP\/TLS\/RTP\/SAVPF|RTP\/SAVPF) [\d ]+$/.test(ms[0]) && !l.some((x) => /^a=(sctp-port|sctpmap|max-message-size)/.test(x));
  };

  function fecharPc() {
    clearTimeout(quedaT);
    if (pc) { try { pc.close(); } catch (e) { /* ok */ } pc = null; }
    if (sink) { try { sink.pause(); sink.srcObject = null; } catch (e) { /* ok */ } sink = null; }
    if (stream) { stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ok */ } }); stream = null; }
  }
  // o celular saiu (ou o PC tirou): o microfone do PC volta ANTES de fechar a conexão (a chamada não fica muda nem um instante)
  async function desconectar(encerrarNoPc) {
    clearTimeout(quedaT);
    if (stream && A.mic.externa === stream) { try { await A.mic.usarExterna(null); } catch (e) { /* ok */ } }
    const tinha = !!pc;
    fecharPc();
    if (encerrarNoPc && nat) { try { info = await nat.encerrar(); } catch (e) { /* ok */ } }
    if (tinha) A.log.info('celular-microfone: desconectado');
    avisar();
  }

  async function responder(id, sdp) {
    if (!soAudio(sdp)) { A.log.aviso('celular-microfone: oferta recusada (não é só áudio)'); nat.responder(id, null); return; }
    await desconectar(false);
    try {
      const p = (pc = new RTCPeerConnection({ iceServers: [] })); // só a rede local: sem STUN/TURN de fora
      p.ondatachannel = (e) => { try { e.channel.close(); } catch (_) { /* ok */ } A.log.aviso('celular-microfone: canal de dados recusado'); desconectar(true); };
      p.ontrack = (e) => {
        if (p !== pc) return;
        if (e.track.kind !== 'audio') { try { e.track.stop(); } catch (_) { /* ok */ } return; }
        stream = new MediaStream([e.track]);
        // o Chromium só solta o áudio de uma trilha WebRTC para o Web Audio se ela também estiver tocando num elemento (mudo, sem som aqui)
        sink = new Audio(); sink.muted = true; sink.srcObject = stream; sink.play().catch(() => {});
      };
      p.onconnectionstatechange = () => {
        if (p !== pc) return;
        const s = p.connectionState;
        if (s === 'connected') { clearTimeout(quedaT); A.log.info('celular-microfone: conectado'); A.som.tocar('abrir'); C.usar(true).catch(() => {}); }
        else if (s === 'disconnected') { clearTimeout(quedaT); quedaT = setTimeout(() => { if (pc === p && p.connectionState !== 'connected') desconectar(true); }, 6000); }
        else if (s === 'failed' || s === 'closed') desconectar(true);
        avisar();
      };
      await p.setRemoteDescription({ type: 'offer', sdp });
      for (const t of p.getTransceivers()) t.direction = 'recvonly'; // daqui não sai nada para o celular
      await p.setLocalDescription(await p.createAnswer());
      await new Promise((ok) => { if (p.iceGatheringState === 'complete') return ok(); const t = setTimeout(ok, 3000); p.addEventListener('icegatheringstatechange', () => { if (p.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); });
      if (p !== pc) { nat.responder(id, null); return; }
      nat.responder(id, p.localDescription.sdp);
    } catch (e) { A.log.aviso('celular-microfone: não deu para responder', e && e.name); nat.responder(id, null); desconectar(true); }
  }

  // "Permitir o celular X?": nada passa sem o PC confirmar
  function pedido(ev) {
    if (pedidoJan) pedidoJan.fechar(false);
    const nomeCel = String(ev.nome || T('Celular', 'Phone')).slice(0, 32);
    let decidido = false;
    const decidir = (sim) => { if (decidido) return; decidido = true; nat.decidir(ev.id, sim); };
    const corpo = h('div', { class: 'col celmic-pedido' },
      h('div', { class: 'linha' }, h('span', { class: 'celmic-orbe' }, A.icone('celular', 26)),
        h('p', { class: 'cresce' }, T('Permitir o celular ', 'Allow the phone '), h('b', {}, '“' + nomeCel + '”'), T(' como microfone desta chamada?', ' as the microphone for this call?'))),
      h('p', { class: 'peq suave' }, T('Só permita se foi você que conectou agora. Ele só manda o áudio do microfone, mais nada.', 'Only allow it if you just connected it. It only sends microphone audio, nothing else.')));
    pedidoJan = U.modal(T('Celular como microfone', 'Phone as microphone'), corpo, { largura: 420, prioridade: true, classe: 'celmic-modal',
      acoes: [{ texto: T('Recusar', 'Deny'), tipo: 'sec', valor: false }, { texto: T('Permitir', 'Allow'), tipo: 'ok', icone: 'check', valor: true }],
      aoFechar: (v) => { pedidoJan = null; decidir(v === true); } });
    if (window.aero && window.aero.mostrar) window.aero.mostrar().catch(() => {});
  }

  // ---------- a janela de conectar (QR code + código) ----------
  let corpoJan = null, contaT = 0;
  function pintar() {
    if (!corpoJan) return;
    const conectado = C.conectado(), sess = info && info.sessao;
    corpoJan.replaceChildren();
    if (!info || !info.ligado) {
      corpoJan.append(h('p', { class: 'suave' }, info && info.erro === 'sem-rede' ? T('Este PC não está numa rede Wi-Fi/local. Conecte o PC e o celular na mesma rede e tente de novo.', 'This PC is not on a local/Wi-Fi network. Put the PC and the phone on the same network and try again.') : T('Ligando...', 'Starting...')),
        info && info.erro ? U.btn(T('Tentar de novo', 'Try again'), { icone: 'atualizar', tipo: 'sec', onclick: ligar }) : null);
      return;
    }
    if (conectado || (sess && pc)) {
      corpoJan.append(h('div', { class: 'celmic-ok' }, h('span', { class: 'celmic-orbe' }, A.icone('celular', 30)),
        h('div', { class: 'cresce' }, h('b', {}, conectado ? T('Conectado: ', 'Connected: ') + nome : T('Conectando ', 'Connecting ') + nome + '...'),
          h('div', { class: 'peq suave' }, A.mic.usandoExterna() ? T('A sua voz está saindo pelo celular.', 'Your voice is coming from the phone.') : T('Conectado, mas a chamada está usando o microfone do PC.', 'Connected, but the call is using the PC microphone.')))),
      h('div', { class: 'linha celmic-acoes' },
        conectado ? (A.mic.usandoExterna() ? U.btn(T('Usar o microfone do PC', 'Use the PC microphone'), { icone: 'mic', tipo: 'sec', peq: true, onclick: () => C.usar(false) })
          : U.btn(T('Usar o celular', 'Use the phone'), { icone: 'celular', peq: true, onclick: () => C.usar(true) })) : null,
        U.btn(T('Desconectar', 'Disconnect'), { icone: 'sair', tipo: 'perigo', peq: true, onclick: () => desconectar(true) })));
      return;
    }
    const url = info.url + (info.codigo ? '#' + info.codigo : '');
    const resta = Math.max(0, Math.round((info.expira - Date.now()) / 1000));
    const vivo = !!info.codigo && resta > 0;
    const qr = vivo ? A.qr(url, 200) : h('div', { class: 'qr celmic-qr-vazio' }, A.icone('celular', 40));
    corpoJan.append(
      h('div', { class: 'celmic-par' },
        h('div', { class: 'celmic-qr' }, qr),
        h('div', { class: 'celmic-passos' },
          h('ol', {},
            h('li', {}, T('Conecte o celular no mesmo Wi-Fi deste PC.', 'Connect the phone to the same Wi-Fi as this PC.')),
            h('li', {}, T('Leia o QR code com a câmera (ou abra o endereço abaixo).', 'Scan the QR code with the camera (or open the address below).')),
            h('li', {}, T('Se o navegador avisar que a conexão não é particular, toque em "Avançado" e continue: o certificado é deste PC.', 'If the browser warns the connection is not private, tap "Advanced" and continue: the certificate belongs to this PC.')),
            h('li', {}, T('Permita aqui quando ele pedir.', 'Allow it here when it asks.'))),
          // a página não abre no celular? quase sempre é o firewall do PC barrando a rede local
          h('p', { class: 'peq suave celmic-nota' }, info.so === 'win32'
            ? T('Não abriu? Permita o Aero no Firewall do Windows (em "Redes privadas") e deixe a rede do PC como Privada.', 'Not loading? Allow Aero in Windows Firewall ("Private networks") and set the PC network to Private.')
            : T('Não abriu? Se o PC tiver firewall (ufw, firewalld), libere o Aero na rede local.', 'Not loading? If the PC has a firewall (ufw, firewalld), allow Aero on the local network.')))),
      h('div', { class: 'celmic-cod' },
        h('div', {}, h('div', { class: 'peq suave' }, T('Endereço', 'Address')), h('code', { class: 'celmic-url' }, info.url)),
        h('div', {}, h('div', { class: 'peq suave' }, T('Código', 'Code')), h('b', { class: 'celmic-codigo' + (vivo ? '' : ' vencido') }, vivo ? info.codigo : '——————'))),
      h('div', { class: 'linha celmic-acoes' },
        h('span', { class: 'peq suave cresce celmic-conta' }, vivo ? T('Vale por ', 'Valid for ') + Math.floor(resta / 60) + ':' + String(resta % 60).padStart(2, '0') + T(' · uso único', ' · single use') : T('O código venceu ou já foi usado.', 'The code expired or was already used.')),
        U.btn(T('Código novo', 'New code'), { icone: 'atualizar', tipo: vivo ? 'sec' : '', peq: true, onclick: async () => { info = await nat.novoCodigo(); pintar(); } })),
      h('p', { class: 'peq suave celmic-nota' }, T('Fica só na sua rede: nada vai para a internet e o servidor desliga sozinho quando a chamada termina. ', 'It stays on your network: nothing goes to the internet and the server turns off when the call ends. ') + T('Digital do certificado: ', 'Certificate fingerprint: ') + info.digital));
  }
  async function ligar() {
    info = { ligado: false }; pintar();
    try { info = await nat.ligar(); } catch (e) { info = { ligado: false, erro: 'falhou' }; }
    pintar();
  }
  C.abrir = async () => {
    if (!C.ligada()) return;
    if (!C.emChamada()) { U.toast(T('Entre numa chamada para conectar o celular.', 'Join a call to connect the phone.'), { ms: 3200 }); return; }
    if (janela) return;
    corpoJan = h('div', { class: 'col celmic' });
    janela = U.modal(T('Celular como microfone', 'Phone as microphone'), corpoJan, { largura: 560, prioridade: true, classe: 'celmic-modal',
      aoFechar: () => { janela = null; corpoJan = null; clearInterval(contaT); } });
    contaT = setInterval(async () => {
      if (!corpoJan) return;
      if (info.ligado && !C.conectado()) { try { info = await nat.info(); } catch (e) { /* ok */ } }
      pintar();
    }, 1000);
    if (info.ligado) { try { info = await nat.info(); } catch (e) { /* ok */ } pintar(); if (!info.codigo && !info.sessao) { info = await nat.novoCodigo(); pintar(); } } else await ligar();
  };
  C.desligar = async () => {
    if (pedidoJan) pedidoJan.fechar(false);
    await desconectar(false);
    if (janela) janela.fechar();
    if (nat && info.ligado) { try { info = await nat.desligar(); } catch (e) { info = { ligado: false }; } }
    avisar();
  };

  if (nat) {
    nat.aoEvento((ev) => {
      if (!ev || typeof ev !== 'object') return;
      if (ev.tipo === 'pedido' && typeof ev.id === 'string') { if (C.ligada() && C.emChamada()) pedido(ev); else nat.decidir(ev.id, false); }
      else if (ev.tipo === 'oferta' && typeof ev.id === 'string') responder(ev.id, ev.sdp);
      else if (ev.tipo === 'sessao') { if (ev.ativa) { nome = String(ev.nome || '').slice(0, 32); } else desconectar(false); nat.info().then((x) => { info = x; pintar(); }).catch(() => {}); }
      else if (ev.tipo === 'codigo') nat.info().then((x) => { info = x; pintar(); }).catch(() => {});
      else if (ev.tipo === 'desligou') { info = { ligado: false }; desconectar(false); }
    });
    // a chamada acabou ou a integração foi desligada: o servidor local desliga junto
    A.evt.on('chamada:fim', () => { C.desligar(); });
    A.evt.on('integ:mudou', () => { if (!C.ligada()) C.desligar(); });
    addEventListener('beforeunload', () => { try { nat.desligar(); } catch (e) { /* ok */ } });
  }
})();
