// Aero - página do celular (celular como microfone). Pega o microfone, pede para parear com o código do PC e manda SÓ o áudio
// por WebRTC dentro da rede local. Nada de fora, nenhum outro dado.
(() => {
  'use strict';
  const pt = /^pt/i.test(navigator.language || 'pt');
  const T = (a, b) => (pt ? a : b);
  const $ = (id) => document.getElementById(id);
  const el = { cod: $('codigo'), nome: $('nome'), conectar: $('conectar'), estado: $('estado'), passoCodigo: $('passoCodigo'), passoAo: $('passoAo'), nivel: $('nivel'), mudo: $('mudo'), sair: $('sair'), titulo: $('titulo'), sub: $('sub') };
  if (!pt) {
    document.documentElement.lang = 'en';
    el.titulo.textContent = 'Phone as microphone'; el.sub.textContent = 'Use this phone as the microphone in your Aero call.';
    document.querySelector('label[for=codigo]').textContent = 'Code shown on the PC';
    document.querySelector('label[for=nome]').innerHTML = 'Name of this phone <span class="suave">(optional)</span>';
    el.nome.placeholder = 'My phone'; el.conectar.textContent = 'Connect'; el.mudo.textContent = 'Mute'; el.sair.textContent = 'Disconnect';
    el.passoAo.querySelector('.peq').textContent = 'Keep this page open and the screen on while in the call.';
    document.querySelector('.rodape').textContent = 'Only your microphone audio goes to the PC, over your Wi-Fi. Nothing goes to the internet.';
  }
  const estado = (t, tipo) => { el.estado.textContent = t; el.estado.className = 'estado' + (tipo ? ' ' + tipo : ''); };

  // o código vem no QR (depois do #, que nunca vai para o servidor) e some da barra de endereço
  const doQr = (location.hash || '').replace(/^#/, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
  if (doQr) { el.cod.value = doQr; try { history.replaceState(null, '', location.pathname); } catch (e) { /* ok */ } }
  try { el.nome.value = localStorage.getItem('aero-cel-nome') || ''; } catch (e) { /* ok */ }

  let token = '', pc = null, stream = null, trava = null, raf = 0, mudo = false;

  const post = async (rota, dados) => {
    const r = await fetch(rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados), cache: 'no-store', credentials: 'omit' });
    let j = {}; try { j = await r.json(); } catch (e) { /* ok */ }
    return { ok: r.ok, status: r.status, j };
  };
  const MSG = {
    errado: T('Código errado. Confira no PC.', 'Wrong code. Check it on the PC.'),
    bloqueado: T('Muitas tentativas. Gere um código novo no PC.', 'Too many tries. Create a new code on the PC.'),
    expirado: T('O código venceu. Gere um novo no PC.', 'The code expired. Create a new one on the PC.'),
    'sem-codigo': T('Gere um código no PC primeiro.', 'Create a code on the PC first.'),
    recusado: T('O PC não permitiu.', 'The PC did not allow it.'),
    ocupado: T('Já tem um celular conectado.', 'Another phone is already connected.'),
  };

  function medir() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const laco = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const db = 10 * Math.log10(s / buf.length + 1e-12); el.nivel.style.transform = 'scaleX(' + (mudo ? 0 : Math.max(0, Math.min(1, (db + 60) / 50))).toFixed(3) + ')'; raf = requestAnimationFrame(laco); };
      laco();
      medir.ctx = ctx;
    } catch (e) { /* sem medidor */ }
  }
  async function manterTela() { try { if (navigator.wakeLock && !trava) { trava = await navigator.wakeLock.request('screen'); trava.addEventListener('release', () => { trava = null; }); } } catch (e) { /* ok */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && pc) manterTela(); });

  function encerrar(msg, tipo) {
    cancelAnimationFrame(raf);
    if (pc) { try { pc.close(); } catch (e) { /* ok */ } pc = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (medir.ctx) { try { medir.ctx.close(); } catch (e) { /* ok */ } medir.ctx = null; }
    if (trava) { try { trava.release(); } catch (e) { /* ok */ } trava = null; }
    token = ''; el.passoAo.hidden = true; el.passoCodigo.hidden = false; el.conectar.disabled = false; el.cod.value = '';
    estado(msg || T('Desconectado.', 'Disconnected.'), tipo);
  }

  el.conectar.addEventListener('click', async () => {
    const codigo = el.cod.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (codigo.length !== 6) { estado(T('Digite o código de 6 letras do PC.', 'Type the 6-letter code from the PC.'), 'erro'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices || !window.RTCPeerConnection) { estado(T('Este navegador não deixa usar o microfone aqui. Tente o Chrome ou o Safari.', 'This browser cannot use the microphone here. Try Chrome or Safari.'), 'erro'); return; }
    el.conectar.disabled = true;
    try { localStorage.setItem('aero-cel-nome', el.nome.value.trim().slice(0, 32)); } catch (e) { /* ok */ }
    try {
      estado(T('Liberando o microfone...', 'Allowing the microphone...'));
      // antes de parear: com o microfone liberado o navegador mostra o endereço real na rede (a conexão local fica direta)
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
      estado(T('Esperando o PC permitir...', 'Waiting for the PC to allow...'));
      const p = await post('/api/parear', { codigo, nome: el.nome.value.trim().slice(0, 32) });
      if (!p.ok) { encerrar(MSG[p.j.erro] || T('Não deu para conectar.', 'Could not connect.'), 'erro'); return; }
      token = p.j.token;
      estado(T('Conectando...', 'Connecting...'));
      pc = new RTCPeerConnection({ iceServers: [] }); // só a rede local: sem servidor de fora
      const trilha = stream.getAudioTracks()[0];
      pc.addTransceiver(trilha, { direction: 'sendonly', streams: [stream] });
      pc.onconnectionstatechange = () => {
        const s = pc && pc.connectionState;
        if (s === 'connected') { estado(T('Conectado! Sua voz está indo para a chamada.', 'Connected! Your voice is going to the call.'), 'ok'); el.passoCodigo.hidden = true; el.passoAo.hidden = false; manterTela(); }
        else if (s === 'failed' || s === 'closed') encerrar(T('A conexão caiu. Gere um código novo no PC para conectar de novo.', 'The connection dropped. Create a new code on the PC to connect again.'), 'erro');
      };
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise((ok) => { if (pc.iceGatheringState === 'complete') return ok(); const t = setTimeout(ok, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc && pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); });
      const s = await post('/api/sinal', { token, sdp: pc.localDescription.sdp });
      if (!s.ok || !s.j.sdp) { encerrar(T('O PC não respondeu. Tente de novo.', 'The PC did not answer. Try again.'), 'erro'); return; }
      await pc.setRemoteDescription({ type: 'answer', sdp: s.j.sdp });
      medir();
    } catch (e) {
      encerrar(e && e.name === 'NotAllowedError' ? T('Você não liberou o microfone.', 'You did not allow the microphone.') : T('Não deu para conectar.', 'Could not connect.'), 'erro');
    }
  });
  el.cod.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.conectar.click(); });
  el.mudo.addEventListener('click', () => {
    mudo = !mudo; if (stream) stream.getAudioTracks().forEach((t) => { t.enabled = !mudo; });
    el.mudo.textContent = mudo ? T('Ligar o som', 'Unmute') : T('Silenciar', 'Mute'); el.mudo.classList.toggle('ativo', mudo);
  });
  el.sair.addEventListener('click', () => { const t = token; if (t) post('/api/fim', { token: t }).catch(() => {}); encerrar(); });
  addEventListener('pagehide', () => { if (token) { try { navigator.sendBeacon('/api/fim', new Blob([JSON.stringify({ token })], { type: 'application/json' })); } catch (e) { /* ok */ } } });
})();
