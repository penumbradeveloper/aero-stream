// Aero Stream - (0.8.7) Música junto (integração oficial): uma fila de músicas do YouTube por conversa, tocando ao mesmo tempo para todo
// mundo da conversa que tem a integração, também durante a chamada. Sem bot: cada aparelho toca sozinho; o servidor (musica.js do worker)
// guarda só a fila e "quando começou", e todo mundo calcula o mesmo ponto da música a partir disso.
// Quem mexe: na DM os dois; no grupo o dono e os admins, e os outros se o dono liberar.
// Começa a tocar sozinho para quem está na chamada da conversa ou com ela aberta; para parar de ouvir é só desligar "Ouvindo junto".
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, U = A.ui, H = A.hub, API = A.api;
  const M = (A.musica = {});
  const estados = new Map(); // cid -> { st, delta }
  const parou = new Set(); // conversas em que você desligou "Ouvindo junto" (até sair da chamada)
  let ouvindo = null, emChamada = null, chave = '', quadro = null, tFalar = 0, acertou = 0;
  const durs = new Map(), durMandada = new Set(); // (0.8.7) duração de cada vídeo (contada pelo tocador)

  M.ligada = () => !!(A.integ && A.integ.ligada('musica'));
  M.ytId = (s) => { s = String(s || '').trim(); const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(s) || /^([A-Za-z0-9_-]{11})$/.exec(s); return m ? m[1] : null; };
  M.ouvindo = () => ouvindo;
  const mandar = (cid, acao, x) => H.enviar({ tipo: 'musica', cid, acao, ...(x || {}) });
  const conv = (cid) => (A.talk && A.talk.conversas || []).find((c) => c.id === cid) || null;
  const posDe = (x) => (!x || x.st.i == null ? 0 : x.st.pausa != null ? x.st.pausa : Math.max(0, (Date.now() - x.delta - x.st.ini) / 1000));
  const atual = (x) => (x && x.st.i != null ? x.st.fila[x.st.i] : null);
  const vol = () => { const v = +(A.cfg.v.musicaVol); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 60; };
  const podeMexer = (cid) => { const c = conv(cid), x = estados.get(cid); if (!c || c.tipo !== 'grupo') return true; return c.meuPapel === 'dono' || c.meuPapel === 'admin' || !!(x && x.st.livre); };
  const manda = (cid) => { const c = conv(cid); return !c || c.tipo !== 'grupo' || c.meuPapel === 'dono' || c.meuPapel === 'admin'; };
  const tempo = (s) => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // ---------- o tocador (um só, escondido; toca a conversa que você está ouvindo) ----------
  const caixa = () => { let c = document.getElementById('musica-tocador'); if (!c) { c = h('div', { id: 'musica-tocador', 'aria-hidden': 'true' }); document.body.append(c); } return c; };
  const falar = (func, args) => { try { if (quadro && quadro.contentWindow) quadro.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), 'https://www.youtube-nocookie.com'); } catch (e) { /* ok */ } };
  // (0.8.7) troca sem corte: a música que sai abaixa aos poucos enquanto a nova entra subindo do zero (a nova começa muda e só sobe
  // quando de fato está tocando, já no ponto certo). O endereço do YouTube fica pré-conectado, então a troca começa mais rápido.
  let nivel = 0, tRampa = 0, subiu = false, tSubir = 0;
  const falarEm = (f, func, args) => { try { if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), 'https://www.youtube-nocookie.com'); } catch (e) { /* ok */ } };
  function sairDevagar(f, de) {
    if (!f) return; let v = de, passo = Math.max(2, de / 9);
    const t = setInterval(() => { v -= passo; if (v <= 0 || !f.isConnected) { clearInterval(t); f.remove(); return; } falarEm(f, 'setVolume', [Math.round(v)]); }, 70);
  }
  function subir() {
    if (subiu || !quadro) return; subiu = true; clearTimeout(tSubir);
    const x = ouvindo ? estados.get(ouvindo) : null; if (x && atual(x) && x.st.pausa == null) { falar('seekTo', [posDe(x), true]); acertou = Date.now(); }
    falar('setVolume', [0]); falar('unMute'); nivel = 0; clearInterval(tRampa);
    tRampa = setInterval(() => { nivel = Math.min(vol(), nivel + Math.max(2, vol() / 8)); falar('setVolume', [Math.round(nivel)]); if (nivel >= vol()) clearInterval(tRampa); }, 60);
  }
  let preconectou = false; // (só com a integração ligada e alguma conversa com música)
  const preconectar = () => { if (preconectou || !M.ligada()) return; preconectou = true; for (const u of ['https://www.youtube-nocookie.com', 'https://i.ytimg.com']) document.head.append(h('link', { rel: 'preconnect', href: u, crossorigin: '' })); };
  function sincronizar() {
    const x = ouvindo ? estados.get(ouvindo) : null, m = atual(x);
    const nova = !x || !m || x.st.pausa != null || !M.ligada() ? '' : ouvindo + ':' + x.st.i + ':' + m.v + ':' + x.st.ini;
    if (nova === chave) return;
    chave = nova; clearInterval(tFalar); clearInterval(tRampa); clearTimeout(tSubir);
    if (quadro) { const velho = quadro; quadro = null; sairDevagar(velho, subiu ? nivel : 0); }
    subiu = false; nivel = 0;
    if (!nova) { A.evt.emit('musica:tocando'); return; }
    const ini = Math.floor(posDe(x));
    // (0.8.7) a música já acabou (ninguém estava ouvindo quando ela terminou): não começa do zero com a barra no fim; o servidor tira ela
    const durJa = m.d || durs.get(m.v) || 0;
    if (durJa && ini > durJa + 3) { chave = ''; mandar(ouvindo, 'ver'); A.evt.emit('musica:tocando'); return; }
    quadro = h('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.v}?autoplay=1&mute=1&start=${ini}&enablejsapi=1&controls=0&rel=0&playsinline=1&disablekb=1`, allow: 'autoplay; encrypted-media', title: 'Música junto', tabindex: '-1' });
    caixa().append(quadro);
    // o player do YouTube só conta o que acontece (acabou, volume) depois de alguém pedir para "ouvir" ele
    let n = 0; tFalar = setInterval(() => { if (!quadro || ++n > 20) { clearInterval(tFalar); return; } try { quadro.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'aero', channel: 'widget' }), 'https://www.youtube-nocookie.com'); } catch (e) { /* ok */ } if (subiu && nivel >= vol()) falar('setVolume', [vol()]); }, 500);
    tSubir = setTimeout(subir, 5000); // (se o YouTube não avisar que começou, sobe assim mesmo)
    A.evt.emit('musica:tocando');
  }
  addEventListener('message', (e) => {
    if (!quadro || e.source !== quadro.contentWindow || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    if (!d) return;
    const tocando = (d.event === 'onStateChange' && d.info === 1) || ((d.event === 'infoDelivery' || d.event === 'initialDelivery') && d.info && d.info.playerState === 1);
    if (tocando) subir();
    // (0.8.7) a duração (vai para o servidor uma vez, para todo mundo ver a barra de tempo) e o acerto: se este tocador se perdeu do
    // ponto da música (travou, a internet caiu e voltou), ele volta para onde todo mundo está
    const inf = d.event === 'infoDelivery' || d.event === 'initialDelivery' ? d.info : null;
    if (inf && ouvindo) {
      const x = estados.get(ouvindo), m = atual(x);
      if (m && +inf.duration > 0) { durs.set(m.v, +inf.duration); if (!m.d && !durMandada.has(ouvindo + ':' + x.st.i + ':' + m.v)) { durMandada.add(ouvindo + ':' + x.st.i + ':' + m.v); mandar(ouvindo, 'dur', { i: x.st.i, d: +inf.duration }); } }
      if (m && x.st.pausa == null && typeof inf.currentTime === 'number' && Date.now() - acertou > 4000) {
        const alvo = posDe(x), dur = m.d || durs.get(m.v) || 0;
        if (dur && alvo > dur + 3) { acertou = Date.now() + 60000; falar('pauseVideo'); mandar(ouvindo, 'ver'); } // já tinha acabado
        else if (Math.abs(inf.currentTime - alvo) > 2.5) { acertou = Date.now(); falar('seekTo', [alvo, true]); }
      }
    }
    const fim = (d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 0);
    if (fim && ouvindo) { const x = estados.get(ouvindo); if (x && x.st.i != null) mandar(ouvindo, 'fim', { i: x.st.i }); }
  });
  // (0.9.3) na chamada, a música da conversa da chamada toca para todo mundo que está nela (com a integração), e a voz das pessoas
  // continua no volume de sempre (antes a chamada ficava muda para quem punha a música). Nunca tocam duas músicas juntas (é um tocador só).
  const surdo = () => { if (A.chamada && A.chamada.surdoMusica) A.chamada.surdoMusica(false); };
  M.ouvir = (cid, sim = true) => {
    if (sim) { parou.delete(cid); ouvindo = cid; if (!estados.has(cid)) mandar(cid, 'ver'); } else { parou.add(cid); if (ouvindo === cid) ouvindo = null; } // (0.9.3) desligou: a chamada não liga de novo sozinha
    sincronizar(); A.evt.emit('musica:estado', { cid });
  };
  M.volume = (v) => { A.cfg.v.musicaVol = v; A.cfg.salvar(); if (subiu) { clearInterval(tRampa); nivel = v; falar('setVolume', [v]); } };

  // ---------- o que chega do servidor ----------
  A.evt.on('hub:musica', (m) => {
    if (!m || !m.cid || !m.st) return;
    if (m.st.i != null) preconectar();
    const antes = estados.get(m.cid);
    estados.set(m.cid, { st: m.st, delta: Date.now() - (m.agora || Date.now()) });
    // começou a tocar numa conversa em que você está (na chamada dela ou com ela aberta): você entra junto
    // (0.8.7) você ouve a última conversa em que entrou que está tocando: começou a tocar na conversa aberta, ou a conversa em que
    // você acabou de entrar já estava tocando, e ela passa a ser a que você ouve (a outra para só para você). Na chamada, nada sozinho.
    const comecou = m.st.i != null && (!antes || antes.st.i == null);
    const tocaAgora = m.st.i != null && m.st.pausa == null;
    const entrouAgora = esperando === m.cid; if (entrouAgora) esperando = null;
    if (M.ligada() && tocaAgora && ouvindo !== m.cid && (emChamada ? emChamada === m.cid && !parou.has(m.cid) : A.talk && A.talk.aberta === m.cid && (comecou || entrouAgora))) ouvindo = m.cid; // (0.9.3) na chamada: a música da chamada
    if (m.cid === ouvindo) sincronizar();
    A.evt.emit('musica:estado', { cid: m.cid });
  });
  // (0.8.7) a conexão caiu e voltou: pergunta de novo o que está tocando e em que ponto (o tocador volta para o lugar certo sozinho)
  A.evt.on('hub:conectou', () => { if (!M.ligada()) return; const cs = new Set([ouvindo, emChamada, A.talk && A.talk.aberta].filter(Boolean)); cs.forEach((c) => mandar(c, 'ver')); });
  // (1.0.0) o servidor não achou a música no YouTube (dos servidores da Cloudflare o YouTube às vezes bloqueia a busca por um tempo): no app
  // do PC, quem pôs procura com a própria internet e manda o vídeo achado. O aviso de erro só aparece se aqui também não achar
  const pedidos = new Map(); // cid -> { x, nome, em, tentou }
  M._pedidos = pedidos;
  A.evt.on('hub:musica-erro', async (m) => {
    if (!m || !m.msg) return;
    const p = m.cid && pedidos.get(m.cid), achar = window.aero && window.aero.musicaAchar;
    if (p && achar && !p.tentou && Date.now() - p.em < 30000 && /achei|reconheci/i.test(m.msg) && (p.x.url || p.nome)) {
      p.tentou = true;
      const r = await achar(p.x.url ? { url: p.x.url, q: p.nome || '' } : { q: p.nome }).catch(() => null);
      if (r && r.v) { A.log.info('música junto: o servidor não achou; achada pelo app', r.v); mandar(m.cid, 'por', { v: r.v, f: /music\.youtube/.test(p.x.url || '') ? 'ytmusic' : 'youtube' }); return; }
      A.log.aviso('música junto: nem o servidor nem o app acharam', p.x.url || p.nome);
    }
    U.toast(m.msg, { tipo: 'erro' });
  });
  A.evt.on('chamada:entrou', (x) => { emChamada = x && x.cid; if (emChamada && M.ligada()) { const y = estados.get(emChamada); if (y && atual(y) && y.st.pausa == null && ouvindo !== emChamada && !parou.has(emChamada)) { ouvindo = emChamada; sincronizar(); A.evt.emit('musica:estado', { cid: emChamada }); } mandar(emChamada, 'ver'); } surdo(); });
  A.evt.on('chamada:fim', () => { emChamada = null; parou.clear(); surdo(); });
  A.evt.on('musica:tocando', surdo);
  // entrou numa conversa: se ela está tocando, passa a ser a que você ouve (a resposta do servidor decide, no hub:musica)
  let esperando = null;
  A.evt.on('talk:abriu', (cid) => {
    if (!M.ligada() || emChamada || !cid || cid === ouvindo) { pip(); return; }
    const x = estados.get(cid);
    if (x && atual(x) && x.st.pausa == null) { ouvindo = cid; sincronizar(); A.evt.emit('musica:estado', { cid }); }
    else { esperando = cid; mandar(cid, 'ver'); }
    pip();
  });

  // ---------- (0.8.7) o mini tocador (PiP): ouvindo uma conversa que não está aberta, ela fica num cantinho embaixo à esquerda ----------
  // No celular não aparece (não cabe sem cobrir nada). Abrir leva à conversa; o X para de ouvir (só para você).
  const estreito = matchMedia('(max-width: 760px)');
  let pipEl = null, pipChave = '', tPip = 0;
  function pip() {
    const x = ouvindo ? estados.get(ouvindo) : null, m = atual(x);
    const mostra = !!m && x.st.pausa == null && M.ligada() && !estreito.matches && !(A.talk && A.talk.aberta === ouvindo) && !document.querySelector('.cham-janela.modo-max');
    clearTimeout(tPip); if (ouvindo) tPip = setTimeout(pip, 1000);
    if (!mostra) { if (pipEl) { const e = pipEl; pipEl = null; pipChave = ''; e.classList.add('sai'); setTimeout(() => e.remove(), 220); } return; }
    const ch = ouvindo + ':' + x.st.i + ':' + m.v;
    if (pipEl && pipChave === ch) return;
    const c = conv(ouvindo), cid = ouvindo;
    const novo = h('div', { class: 'mu-pip vidro', role: 'region', 'aria-label': T('Música junto', 'Music together') },
      capaDe(m.c || `https://i.ytimg.com/vi/${m.v}/mqdefault.jpg`, 'mu-pip-capa'),
      h('button', { type: 'button', class: 'mu-pip-tx', title: T('Escolher o que ouvir', 'Choose what to listen to'), 'aria-haspopup': 'dialog', onclick: (e) => escolherPip(e.currentTarget.closest('.mu-pip') || e.currentTarget) },
        h('b', { title: m.t || '' }, m.t || 'YouTube'), h('small', {}, (m.a ? m.a + ' · ' : '') + ((c && c.nome) || T('Conversa', 'Conversation')))),
      h('div', { class: 'mu-pip-vis', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Parar de ouvir (só para você)', 'Stop listening (just for you)'), onclick: () => M.ouvir(cid, false) }));
    if (pipEl) pipEl.replaceWith(novo); else document.body.append(novo);
    pipEl = novo; pipChave = ch;
  }
  // (0.8.7) clicar no mini tocador: as conversas que estão tocando agora, cada uma com a música e o nome da conversa. Escolher uma troca
  // o que você ouve (a troca é suave); a setinha abre a conversa
  function escolherPip(ancora) {
    const lista = [...estados.entries()].filter(([, x]) => atual(x) && x.st.pausa == null).sort(([a], [b]) => (a === ouvindo ? -1 : b === ouvindo ? 1 : 0));
    const corpo = h('div', { class: 'col mu-esc' });
    const pintar = () => {
      corpo.replaceChildren(...lista.map(([cid, x]) => {
        const m = atual(x), c = conv(cid), eu = cid === ouvindo;
        return h('div', { class: 'mu-esc-it' + (eu ? ' atual' : '') },
          h('button', { type: 'button', class: 'mu-esc-ouvir', 'aria-pressed': String(eu), onclick: () => { if (!eu) { M.ouvir(cid); A.som.tocar('clique'); pintar(); } } },
            capaDe(m.c || `https://i.ytimg.com/vi/${m.v}/mqdefault.jpg`, 'mu-esc-capa'),
            h('span', { class: 'mu-esc-tx' }, h('b', {}, m.t || 'YouTube'), h('small', {}, (c && c.nome) || T('Conversa', 'Conversation'))),
            eu ? h('span', { class: 'mu-pip-vis', 'aria-label': T('Ouvindo agora', 'Listening now') }, h('i'), h('i'), h('i'), h('i')) : h('span', { class: 'mu-esc-tag' }, T('Ouvir', 'Listen'))),
          U.btn('', { icone: 'setaD', tipo: 'sec', redondo: true, peq: true, titulo: T('Abrir a conversa', 'Open the conversation'), onclick: () => { if (pop) pop.fechar(); if (A.talk && A.talk.irPara) A.talk.irPara(cid); } }));
      }));
    };
    pintar();
    const pop = U.popover(ancora, corpo, { largura: 320, titulo: T('Tocando nas suas conversas', 'Playing in your chats') });
  }
  A.evt.on('musica:tocando', pip); A.evt.on('musica:estado', pip); estreito.addEventListener('change', pip);
  A.evt.on('integ:mudou', () => { if (!M.ligada()) { ouvindo = null; } sincronizar(); });

  // as capas vêm pelo servidor do Aero (nada de falar direto com sites de fora)
  const FONTE = { spotify: 'Spotify', deezer: 'Deezer', ytmusic: 'YouTube Music', youtube: 'YouTube' };
  const capaDe = (c, cls) => h('div', { class: cls, estilo: c ? { 'background-image': `url("${API.servidor}/api/capa?u=${encodeURIComponent(c)}")` } : {} });
  // ---------- o menu (no topo do chat e na chamada) ----------
  M.abrir = (cid, ancora) => {
    if (!M.ligada()) return;
    mandar(cid, 'ver');
    const corpo = h('div', { class: 'mu-menu' });
    // (0.8.7) procurar pelo nome (Deezer e YouTube Music) ou colar um link do Spotify, do Deezer ou do YouTube / YouTube Music
    const campo = h('input', { class: 'campo', type: 'search', maxlength: 300, placeholder: T('Procure uma música ou cole um link', 'Search a song or paste a link'), 'aria-label': T('Procurar música', 'Search song') });
    const res = h('div', { class: 'mu-res' });
    const adicionar = (x, nome) => { pedidos.set(cid, { x, nome: nome || '', em: Date.now(), tentou: false }); mandar(cid, 'por', x); campo.value = ''; res.replaceChildren(); A.som.tocar('bolha'); if (ouvindo !== cid) M.ouvir(cid, true); };
    const por = () => {
      const q = campo.value.trim(); if (!q) return;
      if (/^https?:\/\//.test(q)) { const v = /youtu\.?be/.test(q) ? M.ytId(q) : null; adicionar(v ? { v, f: /music\.youtube/.test(q) ? 'ytmusic' : 'youtube' } : { url: q }); return; }
      const b = res.querySelector('.mu-op'); if (b) b.click();
    };
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') por(); });
    let tt = 0, vez = 0;
    campo.addEventListener('input', () => {
      clearTimeout(tt); const q = campo.value.trim(), eu = ++vez;
      if (q.length < 2 || /^https?:\/\//.test(q)) { res.replaceChildren(); return; }
      tt = setTimeout(async () => {
        try {
          const d = await fetch(`${API.servidor}/api/busca?tipo=mu&q=${encodeURIComponent(q)}`, { headers: { Authorization: 'Bearer ' + API.token } }).then((r) => r.json());
          if (eu !== vez) return;
          const l = d.itens || [];
          res.replaceChildren(...(l.length ? l.map((x) => h('button', { type: 'button', class: 'mu-op', onclick: () => adicionar(x.v ? { v: x.v, f: 'ytmusic' } : { id: x.id }, [x.a, x.t].filter(Boolean).join(' ')) },
            capaDe(x.c, 'mu-mini'), h('span', { class: 'cresce' }, h('b', {}, x.t), h('small', { class: 'suave' }, (x.a ? x.a + ' · ' : '') + (x.f === 'deezer' ? 'Deezer' : 'YouTube Music'))))) : [h('div', { class: 'peq suave' }, T('Nada encontrado.', 'Nothing found.'))]));
        } catch (e) { if (eu === vez) res.replaceChildren(h('div', { class: 'peq suave' }, T('A busca não respondeu.', 'Search did not answer.'))); }
      }, 380);
    });
    // (0.8.7) a barra de tempo: quem pode mexer na música (na DM os dois) arrasta para outro ponto, e todo mundo vai junto
    let segurando = false;
    const largou = () => { setTimeout(() => { segurando = false; }, 0); }; addEventListener('pointerup', largou, true);
    const barraTempo = (x, m, pode) => {
      const dur = m.d || durs.get(m.v) || 0, pos = posDe(x);
      const sl = U.slider({ min: 0, max: Math.max(1, Math.round(dur)), valor: Math.min(pos, dur || pos), oninput: (v) => { segurando = true; t1.textContent = tempo(v); },
        onchange: (v) => { segurando = false; if (pode && dur) mandar(cid, 'buscar', { s: v }); } });
      sl.classList.add('mu-seek'); sl.disabled = !pode || !dur; sl.setAttribute('aria-label', T('Tempo da música', 'Song position'));
      sl.addEventListener('pointerdown', () => { segurando = true; });
      const t1 = h('small', { class: 'mu-tempo' }, tempo(pos)), t2 = h('small', { class: 'mu-dur' }, dur ? tempo(dur) : '--:--');
      return h('div', { class: 'mu-barra' }, t1, sl, t2);
    };
    const pintar = () => {
      const x = estados.get(cid), m = atual(x), pode = podeMexer(cid), toc = !!m && x.st.pausa == null;
      const bt = (ic, tit, acao, dis) => { const b = U.btn('', { icone: ic, tipo: 'sec', redondo: true, peq: true, titulo: tit, onclick: acao }); b.disabled = !!dis; return b; };
      const capa = (v, cls, c) => capaDe(c || `https://i.ytimg.com/vi/${v}/mqdefault.jpg`, cls);
      // (0.8.7) o cartão do que está tocando: a capa desfocada no fundo e um visualizador de barras embaixo (parado quando pausa)
      const barras = h('div', { class: 'mu-vis', 'aria-hidden': 'true' }, ...Array.from({ length: 32 }, (_, i) => h('i', { estilo: { '--d': (-((i * 37) % 11) / 10) + 's', '--a': (0.35 + ((i * 53) % 13) / 20).toFixed(2), '--t': (0.7 + ((i * 29) % 7) / 10).toFixed(2) + 's' } })));
      const agora = m ? h('div', { class: 'mu-agora' + (toc ? ' toca' : '') }, capa(m.v, 'mu-agora-fundo', m.c),
        h('div', { class: 'mu-agora-cima' }, capa(m.v, 'mu-capa', m.c),
          h('div', { class: 'cresce mu-agora-tx' }, h('b', { title: m.t }, m.t || 'YouTube'), h('div', { class: 'mu-art' }, m.a || ''),
            h('small', { class: 'mu-de' }, [FONTE[m.f], T('pôs: ', 'added by: ') + (m.nome || '')].filter(Boolean).join(' · ')))),
        h('div', { class: 'mu-agora-baixo' }, barras), barraTempo(x, m, pode))
        : h('div', { class: 'mu-vazio suave' }, A.icone('musica', 26), h('span', {}, T('Nada tocando. Procure uma música ou cole um link do Spotify, Deezer ou YouTube Music.', 'Nothing playing. Search a song or paste a Spotify, Deezer or YouTube Music link.')));
      const controles = h('div', { class: 'mu-ctl' },
        bt('setaE', T('Anterior', 'Previous'), () => mandar(cid, 'voltar'), !pode || !x || !x.st.fila.length),
        bt(toc ? 'pausa' : 'play', toc ? T('Pausar', 'Pause') : T('Tocar', 'Play'), () => mandar(cid, toc ? 'pausar' : m ? 'tocar' : 'ir', m ? {} : { k: 0 }), !pode || !x || !x.st.fila.length),
        bt('setaD', T('Próxima', 'Next'), () => mandar(cid, 'pular'), !pode || !m),
        bt('atualizar', T('Recomeçar a música', 'Restart song'), () => mandar(cid, 'recomecar'), !pode || !m));
      const ouvir = h('label', { class: 'linha mu-ouvir' }, h('span', { class: 'cresce' }, T('Ouvindo junto', 'Listening along')), U.chave(ouvindo === cid, (v) => M.ouvir(cid, v)));
      const volume = h('label', { class: 'linha mu-vol' }, A.icone('volume', 16), U.slider({ min: 0, max: 100, valor: vol(), oninput: (v) => M.volume(+v) }));
      const fila = x && x.st.fila.length ? h('div', { class: 'mu-fila' }, ...x.st.fila.map((it, k) => h('div', { class: 'mu-it' + (k === x.st.i ? ' sel' : '') + (x.st.i != null && k < x.st.i ? ' foi' : ''), role: 'button', tabindex: '0', title: pode ? T('Tocar esta', 'Play this') : '', onclick: () => { if (pode && k !== x.st.i) mandar(cid, 'ir', { k }); } },
        capa(it.v, 'mu-mini', it.c), h('div', { class: 'cresce' }, h('div', { class: 'mu-it-t' }, it.t || it.v), h('small', { class: 'suave' }, [FONTE[it.f], it.nome].filter(Boolean).join(' · '))),
        pode ? bt('fechar', T('Tirar da fila', 'Remove'), (e) => { e.stopPropagation(); mandar(cid, 'tirar', { k }); }) : null))) : null;
      const c = conv(cid);
      const livre = c && c.tipo === 'grupo' && manda(cid) ? h('label', { class: 'linha mu-livre' }, h('span', { class: 'cresce peq' }, T('Todo mundo do grupo pode mexer', 'Everyone in the group can control')), U.chave(!!(x && x.st.livre), (v) => mandar(cid, 'livre', { sim: v }))) : null;
      const aviso = !pode ? h('div', { class: 'suave peq' }, T('Só o dono e os admins mexem na música deste grupo.', 'Only the owner and admins control music in this group.')) : null;
      corpo.replaceChildren(agora, controles, pode ? h('div', { class: 'linha mu-por' }, campo, U.btn(T('Pôr', 'Add'), { icone: 'mais', peq: true, onclick: por })) : null, pode ? res : null, aviso, ouvir, volume, livre,
        fila ? h('div', { class: 'mu-fila-tit suave peq' }, T('Fila', 'Queue') + ' · ' + x.st.fila.length) : null, fila);
    };
    pintar();
    const off = A.evt.on('musica:estado', (e) => { if (!e || e.cid === cid) { const foco = document.activeElement === campo; pintar(); if (foco) campo.focus(); } });
    const relogio = setInterval(() => {
      if (segurando) return;
      const x = estados.get(cid), m = atual(x), t = corpo.querySelector('.mu-tempo'), sl = corpo.querySelector('.mu-seek');
      if (!m) return;
      const dur = m.d || durs.get(m.v) || 0, p = posDe(x);
      if (t) t.textContent = tempo(dur ? Math.min(p, dur) : p);
      if (sl && dur) { if (+sl.max !== Math.round(dur)) { sl.max = Math.round(dur); sl.disabled = !podeMexer(cid); const d2 = corpo.querySelector('.mu-dur'); if (d2) d2.textContent = tempo(dur); } sl.atualizar(Math.min(p, dur)); }
    }, 500);
    U.popover(ancora, corpo, { largura: 360, titulo: T('Música junto', 'Music together'), aoFechar: () => { off(); clearInterval(relogio); removeEventListener('pointerup', largou, true); } });
    A.som.tocar('pop-abrir');
  };
  // o botão do topo do chat acende enquanto você ouve aquela conversa
  M.tocandoEm = (cid) => { const x = estados.get(cid); return ouvindo === cid && !!atual(x) && x.st.pausa == null; };
})();
