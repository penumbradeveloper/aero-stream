// Aero Stream - (1.0.0) "Assistindo agora", como o "Assistindo" do Discord. A extensão do navegador (a mesma do "Ouvindo agora") lê a
// live da Twitch ou da Kick, o vídeo do YouTube ou um site que a pessoa adicionou, e manda ao app do PC (desktop/ouvindo.js). Daqui vai ao
// servidor só quando muda (outro vídeo, pausou, pulou um pedaço). Os amigos veem:
//  - nas listas (Aero Talk, membros do grupo, Conexões): o símbolo do site e o canal (no lugar da música; um jogo aberto vence);
//  - no perfil e no mini perfil: o cartão "Assistindo Twitch" com a miniatura, o título, o canal, a categoria e o tempo (ou a barra).
// É uma integração oficial (aba Integrações > Assistindo agora): lá ficam os sites ligados e os sites da pessoa (nome, domínio, ícone, o
// texto antes do nome e de onde tirar o título e o autor). Invisível: ninguém vê. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const S = (A.assistindo = {});
  const ponte = () => (window.aero && window.aero.ouvindo && window.aero.ouvindo.assistindo ? window.aero.ouvindo : null);
  const U = () => A.ui;
  const CONHECIDOS = ['twitch', 'kick', 'youtube'];
  const NOMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };
  // o símbolo de cada site, desenhado aqui (fixo no código, nunca vem de fora)
  const LOGO = {
    twitch: '<rect x="2" y="2" width="20" height="20" rx="5" fill="#9146ff"/><path d="M7 5.5 5.8 8.4v9.4h3.3v1.9h1.9l1.9-1.9h2.8l3.8-3.8V5.5zm11 7.8-2.2 2.2h-3.1l-1.9 1.9v-1.9H8.3V6.9H18z" fill="#fff"/><path d="M15.2 9v3.6M12.4 9v3.6" stroke="#fff" stroke-width="1.4"/>',
    kick: '<rect x="2" y="2" width="20" height="20" rx="5" fill="#53fc18"/><path d="M7 6h3.2v3.2h1.6V7.6h1.6V6h3.2v4.8h-1.6v1.6h-1.6v1.2h1.6v1.6h1.6V18h-3.2v-1.6h-1.6v-1.6h-1.6V18H7z" fill="#000"/>',
    youtube: '<rect x="1.5" y="5" width="21" height="14.5" rx="4.2" fill="#ff0033"/><path d="M10 9.2v6.1l5.3-3.05z" fill="#fff"/>',
  };
  const logo = (f, tam = 14) => {
    if (!LOGO[f]) return A.icone('tela', tam);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tam); s.setAttribute('height', tam); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ass-logo'); s.innerHTML = LOGO[f]; return s;
  };
  // o ícone de um site da pessoa: o emoji ou as letras dela na cor escolhida
  const icSite = (o, tam = 14) => h('span', { class: 'ass-ic', estilo: { '--c': o.cor || '#5865f2', '--t': tam + 'px' }, 'aria-hidden': 'true' }, (o.ic || (o.s || '?').slice(0, 1)).slice(0, 8));
  const simbolo = (o, tam) => (o.f === 'site' ? icSite(o, tam) : logo(o.f, tam));
  S.logo = logo;

  // ---------- a configuração (guardada no app; a extensão recebe só o que precisa para ler as páginas) ----------
  const cfg = () => {
    let c = A.cfg.v.assistir;
    if (!c || typeof c !== 'object') c = A.cfg.v.assistir = {};
    if (!c.conhecidos || typeof c.conhecidos !== 'object') c.conhecidos = {};
    if (!Array.isArray(c.meus)) c.meus = [];
    return c;
  };
  const salvar = () => { A.cfg.salvar(); A.evt.emit('assistir:config'); };
  S.disponivel = () => !!ponte();
  S.ligado = () => !!ponte() && !!(A.integ && A.integ.ligada && A.integ.ligada('assistindo'));
  S.nome = (o) => (o.f === 'site' ? o.s || 'Site' : NOMES[o.f] || o.f);
  S.rotulo = (o) => (o.vb ? o.vb : o.live ? T('Ao vivo na', 'Watching live on') : T('Assistindo', 'Watching'));
  S.pos = (o) => { const p = Math.max(0, (o.dt || 0) + (Date.now() - (o._rx || Date.now()))); return o.d ? Math.min(p, o.d) : p; };
  async function enviarSites() {
    const p = ponte(); if (!p || !p.sites) return;
    const c = cfg();
    try { await p.sites({ on: S.ligado(), conhecidos: c.conhecidos, meus: c.meus }); } catch (e) { /* app antigo */ }
  }

  // o que a pessoa está assistindo agora (você: o deste computador; os outros: o aparelho que avisou por último)
  let meu = null, enviado = null, pausadoDesde = 0, olhando = false;
  S.de = (cod) => {
    const eu = (A.api && A.api.eu) || {};
    if (!cod) return null;
    if (cod === eu.codigo && meu) return meu; // (1.0.0) sem nada aqui, a atividade de outro aparelho seu
    const ds = A.hub && A.hub.dispositivosDe ? A.hub.dispositivosDe(cod) : [];
    let m = null; for (const d of ds) if (d.ass && d.ass.t && (!m || (d.ass._rx || 0) > (m._rx || 0))) m = d.ass;
    if (m && m.d && (m.dt || 0) + (Date.now() - (m._rx || 0)) > m.d + 60000) return null; // o vídeo acabou faz tempo e não veio outro
    return m;
  };

  // ---------- mandar o meu ----------
  const chave = (x) => (x ? [x.f, x.t, x.a, x.c, x.s, x.id, x.live ? 1 : 0, x.lk].join('\u0001') : '');
  const mandar = (ass) => { if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'assistindo', ass }); };
  const limpar = () => { if (meu || enviado) { meu = null; enviado = null; mandar(null); S.pintar(); } };
  async function olhar() {
    const p = ponte();
    if (!p || olhando || !A.api || !A.api.eu) return;
    if (!S.ligado()) return limpar();
    olhando = true;
    let x = null; try { x = await p.assistindo(); } catch (e) { x = null; } finally { olhando = false; }
    if (!S.ligado()) return;
    const agora = Date.now();
    // pausou: some quase na hora (confere de novo 0,4 s depois, para um clique duplo no play não piscar na tela dos amigos)
    if (x && !x.tocando) { if (!pausadoDesde) pausadoDesde = agora; if (agora - pausadoDesde < 350 && enviado && chave(enviado) === chave(x)) { setTimeout(olhar, 400); return; } x = null; } else pausadoDesde = 0;
    if (!x) return limpar();
    const dados = { f: x.f, t: x.t, a: x.a || '', c: x.c || '', s: x.s || '', ic: x.ic || '', cor: x.cor || '', vb: x.vb || '', lk: x.lk || '', img: x.img || '', id: x.id || '', live: !!x.live, d: x.d || 0 };
    // ao vivo: o tempo conta desde que você abriu a live (não muda enquanto for a mesma)
    const ini = x.live ? (enviado && chave(enviado) === chave(dados) ? enviado.ini : agora) : x.em - x.p;
    meu = { ...dados, dt: agora - ini, _rx: agora };
    if (!enviado || chave(enviado) !== chave(dados) || enviado.img !== dados.img || (dados.d && Math.abs(enviado.ini - ini) > 3000)) {
      enviado = { ...dados, ini };
      mandar({ ...dados, p: agora - ini });
      S.pintar();
    }
  }
  if (ponte()) {
    setInterval(olhar, 1500);
    if (ponte().aoMudar) ponte().aoMudar(() => setTimeout(olhar, 120)); // a extensão avisou que mudou: olha na hora
    A.evt.on('hub:conectou', () => { enviado = null; setTimeout(olhar, 1000); }); // a conexão voltou: o servidor esqueceu, avisa de novo
    const mudouCfg = () => { enviarSites(); setTimeout(olhar, 80); };
    A.evt.on('assistir:config', mudouCfg); A.evt.on('integ:mudou', mudouCfg);
    setTimeout(enviarSites, 0);
  }

  // ---------- na tela ----------
  const hms = (ms) => { const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };
  const dica = (o) => S.rotulo(o) + ' ' + S.nome(o) + ': ' + o.t + (o.a ? ' — ' + o.a : '');
  const capa = (u) => (u && A.perfil && A.perfil.capa ? A.perfil.capa(u) : ''); // as imagens passam pelo servidor (ninguém fala com sites de fora)

  // a linha das listas: o símbolo e o canal (ou o título)
  S.linha = (cod) => { const el = h('div', { class: 'ass-linha', dados: { assCod: cod || '' }, hidden: true }); preencherLinha(el); return el; };
  function preencherLinha(el) { preencherLinha0(el); if (A.ui && A.ui.atvMais) A.ui.atvMais(el); } // (1.0.2) "+1" com várias atividades
  function preencherLinha0(el) {
    const o = S.de(el.dataset.assCod), k = o ? chave(o) : '';
    const pai = el.parentElement; if (pai) pai.classList.toggle('com-ass', !!o);
    if (el.dataset.k === k) return;
    el.dataset.k = k; el.hidden = !o; el.textContent = '';
    if (!o) { el.removeAttribute('title'); return; }
    el.className = 'ass-linha f-' + o.f; el.title = dica(o);
    el.append(simbolo(o, 12), h('span', {}, o.f === 'site' ? (o.vb || T('Assistindo', 'Watching')) + ' ' : '', h('b', {}, o.f === 'site' ? o.s : o.a || o.t)), o.live ? h('i', { class: 'ass-vivo-p' }, T('AO VIVO', 'LIVE')) : null);
  }

  // o título: com link (a live, o vídeo, o site) vira um botão que pergunta antes de abrir
  function titulo(o) {
    let u = null; try { u = o.lk ? new URL(o.lk) : null; } catch (e) { u = null; }
    if (!u || u.protocol !== 'https:') return h('b', { class: 'ass-tit', title: o.t }, o.t);
    const b = h('button', { type: 'button', class: 'sem-botao ass-tit', title: o.t + ' — ' + u.hostname }, o.t);
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await U().confirmar(T('Abrir ', 'Open ') + u.hostname + T(' no navegador?', ' in the browser?'), { sim: T('Abrir', 'Open') }))) return;
      U().abrirFora(u.href);
    });
    return b;
  }
  function miniatura(o) {
    const caixa = h('span', { class: 'ass-mini' + (o.f === 'site' ? ' site' : '') }, o.f === 'site' ? icSite(o, 28) : logo(o.f, 30));
    const src = o.img ? capa(o.img) : '';
    if (src) {
      const im = h('img', { alt: '', draggable: 'false', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', src });
      im.addEventListener('error', () => { im.remove(); caixa.classList.remove('com-img'); });
      im.addEventListener('load', () => caixa.classList.add('com-img'));
      caixa.append(im, h('span', { class: 'ass-selo-mini' }, logo(o.f, 16)));
    }
    return caixa;
  }
  // o corpo do cartão (também usado na prévia do editor de sites)
  function corpo(o) {
    return h('div', { class: 'ass-corpo' }, miniatura(o),
      h('div', { class: 'ass-info' },
        titulo(o),
        o.a ? h('div', { class: 'ass-l', title: o.a }, o.a) : null,
        o.c ? h('div', { class: 'ass-l ass-cat', title: o.c }, o.c) : null,
        o.live ? h('div', { class: 'ass-tempo' }, h('span', { class: 'ass-vivo' }, T('AO VIVO', 'LIVE')), h('span', { class: 'ass-ja' })) :
          o.d ? h('div', { class: 'ouv-barra ass-barra' }, h('span', { class: 'ouv-t ass-ja' }), h('span', { class: 'ouv-trilho' }, h('i')), h('span', { class: 'ouv-t' }, hms(o.d))) :
            h('div', { class: 'ass-tempo' }, h('span', { class: 'ass-ja' }))));
  }
  function cabecalho(o) { return h('div', { class: 'ass-cab' }, h('span', { class: 'ass-selo' }, simbolo(o, 15)), h('span', { class: 'ass-cab-t' }, S.rotulo(o) + ' ' + S.nome(o))); }
  function andar(el, o) {
    const p = S.pos(o), ja = el.querySelector('.ass-ja'), bar = el.querySelector('.ouv-trilho > i');
    const t = o.d ? hms(p) : hms(p) + (o.live ? '' : T(' decorrido', ' elapsed'));
    if (ja && ja.textContent !== t) ja.textContent = t;
    if (bar && o.d) bar.style.width = (Math.min(1, p / o.d) * 100).toFixed(2) + '%';
  }

  S.cartao = (cod, opc = {}) => { const el = h('div', { class: 'ass-cartao' + (opc.mini ? ' mini' : ''), dados: { assCartao: cod || '' }, hidden: true }); preencherCartao(el); setTimeout(S.pintar, 0); return el; };
  function preencherCartao(el) {
    const o = S.de(el.dataset.assCartao), k = o ? chave(o) + '\u0001' + (o.img || '') + '\u0001' + (o.cor || '') + (o.ic || '') + (o.vb || '') : '';
    if (el.dataset.k !== k) {
      el.dataset.k = k; el.hidden = !o; el.textContent = '';
      if (!o) return;
      el.className = 'ass-cartao f-' + o.f + (el.classList.contains('mini') ? ' mini' : '');
      if (o.f === 'site' && o.cor) el.style.setProperty('--ass', o.cor); else el.style.removeProperty('--ass');
      el.append(cabecalho(o), corpo(o));
    }
    if (o) andar(el, o);
  }

  let tick = 0, pedido = 0;
  S.pintar = () => {
    if (pedido) return;
    pedido = requestAnimationFrame(() => {
      pedido = 0;
      document.querySelectorAll('.ass-linha[data-ass-cod]').forEach(preencherLinha);
      const cs = document.querySelectorAll('.ass-cartao[data-ass-cartao]'); cs.forEach(preencherCartao);
      if (cs.length && !tick) tick = setInterval(() => { const l = document.querySelectorAll('.ass-cartao[data-ass-cartao]'); if (!l.length) { clearInterval(tick); tick = 0; return; } if (!document.hidden) l.forEach(preencherCartao); }, 1000);
    });
  };
  ['hub:assistindo', 'hub:presenca', 'hub:offline', 'hub:amigos', 'talk:lista', 'perfil', 'idioma'].forEach((ev) => A.evt.on(ev, S.pintar));

  // ---------- a configuração na aba Integrações (página do "Assistindo agora") ----------
  const DOM = /^(?=.{3,80}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  // aceita "x.com", "https://www.x.com/home" ou "twitter.com/algo": fica só o domínio, sem o www
  S.dominio = (v) => {
    let s = String(v || '').trim().toLowerCase(); if (!s) return '';
    if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
    try { const u = new URL(s); const d = u.hostname.replace(/^www\./, ''); return DOM.test(d) ? d : ''; } catch (e) { return ''; }
  };
  // modelos prontos (só preenchem o formulário; dá para mudar tudo)
  const MODELOS = () => [
    { nome: 'X', dom: 'x.com', ic: '𝕏', cor: '#000000', vb: T('Vendo', 'Browsing'), quando: 'aberta', tit: 'aba', aut: 'nada', tirar: ' / X' },
    { nome: 'Netflix', dom: 'netflix.com', ic: 'N', cor: '#e50914', vb: T('Assistindo', 'Watching'), quando: 'video', tit: 'nada', aut: 'nada' },
    { nome: 'Crunchyroll', dom: 'crunchyroll.com', ic: 'C', cor: '#f47521', vb: T('Assistindo', 'Watching'), quando: 'video', tit: 'aba', aut: 'nada', tirar: 'Crunchyroll|- Watch on|- Assista na|- Assistir na' },
    { nome: 'Prime Video', dom: 'primevideo.com', ic: 'P', cor: '#00a8e1', vb: T('Assistindo', 'Watching'), quando: 'video', tit: 'aba', aut: 'nada', tirar: 'Prime Video:|Prime Video' },
  ];
  // (1.0.6) o Assistindo agora só funciona com a extensão do navegador: ao instalar a integração (e, depois da atualização, para quem já
  // tinha a integração e nunca conectou a extensão) aparece esta tela. Quem já tem a extensão só clica: ela se conecta sozinha, sem código
  let telaExt = null;
  S.exigirExtensao = async () => {
    const p = ponte(); if (!p || !p.extensao || telaExt) return;
    let e0 = null; try { e0 = await p.extensao(); } catch (_) { /* ok */ }
    if ((e0 && e0.conectada) || telaExt) return;
    const U0 = U(), estado = h('div', { class: 'peq ass-ext-estado', role: 'status' });
    let t = 0;
    const ver = async () => {
      let e = null; try { e = await p.extensao(); } catch (_) { /* ok */ }
      if (!telaExt || !e || !e.conectada) return;
      clearInterval(t); estado.textContent = T('✓ Extensão conectada. Tudo pronto!', '✓ Extension connected. All set!'); estado.classList.add('ok');
      setTimeout(() => telaExt && telaExt.fechar(true), 1600);
    };
    const corpoT = h('div', { class: 'ass-ext-tela' },
      h('div', { class: 'ass-ext-logos', 'aria-hidden': 'true' }, ...CONHECIDOS.map((f) => logo(f, 34))),
      h('p', {}, T('O Assistindo agora mostra aos amigos o que você assiste no navegador, e quem lê isso é a extensão do Aero (a mesma do "Ouvindo agora"). Sem ela, nada aparece.', 'Watching now shows friends what you watch in the browser, and the Aero extension (the same as "Listening now") is what reads it. Without it, nothing shows up.')),
      h('p', { class: 'peq suave' }, T('Clique em "Instalar ou conectar": o seu navegador abre a página da extensão. Se ela já estiver instalada, ela se conecta sozinha, sem código.', 'Click "Install or connect": your browser opens the extension page. If it is already installed, it connects by itself, no code needed.')),
      estado);
    telaExt = U0.modal(T('Instale a extensão do navegador', 'Install the browser extension'), corpoT, { largura: 460, classe: 'ass-ext-modal', aoFechar: () => { clearInterval(t); telaExt = null; }, acoes: [
      { texto: T('Agora não', 'Not now'), tipo: 'sec', valor: false },
      { texto: T('Instalar ou conectar', 'Install or connect'), icone: 'download', onclick: async () => {
        try { await p.instalarExtensao(); } catch (er) { U0.toast(er.message, { tipo: 'erro' }); return; }
        if (!estado.classList.contains('ok')) estado.textContent = T('Esperando a extensão se conectar…', 'Waiting for the extension to connect…');
      } }] });
    t = setInterval(ver, 1500);
  };
  // depois da atualização: tem a integração ligada e a extensão nunca se conectou neste PC (uma vez por versão)
  if (ponte()) setTimeout(async () => {
    if (!S.ligado() || !A.api || !A.api.eu) return;
    let ja = ''; try { ja = localStorage.getItem('aero.assExt') || ''; } catch (_) { /* ok */ }
    if (ja === String(A.versao)) return;
    let e = null; try { e = await ponte().extensao(); } catch (_) { return; }
    if (!e || e.jaVista || e.visto) return;
    try { localStorage.setItem('aero.assExt', String(A.versao)); } catch (_) { /* ok */ }
    S.exigirExtensao();
  }, 90000);

  const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

  S.configuracao = () => {
    const el = h('section', { class: 'vidro pad ass-cfg' });
    const pintar = async () => {
      const c = cfg(), U0 = U();
      const linha = (sim, nome, sub, ctl, extra) => h('div', { class: 'ass-cfg-linha' }, sim, h('div', { class: 'cresce ass-cfg-txt' }, h('b', {}, nome), sub ? h('div', { class: 'peq suave' }, sub) : null), extra || null, ctl);
      const conhecidos = CONHECIDOS.map((f) => linha(logo(f, 26), NOMES[f], { twitch: T('Lives e vídeos', 'Lives and videos'), kick: T('Lives e vídeos', 'Lives and videos'), youtube: T('Vídeos e lives (o YouTube Music fica no "Ouvindo")', 'Videos and lives (YouTube Music stays in "Listening")') }[f],
        U0.chave(c.conhecidos[f] !== false, (v) => { cfg().conhecidos[f] = !!v; salvar(); })));
      const meus = c.meus.map((s) => linha(icSite(s, 22), s.nome, s.dom + ' · ' + (s.quando === 'aberta' ? T('com a aba na tela', 'while the tab is visible') : T('com vídeo tocando', 'while a video plays')),
        U0.chave(s.on !== false, (v) => { s.on = !!v; salvar(); }),
        h('div', { class: 'ass-cfg-bts' },
          U0.btn('', { icone: 'lapis', tipo: 'sec', redondo: true, peq: true, titulo: T('Editar', 'Edit'), onclick: () => editor(s) }),
          U0.btn('', { icone: 'lixo', tipo: 'sec', redondo: true, peq: true, titulo: T('Remover', 'Remove'), onclick: async () => { if (!(await U0.confirmar(T('Remover ', 'Remove ') + s.nome + '?', { sim: T('Remover', 'Remove'), perigo: true }))) return; cfg().meus = cfg().meus.filter((y) => y !== s); salvar(); pintar(); } }))));
      const estado = h('div', { class: 'peq suave ass-cfg-estado' });
      el.replaceChildren(
        h('h3', {}, A.icone('tela', 16), T('Sites', 'Sites')),
        h('p', { class: 'peq suave' }, T('Funciona pela extensão do Aero no navegador (a mesma do "Ouvindo agora"). Desligue os sites que você não quer mostrar.', 'Works through the Aero browser extension (the same one as "Listening now"). Turn off the sites you do not want to show.')),
        h('div', { class: 'linha ass-cfg-ext' }, estado, U0.btn(T('Instalar ou conectar', 'Install or connect'), { icone: 'download', tipo: 'sec', peq: true, onclick: async () => { try { await window.aero.ouvindo.instalarExtensao(); estado.textContent = T('Esperando a extensão se conectar…', 'Waiting for the extension to connect…'); } catch (e) { U0.toast(e.message, { tipo: 'erro' }); } } })),
        h('div', { class: 'ass-cfg-lista' }, ...conhecidos),
        h('h4', {}, T('Seus sites', 'Your sites')),
        meus.length ? h('div', { class: 'ass-cfg-lista' }, ...meus) : h('p', { class: 'peq suave' }, T('Nenhum ainda. Adicione o X, um site de filmes ou qualquer outro.', 'None yet. Add X, a movie site or anything else.')),
        h('div', { class: 'linha ass-cfg-add' }, U0.btn(T('Adicionar site', 'Add site'), { icone: 'mais', peq: true, onclick: () => editor(null) }),
          meus.length ? h('span', { class: 'peq suave' }, T('Cada site novo precisa ser permitido uma vez na janelinha da extensão (no botão dela no navegador).', 'Each new site must be allowed once in the extension popup (its button in the browser).')) : null));
      // (1.0.6) o estado da extensão se atualiza sozinho enquanto a tela está aberta
      const verExt = async () => {
        let e = null; try { e = window.aero && window.aero.ouvindo ? await window.aero.ouvindo.extensao() : null; } catch (_) { /* ok */ }
        estado.textContent = e && e.conectada ? T('✓ Extensão conectada neste computador.', '✓ Extension connected on this computer.') : e && e.pareando ? T('Esperando a extensão se conectar…', 'Waiting for the extension to connect…') : e && (e.visto || e.jaVista) ? T('A extensão já se conectou aqui (abra uma aba para ela voltar).', 'The extension has connected here before (open a tab for it to come back).') : T('A extensão ainda não se conectou neste computador.', 'The extension has not connected on this computer yet.');
        estado.classList.toggle('ok', !!(e && e.conectada));
      };
      await verExt();
      clearInterval(el._tExt); el._tExt = setInterval(() => { if (!el.isConnected) return clearInterval(el._tExt); verExt(); }, 2000);
    };
    // o editor de um site (novo ou existente), com a prévia do cartão
    function editor(atual) {
      const U0 = U(), s = { quando: 'video', tit: 'og', aut: 'nada', cor: '#5865f2', ic: '', vb: '', selT: '', selA: '', tirar: '', nome: '', dom: '', ...(atual || {}) };
      const campo = (k, ph, max, extra = {}) => { const i = h('input', { class: 'campo', value: s[k] || '', placeholder: ph, maxlength: String(max), spellcheck: 'false', ...extra }); i.addEventListener('input', () => { s[k] = i.value; prever(); }); i.addEventListener('keydown', (e) => e.stopPropagation()); return i; };
      const nome = campo('nome', 'X', 40), dom = campo('dom', 'x.com', 200), ic = campo('ic', '𝕏', 8, { class: 'campo ass-ed-ic' }), vb = campo('vb', T('Assistindo', 'Watching'), 20);
      const cor = h('input', { type: 'color', class: 'campo-cor', value: /^#[0-9a-f]{6}$/i.test(s.cor) ? s.cor : '#5865f2', title: T('Cor do ícone', 'Icon color') });
      cor.addEventListener('input', () => { s.cor = cor.value; prever(); });
      const selT = campo('selT', T('seletor CSS, ex.: h1', 'CSS selector, e.g. h1'), 200), selA = campo('selA', T('seletor CSS, ex.: .autor', 'CSS selector, e.g. .author'), 200), tirar = campo('tirar', ' / X', 120);
      const quando = U0.seg([['video', T('Com vídeo tocando', 'While a video plays')], ['aberta', T('Com a aba na tela', 'While the tab is visible')]], s.quando, (v) => { s.quando = v; prever(); });
      const tit = U0.seg([['og', T('Da página', 'From page')], ['aba', T('Nome da aba', 'Tab title')], ['sel', T('Seletor', 'Selector')], ['nada', T('Nenhum', 'None')]], s.tit, (v) => { s.tit = v; selT.hidden = v !== 'sel'; prever(); });
      const aut = U0.seg([['nada', T('Nenhum', 'None')], ['og', T('Da página', 'From page')], ['sel', T('Seletor', 'Selector')]], s.aut, (v) => { s.aut = v; selA.hidden = v !== 'sel'; prever(); });
      selT.hidden = s.tit !== 'sel'; selA.hidden = s.aut !== 'sel';
      const prev = h('div', { class: 'ass-cartao ass-prev f-site' });
      const erro = h('div', { class: 'peq ass-ed-erro', role: 'alert' });
      function prever() {
        const nm = String(s.nome || '').trim() || S.dominio(s.dom) || 'Site';
        const o = { f: 'site', s: nm, ic: String(s.ic || '').trim(), cor: s.cor, vb: String(s.vb || '').trim(), t: s.tit === 'nada' ? nm : T('Título da página', 'Page title'), a: s.aut === 'nada' ? '' : T('Autor', 'Author'), live: false, d: 0, dt: 83000, _rx: Date.now() };
        prev.style.setProperty('--ass', s.cor); prev.replaceChildren(cabecalho(o), corpo(o)); andar(prev, o);
        erro.textContent = '';
      }
      const rot = (t, ...c) => h('label', { class: 'ass-ed-campo' }, h('span', { class: 'peq' }, t), ...c);
      const modelos = atual ? null : h('div', { class: 'ass-ed-modelos' }, h('span', { class: 'peq suave' }, T('Modelos:', 'Templates:')), ...MODELOS().map((m) => h('button', { type: 'button', class: 'ig-chip', onclick: () => { editor(Object.assign({}, m, { _modelo: 1 })); mm.fechar(); } }, m.nome)));
      const corpoEd = h('div', { class: 'ass-ed' }, modelos,
        h('div', { class: 'ass-ed-grade' },
          rot(T('Nome', 'Name'), nome), rot(T('Domínio (ou cole o link)', 'Domain (or paste the link)'), dom),
          rot(T('Ícone (emoji ou letras) e cor', 'Icon (emoji or letters) and color'), h('div', { class: 'linha ass-ed-iccor' }, ic, cor)), rot(T('Texto antes do nome', 'Text before the name'), vb)),
        rot(T('Quando mostrar', 'When to show'), quando),
        rot(T('Título', 'Title'), tit, selT), rot(T('Autor', 'Author'), aut, selA),
        rot(T('Tirar do título (separe com |)', 'Remove from the title (separate with |)'), tirar),
        h('div', { class: 'peq suave' }, T('Prévia', 'Preview')), prev, erro);
      prever();
      const mm = U0.modal(atual && !atual._modelo ? T('Editar site', 'Edit site') : T('Adicionar site', 'Add site'), corpoEd, { largura: 520, classe: 'ass-ed-modal', acoes: [
        { texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false },
        { texto: T('Salvar', 'Save'), tipo: 'ok', onclick: () => {
          const d = S.dominio(s.dom);
          if (!d) { erro.textContent = T('Esse domínio não parece certo (ex.: x.com).', 'That domain does not look right (e.g. x.com).'); return; }
          if (CONHECIDOS.some((f) => d === f + '.tv' || d === f + '.com')) { erro.textContent = T('Esse site já vem no Aero: ligue ou desligue ele na lista acima.', 'That site already comes with Aero: turn it on or off in the list above.'); return; }
          const lista = cfg().meus, dono = atual && !atual._modelo ? atual : null;
          if (lista.some((y) => y !== dono && y.dom === d)) { erro.textContent = T('Você já adicionou esse site.', 'You already added that site.'); return; }
          if (!dono && lista.length >= 30) { erro.textContent = T('Dá para ter até 30 sites.', 'You can have up to 30 sites.'); return; }
          const novo = { id: (dono && dono.id) || novoId(), nome: String(s.nome || '').trim().slice(0, 40) || d, dom: d, on: dono ? dono.on !== false : true, quando: s.quando, tit: s.tit, selT: String(s.selT || '').trim().slice(0, 200), aut: s.aut, selA: String(s.selA || '').trim().slice(0, 200), tirar: String(s.tirar || '').slice(0, 120), ic: String(s.ic || '').trim().slice(0, 8), cor: /^#[0-9a-f]{6}$/i.test(s.cor) ? s.cor : '#5865f2', vb: String(s.vb || '').trim().slice(0, 20) };
          if (dono) Object.assign(dono, novo); else lista.push(novo);
          salvar(); mm.fechar(); pintar(); A.som && A.som.tocar && A.som.tocar('sucesso');
        } }] });
      if (!atual) setTimeout(() => nome.focus(), 50);
    }
    pintar();
    return el;
  };
})();
