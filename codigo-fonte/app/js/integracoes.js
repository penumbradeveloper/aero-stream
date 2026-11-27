// Aero Stream - (0.8.7) Integrações: a "oficina" do Aero (como a da Steam ou o Vencord).
// Oficiais (feitas pela equipe) e da Comunidade (publicar exige o Supporter; 0.9.1). Cada uma tem a sua página, com
// demonstrações, descrição, quem fez, estrelas e comentários. Por enquanto as integrações são só de APARÊNCIA (CSS), e o CSS passa
// por travas antes de entrar no app:
//  - nada sai para a internet (sem url() de fora, sem @import, sem fontes de fora): o CSS não tem como mandar dado nenhum para fora;
//  - sem "!important", sem "content" (texto falso na tela), sem camada por cima do app (position: fixed) e sem bloquear cliques;
//  - as partes protegidas (Privacidade, avisos de segurança, a própria aba Integrações) são vigiadas: se uma integração esconder alguma,
//    ela é desligada na hora.
// Integração nenhuma roda código: só muda a cara do app.
(() => {
  'use strict';
  const A = window.Aero;
  const { h, T } = A, U = A.ui;
  const I = (A.integ = {});

  // ---------- as oficiais ----------
  // (1.0.2) vêm do catálogo do servidor (integcatalogo.js): uma nova aparece aqui sem atualizar o app. Montadas na hora (o idioma pode
  // mudar). Só as desta plataforma (o celular como microfone não aparece no site, por exemplo).
  const K = () => A.integCat;
  const deCatalogo = (c) => ({ id: c.id, versao: c.versao, icone: c.icone, tipo: c.cat, cena: c.cena, gen: c.tipo, cat: c,
    nome: K().texto(c.nome), resumo: K().texto(c.resumo), desc: K().texto(c.desc), onde: c.onde ? K().texto(c.onde) : '', curto: c.curto ? K().texto(c.curto) : '',
    seguro: c.seguro && c.seguro.length ? c.seguro.map(K().texto) : null, bloqueio: K().bloqueio(c) || (K().nestaPlataforma(c) ? null : 'plat') });
  // (1.0.0) todas aparecem em todo aparelho (igual no PC); as que não funcionam aqui ficam com o selo de onde funcionam
  const oficiais = () => (K() ? K().lista().map(deCatalogo) : []);
  // (0.8.7) os tipos: o que entra nas conversas e nas chamadas, os widgets do perfil e (na Comunidade) temas
  const tipos = () => ({ conversa: [T('Chats e chamadas', 'Chats & calls'), 'chat'], widget: ['Widget', 'pessoa'], tema: [T('Tema', 'Theme'), 'oPaleta'] });
  // (0.8.7) os temas oficiais saíram (o app já deixa mudar tudo isso em Aparência): quem tinha instalado não fica com sobra
  try { const v = A.cfg.v.integ; if (v && typeof v === 'object') for (const k of ['vidro-profundo', 'cantos-macios', 'compacto', 'halo', 'widget-pasta', 'widgets-favoritos']) delete v[k]; } catch (e) { /* ok */ }
  const porId = (id) => { const c = K() && K().porId(id); return c ? deCatalogo(c) : null; };
  // (0.9.1) as categorias da Comunidade
  const CATS = () => ({ barra: [T('Barra das abas', 'Tab bar'), 'apps'], tema: [T('Tema e fundo', 'Theme and background'), 'oPaleta'], custom: [T('Customização', 'Customization'), 'lapis'], misc: [T('Miscelânea', 'Miscellaneous'), 'bolhas'] });

  // ---------- as travas do CSS ----------
  const PROIBIDAS = new Set(['content', 'pointer-events', '-webkit-app-region', 'app-region', 'behavior', '-moz-binding', 'user-modify', '-webkit-user-modify', 'quotes', 'counter-reset', 'counter-increment', 'counter-set']);
  const VALOR_RUIM = /(url\s*\(|image-set\s*\(|src\s*\(|expression\s*\(|javascript:|@import|attr\s*\()/i;
  const SELETOR_RUIM = /(\[data-protegido|\.integ-|#integ|\.cfg-|\.fundo-modal|\.modal\b|\.toast|#toasts|:root|^\s*html\b|\[\s*style\b)/i; // (1.0.3) [style] deixava o app todo lento (qualquer mudança de estilo recalculava tudo)
  // devolve o CSS limpo e o que foi tirado
  // (0.8.7) pref: as animações (@keyframes) da integração ganham um prefixo, para nunca trocar uma animação do próprio app
  I.sanitizar = (css, pref) => {
    const tirados = [], kfs = [];
    let s = String(css || '').slice(0, 60000).replace(/\/\*[\s\S]*?\*\//g, '');
    const nomesKf = new Set(); if (pref) for (const m of s.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]{1,40})/gi)) nomesKf.add(m[1]);
    const renomear = (v) => (pref && nomesKf.size ? v.replace(/[\w-]+/g, (w) => (nomesKf.has(w) ? 'ig-' + pref + '-' + w : w)) : v);
    if (/\\/.test(s)) { tirados.push('escape'); s = s.replace(/\\/g, ''); } // escapes escondem "url(" e "@import"
    if (/[<>]/.test(s.replace(/>(?=[^{}]*\{)/g, ''))) tirados.push('html');
    const decls = (corpo) => corpo.split(';').map((d) => {
      const i = d.indexOf(':'); if (i < 0) return '';
      const p = d.slice(0, i).trim().toLowerCase(); let v = d.slice(i + 1).trim();
      if (!/^(--[\w-]{1,40}|-?[a-z][a-z-]{1,40})$/.test(p) || PROIBIDAS.has(p)) { tirados.push(p); return ''; }
      if (/!\s*important/i.test(v)) { tirados.push('!important'); v = v.replace(/!\s*important/gi, '').trim(); }
      if (VALOR_RUIM.test(v)) { tirados.push(p + ': ' + v.slice(0, 30)); return ''; }
      if (p === 'position' && /fixed|sticky/i.test(v)) { tirados.push('position: ' + v); return ''; }
      if (p === 'z-index' && Math.abs(parseInt(v, 10)) > 20) { tirados.push('z-index'); return ''; }
      if (/[{}]/.test(v) || v.length > 600) { tirados.push(p); return ''; }
      if (p === 'animation' || p === 'animation-name') v = renomear(v);
      return p + ': ' + v;
    }).filter(Boolean).join('; ');
    const bloco = (txt, fundo) => {
      let out = '', i = 0;
      while (i < txt.length) {
        const a = txt.indexOf('{', i); if (a < 0) break;
        let n = 1, j = a + 1; while (j < txt.length && n) { if (txt[j] === '{') n++; else if (txt[j] === '}') n--; j++; }
        const sel = txt.slice(i, a).replace(/;/g, '').trim(), corpo = txt.slice(a + 1, j - 1); i = j;
        if (fundo > 2) { tirados.push('aninhado'); continue; }
        if (sel.startsWith('@')) {
          const m = /^@(media|supports|container|keyframes|-webkit-keyframes)\b/i.exec(sel);
          if (!m || VALOR_RUIM.test(sel)) { tirados.push(sel.slice(0, 30)); continue; }
          if (/keyframes/i.test(m[1]) && pref) { // vai para fora do @scope, com o nome prefixado
            const nome = (/keyframes\s+([\w-]{1,40})\s*$/i.exec(sel) || [])[1]; if (!nome) { tirados.push(sel.slice(0, 30)); continue; }
            kfs.push('@keyframes ig-' + pref + '-' + nome + ' {\n' + bloco(corpo, 9) + '}\n'); continue;
          }
          out += sel + ' {\n' + (/keyframes/i.test(m[1]) ? bloco(corpo, 9).replace(/^/gm, '') : bloco(corpo, fundo + 1)) + '}\n';
          continue;
        }
        if (fundo === 9) { const d = decls(corpo); if (d) out += sel + ' { ' + d + ' }\n'; continue; } // os quadros de um @keyframes
        if (!sel || sel.length > 400 || SELETOR_RUIM.test(sel) || VALOR_RUIM.test(sel)) { tirados.push(sel.slice(0, 40)); continue; }
        const d = decls(corpo); if (d) out += sel + ' { ' + d + ' }\n';
      }
      return out;
    };
    const regras = bloco(s, 0);
    return { css: regras, kfs: kfs.join(''), tirados };
  };
  // (0.8.7) o CSS de uma integração da oficina só vale FORA das Configurações, da aba Integrações e das partes protegidas (o @scope
  // corta tudo o que está dentro delas); dentro das Configurações, só no lugar das opções dela mesma
  const LIMITES = '.cfg-raiz, .cfg-sub, .integ-aba, [data-protegido], .ig-opcoes, .menu-ctx, .fundo-modal';
  const escopado = (css, id) => {
    const r = I.sanitizar(css, id); if (!r.css && !r.kfs) return '';
    return '@scope (body) to (' + LIMITES + ') {\n' + r.css + '}\n@scope (.ig-opcoes[data-ig="' + id + '"]) {\n' + r.css + '}\n' + r.kfs;
  };

  // ---------- (0.8.7) a oficina: o pacote de uma integração feita por alguém ----------
  // Um CSS puro, ou um pacote .json: { id, nome, autor, descricao, css, opcoes, sons, barras, bolhas, presets }. Nada disso é código:
  // as opções viram atributos e variáveis no <body> (data-ig-<id>-<opção>, --ig-<id>-<opção>), os sons são notas descritas (o app é
  // que toca), as barras e as bolhas são estilos a mais que você escolhe nas opções dela e os presets só mudam valores da Aparência.
  const slug = (v, n = 24) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
  const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
  const HEX = /^#[0-9a-f]{6}$/i;
  const ONDAS = new Set(['sine', 'square', 'triangle', 'sawtooth', 'ruido']);
  let notasGuardadas = null; // (1.0.2) a última lista de notas da aba Integrações (ver abaixo)
  const notas = (l) => (Array.isArray(l) ? l : []).slice(0, 6).map((n) => n && typeof n === 'object' ? {
    o: ONDAS.has(n.o) ? n.o : 'sine', f: A.limitar(+n.f || 800, 40, 9000), ate: n.ate ? A.limitar(+n.ate, 40, 9000) : 0,
    dur: A.limitar(+n.dur || 0.06, 0.005, 0.4), vol: A.limitar(+n.vol || 0.1, 0.01, 0.3), em: A.limitar(+n.atraso || 0, 0, 0.3), q: A.limitar(+n.q || 1, 0.3, 12),
  } : null).filter(Boolean);
  // (0.8.7) a imagem da integração: quem fez coloca no pacote (PNG, JPG, WebP ou GIF embutido, sem link para fora, até ~300 KB)
  const imagemOk = (u) => (typeof u === 'string' && u.length < 420000 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(u) ? u : '');
  I.imagemOk = imagemOk;
  const iconeOk = (u) => (u && u.length < 160000 ? imagemOk(u) : ''); // (1.0.3) o ícone de quem fez (a bolha redonda, separada do banner)
  I.iconeOk = iconeOk;
  I.lerPacote = (texto) => {
    const bruto = String(texto || '').trim();
    let j = null; if (bruto.startsWith('{')) { try { j = JSON.parse(bruto); } catch (e) { throw new Error(T('O pacote .json tem um erro de escrita.', 'The .json package has a syntax error.')); } }
    if (!j) j = { css: bruto };
    if (typeof j !== 'object' || Array.isArray(j)) throw new Error(T('Pacote inválido.', 'Invalid package.'));
    const nome = txt(j.nome, 40) || T('Minha integração', 'My integration');
    const id = slug(j.id || nome) || 'tema';
    const opcoes = (Array.isArray(j.opcoes) ? j.opcoes : []).slice(0, 16).map((o) => {
      if (!o || typeof o !== 'object') return null;
      const oid = slug(o.id, 20); if (!oid) return null;
      const tipo = ['chave', 'cor', 'escolha', 'numero'].includes(o.tipo) ? o.tipo : 'chave';
      const r = { id: oid, tipo, rotulo: txt(o.rotulo, 50) || oid, dica: txt(o.dica, 120) };
      if (tipo === 'chave') r.padrao = !!o.padrao;
      if (tipo === 'cor') r.padrao = HEX.test(o.padrao) ? o.padrao : '#2d9ee0';
      if (tipo === 'numero') { r.min = A.limitar(+o.min || 0, -500, 500); r.max = A.limitar(+o.max || 100, r.min + 1, 1000); r.padrao = A.limitar(+o.padrao || r.min, r.min, r.max); r.un = /^(px|%|deg|s|ms|em)$/.test(o.unidade) ? o.unidade : ''; }
      if (tipo === 'escolha') { r.valores = (Array.isArray(o.valores) ? o.valores : []).slice(0, 8).map((v) => (Array.isArray(v) ? [slug(v[0], 20), txt(v[1], 30)] : [slug(v, 20), txt(v, 30)])).filter((v) => v[0]); if (!r.valores.length) return null; r.padrao = r.valores.some((v) => v[0] === o.padrao) ? o.padrao : r.valores[0][0]; }
      return r;
    }).filter(Boolean);
    const sons = j.sons && typeof j.sons === 'object' ? { nome: txt(j.sons.nome, 30) || nome, normal: (Array.isArray(j.sons.normal) && Array.isArray(j.sons.normal[0]) ? j.sons.normal : [j.sons.normal]).slice(0, 4).map(notas).filter((x) => x.length), espaco: notas(j.sons.espaco), apagar: notas(j.sons.apagar), enter: notas(j.sons.enter) } : null;
    if (sons && !sons.normal.length) sons.normal = [[{ o: 'sine', f: 900, ate: 0, dur: 0.05, vol: 0.1, em: 0, q: 1 }]];
    const lista = (l, n) => (Array.isArray(l) ? l : []).slice(0, n).map((b) => (b && slug(b.id, 20) ? { id: slug(b.id, 20), nome: txt(b.nome, 30) || slug(b.id, 20) } : null)).filter(Boolean);
    // (0.9.5) as bolhas: as de CSS (só id e nome) e as de arte do estúdio (reconferidas em bolhaarte.js)
    const bolhasDe = (l) => lista(l, 6).map((b, i) => { const o = (Array.isArray(l) ? l : []).find((z) => z && slug(z.id, 20) === b.id); if (!o || o.arte === undefined) return b; const arte = A.bolhaArte && A.bolhaArte.validar(o.arte); return arte ? { ...b, arte } : null; void i; }).filter(Boolean);
    // (1.0.2) molduras da foto e anéis de quem fala (só a imagem e números, reconferidos em bolhaarte.js)
    const fotosDe = (l, anel) => (Array.isArray(l) ? l : []).slice(0, 6).map((b) => { const id = b && slug(b.id, 20), arte = id && A.bolhaArte && A.bolhaArte.validarFoto(b.arte, anel); return arte ? { id, nome: txt(b.nome, 30) || id, arte } : null; }).filter(Boolean);
    const presets = (Array.isArray(j.presets) ? j.presets : []).slice(0, 8).map((p) => (p && p.tema && typeof p.tema === 'object' ? { nome: txt(p.nome, 30) || 'Preset', tema: p.tema } : null)).filter(Boolean);
    const css = String(j.css || '').slice(0, 60000);
    const r = I.sanitizar(css, id);
    return { id, nome, autor: txt(j.autor, 40), desc: txt(j.descricao || j.desc, 600), versao: txt(j.versao, 12), imagem: imagemOk(j.imagem), icone: iconeOk(j.icone), css, opcoes, sons, barras: lista(j.barras, 6), bolhas: bolhasDe(j.bolhas), presets, molduras: fotosDe(j.molduras, false), aneis: fotosDe(j.aneis, true), tirados: r.tirados };
  };
  // as opções, as barras e as bolhas de cada integração ligada viram atributos no <body>; os sons entram nos sons de digitação
  const marcados = new Set();
  function extras() {
    const b = document.body; if (!b) return;
    const quer = new Map(), vars = new Map();
    let barra = '', bolha = '';
    for (const [chave, x] of Object.entries(cfg())) {
      if (!x || !x.pac) continue;
      const p = x.pac, on = x.on && !x.trava, vals = x.vals || {};
      if (A.digitar && A.digitar.registrar) A.digitar.registrar('ig-' + p.id, on && p.sons ? p.sons : null);
      if (!on) continue;
      for (const o of p.opcoes || []) {
        let v = vals[o.id] != null ? vals[o.id] : o.padrao;
        if (o.tipo === 'chave') v = v ? 'sim' : 'nao';
        else if (o.tipo === 'cor') v = HEX.test(v) ? v : o.padrao;
        else if (o.tipo === 'numero') v = A.limitar(+v, o.min, o.max);
        else if (!o.valores.some((z) => z[0] === v)) v = o.padrao;
        quer.set('data-ig-' + p.id + '-' + o.id, String(v));
        vars.set('--ig-' + p.id + '-' + o.id, o.tipo === 'numero' ? v + (o.un || '') : String(v));
      }
      if (x.barra && (p.barras || []).some((z) => z.id === x.barra)) barra = p.id + '-' + x.barra;
      if (x.bolha && (p.bolhas || []).some((z) => z.id === x.bolha)) bolha = p.id + '-' + x.bolha;
      void chave;
    }
    if (barra) quer.set('data-ig-barra', barra); if (bolha) quer.set('data-ig-bolha', bolha);
    for (const k of [...marcados]) if (!quer.has(k) && !vars.has(k)) { if (k.startsWith('--')) b.style.removeProperty(k); else b.removeAttribute(k); marcados.delete(k); }
    for (const [k, v] of quer) { if (b.getAttribute(k) !== v) b.setAttribute(k, v); marcados.add(k); }
    for (const [k, v] of vars) { b.style.setProperty(k, v); marcados.add(k); }
  }
  // os presets: só mudam valores que já existem na Aparência, do mesmo tipo (nada de imagem, nada de texto comprido)
  I.aplicarPreset = (p) => {
    const t = A.cfg.v.tema; if (!t || !p || !p.tema) return 0;
    let n = 0;
    for (const [k, v] of Object.entries(p.tema)) {
      if (!(k in t) || /imagem|fundoImg|^img/i.test(k) || typeof t[k] !== typeof v || t[k] === null) continue;
      if (typeof v === 'string' && (v.length > 40 || /[()<>\;{}]/.test(v))) continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      if (typeof v === 'object') continue;
      t[k] = v; n++;
      if (A.tema && A.tema.AVANCADAS && A.tema.AVANCADAS.includes(k)) t.avancado = true; // (1.0.2) senão a cor do pacote não aparecia
    }
    if (n) { A.cfg.salvar(); if (A.tema && A.tema.aplicar) A.tema.aplicar(); A.evt.emit('tema'); }
    return n;
  };
  I.instalarPacote = (pac, chave, com) => {
    chave = chave || 'loc-' + pac.id; const c = cfg(), antes = c[chave];
    const { tirados, ...guardar } = pac; void tirados;
    c[chave] = { on: true, em: Date.now(), pac: guardar, vals: antes && antes.vals ? antes.vals : {}, barra: antes ? antes.barra : '', bolha: antes ? antes.bolha : '', ...(com ? { com } : {}) };
    salvar(); I.aplicar(); A.evt.emit('integ:mudou'); A.som.tocar('bolha-cresce');
    return chave;
  };
  I.locais = () => Object.entries(cfg()).filter(([, x]) => x && x.pac).map(([chave, x]) => ({ chave, ...x }));
  // o lugar das opções de cada integração, nas Configurações (o app desenha; a integração só diz quais opções existem)
  I.secoesConfig = () => I.locais().map((x) => {
    const p = x.pac, sec = h('section', { class: 'vidro pad ig-opcoes', dados: { ig: p.id } }, h('h3', {}, p.nome));
    const guardar = (k, v) => { const y = cfg()[x.chave]; if (!y) return; y.vals = { ...(y.vals || {}), [k]: v }; salvar(); extras(); };
    const corpo = h('div', { class: 'col', estilo: { gap: '6px' } });
    if (!x.on || x.trava) corpo.append(h('div', { class: 'peq suave' }, x.trava ? T('Desligada pela trava de segurança.', 'Turned off by the safety lock.') : T('Desligada (ligue na aba Integrações).', 'Turned off (turn it on in the Integrations tab).')));
    const linha = (rot, ctl, dica) => h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, rot), dica ? h('div', { class: 'peq suave' }, dica) : null), ctl);
    for (const o of p.opcoes || []) {
      const v = (x.vals || {})[o.id] != null ? x.vals[o.id] : o.padrao;
      let ctl;
      if (o.tipo === 'chave') ctl = U.chave(!!v, (n) => guardar(o.id, !!n));
      else if (o.tipo === 'cor') { ctl = h('input', { type: 'color', class: 'campo-cor', value: HEX.test(v) ? v : o.padrao }); ctl.addEventListener('input', () => guardar(o.id, ctl.value)); }
      else if (o.tipo === 'numero') ctl = h('div', { estilo: { 'min-width': '180px' } }, U.slider({ min: o.min, max: o.max, valor: +v, oninput: (n) => guardar(o.id, +n) }));
      else ctl = U.seg(o.valores, v, (n) => guardar(o.id, n));
      corpo.append(linha(o.rotulo, ctl, o.dica));
    }
    const escolhaDe = (lista, k, rot) => { if (!(lista || []).length) return; corpo.append(linha(rot, U.seg([['', T('Do app', 'App\'s')], ...lista.map((z) => [z.id, z.nome])], x[k] || '', (n) => { const y = cfg()[x.chave]; if (y) { y[k] = n; salvar(); extras(); } }))); };
    escolhaDe(p.barras, 'barra', T('Barra das abas', 'Tab bar'));
    escolhaDe((p.bolhas || []).filter((b) => !b.arte), 'bolha', T('Bolhas de conversa', 'Chat bubbles')); // (0.9.5) as de arte se escolhem em Aparência
    if (p.sons) corpo.append(linha(T('Sons de digitação', 'Typing sounds'), h('span', { class: 'peq suave' }, T('"' + p.sons.nome + '" aparece em Chats e sons > Digitação.', '"' + p.sons.nome + '" shows up in Chats and sounds > Typing.'))));
    if ((p.presets || []).length) corpo.append(h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '6px' } }, ...p.presets.map((pr) => U.btn(pr.nome, { tipo: 'sec', peq: true, icone: 'oPaleta', onclick: () => { const n = I.aplicarPreset(pr); A.som.tocar(n ? 'sucesso' : 'erro'); U.toast(n ? T('Preset aplicado.', 'Preset applied.') : T('Este preset não muda nada.', 'This preset changes nothing.')); } }))));
    if (!corpo.children.length) corpo.append(h('div', { class: 'peq suave' }, T('Esta integração não tem opções.', 'This integration has no options.')));
    sec.append(corpo);
    return sec;
  });

  // ---------- instaladas (guardadas neste aparelho; com a sincronização ligada, seguem a conta) ----------
  const cfg = () => { const v = A.cfg.v; if (!v.integ || typeof v.integ !== 'object') v.integ = {}; return v.integ; };
  const salvar = () => A.cfg.salvar();
  I.instalada = (id) => !!cfg()[id];
  I.ligada = (id) => !!(cfg()[id] && cfg()[id].on && !cfg()[id].trava);
  let caixaCss = null;
  const caixa = () => { if (!caixaCss || !caixaCss.isConnected) { caixaCss = h('div', { id: 'integ-estilos', hidden: true }); document.head.append(caixaCss); } return caixaCss; };
  I.aplicar = () => {
    const c = caixa(), quer = new Set();
    for (const [id, x] of Object.entries(cfg())) {
      if (!x || !x.on || x.trava) continue;
      const of = porId(id); const css = of ? of.css : x.pac ? x.pac.css : x.css; if (!css) continue;
      quer.add(id);
      let st = c.querySelector(`style[data-id="${id}"]`);
      const limpo = x.pac ? escopado(css, x.pac.id) : I.sanitizar(css).css;
      if (!st) { st = h('style', { dados: { id } }); c.append(st); }
      if (st.textContent !== limpo) st.textContent = limpo;
    }
    for (const st of [...c.querySelectorAll('style')]) if (!quer.has(st.dataset.id)) st.remove();
    extras();
    vigiar();
  };
  // a vigia: uma parte protegida que está para aparecer (o pai aparece) mas sumiu ou ficou apagada -> descobre qual integração foi e desliga
  const escondida = (el) => {
    const pai = el.parentElement; if (!pai || !pai.getClientRects().length || el.hidden) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility !== 'visible' || parseFloat(cs.opacity) < 0.5 || r.width < 8 || r.height < 8 || cs.clipPath !== 'none' || /blur\((?:[3-9]|\d\d)/.test(cs.filter)) return true;
    // (0.9.1) e os de fora dela: apagar o app inteiro (body, a janela, a coluna) também esconde a parte protegida
    let op = 1;
    for (let a = pai; a && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a); op *= parseFloat(c.opacity) || 0;
      if (op < 0.5 || /blur\((?:[3-9]|\d\d)|opacity\(0?\.[0-4]|brightness\(0?\.[0-2]/.test(c.filter) || (c.clipPath !== 'none' && !a.matches('.orbe, .avatar'))) return true;
    }
    const vw = innerWidth, vh = innerHeight; // empurrada para fora da tela
    return r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh;
  };
  function conferir() {
    const ests = [...caixa().querySelectorAll('style')]; if (!ests.length) return;
    const suspeitas = [...document.querySelectorAll('[data-protegido]')].filter(escondida); if (!suspeitas.length) return;
    for (const st of ests) {
      st.disabled = true;
      const limpou = suspeitas.some((el) => !escondida(el));
      st.disabled = false;
      if (limpou) { const x = cfg()[st.dataset.id]; if (x) { x.trava = 1; x.on = false; } st.remove(); A.log.aviso('integração desligada pela trava: ' + st.dataset.id); }
    }
    salvar(); A.evt.emit('integ:mudou');
  }
  let tVigia = 0;
  function vigiar() { clearInterval(tVigia); tVigia = 0; if (caixa().querySelector('style')) tVigia = setInterval(conferir, 3000); }
  I.instalar = async (id, sim, extra) => {
    const c = cfg();
    if (sim) c[id] = { on: true, em: Date.now(), ver: porId(id) ? verOf(porId(id)) : 1, ...(extra || {}) }; else delete c[id];
    salvar(); I.aplicar(); A.evt.emit('integ:mudou');
    A.som.tocar(sim ? 'bolha-cresce' : 'bolha-estoura');
    try { if (A.api && A.api.token) await A.api.req('integ/' + id + '/instalar', { sim }); } catch (e) { /* a contagem é só estatística */ }
  };
  // (0.9.5) instalada em outro aparelho (veio pela conta): as da Comunidade chegam sem o pacote; ele vem do servidor e passa pelas travas daqui
  let completando = false;
  I.completar = async () => {
    if (completando || !A.api || !A.api.token) return; completando = true;
    try {
      let mudou = false;
      for (const [k, x] of Object.entries(cfg())) {
        if (!x || x.pac || !x.com || !x.com.id) continue;
        try {
          const d = await A.api.req('integ/' + encodeURIComponent(x.com.id) + '/pacote');
          const pk = I.lerPacote(JSON.stringify({ ...d.pac, id: x.com.id, autor: d.autor, imagem: d.imagem || '', icone: d.icone || '' }));
          const { tirados, ...guardar } = pk; void tirados;
          const y = cfg()[k]; if (y && !y.pac) { y.pac = guardar; mudou = true; }
        } catch (e) { A.log.aviso('integração da conta sem pacote: ' + x.com.id); }
      }
      if (mudou) { salvar(); I.aplicar(); A.evt.emit('integ:mudou'); }
    } finally { completando = false; }
  };
  I.escopado = escopado; I.escondida = escondida; // (1.0.0) as skins (.aer, aer.js) usam as mesmas travas
  // (0.8.7) instalada fica instalada (guardada neste aparelho). Saiu uma versão nova: ela continua funcionando e mostra "Atualizar"
  const verOf = (x) => Math.max(1, +(x && x.versao) || 1);
  I.precisaAtualizar = (id) => { const x = cfg()[id], of = porId(id); return !!(x && of && verOf(of) > (+x.ver || 1)); };
  I.atualizar = (id) => { const x = cfg()[id], of = porId(id); if (!x || !of) return; x.ver = verOf(of); salvar(); I.aplicar(); A.evt.emit('integ:mudou'); A.som.tocar('bolha-cresce'); };
  I.ligar = (id, on) => { const x = cfg()[id]; if (!x) return; x.on = !!on; if (on) delete x.trava; salvar(); I.aplicar(); A.evt.emit('integ:mudou'); };
  // ligadas desde a abertura do app
  try { I.aplicar(); } catch (e) { A.log.erro('integrações', e); }
  A.evt.on('hub:eu', () => setTimeout(() => I.completar(), 4000));
  // (0.9.1) modo seguro: Ctrl+Alt+Shift+S desliga TODAS as integrações (para o caso de alguma deixar o app impossível de usar)
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's'))) return;
    let n = 0; for (const x of Object.values(cfg())) if (x && x.on) { x.on = false; n++; }
    if (!n) return; salvar(); I.aplicar(); A.evt.emit('integ:mudou'); U.toast(T('Modo seguro: todas as integrações foram desligadas.', 'Safe mode: all integrations were turned off.'), { ms: 3500 });
  }, true);

  // ---------- (1.0.2) os tipos genéricos do catálogo: os textos deles ficam aqui; os de cada integração vêm do catálogo ----------
  const hostDe = (u) => { try { return new URL(u).host; } catch (e) { return ''; } };
  const seloBloqueio = (x, grande) => h('span', { class: 'ig-selo breve' + (grande ? ' grande' : '') }, x.bloqueio === 'app' ? T('Atualize o app', 'Update the app') : x.bloqueio === 'plat' ? ondeFunciona(x)
    : (((A.extras && A.extras.PLANOS && A.extras.PLANOS[x.cat.plano]) || [])[1] || 'Aero Bubble') + '+');
  const NOME_PLAT = () => ({ pc: 'PC', web: T('site', 'web'), celular: T('celular', 'phone') });
  const ondeFunciona = (x) => T('Só no ', 'Only on ') + ((x.cat && x.cat.plataformas) || []).map((p) => NOME_PLAT()[p] || p).join(T(' e no ', ' & '));
  const textoBloqueio = (x) => (x.bloqueio === 'plat' ? T('Esta integração funciona no ', 'This integration works on ') + ((x.cat && x.cat.plataformas) || []).map((p) => NOME_PLAT()[p] || p).join(T(' e no ', ' and ')) + T('. Instale por lá.', '. Install it there.') : x.bloqueio === 'app' ? T('Esta integração precisa de uma versão mais nova do Aero. Atualize o app para usar.', 'This integration needs a newer version of Aero. Update the app to use it.')
    : T('Disponível para quem assina o plano ', 'Available to subscribers of the ') + ((((A.extras && A.extras.PLANOS && A.extras.PLANOS[x.cat.plano]) || [])[1]) || 'Aero Bubble') + T(' ou acima.', ' plan or above.'));
  const seguroDoTipo = (x) => (x.gen === 'link' ? [T('Só abre ', 'Only opens ') + hostDe(x.cat.url) + T(' no seu navegador, e o Aero pergunta antes.', ' in your browser, and Aero asks first.'), T('Não lê as suas conversas nem manda nada seu para o site.', 'Does not read your chats or send anything of yours to the site.')]
    : x.gen === 'janela' ? [T('Só mostra textos e links numa janela do Aero: não roda código.', 'Only shows text and links in an Aero window: runs no code.'), T('Não lê as suas conversas.', 'Does not read your chats.')]
      : [T('Feita pela equipe do Aero e revisada como o resto do app.', 'Made by the Aero team and reviewed like the rest of the app.')]);
  // abrir um link: sempre pergunta, mostrando o site
  const abrirLink = async (url) => {
    if (!/^https:\/\//.test(url)) return;
    if (await U.confirmar(T('Abrir ', 'Open ') + hostDe(url) + T(' no navegador?', ' in the browser?'), { sim: T('Abrir', 'Open') })) U.abrirFora(url);
  };
  // a janela: montada aqui, só com texto (nada do catálogo vira HTML)
  const janela = (c) => {
    const corpo = h('div', { class: 'ig-janela selecionavel', estilo: { 'overflow-wrap': 'anywhere' } }, ...c.blocos.map((b) => b.t === 'titulo' ? h('h3', {}, K().texto(b.x))
      : b.t === 'lista' ? h('ul', {}, ...b.itens.map((i) => h('li', {}, K().texto(i))))
        : b.t === 'link' ? h('p', {}, h('button', { type: 'button', class: 'link-txt ig-janela-link', estilo: { background: 'none', border: '0', padding: '0', font: 'inherit', display: 'inline-flex', 'align-items': 'center', gap: '4px' }, onclick: () => abrirLink(b.url) }, A.icone('externo', 13), ' ', K().texto(b.x)))
          : h('p', {}, K().texto(b.x))));
    U.modal(K().texto(c.nome), corpo, { largura: 440 });
  };
  // usar uma integração 'link' ou 'janela' (da página dela ou da barra da chamada)
  I.usar = (id) => {
    const c = K() && K().porId(id); if (!c || K().bloqueio(c) || !I.ligada(id)) return;
    if (c.tipo === 'link') abrirLink(c.url); else if (c.tipo === 'janela') janela(c);
  };
  // as que ganham botão na barra da chamada (instaladas, ligadas e que este app sabe usar)
  I.daChamada = () => (K() ? K().lista().filter((c) => (c.tipo === 'link' || c.tipo === 'janela') && (c.lugares || []).includes('chamada') && K().nestaPlataforma(c) && !K().bloqueio(c) && I.ligada(c.id))
    .map((c) => ({ id: c.id, icone: c.icone, nome: K().texto(c.nome), curto: c.curto ? K().texto(c.curto) : '', acao: () => I.usar(c.id) })) : []);
  // o nome (e o curto) de uma oficial, para quem mostra um botão dela
  I.nomeDe = (id, padrao) => { const c = K() && K().porId(id); return c ? K().texto(c.nome) : padrao; };
  I.curtoDe = (id, padrao) => { const c = K() && K().porId(id); return c && c.curto ? K().texto(c.curto) : padrao; };

  // ---------- as cenas de demonstração (desenhadas em CSS, sem imagem de fora) ----------
  const cena = (tipo, grande) => {
    const c = h('div', { class: 'ig-cena ig-c-' + tipo + (grande ? ' grande' : ''), 'aria-hidden': 'true' });
    const jan = (k) => h('div', { class: 'ig-jan ' + (k || '') }, h('i'), h('i'), h('i'));
    if (tipo === 'vidro') c.append(h('div', { class: 'ig-orbe a' }), h('div', { class: 'ig-orbe b' }), jan('fosco'));
    else if (tipo === 'cantos') c.append(jan('redonda'), h('div', { class: 'ig-botoes' }, h('b'), h('b'), h('b')));
    else if (tipo === 'compacto') c.append(h('div', { class: 'ig-linhas' }, ...Array.from({ length: 7 }, (_, i) => h('i', { estilo: { '--i': i } }))));
    else if (tipo === 'halo') c.append(...[0, 1, 2].map((i) => h('div', { class: 'ig-foto', estilo: { '--i': i } })));
    else if (tipo === 'musica') c.append(h('div', { class: 'ig-disco' }), h('div', { class: 'ig-ondas' }, ...Array.from({ length: 9 }, (_, i) => h('i', { estilo: { '--i': i } }))));
    else if (tipo === 'favoritos') c.append(...[0, 1, 2, 3].map((i) => h('div', { class: 'ig-poster', estilo: { '--i': i } })), h('div', { class: 'ig-estrela' }));
    else if (tipo === 'gunslol') c.append(h('div', { class: 'ig-gl' }, h('div', { class: 'ig-gl-av' }), h('div', { class: 'ig-gl-txt' }, h('i'), h('i')), h('div', { class: 'ig-gl-mira' })));
    else if (tipo === 'pasta') c.append(h('div', { class: 'ig-pasta' }, h('i'), h('i'), h('i')));
    return c;
  };
  // (1.0.3) a cabeça do cartão, como no perfil: o banner em cima (a imagem de quem fez ou a cor da integração) e o ícone numa bolha
  // separada, metade para fora do banner. Tudo parado (sem animação)
  const COR_INTEG = { musica: ['#4ade80', '#0f8a4a'], celmic: ['#7dd3fc', '#1d6fd1'], gunslol: ['#c4b5fd', '#6d3fd6'], assistindo: ['#fda4af', '#c8284e'], traducao: ['#fcd34d', '#d0780c'], dicionario: ['#99f6e4', '#0d8f80'], horario: ['#f9a8d4', '#b8338a'] };
  const PALETA = [['#7dd3fc', '#1d6fd1'], ['#4ade80', '#0f8a4a'], ['#fda4af', '#c8284e'], ['#fcd34d', '#d0780c'], ['#c4b5fd', '#6d3fd6'], ['#99f6e4', '#0d8f80'], ['#f9a8d4', '#b8338a'], ['#fdba74', '#c2410c'], ['#a5b4fc', '#3f4fc9'], ['#bef264', '#4d8a0c']];
  const corInteg = (id) => { if (COR_INTEG[id]) return COR_INTEG[id]; let n = 0; for (const c of String(id || '')) n = (n * 31 + c.charCodeAt(0)) >>> 0; return PALETA[n % PALETA.length]; };
  const bannerInteg = (id, icone, grande, imagem, iconeImg) => {
    const [c1, c2] = corInteg(id);
    const capa = h('div', { class: 'ig-capa ig-banner' + (grande ? ' grande' : ''), 'aria-hidden': 'true' });
    const av = h('div', { class: 'ig-av', 'aria-hidden': 'true' });
    const c = h('div', { class: 'ig-cabeca' + (grande ? ' grande' : ''), estilo: { '--b1': c1, '--b2': c2 } }, capa, av);
    c.definir = (img, ic) => {
      if (img) capa.replaceChildren(h('img', { src: img, alt: '', draggable: 'false' }));
      else capa.replaceChildren(h('span', { class: 'ig-banner-marca' }, A.icone(icone, grande ? 150 : 96)));
      capa.classList.toggle('com-img', !!img);
      if (ic) { av.className = 'ig-av com-img'; av.replaceChildren(h('img', { src: ic, alt: '', draggable: 'false' })); }
      else { const o = A.orbe(icone, grande ? 84 : 56); o.classList.add('ig-av-orbe'); o.style.setProperty('--o1', c1); o.style.setProperty('--o2', c2); av.className = 'ig-av'; av.replaceChildren(o); }
    };
    c.definir(imagem, iconeImg);
    return c;
  };
  const capaInteg = (x, grande) => bannerInteg(x.id, x.icone || (tipos()[x.tipo] || ['', 'apps'])[1], grande, x.imagem || (x.pac && x.pac.imagem), x.pac && x.pac.icone);
  const reais = (v) => (v ? 'R$ ' + (+v).toFixed(2).replace('.', ',') : T('Grátis', 'Free')); // (1.0.3) as integrações pagas da Comunidade
  const estrelas = (n, tam = 14) => h('span', { class: 'ig-estrelas', 'aria-label': n.toFixed(1) + T(' de 5 estrelas', ' of 5 stars'), estilo: { '--n': String(n), '--t': tam + 'px' } }, '★★★★★');
  const quando = (t) => { const d = (Date.now() - t) / 1000; if (d < 60) return T('agora', 'now'); if (d < 3600) return Math.floor(d / 60) + ' min'; if (d < 86400) return Math.floor(d / 3600) + ' h'; return new Date(t).toLocaleDateString(); };

  // ---------- a aba ----------
  A.abas.integ = (el) => {
    let notas = (notasGuardadas && Date.now() - notasGuardadas.t < 60000 && notasGuardadas.d) || { oficiais: {}, comunidade: [], minhas: {} }, origem = 'oficiais', filtro = 'tudo', busca = '', aberta = null;
    const offs = [];
    el.classList.add('integ-aba'); el.dataset.protegido = '1';
    const titulo = h('h2', {}, T('Integrações', 'Integrations'));
    const segOrigem = U.seg([['oficiais', T('Oficiais', 'Official'), 'oInteg'], ['comunidade', T('Comunidade', 'Community'), 'pessoas']], origem, (v) => { origem = v; A.som.tocar('click'); if (v === 'comunidade') avisoComunidade().then((sim) => { if (!sim) { origem = 'oficiais'; segOrigem.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === 0)); pintarChips(); pintar(); } }); pintarChips(); pintar(); });
    const campo = h('input', { class: 'campo ig-busca', type: 'search', placeholder: T('Buscar integrações', 'Search integrations'), oninput: (e) => { busca = e.target.value.trim().toLowerCase(); pintar(); } });
    const chips = h('div', { class: 'ig-chips' });
    const grade = h('div', { class: 'ig-grade' });
    const pagina = h('div', { class: 'ig-pagina', hidden: true });
    // (1.0.3) o Estúdio manda as artes dele para o mesmo "Publicar na Comunidade"
    I.publicarDoEstudio = (pac) => criar({ publicar: true, pac });
    const btCriar = U.btn(T('Instalar a sua', 'Install your own'), { icone: 'mais', peq: true, onclick: () => avisoComunidade().then((sim) => { if (sim) criar(); }) });
    const lista = h('div', { class: 'ig-lista' }, h('div', { class: 'ig-topo' }, segOrigem, campo, btCriar), chips, grade);
    el.append(h('div', { class: 'cab' }, titulo, h('span', { class: 'suave peq' }, T('Deixe o Aero do seu jeito', 'Make Aero your own'))), lista, pagina);

    const pintarChips = () => {
      if (origem === 'comunidade') { // (0.9.1) as categorias da Comunidade
        if (!['tudo', 'minhas', 'publicadas', ...Object.keys(CATS())].includes(filtro)) filtro = 'tudo';
        chips.replaceChildren(...[['tudo', T('Tudo', 'All')], ...Object.entries(CATS()).map(([k, v]) => [k, v[0]]), ['minhas', T('Instaladas', 'Installed')], ...(notas.podePublicar ? [['publicadas', T('Minhas publicações', 'My uploads')]] : [])].map(([k, nome]) =>
          h('button', { type: 'button', class: 'ig-chip' + (filtro === k ? ' sel' : ''), onclick: () => { filtro = k; A.som.tocar('click'); pintarChips(); pintar(); } }, CATS()[k] ? A.icone(CATS()[k][1], 13) : null, nome)));
        return;
      }
      if (!['tudo', 'minhas', ...Object.keys(tipos())].includes(filtro)) filtro = 'tudo';
      chips.replaceChildren(...[['tudo', T('Tudo', 'All')], ...Object.entries(tipos()).filter(([k]) => oficiais().some((x) => x.tipo === k)).map(([k, v]) => [k, v[0]]), ['minhas', T('Instaladas', 'Installed')]].map(([k, nome]) =>
        h('button', { type: 'button', class: 'ig-chip' + (filtro === k ? ' sel' : ''), onclick: () => { filtro = k; A.som.tocar('click'); pintarChips(); pintar(); } }, nome)));
    };
    // (0.8.7) as suas (instaladas pela oficina) aparecem junto, como tema
    const locaisComo = () => I.locais().filter((y) => !y.com).map((y) => ({ id: y.chave, local: true, tipo: 'tema', cena: 'vidro', nome: y.pac.nome, resumo: y.pac.desc || (y.pac.autor ? T('Por ', 'By ') + y.pac.autor : T('Instalada por você', 'Installed by you')), pac: y.pac }));
    const cartao = (x, i) => {
      const n = notas.oficiais[x.id] || { nota: 0, votos: 0, inst: 0 }, inst = I.instalada(x.id);
      return h('button', { type: 'button', class: 'ig-cartao vidro' + (inst ? ' instalada' : ''), estilo: { '--i': Math.min(i, 12) }, onclick: () => abrir(x) },
        capaInteg(x),
        h('div', { class: 'ig-cartao-txt' },
          h('div', { class: 'ig-cartao-nome' }, h('b', {}, x.nome), x.emBreve ? h('span', { class: 'ig-selo breve' }, T('Em breve', 'Soon')) : x.bloqueio && !inst ? seloBloqueio(x) : inst && I.precisaAtualizar(x.id) ? h('span', { class: 'ig-selo novo' }, A.icone('download', 11), T('Atualizar', 'Update')) : inst ? h('span', { class: 'ig-selo ok' }, I.ligada(x.id) ? T('Ligada', 'On') : T('Instalada', 'Installed')) : null),
          h('div', { class: 'suave peq ig-cartao-resumo' }, x.resumo),
          h('div', { class: 'ig-cartao-pe' }, h('span', { class: 'ig-tipo' }, A.icone(tipos()[x.tipo][1], 13), tipos()[x.tipo][0]), n.votos ? h('span', { class: 'ig-nota' }, estrelas(n.nota, 12), h('small', {}, n.nota.toFixed(1))) : h('small', { class: 'suave' }, T('Sem notas', 'No ratings')))));
    };
    function pintar(semAnim) {
      if (aberta) return;
      grade.classList.toggle('ja', !!semAnim); // (0.9.0) as notas chegando só trocam os cartões, sem a animação de entrada de novo
      if (origem === 'comunidade') { pintarComunidade(); return; }
      if (origem === 'antiga') {
        grade.replaceChildren(h('div', { class: 'ig-vazio vidro interno' }, A.icone('pessoas', 34), h('b', {}, T('A Comunidade está chegando', 'Community is coming')),
          h('p', { class: 'suave' }, T('Em breve quem assina o Supporter vai poder publicar integrações aqui, e qualquer pessoa vai poder instalar.', 'Soon Supporter subscribers will be able to publish integrations here, and anyone will be able to install them.'))));
        return;
      }
      const itens = [...oficiais(), ...locaisComo()].filter((x) => (filtro === 'tudo' || (filtro === 'minhas' ? I.instalada(x.id) : x.tipo === filtro)) && (!busca || (x.nome + ' ' + x.resumo).toLowerCase().includes(busca)));
      grade.replaceChildren(...(itens.length ? itens.map(cartao) : [h('div', { class: 'ig-vazio vidro interno' }, h('b', {}, T('Nada encontrado', 'Nothing found')))]));
    }
    // ---------- (0.9.1) a Comunidade ----------
    const imgs = new Map(); // id -> Promise da imagem (pedida uma vez, só quando o cartão aparece)
    const imagemCom = (x) => { if (!x.img && !x.ic) return Promise.resolve({}); if (!imgs.has(x.id + '@' + x.atual)) imgs.set(x.id + '@' + x.atual, A.api.req('integ/' + x.id + '/imagem').then((d) => ({ img: I.imagemOk(d.imagem || ''), ic: I.iconeOk(d.icone || '') })).catch(() => ({}))); return imgs.get(x.id + '@' + x.atual); };
    const comInstalada = (id) => cfg()['com-' + id];
    const capaCom = (x, grande) => {
      const c = bannerInteg(x.id, (CATS()[x.cat] || CATS().misc)[1], grande);
      imagemCom(x).then((u) => { if (u.img || u.ic) c.definir(u.img, u.ic); });
      return c;
    };
    const cartaoCom = (x, i) => {
      const inst = comInstalada(x.id), velha = inst && inst.com && (inst.com.atual || 0) < (x.atual || 0);
      return h('button', { type: 'button', class: 'ig-cartao vidro' + (inst ? ' instalada' : ''), estilo: { '--i': Math.min(i, 12) }, onclick: () => abrirCom(x) },
        capaCom(x),
        h('div', { class: 'ig-cartao-txt' },
          h('div', { class: 'ig-cartao-nome' }, h('b', {}, x.nome), x.oculta ? h('span', { class: 'ig-selo breve' }, T('Em revisão', 'Under review')) : velha ? h('span', { class: 'ig-selo novo' }, T('Atualização', 'Update')) : inst ? h('span', { class: 'ig-selo ok' }, T('Instalada', 'Installed')) : x.preco ? h('span', { class: 'ig-selo preco' }, reais(x.preco)) : null),
          h('div', { class: 'suave peq ig-cartao-resumo' }, x.resumo || T('Por ', 'By ') + x.autor),
          h('div', { class: 'ig-cartao-pe' }, h('span', { class: 'ig-tipo' }, A.icone((CATS()[x.cat] || CATS().misc)[1], 13), (CATS()[x.cat] || CATS().misc)[0]), x.votos ? h('span', { class: 'ig-nota' }, estrelas(x.nota, 12), h('small', {}, x.nota.toFixed(1))) : null, h('small', { class: 'suave' }, (x.inst || 0) + ' ↓'))));
    };
    function pintarComunidade() {
      const eu = A.api.eu && A.api.eu.codigo;
      const itens = (notas.comunidade || []).filter((x) => (filtro === 'tudo' || (filtro === 'minhas' ? !!comInstalada(x.id) : filtro === 'publicadas' ? x.codigo === eu : x.cat === filtro))
        && (!busca || (x.nome + ' ' + x.resumo + ' ' + x.autor).toLowerCase().includes(busca)));
      const publicar = h('button', { type: 'button', class: 'ig-cartao vidro ig-publicar', onclick: () => (notas.podePublicar ? criar({ publicar: true }) : U.toast(T('Publicar na Comunidade é do Supporter. Instalar é para todo mundo.', 'Publishing to Community is a Supporter perk. Installing is for everyone.'), { ms: 3500 })) },
        h('div', { class: 'ig-capa vazia', 'aria-hidden': 'true' }, A.orbe('mais', 46)), h('div', { class: 'ig-cartao-txt' }, h('div', { class: 'ig-cartao-nome' }, h('b', {}, T('Publicar uma integração', 'Publish an integration'))),
          h('div', { class: 'suave peq ig-cartao-resumo' }, notas.podePublicar ? T('Mande a sua para todo mundo instalar. Ela passa pelas travas de segurança antes de entrar.', 'Share yours for everyone to install. It goes through the safety locks first.') : T('Exclusivo do Supporter. Qualquer pessoa pode instalar.', 'Supporter perk. Anyone can install.'))));
      grade.replaceChildren(publicar, ...(itens.length ? itens.map(cartaoCom) : [h('div', { class: 'ig-vazio vidro interno' }, A.icone('pessoas', 34), h('b', {}, (notas.comunidade || []).length ? T('Nada encontrado', 'Nothing found') : T('Ainda não há integrações aqui', 'No integrations here yet')), h('p', { class: 'suave' }, T('Seja a primeira pessoa a publicar uma.', 'Be the first to publish one.')))]));
    }
    // instalar (ou atualizar) uma da Comunidade: o pacote vem do servidor e passa de novo pelas travas daqui
    async function instalarCom(x) {
      const d = await A.api.req('integ/' + x.id + '/pacote');
      const p = I.lerPacote(JSON.stringify({ ...d.pac, id: x.id, autor: d.autor, imagem: d.imagem || '', icone: d.icone || '' }));
      if (!I.sanitizar(p.css, p.id).css && !p.opcoes.length && !p.sons && !p.presets.length && !p.bolhas.some((b) => b.arte) && !(p.molduras || []).length && !(p.aneis || []).length) throw new Error(T('Esta integração não passou nas travas de segurança.', 'This integration did not pass the safety locks.'));
      I.instalarPacote(p, 'com-' + x.id, { id: x.id, atual: d.atual || 0, cat: d.cat });
      try { await A.api.req('integ/' + x.id + '/instalar', { sim: true }); } catch (e) { /* só estatística */ }
      return d;
    }
    async function abrirCom(x) {
      aberta = x; A.som.tocar('pop-abrir'); lista.hidden = true; pagina.hidden = false;
      const volta = U.btn(T('Comunidade', 'Community'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: fechar });
      const acao = h('div', { class: 'ig-acao' }), notaTopo = h('div', { class: 'ig-nota-topo' });
      const pintarNota = (n) => notaTopo.replaceChildren(estrelas(n.nota || 0, 16), h('b', {}, n.votos ? n.nota.toFixed(1) : '—'), h('span', { class: 'suave peq' }, (n.votos || 0) + T(' avaliações', ' ratings') + ' · ' + (n.inst || 0) + T(' instalações', ' installs')));
      pintarNota(x);
      let dados = null;
      const pintarAcao = () => {
        acao.replaceChildren();
        const y = comInstalada(x.id);
        // (1.0.3) paga e ainda não é sua: o botão compra (PIX, direto para quem fez) e instala em seguida
        if (!y && x.preco && !(dados && dados.tenho)) acao.append(U.btn(T('Comprar por ', 'Buy for ') + reais(x.preco), { icone: 'pix', grande: true, onclick: () => {
          if (!A.aer || !A.aer.loja || !A.aer.loja.comprar) { U.toast(T('Compras ainda não estão disponíveis neste aparelho.', 'Purchases are not available on this device yet.')); return; }
          A.aer.loja.comprar({ id: x.id, nome: x.nome, preco: x.preco }, notas.loja || {}, async () => {
            try { await instalarCom(x); U.toast(T('Comprada e instalada. Ela fica na sua conta.', 'Bought and installed. It stays on your account.'), { tipo: 'ok' }); } catch (er) { U.toast(er.message, { tipo: 'erro' }); }
            if (aberta === x) abrirCom(x);
          }, { integ: true });
        } }));
        else if (!y) acao.append(U.btn(T('Instalar', 'Install'), { icone: 'download', grande: true, onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await instalarCom(x); U.toast(T('Instalada. As opções dela ficam em Configurações > Integrações.', 'Installed. Its options are in Settings > Integrations.'), { tipo: 'ok' }); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } b.disabled = false; pintarAcao(); } }));
        else {
          if ((y.com && y.com.atual || 0) < (x.atual || 0)) acao.append(U.btn(T('Atualizar', 'Update'), { icone: 'download', grande: true, onclick: async () => { try { await instalarCom(x); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } pintarAcao(); } }));
          acao.append(h('label', { class: 'linha ig-ligar' }, h('span', {}, y.trava ? T('Desligada pela trava', 'Turned off by the lock') : T('Ligada', 'On')), U.chave(I.ligada('com-' + x.id), (v) => { I.ligar('com-' + x.id, v); pintarAcao(); })),
            U.btn(T('Opções', 'Options'), { icone: 'ajustes', tipo: 'sec', peq: true, onclick: () => A.evt.emit('abrir-config', 'integracoes') }),
            U.btn(T('Desinstalar', 'Uninstall'), { icone: 'lixo', tipo: 'perigo', peq: true, onclick: () => { delete cfg()['com-' + x.id]; salvar(); I.aplicar(); A.evt.emit('integ:mudou'); A.som.tocar('bolha-estoura'); A.api.req('integ/' + x.id + '/instalar', { sim: false }).catch(() => {}); pintarAcao(); } }));
        }
        const extras = [];
        if (dados && dados.meu) extras.push(U.btn(T('Atualizar a publicação', 'Update the upload'), { icone: 'subir', tipo: 'sec', peq: true, onclick: () => criar({ publicar: true, de: x, pac: dados.pac }) }));
        if (dados && (dados.meu || dados.mod)) extras.push(U.btn(T('Apagar da Comunidade', 'Delete from Community'), { icone: 'lixo', tipo: 'perigo', peq: true, onclick: async () => { if (!(await U.confirmar(T('Apagar esta integração da Comunidade? Quem já instalou continua com ela.', 'Delete this integration from Community? People who installed it keep it.'), { perigo: true }))) return; try { await A.api.req('integ/' + x.id, null, 'DELETE'); notas.comunidade = (notas.comunidade || []).filter((z) => z.id !== x.id); fechar(); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } } }));
        if (dados && dados.mod && x.oculta) extras.push(U.btn(T('Liberar (revisada)', 'Release (reviewed)'), { icone: 'ok', tipo: 'sec', peq: true, onclick: async () => { try { await A.api.req('integ/' + x.id + '/denunciar', { liberar: true }); x.oculta = false; U.toast(T('Liberada.', 'Released.'), { tipo: 'ok' }); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } } }));
        if (dados && !dados.meu) extras.push(U.btn(T('Denunciar', 'Report'), { icone: 'bandeira', tipo: 'sec', peq: true, onclick: () => denunciar(x) }));
        if (extras.length) acao.append(h('div', { class: 'linha ig-acao-extra', estilo: { gap: '6px', 'flex-wrap': 'wrap', 'flex-basis': '100%' } }, ...extras));
      };
      pintarAcao();
      const coment = h('div', { class: 'ig-coment' }, h('div', { class: 'suave peq' }, T('Carregando...', 'Loading...')));
      const minha = h('div', { class: 'ig-minha vidro interno' });
      const detalhes = h('ul', { class: 'ig-travas' });
      const vitrine = h('div', { class: 'ba-vitrine-lugar' }); // (0.9.5) as bolhas de arte dela, com "Usar"
      const cat = CATS()[x.cat] || CATS().misc;
      pagina.replaceChildren(h('div', { class: 'ig-pag-topo' }, volta),
        h('div', { class: 'ig-heroi vidro' }, h('div', { class: 'ig-palco' }, capaCom(x, true)),
          h('div', { class: 'ig-heroi-txt' },
            h('div', { class: 'ig-tipo' }, A.icone(cat[1], 14), cat[0], x.versao ? h('span', { class: 'suave peq' }, ' v' + x.versao) : null, h('span', { class: 'ig-selo com' }, A.icone('pessoas', 12), T('Comunidade', 'Community'))),
            h('h2', {}, x.nome), x.resumo ? h('p', {}, x.resumo) : null, notaTopo, acao,
            h('button', { type: 'button', class: 'ig-autor', onclick: () => A.perfil && A.perfil.ver(x.codigo) }, U.avatar({ codigo: x.codigo, nome: x.autor, av: x.av }, 34), h('div', {}, h('b', {}, x.autor), h('div', { class: 'suave peq' }, T('Quem fez', 'Made by')))))),
        h('div', { class: 'ig-colunas' },
          h('div', { class: 'col' }, h('section', { class: 'vidro pad' }, h('h3', {}, T('O que ela traz', 'What it includes')), detalhes), vitrine),
          h('div', { class: 'col' }, h('section', { class: 'vidro pad ig-seguro', dados: { protegido: '1' } }, h('h3', {}, A.icone('escudo', 16), T('Segurança', 'Safety')),
            h('ul', { class: 'ig-travas' },
              h('li', {}, T('Feita por outra pessoa: instale por sua conta e risco.', 'Made by someone else: install at your own risk.')),
              h('li', {}, T('Só muda a aparência: não roda código, não acessa a internet e não lê as suas mensagens.', 'Only changes the look: runs no code, has no internet access and cannot read your messages.')),
              h('li', {}, T('Passou pelas travas no servidor e passa de novo neste aparelho antes de instalar.', 'Passed the locks on the server and again on this device before installing.')),
              h('li', {}, T('Algo deu errado? Ctrl+Alt+Shift+S desliga todas as integrações.', 'Something went wrong? Ctrl+Alt+Shift+S turns off all integrations.')))),
            h('section', { class: 'vidro pad' }, h('h3', {}, T('Avaliações', 'Ratings')), minha, coment))));
      pagina.scrollIntoView({ block: 'start' });
      try { dados = await A.api.req('integ/' + x.id + '/pacote'); } catch (e) { coment.replaceChildren(h('div', { class: 'suave peq' }, e.message)); return; }
      if (aberta !== x) return;
      Object.assign(x, { atual: dados.atual, oculta: dados.oculta, preco: dados.preco || 0 }); pintarAcao();
      if (!dados.tenho && dados.itens) { // (1.0.3) paga: antes de comprar mostra só o que ela traz
        const n = dados.itens, um = (k, a, b) => n[k] && n[k] + (n[k] === 1 ? a : b);
        detalhes.replaceChildren(...[n.css && T('Visual novo (CSS)', 'New look (CSS)'), um('opcoes', T(' opção nas Configurações', ' option in Settings'), T(' opções nas Configurações', ' options in Settings')), n.sons && T('Sons de digitação', 'Typing sounds'), um('barras', T(' barra das abas', ' tab bar'), T(' barras das abas', ' tab bars')), um('bolhas', T(' bolha de conversa', ' chat bubble'), T(' bolhas de conversa', ' chat bubbles')), um('presets', T(' preset de cores', ' color preset'), T(' presets de cores', ' color presets')), um('molduras', T(' moldura da foto', ' photo frame'), T(' molduras da foto', ' photo frames')), um('aneis', T(' anel de voz', ' voice ring'), T(' anéis de voz', ' voice rings'))].filter(Boolean).map((t) => h('li', {}, t)));
      } else { const p = I.lerPacote(JSON.stringify({ ...dados.pac, id: x.id }));
        const it = [p.css && T('Visual novo (CSS)', 'New look (CSS)'), p.opcoes.length && p.opcoes.length + (p.opcoes.length === 1 ? T(' opção nas Configurações', ' option in Settings') : T(' opções nas Configurações', ' options in Settings')), p.sons && T('Sons de digitação', 'Typing sounds'), p.barras.length && p.barras.length + (p.barras.length === 1 ? T(' barra das abas', ' tab bar') : T(' barras das abas', ' tab bars')), p.bolhas.length && p.bolhas.length + (p.bolhas.length === 1 ? T(' bolha de conversa', ' chat bubble') : T(' bolhas de conversa', ' chat bubbles')), p.presets.length && p.presets.length + (p.presets.length === 1 ? T(' preset de cores', ' color preset') : T(' presets de cores', ' color presets')), p.molduras.length && p.molduras.length + (p.molduras.length === 1 ? T(' moldura da foto', ' photo frame') : T(' molduras da foto', ' photo frames')), p.aneis.length && p.aneis.length + (p.aneis.length === 1 ? T(' anel de voz', ' voice ring') : T(' anéis de voz', ' voice rings')), p.tirados.length && T('As travas deste aparelho tiram ', 'This device\'s locks remove ') + p.tirados.length + T(' trecho(s) não permitido(s)', ' disallowed part(s)')].filter(Boolean);
        detalhes.replaceChildren(...it.map((t) => h('li', {}, t)));
        const vt = A.bolhaArte && !x.oculta && A.bolhaArte.vitrine(x.id, p.bolhas, async (b) => {
          if (!comInstalada(x.id)) { await instalarCom(x); pintarAcao(); }
          await A.bolhaArte.usar(x.id, b.id);
          U.toast(T('Pronto! Suas mensagens agora usam a bolha "' + b.nome + '".', 'Done! Your messages now use the "' + b.nome + '" bubble.'), { tipo: 'ok' });
        });
        // (1.0.2) as molduras e os anéis de voz dela, com "Usar"
        const vf = A.bolhaArte && !x.oculta && A.bolhaArte.vitrineFotos && A.bolhaArte.vitrineFotos(x.id, p.molduras, p.aneis, async (b, anel) => {
          if (!comInstalada(x.id)) { await instalarCom(x); pintarAcao(); }
          await A.bolhaArte.usarFoto(x.id, b.id, anel);
          U.toast(anel ? T('Pronto! Seu anel de voz agora é "' + b.nome + '".', 'Done! Your voice ring is now "' + b.nome + '".') : T('Pronto! Sua foto agora usa a moldura "' + b.nome + '".', 'Done! Your photo now uses the "' + b.nome + '" frame.'), { tipo: 'ok' });
        });
        vitrine.replaceChildren(...[vt, vf].filter(Boolean)); }
      // as avaliações (as mesmas rotas das oficiais)
      let d = null; try { d = await A.api.req('integ/' + x.id); } catch (e) { coment.replaceChildren(h('div', { class: 'suave peq' }, e.message)); return; }
      if (aberta !== x) return;
      pintarNota(d);
      let nota = d.meu ? d.meu.e : 0;
      const estrBt = h('div', { class: 'ig-escolher', role: 'radiogroup', 'aria-label': T('Sua nota', 'Your rating') });
      const pintarEstr = () => estrBt.replaceChildren(...[1, 2, 3, 4, 5].map((k) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === nota), class: k <= nota ? 'on' : '', title: k + '', onclick: () => { nota = k; A.som.tocar('click'); pintarEstr(); } }, '★')));
      pintarEstr();
      const txt = h('textarea', { class: 'campo', rows: '2', maxlength: '500', placeholder: T('Conte o que achou (opcional)', 'Tell us what you think (optional)') }); txt.value = d.meu ? d.meu.t : '';
      txt.addEventListener('keydown', (e) => e.stopPropagation());
      const enviar = U.btn(d.meu ? T('Atualizar', 'Update') : T('Avaliar', 'Rate'), { icone: 'estrela', peq: true, onclick: async () => {
        if (!nota) { U.toast(T('Escolha as estrelas primeiro.', 'Pick the stars first.')); return; }
        try { const r = await A.api.req('integ/' + x.id + '/avaliar', { estrelas: nota, texto: txt.value }); Object.assign(x, r); A.som.tocar('bolha'); abrirCom(x); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      } });
      minha.replaceChildren(h('b', {}, d.meu ? T('Sua avaliação', 'Your rating') : T('Avalie esta integração', 'Rate this integration')), estrBt, txt, h('div', { class: 'linha entre' }, h('span'), enviar));
      coment.replaceChildren(...(d.coment.length ? d.coment.map((c, i) => h('div', { class: 'ig-c', estilo: { '--i': Math.min(i, 10) } },
        h('button', { type: 'button', class: 'ig-c-foto', title: T('Ver perfil', 'View profile'), onclick: () => A.perfil && A.perfil.ver(c.codigo) }, U.avatar({ codigo: c.codigo, nome: c.nome, av: c.av }, 34)),
        h('div', { class: 'cresce' }, h('div', { class: 'linha ig-c-topo' }, h('b', {}, c.nome), estrelas(c.e, 11), h('small', { class: 'suave' }, quando(c.em))), h('div', { class: 'ig-c-txt selecionavel' }, c.t)))) : [h('div', { class: 'suave peq' }, T('Ninguém avaliou ainda.', 'No ratings yet.'))]));
    }
    function denunciar(x) {
      const motivo = h('textarea', { class: 'campo', rows: '3', maxlength: '200', placeholder: T('O que ela faz de errado? (opcional)', 'What is wrong with it? (optional)') });
      motivo.addEventListener('keydown', (e) => e.stopPropagation());
      const m = U.modal(T('Denunciar integração', 'Report integration'), h('div', { class: 'col', estilo: { gap: '8px' } }, h('p', { class: 'suave peq' }, T('Com várias denúncias ela sai da lista até a moderação olhar.', 'With several reports it leaves the list until moderators review it.')), motivo),
        { largura: 420, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Denunciar', 'Report'), tipo: 'perigo', onclick: async () => { try { await A.api.req('integ/' + x.id + '/denunciar', { motivo: motivo.value }); m.fechar(); U.toast(T('Denúncia enviada. Obrigado!', 'Report sent. Thanks!'), { tipo: 'ok' }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }] });
    }
    // a primeira visita na Comunidade: o aviso de "por sua conta e risco"
    function avisoComunidade() {
      if (A.cfg.v.integAviso) return Promise.resolve(true);
      // (0.8.7) aparece uma vez só e precisa marcar o consentimento: a responsabilidade é de quem instala, não do Aero Stream
      let aceitou = false, ok = null; const pr = new Promise((r) => { ok = r; });
      const btOk = U.btn(T('Concordo e continuar', 'Agree and continue'), { tipo: 'ok', onclick: () => { if (!chk.checked) return; aceitou = true; A.cfg.v.integAviso = 1; salvar(); m.fechar(true); } });
      btOk.disabled = true;
      const chk = h('input', { type: 'checkbox', class: 'ig-consente-chk', onchange: () => { btOk.disabled = !chk.checked; } });
      const m = U.modal(T('Integrações da Comunidade', 'Community integrations'), h('div', { class: 'col ig-aviso', dados: { protegido: '1' } },
        h('div', { class: 'ig-aviso-ic' }, A.icone('escudo', 30)),
        h('p', {}, T('As integrações da Comunidade são feitas por outras pessoas, não pela equipe do Aero. Instale por sua conta e risco.', 'Community integrations are made by other people, not by the Aero team. Install at your own risk.')),
        h('ul', { class: 'ig-travas' },
          h('li', {}, T('Elas só mudam a aparência: não rodam código.', 'They only change the look: they do not run code.')),
          h('li', {}, T('Não leem mensagens, não acessam a internet e não mexem na sua privacidade nem na criptografia.', 'They do not read messages, reach the internet, or touch your privacy or encryption.')),
          h('li', {}, T('Se uma delas tentar esconder uma parte protegida do app, ela é desligada na hora.', 'If one tries to hide a protected part of the app, it is turned off right away.'))),
        h('label', { class: 'ig-consente' }, chk, h('span', {}, T('Entendo que toda a responsabilidade por uma integração da Comunidade ou instalada por mim é minha (de quem baixou e instalou) e não do Aero.', 'I understand that all responsibility for a Community integration or one I install myself is mine (whoever downloaded and installed it), not Aero\'s.'))),
        h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, btOk)),
      { largura: 480, aoFechar: () => ok(aceitou) });
      return pr;
    }
    // ---------- a página de uma integração ----------
    // (0.8.7) instalar a sua: cole um CSS (ou um pacote .json) ou abra o arquivo. Tudo passa pelas travas antes de entrar.
    function criar(op = {}) {
      const pub = !!op.publicar; // (0.9.1) o mesmo editor publica na Comunidade
      const area = h('textarea', { class: 'campo ig-codigo', rows: '10', spellcheck: 'false', placeholder: T('Cole aqui o CSS ou o pacote .json da integração', 'Paste the integration CSS or .json package here') });
      const arq = h('input', { type: 'file', accept: '.css,.json,text/css,application/json', hidden: true });
      arq.addEventListener('change', async () => { const f = arq.files && arq.files[0]; if (!f) return; if (f.size > 120000) { U.toast(T('Arquivo grande demais.', 'File too large.'), { tipo: 'erro' }); return; } area.value = await f.text(); conferirJa(); });
      const info = h('div', { class: 'peq suave ig-criar-info' });
      // (0.8.7) a imagem que aparece no cartão e na página dela
      let imgEsc = '', icEsc = '';
      const imgPrev = h('div', { class: 'ig-criar-img', hidden: true });
      // (1.0.3) o ícone (a bolha redonda do cartão), separado do banner
      const icPrev = h('div', { class: 'ig-criar-ic', hidden: true });
      const icArq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
      icArq.addEventListener('change', () => {
        const f = icArq.files && icArq.files[0]; if (!f) return;
        if (f.size > 110000) { U.toast(T('Ícone grande demais (até 110 KB).', 'Icon too large (up to 110 KB).'), { tipo: 'erro' }); return; }
        const fr = new FileReader(); fr.onload = () => { const u = I.iconeOk(String(fr.result || '')); if (!u) return; icEsc = u; icPrev.hidden = false; icPrev.replaceChildren(h('img', { src: u, alt: '' })); }; fr.readAsDataURL(f);
      });
      const imgArq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
      imgArq.addEventListener('change', () => {
        const f = imgArq.files && imgArq.files[0]; if (!f) return;
        if (f.size > 300000) { U.toast(T('Imagem grande demais (até 300 KB).', 'Image too large (up to 300 KB).'), { tipo: 'erro' }); return; }
        const fr = new FileReader(); fr.onload = () => { const u = I.imagemOk(String(fr.result || '')); if (!u) return; imgEsc = u; imgPrev.hidden = false; imgPrev.replaceChildren(h('img', { src: u, alt: '' })); }; fr.readAsDataURL(f);
      });
      area.addEventListener('keydown', (e) => e.stopPropagation());
      const conferirJa = () => {
        if (!area.value.trim()) { info.textContent = ''; return null; }
        try { const p = I.lerPacote(area.value); const extra = [p.opcoes.length && p.opcoes.length + (p.opcoes.length === 1 ? T(' opção', ' option') : T(' opções', ' options')), p.sons && T('sons de digitação', 'typing sounds'), p.barras.length && p.barras.length + (p.barras.length === 1 ? T(' barra', ' bar') : T(' barras', ' bars')), p.bolhas.length && p.bolhas.length + (p.bolhas.length === 1 ? T(' bolha', ' bubble') : T(' bolhas', ' bubbles')), p.presets.length && p.presets.length + ' presets', p.molduras.length && p.molduras.length + T(' moldura(s)', ' frame(s)'), p.aneis.length && p.aneis.length + T(' anel(éis) de voz', ' voice ring(s)')].filter(Boolean);
          info.textContent = '"' + p.nome + '"' + (extra.length ? ' · ' + extra.join(', ') : '') + (p.tirados.length ? ' · ' + T('as travas tiraram ', 'the locks removed ') + p.tirados.length + T(' trecho(s) que não são permitidos', ' disallowed part(s)') : '')
            + (() => { const ja = cfg()['loc-' + p.id]; if (!ja) return ''; const va = (ja.pac && ja.pac.versao) || '?', vn = p.versao || '?'; return ' · ' + (va !== vn ? T('atualiza da v', 'updates from v') + va + T(' para a v', ' to v') + vn : T('já instalada: instalar de novo atualiza', 'already installed: installing again updates it')); })(); return p;
        } catch (e) { info.textContent = e.message; return null; }
      };
      area.addEventListener('input', conferirJa);
      const exemplo = h('details', { class: 'ig-exemplo' }, h('summary', {}, T('Como fazer uma', 'How to make one')),
        h('p', { class: 'peq' }, T('Um CSS já basta. Para ter opções nas Configurações, sons de digitação, barras, bolhas ou presets, use um pacote .json assim:', 'A CSS is enough. For options in Settings, typing sounds, bars, bubbles or presets, use a .json package like this:')),
        h('pre', { class: 'ig-pre selecionavel' }, '{\n  "id": "neon", "nome": "Neon", "autor": "Você",\n  "css": "body[data-ig-neon-brilho=\\"sim\\"] .vidro { box-shadow: 0 0 18px var(--ig-neon-cor); }",\n  "opcoes": [\n    { "id": "brilho", "rotulo": "Brilho", "tipo": "chave", "padrao": true },\n    { "id": "cor", "rotulo": "Cor do brilho", "tipo": "cor", "padrao": "#ff3df2" }\n  ],\n  "sons": { "nome": "Neon", "normal": [[{ "o": "square", "f": 1200, "dur": 0.03, "vol": 0.06 }]] },\n  "barras": [{ "id": "fina", "nome": "Fina" }],\n  "bolhas": [{ "id": "neon", "nome": "Neon" }],\n  "presets": [{ "nome": "Noite neon", "tema": { "cor": "#ff3df2" } }]\n}'),
        h('p', { class: 'peq suave' }, T('As opções viram data-ig-<id>-<opção> e --ig-<id>-<opção> no body; a barra e a bolha escolhidas viram data-ig-barra e data-ig-bolha. Nada de script, nada de internet: as Configurações, esta aba e as partes protegidas não mudam.', 'Options become data-ig-<id>-<option> and --ig-<id>-<option> on body; the chosen bar and bubble become data-ig-barra and data-ig-bolha. No scripts, no internet: Settings, this tab and protected parts never change.')));
      let cat = (op.de && op.de.cat) || 'tema';
      const catSeg = pub ? h('div', { class: 'col', estilo: { gap: '6px' } }, h('b', { class: 'peq' }, T('Categoria', 'Category')), ((x) => { x.classList.add('quebra'); return x; })(U.seg(Object.entries(CATS()).map(([k, v]) => [k, v[0], v[1]]), cat, (v) => { cat = v; }))) : null;
      if (op.pac) area.value = JSON.stringify({ nome: op.pac.nome, descricao: op.pac.desc, versao: op.pac.versao, css: op.pac.css, opcoes: op.pac.opcoes, sons: op.pac.sons || undefined, barras: op.pac.barras, bolhas: op.pac.bolhas, presets: op.pac.presets, molduras: op.pac.molduras, aneis: op.pac.aneis }, null, 2);
      // (0.9.5) o estúdio de bolhas: monta as bolhas de arte e devolve para o pacote (as imagens já vão para o servidor)
      const abrirEstudio = () => {
        let pkg = {}; const v = area.value.trim();
        if (v) { if (v.startsWith('{')) { try { pkg = JSON.parse(v); } catch (e) { U.toast(T('Arrume o pacote .json antes de abrir o estúdio.', 'Fix the .json package before opening the studio.'), { tipo: 'erro' }); return; } } else pkg = { css: v }; }
        if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) pkg = {};
        A.bolhaArte.estudio(Array.isArray(pkg.bolhas) ? pkg.bolhas : [], (bolhas) => {
          pkg.bolhas = bolhas; if (!pkg.nome) pkg.nome = (bolhas.find((b) => b.arte) || {}).nome || '';
          area.value = JSON.stringify(pkg, null, 2); conferirJa();
        });
      };
      // (1.0.2) o estúdio de molduras e anéis de voz
      const abrirEstudioFotos = () => {
        let pkg = {}; const v = area.value.trim();
        if (v) { if (v.startsWith('{')) { try { pkg = JSON.parse(v); } catch (e) { U.toast(T('Arrume o pacote .json antes de abrir o estúdio.', 'Fix the .json package before opening the studio.'), { tipo: 'erro' }); return; } } else pkg = { css: v }; }
        if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) pkg = {};
        A.bolhaArte.estudioFotos(Array.isArray(pkg.molduras) ? pkg.molduras : [], Array.isArray(pkg.aneis) ? pkg.aneis : [], (molduras, aneis) => {
          pkg.molduras = molduras; pkg.aneis = aneis; if (!pkg.nome) pkg.nome = ((molduras[0] || aneis[0]) || {}).nome || '';
          area.value = JSON.stringify(pkg, null, 2); conferirJa();
        });
      };
      // (1.0.3) o preço: 0 = grátis; para vender, a conta do Mercado Pago de quem publica precisa estar conectada
      const preco = pub ? h('input', { class: 'campo ig-preco', type: 'number', min: 0, max: 200, step: '0.5', value: (op.de && op.de.preco) || 0, 'aria-label': T('Preço em reais', 'Price in reais') }) : null;
      const precoErro = h('div', { class: 'peq est-erro' });
      if (preco) preco.addEventListener('keydown', (e) => e.stopPropagation());
      const precoBloco = !preco ? null : h('div', { class: 'col', estilo: { gap: '6px' } },
        h('label', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, h('b', { class: 'peq' }, T('Preço (R$, 0 = grátis)', 'Price (R$, 0 = free)')), preco),
        A.aer && A.aer.loja && A.aer.loja.vendedor ? A.aer.loja.vendedor(notas.loja || {}, preco, precoErro, T('A venda de integrações ainda não está disponível. Publique grátis por enquanto.', 'Selling integrations is not available yet. Publish for free for now.')) : null, precoErro);
      let enviando = false;
      const enviarPub = async () => {
        if (enviando) return;
        const p = conferirJa(); if (!p) { U.toast(T('Cole um CSS ou um pacote primeiro.', 'Paste a CSS or package first.'), { tipo: 'erro' }); return; }
        if (p.tirados.length) { U.toast(T('Tire as partes que as travas não permitem antes de publicar (' + p.tirados.slice(0, 3).join(', ') + ').', 'Remove the parts the locks do not allow before publishing (' + p.tirados.slice(0, 3).join(', ') + ').'), { tipo: 'erro', ms: 5000 }); return; }
        let bruto; const v = area.value.trim(); try { bruto = v.startsWith('{') ? JSON.parse(v) : { css: v }; } catch (e) { return; }
        bruto.nome = p.nome; if (imgEsc) bruto.imagem = imgEsc; if (icEsc) bruto.icone = icEsc;
        enviando = true;
        try {
          const v = preco ? Math.max(0, +preco.value || 0) : 0;
          if (v && (v < 2 || v > 200)) { precoErro.textContent = T('O preço vai de R$ 2 a R$ 200 (ou grátis).', 'Price goes from R$ 2 to R$ 200 (or free).'); enviando = false; return; }
          const r = await A.api.req('integ/publicar', { pac: bruto, cat, id: op.de ? op.de.id : undefined, manterImagem: !imgEsc, manterIcone: !icEsc, preco: v });
          m.fechar(); A.som.tocar('sucesso'); U.toast(op.de ? T('Publicação atualizada.', 'Upload updated.') : T('Publicada na Comunidade!', 'Published to Community!'), { tipo: 'ok' });
          try { notas = await A.api.req('integ'); notasGuardadas = { t: Date.now(), d: notas }; } catch (e) { /* ok */ } aberta = null; pagina.hidden = true; lista.hidden = false; pintarChips(); pintar(true); void r;
        } catch (e) { U.toast(e.message, { tipo: 'erro', ms: 5000 }); enviando = false; }
      };
      const m = U.modal(pub ? (op.de ? T('Atualizar a publicação', 'Update the upload') : T('Publicar na Comunidade', 'Publish to Community')) : T('Instalar a sua integração', 'Install your own integration'), h('div', { class: 'col', estilo: { gap: '10px' } },
        pub ? h('p', { class: 'peq suave' }, T('Ela passa pelas travas antes de entrar: nada de links, @import, fontes de fora ou código. Quem instala pode avaliar e denunciar.', 'It goes through the locks first: no links, @import, external fonts or code. People who install can rate and report it.')) : null, catSeg, precoBloco,
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, U.btn(T('Abrir arquivo', 'Open file'), { icone: 'pasta', tipo: 'sec', peq: true, onclick: () => arq.click() }), U.btn(T('Ícone', 'Icon'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => icArq.click() }), U.btn(T('Banner', 'Banner'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => imgArq.click() }), pub && A.bolhaArte ? U.btn(T('Estúdio de bolhas', 'Bubble studio'), { icone: 'bolhas', tipo: 'sec', peq: true, onclick: abrirEstudio }) : null, pub && A.bolhaArte && A.bolhaArte.estudioFotos ? U.btn(T('Molduras e anéis', 'Frames and rings'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: abrirEstudioFotos }) : null, h('span', { class: 'peq suave' }, '.css · .json')), arq, imgArq, icArq, h('div', { class: 'ig-criar-prev' }, icPrev, imgPrev), area, info, exemplo),
      { largura: 620, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, pub ? { texto: op.de ? T('Atualizar', 'Update') : T('Publicar', 'Publish'), tipo: 'ok', onclick: () => enviarPub() } : { texto: T('Instalar', 'Install'), tipo: 'ok', onclick: () => {
        const p = conferirJa(); if (!p) { U.toast(T('Cole um CSS ou um pacote primeiro.', 'Paste a CSS or package first.'), { tipo: 'erro' }); return; }
        if (!I.sanitizar(p.css, p.id).css && !p.opcoes.length && !p.sons && !p.presets.length && !p.bolhas.some((b) => b.arte) && !(p.molduras || []).length && !(p.aneis || []).length) { U.toast(T('Não sobrou nada depois das travas.', 'Nothing left after the locks.'), { tipo: 'erro' }); return; }
        const ja = cfg()['loc-' + p.id];
        if (imgEsc) p.imagem = imgEsc; else if (!p.imagem && ja && ja.pac && ja.pac.imagem) p.imagem = ja.pac.imagem;
        if (icEsc) p.icone = icEsc; else if (!p.icone && ja && ja.pac && ja.pac.icone) p.icone = ja.pac.icone;
        I.instalarPacote(p); m.fechar(); U.toast(ja ? T('Atualizada, com as suas opções de antes.', 'Updated, keeping your previous options.') : T('Instalada. As opções dela ficam em Configurações > Integrações.', 'Installed. Its options are in Settings > Integrations.'), { tipo: 'ok' }); pintar();
      } }] });
    }
    // a página de uma das suas
    function abrirLocal(x) {
      aberta = x; A.som.tocar('pop-abrir'); lista.hidden = true; pagina.hidden = false;
      const volta = U.btn(T('Integrações', 'Integrations'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: fechar });
      const acao = h('div', { class: 'ig-acao' });
      const pintarAcao = () => {
        const y = cfg()[x.id]; if (!y) { fechar(); return; }
        acao.replaceChildren(h('label', { class: 'linha ig-ligar' }, h('span', {}, y.trava ? T('Desligada pela trava', 'Turned off by the lock') : T('Ligada', 'On')), U.chave(I.ligada(x.id), (v) => { I.ligar(x.id, v); pintarAcao(); })),
          U.btn(T('Opções', 'Options'), { icone: 'ajustes', tipo: 'sec', peq: true, onclick: () => A.evt.emit('abrir-config', 'integracoes') }),
          U.btn(T('Desinstalar', 'Uninstall'), { icone: 'lixo', tipo: 'perigo', peq: true, onclick: () => { delete cfg()[x.id]; salvar(); I.aplicar(); A.evt.emit('integ:mudou'); A.som.tocar('bolha-estoura'); fechar(); } }));
      };
      pintarAcao();
      const p = x.pac;
      pagina.replaceChildren(h('div', { class: 'ig-pag-topo' }, volta),
        h('div', { class: 'ig-heroi vidro' }, h('div', { class: 'ig-palco' }, capaInteg(x, true)),
          h('div', { class: 'ig-heroi-txt' }, h('div', { class: 'ig-tipo' }, A.icone('oPaleta', 14), T('Tema', 'Theme'), p.versao ? h('span', { class: 'suave peq' }, ' v' + p.versao) : null),
            h('h2', {}, p.nome), p.desc ? h('p', {}, p.desc) : null, acao,
            h('div', { class: 'ig-autor' }, h('div', { class: 'ig-autor-logo' }, A.icone('pessoa', 18)), h('div', {}, h('b', {}, p.autor || T('Você', 'You')), h('div', { class: 'suave peq' }, T('Quem fez', 'Made by')))))),
        h('section', { class: 'vidro pad ig-seguro', dados: { protegido: '1' } }, h('h3', {}, A.icone('escudo', 16), T('Segurança', 'Safety')),
          h('ul', { class: 'ig-travas' }, h('li', {}, T('Só muda a aparência, não roda código e não acessa a internet.', 'Only changes the look, runs no code and has no internet access.')),
            h('li', {}, T('Não alcança as Configurações (só o lugar das opções dela), esta aba nem as partes protegidas.', 'Cannot reach Settings (only its own options area), this tab or protected parts.')),
            h('li', {}, T('Segue a sua conta nos seus aparelhos (se a sincronização estiver ligada) e sai com um clique.', 'Follows your account on your devices (when sync is on) and is removed in one click.')))));
    }
    async function abrir(x) {
      if (x.local) { abrirLocal(x); return; }
      aberta = x; A.som.tocar('pop-abrir');
      lista.hidden = true; pagina.hidden = false;
      const volta = U.btn(T('Integrações', 'Integrations'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: fechar });
      const acao = h('div', { class: 'ig-acao' });
      // (1.0.0) as opções de uma integração nativa que tem configuração própria (Assistindo agora: os sites) aparecem na página dela
      const cfgModulo = h('div', { class: 'ig-cfg-modulo' });
      const pintarCfgModulo = () => cfgModulo.replaceChildren(...(x.cat && x.cat.modulo === 'assistindo' && I.instalada(x.id) && A.assistindo && A.assistindo.disponivel() ? [A.assistindo.configuracao()] : []));
      const pintarAcao = () => {
        acao.replaceChildren();
        pintarCfgModulo(); // instalou ou desinstalou: as opções aparecem ou somem
        if (x.emBreve) { acao.append(h('span', { class: 'ig-selo breve grande' }, T('Em breve', 'Coming soon'))); return; }
        // (1.0.2) do catálogo, mas este app ainda não sabe fazer ela funcionar (ou o plano não alcança)
        if (x.bloqueio && !I.instalada(x.id)) { acao.append(seloBloqueio(x, true), h('p', { class: 'suave peq ig-bloq' }, textoBloqueio(x))); return; }
        if (!I.instalada(x.id)) { acao.append(U.btn(T('Instalar', 'Install'), { icone: 'download', grande: true, onclick: async () => { await I.instalar(x.id, true); pintarAcao(); if (x.cat && x.cat.modulo === 'assistindo' && A.assistindo && A.assistindo.exigirExtensao) A.assistindo.exigirExtensao(); if (x.reinicio) reiniciar(); } })); return; }
        const tr = cfg()[x.id] && cfg()[x.id].trava;
        if (I.precisaAtualizar(x.id)) acao.append(U.btn(T('Atualizar', 'Update'), { icone: 'download', grande: true, onclick: () => { I.atualizar(x.id); pintarAcao(); if (x.reinicio) reiniciar(); } }));
        if ((x.gen === 'link' || x.gen === 'janela') && !x.bloqueio && I.ligada(x.id)) acao.append(U.btn(x.cat.rotulo ? K().texto(x.cat.rotulo) : T('Abrir', 'Open'), { icone: x.gen === 'link' ? 'externo' : x.icone, grande: true, onclick: () => I.usar(x.id) }));
        acao.append(h('label', { class: 'linha ig-ligar' }, h('span', {}, tr ? T('Desligada pela trava', 'Turned off by the lock') : T('Ligada', 'On')), U.chave(I.ligada(x.id), (v) => { I.ligar(x.id, v); pintarAcao(); })),
          U.btn(T('Desinstalar', 'Uninstall'), { icone: 'lixo', tipo: 'perigo', peq: true, onclick: async () => { await I.instalar(x.id, false); pintarAcao(); if (x.reinicio) reiniciar(); } }));
      };
      pintarAcao();
      const n0 = notas.oficiais[x.id] || { nota: 0, votos: 0, inst: 0 };
      const notaTopo = h('div', { class: 'ig-nota-topo' });
      const pintarNota = (n) => notaTopo.replaceChildren(estrelas(n.nota, 16), h('b', {}, n.votos ? n.nota.toFixed(1) : '—'), h('span', { class: 'suave peq' }, n.votos + T(' avaliações', ' ratings') + ' · ' + (n.inst || 0) + T(' instalações', ' installs')));
      pintarNota(n0);
      // a galeria: a demonstração grande e as miniaturas
      const palco = h('div', { class: 'ig-palco' }, capaInteg(x, true));
      const coment = h('div', { class: 'ig-coment' }, h('div', { class: 'suave peq' }, T('Carregando avaliações...', 'Loading ratings...')));
      const minha = h('div', { class: 'ig-minha vidro interno' });
      pagina.replaceChildren(
        h('div', { class: 'ig-pag-topo' }, volta),
        h('div', { class: 'ig-heroi vidro' }, palco,
          h('div', { class: 'ig-heroi-txt' },
            h('div', { class: 'ig-tipo' }, A.icone(tipos()[x.tipo][1], 14), tipos()[x.tipo][0], h('span', { class: 'ig-selo of' }, A.icone('check', 12), T('Oficial', 'Official'))),
            h('h2', {}, x.nome), h('p', {}, x.resumo), notaTopo, acao,
            h('div', { class: 'ig-autor' }, h('div', { class: 'ig-autor-logo' }, A.icone('oInteg', 18)), h('div', {}, h('b', {}, T('Equipe Aero', 'Aero team')), h('div', { class: 'suave peq' }, T('Quem fez', 'Made by')))))),
        cfgModulo,
        h('div', { class: 'ig-colunas' },
          h('div', { class: 'col' },
            h('section', { class: 'vidro pad' }, h('h3', {}, T('Como funciona', 'How it works')), h('p', {}, x.desc)),
            x.onde ? h('section', { class: 'vidro pad' }, h('h3', {}, T('Onde ficam as opções', 'Where the options are')), h('p', {}, x.onde)) : null),
          // (0.8.7) as avaliações do lado da segurança: as duas colunas ficam parecidas e a página cabe na tela
          h('div', { class: 'col' }, h('section', { class: 'vidro pad ig-seguro', dados: { protegido: '1' } }, h('h3', {}, A.icone('escudo', 16), T('Segurança', 'Safety')),
            h('ul', { class: 'ig-travas' },
              x.seguro ? x.seguro.map((t) => h('li', {}, t)) : null,
              x.seguro ? null : seguroDoTipo(x).map((t) => h('li', {}, t)),
              h('li', {}, T('Não mexe na privacidade nem na criptografia.', 'Does not touch privacy or encryption.')),
              h('li', {}, T('Segue a sua conta nos seus aparelhos (se a sincronização estiver ligada) e sai com um clique.', 'Follows your account on your devices (when sync is on) and is removed in one click.')))),
            h('section', { class: 'vidro pad' }, h('h3', {}, T('Avaliações', 'Ratings')), minha, coment))));
      pagina.scrollIntoView({ block: 'start' });
      if (x.emBreve) { minha.hidden = true; coment.replaceChildren(h('div', { class: 'suave peq' }, T('As avaliações abrem quando ela for lançada.', 'Ratings open when it launches.'))); return; }
      // as avaliações
      let d = null;
      try { d = await A.api.req('integ/' + x.id); } catch (e) { coment.replaceChildren(h('div', { class: 'suave peq' }, e.status === 404 ? T('O servidor ainda está atualizando. Tente de novo em alguns minutos.', 'The server is still updating. Try again in a few minutes.') : e.message)); minha.hidden = true; return; }
      if (aberta !== x) return;
      pintarNota(d);
      let nota = d.meu ? d.meu.e : 0;
      const estrBt = h('div', { class: 'ig-escolher', role: 'radiogroup', 'aria-label': T('Sua nota', 'Your rating') });
      const pintarEstr = () => estrBt.replaceChildren(...[1, 2, 3, 4, 5].map((k) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === nota), class: k <= nota ? 'on' : '', title: k + '', onclick: () => { nota = k; A.som.tocar('click'); pintarEstr(); } }, '★')));
      pintarEstr();
      const txt = h('textarea', { class: 'campo', rows: '2', maxlength: '500', placeholder: T('Conte o que achou (opcional)', 'Tell us what you think (optional)') }); txt.value = d.meu ? d.meu.t : '';
      const enviar = U.btn(d.meu ? T('Atualizar', 'Update') : T('Avaliar', 'Rate'), { icone: 'estrela', peq: true, onclick: async () => {
        if (!nota) { U.toast(T('Escolha as estrelas primeiro.', 'Pick the stars first.')); return; }
        try { const r = await A.api.req('integ/' + x.id + '/avaliar', { estrelas: nota, texto: txt.value }); notas.oficiais[x.id] = r; A.som.tocar('bolha'); abrir(x); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      } });
      minha.replaceChildren(h('b', {}, d.meu ? T('Sua avaliação', 'Your rating') : T('Avalie esta integração', 'Rate this integration')), estrBt, txt, h('div', { class: 'linha entre' }, h('span'), enviar));
      coment.replaceChildren(...(d.coment.length ? d.coment.map((c, i) => h('div', { class: 'ig-c', estilo: { '--i': Math.min(i, 10) } },
        h('button', { type: 'button', class: 'ig-c-foto', title: T('Ver perfil', 'View profile'), onclick: () => A.perfil && A.perfil.ver(c.codigo) }, U.avatar({ codigo: c.codigo, nome: c.nome, av: c.av }, 34)),
        h('div', { class: 'cresce' }, h('div', { class: 'linha ig-c-topo' }, h('b', {}, c.nome), estrelas(c.e, 11), h('small', { class: 'suave' }, quando(c.em))), h('div', { class: 'ig-c-txt selecionavel' }, c.t)))) : [h('div', { class: 'suave peq' }, T('Ninguém comentou ainda. Seja o primeiro!', 'No comments yet. Be the first!'))]));
    }
    function fechar() { aberta = null; pagina.hidden = true; lista.hidden = false; A.som.tocar('click'); pintar(); }
    function reiniciar() {
      const m = U.modal(T('Reiniciar o app', 'Restart the app'), h('p', {}, T('Esta integração precisa reiniciar o app para funcionar.', 'This integration needs to restart the app to work.')),
        { largura: 380, acoes: [{ texto: T('Depois', 'Later'), tipo: 'sec', onclick: () => m.fechar() }, { texto: T('Reiniciar agora', 'Restart now'), tipo: 'ok', onclick: () => location.reload() }] });
    }
    offs.push(A.evt.on('integ:mudou', () => { if (!aberta) pintar(true); }));
    offs.push(A.evt.on('integ:catalogo', () => { if (!aberta) { pintarChips(); pintar(true); } })); // (1.0.2) chegou um catálogo novo
    if (K()) K().buscar();
    pintarChips(); pintar();
    // (1.0.2) as notas e comentários valem 1 minuto: entrar e sair da aba várias vezes não pede tudo de novo ao servidor a cada vez
    if (!(notasGuardadas && Date.now() - notasGuardadas.t < 60000)) A.api.req('integ').then((d) => { notas = d; notasGuardadas = { t: Date.now(), d }; pintar(true); }).catch(() => {});
    return { limpar() { offs.forEach((f) => f()); } };
  };
})();
