// Aero Stream - (1.0.2) tradução das mensagens, dicionário por palavra (comparando duas línguas, com pronúncia) e o horário de cada pessoa.
// (1.0.6) A tradução sai deste aparelho direto para o tradutor (o Google recusa os servidores do Cloudflare); o servidor do Aero fica de
// reserva. Vai só o texto, sem cookies e sem dizer de onde veio. Criado por Ryan Victtor.
(() => {
  const A = window.Aero, { h, T } = A, U = A.ui;
  const LINGUAS = [['pt', 'Português'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ja', '日本語'], ['ko', '한국어'], ['zh-CN', '中文'], ['ru', 'Русский'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['tr', 'Türkçe'], ['pl', 'Polski'], ['nl', 'Nederlands'], ['sv', 'Svenska'], ['uk', 'Українська'], ['id', 'Bahasa Indonesia']];
  const nomeLingua = (c) => (LINGUAS.find((x) => x[0] === c || x[0].slice(0, 2) === String(c || '').slice(0, 2)) || [c, String(c || '').toUpperCase()])[1];
  // (1.0.3) "Traduzido do inglês" (o nome da língua na língua do app, não "English")
  const nomeNaMinha = (c) => { try { const n = new Intl.DisplayNames([A.idioma() === 'en' ? 'en' : 'pt-BR'], { type: 'language' }).of(String(c || '').slice(0, 2)); if (n) return n; } catch (e) { /* ok */ } return nomeLingua(c); };
  const cfg = () => { const c = A.cfg.v.chat = A.cfg.v.chat || {}; return c; };
  const minha = () => cfg().traduzirPara || (A.idioma() === 'en' ? 'en' : 'pt');
  const cache = new Map(); // id da mensagem -> { texto, de } (sobrevive quando o chat redesenha a mensagem)
  const pedidos = new Map();

  // (1.0.6) o texto longo vai em pedaços (o tradutor só aceita o texto no endereço)
  const pedacos = (t, max = 700) => {
    const out = []; let resto = t;
    while (resto.length > max && out.length < 8) {
      let i = Math.max(resto.lastIndexOf('. ', max), resto.lastIndexOf('\n', max), resto.lastIndexOf('! ', max), resto.lastIndexOf('? ', max), resto.lastIndexOf('。', max));
      if (i < max / 3) i = resto.lastIndexOf(' ', max); if (i < max / 3) i = max;
      out.push(resto.slice(0, i + 1)); resto = resto.slice(i + 1);
    }
    if (resto) out.push(resto.slice(0, max)); return out;
  };
  const LING = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
  async function direto(texto, para, de) {
    if (!LING.test(para) || (de !== 'auto' && !LING.test(de))) throw new Error('lingua');
    let out = '', lingua = ''; const rom = [];
    for (const p of pedacos(String(texto).slice(0, 4000))) {
      if (!p.trim()) { out += p; continue; }
      const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=rm&sl=' + de + '&tl=' + para + '&q=' + encodeURIComponent(p);
      const r = await fetch(u, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) throw new Error('tradutor ' + r.status);
      const d = await r.json(), ps = Array.isArray(d && d[0]) ? d[0] : [];
      const t = ps.map((x) => (Array.isArray(x) && typeof x[0] === 'string' ? x[0] : '')).join('');
      if (!t) throw new Error('vazio');
      out += t + (/\s$/.test(p) ? ' ' : '');
      const ro = ps.map((x) => (Array.isArray(x) && typeof x[3] === 'string' ? x[3] : '')).join(' ').trim(); if (ro) rom.push(ro);
      if (!lingua && typeof d[2] === 'string' && LING.test(d[2])) lingua = d[2];
    }
    return { texto: out.trim().slice(0, 4000), de: lingua || de, rom: rom.length ? rom.join(' ').slice(0, 400) : undefined };
  }
  async function traduzir(texto, para, de = 'auto') {
    const ch = para + '|' + de + '|' + texto;
    if (pedidos.has(ch)) return pedidos.get(ch);
    const p = direto(texto, para, de).catch(() => A.api.req('traduzir', { texto, para, de })).catch((e) => { pedidos.delete(ch); throw e; });
    pedidos.set(ch, p); if (pedidos.size > 300) pedidos.delete(pedidos.keys().next().value);
    return p;
  }

  // o bloco "Traduzido do inglês · Ver original" embaixo do texto da mensagem
  function pintarTrad(lugar, r, m) {
    let original = false;
    const corpo = h('div', { class: 'cx-trad-txt' }, r.texto);
    const alt = h('button', { class: 'cx-trad-alt', type: 'button', onclick: (e) => { e.stopPropagation(); original = !original; corpo.textContent = original ? m.texto : r.texto; alt.textContent = original ? T('Ver tradução', 'See translation') : T('Ver original', 'See original'); } }, T('Ver original', 'See original'));
    lugar.replaceChildren(h('div', { class: 'cx-trad-topo' }, A.icone('traduzir', 12), h('span', {}, T('Traduzido do ', 'Translated from ') + nomeNaMinha(r.de)), alt), corpo);
    lugar.hidden = false;
  }
  function bloco(m, meu) {
    if (!m || !m.texto || m.trancada) return null;
    const lugar = h('div', { class: 'cx-trad', hidden: true });
    const ja = cache.get(m.id);
    if (ja) { if (ja.texto) pintarTrad(lugar, ja, m); return lugar; }
    if (!meu && cfg().autoTraduzir && traduzivel(m.texto)) {
      traduzir(m.texto, minha()).then((r) => {
        const igual = !r.texto || String(r.de || '').slice(0, 2) === minha().slice(0, 2) || r.texto.trim() === m.texto.trim();
        cache.set(m.id, igual ? { texto: '' } : r); if (!igual) pintarTrad(lugar, r, m);
      }).catch(() => {});
    }
    return lugar;
  }
  // links, menções e figurinhas não passam pelo tradutor (ele estragaria)
  const traduzivel = (t) => !!t && /\p{L}{2}/u.test(t.replace(/\bhttps?:\/\/\S+/g, '').replace(/<[^>]+>/g, '').replace(/:[a-z0-9_]+:/gi, ''));
  async function traduzirMsg(m, el) {
    // (1.0.3) a mensagem já estava na tela antes de ligar a tradução: não tinha o lugar dela e o "Traduzir" do menu não fazia nada
    let lugar = el && el.querySelector('.cx-trad');
    if (!lugar && el) { const txt = el.querySelector('.cx-txt'); if (!txt) return; lugar = h('div', { class: 'cx-trad', hidden: true }); txt.after(lugar); }
    if (!lugar) return;
    lugar.hidden = false; lugar.replaceChildren(h('div', { class: 'cx-trad-topo suave' }, T('Traduzindo…', 'Translating…')));
    try {
      const r = await traduzir(m.texto, minha());
      cache.set(m.id, r); pintarTrad(lugar, r, m);
    } catch (e) { lugar.replaceChildren(h('div', { class: 'cx-trad-topo suave' }, T('Não deu para traduzir agora.', 'Could not translate now.'))); }
  }
  // (as suas mensagens) traduz antes de mandar, se você escolheu uma língua; com links/menções no meio, vai como escreveu
  async function antesDeEnviar(texto) {
    const para = cfg().minhasPara; if (!para || !texto || /\bhttps?:\/\/|<[^>]+>/.test(texto) || !traduzivel(texto)) return texto;
    try { const r = await traduzir(texto, para); return r.texto && String(r.de || '').slice(0, 2) !== para.slice(0, 2) ? r.texto : texto; } catch (e) { return texto; }
  }

  // ---------- dicionário ----------
  const palavrasDe = (t) => [...new Set(String(t || '').replace(/\bhttps?:\/\/\S+/g, '').replace(/<[^>]+>/g, '').match(/[\p{L}][\p{L}'’-]*/gu) || [])].filter((p) => p.length > 1).slice(0, 40);
  const vozes = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
  // (1.0.6) o PC (principalmente o Linux) não tem voz instalada e o "Ouvir" ficava mudo: o áudio vem do servidor do Aero; a voz do sistema só se ele falhar
  let tocando = null;
  function vozDoSistema(palavra, lingua) {
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(palavra); u.lang = lingua; u.rate = 0.85;
      const v = vozes().find((x) => x.lang && x.lang.toLowerCase().startsWith(lingua.slice(0, 2).toLowerCase())); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function falar(palavra, lingua, bt) {
    const srv = (A.api && A.api.servidor) || '';
    if (tocando) { try { tocando.pause(); } catch (e) {} tocando = null; }
    if (!srv) { vozDoSistema(palavra, lingua); return; }
    const au = new Audio(srv + '/api/falar?t=' + encodeURIComponent(palavra) + '&l=' + encodeURIComponent(lingua)); tocando = au;
    if (bt) bt.classList.add('falando');
    const fim = () => { if (bt) bt.classList.remove('falando'); if (tocando === au) tocando = null; };
    au.onended = fim; au.onerror = () => { fim(); vozDoSistema(palavra, lingua); };
    au.play().catch(() => { fim(); vozDoSistema(palavra, lingua); });
  }
  const ehPronuncia = (t) => /pron[uú]n|aussprache|prononciation|произнош|発音/i.test(t || '');
  function coluna(lingua, palavra) {
    const cx = h('div', { class: 'dic-col' }, h('div', { class: 'suave peq' }, T('Procurando…', 'Looking up…')));
    A.api.req('dicionario', { palavra, lingua }).then((d) => {
      const ipa = []; const sec = [];
      for (const s of d.secoes || []) {
        if (ehPronuncia(s.t)) { for (const l of s.l) { const m = l.match(/[/[][^/\]]{1,40}[/\]]/); if (m && ipa.length < 2) ipa.push(m[0]); } continue; }
        sec.push(h('div', { class: 'dic-sec' }, s.t ? h('div', { class: 'dic-sec-t' }, s.t) : null, h('ol', {}, ...s.l.slice(0, 5).map((l) => h('li', {}, l.replace(/^#+\s*/, ''))))));
      }
      cx.replaceChildren(
        h('div', { class: 'dic-cab' },
          h('b', { class: 'dic-pal' }, d.palavra || palavra),
          h('button', { class: 'dic-ouvir', type: 'button', title: T('Ouvir', 'Listen'), onclick: (e) => falar(d.palavra || palavra, lingua, e.currentTarget) }, A.icone('volume', 15)),
          ipa.length ? h('span', { class: 'dic-ipa' }, ipa.join(' · ')) : null),
        ...(sec.length ? sec : [h('div', { class: 'suave peq' }, T('Não achei essa palavra no dicionário de ', 'Not found in the dictionary for ') + nomeLingua(lingua) + '.')]),
        h('div', { class: 'peq suave dic-fonte' }, T('Fonte: Wikcionário', 'Source: Wiktionary')));
    }).catch(() => cx.replaceChildren(h('div', { class: 'suave peq' }, T('O dicionário não respondeu agora.', 'The dictionary did not answer now.'))));
    return cx;
  }
  function selLingua(valor, onchange) {
    const s = h('select', { class: 'campo dic-sel', onchange: () => onchange(s.value) }, ...LINGUAS.map(([c, n]) => h('option', { value: c }, n)));
    s.value = LINGUAS.some((x) => x[0] === valor) ? valor : 'en'; return s;
  }
  function dicionario(palavra, texto) {
    const lista = palavrasDe(texto);
    let a = 'auto', b = minha().slice(0, 2) === 'zh' ? 'zh-CN' : minha();
    const corpo = h('div', { class: 'dic-corpo' });
    const trad = h('div', { class: 'dic-trad' });
    const escolha = lista.length > 1 ? h('div', { class: 'dic-palavras' }, ...lista.map((p) => h('button', { type: 'button', class: 'dic-chip' + (p === palavra ? ' sel' : ''), onclick: () => { palavra = p; escolha.querySelectorAll('.dic-chip').forEach((x) => x.classList.toggle('sel', x.textContent === p)); carregar(); } }, p))) : null;
    const selA = selLingua('en', (v) => { a = v; carregar(); }), selB = selLingua(b, (v) => { b = v; carregar(); });
    async function carregar() {
      if (!palavra) { corpo.replaceChildren(h('div', { class: 'suave peq' }, T('Escolha uma palavra.', 'Pick a word.'))); return; }
      trad.textContent = '…';
      let la = a;
      try {
        const r = await traduzir(palavra, b, a === 'auto' ? 'auto' : a);
        if (a === 'auto') { la = LINGUAS.find((x) => x[0].slice(0, 2) === String(r.de || '').slice(0, 2)) ? String(r.de).slice(0, 2) : 'en'; selA.value = LINGUAS.find((x) => x[0].slice(0, 2) === la)[0]; a = selA.value; }
        trad.replaceChildren(h('span', { class: 'suave' }, nomeLingua(la) + ' → ' + nomeLingua(b) + ': '), h('b', {}, r.texto || '—'), r.rom ? h('span', { class: 'suave' }, ' (' + r.rom + ')') : null);
        const outra = (r.texto || '').trim().split(/\s+/).length <= 3 ? r.texto.trim() : '';
        corpo.replaceChildren(coluna(la, palavra), ...(outra && la.slice(0, 2) !== b.slice(0, 2) ? [coluna(b, outra.replace(/[.!?。]+$/, ''))] : []));
      } catch (e) { trad.textContent = T('Sem tradução agora.', 'No translation now.'); corpo.replaceChildren(coluna(la === 'auto' ? 'en' : la, palavra)); }
    }
    U.modal(T('Dicionário', 'Dictionary'), h('div', { class: 'dic' },
      escolha,
      h('div', { class: 'dic-linguas' }, selA, h('span', { class: 'suave' }, '→'), selB),
      trad, corpo), { largura: 640 });
    if (!palavra && lista.length === 1) palavra = lista[0];
    a = 'auto'; carregar();
  }

  // ---------- horário da pessoa ----------
  function horaEm(fz) {
    try { return new Date().toLocaleTimeString(A.idioma() === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fz }); } catch (e) { return ''; }
  }
  function gmt(fz) {
    try { const p = new Intl.DateTimeFormat('en-US', { timeZone: fz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName'); return p ? p.value : ''; } catch (e) { return ''; }
  }
  const relogios = new Set(); let tic = null;
  function relogio(fz) {
    if (!fz || !horaEm(fz)) return null;
    const meuFz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const el = h('span', { class: 'hora-pessoa', title: T('Horário dessa pessoa', 'Their local time') + ' (' + gmt(fz) + (fz === meuFz ? T(', igual ao seu', ', same as yours') : '') + ')' }, A.icone('relogio', 12), h('span', {}, horaEm(fz)));
    el._fz = fz; relogios.add(el);
    if (!tic) tic = setInterval(() => { for (const r of relogios) { if (!r.isConnected) { relogios.delete(r); continue; } r.lastChild.textContent = horaEm(r._fz); } if (!relogios.size) { clearInterval(tic); tic = null; } }, 30000);
    return el;
  }
  async function mostrarFuso(v) {
    const fz = v ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    cfg().mostrarFuso = v; A.cfg.salvar();
    try { await A.api.req('perfil-extra', { fz }); } catch (e) { U.toast && U.toast(e.message || String(e), { tipo: 'erro' }); }
  }

  // ---------- Configurações > Chats ----------
  function secao(opcao) {
    const c = cfg();
    const opcoes = (vazio) => [...(vazio ? [['', vazio]] : []), ...LINGUAS];
    const sel = (valor, lista, on) => { const s = h('select', { class: 'campo', estilo: { 'max-width': '180px' }, onchange: () => on(s.value) }, ...lista.map(([v, n]) => h('option', { value: v }, n))); s.value = valor; return s; };
    const on = (id) => !!(A.integ && A.integ.ligada(id)), tr = on('traducao') || on('dicionario');
    return [
      tr && opcao(T('Traduzir para', 'Translate to'), sel(minha(), opcoes(), (v) => { c.traduzirPara = v; A.cfg.salvar(); }), T('A língua do "Traduzir" nas mensagens e do dicionário.', 'The language for "Translate" on messages and for the dictionary.')),
      on('traducao') && opcao(T('Traduzir as mensagens dos outros sozinho', 'Auto-translate other people\'s messages'), U.chave(c.autoTraduzir === true, (v) => { c.autoTraduzir = v; A.cfg.salvar(); }), T('A tradução aparece embaixo da mensagem, com o original a um clique.', 'The translation shows under the message, with the original one click away.')),
      on('traducao') && opcao(T('Traduzir as minhas mensagens', 'Translate my messages'), sel(c.minhasPara || '', opcoes(T('Não traduzir', 'Don\'t translate')), (v) => { c.minhasPara = v; A.cfg.salvar(); }), T('O que você escreve vai traduzido para essa língua.', 'What you type is sent translated into this language.')),
      on('horario') && opcao(T('Mostrar o meu horário', 'Show my local time'), U.chave(c.mostrarFuso === true, mostrarFuso), T('Seus amigos veem que horas são aí, ao lado do seu nome.', 'Your friends see what time it is for you, next to your name.')),
    ].filter(Boolean);
  }

  A.idiomas = { LINGUAS, traduzir, bloco, traduzirMsg, antesDeEnviar, dicionario, palavrasDe, relogio, secao, nomeLingua };
})();
