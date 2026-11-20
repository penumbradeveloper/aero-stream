// Aero Stream - sala em janelinha (PiP dentro do app). Dá para voltar ao menu e a sala continua rodando: a janelinha mostra a
// transmissão, pode ser arrastada (e gruda no canto mais próximo), um clique volta à sala. Enquanto ela está ativa, avisos
// importantes (mensagens, pedidos de entrada, pedidos de controle) continuam aparecendo. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T, S = A.sala;
  const P = (U.pip = { visivel: false, naoLidas: 0 });
  let el = null, video = null, titulo = null, selo = null, btnMic = null, vazio = null, mostrando = null, canto = 'br';
  let arrastando = null;
  const toastsPedido = new Map(); // avisos de pedido de entrada ainda na tela

  const lerCanto = () => { try { const c = JSON.parse(A.store.ler('aero-pip', '{}')).c; return ['tl', 'tr', 'bl', 'br'].includes(c) ? c : 'br'; } catch (e) { return 'br'; } };
  const gravarCanto = () => A.store.gravar('aero-pip', JSON.stringify({ c: canto }));
  const margem = () => ({ x: 14, topo: 14, base: A.plat.celular ? 96 : 14 }); // no celular a barra de abas fica embaixo

  function posicionar(animar) {
    if (!el) return;
    const r = el.getBoundingClientRect(), m = margem();
    const x = canto.endsWith('l') ? m.x : innerWidth - r.width - m.x;
    const y = canto.startsWith('t') ? m.topo : innerHeight - r.height - m.base;
    el.classList.toggle('encaixando', !!animar);
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  function montar() {
    video = h('video', { playsinline: '', autoplay: '' }); video.muted = true; video.tabIndex = -1;
    vazio = h('div', { class: 'pip-vazio' });
    titulo = h('div', { class: 'pip-titulo' });
    selo = h('span', { class: 'selo', hidden: true });
    btnMic = U.btn('', { icone: 'micOff', tipo: 'sec', redondo: true, peq: true, titulo: T('Microfone', 'Microphone'), onclick: async (e) => { e.stopPropagation(); try { await S.mic(!S.micLigado()); } catch (err) { U.toast(T('Não consegui usar o microfone.', 'Could not use the microphone.'), { tipo: 'erro' }); } atualizar(); } });
    const voltar = U.btn('', { icone: 'expandir', tipo: 'sec', redondo: true, peq: true, titulo: T('Voltar para a sala', 'Back to the room'), onclick: (e) => { e.stopPropagation(); P.voltar(); } });
    voltar.append(selo);
    const sair = U.btn('', { icone: 'sair', tipo: 'perigo', redondo: true, peq: true, titulo: T('Sair da sala', 'Leave room'), onclick: async (e) => { e.stopPropagation(); if (await U.confirmar(T('Sair da sala?', 'Leave the room?'), { sim: T('Sair', 'Leave') })) { A.som.tocar('sair'); await S.fechar(); } } });
    const area = h('div', { class: 'pip-area', role: 'button', tabindex: '0', title: T('Voltar para a sala', 'Back to the room'), 'aria-label': T('Voltar para a sala', 'Back to the room') }, video, vazio);
    area.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); P.voltar(); } });
    el = h('div', { id: 'pip', class: 'vidro', role: 'dialog', 'aria-label': T('Sala em janelinha', 'Room in a small window') }, area, h('div', { class: 'pip-rodape' }, titulo, btnMic, voltar, sair));
    el.addEventListener('pointerdown', comecar);
    document.body.append(el);
  }

  // ---------- arrastar (com limiar: sem mexer, é um clique e volta à sala) ----------
  function comecar(e) {
    if (e.button > 0 || e.target.closest('.btn')) return;
    const r = el.getBoundingClientRect();
    arrastando = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moveu: false };
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
  }
  function mover(e) {
    const a = arrastando; if (!a || e.pointerId !== a.id) return;
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
    a.moveu = true; el.classList.add('arrastando'); el.classList.remove('encaixando');
    const r = el.getBoundingClientRect();
    const x = A.limitar(e.clientX - a.ox, 4, Math.max(4, innerWidth - r.width - 4)), y = A.limitar(e.clientY - a.oy, 4, Math.max(4, innerHeight - r.height - 4));
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }
  function soltar(e) {
    const a = arrastando; if (!a || e.pointerId !== a.id) return;
    arrastando = null;
    el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); el.removeEventListener('pointercancel', soltar);
    el.releasePointerCapture && el.releasePointerCapture(a.id);
    el.classList.remove('arrastando');
    if (!a.moveu) { P.voltar(); return; }
    const r = el.getBoundingClientRect();
    canto = (r.top + r.height / 2 < innerHeight / 2 ? 't' : 'b') + (r.left + r.width / 2 < innerWidth / 2 ? 'l' : 'r');
    gravarCanto(); posicionar(true);
  }

  // ---------- conteúdo ----------
  function origem() {
    if (S.local.tela && S.previewSeguro()) return S.local.tela;
    const r = [...S.remotas.values()].find((x) => x.tela && x.id === S.foco) || [...S.remotas.values()].find((x) => x.tela);
    return r ? r.stream : null;
  }
  function atualizar() {
    if (!el || !P.visivel) return;
    const s = origem();
    if (s !== mostrando) { mostrando = s; video.srcObject = s || null; if (s) video.play().catch(() => {}); }
    video.hidden = !s; vazio.hidden = !!s;
    if (!s) {
      vazio.textContent = '';
      const quem = S.participantes.slice(0, 4);
      vazio.append(h('div', { class: 'pip-avs' }, quem.map((p) => U.avatar(p, 34))), h('div', { class: 'peq' }, S.local.tela && !S.previewSeguro() ? T('Você está transmitindo', 'You are sharing') : T('Ninguém transmitindo', 'Nobody sharing')));
    }
    titulo.textContent = `${S.sala} · ${S.participantes.length}`;
    btnMic.replaceChildren(A.icone(S.micLigado() ? 'mic' : 'micOff', 18)); btnMic.classList.toggle('ativo', S.micLigado());
    selo.hidden = !P.naoLidas; selo.textContent = P.naoLidas; A.ui.marcarSelo(selo);
    posicionar(false);
  }

  P.mostrar = () => {
    if (!S.ativa) return;
    if (!el) montar();
    P.visivel = true; P.naoLidas = 0; el.classList.remove('saindo');
    canto = lerCanto();
    el.hidden = false; atualizar();
    el.classList.add('entrando'); void el.offsetWidth; requestAnimationFrame(() => el && el.classList.remove('entrando'));
  };
  P.esconder = () => {
    if (!el || !P.visivel) return;
    P.visivel = false; mostrando = null; video.srcObject = null;
    el.classList.add('saindo');
    setTimeout(() => { if (el && !P.visivel) el.hidden = true; }, 260);
  };
  P.voltar = async () => {
    P.esconder();
    if (S.ativa && !(U.telaAtual() && U.telaAtual().nome === 'sala')) await U.ir('sala', {});
  };

  // ---------- eventos ----------
  ['estado', 'stream', 'stream-fim', 'local', 'foco'].forEach((n) => A.evt.on('sala:' + n, atualizar));
  addEventListener('resize', () => posicionar(false));
  A.evt.on('tela', (nome) => { if (nome === 'sala') P.esconder(); else if (P.visivel && !S.ativa) P.esconder(); });
  A.evt.on('sala:fechada', () => { if (P.visivel) { P.esconder(); } });

  // avisos que continuam chegando enquanto a sala está na janelinha
  const abrir = { texto: T('Abrir', 'Open'), tipo: 'ok', onclick: () => P.voltar() };
  A.evt.on('sala:chat', (c) => {
    if (!P.visivel || c.de === S.id) return;
    P.naoLidas++; atualizar();
    const p = S.participante(c.de) || { nome: '?' };
    A.som.tocar('chat-recebido');
    U.toast(h('span', {}, h('b', {}, p.nome), ': ', String(c.texto).slice(0, 90)), { avatar: p, som: 'chat-recebido', ms: 4200, acoes: [{ ...abrir, texto: T('Abrir chat', 'Open chat') }] });
  });
  A.evt.on('sala:pedido', (q) => {
    if (!P.visivel) return;
    const amigo = q.codigo && A.hub.amigos.find((a) => a.codigo === q.codigo && a.estado === 'aceita' && a.confia);
    if (amigo) { S.aprovar(q.id); return; }
    toastsPedido.set(q.id, U.toast(h('span', {}, h('b', {}, q.nome), T(' quer entrar na sala', ' wants to join the room')), { avatar: q, som: 'msg', ms: 15000, acoes: [{ texto: T('Aceitar', 'Accept'), tipo: 'ok', onclick: () => S.aprovar(q.id) }, { texto: T('Recusar', 'Decline'), tipo: 'sec', onclick: () => S.recusar(q.id) }] }));
  });
  A.evt.on('sala:pedido-fim', (q) => { const t = toastsPedido.get(q.id); if (t) { t.fechar(); toastsPedido.delete(q.id); } });
  A.evt.on('sala:ctl', ({ p, antes, depois }) => {
    if (!P.visivel || !depois || depois.st !== 'pedindo' || (antes && antes.st === 'pedindo')) return;
    if (!(depois.dono === S.id || S.papel === 'host')) return;
    U.toast(h('span', {}, h('b', {}, p.nome), T(' quer controlar a sua tela', ' wants to control your screen')), { avatar: p, som: 'msg', ms: 20000, acoes: [{ texto: T('Aceitar', 'Accept'), tipo: 'ok', onclick: () => S.decidirControle(p.id, 'aprovar') }, { texto: T('Negar', 'Deny'), tipo: 'sec', onclick: () => S.decidirControle(p.id, 'negar') }] });
  });
  A.evt.on('sala:entrou', (p) => { if (P.visivel) U.toast(h('span', {}, h('b', {}, p.nome), T(' entrou na sala', ' joined the room')), { avatar: p, som: 'entrar', ms: 2400 }); });
  A.evt.on('sala:saiu', (p) => { if (P.visivel) U.toast(h('span', {}, h('b', {}, p.nome), T(' saiu da sala', ' left the room')), { avatar: p, som: 'sair', ms: 2200 }); });
  A.evt.on('sala:comp-inicio', (p) => { if (P.visivel) U.toast(h('span', {}, h('b', {}, p.nome), T(' começou a compartilhar a tela', ' started sharing their screen')), { avatar: p, som: 'compartilhar', ms: 3400, acoes: [abrir] }); });
})();
