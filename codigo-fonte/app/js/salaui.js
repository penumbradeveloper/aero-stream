// Aero Stream - tela da sala: o palco (vídeo + cursores dos amigos), a barra que se esconde sozinha (som, microfone, compartilhar,
// chat, pessoas, controle remoto, janelinha), a lista fixa de pedidos de controle, o bloqueio (cadeado) e a moderação.
// Os painéis das setinhas (som, microfone, compartilhar) estão em mixer.js. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T, S = A.sala, H = A.hub, API = A.api, E = A.entrada;

  // Seletor da cor do seu cursor (os amigos veem o seu cursor nessa cor)
  // (0.7.6) a chamada do Aero Talk usa o mesmo seletor (definir: para onde vai a cor escolhida)
  function seletorCor(definir) {
    const def = definir || S.definirCursor;
    const atual = () => A.cfg.v.entrada.cor || '';
    const caixa = h('div', { class: 'linha cores-cursor', role: 'group', 'aria-label': T('Cor do seu cursor', 'Your cursor color') });
    const pintar = () => {
      caixa.textContent = '';
      caixa.append(h('button', { type: 'button', class: 'amostra auto' + (!atual() ? ' sel' : ''), title: T('Automática', 'Automatic'), 'aria-label': T('Automática', 'Automatic'), dados: { mudo: '1' }, onclick: () => { def(''); pintar(); } }, 'A'));
      E.CORES.forEach((c) => caixa.append(h('button', { type: 'button', class: 'amostra' + (atual() === c ? ' sel' : ''), 'aria-label': c, dados: { mudo: '1' }, estilo: { background: c }, onclick: () => { def(c); pintar(); } })));
    };
    pintar();
    return caixa;
  }
  U.seletorCor = seletorCor;

  A.telas.sala = (el, dados) => {
    el.classList.add('sala');
    const offs = [], nomes = {};
    let focoId = null, infoVisivel = true, ocultarT = 0, modalPessoas = null, zonaI = -1;
    const ehHost = () => S.papel === 'host';
    const podeAprovar = () => ehHost() || (S.lider && S.lider === S.id); // o host saiu: quem entrou logo depois dele aprova os pedidos
    const guardarNomes = () => S.participantes.forEach((p) => { nomes[p.id] = p; });
    const nomeDe = (id) => (nomes[id] || S.participante(id) || { nome: '?' }).nome;
    const toastsPedido = new Map(); // avisos "fulano quer entrar" ainda na tela (somem quando o pedido é decidido)
    const modalAberto = () => !!document.querySelector('#modais .fundo-modal:not(.fechando)');
    const popAberto = () => !!U._pop;

    // ---------- palco (vídeo) ----------
    const video = h('video', { playsinline: '', autoplay: '' });
    video.muted = true; // o som sai pelo Web Audio (volume funciona até no iPhone)
    const cam = E.camada(video);
    const vazio = h('div', { class: 'sala-vazio' });
    const minis = h('div', { class: 'minis' }); let minisK = '';
    const info = h('div', { class: 'sala-info', hidden: true });
    const topo = h('div', { class: 'sala-topo' });
    const pedidos = h('div', { class: 'pedidos-ctl', 'aria-live': 'polite' });
    // Modo jogo (cadeado): a ÚNICA interface é esta bolha no canto (como no Parsec). Passar o mouse mostra quem você controla; clicar pausa o
    // controle e abre o menu (voltar ao jogo, mostrar os botões, sair). Clicar em qualquer interface desconecta a entrada do jogo.
    const dicaLock = h('button', { type: 'button', class: 'bolha-ctl', 'aria-label': T('Menu do controle remoto', 'Remote control menu') });
    // (0.7.2) presa ao lado da bolha, no jogo: como sair (antes não estava escrito em lugar nenhum). E, com o mouse solto, o aviso no meio
    const dicaSair = h('div', { class: 'bolha-ctl-dica', 'aria-hidden': 'true' });
    const aguardo = h('div', { class: 'sala-aguardo', hidden: true }, h('div', { class: 'vidro pad col', estilo: { 'align-items': 'center', 'text-align': 'center', gap: '12px', padding: '28px' } },
      h('div', { class: 'btn redondo', estilo: { 'pointer-events': 'none', animation: 'respirar 2.4s ease-in-out infinite' } }, A.icone('pessoas', 24)),
      h('h2', {}, T('Aguardando o host aceitar você...', 'Waiting for the host to let you in...')), h('div', { class: 'suave peq' }, T('Assim que ele aceitar, você entra.', 'You will join as soon as they accept.')), U.btn(T('Sair', 'Leave'), { tipo: 'sec', onclick: () => sair(true) })));

    function pintarVazio() {
      vazio.textContent = '';
      if (!S.admitido) return;
      if (S.local.tela && S.local.kms) { // (0.7.4) captura direta da placa: não há prévia (seria só um quadro cinza), e ela também viraria espelho
        const inf = (A.kms && A.kms.info()) || {};
        vazio.append(A.icone('enviarTela', 54), h('h2', {}, T('Você está transmitindo direto da placa', 'You are streaming straight from the GPU')),
          h('div', { class: 'peq', estilo: { opacity: '.85', 'max-width': '440px' } }, T('Captura direta (como o Sunshine): a sua tela inteira vai para quem assiste sem passar por cópias, ', 'Direct capture (like Sunshine): your whole screen goes to viewers with no copies, ') + (inf.larg ? inf.larg + '×' + inf.alt + ' · ' + inf.alvoFps + ' fps' : '') + T('. A prévia fica escondida aqui para não criar o efeito espelho.', '. The preview stays hidden here to avoid the mirror effect.')),
          typeof VideoDecoder === 'function' ? U.btn(T('Mostrar a prévia mesmo assim', 'Show the preview anyway'), { tipo: 'sec', onclick: () => { A.cfg.v.host.preview = 'sempre'; A.cfg.salvar(); atualizarPalco(); } }) : null);
        return;
      }
      if (S.local.tela && !S.previewSeguro()) { // transmitindo, mas a prévia ficaria como um espelho infinito
        vazio.append(A.icone('enviarTela', 54), h('h2', {}, T('Você está transmitindo', 'You are sharing')),
          h('div', { class: 'peq', estilo: { opacity: '.85', 'max-width': '420px' } }, T('A prévia fica escondida para não criar o efeito espelho (a sua tela aparecendo dentro dela mesma). Quem assiste vê tudo normalmente.', 'The preview is hidden to avoid the mirror effect (your screen showing inside itself). Viewers see everything normally.')),
          U.btn(T('Mostrar a prévia mesmo assim', 'Show the preview anyway'), { tipo: 'sec', onclick: () => { A.cfg.v.host.preview = 'sempre'; A.cfg.salvar(); atualizarPalco(); } }));
        return;
      }
      const sozinho = S.participantes.length <= 1;
      vazio.append(A.icone(ehHost() ? 'enviarTela' : 'olho', 54),
        h('h2', {}, ehHost() ? (sozinho ? T('Sala pronta!', 'Room ready!') : T('Você ainda não está compartilhando', 'You are not sharing yet')) : T('Ninguém está compartilhando ainda', 'Nobody is sharing yet')),
        h('div', { class: 'peq', estilo: { opacity: '.8' } }, ehHost() && sozinho ? T('Passe o código ', 'Share the code ') : '', ehHost() && sozinho ? h('b', { class: 'selecionavel' }, S.sala) : '', ehHost() && sozinho ? T(' para os seus amigos.', ' with your friends.') : T('Quando alguém começar, a tela aparece aqui.', 'When someone starts, the screen shows up here.')),
        A.plat.podeCompartilhar ? U.btn(T('Compartilhar minha tela', 'Share my screen'), { icone: 'enviarTela', onclick: alternarCompartilhar }) : null);
    }

    const vistas = () => {
      const v = [];
      if (S.local.tela && S.previewSeguro()) v.push({ id: 'local', stream: S.streamPrevia(), nome: T('Você', 'You'), peerId: null });
      for (const r of S.remotas.values()) if (r.tela) v.push({ id: r.id, stream: r.stream, nome: nomeDe(r.peerId), peerId: r.peerId });
      return v;
    };
    const principalAtual = () => vistas().find((x) => x.id === focoId) || null;
    // quem é o "dono" da tela que estou vendo, quando ela está em modo jogo (dá para pedir o controle)
    const alvoControle = () => {
      const p = principalAtual();
      if (!p) return S.participantes.find((q) => q.id !== S.id && q.comp && q.modo === 'jogo') || null; // (0.7.8) a imagem ainda não chegou: o botão não espera por ela
      if (p.id === 'local') return null;
      const q = S.participante(p.peerId);
      return q && q.comp && q.modo === 'jogo' ? q : null;
    };
    const cursoresAtivos = () => {
      const p = principalAtual(); if (!p) return false;
      if (p.id === 'local') return S.local.modo === 'jogo';
      const q = S.participante(p.peerId);
      return !!(q && q.modo === 'jogo');
    };

    // (0.5.9-6) a prévia da SUA tela não é desenhada enquanto você está em outra janela (no jogo): ela continuava sendo pintada a 60 fps atrás
    // do jogo e disputava a placa com ele. Quem assiste não muda nada; ao voltar para o Aero, a prévia volta.
    const pausarPrevia = () => { if (mostrando && (mostrando === S.local.tela || mostrando === S.streamPrevia()) && !video.paused && (!document.hasFocus() || document.hidden)) video.pause(); };
    const voltarPrevia = () => { if (mostrando && video.paused) video.play().catch(() => {}); };
    addEventListener('blur', pausarPrevia); addEventListener('focus', voltarPrevia);
    const visPrevia = () => (document.hidden ? pausarPrevia() : voltarPrevia());
    document.addEventListener('visibilitychange', visPrevia);
    offs.push(() => { removeEventListener('blur', pausarPrevia); removeEventListener('focus', voltarPrevia); document.removeEventListener('visibilitychange', visPrevia); });
    let mostrando = null; // stream atualmente no vídeo
    // (0.7.7) imagem verde na tela de um amigo (veja gpu.js)
    const verde = {}, tVerde = setInterval(() => { const p = principalAtual(); if (p && p.peerId && !video.hidden) A.gpu.vigiarVerde(verde, video, () => S.avisarVerde(p.peerId), () => S.receptorProprio(p.peerId)); else verde.n = 0; }, 1000);
    offs.push(() => clearInterval(tVerde));
    // (0.7.8) tela preta e controle mudo: a cada segundo confere se quem está no ar tem imagem aqui e se o canal do controle está aberto. Tudo do
    // lado de quem assiste: pede um quadro inteiro (só para esta pessoa), religa o vídeo e, por último, refaz só esta conexão.
    const semTela = {}; let pretoS = 0, dcS = 0;
    const tImagem = setInterval(() => {
      if (!S.admitido || S.status !== 'ativa') return;
      const comTela = new Set(vistas().map((x) => x.peerId));
      for (const q of S.participantes) {
        const falta = q.id !== S.id && q.comp && !q.ausente && !comTela.has(q.id);
        semTela[q.id] = falta ? (semTela[q.id] || 0) + 1 : 0;
        if (semTela[q.id] >= 4) { semTela[q.id] = 0; S.reatar(q.id); }
      }
      const p = principalAtual();
      if (p && p.peerId && !video.hidden) {
        if (video.paused) video.play().catch(() => {});
        pretoS = video.videoWidth ? 0 : pretoS + 1;
        if (pretoS && pretoS % 3 === 0) S.enviarDC(p.peerId, { t: 'quadro' });
        if (pretoS === 7) { video.srcObject = null; video.srcObject = p.stream; video.play().catch(() => {}); }
        if (pretoS >= 12) { pretoS = 0; S.reatar(p.peerId, true); }
      } else pretoS = 0;
      const c = S.meuCtl();
      dcS = c && c.st !== 'pedindo' && !S.dcAberto(c.dono) ? dcS + 1 : 0;
      if (dcS >= 4) { dcS = 0; S.reatar(c.dono, true); }
    }, 1000);
    offs.push(() => clearInterval(tImagem));
    function atualizarPalco() {
      const v = vistas();
      if (!v.some((x) => x.id === focoId)) focoId = (v.find((x) => x.id !== 'local') || v[0] || {}).id || null;
      const principal = v.find((x) => x.id === focoId);
      if (principal) {
        if (mostrando !== principal.stream) {
          const aparecendo = !mostrando;
          mostrando = principal.stream; video.srcObject = principal.stream; video.play().catch(() => {});
          if (aparecendo) { palco.classList.remove('abrindo'); void palco.offsetWidth; palco.classList.add('abrindo'); A.som.tocar('compartilhar'); }
        }
        video.hidden = false; vazio.hidden = true;
      } else if (mostrando) {
        mostrando = null; // a tela fecha com uma animação
        video.classList.add('fechando'); A.som.tocar('parar');
        setTimeout(() => { video.classList.remove('fechando'); if (!mostrando) { video.srcObject = null; video.hidden = true; vazio.hidden = false; pintarVazio(); } }, 360);
      } else { video.hidden = true; vazio.hidden = false; pintarVazio(); }
      const novoFoco = principal && principal.id !== 'local' ? principal.id : null;
      if (S.foco !== novoFoco) S.focar(novoFoco);
      // miniaturas das outras telas. (0.7.6) só refaz quando elas mudam: antes cada aviso da sala (alguém mutou, entrou, pediu o controle)
      // recriava os vídeos das miniaturas (decodificação e imagem recomeçando, um tranco a cada vez)
      const outras = v.filter((x) => x.id !== focoId), km = outras.map((x) => x.id + ':' + (x.stream && x.stream.id) + ':' + x.nome).join('|');
      if (km !== minisK) { minisK = km; minis.textContent = ''; }
      if (minis.childElementCount !== outras.length) outras.forEach((x) => {
        const mv = h('video', { playsinline: '', autoplay: '' }); mv.muted = true; mv.srcObject = x.stream; mv.play().catch(() => {});
        minis.append(h('div', { class: 'mini-video', role: 'button', tabindex: '0', title: x.nome, onclick: () => { focoId = x.id; A.som.tocar('abrir'); atualizarPalco(); } }, mv, h('div', { class: 'peq', estilo: { padding: '3px 8px', background: 'rgba(0,0,0,.55)', color: '#fff' } }, x.nome)));
      });
      cam.el.hidden = !cursoresAtivos() || A.cfg.v.entrada.mostrarCursores === false; cam.desenhar();
      // (0.7.6) vendo um jogo: sem desfoque ao vivo por cima do vídeo (app.css)
      document.documentElement.toggleAttribute('data-video-jogo', !!(principal && (principal.id === 'local' ? S.local.modo === 'jogo' : alvoControle() || (S.participante(principal.peerId) || {}).modo === 'jogo')));
      atualizarInfo(principal); atualizarBarra(); atualizarControle();
    }

    // ---------- números ao vivo (HUD) ----------
    function atualizarInfo(principal) {
      if (!principal || !infoVisivel) { info.hidden = true; return; }
      info.hidden = false;
      if (principal.id === 'local') {
        const n = S.participantes.length - 1, e = S.envio;
        const pessoas = n + (n === 1 ? T(' pessoa', ' person') : T(' pessoas', ' people'));
        if (!e) { info.textContent = T('Sua transmissão · ', 'Your stream · ') + pessoas; return; }
        const alvo = e.alvo ? `/${e.alvo}` : '';
        info.textContent = `${T('Captura', 'Capture')} ${e.captura || '?'} · ${T('enviando', 'sending')} ${Math.round(e.fps)}${alvo} fps · ${e.w}×${e.h} · ${(e.kbps / 1000).toFixed(1)} Mbps · ${e.hw ? 'GPU' : 'CPU'}${e.impl ? ' (' + String(e.impl).slice(0, 28) + ')' : ''} · ${pessoas}`;
        info.classList.toggle('alerta', !!e.alvo && e.fps < e.alvo * 0.9);
        return;
      }
      info.classList.remove('alerta');
      const e = S.estat[principal.peerId] || {};
      info.textContent = `${principal.nome} · ${Math.round(e.fps || 0)} fps` + (e.w ? ` · ${e.w}×${e.h}` : '') + ` · ${((e.kbps || 0) / 1000).toFixed(1)} Mbps` + (e.rtt != null ? ` · ${e.rtt} ms` : '') + (e.caminho ? ' · ' + (e.caminho === 'rele' ? T('via relé', 'via relay') : T('direto', 'direct')) : '');
    }

    // ---------- chips de participantes ----------
    const chips = new Map();
    function atualizarTopo() {
      const ids = new Set(S.participantes.map((p) => p.id));
      [...chips].forEach(([id, c]) => { if (!ids.has(id)) { c.remove(); chips.delete(id); } });
      S.participantes.forEach((p) => {
        let c = chips.get(p.id);
        if (!c) { c = h('div', { class: 'chip vidro', role: 'button', tabindex: '0' }); c.onclick = () => U.perfil(S.participante(c.pid) || p); chips.set(p.id, c); topo.append(c); }
        c.pid = p.id; c.className = 'chip vidro' + (p.comp ? ' comp' : '');
        c.textContent = '';
        const joga = p.ctl && p.ctl.st !== 'pedindo' && p.ctl.dono;
        c.append(U.avatar(p, 32), h('span', {}, p.id === S.id ? T('Você', 'You') : p.nome), p.host ? A.icone('coroa', 15) : null, p.mic ? A.icone('mic', 14) : null,
          joga ? h('i', { class: 'joga', title: T('Controlando uma tela', 'Controlling a screen'), estilo: { '--c': E.corDe(p) } }, A.icone('controle', 13)) : null);
      });
      let aviso = topo.querySelector('.aviso-host');
      const precisa = !S.hostOnline && S.admitido && !ehHost();
      if (precisa && !aviso) topo.append(h('div', { class: 'chip vidro aviso-host', estilo: { 'padding-left': '14px', color: 'var(--aviso)' } }, T('Host offline: a sala continua e ele pode voltar', 'Host offline: the room stays open and they can come back')));
      else if (!precisa && aviso) aviso.remove();
      let lat = topo.querySelector('.lat-chip');
      const rtt = !ehHost() && S.hostId && S.estat[S.hostId] ? S.estat[S.hostId].rtt : null;
      if (rtt != null) { if (!lat) { lat = h('div', { class: 'chip vidro lat-chip', estilo: { 'margin-left': 'auto' } }); topo.append(lat); } lat.textContent = ''; lat.append(h('span', { class: 'lat' }, h('i', { class: rtt > 150 ? 'ruim' : rtt > 70 ? 'med' : '' }), rtt + ' ms')); }
    }

    // ---------- barra inferior (se esconde sozinha) ----------
    const volIcone = () => (S.volume === 0 ? 'mudo' : S.volume < 0.34 ? 'volume0' : S.volume < 0.67 ? 'volume1' : 'volume');
    let ultimoVol = 0.7;
    const rd = (icone, titulo, onclick, tipo = 'sec') => U.btn('', { icone, tipo, redondo: true, titulo, onclick });
    // A setinha abre a janelinha; apertar a MESMA setinha com a janelinha aberta fecha (antes ela fechava e abria de novo, sem parar)
    const seta = (titulo, onclick) => {
      const b = U.btn('', { icone: 'chevron', tipo: 'sec', redondo: true, peq: true, titulo });
      b.addEventListener('click', () => { if (U._pop && U._pop.ancora === b) { U._pop.fechar(); return; } onclick(); });
      b.classList.add('seta'); b.setAttribute('aria-haspopup', 'dialog'); return b;
    };
    const par = (...f) => h('div', { class: 'par' }, ...f);

    const btnSom = rd(volIcone(), T('Som (mudo geral)', 'Sound (mute all)'), () => { S.reativarAudio(); if (S.volume > 0) { ultimoVol = S.volume; S.definirVolume(0); A.som.tocar('som-off'); } else { S.definirVolume(ultimoVol || 0.7); A.som.tocar('som-on'); } atualizarBarra(); });
    const setaSom = seta(T('Saída, volumes e aplicativos', 'Output, volumes and apps'), () => A.mixer.audio(setaSom));
    const btnMic = rd('micOff', T('Microfone (M)', 'Microphone (M)'), async () => { try { await S.mic(!S.micLigado()); } catch (e) { U.toast(T('Não consegui usar o microfone.', 'Could not use the microphone.'), { tipo: 'erro' }); } atualizarBarra(); });
    const setaMic = seta(T('Opções do microfone', 'Microphone options'), () => A.mixer.mic(setaMic));
    const btnComp = rd('enviarTela', T('Compartilhar minha tela', 'Share my screen'), () => alternarCompartilhar());
    const setaComp = seta(T('Opções de compartilhamento', 'Sharing options'), () => A.mixer.compartilhar(setaComp, { alternar: alternarCompartilhar }));
    const btnChat = rd('chat', T('Chat (C)', 'Chat (C)'), () => chat(!el.classList.contains('chat-aberto')));
    const seloChat = h('span', { class: 'selo', hidden: true }); btnChat.append(seloChat);
    const btnPessoas = rd('pessoas', T('Pessoas', 'People'), () => abrirPessoas());
    const seloPessoas = h('span', { class: 'selo', hidden: true }); btnPessoas.append(seloPessoas);
    const btnCtl = rd('controle', T('Controle remoto', 'Remote control'), () => acaoControle());
    const seloCtl = h('span', { class: 'selo', hidden: true }); btnCtl.append(seloCtl);
    const setaCtl = seta(T('Opções do controle', 'Control options'), () => popoverControle(setaCtl));
    const parCtl = par(btnCtl, setaCtl); parCtl.hidden = true;
    const btnOpc = rd('ajustes', T('Opções', 'Options'), () => abrirOpcoes());
    const btnTela = rd('expandir', T('Tela cheia (F)', 'Fullscreen (F)'), () => U.tela.alternar()); // a página inteira: janelinhas, avisos e a bolha continuam aparecendo
    // Tela cheia: a seta grande recolhe a barra. Recolhida, ela NÃO volta com qualquer movimento do mouse (para assistir/jogar em paz):
    // só levando o mouse até a borda de baixo e continuando a descer, tocando no puxador, ou com o X do controle.
    const btnRecolher = rd('chevron', T('Esconder os botões (para mostrar de novo, leve o mouse até a borda de baixo)', 'Hide the buttons (to show them again, move the mouse to the bottom edge)'), () => recolher(true));
    btnRecolher.classList.add('recolher'); btnRecolher.hidden = true;
    const puxador = h('button', { class: 'puxador', type: 'button', hidden: true, title: T('Mostrar os botões', 'Show the buttons'), 'aria-label': T('Mostrar os botões', 'Show the buttons'), onclick: () => recolher(false) });
    let recolhida = false;
    function atualizarRecolher() { btnRecolher.hidden = !(U.tela.cheia() || temControle()); }
    function recolher(on) {
      if (on && temControle() && E.podeEntrar()) { barra.classList.add('oculta'); clearTimeout(ocultarT); entrarLock(); return; } // com o controle do amigo: recolher = voltar ao jogo (a bolha volta)
      if (recolhida === on) return;
      recolhida = on; barra.classList.toggle('recolhida', on); puxador.hidden = !on;
      if (on) { clearTimeout(ocultarT); barra.classList.add('oculta'); if (barra.contains(document.activeElement)) document.activeElement.blur(); A.som.tocar('fechar'); }
      else { A.som.tocar('abrir'); mostrarBarra(); }
    }
    const btnMenu = rd('pip', T('Voltar ao menu (a sala continua em uma janelinha)', 'Back to menu (the room keeps running in a small window)'), () => irMenu());
    const btnSair = rd('sair', T('Sair da sala', 'Leave room'), () => sair(true), 'perigo');
    const barra = h('div', { class: 'barra vidro', role: 'toolbar' }, A.api.eu ? btnMenu : null, A.api.eu ? h('i', { class: 'div' }) : null, par(btnSom, setaSom), par(btnMic, setaMic), A.plat.podeCompartilhar ? par(btnComp, setaComp) : null, btnChat, btnPessoas, parCtl, btnOpc, btnTela, btnRecolher, h('i', { class: 'div' }), btnSair);

    function atualizarBarra() {
      btnSom.replaceChildren(A.icone(volIcone(), 22));
      btnMic.classList.toggle('ativo', S.micLigado()); btnMic.replaceChildren(A.icone(S.micLigado() ? 'mic' : 'micOff', 22));
      btnComp.classList.toggle('ativo', !!S.local.tela); btnComp.title = S.local.tela ? T('Parar de compartilhar', 'Stop sharing') : T('Compartilhar minha tela', 'Share my screen');
      const pend = (podeAprovar() ? S.pendentes.length : 0) + S.pedidosParaMim().length; seloPessoas.hidden = !pend; seloPessoas.textContent = pend; U.marcarSelo(seloPessoas);
      seloChat.hidden = !S.naoLidas; seloChat.textContent = S.naoLidas; U.marcarSelo(seloChat);
    }
    function mostrarBarra() {
      if (E.lock || recolhida) return;
      barra.classList.remove('oculta'); clearTimeout(ocultarT);
      ocultarT = setTimeout(() => { if (!barra.matches(':hover') && !barra.contains(document.activeElement) && !modalAberto() && !popAberto() && document.activeElement !== inp) barra.classList.add('oculta'); }, 3000);
    }

    async function alternarCompartilhar() {
      try {
        if (S.local.tela) { S.pararCompartilhar(); return; }
        let fonte = { id: null };
        if (A.plat.desktop) { fonte = await U.escolherFonte(); if (!fonte) return; }
        const c = A.cfg.v.host;
        await S.compartilhar({ fonteId: fonte.id, fonte: fonte.id ? fonte : null, modo: c.modo, preset: A.gpu.presetUsuario(), audio: c.audio, apps: c.appsCaptura });
      } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') U.toast(e.message || String(e), { tipo: 'erro' }); }
      atualizarBarra();
    }

    // ---------- controle remoto: o botão, o cadeado e a lista de pedidos ----------
    function acaoControle() {
      const alvo = alvoControle(), c = S.meuCtl();
      if (!alvo && !(S.local.tela && S.local.modo === 'jogo')) return;
      if (!alvo) { if (U._pop && U._pop.ancora === btnCtl) U._pop.fechar(); else popoverControle(btnCtl); return; } // quem transmite: vê quem está jogando (apertar de novo fecha)
      if (!c) { S.pedirControle(alvo.id); A.som.tocar('click'); return; }
      if (c.st === 'pedindo') { S.sairControle(); return; }
      entrarLock();
    }
    function entrarLock() {
      if (!E.podeEntrar()) return;
      E.entrarLock(video);
    }
    function atualizarControle() {
      const alvo = alvoControle(), c = S.meuCtl(), dono = S.local.tela && S.local.modo === 'jogo';
      const ctl = S.controladores(S.id).length;
      parCtl.hidden = !(alvo || dono);
      seloCtl.hidden = !(dono && ctl); seloCtl.textContent = ctl; U.marcarSelo(seloCtl);
      setaCtl.hidden = false; // (0.6.9) a setinha aparece sempre junto do botão (antes, para quem assiste, só depois de clicar nele)
      let ic = 'controle', rot = T('Pedir para controlar', 'Ask to control');
      if (dono && !alvo) rot = T('Quem está jogando', 'Who is playing');
      else if (c && c.st === 'pedindo') { rot = T('Aguardando o host... (clique para cancelar)', 'Waiting for the host... (click to cancel)'); }
      else if (c && c.st === 'ativo') { ic = 'cadeado'; rot = T('Entrar no controle (bloqueia a interface)', 'Enter control (locks the interface)'); }
      else if (c && c.st === 'pausado') { ic = 'cadeadoAberto'; rot = T('Retomar o controle', 'Resume control'); }
      btnCtl.replaceChildren(A.icone(ic, 22)); btnCtl.title = rot; btnCtl.setAttribute('aria-label', rot);
      btnCtl.classList.toggle('ativo', !!(c && c.st === 'ativo'));
      btnCtl.classList.toggle('esperando', !!(c && c.st === 'pedindo'));
      pintarPedidos(); atualizarRecolher();
    }

    // (0.8.6) "Sempre sem pedir" fica guardado neste aparelho pela conta da pessoa: vale ao ela sair e voltar, numa sala nova e quando
    // você recria a sala (antes valia só naquela sala, e quem entrava sem conta perdia na hora)
    function lembrarLivre(p, sim) {
      if (!p || !p.codigo) return;
      const l = A.cfg.v.salaLivre || (A.cfg.v.salaLivre = {});
      if (sim) l[p.codigo] = 1; else delete l[p.codigo];
      A.cfg.salvar();
    }
    const livreGuardado = (p) => !!(p && p.codigo && (A.cfg.v.salaLivre || {})[p.codigo]);
    // lista FIXA de pedidos: não some sozinha como um aviso; fica até alguém decidir
    function pintarPedidos() {
      const lista = S.pedidosParaMim();
      pedidos.hidden = !lista.length;
      pedidos.textContent = '';
      lista.forEach((p) => {
        pedidos.append(h('div', { class: 'pedido vidro', role: 'group', 'aria-label': p.nome },
          U.avatar(p, 34), h('div', { class: 'cresce' }, h('b', {}, p.nome), h('div', { class: 'peq suave' }, T('quer controlar a sua tela', 'wants to control your screen'))),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', 'justify-content': 'flex-end', gap: '6px' } },
            U.btn(T('Aceitar', 'Accept'), { tipo: 'ok', peq: true, onclick: () => S.decidirControle(p.id, 'aprovar') }),
            U.btn(T('Negar', 'Deny'), { tipo: 'sec', peq: true, onclick: () => S.decidirControle(p.id, 'negar') }),
            U.btn(T('Sempre sem pedir', 'Always allow'), { tipo: 'sec', peq: true, titulo: T('Aceita agora e nas próximas vezes (você pode mudar em Pessoas)', 'Accept now and next time (change it in People)'), onclick: () => { lembrarLivre(p, true); S.regras(p.id, { perm: p.perm, livre: true }); S.decidirControle(p.id, 'aprovar'); } }))));
      });
      atualizarBarra();
    }

    function popoverControle(ancora) {
      const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
      const c = S.meuCtl(), alvo = alvoControle();
      if (alvo && c) {
        corpo.append(h('div', { class: 'linha' }, A.icone('controle', 20), h('div', { class: 'cresce' }, h('b', {}, T('Controlando ', 'Controlling ') + alvo.nome), h('div', { class: 'peq suave' }, c.st === 'ativo' ? T('Ativo', 'Active') : c.st === 'pausado' ? T('Pausado: volte ao cadeado para jogar', 'Paused: go back to the lock to play') : T('Aguardando', 'Waiting')))));
        const caps = E.cap;
        if (caps && !caps.mouse && !caps.teclado) corpo.append(h('div', { class: 'peq suave pop-nota' }, T('Neste computador o mouse e o teclado reais ainda não podem ser controlados de fora: você aparece como um cursor colorido, que só indica.', 'On this computer the real mouse and keyboard cannot be driven remotely yet: you show up as a colored cursor that only points.')));
        corpo.append(h('div', { class: 'pop-sec' }, h('b', {}, T('Cor do seu cursor', 'Your cursor color'))), seletorCor(),
          // (0.6.0) como o seu mouse controla: movendo o cursor de quem transmite (os dois sempre no mesmo lugar) ou apontando direto
          h('div', { class: 'pop-sec' }, h('b', {}, T('Seu mouse', 'Your mouse'))),
          U.seg([['host', T('Move o cursor dele', 'Moves their cursor')], ['livre', T('Aponta direto', 'Points directly')]], (A.cfg.v.entrada.mouseModo || 'host'), (v) => { A.cfg.v.entrada.mouseModo = v; A.cfg.salvar(); E.modoMouse && E.modoMouse(); }),
          h('div', { class: 'peq suave' }, T('"Move o cursor dele": o seu cursor some e você mexe o cursor da tela do amigo, sempre no mesmo lugar. Quando ele usar o próprio mouse, o seu aparece e espera.', '"Moves their cursor": your cursor hides and you move the cursor on your friend\'s screen, always in the same spot. When they use their own mouse, yours shows up and waits.')),
          h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Entrar no bloqueio automaticamente', 'Enter the lock automatically')), U.chave(A.cfg.v.entrada.lockAuto !== false, (v) => { A.cfg.v.entrada.lockAuto = v; A.cfg.salvar(); })),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, U.btn(T('Sair do controle', 'Leave control'), { tipo: 'perigo', peq: true, onclick: () => { S.sairControle(); pop.fechar(); } })),
          h('div', { class: 'peq suave' }, T('Para sair do cadeado: Esc solta o mouse; Esc de novo sai. No controle: START + SELECT + RB (o mesmo combo volta para o jogo).', 'To leave the lock: Esc frees the mouse; Esc again leaves. On a gamepad: START + SELECT + RB (the same combo goes back to the game).')));
      } else if (alvo && !c) { // (0.6.9) ainda não pediu: a setinha já mostra como pedir e as escolhas de antes de entrar
        corpo.append(h('div', { class: 'linha' }, A.icone('controle', 20), h('div', { class: 'cresce' }, h('b', {}, T('Controlar a tela de ', 'Control the screen of ') + alvo.nome), h('div', { class: 'peq suave' }, T('O host precisa aceitar.', 'The host needs to accept.')))),
          U.btn(T('Pedir para controlar', 'Ask to control'), { icone: 'controle', onclick: () => { S.pedirControle(alvo.id); A.som.tocar('click'); pop.fechar(); } }),
          h('div', { class: 'pop-sec' }, h('b', {}, T('Cor do seu cursor', 'Your cursor color'))), seletorCor(),
          h('div', { class: 'pop-sec' }, h('b', {}, T('Seu mouse', 'Your mouse'))),
          U.seg([['host', T('Move o cursor dele', 'Moves their cursor')], ['livre', T('Aponta direto', 'Points directly')]], (A.cfg.v.entrada.mouseModo || 'host'), (v) => { A.cfg.v.entrada.mouseModo = v; A.cfg.salvar(); E.modoMouse && E.modoMouse(); }));
      } else {
        const ativos = S.controladores(S.id);
        corpo.append(h('div', { class: 'pop-sec' }, h('b', {}, T('Quem está jogando', 'Who is playing'))));
        if (!ativos.length) corpo.append(h('div', { class: 'peq suave' }, T('Ninguém controla a sua tela agora.', 'Nobody is controlling your screen right now.')));
        ativos.forEach((p) => {
          const slots = E.slots.map((s, i) => (s && s.de === p.id ? i + 1 : 0)).filter(Boolean);
          corpo.append(h('div', { class: 'linha' }, U.avatar(p, 32), h('div', { class: 'cresce' }, h('b', {}, p.nome), h('div', { class: 'peq suave' }, [p.ctl.st === 'pausado' ? T('pausado', 'paused') : T('ativo', 'active'), p.ctl.real ? T('mouse e teclado reais', 'real mouse and keyboard') : T('cursor emulado', 'emulated cursor'), slots.length ? T('controle ', 'gamepad ') + slots.join(', ') : ''].filter(Boolean).join(' · '))), U.btn(T('Revogar', 'Revoke'), { tipo: 'sec', peq: true, onclick: () => { S.decidirControle(p.id, 'revogar'); pop.fechar(); } })));
        });
        corpo.append(h('div', { class: 'pop-sec' }, h('b', {}, T('Cor do seu cursor', 'Your cursor color'))), seletorCor(), h('div', { class: 'peq suave' }, T('Até 4 controles ao mesmo tempo. Mouse e teclado: uma pessoa de cada vez controla de verdade; as outras aparecem como cursores coloridos.', 'Up to 4 gamepads at once. Mouse and keyboard: one person at a time truly controls; others show up as colored cursors.')));
      }
      const pop = U.popover(ancora, corpo, { largura: 360, titulo: T('Controle remoto', 'Remote control') });
    }

    // ---------- bloqueio: o que o usuário vê enquanto joga ----------
    function pintarDicaLock() {
      dicaSair.hidden = !E.lock; dicaSair.textContent = T('Pausar: ' + E.atalhoBolha() + ' ou START + SELECT + RB', 'Pause: ' + E.atalhoBolha() + ' or START + SELECT + RB') + (E.imersivo() ? T(' · imersivo', ' · immersive') : '');
      const mostra = E.lock || dicaLock.classList.contains('aberta'), alvo = alvoControle(), preciso = E.lock && ((S.eu() || {}).perm || {}).mouse && !E.mouseCapturado();
      const dica = preciso ? T('Clique no vídeo para capturar o mouse', 'Click the video to capture the mouse') : E.lock ? T(E.atalhoBolha() + ' abre este menu', E.atalhoBolha() + ' opens this menu') : T('Pausado', 'Paused');
      // (0.7.6) só refaz quando muda: refazer entre o apertar e o soltar do mouse (a pausa) fazia o 1º clique na bolha se perder
      const k = mostra ? E.lock + '|' + (alvo ? alvo.nome : '') + '|' + dica : '';
      if (k === dicaLock.dataset.k) return; dicaLock.dataset.k = k; dicaLock.textContent = '';
      if (!mostra) return;
      dicaLock.append(h('span', { class: 'bolha-ctl-ic' }, A.icone(E.lock ? 'controle' : 'cadeadoAberto', 20)),
        h('span', { class: 'bolha-ctl-tx' }, h('b', {}, T('Controlando ', 'Controlling ') + (alvo ? alvo.nome : '')), h('small', {}, dica)));
    }
    function menuBolha() {
      if (U._pop && U._pop.ancora === dicaLock) { U._pop.fechar(); if (!E.lock) return; } // (0.7.6) clicou de novo: fecha; se voltou ao jogo com ela aberta, reabre e pausa
      dicaLock.classList.add('aberta');
      if (E.lock) E.sairLock('bolha'); // clicou na interface: a entrada sai do jogo
      pintarDicaLock(); A.som.tocar('abrir');
      const corpo = h('div', { class: 'col', estilo: { gap: '8px', 'min-width': '230px' } },
        U.btn(T('Voltar ao jogo', 'Back to the game'), { icone: 'controle', tipo: 'ok', onclick: () => { pop.fechar(); entrarLock(); } }),
        h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Modo imersivo', 'Immersive mode')), h('div', { class: 'peq suave' }, T('Super, Alt+Tab e os outros atalhos vão só para o PC do amigo (abre em tela cheia).', 'Super, Alt+Tab and other shortcuts go only to your friend\'s PC (opens fullscreen).'))), U.chave(E.imersivo(), (on) => E.definirImersivo(on))),
        U.btn(T('Mostrar os botões', 'Show the buttons'), { icone: 'menu', tipo: 'sec', onclick: () => { pop.fechar(); if (recolhida) recolher(false); else mostrarBarra(); } }),
        U.btn(T('Sair do controle', 'Leave control'), { icone: 'sair', tipo: 'perigo', onclick: () => { pop.fechar(); S.sairControle(); } }),
        h('div', { class: 'peq suave' }, T('Para voltar ao jogo também dá para recolher os botões (seta para baixo) ou apertar START + SELECT + RB. No jogo, ' + E.atalhoBolha() + ' abre este menu e START + SELECT + LB mostra os botões.', 'You can also go back to the game by collapsing the buttons (down arrow) or pressing START + SELECT + RB. In the game, ' + E.atalhoBolha() + ' opens this menu and START + SELECT + LB shows the buttons.')));
      const pop = U.popover(dicaLock, corpo, { largura: 290, titulo: T('Controle remoto', 'Remote control'), aoFechar: () => { dicaLock.classList.remove('aberta'); pintarDicaLock(); } });
    }
    dicaLock.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); menuBolha(); });
    dicaLock.addEventListener('mousedown', (e) => e.stopPropagation(), true); // o clique na bolha não vai para o jogo
    video.addEventListener('click', () => { if (E.lock) E.capturarMouse(); });
    const temControle = () => { const c = S.meuCtl(); return !!(c && alvoControle() && (c.st === 'ativo' || c.st === 'pausado')); };
    offs.push(A.evt.on('entrada:lock', () => { pintarDicaLock(); if (E.lock) { barra.classList.add('oculta'); clearTimeout(ocultarT); } atualizarRecolher(); }),
      A.evt.on('entrada:mouse', pintarDicaLock), A.evt.on('entrada:mira', pintarDicaLock), A.evt.on('entrada:pausa', pintarDicaLock), A.evt.on('entrada:imersivo', pintarDicaLock),
      A.evt.on('pad:combo-cadeado', () => { if (!E.lock && alvoControle() && E.podeEntrar()) { if (U._pop && U._pop.ancora === dicaLock) U._pop.fechar(); entrarLock(); } }), // START + SELECT + RB no controle: volta para o jogo
      A.evt.on('entrada:bolha', () => { if (E.lock) menuBolha(); }), // (0.7.9) o atalho e o combo do controle abrem a bolha, sem mostrar os botões
      A.evt.on('entrada:lock-fim', (motivo) => { if (motivo === 'bolha') return; mostrarBarra(); if (motivo === 'fim' || motivo === 'fechar' || motivo === 'sala') return; U.toast(T('Controle pausado. Use o cadeado para voltar a jogar.', 'Control paused. Use the lock to play again.'), { ms: 3600, som: 'fechar' }); atualizarControle(); }),
      A.evt.on('entrada:cursores', () => cam.desenhar()),
      A.evt.on('entrada:slot', (m) => U.toast(T('Você é o jogador ', 'You are player ') + (m.slot + 1), { tipo: 'ok', ms: 3000 })),
      A.evt.on('entrada:cap', (c) => { if (!c.mouse && !c.teclado && !c.gamepad) U.toast(T('O computador de quem transmite ainda não aceita controle de fora. Você aparece como cursor.', 'The sharer\'s computer does not accept remote input yet. You show up as a cursor.'), { ms: 6000 }); }));

    // ---------- chat (abre à direita e empurra o vídeo) ----------
    // o chat é o componente do chatui.js (emojis, imagens, responder, copiar, editar e apagar)
    const estilos = new Map(); let refazerChat = 0;
    const pendSala = []; let idPendSala = 0;
    const tirarPend = (id) => { const i = pendSala.findIndex((x) => x.id === id); if (i < 0) return; pendSala.splice(i, 1); cx.remover(id, true); };
    const codDe = (m) => m.cod || ((nomes[m.de] || S.participante(m.de) || {}).codigo) || '';
    function estiloDe(m) {
      const cod = codDe(m); if (!cod || !A.api.token) return {};
      if (estilos.has(cod)) return estilos.get(cod) || {};
      const conhecido = A.talk && A.talk.pessoaDe ? A.talk.pessoaDe(cod) : null;
      if (conhecido && conhecido.nome !== '?') { estilos.set(cod, conhecido); return conhecido; }
      estilos.set(cod, null);
      A.api.perfil(cod).then((p) => { estilos.set(cod, { nm: p.nm, sl: p.sl, bc: p.bc }); clearTimeout(refazerChat); refazerChat = setTimeout(() => cx.definir(S.chat.map((c) => ({ ...c, id: c.id || ('l' + c.t + c.de) }))), 250); }).catch(() => {});
      return {};
    }
    const cx = A.chatUI.criar({
      ehMeu: (m) => m.de === S.id || (!!m.cod && !!A.api.eu && m.cod === A.api.eu.codigo),
      nome: (m) => (nomes[m.de] || {}).nome || m.nome || '?',
      avatar: (m) => nomes[m.de] || S.participante(m.de) || { nome: m.nome || '?', codigo: m.cod || '', av: m.av || 0 }, // histórico: a foto vem na própria mensagem
      perfilDe: (m) => (A.api.token && (m.cod || ((nomes[m.de] || S.participante(m.de) || {}).codigo))) || null, // convidado sem conta: sem mini perfil
      podeApagar: () => ehHost(), // o host modera
      digitando: () => S.avisarDigitando(),
      urlAnexo: (m) => (m.img ? S.chatImgUrl(m.img) : null),
      enviar: async ({ texto, anexo, resp }) => {
        const img = anexo ? await S.chatImagem(anexo) : '';
        // (0.8.1) a sua mensagem aparece na hora (como no Aero Talk) e é trocada pela de verdade quando o servidor devolve
        const t = String(texto || '').trim();
        if (t && !img) { const m = { id: 'p' + (++idPendSala), de: S.id, cod: A.api.eu ? A.api.eu.codigo : '', nome: (A.api.eu && A.api.eu.nome) || '', t: Date.now(), texto: t, resp: resp ? resp.id : undefined, pendente: true }; pendSala.push(m); cx.adicionar(m); setTimeout(() => tirarPend(m.id), 12000); }
        S.chatEnviar(texto, { img, resp: resp ? resp.id : '' });
      },
      editar: async (m, texto) => S.chatEditar(m.id, texto),
      apagar: async (m) => S.chatApagar(m.id),
      // (0.8.0) o mesmo chat do Aero Talk (menos encaminhar): reações, mensagem de voz, áudio/vídeo curto, GIFs, figurinhas, @menções e o
      // estilo de cada pessoa (nome, selos e bolha)
      reagir: async (m, e) => S.chatReagir(m.id, e),
      meuId: () => (A.api.eu ? A.api.eu.codigo : S.id),
      nomeDe: (q) => { const p = S.participantes.find((x) => x.codigo === q || x.id === q) || Object.values(nomes).find((x) => x.codigo === q); return p ? p.nome : (S.chat.find((c) => c.cod === q || c.de === q) || {}).nome || '?'; },
      membros: () => S.participantes.filter((p) => p.codigo).map((p) => ({ codigo: p.codigo, nome: p.nome, tag: p.tag, av: p.av })),
      aceitar: 'image/*,audio/*,video/mp4,video/webm', limite: 1900 * 1024,
      tituloAnexo: T('Enviar foto, áudio ou vídeo curto (até 1,9 MB) · também dá para colar ou arrastar', 'Send a photo, audio or short video (up to 1.9 MB) · you can also paste or drag'),
      gravarAudio: true,
      ...(A.api.token && A.talk && A.talk.gifs ? { gifs: A.talk.gifs, figurinhas: A.talk.figurinhas, favoritarGif: (url, w, hh) => A.talk.gifs.favoritar({ url, prev: url, w: w || 0, h: hh || 0 }, !A.talk.gifs.eFavorito(url)).catch((e) => U.toast(e.message, { tipo: 'erro' })), gifFavorito: (url) => A.talk.gifs.eFavorito(url) } : {}),
      nomeEstiloDe: (m) => estiloDe(m).nm, selosDe: (m) => estiloDe(m).sl, bolhaDe: (m) => estiloDe(m).bc,
    });
    const inp = cx.inp, msgs = cx.lista;
    // (0.8.4) sem largura mínima: com o chat no menor tamanho, o X ficava para fora (cortado); agora o título encolhe e o X fica sempre
    const cabChat = h('div', { class: 'linha entre pad sala-chat-cab', estilo: { padding: '14px 16px 4px' } }, h('h3', {}, T('Chat da sala', 'Room chat')), U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, onclick: () => chat(false), mudo: true }));
    // (0.8.0) chat vazio: um convite para começar a conversa, no lugar do painel em branco
    const vazioChat = h('div', { class: 'sala-chat-vazio', 'aria-hidden': 'true' }, h('div', { class: 'tk-vazio-bolha' }, A.icone('chat', 42)), h('b', {}, T('Ninguém falou nada ainda', 'No messages yet')), h('span', { class: 'peq suave' }, T('Mande um oi, um GIF, uma figurinha ou um áudio 👋', 'Say hi, send a GIF, a sticker or a voice message 👋')));
    const pintarChatVazio = () => { vazioChat.hidden = S.chat.length > 0; };
    const painelChat = h('div', { class: 'chat vidro' }, cabChat, vazioChat, cx.el);
    if (!A.plat.celular) U.chatEncaixavel(painelChat, cabChat, el, 'sala'); // (0.6.0) grudar à esquerda/direita ou soltar
    function chat(abrir) {
      el.classList.toggle('chat-aberto', abrir); S.chatVisto(abrir); A.som.tocar(abrir ? 'abrir' : 'fechar'); atualizarBarra();
      if (abrir) { setTimeout(() => { inp.focus({ preventScroll: true }); msgs.scrollTop = msgs.scrollHeight; }, 420); } else mostrarBarra();
    }
    const pintarMsg = (c) => cx.adicionar({ ...c, id: c.id || ('l' + c.t + c.de) });
    cx.definir(S.chat.map((c) => ({ ...c, id: c.id || ('l' + c.t + c.de) }))); pintarChatVazio();

    // ---------- pessoas, regras e moderação ----------
    function abrirPessoas() {
      const lista = h('div', { class: 'col', estilo: { gap: '10px' } });
      const podeRegras = () => ehHost() || (S.local.tela && S.local.modo === 'jogo');
      const pintar = () => {
        lista.textContent = '';
        if (podeAprovar() && S.pendentes.length) {
          lista.append(h('h3', {}, T('Querem entrar', 'Want to join')));
          S.pendentes.forEach((q) => lista.append(h('div', { class: 'linha' }, U.avatar(q, 38), h('div', { class: 'cresce' }, h('b', {}, q.nome), q.tag ? h('span', { class: 'tag' }, ' #' + q.tag) : h('span', { class: 'suave peq' }, T(' (convidado)', ' (guest)'))), U.btn(T('Aceitar', 'Accept'), { tipo: 'ok', peq: true, onclick: () => S.aprovar(q.id) }), U.btn(T('Recusar', 'Decline'), { tipo: 'sec', peq: true, onclick: () => S.recusar(q.id) }))));
        }
        if (A.api.eu) lista.append(h('div', { class: 'linha entre', estilo: { 'flex-wrap': 'wrap' } }, h('span', { class: 'peq suave' }, T('Chame um amigo: ele recebe o convite e escolhe se entra.', 'Invite a friend: they get the invite and choose whether to join.')), U.btn(T('Convidar amigos', 'Invite friends'), { icone: 'convidar', peq: true, onclick: () => U.convidarParaSala() })));
        lista.append(h('h3', {}, T('Na sala', 'In the room') + ` (${S.participantes.length})`));
        S.participantes.forEach((p) => {
          const eu = p.id === S.id, e = S.estat[p.id] || {};
          const linha = h('div', { class: 'vidro interno pad col', estilo: { gap: '8px', padding: '10px 12px' } });
          const status = [p.host ? T('host', 'host') : null, p.comp ? (p.modo === 'jogo' ? T('compartilhando (jogo)', 'sharing (game)') : T('compartilhando', 'sharing')) : null, p.mic ? T('microfone', 'mic') : null, p.ctl && p.ctl.st === 'ativo' ? T('controlando', 'controlling') : p.ctl && p.ctl.st === 'pedindo' ? T('pediu controle', 'asked for control') : null].filter(Boolean).join(' · ');
          const topoL = h('div', { class: 'linha' }, h('div', { class: 'linha cresce', estilo: { cursor: 'pointer' }, onclick: () => U.perfil(p) }, U.avatar(p, 40), h('div', {}, h('div', { estilo: { 'font-weight': '700' } }, p.nome, ' ', p.tag ? h('span', { class: 'tag' }, '#' + p.tag) : null, eu ? h('span', { class: 'suave peq' }, T(' (você)', ' (you)')) : null), h('div', { class: 'peq suave' }, status))),
            !eu && e.rtt != null ? h('span', { class: 'lat' }, h('i', { class: e.rtt > 150 ? 'ruim' : e.rtt > 70 ? 'med' : '' }), e.rtt + ' ms') : null);
          linha.append(topoL);
          if (!eu) {
            const acoes = h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '8px' } });
            const mudo = S.mudos.has(p.id);
            acoes.append(U.btn(mudo ? T('Ativar o som dele(a)', 'Unmute') : T('Silenciar para mim', 'Mute for me'), { icone: mudo ? 'mudo' : 'volume', tipo: 'sec', peq: true, onclick: () => { S.mudar(p.id, !mudo); pintar(); } }));
            if (p.comp) { // (0.5.9-5) a resolução é só a que o host escolheu; quem assiste não escolhe mais (dava problema)
              const pr = S.peers.get(p.id); if (pr && !pr.avisouCodec) acoes.append(U.btn(T('Imagem com defeito? Trocar formato', 'Glitchy picture? Switch format'), { tipo: 'sec', peq: true, titulo: T('A transmissão desta pessoa para você passa a usar VP8 (o formato das chamadas do Aero Talk)', 'This person\'s stream to you switches to VP8 (the Aero Talk call format)'), onclick: (e) => { S.pedirOutroFormato(p.id); e.currentTarget.disabled = true; U.toast(T('Pedido enviado: a imagem troca de formato em instantes.', 'Request sent: the picture switches format in a moment.'), { ms: 3000 }); } })); }
            if (p.ctl && p.ctl.st !== 'pedindo' && (ehHost() || p.ctl.dono === S.id)) acoes.append(U.btn(T('Revogar controle', 'Revoke control'), { tipo: 'sec', peq: true, onclick: () => S.decidirControle(p.id, 'revogar') }));
            if (ehHost() && !p.host) acoes.append(U.btn(T('Remover', 'Remove'), { tipo: 'perigo', peq: true, onclick: async () => { if (await U.confirmar(T('Remover ', 'Remove ') + p.nome + '?', { perigo: true })) S.moderar(p.id, 'remover'); } }), U.btn(T('Banir', 'Ban'), { tipo: 'perigo', peq: true, onclick: async () => { if (await U.confirmar(T('Banir ', 'Ban ') + p.nome + T(' desta sala?', ' from this room?'), { perigo: true })) S.moderar(p.id, 'banir'); } }));
            linha.append(acoes);
            // volume do microfone desta pessoa (só para você) + medidor do que está chegando dela
            const medidor = h('i', { class: 'nivel-barra', dados: { pessoa: p.id } });
            const volNum = h('b', { class: 'peq' }, S.volumePessoa(p.id) + '%');
            const volP = U.slider({ min: 0, max: 200, valor: S.volumePessoa(p.id), oninput: (v) => { volNum.textContent = v + '%'; S.definirVolumePessoa(p.id, v); } });
            volP.setAttribute('aria-label', T('Volume do microfone de ', 'Microphone volume of ') + p.nome);
            linha.append(h('div', { class: 'col', estilo: { gap: '4px' } }, h('div', { class: 'linha entre peq' }, h('span', {}, A.icone('mic', 14), ' ', T('Volume do microfone (só para você)', 'Microphone volume (just for you)')), volNum), volP,
              h('div', { class: 'nivel', estilo: { height: '6px' }, title: T('O que está chegando do microfone dele(a)', 'What is coming from their mic') }, medidor)));
            if (podeRegras() && !p.host && p.id !== S.id) {
              // (0.8.7) quem transmite sem ser o host vê e muda só as regras da própria tela (o servidor guarda separado)
              const rg = ehHost() ? { perm: p.perm || {}, livre: !!p.livre } : ((p.pd || {})[S.id] || { perm: {}, livre: false });
              const regra = (k, rot, ic) => h('label', { class: 'linha peq', estilo: { gap: '6px' } }, U.chave((rg.perm || {})[k] !== false, (v) => S.regras(p.id, { perm: { ...(rg.perm || {}), [k]: v }, livre: !!rg.livre })), A.icone(ic, 15), rot);
              linha.append(h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '14px' } }, h('span', { class: 'peq suave' }, T('Pode usar:', 'Can use:')), regra('gamepad', T('Controle', 'Gamepad'), 'controle'), regra('mouse', 'Mouse', 'rato'), regra('teclado', T('Teclado', 'Keyboard'), 'teclado')),
                h('label', { class: 'linha peq', estilo: { gap: '6px' } }, U.chave(!!rg.livre, (v) => { lembrarLivre(p, v); S.regras(p.id, { perm: rg.perm || {}, livre: v }); }), T('Entra no controle sem pedir', 'Joins control without asking')));
            }
          }
          lista.append(linha);
        });
      };
      pintar();
      let arrastando = false, rafNivel = 0;
      lista.addEventListener('pointerdown', (e) => { if (e.target.closest('input[type=range]')) arrastando = true; });
      const soltar = () => { if (arrastando) { arrastando = false; pintar(); } };
      document.addEventListener('pointerup', soltar); document.addEventListener('pointercancel', soltar);
      const refazer = () => { if (arrastando || (document.activeElement && lista.contains(document.activeElement) && document.activeElement.type === 'range')) return; pintar(); };
      const medir = () => { lista.querySelectorAll('.nivel-barra[data-pessoa]').forEach((b) => { b.style.transform = 'scaleX(' + S.nivelPessoa(b.dataset.pessoa).toFixed(3) + ')'; }); rafNivel = requestAnimationFrame(medir); };
      rafNivel = requestAnimationFrame(medir);
      const o1 = A.evt.on('sala:estado', refazer), o2 = A.evt.on('sala:estat', refazer);
      modalPessoas = U.modal(T('Pessoas na sala', 'People in the room'), lista, { largura: 580, aoFechar: () => { o1(); o2(); cancelAnimationFrame(rafNivel); document.removeEventListener('pointerup', soltar); document.removeEventListener('pointercancel', soltar); modalPessoas = null; } });
    }

    function abrirOpcoes() {
      let janela = null;
      const corpo = h('div', { class: 'col' });
      if (ehHost()) {
        const link = `${/^https?:\/\/(localhost|127\.0\.0\.1)/.test(location.origin) ? location.origin : A.SITE}/?sala=${S.sala}`; // o site pergunta se quer abrir no app
        corpo.append(h('div', { class: 'vidro interno pad col', estilo: { gap: '8px' } }, h('div', { class: 'peq suave' }, T('Código da sala', 'Room code')), h('div', { class: 'selecionavel', estilo: { 'font-size': '30px', 'font-weight': '700', 'letter-spacing': '4px' } }, S.sala),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, A.api.eu ? U.btn(T('Convidar amigos', 'Invite friends'), { icone: 'convidar', peq: true, onclick: () => { janela && janela.fechar(); U.convidarParaSala(); } }) : null, U.btn(T('Copiar link de convite', 'Copy invite link'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(link, e.currentTarget) }), U.btn(T('Copiar código', 'Copy code'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(S.sala, e.currentTarget) })),
          h('div', { class: 'peq suave' }, T('Se o seu computador cair, a sala continua. Volte em Transmitir > Retomar minha sala. Uma sala vazia por mais de 10 minutos se fecha sozinha.', 'If your computer drops, the room stays open. Come back in Share > Resume my room. A room left empty for over 10 minutes closes by itself.'))));
      }
      const pads = A.pad.lista();
      corpo.append(
        h('div', { class: 'opcao' }, h('div', {}, T('Mostrar informações da transmissão', 'Show stream info')), U.chave(infoVisivel, (v) => { infoVisivel = v; atualizarPalco(); })),
        h('div', { class: 'opcao' }, h('div', {}, T('Modo escuro', 'Dark mode')), U.chave(A.cfg.v.tema.escuro, (v) => { A.cfg.v.tema.escuro = v; A.tema.aplicar(); A.cfg.salvar(); A.som.tocar(v ? 'noite' : 'dia'); })),
        h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', {}, T('Mostrar cursores dos amigos', 'Show friends\' cursors')), h('div', { class: 'peq suave' }, T('Cada um aparece com seu nome e sua cor.', 'Each one shows with their name and color.'))), U.chave(A.cfg.v.entrada.mostrarCursores !== false, (v) => { A.cfg.v.entrada.mostrarCursores = v; A.cfg.salvar(); atualizarPalco(); })),
        h('div', { class: 'col', estilo: { gap: '6px' } }, h('div', { estilo: { 'font-weight': '600' } }, T('Cor do seu cursor', 'Your cursor color')), seletorCor()),
        h('div', { class: 'col', estilo: { gap: '4px' } }, h('div', { estilo: { 'font-weight': '600' } }, T('Controles conectados', 'Connected controllers')), ...(pads.length ? pads.map((p) => h('div', { class: 'peq suave' }, `#${p.indice + 1} · ${p.nome}`)) : [h('div', { class: 'peq suave' }, T('Nenhum controle detectado.', 'No controller detected.'))])),
        A.api.eu ? U.btn(T('Configurar controles', 'Set up controllers'), { tipo: 'sec', peq: true, icone: 'controle', onclick: () => { janela && janela.fechar(); irMenu('controles'); } }) : null);
      janela = U.modal(T('Opções da sala', 'Room options'), corpo, { largura: 520 });
    }

    // ---------- janelinha e saída ----------
    // destino: 'home' (padrão) ou 'controles' (tela de controles; ao sair dela volta para a sala, que continua rodando)
    function irMenu(destino) {
      if (!A.api.eu) return; // convidado (sem conta) não tem menu para voltar: só a sala
      if (E.lock) E.sairLock('menu');
      if (U.tela.cheia()) U.tela.alternar();
      if (S.ativa) U.pip.mostrar();
      if (destino === 'controles') {
        U.ir('controles', { voltar: () => { if (S.ativa) { U.pip.esconder(); U.ir('sala', {}); } else U.ir('home', A.homeDados); } });
        return;
      }
      U.ir('home', A.homeDados);
    }
    async function sair(perguntar) {
      if (perguntar && ehHost() && S.admitido && !(await U.confirmar(T('Sair da sala? Ela continua existindo: você volta em Transmitir > Retomar minha sala.', 'Leave the room? It keeps existing: come back in Share > Resume my room.'), { sim: T('Sair', 'Leave') }))) return;
      else if (perguntar && !ehHost() && S.admitido && !(await U.confirmar(T('Sair da sala?', 'Leave the room?'), { sim: T('Sair', 'Leave') }))) return;
      A.som.tocar('sair'); await S.fechar();
    }

    // ---------- eventos da sala: cada um com seu som e sua animação ----------
    const on = (n, f) => offs.push(A.evt.on('sala:' + n, f));
    on('estado', () => { guardarNomes(); atualizarTopo(); atualizarPalco(); aguardo.hidden = S.admitido; });
    on('aprovado', () => { aguardo.hidden = true; A.som.tocar('sucesso'); });
    on('aguardando', () => { aguardo.hidden = false; });
    on('stream', () => { guardarNomes(); atualizarPalco(); });
    on('stream-fim', () => atualizarPalco());
    on('local', () => { atualizarPalco(); });
    on('estat', () => { atualizarInfo(principalAtual()); atualizarTopo(); });
    on('entrou', (p) => { A.som.tocar('entrar'); U.toast(h('span', {}, h('b', {}, p.nome), T(' entrou na sala', ' joined the room')), { avatar: p, som: 'entrar', ms: 2600 }); });
    on('saiu', (p) => { A.som.tocar('sair'); U.toast(h('span', {}, h('b', {}, p.nome), T(' saiu da sala', ' left the room')), { avatar: p, som: 'sair', ms: 2400 }); });
    on('comp-inicio', (p) => U.toast(h('span', {}, h('b', {}, p.nome), T(' começou a compartilhar a tela', ' started sharing their screen')), { avatar: p, som: 'compartilhar', ms: 3600 }));
    on('comp-fim', (p) => U.toast(h('span', {}, h('b', {}, p.nome), T(' parou de compartilhar', ' stopped sharing')), { avatar: p, som: 'parar', ms: 2600 }));
    on('digitando', (d) => { if (d.de !== S.id) cx.digitando(d.nome || '?'); });
    on('chat', (c) => { if (c.de === S.id) { const x = pendSala.find((y) => y.texto === String(c.texto || '').trim()); if (x) tirarPend(x.id); } guardarNomes(); if (c.de !== S.id) cx.parouDeDigitar((nomes[c.de] || {}).nome || c.nome || '?'); pintarMsg(c); pintarChatVazio(); if (c.de !== S.id) A.som.tocar('chat-recebido'); atualizarBarra(); });
    on('chat-hist', () => { guardarNomes(); cx.definir(S.chat); pintarChatVazio(); });
    on('chat-mudou', (c) => cx.atualizar(c));
    on('chat-apagado', (c) => { cx.remover(c.id); pintarChatVazio(); });
    on('aviso', (m) => U.toast(m.msg, { tipo: 'erro' }));
    // (0.6.0) a imagem de alguém não chega: em vez de trocar o formato sozinho, pergunta a quem assiste
    const avisosSemImagem = new Map();
    on('imagem-voltou', ({ id }) => { const t = avisosSemImagem.get(id); if (t) { t.fechar(); avisosSemImagem.delete(id); } }); // (0.7.4) a imagem chegou: o aviso some na hora
    on('sem-imagem', ({ id }) => { const nome = (S.participante(id) || {}).nome || T('a pessoa', 'this person'); avisosSemImagem.set(id, U.toast(T('A imagem de ', 'The picture from ') + nome + T(' não está chegando.', ' is not coming through.'), { ms: 15000, acoes: [{ texto: T('Trocar formato', 'Switch format'), onclick: () => S.pedirOutroFormato(id) }] })); });
    on('pedido', (q) => {
      const amigo = q.codigo && H.amigos.find((a) => a.codigo === q.codigo && a.estado === 'aceita' && a.confia);
      if (amigo) { S.aprovar(q.id); return; } // amigo marcado como "entra sem pedir"
      const t = U.toast(h('span', {}, h('b', {}, q.nome), T(' quer entrar', ' wants to join')), { avatar: q, som: 'msg', ms: 12000, acoes: [{ texto: T('Aceitar', 'Accept'), tipo: 'ok', onclick: () => S.aprovar(q.id) }, { texto: T('Recusar', 'Decline'), tipo: 'sec', onclick: () => S.recusar(q.id) }] });
      toastsPedido.set(q.id, t);
      atualizarBarra();
    });
    on('pedido-fim', (q) => { const t = toastsPedido.get(q.id); if (t) { t.fechar(); toastsPedido.delete(q.id); } atualizarBarra(); });
    on('ctl', ({ p, antes, depois }) => {
      if (depois && depois.st === 'pedindo' && !(antes && antes.st === 'pedindo') && depois.dono === S.id && livreGuardado(p)) {
        const rg = ehHost() ? { perm: p.perm || {}, livre: !!p.livre } : ((p.pd || {})[S.id] || { perm: {}, livre: false });
        if (!rg.livre) S.regras(p.id, { perm: rg.perm || {}, livre: true });
        S.decidirControle(p.id, 'aprovar'); return; // já liberado antes: entra direto, sem perguntar de novo
      }
      pintarPedidos(); atualizarTopo();
      if (depois && depois.st === 'pedindo' && !(antes && antes.st === 'pedindo') && (depois.dono === S.id || ehHost())) A.som.tocar('msg');
      if (!depois && antes && antes.st !== 'pedindo' && antes.dono === S.id) U.toast(h('span', {}, h('b', {}, p.nome), T(' saiu do controle', ' left the control')), { avatar: p, ms: 2400, som: 'sair' });
    });
    on('ctl-meu', ({ antes, depois }) => {
      atualizarControle(); atualizarBarra();
      if (depois && depois.st === 'ativo' && (!antes || antes.st === 'pedindo')) {
        A.som.tocar('sucesso');
        if (A.cfg.v.entrada.lockAuto !== false && alvoControle()) entrarLock(); // quem entra no controle e está vendo a tela do host cai direto no bloqueio
        else U.toast(T('Controle liberado! Use o cadeado para jogar.', 'Control granted! Use the lock to play.'), { tipo: 'ok' });
      }
    });
    on('input-fim', (m) => { atualizarControle(); U.toast(m && m.negado ? T('O controle não foi liberado.', 'Control was not granted.') : T('Seu controle foi encerrado.', 'Your control has ended.'), { ms: 3200, som: 'parar' }); });

    // ---------- atalhos (teclado e controle) ----------
    const zonas = () => [barra, topo, el.classList.contains('chat-aberto') ? painelChat : null, pedidos.hidden ? null : pedidos].filter(Boolean);
    const irZona = (d) => {
      if (E.lock || modalAberto()) return;
      mostrarBarra();
      if (recolhida) recolher(false);
      const z = zonas(); if (!z.length) return;
      zonaI = (zonaI + d + z.length) % z.length;
      const alvo = z[zonaI].querySelector('button:not([hidden]), input, select, [tabindex="0"]');
      if (alvo) { barra.classList.remove('oculta'); alvo.focus({ preventScroll: true }); }
    };
    const tecla = (e) => {
      if (E.lock || modalAberto() || e.target === inp || e.ctrlKey || e.metaKey || e.altKey) return;
      mostrarBarra();
      const k = e.key.toLowerCase();
      if (k === 'c') chat(!el.classList.contains('chat-aberto')); else if (k === 'm') btnMic.click(); else if (k === 'f') btnTela.click(); else if (k === 'escape') irMenu();
    };
    document.addEventListener('keydown', tecla);
    offs.push(A.evt.on('pad:y', () => !modalAberto() && !E.lock && chat(!el.classList.contains('chat-aberto'))),
      A.evt.on('pad:x', () => { if (E.lock) return; if (recolhida) { recolher(false); return; } barra.classList.contains('oculta') ? mostrarBarra() : barra.classList.add('oculta'); }),
      A.evt.on('pad:rb', () => irZona(1)), A.evt.on('pad:lb', () => irZona(-1)),
      A.evt.on('pad:cima', mostrarBarra), A.evt.on('pad:baixo', mostrarBarra), A.evt.on('pad:esq', mostrarBarra), A.evt.on('pad:dir', mostrarBarra));
    A.pad.legendas([{ botao: 'lb', texto: '' }, { botao: 'rb', texto: T('Trocar de área', 'Switch area') }, { botao: 'x', texto: T('Barra', 'Bar') }, { botao: 'y', texto: T('Chat', 'Chat') }, { botao: 'voltar', texto: T('Esconder legenda', 'Hide legend') }]);
    // SELECT esconde/mostra a legenda do controle (assistindo); a legenda desce quando a barra se esconde (CSS [data-barra=oculta])
    const raizHtml = document.documentElement;
    offs.push(A.evt.on('pad:select', () => { if (E.lock || modalAberto()) return; const off = raizHtml.dataset.legenda === 'off'; if (off) delete raizHtml.dataset.legenda; else raizHtml.dataset.legenda = 'off'; A.som.tocar(off ? 'abrir' : 'fechar'); }));
    const obsBarra = new MutationObserver(() => { raizHtml.dataset.barra = barra.classList.contains('oculta') ? 'oculta' : ''; });
    obsBarra.observe(barra, { attributes: true, attributeFilter: ['class'] });
    offs.push(() => { obsBarra.disconnect(); delete raizHtml.dataset.barra; delete raizHtml.dataset.legenda; });

    const resize = () => cam.desenhar();
    addEventListener('resize', resize); video.addEventListener('loadedmetadata', resize); video.addEventListener('resize', resize);
    const palco = h('div', { class: 'sala-palco' }, video, cam.el, vazio, minis, topo, pedidos, info, dicaLock, dicaSair, barra, puxador, aguardo);
    // controlando o PC do amigo: mexer o mouse no jogo não faz a barra pular na frente (ela aparece só encostando na borda de baixo)
    ['pointermove', 'pointerdown', 'touchstart'].forEach((ev) => palco.addEventListener(ev, (e) => { if (E.lock && !E.pausaLocal && !(e.clientY >= innerHeight - 30)) return; mostrarBarra(); }, { passive: true }));
    // recolhida: "puxar" a barra = mouse encostado na borda de baixo e ainda descendo
    palco.addEventListener('pointermove', (e) => { if (recolhida && e.pointerType === 'mouse' && e.clientY >= innerHeight - 24 && e.movementY > 0) recolher(false); }, { passive: true });
    const telaCheiaMudou = () => { const cheia = U.tela.cheia(); atualizarRecolher(); if (!cheia) recolher(false); };
    document.addEventListener('fullscreenchange', telaCheiaMudou); document.addEventListener('webkitfullscreenchange', telaCheiaMudou);
    offs.push(() => { document.removeEventListener('fullscreenchange', telaCheiaMudou); document.removeEventListener('webkitfullscreenchange', telaCheiaMudou); });
    el.append(palco, painelChat);
    guardarNomes(); atualizarTopo(); atualizarPalco(); aguardo.hidden = S.admitido; atualizarBarra(); mostrarBarra();
    if (ehHost() && dados.mostrarCodigos) U.toast(h('span', {}, T('Sala ', 'Room '), h('b', { class: 'selecionavel' }, S.sala)), { ms: 6000, som: 'sucesso' });
    if (S.meuCtl() && S.meuCtl().st === 'ativo' && alvoControle() && A.cfg.v.entrada.lockAuto !== false) setTimeout(entrarLock, 300); // voltou da janelinha com o controle ativo
    return {
      voltar: () => { if (E.lock) return; irMenu(); },
      limpar() {
        offs.forEach((f) => f()); cam.limpar && cam.limpar(); document.removeEventListener('keydown', tecla); removeEventListener('resize', resize);
        clearTimeout(ocultarT); video.srcObject = null; A.pad.legendas(null); document.documentElement.removeAttribute('data-video-jogo');
        if (U._pop) U._pop.fechar();
        if (E.lock) E.sairLock('tela');
        if (U.tela.cheia()) U.tela.alternar();
      },
    };
  };

  // ---------- seletor de tela/janela do app do PC ----------
  U.escolherFonte = async () => {
    if (!A.plat.desktop || !window.aero.fontes) return { id: null, nome: T('Tela principal', 'Main screen') };
    // Linux com Wayland (KDE Plasma, GNOME): o seletor do SISTEMA (portal) é o único; o Aero não abre outro por cima
    if (await A.portalPC()) return { id: null, nome: T('Escolhido no seletor do sistema', 'Chosen in the system picker'), portal: true };
    const lista = await window.aero.fontes();
    return new Promise((ok) => {
      const grade = h('div', { class: 'grade', estilo: { 'grid-template-columns': 'repeat(auto-fill, minmax(190px, 1fr))' } });
      let escolhido = false;
      const m = U.modal(T('O que você quer mostrar?', 'What do you want to show?'), grade, { largura: 780, aoFechar: () => { if (!escolhido) ok(null); } });
      lista.forEach((f) => grade.append(U.paralax(h('button', { class: 'tile vidro', type: 'button', estilo: { padding: '10px', border: '0', color: 'inherit', 'text-align': 'center' }, onclick: () => { escolhido = true; ok(f); m.fechar(); } },
        h('img', { src: f.thumb, alt: '', estilo: { width: '100%', 'border-radius': 'var(--raio-p)', background: '#000', display: 'block' } }), h('div', { class: 'peq', estilo: { 'margin-top': '8px', 'font-weight': '600', 'overflow-wrap': 'anywhere' } }, (f.tipo === 'janela' ? '▢ ' : '▣ ') + f.nome)))));
    });
  };

  // ---------- convidar um amigo para a sala (modo sala) ----------
  // Quem está na sala escolhe o amigo; ele recebe "Fulano te chamou para a sala" e aceita (entra direto, sem esperar aprovação
  // quando quem convidou é o host) ou recusa (e quem convidou fica sabendo).
  U.convidarParaSala = () => {
    if (!S.ativa || !A.api.eu) return;
    const amigos = A.hub.amigos.filter((a) => a.estado === 'aceita');
    if (!amigos.length) { U.toast(T('Adicione amigos primeiro (Aero Talk > Amigos).', 'Add friends first (Aero Talk > Friends).')); return; }
    const naSala = new Set(S.participantes.map((p) => p.codigo).filter(Boolean));
    const online = (cod) => [...A.hub.presenca.values()].some((p) => p.codigo === cod);
    const lista = h('div', { class: 'col', estilo: { gap: '8px' } });
    amigos.sort((a, b) => (online(b.codigo) ? 1 : 0) - (online(a.codigo) ? 1 : 0)).forEach((a) => {
      const ja = naSala.has(a.codigo);
      const b = U.btn(ja ? T('Já está na sala', 'Already here') : T('Convidar', 'Invite'), { peq: true, tipo: ja ? 'sec' : 'ok', icone: ja ? 'ok' : 'mais', onclick: async () => {
        b.disabled = true;
        try {
          const r = await A.api.req('convite-sala', { codigo: a.codigo, sala: S.sala });
          if (S.papel === 'host') { S.autoAprovar = S.autoAprovar || new Set(); S.autoAprovar.add(a.codigo); } // aceitou: entra sem pedir
          b.replaceChildren(A.icone('ok', 18), h('span', {}, r.online ? T('Convidado', 'Invited') : T('Está offline', 'Offline')));
          U.toast(r.online ? T('Convite enviado para ', 'Invite sent to ') + (a.apelido || a.nome) + '.' : (a.apelido || a.nome) + T(' está offline agora: o convite não chegou.', ' is offline now: the invite did not arrive.'), { tipo: r.online ? 'ok' : '' });
          if (!r.online) b.disabled = false;
        } catch (e) { b.disabled = false; U.toast(e.message, { tipo: 'erro' }); }
      } });
      b.disabled = ja;
      lista.append(h('div', { class: 'linha' }, U.avatar(a, 40, online(a.codigo) ? 'online' : 'offline'), h('div', { class: 'cresce' }, h('b', {}, a.apelido || a.nome), h('div', { class: 'peq suave' }, online(a.codigo) ? T('online', 'online') : T('offline', 'offline'))), b));
    });
    U.modal(T('Convidar para a sala ', 'Invite to room ') + S.sala, lista, { largura: 480 });
  };
  // quem é convidado: um cartão no canto, como o da chamada
  let convite = null;
  const fecharConvite = () => { if (convite) { const el = convite.el; clearTimeout(convite.t); convite = null; el.classList.add('saindo'); setTimeout(() => el.remove(), 380); } };
  A.evt.on('hub:convite-sala', (e) => {
    return; // (0.9.6) as salas acabaram: convites antigos não aparecem mais
    if (S.ativa && S.sala === e.sala) return;
    fecharConvite();
    const nome = (A.hub.amigos.find((a) => a.codigo === e.de.codigo) || {}).apelido || e.de.nome;
    const responder = (aceitou) => A.api.req('convite-sala/resposta', { codigo: e.de.codigo, sala: e.sala, aceitou }).catch(() => {});
    const el = h('div', { class: 'cham-toque vidro convite-sala', role: 'alertdialog', 'aria-label': nome + T(' te convidou para uma sala', ' invited you to a room') },
      h('div', { class: 'cham-toque-av' }, U.avatar(e.de, 64)),
      h('div', { class: 'cresce' }, h('b', {}, nome), h('div', { class: 'peq suave' }, T('te chamou para a sala ', 'invited you to room ') + e.sala)),
      h('div', { class: 'cham-toque-botoes' },
        U.btn(T('Recusar', 'Decline'), { tipo: 'sec', peq: true, onclick: () => { fecharConvite(); responder(false); } }),
        U.btn(T('Entrar', 'Join'), { tipo: 'ok', peq: true, icone: 'play', onclick: async () => {
          fecharConvite();
          if (S.ativa && !(await U.confirmar(T('Você está em outra sala. Sair dela e entrar na de ', 'You are in another room. Leave it and join ') + nome + '?'))) { responder(false); return; }
          responder(true);
          if (S.ativa) await S.fechar();
          A.abrirSala({ papel: 'membro', sala: e.sala });
        } })));
    convite = { sala: e.sala, el, t: setTimeout(() => { fecharConvite(); }, 60000) };
    document.body.append(el);
    if (!A.ui.naoPerturbe()) { const tq = A.cfg.v.toque; A.som.tocar(tq === 'novo' ? 'chamada-entrada' : ['marimba', 'brisa'].includes(tq) ? 'chamada-entrada-' + tq : 'chamada-entrada-classico'); } // o toque escolhido
    if (document.hidden && window.Notification && Notification.permission === 'granted') { try { const n = new Notification(nome, { body: T('te chamou para a sala ', 'invited you to room ') + e.sala, tag: 'aero-convite' }); n.onclick = () => { window.focus(); n.close(); }; } catch (_) { /* ok */ } }
  });
  A.evt.on('hub:convite-sala-fim', (e) => { if (convite && convite.sala === e.sala) fecharConvite(); }); // respondi em outro aparelho
  A.evt.on('hub:convite-sala-resposta', (e) => {
    const nome = (A.hub.amigos.find((a) => a.codigo === e.de.codigo) || {}).apelido || e.de.nome;
    U.toast(nome + (e.aceitou ? T(' aceitou o convite e está entrando.', ' accepted and is joining.') : T(' recusou o convite.', ' declined the invite.')), { tipo: e.aceitou ? 'ok' : '', avatar: e.de, ms: 4000 });
  });
})();
