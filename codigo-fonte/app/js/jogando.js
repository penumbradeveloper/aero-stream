// Aero Stream - (1.0.0) "Atividade de jogo", como a do Discord. O app do PC descobre o que a pessoa está jogando (desktop/jogos.js: os
// jogos que o Discord reconhece, emuladores, o que o próprio jogo manda pelo SDK do Aero ou pelo canal do Discord, e as atividades
// personalizadas) e manda ao servidor só quando muda. Os amigos veem:
//  - nas listas (Aero Talk, membros do grupo, Conexões): "Jogando X" embaixo do nome;
//  - no perfil e no mini perfil: o cartão com o ícone grande e o pequeno (o texto de cada um ao passar o mouse), o nome, os detalhes,
//    o estado, o grupo (1 de 4) e o tempo andando.
// Em Configurações > Privacidade: ligar/desligar e "Atividades de jogo..." (a ponte do Discord, o SDK e as atividades personalizadas).
// Invisível: ninguém vê. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const J = (A.jogando = {});
  const ponte = () => (window.aero && window.aero.jogo) || null;
  const VERBO = { 0: ['Jogando', 'Playing'], 2: ['Ouvindo', 'Listening to'], 3: ['Assistindo', 'Watching'], 5: ['Competindo em', 'Competing in'] };
  let meu = null, enviado = null, ligouPonte = null, olhando = false, deNovo = false, sumiuDesde = 0, timerSumiu = 0;
  const FOLGA_SUMIU = 1500; // fechou: some quase na hora (a folga só cobre o jogo reconectando ao trocar de mapa)

  const cfg = () => { const c = A.cfg.v.jogo; return c && typeof c === 'object' ? c : {}; };
  J.disponivel = () => !!ponte();
  J.ligado = () => !!ponte() && cfg().ativo !== false;
  J.verbo = (tp) => { const v = VERBO[tp] || VERBO[0]; return T(v[0], v[1]); };
  // o texto antes do nome: o que a pessoa escreveu (até 20 letras) ou "Jogando"
  J.rotulo = (j) => (j && typeof j.vb === 'string' && j.vb.trim() ? j.vb.trim().slice(0, 20) : J.verbo(j && j.tp));
  // as imagens passam pelo servidor: o aparelho de ninguém fala com sites de fora. "aero:jg/CÓDIGO/id" é a foto que a pessoa enviou ao Aero
  const REF_FOTO = /^aero:jg\/([A-Z0-9]{6})\/([0-9a-f]{10})$/;
  const capa = (u) => { if (!u) return ''; const m = REF_FOTO.exec(u); if (m) return A.api && A.api.servidor ? `${A.api.servidor}/api/jogo-img/${m[1]}/${m[2]}` : ''; return A.perfil && A.perfil.capa ? A.perfil.capa(u) : ''; };

  // o que a pessoa está jogando (você: o deste computador; os outros: o aparelho que avisou por último)
  J.de = (cod) => {
    const eu = (A.api && A.api.eu) || {};
    if (!cod) return null;
    if (cod === eu.codigo) return meu;
    const ds = A.hub && A.hub.dispositivosDe ? A.hub.dispositivosDe(cod) : [];
    let m = null; for (const d of ds) if (d.jog && d.jog.n && (!m || (d.jog._rx || 0) > (m._rx || 0))) m = d.jog;
    return m;
  };
  // quanto tempo já passou / quanto falta (pelo relógio deste aparelho, a partir de quando o aviso chegou)
  const passou = (j) => (j.dt == null ? null : Math.max(0, j.dt + (Date.now() - (j._rx || Date.now()))));
  const falta = (j) => (j.rest == null ? null : Math.max(0, j.rest - (Date.now() - (j._rx || Date.now()))));

  // ---------- mandar a minha atividade ----------
  const chave = (x) => (x ? [x.n, x.d, x.s, x.li, x.lt, x.si, x.st, x.tp, x.vb, x.lk, x.o, (x.p || []).join('/'), (x.b || []).map((b) => b.l + '>' + b.u).join(' '), x.pj ? 1 : 0].join('\u0001') : '');
  const mandar = (jog) => { if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'jogando', jog }); };
  const limpar = () => { if (meu || enviado) { meu = null; enviado = null; mandar(null); J.pintar(); } };
  async function olhar() {
    const p = ponte();
    if (!p || !A.api || !A.api.eu) return;
    if (olhando) { deNovo = true; return; } // chegou um aviso no meio: olha de novo logo depois
    if (!J.ligado()) { if (ligouPonte !== false) { ligouPonte = false; p.ligar({ ativo: false }).catch(() => {}); } limpar(); return; }
    const c = cfg(), k = 'on|' + (c.ponte !== false) + '|' + (c.sdk !== false);
    if (ligouPonte !== k) { ligouPonte = k; try { await p.ligar({ ativo: true, ponte: c.ponte !== false, sdk: c.sdk !== false }); } catch (e) { ligouPonte = null; return; } }
    olhando = true;
    let x = null; try { x = await p.agora(); } catch (e) { x = null; } finally { olhando = false; if (deNovo) { deNovo = false; setTimeout(olhar, 0); } }
    if (!J.ligado()) return;
    const agora = Date.now();
    // fechou o jogo: uma folga curtinha (o jogo reconectando ao trocar de mapa não pisca na tela dos amigos)
    if (!x) {
      if (!sumiuDesde) sumiuDesde = agora;
      if (agora - sumiuDesde < FOLGA_SUMIU && enviado) { clearTimeout(timerSumiu); timerSumiu = setTimeout(olhar, FOLGA_SUMIU - (agora - sumiuDesde) + 50); return; }
      limpar(); return;
    }
    sumiuDesde = 0; clearTimeout(timerSumiu);
    const dados = { n: x.n, d: x.d || '', s: x.s || '', li: x.li || '', lt: x.lt || '', si: x.si || '', st: x.st || '', tp: x.tp || 0, o: x.o || 'jogo' };
    if (x.p) dados.p = x.p;
    if (Array.isArray(x.b) && x.b.length) dados.b = x.b.slice(0, 2); // (1.0.2) os botões do jogo
    if (x.pj) dados.pj = 1; // (1.0.2) a partida aceita gente entrando
    if (x.vb) dados.vb = String(x.vb).slice(0, 20);
    if (x.lk) dados.lk = x.lk;
    if (x.app) dados.app = x.app;
    if (x.emu) dados.emu = 1;
    meu = { ...dados, dt: x.ini ? agora - x.ini : null, rest: x.fim ? x.fim - agora : null, _rx: agora };
    if (!enviado || chave(enviado) !== chave(dados) || Math.abs((enviado.ini || 0) - (x.ini || 0)) > 5000 || Math.abs((enviado.fim || 0) - (x.fim || 0)) > 5000) {
      enviado = { ...dados, ini: x.ini || 0, fim: x.fim || 0 };
      const msg = { ...dados }; if (x.ini) msg.dt = Math.max(0, agora - x.ini); if (x.fim && x.fim > agora) msg.rest = x.fim - agora;
      mandar(msg);
      J.pintar();
    }
  }
  if (ponte()) {
    setInterval(olhar, 2500); // de reserva: o normal é o app do PC avisar na hora em que muda
    if (ponte().aoMudar) ponte().aoMudar(() => olhar());
    A.evt.on('hub:conectou', () => { enviado = null; setTimeout(olhar, 900); }); // a conexão voltou: o servidor esqueceu, avisa de novo
    A.evt.on('jogo:config', () => { setTimeout(olhar, 50); });
  }

  // ---------- na tela ----------
  const hms = (ms) => { const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };
  const textoTempo = (j) => { const f = falta(j); if (f != null) return T('faltam ', '') + hms(f) + T('', ' left'); const p = passou(j); return p == null ? '' : hms(p) + T(' decorrido', ' elapsed'); };
  const dica = (j) => J.rotulo(j) + ' ' + j.n + (j.d ? ' — ' + j.d : '');

  // a linha das listas: 🎮 Jogando X (no lugar da música quando os dois estão ligados, como no Discord)
  J.linha = (cod) => { const el = h('div', { class: 'jog-linha', dados: { jogCod: cod || '' }, hidden: true }); preencherLinha(el); return el; };
  function preencherLinha(el) { preencherLinha0(el); if (A.ui && A.ui.atvMais) A.ui.atvMais(el); } // (1.0.2) "+1" com várias atividades
  function preencherLinha0(el) {
    const j = J.de(el.dataset.jogCod), k = j ? J.rotulo(j) + '|' + j.n : '';
    el.toggleAttribute('data-com-jogo', !!j); const pai = el.parentElement; if (pai) pai.classList.toggle('com-jogo', !!j);
    if (el.dataset.k === k) return;
    el.dataset.k = k; el.hidden = !j; el.textContent = '';
    if (!j) { el.removeAttribute('title'); return; }
    el.title = dica(j);
    el.append(A.icone('controle', 12), h('span', {}, J.rotulo(j) + ' ', h('b', {}, j.n)));
  }

  // uma imagem do cartão (grande ou pequena), com o texto ao passar o mouse
  const imagem = (url, texto, cls, reserva) => {
    const caixa = h('span', { class: cls, title: texto || null }, reserva ? A.icone('controle', cls === 'jog-ig' ? 30 : 12) : null);
    const src = capa(url);
    if (src) {
      const im = h('img', { alt: '', draggable: 'false', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', src });
      im.addEventListener('error', () => { im.remove(); caixa.classList.remove('com-img'); if (!reserva) caixa.remove(); });
      // carregou: tira o ícone de reserva (não aparece por trás de imagem com transparência). Imagem quadrada preenche o quadrado;
      // a que não é quadrada (capa da Steam, banner) aparece inteira, sem corte, com ela mesma desfocada atrás preenchendo as sobras
      im.addEventListener('load', () => {
        caixa.classList.add('com-img'); const r = im.naturalWidth / Math.max(1, im.naturalHeight);
        if (r < 0.85 || r > 1.18) { caixa.classList.add('nao-quadrada'); caixa.prepend(h('img', { class: 'jog-borrado', alt: '', 'aria-hidden': 'true', draggable: 'false', src: im.src })); }
      });
      caixa.append(im);
    }
    return caixa;
  };
  // o nome da atividade: com link (a live, por exemplo) vira um botão que pergunta antes de abrir o site
  const linkOk = (u) => { if (typeof u !== 'string' || u.length > 300) return null; try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.includes('.') && !x.username && !x.password ? x : null; } catch (e) { return null; } };
  function nomeDe(j) {
    const u = linkOk(j.lk);
    if (!u) return h('b', { class: 'jog-nome', title: j.n }, j.n);
    const b = h('button', { type: 'button', class: 'jog-nome jog-nome-link', title: j.n + ' — ' + u.hostname }, j.n);
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await U().confirmar(T('Abrir ', 'Open ') + u.hostname + T(' no navegador?', ' in the browser?'), { sim: T('Abrir', 'Open') }))) return;
      U().abrirFora(u.href);
    });
    return b;
  }
  // o corpo do cartão (também usado na prévia do editor)
  function corpo(j) {
    const li = j.li || (j.si ? j.si : ''), si = j.li ? j.si : '';
    const imgs = h('span', { class: 'jog-imgs' }, imagem(li, j.li ? j.lt : j.st, 'jog-ig', true), si ? imagem(si, j.st, 'jog-ip', false) : null);
    const grupo = j.p ? ' (' + j.p[0] + T(' de ', ' of ') + j.p[1] + ')' : '';
    return h('div', { class: 'jog-corpo' }, imgs,
      h('div', { class: 'jog-info' },
        nomeDe(j),
        j.d ? h('div', { class: 'jog-l', title: j.d }, j.d) : null,
        j.s || grupo ? h('div', { class: 'jog-l', title: (j.s || '') + grupo }, (j.s || '') + grupo) : null,
        h('div', { class: 'jog-l jog-tempo', hidden: j.dt == null && j.rest == null }, A.icone('controle', 11), h('span', { class: 'jog-t' }, textoTempo(j)))));
  }
  J.corpo = corpo;
  // (1.0.2) como no Discord: os botões que o jogo manda (abrem no navegador, perguntando antes) e "Pedir para entrar" quando a partida
  // aceita gente entrando (manda a pergunta na conversa com a pessoa)
  function botoes(j, cod) {
    const eu = A.api && A.api.eu && cod === A.api.eu.codigo, l = [];
    if (j.pj && cod && !eu) l.push(h('button', { type: 'button', class: 'jog-bt jog-bt-entrar', onclick: async (e) => {
      e.stopPropagation(); const b = e.currentTarget; if (b.disabled || !A.talk) return; b.disabled = true;
      try {
        const c = await A.talk.abrirDM(cod), grupo = j.p ? ' (' + (j.s ? j.s + ', ' : '') + j.p[0] + T(' de ', ' of ') + j.p[1] + ')' : j.s ? ' (' + j.s + ')' : '';
        await A.talk.enviar(c, { texto: T('🎮 Posso entrar na sua partida de ', '🎮 Can I join your ') + j.n + T('', ' game') + grupo + '?' });
        A.som.tocar('enviar'); A.talk.irPara(c.id);
      } catch (er) { U().toast(er.message, { tipo: 'erro' }); } finally { b.disabled = false; }
    } }, A.icone('convidar', 14), T('Pedir para entrar', 'Ask to join')));
    for (const x of j.b || []) { const u = linkOk(x.u); if (!u) continue; l.push(h('button', { type: 'button', class: 'jog-bt', title: u.hostname, onclick: async (e) => {
      e.stopPropagation(); if (await U().confirmar(T('Abrir ', 'Open ') + u.hostname + T(' no navegador?', ' in the browser?'), { sim: T('Abrir', 'Open') })) U().abrirFora(u.href);
    } }, x.l)); }
    return l.length ? h('div', { class: 'jog-bts' }, ...l) : null;
  }

  // o cartão do perfil: "Jogando", os ícones, o nome, os detalhes, o estado e o tempo
  J.cartao = (cod, opc = {}) => { const el = h('div', { class: 'jog-cartao' + (opc.mini ? ' mini' : ''), dados: { jogCartao: cod || '' }, hidden: true }); preencherCartao(el); setTimeout(J.pintar, 0); return el; };
  function preencherCartao(el) {
    const j = J.de(el.dataset.jogCartao), k = j ? chave(j) : '';
    if (el.dataset.k !== k) {
      el.dataset.k = k; el.hidden = !j; el.textContent = '';
      if (!j) return;
      el.append(h('div', { class: 'jog-cab' }, J.rotulo(j), h('span', { class: 'jog-selo', title: j.o === 'sdk' || j.o === 'discord' ? T('Informado pelo jogo', 'Reported by the game') : null }, A.icone('controle', 13))), corpo(j));
      const acoes = botoes(j, el.dataset.jogCartao); if (acoes) el.append(acoes);
    }
    if (j) { const t = el.querySelector('.jog-t'), tx = textoTempo(j); if (t && t.textContent !== tx) t.textContent = tx; }
  }

  // atualiza o que está na tela e anda o relógio uma vez por segundo enquanto houver cartão aberto
  let tick = 0, pedido = 0;
  J.pintar = () => {
    if (pedido) return;
    pedido = requestAnimationFrame(() => {
      pedido = 0;
      document.querySelectorAll('.jog-linha[data-jog-cod]').forEach(preencherLinha);
      const cs = document.querySelectorAll('.jog-cartao[data-jog-cartao]'); cs.forEach(preencherCartao);
      if (cs.length && !tick) tick = setInterval(() => { const l = document.querySelectorAll('.jog-cartao[data-jog-cartao]'); if (!l.length) { clearInterval(tick); tick = 0; return; } if (!document.hidden) l.forEach(preencherCartao); }, 1000);
    });
  };
  ['hub:jogando', 'hub:presenca', 'hub:offline', 'hub:amigos', 'talk:lista', 'perfil', 'idioma'].forEach((ev) => A.evt.on(ev, J.pintar));

  // ---------- Configurações: "Atividades de jogo..." ----------
  const U = () => A.ui;
  const salvarCfg = (x) => { A.cfg.v.jogo = { ...cfg(), ...x }; A.cfg.salvar(); A.evt.emit('jogo:config'); };
  J.opcaoPrivacidade = (opcao) => {
    if (!J.disponivel()) return null;
    return h('div', { class: 'col', estilo: { gap: '0' } },
      opcao(T('Mostrar o jogo que estou jogando', 'Show the game I am playing'), U().chave(cfg().ativo !== false, (v) => salvarCfg({ ativo: v })),
        T('Como no Discord: os amigos veem "Jogando X" nas listas e o cartão no seu perfil, com os detalhes que o jogo mandar.', 'Like Discord: friends see "Playing X" in lists and a card on your profile, with the details the game sends.')),
      h('div', { class: 'linha', estilo: { 'margin': '2px 0 8px' } }, U().btn(T('Atividades de jogo...', 'Game activities...'), { icone: 'controle', tipo: 'sec', peq: true, onclick: () => J.abrir() })));
  };

  J.abrir = async () => {
    const p = ponte(); if (!p) return;
    const est = h('div', { class: 'peq suave jog-est' });
    const lista = h('div', { class: 'col jog-pers-lista jog-rolar' });
    const prev = h('div', { class: 'jog-prev-agora' });
    // (1.0.2) uma buscazinha em cada lista; cada lista rola sozinha depois de um tamanho (quem tem muita coisa detectada ou configurada)
    const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtrar = (el, q) => {
      const k = semAcento(q).trim(), its = [...el.querySelectorAll(':scope > .jog-pers-it')];
      let vis = 0; for (const it of its) { const ok = !k || (it.dataset.busca || '').includes(k); it.hidden = !ok; if (ok) vis++; }
      let nada = el.querySelector(':scope > .jog-nada');
      if (k && its.length && !vis) { if (!nada) { nada = h('div', { class: 'peq suave jog-nada' }, T('Nada encontrado.', 'Nothing found.')); el.append(nada); } } else if (nada) nada.remove();
    };
    const busca = (el, ph) => { const i = h('input', { class: 'campo jog-busca', type: 'search', maxlength: 60, placeholder: ph, 'aria-label': ph, oninput: () => filtrar(el, i.value) }); i.addEventListener('keydown', (e) => e.stopPropagation()); return i; };
    const buscaPers = busca(lista, T('Procurar nas atividades...', 'Search activities...'));
    const pintarEst = async () => {
      let e = {}; try { e = await p.estado(); } catch (x) { /* ok */ }
      est.textContent = !J.ligado() ? T('Desligado em Privacidade.', 'Off in Privacy.') : [
        T(e.jogos + ' jogos reconhecidos', e.jogos + ' games recognized'),
        cfg().ponte === false ? T('canal do Discord desligado', 'Discord channel off') : e.ponte ? T('recebendo dos jogos pelo canal do Discord', 'receiving from games through the Discord channel') : T('o canal do Discord está ocupado (abra o Aero antes do Discord)', 'the Discord channel is busy (open Aero before Discord)'),
        cfg().sdk === false ? T('SDK desligado', 'SDK off') : e.sdk ? T('SDK do Aero pronto', 'Aero SDK ready') : T('SDK indisponível', 'SDK unavailable'),
      ].join(' · ');
      prev.textContent = '';
      if (meu) prev.append(h('div', { class: 'peq suave', estilo: { 'margin-bottom': '6px' } }, T('Agora os amigos veem:', 'Friends now see:')), h('div', { class: 'jog-cartao' }, h('div', { class: 'jog-cab' }, J.rotulo(meu)), corpo(meu)));
    };
    const pintarLista = async () => {
      let l = []; try { l = await p.pers(); } catch (x) { /* ok */ }
      lista.replaceChildren(...(l.length ? l.map((x) => h('div', { class: 'jog-pers-it vidro interno', 'data-busca': semAcento([x.nome, x.proc, x.det, x.vb].filter(Boolean).join(' ')) },
        imagem(x.li, '', 'jog-ip-lista', true),
        h('div', { class: 'cresce', estilo: { 'min-width': 0 } }, h('b', { class: 'jog-ell' }, x.nome), h('div', { class: 'peq suave jog-ell' }, x.modo === 'manual' ? T('Manual: fica até você desligar', 'Manual: stays until you turn it off') : x.proc ? T('Quando abrir ', 'When ') + x.proc + T('', ' is open') : T('Sempre', 'Always'))),
        x.modo === 'manual' ? U().btn('', { icone: 'girar', tipo: 'sec', redondo: true, peq: true, titulo: T('Zerar o contador', 'Reset the timer'), onclick: async () => { x.ini = Date.now(); try { await p.pers(l); } catch (e) { return; } A.som.tocar('sucesso'); setTimeout(async () => { await olhar(); pintarEst(); }, 50); } }) : null,
        U().chave(x.ativo !== false, async (v) => { x.ativo = v; await p.pers(l); setTimeout(olhar, 50); }),
        U().btn('', { icone: 'lapis', tipo: 'sec', redondo: true, peq: true, titulo: T('Editar', 'Edit'), onclick: () => editar(l, x, pintarLista) })))
        : [h('div', { class: 'peq suave' }, T('Nenhuma ainda. Crie uma para mostrar o que quiser quando um app ou jogo estiver aberto.', 'None yet. Create one to show whatever you want while an app or game is open.'))]));
      filtrar(lista, buscaPers.value);
    };
    // (1.0.2) os jogos e emuladores que o Aero está vendo agora: a pessoa escolhe quais os amigos veem (ex.: o Dolphin aberto o dia todo).
    // Os desligados continuam na lista, mesmo fechados, para dar para ligar de novo
    const detLista = h('div', { class: 'col jog-pers-lista jog-det-lista jog-rolar' });
    const buscaDet = busca(detLista, T('Procurar nos jogos detectados...', 'Search detected games...'));
    const temDet = !!(p.detectados && p.ignorados);
    const TIPO = { jogo: ['Jogo reconhecido', 'Recognized game'], emu: ['Emulador', 'Emulator'], discord: ['Mandado pelo jogo', 'Sent by the game'], sdk: ['Pelo SDK do Aero', 'Through the Aero SDK'] };
    let assDet = '';
    const pintarDet = async (forcar) => {
      if (!temDet || !detLista.isConnected && !forcar) return;
      let vivos = [], ign = [];
      try { [vivos, ign] = await Promise.all([p.detectados(), p.ignorados()]); } catch (e) { return; }
      vivos = Array.isArray(vivos) ? vivos : []; ign = Array.isArray(ign) ? ign : [];
      const mesmo = (a, b) => a.ks.some((k) => b.ks.includes(k));
      const itens = vivos.map((x) => ({ ...x, aberto: true }));
      for (const g of ign) if (!itens.some((x) => mesmo(x, g))) itens.push({ ...g, aberto: false });
      const escondido = (x) => ign.some((g) => mesmo(x, g));
      const ass = JSON.stringify(itens.map((x) => [x.ks, x.n, x.ic, x.aberto, escondido(x)]));
      if (ass === assDet && !forcar) return; assDet = ass;
      const mudar = async (x, mostrar) => {
        let l = []; try { l = await p.ignorados(); } catch (e) { return; }
        l = (Array.isArray(l) ? l : []).filter((g) => !mesmo(x, g));
        if (!mostrar) l.push({ ks: x.ks, n: x.n, ic: x.ic || '', tipo: x.tipo });
        try { await p.ignorados(l); } catch (e) { return; }
        assDet = ''; pintarDet(); setTimeout(async () => { await olhar(); pintarEst(); }, 50);
      };
      detLista.replaceChildren(...(itens.length ? itens.map((x) => h('div', { class: 'jog-pers-it vidro interno' + (escondido(x) ? ' jog-det-off' : ''), 'data-busca': semAcento(x.n) },
        imagem(x.ic, '', 'jog-ip-lista', true),
        h('div', { class: 'cresce', estilo: { 'min-width': 0 } }, h('b', { class: 'jog-ell' }, x.n),
          h('div', { class: 'peq suave jog-ell' }, T(...(TIPO[x.tipo] || TIPO.jogo)) + ' · ' + (x.aberto ? T('aberto agora', 'open now') : T('fechado', 'closed')) + (escondido(x) ? ' · ' + T('os amigos não veem', 'friends do not see it') : ''))),
        U().chave(!escondido(x), (v) => mudar(x, v))))
        : [h('div', { class: 'peq suave' }, T('Nenhum jogo aberto agora. Quando o Aero reconhecer um jogo ou emulador, ele aparece aqui e você escolhe se os amigos veem.', 'No game open right now. When Aero recognizes a game or emulator, it shows up here and you choose whether friends see it.'))]));
      filtrar(detLista, buscaDet.value);
    };
    const m = U().modal(T('Atividades de jogo', 'Game activities'), h('div', { class: 'col jog-cfg', estilo: { gap: '12px' } },
      est, prev,
      h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, T('Receber dos jogos pelo canal do Discord', 'Receive from games through the Discord channel')),
        h('div', { class: 'peq suave' }, T('Os jogos que mostram detalhes no Discord (modo, mapa, partida) mostram também no Aero. O Aero repassa tudo ao Discord, que continua funcionando igual. No Windows, o Aero precisa abrir antes do Discord.', 'Games that show details on Discord (mode, map, match) show them on Aero too. Aero forwards everything to Discord, which keeps working the same. On Windows, Aero must open before Discord.'))),
      U().chave(cfg().ponte !== false, (v) => { salvarCfg({ ponte: v }); setTimeout(pintarEst, 900); })),
      h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, T('SDK do Aero para jogos e apps', 'Aero SDK for games and apps')),
        h('div', { class: 'peq suave' }, T('Jogos e programas mandam a atividade direto para o Aero (o canal "aero-ipc-0", igual ao do Discord).', 'Games and programs send their activity straight to Aero (the "aero-ipc-0" channel, same as Discord\'s).'))),
      U().chave(cfg().sdk !== false, (v) => { salvarCfg({ sdk: v }); setTimeout(pintarEst, 900); })),
      temDet ? h('div', { class: 'col', estilo: { gap: '8px', 'margin-top': '4px' } },
        h('h3', { estilo: { margin: 0 } }, T('Jogos detectados', 'Detected games')),
        h('div', { class: 'peq suave' }, T('O que o Aero reconheceu aberto neste computador. Desligue o que você não quer que os amigos vejam: o Aero continua reconhecendo, só não mostra.', 'What Aero recognized open on this computer. Turn off what you do not want friends to see: Aero still recognizes it, it just does not show it.')),
        buscaDet, detLista) : null,
      h('div', { class: 'linha entre', estilo: { 'margin-top': '4px' } }, h('h3', { estilo: { margin: 0 } }, T('Atividades personalizadas', 'Custom activities')),
        U().btn(T('Nova', 'New'), { icone: 'mais', tipo: 'ok', peq: true, onclick: async () => { let l = []; try { l = await p.pers(); } catch (x) { /* ok */ } editar(l, null, pintarLista); } })),
      buscaPers, lista), { largura: 640, classe: 'jog-modal' });
    void m;
    pintarEst(); pintarLista(); pintarDet(true);
    // enquanto a janela está aberta, a lista acompanha o que abre e fecha
    if (temDet) { const tk = setInterval(() => { if (!detLista.isConnected) { clearInterval(tk); return; } pintarDet(); }, 3000); }
  };

  // ---------- o editor de uma atividade personalizada ----------
  async function editar(lista, original, depois) {
    const p = ponte(); if (!p) return;
    const x = original ? { modo: 'proc', vb: '', link: '', ...original } : { ativo: true, modo: 'proc', proc: '', nome: '', det: '', est: '', li: '', lt: '', si: '', st: '', vb: '', link: '', sobrepor: false };
    delete x.tp; delete x.tempo; delete x.decorrido;
    const campo = (k, rot, ph, max = 128) => { const i = h('input', { class: 'campo', maxlength: max, placeholder: ph || '', value: x[k] || '', oninput: () => { x[k] = i.value; pintarPrev(); } }); i.addEventListener('keydown', (e) => e.stopPropagation()); return h('label', { class: 'col jog-campo' }, rot ? h('span', { class: 'rot' }, rot) : null, i); };
    const prev = h('div', { class: 'jog-cartao jog-prev' });
    const okImg = (u) => !u || REF_FOTO.test(u) || /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net|images\.igdb\.com|i\.imgur\.com|cdn\.(akamai|cloudflare)\.steamstatic\.com|shared\.(akamai|fastly)\.steamstatic\.com|steamcdn-a\.akamaihd\.net|(tr|t\d)\.rbxcdn\.com|(upload|thumb)\.wikimedia\.org|thumbnails\.libretro\.com)\//.test(u);
    const avisoImg = h('div', { class: 'peq jog-aviso', hidden: true }, T('Essa imagem não vai aparecer: envie a foto pelo botão ao lado ou use um link do Discord, Steam, Roblox, IGDB, Imgur ou Wikipédia.', 'That image will not show: upload the picture with the button next to it or use a link from Discord, Steam, Roblox, IGDB, Imgur or Wikipedia.'));
    function pintarPrev() {
      const j = { n: (x.nome || '').trim() || T('Nome da atividade', 'Activity name'), d: x.det, s: x.est, li: okImg(x.li) ? x.li : '', lt: x.lt, si: okImg(x.si) ? x.si : '', st: x.st, vb: x.vb, lk: linkOk(x.link) ? x.link : '', dt: 0, _rx: desde() };
      prev.replaceChildren(h('div', { class: 'jog-cab' }, J.rotulo(j)), corpo(j));
      avisoImg.hidden = okImg(x.li) && okImg(x.si);
    }
    const aberta = Date.now();
    const tick = setInterval(() => { const t = prev.querySelector('.jog-t'); if (t) t.textContent = hms(Date.now() - desde()) + T(' decorrido', ' elapsed'); }, 1000); // o tempo conta desde que o app abriu (no manual, desde que ligou)
    const desde = () => (x.modo !== 'manual' ? aberta : zerou || (x.ini && original && original.modo === 'manual' ? x.ini : aberta));

    // o app ou processo: dos que estão abertos agora, ou procurando o jogo pelo nome ou pela sigla (a lista do Discord)
    const proc = h('input', { class: 'campo', maxlength: 80, placeholder: T('ex.: rdr2.exe (vazio = sempre)', 'e.g. rdr2.exe (empty = always)'), value: x.proc || '', list: 'jog-abertos', oninput: () => { x.proc = proc.value.trim(); } });
    proc.addEventListener('keydown', (e) => e.stopPropagation());
    const abertos = h('datalist', { id: 'jog-abertos' });
    p.abertos().then((l) => abertos.replaceChildren(...l.map((n) => h('option', { value: n })))).catch(() => {});
    const busca = h('input', { class: 'campo', type: 'search', maxlength: 60, placeholder: T('Procurar jogo: nome ou sigla (rdr2, doors, celeste...)', 'Find a game: name or acronym (rdr2, doors, celeste...)') });
    const res = h('div', { class: 'jog-res', role: 'listbox' });
    // escolheu um resultado: o nome, o app do Discord (se tiver) e o ícone; a foto que a pessoa enviou nunca é trocada
    const usar = (g, img) => {
      x.nome = g.n; x.app = g.id || '';
      const nova = img || g.ic || g.c || '';
      if (nova && !REF_FOTO.test(x.li || '')) x.li = nova;
      if (g.exe && !proc.value) { x.proc = g.exe; proc.value = g.exe; }
      for (const k of ['nome', 'det', 'est', 'lt', 'st']) { const el = campos[k].querySelector('input'); if (el) el.value = x[k] || ''; }
      mostrarImg('li'); res.replaceChildren(); busca.value = ''; pintarPrev();
      abrirGaleria(g.n, g.o);
    };
    const normN = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
    const itemRes = (g) => {
      const capaBtn = g.c && g.c !== g.ic ? h('button', { type: 'button', class: 'jog-res-capa', title: T('Usar a capa em vez do ícone', 'Use the cover instead of the icon'), onclick: () => usar(g, g.c) }, imagem(g.c, '', 'jog-ip-capa', true)) : null;
      const imC = capaBtn && capaBtn.querySelector('img'); if (imC) imC.addEventListener('error', () => capaBtn.remove()); // a loja não tem a capa em pé desse jogo
      return h('div', { class: 'jog-res-it', role: 'option' },
        h('button', { type: 'button', class: 'jog-res-pri', onclick: () => usar(g) }, imagem(g.ic || g.c, '', 'jog-ip-lista', true),
          h('span', { class: 'jog-res-tx' }, h('span', { class: 'jog-ell jog-res-n' }, g.n), g.sub ? h('small', { class: 'jog-ell suave' }, g.sub) : null)),
        capaBtn);
    };
    let tb = 0, nb = 0;
    const msgRes = (t) => h('div', { class: 'jog-res-msg peq suave' }, t);
    const procurarJogo = async () => {
      const q = busca.value.trim(), eu = ++nb;
      if (q.length < 2) { res.replaceChildren(); return; }
      let locais = [], consoles = [], remotos = null;
      const pintarRes = () => {
        if (eu !== nb) return;
        const vistos = new Map(), l = [];
        for (const g of [...locais, ...consoles]) { const k = g.chave || normN(g.n); if (!vistos.has(k)) { vistos.set(k, g); l.push(g); } }
        for (const g of remotos || []) { const k = normN(g.n), ja = vistos.get(k); if (ja) { if (!ja.ic) ja.ic = g.ic; if (!ja.c) ja.c = g.c; continue; } vistos.set(k, g); l.push(g); }
        const fim = remotos === null ? [msgRes(T('Procurando em mais lugares...', 'Searching more places...'))] : !l.length ? [msgRes(T('Nada encontrado. Escreva o nome do jogo e envie a sua própria foto abaixo.', 'Nothing found. Type the game name and upload your own picture below.'))] : [];
        res.replaceChildren(...l.slice(0, 14).map(itemRes), ...fim);
      };
      res.replaceChildren(msgRes(T('Procurando...', 'Searching...')));
      // os jogos de console (o índice das capas do libretro): cada versão aparece com o seu console ("Nintendo 64", "PlayStation"...)
      const con = (p.imagens ? p.imagens(q) : Promise.resolve([])).then((l) => {
        const ja = new Set();
        for (const i of l || []) { if (i.k !== 'capa' && i.k !== 'tela') continue; const ch = normN(i.n) + '|' + i.o; if (ja.has(ch) || ja.size >= 6) continue; ja.add(ch); consoles.push({ n: i.n, o: i.o, ic: i.u, chave: ch, sub: i.o }); }
      }).catch(() => {});
      const loc = p.procurar(q).then((l) => { locais = (l || []).slice(0, 6).map((g) => ({ n: g.n, id: g.id, ic: g.ic, exe: g.exe, sub: g.exe ? g.exe : T('Reconhecido pelo Aero', 'Recognized by Aero') })); }).catch(() => {}).then(pintarRes);
      const rem = fetch(`${A.api.servidor}/api/busca?tipo=jg&q=${encodeURIComponent(q)}`, { headers: { Authorization: 'Bearer ' + A.api.token } }).then((r) => r.json())
        .then((d) => { remotos = (d.itens || []).map((i) => ({ n: i.t, ic: i.i || '', c: i.c || '', sub: [i.a, i.f === 'wiki' ? 'Wikipédia' : ''].filter(Boolean).join(' · ') })); })
        .catch(() => { remotos = []; });
      await con; pintarRes(); await loc; await rem; pintarRes();
    };
    busca.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); const b = res.querySelector('.jog-res-pri'); if (b) b.click(); } });
    busca.addEventListener('input', () => { clearTimeout(tb); tb = setTimeout(procurarJogo, 220); });

    // a galeria de imagens do jogo (como no Playnite): capas, logos e telas de título de cada console (libretro), as da Wikipédia e do
    // Commons e as da Steam. Clicar põe no ícone grande ou no pequeno
    const galeria = h('div', { class: 'jog-gal', hidden: true });
    let alvoGal = 'li', filtroGal = 'todas', nGal = 0;
    const ROT_K = { capa: T('Capa', 'Cover'), logo: 'Logo', tela: T('Tela de título', 'Title screen'), icone: T('Ícone', 'Icon') };
    async function abrirGaleria(nome, consolePreferido) {
      nome = String(nome || x.nome || '').trim(); const eu = ++nGal;
      if (nome.length < 2) { galeria.hidden = true; return; }
      galeria.hidden = false;
      const grade = h('div', { class: 'jog-gal-grade' }, h('div', { class: 'peq suave jog-res-msg' }, T('Procurando imagens...', 'Searching for pictures...')));
      let imgs = [];
      const pintarGrade = () => {
        if (eu !== nGal) return;
        const l = imgs.filter((i) => filtroGal === 'todas' || i.k === filtroGal);
        grade.replaceChildren(...l.map((i) => {
          const b = h('button', { type: 'button', class: 'jog-gal-it', title: [i.n, i.o, ROT_K[i.k]].filter(Boolean).join(' · '), onclick: () => {
            x[alvoGal] = i.u; mostrarImg(alvoGal); pintarPrev(); grade.querySelectorAll('.jog-gal-it.sel').forEach((e) => e.classList.remove('sel')); b.classList.add('sel');
          } }, h('img', { alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', draggable: 'false', src: capa(i.u) }), h('small', { class: 'jog-ell' }, i.o + (i.k === 'logo' || i.k === 'tela' ? ' · ' + ROT_K[i.k] : '')));
          b.querySelector('img').addEventListener('error', () => b.remove());
          if (x.li === i.u || x.si === i.u) b.classList.add('sel');
          return b;
        }), ...(l.length ? [] : [h('div', { class: 'peq suave jog-res-msg' }, T('Nenhuma imagem encontrada para esse nome.', 'No pictures found for that name.'))]));
      };
      const filtro = U().seg([['todas', T('Todas', 'All')], ['capa', T('Capas', 'Covers')], ['logo', 'Logos'], ['tela', T('Telas', 'Screens')]], filtroGal, (v) => { filtroGal = v; pintarGrade(); });
      const alvo = U().seg([['li', T('Ícone grande', 'Large icon')], ['si', T('Ícone pequeno', 'Small icon')]], alvoGal, (v) => { alvoGal = v; });
      filtro.classList.add('quebra'); alvo.classList.add('quebra');
      galeria.replaceChildren(
        h('div', { class: 'linha entre jog-gal-cab' }, h('b', { class: 'jog-ell' }, T('Imagens de ', 'Pictures of ') + nome),
          U().btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Fechar as imagens', 'Close pictures'), onclick: () => { nGal++; galeria.hidden = true; } })),
        h('div', { class: 'linha jog-gal-opc' }, h('span', { class: 'peq suave' }, T('Usar em', 'Use as')), alvo), filtro, grade);
      const [con, rem] = await Promise.all([
        (p.imagens ? p.imagens(nome) : Promise.resolve([])).catch(() => []),
        fetch(`${A.api.servidor}/api/busca?tipo=jgi&q=${encodeURIComponent(nome)}`, { headers: { Authorization: 'Bearer ' + A.api.token } }).then((r) => r.json()).then((d) => d.itens || []).catch(() => []),
      ]);
      if (eu !== nGal) return;
      // primeiro as do console escolhido, depois as da loja e da Wikipédia, depois as dos outros consoles
      const daqui = (con || []).filter((i) => !consolePreferido || i.o === consolePreferido), outros = (con || []).filter((i) => consolePreferido && i.o !== consolePreferido);
      const vistos = new Set(); imgs = [];
      for (const i of [...daqui, ...(rem || []), ...outros]) if (i && i.u && okImg(i.u) && !vistos.has(i.u)) { vistos.add(i.u); imgs.push(i); }
      pintarGrade();
    }

    // o ícone grande e o pequeno: um link ou a foto que a pessoa envia (PNG, JPG, WebP ou GIF)
    const ESTADO_IMG = { li: h('div', { class: 'peq suave jog-img-est', hidden: true }), si: h('div', { class: 'peq suave jog-img-est', hidden: true }) };
    const reduzir = async (f) => { // imagem parada: no máximo 512 px (o ícone nunca aparece maior); GIF vai como está
      if (f.type === 'image/gif') return f;
      const bm = await createImageBitmap(f), lado = Math.min(1, 512 / Math.max(bm.width, bm.height));
      if (lado >= 1 && f.size < 600 * 1024) { bm.close && bm.close(); return f; }
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bm.width * lado)); cv.height = Math.max(1, Math.round(bm.height * lado));
      cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height); bm.close && bm.close();
      return await new Promise((ok) => cv.toBlob((b) => ok(b || f), 'image/webp', 0.9));
    };
    const enviarFoto = (k) => {
      const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
      arq.addEventListener('change', async () => {
        const f = arq.files && arq.files[0]; arq.value = ''; if (!f) return;
        const est = ESTADO_IMG[k]; est.hidden = false; est.classList.remove('erro');
        if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { est.textContent = T('Use PNG, JPG, WebP ou GIF.', 'Use PNG, JPG, WebP or GIF.'); est.classList.add('erro'); return; }
        if (f.size > 4 * 1048576) { est.textContent = T('Imagem grande demais (máximo 4 MB).', 'Image too large (max 4 MB).'); est.classList.add('erro'); return; }
        est.textContent = T('Enviando...', 'Uploading...');
        try {
          const r = await A.api.subirImagem('jogo', await reduzir(f));
          if (!REF_FOTO.test(r.ref || '')) throw new Error(T('Não consegui enviar a imagem.', 'Could not upload the image.'));
          x[k] = r.ref; est.hidden = true; mostrarImg(k); pintarPrev();
        } catch (e) { est.textContent = e.message || T('Não consegui enviar a imagem.', 'Could not upload the image.'); est.classList.add('erro'); }
      });
      return h('span', { class: 'jog-img-acoes' }, arq,
        U().btn('', { icone: 'imagem', tipo: 'sec', redondo: true, peq: true, titulo: T('Escolher entre as imagens do jogo (capas, logos, telas)', 'Pick from the game pictures (covers, logos, screens)'), onclick: () => { alvoGal = k; abrirGaleria(x.nome); } }),
        U().btn('', { icone: 'subir', tipo: 'sec', redondo: true, peq: true, titulo: T('Enviar uma foto do computador', 'Upload a picture from your computer'), onclick: () => arq.click() }),
        Object.assign(U().btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar a imagem', 'Remove the image'), onclick: () => { x[k] = ''; ESTADO_IMG[k].hidden = true; mostrarImg(k); pintarPrev(); } }), { className: 'btn sec peq redondo jog-img-tirar' }));
    };
    // a foto enviada não mostra o código no campo: o campo fica vazio dizendo "sua foto"
    const mostrarImg = (k) => {
      const c = campos[k], i = c && c.querySelector('input'); if (!i) return;
      const foto = REF_FOTO.test(x[k] || '');
      i.value = foto ? '' : x[k] || ''; i.placeholder = foto ? T('Sua foto (enviada)', 'Your picture (uploaded)') : 'https://...';
      c.classList.toggle('com-foto', foto); c.classList.toggle('com-valor', !!x[k]);
    };
    const campoImg = (k, rot) => {
      const i = h('input', { class: 'campo', maxlength: 390, placeholder: 'https://...', 'aria-label': rot, oninput: () => { x[k] = i.value.trim(); mostrarImg(k); pintarPrev(); } });
      i.addEventListener('keydown', (e) => e.stopPropagation());
      return h('div', { class: 'col jog-campo jog-campo-img' }, h('span', { class: 'rot' }, rot), h('div', { class: 'linha jog-img-linha' }, i, enviarFoto(k)), ESTADO_IMG[k]);
    };

    const campos = {
      nome: campo('nome', T('Nome', 'Name'), 'Red Dead Redemption 2'),
      det: campo('det', T('Detalhes', 'Details'), T('Modo história', 'Story mode')),
      est: campo('est', T('Estado (subtexto)', 'State (subtext)'), T('Em Saint Denis', 'In Saint Denis')),
      li: campoImg('li', T('Ícone grande (link ou foto)', 'Large icon (link or picture)')),
      lt: campo('lt', '', T('Texto ao passar o mouse (opcional)', 'Hover text (optional)'), 64),
      si: campoImg('si', T('Ícone pequeno (link ou foto)', 'Small icon (link or picture)')),
      st: campo('st', '', T('Texto ao passar o mouse (opcional)', 'Hover text (optional)'), 64),
    };
    // o Tipo: pelo app aberto (como sempre foi) ou manual, ligada até a pessoa desligar, com o contador que ela zera quando quiser (uma live, por exemplo)
    const linhaProc = h('label', { class: 'col jog-campo' }, h('span', { class: 'rot' }, T('App ou processo', 'App or process')), proc, abertos);
    let zerou = 0;
    const zerar = U().btn(T('Zerar contador', 'Reset timer'), { icone: 'girar', tipo: 'sec', peq: true, onclick: () => { zerou = Date.now(); zerar.disabled = true; pintarPrev(); zerar.lastChild.textContent = T('Zera ao salvar', 'Resets on save'); } });
    zerar.classList.add('jog-zerar');
    const dicaModo = h('div', { class: 'peq suave' });
    const pintarModo = () => {
      const manual = x.modo === 'manual';
      linhaProc.hidden = manual; zerar.hidden = !manual || !original;
      dicaModo.textContent = manual ? T('Fica ligada até você desligar na lista, com o tempo contando desde que você ligou.', 'Stays on until you turn it off in the list, with the time counting from when you turned it on.')
        : T('Aparece quando o app ou jogo abrir e some quando fechar.', 'Shows when the app or game opens and goes away when it closes.');
    };
    const tipo = U().seg([['proc', T('Por app aberto', 'By open app')], ['manual', T('Manual', 'Manual')]], x.modo === 'manual' ? 'manual' : 'proc', (v) => { x.modo = v; pintarModo(); pintarPrev(); });
    const campoVb = campo('vb', T('Texto antes do nome', 'Text before the name'), T('Jogando', 'Playing'), 20);
    const campoLink = campo('link', T('Link do nome (opcional)', 'Name link (optional)'), 'https://twitch.tv/...', 300);
    const avisoLink = h('div', { class: 'peq jog-aviso', hidden: true }, T('O link precisa começar com https://', 'The link must start with https://'));
    campoLink.querySelector('input').addEventListener('input', () => { avisoLink.hidden = !x.link || !!linkOk(x.link); });

    const salvar = async (fechar) => {
      if (!(x.nome || '').trim()) { U().toast(T('Dê um nome para a atividade.', 'Give the activity a name.'), { tipo: 'erro', ms: 2400 }); return; }
      if (x.link && !linkOk(x.link)) { U().toast(T('O link precisa começar com https://', 'The link must start with https://'), { tipo: 'erro', ms: 2400 }); return; }
      x.vb = (x.vb || '').trim().slice(0, 20); x.link = (x.link || '').trim();
      if (x.modo === 'manual') { if (zerou || !x.ini || !original || original.modo !== 'manual') x.ini = Date.now(); x.proc = ''; } else delete x.ini;
      const nova = original ? lista.map((y) => (y.id === original.id ? x : y)) : [...lista, x];
      try { await p.pers(nova); } catch (e) { U().toast(e.message, { tipo: 'erro' }); return; }
      A.som.tocar('sucesso'); fechar(); depois && depois(); setTimeout(olhar, 50);
    };
    const apagar = async (fechar) => {
      if (!(await U().confirmar(T('Apagar esta atividade?', 'Delete this activity?'), { perigo: true, sim: T('Apagar', 'Delete') }))) return;
      try { await p.pers(lista.filter((y) => y.id !== original.id)); } catch (e) { return; }
      fechar(); depois && depois(); setTimeout(olhar, 50);
    };
    mostrarImg('li'); mostrarImg('si'); pintarModo(); pintarPrev();
    U().modal(original ? T('Editar atividade', 'Edit activity') : T('Nova atividade', 'New activity'), h('div', { class: 'jog-editor' },
      h('div', { class: 'col jog-form' },
        h('div', { class: 'col jog-campo' }, h('span', { class: 'rot' }, T('Tipo', 'Type')), tipo, dicaModo, zerar),
        linhaProc,
        h('div', { class: 'col jog-campo' }, h('span', { class: 'rot' }, T('Procurar o jogo', 'Find the game')), busca, res),
        campoVb, campos.nome, campoLink, avisoLink, campos.det, campos.est,
        h('div', { class: 'jog-par jog-icones' }, h('div', { class: 'col jog-icone-bloco' }, campos.li, campos.lt), h('div', { class: 'col jog-icone-bloco' }, campos.si, campos.st)),
        galeria,
        h('div', { class: 'peq suave jog-dica-img' }, T('O pequeno aparece no canto do grande. Envie uma foto (PNG, JPG, WebP ou GIF, até 4 MB) ou cole um link.', 'The small one shows in the corner of the large one. Upload a picture (PNG, JPG, WebP or GIF, up to 4 MB) or paste a link.')), avisoImg,
        h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, T('Mostrar no lugar do que o jogo mandar', 'Show instead of what the game sends')), h('div', { class: 'peq suave' }, T('Desligado, os detalhes que o próprio jogo manda aparecem na frente.', 'Off, the details the game itself sends come first.'))), U().chave(!!x.sobrepor, (v) => { x.sobrepor = v; }))),
      h('div', { class: 'col jog-lado' }, h('div', { class: 'peq suave' }, T('Prévia', 'Preview')), prev)),
    { largura: 760, classe: 'jog-modal', aoFechar: () => clearInterval(tick), acoes: [
      ...(original ? [{ texto: T('Apagar', 'Delete'), tipo: 'perigo', icone: 'lixo', onclick: apagar }] : []),
      { texto: T('Cancelar', 'Cancel'), tipo: 'sec' },
      { texto: T('Salvar', 'Save'), tipo: 'ok', icone: 'ok', onclick: salvar },
    ] });
  }
})();
