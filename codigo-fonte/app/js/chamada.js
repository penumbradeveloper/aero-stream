// Aero Stream - MODO TALK: chamadas do Aero Talk (privado ou grupo de até 10), inspiradas no Skype clássico e com a cara do Aero.
// O MODO SALA (transmitir, jogar junto, muita gente) é outra coisa; a chamada não cria sala e a aba Transmitir fica livre.
//  - Quem liga toca o "telefone" dos outros (HTTP); quem atende avisa a conversa ("entrar") e quem já está na chamada manda a oferta.
//  - A negociação do WebRTC (oferta, resposta, ICE) passa pelo WebSocket do Hub; voz, câmera e tela vão direto (ou pelo TURN).
//  - Em grupo é uma malha: cada um liga direto com cada um.
//  - Três jeitos de ver: MAXIMIZADA (o "palco" azul do Skype: as pessoas lado a lado com o nome embaixo, você pequenininho no meio de
//    baixo e a barra de botões flutuando), JANELINHA (PiP, arrastável, para usar o app durante a chamada) e MINIMIZADA (uma pílula).
//  - Compartilhar a tela (com o mesmo seletor e o mesmo som por aplicativo da sala) e os MESMOS painéis de microfone e de som da sala:
//    o microfone passa pelo tratamento do app (supressão de ruído, sensibilidade, volume, dispositivo) e o som dos amigos pelo mesmo
//    caminho de áudio (volume geral, vozes, transmissões e a saída escolhida).
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, API = A.api, H = A.hub;
  const CH = (A.chamada = { ativa: null });
  const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const eu = () => API.eu || {};
  const SEM_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // (0.9.1) sem o "play" cinza do Android
  const nomeDe = (cod) => (A.talk && A.talk.nomeDe ? A.talk.nomeDe(cod) : cod);
  const pessoaDe = (cod) => (A.talk && A.talk.pessoaDe ? A.talk.pessoaDe(cod) : { codigo: cod, nome: cod });
  const conversa = (cid) => (A.talk && A.talk.conversas.find((c) => c.id === cid)) || null;
  const S = () => A.sala;

  // ---------- sons ----------
  let toque = null;
  const pararToque = () => { if (toque) { clearInterval(toque); toque = null; } if (A.extras) A.extras.pararToque(); };
  const tocar = (nome, ms) => { pararToque(); A.som.tocar(nome); toque = setInterval(() => A.som.tocar(nome), ms); };

  // ---------- estado da chamada ----------
  // ch = { cid, id, titulo, grupo, ice, mic (trilha), cam (trilha), tela (stream), mudo, pares: Map, saindo, inicio, ui, timers, modo }
  let ch = null;
  // (0.6.1) todo sinal leva a "sessão" (uma por vez que você entra na chamada): quem saiu e voltou é reconhecido na hora
  const sinal = (para, paraDev, dados) => ch && H.enviar({ tipo: 'cham-sinal', cid: ch.cid, id: ch.id, para, paraDev: paraDev || undefined, dados: { ...dados, s: ch.sessao } });
  const viva = (t) => (t && t.readyState === 'live' ? t : null);
  const minhas = () => ({ voz: viva(ch.mic), cam: viva(ch.cam), tela: ch.tela && !S().local.kms ? viva(ch.tela.getVideoTracks()[0]) : null, somTela: ch.tela ? viva(ch.tela.getAudioTracks()[0]) : null });
  // (1.0.0) o ajuste da câmera (espelhar, de cabeça para baixo, girar): quem mostra escolhe e todo mundo vê a imagem já corrigida
  const ajOk = (a) => ({ h: !!(a && a.h), v: !!(a && a.v), r: a && [90, 180, 270].includes(a.r) ? a.r : 0 });
  const ajCam = () => ajOk(A.cfg.v.camAjuste);
  const meuEstado = () => ({ aj: ajCam(), mudo: ch.mudo, cam: !!viva(ch.cam), tela: !!ch.tela, cel: !!A.plat.celular, modo: ch.modoTela, cor: corOk((A.cfg.v.entrada || {}).cor), ms: ch.meuMs || undefined });
  const corOk = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  const avisarEstado = () => { sinal('*', '', { t: 'estado', ...meuEstado() }); };

  // o microfone passa pelo tratamento do app (o mesmo da sala). A chamada usa uma CÓPIA da trilha: mutar aqui não muta a sala.
  async function abrirMic() {
    try { const st = await A.mic.iniciar(); const t = st.getAudioTracks()[0]; return t ? t.clone() : null; }
    catch (e) { A.ui.toast(T('Não consegui usar o microfone: os outros não vão te ouvir.', 'Could not use the microphone: others will not hear you.'), { tipo: 'erro' }); return null; }
  }
  // (0.7.6) a câmera escolhida na setinha do botão da câmera (fica guardada); se ela não estiver mais ligada no PC, vai a padrão
  async function abrirCamera() {
    const base = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, id = A.cfg.v.camera;
    if (id) try { return (await navigator.mediaDevices.getUserMedia({ video: { ...base, deviceId: { exact: id } } })).getVideoTracks()[0]; } catch (_) { /* tenta a padrão */ }
    try { return (await navigator.mediaDevices.getUserMedia({ video: base })).getVideoTracks()[0]; }
    catch (e) { A.ui.toast(T('Não consegui usar a câmera.', 'Could not use the camera.'), { tipo: 'erro' }); return null; }
  }
  const largarMic = () => { const s = S(); if (!(s && s.ativa && s.local.mic)) A.mic.parar(); }; // a sala ainda usa? então fica

  function novoEstado(cid, id, titulo, grupo) {
    return { cid, id, titulo, grupo, sessao: Math.random().toString(36).slice(2, 10), ice: [], mic: null, cam: null, tela: null, mudo: false, pares: new Map(), saindo: false, inicio: 0, timers: [], pronto: false, fila: [], modo: 'max', modoTela: A.cfg.v.chamadaModo === 'jogo' ? 'jogo' : 'tela', superficie: '' };
  }
  async function prepararMidia(video) {
    try { ch.ice = await API.ice(); } catch (_) { ch.ice = []; }
    const meu = ch;
    const mic = await abrirMic(), cam = video && A.plat.camera ? await abrirCamera() : null;
    if (ch !== meu) { [mic, cam].forEach((t) => t && t.stop()); return false; }
    ch.mic = mic; ch.cam = cam;
    return true;
  }

  // o servidor sabe quem está na chamada da conversa (para "Chamada em andamento — Entrar" e para registrar no chat quanto durou)
  const avisarServidor = (acao, extra = {}, c = ch) => (c ? API.req(`conv/${c.cid}/chamada`, { acao, id: c.id, dev: H.dev || '', ...extra }).then((r) => { if (acao !== 'sair' && acao !== 'cancelar') c.noServidor = true; return r; }) : Promise.resolve(null));
  CH.ativaId = () => (ch ? ch.id : null);
  CH.compartilhando = () => !!(ch && ch.tela);
  CH.chatVisivel = (cid) => !!(ch && ch.cid === cid && ch.modo === 'max' && ch.ui && ch.ui.chatAberto && ch.ui.chatAberto() && !document.hidden); // (0.7.0) o chat da conversa aberto dentro da chamada
  // (0.7.0) a tela que alguém está compartilhando (para a faixa da chamada no chat mostrar) e abrir ela em destaque
  CH.midiaTela = (codigo) => { if (!ch) return null; for (const par of ch.pares.values()) if (par.codigo === codigo && par.tela && par.midia && par.midia.tela) return par.midia.tela; return null; };
  CH.telaRemota = () => !!ch && [...ch.pares.values()].some((par) => par.tela);
  CH.focarTela = (codigo) => { if (!ch) return; for (const par of ch.pares.values()) if (par.codigo === codigo) { if (CH.focar) CH.focar(par.chave); return; } };

  // ---------- ligar ----------
  CH.ligar = async (c, video) => {
    if (ch && ch.cid === c.id) { CH.modo('max'); return; }
    if (ch) CH.desligar(); // (0.7.0) já estava em outra chamada: sai dela e liga para esta
    if (c.cham && c.cham.id) return CH.entrarNa(c, video, true); // já tem uma chamada acontecendo nesta conversa: entra nela
    ch = novoEstado(c.id, novoId(), A.talk.titulo(c), c.tipo === 'grupo');
    // (0.7.14) a chamada de voz de um grupo (um canal de voz) não toca o telefone de ninguém: quem quiser entra. Começa já "dentro", sem o
    // toque de chamando e sem o "Ninguém atendeu"
    const canalVoz = c.canal === 'voz';
    ch.saindo = !canalVoz;
    const meu = ch;
    if (!(await prepararMidia(video))) return;
    ch.pronto = true;
    montarJanela();
    if (!canalVoz) tocar('chamada-saida', 2600);
    let r;
    try { r = await avisarServidor('tocar', { video: !!video }); }
    catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); encerrar(false); return; }
    if (r && r.entrou && ch === meu) { // alguém começou uma chamada nesta conversa um instante antes: entra nela
      pararToque(); ch.id = r.entrou; ch.saindo = false; if (tocando && tocando.cid === ch.cid) fecharTocando();
      sinal('*', '', { t: 'entrar', ...meuEstado() }); A.evt.emit('chamada:entrou', { cid: ch.cid }); A.evt.emit('talk:cham', { cid: ch.cid }); return;
    }
    A.evt.emit('chamada:entrou', { cid: c.id });
    if (canalVoz) { if (ch === meu) { A.som.tocar('cham-entrei'); vigiarSozinho(); } return; }
    ch.timers.push(setTimeout(() => { if (ch === meu && !ch.pares.size) { A.ui.toast(T('Ninguém atendeu.', 'Nobody answered.')); CH.desligar(); } }, 45000));
  };
  // entrar numa chamada que já está acontecendo (a faixa "Chamada em andamento — Entrar" do Aero Talk)
  CH.entrarNa = async (c, video = false, ligarSeAcabou = false) => {
    if (!c || !c.cham) return;
    if (ch && ch.id === c.cham.id) { CH.modo('max'); return; }
    if (ch) CH.desligar();
    ch = novoEstado(c.id, c.cham.id, A.talk.titulo(c), c.tipo === 'grupo');
    if (!(await prepararMidia(!!video))) return;
    montarJanela();
    sinal('*', '', { t: 'entrar', ...meuEstado() });
    ch.pronto = true; ch.fila.splice(0).forEach(tratarSinal);
    const meu = ch;
    try { await avisarServidor('entrar'); }
    catch (e) {
      if (ch === meu) encerrar(false);
      // a chamada já tinha acabado (alguém caiu sem desligar e ela ficou aparecendo): some a faixa e, se era para ligar, liga de novo
      if (e.status === 409) { c.cham = null; A.evt.emit('talk:cham', { cid: c.id }); if (ligarSeAcabou && !ch) return CH.ligar(c, video); }
      A.ui.toast(e.message || String(e), { tipo: 'erro' }); return;
    }
    if (ch !== meu) return;
    A.som.tocar('cham-entrei'); A.evt.emit('chamada:entrou', { cid: c.id }); // (0.7.0) o som de entrar
    setTimeout(vigiarSozinho, 15000);
  };
  // o Hub reconectou (o aparelho ganhou outro id): continua na chamada com o id novo
  A.evt.on('hub:eu', () => {
    if (ch && ch.pronto && !ch.saindo) avisarServidor('entrar', { retomar: true }).catch(() => {});
    if (ch) for (const p of ch.pares.values()) if (p.caiuDesde && p.pc.signalingState === 'stable') ofertar(p, true).catch(() => {}); // (0.7.4) o sinal voltou: tenta já
  }); // (0.7.0) volta sem o aviso de "iniciou uma chamada"

  // ---------- o telefone tocando: um cartão no canto ----------
  let tocando = null; // { id, cid, el }
  function fecharTocando() { pararToque(); if (tocando) { const e = tocando.el; tocando = null; e.classList.add('saindo'); setTimeout(() => e.remove(), A.aer && A.aer.tempoSaidaLigacao ? A.aer.tempoSaidaLigacao() : 380); A.evt.emit('talk:cham', { cid: e.dataset.cid }); } }
  // (0.5.9-6) com a conversa da chamada aberta, atender/recusar aparecem na faixa da chamada do chat e o cartão do meio some (ele ficava por
  // cima dos botões da faixa)
  CH.tocandoEm = (cid) => (tocando && tocando.cid === cid ? { video: tocando.ev.video, de: tocando.ev.de } : null);
  CH.atenderTocando = (video) => { if (tocando) return atender(tocando.ev, video); };
  CH.recusarTocando = () => { if (tocando) recusar(tocando.ev); };
  CH.ajustarToque = () => { if (!tocando) return; const p = document.querySelector('.tk-cham-palco[data-cid="' + tocando.cid + '"]:not([hidden])'); tocando.el.classList.toggle('escondida-no-chat', !!(p && p.getClientRects().length)); };
  A.evt.on('hub:chamada', (e) => {
    if ((ch && ch.id === e.id) || (tocando && tocando.id === e.id)) return;
    // (0.6.9) os dois ligaram ao mesmo tempo nesta conversa: não toca (o servidor junta as duas numa chamada só, e a resposta do "ligar" já
    // diz em qual entrar). Antes tocava por cima da própria chamada e a tela da chamada ficava bugada até trocar de conversa
    if (ch && ch.cid === e.cid) return;
    if (tocando) fecharTocando();
    const U = A.ui, nome = nomeDe(e.de.codigo) || e.de.nome;
    const tocarAntigo = () => { if (A.cfg.v.toque === 'novo') tocar('chamada-entrada', 3000); else if (A.cfg.v.toque === 'marimba') tocar('chamada-entrada-marimba', 3400); else if (A.cfg.v.toque === 'brisa') tocar('chamada-entrada-brisa', 4000); else tocar('chamada-entrada-classico', 3000); }; // padrão: Vidro // o toque novo (ou o antigo, nas Configurações)
    // (1.0.0) os toques do Aero Bubble (o do amigo, o escolhido, o próprio); sem nenhum, o de antes
    if (A.ui.naoPerturbe()) { /* não perturbe: o cartão aparece, mas sem tocar */ } else { const idx = A.extras ? A.extras.toqueDe(e.de.codigo) : ''; if (!idx) tocarAntigo(); else A.extras.tocarToque(idx, tocar).then((ok) => { if (!tocando || tocando.id !== e.id) { A.extras.pararToque(); pararToque(); } else if (!ok) tocarAntigo(); }); }
    const atenderCom = (video) => () => atender(e, video).catch((x) => U.toast(x.message || String(x), { tipo: 'erro' }));
    const el = h('div', { class: 'cham-toque vidro', role: 'alertdialog', 'aria-label': T('Chamada de ', 'Call from ') + nome },
      h('div', { class: 'cham-toque-av' }, h('div', { class: 'tocando-ondas' }, h('i'), h('i'), h('i')), U.avatar(e.de, 64)),
      h('div', { class: 'cresce' },
        h('b', {}, nome),
        h('div', { class: 'peq suave' }, (e.video ? T('Chamada de vídeo', 'Video call') : T('Chamada de voz', 'Voice call')) + (e.grupo ? ' · ' + e.grupo : '') + '…')),
      h('div', { class: 'cham-toque-botoes' },
        U.btn('', { icone: 'desligarTel', tipo: 'perigo', redondo: true, titulo: T('Recusar', 'Decline'), onclick: () => recusar(e) }),
        U.btn('', { icone: 'telefone', tipo: 'ok', redondo: true, titulo: T('Atender com voz', 'Answer with voice'), onclick: atenderCom(false) }),
        e.video && A.plat.camera ? U.btn('', { icone: 'video', tipo: 'ok', redondo: true, titulo: T('Atender com vídeo', 'Answer with video'), onclick: atenderCom(true) }) : null));
    el.dataset.cid = e.cid;
    // (1.0.0) o cartão de ligação de quem liga (Donator e Supporter): a imagem atrás do aviso
    const clV = A.extras ? A.extras.extrasDe(e.de.codigo).clV : 0;
    if (clV) { el.classList.add('com-cartao'); el.prepend(h('div', { class: 'cham-toque-cartao', 'aria-hidden': 'true', estilo: { 'background-image': `url("${A.extras.urlLigacao(e.de.codigo, clV)}")` } })); }
    if (A.aer && A.aer.vestirLigacao) A.aer.vestirLigacao(el); // (1.0.0) a tela de ligação da skin (imagens e animação)
    tocando = { id: e.id, cid: e.cid, el, ev: e };
    document.body.append(el);
    A.ui.arrastar(el, el, { chave: 'toque' }); // (0.6.0) dá para arrastar o cartão para onde quiser (fica lembrado)
    A.evt.emit('talk:cham', { cid: e.cid }); CH.ajustarToque();
    if (document.hidden && window.Notification && Notification.permission === 'granted') {
      try { const n = new Notification(nome, { body: e.video ? T('Chamada de vídeo no Aero Talk', 'Aero Talk video call') : T('Chamada de voz no Aero Talk', 'Aero Talk voice call'), tag: 'aero-chamada', requireInteraction: true }); n.onclick = () => { window.focus(); n.close(); }; } catch (_) { /* sem notificação */ }
    }
    setTimeout(() => { const b = el.querySelector('.btn.ok'); if (b && document.documentElement.dataset.entrada === 'pad') b.focus(); }, 300);
    setTimeout(() => { if (tocando && tocando.id === e.id) fecharTocando(); }, 45000);
  });
  function recusar(e) { fecharTocando(); A.som.tocar('chamada-fim'); API.req(`conv/${e.cid}/chamada`, { acao: 'recusar', id: e.id }).catch(() => {}); }
  async function atender(e, video) {
    fecharTocando();
    if (ch) CH.desligar();
    const c = conversa(e.cid);
    ch = novoEstado(e.cid, e.id, c ? A.talk.titulo(c) : nomeDe(e.de.codigo), !!e.grupo);
    if (!(await prepararMidia(video))) return;
    montarJanela();
    sinal('*', '', { t: 'entrar', ...meuEstado() });
    ch.pronto = true; ch.fila.splice(0).forEach(tratarSinal); // o que chegou enquanto o microfone abria
    avisarServidor('entrar').catch(() => {}); A.evt.emit('chamada:entrou', { cid: e.cid }); A.som.tocar('cham-entrei');
  }
  A.evt.on('hub:chamada-fim', (e) => { if (tocando && tocando.id === e.id) { fecharTocando(); A.ui.toast(T('Chamada perdida de ', 'Missed call from ') + (conversa(e.cid) ? A.talk.titulo(conversa(e.cid)) : '?')); } });
  A.evt.on('hub:chamada-recusada', (e) => {
    if (e.de && e.de.codigo === eu().codigo) { if (tocando && tocando.id === e.id) fecharTocando(); return; } // recusei em outro aparelho
    if (!ch || ch.id !== e.id) return;
    A.ui.toast((nomeDe(e.de.codigo) || e.de.nome) + T(' recusou a chamada.', ' declined the call.'), { ms: 3500 });
    if (!ch.grupo && !ch.pares.size) encerrar(false);
  });

  // ---------- a negociação ----------
  A.evt.on('hub:cham-sinal', (e) => {
    const d = e.dados || {};
    if (!ch || ch.id !== e.id) {
      // atendi em outro aparelho meu: este para de tocar
      if (tocando && tocando.id === e.id && e.de === eu().codigo && d.t === 'entrar') { fecharTocando(); A.ui.toast(T('Chamada atendida em outro aparelho.', 'Call answered on another device.')); }
      return;
    }
    if (!ch.pronto) { ch.fila.push(e); return; }
    tratarSinal(e);
  });
  // um sinal de cada vez, na ordem em que chegaram (senão uma oferta pode ser aplicada no meio da criação de outra)
  let cadeia = Promise.resolve();
  function tratarSinal(e) { cadeia = cadeia.then(() => processar(e)).catch((x) => A.log.aviso('chamada', x)); }
  async function processar(e) {
    const d = e.dados || {};
    if (!ch || ch.id !== e.id) return;
    // (0.6.9) a chamada é UMA por conta (por aparelho): sinal da própria conta é de uma cópia velha deste app (reiniciou e a antiga ainda não
    // tinha fechado) e não vira ninguém na tela. Era o "eu aparecendo duas vezes" depois de reiniciar o app e voltar para a chamada
    if (eu() && e.de === eu().codigo) return;
    const chave = e.de + '/' + e.deDev;
    let par = ch.pares.get(chave);
    // (0.6.1) a pessoa saiu e voltou (e o aviso de saída se perdeu): a conexão antiga, com o som dela, sai antes de tudo. Antes o "entrar"
    // novo era ignorado e a conexão velha se misturava com a nova: imagem toda quebrada e áudio robótico e estourado (tocando dobrado)
    if (par && d.s && par.sessao && d.s !== par.sessao) { if (d.t !== 'entrar' && d.t !== 'oferta') return; removerPar(par, { semSom: true }); par = null; }
    if (d.t === 'entrar') {
      // (0.8.4) o som de "entrou" toca quando a pessoa entra, sem esperar a conexão ficar pronta (com a internet ruim de quem entrou, a primeira
      // conexão demorava ou caía e o som só saía na segunda). Quem refaz a conexão (já estava na chamada) não toca de novo
      if (!ch.anunciados) ch.anunciados = new Set();
      if (!ch.anunciados.has(e.de)) { ch.anunciados.add(e.de); A.som.tocar(A.extras ? A.extras.somEntrou(e.de) : 'cham-entrou'); }
      // a oferta dele já chegou (cruzou com o "entrar"): seguimos com ela. (0.7.4) Mas se a conexão com ele está caída, o "entrar" é ele
      // refazendo a conexão do zero: a velha sai e começa uma nova (antes era ignorado e os dois ficavam presos numa conexão morta)
      if (par && !(par.caiuDesde || Date.now() - par.criado > 15000)) return;
      if (par && par.pc.connectionState === 'connected') return;
      if (par) { removerPar(par, { semSom: true }); par = null; }
      par = criarPar(e, d); await ofertar(par);
    } else if (d.t === 'oferta') {
      // as duas pontas mandaram oferta ao mesmo tempo: a de chave menor cede (joga a dela fora e responde a outra)
      if (par && par.pc.signalingState === 'have-local-offer') {
        if ((eu().codigo + '/' + H.dev) > par.chave) return;
        const guardados = par.ice; removerPar(par, { semSom: true }); par = null;
        par = criarPar(e, d); par.ice.push(...guardados);
      }
      if (!par) par = criarPar(e, d);
      lerEstado(par, d);
      await par.pc.setRemoteDescription({ type: 'offer', sdp: somDaTela(d.sdp) });
      ligarTrilhas(par);
      await par.pc.setLocalDescription(await par.pc.createAnswer());
      sinal(e.de, e.deDev, { t: 'resposta', sdp: par.pc.localDescription.sdp });
      await soltarIce(par);
      if (par.refazerOferta) { par.refazerOferta = false; renegociar(par); }
    } else if (d.t === 'resposta' && par) {
      await par.pc.setRemoteDescription({ type: 'answer', sdp: somDaTela(d.sdp) });
      await soltarIce(par);
      if (par.refazerOferta) { par.refazerOferta = false; renegociar(par); }
    } else if (d.t === 'ice' && par) {
      if (par.pc.remoteDescription) await par.pc.addIceCandidate(d.c).catch(() => {}); else par.ice.push(d.c);
    } else if (d.t === 'sair' && par) {
      // como no Discord: quem saiu sai; a chamada continua para quem ficou (ela só acaba quando o último sair). Sozinho por 10 min: sai.
      removerPar(par);
      if (!ch.pares.size && !ch.saindo) {
        A.ui.toast(nomeDe(par.codigo) + T(' saiu da chamada. Você continua nela; se ninguém voltar em 3 minutos, ela fecha.', ' left the call. You are still in it; if nobody comes back in 3 minutes, it closes.'), { ms: 4500 });
        vigiarSozinho();
      }
    } else if (d.t === 'reconectar' && par) { // (0.7.4) do lado de lá a conexão caiu: refaz o caminho (ICE) daqui
      if (par.pc.connectionState !== 'connected' && par.pc.signalingState === 'stable') await ofertar(par, true);
    } else if (d.t === 'estado' && par) { lerEstado(par, d); pintarTudo(); }
    else if (d.t === 'ms' && par) msDoPar(par, d.v);
    else if (d.t === 'quadro' && par) mandarQuadro(par, d.papel === 'cam' ? 'cam' : 'tela'); // (0.6.1) a imagem quebrou do lado de lá: um quadro inteiro
    else if (d.t === 'verde' && par && par.pj) S().sinalDaChamada(par.pj, { verde: 1 });
    else if (d.t === 'telaPreta' && par && minhaTela() && Date.now() - (par.refezTela || 0) > 20000) { par.refezTela = Date.now(); A.log.aviso('tela da chamada: sem imagem para', par.codigo, '- refazendo o envio'); desligarTelaJogo(par); if (ligarTelaJogo(par)) renegociar(par); }
    else if (d.t === 'jogo' && par && par.pj) S().sinalDaChamada(par.pj, d.d);
  }
  // (0.8.7) o ms que a própria pessoa mediu da internet dela: aparece na janelinha dela
  const msDoPar = (par, v) => { v = Math.round(+v); par.ms = Number.isFinite(v) && v > 0 && v < 10000 ? v : 0; pintarMsPar(par); };
  const nivelMs = (v) => (!v ? '' : v < 90 ? 'bom' : v < 200 ? 'medio' : 'ruim');
  const pintarMsPar = (par) => { const e = par.tile && par.tile.querySelector('.cham-tile-ms'); if (!e) return; const t = par.ms ? par.ms + ' ms' : ''; if (e.textContent !== t) e.textContent = t; e.dataset.nivel = nivelMs(par.ms); e.title = par.ms ? T('Conexão de ', 'Connection of ') + nomeDe(par.codigo) + ': ' + par.ms + ' ms' : ''; };
  const lerEstado = (par, d) => {
    if (d.ms !== undefined) msDoPar(par, d.ms);
    if (d.cel !== undefined) par.cel = !!d.cel;
    par.aj = ajOk(d.aj);
    par.mudo = !!d.mudo; par.cam = !!d.cam; par.tela = !!d.tela; if (par.tela && !par.telaDesde) par.telaDesde = Date.now(); if (!par.tela) par.telaDesde = 0; A.evt.emit('chamada:tela', par.tela);
    const eraJogo = par.modo === 'jogo';
    par.modo = d.modo === 'jogo' ? 'jogo' : 'tela'; par.cor = corOk(d.cor); sujarCtl();
    if (eraJogo !== (par.modo === 'jogo')) atrasoTela(par);
    acertarJogo(par);
    if (meuCtlCh && meuCtlCh.dono === par.chave && !(par.tela && par.modo === 'jogo')) fimMeuCtl(false); // parou de compartilhar no modo jogo: o meu controle acaba
  };

  // (0.7.6) a folga para segurar a imagem: no modo jogo quase nenhuma (cada milissegundo é atraso no controle, como na sala); fora dele,
  // ~0,1 s (dá tempo do pacote perdido chegar de novo antes de a imagem ser montada)
  function atrasoTela(par) {
    for (const tr of par.pc.getTransceivers()) {
      if (!tr.receiver || !tr.receiver.track || tr.receiver.track.kind !== 'video') continue;
      const r = tr.receiver, papel = papelDe(par.pc, tr);
      // (1.0.0) a tela: a mesma regra da sala (S.folgaTela): mínimo só para quem controla; quem só assiste ganha folga, como um vídeo
      const ctl = !!(meuCtlCh && meuCtlCh.dono === par.chave && meuCtlCh.st !== 'pedindo');
      const ms = papel === 'tela' ? S().folgaTela(par.modo === 'jogo', ctl) : 90;
      try { if ('jitterBufferTarget' in r) r.jitterBufferTarget = ms; } catch (_) { /* navegador sem suporte */ }
      try { if ('playoutDelayHint' in r) r.playoutDelayHint = papel === 'tela' ? ms / 1000 : null; } catch (_) { /* idem */ }
    }
  }

  // (0.7.6) A TELA É A DA SALA: enquanto eu ou essa pessoa compartilhamos, ela também é um "peer" da sala (sala.js): a captura (direta da placa,
  // no modo jogo no Linux), a taxa, o tamanho por internet e por PC e o codificador por pessoa são o mesmo código, e não uma cópia
  // (0.7.10) nos dois modos: a tela normal da chamada tinha conta própria (1080p30, 540p com pouca taxa) e não sabia se o PC de quem assiste dava conta
  const minhaTela = () => !!(ch && ch.tela), minhaTelaJogo = () => minhaTela() && ch.modoTela === 'jogo';
  function acertarJogo(par) {
    const quer = minhaTela() || par.tela;
    if (quer && !par.pj) {
      par.pj = S().novoPeerChamada('ch:' + par.chave, par.pc, {
        sinal: (d) => sinal(par.codigo, par.dev, { t: 'jogo', d }),
        aoVp8: () => irVp8(par),
        aoBase: () => { A.codec.preferir(par.tr.tela, { pref: 'h264-base', soH264: true, soBase: true }); renegociar(par); },
        telaStream: () => par.midia.tela,
        aoPlaca: () => { A.codec.preferir(par.tr.tela, { pref: A.gpu.codecAtual(), soH264: A.gpu.usaPlaca() }); renegociar(par); },
      });
    } else if (!quer && par.pj) soltarJogo(par);
  }
  function soltarJogo(par) {
    if (!par.pj) return;
    desligarTelaJogo(par); S().peersChamada.delete(par.pj.id); par.pj = null;
  }
  function renegociar(par) { if (par.pc.signalingState === 'stable') ofertar(par).catch((e) => A.log.aviso('chamada: renegociar', e)); else par.refazerOferta = true; }
  // a minha tela no modo jogo entra nessa conexão como entra numa sala (na ordem: formato, transformação da placa, qualidade)
  function ligarTelaJogo(par) {
    const tr = par.tr && par.tr.tela; if (!tr || !minhaTela()) return false;
    acertarJogo(par);
    const pe = par.pj;
    // a captura direta entra como numa sala: um envio novo, que já nasce com a transformação (num envio já aberto ela não pega e sairia o quadrinho)
    if (S().local.kms && A.kms) { if (!par.trJogo) par.trJogo = par.pc.addTransceiver(ch.tela.getVideoTracks()[0], { direction: 'sendonly' }); A.kms.prepararSender(par.trJogo.sender, par.trJogo); }
    else A.codec.preferir(tr, { pref: pe.codecForcado || A.gpu.codecAtual(), soH264: pe.codecForcado !== 'vp8' && A.gpu.usaPlaca(), soBase: pe.codecForcado === 'h264-base' });
    pe.senders.set('tela', (par.trJogo || tr).sender); S().aplicarQualidadePeer(pe);
    return true;
  }
  function desligarTelaJogo(par) {
    const pe = par.pj, tr = par.tr && par.tr.tela; if (!pe || !tr || !pe.senders.size) return;
    pe.senders.delete('tela');
    if (par.trJogo) { if (A.kms) A.kms.soltarSender(par.trJogo.sender); try { par.trJogo.stop(); } catch (_) { /* ok */ } par.trJogo = null; }
    preferirTela(tr);
  }

  // As trilhas de cada conexão, sempre nesta ordem: áudio = [voz, som da tela]; vídeo = [câmera, tela].
  // Tudo existe desde o começo (vazio quando desligado): ligar câmera ou tela no meio da chamada não precisa renegociar.
  const papelDe = (pc, tr) => { const k = tr.receiver.track.kind; const i = pc.getTransceivers().filter((x) => x.receiver.track && x.receiver.track.kind === k).indexOf(tr); return k === 'audio' ? (i === 0 ? 'voz' : 'somTela') : (i === 0 ? 'cam' : 'tela'); };

  // (0.6.0) sozinho na chamada por 3 minutos: sai sozinho (vale para quem ficou sozinho, não derruba ninguém)
  function vigiarSozinho() {
    if (!ch) return; clearTimeout(ch.sozinhoT);
    if (ch.pares.size || ch.saindo) return;
    const meu = ch; ch.sozinhoT = setTimeout(() => { if (ch === meu && !ch.pares.size) { A.ui.toast(T('Você ficou sozinho na chamada por 3 minutos: saí dela.', 'You were alone in the call for 3 minutes: left it.')); CH.desligar(); } }, 3 * 60000);
  }
  CH._vigiarSozinho = vigiarSozinho;
  CH._pares = () => (ch ? [...ch.pares.values()].map((p) => ({ chave: p.chave, sessao: p.sessao, estado: p.pc.connectionState, som: Object.keys(p.som || {}).length })) : []); // para os testes
  // (0.9.6) o som da tela (o 2º áudio da conexão) vai em estéreo e com qualidade de música, como era na sala; o microfone continua igual
  const somDaTela = (sdp) => {
    const sec = String(sdp || '').split(/\r?\n(?=m=)/).filter((s) => s.startsWith('m=audio'))[1];
    const mid = sec && (/\r?\na=mid:(\S+)/.exec(sec) || [])[1];
    return mid && S() && S()._somMusica ? S()._somMusica(sdp, [mid]) : sdp;
  };
  // (1.0.0) esconder o IP é sempre ligado: a conexão passa só pelo retransmissor (TURN), então o outro lado nunca vê o seu endereço
  const usarRelay = () => !!API.turn;
  function criarPar(e, d) {
    // (0.6.0) UMA conexão por pessoa: se ela saiu e voltou (e o aviso de saída se perdeu), a conexão antiga sai e fica só a nova
    for (const p of [...ch.pares.values()]) if (p.codigo === e.de && p.chave !== e.de + '/' + e.deDev) removerPar(p, { semSom: true });
    const relay = usarRelay(e.de);
    const pc = new RTCPeerConnection({ iceServers: ch.ice, bundlePolicy: 'max-bundle', iceTransportPolicy: relay ? 'relay' : 'all' });
    const par = { relay, chave: e.de + '/' + e.deDev, codigo: e.de, dev: e.deDev, sessao: d.s || '', cel: !!d.cel, mbps: 0, limpo: 0, pc, ice: [], mudo: !!d.mudo, cam: !!d.cam, tela: !!d.tela, telaDesde: d.tela ? Date.now() : 0, tr: {}, midia: {}, tile: null, nivel: 0, rtt: 0 };
    par.modo = d.modo === 'jogo' ? 'jogo' : 'tela'; par.cor = corOk(d.cor);
    ch.pares.set(par.chave, par); par.criado = Date.now();
    // (0.6.9) quem não conectou em 25 s sai da lista (antes só saía quem caiu DEPOIS de conectar; quem nunca conectou ficava na tela para sempre)
    par.conectarT = setTimeout(() => { if (ch && ch.pares.get(par.chave) === par && pc.connectionState !== 'connected') { removerPar(par); vigiarSozinho(); } }, 25000);
    pc.onicecandidate = (ev) => { if (ev.candidate) sinal(par.codigo, par.dev, { t: 'ice', c: ev.candidate.toJSON() }); };
    pc.ontrack = (ev) => {
      const papel = papelDe(pc, ev.transceiver);
      const st = new MediaStream([ev.track]);
      // (0.7.6) a tela da captura direta chega num envio à parte (veja ligarTelaJogo); quando ela acaba, volta a valer o de sempre
      // (0.7.8) a volta é sempre para a trilha de sempre: guardar "a anterior" podia devolver uma já encerrada (trocar de modo com a tela ligada
      // emenda um envio no outro), e a trilha de sempre não pode cobrir a da captura direta (nos dois casos, tela preta)
      if (papel === 'tela' && par.tr.tela && ev.transceiver === par.tr.tela) par.telaBase = st;
      if (papel === 'tela' && par.tr.tela && ev.transceiver !== par.tr.tela) {
        par.rxJogo = ev.transceiver;
        ev.track.addEventListener('ended', () => { if (par.rxJogo !== ev.transceiver) return; par.rxJogo = null; par.midia.tela = par.telaBase || null; pintarTudo(); });
      }
      if (!(papel === 'tela' && par.rxJogo && ev.transceiver !== par.rxJogo)) par.midia[papel] = st;
      // (0.6.1) vídeo da chamada: um pouco mais de folga para segurar a imagem (~0,1 s). Dá tempo do pacote perdido chegar de novo antes de
      // a imagem ser montada, e ela não quebra a cada perdinha (no celular e no Wi-Fi é o que mais acontece)
      if (ev.track.kind === 'video') atrasoTela(par);
      if (papel === 'tela' && A.receptor) A.receptor.ligar(ev.receiver);
      if (papel === 'voz' || papel === 'somTela') ligarSom(par, papel, st);
      pintarTudo();
    };
    pc.onconnectionstatechange = () => {
      if (!ch || !ch.pares.has(par.chave)) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(par.conectarT); clearTimeout(par.caiuT); clearInterval(par.reT); par.reT = 0;
        if (par.caiuDesde) A.log.info('chamada: reconectou com', par.codigo, 'em', Math.round((Date.now() - par.caiuDesde) / 1000) + ' s');
        par.caiuDesde = 0; par.refez = false;
        if (ch.saindo) { ch.saindo = false; pararToque(); }
        if (!par.anunciado) { par.anunciado = true; if (!ch.anunciados) ch.anunciados = new Set(); if (!ch.anunciados.has(par.codigo)) { ch.anunciados.add(par.codigo); A.som.tocar(A.extras ? A.extras.somEntrou(par.codigo) : 'cham-entrou'); } } // (0.7.0) outra pessoa entrou
        if (!ch.inicio) ch.inicio = Date.now();
        clearTimeout(ch.sozinhoT);
      }
      if ((pc.connectionState === 'disconnected' || pc.connectionState === 'failed') && par.anunciado) recuperar(par);
      pintarTudo();
    };
    // (0.7.6) os canais do modo jogo (combinados dos dois lados, sem negociação: quem tem uma versão antiga só não usa): 'ctl' confiável
    // (pedidos, cliques, teclas) e 'ctl-r' sem retransmissão (movimento do mouse e controles: o atrasado já não serve)
    try {
      par.dc = pc.createDataChannel('ctl', { negotiated: true, id: 11 });
      par.dcR = pc.createDataChannel('ctl-r', { negotiated: true, id: 12, ordered: false, maxRetransmits: 0 });
      for (const c of [par.dc, par.dcR]) c.onmessage = (ev) => aoDadoCtl(par, ev.data);
      par.dc.onopen = () => { if (ch && ch.pares.get(par.chave) === par && ctlDeMim.size) difundirCtl(par); };
    } catch (_) { /* navegador sem canais de dados */ }
    par.camEl = h('video', { autoplay: true, playsinline: true, poster: SEM_POSTER }); par.camEl.muted = true;
    if (ch.ui) ch.ui.pessoas.append(tilePar(par));
    sujarCtl();
    return par;
  }
  // (0.7.4) A CONEXÃO CAIU (internet piscou, Wi-Fi trocou, o roteador mudou o caminho): antes, depois de 20 s a pessoa saía da chamada e só
  // um dos lados tentava refazer, e só quando o Chromium já tinha desistido (mais de 20 s). Era o "paro de ouvir ele e ele some da call".
  // Agora: em 2 s refaz o caminho (ICE) pelos dois lados, de novo a cada 5 s; com 12 s caída, refaz a conexão do zero; a pessoa só sai da lista
  // depois de 2 minutos sem voltar (ou quando ela sai de verdade: aí chega o aviso "sair")
  function recuperar(par) {
    if (par.caiuDesde) return;
    par.caiuDesde = Date.now();
    A.log.aviso('chamada: a conexão com', par.codigo, 'caiu (' + par.pc.connectionState + '): reconectando');
    const tentar = () => {
      if (!ch || ch.pares.get(par.chave) !== par || par.pc.connectionState === 'connected') { clearInterval(par.reT); par.reT = 0; return; }
      const t = Date.now() - par.caiuDesde;
      if (t > 120000) { clearInterval(par.reT); par.reT = 0; removerPar(par); vigiarSozinho(); return; }
      if (t > 12000 && !par.refez) { refazerPar(par); return; }
      if (par.pc.signalingState === 'stable') ofertar(par, true).catch(() => {});
      sinal(par.codigo, par.dev, { t: 'reconectar' }); // o outro lado também tenta (quem conseguir primeiro, vale)
    };
    clearTimeout(par.caiuT); par.caiuT = setTimeout(tentar, 2000);
    clearInterval(par.reT); par.reT = setInterval(tentar, 5000);
  }
  // refaz a conexão do zero com essa pessoa: a velha fecha e o "entrar" pede ao outro lado uma conexão nova (o som e a imagem voltam sozinhos)
  function refazerPar(par) {
    clearInterval(par.reT); par.reT = 0;
    A.log.aviso('chamada: refazendo a conexão com', par.codigo, 'do zero');
    const { codigo, dev } = par;
    if (API.turn) (ch.relayPara = ch.relayPara || new Set()).add(codigo); // a direta não deu: a conexão nova vai pelo retransmissor
    removerPar(par, { semSom: true });
    sinal(codigo, dev, { t: 'entrar', ...meuEstado() });
    vigiarSozinho();
  }
  CH._recuperar = recuperar; CH._paresReais = () => (ch ? [...ch.pares.values()] : []); // para os testes

  // o som dos amigos vai pelo mesmo caminho da sala (volume geral, vozes, transmissões e saída escolhida)
  // (0.8.7) Música junto: tocar a música de uma conversa durante a chamada deixa a chamada muda SÓ para você (o ganho de cada pessoa
  // aqui, no seu aparelho; nada muda para os outros nem no que você manda)
  let surdoMusica = false;
  const surdoEm = (s) => { if (!s || !s.gain) return; if (surdoMusica) { if (s._antes == null) s._antes = s.gain.gain.value; s.gain.gain.value = 0; } else if (s._antes != null) { s.gain.gain.value = s._antes; s._antes = null; } };
  CH.surdoMusica = (on) => { surdoMusica = !!on; if (ch) for (const par of ch.pares.values()) for (const s of Object.values(par.som || {})) surdoEm(s); };
  function ligarSom(par, papel, st) {
    if (par.som && par.som[papel]) par.som[papel].parar();
    par.som = par.som || {};
    const s = S() && S().audioExterno ? S().audioExterno(st, { tela: papel === 'somTela', codigo: par.codigo }) : null;
    if (s) { par.som[papel] = s; surdoEm(s); return; }
    const el = new Audio(); el.srcObject = st; el.play().catch(() => {}); // sem Web Audio: toca direto
    par.som[papel] = { medidor: null, parar: () => { el.srcObject = null; } };
  }
  async function ofertar(par, reiniciar) {
    par.ofertante = true;
    if (!par.tr.voz) {
      const m = minhas();
      par.tr.voz = par.pc.addTransceiver(m.voz || 'audio', { direction: 'sendrecv' }); A.codec.somRobusto(par.tr.voz);
      par.tr.cam = par.pc.addTransceiver(m.cam || 'video', { direction: 'sendrecv' });
      par.tr.tela = par.pc.addTransceiver(m.tela || 'video', { direction: 'sendrecv' });
      preferirTela(par.tr.tela);
      par.tr.somTela = par.pc.addTransceiver(m.somTela || 'audio', { direction: 'sendrecv' }); A.codec.somRobusto(par.tr.somTela);
      ligarTelaJogo(par);
    }
    await par.pc.setLocalDescription(await par.pc.createOffer(reiniciar ? { iceRestart: true } : undefined));
    sinal(par.codigo, par.dev, { t: 'oferta', sdp: par.pc.localDescription.sdp, ...meuEstado() });
  }
  function ligarTrilhas(par) { // quem recebe a oferta: põe as próprias trilhas nos transceptores que vieram nela, pela mesma ordem
    const m = minhas();
    for (const t of par.pc.getTransceivers()) {
      if (!t.receiver.track) continue;
      const papel = papelDe(par.pc, t);
      if (par.tr[papel]) continue;
      par.tr[papel] = t; t.direction = 'sendrecv'; t.sender.replaceTrack(m[papel]).catch(() => {});
      if (papel === 'tela') preferirTela(t);
      if (papel === 'voz' || papel === 'somTela') A.codec.somRobusto(t);
    }
    if (minhaTela() && par.tr.tela && !(par.pj && par.pj.senders.size)) { ligarTelaJogo(par); par.refazerOferta = true; } // (a oferta foi dessa pessoa: confirma o formato com uma minha)
  }
  // (0.6.0) a tela da chamada usa o codificador escolhido (placa = H.264 pela placa). Sem isto o Chromium ia de VP8, codificado pelo
  // PROCESSADOR: num iGPU Intel ou com um jogo aberto a tela virava "slideshow" (2-3 fps).
  function preferirTela(tr) { if (tr && A.gpu && A.codec) A.codec.preferir(tr, { pref: A.gpu.codecAtual() }); }
  // (0.6.8) o som na frente: a voz e o som da tela com prioridade alta, a tela com prioridade baixa (quando falta banda, a tela cede primeiro)
  function prioridades(par) {
    if (par.prioOk || !par.tr) return;
    let ok = true;
    for (const [papel, prio] of [['voz', 'high'], ['somTela', 'high'], ['tela', 'high'], ['cam', 'low']]) {
      const sd = par.tr[papel] && par.tr[papel].sender; if (!sd) { ok = false; continue; }
      try { const p = sd.getParameters(); if (!p.encodings || !p.encodings.length) { ok = false; continue; } p.encodings[0].priority = prio; p.encodings[0].networkPriority = prio; sd.setParameters(p).catch(() => {}); } catch (_) { ok = false; }
    }
    par.prioOk = ok;
  }
  // QUEM RECEBE: a imagem do H.264 da placa não se conserta sozinha depois de um pacote perdido (fica "derretida" até o próximo quadro
  // inteiro, que pode demorar muito). Viu perda na tela ou na câmera de alguém: pede a essa pessoa um quadro inteiro (no máximo a cada 3 s)
  async function vigiarPerda(par) {
    for (const papel of ['tela', 'cam']) {
      const tr = (papel === 'tela' && par.rxJogo) || (par.tr && par.tr[papel]); if (!tr || !tr.receiver || !par.midia[papel]) continue;
      let perdidos = null, h264 = false;
      try { const r = await tr.receiver.getStats(); r.forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') { perdidos = x.packetsLost || 0; const c = x.codecId && r.get(x.codecId); h264 = !!(c && /h264/i.test(c.mimeType || '')); } }); } catch (_) { continue; }
      if (perdidos == null || !h264) continue; // o VP8 já pede o quadro novo sozinho
      const ant = (par.perdidos || {})[papel]; (par.perdidos = par.perdidos || {})[papel] = perdidos;
      // (0.6.8) só numa perda de verdade (8+ pacotes em 2 s) e no máximo a cada 15 s: o quadro inteiro religa o codificador da placa (a tela
      // de quem envia trava um instante) e sai de uma vez (o som fica na fila atrás dele). Com a internet boa, uma perdinha à toa fazia isso
      // a cada poucos segundos: era a tela travando e o som travando logo depois
      // (1.0.3) pelo próprio WebRTC (RTCP) quando dá: o codificador de lá só solta um quadro inteiro, sem religar nada (no máximo a cada 8 s: o quadro inteiro é grande)
      if (ant != null && perdidos - ant >= 8 && Date.now() - (par.pediuQuadro || 0) > 8000) { par.pediuQuadro = Date.now(); pedirQuadro(par, papel, tr); }
    }
  }
  // (1.0.3) QUEM RECEBE pede um quadro inteiro: pelo WebRTC (RTCP PLI, pelo receptor da tela) ou, sem ele, pelo aviso antigo (quem envia religa
  // o envio: a imagem para um instante, então esse caminho continua raro, no máximo a cada 15 s)
  function pedirQuadro(par, papel, tr) {
    if (A.receptor && tr && A.receptor.pedirInteiro(tr.receiver)) return;
    if (Date.now() - (par.pediuQuadroSinal || 0) < 15000) return; par.pediuQuadroSinal = Date.now();
    sinal(par.codigo, par.dev, { t: 'quadro', papel });
  }
  // (0.7.6) QUEM RECEBE: tela toda verde é o decodificador de H.264 montando a imagem sem a referência (cada ponto zerado vira esse verde, e só
  // o que se mexe aparece, como o cursor). Vendo isso seguido, avisa quem envia (primeiro um quadro inteiro; se continuar, outro codificador)
  CH._amostraVerde = null; CH._telaVerde = (v) => telaVerde(v); // (para os testes)
  const telaVerde = (video) => (CH._amostraVerde ? CH._amostraVerde() : A.gpu.verdeParcial(video));
  function vigiarVerde(par) {
    const v = ch && ch.ui && ch.ui.palcoVideo;
    if (!v || !par.midia.tela || v.srcObject !== par.midia.tela) { par.verdeN = 0; return; }
    if (!telaVerde(v)) { par.verdeOk = (par.verdeOk || 0) + 1; if (par.verdeOk >= 10) par.verdeN = 0; return; } // (0.7.9) a imagem que pisca verde também conta: só 10 s limpos zeram
    par.verdeOk = 0; par.verdeN = (par.verdeN || 0) + 1;
    if (par.verdeN === 2 || par.verdeN === 4) { A.log.aviso('tela da chamada: imagem verde de', par.codigo); sinal(par.codigo, par.dev, { t: 'verde' }); }
    if (par.verdeN === 6 && !(par.pj && S().receptorProprio(par.pj.id)) && (CH._amostraVerde || A.gpu.imagemVerde(v))) A.gpu.decodificadorFalhou(); // nem o quadro inteiro nem o Baseline resolveram: é o decodificador deste PC
  }
  // (0.7.8) QUEM RECEBE: o vigia de tela preta que a sala já tinha (a chamada ficava preta até alguém sair e entrar de novo). Na ordem: um quadro
  // inteiro, religa o vídeo aqui, pede para refazer o envio só para esta pessoa e, se chegam dados mas nada vira imagem, é o decodificador deste
  // PC: outro formato ou, por último, o processador. Só com a imagem toda preta e quadros chegando (tela de carregamento?), não troca o decodificador
  CH._semImagem = null;
  async function vigiarPreto(par) {
    const v = ch && ch.ui && ch.ui.palcoVideo;
    if (!v || !par.tela || !par.midia.tela || v.srcObject !== par.midia.tela) { par.pretoN = 0; return; }
    if (v.paused) v.play().catch(() => {});
    const semImagem = CH._semImagem ? CH._semImagem() : v.videoWidth <= 16; // (16x16 é o quadrinho que marca o ritmo da captura direta, não a imagem)
    if (!semImagem && !(par.modo === 'jogo' && A.gpu.imagemPreta(v))) { par.pretoN = 0; return; }
    const trT = par.rxJogo || (par.tr && par.tr.tela);
    // (1.0.3) imagem preta com quadros novos saindo do decodificador é só uma cena escura do jogo (tela de carregamento, noite, menu): antes
    // isso pedia quadro inteiro, religava o vídeo e, em ~12 s, refazia o envio da tela inteira. Era o congelamento no meio do jogo
    if (!semImagem && !CH._semImagem) {
      let dec = -1; try { (await trT.receiver.getStats()).forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') dec = x.framesDecoded || 0; }); } catch (_) { /* sem números */ }
      const ctlR = A.receptor && A.receptor.de(trT.receiver), proprio = !!(ctlR && ctlR.proprio && ctlR.est.fps > 0);
      const anda = proprio || (dec >= 0 && par.pretoDec != null && dec > par.pretoDec); par.pretoDec = dec;
      if (anda) { par.pretoN = 0; return; }
    }
    const n = par.pretoN = (par.pretoN || 0) + 1;
    if (n % 2 === 0) pedirQuadro(par, 'tela', trT);
    if (n === 4) { const st = v.srcObject; v.srcObject = null; v.srcObject = st; v.play().catch(() => {}); }
    if (n === 6) sinal(par.codigo, par.dev, { t: 'telaPreta' });
    if (n === 8 || n === 10 || n === 14) {
      const tr = par.rxJogo || (par.tr && par.tr.tela); let bytes = 0, quadros = 0;
      try { (await tr.receiver.getStats()).forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') { bytes = x.bytesReceived || 0; quadros = x.framesDecoded || 0; } }); } catch (_) { return; }
      if (!semImagem || quadros > 0 || bytes < 300000) return;
      A.log.aviso('tela da chamada: chegam dados de', par.codigo, 'mas nenhuma imagem é decodificada');
      if (n === 14) { if (!(par.pj && S().receptorProprio(par.pj.id))) A.gpu.decodificadorFalhou(); } else sinal(par.codigo, par.dev, { t: 'verde' });
    }
  }
  function irVp8(par) { A.codec.preferir(par.tr.tela, { pref: 'vp8', semH264: true }); renegociar(par); }
  // QUEM ENVIA: um quadro inteiro na hora. Sem um comando para isso no navegador, a trilha dessa pessoa é desligada e religada num instante
  // (só para ela): o codificador recomeça com um quadro inteiro e a imagem dela volta limpa
  async function mandarQuadro(par, papel) {
    const s = papel === 'tela' && par.trJogo ? par.trJogo.sender : par.tr && par.tr[papel] && par.tr[papel].sender; if (!s || !s.track) return;
    if (Date.now() - (par.mandouQuadro || 0) < 12000) return; par.mandouQuadro = Date.now();
    try {
      if (typeof s.generateKeyFrame === 'function') { await s.generateKeyFrame(); return; }
      const p = s.getParameters(); if (!p.encodings || !p.encodings.length) return;
      p.encodings[0].active = false; await s.setParameters(p);
      const p2 = s.getParameters(); p2.encodings[0].active = true; await s.setParameters(p2);
    } catch (_) { /* tenta na próxima */ }
  }
  const trocar = (papel, trilha) => { for (const par of ch.pares.values()) if (par.tr[papel]) par.tr[papel].sender.replaceTrack(trilha).catch(() => {}); };
  async function soltarIce(par) { const l = par.ice.splice(0); for (const c of l) await par.pc.addIceCandidate(c).catch(() => {}); }
  function removerPar(par, { semSom = false } = {}) {
    clearTimeout(par.caiuT); clearTimeout(par.conectarT);
    soltarJogo(par);
    const tocouEntrar = par.anunciado || !!(ch && ch.anunciados && ch.anunciados.has(par.codigo));
    if (!semSom && ch && ch.anunciados) ch.anunciados.delete(par.codigo); // saiu de verdade: se voltar, o som de entrar toca de novo
    if (tocouEntrar && !semSom && ch && !ch.encerrando) A.som.tocar('cham-saiu'); // (0.7.0) outra pessoa saiu
    try { par.pc.close(); } catch (_) { /* já fechou */ }
    Object.values(par.som || {}).forEach((s) => s.parar());
    if (par.tile) par.tile.remove();
    const pessoa = participanteCtl(par.chave);
    ch.pares.delete(par.chave); sujarCtl();
    if (ctlDeMim.delete(par.chave)) { A.evt.emit('chctl:saiu', pessoa); difundirCtl(); }
    if (meuCtlCh && meuCtlCh.dono === par.chave) fimMeuCtl(false);
    if (par.tela) A.evt.emit('chamada:tela', false); // (0.9.6) quem compartilhava saiu: o fundo e os enfeites voltam
    pintarTudo();
  }

  // ---------- (0.7.6) MODO JOGO NA CHAMADA: os amigos jogam no seu computador, como na sala ----------
  // Quem compartilha no modo jogo é quem decide quem controla (pedido, aceitar, negar, revogar, pausa). Tudo vai direto entre os dois pelos
  // canais de dados da própria chamada (criptografados como a voz e a tela): o servidor não vê nem decide nada. Cada um só fala por si: um
  // pedido vale só para quem mandou, e a lista de quem controla só vale para a tela de quem a mandou. O controle em si (mouse, teclado,
  // controles, cadeado, cursores) é o mesmo da sala (entrada.js), que passa a ouvir a chamada enquanto ela está aberta (e não há sala).
  const meuId = () => eu().codigo + '/' + H.dev;
  const ctlDeMim = new Map(); // quem controla a MINHA tela: chave -> { st: 'pedindo' | 'ativo' | 'pausado', real }
  let meuCtlCh = null; // o MEU controle na tela de alguém: { dono: chave, st, real }
  const PERM = { gamepad: true, mouse: true, teclado: true };
  const ESTADOS = new Set(['pedindo', 'ativo', 'pausado']);
  let partes = null; // (guardado: o entrada.js consulta a cada mensagem)
  function sujarCtl() { partes = null; }
  function listaCtl() {
    if (partes) return partes;
    const l = [], m = new Map();
    if (ch) {
      l.push({ ...eu(), id: meuId(), nome: eu().nome, cor: corOk((A.cfg.v.entrada || {}).cor), perm: PERM, ctl: meuCtlCh, comp: !!ch.tela, modo: ch.modoTela });
      for (const par of ch.pares.values()) {
        const x = ctlDeMim.get(par.chave);
        l.push({ ...pessoaDe(par.codigo), id: par.chave, nome: nomeDe(par.codigo) || par.codigo, codigo: par.codigo, cor: par.cor || '', perm: PERM, ctl: x ? { dono: meuId(), st: x.st, real: !!x.real } : par.ctlOutro || null, comp: !!par.tela, modo: par.modo || 'tela' });
      }
    }
    for (const p of l) m.set(p.id, p);
    return (partes = { l, m });
  }
  const participanteCtl = (id) => listaCtl().m.get(id) || null;
  function enviarCtl(chave, obj, rapido) {
    const par = ch && ch.pares.get(chave); if (!par) return false;
    const c = rapido && par.dcR && par.dcR.readyState === 'open' ? par.dcR : par.dc;
    if (!c || c.readyState !== 'open') return false;
    try { c.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); return true; } catch (_) { return false; }
  }
  // o "lado" que o entrada.js usa enquanto a chamada está aberta (o mesmo jeito de falar da sala)
  const ctx = {
    sairControle: () => CH.sairControle(), // (0.7.9) Ctrl + Alt + F11
    prefixo: 'chctl:',
    get id() { return meuId(); },
    get participantes() { return listaCtl().l; },
    participante: participanteCtl,
    eu: () => participanteCtl(meuId()),
    meuCtl: () => meuCtlCh,
    enviarDC: (id, obj, { rapido = false } = {}) => enviarCtl(id, obj, rapido),
    pausarControle: (pausar) => pedirAoDono(pausar ? 'pausar' : 'retomar'),
    pedirReal: (v) => pedirAoDono('real', !!v),
    get local() { return { tela: ch ? ch.tela : null, modo: ch ? ch.modoTela : 'tela', superficie: ch ? ch.superficie : '' }; },
  };
  CH._ctx = ctx; // para os testes
  const garantirCtx = () => { const E = A.entrada; if (!E || !ch || (A.sala && A.sala.ativa)) return false; if (E.contexto() !== ctx) E.usar(ctx); return true; };
  A.evt.on('sala:estado', () => { if (A.sala.ativa && A.entrada && A.entrada.contexto() === ctx) A.entrada.usar(null); }); // entrou numa sala: o controle volta para ela
  A.evt.on('sala:estado', () => { if (A.sala.ativa && minhaTela()) { pararTela(); A.ui.toast(T('Você entrou numa sala: a tela da chamada parou.', 'You joined a room: the call screen share stopped.')); } }); // (a transmissão do modo jogo é uma só)
  A.evt.on('chamada:kms-fim', () => { if (!minhaTelaJogo()) return; A.ui.toast(T('A captura direta da placa parou. A transmissão continua pela captura normal.', 'Direct GPU capture stopped. The stream continues with normal capture.'), { ms: 6000 }); reiniciarTela(); });
  A.evt.on('sala:fechada', () => { if (ch) garantirCtx(); });

  // ----- quem assiste: pede, sai, pausa (a resposta vem na lista de quem compartilha) -----
  function mudouMeuCtl(novo) {
    const antes = meuCtlCh; if (JSON.stringify(antes) === JSON.stringify(novo)) return;
    meuCtlCh = novo; sujarCtl();
    for (const par of (ch ? ch.pares.values() : [])) atrasoTela(par); // (1.0.0) começou ou parou de controlar: a folga da imagem muda
    A.evt.emit('chctl:ctl-meu', { antes, depois: novo });
    pintarTudo();
  }
  function fimMeuCtl(negado) { if (!meuCtlCh) return; mudouMeuCtl(null); A.evt.emit('chctl:input-fim', { negado }); }
  function pedirAoDono(a, v) { if (meuCtlCh) enviarCtl(meuCtlCh.dono, { t: 'ctlp', a, v }); }
  CH.pedirControle = (chave) => {
    const par = ch && ch.pares.get(chave);
    if (!par || !par.tela || par.modo !== 'jogo') return;
    if (!garantirCtx()) { A.ui.toast(T('Saia da sala para controlar a tela de alguém na chamada.', 'Leave the room to control someone\'s screen on the call.')); return; }
    if (meuCtlCh && meuCtlCh.dono !== chave) CH.sairControle();
    if (meuCtlCh) return;
    if (!enviarCtl(chave, { t: 'ctlp', a: 'pedir' })) { A.ui.toast(T('A versão do app de quem compartilha ainda não aceita controle na chamada.', 'The sharer\'s app version does not accept control on calls yet.')); return; }
    mudouMeuCtl({ dono: chave, st: 'pedindo', real: false });
  };
  CH.sairControle = () => { if (!meuCtlCh) return; pedirAoDono('sair'); if (A.entrada && A.entrada.lock) A.entrada.sairLock('fim'); mudouMeuCtl(null); };
  CH.meuCtl = () => meuCtlCh;

  // ----- quem compartilha: decide -----
  const ctlPub = (chave) => { const x = ctlDeMim.get(chave); return x ? { dono: meuId(), st: x.st, real: !!x.real } : null; };
  function mudouCtl(chave, antes) {
    sujarCtl();
    const p = participanteCtl(chave); if (p) A.evt.emit('chctl:ctl', { p, antes, depois: ctlPub(chave) });
    difundirCtl(); pintarTudo();
  }
  function difundirCtl(so) {
    if (!ch) return;
    const msg = JSON.stringify({ t: 'ctlp', a: 'lista', l: [...ctlDeMim].map(([k, x]) => [k, x.st, x.real ? 1 : 0]) });
    for (const par of ch.pares.values()) if (!so || par === so) enviarCtl(par.chave, msg);
  }
  CH.decidirControle = (chave, acao) => {
    const x = ctlDeMim.get(chave); if (!x) return;
    const antes = ctlPub(chave);
    if (acao === 'aprovar') { if (x.st !== 'pedindo') return; x.st = 'ativo'; A.som.tocar('sucesso'); }
    else if (acao === 'negar' || acao === 'revogar') { ctlDeMim.delete(chave); enviarCtl(chave, { t: 'ctlp', a: 'fim', negado: acao === 'negar' ? 1 : 0 }); }
    else return;
    mudouCtl(chave, antes);
  };
  CH.sempreLiberar = (chave) => { const par = ch && ch.pares.get(chave); if (!par) return; const l = A.cfg.v.chamLivre || (A.cfg.v.chamLivre = {}); l[par.codigo] = 1; A.cfg.salvar(); CH.decidirControle(chave, 'aprovar'); };
  CH.pedidosCtl = () => [...ctlDeMim].filter(([, x]) => x.st === 'pedindo').map(([k]) => participanteCtl(k)).filter(Boolean);
  CH.controladores = () => [...ctlDeMim].filter(([, x]) => x.st !== 'pedindo').map(([k]) => participanteCtl(k)).filter(Boolean);
  // parou de compartilhar (ou voltou para o modo tela): todo mundo sai do controle e o que estava apertado é solto
  function encerrarCtlDeMim() {
    for (const k of [...ctlDeMim.keys()]) { const antes = ctlPub(k); ctlDeMim.delete(k); enviarCtl(k, { t: 'ctlp', a: 'fim', negado: 0 }); sujarCtl(); const p = participanteCtl(k); if (p) A.evt.emit('chctl:ctl', { p, antes, depois: null }); }
    A.evt.emit('chctl:local', { tela: false });
    difundirCtl(); pintarTudo();
  }
  function aoPedidoCtl(par, m) {
    if (!ch) return;
    const x = ctlDeMim.get(par.chave), antes = ctlPub(par.chave);
    if (m.a === 'pedir') {
      if (!ch.tela || ch.modoTela !== 'jogo' || !garantirCtx()) { enviarCtl(par.chave, { t: 'ctlp', a: 'fim', negado: 1 }); return; }
      if (x) { difundirCtl(par); return; } // já estava: só repete a lista para ele
      if (Date.now() - (par.pediuCtl || 0) < 2500) return; // (no máximo um pedido a cada 2,5 s)
      par.pediuCtl = Date.now();
      const livre = !!(A.cfg.v.chamLivre || {})[par.codigo];
      ctlDeMim.set(par.chave, { st: livre ? 'ativo' : 'pedindo', real: false });
      if (!livre) A.som.tocar('msg');
    } else if (!x) return;
    else if (m.a === 'sair') ctlDeMim.delete(par.chave);
    else if (m.a === 'pausar' && x.st === 'ativo') x.st = 'pausado';
    else if (m.a === 'retomar' && x.st === 'pausado') x.st = 'ativo';
    else if (m.a === 'real' && x.st !== 'pedindo') x.real = !!m.v;
    else return;
    mudouCtl(par.chave, antes);
  }
  // o que chega pelos canais: o protocolo do controle fica aqui; o resto (mouse, teclado, controles, cursores) vai para o entrada.js
  function aoDadoCtl(par, dados) {
    if (!ch || ch.pares.get(par.chave) !== par || typeof dados !== 'string' || dados.length > 16384) return;
    if (!dados.startsWith('{"t":"ctlp"')) { A.evt.emit('chctl:dc', { de: par.chave, dados }); return; }
    let m; try { m = JSON.parse(dados); } catch (_) { return; }
    if (m.a === 'lista' && Array.isArray(m.l)) {
      const l = m.l.slice(0, 16).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && ESTADOS.has(e[1]));
      for (const q of ch.pares.values()) if (q.ctlOutro && q.ctlOutro.dono === par.chave) q.ctlOutro = null;
      for (const e of l) { const q = ch.pares.get(e[0]); if (q) q.ctlOutro = { dono: par.chave, st: e[1], real: !!e[2] }; }
      sujarCtl();
      const meu = l.find((e) => e[0] === meuId());
      if (meu && par.tela && par.modo === 'jogo' && (!meuCtlCh || meuCtlCh.dono === par.chave)) { garantirCtx(); mudouMeuCtl({ dono: par.chave, st: meu[1], real: !!meu[2] }); }
      else if (meu && meuCtlCh && meuCtlCh.dono !== par.chave) enviarCtl(par.chave, { t: 'ctlp', a: 'sair' }); // (só controlo uma tela por vez)
      else if (!meu && meuCtlCh && meuCtlCh.dono === par.chave && meuCtlCh.st !== 'pedindo') fimMeuCtl(false);
      pintarTudo();
    } else if (m.a === 'fim') { if (meuCtlCh && meuCtlCh.dono === par.chave) fimMeuCtl(!!m.negado); }
    else aoPedidoCtl(par, m);
  }
  CH.modoTela = (v) => {
    v = v === 'jogo' ? 'jogo' : 'tela';
    A.cfg.v.chamadaModo = v; A.cfg.salvar();
    if (!ch || ch.modoTela === v) return;
    ch.modoTela = v; sujarCtl();
    if (ch.tela) { reiniciarTela(); return; } // (a captura e o caminho do vídeo mudam: recomeça na mesma tela)
    if (v === 'tela') encerrarCtlDeMim();
    else if (ch.tela) { garantirCtx(); if (A.entrada) A.entrada.avisarCapacidade(); }
    aplicarQualidade();
    avisarEstado(); pintarTudo();
  };

  // ---------- microfone, câmera, tela, desligar ----------
  CH.mudo = () => {
    if (!ch) return;
    ch.mudo = !ch.mudo;
    if (ch.mic) ch.mic.enabled = !ch.mudo;
    A.som.tocar(ch.mudo ? 'mic-off' : 'mic-on');
    avisarEstado(); pintarTudo();
  };
  CH.camera = async () => {
    if (!ch || !A.plat.camera) return;
    if (viva(ch.cam)) { ch.cam.stop(); ch.cam = null; }
    else { const v = await abrirCamera(); if (!v || !ch) return; ch.cam = v; }
    trocar('cam', viva(ch.cam));
    avisarEstado(); pintarTudo();
  };
  // (0.7.10) a qualidade é a mesma da sala: a escolha é uma só (A.gpu.presetUsuario) e o caminho do vídeo também
  CH._qualidade = () => A.gpu.presetUsuario(); // (para os testes)
  function aplicarQualidade() { if (ch && ch.tela && S().local.naChamada) S().atualizarPreset(A.gpu.presetUsuario()); }
  function opcoesTela(ancora) {
    const U = A.ui, cfg = A.cfg.v.host;
    const corpo = h('div', { class: 'col', estilo: { gap: '10px' } },
      h('div', { class: 'linha' }, h('i', { class: 'pt-estado' + (ch && ch.tela ? ' on' : '') }), h('b', {}, ch && ch.tela ? T('Compartilhando agora', 'Sharing now') : T('Você não está compartilhando', 'You are not sharing'))),
      U.btn(ch && ch.tela ? T('Trocar tela ou janela', 'Switch screen or window') : T('Compartilhar agora', 'Share now'), { icone: ch && ch.tela ? 'atualizar' : 'enviarTela', onclick: async () => { pop.fechar(); if (ch && ch.tela) pararTela(); await CH.tela(); } }),
      ch && ch.tela ? U.btn(T('Parar de compartilhar', 'Stop sharing'), { icone: 'parar', tipo: 'perigo', onclick: () => { pop.fechar(); pararTela(); } }) : null,
      h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Enviar o som do computador', 'Send computer sound')), h('div', { class: 'peq suave' }, T('Vídeos e jogos com som (sem o som do próprio Aero).', 'Videos and games with sound (without Aero\'s own sound).'))), U.chave(cfg.audio !== false, (v) => { cfg.audio = v; A.cfg.salvar(); refazerSom(); })),
      // (0.6.2) as mesmas escolhas de som da sala, aqui na setinha da tela: sem o som do Aero (padrão, evita eco) e sem o do Discord
      h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Não captar o som do Aero', 'Do not capture Aero sound')), h('div', { class: 'peq suave' }, T('Ninguém ouve a própria voz de volta.', 'Nobody hears their own voice back.'))), U.chave(S().semAero(), (v) => { cfg.semEcoAero = v; A.cfg.salvar(); refazerSom(); })),
      h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Não captar o som do Discord', 'Do not capture Discord sound')), h('div', { class: 'peq suave' }, T('Quem está na chamada não ouve a sua call do Discord.', 'People in the call do not hear your Discord call.'))), U.chave(S().semDiscord(), (v) => { cfg.semEcoDiscord = v; A.cfg.salvar(); refazerSom(); })),
      A.plat.desktop && A.mixer.appsCaptura ? U.btn(T('Aplicativos com som...', 'Apps with sound...'), { icone: 'volume', tipo: 'sec', peq: true, onclick: () => { pop.fechar(); abrirAppsSom(); } }) : null,
      h('div', { class: 'pop-sec' }, h('b', {}, T('Qualidade', 'Quality'))),
      ...A.gpu.seletoresQualidade(aplicarQualidade),
      // (0.7.6) o modo jogo da sala, na chamada: os amigos pedem para controlar a sua tela (mouse, teclado e controles)
      h('div', { class: 'pop-sec' }, h('b', {}, T('Modo', 'Mode'))),
      U.seg([['tela', T('Tela', 'Screen')], ['jogo', T('Jogo', 'Game')]], (ch && ch.modoTela) || (A.cfg.v.chamadaModo === 'jogo' ? 'jogo' : 'tela'), (v) => CH.modoTela(v)),
      h('div', { class: 'peq suave' }, T('No modo jogo, quem está na chamada pode pedir para jogar no seu computador (você aceita ou nega).', 'In game mode, people on the call can ask to play on your computer (you accept or deny).')));
    const pop = U.popover(ancora, corpo, { largura: 360, titulo: T('Compartilhar a tela', 'Share screen') });
  }

  // (0.7.3) "Aplicativos com som..." só montava a lista e não mostrava nada: agora abre numa janela, e marcar/desmarcar refaz o som da tela
  // da chamada na hora (antes ia para o som da sala, que não existe durante a chamada). Sem compartilhar, a escolha vale para a próxima vez
  function abrirAppsSom() {
    const apps = A.mixer.appsCaptura({ aoMudar: () => refazerSom() });
    A.ui.modal(T('Aplicativos com som', 'Apps with sound'), h('div', { class: 'col', estilo: { gap: '10px', 'min-width': 'min(380px, 80vw)' } }, apps.el),
      { largura: 440, acoes: [{ texto: T('Pronto', 'Done'), valor: true }], aoFechar: () => apps.parar() });
  }
  // (0.6.2) mudou uma escolha de som enquanto compartilha: refaz o som da tela na hora (só do que foi escolhido, sem o Aero/Discord se marcado)
  async function refazerSom() {
    const st = ch && ch.tela, cfg = A.cfg.v.host; if (!st) return;
    if (cfg.audio === false) { st.getAudioTracks().forEach((t) => { st.removeTrack(t); t.stop(); }); if (A.captura) A.captura.pararAudio(); trocar('somTela', null); return; }
    const r = A.captura ? await A.captura.iniciarAudio({ ids: cfg.appsCaptura || [], excluirAero: S().semAero(), excluirDiscord: S().semDiscord(), janela: null }).catch(() => null) : null;
    if (!ch || ch.tela !== st) { if (r && r.track) A.captura.pararAudio(); return; }
    if (r && r.track) { st.getAudioTracks().forEach((t) => { st.removeTrack(t); t.stop(); }); st.addTrack(r.track); S().local.audioNativo = true; trocar('somTela', r.track); return; }
    if (!st.getAudioTracks().length) A.ui.toast(T('Compartilhe a tela de novo para o som mudar.', 'Share the screen again for the sound to change.'), { ms: 4000 });
  }
  // compartilhar a tela: o mesmo seletor e o mesmo som por aplicativo da sala
  async function reiniciarTela() { const f = ch && ch.fonteTela; pararTela(); if (ch) await CH.tela(f); }
  CH.tela = async (fonteJa) => {
    if (!ch) return;
    if (ch.tela) return pararTela();
    const s = S();
    if (s.local.tela) { A.ui.toast(T('Você já está transmitindo numa sala. Pare lá antes de compartilhar na chamada.', 'You are already sharing in a room. Stop there before sharing on the call.')); return; }
    if (s.ativa) { A.ui.toast(T('Saia da sala para compartilhar a tela na chamada.', 'Leave the room to share your screen on the call.')); return; }
    if (!A.plat.podeCompartilhar) { A.ui.toast(T('Este aparelho não consegue compartilhar a tela.', 'This device cannot share its screen.')); return; }
    try {
      let fonte = fonteJa || { id: null };
      if (A.plat.desktop && !fonteJa) { fonte = await A.ui.escolherFonte(); if (!fonte) return; }
      ch.fonteTela = fonte;
      const cfg = A.cfg.v.host, opts = { fonteId: fonte.id, fonte: fonte.id ? fonte : null, audio: cfg.audio !== false };
      const st = await s.compartilharChamada({ ...opts, modo: ch.modoTela, preset: A.gpu.presetUsuario() });
      // (0.6.2) os avisos do som (ex.: "este Windows não separa o som do Aero, a tela vai sem som") aparecem também na chamada
      const offAviso = s.ativa ? null : A.evt.on('sala:aviso', (m) => A.ui.toast(m.msg, { tipo: 'erro', ms: 12000 }));
      try { await s.prepararAudioTela(st, { audio: cfg.audio !== false, apps: cfg.appsCaptura }); } finally { if (offAviso) offAviso(); }
      if (!ch) { st.getTracks().forEach((t) => t.stop()); s.pararChamada(); return; }
      const vt = st.getVideoTracks()[0]; vt.contentHint = 'motion';
      ch.superficie = (vt.getSettings && vt.getSettings().displaySurface) || (fonte.id && /^window:/.test(fonte.id) ? 'window' : ''); // (0.6.0) "detail" = modo de slides do WebRTC (só manda quadro quando muda e derruba o fps); vídeo e jogo precisam de movimento
      // (0.7.0) a captura terminou sem ninguém mandar parar (no Windows, o jogo trocou de resolução/tela cheia, a tela de UAC...): no app do PC
      // ela é retomada sozinha na mesma tela (sem abrir o seletor) em vez de a tela sumir para todo mundo
      const aoTerminar = (trilha) => trilha.addEventListener('ended', () => { if (ch && ch.tela === st) { A.log.aviso('tela da chamada: a captura terminou sozinha'); recuperarTela(st, fonte, aoTerminar); } });
      if (!s.local.kms) aoTerminar(vt);
      ch.tela = st; A.evt.emit('chamada:tela', true);
      // (0.7.0) o app do PC passa a saber que está transmitindo também na chamada (antes só na sala): prioridade na placa de vídeo e nos
      // processos de captura/codificação (Windows) e GameMode (Linux), como já era ao transmitir numa sala
      if (A.plat.desktop && window.aero && window.aero.gpu && window.aero.gpu.transmitindo) window.aero.gpu.transmitindo(true).catch(() => {}); // (0.6.8) os efeitos do fundo param enquanto compartilha (menos peso no PC)
      await Promise.all([...ch.pares.values()].map((par) => (par.tr.tela && !s.local.kms ? par.tr.tela.sender.replaceTrack(vt).catch(() => {}) : null)));
      if (!ch || ch.tela !== st) return;
      trocar('somTela', st.getAudioTracks()[0] || null);
      for (const par of ch.pares.values()) if (ligarTelaJogo(par)) renegociar(par);
      A.som.tocar('compartilhar');
      if (ch.modoTela === 'jogo') { garantirCtx(); if (A.entrada) A.entrada.avisarCapacidade(); }
      avisarEstado(); pintarTudo();
    } catch (e) { if (!ch || !ch.tela) s.pararChamada(); if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') A.ui.toast(e.message || String(e), { tipo: 'erro' }); }
  };
  async function recuperarTela(st, fonte, aoTerminar) {
    if (!ch || ch.tela !== st || ch.recuperandoTela) return;
    if (!A.plat.desktop || !fonte || !fonte.id) { pararTela(); return; }
    ch.recuperandoTela = true;
    try {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 700 + i * 700));
        if (!ch || ch.tela !== st) return;
        try {
          if (window.aero && window.aero.reusarFonte) await window.aero.reusarFonte();
          const novo = await S().capturarTela({ fonteId: fonte.id, fonte, preset: A.gpu.presetUsuario(), audio: false });
          const nv = novo.getVideoTracks()[0]; if (!nv) continue;
          if (!ch || ch.tela !== st) { nv.stop(); return; }
          nv.contentHint = 'motion';
          st.getVideoTracks().forEach((t) => { st.removeTrack(t); try { t.stop(); } catch (_) { /* ok */ } }); st.addTrack(nv);
          trocar('tela', nv); for (const par of ch.pares.values()) if (par.pj) S().aplicarQualidadePeer(par.pj);
          aoTerminar(nv); A.log.info('tela da chamada: captura retomada'); return;
        } catch (e) { A.log.aviso('tela da chamada: não deu para retomar', e && e.message); }
      }
      pararTela();
    } finally { if (ch) ch.recuperandoTela = false; }
  }
  function pararTela() {
    const st = ch && ch.tela; if (!st) return;
    ch.tela = null; A.evt.emit('chamada:tela', false);
    encerrarCtlDeMim();
    if (A.plat.desktop && window.aero && window.aero.gpu && window.aero.gpu.transmitindo) window.aero.gpu.transmitindo(false).catch(() => {});
    for (const par of ch.pares.values()) { if (par.pj && par.pj.senders.size) { desligarTelaJogo(par); renegociar(par); } acertarJogo(par); }
    st.getTracks().forEach((t) => t.stop());
    if (A.captura && S().local.audioNativo) A.captura.pararAudio();
    const s = S();
    s.pararChamada();
    if (window.aero && window.aero.protegerJanela && s.local.protegida) window.aero.protegerJanela(false).catch(() => {});
    s.local.protegida = false; s.local.audioNativo = false;
    trocar('tela', null); trocar('somTela', null);
    avisarEstado(); pintarTudo();
  }
  CH.desligar = () => {
    if (!ch) return;
    sinal('*', '', { t: 'sair' });
    encerrar(true);
  };
  function encerrar(som) {
    if (!ch) return;
    if (ch.tela) pararTela();
    if (meuCtlCh) CH.sairControle();
    if (A.entrada && A.entrada.contexto() === ctx) { A.evt.emit('chctl:fechada'); A.entrada.usar(null); }
    ctlDeMim.clear(); meuCtlCh = null;
    const c = ch; ch = null; CH.ativa = null; sujarCtl();
    // toda saída avisa o servidor (desligar, recusada, erro): senão a conversa ficava com uma "chamada em andamento" fantasma
    if (c.noServidor) avisarServidor(c.saindo && !c.pares.size ? 'cancelar' : 'sair', {}, c).catch(() => {}); // ninguém atendeu: para de tocar nos outros
    pararToque();
    c.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); clearTimeout(c.sozinhoT);
    for (const par of c.pares.values()) { try { par.pc.close(); } catch (_) { /* ok */ } Object.values(par.som || {}).forEach((s) => s.parar()); }
    [c.mic, c.cam].forEach((t) => t && t.stop());
    largarMic();
    if (c.ui) { c.ui.limpar(); const el = c.ui.el; el.classList.add('saindo'); setTimeout(() => el.remove(), 320); document.documentElement.removeAttribute('data-cham-max'); document.documentElement.removeAttribute('data-cham-jogo'); }
    if (som) A.som.tocar('cham-sai'); // (0.7.0) o som de sair
    A.evt.emit('chamada:fim');
  }
  // (0.6.9) o servidor tirou um aparelho da chamada (o app dele fechou, a internet caiu): ele sai da tela na hora, com a tela compartilhada
  // dele (antes ficava a imagem parada por até 20 s, até a conexão direta desistir)
  A.evt.on('hub:chamada-estado', (e) => {
    if (!ch || !e || e.cid !== ch.cid || !e.cham || e.cham.id !== ch.id || !Array.isArray(e.cham.devs)) return;
    const devs = new Set(e.cham.devs);
    for (const par of [...ch.pares.values()]) if (par.dev && !devs.has(par.dev) && Date.now() - (par.criado || 0) > 8000) { removerPar(par); vigiarSozinho(); }
  });
  // (0.6.9) o app está fechando: avisa que saiu, para a tela e fecha as conexões na hora (os outros não ficam com a tela parada na frente)
  CH.saidaRapida = () => {
    if (!ch) return;
    sinal('*', '', { t: 'sair' });
    if (ch.noServidor) avisarServidor('sair', {}, ch).catch(() => {});
    try { if (ch.tela) ch.tela.getTracks().forEach((t) => t.stop()); } catch (_) { /* ok */ }
    for (const par of ch.pares.values()) { try { par.pc.close(); } catch (_) { /* ok */ } }
  };
  // (0.6.0) a chamada é do APARELHO: entrei nela por outro aparelho da mesma conta, e o servidor avisou ESTE aparelho; ele sai sem derrubar o outro
  A.evt.on('hub:chamada-trocou', (e) => { if (!ch || ch.cid !== e.cid || ch.id !== e.id) return; A.ui.toast(T('A chamada continuou no seu outro aparelho.', 'The call moved to your other device.'), { ms: 4000 }); ch.noServidor = false; CH.desligar(); });
  // saiu da conta: a chamada desta conta acaba aqui
  CH.encerrarTudo = () => { if (ch) CH.desligar(); if (tocando) fecharTocando(); };

  // ---------- quem está falando (a bolha acende) ----------
  const nivelDe = (an) => { if (!an) return 0; const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let s2 = 0; for (const v of d) { const x = (v - 128) / 128; s2 += x * x; } return Math.sqrt(s2 / d.length); };
  // (0.7.1) a fala tem pausas entre as sílabas: medindo um instante só, a bolinha verde piscava ou nem acendia. Agora ela fica acesa
  // até meio segundo depois do último som (como no Discord)
  const SEGURA_FALA = 500;
  const falouAgora = (chave, sim) => { if (!ch) return false; const f = ch.falou || (ch.falou = {}); if (sim) f[chave] = Date.now(); return Date.now() - (f[chave] || 0) < SEGURA_FALA; };
  // (1.0.1) o ruído de fundo constante (ventilador, supressão desligada) passava do limite fixo e a pessoa ficava "falando" para sempre
  // (o anel de fala não parava mais). Agora cada um tem um piso que acompanha o ruído (desce na hora, sobe devagar) e só conta som acima dele
  const pisoFala = (chave, v, folga) => {
    const p = ch.pisos || (ch.pisos = {});
    const atual = p[chave] == null ? v : v < p[chave] ? v : p[chave] + (v - p[chave]) * 0.01;
    p[chave] = atual;
    return v > atual * folga[0] + folga[1];
  };
  const marcarFala = (el, on) => { if (!el) return; if (A.extras && A.extras.fala) A.extras.fala(el, on); else el.classList.toggle('falando', on); };
  function medirFalas() {
    if (!ch || !ch.ui) return;
    for (const par of ch.pares.values()) {
      const v = nivelDe(par.som && par.som.voz && par.som.voz.medidor);
      const on = falouAgora(par.chave, !par.mudo && v > 0.025 && pisoFala(par.chave, v, [1.8, 0.008])) && !par.mudo;
      marcarFala(par.tile, on); par.falando = on;
      // (1.0.2) o volume acima do ruído (0 a 1) vai para o anel de fala, que brinca com ele
      if (A.extras && A.extras.volume) A.extras.volume(par.codigo, on ? Math.sqrt(Math.max(0, Math.min(1, (v - ((ch.pisos && ch.pisos[par.chave]) || 0) * 1.8 - 0.008) / 0.13))) : 0);
    }
    const v = A.mic.ativo ? A.mic.nivel() : 0;
    ch.euFalando = falouAgora('eu', !ch.mudo && A.mic.ativo && v > 0.45 && pisoFala('eu', v, [1, 0.1]) && A.mic.aberto) && !ch.mudo;
    marcarFala(ch.ui.euTile, ch.euFalando);
    // (1.0.2) a foto grande no palco (quem você pôs em destaque, sem câmera): fala junto com a janelinha da pessoa
    const pa = ch.ui.palcoAtual, pf = !!(pa && pa.tipo === 'foto' && (pa.eu ? ch.euFalando : ch.pares.has(pa.chave) && ch.pares.get(pa.chave).falando));
    if (ch.ui.palcoAv && pf !== ch.ui.palcoAv.classList.contains('falando')) marcarFala(ch.ui.palcoAv, pf);
    if (ch.ui.cantoEls && ch.ui.cantoEls.size) for (const [id, el] of ch.ui.cantoEls) { const par = ch.pares.get(id.split('|')[0]), f = !!(par && par.falando); if (f !== el.classList.contains('falando')) el.classList.toggle('falando', f); } // (1.0.2) quem fala, no cantinho
    if (A.extras && A.extras.volume) A.extras.volume(eu().codigo, ch.euFalando ? Math.max(0, Math.min(1, (v - Math.max(0.45, ((ch.pisos && ch.pisos.eu) || 0) + 0.1)) / 0.32)) : 0);
  }
  // qualidade da conexão (o "sinal" da barra). (0.8.4) Não é mais o pior tempo de ida e volta entre todo mundo (a internet ruim de uma
  // pessoa deixava o sinal de todos vermelho): é o SEU — com quem você está vendo em destaque ou a tela compartilhada, senão a sua melhor conexão
  // (0.8.3) roda a cada 1 s (o número de ms fica à vista, sem passar o mouse); as conferências mais pesadas continuam a cada 2 s
  // (0.8.7) o SEU ms: o tempo da sua internet até o servidor mais perto (o tempo entre duas pessoas é o mesmo dos dois lados, então cada um
  // mostrava o mesmo número). Mede a cada 2 s, usa o menor das últimas 3 medidas (tira os picos) e conta aos outros quando muda
  let pingN = 0, pingVoando = false, msAvisado = 0, msAvisadoEm = 0;
  async function medirMeuMs() {
    if (!ch || pingVoando) return; pingN++; // (0.9.3) mede a cada 1 s (antes a cada 2 s)
    pingVoando = true; const c = ch;
    try {
      // (1.0.0) no navegador o relógio da página atrasa (aba ocupada desenhando o vídeo, aba em segundo plano) e o ms pulava para 500;
      // agora vale o tempo de rede que o próprio navegador anota da requisição (Resource Timing), sem a espera da página
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000), t0 = performance.now(), u = API.servidor + '/ping?n=' + pingN;
      const r = await fetch(u, { cache: 'no-store', signal: ctl.signal }); clearTimeout(to);
      if (!r.ok && r.status !== 204) throw new Error('ping ' + r.status);
      let v = performance.now() - t0;
      try {
        await r.arrayBuffer(); // (a anotação do navegador só aparece depois de ler a resposta)
        const e = performance.getEntriesByName(new URL(u, location.href).href).pop();
        if (e) { const ini = e.requestStart || e.fetchStart, fim = e.responseStart || e.responseEnd; if (ini > 0 && fim > ini) v = Math.min(v, fim - ini); }
        if (pingN % 50 === 0 && performance.getEntriesByType('resource').length > 200) performance.clearResourceTimings(); // a lista não enche (cheia, o navegador para de anotar)
      } catch (_) { /* fica a medida de antes */ }
      c.pings = [...(c.pings || []).slice(-2), v];
    } catch (_) { c.pings = [...(c.pings || []).slice(-2), 4000]; }
    finally { pingVoando = false; }
    if (ch !== c) return;
    c.meuMs = Math.max(1, Math.round(Math.min(...c.pings)));
    if (Math.abs(c.meuMs - msAvisado) >= 3 || (c.meuMs !== msAvisado && Date.now() - msAvisadoEm > 2000)) /* (0.9.3) a outra pessoa vê o seu ms quase na hora */ { msAvisado = c.meuMs; msAvisadoEm = Date.now(); if (c.pares.size) sinal('*', '', { t: 'ms', v: c.meuMs }); }
  }
  let sinalN = 0;
  async function medirSinal() {
    medirMeuMs();
    if (!ch || !ch.ui) return;
    let melhor = 0; const pesado = (sinalN++ & 1) === 0;
    for (const par of ch.pares.values()) {
      if (par.pc.connectionState !== 'connected') continue;
      try { const r = await par.pc.getStats(); r.forEach((x) => { if (x.type === 'candidate-pair' && x.nominated && x.currentRoundTripTime != null) par.rtt = x.currentRoundTripTime * 1000; }); } catch (_) { /* ok */ }
      if (pesado) { if (ch && ch.tela) prioridades(par); vigiarPerda(par); vigiarVerde(par); vigiarPreto(par); } // (só com a tela no ar, como antes)
      if (par.rtt && (!melhor || par.rtt < melhor)) melhor = par.rtt;
    }
    if (!ch || !ch.ui) return;
    const ok = (par) => par && par.pc.connectionState === 'connected' && par.rtt;
    const telas = [...ch.pares.values()].filter((par) => par.tela && ok(par));
    const vendo = ok(ch.pares.get(ch.foco)) ? ch.pares.get(ch.foco) : telas.length === 1 ? telas[0] : null;
    ch.rttVendo = vendo ? vendo.rtt : melhor; // (o tempo entre as pessoas continua valendo por dentro)
    const meu = ch.meuMs || 0, b = ch.ui.bSinal;
    b.dataset.nivel = nivelMs(meu);
    b.title = meu ? T('Sua conexão: ', 'Your connection: ') + meu + ' ms' : T('Sua conexão', 'Your connection');
    const ms = meu ? meu + ' ms' : '';
    if (ch.ui.msEl.textContent !== ms) ch.ui.msEl.textContent = ms;
  }

  // ---------- a interface ----------
  const fmt = (ms) => { const s = Math.floor(ms / 1000); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
  // o tamanho do avatar da chamada vem do CSS (pequeno na sua prévia, no PiP e no celular): sem o --t fixo no próprio elemento
  const semTamanho = (av) => { av.style.removeProperty('--t'); return av; };
  function tile(pessoa, { eu: ehEu, videoEl } = {}) {
    const quadro = h('div', { class: 'cham-quadro' }, videoEl || null, h('div', { class: 'cham-av' }, semTamanho(A.ui.avatar(pessoa, 96))), h('span', { class: 'cham-mudo', title: T('Microfone desligado', 'Microphone off') }, A.icone('micOff', 16)));
    const el = h('div', { class: 'cham-tile' + (ehEu ? ' eu' : '') }, quadro,
      h('div', { class: 'cham-nome' }, h('span', {}, ehEu ? T('Você', 'You') : nomeDe(pessoa.codigo) || pessoa.nome), h('span', { class: 'cham-pontos' }, h('i'), h('i'), h('i'))));
    return A.extras ? A.extras.marcarChamada(el, pessoa.codigo) : el; // (1.0.0) o anel de fala e a moldura da câmera da pessoa (só aqui, em quem vê)
  }
  function tilePar(par) {
    par.tile = tile(pessoaDe(par.codigo), { videoEl: par.camEl });
    par.tile.querySelector('.cham-quadro').append(h('span', { class: 'cham-tile-ms', 'aria-live': 'off' })); pintarMsPar(par); // (0.8.7) o ms dela, na janelinha dela
    // volume desta pessoa só para você (fica guardado pela conta dela)
    par.tile.addEventListener('contextmenu', (ev) => { ev.preventDefault(); volumePessoa(par, par.tile); });
    par.tile.querySelector('.cham-quadro').addEventListener('click', () => CH.focar(par.chave)); // como no Discord: um clique põe a pessoa em destaque
    return par.tile;
  }
  function volumePessoa(par, ancora) {
    const s = par.som && par.som.voz; if (!s || !s.volume) return;
    const v = h('b', {}, s.volume() + '%');
    const sl = A.ui.slider({ min: 0, max: 200, valor: s.volume(), oninput: (x) => { s.volume(x); v.textContent = x + '%'; } });
    // (0.9.6) o que a sala tinha e a chamada não: a linha com a qualidade da tela que chega e o botão para pedir outro formato de vídeo
    // (só o que VOCÊ recebe dessa pessoa muda; a transmissão dela para os outros continua igual)
    const telaInfo = par.tela ? h('div', { class: 'peq suave selecionavel' }, T('Medindo a tela...', 'Measuring the screen...')) : null;
    const trocar = par.tela ? A.ui.btn(T('Imagem com defeito? Trocar formato', 'Broken picture? Switch format'), { peq: true, tipo: 'sec', onclick: () => {
      sinal(par.codigo, par.dev, { t: 'jogo', d: { codecFalhou: (par.pj && par.pj.codecRecebido) || 'manual', motivo: 'manual' } });
      if (par.pj) par.pj.avisouCodec = true;
      A.ui.toast(T('Pedi outro formato de vídeo. A imagem volta em alguns segundos.', 'Asked for another video format. The picture comes back in a few seconds.'));
    } }) : null;
    A.ui.popover(ancora, h('div', { class: 'col', estilo: { gap: '8px' } }, h('div', { class: 'linha entre' }, h('span', {}, T('Volume para você', 'Volume for you')), v), sl, telaInfo, trocar), { largura: 300, titulo: nomeDe(par.codigo) });
    if (telaInfo) {
      let antes = null;
      const medir = async () => {
        if (!telaInfo.isConnected || !ch || ch.pares.get(par.chave) !== par) { clearInterval(t); return; }
        try {
          const r = await par.pc.getStats(); let vid = null, cp = null; const cand = new Map();
          r.forEach((x) => {
            if (x.type === 'inbound-rtp' && x.kind === 'video' && (!vid || (x.bytesReceived || 0) > (vid.bytesReceived || 0))) vid = x;
            if (x.type === 'candidate-pair' && (x.nominated || x.selected) && x.state === 'succeeded') cp = x;
            if (x.type === 'local-candidate' || x.type === 'remote-candidate') cand.set(x.id, x);
          });
          if (!vid) return;
          const mbps = antes ? Math.max(0, ((vid.bytesReceived - antes.b) * 8) / ((vid.timestamp - antes.t) * 1000)) : 0; antes = { b: vid.bytesReceived, t: vid.timestamp };
          const ms = cp && cp.currentRoundTripTime != null ? Math.round(cp.currentRoundTripTime * 1000) : null;
          const rele = cp && [cand.get(cp.localCandidateId), cand.get(cp.remoteCandidateId)].some((c) => c && c.candidateType === 'relay');
          telaInfo.textContent = [Math.round(vid.framesPerSecond || 0) + ' fps', vid.frameWidth ? vid.frameWidth + '×' + vid.frameHeight : null, mbps.toFixed(1) + ' Mbps', ms != null ? ms + ' ms' : null, cp ? (rele ? T('via retransmissor', 'via relay') : T('direto', 'direct')) : null].filter(Boolean).join(' · ');
        } catch (_) { /* a conexão fechou */ }
      };
      const t = setInterval(medir, 1000); medir();
    }
  }
  // (0.7.2) o volume de uma pessoa a partir de outro lugar (botão direito na foto dela na faixa da chamada do chat)
  // (0.9.1) no Android, vídeo ainda sem imagem mostrava o "play" cinza gigante do sistema (ex.: ao sair e voltar para a chamada); agora fica
  // transparente e a tela aparece assim que chega o primeiro quadro. Tudo só em quem assiste: nada muda na transmissão de quem compartilha
  function tocarQuandoChegar(v, st) {
    const t = st && st.getVideoTracks()[0]; if (!t) return;
    const ir = () => { if (v.srcObject === st && v.paused) v.play().catch(() => {}); };
    t.addEventListener('unmute', ir);
    setTimeout(() => { if (v.srcObject === st && v.readyState < 2 && t.readyState === 'live') { v.srcObject = null; v.srcObject = st; v.play().catch(() => {}); } }, 2500);
  }
  CH.volumePessoa = (codigo, ancora) => { const par = ch && [...ch.pares.values()].find((p) => p.codigo === codigo); if (par) volumePessoa(par, ancora); return !!par; };
  // quem aparece grande (o "palco"):
  //  - a pessoa que você clicou (como no Discord): a tela dela se estiver compartilhando, senão a câmera, senão a foto; clicar de novo volta;
  //  - sem ninguém escolhido: a tela compartilhada mais recente (de alguém, ou a sua se só você compartilha).
  CH.focar = (chave) => {
    if (!ch) return;
    ch.foco = ch.foco === chave ? null : chave; ch.semAuto = false; zoomReset();
    A.som.tocar(ch.foco ? 'abrir' : 'fechar'); pintarTudo();
  };
  const temVideo = (st) => !!(st && st.getVideoTracks().some((t) => t.readyState === 'live'));
  function quemNoPalco() {
    const doPar = (par) => {
      if (par.tela && temVideo(par.midia.tela)) return { st: par.midia.tela, nome: T('Tela de ', 'Screen of ') + nomeDe(par.codigo), tipo: 'tela', chave: par.chave };
      if (par.cam && temVideo(par.midia.cam)) return { st: par.midia.cam, nome: nomeDe(par.codigo), tipo: 'cam', chave: par.chave, aj: par.aj };
      return { st: null, pessoa: pessoaDe(par.codigo), nome: nomeDe(par.codigo), tipo: 'foto', chave: par.chave };
    };
    const meu = () => {
      if (ch.tela && S().local.kms) return { st: S().previewSeguro() ? S().streamPrevia() : null, nome: T('Você está transmitindo direto da placa', 'You are streaming straight from the GPU'), tipo: 'tela', eu: true }; // (o quadrinho que vai na trilha não é a imagem)
      if (ch.tela) return { st: new MediaStream(ch.tela.getVideoTracks()), nome: T('Você está compartilhando a tela', 'You are sharing your screen'), tipo: 'tela', eu: true };
      const c = viva(ch.cam); if (c) return { st: new MediaStream([c]), nome: T('Você', 'You'), tipo: 'cam', eu: true };
      return { st: null, pessoa: eu(), nome: T('Você', 'You'), tipo: 'foto', eu: true };
    };
    if (ch.foco === 'eu') return { ...meu(), foco: true };
    if (ch.foco && ch.pares.has(ch.foco)) return { ...doPar(ch.pares.get(ch.foco)), foco: true };
    if (ch.foco) ch.foco = null; // a pessoa saiu da chamada
    if (ch.semAuto) return null;
    const remotas = [...ch.pares.values()].filter((p) => p.tela && temVideo(p.midia.tela)).sort((a, b) => b.telaDesde - a.telaDesde);
    if (remotas.length) return doPar(remotas[0]);
    if (ch.tela) return meu();
    return null;
  }
  // zoom no palco (roda do mouse, arrastar para mover, botões; duplo clique = tela cheia)
  const zoom = { z: 1, x: 0, y: 0 };
  function zoomReset() { zoom.z = 1; zoom.x = 0; zoom.y = 0; aplicarZoom(); }
  function aplicarZoom() {
    if (!ch || !ch.ui) return;
    const lim = (v) => Math.max(-50 * (zoom.z - 1), Math.min(50 * (zoom.z - 1), v)); // não deixa a imagem sair do quadro
    zoom.x = lim(zoom.x); zoom.y = lim(zoom.y);
    ch.ui.palcoMidia.style.transform = zoom.z > 1 ? `scale(${zoom.z}) translate(${zoom.x / zoom.z}%, ${zoom.y / zoom.z}%)` : '';
    ch.ui.palco.classList.toggle('com-zoom', zoom.z > 1);
    ch.ui.zoomTxt.textContent = Math.round(zoom.z * 100) + '%';
  }
  CH.zoom = (fator) => { zoom.z = Math.max(1, Math.min(5, fator === 0 ? 1 : zoom.z * fator)); if (zoom.z === 1) { zoom.x = 0; zoom.y = 0; } aplicarZoom(); };

  // gira e espelha o <video> da câmera; girado de lado, aumenta (quadrinhos, cobrindo) ou diminui (palco, cabendo inteiro) para ocupar o quadro
  function ajustarVideo(el, aj, espelhoLocal, cobrir) {
    const a = ajOk(aj), sx = (a.h !== !!espelhoLocal) ? -1 : 1, sy = a.v ? -1 : 1;
    let k = 1;
    if (a.r % 180) { const w = el.clientWidth, hh = el.clientHeight; if (w && hh) k = cobrir ? Math.max(w / hh, hh / w) : Math.min(w / hh, hh / w); }
    const t = !a.r && sx === 1 && sy === 1 ? 'none' : `rotate(${a.r}deg) scale(${sx * k}, ${sy * k})`;
    if (el.style.transform !== t) el.style.transform = t;
  }
  // (1.0.2) O CANTINHO: com uma tela grande no palco, as câmeras de quem está na chamada ficam num cantinho por cima dela (como no Discord).
  // Dá para arrastar: da fila de pessoas para a tela (põe no canto, inclusive a tela de alguém quando é uma câmera que está grande), do canto
  // de volta para a fila (fica só lá embaixo) e de um lugar do canto para outro (a ordem). Vale só para você, nesta chamada
  const cantoDe = () => ch.canto || (ch.canto = { ordem: [], dentro: new Set(), fora: new Set() });
  function itensCanto(p) {
    if (!p || p.tipo === 'foto' || ch.modo !== 'max') return [];
    const c = cantoDe(), l = [];
    for (const par of ch.pares.values()) {
      for (const tipo of ['cam', 'tela']) {
        const st = tipo === 'cam' ? (par.cam && temVideo(par.midia.cam) ? par.midia.cam : null) : (par.tela && temVideo(par.midia.tela) ? par.midia.tela : null);
        if (!st || (!p.eu && p.chave === par.chave && p.tipo === tipo)) continue; // o que já está grande não vai para o canto
        const id = par.chave + '|' + tipo;
        if (c.fora.has(id) || (!(tipo === 'cam' && p.tipo === 'tela') && !c.dentro.has(id))) continue; // sozinhas, só as câmeras por cima de uma tela
        l.push({ id, par, tipo, st });
      }
    }
    const pos = (x) => { const i = c.ordem.indexOf(x.id); return i < 0 ? 1e6 : i; };
    return l.sort((a, b) => pos(a) - pos(b));
  }
  CH.itemArrastavel = (par) => { // da fila: a tela da pessoa (se não for ela que está grande), senão a câmera
    const p = ch && ch.ui && ch.ui.palcoAtual; if (!par || !p) return '';
    const grande = (tipo) => !p.eu && p.chave === par.chave && p.tipo === tipo;
    if (par.tela && temVideo(par.midia.tela) && !grande('tela')) return par.chave + '|tela';
    if (par.cam && temVideo(par.midia.cam) && !grande('cam')) return par.chave + '|cam';
    return '';
  };
  CH.moverCanto = (id, onde, antesDe) => { // onde: 'canto' ou 'fila'
    if (!ch || !id) return; const c = cantoDe();
    c.ordem = c.ordem.filter((x) => x !== id);
    if (onde === 'fila') { c.fora.add(id); c.dentro.delete(id); } else {
      c.fora.delete(id); c.dentro.add(id);
      const vis = itensCanto(ch.ui && ch.ui.palcoAtual).map((x) => x.id).filter((x) => x !== id);
      for (const x of vis) if (!c.ordem.includes(x)) c.ordem.push(x); // a ordem que está na tela passa a valer
      const i = antesDe ? c.ordem.indexOf(antesDe) : -1;
      if (i >= 0) c.ordem.splice(i, 0, id); else c.ordem.push(id);
    }
    pintarTudo();
  };
  function pintarCanto(p) {
    const ui = ch.ui, cx = ui.canto; if (!cx) return;
    const itens = itensCanto(p), vivos = new Set(itens.map((x) => x.id));
    for (const [id, el] of ui.cantoEls) if (!vivos.has(id)) { const v = el.querySelector('video'); if (v) v.srcObject = null; el.remove(); ui.cantoEls.delete(id); }
    let anterior = null;
    for (const it of itens) {
      let el = ui.cantoEls.get(it.id);
      if (!el) {
        const v = h('video', { autoplay: true, playsinline: true, poster: SEM_POSTER }); v.muted = true;
        el = h('div', { class: 'cham-canto-item', draggable: 'true', 'data-id': it.id, 'data-tipo': it.tipo, title: T('Arraste para mudar a ordem, ou para a fila embaixo para tirar daqui', 'Drag to reorder, or to the row below to remove it from here') },
          v, h('span', { class: 'cham-canto-nome' }));
        el.addEventListener('click', () => CH.focar(it.par.chave));
        ui.cantoEls.set(it.id, el);
      }
      const v = el.querySelector('video');
      if (v.srcObject !== it.st) { v.srcObject = it.st; v.play().catch(() => {}); }
      if (it.tipo === 'cam') ajustarVideo(v, it.par.aj, false, true); else if (v.style.transform) v.style.transform = '';
      const nome = it.tipo === 'tela' ? T('Tela de ', 'Screen of ') + nomeDe(it.par.codigo) : nomeDe(it.par.codigo);
      const n = el.querySelector('.cham-canto-nome'); if (n.textContent !== nome) n.textContent = nome;
      el.classList.toggle('falando', !!it.par.falando);
      if ((anterior ? anterior.nextElementSibling : cx.firstElementChild) !== el) { if (anterior) anterior.after(el); else cx.prepend(el); }
      anterior = el;
    }
    cx.hidden = !itens.length;
    // na fila de baixo, quem está com a câmera no canto aparece com a foto (a câmera não fica repetida)
    for (const par of ch.pares.values()) if (par.tile) {
      const comVideo = !!(par.cam && temVideo(par.midia.cam));
      par.tile.classList.toggle('com-video', comVideo && !vivos.has(par.chave + '|cam'));
      par.tile.draggable = !!CH.itemArrastavel(par);
    }
  }
  function pintarVideos() {
    if (!ch || !ch.ui) return;
    for (const par of ch.pares.values()) if (par.camEl) ajustarVideo(par.camEl, par.aj, false, true);
    ajustarVideo(ch.ui.euVideo, ajCam(), true, true);
    const p = ch.ui.palcoAtual;
    if (p && p.tipo === 'cam') ajustarVideo(ch.ui.palcoVideo, p.eu ? ajCam() : p.aj, !!p.eu, false);
    else if (ch.ui.palcoVideo.style.transform) ch.ui.palcoVideo.style.transform = '';
  }
  CH.ajusteCamera = (mudar) => {
    A.cfg.v.camAjuste = ajOk({ ...ajCam(), ...mudar }); A.cfg.salvar();
    if (ch) { avisarEstado(); pintarVideos(); }
  };
  // (1.0.3) QUEM TRANSMITE: a prévia da própria tela só anda com o Aero à vista. Com o jogo na frente ela era desenhada a 60 fps mesmo assim
  // (o app não "dorme" atrás do jogo, para a transmissão não parar) e disputava a placa com o jogo e com a captura. Só a prévia daqui pausa:
  // a captura e o que os outros recebem não mudam. Volta na hora quando o Aero aparece
  function pintarTudo() {
    if (!ch || !ch.ui) return;
    const ui = ch.ui, n = ch.pares.size;
    for (const par of ch.pares.values()) {
      if (!par.tile) continue;
      const comVideo = par.cam && par.midia.cam && par.midia.cam.getVideoTracks().some((t) => t.readyState === 'live');
      if (comVideo && par.camEl.srcObject !== par.midia.cam) { par.camEl.srcObject = par.midia.cam; par.camEl.play().catch(() => {}); }
      par.tile.classList.toggle('com-video', !!comVideo);
      par.tile.classList.toggle('mudo', par.mudo);
      par.tile.classList.toggle('conectando', par.pc.connectionState !== 'connected');
      par.tile.classList.toggle('na-tela', par.tela);
    }
    // eu
    const cam = viva(ch.cam);
    if (cam && (!ui.euVideo.srcObject || ui.euVideo.srcObject.getVideoTracks()[0] !== cam)) ui.euVideo.srcObject = new MediaStream([cam]);
    if (!cam) ui.euVideo.srcObject = null;
    ui.euTile.classList.toggle('com-video', !!cam);
    ui.euTile.classList.toggle('mudo', ch.mudo);
    // palco (tela compartilhada)
    // (1.0.2) a tela (ou câmera) que estava grande sumiu (a pessoa parou de mostrar ou saiu): volta para a chamada normal e sai da tela
    // cheia, em vez de ficar um quadro vazio
    const antes = ui.palcoAtual;
    let p = quemNoPalco();
    const sumiu = !!(antes && antes.tipo !== 'foto' && (!p || (p.tipo === 'foto' && (antes.eu ? p.eu : p.chave === antes.chave))));
    if (sumiu && p && p.foco) { ch.foco = null; p = quemNoPalco(); }
    if (sumiu && (!p || p.tipo === 'foto') && ui.palco.classList.contains('cheio') && CH._telaCheia) CH._telaCheia(false);
    ui.palcoAtual = p;
    // alguém começou a compartilhar a tela: o chat abre no canto sozinho (uma vez por compartilhamento; dá para fechar)
    if (p && !p.foco && !ui.el.classList.contains('com-palco') && ch.modo === 'max' && ui.abrirChat && !ui.chatAberto() && !A.plat.celular && !matchMedia('(max-width: 760px)').matches) ui.abrirChat(true); // (0.9.0) só quando alguém compartilha a tela, e nunca no celular (lá o chat cobria a chamada)
    if (p && !ui.el.classList.contains('com-palco')) ui.el.classList.add('palco-quieto'); // (1.0.2) a tela entrou: os controles por cima dela só aparecem com o mouse em cima
    ui.el.classList.toggle('com-palco', !!p);
    ui.el.classList.toggle('com-foco', !!(p && p.foco));
    const chaveFoco = ch.foco;
    for (const par of ch.pares.values()) if (par.tile) par.tile.classList.toggle('em-foco', par.chave === chaveFoco);
    ui.euTile.classList.toggle('em-foco', chaveFoco === 'eu');
    // (0.7.9) outra pessoa em destaque: você aparece na fila com os outros, para dar para voltar para você com um clique
    const euNaFila = !!(p && p.foco && !p.eu);
    if (euNaFila && ui.euTile.parentNode !== ui.pessoas) ui.pessoas.append(ui.euTile);
    else if (!euNaFila && ui.euTile.parentNode === ui.pessoas) ui.pessoas.nextElementSibling.after(ui.euTile);
    if (p) {
      const trilha = p.st && p.st.getVideoTracks()[0];
      if (trilha && (!ui.palcoVideo.srcObject || ui.palcoVideo.srcObject.getVideoTracks()[0] !== trilha)) { ui.palcoVideo.srcObject = p.st; ui.palcoVideo.play().catch(() => {}); tocarQuandoChegar(ui.palcoVideo, p.st); zoomReset(); }
      if (!trilha) ui.palcoVideo.srcObject = null;
      ui.palco.dataset.tipo = p.tipo; ui.palcoVideo.classList.toggle('espelho', !!(p.eu && p.tipo === 'cam'));
      if (p.tipo === 'foto' && ui.palcoAv.dataset.de !== (p.pessoa.codigo || '')) { ui.palcoAv.replaceChildren(A.ui.avatar(p.pessoa, 180)); ui.palcoAv.dataset.de = p.pessoa.codigo || ''; ui.palcoAv.classList.remove('falando'); }
      if (p.tipo === 'foto' && A.extras) A.extras.marcarChamada(ui.palcoAv, p.pessoa.codigo); // (1.0.2) a foto grande também tem o anel de fala da pessoa
      ui.palcoNome.textContent = p.nome;
    } else ui.palcoVideo.srcObject = null;
    pintarCanto(p);
    pintarVideos();
    // chamando (antes de alguém atender): as bolhas de quem foi chamado
    ui.pessoas.querySelectorAll('.cham-tile.chamando').forEach((t) => { if (!ch.saindo || n) t.remove(); });
    // cabeçalho e botões
    ui.estado.textContent = ch.inicio ? fmt(Date.now() - ch.inicio) : ch.saindo && !n ? T('chamando', 'calling') : T('conectando…', 'connecting…');
    ui.el.dataset.pessoas = String(Math.max(1, ui.pessoas.children.length));
    ui.miniAvs.textContent = '';
    [...ch.pares.values()].slice(0, 3).forEach((x) => ui.miniAvs.append(A.ui.avatar(pessoaDe(x.codigo), 30)));
    const bt = (b, ico, ligado, tit) => { if (!b) return; b.replaceChildren(A.icone(ico, 22)); b.classList.toggle('ativo', !!ligado); b.title = tit; b.setAttribute('aria-label', tit); };
    bt(ui.bMic, ch.mudo ? 'micOff' : 'mic', false, ch.mudo ? T('Ligar microfone', 'Unmute') : T('Desligar microfone', 'Mute'));
    ui.bMic.classList.toggle('desligado', ch.mudo);
    bt(ui.bCam, cam ? 'video' : 'videoOff', !!cam, cam ? T('Desligar câmera', 'Turn camera off') : T('Ligar câmera', 'Turn camera on'));
    bt(ui.bTela, 'enviarTela', !!ch.tela, ch.tela ? T('Parar de compartilhar', 'Stop sharing') : T('Compartilhar a tela', 'Share screen'));
    ui.miniMic.replaceChildren(A.icone(ch.mudo ? 'micOff' : 'mic', 18)); ui.miniMic.classList.toggle('desligado', ch.mudo);
    const mudoGeral = S().volume <= 0;
    bt(ui.bSom, mudoGeral ? 'mudo' : 'volume', false, mudoGeral ? T('Ligar o som', 'Unmute sound') : T('Som (mudo geral)', 'Sound (mute all)')); ui.bSom.classList.toggle('desligado', mudoGeral);
    if (ui.pintarCtl) ui.pintarCtl();
  }

  // (0.7.6) a setinha da câmera: escolher qual câmera usar (fica guardada); com a câmera ligada, troca na hora
  async function escolherCamera(ancora) {
    const U = A.ui;
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (_) { /* sem lista */ }
    if (!ch || !ancora.isConnected) return;
    const ligada = viva(ch.cam), idLigada = ligada && ligada.getSettings ? ligada.getSettings().deviceId : '', escolhida = idLigada || A.cfg.v.camera || '';
    const corpo = h('div', { class: 'col', estilo: { gap: '6px' } });
    if (!devs.length) corpo.append(h('div', { class: 'peq suave' }, T('Nenhuma câmera encontrada.', 'No camera found.')));
    devs.forEach((d, i) => {
      const sel = escolhida ? d.deviceId === escolhida : i === 0;
      corpo.append(U.btn(d.label || T('Câmera ', 'Camera ') + (i + 1), { icone: sel ? 'check' : 'camera', tipo: sel ? 'ok' : 'sec', onclick: () => { pop.fechar(); CH.usarCamera(d.deviceId); } }));
    });
    // (1.0.0) corrigir a imagem: a câmera pode vir espelhada, de cabeça para baixo ou deitada; quem está na chamada vê do jeito escolhido aqui
    const aj = ajCam(), linhaAj = h('div', { class: 'cam-aj' });
    const pintarAj = () => {
      const a = ajCam();
      linhaAj.replaceChildren(
        U.btn(T('Espelhar', 'Mirror'), { icone: 'espelhar', tipo: a.h ? 'ok' : 'sec', peq: true, titulo: T('Inverter o lado (esquerda e direita)', 'Flip sides (left and right)'), onclick: () => { CH.ajusteCamera({ h: !ajCam().h }); pintarAj(); } }),
        U.btn(T('Virar', 'Flip'), { icone: 'virar', tipo: a.v ? 'ok' : 'sec', peq: true, titulo: T('De cabeça para baixo', 'Upside down'), onclick: () => { CH.ajusteCamera({ v: !ajCam().v }); pintarAj(); } }),
        U.btn(a.r ? a.r + '°' : T('Girar', 'Rotate'), { icone: 'girar', tipo: a.r ? 'ok' : 'sec', peq: true, titulo: T('Girar 90°', 'Rotate 90°'), onclick: () => { CH.ajusteCamera({ r: (ajCam().r + 90) % 360 }); pintarAj(); } }),
        a.h || a.v || a.r ? U.btn(T('Voltar ao normal', 'Reset'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: () => { CH.ajusteCamera({ h: false, v: false, r: 0 }); pintarAj(); } }) : null);
    };
    void aj; pintarAj();
    corpo.append(h('div', { class: 'pop-sec' }, h('b', {}, T('Imagem', 'Image'))), linhaAj, h('div', { class: 'peq suave' }, T('Se a sua câmera aparece ao contrário, corrija aqui. Todo mundo na chamada vê do jeito que você deixar.', 'If your camera looks reversed, fix it here. Everyone on the call sees it the way you set it.')));
    corpo.append(U.btn(ligada ? T('Desligar a câmera', 'Turn camera off') : T('Ligar a câmera', 'Turn camera on'), { icone: ligada ? 'videoOff' : 'video', tipo: 'sec', peq: true, onclick: () => { pop.fechar(); CH.camera(); } }));
    const pop = U.popover(ancora, corpo, { largura: 320, titulo: T('Câmera', 'Camera') });
  }
  CH.usarCamera = async (id) => {
    A.cfg.v.camera = id || ''; A.cfg.salvar();
    if (!ch || !viva(ch.cam)) return;
    if (ch.cam.getSettings && ch.cam.getSettings().deviceId === id) return;
    const velha = ch.cam; velha.stop(); // (algumas câmeras não abrem duas vezes ao mesmo tempo)
    const v = await abrirCamera(); if (!ch) { if (v) v.stop(); return; }
    ch.cam = v; trocar('cam', viva(v)); avisarEstado(); pintarTudo();
  };

  // MAXIMIZADA, JANELINHA (pip) ou MINIMIZADA
  // ---------- a chamada dentro do chat (0.5.9-5, como no Discord) ----------
  // O Aero Talk desenha no topo da conversa as bolhas de quem está na chamada e os botões. Estando no chat da própria chamada, a
  // janelinha (PiP) some (a faixa do chat faz o papel dela); saindo do chat, ela volta. A tela maximizada continua igual.
  CH.estado = () => {
    if (!ch) return null;
    return {
      cid: ch.cid, id: ch.id, modo: ch.modo, inicio: ch.inicio, chamando: ch.saindo && !ch.pares.size,
      eu: { codigo: eu().codigo, nome: eu().nome, av: eu().av, mudo: ch.mudo, surdo: S().volume <= 0, cam: !!viva(ch.cam), tela: !!ch.tela, falando: !!ch.euFalando && !ch.mudo },
      pares: [...ch.pares.values()].map((par) => ({ codigo: par.codigo, mudo: par.mudo, cam: par.cam, tela: par.tela, falando: !!par.falando && !par.mudo, conectado: par.pc.connectionState === 'connected' })),
    };
  };
  // (1.0.0) o mudo geral (deixar de ouvir a chamada), o mesmo na barra grande e na faixa da conversa
  let volAntes = 1;
  CH.mudoSom = () => { const s = S(); s.reativarAudio(); if (s.volume > 0) { volAntes = s.volume; s.definirVolume(0); A.som.tocar('som-off'); } else { s.definirVolume(volAntes || 1); A.som.tocar('som-on'); } if (ch && ch.ui) pintarTudo(); };
  CH.opcoesSom = (b) => A.mixer.audio(b);
  CH.opcoesTela = (b) => opcoesTela(b);
  CH.opcoesCamera = (b) => escolherCamera(b);
  CH.opcoesMic = (b) => A.mixer.mic(b, { ligado: () => !!ch && !ch.mudo, alternar: async () => CH.mudo(), reiniciar: () => A.mic.reiniciar() });
  const noChatDaChamada = () => { const p = ch && document.querySelector('.tk-cham-palco[data-cid="' + ch.cid + '"]'); return !!(p && p.isConnected && p.getClientRects().length); };
  CH.ajustarJanela = () => { if (!ch || !ch.ui) return; ch.ui.el.classList.toggle('escondida-no-chat', ch.modo !== 'max' && noChatDaChamada()); };

  const modoPequeno = () => (A.cfg.v.chamPequena === 'mini' ? 'mini' : 'pip'); // (0.7.2) o modo pequeno que você deixou da última vez
  CH.modo = (m) => {
    if (!ch || !ch.ui) return;
    const el = ch.ui.el;
    if (m === 'max') Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: '' }); // a maximizada ocupa tudo; a janelinha volta ao canto
    if (m !== 'max' && CH._telaCheia && ch.ui && ch.ui.palco.classList.contains('cheio')) CH._telaCheia(false); // (0.6.0) janelinha/pílula: sai da tela cheia antes
    ch.modo = m;
    el.classList.toggle('modo-max', m === 'max'); el.classList.toggle('modo-pip', m === 'pip'); el.classList.toggle('modo-mini', m === 'mini');
    document.documentElement.toggleAttribute('data-cham-max', m === 'max'); // (0.5.9-9) chamada em tela cheia: o fundo para (app.css)
    el.setAttribute('aria-modal', m === 'max' ? 'true' : 'false');
    A.som.tocar(m === 'max' ? 'abrir' : 'fechar');
    // (0.7.2) cada modo pequeno no lugar dele (o lugar da pílula não serve para a janelinha, que é maior); sem lugar salvo, o canto padrão.
    // E o app lembra qual dos dois você usa (janelinha ou minimizada)
    if (m !== 'max') { Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: '', translate: '' }); A.cfg.v.chamPequena = m; A.cfg.salvar(); }
    if (m !== 'max' && ch.ui.arrJanela) requestAnimationFrame(() => requestAnimationFrame(() => ch && ch.ui && ch.modo === m && ch.ui.arrJanela.aplicarSalva()));
    pintarTudo(); CH.ajustarJanela(); A.evt.emit('chamada:modo', m);
  };

  function montarJanela() {
    const U = A.ui;
    const euVideo = h('video', { autoplay: true, playsinline: true, poster: SEM_POSTER }); euVideo.muted = true;
    const euTile = tile(eu(), { eu: true, videoEl: euVideo });
    const pessoas = h('div', { class: 'cham-pessoas' });
    // quem está sendo chamado (antes de atender): a foto dele grande com "chamando" e os pontinhos, como no Skype
    if (ch.saindo) {
      const c = conversa(ch.cid);
      (c ? (c.membros || []).filter((m) => m.codigo !== eu().codigo).slice(0, 9) : []).forEach((m) => { const t = tile(m); t.classList.add('chamando'); pessoas.append(t); });
    }
    const palcoVideo = h('video', { autoplay: true, playsinline: true, poster: SEM_POSTER }); palcoVideo.muted = true;
    const palcoAv = h('div', { class: 'cham-palco-av' });
    const palcoMidia = h('div', { class: 'cham-palco-midia' }, palcoVideo, palcoAv);
    const palcoNome = h('div', { class: 'cham-palco-nome' });
    const zoomTxt = h('span', { class: 'cham-zoom-txt' }, '100%');
    // tela cheia: só o palco (a tela compartilhada) vai para a tela cheia; a barra de botões entra junto (ui.js leva as janelinhas e avisos)
    // (0.6.0) tela cheia pelo próprio app: o palco cobre a janela e o app do PC vai para a tela cheia do sistema. A tela cheia do navegador
    // (requestFullscreen) falhava no Windows dentro do Aero, e a barra ficava de fora.
    let modoAntesCheia = null;
    const telaCheia = (forcar) => {
      const on = typeof forcar === 'boolean' ? forcar : !palco.classList.contains('cheio');
      // (0.7.0) vindo da janelinha (PiP): a tela cheia ficava presa dentro dela (só uma faixa preta no canto). Passa para a janela grande antes,
      // e volta para a janelinha ao sair da tela cheia
      if (on && ch && ch.modo !== 'max') { modoAntesCheia = ch.modo; CH.modo('max'); }
      palco.classList.toggle('cheio', on); document.documentElement.classList.toggle('palco-cheio', on);
      if (on && barra.parentNode !== palco) { palco.append(barra, puxador); barraArr.voltar(); } else if (!on && barra.parentNode === palco) { el.insertBefore(barra, mini); el.insertBefore(puxador, mini); }
      // (0.6.9) o chat aberto vai junto para a tela cheia, do lado (antes ficava escondido atrás da tela compartilhada)
      if (on && !chatBox.hidden && chatBox.parentNode !== palco) { chatPai = chatBox.parentNode; palco.append(chatBox); }
      else if (!on && chatBox.parentNode === palco && chatPai) chatPai.append(chatBox);
      palco.classList.toggle('com-chat', on && !chatBox.hidden);
      const NC = A.plat.apk && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AeroNotif; // (0.9.1) celular: a tela inteira do aparelho
      if (NC && NC.telaCheia) NC.telaCheia({ on, paisagem: !!(on && palcoVideo.videoWidth > palcoVideo.videoHeight * 1.1) }).catch(() => {});
      else if (window.aero && window.aero.telaCheia) window.aero.telaCheia(on).catch(() => {});
      else if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      // (0.7.9) a tela cheia do sistema não pegou (a imagem ficava só no tamanho da janela): tenta de novo e deixa registrado no relatório
      if (on && !NC) setTimeout(() => { if (!palco.classList.contains('cheio') || innerHeight >= screen.height * 0.97) return; A.log.aviso('tela cheia não ocupou o monitor: janela', innerWidth + 'x' + innerHeight, 'tela', screen.width + 'x' + screen.height); if (window.aero && window.aero.telaCheia) window.aero.telaCheia(true).catch(() => {}); }, 1500);
      if (!on) esconderBarra(false);
      if (!on && modoAntesCheia && ch) { const m = modoAntesCheia; modoAntesCheia = null; CH.modo(m); }
    };
    CH._telaCheia = telaCheia;
    const zb = (icone, titulo, f) => { const b = A.ui.btn('', { icone, tipo: 'sec', redondo: true, peq: true, titulo }); b.onclick = (e) => { e.stopPropagation(); f(); }; return b; };
    const palcoCtl = h('div', { class: 'cham-palco-ctl' }, h('span', { class: 'cham-zoom-grupo' }, zb('menos', T('Diminuir', 'Zoom out'), () => CH.zoom(1 / 1.25)), zoomTxt, zb('mais', T('Aumentar', 'Zoom in'), () => CH.zoom(1.25))), zb('expandir', T('Tela cheia', 'Fullscreen'), telaCheia), zb('fechar', T('Voltar ao normal', 'Back to normal'), () => { if (ch.foco) CH.focar(ch.foco); else { ch.semAuto = true; zoomReset(); pintarTudo(); } }));
    const canto = h('div', { class: 'cham-canto', hidden: true }); // (1.0.2) as câmeras no cantinho da tela grande
    const palco = h('div', { class: 'cham-palco' }, palcoMidia, palcoNome, palcoCtl, canto);
    // (1.0.2) arrastar câmeras e telas entre a fila de pessoas e o cantinho da tela grande (e mudar a ordem dentro do canto)
    const DND = 'application/x-aero-canto';
    let doCanto = '';
    const temItem = (e) => !!(e.dataTransfer && [...e.dataTransfer.types].includes(DND));
    const limparDnd = () => { doCanto = ''; el.classList.remove('soltando'); palco.classList.remove('soltar-aqui'); pessoas.classList.remove('soltar-aqui'); canto.querySelectorAll('.arrastando').forEach((x) => x.classList.remove('arrastando')); };
    canto.addEventListener('dragstart', (e) => {
      const it = e.target.closest && e.target.closest('.cham-canto-item'); if (!it) return;
      doCanto = it.dataset.id; e.dataTransfer.setData(DND, doCanto); e.dataTransfer.effectAllowed = 'move'; it.classList.add('arrastando'); el.classList.add('soltando');
    });
    canto.addEventListener('dragend', limparDnd);
    palco.addEventListener('dragover', (e) => { if (!temItem(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; palco.classList.add('soltar-aqui'); });
    palco.addEventListener('dragleave', (e) => { if (!palco.contains(e.relatedTarget)) palco.classList.remove('soltar-aqui'); });
    palco.addEventListener('drop', (e) => {
      if (!temItem(e)) return; e.preventDefault();
      const id = e.dataTransfer.getData(DND), alvo = e.target.closest && e.target.closest('.cham-canto-item');
      limparDnd(); CH.moverCanto(id, 'canto', alvo && alvo.dataset.id !== id ? alvo.dataset.id : null);
    });
    pessoas.addEventListener('dragstart', (e) => {
      const t = e.target.closest && e.target.closest('.cham-tile'), par = t && ch && [...ch.pares.values()].find((x) => x.tile === t), id = CH.itemArrastavel(par);
      if (!id) { e.preventDefault(); return; }
      e.dataTransfer.setData(DND, id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('soltando');
    });
    pessoas.addEventListener('dragend', limparDnd);
    pessoas.addEventListener('dragover', (e) => { if (!doCanto || !temItem(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; pessoas.classList.add('soltar-aqui'); });
    pessoas.addEventListener('dragleave', (e) => { if (!pessoas.contains(e.relatedTarget)) pessoas.classList.remove('soltar-aqui'); });
    pessoas.addEventListener('drop', (e) => { if (!doCanto) return; e.preventDefault(); const id = doCanto; limparDnd(); CH.moverCanto(id, 'fila'); });
    const travado = () => !!(A.entrada && A.entrada.lock); // (0.7.6) no cadeado do modo jogo, o mouse é do jogo do amigo
    // (1.0.2) sem duplo clique na tela: ele ligava a tela cheia sem querer (e no modo jogo os cliques são do jogo); a tela cheia fica no botão
    // (0.7.0) o que fica por cima da tela (botões, barra, puxador, chat da tela cheia) não vira arrastar/zoom da imagem
    const ehControle = (t) => !!(t && t.closest && t.closest('button, .btn, .puxador, .cham-barra, .cham-palco-ctl, .cham-chat, .cham-canto, input, textarea'));
    // (0.7.0) mouse parado por 2,5 s: o zoom, a tela cheia e o nome somem (e, na tela cheia, a barra e o cursor), para ficar imersivo
    let quietoT = 0;
    const acordarPalco = () => { palco.classList.remove('quieto'); el.classList.remove('palco-quieto'); clearTimeout(quietoT); quietoT = setTimeout(() => { if (!palco.matches(':focus-within') || palco.classList.contains('cheio')) { palco.classList.add('quieto'); el.classList.add('palco-quieto'); } }, 2500); };
    palco.addEventListener('pointermove', acordarPalco); palco.addEventListener('pointerdown', acordarPalco); palco.addEventListener('pointerleave', () => { clearTimeout(quietoT); palco.classList.remove('quieto'); el.classList.add('palco-quieto'); /* (1.0.2) o puxador da barra escondida some junto, até o mouse voltar */ });
    palco.addEventListener('wheel', (e) => { if (travado() || ehControle(e.target) || document.documentElement.hasAttribute('data-cham-jogo')) return; e.preventDefault(); CH.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    let arraste = null;
    // antes o puxador e o chat "perdiam" o clique para a tela (ela prendia o ponteiro)
    palco.addEventListener('pointerdown', (e) => { if (travado() || ehControle(e.target)) return; arraste = { x: e.clientX, y: e.clientY, zx: zoom.x, zy: zoom.y, moveu: false }; palco.setPointerCapture(e.pointerId); });
    palco.addEventListener('pointermove', (e) => {
      if (!arraste) return;
      const dx = e.clientX - arraste.x, dy = e.clientY - arraste.y; if (Math.abs(dx) + Math.abs(dy) > 4) arraste.moveu = true;
      if (zoom.z > 1) { const r = palco.getBoundingClientRect(); zoom.x = arraste.zx + (dx / r.width) * 100; zoom.y = arraste.zy + (dy / r.height) * 100; aplicarZoom(); }
    });
    // um clique (sem arrastar e sem zoom) no palco de alguém em destaque: volta ao normal (como no Discord)
    palco.addEventListener('pointerup', () => { const a = arraste; arraste = null; if (a && !a.moveu && zoom.z === 1 && ch && ch.foco) CH.focar(ch.foco); });
    const horizonte = h('div', { class: 'cham-horizonte', 'aria-hidden': 'true' }); // a linha entre quem você chamou (em cima) e você (embaixo)

    const estado = h('span', { class: 'cham-estado' });
    const miniAvs = h('span', { class: 'cham-mini-avs' });
    const rb = (icone, titulo, onclick, tipo = 'sec') => U.btn('', { icone, tipo, redondo: true, titulo, onclick });
    // a setinha, como na barra da sala: grudada no botão; um clique abre, outro clique (ou o A do controle) fecha
    const seta = (titulo, abrir) => {
      const b = U.btn('', { icone: 'chevron', tipo: 'sec', redondo: true, peq: true, titulo });
      b.classList.add('seta', 'cham-seta'); b.setAttribute('aria-haspopup', 'dialog');
      b.onclick = (e) => { e.stopPropagation(); if (U._pop && U._pop.ancora === b) { U._pop.fechar(); return; } abrir(b); };
      return b;
    };
    const ctxMic = { ligado: () => !!ch && !ch.mudo, alternar: async () => CH.mudo(), reiniciar: () => A.mic.reiniciar() };
    // cada botão com a sua setinha de opções, como na barra da sala: tela ▾, microfone ▾, som ▾
    const bTela = A.plat.podeCompartilhar ? rb('enviarTela', T('Compartilhar a tela', 'Share screen'), () => CH.tela()) : null;
    const setaTela = bTela ? seta(T('Opções de compartilhamento', 'Sharing options'), (b) => opcoesTela(b)) : null;
    // o chat da conversa no canto da chamada (como na sala); na janelinha, abre o Aero Talk
    const chatBox = h('aside', { class: 'cham-chat', hidden: true });
    let chatCx = null, chatPai = null;
    const abrirChat = (on) => {
      if (on && !chatCx) { chatCx = A.talk.chatCompacto && A.talk.chatCompacto(ch.cid); if (!chatCx) { CH.modo(modoPequeno()); A.talk.irPara(ch.cid); return; } const cabC = h('div', { class: 'cham-chat-cab' }, h('b', {}, T('Conversa', 'Chat')), U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Fechar o chat', 'Close chat'), onclick: () => abrirChat(false) })); chatBox.append(cabC, chatCx.el); if (!A.plat.celular) U.chatEncaixavel(chatBox, cabC, el, 'chamada'); }
      chatBox.hidden = !on; el.classList.toggle('com-chat', !!on); bChat.classList.toggle('ativo', !!on);
      if (palco.classList.contains('cheio')) { if (on && chatBox.parentNode !== palco) { chatPai = chatBox.parentNode; palco.append(chatBox); } palco.classList.toggle('com-chat', !!on); } // (0.6.9) na tela cheia, o chat abre do lado
      if (on && chatCx) setTimeout(() => chatCx.focar(), 50);
    };
    const bChat = rb('chat', T('Chat da conversa', 'Conversation chat'), () => { if (ch.modo !== 'max') { CH.modo(modoPequeno()); A.talk.irPara(ch.cid); return; } abrirChat(chatBox.hidden); });
    const bCam = A.plat.camera ? rb('video', T('Câmera', 'Camera'), () => CH.camera()) : null;
    const setaCam = bCam ? seta(T('Escolher a câmera', 'Choose the camera'), (b) => escolherCamera(b)) : null;
    const bMic = rb('mic', T('Microfone', 'Microphone'), () => CH.mudo());
    const setaMic = seta(T('Opções do microfone', 'Microphone options'), (b) => A.mixer.mic(b, ctxMic));
    const bSom = rb('volume', T('Som (mudo geral)', 'Sound (mute all)'), () => CH.mudoSom());
    const setaSom = seta(T('Saída de som e volumes', 'Sound output and volumes'), (b) => A.mixer.audio(b));
    const bFim = rb('desligarTel', T('Desligar', 'Hang up'), () => CH.desligar(), 'perigo'); bFim.classList.add('cham-fim');
    const msEl = h('span', { class: 'cham-ms', 'aria-live': 'off' });
    const bSinal = h('span', { class: 'cham-sinal', role: 'img' }, A.icone('sinal', 20), msEl);
    const bModo = rb('pip', T('Janelinha (continuar usando o app)', 'Small window (keep using the app)'), () => CH.modo(ch.modo === 'max' ? modoPequeno() : 'max'));
    // (0.6.0) a setinha da sala: recolhe a barra de botões para baixo; o puxador traz de volta
    const bRecolher = rb('chevron', T('Esconder os botões', 'Hide the buttons'), () => esconderBarra(true)); bRecolher.classList.add('recolher');
    const puxador = h('button', { type: 'button', class: 'puxador cham-puxador', title: T('Mostrar os botões', 'Show the buttons'), hidden: true, onclick: () => esconderBarra(false) });
    const esconderBarra = (on) => { barra.classList.toggle('oculta', on); puxador.hidden = !on; A.som.tocar(on ? 'fechar' : 'abrir'); };

    // (0.7.6) MODO JOGO: o botão do controle (com a setinha), os pedidos, a bolha do cadeado e os cursores dos amigos, como na sala
    const E = A.entrada;
    const camCur = E.camada(palcoVideo); palcoMidia.append(camCur.el);
    const pedidos = h('div', { class: 'pedidos-ctl cham-pedidos', 'aria-live': 'polite', hidden: true });
    const dicaLock = h('button', { type: 'button', class: 'bolha-ctl cham-bolha', 'aria-label': T('Menu do controle remoto', 'Remote control menu') });
    const dicaSair = h('div', { class: 'bolha-ctl-dica', 'aria-hidden': 'true', hidden: true });
    palco.append(pedidos, dicaLock, dicaSair); // (1.0.2) sem o aviso "clique na tela para controlar": o Esc é do jogo e o mouse volta sozinho
    const nosso = () => E.contexto() === ctx;
    const souDono = () => !!(ch && ch.tela && ch.modoTela === 'jogo');
    // a tela que dá para controlar: a de quem eu já controlo, senão a que está no palco (se estiver no modo jogo)
    const alvoCtl = () => {
      if (!ch) return null;
      const d = meuCtlCh && ch.pares.get(meuCtlCh.dono);
      if (d && d.tela && d.modo === 'jogo') return d;
      const p = ch.ui && ch.ui.palcoAtual, q = p && !p.eu && p.tipo === 'tela' && ch.pares.get(p.chave);
      return q && q.tela && q.modo === 'jogo' ? q : null;
    };
    const nomeCtl = (par) => (par ? nomeDe(par.codigo) || par.codigo : '');
    const entrarLockCh = () => {
      const alvo = alvoCtl(); if (!alvo || !E.podeEntrar() || !nosso()) return;
      const p = ch.ui.palcoAtual;
      if (!(p && p.chave === alvo.chave && p.tipo === 'tela')) { ch.foco = alvo.chave; ch.semAuto = false; pintarTudo(); }
      if (ch.modo !== 'max') CH.modo('max');
      zoomReset(); if (!palco.classList.contains('cheio')) telaCheia(true); // o jogo na tela inteira, sem nada por cima
      E.entrarLock(palcoVideo);
    };
    const acaoCtl = () => {
      const alvo = alvoCtl(), c = meuCtlCh;
      if (!alvo) { if (U._pop && U._pop.ancora === bCtl) U._pop.fechar(); else if (souDono()) popoverCtl(bCtl); return; } // quem compartilha: vê quem está jogando (apertar de novo fecha)
      if (!c) { CH.pedirControle(alvo.chave); A.som.tocar('click'); return; }
      if (c.st === 'pedindo') { CH.sairControle(); return; }
      entrarLockCh();
    };
    const bCtl = rb('controle', T('Controle remoto', 'Remote control'), acaoCtl);
    const seloCtl = h('span', { class: 'selo', hidden: true });
    const setaCtl = seta(T('Opções do controle', 'Control options'), (b) => popoverCtl(b));
    const parCtl = h('div', { class: 'par cham-par', hidden: true }, bCtl, setaCtl);
    const definirCor = (c) => { const cfgE = A.cfg.v.entrada || (A.cfg.v.entrada = {}); cfgE.cor = c || ''; A.cfg.salvar(); sujarCtl(); if (ch) avisarEstado(); };
    const modoMouse = () => U.seg([['host', T('Move o cursor dele', 'Moves their cursor')], ['livre', T('Aponta direto', 'Points directly')]], (A.cfg.v.entrada.mouseModo || 'host'), (v) => { A.cfg.v.entrada.mouseModo = v; A.cfg.salvar(); if (E.modoMouse) E.modoMouse(); });
    const cores = () => [h('div', { class: 'pop-sec' }, h('b', {}, T('Cor do seu cursor', 'Your cursor color'))), U.seletorCor ? U.seletorCor(definirCor) : null];
    function popoverCtl(ancora) {
      const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
      const c = meuCtlCh, alvo = alvoCtl();
      if (alvo && c) {
        corpo.append(h('div', { class: 'linha' }, A.icone('controle', 20), h('div', { class: 'cresce' }, h('b', {}, T('Controlando ', 'Controlling ') + nomeCtl(alvo)), h('div', { class: 'peq suave' }, c.st === 'ativo' ? T('Ativo', 'Active') : c.st === 'pausado' ? T('Pausado: volte ao cadeado para jogar', 'Paused: go back to the lock to play') : T('Aguardando a resposta', 'Waiting for an answer')))));
        if (E.cap && !E.cap.mouse && !E.cap.teclado) corpo.append(h('div', { class: 'peq suave pop-nota' }, T('Neste computador o mouse e o teclado reais ainda não podem ser controlados de fora: você aparece como um cursor colorido, que só indica.', 'On this computer the real mouse and keyboard cannot be driven remotely yet: you show up as a colored cursor that only points.')));
        corpo.append(...cores(), h('div', { class: 'pop-sec' }, h('b', {}, T('Seu mouse', 'Your mouse'))), modoMouse(),
          h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Entrar no bloqueio automaticamente', 'Enter the lock automatically')), U.chave(A.cfg.v.entrada.lockAuto !== false, (v) => { A.cfg.v.entrada.lockAuto = v; A.cfg.salvar(); })),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } },
            c.st !== 'pedindo' ? U.btn(T('Entrar no jogo', 'Enter the game'), { icone: 'cadeado', tipo: 'ok', peq: true, onclick: () => { pop.fechar(); entrarLockCh(); } }) : null,
            U.btn(c.st === 'pedindo' ? T('Cancelar o pedido', 'Cancel the request') : T('Sair do controle', 'Leave control'), { tipo: 'perigo', peq: true, onclick: () => { pop.fechar(); CH.sairControle(); } })),
          h('div', { class: 'peq suave' }, T('No jogo, ' + E.atalhoBolha() + ' ou START + SELECT + RB abre a bolha e pausa; START + SELECT + LB abre os botões; ' + E.atalhoFechar() + ' larga o controle.', 'In the game, ' + E.atalhoBolha() + ' or START + SELECT + RB opens the bubble and pauses; START + SELECT + LB opens the buttons; ' + E.atalhoFechar() + ' leaves control.')));
      } else if (alvo) {
        corpo.append(h('div', { class: 'linha' }, A.icone('controle', 20), h('div', { class: 'cresce' }, h('b', {}, T('Controlar a tela de ', 'Control the screen of ') + nomeCtl(alvo)), h('div', { class: 'peq suave' }, T('Quem compartilha precisa aceitar.', 'The sharer needs to accept.')))),
          U.btn(T('Pedir para controlar', 'Ask to control'), { icone: 'controle', onclick: () => { pop.fechar(); CH.pedirControle(alvo.chave); A.som.tocar('click'); } }),
          ...cores(), h('div', { class: 'pop-sec' }, h('b', {}, T('Seu mouse', 'Your mouse'))), modoMouse());
      }
      if (souDono()) {
        const ativos = CH.controladores();
        corpo.append(h('div', { class: 'pop-sec' }, h('b', {}, T('Quem está jogando na sua tela', 'Who is playing on your screen'))));
        if (!ativos.length) corpo.append(h('div', { class: 'peq suave' }, T('Ninguém controla a sua tela agora.', 'Nobody is controlling your screen right now.')));
        ativos.forEach((p) => {
          const slots = E.slots.map((x, i) => (x && x.de === p.id ? i + 1 : 0)).filter(Boolean);
          corpo.append(h('div', { class: 'linha' }, U.avatar(p, 32), h('div', { class: 'cresce' }, h('b', {}, p.nome), h('div', { class: 'peq suave' }, [p.ctl.st === 'pausado' ? T('pausado', 'paused') : T('ativo', 'active'), p.ctl.real ? T('mouse e teclado reais', 'real mouse and keyboard') : T('cursor emulado', 'emulated cursor'), slots.length ? T('controle ', 'gamepad ') + slots.join(', ') : ''].filter(Boolean).join(' · '))),
            U.btn(T('Revogar', 'Revoke'), { tipo: 'sec', peq: true, onclick: () => { pop.fechar(); CH.decidirControle(p.id, 'revogar'); } })));
        });
        if (!alvo) corpo.append(...cores());
        corpo.append(h('div', { class: 'peq suave' }, T('Até 4 controles ao mesmo tempo. Mouse e teclado: uma pessoa de cada vez controla de verdade; as outras aparecem como cursores coloridos.', 'Up to 4 gamepads at once. Mouse and keyboard: one person at a time truly controls; others show up as colored cursors.')));
      }
      if (!alvo && !souDono()) corpo.append(h('div', { class: 'peq suave' }, T('Quando alguém compartilhar a tela no modo jogo, dá para pedir para controlar por aqui.', 'When someone shares their screen in game mode, you can ask to control it here.')), ...cores());
      const pop = U.popover(ancora, corpo, { largura: 360, titulo: T('Controle remoto', 'Remote control') });
    }
    // a lista FIXA de pedidos (fica até você decidir)
    let pedidosK = '';
    function pintarPedidos() {
      const lista = souDono() ? CH.pedidosCtl() : [], k = lista.map((p) => p.id).join(',');
      if (k === pedidosK) return; pedidosK = k;
      pedidos.hidden = !lista.length; pedidos.textContent = '';
      lista.forEach((p) => pedidos.append(h('div', { class: 'pedido vidro', role: 'group', 'aria-label': p.nome },
        U.avatar(p, 34), h('div', { class: 'cresce' }, h('b', {}, p.nome), h('div', { class: 'peq suave' }, T('quer controlar a sua tela', 'wants to control your screen'))),
        h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', 'justify-content': 'flex-end', gap: '6px' } },
          U.btn(T('Aceitar', 'Accept'), { tipo: 'ok', peq: true, onclick: () => CH.decidirControle(p.id, 'aprovar') }),
          U.btn(T('Negar', 'Deny'), { tipo: 'sec', peq: true, onclick: () => CH.decidirControle(p.id, 'negar') }),
          U.btn(T('Sempre sem pedir', 'Always allow'), { tipo: 'sec', peq: true, titulo: T('Aceita agora e nas próximas vezes', 'Accept now and next time'), onclick: () => CH.sempreLiberar(p.id) })))));
    }
    // o que aparece no cadeado: só a bolha no canto, como no Parsec
    function pintarDicaLock() {
      const meuLock = E.lock && nosso();
      dicaSair.hidden = !meuLock; dicaSair.textContent = T('Pausar: ' + E.atalhoBolha() + ' ou START + SELECT + RB', 'Pause: ' + E.atalhoBolha() + ' or START + SELECT + RB') + (E.imersivo() ? T(' · imersivo', ' · immersive') : '');
      const mostra = meuLock || dicaLock.classList.contains('aberta'), alvo = alvoCtl(), preciso = meuLock && !E.mouseCapturado();
      const dica = preciso ? T('Clique no vídeo para capturar o mouse', 'Click the video to capture the mouse') : meuLock ? T(E.atalhoBolha() + ' abre este menu', E.atalhoBolha() + ' opens this menu') : T('Pausado', 'Paused');
      // (só refaz quando muda: refazer entre o apertar e o soltar do mouse fazia o clique na bolha se perder)
      const k = mostra ? meuLock + '|' + nomeCtl(alvo) + '|' + dica : '';
      if (k === dicaLock.dataset.k) return; dicaLock.dataset.k = k; dicaLock.textContent = '';
      if (!mostra) return;
      dicaLock.append(h('span', { class: 'bolha-ctl-ic' }, A.icone(meuLock ? 'controle' : 'cadeadoAberto', 20)),
        h('span', { class: 'bolha-ctl-tx' }, h('b', {}, T('Controlando ', 'Controlling ') + nomeCtl(alvo)), h('small', {}, dica)));
    }
    function menuBolha() {
      if (U._pop && U._pop.ancora === dicaLock) { U._pop.fechar(); if (!E.lock) return; } // clicou de novo: fecha; se voltou ao jogo com ela aberta, reabre e pausa
      dicaLock.classList.add('aberta');
      if (E.lock) E.sairLock('bolha');
      pintarDicaLock(); A.som.tocar('abrir');
      const corpo = h('div', { class: 'col', estilo: { gap: '8px', 'min-width': '230px' } },
        U.btn(T('Voltar ao jogo', 'Back to the game'), { icone: 'controle', tipo: 'ok', onclick: () => { pop.fechar(); entrarLockCh(); } }),
        h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Modo imersivo', 'Immersive mode')), h('div', { class: 'peq suave' }, T('Super, Alt+Tab e os outros atalhos vão só para o PC do amigo (abre em tela cheia).', 'Super, Alt+Tab and other shortcuts go only to your friend\'s PC (opens fullscreen).'))), U.chave(E.imersivo(), (on) => E.definirImersivo(on))),
        U.btn(T('Mostrar os botões', 'Show the buttons'), { icone: 'menu', tipo: 'sec', onclick: () => { pop.fechar(); esconderBarra(false); } }),
        U.btn(T('Sair do controle', 'Leave control'), { icone: 'sair', tipo: 'perigo', onclick: () => { pop.fechar(); CH.sairControle(); } }));
      const pop = U.popover(dicaLock, corpo, { largura: 290, titulo: T('Controle remoto', 'Remote control'), aoFechar: () => { dicaLock.classList.remove('aberta'); pintarDicaLock(); } });
    }
    dicaLock.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); menuBolha(); });
    dicaLock.addEventListener('mousedown', (e) => e.stopPropagation(), true); // o clique na bolha não vai para o jogo
    dicaLock.addEventListener('pointerdown', (e) => e.stopPropagation());
    palcoVideo.addEventListener('click', () => { if (E.lock && nosso()) E.capturarMouse(); });
    let ctlK = '';
    const pintarCtl = () => {
      if (!ch) return;
      const alvo = alvoCtl(), c = meuCtlCh, dono = souDono(), n = CH.controladores().length;
      parCtl.hidden = !(alvo || dono);
      let ic = 'controle', rot = T('Pedir para controlar', 'Ask to control');
      if (dono && !alvo) rot = T('Quem está jogando', 'Who is playing');
      else if (c && c.st === 'pedindo') rot = T('Aguardando a resposta... (clique para cancelar)', 'Waiting for an answer... (click to cancel)');
      else if (c && c.st === 'ativo') { ic = 'cadeado'; rot = T('Entrar no controle (bloqueia a interface)', 'Enter control (locks the interface)'); }
      else if (c && c.st === 'pausado') { ic = 'cadeadoAberto'; rot = T('Retomar o controle', 'Resume control'); }
      const k = ic + rot + n + (c ? c.st : '');
      if (k !== ctlK) {
        ctlK = k;
        seloCtl.hidden = !(dono && n); seloCtl.textContent = n;
        bCtl.replaceChildren(A.icone(ic, 22), seloCtl); bCtl.title = rot; bCtl.setAttribute('aria-label', rot);
        bCtl.classList.toggle('ativo', !!(c && c.st === 'ativo')); bCtl.classList.toggle('esperando', !!(c && c.st === 'pedindo'));
      }
      // os cursores dos amigos só em cima de uma tela no modo jogo
      const p = ch.ui && ch.ui.palcoAtual;
      const jogoNoPalco = !!(p && p.tipo === 'tela' && (p.eu ? dono : (ch.pares.get(p.chave) || {}).modo === 'jogo'));
      camCur.el.hidden = !jogoNoPalco;
      document.documentElement.toggleAttribute('data-cham-jogo', jogoNoPalco && ch.modo === 'max'); // sem desfoque ao vivo por cima do jogo (app.css)
      pintarPedidos();
    };
    const offsCtl = [
      A.evt.on('entrada:lock', pintarDicaLock), A.evt.on('entrada:mouse', pintarDicaLock), A.evt.on('entrada:mira', pintarDicaLock), A.evt.on('entrada:pausa', pintarDicaLock), A.evt.on('entrada:imersivo', pintarDicaLock),
      A.evt.on('entrada:cursores', () => camCur.desenhar()),
      A.evt.on('pad:combo-cadeado', () => { if (nosso() && !E.lock && alvoCtl() && E.podeEntrar()) { if (U._pop && U._pop.ancora === dicaLock) U._pop.fechar(); entrarLockCh(); } }), // START + SELECT + RB: volta para o jogo
      A.evt.on('entrada:bolha', () => { if (nosso() && E.lock) menuBolha(); }), // (0.7.9) o atalho e o combo do controle abrem a bolha, sem mostrar os botões
      A.evt.on('entrada:lock-fim', (motivo) => { if (!nosso() || motivo === 'bolha' || motivo === 'fim' || motivo === 'fechar' || motivo === 'sala') return; U.toast(T('Controle pausado. Use o cadeado para voltar a jogar.', 'Control paused. Use the lock to play again.'), { ms: 3600, som: 'fechar' }); pintarCtl(); }),
      A.evt.on('entrada:slot', (m) => { if (nosso()) U.toast(T('Você é o jogador ', 'You are player ') + (m.slot + 1), { tipo: 'ok', ms: 3000 }); }),
      A.evt.on('entrada:cap', (c) => { if (nosso() && !c.mouse && !c.teclado && !c.gamepad) U.toast(T('O computador de quem compartilha ainda não aceita controle de fora. Você aparece como cursor.', 'The sharer\'s computer does not accept remote input yet. You show up as a cursor.'), { ms: 6000 }); }),
      A.evt.on('chctl:ctl-meu', ({ antes, depois }) => {
        pintarCtl(); pintarDicaLock();
        if (depois && depois.st === 'ativo' && !(antes && (antes.st === 'ativo' || antes.st === 'pausado'))) {
          U.toast(T('Liberado! Você está controlando a tela de ', 'Granted! You are controlling the screen of ') + nomeCtl(ch && ch.pares.get(depois.dono)), { tipo: 'ok', ms: 3200 });
          if (A.cfg.v.entrada.lockAuto !== false) setTimeout(entrarLockCh, 200);
        }
      }),
      A.evt.on('chctl:input-fim', (m) => { pintarCtl(); U.toast(m && m.negado ? T('O controle não foi liberado.', 'Control was not granted.') : T('Seu controle foi encerrado.', 'Your control has ended.'), { ms: 3200, som: 'parar' }); }),
      A.evt.on('chctl:ctl', () => pintarCtl()),
    ];
    const par = (...x) => h('div', { class: 'par cham-par' }, ...x.filter(Boolean));
    const barra = h('div', { class: 'cham-barra' },
      // (1.0.0) em blocos, do mais usado para o menos: a voz (microfone, som), o vídeo (câmera, tela, controle), o desligar no meio;
      // depois a conversa (chat, música) e, por fim, a janela (sinal, janelinha, esconder)
      h('div', { class: 'cham-grupo' }, par(bMic, setaMic), par(bSom, setaSom), h('i', { class: 'cham-div', 'aria-hidden': 'true' }), bCam ? par(bCam, setaCam) : null, bTela ? par(bTela, setaTela) : null, parCtl),
      bFim,
      h('div', { class: 'cham-grupo' }, bChat, A.integChamada ? A.integChamada(ch, rb) : null, h('i', { class: 'cham-div', 'aria-hidden': 'true' }), bSinal, bModo, bRecolher)); // (0.8.7) Música junto na chamada; (1.0.2) com mais de uma integração, o botão vira um + (integchamada.js)
    const barraArr = A.ui.arrastar(barra, barra, { fixar: true, quando: () => ch && ch.modo === 'max' && !matchMedia('(max-width: 680px)').matches }); // (0.6.0) a barra de botões dá para arrastar
    // cabeçalho: nome da conversa e tempo; à direita, janelinha/maximizar e minimizar
    const bMax = rb('expandir', T('Maximizar', 'Maximize'), () => CH.modo('max')); bMax.classList.add('so-pip');
    const bPip = rb('pip', T('Janelinha', 'Small window'), () => CH.modo('pip')); bPip.classList.add('so-max');
    const bMin = rb('minimizar', T('Minimizar', 'Minimize'), () => CH.modo('mini'));
    [bMax, bPip, bMin].forEach((b) => b.classList.add('peq'));
    const cab = h('header', { class: 'cham-cab' }, miniAvs, h('div', { class: 'cresce cham-titulo' }, h('b', {}, ch.titulo), estado), bMax, bPip, bMin);
    // pílula (minimizada): microfone, desligar e abrir
    const miniMic = rb('mic', T('Microfone', 'Microphone'), () => CH.mudo());
    const mini = h('div', { class: 'cham-mini' }, miniMic, rb('desligarTel', T('Desligar', 'Hang up'), () => CH.desligar(), 'perigo'), rb('expandir', T('Abrir a chamada', 'Open the call'), () => CH.modo('max')));
    const brilho = h('div', { class: 'cham-ceu', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i'));
    const el = h('div', { class: 'cham-janela', role: 'dialog', 'aria-label': T('Chamada com ', 'Call with ') + ch.titulo },
      brilho, cab, palco, pessoas, horizonte, euTile, barra, puxador, mini, chatBox);
    euTile.querySelector('.cham-quadro').addEventListener('click', () => CH.focar('eu'));
    el.addEventListener('click', (ev) => { if (ch && ch.modo === 'mini' && !ev.target.closest('.btn')) CH.modo('max'); });
    const tecla = (ev) => { if (ev.key === 'Escape' && ch && ch.ui && ch.ui.palco.classList.contains('cheio')) { ev.stopPropagation(); CH._telaCheia(false); return; } if (ev.key === 'Escape' && ch && ch.modo === 'max' && !document.querySelector('#modais .pop, #modais .modal')) CH.modo(modoPequeno()); };
    document.addEventListener('keydown', tecla);
    // (0.6.0) janelinha e pílula arrastáveis por qualquer parte (os botões continuam botões); a pílula fica onde você soltou
    const arrJanela = A.ui.arrastar(el, el, { chave: () => 'cham-' + ((ch && ch.modo) || 'pip'), quando: () => ch && (ch.modo === 'pip' || ch.modo === 'mini') && !matchMedia('(max-width: 680px)').matches });
    if (A.extras && A.extras.pintarTelaChamada) A.extras.pintarTelaChamada(el); // (1.0.2) a cor, a imagem, as bolhas e os acessórios que você escolheu para a sua tela
    document.body.append(el);
    ch.ui = { el, arrJanela, pessoas, canto, cantoEls: new Map(), palco, palcoVideo, palcoNome, palcoAv, palcoMidia, zoomTxt, estado, miniAvs, bMic, bCam, bTela, bSom, bSinal, msEl, miniMic, euTile, euVideo, abrirChat, chatAberto: () => !chatBox.hidden, pintarCtl, limpar: () => { offsCtl.forEach((f) => f()); camCur.limpar(); if (E.lock && nosso()) E.sairLock('fim'); document.removeEventListener('keydown', tecla); if (palco.classList.contains('cheio')) telaCheia(false); if (chatCx) chatCx.limpar(); } };
    CH.ativa = ch; garantirCtx();
    for (const par of ch.pares.values()) pessoas.append(tilePar(par));
    CH.modo('max');
    ch.timers.push(setInterval(() => { if (S().peersChamada.size && !S().ativa) S().medirJogo(); }, 1000)); // (na sala é ela que mede)
    ch.timers.push(setInterval(pintarTudo, 1000), setInterval(medirFalas, 150), setInterval(medirSinal, 1000), setInterval(CH.ajustarJanela, 400));
    A.evt.emit('chamada:inicio');
  }
  // a janelinha pode ser arrastada pelo topo (fica onde você deixar)
})();
