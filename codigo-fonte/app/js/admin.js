// Aero Stream - equipe: aba DESENVOLVEDOR (só a conta do desenvolvedor) e aba MODERAÇÃO (moderadores), insígnias ao lado do nome,
// avisos da equipe (resposta de denúncia/feedback, suspensão) e o "Denunciar". O servidor decide quem pode o quê (servidor/src/admin.js):
// a interface só mostra. Desenvolvedor: vê IDs e IPs, dá cargo de moderador e insígnias, bloqueia por IP/aparelho e lê os feedbacks.
// Moderador: bane e silencia pela #, lê e responde denúncias. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, U = A.ui, API = A.api;
  const ADM = (A.admin = {});

  // ---------- insígnias (ao lado do nome, no perfil, no chat...) ----------
  // (0.8.0) sl: os selos oficiais (desenvolvedor, moderador e o plano do Aero Bubble), cada um com o seu ícone; vêm antes das insígnias
  // (0.8.0) desenhos cheios (brancos, com uma sombrinha) por cima da bolinha de vidro colorida: leem bem mesmo pequenos
  const SELOS = {
    dev: { pt: 'Desenvolvedor do Aero', en: 'Aero developer', svg: '<path fill="#fff" d="M8.6 6.3a1.2 1.2 0 0 1 0 1.7L4.6 12l4 4a1.2 1.2 0 1 1-1.7 1.7l-4.85-4.85a1.2 1.2 0 0 1 0-1.7L6.9 6.3a1.2 1.2 0 0 1 1.7 0zm6.8 0a1.2 1.2 0 0 1 1.7 0l4.85 4.85a1.2 1.2 0 0 1 0 1.7L17.1 17.7a1.2 1.2 0 1 1-1.7-1.7l4-4-4-4a1.2 1.2 0 0 1 0-1.7zM13.6 4.1a1.2 1.2 0 0 1 .8 1.5l-3.6 13.2a1.2 1.2 0 1 1-2.3-.6l3.6-13.2a1.2 1.2 0 0 1 1.5-.9z"/>' },
    mod: { pt: 'Moderador oficial', en: 'Official moderator', svg: '<path fill="#fff" d="M12 2.2 4.2 5.3v6c0 4.9 3.3 8.9 7.8 10.5 4.5-1.6 7.8-5.6 7.8-10.5v-6z"/><path fill="none" stroke="#1d8a4c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m8.4 12.1 2.5 2.5 4.8-5"/>' },
    standard: { pt: 'Aero Bubble Standard', en: 'Aero Bubble Standard', svg: '<circle cx="12" cy="12.5" r="7.6" fill="#fff" fill-opacity=".92"/><ellipse cx="9.6" cy="9.4" rx="2.6" ry="1.6" fill="#3aa6e8" fill-opacity=".55" transform="rotate(-30 9.6 9.4)"/>' },
    plus: { pt: 'Aero Bubble Plus', en: 'Aero Bubble Plus', svg: '<circle cx="10" cy="13.6" r="6.6" fill="#fff" fill-opacity=".92"/><circle cx="18.2" cy="6.4" r="3.2" fill="#fff" fill-opacity=".92"/><path stroke="#16958a" stroke-width="2.3" stroke-linecap="round" d="M10 10.6v6M7 13.6h6"/>' },
    // (0.8.1) a insígnia exclusiva do Donator: uma coroa com um diamante; a do Supporter: um coração
    donator: { pt: 'Aero Bubble Donator', en: 'Aero Bubble Donator', svg: '<path fill="#fff" d="M3.2 8.2 7.6 11.4 12 4.6l4.4 6.8 4.4-3.2-1.6 9.6H4.8z"/><rect x="4.8" y="18.4" width="14.4" height="2.2" rx="1.1" fill="#fff"/><path fill="#7c3aed" fill-opacity=".75" d="M12 10.6l2.2 2.4L12 16.2 9.8 13z"/><circle cx="3.2" cy="8.2" r="1.3" fill="#fff"/><circle cx="20.8" cy="8.2" r="1.3" fill="#fff"/><circle cx="12" cy="4.2" r="1.3" fill="#fff"/>' },
    supporter: { pt: 'Aero Bubble Supporter', en: 'Aero Bubble Supporter', svg: '<path fill="#fff" d="M12 20.6 4.2 13.2A4.9 4.9 0 0 1 12 6.9a4.9 4.9 0 0 1 7.8 6.3z"/><ellipse cx="8.6" cy="9.8" rx="1.6" ry="1" fill="#e11d48" fill-opacity=".35" transform="rotate(-35 8.6 9.8)"/>' },
    // (1.0.2) quem testou o Aero desde o começo: um frasco de laboratório com bolhas (o selo é dado pelo servidor, pelo ID da conta)
    tester: { pt: 'Tester Oficial do Aero', en: 'Official Aero Tester', svg: '<path fill="#fff" d="M9 2.8h6a.9.9 0 0 1 0 1.8h-.6v4.1l4.9 8.4a2.3 2.3 0 0 1-2 3.5H6.7a2.3 2.3 0 0 1-2-3.5l4.9-8.4V4.6H9a.9.9 0 0 1 0-1.8z"/><path fill="#3f6212" fill-opacity=".55" d="M7.6 14.6h8.8l1.7 2.9a.8.8 0 0 1-.7 1.2H6.6a.8.8 0 0 1-.7-1.2z"/><circle cx="10.6" cy="16.6" r="1" fill="#fff"/><circle cx="13.6" cy="15.6" r=".7" fill="#fff"/><circle cx="12.4" cy="11.6" r=".6" fill="#3f6212" fill-opacity=".6"/>' },
    fundador: { pt: 'Fundador 1.0: apoiou o Aero no lançamento', en: 'Founder 1.0: supported Aero at launch', svg: '<path fill="#fff" d="M5 20.5h14v-2H5zM6.5 17h11l1.5-9-4 3-3-6-3 6-4-3z"/><text x="12" y="15" text-anchor="middle" font-size="5.5" font-weight="900" fill="#1e3a8a">1.0</text>' },
  };
  // (1.0.0) fidelidade: 1, 2, 3 e 6 meses (uma luazinha com o número) e 1, 2, 3, 4, 5, 7, 8, 9 e 10 anos (louros com o número; a partir de 5 anos
  // ganha uma estrela em cima). A cor vai ficando mais nobre a cada faixa (o desenho do fundo está no CSS, em .selo-fielN)
  const NUM = (n, y, f) => `<text x="12" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${f}" font-weight="900" fill="#fff">${n}</text>`;
  const LUA = '<path fill="#fff" fill-opacity=".92" d="M13.4 2.4a3.6 3.6 0 1 0 2.9 5.9 2.9 2.9 0 1 1-2.9-5.9z"/>';
  const FOLHAS = [[7.6, 19.6, -62], [5.3, 16.6, -36], [4.4, 12.9, -12], [4.9, 9.2, 14]];
  const LOUROS = (cor) => FOLHAS.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry="2.5" fill="${cor}" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${24 - x}" cy="${y}" rx="1.3" ry="2.5" fill="${cor}" transform="rotate(${-r} ${24 - x} ${y})"/>`).join('');
  const ESTRELA = '<path fill="#fff" d="M12 1.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/>';
  for (const m of [1, 2, 3, 6]) SELOS['fiel' + m] = { pt: m === 1 ? 'Apoia há 1 mês' : `Apoia há ${m} meses seguidos`, en: m === 1 ? 'Supporter for 1 month' : `Supporter for ${m} months in a row`, svg: LUA + NUM(m, 19.6, 11) };
  for (const a of [1, 2, 3, 4, 5, 7, 8, 9, 10]) SELOS['fiel' + a * 12] = { pt: a === 1 ? 'Apoia há 1 ano seguido' : `Apoia há ${a} anos seguidos`, en: a === 1 ? 'Supporter for 1 year in a row' : `Supporter for ${a} years in a row`,
    svg: LOUROS(a === 9 ? '#fcd34d' : 'rgba(255,255,255,.9)') + (a >= 5 ? ESTRELA : '') + NUM(a, a >= 10 ? 16.4 : 16.6, a >= 10 ? 8.5 : 10.5) };
  U.nomeSelo = (x) => SELOS[x] ? A.T(SELOS[x].pt, SELOS[x].en) : '';
  U.selos = (sl) => {
    const l = (Array.isArray(sl) ? sl : []).filter((x, i, a) => SELOS[x] && a.indexOf(x) === i);
    if (!l.length) return null;
    return h('span', { class: 'selos' }, ...l.map((x) => { const d = SELOS[x], t = A.T(d.pt, d.en), el = h('span', { class: 'selo-of selo-' + x, title: t, role: 'img', 'aria-label': t }); el.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' + d.svg + '</svg>'; return el; }));
  };
  // (1.0.2) os selos junto do nome (no chat): só os que a pessoa deixou aparecendo no perfil. O servidor já filtra os dos outros; o seu vem completo
  U.selosVisiveis = (p) => { const sl = (p && p.sl) || [], pf = (p && p.pf) || {}; if (pf.si === false) return []; return Array.isArray(pf.so) && pf.so.length ? sl.filter((x) => !pf.so.includes('s:' + x)) : sl; };
  // (1.0.0) cada insígnia e cada selo tem uma chave ("s:" + selo, "i:" + texto); "oc" é a lista das que a pessoa escondeu do perfil
  U.chaveIns = (x) => 'i:' + String((x && x.t) || '').slice(0, 40);
  U.insignias = (lista, sl, oc) => {
    if (Array.isArray(oc) && oc.length) { lista = (Array.isArray(lista) ? lista : []).filter((x) => !oc.includes(U.chaveIns(x))); sl = (Array.isArray(sl) ? sl : []).filter((x) => !oc.includes('s:' + x)); }
    const selos = U.selos(sl), tem = Array.isArray(lista) && lista.length;
    if (!tem && !selos) return null;
    return h('span', { class: 'insignias' }, selos, ...(tem ? lista.slice(0, 4) : []).map((x) => h('span', { class: 'insignia', estilo: { background: x.c2 ? `linear-gradient(135deg, ${x.c1}, ${x.c2})` : x.c1, color: x.ct || '#fff' } }, x.t)));
  };

  // ---------- avisos da equipe ----------
  // (0.5.9-6) o aviso só conta como lido quando a pessoa FECHA a janela; até lá ele volta sempre que o app abre (em qualquer aparelho).
  // Fechou num aparelho: os outros fecham o mesmo aviso sozinhos.
  // (0.8.2) todos os avisos numa janela só: cada um numa linha que abre e fecha, com a data e a hora em que foi mandado. O mais novo
  // vem aberto; os outros, fechados (um clique abre). Aviso novo com a janela aberta entra na lista, sem abrir outra janela.
  // Fechar a janela marca como lidos todos os que estavam nela.
  const pendentes = new Map(); // id -> aviso
  const expandidos = new Set();
  let janela = null, listaEl = null, contaEl = null, saindo = false;
  const jeito = (tipo) => ({
    alerta: ['atencao', T('Alerta', 'Alert'), 'atencao'], aviso: ['alerta', T('Aviso da moderação', 'Moderation warning'), 'escudo'], // alerta: bug ou aviso geral; aviso: infração
    ban: ['alerta', T('Conta suspensa', 'Account suspended'), 'bloquear'], mudo: ['atencao', T('Mensagens bloqueadas', 'Messages blocked'), 'atencao'],
    denuncia: ['normal', T('Sua denúncia', 'Your report'), 'escudo'], feedback: ['normal', T('Seu feedback', 'Your feedback'), 'chat'],
    cargo: ['normal', T('Novo cargo', 'New role'), 'coroa'], bolha: ['normal', 'Aero Bubble', 'coracao'],
  }[tipo] || ['normal', T('Mensagem do desenvolvedor', 'Message from the developer'), 'sino']);
  const quandoAv = (t) => new Date(t).toLocaleString(A.idioma && A.idioma() === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pintarAvisos = () => {
    if (!listaEl) return;
    const lista = [...pendentes.values()].sort((a, b) => b.t - a.t), varios = lista.length > 1;
    contaEl.textContent = varios ? T(lista.length + ' avisos', lista.length + ' notices') : '';
    listaEl.replaceChildren(...lista.map((av) => {
      const [cor, titulo, ic] = jeito(av.tipo), aberto = !varios || expandidos.has(av.id);
      const it = h('div', { class: 'av-item av-' + cor + (aberto ? ' aberto' : '') });
      const cab = h('button', { type: 'button', class: 'av-cab', 'aria-expanded': aberto ? 'true' : 'false', disabled: !varios, onclick: () => { if (expandidos.has(av.id)) expandidos.delete(av.id); else expandidos.add(av.id); A.som.tocar(expandidos.has(av.id) ? 'menu-abrir' : 'menu-fechar'); pintarAvisos(); } },
        h('span', { class: 'av-ic', 'aria-hidden': 'true' }, A.icone(ic, 18)),
        h('span', { class: 'av-tit' }, h('b', {}, titulo), h('small', {}, quandoAv(av.t))),
        !aberto ? h('span', { class: 'av-prev' }, av.texto) : null,
        varios ? h('span', { class: 'av-seta', 'aria-hidden': 'true' }, A.icone('chevron', 16)) : null);
      it.append(cab, h('div', { class: 'av-corpo', hidden: !aberto }, h('p', { class: 'selecionavel' }, av.texto)));
      return it;
    }));
  };
  const fecharAvisos = () => {
    const ids = [...pendentes.keys()], cargo = [...pendentes.values()].some((a) => a.tipo === 'cargo');
    pendentes.clear(); expandidos.clear(); janela = null; listaEl = null;
    if (saindo) { saindo = false; return; } // fechou porque foram lidos em outro aparelho
    if (ids.length) API.req('avisos/lido', { ids }).catch(() => {});
    if (cargo) setTimeout(() => A.api.recarregar(), 600);
  };
  const mostrarAviso = (av) => {
    if (!av || !av.id || pendentes.has(av.id)) return;
    pendentes.set(av.id, av);
    const maisNovo = [...pendentes.values()].every((x) => x.t <= av.t);
    if (maisNovo) { expandidos.clear(); expandidos.add(av.id); } // o que acabou de chegar vem aberto; os outros se recolhem
    A.som.tocar('msg');
    if (janela) { pintarAvisos(); return; }
    listaEl = h('div', { class: 'av-lista' }); contaEl = h('span', { class: 'peq suave' });
    janela = U.modal(T('Avisos da equipe', 'Team notices'), h('div', { class: 'col', estilo: { gap: '8px' } }, contaEl, listaEl),
      { largura: 500, prioridade: true, classe: 'av-modal', acoes: [{ texto: T('Entendi', 'Got it'), valor: true }], aoFechar: fecharAvisos });
    pintarAvisos();
  };
  ADM.verAvisos = async () => {
    try {
      const { avisos } = await API.req('avisos');
      (avisos || []).forEach(mostrarAviso);
    } catch (e) { /* ok */ }
  };
  A.evt.on('hub:aviso-admin', (av) => mostrarAviso(av));
  A.evt.on('hub:aviso-lido', (e) => { // lidos em outro aparelho: saem da lista (e a janela fecha se ficou vazia)
    let mudou = false; (e.ids || []).forEach((id) => { if (pendentes.delete(id)) { expandidos.delete(id); mudou = true; } });
    if (!mudou || !janela) return;
    if (!pendentes.size) { saindo = true; janela.fechar(); } else pintarAvisos();
  });
  // (0.8.3) os feedbacks que o desenvolvedor ainda não leu: as bolinhas (na aba, no tipo e na pessoa) e um som quando chega um novo
  ADM.fb = { n: 0, porTipo: {}, porPessoa: {} };
  const fbMudou = (r) => { ADM.fb = { n: r.n || 0, porTipo: r.porTipo || {}, porPessoa: r.porPessoa || {} }; A.evt.emit('fb:novos', ADM.fb); };
  ADM.contarFb = async () => { if (!API.eu || API.eu.cargo !== 'dev') return; try { fbMudou(await API.req('admin/feedbacks-novos')); } catch (e) { /* ok */ } };
  A.evt.on('hub:fb-novos', (r) => { fbMudou(r); if (r.novo) A.som.tocar('feedback-novo'); });
  A.evt.on('hub:eu', () => { if (API.token && API.eu) { ADM.verAvisos(); ADM.contarFb(); } }); // reconectou (ou abriu em outro aparelho): o que ficou sem fechar aparece de novo
  // (0.6.0) e de tempos em tempos (com o app aberto): a resposta da equipe aparece mesmo se o aviso ao vivo se perdeu
  // (1.0.0) a cada 30 min (era a cada minuto): o normal é o aviso chegar ao vivo pela conexão, e ao reconectar ele é conferido de novo
  setInterval(() => { if (API.token && API.eu && !document.hidden) ADM.verAvisos(); }, 30 * 60000);
  // suspensa: avisa e sai da conta (a tela de entrar mostra o motivo se tentar de novo)
  let avisouBan = false;
  A.evt.on('conta:banida', (d) => {
    if (avisouBan) return; avisouBan = true;
    const b = d.banido || {};
    U.modal(T('Conta suspensa', 'Account suspended'), h('p', {}, T('Sua conta foi suspensa pela equipe do Aero', 'Your account was suspended by the Aero team') + (b.ate ? T(' até ', ' until ') + new Date(b.ate).toLocaleString() : T(' por tempo indeterminado', ' indefinitely')) + (b.motivo ? '. ' + T('Motivo: ', 'Reason: ') + b.motivo : '.')), { largura: 460, acoes: [{ texto: 'OK', valor: true }], aoFechar: () => { avisouBan = false; } });
    if (API.token) { API.definirToken(''); A.hub.fechar(); setTimeout(() => A.api.recarregar(), 4000); }
  });

  // ---------- denunciar (perfil, menu do botão direito) ----------
  ADM.denunciar = (p) => {
    const motivo = h('textarea', { class: 'campo', rows: 4, maxlength: 1000, placeholder: T('O que aconteceu? (a equipe lê tudo)', 'What happened? (the team reads everything)') });
    U.modal(T('Denunciar ', 'Report ') + p.nome, [h('p', { class: 'peq suave', estilo: { 'margin-top': 0 } }, T('A denúncia vai para a equipe do Aero; a pessoa não fica sabendo quem denunciou. Você recebe a resposta aqui no app.', 'The report goes to the Aero team; the person does not learn who reported. You get the answer here in the app.')), motivo], {
      largura: 480, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Enviar denúncia', 'Send report'), tipo: 'perigo', valor: true }],
      aoFechar: async (v) => { if (!v) return; try { await API.req('denunciar', { nome: p.nome, tag: p.tag, motivo: motivo.value }); U.toast(T('Denúncia enviada. Obrigado por ajudar!', 'Report sent. Thanks for helping!'), { tipo: 'ok' }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } },
    });
    setTimeout(() => motivo.focus(), 200);
  };

  // ---------- aba Desenvolvedor / Moderação ----------
  const DURACOES = () => ([[3600000, T('1 hora', '1 hour')], [86400000, T('1 dia', '1 day')], [7 * 86400000, T('7 dias', '7 days')], [30 * 86400000, T('30 dias', '30 days')], [0, T('Sem prazo', 'Indefinite')]]);
  const quando = (t) => (t ? new Date(t).toLocaleString() : T('sem prazo', 'indefinite'));
  const sel = (lista, val) => { const s = h('select', { class: 'campo' }, lista.map(([v, r]) => h('option', { value: String(v) }, r))); if (val != null) s.value = String(val); return s; };
  const secao = (titulo, ...filhos) => h('section', { class: 'vidro pad col adm-secao', estilo: { gap: '10px' } }, titulo ? h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, titulo) : null, ...filhos);
  // some com a animação e o som de bolha estourando
  const estourar = (el) => { A.som.tocar('estourar-equipe'); el.classList.add('estourando'); setTimeout(() => el.remove(), 420); };
  // a pessoa já leu (fechou) a resposta?
  const lidaEm = (r) => h('span', { class: 'pilula adm-lida' + (r.lido ? ' sim' : '') }, r.lido ? T('✓ lida ', '✓ read ') + new Date(r.lido).toLocaleString() : T('ainda não lida', 'not read yet'));

  function aba(el, dev) {
    el.append(h('div', { class: 'cab' }, h('h2', {}, dev ? T('Desenvolvedor', 'Developer') : T('Moderação', 'Moderation')), h('span', { class: 'suave' }, dev ? T('Tudo da equipe; só você vê os IDs', 'Everything for the team; only you see IDs') : T('Banir, silenciar e responder denúncias', 'Ban, mute and answer reports'))));
    // --- buscar e agir numa conta ---
    const busca = h('input', { class: 'campo', placeholder: dev ? T('ID (12 caracteres) ou #', 'ID (12 characters) or #') : '#tag', spellcheck: 'false' });
    const ficha = h('div', { class: 'col', estilo: { gap: '10px' } });
    let fichaAlvo = null;
    const buscar = async (silencioso) => {
      const corpo = silencioso === true ? fichaAlvo : (() => { const v = busca.value.trim(); return !v ? null : /^[0-9a-f]{12}$/i.test(v) && dev ? { uid: v } : { tag: v.replace(/^#/, '') }; })();
      if (!corpo) return;
      // recarregando sozinho: não refaz a ficha enquanto você escreve um motivo nela
      if (silencioso === true && ficha.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      try { const { conta } = await API.req('admin/buscar', corpo); fichaAlvo = corpo; pintarFicha(conta, corpo); } catch (e) { if (silencioso === true) return; fichaAlvo = null; ficha.textContent = ''; ficha.append(h('p', { class: 'msg erro' }, e.message)); }
    };
    busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
    function pintarFicha(c, alvo) {
      ficha.textContent = '';
      const agir = async (rota, extra = {}) => { try { const r = await API.req('admin/' + rota, { ...alvo, ...extra }); A.som.tocar('sucesso'); U.toast(T('Feito.', 'Done.'), { tipo: 'ok', ms: 2000 }); if (r.conta) pintarFicha(r.conta, alvo); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
      const info = h('div', { class: 'adm-ficha' },
        h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '8px' } }, U.avatar(c, 52), h('div', { class: 'cresce' }, h('b', {}, c.nome), ' ', h('span', { class: 'tag' }, '#' + c.tag), ' ', U.insignias(c.ins, c.sl), c.cargo ? h('span', { class: 'pilula', estilo: { background: c.cargo === 'dev' ? '#8a63e0' : '#1fb6a6', 'margin-left': '6px' } }, c.cargo === 'dev' ? T('desenvolvedor', 'developer') : T('moderador', 'moderator')) : null,
          h('div', { class: 'peq suave selecionavel' }, (dev && c.uid ? 'ID ' + c.uid + ' · ' : '') + T('código ', 'code ') + c.codigo + ' · ' + T('conta de ', 'since ') + new Date(c.criado || 0).toLocaleDateString())),
          U.btn(T('Abrir perfil', 'Open profile'), { icone: 'pessoa', tipo: 'sec', peq: true, onclick: () => A.perfil && A.perfil.ver(c.codigo) })),
        c.ban ? h('div', { class: 'msg erro' }, T('Suspensa até: ', 'Suspended until: ') + quando(c.ban.ate) + (c.ban.motivo ? ' — ' + c.ban.motivo : '')) : null,
        c.mudo ? h('div', { class: 'msg erro' }, T('Silenciada até: ', 'Muted until: ') + quando(c.mudo.ate) + (c.mudo.motivo ? ' — ' + c.mudo.motivo : '')) : null,
        dev ? h('div', { class: 'peq suave selecionavel' }, 'IPs: ' + ((c.ips || []).join(', ') || '—'), h('br'), T('Aparelhos: ', 'Devices: ') + ((c.hws || []).map((x) => x.slice(0, 12)).join(', ') || '—')) : null);
      // banir
      const durB = sel(DURACOES(), 86400000), motB = h('input', { class: 'campo', placeholder: T('Motivo', 'Reason'), maxlength: 300 });
      const ip = h('input', { type: 'checkbox' }), hw = h('input', { type: 'checkbox' });
      const banir = h('div', { class: 'col adm-acao', estilo: { gap: '6px' } }, h('b', {}, T('Banir', 'Ban')), h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '6px' } }, durB, motB),
        dev ? h('div', { class: 'linha', estilo: { gap: '14px', 'flex-wrap': 'wrap' } }, h('label', { class: 'linha', estilo: { gap: '6px' } }, ip, T('Bloquear também o IP', 'Also block the IP')), h('label', { class: 'linha', estilo: { gap: '6px' } }, hw, T('Bloquear também o aparelho', 'Also block the device'))) : null,
        h('div', { class: 'linha', estilo: { gap: '6px' } }, U.btn(T('Banir', 'Ban'), { tipo: 'perigo', peq: true, onclick: async () => { if (await U.confirmar(T('Banir ', 'Ban ') + c.nome + '?', { perigo: true })) agir('banir', { dur: +durB.value, motivo: motB.value, ip: ip.checked, hw: hw.checked }); } }), c.ban ? U.btn(T('Desbanir', 'Unban'), { tipo: 'sec', peq: true, onclick: () => agir('desbanir') }) : null));
      // silenciar
      const durS = sel(DURACOES(), 3600000), motS = h('input', { class: 'campo', placeholder: T('Motivo', 'Reason'), maxlength: 300 });
      const silenciar = h('div', { class: 'col adm-acao', estilo: { gap: '6px' } }, h('b', {}, T('Bloquear o chat (não manda mensagem para ninguém)', 'Block chat (cannot message anyone)')), h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '6px' } }, durS, motS),
        h('div', { class: 'linha', estilo: { gap: '6px' } }, U.btn(T('Silenciar', 'Mute'), { tipo: 'perigo', peq: true, onclick: () => agir('silenciar', { dur: +durS.value, motivo: motS.value }) }), c.mudo ? U.btn(T('Tirar o silêncio', 'Unmute'), { tipo: 'sec', peq: true, onclick: () => agir('dessilenciar') }) : null));
      ficha.append(info, banir, silenciar);
      if (dev) {
        ficha.append(h('div', { class: 'col adm-acao', estilo: { gap: '6px' } }, h('b', {}, T('Cargo', 'Role')), h('div', { class: 'linha', estilo: { gap: '6px' } }, c.cargo === 'mod' ? U.btn(T('Tirar moderador', 'Remove moderator'), { tipo: 'sec', peq: true, onclick: () => agir('cargo', { cargo: '' }) }) : U.btn(T('Tornar moderador', 'Make moderator'), { peq: true, onclick: () => agir('cargo', { cargo: 'mod' }) }))));
        // (0.8.2) mandar um aviso para a pessoa: notificação normal (para ler), alerta (bug ou aviso geral) ou aviso (infração)
        const avTxt = h('textarea', { class: 'campo', rows: 3, maxlength: 1000, placeholder: T('Escreva o aviso para ', 'Write the notice to ') + c.nome + '...' });
        let avNivel = 'normal';
        const avSeg = U.seg(NIVEIS_AVISO(), 'normal', (v) => { avNivel = v; });
        avSeg.classList.add('quebra');
        ficha.append(h('div', { class: 'col adm-acao', estilo: { gap: '6px' } }, h('b', {}, T('Enviar aviso', 'Send notice')), avSeg, avTxt,
          h('div', { class: 'linha', estilo: { gap: '6px' } }, U.btn(T('Enviar', 'Send'), { icone: 'enviar', peq: true, onclick: async () => { if (!avTxt.value.trim()) { U.toast(T('Escreva o aviso.', 'Write the notice.'), { tipo: 'erro' }); return; } await agir('aviso', { texto: avTxt.value, nivel: avNivel }); } }))));
        // (0.8.0) o selo de moderador sem o cargo (só o ícone ao lado do nome). Quem é moderador já tem o selo sozinho
        ficha.append(h('div', { class: 'col adm-acao', estilo: { gap: '6px' } }, h('b', {}, T('Selo de moderador (só o ícone, sem o cargo)', 'Moderator badge (icon only, no role)')),
          c.cargo === 'mod' ? h('div', { class: 'peq suave' }, T('Moderadores já têm o selo.', 'Moderators already have the badge.'))
            : h('div', { class: 'linha', estilo: { gap: '6px' } }, c.seloMod ? U.btn(T('Tirar o selo', 'Remove badge'), { tipo: 'sec', peq: true, onclick: () => agir('selo-mod', { sim: false }) }) : U.btn(T('Dar o selo', 'Give badge'), { peq: true, onclick: () => agir('selo-mod', { sim: true }) }))));
        ficha.append(editorInsignias(c, (ins) => agir('insignias', { ins })));
        // (0.7.14) Aero Bubble: dar o plano (PIX, por exemplo), renovar ou tirar
        const b = c.bolha || {}, planos = (A.apoio && A.apoio.PLANOS) || [];
        const sel = h('select', { class: 'campo', estilo: { width: 'auto' } }, h('option', { value: '' }, T('Sem plano', 'No plan')), ...planos.map((p) => h('option', { value: p.id, selected: b.plano === p.id }, p.nome + ' (R$ ' + p.preco + ')')));
        const tempo = escolherTempo();
        ficha.append(h('div', { class: 'col adm-acao', estilo: { gap: '6px' } },
          h('b', {}, 'Aero Bubble'),
          h('div', { class: 'peq suave' }, b.plano ? (planos.find((p) => p.id === b.plano) || {}).nome + (b.ate ? T(' até ', ' until ') + new Date(b.ate).toLocaleString() : T(' sem prazo', ' no limit')) : T('Sem plano.', 'No plan.')),
          h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, sel, tempo.el,
            U.btn(T('Presentear', 'Gift'), { icone: 'coracao', peq: true, onclick: () => { if (!sel.value) { U.toast(T('Escolha um plano.', 'Pick a plan.'), { tipo: 'erro' }); return; } agir('bolha', { plano: sel.value, ms: tempo.ms(), texto: tempo.texto(), presente: true }); } }),
            // (0.8.2) o PIX que caiu direto no Nubank: dá o plano e entra no painel de Assinaturas
            dev ? U.btn(T('Recebi no PIX Nubank', 'Got it via Nubank PIX'), { icone: 'pix', tipo: 'sec', peq: true, onclick: () => { if (!sel.value) { U.toast(T('Escolha um plano.', 'Pick a plan.'), { tipo: 'erro' }); return; } const p = planos.find((x) => x.id === sel.value); agir('bolha', { plano: sel.value, ms: tempo.ms(), pago: { via: 'nubank', valor: p ? p.preco : 0 } }); } }) : null,
            b.plano ? U.btn(T('Tirar plano', 'Remove plan'), { tipo: 'sec', peq: true, onclick: () => agir('bolha', { plano: '' }) }) : null),
          // (0.8.5) doação sem plano que caiu direto no Nubank (o Nubank não avisa o app): entra no caixa, o plano não muda
          dev ? (() => {
            const v = h('input', { class: 'campo', type: 'number', min: 0.01, step: 0.01, placeholder: 'R$', estilo: { width: '96px' }, 'aria-label': T('Valor da doação', 'Donation amount') });
            return h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap', 'align-items': 'center' } }, v,
              U.btn(T('Registrar doação no PIX Nubank', 'Record Nubank PIX donation'), { icone: 'pix', tipo: 'sec', peq: true, onclick: () => { const n = Math.round(parseFloat(String(v.value).replace(',', '.')) * 100) / 100; if (!(n > 0)) { U.toast(T('Escreva o valor.', 'Enter the amount.'), { tipo: 'erro' }); return; } agir('doacao', { valor: n, via: 'nubank' }); v.value = ''; } }));
          })() : null));
      }
    }
    // (0.8.0) quanto tempo dura o presente: minutos, horas, dias, meses, anos ou sem prazo
    function escolherTempo() {
      const UN = { min: [60000, T('minutos', 'minutes')], h: [3600000, T('horas', 'hours')], d: [86400000, T('dias', 'days')], mes: [30 * 86400000, T('meses', 'months')], ano: [365 * 86400000, T('anos', 'years')], sempre: [0, T('sem prazo', 'no limit')] };
      const UM = { min: T('minuto', 'minute'), h: T('hora', 'hour'), d: T('dia', 'day'), mes: T('mês', 'month'), ano: T('ano', 'year') };
      const n = h('input', { class: 'campo', type: 'number', min: 1, max: 100000, value: 1, estilo: { width: '84px' }, 'aria-label': T('Quanto tempo', 'How long') });
      const un = h('select', { class: 'campo', estilo: { width: 'auto' } }, ...Object.entries(UN).map(([k, [, r]]) => h('option', { value: k, selected: k === 'mes' }, r)));
      un.addEventListener('change', () => { n.hidden = un.value === 'sempre'; });
      const qtd = () => Math.max(1, Math.round(+n.value || 1));
      return { el: h('span', { class: 'linha', estilo: { gap: '6px' } }, n, un), ms: () => (un.value === 'sempre' ? 0 : qtd() * UN[un.value][0]), texto: () => (un.value === 'sempre' ? '' : qtd() + ' ' + (qtd() === 1 ? UM[un.value] : UN[un.value][1])) };
    }
    const blocoConta = secao(T('Contas', 'Accounts'), h('div', { class: 'linha', estilo: { gap: '6px' } }, busca, U.btn(T('Buscar', 'Search'), { icone: 'lupa', peq: true, onclick: () => buscar() })), ficha);
    // --- denúncias e (só dev) feedback: listas que ficam guardadas no servidor ---
    // (0.5.9-6) as listas se atualizam sozinhas: o servidor avisa a equipe quando chega denúncia/feedback, quando alguém responde e quando a
    // pessoa lê a resposta (e, por garantia, a cada 30 s). Cada item igual fica como está (não perde o texto que você está escrevendo nem
    // se fecha); só o que mudou é trocado.
    const listas = [];
    const lista = (rota, titulo, pintar, filtro = null) => {
      const corpo = h('div', { class: 'col adm-lista', estilo: { gap: '8px' } });
      const det = h('details', { class: 'mais adm-det', open: '' }, h('summary', {}, titulo, ' ', h('span', { class: 'selo adm-n' }, '…')), filtro ? filtro.el : null, corpo);
      let ultimos = [];
      // (0.8.1) o filtro (feedback: lidos/não lidos e o tipo) só esconde: a lista continua a mesma
      const filtrar = () => { if (!filtro) return; if (filtro.arrumar && ultimos.length) filtro.arrumar(corpo, ultimos, (id) => feitos.get(id).el); let n = 0; for (const [id, x] of feitos) { const it = ultimos.find((i) => i.id === id); const ok = !it || filtro.passa(it); x.el.hidden = !ok; if (ok && it) n++; } det.querySelector('.adm-n').textContent = n === ultimos.length ? String(n) : n + '/' + ultimos.length; };
      if (filtro) { filtro.aoMudar = filtrar; filtro.recarregar = () => carregar(); }
      const feitos = new Map(); // id -> { sig, el }
      let carregando = false;
      const carregar = async () => {
        if (carregando) return; carregando = true;
        try {
          const { itens } = await API.req('admin/' + rota);
          det.querySelector('.adm-n').textContent = itens.length; ultimos = itens;
          const novos = itens.map((it) => {
            const sig = JSON.stringify(it), ja = feitos.get(it.id);
            if (ja && ja.sig === sig) return ja.el;
            const el = pintar(it, carregar);
            if (ja) { // mudou: leva junto o que estava aberto e o que estava escrito
              if (ja.el.open) el.open = true;
              const t0 = ja.el.querySelector('textarea'), t1 = el.querySelector('textarea');
              if (t0 && t1 && t0.value && !it.resposta) t1.value = t0.value;
            }
            feitos.set(it.id, { sig, el });
            return el;
          });
          for (const [id, x] of feitos) if (!itens.some((it) => it.id === id)) { feitos.delete(id); x.el.remove(); }
          [...corpo.children].forEach((e) => { if (!novos.includes(e)) e.remove(); });
          if (!itens.length) corpo.append(h('p', { class: 'suave peq' }, T('Nada por aqui. 🫧', 'Nothing here. 🫧')));
          if (filtro && filtro.arrumar && itens.length) filtro.arrumar(corpo, itens, (id) => feitos.get(id).el); // (0.8.2) os grupos por pessoa
          else novos.forEach((e, i) => { if (corpo.children[i] !== e) corpo.insertBefore(e, corpo.children[i] || null); });
          filtrar();
        } catch (e) { corpo.textContent = ''; feitos.clear(); corpo.append(h('p', { class: 'msg erro' }, e.message)); }
        carregando = false;
      };
      carregar(); listas.push(carregar);
      return det;
    };
    const denuncia = (r, recarregar) => {
      const resp = h('textarea', { class: 'campo', rows: 2, maxlength: 1000, placeholder: T('Resposta para quem denunciou (ex.: obrigado!)', 'Answer to the reporter (e.g. thank you!)') });
      const punida = h('input', { type: 'checkbox' });
      const el = h('details', { class: 'adm-item bolha-item' + (r.estado === 'respondida' ? ' ok' : '') },
        h('summary', {}, h('b', {}, r.deNome), ' #' + r.deTag, dev && r.deUid ? h('span', { class: 'peq suave' }, ' · ID ' + r.deUid) : null, T(' denunciou ', ' reported '), h('b', {}, r.alvoNome || '?'), r.alvoTag ? ' #' + r.alvoTag : '', dev && r.alvoUid ? h('span', { class: 'peq suave' }, ' · ID ' + r.alvoUid) : null, h('span', { class: 'peq suave' }, ' · ' + new Date(r.t).toLocaleString())),
        h('p', { class: 'selecionavel', estilo: { 'white-space': 'pre-wrap' } }, r.motivo),
        r.resposta ? h('div', { class: 'peq suave' }, T('Respondida: ', 'Answered: ') + (r.resposta.texto || '—') + (r.resposta.banido ? T(' (punida)', ' (punished)') : ''), ' ', lidaEm(r.resposta)) : null,
        h('div', { class: 'col', estilo: { gap: '6px' } }, resp, h('label', { class: 'linha', estilo: { gap: '6px' } }, punida, T('A pessoa denunciada foi punida', 'The reported person was punished')),
          h('div', { class: 'linha', estilo: { gap: '6px' } }, r.alvoTag ? U.btn(T('Abrir a conta', 'Open account'), { tipo: 'sec', peq: true, onclick: () => { busca.value = dev && r.alvoUid ? r.alvoUid : '#' + r.alvoTag; buscar(); blocoConta.scrollIntoView({ behavior: 'smooth' }); } }) : null,
            U.btn(T('Responder', 'Answer'), { peq: true, onclick: async () => { try { await API.req('admin/denuncia/responder', { id: r.id, texto: resp.value, banido: punida.checked }); U.toast(T('Resposta enviada.', 'Answer sent.'), { tipo: 'ok' }); recarregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }),
            U.btn(T('Apagar', 'Delete'), { tipo: 'perigo', peq: true, onclick: async () => { try { await API.req('admin/denuncia/apagar', { id: r.id }); estourar(el); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }))));
      return el;
    };
    const feedback = (f, recarregar) => {
      const resp = h('textarea', { class: 'campo', rows: 2, maxlength: 1000, placeholder: T('Responder (a pessoa recebe no app)', 'Answer (they get it in the app)') });
      const el = h('details', { class: 'adm-item bolha-item' + (f.estado === 'respondida' ? ' ok' : '') + (f.lido === false ? ' nao-lido' : '') },
        h('summary', {}, f.lido === false ? h('span', { class: 'adm-novo', title: T('Não lido', 'Unread') }) : null, h('span', { class: 'pilula', estilo: { background: { bug: '#e5473b', ideia: '#2d7fe0', elogio: '#3fae2a' }[f.tipo] || '#8a9ba8' } }, f.tipo), f.sub ? h('span', { class: 'pilula fb-subp' }, SUBS_BUG()[f.sub] || f.sub) : null, f.anexos && f.anexos.length ? h('span', { class: 'peq suave', title: T('Anexos', 'Attachments') }, ' 📎' + f.anexos.length) : null, ' ', h('b', {}, f.deNome), ' #' + f.deTag, f.deUid ? h('span', { class: 'peq suave' }, ' · ID ' + f.deUid) : null, h('span', { class: 'peq suave' }, ' · ' + new Date(f.t).toLocaleString())),
        h('p', { class: 'selecionavel', estilo: { 'white-space': 'pre-wrap' } }, f.texto),
        f.anexos && f.anexos.length ? anexosFb(f.anexos) : null,
        f.diag ? h('details', { class: 'mais adm-diag' }, h('summary', {}, T('Relatório de diagnóstico', 'Diagnostic report')), h('div', { class: 'linha', estilo: { gap: '6px', margin: '6px 0' } }, U.btn(T('Copiar', 'Copy'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(f.diag, e.currentTarget) })), h('pre', { class: 'selecionavel adm-diag-txt' }, f.diag)) : null,
        f.resposta ? h('div', { class: 'peq suave' }, T('Respondido: ', 'Answered: ') + f.resposta.texto, ' ', lidaEm(f.resposta)) : null,
        h('div', { class: 'col', estilo: { gap: '6px' } }, resp, h('div', { class: 'linha', estilo: { gap: '6px' } },
          U.btn(T('Responder', 'Answer'), { peq: true, onclick: async () => { try { await API.req('admin/feedback/responder', { id: f.id, texto: resp.value }); U.toast(T('Resposta enviada.', 'Answer sent.'), { tipo: 'ok' }); recarregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }),
          U.btn(f.lido === false ? T('Marcar como lido', 'Mark as read') : T('Marcar como não lido', 'Mark as unread'), { tipo: 'sec', peq: true, onclick: async () => { try { await API.req('admin/feedback/lido', { id: f.id, lido: f.lido === false }); recarregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }),
          U.btn(T('Remover', 'Remove'), { tipo: 'perigo', peq: true, onclick: async () => { try { await API.req('admin/feedback/apagar', { id: f.id }); estourar(el); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }))));
      // abrir um não lido marca como lido
      el.addEventListener('toggle', () => { if (el.open && f.lido === false) { f.lido = true; el.classList.remove('nao-lido'); const b = el.querySelector('.adm-novo'); if (b) b.remove(); API.req('admin/feedback/lido', { id: f.id, lido: true }).then(recarregar).catch(() => {}); } });
      return el;
    };
    // (0.8.2) os anexos do feedback: só carregam quando o feedback é aberto (vêm com o token, por isso viram um endereço local)
    const tamanho = (n) => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
    const anexosFb = (lista) => {
      const cx = h('div', { class: 'fb-galeria' });
      let feito = false;
      const carregar = () => {
        if (feito) return; feito = true;
        for (const a of lista) {
          const cel = h('div', { class: 'fb-midia' }, h('span', { class: 'peq suave' }, T('Carregando…', 'Loading…')));
          cx.append(cel);
          fetch(`${API.servidor}/api/admin/feedback-anexo/${a.id}`, { headers: { Authorization: 'Bearer ' + API.token } }).then(async (r) => {
            if (!r.ok) throw new Error(T('Anexo não encontrado.', 'Attachment not found.'));
            const url = URL.createObjectURL(await r.blob()), nome = a.nome || a.id;
            const midia = /^image\//.test(a.mime) ? h('img', { src: url, alt: nome, loading: 'lazy', onclick: () => window.open(url, '_blank') })
              : /^video\//.test(a.mime) ? h('video', { src: url, controls: true, preload: 'metadata' })
              : h('audio', { src: url, controls: true, preload: 'metadata' });
            cel.replaceChildren(midia, h('div', { class: 'linha entre peq' }, h('span', { class: 'suave fb-anexo-nome' }, nome + ' · ' + tamanho(a.tam)), h('a', { href: url, download: nome, class: 'link' }, T('Baixar', 'Download'))));
          }).catch((e) => cel.replaceChildren(h('span', { class: 'msg erro peq' }, e.message)));
        }
      };
      requestAnimationFrame(() => { const d = cx.closest('details'); if (!d) return carregar(); if (d.open) carregar(); d.addEventListener('toggle', () => { if (d.open) carregar(); }); });
      return cx;
    };
    const SUBS_BUG = () => ({ chat: T('chat', 'chat'), transmissao: T('transmissão', 'streaming'), interface: T('interface', 'interface'), conexao: T('conexão', 'connection'), outros: T('outros', 'other') });
    // (0.8.1) filtro dos feedbacks: todos, não lidos ou lidos, e o tipo (ideia, problema, elogio, outro)
    function filtroFeedback() {
      const f = { estado: 'todos', tipo: 'todos', sub: 'todos', pessoa: '', agrupar: true, aoMudar: null };
      const mudou = () => { if (f.aoMudar) f.aoMudar(); };
      const est = U.seg([['todos', T('Todos', 'All')], ['nao', T('Não lidos', 'Unread')], ['lidos', T('Lidos', 'Read')]], 'todos', (v) => { f.estado = v; mudou(); });
      const tipo = U.seg([['todos', T('Todos os tipos', 'All types')], ['ideia', T('Ideias', 'Ideas')], ['bug', T('Problemas', 'Bugs')], ['elogio', T('Elogios', 'Praise')], ['outro', T('Outros', 'Other')]], 'todos', (v) => { f.tipo = v; sub.hidden = v !== 'bug'; mudou(); });
      // (0.8.2) no "Problemas", onde foi; e por pessoa (com os de uma mesma pessoa juntos, abrindo e fechando)
      const sub = U.seg([['todos', T('Todos os problemas', 'All bugs')], ...Object.entries(SUBS_BUG()).map(([k, r]) => [k, r[0].toUpperCase() + r.slice(1)])], 'todos', (v) => { f.sub = v; mudou(); });
      sub.hidden = true;
      const pessoa = h('select', { class: 'campo fb-pessoa', estilo: { width: 'auto' }, 'aria-label': T('Pessoa', 'Person') }, h('option', { value: '' }, T('Todas as pessoas', 'Everyone')));
      pessoa.addEventListener('change', () => { f.pessoa = pessoa.value; mudou(); });
      const agrupar = h('label', { class: 'linha peq', estilo: { gap: '6px' } }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { f.agrupar = e.target.checked; mudou(); } }), T('Juntar os da mesma pessoa', 'Group by person'));
      est.classList.add('quebra'); tipo.classList.add('quebra'); sub.classList.add('quebra');
      // (0.8.3) limpar os já lidos (todos, ou só os da pessoa escolhida): ficam só os não lidos
      const limparLidos = async (de, nome) => {
        if (!(await U.confirmar(de ? T('Apagar os feedbacks já lidos de ' + nome + '? Ficam só os não lidos.', 'Delete the read feedback from ' + nome + '? Only unread ones stay.') : T('Apagar todos os feedbacks já lidos? Ficam só os não lidos.', 'Delete all read feedback? Only unread ones stay.'), { perigo: true, sim: T('Limpar', 'Clear') }))) return;
        try { const r = await API.req('admin/feedback/limpar-lidos', de ? { de } : {}); A.som.tocar('estourar-equipe'); U.toast(r.apagados ? T('Limpei ' + r.apagados + '.', 'Cleared ' + r.apagados + '.') : T('Nenhum lido para limpar.', 'No read ones to clear.'), { tipo: 'ok', ms: 2200 }); if (f.recarregar) f.recarregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      };
      f.limparLidos = limparLidos;
      const btLimpar = U.btn(T('Limpar os lidos', 'Clear read'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => { const x = f.pessoa && pessoa.selectedOptions[0]; limparLidos(f.pessoa, x ? x.dataset.nome : ''); } });
      f.el = h('div', { class: 'col adm-filtro', estilo: { gap: '6px', margin: '8px 0' } }, est, tipo, sub, h('div', { class: 'linha', estilo: { gap: '10px', 'flex-wrap': 'wrap' } }, pessoa, agrupar, h('span', { class: 'cresce' }), btLimpar));
      // as bolinhas nos tipos (quantos não lidos de cada)
      const TIPOS = ['todos', 'ideia', 'bug', 'elogio', 'outro'];
      const pontos = () => { const pt = (ADM.fb && ADM.fb.porTipo) || {}; [...tipo.querySelectorAll('button')].forEach((b, i) => { const n = TIPOS[i] === 'todos' ? (ADM.fb && ADM.fb.n) || 0 : pt[TIPOS[i]] || 0; let p = b.querySelector('.adm-novo'); if (n && !p) b.append(p = h('span', { class: 'adm-novo adm-novo-seg' })); if (p) { p.hidden = !n; p.title = n + T(' não lidos', ' unread'); } }); };
      f.pontos = pontos; pontos();
      const offPt = A.evt.on('fb:novos', () => { if (!f.el.isConnected) { if (f.vivo) offPt(); return; } f.vivo = true; pontos(); });
      f.passa = (it) => (f.tipo === 'todos' || it.tipo === f.tipo) && (f.tipo !== 'bug' || f.sub === 'todos' || it.sub === f.sub) && (!f.pessoa || it.de === f.pessoa) && (f.estado === 'todos' || (f.estado === 'nao' ? it.lido === false : it.lido !== false));
      // a lista de pessoas (com quantos de cada) e os grupos
      const grupos = new Map(); // de -> { el, corpo, cab }
      f.arrumar = (corpo, itens, elDe) => {
        const contas = new Map(); for (const it of itens) { const x = contas.get(it.de) || { nome: it.deNome, tag: it.deTag, n: 0, nao: 0 }; x.n++; if (it.lido === false) x.nao++; contas.set(it.de, x); }
        const atual = pessoa.value;
        pessoa.replaceChildren(h('option', { value: '' }, T('Todas as pessoas', 'Everyone') + ' (' + itens.length + ')'), ...[...contas].sort((a, b) => b[1].nao - a[1].nao || b[1].n - a[1].n || a[1].nome.localeCompare(b[1].nome)).map(([id, x]) => h('option', { value: id, selected: id === atual, 'data-nome': x.nome }, (x.nao ? '● ' : '') + x.nome + ' #' + x.tag + ' (' + x.n + (x.nao ? T(', ' + x.nao + ' novos', ', ' + x.nao + ' new') : '') + ')')));
        pontos();
        if (atual && !contas.has(atual)) { f.pessoa = ''; pessoa.value = ''; }
        const topo = [];
        const porPessoa = new Map(); for (const it of itens) { if (!porPessoa.has(it.de)) porPessoa.set(it.de, []); porPessoa.get(it.de).push(it); }
        const usados = new Set();
        for (const it of itens) {
          const dele = porPessoa.get(it.de), el = elDe(it.id);
          if (!f.agrupar || dele.length < 2) { topo.push(el); continue; }
          if (usados.has(it.de)) continue; usados.add(it.de);
          let g = grupos.get(it.de);
          if (!g) { g = { corpo: h('div', { class: 'col fb-grupo-corpo', estilo: { gap: '8px' } }), cab: h('summary', {}), acoes: h('div', { class: 'linha fb-grupo-acoes' }) }; g.el = h('details', { class: 'adm-item fb-grupo' }, g.cab, g.acoes, g.corpo); grupos.set(it.de, g); }
          const lidosDele = dele.filter((x) => x.lido !== false).length;
          g.acoes.replaceChildren(lidosDele ? U.btn(T('Limpar os lidos dessa pessoa (' + lidosDele + ')', 'Clear this person\'s read ones (' + lidosDele + ')'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => limparLidos(it.de, it.deNome) }) : h('span', { class: 'peq suave' }, T('Todos ainda não lidos.', 'All still unread.')));
          const vis = dele.filter((x) => f.passa(x)), nao = vis.filter((x) => x.lido === false).length;
          g.cab.replaceChildren(nao ? h('span', { class: 'adm-novo' }) : null, h('b', {}, it.deNome), ' #' + it.deTag, h('span', { class: 'selo adm-n' }, String(vis.length)), nao ? h('span', { class: 'peq suave' }, ' · ' + nao + T(' não lidos', ' unread')) : null, h('span', { class: 'peq suave' }, ' · ' + T('último em ', 'latest ') + new Date(dele[0].t).toLocaleString()));
          g.corpo.replaceChildren(...dele.map((x) => elDe(x.id)));
          g.el.hidden = !vis.length;
          topo.push(g.el);
        }
        for (const [de, g] of grupos) if (!topo.includes(g.el)) { grupos.delete(de); g.el.remove(); }
        topo.forEach((e, i) => { if (corpo.children[i] !== e) corpo.insertBefore(e, corpo.children[i] || null); });
        [...corpo.children].forEach((e) => { if (!topo.includes(e)) e.remove(); });
      };
      return f;
    }
    // grade simples (o mosaico media as caixas vazias, antes das listas chegarem, e ficava torto até recarregar a página)
    // (0.8.0) presentear alguém com o Aero Bubble (só o desenvolvedor): a # da pessoa, o plano e por quanto tempo
    const blocoPresente = dev ? (() => {
      // (0.8.2) várias pessoas de uma vez (ID ou #), dar (soma com o tempo que ela já tem do mesmo plano) ou tirar, e a lista de quem tem plano
      const planos = (A.apoio && A.apoio.PLANOS) || [], nomePlano = (id) => (planos.find((p) => p.id === id) || {}).nome || id;
      const escolhidos = new Map(); let modo = 'dar';
      const busca = h('input', { class: 'campo cresce', placeholder: T('ID ou # da pessoa', "Person's ID or #"), spellcheck: 'false' });
      const chips = h('div', { class: 'av-chips bp-chips' });
      const sel = h('select', { class: 'campo', estilo: { width: 'auto' } }, ...planos.map((p) => h('option', { value: p.id }, p.nome)));
      const tempo = escolherTempo();
      const linhaPlano = h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, sel, tempo.el);
      const ajuda = h('div', { class: 'peq suave' });
      const botao = U.btn('', { icone: 'coracao', peq: true, onclick: (e) => fazer(e.currentTarget) });
      const pintar = () => {
        chips.replaceChildren(...[...escolhidos].map(([k, c]) => h('span', { class: 'bolha-chip' }, U.avatar(c, 20), c.nome + ' #' + c.tag, c.bolha && c.bolha.plano ? h('small', { class: 'suave' }, ' · ' + nomePlano(c.bolha.plano)) : null,
          h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar', 'Remove'), onclick: () => { escolhidos.delete(k); pintar(); } }, '×'))),
        escolhidos.size ? null : h('span', { class: 'peq suave' }, T('Ninguém escolhido ainda.', 'No one chosen yet.')));
        linhaPlano.hidden = modo === 'tirar';
        ajuda.textContent = modo === 'tirar' ? T('Tira o plano na hora. Quem assinava no cartão tem a assinatura do Mercado Pago cancelada junto.', 'Removes the plan right away. Card subscriptions are cancelled on Mercado Pago too.') : T('Cada pessoa recebe o plano na hora, com um aviso de presente. Quem já tem o mesmo plano ganha o tempo somado ao que falta.', 'Each person gets the plan right away, with a gift notice. Whoever already has the same plan gets the time added on top.');
        const rot = (modo === 'tirar' ? T('Tirar o plano', 'Remove plan') : T('Presentear', 'Gift')) + (escolhidos.size > 1 ? ' (' + escolhidos.size + ')' : '');
        botao.replaceChildren(A.icone(modo === 'tirar' ? 'lixo' : 'coracao', 20), h('span', {}, rot)); botao.className = 'btn peq' + (modo === 'tirar' ? ' perigo' : '');
      };
      const adicionarConta = (c) => { if (![...escolhidos.values()].some((x) => x.codigo === c.codigo)) escolhidos.set(c.uid || '#' + c.tag, c); pintar(); };
      const adicionar = async () => {
        const v = busca.value.trim(); if (!v) return;
        for (const parte of v.split(/[\s,;]+/).filter(Boolean)) {
          const corpo = /^[0-9a-f]{12}$/i.test(parte) ? { uid: parte.toLowerCase() } : { tag: parte.replace(/^#/, '') };
          try { const { conta } = await API.req('admin/buscar', corpo); adicionarConta(conta); } catch (e) { U.toast(parte + ': ' + e.message, { tipo: 'erro' }); }
        }
        busca.value = '';
      };
      busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
      const fazer = async (bt) => {
        if (!escolhidos.size) { const v = busca.value.trim(); if (v) await adicionar(); if (!escolhidos.size) { U.toast(T('Escolha para quem.', 'Choose who.'), { tipo: 'erro' }); busca.focus(); return; } }
        if (modo === 'tirar' && !(await U.confirmar(T('Tirar o plano de ', 'Remove the plan from ') + escolhidos.size + (escolhidos.size === 1 ? T(' pessoa?', ' person?') : T(' pessoas?', ' people?')), { perigo: true, sim: T('Tirar', 'Remove') }))) return;
        bt.disabled = true;
        try {
          const r = await API.req('admin/bolha-varios', modo === 'tirar' ? { para: [...escolhidos.keys()], tirar: true } : { para: [...escolhidos.keys()], plano: sel.value, ms: tempo.ms(), texto: tempo.texto() });
          A.som.tocar('sucesso');
          const n = r.feitos.length, extra = [r.naoAchou.length ? T(' Não achei: ', ' Not found: ') + r.naoAchou.join(', ') + '.' : '', r.semPlano.length ? T(' Sem plano: ', ' No plan: ') + r.semPlano.map((x) => '#' + x).join(', ') + '.' : ''].join('');
          U.toast((modo === 'tirar' ? T('Plano tirado de ', 'Plan removed from ') : T('Presente enviado para ', 'Gift sent to ')) + n + (n === 1 ? T(' pessoa.', ' person.') : T(' pessoas.', ' people.')) + extra, { tipo: n ? 'ok' : 'erro', ms: 4000 });
          escolhidos.clear(); pintar(); if (!listaCx.hidden) carregarLista();
        } catch (x) { U.toast(x.message, { tipo: 'erro' }); } finally { bt.disabled = false; }
      };
      const modos = U.seg([['dar', T('Dar ou somar tempo', 'Give or add time')], ['tirar', T('Tirar o plano', 'Remove plan')]], 'dar', (v) => { modo = v; pintar(); });
      // a lista de quem está com um plano que você deu, e quanto falta
      const listaCx = h('div', { class: 'col bp-lista', hidden: true });
      const quando = (t) => new Date(t).toLocaleDateString(A.idioma() === 'en' ? 'en' : 'pt-BR');
      const falta = (ate) => { if (!ate) return T('sem prazo', 'no limit'); const ms = ate - Date.now(), d = Math.floor(ms / 86400000), hr = Math.floor(ms / 3600000);
        return d >= 1 ? T('faltam ', '') + d + (d === 1 ? T(' dia', ' day left') : T(' dias', ' days left')) : hr >= 1 ? T('faltam ', '') + hr + (hr === 1 ? T(' hora', ' hour left') : T(' horas', ' hours left')) : T('menos de 1 hora', 'under 1 hour'); };
      const ORIG = { presente: T('presente', 'gift'), dev: T('dado pelo dev', 'given by dev'), pix: 'PIX', 'mp-pix': 'PIX', cartao: T('cartão', 'card'), 'mp-cartao': T('cartão', 'card'), kofi: 'Ko-fi', nubank: 'PIX Nubank', outro: T('outro', 'other') };
      const carregarLista = async () => {
        listaCx.replaceChildren(h('p', { class: 'peq suave' }, T('Carregando…', 'Loading…')));
        try {
          const { itens } = await API.req('admin/bolha-lista');
          if (!itens.length) { listaCx.replaceChildren(h('p', { class: 'peq suave' }, T('Ninguém está com um plano que você deu.', 'No one has a plan you gave.'))); return; }
          listaCx.replaceChildren(h('div', { class: 'linha entre peq' }, h('b', {}, itens.length + (itens.length === 1 ? T(' pessoa com plano seu', ' person with your plan') : T(' pessoas com plano seu', ' people with your plan'))),
            U.btn(T('Escolher todos', 'Choose all'), { tipo: 'link', peq: true, onclick: () => itens.forEach((c) => adicionarConta({ ...c, bolha: { plano: c.plano } })) })),
          ...itens.map((c) => h('div', { class: 'bp-item' }, U.avatar(c, 28),
            h('div', { class: 'cresce' }, h('div', {}, h('b', {}, c.nome), ' ', h('span', { class: 'suave peq' }, '#' + c.tag)),
              h('div', { class: 'peq suave' }, h('span', { class: 'pilula bp-plano bp-' + c.plano }, nomePlano(c.plano)), ' ', h('b', {}, falta(c.ate)), c.ate ? ' · ' + T('até ', 'until ') + quando(c.ate) : '')),
            U.btn(T('Escolher', 'Choose'), { tipo: 'sec', peq: true, onclick: () => adicionarConta({ ...c, bolha: { plano: c.plano } }) }))));
        } catch (e) { listaCx.replaceChildren(h('p', { class: 'msg erro' }, e.message)); }
      };
      const verLista = U.btn(T('Quem eu dei plano', 'Who I gave a plan'), { icone: 'pessoas', tipo: 'sec', peq: true, onclick: () => { listaCx.hidden = !listaCx.hidden; if (!listaCx.hidden) carregarLista(); } });
      pintar();
      return secao(T('Presentear Aero Bubble', 'Gift Aero Bubble'), h('div', { class: 'col', estilo: { gap: '8px' } },
        modos, ajuda,
        h('div', { class: 'linha', estilo: { gap: '6px' } }, busca, U.btn(T('Adicionar', 'Add'), { icone: 'mais', tipo: 'sec', peq: true, onclick: adicionar })), chips,
        linhaPlano, h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, botao, verLista), listaCx));
    })() : null;
    // (0.8.0) duas pilhas fixas: as ferramentas de um lado e as listas do outro. Uma lista comprida só cresce para baixo, sem abrir buraco
    // embaixo das outras caixas (a grade em linhas esticava a linha inteira)
    const grade = h('div', { class: 'adm-grade' },
      h('div', { class: 'adm-pilha' }, blocoConta, blocoPresente),
      h('div', { class: 'adm-pilha' }, dev ? secao(null, lista('feedbacks', T('Feedback', 'Feedback'), feedback, filtroFeedback())) : null, secao(null, lista('denuncias', T('Denúncias', 'Reports'), denuncia))));
    // (0.7.6) desenvolvedor: Analytics (quantas pessoas usam o app; analytics.js) e Equipe (o que já existia). Abre no último escolhido.
    let an = null, cx = null, avP = null;
    if (dev && A.analytics) {
      let vista = 'analytics'; try { vista = localStorage.getItem('aero-dev-vista') || vista; } catch (e) { /* ok */ }
      const caixaAn = h('div'), caixaCx = h('div'), caixaAv = h('div');
      const mostrar = (v) => {
        vista = v; try { localStorage.setItem('aero-dev-vista', v); } catch (e) { /* ok */ }
        if (v === 'analytics' && !an) { an = A.analytics.painel(); caixaAn.append(an.el); } else if (v === 'analytics') an.carregar();
        // (0.8.2) Assinaturas: o caixa do Aero Bubble (analytics.js)
        if (v === 'assinaturas' && !cx) { cx = A.analytics.painelAssinaturas(); caixaCx.append(cx.el); } else if (v === 'assinaturas') cx.carregar();
        if (v === 'avisos' && !avP) { avP = painelAvisos(); caixaAv.append(avP); } // (0.8.2)
        caixaAn.hidden = v !== 'analytics'; caixaCx.hidden = v !== 'assinaturas'; caixaAv.hidden = v !== 'avisos'; grade.hidden = v !== 'equipe';
      };
      if (!['analytics', 'assinaturas', 'avisos', 'equipe'].includes(vista)) vista = 'analytics';
      el.append(U.seg([['analytics', T('Analytics', 'Analytics'), 'sinal'], ['assinaturas', T('Assinaturas', 'Subscriptions'), 'coracao'], ['avisos', T('Avisos', 'Notices'), 'sino'], ['equipe', T('Equipe', 'Team'), 'escudo']], vista, mostrar), caixaAn, caixaCx, caixaAv, grade);
      el.querySelector('.seg').classList.add('an-vistas');
      mostrar(vista);
    } else el.append(grade);
    let t = 0;
    const atualizar = () => { clearTimeout(t); t = setTimeout(() => { if (!el.isConnected) return; listas.forEach((f) => f()); if (fichaAlvo) buscar(true); }, 250); };
    const offs = [A.evt.on('hub:admin-mudou', atualizar), A.evt.on('hub:eu', atualizar)];
    const iv = setInterval(() => { if (!document.hidden) atualizar(); }, 30000);
    return { limpar: () => { offs.forEach((f) => f()); clearInterval(iv); clearTimeout(t); if (an) an.limpar(); if (cx) cx.limpar(); } };
  }

  // (0.8.2) os jeitos de aviso que o desenvolvedor manda
  const NIVEIS_AVISO = () => [['normal', T('Notificação normal', 'Normal notification'), 'sino'], ['alerta', T('Alerta', 'Alert'), 'atencao'], ['aviso', T('Aviso (infração)', 'Warning (violation)'), 'escudo']];
  // (0.8.2) desenvolvedor: disparar avisos para todo mundo ou para as pessoas escolhidas (por ID ou #)
  function painelAvisos() {
    let nivel = 'normal', todos = false;
    const escolhidos = new Map(); // ID/# digitado -> ficha
    const el = h('section', { class: 'vidro pad col av-envio', estilo: { gap: '12px' } });
    const ajuda = h('div', { class: 'peq suave' });
    const pintarAjuda = () => { ajuda.textContent = { normal: T('Uma mensagem para a pessoa ler.', 'A message for the person to read.'), alerta: T('Para avisar de um bug ou de alguma coisa no geral.', 'To warn about a bug or something in general.'), aviso: T('Para quem infringiu alguma regra: vai em vermelho, como aviso da moderação.', 'For someone who broke a rule: shown in red, as a moderation warning.') }[nivel]; };
    const busca = h('input', { class: 'campo cresce', placeholder: T('ID (12 caracteres) ou #', 'ID (12 characters) or #'), spellcheck: 'false' });
    const chips = h('div', { class: 'av-chips' });
    const pessoas = h('div', { class: 'col', estilo: { gap: '8px' } });
    const pintarChips = () => chips.replaceChildren(...[...escolhidos].map(([k, c]) => h('span', { class: 'bolha-chip' }, U.avatar(c, 20), c.nome + ' #' + c.tag,
      h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar', 'Remove'), onclick: () => { escolhidos.delete(k); pintarChips(); } }, '×'))),
      escolhidos.size ? null : h('span', { class: 'peq suave' }, T('Ninguém escolhido ainda.', 'No one chosen yet.')));
    const adicionar = async () => {
      const v = busca.value.trim(); if (!v) return;
      const corpo = /^[0-9a-f]{12}$/i.test(v) ? { uid: v.toLowerCase() } : { tag: v.replace(/^#/, '') };
      try { const { conta } = await API.req('admin/buscar', corpo); if ([...escolhidos.values()].some((c) => c.codigo === conta.codigo)) { busca.value = ''; return; } escolhidos.set(conta.uid || '#' + conta.tag, conta); busca.value = ''; pintarChips(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    };
    busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
    pessoas.append(h('div', { class: 'linha', estilo: { gap: '6px' } }, busca, U.btn(T('Adicionar', 'Add'), { icone: 'mais', tipo: 'sec', peq: true, onclick: adicionar })), chips);
    const texto = h('textarea', { class: 'campo', rows: 4, maxlength: 1000, placeholder: T('Escreva o aviso...', 'Write the notice...') });
    const enviar = U.btn(T('Enviar', 'Send'), { icone: 'enviar', onclick: async () => {
      if (!texto.value.trim()) { U.toast(T('Escreva o aviso.', 'Write the notice.'), { tipo: 'erro' }); return; }
      if (!todos && !escolhidos.size) { U.toast(T('Escolha para quem mandar.', 'Choose who to send it to.'), { tipo: 'erro' }); return; }
      if (todos && !(await U.confirmar(T('Mandar este aviso para TODO MUNDO?', 'Send this notice to EVERYONE?'), { sim: T('Mandar para todos', 'Send to everyone') }))) return;
      enviar.disabled = true;
      try {
        const r = await API.req('admin/avisos-enviar', todos ? { todos: true, texto: texto.value, nivel } : { para: [...escolhidos.keys()], texto: texto.value, nivel });
        A.som.tocar('sucesso'); texto.value = '';
        U.toast(r.todos ? T('Enviado para todo mundo (' + r.online + ' aparelhos online agora; os outros veem ao abrir o app).', 'Sent to everyone (' + r.online + ' devices online now; the others see it when they open the app).') : T('Enviado para ' + r.enviados + (r.enviados === 1 ? ' pessoa' : ' pessoas') + '.', 'Sent to ' + r.enviados + (r.enviados === 1 ? ' person' : ' people') + '.') + (r.naoAchou && r.naoAchou.length ? T(' Não achei: ', ' Not found: ') + r.naoAchou.join(', ') : ''), { tipo: 'ok', ms: 4000 });
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      enviar.disabled = false;
    } });
    const destino = U.seg([['pessoas', T('Pessoas escolhidas', 'Chosen people'), 'pessoas'], ['todos', T('Todo mundo', 'Everyone'), 'grupo']], 'pessoas', (v) => { todos = v === 'todos'; pessoas.hidden = todos; });
    const jeito = U.seg(NIVEIS_AVISO(), 'normal', (v) => { nivel = v; pintarAjuda(); }); jeito.classList.add('quebra'); destino.classList.add('quebra');
    pintarAjuda(); pintarChips();
    el.append(h('h3', {}, T('Enviar avisos', 'Send notices')),
      h('div', { class: 'col', estilo: { gap: '6px' } }, h('b', {}, T('Tipo', 'Type')), jeito, ajuda),
      h('div', { class: 'col', estilo: { gap: '6px' } }, h('b', {}, T('Para quem', 'To whom')), destino, pessoas),
      texto, h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, enviar));
    // (0.8.2) os que já mandei: para quem, quem leu e quando; apagar um (some de quem ainda não leu) ou limpar os que todo mundo já leu
    const hist = h('div', { class: 'col av-hist', estilo: { gap: '8px' } });
    const NOME = Object.fromEntries(NIVEIS_AVISO().map(([k, r]) => [k === 'normal' ? 'admin' : k, r]));
    const carregar = async () => {
      if (!el.isConnected && hist.childElementCount) return;
      let itens; try { ({ itens } = await API.req('admin/avisos-enviados')); } catch (e) { hist.replaceChildren(h('p', { class: 'msg erro' }, e.message)); return; }
      const abertos = new Set([...hist.querySelectorAll('details[open]')].map((d) => d.dataset.id));
      hist.replaceChildren(...(itens.length ? itens.map((e) => {
        const lidos = e.todos ? e.nLidos || 0 : e.para.filter((x) => x.lido).length, total = e.todos ? null : e.para.length;
        const d = h('details', { class: 'av-env av-' + ({ alerta: 'atencao', aviso: 'alerta' }[e.tipo] || 'normal'), 'data-id': e.id, open: abertos.has(e.id) },
          h('summary', {}, h('b', {}, NOME[e.tipo] || e.tipo), ' ', h('span', { class: 'peq suave' }, new Date(e.t).toLocaleString()), ' ',
            h('span', { class: 'pilula adm-lida' + (total != null && lidos === total ? ' sim' : '') }, e.todos ? T('todo mundo · ', 'everyone · ') + lidos + T(' leram', ' read') : lidos + '/' + total + T(' leram', ' read')),
            h('div', { class: 'av-env-prev' }, e.texto)),
          h('div', { class: 'col', estilo: { gap: '6px' } },
            h('div', { class: 'av-env-txt selecionavel' }, e.texto),
            e.todos ? h('div', { class: 'peq suave' }, T('Para todo mundo. Vale por 30 dias.', 'To everyone. Lasts 30 days.'))
              : h('div', { class: 'av-env-para' }, e.para.map((x) => h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, h('span', {}, x.nome, ' ', h('span', { class: 'tag' }, '#' + x.tag)), lidaEm(x)))),
            h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, U.btn(T('Remover', 'Remove'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: async () => {
              if (!(await U.confirmar(T('Remover este aviso? Quem ainda não leu não vai mais ver.', 'Remove this notice? Whoever has not read it will no longer see it.'), { perigo: true }))) return;
              try { await API.req('admin/aviso-enviado/apagar', { id: e.id }); estourar(d); } catch (er) { U.toast(er.message, { tipo: 'erro' }); }
            } }))));
        return d;
      }) : [h('div', { class: 'peq suave' }, T('Nenhum aviso enviado.', 'No notices sent.'))]));
    };
    const limpar = U.btn(T('Limpar os já lidos', 'Clear the read ones'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: async () => {
      try { const r = await API.req('admin/avisos-enviados/limpar', {}); U.toast(r.apagados ? T('Limpei ' + r.apagados + '.', 'Cleared ' + r.apagados + '.') : T('Nada para limpar: tem gente que ainda não leu.', 'Nothing to clear: someone has not read them yet.'), { tipo: 'ok', ms: 2500 }); carregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    } });
    const secHist = h('section', { class: 'vidro pad col', estilo: { gap: '10px' } },
      h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, h('h3', { class: 'cresce', estilo: { margin: 0 } }, T('Avisos enviados', 'Sent notices')), limpar),
      h('div', { class: 'peq suave' }, T('Os de todo mundo saem ao limpar depois de 30 dias.', 'Everyone notices are cleared after 30 days.')), hist);
    let t = 0; const recarregar = () => { clearTimeout(t); t = setTimeout(carregar, 300); };
    A.evt.on('hub:admin-mudou', (m) => { if (secHist.isConnected) recarregar(); });
    enviar.addEventListener('click', () => setTimeout(recarregar, 800));
    carregar();
    return h('div', { class: 'col', estilo: { gap: '12px' } }, el, secHist);
  }

  // insígnias: texto, cor (ou gradiente) e cor da letra, com prévia
  function editorInsignias(c, salvar) {
    const itens = (c.ins || []).map((x) => ({ ...x }));
    const caixa = h('div', { class: 'col adm-acao', estilo: { gap: '6px' } });
    const pintar = () => {
      caixa.textContent = '';
      caixa.append(h('b', {}, T('Insígnias (aparecem ao lado do nome)', 'Badges (shown next to the name)')), h('div', {}, U.insignias(itens) || h('span', { class: 'peq suave' }, T('Nenhuma.', 'None.'))));
      itens.forEach((x, i) => {
        const t = h('input', { class: 'campo', value: x.t, maxlength: 24, placeholder: T('Texto', 'Text'), estilo: { width: '140px' } });
        const c1 = h('input', { type: 'color', value: x.c1 || '#2d9ee0', title: T('Cor', 'Color') }), grad = h('input', { type: 'checkbox' }), c2 = h('input', { type: 'color', value: x.c2 || '#8a63e0', title: T('Segunda cor (gradiente)', 'Second color (gradient)') }), ct = h('input', { type: 'color', value: x.ct || '#ffffff', title: T('Cor da letra', 'Text color') });
        grad.checked = !!x.c2; c2.disabled = !grad.checked;
        const atualizar = () => { x.t = t.value; x.c1 = c1.value; x.c2 = grad.checked ? c2.value : ''; x.ct = ct.value; c2.disabled = !grad.checked; caixa.querySelector('div').replaceChildren(U.insignias(itens) || ''); };
        [t, c1, grad, c2, ct].forEach((e) => e.addEventListener('input', atualizar));
        caixa.append(h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, t, c1, h('label', { class: 'linha peq', estilo: { gap: '4px' } }, grad, T('gradiente', 'gradient')), c2, h('span', { class: 'peq suave' }, T('letra', 'text')), ct, U.btn('', { icone: 'lixo', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar', 'Remove'), onclick: () => { itens.splice(i, 1); A.som.tocar('estourar'); pintar(); } })));
      });
      caixa.append(h('div', { class: 'linha', estilo: { gap: '6px' } }, itens.length < 4 ? U.btn(T('Nova insígnia', 'New badge'), { icone: 'mais', tipo: 'sec', peq: true, onclick: () => { itens.push({ t: 'VIP', c1: '#f0b400', c2: '', ct: '#ffffff' }); A.som.tocar('bolha'); pintar(); } }) : null, U.btn(T('Salvar insígnias', 'Save badges'), { peq: true, onclick: () => salvar(itens) })));
    };
    pintar();
    return caixa;
  }

  A.abas = A.abas || {};
  A.abas.dev = (el) => aba(el, true);
  A.abas.mod = (el) => aba(el, false);
})();
