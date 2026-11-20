// Aero Stream - componentes de interface compartilhados (janelas, avisos, avatar, controles, parallax, bolhas).
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h;
  const U = (A.ui = {});

  // (0.7.3) anti-spam em TODOS os botões: um segundo clique de verdade no MESMO botão em menos de 400 ms é ignorado (clicar várias vezes
  // seguidas abria duas janelas, mandava duas vezes, ligava e desligava). Cliques do próprio app (el.click()) passam; botões que precisam
  // de cliques seguidos (um emoji atrás do outro, teclas) ficam de fora com data-rapido
  const ultimoClique = new WeakMap();
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const b = e.target && e.target.closest && e.target.closest('button, [role="button"], .btn, .aba, .menu-it');
    if (!b || b.closest('[data-rapido], .cx-emoji, .cx-emoji-grade')) return;
    const agora = performance.now(), antes = ultimoClique.get(b) || 0;
    if (agora - antes < 400) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    ultimoClique.set(b, agora);
  }, true);

  // ---------- avatar: foto, ou a inicial do nome com uma cor própria ----------
  const matiz = (s) => { let x = 0; for (const c of String(s || '?')) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
  U.avatar = (p, tam = 44, estado) => {
    const el = h('div', { class: 'avatar', estilo: { '--t': tam + 'px', '--ah': matiz(p.codigo || p.nome) } });
    if (p.codigo) { el.dataset.cod = p.codigo; el.dataset.av = String(p.av || 0); if (estado) el.dataset.vivo = '1'; } // atualizado ao vivo (U.atualizarVivos)
    el.append(h('span', {}, (p.nome || '?').trim().charAt(0).toUpperCase()));
    const url = A.avatarUrl(p.codigo, p.av);
    if (url) {
      const img = h('img', { alt: '', src: url, loading: 'lazy', draggable: 'false' });
      img.addEventListener('error', () => img.remove()); // sem foto: fica a inicial
      el.append(img);
    }
    if (estado) { const pt = h('i', { class: 'pt ' + estado }); el.append(pt); if (p.codigo) U.pintarPt(pt, p.codigo, estado); }
    return el;
  };
  // (0.8.3) status personalizado (texto até 30 letras, cor da bolinha e ícone). Vale enquanto a pessoa aparece (offline/invisível: some)
  // (0.8.7) o cinza é só de offline/invisível: um status personalizado nessa cor usa a cor do estado de verdade (ausente fica laranja etc.)
  const COR_ESTADO = { online: '#3fae2a', ausente: '#d98a00', ocupado: '#e5473b' };
  const semCinza = (stc, cod) => (stc && /^#8a9ba8$/i.test(stc.c || '') ? { ...stc, c: COR_ESTADO[U.estadoDe(cod)] || COR_ESTADO.online } : stc);
  U.statusPers = (cod) => {
    const eu = (A.api && A.api.eu) || {};
    if (cod && cod === eu.codigo) return eu.status !== 'invisivel' && eu.stc && eu.stc.c ? semCinza(eu.stc, cod) : null;
    const ds = A.hub && A.hub.dispositivosDe ? A.hub.dispositivosDe(cod) : [];
    const d = ds.find((x) => x.stc && x.stc.c); return d ? semCinza(d.stc, cod) : null;
  };
  U.pintarPt = (pt, cod, st) => {
    const x = st === 'offline' || st === 'invisivel' ? null : U.statusPers(cod);
    const k = x ? x.i + x.c : '';
    if (pt.dataset.stc === k && pt.classList.contains(st)) return;
    pt.dataset.stc = k; pt.className = 'pt ' + st + (x ? ' pers i-' + (x.i === 'ocupado' ? 'codigo' : x.i) : '');
    // a cor vai também no avatar: a pílula de "digitando" (irmã da bolinha) usa a mesma cor
    for (const e of [pt, pt.parentElement]) if (e) { if (x) e.style.setProperty('--stc', x.c); else e.style.removeProperty('--stc'); }
  };
  // (0.8.6) passar o mouse na bolinha de status de alguém (ou na sua) mostra um balãozinho com o status: o personalizado (ícone, cor e
  // texto) ou o normal (Online, Ausente...)
  (() => {
    let dica = null, alvo = null, timer = 0;
    const ESTADOS = ['online', 'ausente', 'ocupado', 'offline', 'invisivel'];
    const esconder = () => { clearTimeout(timer); alvo = null; if (dica) dica.classList.remove('on'); };
    const mostrar = (pt) => {
      const av = pt.parentElement, cod = av && av.dataset.cod; if (!pt.isConnected) return;
      const st = ESTADOS.find((x) => pt.classList.contains(x)) || 'online';
      const x = st === 'offline' || st === 'invisivel' ? null : U.statusPers(cod);
      const texto = x && x.t && x.t.trim() ? x.t.trim() : U.textoEstado(st);
      if (!dica) { dica = h('div', { class: 'st-dica', role: 'tooltip' }); document.body.append(dica); }
      dica.replaceChildren(h('span', { class: 'st-ic ' + (x ? 'i-' + (x.i === 'ocupado' ? 'codigo' : x.i) : 'st-' + st), estilo: x ? { '--stc': x.c } : {} }), h('span', {}, texto.charAt(0).toUpperCase() + texto.slice(1)));
      const r = pt.getBoundingClientRect(); dica.classList.add('on');
      const w = dica.offsetWidth, hh = dica.offsetHeight;
      let left = r.left + r.width / 2 - w / 2, top = r.top - hh - 8;
      left = Math.max(6, Math.min(innerWidth - w - 6, left)); if (top < 6) top = r.bottom + 8;
      dica.style.left = left + 'px'; dica.style.top = top + 'px';
    };
    document.addEventListener('pointerover', (e) => {
      const pt = e.target && e.target.closest ? e.target.closest('.avatar > .pt') : null;
      if (pt === alvo) return; esconder(); if (!pt || e.pointerType === 'touch') return;
      alvo = pt; timer = setTimeout(() => { if (alvo === pt) mostrar(pt); }, 180);
    }, true);
    document.addEventListener('pointerdown', esconder, true);
    window.addEventListener('scroll', esconder, true);
  })();
  // (0.8.4) a pílula de status (ex.: a do topo) com a cor e o ícone do status personalizado
  U.pintarPilula = (e, cod, st) => {
    const x = st === 'offline' || st === 'invisivel' ? null : U.statusPers(cod), tx = U.textoStatusDe(cod, st), k = st + '|' + (x ? x.i + x.c : '') + '|' + tx;
    if (e.dataset.k === k) return; e.dataset.k = k; e.dataset.st = st;
    e.className = 'pilula ' + st + (x ? ' pers' : '');
    // (0.8.7) a moldura da sua foto no topo também fica na cor do status personalizado
    for (const el of [e, e.closest('.eu')]) if (el) { if (x) el.style.setProperty('--stc', x.c); else el.style.removeProperty('--stc'); }
    e.replaceChildren(...(x ? [h('span', { class: 'st-ic i-' + (x.i === 'ocupado' ? 'codigo' : x.i) })] : []), tx);
  };
  // o texto do status: o personalizado (se tiver texto) ou o normal (online, ausente...)
  U.textoStatusDe = (cod, st) => { const x = st === 'offline' || st === 'invisivel' ? null : U.statusPers(cod); return x && x.t ? x.t : U.textoEstado(st); };

  // ---------- botões e controles ----------
  U.btn = (texto, { icone, tipo = '', peq, grande, redondo, onclick, titulo, mudo, dados } = {}) =>
    h('button', { class: ['btn', tipo, peq && 'peq', grande && 'grande', redondo && 'redondo'].filter(Boolean).join(' '), type: 'button', title: titulo || false, 'aria-label': titulo || texto || false, onclick, dados: { ...(mudo ? { mudo: '1' } : {}), ...(dados || {}) } },
      icone ? A.icone(icone, redondo ? 22 : 20) : null, texto ? h('span', {}, texto) : null);

  // (0.5.9-9) botão com a bolinha de contador à mostra: ganha a classe "com-selo" (antes era um ":has()" no CSS, que o navegador
  // reavaliava a cada mudança na página)
  U.marcarSelo = (s) => { if (s && s.parentElement) s.parentElement.classList.toggle('com-selo', !s.hidden); };
  U.chave = (valor, onchange) => {
    const i = h('input', { type: 'checkbox', role: 'switch' });
    i.checked = !!valor; i.addEventListener('change', () => { A.som.tocar('click'); onchange && onchange(i.checked); });
    return h('label', { class: 'chave' }, i, h('i'));
  };

  // qualquer controle deslizante do app: a parte preenchida acompanha a bolinha (antes, os criados fora do U.slider ficavam parados em 50%)
  U.pintarRange = (i) => { const mn = +i.min || 0, mx = +i.max || 100; i.style.setProperty('--pct', (mx > mn ? ((+i.value - mn) / (mx - mn)) * 100 : 0) + '%'); };
  document.addEventListener('input', (e) => { if (e.target && e.target.type === 'range') U.pintarRange(e.target); }, true);
  // (0.9.6) e já nasce no lugar certo: um controle criado com um valor (fora do U.slider) ficava com o preenchimento em 50% até alguém mexer
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.tagName === 'INPUT') { if (n.type === 'range') U.pintarRange(n); } else if (n.firstElementChild) for (const i of n.getElementsByTagName('input')) if (i.type === 'range') U.pintarRange(i); } }).observe(document.documentElement, { childList: true, subtree: true });
  U.slider = ({ min = 0, max = 100, passo = 1, valor = 0, oninput, onchange }) => {
    const i = h('input', { type: 'range', min, max, step: passo });
    i.value = valor;
    const pct = () => i.style.setProperty('--pct', ((i.value - min) / (max - min)) * 100 + '%');
    pct();
    i.addEventListener('input', () => { pct(); oninput && oninput(Number(i.value)); });
    i.addEventListener('change', () => onchange && onchange(Number(i.value)));
    i.atualizar = (v) => { i.value = v; pct(); };
    return i;
  };

  U.seg = (opcoes, valor, onchange) => {
    const caixa = h('div', { class: 'seg', role: 'group' });
    opcoes.forEach(([v, rotulo, icone]) => {
      const b = h('button', { type: 'button', class: v === valor ? 'sel' : '' }, icone ? A.icone(icone, 18) : null, rotulo);
      b.addEventListener('click', () => { caixa.querySelectorAll('button').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); onchange(v); });
      caixa.append(b);
    });
    return caixa;
  };

  // ---------- ao vivo (0.5.9-7): status, foto, nome e # mudam na tela sem redesenhar nada (sem animação) ----------
  // estado de uma conta: 'online', 'ausente', 'ocupado' (não perturbe) ou 'offline' (invisível também aparece offline para os outros)
  U.estadoDe = (cod) => {
    const H = A.hub, eu = A.api.eu || {};
    if (cod && cod === eu.codigo) return eu.status === 'invisivel' ? 'invisivel' : eu.status === 'ausente' || eu.status === 'ocupado' ? eu.status : H.estado === 'ausente' ? 'ausente' : 'online';
    const ds = H.dispositivosDe ? H.dispositivosDe(cod) : [];
    if (!ds.length) return 'offline';
    if (ds.some((d) => d.estado === 'online')) return 'online';
    if (ds.some((d) => d.estado === 'ocupado')) return 'ocupado';
    return 'ausente';
  };
  U.naoPerturbe = () => { const eu = A.api.eu || {}; return eu.status === 'ocupado' || !!(eu.stc && eu.stc.c && eu.stc.sn); }; // (0.8.6) ou o status personalizado com "sem notificações" // (0.5.9-7) não perturbe: nenhum aviso de mensagem, amigo online ou toque
  // (0.8.6) "visto por último há 5 min / há 2 h / ontem às 21:40 / em 3 de mar."
  U.vistoHa = (t) => {
    const T = A.T, s = Math.max(0, (Date.now() - t) / 1000), d = new Date(t), hm = d.toLocaleTimeString(T('pt-BR', 'en-US'), { hour: '2-digit', minute: '2-digit' });
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    if (s < 90) return T('Visto agora há pouco', 'Last seen just now');
    if (s < 3600) return T('Visto por último há ' + Math.round(s / 60) + ' min', 'Last seen ' + Math.round(s / 60) + ' min ago');
    if (new Date().toDateString() === d.toDateString()) return T('Visto por último hoje às ', 'Last seen today at ') + hm;
    if (ontem.toDateString() === d.toDateString()) return T('Visto por último ontem às ', 'Last seen yesterday at ') + hm;
    return T('Visto por último em ', 'Last seen on ') + d.toLocaleDateString(T('pt-BR', 'en-US'), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };
  U.ativoHa = (t) => { const T = A.T, m = Math.round((Date.now() - t) / 60000); return m < 60 ? T('Ativo há ' + m + ' min', 'Active ' + m + ' min ago') : T('Ativo há ' + Math.round(m / 60) + ' h', 'Active ' + Math.round(m / 60) + ' h ago'); };
  // o visto por último que o servidor mandou (só quando as duas pessoas deixam) e o que aparece no topo da conversa
  const vistos = new Map();
  U.lembrarVisto = (cod, t, vm) => { if (!cod) return; if (t) vistos.set(cod, { t, vm }); else vistos.delete(cod); };
  U.textoTopo = (cod, st) => {
    const v = vistos.get(cod), tx = U.textoStatusDe(cod, st);
    if (!v) return tx;
    if (st === 'offline' || st === 'invisivel') return U.vistoHa(v.t);
    return v.vm === 'atividade' && Date.now() - v.t > 600000 ? tx + ' · ' + U.ativoHa(v.t).toLowerCase() : tx;
  };
  // saiu agora (para nós): o visto passa a ser agora, sem perguntar ao servidor de novo
  A.evt.on('hub:offline', (e) => {
    const cod = e && e.codigo; if (!cod || U.estadoDe(cod) !== 'offline') return;
    if (vistos.has(cod)) { vistos.get(cod).t = Date.now(); U.atualizarVivos(); return; }
    // ainda não sabíamos (estava online quando a conversa abriu): pergunta de novo só se o topo dessa conversa está na tela
    if (A.perfil && document.querySelector('[data-topo][data-estado-cod="' + cod + '"]')) setTimeout(() => { A.perfil.esquecer(cod); A.perfil.buscar(cod).then((p) => { if (p && p.visto) { U.lembrarVisto(cod, p.visto, p.vm); U.atualizarVivos(); } }).catch(() => {}); }, 600);
  });
  // (0.8.6) "quando eu mexo no app": avisa o servidor no máximo 1 vez por minuto (ele só guarda se você escolheu esse modo e não está invisível)
  { let ult = 0; const mexeu = () => { const agora = Date.now(); if (agora - ult < 60000 || document.hidden) return; const eu = (A.api && A.api.eu) || {}; if (eu.status === 'invisivel' || (eu.priv && (eu.priv.visto === false || eu.priv.vistoModo !== 'atividade'))) return; ult = agora; if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'ativo' }); };
    for (const ev of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, mexeu, { capture: true, passive: true }); }
  U.textoEstado = (st) => ({ online: A.T('online', 'online'), ausente: A.T('ausente', 'away'), ocupado: A.T('não perturbe', 'do not disturb'), offline: A.T('offline', 'offline'), invisivel: A.T('invisível', 'invisible') }[st] || st);
  let vivoPedido = 0;
  U.atualizarVivos = () => {
    if (vivoPedido) return;
    vivoPedido = requestAnimationFrame(() => {
      vivoPedido = 0;
      const H = A.hub, eu = A.api.eu || {};
      const pessoa = (cod) => (cod === eu.codigo ? eu : (H.amigos || []).find((a) => a.codigo === cod) || (A.talk && A.talk.pessoaDe ? A.talk.pessoaDe(cod) : null));
      document.querySelectorAll('.avatar[data-cod]').forEach((el) => {
        const cod = el.dataset.cod, p = pessoa(cod);
        if (p && p.nome && p.nome !== '?' && String(p.av || 0) !== el.dataset.av) {
          el.dataset.av = String(p.av || 0);
          const url = A.avatarUrl(cod, p.av); let img = el.querySelector('img');
          if (url) { if (!img) { img = h('img', { alt: '', draggable: 'false' }); img.addEventListener('error', () => img.remove()); el.append(img); } img.src = url; } else if (img) img.remove();
          const sp = el.querySelector('span'); if (sp) sp.textContent = (p.nome || '?').trim().charAt(0).toUpperCase();
        }
        if (el.dataset.vivo) { const pt = el.querySelector('.pt'), st = U.estadoDe(cod); if (pt) U.pintarPt(pt, cod, st); }
      });
      document.querySelectorAll('[data-nome-cod]').forEach((e) => { const n = A.talk && A.talk.nomeDe ? A.talk.nomeDe(e.dataset.nomeCod) : ''; if (n && n !== '?' && e.textContent !== n) e.textContent = n; const p = pessoa(e.dataset.nomeCod); if (p) { const k = JSON.stringify(p.nm || null); if (e.dataset.nmK !== k) { e.dataset.nmK = k; U.aplicarNome(e, p.nm); } } }); // (0.8.0) o estilo do nome também
      document.querySelectorAll('[data-tag-cod]').forEach((e) => { const p = pessoa(e.dataset.tagCod); if (p && p.tag && e.textContent !== '#' + p.tag) e.textContent = '#' + p.tag; });
      document.querySelectorAll('.pilula[data-estado-cod]').forEach((e) => U.pintarPilula(e, e.dataset.estadoCod, U.estadoDe(e.dataset.estadoCod)));
      document.querySelectorAll('[data-estado-cod]:not(.pilula)').forEach((e) => { const st = U.estadoDe(e.dataset.estadoCod), tx = e.dataset.topo ? U.textoTopo(e.dataset.estadoCod, st) : U.textoStatusDe(e.dataset.estadoCod, st); if (e.dataset.st !== st || e.textContent !== tx) { e.dataset.st = st; e.textContent = tx; if (e.classList.contains('pilula')) e.className = 'pilula ' + st; } });
    });
  };
  ['hub:presenca', 'hub:offline', 'hub:amigos', 'hub:estado', 'perfil', 'talk:lista'].forEach((ev) => A.evt.on(ev, U.atualizarVivos));

  // ---------- película de bolha (0.5.9-7): embeds do chat e mini perfil ----------
  // Ondas correm pela borda no sentido horário (de cima à esquerda para a direita, desce, volta por baixo e sobe pela esquerda). A borda
  // só ESTUFA para fora e volta: nunca entra além do tamanho normal (o mínimo). Várias ondas fracas ao mesmo tempo, suaves mas visíveis.
  // Desenhada num SVG atrás do conteúdo; só anima o que está na tela (e nada com animações desligadas / versão otimizada).
  const peliculas = new Set(); let peliculaRaf = 0, peliculaN = 0;
  const NS = 'http://www.w3.org/2000/svg', FOLGA = 11, RAIO = 26, AMP = 3.6; // (0.7.0) a bolha fica um pouco mais folgada em volta da mídia
  const ONDAS = [{ v: 0.055, w: 0.16, a: 1, f: 0 }, { v: 0.04, w: 0.22, a: 0.75, f: 0.37 }, { v: 0.07, w: 0.12, a: 0.55, f: 0.71 }];
  const pulso = (x, w) => { x = x - Math.floor(x); return x < w ? Math.pow(Math.sin((Math.PI * x) / w), 2) : 0; };
  // ponto da borda (retângulo arredondado) na fração u do perímetro, a partir do canto de cima à esquerda, no sentido horário + a normal
  function bordaEm(W, Hh, r, u) {
    const ret = [W - 2 * r, Hh - 2 * r], arco = (Math.PI * r) / 2, per = 2 * ret[0] + 2 * ret[1] + 4 * arco;
    let d = (u - Math.floor(u)) * per;
    const seg = [[ret[0], (t) => [r + t, 0, 0, -1]], [arco, (t) => { const a = -Math.PI / 2 + t / r; return [W - r + r * Math.cos(a), r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
      [ret[1], (t) => [W, r + t, 1, 0]], [arco, (t) => { const a = t / r; return [W - r + r * Math.cos(a), Hh - r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
      [ret[0], (t) => [W - r - t, Hh, 0, 1]], [arco, (t) => { const a = Math.PI / 2 + t / r; return [r + r * Math.cos(a), Hh - r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
      [ret[1], (t) => [0, Hh - r - t, -1, 0]], [arco, (t) => { const a = Math.PI + t / r; return [r + r * Math.cos(a), r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }]];
    for (const [len, f] of seg) { if (d <= len) return f(d); d -= len; }
    return [r, 0, 0, -1];
  }
  let ultimoQuadroPel = 0, ultimoTPel = 0;
  // (0.8.4) rolando (o chat, uma lista): a onda das películas espera a rolagem parar. Cada quadro de onda é um canvas novo para a placa
  // de vídeo; junto com a rolagem de um chat cheio de embeds, era isso que derrubava os quadros. O relógio da onda também para (sem pulo)
  let rolandoAte = 0, pelPausa = 0, pelPausaIni = 0;
  document.addEventListener('scroll', () => { rolandoAte = performance.now() + 200; }, { capture: true, passive: true });
  document.addEventListener('wheel', () => { rolandoAte = performance.now() + 200; }, { capture: true, passive: true });
  // (0.9.7) enquanto a página rola: as animações enfeite param e o mouse não acende hover (cada hover em cartão de vidro refazia o desfoque
  // no meio da rolagem). A classe entra uma vez no começo e sai 160 ms depois do último passo, sem nada por quadro
  // (1.0.2) só a rolagem feita pela pessoa (roda, toque, teclado, barra de rolagem) liga isso. A rolagem automática (o chat descendo até
  // o fim ao abrir uma conversa, as fotos carregando, as mensagens antigas chegando) também ligava, e os cliques ficavam mortos por segundos
  // ao trocar de DM. E mexer o mouse desliga na hora: o próximo clique sempre pega
  { const raiz = document.documentElement; let fimRol = 0, maoAte = 0;
    const mao = () => { maoAte = performance.now() + 700; };
    const parar = () => { if (!fimRol) return; clearTimeout(fimRol); fimRol = 0; raiz.classList.remove('rolando'); };
    const rolou = (e) => {
      const alvo = e.target;
      if (performance.now() > maoAte || alvo === document || !(alvo instanceof Element) || alvo.closest('.cham-janela, .tela-jogo, [data-lock="1"]')) return;
      if (!fimRol) raiz.classList.add('rolando'); else clearTimeout(fimRol);
      fimRol = setTimeout(() => { fimRol = 0; raiz.classList.remove('rolando'); }, 160);
    };
    for (const t of ['wheel', 'touchmove']) document.addEventListener(t, mao, { capture: true, passive: true });
    document.addEventListener('keydown', (e) => { if (/^(Page(Up|Down)|Home|End|Arrow(Up|Down)| )$/.test(e.key)) mao(); }, { capture: true, passive: true });
    document.addEventListener('pointerdown', () => { parar(); mao(); }, { capture: true, passive: true }); // segurando a barra de rolagem
    document.addEventListener('pointerup', () => { maoAte = 0; }, { capture: true, passive: true });
    document.addEventListener('pointermove', (e) => { if (fimRol && (e.movementX || e.movementY) && !e.buttons) parar(); }, { capture: true, passive: true });
    document.addEventListener('scroll', rolou, { capture: true, passive: true }); }
  // (0.8.3) mais leve com o mesmo desenho: os pontos da borda (e a direção de cada um) são calculados uma vez por tamanho, não a cada quadro;
  // a borda usa menos pontos ligados por curvas suaves (antes eram 110 a 200 pontos retos por quadro, mesmo nas bolhas pequenas)
  function geoPelicula(p) {
    const W = p.W, Hh = p.H, r = Math.min(RAIO, W / 2, Hh / 2), per = 2 * (W + Hh);
    const N = Math.min(120, Math.max(40, Math.round(per / 14))), g = new Float32Array((N + 1) * 5);
    for (let i = 0; i <= N; i++) { const u = i / N, [x, y, nx, ny] = bordaEm(W, Hh, r, u); g.set([u, FOLGA + x, FOLGA + y, nx, ny], i * 5); }
    p.geo = g; p.geoK = W + 'x' + Hh; p.N = N;
  }
  const f1 = (v) => Math.round(v * 10) / 10;
  // (0.8.3) desenhada num <canvas> (antes, um caminho de SVG trocado a cada quadro: cada troca refazia o estilo e o layout da página,
  // várias vezes por quadro com várias bolhas na tela). As cores continuam vindo do CSS (tema, cor da bolha, cor da moldura), lidas uma vez
  // e de novo só quando o tema muda. Longe da tela, o canvas solta a memória
  let temaPel = 0;
  A.evt.on('tema', () => { temaPel++; for (const p of peliculas) p.sujo = true; });
  function coresPelicula(p) {
    const cs = (e, k) => getComputedStyle(e)[k];
    const st = p.cores.querySelectorAll('stop'), pa = p.cores.querySelector('path');
    p.cor = { a: cs(st[0], 'stopColor'), b: cs(st[1], 'stopColor'), c: cs(st[2], 'stopColor'), traco: cs(pa, 'stroke'), larg: parseFloat(cs(pa, 'strokeWidth')) || 1.5 };
    p.temaV = temaPel;
  }
  function desenharPelicula(p, t) {
    if (p.geoK !== p.W + 'x' + p.H) geoPelicula(p);
    if (p.temaV !== temaPel || !p.cor) coresPelicula(p);
    const g = p.geo, N = p.N, amp = AMP * (0.85 + 0.15 * Math.sin(t * 0.9)), xs = p.xs && p.xs.length === N + 1 ? p.xs : (p.xs = new Float32Array(N + 1)), ys = p.ys && p.ys.length === N + 1 ? p.ys : (p.ys = new Float32Array(N + 1));
    const o0 = ONDAS[0], o1 = ONDAS[1], o2 = ONDAS[2], s0 = o0.v * t + o0.f, s1 = o1.v * t + o1.f, s2 = o2.v * t + o2.f;
    for (let i = 0; i <= N; i++) {
      const k = i * 5, u = g[k];
      const d = amp * Math.min(1.6, o0.a * pulso(u - s0, o0.w) + o1.a * pulso(u - s1, o1.w) + o2.a * pulso(u - s2, o2.w)); // sempre >= 0: só para fora
      xs[i] = g[k + 1] + g[k + 3] * d; ys[i] = g[k + 2] + g[k + 4] * d;
    }
    const cv = p.tela, dpr = Math.min(2, window.devicePixelRatio || 1), CW = p.W + 2 * FOLGA, CH = p.H + 2 * FOLGA, pw = Math.round(CW * dpr), ph = Math.round(CH * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; p.ctx = null; }
    const ctx = p.ctx || (p.ctx = cv.getContext('2d'));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
    // curva suave: passa pelo meio de cada par de pontos, com o ponto como controle
    ctx.beginPath(); ctx.moveTo((xs[0] + xs[1]) / 2, (ys[0] + ys[1]) / 2);
    for (let i = 1; i < N; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.quadraticCurveTo(xs[0], ys[0], (xs[0] + xs[1]) / 2, (ys[0] + ys[1]) / 2); ctx.closePath();
    if (!p.grad || p.gradK !== CW + 'x' + CH + p.temaV) { const gr = ctx.createLinearGradient(FOLGA, FOLGA, FOLGA + p.W, FOLGA + p.H); gr.addColorStop(0, p.cor.a); gr.addColorStop(0.55, p.cor.b); gr.addColorStop(1, p.cor.c); p.grad = gr; p.gradK = CW + 'x' + CH + p.temaV; }
    ctx.fillStyle = p.grad; ctx.fill();
    if (p.cor.traco && p.cor.traco !== 'none') { ctx.strokeStyle = p.cor.traco; ctx.lineWidth = p.cor.larg; ctx.lineJoin = 'round'; ctx.stroke(); }
    p.sujo = false; p.vazia = false;
    if (!p.pronta) { p.pronta = true; p.el.classList.add('pel-ok'); } // até o 1º desenho, a bolha parada (sem animar) continua por baixo
  }
  const pertoDaTela = (el) => { const r = el.getBoundingClientRect(); return r.bottom > -400 && r.top < innerHeight + 400 && r.right > -400 && r.left < innerWidth + 400; };
  const soltarPelicula = (p) => { if (p.vazia || !p.tela) return; p.tela.width = 0; p.tela.height = 0; p.ctx = null; p.grad = null; p.vazia = true; p.sujo = true; if (p.pronta) { p.pronta = false; p.el.classList.remove('pel-ok'); } }; // (0.9.4) sem desenho: a bolha parada volta por baixo
  // (0.8.3) o próximo quadro é pedido só depois de ~30 ms (antes o laço acordava a cada atualização da tela, 120 vezes por segundo num monitor
  // de 120 Hz, para desenhar 30). Coberta por uma janela ou transmitindo: confere 2 vezes por segundo. Nenhuma na tela ou o app parado:
  // dorme de vez (a película que aparecer, mudar de tamanho ou o app voltar a ser usado acorda o laço)
  const seguirPel = (ms) => { if (!peliculas.size || document.hidden) return; peliculaRaf = setTimeout(() => { peliculaRaf = requestAnimationFrame(quadroPelicula); }, ms); };
  function quadroPelicula(agora) {
    peliculaRaf = 0;
    // (0.5.9-8) 30 quadros por segundo bastam para uma onda lenta (metade do trabalho); e com uma janela aberta por cima (perfil, configurações)
    // as películas de trás ficam paradas: estão cobertas e desfocadas
    // (0.6.8) compartilhando a tela: a película dos embeds para de se mexer
    // (0.7.1) parada, mas uma que mudou de tamanho (a imagem terminou de carregar, a janela mudou) é redesenhada uma vez: antes ficava com o
    // tamanho antigo, maior ou menor que a mídia
    const ocio = U.ocioso && U.ocioso(), parada = ocio || document.documentElement.dataset.modal || document.documentElement.dataset.transmitindo === '1';
    if (parada) {
      for (const p of peliculas) if (p.sujo && p.W && p.el.isConnected && p.visivel) desenharPelicula(p, ultimoTPel);
      if (!ocio) seguirPel(500); return;
    }
    if (agora < rolandoAte) {
      if (!pelPausaIni) pelPausaIni = agora;
      // (0.9.4) rolando: nenhuma é desenhada (antes, cada bolha que entrava na tela era desenhada no meio da rolagem, e num chat cheio de
      // bolhas Aquário era isso que mais pesava). Até a rolagem parar, aparece a bolha parada de sempre por baixo
      seguirPel(Math.max(16, rolandoAte - agora)); return;
    }
    if (pelPausaIni) { pelPausa += agora - pelPausaIni; pelPausaIni = 0; }
    ultimoQuadroPel = agora;
    const t = ultimoTPel = (agora - pelPausa) / 1000;
    let vistas = 0, fora = 0; const molduraOff = document.documentElement.dataset.moldura === '0';
    for (const p of peliculas) {
      // (0.8.2) fora da página: só desiste depois de 5 s. Uma caixa recém-criada (configurações, mosaico) entra na página um quadro depois;
      // antes a película era jogada fora nesse meio tempo e a bolha (Aquário) ficava sem fundo nenhum
      if (!p.el.isConnected) { if (!p.fora) p.fora = agora; else if (agora - p.fora > 5000) { peliculas.delete(p); pelIO.unobserve(p.el); pelRO.unobserve(p.el); pelDe.delete(p.el); } fora++; continue; }
      p.fora = 0;
      if (!p.W || !p.visivel) continue;
      if (molduraOff && p.el.classList.contains('cx-midia')) continue; // (0.8.3) moldura das embeds desligada: nem desenha
      desenharPelicula(p, t); if (p.visivel) vistas++;
    }
    // (1.0.2) com o Aero na frente e na versão completa, no ritmo do monitor; sem foco ou na otimizada, 30 por segundo
    const cheio = A.naFrente() && document.documentElement.dataset.visual !== 'lite';
    if (vistas) { if (cheio) peliculaRaf = requestAnimationFrame(quadroPelicula); else seguirPel(Math.max(0, 33 - (performance.now() - agora))); } else if (fora) seguirPel(1000);
  }
  const animar = () => { if (!peliculaRaf && peliculas.size && !document.hidden) peliculaRaf = requestAnimationFrame(quadroPelicula); };
  A.evt.on('ocioso', (o) => { if (!o) animar(); });
  document.addEventListener('visibilitychange', animar);
  // (0.8.4) um observador só para todas as películas (antes, dois por película: num chat com centenas de embeds, conferir a posição de
  // cada uma a cada quadro da rolagem pesava)
  const pelDe = new WeakMap();
  const pelRO = window.ResizeObserver ? new ResizeObserver((es) => {
    for (const e of es) { const p = pelDe.get(e.target); if (!p) continue; const el = p.el; p.W = el.offsetWidth; p.H = el.offsetHeight; p.sujo = true;
      // o primeiro desenho sai na hora (antes da tela ser pintada): a bolha não espera o próximo quadro do laço para aparecer
      if (p.W && p.H && performance.now() >= rolandoAte && pertoDaTela(el)) desenharPelicula(p, ultimoTPel || performance.now() / 1000); }
    animar(); }) : null;
  // perto da tela (até 400 px fora) conta como visível: ao rolar, a bolha já está desenhada quando entra. Mais longe, o canvas solta a memória
  const pelIO = window.IntersectionObserver ? new IntersectionObserver((es) => {
    for (const e of es) { const p = pelDe.get(e.target); if (!p) continue; p.visivel = e.isIntersecting; if (!p.visivel) soltarPelicula(p); else if (p.W && p.H && (p.vazia || p.sujo) && performance.now() >= rolandoAte) desenharPelicula(p, ultimoTPel || performance.now() / 1000); }
    animar(); }, { rootMargin: '400px' }) : null;
  U.pelicula = (el) => {
    const raiz = document.documentElement;
    if (raiz.dataset.anim === 'nenhuma' || raiz.dataset.visual === 'lite' || !window.ResizeObserver || !window.IntersectionObserver) return el;
    const id = 'pel' + (++peliculaN);
    // as cores vêm de um SVG escondido (o CSS das cores continua o mesmo); o desenho, de um canvas
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'pelicula pelicula-cores'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="pel-a"/><stop offset=".55" class="pel-b"/><stop offset="1" class="pel-c"/></linearGradient></defs><path fill="url(#${id})"/>`;
    const tela = document.createElement('canvas'); tela.className = 'pelicula pelicula-tela'; tela.setAttribute('aria-hidden', 'true'); tela.width = 0; tela.height = 0;
    const p = { el, cores: svg, tela, W: 0, H: 0, visivel: false };
    // (0.8.3) o primeiro desenho sai na hora (antes da tela ser pintada): a bolha não espera o próximo quadro do laço (que podia estar
    // dormindo até 1 s) para aparecer ao abrir a conversa
    pelDe.set(el, p); pelRO.observe(el); pelIO.observe(el);
    el.classList.add('com-pelicula'); el.prepend(tela, svg);
    peliculas.add(p); animar();
    return el;
  };

  // Copia texto com 3 caminhos: área de transferência do app do PC (Electron), a do navegador, e o jeito antigo (textarea + copy).
  // Se nenhum der certo, mostra o texto numa janela já selecionado para Ctrl+C.
  U.copiarTexto = async (texto) => {
    try { if (window.aero && window.aero.copiar && (await window.aero.copiar(String(texto)))) return true; } catch (e) { /* tenta o próximo */ }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(String(texto)); return true; } } catch (e) { /* tenta o próximo */ }
    try {
      const ta = h('textarea', { estilo: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' } }); ta.value = String(texto);
      document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
    } catch (e) { /* nada */ }
    return false;
  };
  U.copiar = async (texto, botao) => {
    const txt = botao ? botao.querySelector('span') : null;
    const original = txt ? txt.textContent : '';
    let t = texto;
    try { if (typeof t === 'function') t = await t(); } catch (e) { t = String(e && e.message || e); }
    const ok = await U.copiarTexto(t);
    if (ok) { A.som.tocar('sucesso'); if (txt) txt.textContent = A.T('Copiado!', 'Copied!'); U.toast(A.T('Copiado para a área de transferência.', 'Copied to the clipboard.'), { tipo: 'ok', ms: 2200 }); }
    else {
      const area = h('textarea', { class: 'campo selecionavel', readonly: true, estilo: { width: '100%', height: '50vh', 'font-family': 'monospace', 'font-size': '12px' } }); area.value = String(t);
      U.modal(A.T('Copie o texto (Ctrl+C)', 'Copy the text (Ctrl+C)'), area, { largura: '720px' }); setTimeout(() => { area.focus(); area.select(); }, 60);
    }
    if (txt) setTimeout(() => { txt.textContent = original; }, 1500);
    return ok;
  };

  // ---------- arquivos e imagens (0.6.0) ----------
  // (1.0.0) imagem de qualquer site fora da lista de confiança passa pelo proxy do servidor (como o Discord faz): quem mandou o link
  // nunca descobre o IP de quem abriu. Os do Aero, blob:, data: e os CDNs grandes já liberados continuam direto.
  const CONFIA = /(^|\.)(aerostream\.workers\.dev|klipy\.com|klipy\.co|discordapp\.com|discordapp\.net|dzcdn\.net|scdn\.co|spotifycdn\.com|ytimg\.com|ggpht\.com|googleusercontent\.com|media-amazon\.com|anilist\.co|ltrbxd\.com|steamstatic\.com|akamaihd\.net|wikimedia\.org|kitsu\.app|openlibrary\.org|books\.google\.com|twimg\.com)$/i;
  U.imgSegura = (url) => {
    const s = String(url || '');
    if (!s || /^(blob:|data:)/.test(s)) return s;
    let x; try { x = new URL(s, location.href); } catch (e) { return ''; }
    if (x.origin === location.origin || /^(localhost|127\.0\.0\.1)$/.test(x.hostname)) return s;
    if (x.protocol === 'https:' && CONFIA.test(x.hostname)) return s;
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
    const srv = A.api && A.api.servidor; if (srv && x.origin === new URL(srv).origin) return s;
    return srv ? `${srv}/api/img?u=${encodeURIComponent(x.href.replace(/^http:/, 'https:'))}` : '';
  };
  const blobDe = async (url) => (await fetch(/^(blob:|data:)/.test(url) ? url : (U.imgSegura(url) || url))).blob();
  U.baixar = async (url, nome) => {
    try {
      const href = /^blob:|^data:/.test(url) ? url : URL.createObjectURL(await blobDe(url));
      const a = h('a', { href, download: nome || 'arquivo' }); document.body.append(a); a.click(); a.remove();
      if (href !== url) setTimeout(() => URL.revokeObjectURL(href), 30000);
      A.som.tocar('sucesso');
    } catch (e) { U.toast(A.T('Não consegui baixar.', 'Could not download.'), { tipo: 'erro' }); }
  };
  // "Abrir no navegador": link da internet vai direto; anexo cifrado (blob:) é aberto pelo app do PC no programa padrão do sistema
  // (0.9.5) texto com links clicáveis (bio do perfil, comentários do Mural): https://..., www.... e domínio.algo/caminho
  const RE_LINK = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|lol|gg|io|me|tv|app|dev|xyz|br|co|link|bio|cc|to|fm|art|page|site|so|ly)(?:\/[^\s<>"']*)?/gi;
  U.textoComLinks = (texto) => {
    const out = []; let i = 0, m; texto = String(texto || ''); RE_LINK.lastIndex = 0;
    while ((m = RE_LINK.exec(texto))) {
      let u = m[0]; const sobra = (/[.,;:!?)\]}'"]+$/.exec(u) || [''])[0]; if (sobra) u = u.slice(0, -sobra.length);
      if (!u || (m.index > 0 && /[@\w]/.test(texto[m.index - 1]))) continue; // e-mail ou parte de outra palavra
      if (m.index > i) out.push(texto.slice(i, m.index));
      const href = /^https?:\/\//i.test(u) ? u : 'https://' + u;
      out.push(A.h('a', { href, class: 'link-txt', target: '_blank', rel: 'noopener noreferrer', title: href, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.closest('.pf-editor, .editando')) return; U.abrirFora(href); } }, u));
      i = m.index + u.length; RE_LINK.lastIndex = i;
    }
    if (i < texto.length) out.push(texto.slice(i));
    return out;
  };
  U.abrirFora = async (url, nome) => {
    if (/^https?:/.test(url)) { window.open(url, '_blank', 'noopener'); return; }
    if (window.aero && window.aero.abrirArquivo) {
      try { const b = await blobDe(url); if (await window.aero.abrirArquivo({ nome: nome || 'arquivo', dados: new Uint8Array(await b.arrayBuffer()) })) return; } catch (e) { /* tenta o navegador */ }
    }
    const w = window.open(url, '_blank'); if (!w) U.toast(A.T('O navegador bloqueou a janela nova.', 'The browser blocked the new window.'), { tipo: 'erro' });
  };
  // (0.6.9) copiar imagem: (1) pega os bytes (de outro site, no app do PC, quem baixa é o app: a página não pode ler por causa do CORS, era
  // o "não consegui copiar"); (2) vira PNG; (3) vai para a área de transferência do sistema (e só diz "copiada" se foi mesmo)
  U.copiarImagem = async (url, imgEl) => {
    // (0.7.1) cada passo tem plano B e o relatório de diagnóstico diz qual falhou (antes era só "não consegui copiar"):
    // bytes: a página -> o app do PC; PNG: createImageBitmap -> <img> desenhada no canvas; cópia: o app do PC -> o navegador
    let passo = 'baixar';
    try {
      let blob = null;
      try { blob = await blobDe(url); } catch (e) { blob = null; }
      if ((!blob || !blob.size) && window.aero && window.aero.baixarImagem && /^https:/i.test(url)) { const b = await window.aero.baixarImagem(url); if (b && b.length) blob = new Blob([b]); }
      // (0.8.3) GIF (ou WebP animado): vai o arquivo em si, animado; copiado como imagem iria só o primeiro quadro
      if (blob && blob.size && window.aero && window.aero.copiarArquivo) {
        const cab = new Uint8Array(await blob.slice(0, 64).arrayBuffer()), txt = String.fromCharCode(...cab);
        const ext = txt.startsWith('GIF8') ? 'gif' : txt.startsWith('RIFF') && txt.slice(8, 12) === 'WEBP' && /ANIM/.test(String.fromCharCode(...new Uint8Array(await blob.slice(0, 4096).arrayBuffer()))) ? 'webp' : '';
        if (ext) {
          passo = 'copiar gif';
          let foi = false; try { foi = !!(await window.aero.copiarArquivo(new Uint8Array(await blob.arrayBuffer()), ext)); } catch (e) { foi = false; }
          if (foi) { U.toast(A.T('GIF copiado.', 'GIF copied.'), { tipo: 'ok', ms: 1800 }); return; }
          A.log.aviso('copiar gif como arquivo falhou: foi como imagem');
        }
      }
      let fonte = null;
      // sem os bytes: usa a própria imagem que já está na tela (se ela carregou)
      if ((!blob || !blob.size) && imgEl && imgEl.complete && imgEl.naturalWidth) fonte = imgEl;
      if (!fonte && (!blob || !blob.size)) throw new Error('sem bytes');
      passo = 'converter';
      if (!fonte) { try { fonte = await createImageBitmap(blob); } catch (e) { fonte = null; } }
      if (!fonte) {
        const u = URL.createObjectURL(blob);
        try { const im = new Image(); im.src = u; await im.decode(); fonte = im; } finally { setTimeout(() => URL.revokeObjectURL(u), 5000); }
      }
      // (0.8.3) tamanho REAL da imagem: a <img> do chat tem .width = tamanho na tela (menor), e a cópia saía cortada
      const w = fonte.naturalWidth || fonte.width, hh = fonte.naturalHeight || fonte.height;
      if (!w || !hh) throw new Error('imagem vazia');
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; cv.getContext('2d').drawImage(fonte, 0, 0);
      const png = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
      if (!png) throw new Error('png');
      passo = 'copiar';
      let ok = false, erroApp = '';
      if (window.aero && window.aero.copiarImagem) { try { ok = !!(await window.aero.copiarImagem(new Uint8Array(await png.arrayBuffer()))); } catch (e) { erroApp = e.message; } }
      if (!ok) { try { window.focus(); } catch (e) { /* ok */ } await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); ok = true; }
      if (erroApp) A.log.aviso('copiar imagem: o app do PC falhou (' + erroApp + '), foi pelo navegador');
      U.toast(A.T('Imagem copiada.', 'Image copied.'), { tipo: 'ok', ms: 1800 });
    } catch (e) { A.log.aviso('copiar imagem falhou em "' + passo + '": ' + (e && e.message), String(url).slice(0, 60)); U.toast(A.T('Não consegui copiar a imagem.', 'Could not copy the image.'), { tipo: 'erro' }); }
  };
  // (0.9.5) "galeria": { itens: [{ url, video, nome, link }], i } — várias fotos/vídeos de uma mensagem, com setas (e ← →) e miniaturas embaixo
  U.verImagem = (url, { nome, favoritar, link, gif, galeria } = {}) => {
    const itens = galeria && Array.isArray(galeria.itens) ? galeria.itens.filter((x) => x && x.url) : null;
    let pos = itens ? Math.max(0, itens.findIndex((x) => x.url === url)) : 0, video = !!(itens && itens[pos].video);
    const linkDe = (u, l) => l || (/^https?:/.test(u) ? u : null); // (0.8.3) copiar o link (da imagem ou do GIF)
    link = linkDe(url, link);
    const txtLink = () => (gif ? A.T('Copiar link do GIF', 'Copy GIF link') : video ? A.T('Copiar link do vídeo', 'Copy video link') : A.T('Copiar link da imagem', 'Copy image link'));
    const img = h('img', { src: url, alt: '', class: 'vi-img', draggable: 'false' });
    let mid = img; // a imagem (com zoom) ou o vídeo (com controles) mostrado agora
    const palco = h('div', { class: 'vi-palco' }, img);
    let z = 1, x = 0, y = 0;
    const pintar = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${z})`; nivel.textContent = Math.round(z * 100) + '%'; palco.classList.toggle('ampliada', z > 1); };
    const zoom = (nz, cx, cy) => {
      if (video) return;
      nz = A.limitar(nz, 1, 8); const r = palco.getBoundingClientRect(); cx = cx == null ? r.width / 2 : cx - r.left; cy = cy == null ? r.height / 2 : cy - r.top;
      const ox = cx - r.width / 2, oy = cy - r.height / 2; x = ox - ((ox - x) * nz) / z; y = oy - ((oy - y) * nz) / z; z = nz; if (z === 1) { x = 0; y = 0; } pintar();
    };
    palco.addEventListener('wheel', (e) => { if (video) return; e.preventDefault(); zoom(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY); }, { passive: false });
    palco.addEventListener('dblclick', (e) => zoom(z > 1 ? 1 : 2.5, e.clientX, e.clientY));
    const toques = new Map(); let ini = null;
    palco.addEventListener('pointerdown', (e) => { if (video || e.target.closest('.vi-seta')) return; palco.setPointerCapture(e.pointerId); toques.set(e.pointerId, e); ini = { x, y, px: e.clientX, py: e.clientY, z, d: toques.size === 2 ? Math.hypot(...(() => { const [a1, b1] = [...toques.values()]; return [a1.clientX - b1.clientX, a1.clientY - b1.clientY]; })()) : 0 }; });
    palco.addEventListener('pointermove', (e) => {
      if (!toques.has(e.pointerId) || !ini) return; toques.set(e.pointerId, e);
      if (toques.size === 2 && ini.d) { const [a1, b1] = [...toques.values()]; zoom(ini.z * (Math.hypot(a1.clientX - b1.clientX, a1.clientY - b1.clientY) / ini.d)); return; }
      if (z > 1) { x = ini.x + e.clientX - ini.px; y = ini.y + e.clientY - ini.py; pintar(); }
    });
    const solta = (e) => {
      const i0 = ini; toques.delete(e.pointerId); ini = null;
      // (0.9.5) no celular, arrastar para o lado (sem zoom) troca de foto
      if (itens && i0 && z === 1 && toques.size === 0 && e.type === 'pointerup') { const dx = e.clientX - i0.px; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - i0.py) * 1.5) ir(dx < 0 ? 1 : -1); }
    };
    palco.addEventListener('pointerup', solta); palco.addEventListener('pointercancel', solta);
    const nivel = h('span', { class: 'vi-nivel' }, '100%');
    const bt = (ic, tit, f) => U.btn('', { icone: ic, tipo: 'sec', redondo: true, peq: true, titulo: tit, onclick: f });
    const btLink = link || itens ? bt('link', txtLink(), () => link && U.copiar(link)) : null;
    const zoomBts = [bt('zoomMenos', A.T('Diminuir', 'Zoom out'), () => zoom(z / 1.4)), nivel, bt('zoomMais', A.T('Aumentar', 'Zoom in'), () => zoom(z * 1.4)), h('i', { class: 'vi-sep' })];
    const btCopiar = bt('copiar', A.T('Copiar imagem', 'Copy image'), () => U.copiarImagem(url));
    const barra = h('div', { class: 'vi-barra' }, ...zoomBts, bt('download', A.T('Baixar', 'Download'), () => U.baixar(url, nome)), bt('externo', A.T('Abrir no navegador', 'Open in browser'), () => U.abrirFora(url, nome)),
      btCopiar, btLink, favoritar ? bt('estrela', A.T('Favoritar GIF', 'Favorite GIF'), favoritar) : null);
    palco.addEventListener('contextmenu', (e) => U.menuContexto(e, [{ texto: A.T('Baixar', 'Download'), icone: 'download', onclick: () => U.baixar(url, nome) }, { texto: A.T('Abrir no navegador', 'Open in browser'), icone: 'externo', onclick: () => U.abrirFora(url, nome) }, ...(video ? [] : [{ texto: A.T('Copiar imagem', 'Copy image'), icone: 'copiar', onclick: () => U.copiarImagem(url) }]), ...(link ? [{ texto: txtLink(), icone: 'link', onclick: () => U.copiar(link) }] : [])]));
    const partes = [palco, barra];
    let ir = () => {};
    if (itens && itens.length > 1) {
      const n = itens.length, cont = h('span', { class: 'vi-cont' });
      const seta = (lado) => h('button', { type: 'button', class: 'vi-seta ' + lado, title: lado === 'esq' ? A.T('Anterior', 'Previous') : A.T('Próxima', 'Next'), onclick: (e) => { e.stopPropagation(); ir(lado === 'esq' ? -1 : 1); } }, A.icone(lado === 'esq' ? 'setaE' : 'setaD', 22));
      const sEsq = seta('esq'), sDir = seta('dir');
      palco.append(sEsq, sDir, cont);
      const tiras = itens.map((it, k) => h('button', { type: 'button', class: 'vi-mini' + (it.video ? ' video' : ''), title: it.nome || '', onclick: () => mostrar(k) },
        it.video ? h('video', { src: it.url, muted: '', preload: 'metadata', playsinline: '' }) : h('img', { src: it.url, alt: '', loading: 'lazy', draggable: 'false' })));
      const faixa = h('div', { class: 'vi-faixa' }, ...tiras);
      partes.push(faixa);
      const mostrar = (k) => {
        pos = (k + n) % n; const it = itens[pos];
        url = it.url; nome = it.nome || nome; video = !!it.video; link = linkDe(url, it.link);
        z = 1; x = 0; y = 0; pintar(); toques.clear(); ini = null;
        if (mid !== img) { try { mid.pause(); } catch (e) { /* ok */ } mid.remove(); }
        if (video) { mid = h('video', { src: url, class: 'vi-img vi-video', controls: '', autoplay: '', playsinline: '' }); img.hidden = true; palco.prepend(mid); }
        else { mid = img; img.hidden = false; img.src = url; }
        palco.classList.toggle('video', video);
        zoomBts.forEach((b) => (b.hidden = video)); btCopiar.hidden = video;
        if (btLink) { btLink.hidden = !link; btLink.title = txtLink(); }
        cont.textContent = (pos + 1) + ' / ' + n;
        tiras.forEach((t, j) => t.classList.toggle('ativa', j === pos));
        tiras[pos].scrollIntoView({ block: 'nearest', inline: 'center' });
      };
      ir = (d) => mostrar(pos + d);
      const tecla = (e) => { if (!palco.isConnected) { removeEventListener('keydown', tecla, true); return; } if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); ir(e.key === 'ArrowLeft' ? -1 : 1); } };
      addEventListener('keydown', tecla, true);
      requestAnimationFrame(() => mostrar(pos));
    } else if (video) { requestAnimationFrame(() => { mid = h('video', { src: url, class: 'vi-img vi-video', controls: '', autoplay: '', playsinline: '' }); img.hidden = true; palco.prepend(mid); palco.classList.add('video'); zoomBts.forEach((b) => (b.hidden = true)); btCopiar.hidden = true; }); }
    return U.modal(null, partes, { largura: 1100, classe: 'vi-modal' + (itens && itens.length > 1 ? ' vi-galeria' : ''), prioridade: true });
  };
  // ---------- arrastar e redimensionar (0.6.0) ----------
  // arrastar: "el" (position: fixed) segue o mouse/dedo pela "alca"; um clique sem arrastar continua sendo clique. A posição fica lembrada.
  const lerPos = (k) => { try { return JSON.parse(A.store.ler('aero-pos:' + k, 'null')); } catch (e) { return null; } };
  U.arrastar = (el, alca = el, { chave = '', quando = () => true, aoMover, fixar = false } = {}) => {
    let ini = null, moveu = false;
    // (0.7.2) a chave pode depender do estado (a janelinha e a pílula da chamada têm tamanhos diferentes: cada uma lembra o seu lugar)
    const k = () => (typeof chave === 'function' ? chave() : chave);
    const por = (x, y) => { if (!el.offsetWidth) return; x = A.limitar(x, 4, Math.max(4, innerWidth - el.offsetWidth - 4)); y = A.limitar(y, 4, Math.max(4, innerHeight - el.offsetHeight - 4)); Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto', transform: 'none', translate: 'none' }); };
    // (0.7.1) a posição salva só vale quando dá para arrastar (a chamada abre maximizada: aplicar ali encolhia a janela num canto)
    const aplicarSalva = () => { const sv = k() && lerPos(k()); if (sv && !fixar && el.isConnected && quando()) por(sv.x * innerWidth, sv.y * innerHeight); };
    requestAnimationFrame(aplicarSalva);
    // (0.7.2) sempre inteira dentro da janela: mudou o tamanho da janela do app ou o dela (antes podia ficar quase toda para fora, no canto)
    const dentro = () => { if (fixar || !el.isConnected || !el.style.left || el.style.left === 'auto' || !quando()) return; por(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0); };
    addEventListener('resize', dentro); if (window.ResizeObserver) new ResizeObserver(dentro).observe(el);
    alca.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, textarea, select, a, .cx, .btn') || !quando()) return;
      const r = el.getBoundingClientRect(); ini = { dx: e.clientX - r.left, dy: e.clientY - r.top, px: e.clientX, py: e.clientY }; moveu = false;
    });
    alca.addEventListener('pointermove', (e) => {
      if (!ini) return;
      if (!moveu) { if (Math.abs(e.clientX - ini.px) + Math.abs(e.clientY - ini.py) < 5) return; moveu = true; alca.setPointerCapture(e.pointerId); el.classList.add('arrastando'); if (fixar) { const r = el.getBoundingClientRect(); el.style.position = 'fixed'; el.style.width = r.width + 'px'; el.style.margin = '0'; el.style.zIndex = '60'; } }
      por(e.clientX - ini.dx, e.clientY - ini.dy); if (aoMover) aoMover(el.getBoundingClientRect());
    });
    const solta = () => { if (!ini) return; ini = null; el.classList.remove('arrastando'); if (moveu && k()) { const r = el.getBoundingClientRect(); A.store.gravar('aero-pos:' + k(), JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight })); } };
    alca.addEventListener('pointerup', solta); alca.addEventListener('pointercancel', solta);
    // o clique que vem logo depois de arrastar não conta (senão soltar a pílula da chamada abria a chamada)
    alca.addEventListener('click', (e) => { if (moveu) { e.stopPropagation(); e.preventDefault(); moveu = false; } }, true);
    return { aplicarSalva, dentro, voltar: () => { if (k()) A.store.gravar('aero-pos:' + k(), 'null'); ['left', 'top', 'right', 'bottom', 'transform', 'translate', ...(fixar ? ['position', 'width', 'margin', 'z-index'] : [])].forEach((p) => el.style.removeProperty(p)); } };
  };
  // redimensionar por um divisor: "eixo" x (largura) ou y (altura); "sinal" -1 quando o divisor fica do lado esquerdo/de cima
  U.redimensionar = (el, divisor, { eixo = 'y', min = 80, max = 800, chave = '', sinal = 1, prop } = {}) => {
    const propriedade = prop || (eixo === 'x' ? 'width' : 'height');
    const salvo = chave && +A.store.ler('aero-tam:' + chave, '0'); if (salvo) el.style[propriedade] = A.limitar(salvo, min, max) + 'px';
    let ini = null;
    divisor.addEventListener('pointerdown', (e) => { e.preventDefault(); divisor.setPointerCapture(e.pointerId); ini = { p: eixo === 'x' ? e.clientX : e.clientY, t: eixo === 'x' ? el.offsetWidth : el.offsetHeight }; document.documentElement.classList.add('redimensionando'); });
    divisor.addEventListener('pointermove', (e) => { if (!ini) return; const d = ((eixo === 'x' ? e.clientX : e.clientY) - ini.p) * sinal; el.style[propriedade] = A.limitar(ini.t + d, min, max) + 'px'; });
    const solta = () => { if (!ini) return; ini = null; document.documentElement.classList.remove('redimensionando'); if (chave) A.store.gravar('aero-tam:' + chave, String(eixo === 'x' ? el.offsetWidth : el.offsetHeight)); };
    divisor.addEventListener('pointerup', solta); divisor.addEventListener('pointercancel', solta);
    divisor.addEventListener('dblclick', () => { el.style.removeProperty(propriedade); if (chave) A.store.gravar('aero-tam:' + chave, '0'); });
  };

  // ---------- chat durante a transmissão (0.6.0): grudado à direita, à esquerda ou solto numa janela flutuante ----------
  // Arraste pelo cabeçalho: soltar perto da borda esquerda/direita gruda ali; no meio, fica solto (dá para mudar o tamanho pelo canto).
  // A tela se ajusta (o vídeo usa o espaço que sobra). Fica lembrado.
  U.chatEncaixavel = (painel, alca, contexto, chave) => {
    const lerLado = () => { const l = A.store.ler('aero-chat-lado:' + chave, 'dir'); return ['dir', 'esq', 'solto'].includes(l) ? l : 'dir'; };
    const aplicar = (lado, pos) => {
      contexto.dataset.chatLado = lado;
      if (lado === 'solto') { const p = pos || lerPos('chat-' + chave) || { x: 0.55, y: 0.15 }; Object.assign(painel.style, { left: Math.round(A.limitar(p.x * innerWidth, 4, innerWidth - 220)) + 'px', top: Math.round(A.limitar(p.y * innerHeight, 4, innerHeight - 200)) + 'px' }); }
      else ['left', 'top'].forEach((k) => painel.style.removeProperty(k));
    };
    aplicar(lerLado());
    alca.classList.add('chat-alca'); alca.title = A.T('Arraste para grudar à esquerda, à direita ou soltar', 'Drag to dock left, right or float');
    let ini = null, moveu = false;
    alca.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('button, input, textarea')) return; const r = painel.getBoundingClientRect(); ini = { dx: e.clientX - r.left, dy: e.clientY - r.top, px: e.clientX, py: e.clientY }; moveu = false; });
    alca.addEventListener('pointermove', (e) => {
      if (!ini) return;
      if (!moveu) { if (Math.abs(e.clientX - ini.px) + Math.abs(e.clientY - ini.py) < 6) return; moveu = true; alca.setPointerCapture(e.pointerId); contexto.dataset.chatLado = 'solto'; painel.classList.add('arrastando'); }
      Object.assign(painel.style, { left: A.limitar(e.clientX - ini.dx, 0, innerWidth - 120) + 'px', top: A.limitar(e.clientY - ini.dy, 0, innerHeight - 80) + 'px' });
      const r = contexto.getBoundingClientRect(); contexto.dataset.chatAlvo = e.clientX < r.left + 110 ? 'esq' : e.clientX > r.right - 110 ? 'dir' : '';
    });
    const solta = (e) => {
      if (!ini) return; ini = null; painel.classList.remove('arrastando'); delete contexto.dataset.chatAlvo;
      if (!moveu) return;
      const r = contexto.getBoundingClientRect(), lado = e.clientX < r.left + 110 ? 'esq' : e.clientX > r.right - 110 ? 'dir' : 'solto';
      const pr = painel.getBoundingClientRect(), pos = { x: pr.left / innerWidth, y: pr.top / innerHeight };
      if (lado === 'solto') A.store.gravar('aero-pos:chat-' + chave, JSON.stringify(pos));
      A.store.gravar('aero-chat-lado:' + chave, lado); aplicar(lado, pos); A.som.tocar('bolha');
    };
    alca.addEventListener('pointerup', solta); alca.addEventListener('pointercancel', solta);
    // (0.6.0) largura: arrastar a borda de dentro (a do lado do vídeo; solto, a da direita). Fica lembrada; duplo clique volta ao padrão
    const borda = h('div', { class: 'chat-borda', title: A.T('Arraste para mudar a largura', 'Drag to change the width') });
    painel.append(borda);
    const larg = +A.store.ler('aero-chat-w:' + chave, '0');
    const porLargura = (w) => contexto.style.setProperty('--chat-w', Math.round(A.limitar(w, 280, Math.max(320, Math.min(900, innerWidth * 0.7)))) + 'px');
    if (larg) porLargura(larg);
    let ib = null;
    borda.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); borda.setPointerCapture(e.pointerId); ib = { x: e.clientX, w: painel.offsetWidth, s: contexto.dataset.chatLado === 'dir' ? -1 : 1 }; document.documentElement.classList.add('redimensionando'); });
    borda.addEventListener('pointermove', (e) => { if (ib) porLargura(ib.w + (e.clientX - ib.x) * ib.s); });
    const soltaB = () => { if (!ib) return; ib = null; document.documentElement.classList.remove('redimensionando'); A.store.gravar('aero-chat-w:' + chave, String(painel.offsetWidth)); };
    borda.addEventListener('pointerup', soltaB); borda.addEventListener('pointercancel', soltaB);
    borda.addEventListener('dblclick', () => { contexto.style.removeProperty('--chat-w'); A.store.gravar('aero-chat-w:' + chave, '0'); });
  };

  // (0.9.4) imagem para enviar (banner, fundo, Mural, nameplate, grupo): até 20 MB vai COMO ESTÁ, sem perder qualidade. Só acima disso
  // a qualidade baixa aos poucos (e, se ainda não couber, o tamanho) até caber. GIF animado não passa pelo canvas (perderia a animação).
  U.LIMITE_IMG = 20 * 1048576;
  // (0.9.5) GIF ou WebP com mais de um quadro (animado): vai como está, porque redesenhar no canvas tiraria a animação
  U.animada = async (f) => {
    try {
      if (!f || !/^image\/(gif|webp)$/.test(f.type)) return false;
      const b = new Uint8Array(await f.slice(0, f.type === 'image/gif' ? Math.min(f.size, 4 * 1048576) : 64).arrayBuffer());
      if (f.type === 'image/webp') return b.length > 21 && String.fromCharCode(b[12], b[13], b[14], b[15]) === 'VP8X' && !!(b[20] & 0x02);
      let n = 0; for (let i = 0; i + 2 < b.length; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04 && ++n > 1) return true;
      return false;
    } catch (e) { return false; }
  };
  U.encolher = async (f, max = U.LIMITE_IMG) => {
    if (!f || f.size <= max) return f;
    if (f.type === 'image/gif' || (await U.animada(f))) throw new Error(A.T('GIF grande demais (máximo 20 MB).', 'GIF too large (max 20 MB).'));
    let bmp; try { bmp = await createImageBitmap(f); } catch (_) { throw new Error(A.T('Não consegui abrir essa imagem.', 'Could not open that image.')); }
    let e = Math.min(1, 8192 / Math.max(bmp.width, bmp.height));
    for (let volta = 0; volta < 6; volta++, e *= 0.8) {
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * e)); cv.height = Math.max(1, Math.round(bmp.height * e));
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      for (const q of [0.95, 0.9, 0.82, 0.72]) { const b = await new Promise((ok) => cv.toBlob(ok, 'image/webp', q)); if (b && b.size <= max) { try { bmp.close(); } catch (_) { /* ok */ } return b; } }
      cv.width = cv.height = 0;
    }
    try { bmp.close(); } catch (_) { /* ok */ }
    throw new Error(A.T('Imagem grande demais (máximo 20 MB).', 'Image too large (max 20 MB).'));
  };

  // ---------- recortar uma imagem (0.6.0): arrastar e dar zoom dentro da moldura; devolve um Blob do tamanho pedido (ou null) ----------
  U.recortar = (arquivo, { largura = 320, altura = 320, redondo = false, titulo, nativo = false } = {}) => new Promise(async (resolver) => {
    let bmp; try { bmp = await createImageBitmap(arquivo); } catch (e) { U.toast(A.T('Não consegui abrir essa imagem.', 'Could not open that image.'), { tipo: 'erro' }); resolver(null); return; }
    const VW = Math.min(440, innerWidth - 80), VH = Math.round(VW * altura / largura);
    const cv = h('canvas', { class: 'rc-canvas' + (redondo ? ' redondo' : ''), width: VW, height: VH }), g = cv.getContext('2d');
    const base = Math.max(VW / bmp.width, VH / bmp.height); let z = 1, x = 0, y = 0; // x,y: deslocamento do centro (px da moldura)
    const limitar = () => { const w = bmp.width * base * z, hh = bmp.height * base * z; x = A.limitar(x, -(w - VW) / 2, (w - VW) / 2); y = A.limitar(y, -(hh - VH) / 2, (hh - VH) / 2); };
    const desenhar = () => { limitar(); const w = bmp.width * base * z, hh = bmp.height * base * z; g.clearRect(0, 0, VW, VH); g.drawImage(bmp, (VW - w) / 2 + x, (VH - hh) / 2 + y, w, hh); };
    let ini = null;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ini = { px: e.clientX, py: e.clientY, x, y }; });
    cv.addEventListener('pointermove', (e) => { if (!ini) return; x = ini.x + e.clientX - ini.px; y = ini.y + e.clientY - ini.py; desenhar(); });
    cv.addEventListener('pointerup', () => { ini = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); z = A.limitar(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 1, 6); desenhar(); zoomEl.value = z; }, { passive: false });
    const zoomEl = U.slider({ min: 1, max: 6, passo: 0.01, valor: 1, oninput: (v) => { z = v; desenhar(); } });
    desenhar();
    let feito = false;
    U.modal(titulo || A.T('Ajustar imagem', 'Adjust image'), h('div', { class: 'col', estilo: { gap: '10px', 'align-items': 'center' } }, h('div', { class: 'rc-moldura' }, cv), h('div', { class: 'linha', estilo: { width: '100%' } }, A.icone('zoomMenos', 18), zoomEl, A.icone('zoomMais', 18)), h('div', { class: 'peq suave' }, A.T('Arraste para posicionar; role ou use a barra para aproximar.', 'Drag to position; scroll or use the bar to zoom.'))),
      { largura: VW + 60, acoes: [{ texto: A.T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: A.T('Aplicar', 'Apply'), valor: true }], aoFechar: async (v) => {
        if (feito) return; feito = true;
        if (!v) { resolver(null); return; }
        // (0.9.4) nativo: sai na resolução da própria imagem (só o enquadramento muda), sem encolher para o tamanho "ideal"
        if (nativo) { const lw = Math.min(8192, Math.max(largura, Math.round(VW / (base * z)))); altura = Math.round(lw * altura / largura); largura = lw; }
        const out = document.createElement('canvas'); out.width = largura; out.height = altura;
        const k = largura / VW, w = bmp.width * base * z * k, hh = bmp.height * base * z * k;
        out.getContext('2d').drawImage(bmp, (largura - w) / 2 + x * k, (altura - hh) / 2 + y * k, w, hh);
        resolver(await new Promise((ok) => out.toBlob(ok, 'image/png')));
      } });
  });

  // ---------- vídeo numa janelinha que fica por cima de tudo (0.6.0): continua tocando ao trocar de aba; fechar para de vez ----------
  U.janelaVideo = (url, tempo = 0, tocar = true) => {
    U.fecharJanelaVideo();
    const v = h('video', { src: url, playsinline: '', controls: '' }); v.currentTime = tempo;
    const fechar = U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: A.T('Fechar', 'Close'), onclick: () => U.fecharJanelaVideo() });
    const el = h('div', { class: 'janela-video vidro', id: 'janela-video' }, h('div', { class: 'jv-cab' }, h('span', { class: 'cresce peq' }, A.T('Vídeo', 'Video')), fechar), v);
    document.body.append(el);
    let ini = null; const cab = el.querySelector('.jv-cab');
    cab.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; cab.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect(); ini = { dx: e.clientX - r.left, dy: e.clientY - r.top }; });
    cab.addEventListener('pointermove', (e) => { if (!ini) return; el.style.left = A.limitar(e.clientX - ini.dx, 0, innerWidth - el.offsetWidth) + 'px'; el.style.top = A.limitar(e.clientY - ini.dy, 0, innerHeight - el.offsetHeight) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; });
    cab.addEventListener('pointerup', () => { ini = null; });
    if (tocar) v.play().catch(() => {});
    U._jv = { el, v };
  };
  U.fecharJanelaVideo = () => { const j = U._jv; if (!j) return; U._jv = null; try { j.v.pause(); j.v.removeAttribute('src'); j.v.load(); } catch (e) { /* ok */ } j.el.remove(); }; // tira o vídeo de vez: nada fica decodificando

  // ---------- janelas (modais) ----------
  // som: [abrir, fechar] — cada tipo de janela tem o seu par (o perfil, por exemplo); sem isso, o par das janelas comuns
  // (0.5.9-9) "tem janela aberta" fica marcado na raiz (data-modal): o fundo e as películas de trás param. Antes era um ":has()" no CSS e
  // uma busca no documento a cada quadro
  const marcarModais = () => { const r = document.documentElement, m = document.querySelector('#modais .fundo-modal, .fundo-modal.prioridade') ? '1' : ''; if ((r.dataset.modal || '') !== m) { if (m) r.dataset.modal = m; else delete r.dataset.modal; } };
  U.modal = (titulo, conteudo, { largura, acoes = [], aoFechar, som = ['janela-abrir', 'janela-fechar'], classe = '', prioridade = false } = {}) => {
    const raiz = prioridade ? document.body : document.getElementById('modais'); // (0.6.0) prioridade: por cima de tudo (chamada, sala, menus)
    const fundo = h('div', { class: 'fundo-modal' + (prioridade ? ' prioridade' : '') });
    const caixa = h('div', { class: 'modal vidro' + (classe ? ' ' + classe : ''), role: 'dialog', 'aria-modal': 'true', estilo: largura ? { width: `min(${largura}px, 100%)` } : {} });
    let fechado = false;
    const fechar = (valor) => {
      if (fechado) return; fechado = true;
      A.som.tocar(som[1]); fundo.classList.add('fechando'); // fechou: a bolha estoura
      document.removeEventListener('keydown', tecla, true);
      setTimeout(() => { fundo.remove(); marcarModais(); aoFechar && aoFechar(valor); }, 260);
    };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('keydown', tecla, true);
    fundo.addEventListener('pointerdown', (e) => { if (e.target === fundo) fechar(); });
    caixa.append(titulo ? h('div', { class: 'linha entre' }, h('h2', {}, titulo), U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: A.T('Fechar', 'Close'), onclick: () => fechar(), mudo: true })) : null, h('div', { class: 'col', estilo: { 'margin-top': titulo ? '14px' : '0' } }, conteudo),
      acoes.length ? h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end', 'margin-top': '18px', 'flex-wrap': 'wrap' } }, acoes.map((a) => U.btn(a.texto, { tipo: a.tipo, icone: a.icone, onclick: () => (a.onclick ? a.onclick(fechar) : fechar(a.valor)) }))) : null);
    fundo.append(caixa); raiz.append(fundo); marcarModais();
    A.som.tocar(som[0]); // abriu: a bolha se forma
    const primeiro = caixa.querySelector('input:not([type=range]):not([type=file]):not([type=color]):not([type=checkbox]),.btn:not(.redondo)'); // (não o volume da música do perfil) if (primeiro && !A.plat.toque) setTimeout(() => primeiro.focus({ preventScroll: true }), 80);
    return { fechar, el: caixa };
  };

  U.confirmar = (msg, { sim = A.T('Sim', 'Yes'), nao = A.T('Cancelar', 'Cancel'), perigo, titulo = null } = {}) => new Promise((ok) => {
    U.modal(titulo, typeof msg === 'string' ? h('p', { estilo: { 'font-size': '17px', margin: '4px 0' } }, msg) : msg, {
      acoes: [{ texto: nao, tipo: 'sec', valor: false }, { texto: sim, tipo: perigo ? 'perigo' : '', valor: true }], aoFechar: (v) => ok(!!v),
    });
  });

  // (0.6.0) com o app minimizado ou atrás de outra janela: a notificação do sistema (o balão do Windows/KDE/celular) também aparece
  // (0.8.6) com a pessoa: a foto e o nome dela na notificação (no PC, no Linux e no Windows, e no celular), em vez do ícone do Aero
  const notifCel = () => (A.plat.apk && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AeroNotif) || null;
  // (1.0.0) a foto vai para a notificação do PC já como PNG redondinho: o sistema não abre WebP/GIF (as fotos do Aero) e mostrava o ícone do app no lugar
  const fotosPng = new Map();
  const fotoPng = (url) => {
    if (!url) return Promise.resolve('');
    if (fotosPng.has(url)) return fotosPng.get(url);
    const p = new Promise((ok) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const fim = setTimeout(() => ok(''), 3500);
      img.onload = () => {
        clearTimeout(fim);
        try {
          const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
          const s = Math.min(img.naturalWidth, img.naturalHeight) || 1;
          c.beginPath(); c.arc(64, 64, 64, 0, Math.PI * 2); c.clip();
          c.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 128, 128);
          ok(cv.toDataURL('image/png'));
        } catch (e) { ok(''); }
      };
      img.onerror = () => { clearTimeout(fim); ok(''); };
      img.src = url;
    }).then((r) => { if (!r) fotosPng.delete(url); return r; });
    if (fotosPng.size > 60) fotosPng.clear();
    fotosPng.set(url, p); return p;
  };
  U.notificar = (titulo, texto, { cid, pessoa, nome } = {}) => {
    try {
      if (A.focado()) return;
      const icone = pessoa && pessoa.codigo ? A.avatarUrl(pessoa.codigo, pessoa.av) || '' : '';
      // celular (APK): notificação de verdade do Android; as da mesma pessoa se empilham numa só
      const N = notifCel();
      if (N && N.mostrar) { if (document.hidden) { A.push && A.push.visto && A.push.visto(); N.mostrar({ grupo: (pessoa && pessoa.codigo) || cid || 'aero', nome: nome || titulo, titulo, texto: String(texto || '').slice(0, 300), icone, cid: cid || '' }).catch(() => {}); } return; }
      if (A.plat.toque && !document.hidden) return; // (0.7.0) celular com o Aero na tela: o "foco" nem sempre é informado (iPhone); a notificação do sistema é só com o app fechado/no fundo
      // (0.7.0) no app do PC, pelo próprio app (no Linux passa pelo "não perturbe" automático de quando a tela está sendo compartilhada)
      if (window.aero && window.aero.notificar) { const urgente = document.documentElement.dataset.transmitindo === '1'; fotoPng(icone).then((png) => window.aero.notificar({ titulo, texto, cid: cid || '', icone: png || icone, urgente })).catch(() => {}); return; }
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default' && !A.plat.desktop) { Notification.requestPermission().catch(() => {}); return; }
      if (Notification.permission !== 'granted') return;
      const n = new Notification(String(titulo).slice(0, 80), { body: String(texto || '').slice(0, 160), icon: icone || 'icon-512.png', silent: true });
      n.onclick = () => { try { window.focus(); if (window.aero && window.aero.mostrar) window.aero.mostrar(); } catch (e) { /* ok */ } n.close(); };
    } catch (e) { /* sem notificação: o balão dentro do app já avisou */ }
  };
  // celular: pede a permissão de notificação uma vez e, ao voltar para o app, tira as notificações que já foram vistas
  if (notifCel()) {
    setTimeout(() => { try { notifCel().permitir().catch(() => {}); } catch (e) { /* ok */ } }, 4000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) try { notifCel().limpar({}).catch(() => {}); } catch (e) { /* ok */ } });
  }

  // (0.9.1) NOTIFICAÇÕES PUSH: avisam de mensagem com o Aero fechado. No site (e no site instalado), Web Push pelo service worker; no app do
  // Android, o próprio app pergunta as novidades em segundo plano. O token de push é só deste aparelho e morre junto com a sessão.
  const PUSH_K = 'aero-push';
  const B64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  const guardadoPush = () => { try { return JSON.parse(A.store.ler(PUSH_K, '') || 'null'); } catch (e) { return null; } };
  const webPush = () => !notifCel() && !A.plat.desktop && location.protocol === 'https:' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  A.push = {
    async ligar() {
      try {
        const API = A.api, eu = API && API.eu, N = notifCel();
        if (!eu || !API.token || (!N && !webPush())) return;
        const g = guardadoPush(), sess = API.token.slice(0, 10);
        // o app abriu: o que chegou enquanto estava fechado já aparece aqui dentro, então a fila de avisos esvazia (sem notificação velha depois)
        let morto = false;
        if (g && g.t) { const d = await fetch(API.servidor + '/api/push/novas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: g.t }) }).then((r) => r.json()).catch(() => null); morto = !!(d && d.fim); }
        if (N) {
          // (0.9.5) o token já é deste aparelho: entrega de novo ao Android mesmo assim (ele pode ter perdido); se o servidor disse que
          // ele acabou, pede outro
          if (g && g.c === eu.codigo && g.s === sess && !morto) { if (N.guardarPush) await N.guardarPush({ t: g.t, api: API.servidor }); return; }
          const r = await API.req('push/registrar', { antigo: g && g.t });
          A.store.gravar(PUSH_K, JSON.stringify({ c: eu.codigo, s: sess, t: r.t }));
          if (N.guardarPush) await N.guardarPush({ t: r.t, api: API.servidor });
          return;
        }
        if (Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker.register('sw.js');
        let sub = await reg.pushManager.getSubscription();
        if (g && g.c === eu.codigo && g.s === sess && sub && g.e === sub.endpoint && !morto) return;
        if (!sub) { const { chave } = await API.req('push/chave'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: B64(chave) }); }
        const r = await API.req('push/registrar', { web: { endpoint: sub.endpoint }, antigo: g && g.t });
        await (await caches.open('aero-push')).put('/__aero-push', new Response(JSON.stringify({ t: r.t, api: API.servidor })));
        A.store.gravar(PUSH_K, JSON.stringify({ c: eu.codigo, s: sess, t: r.t, e: sub.endpoint }));
      } catch (e) { A.log && A.log.aviso && A.log.aviso('push', e && e.message); }
    },
    async desligar() {
      const g = guardadoPush(); A.store.gravar(PUSH_K, '');
      try { if (g && g.t) await A.api.req('push/sair', { t: g.t }); } catch (e) { /* a sessão some de qualquer jeito */ }
      try { const N = notifCel(); if (N && N.limparPush) await N.limparPush(); } catch (e) { /* ok */ }
      try { if (window.caches) await (await caches.open('aero-push')).delete('/__aero-push'); } catch (e) { /* ok */ }
    },
  };
  A.evt.on('hub:conectou', () => setTimeout(() => A.push.ligar(), 3000));
  // (0.9.2) app do celular: foi para o fundo, o servidor passa a mandar push para este aparelho (o Android congela o app e a conexão
  // continua parecendo viva); o que o próprio app já avisou sai da fila, para não chegar repetido depois
  if (notifCel()) {
    const fundo = () => { try { if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'fundo', sim: document.hidden }); } catch (e) { /* ok */ } };
    document.addEventListener('visibilitychange', fundo);
    A.evt.on('hub:conectou', () => { if (document.hidden) fundo(); });
    let tVisto = 0;
    A.push.visto = () => {
      clearTimeout(tVisto);
      tVisto = setTimeout(() => { const g = guardadoPush(); if (g && g.t && A.api) fetch(A.api.servidor + '/api/push/novas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: g.t }) }).catch(() => {}); }, 2500);
    };
  }
  if (webPush()) {
    navigator.serviceWorker.addEventListener('message', (e) => { const cid = e.data && e.data.aeroAbrir; if (cid && A.talk && A.talk.irPara) A.talk.irPara(cid); });
    // o primeiro toque na tela pede a permissão (o navegador só deixa pedir com um gesto da pessoa); aceitou: o push liga
    const pedir = () => { if (!A.api || !A.api.eu || Notification.permission !== 'default') return; document.removeEventListener('pointerup', pedir, true); Notification.requestPermission().then((p) => { if (p === 'granted') A.push.ligar(); }).catch(() => {}); };
    document.addEventListener('pointerup', pedir, true);
  }

  // ---------- avisos que caem do topo ----------
  U.toast = (texto, { tipo = '', avatar, acoes = [], ms = 4200, som } = {}) => {
    const raiz = document.getElementById('toasts');
    const t = h('div', { class: 'toast vidro ' + tipo, role: 'status' }, avatar ? U.avatar(avatar, 38) : null, h('div', { class: 'cresce' }, texto),
      acoes.map((a) => U.btn(a.texto, { tipo: a.tipo, peq: true, onclick: () => { a.onclick && a.onclick(); sair(); } })));
    let saiu = false;
    const sair = () => { if (saiu) return; saiu = true; t.classList.add('saindo'); setTimeout(() => t.remove(), 320); };
    raiz.append(t);
    A.som.tocar(som || (tipo === 'erro' ? 'erro' : tipo === 'ok' ? 'sucesso' : 'abrir'));
    if (ms) setTimeout(sair, ms);
    return { fechar: sair };
  };

  // ---------- fundo: bolhas flutuando (motor só de CSS: o JS só cria os elementos e define variáveis) ----------
  // Cada bolha é um elemento com variáveis (--tam, --x, --y, --dur, --atraso, --dx); o movimento é uma animação de transform no
  // compositor, sem JS por quadro. Mudou a cor? Só variáveis CSS, nada é recriado (sem piscar). Mudou quantidade/tamanho/velocidade/
  // direção/imagem? As bolhas novas aparecem em fade e as antigas somem em fade (nunca um "corte" seco).
  const alea = (a, b) => a + Math.random() * (b - a);
  U.fundoBolhas = {
    sig: '', atual: null, geracao: 0,
    quantidade() {
      const t = A.cfg.v.tema;
      if (!t.bolhas || A.cfg.v.visual === 'lite') return 0;
      return A.plat.celular ? Math.min(t.bolhasQtd, 8) : t.bolhasQtd;
    },
    reconstruir(forcar) {
      const fundo = document.getElementById('fundo'); if (!fundo) return;
      const t = A.cfg.v.tema, qtd = this.quantidade();
      const sig = A.tema.assinaturaBolhas(t) + '|' + qtd + '|' + A.cfg.v.visual + '|' + (A.plat.celular ? 'c' : 'd');
      if (sig === this.sig && !forcar) return;
      this.sig = sig;
      const maxTam = A.plat.celular ? Math.min(t.bolhasTam, 220) : t.bolhasTam, minTam = Math.max(30, maxTam * 0.28);
      const modo = t.bolhasModo, vel = t.bolhasVel;
      const base = 90 - 0.78 * vel; // 90 s (lenta) .. 12 s (rápida)
      const novo = h('div', { class: 'bolhas-bg entrando', dados: { modo } });
      if (t.bolhasImagem) novo.style.setProperty('--bimg', `url("${t.bolhasImagem}")`);
      // (0.5.9-9) cada bolha ganha os SEUS keyframes, com os números já calculados. Com variáveis dentro dos @keyframes (var(--dx),
      // var(--tam)...) o Chrome não conseguia passar a animação para a placa de vídeo: ela rodava no processador, a cada quadro. Os
      // keyframes ficam num <style> dentro do próprio fundo (somem junto com ele).
      const geracao = ++this.geracao, kf = [];
      const amp = Math.round(6 + (vel / 100) * 18);
      for (let i = 0; i < qtd; i++) {
        const tam = Math.round(alea(minTam, maxTam)), dur = modo === 'parado' ? alea(7, 14) : base * alea(0.75, 1.3), dx = Math.round(alea(-90, 90));
        const nb = `bb${geracao}-${i}`, longe = tam * 2;
        const fim = { subir: `${dx}px, calc(-100vh - ${longe}px), 0`, descer: `${dx}px, calc(100vh + ${longe}px), 0`, esq: `calc(-100vw - ${longe}px), ${dx}px, 0`, dir: `calc(100vw + ${longe}px), ${dx}px, 0`, parado: `${Math.round(dx * 0.35)}px, -26px, 0` }[modo] || `${dx}px, calc(-100vh - ${longe}px), 0`;
        kf.push(`@keyframes ${nb}{from{transform:translate3d(0,0,0)}to{transform:translate3d(${fim})}}`);
        const inner = h('i', { class: 'in' });
        if (modo !== 'parado') inner.style.animationName = modo === 'esq' || modo === 'dir' ? `bi${geracao}-y` : `bi${geracao}-x`;
        const e = h('div', { class: 'b' + (t.bolhasImagem ? ' img' : t.bolhasGradiente ? '' : ' lisa'), estilo: {
          '--tam': tam + 'px', '--x': alea(0, 100).toFixed(1) + '%', '--y': alea(0, 100).toFixed(1) + '%', '--dur': dur.toFixed(1) + 's',
          '--atraso': (-alea(0, dur)).toFixed(1) + 's', 'animation-name': nb } }, inner);
        novo.append(e);
      }
      kf.push(`@keyframes bi${geracao}-x{from{transform:translateX(-${amp}px)}to{transform:translateX(${amp}px)}}`, `@keyframes bi${geracao}-y{from{transform:translateY(-${amp}px)}to{transform:translateY(${amp}px)}}`);
      novo.append(h('style', {}, kf.join('')));
      const velho = this.atual; this.atual = novo;
      fundo.append(novo);
      requestAnimationFrame(() => requestAnimationFrame(() => novo.classList.remove('entrando')));
      if (velho) { velho.classList.add('saindo'); setTimeout(() => velho.remove(), 800); }
    },
    iniciar() {
      this.reconstruir(true);
      let t = 0;
      A.evt.on('tema', () => { clearTimeout(t); t = setTimeout(() => this.reconstruir(false), 160); }); // arrastar um slider não recria a cada pixel
    },
  };
  U.montarFundo = () => U.fundoBolhas.iniciar();

  // ---------- fundo parado quando ninguém está olhando ----------
  // O app do PC continua rodando a 100% atrás do jogo (para a transmissão não engasgar), então as bolhas e a aurora também
  // continuavam animando, gastando placa de vídeo à toa. Com a janela sem foco ou escondida, o fundo congela; volta ao focar.
  // (0.8.3) e com o app parado (ninguém mexeu no mouse, no teclado ou no controle por 90 s), o enfeite também congela: CPU e placa de vídeo
  // em zero com o app aberto à toa. Qualquer movimento volta tudo no mesmo instante, do ponto onde parou. Nada disso mexe em sala, chamada,
  // vídeo ou transmissão: só no fundo, nas bolhas e nas animações de enfeite.
  const OCIOSO_MS = 90000;
  let ultimaAtividade = performance.now(), ocioso = false, verPausa = () => {}, tOcioso = 0;
  // parado, qualquer coisa nova na tela (mensagem chegando, alguém ligando, um aviso) também acorda: o que aparece sozinho nunca fica congelado
  let vigiaTela = null;
  const checarOcioso = () => {
    const falta = OCIOSO_MS - (performance.now() - ultimaAtividade);
    if (falta > 50) { tOcioso = setTimeout(checarOcioso, falta); return; }
    ocioso = true; verPausa(); A.evt.emit('ocioso', true);
    if (window.MutationObserver && document.body) { vigiaTela = vigiaTela || new MutationObserver(() => U.atividade()); vigiaTela.observe(document.body, { childList: true, subtree: true }); }
  };
  const agendarOcioso = () => { clearTimeout(tOcioso); tOcioso = setTimeout(checarOcioso, OCIOSO_MS); };
  U.atividade = () => { ultimaAtividade = performance.now(); if (ocioso) { ocioso = false; if (vigiaTela) vigiaTela.disconnect(); verPausa(); A.evt.emit('ocioso', false); agendarOcioso(); } };
  U.ocioso = () => ocioso;
  U.iniciarPausaFundo = () => {
    const root = document.documentElement;
    const ver = verPausa = () => { const p = A.naFrente() && !ocioso ? '' : '1'; if (root.dataset.pausado !== p) root.dataset.pausado = p; if (root.dataset.ocioso !== (ocioso ? '1' : '')) root.dataset.ocioso = ocioso ? '1' : ''; };
    addEventListener('focus', ver); addEventListener('blur', ver); document.addEventListener('visibilitychange', ver); A.evt.on('frente', ver); ver();
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, U.atividade, { capture: true, passive: true });
    agendarOcioso();
  };

  // ---------- relógio das animações contínuas (0.7.12) ----------
  // Medido numa RX 580 com monitor de 120 Hz: cada animação sem fim (bolhas, aurora, o "respirar" das fotos, os pontinhos de "chamando") fazia
  // o Chromium montar a janela inteira 120 vezes por segundo, e o KWin a tela inteira junto, mesmo com o app parado. Agora elas ficam pausadas e
  // este relógio as avança todas juntas 30 vezes por segundo: o mesmo movimento, na mesma velocidade, com 1/4 dos quadros. A pausa do CSS
  // (janela sem foco, sala aberta, transmitindo) continua valendo: é lida do estilo a cada varredura. As animações curtas (abrir, surgir) não mudam.
  U.iniciarRelogioAnim = () => {
    if (typeof document.getAnimations !== 'function') return;
    const FPS = 30;
    let lista = [];
    const infinita = (a) => { try { return !!a.effect && a.effect.getTiming().iterations === Infinity; } catch (e) { return false; } };
    // a pausa do CSS (animation-play-state) da animação, na posição dela na lista do elemento ("running, paused")
    const pausadaNoCss = (a) => {
      const t = a.effect.target;
      if (!t || !t.isConnected) return true;
      try {
        const cs = getComputedStyle(t, a.effect.pseudoElement || null);
        const estados = cs.animationPlayState.split(','), nomes = cs.animationName.split(',').map((x) => x.trim());
        const i = Math.max(0, nomes.indexOf(a.animationName || ''));
        return (estados[i % estados.length] || '').trim() === 'paused';
      } catch (e) { return false; }
    };
    // (0.9.4) na versão otimizada, as animações que só enfeitam (brilhos, gotas, bolhas, prévias) ficam paradas no primeiro quadro: cada
    // quadro delas recalculava o estilo e pesava em PC fraco. Só andam as que dizem alguma coisa (carregando, digitando, enviando)
    const UTIL = /^(gir|spin|carreg|subindo|esperaGif|digOnda|tk-dig-pulo|digitaPula|dg-|cx-dig)/;
    // (1.0.2) só mexe em posição, tamanho, giro ou transparência: o navegador anda com ela sozinho, sem repintar (as que mudam sombra, cor
    // ou fundo repintam a cada quadro e ficam no relógio de 30 por segundo)
    const LEVES = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate', 'offset', 'easing', 'composite', 'computedOffset', 'filter']);
    const soMove = (a) => { try { return a.effect.getKeyframes().every((k) => Object.keys(k).every((p) => LEVES.has(p))); } catch (e) { return false; } };
    const varrer = () => {
      if (document.hidden) return;
      const agora = performance.now(), lite = document.documentElement.dataset.visual === 'lite' || document.documentElement.dataset.assistindo === '1';
      lista = document.getAnimations().filter(infinita);
      for (const a of lista) {
        if (!a._rel) { a._rel = { base: a.currentTime || 0, t0: agora, leve: soMove(a) }; a.pause(); }
        a._rel.parada = lite && !UTIL.test(a.animationName || '') ? true : pausadaNoCss(a);
      }
    };
    // (0.8.3) o relógio de 30 quadros só fica ligado quando tem alguma animação andando (antes acordava 30 vezes por segundo à toa) e para
    // com o app parado (U.ocioso): as animações continuam do mesmo ponto quando alguém mexe
    // (1.0.2) com o Aero na frente, na versão completa e alguém usando, as animações voltam para o próprio motor do navegador: andam no
    // ritmo do monitor (120 Hz ou mais) fora do caminho do resto do app, lisas mesmo com o chat cheio (antes cada uma era empurrada à mão,
    // quadro a quadro, e com 100+ animações num chat isso derrubava o chat para 20-30 quadros). Sem foco (o jogo na frente), parado há um
    // tempo ou na versão otimizada: continuam pausadas e este relógio as avança 30 vezes por segundo, para deixar a placa livre para o jogo
    let tPasso = 0;
    const rapido = () => document.documentElement.dataset.visual !== 'lite' && document.documentElement.dataset.assistindo !== '1' && A.naFrente() && !ocioso && !document.hidden;
    const pararPasso = () => { clearInterval(tPasso); tPasso = 0; };
    // entrega ao navegador as que podem andar sozinhas e pega de volta as que precisam parar (ou todas, fora do modo rápido)
    const sincronizar = () => {
      const agora = performance.now(), nat = rapido();
      for (const a of lista) {
        const r = a._rel; if (!r) continue;
        if (nat && !r.parada && r.leve) { if (!r.nativo) { try { a.play(); r.nativo = true; } catch (e) { /* segue no relógio */ } } }
        else if (r.nativo) { try { a.pause(); } catch (e) { /* ok */ } r.nativo = false; r.base = a.currentTime || 0; r.t0 = agora; }
      }
    };
    const passo = () => {
      const agora = performance.now(), parado = document.hidden || ocioso;
      let anda = false;
      for (const a of lista) {
        const r = a._rel;
        if (r.nativo) continue;
        if (r.parada || parado) { r.base = a.currentTime || 0; r.t0 = agora; continue; }
        a.currentTime = r.base + (agora - r.t0); anda = true;
      }
      if (!anda) pararPasso();
    };
    const ligar = () => {
      sincronizar();
      if (tPasso || document.hidden || ocioso || !lista.some((a) => !a._rel.parada && !a._rel.nativo)) return;
      tPasso = setInterval(passo, 1000 / FPS);
    };
    const varrer0 = varrer;
    const varrerEligar = () => { if (ocioso) return; varrer0(); ligar(); };
    // (0.9.0) a varredura (que lê o estilo de cada animação) é de 400 ms só com a janela em foco; sem foco, a cada 1,5 s; minimizada ou
    // parada, não roda (antes rodava sempre 2,5 vezes por segundo, até com o app escondido)
    let tVarrer = 0;
    const agendarVarrer = () => { clearTimeout(tVarrer); tVarrer = 0; if (ocioso || document.hidden) return; tVarrer = setTimeout(() => { const ir = () => { varrerEligar(); agendarVarrer(); }; if (window.requestIdleCallback) requestIdleCallback(ir, { timeout: 400 }); else ir(); }, A.naFrente() ? 900 : 2500); }; // (1.0.2) no tempo livre do app: nunca rouba um quadro // (1.0.2) 900 ms / 2,5 s: cada varredura lê o estilo de todas as animações
    A.evt.on('ocioso', (o) => { if (o) { clearTimeout(tVarrer); tVarrer = 0; sincronizar(); pararPasso(); } else { varrerEligar(); agendarVarrer(); } });
    const mudouJanela = () => { varrerEligar(); agendarVarrer(); };
    document.addEventListener('visibilitychange', mudouJanela); addEventListener('focus', mudouJanela); addEventListener('blur', mudouJanela); A.evt.on('frente', mudouJanela);
    mudouJanela();
  };

  // ---------- parallax: a luz do vidro, as bolhas e os cartões acompanham o mouse ----------
  // (0.5.9-9) Antes, a cada movimento do mouse, 4 variáveis eram trocadas na RAIZ da página (--mx, --my, --luz-x, --luz-y): toda variável
  // herdada obriga o navegador a recalcular o estilo de TODOS os elementos (8 a 10 ms por quadro com o perfil aberto, o que sozinho já
  // derrubava os 120 fps), e a luz "fixa" na janela redesenhava todos os painéis de vidro. Agora: as bolhas do fundo (e a esfera da
  // abertura) mexem só a própria posição, e a luz só existe no vidro que está embaixo do mouse, com a posição dentro dele (variável que
  // não é herdada: nada além do brilho é recalculado). O visual é o mesmo: a luz de 240 px só aparecia mesmo onde o mouse está.
  U.iniciarParallax = () => {
    if (A.plat.toque) return;
    const root = document.documentElement;
    let alvo = null, raf = 0, ev = null, luzes = [];
    const limpar = (el) => { if (!el) return; el.classList.remove('mexendo'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
    const apagarLuzes = () => { for (const v of luzes) { v.style.removeProperty('--luz-x'); v.style.removeProperty('--luz-y'); } luzes = []; };
    const passo = () => {
      raf = 0; if (!ev) return;
      if (root.dataset.parallax === '0' || root.dataset.visual === 'lite' || root.dataset.assistindo === '1') { limpar(alvo); alvo = null; apagarLuzes(); if (U.fundoBolhas.atual) U.fundoBolhas.atual.style.transform = ''; return; }
      const mx = (ev.clientX / innerWidth - 0.5) * 2, my = (ev.clientY / innerHeight - 0.5) * 2;
      const bolhas = U.fundoBolhas.atual;
      if (bolhas) bolhas.style.transform = `translate3d(${(mx * -14).toFixed(1)}px, ${(my * -14).toFixed(1)}px, 0)`;
      if (root.dataset.tela === 'splash') { const esf = document.querySelector('.tela.ativa .esfera'); if (esf) { esf.style.setProperty('--mx', mx.toFixed(3)); esf.style.setProperty('--my', my.toFixed(3)); } }
      // a luz: o vidro embaixo do mouse (e os vidros em volta dele, como o painel que contém um cartão de vidro)
      const novas = [];
      for (let v = ev.target.closest && ev.target.closest('.vidro'); v && novas.length < 3; v = v.parentElement && v.parentElement.closest('.vidro')) novas.push(v);
      for (const v of luzes) if (!novas.includes(v)) { v.style.removeProperty('--luz-x'); v.style.removeProperty('--luz-y'); }
      for (const v of novas) { const r = v.getBoundingClientRect(); v.style.setProperty('--luz-x', Math.round(ev.clientX - r.left) + 'px'); v.style.setProperty('--luz-y', Math.round(ev.clientY - r.top) + 'px'); }
      luzes = novas;
      const el = ev.target.closest && ev.target.closest('.paralax,.tile,.bolha');
      if (alvo && alvo !== el) limpar(alvo);
      alvo = el;
      if (!el) return;
      const r = el.getBoundingClientRect(), x = A.limitar((ev.clientX - r.left) / r.width, 0, 1), y = A.limitar((ev.clientY - r.top) / r.height, 0, 1);
      el.classList.add('mexendo');
      el.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg'); // o mouse em cima inclina para trás; embaixo, para frente
      el.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
      el.style.setProperty('--px', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--py', (y * 100).toFixed(1) + '%');
    };
    document.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(passo); }, { passive: true });
    document.addEventListener('pointerleave', (e) => { if (e.relatedTarget) return; limpar(alvo); alvo = null; apagarLuzes(); }, true); // o mouse saiu da janela
  };
  U.paralax = (el) => { el.classList.add('paralax'); el.append(h('i', { class: 'vidro-brilho' })); return el; };

  // ---------- sons automáticos nos botões ----------
  U.iniciarSons = () => {
    const alvos = '.btn,.aba,.tile,.amigo,.chip,.seg button,.eu';
    const destravar = () => A.som.destravar();
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, destravar, { once: true, passive: true, capture: true }));
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      if (document.documentElement.dataset.lock === '1') return; // controlando o PC de um amigo: o mouse passa pela interface sem sons
      // (0.7.6) dentro das mensagens do chat, nada de som de seleção: os botões de cada mensagem aparecem sob o mouse ao passar por ela e
      // tocavam fora de ordem. As conversas da lista do Aero Talk têm o som delas (talk.js)
      if (e.target.closest && e.target.closest('.cx-msgs, .tk-item')) { U._ultimoHover = null; return; }
      const el = e.target.closest && e.target.closest(alvos);
      if (el && !el.dataset.mudo && !el.disabled && el !== U._ultimoHover) { U._ultimoHover = el; A.som.tocar('hover'); }
      else if (!el) U._ultimoHover = null;
    }, { passive: true });
    document.addEventListener('click', (e) => {
      if (document.documentElement.dataset.lock === '1' && !A.entrada.pausaLocal) return;
      if (e.target.closest && e.target.closest('.cx-msgs, .tk-item')) return; // (0.7.6) as mensagens do chat não fazem o "clique" de botão; (1.0.0) as conversas da lista têm o delas (abrir DM / grupo)
      const el = e.target.closest && e.target.closest(alvos);
      if (el && !el.dataset.mudo && !el.disabled && !el.dataset.somProprio) A.som.tocar('click');
    }, { passive: true });
  };

  // ---------- o seu chip de perfil (0.6.0): perfil, trocar de conta e sair ----------
  U.menuConta = (ev, { sair } = {}) => {
    const API = A.api;
    const r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget.getBoundingClientRect() : null;
    const pos = r ? { clientX: r.left + 12, clientY: r.bottom + 6, preventDefault() {}, ancora: ev.currentTarget } : ev;
    U.menuContexto(pos, [
      { texto: A.T('Perfil', 'Profile'), icone: 'pessoa', onclick: () => A.perfil && A.perfil.ver(API.eu.codigo) },
      { texto: A.T('Editar perfil', 'Edit profile'), icone: 'lapis', onclick: () => A.perfil && A.perfil.editar() },
      U.itemStatus(),
      { texto: A.T('Trocar de conta', 'Switch account'), icone: 'pessoas', onclick: () => U.trocarConta() },
      null,
      { texto: A.T('Sair da conta', 'Sign out'), icone: 'sair', perigo: true, onclick: async () => { if (await U.confirmar(A.T('Sair da conta neste aparelho?', 'Sign out of this account on this device?'), { sim: A.T('Sair', 'Sign out'), perigo: true })) (sair || (async () => { await API.sair(); A.api.recarregar(); }))(); } },
    ]);
  };
  // (0.8.0) bolhas de conversa: cada pessoa escolhe o modelo e as cores da bolha das mensagens dela, e todo mundo vê assim
  U.MODELOS_BOLHA = [['padrao', 'Padrão', 'Default'], ['aero', 'Aero', 'Aero'], ['aquario', 'Aquário', 'Aquarium'], ['sabao', 'Bolha de sabão', 'Soap bubble'], ['neon', 'Neon', 'Neon'], ['gibi', 'Gibi', 'Comic'], ['carta', 'Carta', 'Letter'], ['terminal', 'Terminal', 'Terminal'], ['aurora', 'Aurora', 'Aurora'], ['pixel', 'Pixel', 'Pixel'], ['madeira', 'Madeira', 'Wood']];
  // (0.8.0) as cores de cada modelo (fundo, letra): cada bolha guarda as suas, e o que não foi mudado fica com a cor do próprio modelo
  U.CORES_BOLHA = { padrao: ['#5fb8ec', '#0b3b5b'], aero: ['#4aa8e8', '#08324d'], aquario: ['#2d9ee0', '#0b3b5b'], sabao: ['#bfe6ff', '#0b3b5b'], neon: ['#3ef0ff', '#ffffff'], gibi: ['#ffffff', '#111111'], carta: ['#fffaf0', '#3b2f1e'], terminal: ['#2bd45a', '#6dff8a'], aurora: ['#3a7bd5', '#ffffff'], pixel: ['#ffd84a', '#1b1b1b'], madeira: ['#a86b3c', '#3a1f0c'] };
  U.ANEL_SABAO = ['#ff9ad5', '#9ad8ff', '#b5ff9a', '#fff59a'];
  // (0.8.2) as bolhas com várias cores (de 2 a 6): o anel da Bolha de sabão e o degradê da Aurora
  U.CORES_VARIAS = { sabao: U.ANEL_SABAO, aurora: ['#3a7bd5', '#8e54e9', '#00d2c6'] };
  U.aplicarBolha = (el, bc) => {
    // (0.9.5) as bolhas de arte (estúdio, bolhaarte.js): se a arte não vale ou quem vê desligou, fica a bolha padrão
    if (A.bolhaArte) A.bolhaArte.limpar(el);
    if (bc && bc.m === 'arte') { if (A.bolhaArte && A.bolhaArte.aplicar(el, bc)) return el; bc = null; }
    if (!bc || !bc.m) { delete el.dataset.bc; el.style.removeProperty('--bc'); el.style.removeProperty('--bcf'); el.style.removeProperty('--bcg'); return el; }
    const g = Array.isArray(bc.g) ? bc.g.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : [];
    if (g.length >= 2) el.style.setProperty('--bcg', g.join(', ') + ', ' + g[0]); else el.style.removeProperty('--bcg');
    el.dataset.bc = bc.m;
    if (/^#[0-9a-f]{6}$/i.test(bc.c || '')) el.style.setProperty('--bc', bc.c); else el.style.removeProperty('--bc');
    if (/^#[0-9a-f]{6}$/i.test(bc.f || '')) el.style.setProperty('--bcf', bc.f); else el.style.removeProperty('--bcf');
    return el;
  };
  // (0.8.0) estilo do nome (como os do Discord, mais os do Aero): a fonte, o efeito e as cores (até 8 nos degradês). Os animados só se mexem no perfil, no
  // cartão de quem está aberto e com o mouse em cima (na lista e no chat ficam parados: nada gasta a placa à toa)
  U.FONTES_NOME = [['padrao', 'Padrão', 'Default'], ['arredondada', 'Arredondada', 'Rounded'], ['serifa', 'Serifa', 'Serif'], ['maquina', 'Máquina', 'Typewriter'], ['manuscrita', 'Manuscrita', 'Script'], ['grossa', 'Grossa', 'Heavy'], ['estreita', 'Estreita', 'Condensed'], ['pixel', 'Pixel', 'Pixel'], ['gotica', 'Gótica', 'Gothic'], ['elegante', 'Elegante', 'Elegant']];
  U.EFEITOS_NOME = [['solido', 'Sólido', 'Solid', 1], ['degrade', 'Degradê', 'Gradient', 2], ['neon', 'Neon', 'Neon', 1], ['desenho', 'Contorno', 'Outline', 1], ['pop', 'Pop', 'Pop', 2], ['gummy', 'Gummy', 'Gummy', 1], ['pulo', 'Pulo', 'Bounce', 1], ['elastico', 'Elástico', 'Rubber', 1], ['onda', 'Ondinha', 'Wave', 2],
    ['prisma', 'Prisma', 'Prism', 4], ['bolha', 'Bolha', 'Bubble', 2], ['aurora', 'Aurora', 'Aurora', 3], ['agua', 'Água', 'Water', 2], ['gelo', 'Gelo', 'Ice', 2], ['fogo', 'Fogo', 'Fire', 2], ['galaxia', 'Galáxia', 'Galaxy', 2], ['holograma', 'Holograma', 'Hologram', 3], ['glitch', 'Glitch', 'Glitch', 2], ['purpurina', 'Purpurina', 'Glitter', 1], ['brilho', 'Brilho', 'Shine', 1], ['diamante', 'Diamante', 'Diamond', 2]];
  U.NOME_EXCLUSIVOS = ['diamante']; // só com o Aero Bubble Donator ou Supporter (o servidor confere)
  U.ehDev = () => !!(A.api && A.api.eu && A.api.eu.cargo === 'dev'); // (1.0.0) desenvolvedor: nada travado
  U.temExclusivos = () => U.ehDev() || !!(A.api && A.api.eu && A.api.eu.bolha && A.api.eu.bolha.exclusivo);
  U.testesLiberados = () => U.ehDev() || !!(A.api && A.api.eu && A.api.eu.bolha && A.api.eu.bolha.testes); // (0.8.1) novidades em teste: só para o Supporter
  U.CORES_NOME_PADRAO = { solido: ['#2d9ee0'], degrade: ['#2d9ee0', '#9b6cff'], neon: ['#38e1ff'], desenho: ['#2d9ee0'], pop: ['#ffcf3f', '#e5473b'], gummy: ['#ff6fae'], pulo: ['#ffb02e'], elastico: ['#7c5cff'], onda: ['#38c8ff', '#ff6fae'], prisma: ['#ff5f6d', '#ffc371', '#47e3a0', '#4facfe'],
    bolha: ['#7fd3ff', '#1a7bc4'], aurora: ['#42f5b3', '#3fa9ff', '#b26cff'], agua: ['#5fd7ff', '#1767c9'], gelo: ['#e8fbff', '#7fc8ff'], fogo: ['#ffb000', '#e5261b'], galaxia: ['#7b3fe4', '#1a1f6b'], holograma: ['#9ffcff', '#ff9ff3', '#c1a3ff'], glitch: ['#2de2e6', '#ff2e63'], purpurina: ['#f5c542'], brilho: ['#f5c542'], diamante: ['#8fe3ff', '#5a6bff'] };
  // (0.8.0) os efeitos que se mexem podem ir no nome todo ou letra por letra (cada letra no seu tempo); a Ondinha é sempre por letra
  U.NOME_POR_LETRA = ['gummy', 'pulo', 'elastico', 'onda'];
  U.NOME_LEGADO = { entardecer: 'degrade', arcoiris: 'prisma', nebulosa: 'galaxia', ouro: 'purpurina' };
  // (0.8.0) os degradês de verdade: de 2 a 8 cores, a pessoa tira e põe quantas quiser
  U.NOME_LIVRE = ['degrade', 'onda', 'prisma', 'aurora', 'holograma']; U.NOME_MAX_CORES = 8;
  // (0.8.7) só os emojis de um texto (cada um com as variações de cor/pele/família/bandeira), na ordem
  U.emojisDe = (t) => { const eh = /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}]|[#*0-9]\uFE0F?\u20E3)/u, so = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]+$/u; return letras(String(t || '').replace(/\s+/g, '')).filter((g) => eh.test(g) && so.test(g)); };
  const letras = (t) => (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)].map((x) => x.segment) : [...t]);
  // os filtros de "líquido" (Água) e de chama (Fogo): o desenho das letras ondula de verdade. Só valem onde o nome está animado.
  let filtrosNome = false;
  const porFiltrosNome = () => {
    if (filtrosNome || !document.body) return; filtrosNome = true;
    const d = document.createElement('div');
    d.innerHTML = '<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>'
      + '<filter id="nm-agua" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.07" numOctaves="2" seed="3" result="t"><animate attributeName="baseFrequency" dur="5s" values="0.018 0.07;0.024 0.09;0.018 0.07" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="t" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter>'
      + '<filter id="nm-fogo" x="-15%" y="-220%" width="130%" height="340%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.045 0.11" numOctaves="2" seed="7" stitchTiles="stitch" x="0" y="-32" width="64" height="32" result="t"/><feOffset in="t" x="0" y="-32" width="64" height="32" result="a"><animate attributeName="dy" values="0;-2;-4;-6;-8;-10;-12;-14;-16;-18;-20;-22;-24;-26;-28;-30" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/></feOffset><feOffset in="t" x="0" y="-32" width="64" height="32" result="b"><animate attributeName="dy" values="32;30;28;26;24;22;20;18;16;14;12;10;8;6;4;2" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/></feOffset><feMerge x="0" y="-32" width="64" height="32" result="o"><feMergeNode in="a"/><feMergeNode in="b"/></feMerge><feTile in="o" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>'
      + '</defs></svg>';
    document.body.append(d.firstChild);
  };
  U.aplicarNome = (el, nm) => {
    if (!el) return el;
    const desfazLetras = () => { if (el.querySelector(':scope > .nm-l')) el.textContent = el.textContent; delete el.dataset.nmA; delete el.dataset.nmL; };
    if (!nm || ((!nm.f || nm.f === 'padrao') && (!nm.e || nm.e === 'solido') && !(nm.c || []).length)) { desfazLetras(); el.classList.remove('nm'); delete el.dataset.nmF; delete el.dataset.nmE; delete el.dataset.nmT; return el; }
    const e = U.NOME_LEGADO[nm.e] || nm.e || 'solido', base = U.CORES_NOME_PADRAO[e] || ['#2d9ee0']; // (0.9.6) os efeitos que saíram viram o parecido que ficou
    const cs = (nm.c || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
    const n = (U.EFEITOS_NOME.find((x) => x[0] === e) || [])[3] || 1;
    const lista = cs.length ? cs : base;
    const usa = n === 1 ? [lista[0]] : lista.length >= 2 ? lista : [lista[0], base[1] || lista[0]];
    el.classList.add('nm'); el.dataset.nmF = nm.f || 'padrao'; el.dataset.nmE = e;
    el.style.setProperty('--n1', usa[0]); el.style.setProperty('--n2', usa[1] || usa[0]); el.style.setProperty('--n3', usa[2] || usa[1] || usa[0]);
    el.style.setProperty('--ng', usa.length > 1 ? usa.join(', ') + ', ' + usa[0] : usa[0] + ', ' + usa[0]);
    el.style.setProperty('--nl', usa.length > 1 ? usa.join(', ') : usa[0] + ', ' + usa[0]);
    if (e === 'eletrico') { // (1.0.0) vários raios curtos (no jeito do raio de antes: a linha fina e torta), em alturas diferentes e com galhinhos, na cor dos raios (a 3ª); quem salvou com 2 cores fica com o branco de antes
      const rc = encodeURIComponent(/^#[0-9a-f]{6}$/i.test(cs[2] || '') ? cs[2] : '#ffffff');
      const raio = (linhas) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E${linhas.map(([p, w]) => `%3Cpolyline points='${p}' fill='none' stroke='${rc}' stroke-width='${w}' stroke-linejoin='bevel' vector-effect='non-scaling-stroke'/%3E`).join('')}%3C/svg%3E")`;
      el.style.setProperty('--nm-raio-a', raio([['0,6 4,3 7,8 11,2 15,7 19,4 24,9', 1.6], ['15,7 17,11 19,10', 1], ['36,15 40,11 43,17 47,12 51,18 55,13 60,16', 1.6], ['47,12 49,8', 1], ['72,9 76,13 79,6 83,12 87,5 91,11 96,8 100,10', 1.6], ['83,12 85,16 87,15', 1]]));
      el.style.setProperty('--nm-raio-b', raio([['8,14 12,18 16,12 20,17 25,11 29,15', 1.6], ['20,17 22,20', 1], ['44,5 48,9 52,3 56,8 60,2 64,7', 1.6], ['56,8 57,12 59,11', 1], ['78,16 82,12 85,18 89,13 94,17 98,12', 1.6], ['89,13 91,9', 1]]));
    }
    if (e === 'agua' || e === 'fogo') porFiltrosNome();
    // letra por letra: cada letra num <span> com a posição dela (--i) e onde fica entre a primeira e a última (--p, para as cores)
    const porLetra = e === 'onda' || e === 'gelo' || e === 'fogo' || e === 'digitar' || e === 'tinta' || e === 'pulsar' || (nm.a === 'letra' && U.NOME_POR_LETRA.includes(e)); // Gelo e Fogo: a neve e as chamas ficam em cada letra
    const texto = el.textContent;
    el.dataset.nmT = texto;
    if (porLetra && !el.querySelector(':scope > :not(.nm-l)')) {
      const ls = letras(texto), tot = Math.max(1, ls.length - 1);
      if (el.dataset.nmA !== 'letra' || el.dataset.nmL !== e || el.children.length !== ls.length) el.replaceChildren(...ls.map((c, i) => { const s = document.createElement('span'); s.className = 'nm-l'; s.textContent = c; s.dataset.k = /^\s+$/.test(c) ? 'e' : c === 't' ? 't' : /^[a-zà-öø-ÿ]$/.test(c) && !/[bdfhkl]/.test(c) ? 'x' : 'a'; /* espaço, letra baixa (x) ou alta: onde fica o topo da letra */ s.style.setProperty('--i', i); s.style.setProperty('--p', Math.round((i / tot) * 100) + '%'); return s; }));
      el.dataset.nmL = e;
      el.dataset.nmA = 'letra';
      if (e === 'onda') { // cada letra com a cor do ponto dela no degradê (com quantas cores houver)
        const rgb = usa.map((c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16))), L = el.children, nL = Math.max(1, L.length - 1);
        for (let i = 0; i < L.length; i++) { const t = (i / nL) * (rgb.length - 1), k = Math.min(rgb.length - 2, Math.floor(t)), f = t - k, a = rgb[k], b = rgb[k + 1] || a; L[i].style.setProperty('--lc', 'rgb(' + a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',') + ')'); }
      }
    } else desfazLetras();
    return el;
  };
  // (0.8.0) mudar o status sem abrir o perfil: no menu da conta, passando o mouse em "Status"
  U.mudarStatus = async (v, tirarPers) => {
    const API = A.api, T = A.T;
    try {
      const r = await API.req('status', tirarPers ? { estado: v, stc: null } : { estado: v }); if (API.eu) { API.eu.status = v; if (tirarPers) API.eu.stc = r.stc || null; } A.som.tocar('click');
      U.toast(v === 'invisivel' ? T('Off-line: para os amigos você aparece offline.', 'Offline: friends see you as offline.') : v === 'ausente' ? T('Você aparece como ausente.', 'You appear as away.') : v === 'ocupado' ? T('Não perturbe: nenhuma notificação chega (mensagens e amigos online ficam em silêncio).', 'Do not disturb: no notifications (messages and friends coming online stay silent).') : T('Você aparece online.', 'You appear online.'), { ms: 2600 });
      A.evt.emit('perfil'); U.atualizarVivos();
    } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
  };
  // (0.8.3) status personalizado: um texto de até 30 letras ("Jogando", "Fazendo live"...), a cor da bolinha e um ícone
  U.ICONES_STATUS = [['bolinha', 'Bolinha', 'Dot'], ['controle', 'Controle', 'Controller'], ['monitor', 'Monitor', 'Monitor'], ['codigo', 'Código', 'Code']];
  U.editorStatus = (aoSalvar) => {
    const API = A.api, T = A.T, eu = API.eu || {}, x0 = eu.stc || {};
    const st = { t: x0.t || '', c: /^#[0-9a-f]{6}$/i.test(x0.c || '') ? x0.c : '#2fbf71', i: x0.i === 'ocupado' ? 'codigo' : x0.i || 'bolinha', sn: !!x0.sn };
    const conta = h('small', { class: 'suave' }, '');
    const txt = h('input', { class: 'campo', maxlength: 30, placeholder: T('Ex.: Jogando, Fazendo live…', 'E.g.: Playing, Streaming…'), value: st.t, oninput: () => { st.t = txt.value; pintar(); } });
    const cor = h('input', { type: 'color', class: 'st-cor', value: st.c, title: T('Cor da bolinha', 'Dot color'), oninput: () => { st.c = cor.value; pintar(); } });
    const CORES = ['#2fbf71', '#2d9ee0', '#9b6cff', '#ff6fae', '#f0b400', '#ff8a3d', '#e5473b', '#1fb5b0'];
    const amostras = h('div', { class: 'linha st-cores' }, ...CORES.map((c) => h('button', { type: 'button', class: 'amostra', estilo: { background: c }, title: c, onclick: () => { st.c = c; cor.value = c; pintar(); } })), cor);
    const icones = h('div', { class: 'linha st-icones', role: 'radiogroup' });
    const previa = h('div', { class: 'linha st-previa' });
    let pintou = false, tocou = false; // tocou: a pessoa mexeu em algo desde o último salvar
    function pintar() {
      if (pintou) tocou = true; pintou = true;
      conta.textContent = st.t.length + '/30';
      icones.replaceChildren(...U.ICONES_STATUS.map(([id, pt, en]) => h('button', { type: 'button', role: 'radio', 'aria-checked': st.i === id ? 'true' : 'false', class: 'st-icone' + (st.i === id ? ' sel' : ''), title: T(pt, en), onclick: () => { st.i = id; pintar(); } },
        h('span', { class: 'st-ic i-' + id, estilo: { '--stc': st.c } }), h('span', {}, T(pt, en)))));
      previa.replaceChildren(h('span', { class: 'st-ic i-' + st.i, estilo: { '--stc': st.c } }), h('b', {}, st.t.trim() || U.textoEstado(eu.status === 'invisivel' ? 'offline' : eu.status || 'online')));
    }
    let base = JSON.stringify(x0.c ? { t: (x0.t || '').trim(), c: st.c, i: st.i, sn: st.sn } : null); // o que está salvo agora
    const atual = () => ({ t: st.t.trim(), c: st.c, i: st.i, sn: st.sn });
    const salvar = async (stc, quieto) => {
      try {
        const r = await API.req('status', { estado: (API.eu || eu).status || 'online', stc });
        if (API.eu) API.eu.stc = r.stc || null; base = JSON.stringify(stc ? { t: stc.t.trim(), c: stc.c, i: stc.i, sn: !!stc.sn } : null); tocou = false;
        if (!quieto) A.som.tocar('click');
        A.evt.emit('perfil'); U.atualizarVivos();
        if (!quieto) U.toast(stc ? T('Status personalizado salvo.', 'Custom status saved.') : T('Status personalizado tirado.', 'Custom status removed.'), { tipo: 'ok', ms: 2200 });
        if (aoSalvar && !quieto) aoSalvar();
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); if (quieto) throw e; }
    };
    pintar();
    // (0.8.5) mexeu no status e apertou "Salvar perfil" sem o "Salvar" daqui: o perfil salva o status junto (sem perguntar)
    const mudou = () => tocou && JSON.stringify(atual()) !== base;
    const el = h('div', { class: 'col st-editor', estilo: { gap: '8px' } },
      h('div', { class: 'linha', estilo: { gap: '8px' } }, h('div', { class: 'cresce' }, txt), conta),
      amostras, icones,
      h('label', { class: 'linha entre st-sn', estilo: { gap: '10px' } }, h('div', {}, h('div', {}, T('Sem notificações', 'No notifications')), h('small', { class: 'suave' }, T('Enquanto este status estiver ativo, mensagens e avisos chegam em silêncio.', 'While this status is on, messages and alerts arrive silently.'))), U.chave(st.sn, (v) => { st.sn = v; pintar(); })),
      h('div', { class: 'linha', estilo: { 'justify-content': 'space-between', gap: '8px', 'flex-wrap': 'wrap' } }, previa,
        h('div', { class: 'linha', estilo: { gap: '6px' } },
          U.btn(T('Tirar', 'Remove'), { tipo: 'sec', peq: true, onclick: () => salvar(null) }),
          U.btn(T('Salvar', 'Save'), { peq: true, onclick: () => salvar({ t: st.t, c: st.c, i: st.i, sn: st.sn }) }))));
    el.salvarPendente = () => (mudou() ? salvar({ t: st.t, c: st.c, i: st.i, sn: st.sn }, true) : Promise.resolve());
    return el;
  };
  U.abrirStatusPers = () => { let m = null; m = U.modal(A.T('Status personalizado', 'Custom status'), U.editorStatus(() => m && m.fechar()), { largura: '420px' }); };
  U.itemStatus = () => {
    const at = (A.api.eu || {}).status || 'online', T = A.T;
    // (0.8.5) com status personalizado, o menu mostra o texto, a cor e o ícone dele (como a pílula de cima). No submenu ele aparece
    // marcado (e não o "Online"): clicar abre a tela para mudar e o X tira, voltando para o status que estava antes (online, ausente...).
    // Escolher outro status da lista também tira o personalizado
    const x = U.statusPers((A.api.eu || {}).codigo);
    const op = (v, texto, ponto) => ({ texto, ponto, sel: !x && at === v, onclick: () => U.mudarStatus(v, !!x) });
    const pers = x
      ? { texto: x.t && x.t.trim() ? x.t.trim() : T('Status personalizado', 'Custom status'), stc: x, sel: true, onclick: () => U.abrirStatusPers(), tirar: () => U.tirarStatusPers(), tirarTitulo: T('Tirar o status personalizado', 'Remove custom status') }
      : { texto: T('Status personalizado…', 'Custom status…'), icone: 'lapis', onclick: () => U.abrirStatusPers() };
    return { texto: T('Status', 'Status') + ': ' + (x && x.t && x.t.trim() ? x.t.trim() : U.textoEstado(at === 'invisivel' ? 'offline' : at)), ponto: at === 'invisivel' ? 'offline' : at, stc: x || null, sub: [op('online', T('Online', 'Online'), 'online'), op('ausente', T('Ausente', 'Away'), 'ausente'), op('ocupado', T('Não perturbe', 'Do not disturb'), 'ocupado'), op('invisivel', T('Off-line (invisível)', 'Offline (invisible)'), 'offline'), null, pers] };
  };
  U.tirarStatusPers = async () => {
    const API = A.api;
    try {
      const r = await API.req('status', { estado: (API.eu || {}).status || 'online', stc: null });
      if (API.eu) API.eu.stc = r.stc || null; A.som.tocar('click');
      A.evt.emit('perfil'); U.atualizarVivos();
    } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
  };
  U.trocarConta = () => {
    const API = A.api, l = API.contas();
    const lista = h('div', { class: 'col', estilo: { gap: '8px' } });
    for (const c of l) {
      const atual = API.eu && c.codigo === API.eu.codigo;
      lista.append(h('div', { class: 'conta-salva' }, h('button', { type: 'button', class: 'conta-salva-ir' + (atual ? ' atual' : ''), disabled: atual || null, onclick: () => API.trocarConta(c.codigo) }, U.avatar(c, 40), h('div', { class: 'cresce' }, h('b', {}, c.nome), h('div', { class: 'peq suave' }, '#' + (c.tag || ''))), atual ? h('span', { class: 'pilula online' }, A.T('em uso', 'in use')) : null),
        atual ? null : U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: A.T('Tirar deste aparelho', 'Remove from this device'), onclick: (e) => { API.esquecerConta(c.codigo); e.currentTarget.closest('.conta-salva').remove(); } })));
    }
    if (l.length <= 1) lista.append(h('p', { class: 'peq suave', estilo: { margin: 0 } }, A.T('Nenhuma outra conta neste aparelho ainda.', 'No other accounts on this device yet.')));
    U.modal(A.T('Trocar de conta', 'Switch account'), [lista], { largura: 440, acoes: [{ texto: A.T('Adicionar conta', 'Add account'), icone: 'mais', onclick: () => API.adicionarConta() }] });
  };

  // ---------- menu do botão direito (0.5.9-5): uma bolha de vidro que se forma no ponto do clique, item por item ----------
  // itens: [{ texto, icone, perigo, onclick }] ou null (separador). Abre com o som de bolha se formando e fecha estourando.
  U.menuContexto = (ev, itens) => {
    // (0.6.0) aberto por um botão: clicar nele de novo fecha (antes o menu fechava no toque e o clique abria outra vez)
    const ancora = ev && (ev.ancora || (ev.type === 'click' && ev.currentTarget instanceof Element ? ev.currentTarget : null));
    if (U._menu) U._menu.fechar(true);
    if (ev && ev.preventDefault) ev.preventDefault();
    const x0 = ev && ev.clientX != null ? ev.clientX : innerWidth / 2, y0 = ev && ev.clientY != null ? ev.clientY : innerHeight / 2;
    let i = 0;
    // (0.8.0) item com "sub": abre um submenu ao lado quando o mouse passa por cima (ou com o clique / A do controle)
    let sub = null, subDe = null;
    const fecharSub = () => { if (sub) { const s0 = sub; s0.classList.add('estourando'); setTimeout(() => s0.remove(), 300); } sub = null; if (subDe) subDe.classList.remove('aberto'); subDe = null; };
    const abrirSub = (b, it) => {
      if (subDe === b) return; fecharSub(); subDe = b; b.classList.add('aberto');
      let j = 0;
      sub = h('div', { class: 'menu-ctx menu-sub vidro', role: 'menu' }, ...it.sub.map((si) => (!si ? h('div', { class: 'menu-sep' }) : h('button', { type: 'button', role: 'menuitem', class: 'menu-it' + (si.sel ? ' sel' : ''), estilo: { '--i': j++ }, dados: { mudo: '1' }, onclick: (e) => { e.stopPropagation(); fechar(true); try { si.onclick(); } catch (x) { A.log.erro('menu', x); } } }, si.stc ? h('span', { class: 'menu-ponto st-ic i-' + (si.stc.i === 'ocupado' ? 'codigo' : si.stc.i || 'bolinha'), estilo: { '--stc': si.stc.c } }) : si.ponto ? h('span', { class: 'menu-ponto st-' + si.ponto }) : si.icone ? A.icone(si.icone, 16) : h('span', { class: 'menu-ic-vazio' }), h('span', { class: si.tirar ? 'cresce' : null }, si.texto),
        // (0.8.5) item com um X do lado (ex.: tirar o status personalizado)
        si.tirar ? h('span', { class: 'menu-tirar', role: 'button', tabindex: '-1', title: si.tirarTitulo || '', 'aria-label': si.tirarTitulo || '', onclick: (e) => { e.stopPropagation(); fechar(true); try { si.tirar(); } catch (x) { A.log.erro('menu', x); } } }, A.icone('fechar', 12)) : si.sel ? A.icone('check', 14) : null))));
      document.body.append(sub);
      sub.querySelectorAll('.menu-it').forEach((x) => x.addEventListener('pointerenter', () => A.som.tocar('menu-item')));
      const rb = b.getBoundingClientRect(), w = sub.offsetWidth, hh = sub.offsetHeight;
      const x = rb.right + 6 + w <= innerWidth - 8 ? rb.right + 6 : Math.max(8, rb.left - 6 - w);
      Object.assign(sub.style, { left: x + 'px', top: Math.max(8, Math.min(rb.top - 6, innerHeight - hh - 8)) + 'px', transformOrigin: (x > rb.left ? '0 ' : '100% ') + '12px' });
      if (document.documentElement.dataset.entrada === 'pad') { const f = sub.querySelector('.menu-it'); if (f) f.focus(); }
    };
    const el = h('div', { class: 'menu-ctx vidro', role: 'menu' }, ...itens.map((it) => {
      if (!it) return h('div', { class: 'menu-sep' });
      const b = h('button', { type: 'button', role: 'menuitem', class: 'menu-it' + (it.perigo ? ' perigo' : '') + (it.sub ? ' tem-sub' : ''), estilo: { '--i': i++ }, onclick: (e) => { e.stopPropagation(); if (it.sub) { abrirSub(b, it); return; } fechar(true); try { it.onclick(); } catch (x) { A.log.erro('menu', x); } } }, it.stc ? h('span', { class: 'menu-ponto st-ic i-' + (it.stc.i === 'ocupado' ? 'codigo' : it.stc.i || 'bolinha'), estilo: { '--stc': it.stc.c } }) : it.ponto ? h('span', { class: 'menu-ponto st-' + it.ponto }) : it.icone ? A.icone(it.icone, 16) : h('span', { class: 'menu-ic-vazio' }), h('span', {}, it.texto), it.sub ? A.icone('chevron', 14) : null);
      b.addEventListener('pointerenter', () => { if (it.sub) abrirSub(b, it); else if (sub) fecharSub(); });
      return b;
    }));
    // (0.5.9-7) cada opção que o mouse ou o controle alcança faz um "tic" de vidro
    el.querySelectorAll('.menu-it').forEach((b) => { b.dataset.mudo = '1'; const tic = () => A.som.tocar('menu-item'); b.addEventListener('pointerenter', tic); b.addEventListener('focus', tic); });
    document.body.append(el);
    // (0.7.0) o tamanho de verdade (offsetWidth/Height): o getBoundingClientRect pegava o menu ainda encolhido pela animação de abrir, e um
    // menu perto da borda passava da tela. Como no Discord: ele sobe (ou vai para a esquerda) o quanto precisar, e se for mais alto que a tela, rola
    el.style.maxHeight = (innerHeight - 16) + 'px'; if (el.scrollHeight > innerHeight - 16) el.style.overflowY = 'auto'; // rola só se for mesmo maior que a tela (antes a barra aparecia à toa)
    const r = { width: el.offsetWidth, height: el.offsetHeight };
    const x = Math.min(x0, innerWidth - r.width - 8), y = Math.min(y0, innerHeight - r.height - 8);
    Object.assign(el.style, { left: Math.max(8, x) + 'px', top: Math.max(8, y) + 'px', transformOrigin: (x0 - x) + 'px ' + (y0 - y) + 'px' });
    A.som.tocar('menu-abrir');
    let fechado = false;
    function fechar(semSom) {
      if (fechado) return; fechado = true; U._menu = null; fecharSub();
      document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', tecla, true); removeEventListener('blur', fecharJa); removeEventListener('resize', fecharJa);
      setTimeout(() => document.removeEventListener('click', cliqueAncora, true), porAncora ? 600 : 0); // fechou tocando no botão: o clique que vem depois não reabre
      if (!semSom) A.som.tocar('menu-fechar');
      el.classList.add('estourando'); setTimeout(() => el.remove(), 380);
    }
    const fecharJa = () => fechar();
    let porAncora = false;
    const fora = (e) => { if (!el.contains(e.target) && !(sub && sub.contains(e.target))) { porAncora = !!(ancora && ancora.contains(e.target)); fechar(); } };
    const cliqueAncora = (e) => { if (ancora && ancora.contains(e.target)) { e.stopPropagation(); e.preventDefault(); document.removeEventListener('click', cliqueAncora, true); fechar(); } };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (sub) { const b = subDe; fecharSub(); if (b) b.focus(); } else fechar(); } };
    setTimeout(() => { document.addEventListener('click', cliqueAncora, true); document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true); addEventListener('blur', fecharJa); addEventListener('resize', fecharJa); const b = el.querySelector('.menu-it'); if (b && document.documentElement.dataset.entrada === 'pad') b.focus(); }, 0);
    U._menu = { fechar, ancora };
    return U._menu;
  };

  // ---------- popover: painel de vidro ancorado a um botão (abre para cima na barra da sala) ----------
  // Mosaico: caixas em colunas que se encaixam (cada uma vai para a coluna mais baixa), com o mesmo espaço entre todas.
  // Quantas colunas cabem depende da largura (refaz quando a janela muda). Caixas com a classe "larga" ocupam a largura toda.
  U.mosaico = (itens, { min = 430 } = {}) => {
    const raiz = h('div', { class: 'mosaico' }), lista = itens.filter(Boolean);
    let n = 0;
    // (0.6.0) mede TODAS as caixas de uma vez (numa coluna escondida da mesma largura) e depois distribui pela soma das alturas. Antes cada
    // caixa colocada obrigava o navegador a refazer o layout para medir as colunas: era o tranco ao abrir as Configurações.
    const montar = () => {
      const w = raiz.clientWidth; if (!w) return;
      const nn = Math.max(1, Math.floor((w + 14) / (min + 14)));
      if (nn === n && raiz.childElementCount) return;
      n = nn; raiz.textContent = '';
      const largCol = (w - 14 * (n - 1)) / n;
      const medida = h('div', { class: 'mosaico-col', estilo: { position: 'absolute', visibility: 'hidden', width: largCol + 'px', left: '-99999px', top: '0' } });
      raiz.append(medida);
      lista.forEach((it) => medida.append(it)); // (1.0.0) as largas também: medidas na largura de uma coluna, para saber se cabem num buraco
      const altura = new Map(lista.map((it) => [it, it.offsetHeight])); // um layout só
      medida.remove();
      let cols = null, alts = null;
      for (const it of lista) {
        if (it.classList.contains('larga')) {
          // (1.0.0) nada de espaço vazio: se a coluna mais baixa tem um buraco onde a caixa larga cabe, ela entra ali em vez de descer inteira
          if (cols && cols.length > 1) {
            let k = 0; for (let i = 1; i < cols.length; i++) if (alts[i] < alts[k]) k = i;
            if (Math.max(...alts) - alts[k] >= altura.get(it) * 0.6) { cols[k].append(it); alts[k] += altura.get(it) + 14; continue; }
          }
          raiz.append(it); cols = null; continue;
        }
        if (!cols) {
          // (1.0.0) um bloco com menos caixas que colunas usa só as colunas que vai encher (nada de coluna vazia ao lado)
          let qtd = 0; for (let j = lista.indexOf(it); j < lista.length && !lista[j].classList.contains('larga'); j++) qtd++;
          const nb = Math.max(1, Math.min(n, qtd));
          cols = Array.from({ length: nb }, () => h('div', { class: 'mosaico-col' })); alts = new Array(nb).fill(0); raiz.append(h('div', { class: 'mosaico-bloco', estilo: { 'grid-template-columns': `repeat(${nb}, minmax(0, 1fr))` } }, ...cols));
        }
        let k = 0; for (let i = 1; i < cols.length; i++) if (alts[i] < alts[k]) k = i;
        cols[k].append(it); alts[k] += altura.get(it) + 14;
      }
    };
    if (window.ResizeObserver) new ResizeObserver(montar).observe(raiz); else { raiz.append(...lista); }
    return raiz;
  };

  U.popover = (ancora, conteudo, { largura = 340, aoFechar, titulo } = {}) => {
    if (U._pop) U._pop.fechar();
    let raiz = document.getElementById('popovers');
    if (!raiz) { raiz = h('div', { id: 'popovers' }); document.body.append(raiz); }
    const el = h('div', { class: 'pop vidro', role: 'dialog' }, titulo ? h('div', { class: 'pop-titulo' }, titulo) : null, h('div', { class: 'col pop-corpo' }, conteudo));
    let fechado = false;
    const posicionar = () => {
      const r = ((ancora.closest && ancora.closest('.par, .cham-par')) || ancora).getBoundingClientRect(), w = Math.min(largura, innerWidth - 16); // centraliza na cápsula inteira (botão + setinha)
      el.style.width = w + 'px';
      el.style.left = A.limitar(r.left + r.width / 2 - w / 2, 8, Math.max(8, innerWidth - w - 8)) + 'px';
      const acima = r.top > innerHeight * 0.45;
      if (acima) { el.style.bottom = Math.max(8, innerHeight - r.top + 10) + 'px'; el.style.top = 'auto'; el.style.maxHeight = Math.max(160, r.top - 24) + 'px'; el.dataset.lado = 'cima'; }
      else { el.style.top = r.bottom + 10 + 'px'; el.style.bottom = 'auto'; el.style.maxHeight = Math.max(160, innerHeight - r.bottom - 24) + 'px'; el.dataset.lado = 'baixo'; }
    };
    const fechar = () => {
      if (fechado) return; fechado = true;
      document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', tecla, true); removeEventListener('resize', posicionar);
      setTimeout(() => document.removeEventListener('click', cliqueAncora, true), 0);
      el.classList.add('fechando'); setTimeout(() => el.remove(), 200); A.som.tocar('pop-fechar');
      if (U._pop === api) U._pop = null;
      try { ancora.setAttribute('aria-expanded', 'false'); } catch (e) { /* ok */ }
      aoFechar && aoFechar();
    };
    const fora = (e) => { if (!el.contains(e.target) && !(ancora.contains && ancora.contains(e.target))) fechar(); };
    // (0.6.0) clicar de novo no botão que abriu fecha (o clique não chega ao botão, então ele não abre outra vez)
    const cliqueAncora = (e) => { if (ancora.contains && ancora.contains(e.target)) { e.stopPropagation(); e.preventDefault(); fechar(); } };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true); addEventListener('resize', posicionar);
    setTimeout(() => { if (!fechado) document.addEventListener('click', cliqueAncora, true); }, 0);
    raiz.append(el); posicionar();
    try { ancora.setAttribute('aria-expanded', 'true'); } catch (e) { /* ok */ }
    A.som.tocar('pop-abrir');
    const api = { fechar, el, posicionar, ancora };
    U._pop = api;
    return api;
  };

  // Tela cheia de UM elemento (o palco da chamada, por exemplo): só ele aparece. As janelinhas das setinhas, as janelas e os avisos vivem
  // fora dele, então eles entram junto enquanto durar a tela cheia (e voltam para o lugar ao sair). Antes ficavam invisíveis.
  document.addEventListener('fullscreenchange', () => {
    const fe = document.fullscreenElement;
    const raizes = ['popovers', 'modais', 'toasts'].map((id) => document.getElementById(id)).filter(Boolean);
    for (const r of raizes) { if (fe && fe !== document.documentElement && fe !== document.body) { if (r.parentNode !== fe) fe.append(r); } else if (r.parentNode !== document.body) document.body.append(r); }
  });
  // ---------- idioma da tela e relógio de tela cheia ----------
  U.tela = {
    cheia() { const e = document.documentElement; return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    alternar(el = document.documentElement) {
      const f = el.requestFullscreen || el.webkitRequestFullscreen;
      if (U.tela.cheia()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else if (f) f.call(el).catch(() => {});
    },
  };
  // (0.8.7) toda lista de escolher (<select>) abre num menu de vidro do Aero em vez da lista do sistema/Electron.
  // O <select> continua no lugar (value, change e opções de sempre), só a lista que abre é nossa: nada do código que usa muda.
  (function menuSelect() {
    const h = A.h; let aberto = null;
    const fechar = (foco) => {
      if (!aberto) return; const { el, sel, offs } = aberto; aberto = null;
      offs.forEach((f) => f()); el.classList.add('fechando'); setTimeout(() => el.remove(), 180);
      sel.classList.remove('sel-aberto'); try { sel.setAttribute('aria-expanded', 'false'); } catch (e) { /* ok */ }
      if (foco) sel.focus({ preventScroll: true });
    };
    const escolher = (sel, v) => {
      fechar(true);
      if (sel.value === v) return;
      sel.value = v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
      try { A.som.tocar('bolha'); } catch (e) { /* ok */ }
    };
    const abrir = (sel) => {
      if (aberto) { const era = aberto.sel; fechar(); if (era === sel) return; }
      const ops = [...sel.options].filter((op) => !op.hidden);
      if (!ops.length) return;
      const itens = ops.map((op) => h('button', { type: 'button', role: 'option', class: 'sel-op' + (op.selected ? ' marcada' : ''), disabled: op.disabled || null, 'aria-selected': op.selected ? 'true' : 'false',
        onclick: (e) => { e.stopPropagation(); escolher(sel, op.value); } }, h('span', { class: 'sel-op-txt' }, op.textContent), h('i', { class: 'sel-op-ok' })));
      const el = h('div', { class: 'sel-menu vidro', role: 'listbox' }, itens);
      document.body.append(el);
      const r = sel.getBoundingClientRect(), w = Math.min(Math.max(r.width, 180), innerWidth - 16);
      el.style.minWidth = w + 'px'; el.style.maxWidth = Math.max(w, Math.min(360, innerWidth - 16)) + 'px';
      el.style.left = A.limitar(r.left, 8, Math.max(8, innerWidth - el.offsetWidth - 8)) + 'px';
      const baixo = innerHeight - r.bottom - 12, cima = r.top - 12, pra = baixo >= Math.min(el.scrollHeight, 260) || baixo >= cima;
      if (pra) { el.style.top = r.bottom + 6 + 'px'; el.style.maxHeight = Math.max(120, baixo) + 'px'; el.dataset.lado = 'baixo'; }
      else { el.style.bottom = innerHeight - r.top + 6 + 'px'; el.style.maxHeight = Math.max(120, cima) + 'px'; el.dataset.lado = 'cima'; }
      const atual = el.querySelector('.marcada') || itens.find((b) => !b.disabled);
      if (atual) { atual.scrollIntoView({ block: 'nearest' }); atual.focus({ preventScroll: true }); }
      const fora = (e) => { if (!el.contains(e.target) && e.target !== sel) fechar(); };
      const tecla = (e) => {
        if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); fechar(true); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
          e.preventDefault(); e.stopPropagation();
          const vivos = itens.filter((b) => !b.disabled), i = vivos.indexOf(document.activeElement);
          const n = e.key === 'Home' ? 0 : e.key === 'End' ? vivos.length - 1 : A.limitar(i + (e.key === 'ArrowDown' ? 1 : -1), 0, vivos.length - 1);
          if (vivos[n]) vivos[n].focus();
        }
      };
      const rolar = (e) => { if (!el.contains(e.target)) fechar(); };
      document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true);
      addEventListener('resize', () => fechar(), { once: true }); document.addEventListener('scroll', rolar, true);
      aberto = { el, sel, offs: [() => document.removeEventListener('pointerdown', fora, true), () => document.removeEventListener('keydown', tecla, true), () => document.removeEventListener('scroll', rolar, true)] };
      sel.classList.add('sel-aberto'); try { sel.setAttribute('aria-expanded', 'true'); } catch (e) { /* ok */ }
      try { A.som.tocar('pop-abrir'); } catch (e) { /* ok */ }
    };
    const alvo = (e) => { const s = e.target && e.target.closest ? e.target.closest('select') : null; return s && !s.disabled && !s.multiple && s.size <= 1 ? s : null; };
    // mousedown/pointerdown impedidos: a lista do sistema não chega a abrir
    document.addEventListener('mousedown', (e) => { const s = alvo(e); if (!s || e.button !== 0) return; e.preventDefault(); s.focus({ preventScroll: true }); abrir(s); }, true);
    document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && alvo(e)) e.preventDefault(); }, true);
    document.addEventListener('click', (e) => { const s = alvo(e); if (!s) return; e.preventDefault(); if (e.pointerType && e.pointerType !== 'mouse' && !(aberto && aberto.sel === s)) abrir(s); }, true);
    document.addEventListener('keydown', (e) => {
      const s = alvo(e); if (!s || (aberto && aberto.sel === s)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) { e.preventDefault(); abrir(s); }
    }, true);
  })();
})();
