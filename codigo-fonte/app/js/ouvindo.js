// Aero Stream - (1.0.0) "Ouvindo agora", como o do Discord. O app do PC descobre a música que toca no computador (desktop/ouvindo.js:
// o app do Spotify e, pelo navegador, YouTube Music e Deezer) e manda ao servidor só quando muda (outra música, pausou, pulou um
// pedaço). Os amigos veem:
//  - nas listas (Aero Talk, membros do grupo, Conexões): uma notinha com o nome do artista embaixo do nome;
//  - no perfil e no mini perfil: o cartão "Ouvindo Spotify" com a capa, a música, o artista e a barra andando com os tempos.
// A barra é calculada aqui pelo próprio relógio (o servidor manda quanto já tinha tocado quando avisou). Invisível: ninguém vê.
// Pode ser desligado em Configurações > Privacidade. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const O = (A.ouvindo = {});
  const ponte = () => (window.aero && window.aero.ouvindo) || null;
  const NOMES = { spotify: 'Spotify', ytmusic: 'YouTube Music', deezer: 'Deezer' };
  // o símbolo de cada serviço, desenhado aqui (fixo no código, nunca vem de fora)
  const LOGO = {
    spotify: '<circle cx="12" cy="12" r="11" fill="#1db954"/><path d="M6.6 9.3c3.6-1.1 7.6-.8 10.9 1M7.2 12.4c3-.9 6.2-.6 8.9.9M7.8 15.3c2.4-.6 4.8-.4 6.9.7" fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round"/>',
    ytmusic: '<circle cx="12" cy="12" r="11" fill="#ff0033"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M10.4 9.6v4.8l4-2.4z" fill="#fff"/>',
    deezer: '<rect x="2" y="15" width="4" height="3" rx=".6" fill="#a238ff"/><rect x="7" y="12" width="4" height="6" rx=".6" fill="#c25cff"/><rect x="12" y="9" width="4" height="9" rx=".6" fill="#d97bff"/><rect x="17" y="6" width="4" height="12" rx=".6" fill="#ef9bff"/>',
  };
  const logo = (f, tam = 14) => {
    if (!LOGO[f]) return A.icone('musica', tam);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tam); s.setAttribute('height', tam); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ouv-logo'); s.innerHTML = LOGO[f]; return s;
  };
  O.logo = logo;
  let meu = null, enviado = null, pausadoDesde = 0, ligouPonte = null, olhando = false, local = null; // local: o que toca aqui agora (mesmo pausado)

  O.disponivel = () => !!ponte();
  O.ligado = () => !!ponte() && (A.cfg.v.ouvir || {}).ativo !== false;
  O.nome = (f) => NOMES[f] || T('música', 'music');
  O.pos = (o) => { const p = Math.max(0, (o.dt || 0) + (Date.now() - (o._rx || Date.now()))); return o.d ? Math.min(p, o.d) : p; };

  // o que a pessoa está ouvindo agora (você: o deste computador; os outros: o aparelho que avisou por último)
  O.de = (cod) => {
    const eu = (A.api && A.api.eu) || {};
    if (!cod) return null;
    if (cod === eu.codigo && meu) return meu; // (1.0.0) sem nada aqui, a atividade de outro aparelho seu
    const ds = A.hub && A.hub.dispositivosDe ? A.hub.dispositivosDe(cod) : [];
    let m = null; for (const d of ds) if (d.ouv && d.ouv.t && (!m || (d.ouv._rx || 0) > (m._rx || 0))) m = d.ouv;
    if (m && m.d && (m.dt || 0) + (Date.now() - (m._rx || 0)) > m.d + 60000) return null; // a música acabou faz tempo e não veio outra
    return m;
  };

  // ---------- mandar a minha música ----------
  const chave = (x) => (x ? [x.f, x.t, x.a, x.al].join('\u0001') : '');
  const mandar = (ouv) => { if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'ouvindo', ouv }); };
  async function olhar() {
    const p = ponte();
    if (!p || olhando || !A.api || !A.api.eu) return;
    if (!O.ligado()) { if (ligouPonte !== false) { ligouPonte = false; p.ligar(false).catch(() => {}); } if (meu || enviado) { meu = null; enviado = null; mandar(null); O.pintar(); } return; }
    if (ligouPonte !== true) { ligouPonte = true; try { await p.ligar(true); } catch (e) { return; } }
    olhando = true;
    let x = null; try { x = await p.agora(); } catch (e) { x = null; } finally { olhando = false; }
    local = x ? { ...x } : null;
    if (!O.ligado()) return;
    const agora = Date.now();
    // pausou: some quase na hora (confere de novo 0,4 s depois, para um clique duplo no play não piscar na tela dos amigos)
    if (x && !x.tocando) { if (!pausadoDesde) pausadoDesde = agora; if (agora - pausadoDesde < 350 && enviado && chave(enviado) === chave(x)) { setTimeout(olhar, 400); return; } x = null; } else pausadoDesde = 0;
    if (!x) { if (meu || enviado) { meu = null; enviado = null; mandar(null); O.pintar(); } return; }
    // (1.0.2) Spotify do Windows: sem o código da música e muitas vezes sem a capa. Procura uma vez por música (sem esperar)
    if (x.f === 'spotify' && !x.id) { const k = chave(x); if (achados.has(k)) { const v = achados.get(k); if (v) { x.id = v.id; if (v.img) x.img = v.img; } } else achar(x).then((v) => { if (v) setTimeout(olhar, 30); }); }
    const dados = { f: x.f, t: x.t, a: x.a || '', al: x.al || '', img: x.img || '', id: x.id || '', k: x.k === 'ep' ? 'ep' : '', d: x.d || 0, jn: junto && combina(x, O.de(junto.cod)) ? junto.cod : '' };
    const ini = x.em - x.p;
    meu = { ...dados, dt: x.p, _rx: x.em };
    // só avisa quando muda: outra música, outra capa ou a posição pulou (alguém arrastou a barra)
    if (!enviado || chave(enviado) !== chave(dados) || enviado.img !== dados.img || enviado.jn !== dados.jn || Math.abs(enviado.ini - ini) > 3000) {
      enviado = { ...dados, ini };
      mandar({ ...dados, p: x.p });
      O.pintar();
    }
  }
  // (1.0.2) o Windows não conta qual é a música (o código do Spotify) nem, muitas vezes, a capa: sem o código, os amigos não tinham o
  // "Ouvir junto". O servidor procura no Spotify pelo nome e pelo artista (a mesma busca da música do perfil) e confere a duração
  const achados = new Map(); // chave -> { id, img } | null (procurando ou não achou)
  async function achar(x) {
    const k = chave(x), API = A.api;
    if (!API || !API.token || !API.servidor) return null;
    achados.set(k, null); if (achados.size > 100) achados.delete(achados.keys().next().value);
    try {
      const art = String(x.a || '').split(/,|&| feat\.? | ft\.? /i)[0].trim();
      const q = ('track:' + x.t + (art ? ' artist:' + art : '')).slice(0, 100);
      const r = await fetch(API.servidor + '/api/spotify?q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + API.token } });
      if (!r.ok) { if (r.status === 429 || r.status >= 500) setTimeout(() => achados.delete(k), 120000); return null; }
      const fs = ((await r.json()) || {}).faixas || [];
      const n = (v) => norm(v).replace(/\s*[-(\[].*$/, '');
      const ok = (f) => f && f.id && n(f.nome) === n(x.t) && (!art || norm(f.artista).includes(norm(art)));
      const f = fs.find((f) => ok(f) && (!x.d || !f.duracao || Math.abs(f.duracao - x.d) < 5000)) || fs.find(ok);
      const v = f ? { id: f.id, img: f.capa || '' } : null; achados.set(k, v); return v;
    } catch (e) { achados.delete(k); return null; }
  }

  // ---------- (1.0.0) "Ouvir junto" (como a jam do Spotify / o "ouvir junto" do Discord) ----------
  // Quem estava ouvindo lidera: aqui só seguimos. A música dele abre no nosso Spotify (ou no YouTube Music/Deezer do navegador),
  // no mesmo tempo; quando ele troca, pausa, volta ou pula, a gente vai junto. Trocar de música por conta própria sai da jam.
  let junto = null; // { cod, desde, cmdEm, tentativas, casou, sumiu }
  const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const combina = (a, b) => !!(a && b && a.f === b.f && (a.id && b.id ? a.id === b.id : norm(a.t) === norm(b.t)));
  O.podeJunto = (cod) => { const o = O.de(cod), p = ponte(); return !!(o && o.id && p && p.tocar && O.ligado() && cod !== ((A.api && A.api.eu) || {}).codigo); };
  O.junto = () => (junto ? junto.cod : null);
  O.entrarJunto = (cod) => { if (!O.podeJunto(cod)) return; junto = { cod, desde: Date.now(), cmdEm: 0, tentativas: 0, casou: false, sumiu: 0, alvo: '' }; enviado = null; seguir(); O.pintar(); A.evt.emit('ouvir:junto', cod); };
  O.sairJunto = () => { if (!junto) return; junto = null; enviado = null; O.pintar(); A.evt.emit('ouvir:junto', null); setTimeout(olhar, 50); };
  let seguindo = false;
  async function seguir() {
    const p = ponte(); if (!junto || seguindo || !p || !p.tocar) return;
    if (!O.ligado()) return O.sairJunto();
    const L = O.de(junto.cod), agora = Date.now();
    seguindo = true;
    try {
      if (!L || !L.t) { // o líder pausou ou parou: pausa aqui também; 2 minutos sem nada, a jam acaba
        if (!junto.sumiu) { junto.sumiu = agora; if (local && local.tocando && junto.casou) await p.tocar({ f: local.f, id: local.id || junto.ultId || '', k: local.k || '', p: local.p, tocando: false, t: local.t }); }
        else if (agora - junto.sumiu > 120000) O.sairJunto();
        return;
      }
      junto.sumiu = 0;
      if (!L.id) return O.sairJunto();
      const pos = O.pos(L), c = { f: L.f, id: L.id, k: L.k || '', p: pos, tocando: true, t: L.t };
      if (junto.alvo !== L.id) { junto.alvo = L.id; junto.ultId = L.id; junto.tentativas = 0; junto.cmdEm = 0; junto.casou = false; } // o líder trocou de música
      const aqui = local && combina(local, L);
      if (!aqui) {
        // mudou de música por conta própria depois de já estar junto: sai da jam (como no Discord)
        if (junto.casou && local && local.tocando && agora - junto.cmdEm > 8000) return O.sairJunto();
        if (agora - junto.cmdEm < 7000) return;
        if (++junto.tentativas > 4) return O.sairJunto(); // não deu para abrir aqui
        junto.cmdEm = agora; await p.tocar(c); setTimeout(olhar, 600);
        return;
      }
      junto.casou = true;
      const dif = Math.abs((local.p || 0) + (local.tocando ? agora - (local.em || agora) : 0) - pos);
      if ((!local.tocando || dif > 3000) && agora - junto.cmdEm > 3500) { junto.cmdEm = agora; await p.tocar(c); setTimeout(olhar, 600); }
    } catch (e) { /* tenta de novo na próxima */ } finally { seguindo = false; }
  }

  if (ponte()) {
    setInterval(olhar, 1000);
    setInterval(() => { if (junto) seguir(); }, 1000);
    A.evt.on('hub:ouvindo', (m) => { if (junto && m && m.codigo === junto.cod) setTimeout(seguir, 30); });
    // o PC avisa na hora quando o player pausa, volta ou troca de música (Linux pelo D-Bus; a extensão do navegador também)
    if (ponte().aoMudar) ponte().aoMudar(() => { if (olhando) setTimeout(olhar, 250); else olhar(); });
    A.evt.on('hub:conectou', () => { enviado = null; setTimeout(olhar, 800); }); // a conexão voltou: o servidor esqueceu, avisa de novo
    A.evt.on('ouvir:config', () => { setTimeout(olhar, 50); });
  }

  // ---------- na tela ----------
  // podcasts passam de 1 hora: aí vira h:mm:ss
  const mmss = (ms, longo) => { const s = Math.floor(ms / 1000), h2 = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0'); return longo || h2 ? h2 + ':' + String(m).padStart(2, '0') + ':' + ss : String(m).padStart(2, '0') + ':' + ss; };
  const ehPod = (o) => o && o.k === 'ep';
  O.ehPodcast = ehPod;
  const dica = (o) => ehPod(o) ? T('Ouvindo um podcast no ', 'Listening to a podcast on ') + O.nome(o.f) + ': ' + o.t + (o.a ? ' — ' + o.a : '') : T('Ouvindo ', 'Listening to ') + O.nome(o.f) + ': ' + o.t + (o.a ? ' — ' + o.a : '');

  // a linha das listas: ♫ Artista (verde no Spotify, como no Discord)
  O.linha = (cod) => { const el = h('div', { class: 'ouv-linha', dados: { ouvCod: cod || '' }, hidden: true }); preencherLinha(el); return el; };
  function preencherLinha(el) { preencherLinha0(el); if (A.ui && A.ui.atvMais) A.ui.atvMais(el); } // (1.0.2) "+1" com várias atividades
  function preencherLinha0(el) {
    const o = O.de(el.dataset.ouvCod), k = o ? chave(o) : '';
    if (el.dataset.k === k) return;
    el.dataset.k = k; el.hidden = !o; el.textContent = '';
    if (!o) { el.removeAttribute('title'); return; }
    el.className = 'ouv-linha f-' + o.f + (ehPod(o) ? ' pod' : ''); el.title = dica(o);
    el.append(logo(o.f, 12), ehPod(o) ? A.icone('mic', 11) : null, h('span', {}, o.a || o.t));
  }

  // o cartão do perfil: "Ouvindo Spotify", a capa, a música, o artista e a barra com os tempos
  O.cartao = (cod, opc = {}) => { const el = h('div', { class: 'ouv-cartao' + (opc.mini ? ' mini' : ''), dados: { ouvCartao: cod || '' }, hidden: true }); preencherCartao(el); setTimeout(O.pintar, 0); setTimeout(O.pintar, 600); return el; }; // (a barra começa a andar quando ele entra na tela)
  function preencherCartao(el) {
    const cod = el.dataset.ouvCartao, o = O.de(cod), ouvintes = o ? quemOuveJunto(cod) : [];
    const k = o ? [chave(o), o.img || '', o.id || '', O.podeJunto(cod) ? (junto && junto.cod === cod ? 'J' : 'P') : '', o.jn || '', ouvintes.map((x) => x.codigo).join(',')].join('\u0001') : '';
    if (el.dataset.k !== k) {
      el.dataset.k = k; el.hidden = !o; el.textContent = '';
      if (!o) return;
      const pod = ehPod(o);
      el.className = 'ouv-cartao f-' + o.f + (pod ? ' pod' : '') + (el.classList.contains('mini') ? ' mini' : '');
      const link = o.f === 'spotify' && o.id ? 'https://open.spotify.com/' + (pod ? 'episode/' : 'track/') + o.id : '';
      const abrir = link ? (e) => { e.stopPropagation(); A.ui.abrirFora(link); } : null;
      const capa = h('span', { class: 'ouv-capa' }, A.icone('musica', 26));
      if (o.img) { const im = h('img', { alt: '', draggable: 'false', loading: 'lazy', referrerpolicy: 'no-referrer', src: o.img }); im.addEventListener('error', () => im.remove()); capa.append(im); }
      el.append(
        h('div', { class: 'ouv-cab' }, h('span', { class: 'ouv-selo' }, logo(o.f, 15)), h('span', { class: 'ouv-cab-t' }, pod ? T('Ouvindo um podcast no ', 'Listening to a podcast on ') + O.nome(o.f) : T('Ouvindo ', 'Listening to ') + O.nome(o.f)),
          pod ? h('span', { class: 'ouv-tag' }, A.icone('mic', 11), 'Podcast') : null),
        h('div', { class: 'ouv-corpo' }, link ? h('button', { type: 'button', class: 'sem-botao ouv-capa-bt', title: T('Abrir no Spotify', 'Open in Spotify'), onclick: abrir }, capa) : capa,
          h('div', { class: 'ouv-info' },
            link ? h('button', { type: 'button', class: 'sem-botao ouv-tit', title: o.t, onclick: abrir }, o.t) : h('b', { class: 'ouv-tit', title: o.t }, o.t),
            o.a ? h('div', { class: 'ouv-art', title: o.a }, pod ? A.icone('mic', 11) : null, h('span', {}, o.a)) : null,
            o.d ? h('div', { class: 'ouv-barra' }, h('span', { class: 'ouv-t ouv-ja' }), h('span', { class: 'ouv-trilho' }, h('i')), h('span', { class: 'ouv-t ouv-tot' }, mmss(o.d))) : null)),
        rodapeJunto(cod, o, ouvintes));
    }
    if (o && o.d) {
      const p = O.pos(o), ja = el.querySelector('.ouv-ja'), bar = el.querySelector('.ouv-trilho > i');
      const t = mmss(p, o.d >= 3600000); if (ja && ja.textContent !== t) ja.textContent = t;
      if (bar) bar.style.width = (Math.min(1, p / o.d) * 100).toFixed(2) + '%';
    }
  }

  // quem está ouvindo junto com esta pessoa (entre os amigos que você vê) e o botão de entrar/sair da jam
  function quemOuveJunto(cod) {
    const H = A.hub; if (!H || !H.presenca) return [];
    const vistos = new Map();
    for (const d of H.presenca.values()) if (d.ouv && d.ouv.jn === cod && d.codigo !== cod) vistos.set(d.codigo, d);
    const eu = (A.api && A.api.eu) || {};
    if (junto && junto.cod === cod && meu && meu.jn === cod) vistos.set(eu.codigo, eu);
    return [...vistos.values()].slice(0, 6);
  }
  function rodapeJunto(cod, o, ouvintes) {
    const pode = O.podeJunto(cod), nele = junto && junto.cod === cod;
    if (!pode && !ouvintes.length && !o.jn) return null;
    const lider = o.jn ? (A.hub && A.hub.dispositivosDe(o.jn)[0]) : null;
    const nomeDe = (x) => (x && (x.apelido || x.nome)) || '';
    return h('div', { class: 'ouv-junto' },
      ouvintes.length ? h('div', { class: 'ouv-ouvintes', title: ouvintes.map(nomeDe).filter(Boolean).join(', ') },
        h('span', { class: 'ouv-avs' }, ouvintes.slice(0, 4).map((x) => (A.ui && A.ui.avatar ? A.ui.avatar(x, 18) : h('i')))),
        h('span', {}, ouvintes.length === 1 ? T('1 ouvindo junto', '1 listening along') : ouvintes.length + T(' ouvindo junto', ' listening along'))) :
        o.jn && lider ? h('div', { class: 'ouv-ouvintes' }, A.icone('fones', 13), h('span', {}, T('Ouvindo junto com ', 'Listening along with ') + nomeDe(lider))) :
        nele ? h('div', { class: 'ouv-ouvintes' }, A.icone('fones', 13), h('span', {}, T('Você está ouvindo junto', 'You are listening along'))) : h('span'),
      pode ? h('button', { type: 'button', class: 'ouv-junto-bt' + (nele ? ' nele' : ''), onclick: (e) => { e.stopPropagation(); if (nele) O.sairJunto(); else O.entrarJunto(cod); } },
        A.icone(nele ? 'sair' : 'fones', 14), nele ? T('Sair', 'Leave') : T('Ouvir junto', 'Listen along')) : null);
  }

  // atualiza tudo o que está na tela (chegou presença, mudou a música) e anda a barra uma vez por segundo enquanto houver cartão aberto
  let tick = 0, pedido = 0;
  O.pintar = () => {
    if (pedido) return;
    pedido = requestAnimationFrame(() => {
      pedido = 0;
      document.querySelectorAll('.ouv-linha[data-ouv-cod]').forEach(preencherLinha);
      const cs = document.querySelectorAll('.ouv-cartao[data-ouv-cartao]'); cs.forEach(preencherCartao);
      if (cs.length && !tick) tick = setInterval(() => { const l = document.querySelectorAll('.ouv-cartao[data-ouv-cartao]'); if (!l.length) { clearInterval(tick); tick = 0; return; } if (!document.hidden) l.forEach(preencherCartao); }, 1000);
    });
  };
  ['hub:ouvindo', 'hub:presenca', 'hub:offline', 'hub:amigos', 'talk:lista', 'perfil', 'idioma'].forEach((ev) => A.evt.on(ev, O.pintar));
})();
