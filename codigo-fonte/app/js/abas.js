// Aero Stream - conteúdo das abas: Conexões, Amigos, Transmitir e Configurações. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T, API = A.api, H = A.hub;
  const ABAS = (A.abas = {});
  const cab = (titulo, sub) => h('div', { class: 'cab' }, h('h2', {}, titulo), sub ? h('span', { class: 'suave' }, sub) : null);
  const secao = (titulo, ...filhos) => h('section', { class: 'vidro pad', estilo: { 'margin-bottom': '14px' } }, titulo ? h('h3', { estilo: { 'margin-bottom': '8px' } }, titulo) : null, ...filhos);
  // (0.8.7) cenas animadas que mostram o que cada opção da Privacidade faz (data-e = o estado escolhido)
  const CENAS_PRIV = {
    discord: '<i class="pc-card"><i class="pc-av"></i><i class="pc-l1"></i><i class="pc-l2"></i><i class="pc-play"></i></i>',
    lidos: '<i class="pc-balao"><i class="pc-l1"></i><i class="pc-l2"></i></i><b class="pc-ck"></b><b class="pc-ck pc-ck2"></b>',
    visto: '<i class="pc-av"></i><i class="pc-relogio"><b></b></i><i class="pc-l1"></i>',
    conta: '<i class="pc-jan"><i class="pc-tit"></i><i class="pc-x"></i><i class="pc-l1"></i><i class="pc-l2"></i></i><i class="pc-onda"></i><i class="pc-cursor"></i><i class="pc-rel"><b></b></i>',
    msg: '<i class="pc-av pc-s1"></i><i class="pc-av pc-s2"></i><i class="pc-env pc-e1"></i><i class="pc-env pc-e2"></i><i class="pc-portao pc-g1"></i><i class="pc-portao pc-g2"></i><i class="pc-caixa"></i>',
    aparelho: '<i class="pc-tela"><i class="pc-l1"></i><i class="pc-l2"></i></i><i class="pc-pe"></i><i class="pc-olho"></i>',
    // (1.0.2) a música tocando (capa, barrinhas do som e a barra andando) e o navegador com a extensão encaixando
    musica: '<i class="pc-card"><i class="pc-capa"></i><i class="pc-eq"><b></b><b></b><b></b><b></b></i><i class="pc-barra"><b></b></i></i>',
    navegador: '<i class="pc-jan"><i class="pc-tit"><b></b><b></b><b></b></i><i class="pc-play"></i><i class="pc-l1"></i></i><i class="pc-peca"></i>',
  };
  const cenaPriv = (tipo, e) => {
    const c = h('div', { class: 'priv-cena pc-' + tipo, 'aria-hidden': 'true', dados: { e: String(e) } }); c.innerHTML = CENAS_PRIV[tipo] + '<s class="pc-risco"></s>';
    // (0.8.7) trocar a opção recomeçava a animação de repente (um tranco confuso): agora a cena esmaece e volta já no estado novo,
    // e só quando o estado muda de verdade
    try {
      new MutationObserver((ms) => {
        if (!ms.some((m) => c.getAttribute(m.attributeName) !== m.oldValue)) return;
        // (0.8.7) todas as peças recomeçam juntas (sem uma animação continuar por cima da outra) e a cena esmaece uma vez só
        c.classList.remove('muda'); c.classList.add('reinicia'); void c.offsetWidth; c.classList.remove('reinicia'); c.classList.add('muda');
      }).observe(c, { attributes: true, attributeOldValue: true, attributeFilter: ['data-e', 'data-k', 'data-a', 'data-b'] });
    } catch (_) { /* ok */ }
    return c;
  };
  const comCena = (cena, op) => { op.classList.add('com-cena'); op.prepend(cena); return op; };
  const opcao = (rot, controle, desc) => h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, rot), desc ? h('div', { class: 'peq suave' }, desc) : null), controle);
  const ouvir = (offs, ev, f) => offs.push(A.evt.on(ev, f));

  // ---------- perfil de qualquer pessoa (usado na lista de amigos e dentro da sala) ----------
  U.perfil = async (p) => {
    const corpo = h('div', { class: 'col', estilo: { 'align-items': 'center', 'text-align': 'center' } }, h('div', { class: 'suave' }, T('Carregando...', 'Loading...')));
    const m = U.modal(null, corpo, { largura: 440 });
    try {
      const d = p.codigo ? await API.perfil(p.codigo) : { nome: p.nome, tag: p.tag, codigo: '', av: 0, amizade: null };
      const ehEu = API.eu && d.codigo === API.eu.codigo;
      corpo.textContent = '';
      corpo.append(U.avatar(d, 96), h('div', { estilo: { 'font-size': '24px', 'font-weight': '700' } }, d.nome, ' ', h('span', { class: 'tag' }, d.tag ? '#' + d.tag : '')),
        d.codigo ? h('div', { class: 'peq suave' }, T('Código de amigo: ', 'Friend code: '), h('b', { class: 'selecionavel' }, d.codigo)) : h('div', { class: 'peq suave' }, T('Convidado (sem conta)', 'Guest (no account)')),
        d.criado ? h('div', { class: 'peq suave' }, T('Conta criada em ', 'Account created on '), new Date(d.criado).toLocaleDateString(A.idioma())) : null);
      if (d.amizade === 'aceita') { const e = h('div', { class: 'estat vidro interno pad', estilo: { width: '100%' } }, h('div', { class: 'suave' }, T('Carregando estatísticas...', 'Loading stats...'))); corpo.append(e); estatisticas(e, d.codigo); }
      else if (d.codigo && !ehEu && !d.amizade) corpo.append(U.btn(T('Adicionar amigo', 'Add friend'), { icone: 'mais', onclick: async (ev) => { try { await API.amigos.pedir(d.codigo); ev.currentTarget.disabled = true; U.toast(T('Pedido enviado!', 'Request sent!'), { tipo: 'ok' }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }));
    } catch (e) { corpo.textContent = e.message; }
  };

  async function estatisticas(el, codigo) {
    try {
      const s = await API.amigos.stats(codigo);
      const linha = (n, rot) => h('div', {}, h('div', { class: 'n' }, A.fmtDuracao(n)), h('div', { class: 'peq suave' }, rot));
      el.textContent = '';
      el.append(linha(s.eleViu, T('que ele(a) já assistiu da sua tela', 'they have watched of your screen')), linha(s.voceViu, T('que você já assistiu da tela dele(a)', 'you have watched of their screen')), linha(s.juntos, T('juntos em salas, no total', 'together in rooms, in total')));
    } catch (e) { el.textContent = e.message; }
  }

  // ---------- CONEXÕES ----------
  ABAS.conexoes = (el, ctx) => {
    const offs = [];
    const bolhas = h('div', { class: 'bolhas' }), vazio = h('p', { class: 'suave conex-vazio' }, T('Nenhum amigo online agora. Quando alguém abrir o Aero, a bolha dele aparece aqui. (Adicione amigos pelo código ou pela # no Aero Talk > Amigos.)', 'No friends online right now. When someone opens Aero, their bubble shows up here. (Add friends by code or # in Aero Talk > Friends.)'));
    const els = new Map();
    // (0.5.9-5) só quem está ONLINE aparece. Quem chega ganha uma bolha que se forma (com som); quem sai, a bolha estoura. As animações
    // só rodam com a aba visível; a primeira pintura (abrir a aba) é sem animação nenhuma, sem bolhas "acendendo e apagando".
    let primeira = true;
    const visivel = () => !document.hidden && bolhas.isConnected;
    // (0.5.9-7) UMA bolha por pessoa. Quem está em vários aparelhos aparece com todos eles dentro da mesma bolha; e quando a internet de
    // alguém oscila e ele reconecta, o aparelho repetido (mesmo nome e sistema) conta uma vez só. Antes cada reconexão virava uma bolha nova.
    const render = () => {
      const ok = new Set(H.amigos.filter((a) => a.estado === 'aceita').map((a) => a.codigo));
      const grupos = new Map();
      for (const p of H.presenca.values()) {
        if (!ok.has(p.codigo) || p.estado === 'offline') continue;
        let g = grupos.get(p.codigo); if (!g) { g = { codigo: p.codigo, nome: p.nome, av: p.av, tag: p.tag, ins: p.ins, devs: new Map() }; grupos.set(p.codigo, g); }
        const k = p.maquina + '|' + p.so, ja = g.devs.get(k);
        if (!ja || (p.sala && !ja.sala) || (p.estado === 'online' && ja.estado !== 'online')) g.devs.set(k, p); // fica o que está numa sala / online
      }
      const lista = [...grupos.values()].map((g) => { const ds = [...g.devs.values()]; const sala = ds.find((d) => d.comp) || ds.find((d) => d.sala); return { ...g, ds, sala, estado: ds.some((d) => d.estado === 'online') ? 'online' : ds.some((d) => d.estado === 'ocupado') ? 'ocupado' : 'ausente' }; })
        .sort((a, b) => (b.sala ? 1 : 0) - (a.sala ? 1 : 0) || a.nome.localeCompare(b.nome));
      const vivos = new Set(lista.map((p) => p.codigo));
      [...els].forEach(([k, e]) => { if (vivos.has(k)) return; els.delete(k); if (!primeira && visivel()) { A.som.tocar('estourar'); e.classList.add('estourando'); setTimeout(() => e.remove(), 420); } else e.remove(); });
      const novas = [], muitas = lista.length > 5;
      bolhas.classList.toggle('muitas', muitas);
      lista.forEach((p) => {
        let b = els.get(p.codigo);
        if (!b) {
          b = h('div', { class: 'bolha', tabindex: '0', dados: { menu: '1' } }); // o controle alcança a bolha; X abre o menu da pessoa
          b.av = h('span'); b.nm = h('div', { class: 'nm' }); b.so = h('div', { class: 'so' }); b.pil = h('span', { class: 'pilula' }); b.q = h('div', { class: 'peq suave' });
          // (0.7.14) clique na bolha (fora do botão de assistir): abre a conversa com a pessoa no Aero Talk
          const abrirChat = async () => { const q = b.pessoa; if (!q || !A.talk) return; try { const c = await A.talk.abrirDM(q.codigo); A.talk.irPara(c.id); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } };
          b.addEventListener('click', (e) => { if (e.button === 0 && !e.target.closest('.btn')) abrirChat(); });
          b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === b) { e.preventDefault(); abrirChat(); } });
          b.addEventListener('contextmenu', (e) => { const q = b.pessoa; if (q && A.perfil && A.perfil.menu) A.perfil.menu(e, { codigo: q.codigo, nome: q.nome, tag: q.tag, av: q.av }); });
          b.append(b.av, b.nm, b.so, b.pil, b.q); els.set(p.codigo, b); bolhas.append(b);
          // (0.7.0) as bolhas aparecem uma de cada vez, cada uma com o som dela (ao abrir a aba também, em sequência)
          // (0.7.1) até a vez dela a bolha fica PARADA e invisível (antes já estava subindo e descendo escondida, e aparecia no meio do balanço);
          // o balanço só começa depois que ela se formou. Com mais de 5 pessoas online, aparecem todas juntas, sem animação (só o som)
          novas.push(b);
        }
        b.pessoa = p;
        const est = p.estado === 'online' ? 'online' : 'ausente';
        b.className = 'bolha ' + est + ['nasce', 'espera', 'filtrada'].filter((c) => b.classList.contains(c)).map((c) => ' ' + c).join(''); b.sala = p.sala && p.sala.sala; b.title = p.nome + (p.ds.some((d) => d.maquina) ? ' · ' + p.ds.map((d) => d.maquina).filter(Boolean).join(', ') : '');
        const ptv = b.av.querySelector('.pt'); if (ptv) U.pintarPt(ptv, p.codigo, p.estado);
        if (b.av.dataset.cod !== p.codigo || b.av.dataset.av !== String(p.av || 0) || b.av.dataset.st !== p.estado) { b.av.replaceWith(b.av = U.avatar(p, 56, p.estado)); b.av.classList.add('bolha-av'); b.av.dataset.st = p.estado; }
        // (0.6.0) com o aparelho escondido, a bolha mostra o nome da pessoa no lugar (antes ficava "online" repetido)
        const semAparelho = !p.ds.some((d) => d.maquina);
        const nm = semAparelho ? p.nome : p.ds.length > 1 ? p.ds.length + T(' aparelhos', ' devices') : p.ds[0].maquina;
        if (b.nm.textContent !== nm) b.nm.textContent = nm;
        const so = [...new Set(p.ds.map((d) => d.so).filter(Boolean))].join(' · '); if (b.so.textContent !== so) b.so.textContent = so;
        b.pil.className = 'pilula ' + p.estado; b.pil.textContent = U.textoStatusDe(p.codigo, p.estado);
        b.q.textContent = (semAparelho ? '' : p.nome) + (p.sala ? (semAparelho ? '' : ' · ') + (p.sala.comp ? T('transmitindo', 'sharing') : T('em uma sala', 'in a room')) : '');
        // está numa sala: assistir (transmitindo) ou pedir para entrar (o pedido vai para o líder da sala)
      });
      // (0.6.0) UM som só, próprio, quando bolhas aparecem (antes tocava um por pessoa, todos de uma vez); ao abrir a aba com gente online, também uma vez
      // (antes: um som só para todas, que apareciam de uma vez)
      if (novas.length && visivel()) {
        if (muitas) A.som.tocar('bolha');
        else novas.forEach((b, i) => { b.classList.add('espera'); setTimeout(() => { if (!b.isConnected) return; b.classList.remove('espera'); b.classList.add('nasce'); A.som.tocar('bolha'); }, i * 170); });
      }
      filtrar();
      vazio.hidden = lista.length > 0;
      lista.forEach((p, i) => { const b = els.get(p.codigo); if (b && bolhas.children[i] !== b) bolhas.insertBefore(b, bolhas.children[i] || null); }); // sem tirar e pôr de volta (reiniciaria a animação)
      primeira = false;
    };
    // (0.7.1) pesquisar amigos: filtra as bolhas de quem está online e mostra também quem está offline (com um botão para mandar mensagem)
    const busca = h('input', { class: 'campo conex-busca', 'data-busca': '', type: 'search', placeholder: T('Pesquisar amigos…', 'Search friends…'), 'aria-label': T('Pesquisar amigos', 'Search friends'), spellcheck: 'false' });
    const achados = h('div', { class: 'conex-achados', hidden: true });
    const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    function filtrar() {
      const q = norm(busca.value.trim());
      for (const b of els.values()) { const p = b.pessoa || {}; b.classList.toggle('filtrada', !!q && !norm([p.nome, p.tag, p.codigo, ...(p.ds || []).map((d) => d.maquina)].join(' ')).includes(q)); }
      achados.textContent = '';
      if (!q) { achados.hidden = true; return; }
      const fora = H.amigos.filter((a) => a.estado === 'aceita' && !els.has(a.codigo) && norm([a.nome, a.apelido, a.tag, a.codigo].join(' ')).includes(q));
      const algumOn = [...els.values()].some((b) => !b.classList.contains('filtrada'));
      achados.hidden = false;
      if (!fora.length && !algumOn) { achados.append(h('p', { class: 'suave peq' }, T('Nenhum amigo com esse nome.', 'No friend with that name.'))); return; }
      if (fora.length) achados.append(h('div', { class: 'peq suave conex-achados-tit' }, T('Offline', 'Offline')), ...fora.slice(0, 40).map((a) => h('div', { class: 'conex-achado', dados: { menu: '1' }, oncontextmenu: (e) => A.perfil && A.perfil.menu(e, a) },
        U.avatar(a, 34, 'offline'), h('div', { class: 'cresce' }, h('b', {}, a.apelido || a.nome), a.tag ? h('div', { class: 'peq suave' }, '#' + a.tag) : null),
        U.btn('', { icone: 'pessoa', tipo: 'sec', redondo: true, peq: true, titulo: T('Perfil', 'Profile'), onclick: () => A.perfil && A.perfil.ver(a.codigo) }),
        U.btn('', { icone: 'chat', tipo: 'sec', redondo: true, peq: true, titulo: T('Mensagem', 'Message'), onclick: async () => { try { const c = await A.talk.abrirDM(a.codigo); A.talk.irPara(c.id); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }))));
    }
    busca.addEventListener('input', filtrar);
    busca.addEventListener('keydown', (e) => { if (e.key === 'Escape') { busca.value = ''; filtrar(); } });
    const salvo = A.cfg.v.host;
    const retomar = null; // (0.9.6) sem salas: compartilhar a tela é só nas chamadas do Aero Talk
    // as bolhas ficam numa área de vidro que cresce até o fim da janela (sem espaço vazio sobrando embaixo)
    // (0.8.0) "Disponíveis" (as bolhas de quem está online) e "Todas as conexões" (os amigos, pedidos e enviados: o que era a aba Amigos do Aero Talk)
    const rolar = h('div', { class: 'conex-rolar' }, bolhas, achados, vazio), todas = h('div', { class: 'conex-rolar conex-todas', hidden: true });
    let limparTodas = null;
    const titulo = h('h2', {}, T('Conexões disponíveis', 'Available connections'));
    const verModo = (v) => {
      const tudo = v === 'todas'; rolar.hidden = tudo; busca.hidden = tudo; todas.hidden = !tudo;
      titulo.textContent = tudo ? T('Todas as conexões', 'All connections') : T('Conexões disponíveis', 'Available connections');
      if (tudo && !todas.children.length) { const r = ABAS.amigos(todas, ctx) || {}; limparTodas = r.limpar; }
    };
    const segConex = U.seg([['disp', T('Disponíveis', 'Available'), 'bolhas'], ['todas', T('Todas as conexões', 'All connections'), 'pessoas']], 'disp', (v) => { verModo(v); A.som.tocar('click'); });
    segConex.classList.add('conex-seg');
    offs.push(() => limparTodas && limparTodas());
    // (0.8.0) sem "Entrar com um código" (fica no Transmitir) e sem "Adicionar amigos" (Todas as conexões já tem, em cima)
    el.append(h('div', { class: 'cab' }, titulo), h('section', { class: 'conex-area' }, h('div', { class: 'conex-topo' }, segConex, busca), rolar, todas), retomar ? h('div', { class: 'grade g2', estilo: { 'margin-top': '14px' } }, retomar) : null);
    ouvir(offs, 'hub:presenca', render); ouvir(offs, 'hub:offline', render); ouvir(offs, 'hub:amigos', render); ouvir(offs, 'idioma', render);
    render();
    // (0.8.7) na bolha do perfil, a coluna embaixo do seu cartão vira a lista de contatos (como no MSN): online em cima, depois offline
    if (ctx.lateralNaBolha && ctx.lateralNaBolha()) {
      const corpoMsn = h('div', { class: 'msn-corpo' });
      const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const buscaMsn = h('input', { type: 'search', class: 'msn-busca', placeholder: T('Procurar amigo…', 'Search friends…'), 'aria-label': T('Procurar amigo', 'Search friends'), oninput: () => pintarMsn() });
      const lista = h('div', { class: 'msn-lista vidro' }, h('label', { class: 'msn-busca-caixa' }, A.icone('lupa', 16), buscaMsn), corpoMsn);
      const linha = (a, est) => {
        const r = h('div', { class: 'msn-it' + (est === 'offline' ? ' off' : ''), role: 'button', tabindex: '0', title: T('Ver perfil', 'View profile'), onclick: () => A.perfil && A.perfil.ver(a.codigo) },
          U.avatar(a, 34, est), h('div', { class: 'cresce' }, h('b', {}, a.apelido || a.nome), h('small', {}, U.textoStatusDe ? U.textoStatusDe(a.codigo, est) : est), A.jogando ? A.jogando.linha(a.codigo) : null, A.assistindo ? A.assistindo.linha(a.codigo) : null, A.ouvindo ? A.ouvindo.linha(a.codigo) : null),
          U.btn('', { icone: 'chat', tipo: 'sec', redondo: true, peq: true, titulo: T('Mensagem', 'Message'), onclick: async (e) => { e.stopPropagation(); try { const c = await A.talk.abrirDM(a.codigo); if (c && A.talk.irPara) A.talk.irPara(c); } catch (x) { U.toast(x.message, { tipo: 'erro' }); } } }));
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter') r.click(); });
        return r;
      };
      const grupoMsn = (tit, itens, cls) => itens.length ? h('div', { class: 'msn-grupo ' + cls }, h('div', { class: 'msn-tit' }, h('i'), tit, h('span', {}, String(itens.length))), ...itens) : null;
      const pintarMsn = () => {
        const q = semAcento(buscaMsn.value.trim());
        const todos = H.amigos.filter((a) => a.estado === 'aceita');
        const am = todos.filter((a) => !q || semAcento([a.apelido, a.nome, a.tag, a.codigo].filter(Boolean).join(' ')).includes(q)).map((a) => ({ a, est: U.estadoDe(a.codigo) }));
        const on = am.filter((x) => x.est !== 'offline' && x.est !== 'invisivel').sort((x, y) => (x.a.apelido || x.a.nome).localeCompare(y.a.apelido || y.a.nome));
        const off = am.filter((x) => x.est === 'offline' || x.est === 'invisivel').sort((x, y) => (x.a.apelido || x.a.nome).localeCompare(y.a.apelido || y.a.nome));
        if (q && !am.length) { corpoMsn.replaceChildren(h('p', { class: 'suave peq msn-nada' }, T('Ninguém com esse nome.', 'Nobody with that name.'))); return; }
        buscaMsn.parentNode.hidden = !todos.length;
        corpoMsn.replaceChildren(...(am.length ? [grupoMsn(T('Online', 'Online'), on.map((x) => linha(x.a, x.est)), 'on'), grupoMsn(T('Offline', 'Offline'), off.slice(0, 80).map((x) => linha(x.a, 'offline')), 'off')].filter(Boolean)
          : [h('div', { class: 'msn-vazio' }, E_CENA(), h('p', { class: 'suave peq' }, T('Seus amigos aparecem aqui. Adicione pela # em Todas as conexões.', 'Your friends show up here. Add them by # in All connections.')))]));
      };
      const E_CENA = () => (A.estudio ? A.estudio.cena('aparelhos') : h('i'));
      ctx.lateral(lista); pintarMsn();
      ouvir(offs, 'hub:presenca', pintarMsn); ouvir(offs, 'hub:offline', pintarMsn); ouvir(offs, 'hub:amigos', pintarMsn);
    }
    return { limpar: () => offs.forEach((f) => f()) };
  };

  // ---------- AMIGOS ----------
  ABAS.amigos = (el, ctx) => {
    const offs = [];
    const eu = API.eu;
    const lista = h('div', { class: 'lista-amigos' }), pedidos = h('div', { class: 'lista-amigos' }), enviados = h('div', { class: 'lista-amigos' });
    const msg = h('p', { class: 'msg' });
    const quando = (a) => { const ds = H.dispositivosDe(a.codigo); if (!ds.length) return T('offline', 'offline'); const s = ds.find((d) => d.sala); return s ? (s.comp ? T('transmitindo agora', 'sharing now') : T('em uma sala', 'in a room')) : ds[0].estado === 'online' ? T('online em ', 'online on ') + ds[0].maquina : T('ausente', 'away'); };
    const linha = (a, extra) => {
      const ds = H.dispositivosDe(a.codigo);
      const est = !ds.length ? 'offline' : ds.some((d) => d.estado === 'online') ? 'online' : 'ausente';
      return h('div', { class: 'amigo vidro', role: 'button', tabindex: '0', dados: { menu: '1' }, oncontextmenu: (e) => { if (a.estado === 'aceita' && A.perfil && A.perfil.menu) A.perfil.menu(e, a); }, onclick: (e) => { if (!e.target.closest('.btn')) { if (A.perfil && a.estado === 'aceita') A.perfil.ver(a.codigo); else abrirAmigo(a); } } }, U.avatar(a, 50, est),
        h('div', { class: 'cresce' }, h('div', { class: 'nm' }, a.nome, ' ', h('span', { class: 'tag' }, '#' + a.tag)), h('div', { class: 'quando' }, a.estado === 'aceita' ? quando(a) : a.estado === 'recebido' ? T('quer ser seu amigo', 'wants to be your friend') : T('aguardando resposta', 'waiting for a reply')), a.estado === 'aceita' && A.jogando ? A.jogando.linha(a.codigo) : null, a.estado === 'aceita' && A.assistindo ? A.assistindo.linha(a.codigo) : null, a.estado === 'aceita' && A.ouvindo ? A.ouvindo.linha(a.codigo) : null), extra);
    };
    const agir = async (f) => { try { await f(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
    const render = () => {
      const por = (s) => H.amigos.filter((a) => a.estado === s).sort((a, b) => a.nome.localeCompare(b.nome));
      const on = (a) => (H.online(a.codigo) ? 0 : 1);
      lista.textContent = ''; pedidos.textContent = ''; enviados.textContent = '';
      const q = buscaAmigo.value.trim().toLowerCase().replace(/^#/, '');
      const todos = por('aceita').sort((a, b) => on(a) - on(b));
      const ok = q ? todos.filter((a) => [a.nome, a.apelido, a.tag].some((x) => x && String(x).toLowerCase().includes(q))) : todos;
      contAmigos.textContent = todos.length ? String(todos.length) : '';
      if (q && !ok.length) lista.append(h('p', { class: 'suave', estilo: { padding: '14px', 'text-align': 'center' } }, T('Nenhum amigo com esse nome.', 'No friend with that name.')));
      if (!todos.length) lista.append(h('p', { class: 'suave', estilo: { padding: '18px', 'text-align': 'center' } }, T('Você ainda não tem amigos. Passe seu código ou use o de alguém.', 'No friends yet. Share your code or use someone\'s.')));
      ok.forEach((a) => {
        const ds = H.dispositivosDe(a.codigo).find((d) => d.sala);
        lista.append(linha(a, null));
      });
      por('recebido').forEach((a) => pedidos.append(linha(a, h('div', { class: 'linha' }, U.btn(T('Aceitar', 'Accept'), { peq: true, tipo: 'ok', onclick: () => agir(() => API.amigos.aceitar(a.codigo)) }), U.btn(T('Recusar', 'Decline'), { peq: true, tipo: 'sec', onclick: () => agir(() => API.amigos.remover(a.codigo)) })))));
      por('enviado').forEach((a) => enviados.append(linha(a, U.btn(T('Cancelar', 'Cancel'), { peq: true, tipo: 'sec', onclick: () => agir(() => API.amigos.remover(a.codigo)) }))));
      if (!enviados.children.length) enviados.append(h('p', { class: 'suave enviados-vazio', estilo: { padding: '14px', 'text-align': 'center' } }, '🫧 ', T('Por enquanto você é uma bolha solitária... convide mais bolhinhas pra conversar com você!', 'For now you are a lonely bubble... invite more little bubbles to chat with you!')));
      // (0.5.9-6) pedidos no topo; os enviados só aparecem quando existem (ou, sem amigo nenhum, a bolha solitária)
      pedSec.hidden = !pedidos.children.length; envSec.hidden = !por('enviado').length;
      semPedidos.hidden = !(pedSec.hidden && envSec.hidden); // (0.8.7) aqui ficam só os pedidos (os amigos estão na coluna ao lado)
      if (!pintouAmigos) { pintouAmigos = true; setTimeout(() => [lista, pedidos, enviados].forEach((x) => x.classList.add('fixo')), 700); } // depois da primeira vez, repintar (alguém ficou online) não anima de novo
    };
    let pintouAmigos = false;
    const novo = h('input', { class: 'campo', placeholder: T('Código de amigo ou #tag', 'Friend code or #tag'), maxlength: 24, spellcheck: 'false' });
    const adicionar = async () => {
      const v = novo.value.trim(); if (!v) return;
      try { await API.amigos.pedir(v); novo.value = ''; msg.textContent = T('Pedido enviado!', 'Request sent!'); msg.className = 'msg ok'; A.som.tocar('sucesso'); }
      catch (e) { msg.textContent = e.message; msg.className = 'msg erro'; A.som.tocar('erro'); }
    };
    novo.addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
    const pedSec = secao(T('Pedidos recebidos', 'Requests received'), pedidos), envSec = secao(T('Pedidos enviados', 'Sent requests'), enviados);
    const semPedidos = h('section', { class: 'vidro pad', hidden: true }, h('p', { class: 'suave peq', estilo: { margin: 0, 'text-align': 'center' } }, T('Nenhum pedido de amizade agora. Seus amigos ficam na coluna ao lado.', 'No friend requests right now. Your friends are in the side column.')));
    // "Seus amigos": procurar e recolher/abrir a lista (fica lembrado)
    const buscaAmigo = h('input', { class: 'campo amigos-busca', placeholder: T('Procurar amigo...', 'Search friend...'), 'aria-label': T('Procurar amigo', 'Search friend'), hidden: true });
    buscaAmigo.addEventListener('input', () => render());
    buscaAmigo.addEventListener('keydown', (e) => { if (e.key === 'Escape') { buscaAmigo.value = ''; buscaAmigo.hidden = true; render(); } });
    const contAmigos = h('span', { class: 'suave peq amigos-n' });
    let recolhida = A.store.ler('aero-amigos-recolhida', '') === '1';
    const btnBusca = U.btn('', { icone: 'lupa', tipo: 'sec', redondo: true, peq: true, titulo: T('Procurar amigo', 'Search friend'), onclick: () => { buscaAmigo.hidden = !buscaAmigo.hidden; if (!buscaAmigo.hidden) { if (recolhida) alternarLista(); buscaAmigo.focus(); } else if (buscaAmigo.value) { buscaAmigo.value = ''; render(); } } });
    const btnSeta = U.btn('', { icone: 'chevron', tipo: 'sec', redondo: true, peq: true, titulo: T('Recolher ou mostrar a lista', 'Collapse or show the list') });
    btnSeta.classList.add('amigos-seta');
    const amigosSec = h('section', { class: 'vidro pad amigos-sec', estilo: { 'margin-bottom': '14px' } }, h('div', { class: 'linha amigos-cab' }, h('h3', { class: 'cresce' }, T('Seus amigos', 'Your friends'), ' ', contAmigos), btnBusca, btnSeta), buscaAmigo, lista);
    function alternarLista() { recolhida = !recolhida; A.store.gravar('aero-amigos-recolhida', recolhida ? '1' : ''); amigosSec.classList.toggle('recolhida', recolhida); A.som.tocar(recolhida ? 'pop-fechar' : 'pop-abrir'); }
    btnSeta.onclick = alternarLista; btnSeta.dataset.somProprio = '1';
    amigosSec.classList.toggle('recolhida', recolhida);

    function abrirAmigo(a) {
      const estat = h('div', { class: 'estat vidro interno pad' }, h('div', { class: 'suave' }, T('Carregando estatísticas...', 'Loading stats...')));
      const confia = U.chave(a.confia, (v) => agir(() => API.amigos.confianca(a.codigo, v)));
      const ds = H.dispositivosDe(a.codigo).find((d) => d.sala);
      const m = U.modal(null, [
        h('div', { class: 'col', estilo: { 'align-items': 'center', 'text-align': 'center', gap: '6px' } }, U.avatar(a, 96, H.online(a.codigo) ? 'online' : 'offline'),
          h('div', { estilo: { 'font-size': '24px', 'font-weight': '700' } }, a.nome, ' ', h('span', { class: 'tag' }, '#' + a.tag)),
          h('div', { class: 'peq suave' }, T('Código: ', 'Code: '), h('b', { class: 'selecionavel' }, a.codigo), a.desde ? ' · ' + T('amigos desde ', 'friends since ') + new Date(a.desde).toLocaleDateString(A.idioma()) : '')),
        estat, opcao(T('Entra na minha tela sem pedir', 'Joins my screen without asking'), confia),
        h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end', 'flex-wrap': 'wrap' } },           U.btn(T('Remover amigo', 'Remove friend'), { tipo: 'perigo', onclick: async () => { if (await U.confirmar(T('Remover ', 'Remove ') + a.nome + '?', { perigo: true })) { await agir(() => API.amigos.remover(a.codigo)); m.fechar(); } } })),
      ], { largura: 460 });
      estatisticas(estat, a.codigo);
    }

    el.append(cab(T('Amigos', 'Friends')), h('div', { class: 'grade g2 amigos-topo' },
      secao(T('Seu código de amigo', 'Your friend code'), h('div', { class: 'linha' }, h('div', { class: 'cresce' }, h('div', { class: 'selecionavel', estilo: { 'font-size': '26px', 'font-weight': '700', 'letter-spacing': '3px' } }, eu.codigo), h('div', { class: 'peq suave' }, T('ou use a sua #', 'or use your #'), ' ', h('b', {}, '#' + eu.tag))), U.btn(T('Copiar', 'Copy'), { icone: 'copiar', tipo: 'sec', onclick: (e) => U.copiar(eu.codigo, e.currentTarget) }))),
      secao(T('Adicionar amigo', 'Add a friend'), h('div', { class: 'linha' }, novo, U.btn('', { icone: 'mais', redondo: true, titulo: T('Enviar pedido', 'Send request'), onclick: adicionar })), msg)),
      pedSec, envSec, semPedidos);
    void amigosSec; // (0.8.7) a lista "Seus amigos" saiu daqui: os amigos já ficam na coluna ao lado
    ouvir(offs, 'hub:amigos', render); ouvir(offs, 'hub:presenca', render); ouvir(offs, 'hub:offline', render);
    render();
    return { limpar: () => offs.forEach((f) => f()) };
  };

  // ---------- TRANSMITIR ----------
  ABAS.transmitir = (el, ctx) => {
    const c = A.cfg.v.host;
    let fonte = { id: null, nome: T('Tela principal', 'Main screen') };
    const gpuTxt = h('span'), gpuDica = h('span');
    const gpuInfo = h('div', { class: 'peq suave' }, gpuTxt, gpuDica);
    // (0.7.10) a mesma escolha da sala ao vivo e do Aero Talk; refaz quando o teste da placa muda o padrão
    const qualidade = h('div', { class: 'col', estilo: { gap: '8px' } });
    const pintarQualidade = () => qualidade.replaceChildren(...A.gpu.seletoresQualidade());
    const mostrarGpu = () => {
      const r = A.gpu.resultado;
      gpuTxt.textContent = !r ? T('Verificando a placa de vídeo...', 'Checking your graphics card...')
        : r.linux && r.hw ? (r.verificado ? T('Placa de vídeo confirmada: ela codifica o vídeo (H.264). ', 'Graphics card confirmed: it encodes the video (H.264). ') : T('A placa de vídeo codifica o vídeo (H.264 pelo VA-API) quando você transmite. ', 'Your graphics card encodes the video (H.264 via VA-API) when you share. ')) + T('Na sala, o painel mostra "GPU" e o fps real.', 'In the room, the panel shows "GPU" and the real fps.')
        : r.linux && r.verificado ? T('O Chromium NÃO encontrou o codificador H.264 da placa (o vídeo sai pelo processador). Mande o relatório de diagnóstico (Configurações > Conta e diagnóstico).', 'Chromium did NOT find the GPU H.264 encoder (video goes through the CPU). Send the diagnostics report (Settings > Account and diagnostics).')
        : r.hw ? T('Placa de vídeo codificando por hardware: resolução nativa no FPS escolhido.', 'Hardware encoding on your GPU: native resolution at the FPS you pick.')
        : T('Sem codificação pela placa neste aparelho: usando o processador (', 'No GPU encoding on this device: using the CPU (') + r.melhor.id + ')';
      gpuDica.textContent = '';
      pintarQualidade();
    };
    // (0.7.1) "Verificar a placa" aqui na aba Transmitir: antes, no Windows, só disparava o teste sem mostrar nada (sem "verificando", e o
    // resultado igual ao de antes parecia que o botão não fazia nada; com o teste da abertura ainda rodando, era ignorado). Agora mostra o
    // andamento e o resultado, como em Configurações
    async function verificarPlaca(b) {
      if (b.disabled) return;
      b.disabled = true;
      try {
        const i = await A.infoPC();
        if (i.so !== 'Linux') {
          gpuDica.textContent = ' ' + T('Verificando a placa (alguns segundos)...', 'Checking the GPU (a few seconds)...');
          const r = await A.gpu.testar({ forcar: true });
          mostrarGpu();
          gpuDica.textContent = ' ' + (!r ? T('Não consegui verificar agora. Tente de novo.', 'Could not check now. Try again.') : r.hw ? T('Verificado agora: a PLACA codifica o vídeo.', 'Checked now: the GPU encodes the video.') : T('Verificado agora: a placa NÃO codifica; o processador faz o trabalho. Atualize o driver da placa e verifique de novo.', 'Checked now: the GPU does NOT encode; the CPU does the work. Update your GPU driver and check again.'));
          return;
        }
        gpuDica.textContent = ' ' + T('Testando as combinações da placa (até 1 minuto)...', 'Testing GPU combinations (up to 1 minute)...'); const v = await A.gpu.verificar(); gpuDica.textContent = ' ' + (!v ? '' : v.reiniciar ? T('Achei uma combinação em que a PLACA codifica. Reinicie o app para usar (aparece um aviso com o botão).', 'Found a combination where the GPU encodes. Restart the app to use it.') : v.hw ? T('Resultado: a PLACA codifica' + (v.impl ? ' (' + v.impl + ')' : '') + '.', 'Result: the GPU encodes' + (v.impl ? ' (' + v.impl + ')' : '') + '.') : v.hw ? T('Resultado: o Chromium enxerga o codificador H.264 da PLACA' + (v.perfis && v.perfis.length ? ' (' + v.perfis.length + ' perfis)' : '') + '. Na sala, o painel confirma com "GPU".', 'Result: Chromium sees the GPU H.264 encoder' + (v.perfis && v.perfis.length ? ' (' + v.perfis.length + ' profiles)' : '') + '. In the room, the panel confirms with "GPU".') : T('Resultado: o Chromium NÃO enxerga o codificador H.264 da placa; o vídeo sairia pelo processador. Mande o relatório de diagnóstico.', 'Result: Chromium does NOT see the GPU H.264 encoder; video would use the CPU. Send the diagnostics report.'));
      } catch (x) { gpuDica.textContent = ' ' + T('Não consegui verificar: ', 'Could not check: ') + (x && x.message || x); } finally { b.disabled = false; }
    }
    const offs = [A.evt.on('gpu', mostrarGpu)];
    mostrarGpu();
    if (!A.gpu.resultado && !A.gpu.testando) A.gpu.testar().catch((e) => A.log.erro('gpu', e)); // abriu Transmitir antes do teste: roda agora

    // Dois modos só: Compartilhar (mostra a tela) e Jogo (deixa os amigos jogarem e prioriza o menor atraso)
    const textoModo = (m) => (m === 'jogo' ? T('Seus amigos podem jogar na sua máquina (controle, mouse e teclado, conforme você permitir) e o atraso é o menor possível.', 'Your friends can play on your machine (gamepad, mouse and keyboard, as you allow) and the delay is as low as possible.') : T('Só mostra a sua tela e o som para os amigos.', 'Just shows your screen and sound to your friends.'));
    const descModo = h('div', { class: 'peq suave', estilo: { 'margin-top': '8px' } }, textoModo(c.modo));
    const modoSel = U.seg([['tela', T('Compartilhar', 'Share'), 'tela'], ['jogo', T('Jogo', 'Game'), 'controle']], c.modo === 'jogo' ? 'jogo' : 'tela', (v) => { c.modo = v; A.cfg.salvar(); descModo.textContent = textoModo(v); });
    const nomeFonte = h('b', {}, fonte.nome);
    A.portalPC().then((p) => { if (p) nomeFonte.textContent = T('Você escolhe no seletor do sistema ao iniciar', 'You pick in the system picker when you start'); });
    const escolherFonte = async () => {
      if (await A.portalPC()) { U.toast(T('No seu Linux a tela ou janela é escolhida no seletor do sistema, que abre quando você inicia a transmissão.', 'On your Linux the screen or window is picked in the system picker, which opens when you start sharing.'), { ms: 5200 }); return; }
      if (!A.plat.desktop) { U.toast(T('O navegador vai perguntar qual tela ou janela quando você iniciar.', 'The browser will ask which screen or window when you start.')); return; }
      const f = await U.escolherFonte();
      if (f) { fonte = f; nomeFonte.textContent = f.nome; }
    };
    const salaCod = h('b', { class: 'selecionavel', estilo: { 'letter-spacing': '2px' } }), chaveCod = h('b', { class: 'selecionavel', estilo: { 'letter-spacing': '2px' } });
    // Padrão: sala NOVA. "Retomar" só aparece (e vira o padrão) se a sala anterior ainda estiver aberta no servidor.
    let nova = true, anteriorAberta = false, porCodigo = false;
    // (0.5.9-5) também dá para transmitir numa sala pelo CÓDIGO: com o código de retorno você é o host dela; só com o código da sala,
    // você entra (o líder aprova) e começa a compartilhar lá dentro
    const codSala = h('input', { class: 'campo', placeholder: T('Código da sala (ex.: ABC234)', 'Room code (e.g. ABC234)'), maxlength: 12, spellcheck: 'false', estilo: { 'text-transform': 'uppercase', 'letter-spacing': '2px' } });
    if (c.sala) A.api.salaExiste(c.sala).then((sim) => { anteriorAberta = sim; nova = !sim; mostrarSala(); });
    const modoSala = h('div');
    const mostrarSala = () => {
      modoSala.textContent = '';
      const opc = [...(c.sala && anteriorAberta ? [['retomar', T('Retomar minha sala', 'Resume my room'), 'casa']] : []), ['nova', T('Criar sala nova', 'New room'), 'mais'], ['codigo', T('Usar um código', 'Use a code'), 'teclado']];
      modoSala.append(U.seg(opc, porCodigo ? 'codigo' : nova ? 'nova' : 'retomar', (v) => { porCodigo = v === 'codigo'; nova = v === 'nova'; mostrarSala(); }));
      // (0.8.0) sem "código de retorno": a sua sala você retoma pelo código dela mesmo; a de outra pessoa, você entra (o líder aprova) e compartilha lá
      if (porCodigo) { modoSala.append(h('div', { class: 'col', estilo: { gap: '8px', 'margin-top': '10px' } }, codSala, h('div', { class: 'peq suave' }, T('Se a sala for sua, você volta como dono dela. Se for de outra pessoa, você entra (o líder aprova) e começa a compartilhar lá.', 'If the room is yours, you come back as its owner. If it is someone else\'s, you join (the leader approves) and start sharing there.')))); return; }
      salaCod.textContent = nova ? T('será criada ao iniciar', 'created on start') : c.sala; chaveCod.textContent = nova ? '—' : c.chave;
      modoSala.append(h('div', { class: 'peq suave', estilo: { 'margin-top': '10px' } }, T('Sala: ', 'Room: '), salaCod));
    };
    mostrarSala();
    const audio = U.chave(c.audio, (v) => { c.audio = v; A.cfg.salvar(); });
    const apps = A.mixer.appsCaptura();
    offs.push(apps.parar);
    const iniciar = U.btn(T('Iniciar transmissão', 'Start sharing'), { grande: true, icone: 'enviarTela', onclick: async () => {
      const p = A.gpu.presetUsuario();
      if (porCodigo) {
        const sala = codSala.value.trim().toUpperCase(), chave = sala === c.sala ? c.chave : '';
        if (!/^[A-Z0-9]{4,12}$/.test(sala)) { U.toast(T('Digite o código da sala (letras e números).', 'Type the room code (letters and numbers).'), { tipo: 'erro' }); return; }
        if (chave) { ctx.abrirSala({ papel: 'host', sala, chave, retomar: true, fonteId: fonte.id, fonte: fonte.id ? fonte : null, modo: c.modo, preset: p, audio: c.audio, apps: c.appsCaptura, iniciar: true }); return; }
        const off = A.evt.on('sala:aprovado', () => { off(); A.sala.compartilhar({ fonteId: fonte.id, fonte: fonte.id ? fonte : null, modo: c.modo, preset: p, audio: c.audio, apps: c.appsCaptura }).catch((e) => { if (e.name !== 'NotAllowedError') U.toast(e.message || String(e), { tipo: 'erro' }); }); });
        setTimeout(off, 5 * 60000);
        ctx.abrirSala({ papel: 'membro', sala });
        return;
      }
      const cods = nova ? A.sala.gerarCodigos() : { sala: c.sala, chave: c.chave };
      ctx.abrirSala({ papel: 'host', sala: cods.sala, chave: cods.chave, retomar: !nova, fonteId: fonte.id, fonte: fonte.id ? fonte : null, modo: c.modo, preset: p, audio: c.audio, apps: c.appsCaptura, iniciar: true });
    } });
    el.append(cab(T('Transmitir', 'Share'), T('Compartilhe jogo, vídeo, Netflix ou qualquer coisa', 'Share a game, a video, Netflix or anything')),
      U.mosaico([secao(null, modoSel, descModo),
      secao(T('O que mostrar', 'What to show'), h('div', { class: 'linha' }, h('div', { class: 'cresce' }, nomeFonte), U.btn(T('Escolher tela ou janela', 'Choose screen or window'), { tipo: 'sec', peq: true, onclick: escolherFonte })),
        h('div', { class: 'peq suave', estilo: { 'margin-top': '6px' } }, T('Dica: escolher só uma janela deixa você usar o resto do computador sem aparecer na transmissão, e só o som dela é enviado.', 'Tip: sharing a single window lets you use the rest of your computer without it showing up, and only its sound is sent.')),
        opcao(T('Compartilhar o som', 'Share sound'), audio)),
      secao(T('Qualidade', 'Quality'), qualidade, gpuInfo,
        h('div', { class: 'linha', estilo: { 'margin-top': '8px' } }, U.btn(T('Verificar a placa', 'Check the GPU'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: (e) => verificarPlaca(e.currentTarget) }))),
      A.kms && window.aero && window.aero.kms && /Linux|Windows/i.test(navigator.userAgent) ? secao(null, A.kms.painel()) : null, // (0.7.4) Linux e (0.7.8) Windows: captura direta da placa
      secao(null, h('details', { class: 'mais', open: innerWidth >= 1500 ? '' : undefined }, h('summary', {}, T('Avançado', 'Advanced')), h('div', { class: 'col', estilo: { gap: '12px', 'margin-top': '10px' } }, A.mixer.avancadoHost(), apps.el))),
      secao(T('Sala', 'Room'), modoSala)], { min: 640 }), h('div', { class: 'linha', estilo: { 'justify-content': 'center', 'margin-top': '14px' } }, iniciar));
    return { limpar: () => offs.forEach((f) => f()) };
  };

  // ---------- CONFIGURAÇÕES ----------
  ABAS.config = (el, ctx, sub) => {
    const offs = [];
    el.classList.add('cfg-raiz'); // (0.8.7) o CSS das integrações não alcança nada aqui dentro (integracoes.js), só o lugar das opções delas
    const igCaixa = h('div', { class: 'col ig-cfg', estilo: { gap: '14px' } });
    // (0.7.6) o que pergunta ao app do PC (diagnóstico da placa, Discord, VA-API, driver) espera a aba terminar de abrir: antes tudo isso
    // saía junto com a montagem (vários programas rodando ao mesmo tempo no PC) e a aba abria com um tranco
    const depois = (f) => { const t = setTimeout(f, 450); offs.push(() => clearTimeout(t)); };
    const eu = API.eu;

    // (0.5.9-3) foto, nome e # ficam no editor do perfil (perfil.js), junto com banner, música e Discord

    // --- controles: tela própria (testar, remapear, calibrar) ---
    const abrirControles = () => U.ir('controles', { voltar: () => U.ir('home', { ...A.homeDados, aba: 'config' }) });

    // --- ouvir os sons: o mesmo botão vira "Parar" enquanto toca (antes só dava para esperar todos terminarem) ---
    const LISTA_SONS = ['abrir', 'compartilhar', 'online', 'chat-recebido', 'chat-envio', 'mic-on', 'mic-off', 'sucesso', 'parar', 'fechar'];
    let timersSons = [], tocandoSons = false;
    const sonsEstado = h('span', { class: 'peq suave', role: 'status', 'aria-live': 'polite' });
    const btnSons = U.btn(T('Ouvir os sons', 'Play sounds'), { icone: 'volume', tipo: 'sec', peq: true, mudo: true, onclick: () => (tocandoSons ? pararSons() : ouvirSons()) });
    const pintarSons = () => { btnSons.replaceChildren(A.icone(tocandoSons ? 'parar' : 'volume', 20), h('span', {}, tocandoSons ? T('Parar de ouvir', 'Stop playing') : T('Ouvir os sons', 'Play sounds'))); btnSons.setAttribute('aria-label', tocandoSons ? T('Parar de ouvir os sons', 'Stop playing sounds') : T('Ouvir os sons', 'Play sounds')); btnSons.classList.toggle('ativo', tocandoSons); };
    function pararSons(silencioso) {
      timersSons.forEach(clearTimeout); timersSons = [];
      if (tocandoSons) { tocandoSons = false; A.som.silenciar(); pintarSons(); if (!silencioso) sonsEstado.textContent = ''; }
    }
    function ouvirSons() {
      pararSons(true); tocandoSons = true; pintarSons();
      LISTA_SONS.forEach((n, i) => timersSons.push(setTimeout(() => { A.som.tocar(n); sonsEstado.textContent = `${i + 1}/${LISTA_SONS.length}`; }, i * 650)));
      timersSons.push(setTimeout(() => { tocandoSons = false; timersSons = []; pintarSons(); sonsEstado.textContent = ''; }, LISTA_SONS.length * 650 + 400));
    }
    offs.push(() => pararSons(true));

    // --- placa de vídeo (PC) ---
    const gpuBox = h('div', { class: 'peq suave selecionavel' });
    // Linux: as combinações que o app testou para a placa codificar (e qual está em uso)
    const perfisTxt = h('div', { class: 'peq suave selecionavel', estilo: { 'white-space': 'pre-line', 'margin-top': '6px' } });
    const pintarPerfis = async () => {
      if (!window.aero || !window.aero.gpu || !window.aero.gpu.perfil) return;
      let p = null; try { p = await window.aero.gpu.perfil(); } catch (e) { return; }
      const nome = (id) => ((p.perfis || []).find((x) => x.id === id) || {}).nome || id;
      const sd = p.sonda;
      perfisTxt.textContent = T('Em uso: ', 'In use: ') + nome(p.perfil || 'padrao') + '\n' + (!sd ? T('As combinações ainda não foram testadas (o teste roda sozinho uns segundos depois de abrir).', 'Combinations not tested yet (the test runs by itself a few seconds after opening).')
        : sd.resultados.map((r) => (r.placa ? '✓ ' : '✗ ') + nome(r.id) + (r.impl ? ' — ' + r.impl : r.motivo ? ' — ' + r.motivo : '')).join('\n'));
    };
    const perfisBloco = h('div', { hidden: true, estilo: { 'margin-top': '8px' } }, perfisTxt, h('div', { class: 'linha', estilo: { 'margin-top': '8px' } }, U.btn(T('Testar todas as combinações de novo', 'Test all combinations again'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: async () => { perfisTxt.textContent = T('Testando... (cada combinação abre uma cópia escondida do app por alguns segundos)', 'Testing... (each combination opens a hidden copy of the app for a few seconds)'); try { await window.aero.gpu.sondar({ todos: true }); } catch (e) { /* ok */ } pintarPerfis(); } })));
    depois(() => A.infoPC().then((i) => { if (i.so === 'Linux' && window.aero && window.aero.gpu && window.aero.gpu.perfil) { perfisBloco.hidden = false; pintarPerfis(); } }));
    offs.push(A.evt.on('placa:sonda', pintarPerfis));
    // Windows/macOS: qual placa, qual driver, qual codificador e o botão de verificar (antes só o Linux tinha alguma coisa aqui)
    const winTxt = h('div', { class: 'peq selecionavel', estilo: { 'white-space': 'pre-line' } });
    const FAB = { 0x10de: ['NVIDIA', 'NVENC'], 0x1002: ['AMD', 'AMF'], 0x1022: ['AMD', 'AMF'], 0x8086: ['Intel', 'Quick Sync'] };
    const pintarWin = async () => {
      let d = null; try { d = await window.aero.diagnostico(); } catch (e) { /* ok */ }
      const devs = (d && Array.isArray(d.gpu) ? d.gpu : []), at = devs.find((x) => x.active) || devs[0];
      const f = at && FAB[at.vendorId], r = A.gpu.resultado;
      winTxt.textContent = (at ? T('Placa: ', 'GPU: ') + (f ? f[0] : '0x' + (at.vendorId || 0).toString(16)) + (at.driverVersion ? T(' · driver ', ' · driver ') + at.driverVersion : '') + '\n' : '')
        + (!r ? T('Ainda não verificada.', 'Not checked yet.') : r.hw ? T('Codificação pela placa: SIM', 'GPU encoding: YES') + (f ? ' (' + f[1] + T(', pelo Media Foundation do Windows)', ', via Windows Media Foundation)') : '') + T(' — H.264, resolução nativa no FPS escolhido.', ' — H.264, native resolution at the chosen FPS.')
          : T('Codificação pela placa: NÃO (o processador codifica, em resolução menor). Atualize o driver da placa', 'GPU encoding: NO (the CPU encodes, at a lower resolution). Update your GPU driver') + (f ? ' (' + f[0] + ')' : '') + T(' e verifique de novo.', ' and check again.'));
    };
    // (0.7.8) o driver dos controles dos amigos, sem precisar esperar o aviso
    const vigemLinha = h('div', { class: 'linha', hidden: true, estilo: { 'margin-top': '8px', 'flex-wrap': 'wrap' } }, h('span', { class: 'peq cresce' }, T('Controles dos amigos: falta o driver ViGEmBus.', 'Friends\' gamepads: the ViGEmBus driver is missing.')),
      U.btn(T('Instalar o driver', 'Install the driver'), { icone: 'controle', tipo: 'sec', peq: true, onclick: async () => { const r = await A.entrada.instalarVigem(); if (r && r.ok) vigemLinha.hidden = true; } }));
    const winBloco = h('div', { hidden: true, estilo: { 'margin-top': '8px' } }, winTxt, vigemLinha, h('div', { class: 'linha', estilo: { 'margin-top': '8px' } }, U.btn(T('Verificar a placa', 'Check the GPU'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: async (e) => { const b = e.currentTarget; b.disabled = true; winTxt.textContent = T('Verificando...', 'Checking...'); try { await A.gpu.testar({ forcar: true }); } catch (x) { /* ok */ } b.disabled = false; pintarWin(); } })));
    depois(() => A.infoPC().then((i) => { if (i.so && i.so !== 'Linux') { winBloco.hidden = false; pintarWin(); A.entrada.capacidades().then((c) => { vigemLinha.hidden = !(c && c.motivo === 'gamepad-precisa-vigem'); }); } }));
    offs.push(A.evt.on('gpu', () => { if (!winBloco.hidden) pintarWin(); }));
    const mostrarGpu = () => { const r = A.gpu.resultado; if (r && !r.linux && !winBloco.hidden) { gpuBox.textContent = ''; return; } gpuBox.textContent = r && r.semTeste && r.linux ? (r.hw || (r.verificado && A.cfg.v.gpuModo !== 'software' && A.cfg.v.gpuModo !== 'semgpu') ? T('Linux: a placa codifica pelo VA-API (só codificação; a decodificação por hardware fica desligada, que é a parte que travava o driver). Nada é codificado ao abrir o app.', 'Linux: the GPU encodes via VA-API (encode only; hardware decoding stays off, which is what crashed the driver). Nothing is encoded when the app opens.') : T('Modo de compatibilidade: o processador codifica.', 'Compatibility mode: the CPU encodes.')) + (r.verificado ? ' ' + T('Verificado: ', 'Checked: ') + (r.hw ? 'GPU' : 'CPU') + (r.impl ? ' (' + r.impl + ')' : '') : '') : r ? r.testes.map((x) => `${x.id}: ${x.ok ? (x.hw ? 'GPU' : 'CPU') : '--'}${x.fps ? ' ' + x.fps.toFixed(0) + 'fps' : ''}`).join('  |  ') + `  (${r.codec || '?'})` : T('Ainda não testada.', 'Not tested yet.'); };
    mostrarGpu(); ouvir(offs, 'gpu', mostrarGpu);
    const compat = h('select', { class: 'campo', 'aria-label': T('Modo de compatibilidade', 'Compatibility mode') }, [['auto', T('Automático: a placa codifica (recomendado)', 'Automatic: the GPU encodes (recommended)')], ['forcar', T('Forçar a placa (ignora a lista de bloqueio do Chromium)', 'Force the GPU (ignore the Chromium blocklist)')], ['software', T('Sem aceleração de vídeo (compatibilidade)', 'No video acceleration (compatibility)')], ['semgpu', T('Sem GPU nenhuma (último recurso)', 'No GPU at all (last resort)')]].map(([v, r]) => h('option', { value: v }, r)));
    compat.value = A.cfg.v.gpuModo === 'vaapi' ? 'auto' : A.cfg.v.gpuModo;
    // Linux: explica POR QUE a placa não está codificando (o Chromium só usa o codificador se o driver VA-API oferecer H.264)
    const vaTexto = h('div', { class: 'peq suave selecionavel', estilo: { 'margin-top': '8px' } });
    const vaBloco = h('div', { hidden: true },
      U.btn(T('Verificar a codificação por hardware', 'Check hardware encoding'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: async () => {
        vaTexto.textContent = T('Verificando...', 'Checking...');
        let v = null; try { v = await window.aero.gpu.vaapi(); } catch (e) { v = { codigo: 'erro' }; }
        const sim = (x) => (x ? '✓' : '✗'), nome = v.driver ? ' (' + v.driver + ')' : '';
        const cap = v.h264 ? T(' Codifica: H.264 ', ' Encodes: H.264 ') + sim(v.h264.codifica) + ' · HEVC ' + sim(v.hevc.codifica) + ' · AV1 ' + sim(v.av1.codifica) : '';
        vaTexto.textContent = ({
          ok: T('O seu Linux oferece H.264 por hardware' + nome + '. O app já usa o codificador da placa no modo Automático; use "Verificar a placa" na aba Transmitir para confirmar.', 'Your Linux offers hardware H.264' + nome + '. The app already uses the GPU encoder in Automatic mode; use "Check the GPU" in the Share tab to confirm.'),
          'sem-vainfo': T('Não achei o programa "vainfo", então não consigo ver o que a placa oferece. Instale o pacote libva-utils (CachyOS/Arch: sudo pacman -S libva-utils) e verifique de novo.', 'I could not find the "vainfo" program, so I cannot see what the GPU offers. Install the libva-utils package (CachyOS/Arch: sudo pacman -S libva-utils) and check again.'),
          'sem-h264-encode': T('O driver de vídeo' + nome + ' não oferece codificação H.264 por hardware. No CachyOS/Arch confirme que os pacotes mesa (AMD) ou intel-media-driver (Intel) estão instalados e atualizados. Placa NVIDIA no Linux: o driver dela só decodifica pelo VA-API, então a codificação fica no processador (ou na parte integrada Intel/AMD, se houver).', 'The video driver' + nome + ' does not offer hardware H.264 encoding. On CachyOS/Arch make sure mesa (AMD) or intel-media-driver (Intel) are installed and up to date. NVIDIA card on Linux: its driver only decodes through VA-API, so encoding stays on the CPU (or on the Intel/AMD integrated graphics, if you have them).'),
        }[v.codigo] || T('Não consegui ler o VA-API (o vainfo falhou). Rode "vainfo" no terminal e me mande o resultado junto com o relatório de diagnóstico.', 'I could not read VA-API (vainfo failed). Run "vainfo" in a terminal and send me the result with the diagnostics report.')) + cap;
      } }), vaTexto);
    A.infoPC().then((i) => { if (i.so === 'Linux' && window.aero.gpu) vaBloco.hidden = false; });
    // Linux + AMD Polaris: o bug do kernel que trava a placa ao codificar (sistema.js / desktop/vce3.js)
    const drvTexto = h('div', { class: 'peq selecionavel' }), drvBotoes = h('div', { class: 'linha', estilo: { 'margin-top': '8px', 'flex-wrap': 'wrap' } });
    const drvBloco = h('div', { hidden: true, estilo: { 'margin-top': '12px' } }, h('div', { class: 'rot' }, T('Driver da placa (bug do kernel que trava a placa)', 'Graphics driver (kernel bug that freezes the card)')), drvTexto, drvBotoes);
    const pintarDrv = () => {
      const D = A.driver, d = D && D.estado; if (!d || !d.aplicavel) { drvBloco.hidden = true; return; }
      drvBloco.hidden = false; drvBotoes.textContent = '';
      const b = (t, f, tipo = 'sec') => drvBotoes.append(U.btn(t, { tipo, peq: true, onclick: f }));
      if (D.preparando) drvTexto.textContent = T('Preparando a correção: ', 'Preparing the fix: ') + ((D.progresso && D.progresso.etapa) || '...') + T(' (alguns minutos, em segundo plano)', ' (a few minutes, in the background)');
      else if (!d.temBug) drvTexto.textContent = '✓ ' + T('O kernel ' + d.kver + ' não tem o bug.', 'Kernel ' + d.kver + ' does not have the bug.');
      else if (d.corrigido) { drvTexto.textContent = '✓ ' + T('Corrigido: o driver em uso tem a correção da AMD (kernel ' + d.kver + ').', 'Fixed: the driver in use has AMD\'s fix (kernel ' + d.kver + ').'); b(T('Desfazer a correção', 'Undo the fix'), () => D.desfazer()); }
      else if (d.reiniciarPendente) { drvTexto.textContent = T('A correção está instalada; falta reiniciar o computador.', 'The fix is installed; the computer still needs a restart.'); b(T('Reiniciar computador', 'Restart computer'), () => D.reiniciarPC(), 'ok'); }
      else if (d.pronto) { drvTexto.textContent = T('⚠ O kernel tem o bug. A correção está pronta para instalar.', '⚠ The kernel has the bug. The fix is ready to install.'); b(T('Instalar correção', 'Install fix'), () => D.instalar(), 'ok'); }
      else if (d.podeCorrigir) { drvTexto.textContent = T('⚠ O kernel ' + d.kver + ' tem o bug que trava a placa ao transmitir.', '⚠ Kernel ' + d.kver + ' has the bug that freezes the card while streaming.') + (D.ultimoErro ? ' ' + D.ultimoErro : ''); b(T('Corrigir driver', 'Fix driver'), () => D.preparar(), 'ok'); }
      else drvTexto.textContent = T('⚠ O kernel tem o bug, mas não dá para corrigir aqui: ', '⚠ The kernel has the bug, but it cannot be fixed here: ') + (d.erroFonte || T('faltam ', 'missing ') + (d.faltando || []).join(', '));
    };
    ouvir(offs, 'driver', pintarDrv);
    if (A.driver && window.aero && window.aero.vce3) { if (A.driver.estado) pintarDrv(); else depois(() => A.driver.verificar({ silencioso: true })); }
    if (window.aero && window.aero.diagnostico) depois(() => window.aero.diagnostico().then((d) => { if (d.gpuModo) compat.value = d.gpuModo; }).catch(() => {}));
    compat.addEventListener('change', async () => {
      A.cfg.v.gpuModo = compat.value; A.cfg.salvar(); if (window.aero && window.aero.definirGpuModo) { await window.aero.definirGpuModo(compat.value); if (await U.confirmar(T('Reiniciar o app agora para aplicar?', 'Restart the app now to apply?'))) window.aero.reiniciar(); } });

    // --- Discord (app do PC) ---
    const dc = A.cfg.v.discord;
    const dcEstado = h('div', { class: 'peq suave' });
    const mostrarDc = async () => {
      if (!window.aero || !window.aero.discord) return;
      try { const e = await window.aero.discord.estado(); dcEstado.textContent = !dc.ativo ? T('Desligado.', 'Off.') : e.conectado ? T('Conectado ao Discord. Não aparece no perfil? No Discord: Configurações > Privacidade de atividade > ligue "Compartilhar sua atividade".', 'Connected to Discord. Not showing on your profile? In Discord: Settings > Activity Privacy > turn on "Share your activity".') : e.semId ? T('Falta o ID do aplicativo (veja o LEIA-ME).', 'Application ID missing (see the README).') : e.erro === 'sem-resposta' ? T('O Discord foi achado mas não respondeu. Feche o Discord pela bandeja (Sair do Discord) e abra de novo; se o Discord estiver aberto como administrador, abra o Aero do mesmo jeito.', 'Discord was found but did not answer. Quit Discord from the tray and open it again; if Discord runs as administrator, run Aero the same way.') : e.erro && e.erro !== 'discord-fechado' ? T('O Discord recusou: ', 'Discord refused: ') + e.erro : T('Procurando o Discord aberto neste computador (o app do Discord, não o site)...', 'Looking for Discord running on this computer (the Discord app, not the website)...'); } catch (e) { dcEstado.textContent = ''; }
    };
    const dcTimer = setInterval(mostrarDc, 4000); offs.push(() => clearInterval(dcTimer)); depois(mostrarDc);
    // (1.0.0) "Ouvindo agora" pelo navegador: a extensão pede o código de pareamento deste PC (sem ele o app não aceita nada)
    const ouvExtensao = () => { // (1.0.0) um botão: abre a página de instalar no navegador padrão; a extensão se conecta sozinha
      const estado = h('div', { class: 'peq', estilo: { 'margin-top': '6px' } });
      const ver = async () => { let e = null; try { e = await window.aero.ouvindo.extensao(); } catch (_) { /* ok */ } estado.textContent = e && e.visto ? T('✓ Extensão conectada neste computador.', '✓ Extension connected on this computer.') : ''; estado.style.color = 'var(--ok, #1f9d55)'; };
      const caixa = h('div', { class: 'opcao com-cena' }, cenaPriv('navegador', true), h('div', { class: 'cresce' },
        h('div', { estilo: { 'font-weight': '600' } }, T('Navegador (YouTube Music e Deezer)', 'Browser (YouTube Music and Deezer)')),
        h('div', { class: 'peq suave' }, T('Clique no botão: o seu navegador abre e mostra como instalar a extensão do Aero. Ela se conecta sozinha. No Linux, o Firefox e o Zen já funcionam sem a extensão.', 'Click the button: your browser opens and shows how to install the Aero extension. It connects by itself. On Linux, Firefox and Zen already work without the extension.')),
        estado),
        U.btn(T('Instalar no navegador', 'Install in the browser'), { tipo: 'sec', peq: true, onclick: async () => { try { await window.aero.ouvindo.instalarExtensao(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }));
      ver(); const t = setInterval(() => { if (!caixa.isConnected) return clearInterval(t); ver(); }, 3000);
      return caixa;
    };

    const idSecreto = h('b', { class: 'selecionavel' }, '••••-••••-••••'); let ver = false;
    const meuCodigo = () => API.codigoAcesso() || T('(não guardado neste aparelho)', '(not stored on this device)');
    // trocar o código (gera um novo; os outros aparelhos precisam entrar de novo) e a senha de recuperação das conversas
    // (0.7.8) o e-mail fica escondido como o código de acesso (a tela de configurações pode aparecer numa transmissão)
    const escondeEmail = (e) => e ? e.replace(/^(.).*(@.*)$/, '$1•••$2') : T('sem e-mail', 'no e-mail');
    let verEmail = false; const emailTxt = h('span', { class: 'selecionavel', dados: { email: '1' } }, escondeEmail(API.eu && API.eu.email));
    const pintarEmail = () => { const e = API.eu && API.eu.email; emailTxt.textContent = verEmail && e ? e : escondeEmail(e); };
    const campoLimpo = (el) => { el.addEventListener('keydown', (e) => e.stopPropagation()); return el; };
    const confirmarEmail = (email) => {
      const cod = campoLimpo(h('input', { class: 'campo', inputmode: 'numeric', maxlength: 6, placeholder: '000000', autocomplete: 'one-time-code', estilo: { 'font-size': '22px', 'letter-spacing': '6px', 'text-align': 'center' } }));
      U.modal(T('Confirme o novo e-mail', 'Confirm the new e-mail'), [h('p', {}, T('Mandamos um código de 6 números para ', 'We sent a 6-digit code to '), h('b', {}, email), '.'), cod], { largura: 420, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Confirmar', 'Confirm'), onclick: async (fechar) => { try { await API.confirmarTrocaEmail(cod.value); pintarEmail(); A.som.tocar('sucesso'); U.toast(T('E-mail trocado. Avisamos o endereço antigo.', 'E-mail changed. We notified the old address.'), { tipo: 'ok' }); fechar(true); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }] });
      setTimeout(() => cod.focus(), 120);
    };
    const trocarEmail = () => {
      const novo = campoLimpo(h('input', { class: 'campo', type: 'email', maxlength: 80, autocomplete: 'email', placeholder: T('Novo e-mail', 'New e-mail') }));
      const cod = campoLimpo(h('input', { class: 'campo', type: 'password', autocomplete: 'off', placeholder: T('Seu código de acesso', 'Your access code') }));
      U.modal(T('Trocar e-mail', 'Change e-mail'), h('div', { class: 'col', estilo: { gap: '10px' } }, h('p', { estilo: { margin: 0 } }, T('Depois de confirmar, o e-mail antigo recebe um aviso da troca.', 'After you confirm, the old e-mail gets a notice about the change.')), novo, cod), { largura: 420, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Continuar', 'Continue'), onclick: async (fechar) => { const email = novo.value.trim(); try { await API.pedirTrocaEmail(cod.value, email); fechar(true); confirmarEmail(email); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }] });
      setTimeout(() => novo.focus(), 120);
    };
    // (0.9.6) senha opcional (o código de acesso continua o padrão)
    const senhaBtns = h('div', { class: 'linha' });
    const pintarSenha = () => {
      const tem = !!(API.eu && API.eu.senha);
      senhaBtns.replaceChildren(U.btn(tem ? T('Trocar senha', 'Change password') : T('Criar senha', 'Create password'), { tipo: 'sec', peq: true, onclick: pedirSenha }),
        tem ? U.btn(T('Tirar', 'Remove'), { tipo: 'sec', peq: true, onclick: async () => { try { await API.removerSenha(); API.eu.senha = false; pintarSenha(); U.toast(T('Senha removida: só o código de acesso entra agora.', 'Password removed: only the access code signs in now.'), { tipo: 'ok' }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }) : null);
    };
    const pedirSenha = () => {
      const s1 = campoLimpo(h('input', { class: 'campo', type: 'password', autocomplete: 'new-password', maxlength: 128, placeholder: T('Senha nova (8 ou mais caracteres)', 'New password (8 or more characters)') }));
      const s2 = campoLimpo(h('input', { class: 'campo', type: 'password', autocomplete: 'new-password', maxlength: 128, placeholder: T('Repita a senha', 'Repeat the password') }));
      U.modal(T('Senha para entrar', 'Sign-in password'), h('div', { class: 'col', estilo: { gap: '10px' } }, h('p', { estilo: { margin: 0 } }, T('Você vai poder entrar com a sua # (', 'You will be able to sign in with your # (') + '#' + ((API.eu && API.eu.tag) || '') + T(') e esta senha. Ela nunca sai deste aparelho: o servidor só recebe uma versão embaralhada.', ') and this password. It never leaves this device: the server only gets a scrambled version.')), s1, s2), { largura: 420, acoes: [
        { texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false },
        { texto: T('Salvar', 'Save'), onclick: async (fechar) => {
          if (s1.value.length < 8) return U.toast(T('A senha precisa de 8 ou mais caracteres.', 'The password needs 8 or more characters.'), { tipo: 'erro' });
          if (s1.value !== s2.value) return U.toast(T('As duas senhas não são iguais.', 'The two passwords do not match.'), { tipo: 'erro' });
          try { await API.definirSenha(s1.value); API.eu.senha = true; pintarSenha(); U.toast(T('Senha salva!', 'Password saved!'), { tipo: 'ok' }); fechar(true); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
        } }] });
      setTimeout(() => s1.focus(), 120);
    };
    pintarSenha();
    // (1.0.0) entrar em outro aparelho: este mostra o QR e o código que muda; o outro lê (ou digita) e este confirma
    const entrarOutro = () => A.ui.mostrarQrEntrada ? A.ui.mostrarQrEntrada() : null;
    const trocarCodigo = async () => {
      if (!(await U.confirmar(T('Gerar um código de acesso novo? O antigo para de funcionar e os seus outros aparelhos vão pedir o código novo.', 'Generate a new access code? The old one stops working and your other devices will ask for the new code.'), { sim: T('Gerar código novo', 'Generate new code') }))) return;
      try { const c = await A.cripto.trocarCodigo(); ver = true; idSecreto.textContent = c; U.modal(T('Seu código novo', 'Your new code'), h('div', { class: 'col', estilo: { gap: '10px' } }, h('p', {}, T('Guarde bem: ninguém (nem o servidor) consegue ver ou recuperar este código.', 'Keep it safe: nobody (not even the server) can see or recover this code.')), h('div', { class: 'selecionavel cripto-codigo' }, c), U.btn(T('Copiar', 'Copy'), { icone: 'copiar', tipo: 'sec', onclick: (e) => U.copiar(c, e.currentTarget) })), { largura: 460 }); A.som.tocar('sucesso'); }
      catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    };


    // --- privacidade (0.6.0): Discord, confirmação de leitura, quem pode mandar mensagem, aparelho escondido, bloqueados e 2FA ---
    function secaoPrivacidade() {
      const corpo = h('div', { class: 'col', estilo: { gap: '4px' } }, h('p', { class: 'peq suave' }, T('Carregando...', 'Loading...')));
      const pintar = async () => {
        let d; try { d = await API.req('privacidade'); } catch (e) { corpo.replaceChildren(h('p', { class: 'msg erro' }, e.status === 404 ? T('O servidor ainda está atualizando. Tente de novo em alguns minutos.', 'The server is still updating. Try again in a few minutes.') : e.message), U.btn(T('Tentar de novo', 'Try again'), { tipo: 'sec', peq: true, onclick: pintar })); return; }
        const p = d.priv, salvar = async (x) => { try { const r = await API.req('privacidade', x); Object.assign(p, r.priv); if (API.eu) API.eu.priv = r.priv; A.som.tocar('click'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
        const bloq = h('div', { class: 'col', estilo: { gap: '6px' } });
        const pintarBloq = (lista) => {
          bloq.textContent = '';
          if (!lista.length) { bloq.append(h('div', { class: 'peq suave' }, T('Ninguém bloqueado.', 'Nobody blocked.'))); return; }
          for (const b of lista) bloq.append(h('div', { class: 'linha' }, U.avatar(b, 30), h('div', { class: 'cresce' }, h('b', {}, b.nome), h('div', { class: 'peq suave' }, '#' + (b.tag || ''))), U.btn(T('Desbloquear', 'Unblock'), { tipo: 'sec', peq: true, onclick: async () => { try { await API.req('bloquear', { codigo: b.codigo, sim: false }); A.som.tocar('bolha'); pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } })));
        };
        pintarBloq(d.bloqueados || []);
        const doisFa = h('div', { class: 'col', estilo: { gap: '8px' } });
        const pintar2fa = () => {
          doisFa.textContent = '';
          const ativo = !!(API.eu && API.eu.totp);
          doisFa.append(h('div', { class: 'peq suave' }, ativo ? T('Ligada: o login pede o código do aplicativo autenticador.', 'On: login asks for the authenticator app code.') : T('Desligada. Com ela, entrar na conta pede também o código de 6 números do Google Authenticator (ou outro autenticador).', 'Off. With it, signing in also asks for the 6-digit code from Google Authenticator (or another authenticator).')),
            U.btn(ativo ? T('Desligar a verificação em duas etapas', 'Turn off two-step verification') : T('Ligar a verificação em duas etapas', 'Turn on two-step verification'), { tipo: ativo ? 'perigo' : '', peq: true, icone: 'escudo', onclick: () => (ativo ? desligar2fa() : ligar2fa()) }));
        };
        const ligar2fa = async () => {
          let r; try { r = await API.req('2fa/iniciar', {}); } catch (e) { U.toast(e.message, { tipo: 'erro' }); return; }
          const cod = h('input', { class: 'campo', inputmode: 'numeric', maxlength: 6, placeholder: '000000', autocomplete: 'one-time-code', estilo: { 'font-size': '22px', 'letter-spacing': '6px', 'text-align': 'center' } });
          const qr = A.qr ? A.qr(r.uri, 220) : null;
          const m = U.modal(T('Verificação em duas etapas', 'Two-step verification'), h('div', { class: 'col', estilo: { gap: '10px', 'align-items': 'center', 'text-align': 'center' } },
            h('p', { estilo: { margin: 0 } }, T('1. No celular, abra o Google Authenticator (ou outro autenticador) e leia este QR code:', '1. On your phone, open Google Authenticator (or another authenticator) and scan this QR code:')), qr,
            h('div', { class: 'peq suave' }, T('Não consegue ler? Digite esta chave: ', 'Cannot scan? Type this key: '), h('code', { class: 'selecionavel' }, r.segredo.replace(/(.{4})/g, '$1 ').trim())),
            h('p', { estilo: { margin: 0 } }, T('2. Digite o código de 6 números que aparece no aplicativo:', '2. Type the 6-digit code shown in the app:')), cod),
            { largura: 460, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Ligar', 'Turn on'), onclick: async (fechar) => { try { await API.req('2fa/ativar', { codigo: cod.value }); if (API.eu) API.eu.totp = true; A.som.tocar('sucesso'); U.toast(T('Verificação em duas etapas ligada.', 'Two-step verification is on.'), { tipo: 'ok' }); fechar(true); pintar2fa(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }] });
          cod.addEventListener('keydown', (e) => e.stopPropagation()); setTimeout(() => cod.focus(), 120); void m;
        };
        const desligar2fa = async () => {
          const cod = h('input', { class: 'campo', inputmode: 'numeric', maxlength: 6, placeholder: '000000', estilo: { 'font-size': '22px', 'letter-spacing': '6px', 'text-align': 'center' } });
          U.modal(T('Desligar a verificação em duas etapas', 'Turn off two-step verification'), [h('p', {}, T('Digite o código atual do aplicativo autenticador:', 'Type the current code from your authenticator app:')), cod], { largura: 420, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Desligar', 'Turn off'), tipo: 'perigo', onclick: async (fechar) => { try { await API.req('2fa/desativar', { codigo: cod.value }); if (API.eu) API.eu.totp = false; fechar(true); pintar2fa(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }] });
          cod.addEventListener('keydown', (e) => e.stopPropagation()); setTimeout(() => cod.focus(), 120);
        };
        pintar2fa();
        // (0.8.6) o que conta para o "visto por último": só a hora em que você sai, ou também a última vez que mexeu no app
        const cDc = cenaPriv('discord', dc.ativo !== false), cOuv = cenaPriv('musica', (A.cfg.v.ouvir || {}).ativo !== false), cLidos = cenaPriv('lidos', !!p.lidos), cVisto = cenaPriv('visto', p.visto !== false), cMsg = cenaPriv('msg', p.mensagens || 'amigos'), pintarMsg = (k, v) => { const d = cMsg.dataset; d.k = k; if (k === 'msg') { d.a = 'passa'; d.b = { amigos: 'barra', pedidos: 'espera' }[v] || 'passa'; } else { d.a = v === 'ninguem' ? 'barra' : 'passa'; d.b = v === 'todos' || !v ? 'passa' : 'barra'; } }, cAp = cenaPriv('aparelho', !!p.esconderAparelho);
        const modoVisto = h('div', { class: 'opcao sub-opcao', hidden: p.visto === false }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, T('O que conta', 'What counts')), h('div', { class: 'peq suave' }, T('"Quando eu saio": a hora em que você fechou o app ou ficou off-line. "Quando eu mexo no app": também a última vez que você usou o app, mesmo com ele aberto.', '"When I leave": the time you closed the app or went offline. "When I use the app": also the last time you used it, even with it open.'))),
          U.seg([['saida', T('Quando eu saio', 'When I leave')], ['atividade', T('Quando eu mexo no app', 'When I use the app')]], p.vistoModo || 'saida', (v) => { salvar({ vistoModo: v }); }));
        corpo.replaceChildren(
          A.plat.desktop ? comCena(cDc, opcao(T('Mostrar no Discord o que estou fazendo', 'Show what I am doing on Discord'), U.chave(dc.ativo !== false, (v) => { cDc.dataset.e = v; dc.ativo = v; A.cfg.salvar(); A.evt.emit('discord:config'); setTimeout(mostrarDc, 800); }), T('Rich Presence: no menu ou em uma sala (com quantas pessoas), com a sua foto.', 'Rich Presence: in the menu or in a room (with how many people), with your photo.'))) : null,
          A.plat.desktop ? dcEstado : null,
          A.ouvindo && A.ouvindo.disponivel() ? comCena(cOuv, opcao(T('Mostrar a música que estou ouvindo', 'Show the music I am listening to'), U.chave((A.cfg.v.ouvir || {}).ativo !== false, (v) => { cOuv.dataset.e = v; A.cfg.v.ouvir = { ...(A.cfg.v.ouvir || {}), ativo: v }; A.cfg.salvar(); A.evt.emit('ouvir:config'); }), T('Como no Discord: os amigos veem nas listas e no seu perfil a música que toca no Spotify deste computador (e no YouTube Music e no Deezer do navegador), com a barra andando. No modo invisível ninguém vê.', 'Like Discord: friends see in their lists and on your profile the song playing on Spotify on this computer (and on YouTube Music and Deezer in the browser), with a moving progress bar. In invisible mode nobody sees it.'))) : null,
          A.ouvindo && A.ouvindo.disponivel() ? ouvExtensao() : null,
          A.jogando ? A.jogando.opcaoPrivacidade(opcao) : null, // (1.0.0) atividade de jogo (e o botão das atividades personalizadas)
          comCena(cLidos, opcao(T('Confirmação de leitura', 'Read receipts'), U.chave(p.lidos, (v) => { cLidos.dataset.e = v; salvar({ lidos: v }); }), T('Ligada: você vê quando leram as suas mensagens (e os outros veem quando você leu). Desligada: ninguém vê, nem você; só aparece "recebida". Precisa estar ligada para as duas pessoas.', 'On: you see when your messages were read (and others see when you read theirs). Off: nobody sees, not even you; only "delivered" shows. Must be on for both people.'))),
          comCena(cVisto, opcao(T('Visto por último', 'Last seen'), U.chave(p.visto !== false, (v) => { cVisto.dataset.e = v; salvar({ visto: v }); modoVisto.hidden = !v; }), T('Mostra há quanto tempo você esteve no Aero (no topo da conversa e no seu perfil). Para ver o de alguém, vocês dois precisam ter isto ligado: desligado, ninguém vê o seu e você também não vê o dos outros. No modo invisível nada conta.', 'Shows how long ago you were on Aero (at the top of the chat and on your profile). To see someone else\'s, both of you need this on: when it is off, nobody sees yours and you don\'t see theirs. Invisible mode never counts.'))),
          modoVisto,
          (() => { // (0.8.7) mensagens e pedidos de amizade na mesma cena: ela mostra a opção que você está mexendo
            pintarMsg('msg', p.mensagens || 'amigos');
            const oMsg = opcao(T('Quem pode me mandar mensagem', 'Who can message me'), U.seg([['amigos', T('Só amigos', 'Friends only')], ['pedidos', T('Pedidos de mensagem', 'Message requests')], ['todos', T('Todos', 'Everyone')]], p.mensagens, (v) => { p.mensagens = v; pintarMsg('msg', v); salvar({ mensagens: v }); }), T('Pedidos de mensagem: quem não é seu amigo manda UMA mensagem e espera você aceitar (como no Instagram).', 'Message requests: non-friends send ONE message and wait for you to accept (like Instagram).'));
            const oPed = opcao(T('Quem pode me mandar pedido de amizade', 'Who can send me friend requests'), U.seg([['todos', T('Todos', 'Everyone')], ['amigos2', T('Amigos de amigos', 'Friends of friends')], ['ninguem', T('Ninguém', 'Nobody')]], p.pedidosAmizade || 'todos', (v) => { p.pedidosAmizade = v; pintarMsg('amigo', v); salvar({ pedidosAmizade: v }); }), T('Amigos de amigos: só quem tem pelo menos um amigo em comum com você. Pedidos que você já recebeu continuam aí.', 'Friends of friends: only people with at least one friend in common with you. Requests you already got stay there.'));
            // passar o mouse mostra a opção de baixo ou a de cima, com uma pausa (passar por cima rapidinho não troca a cena)
            let tHover = 0; const mostrar = (k, v) => () => { clearTimeout(tHover); tHover = setTimeout(() => pintarMsg(k, v()), 180); };
            oMsg.addEventListener('pointerenter', mostrar('msg', () => p.mensagens || 'amigos'));
            oPed.addEventListener('pointerenter', mostrar('amigo', () => p.pedidosAmizade || 'todos'));
            return h('div', { class: 'opcao com-cena pc-dupla' }, cMsg, h('div', { class: 'pc-dupla-col' }, oMsg, oPed));
          })(),
          comCena(cAp, opcao(T('Esconder o nome do aparelho e o sistema', 'Hide device name and system'), U.chave(p.esconderAparelho, (v) => { cAp.dataset.e = v; salvar({ esconderAparelho: v }); }), T('Em Conexões, os amigos não veem o nome do seu computador/celular nem o sistema (Windows, Linux, Android).', 'In Connections, friends do not see your computer/phone name or system (Windows, Linux, Android).'))),
          API.eu && API.eu.donoPend ? (() => { // (0.9.7) só a conta do dono vê isto, e só enquanto não provou a chave exclusiva
            const campo = h('input', { type: 'password', class: 'campo', autocomplete: 'off', spellcheck: 'false', placeholder: T('Chave', 'Key') });
            const ir = async () => { const v = campo.value.trim(); if (!v) return; campo.value = ''; try { await API.req('dono', { chave: v }); U.toast(T('Pronto. Reabra o app.', 'Done. Reopen the app.'), { ms: 3000 }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
            campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
            return h('div', { class: 'linha', estilo: { gap: '8px', margin: '6px 0 12px' } }, campo, U.btn(T('Confirmar', 'Confirm'), { tipo: 'sec', peq: true, onclick: ir }));
          })() : null,
          h('div', { class: 'rot' }, T('Verificação em duas etapas (2FA)', 'Two-step verification (2FA)')), doisFa,
          h('div', { class: 'rot' }, T('Bloqueados', 'Blocked')), bloq);
      };
      pintar();
      const sec = secao(T('Privacidade', 'Privacy'), corpo); sec.dataset.protegido = '1'; return sec; // (0.8.7) integração nenhuma pode esconder esta parte (integracoes.js)
    }
    // --- aparelhos conectados (com IP e o botão de tirar) ---
    function secaoAparelhos() {
      const lista = h('div', { class: 'col', estilo: { gap: '8px' } });
      const pintar = async () => {
        let r; try { r = await API.req('sessoes'); } catch (e) { lista.textContent = ''; lista.append(h('p', { class: 'msg erro' }, e.message)); return; }
        lista.textContent = '';
        r.sessoes.forEach((s) => {
          const item = h('div', { class: 'linha aparelho-item', estilo: { gap: '10px' } },
            ((so) => h('span', { class: 'aparelho-ic so-' + so }, A.icone(so, 22)))(/android/i.test(s.so) ? 'android' : /ios|iphone|ipad|mac/i.test(s.so) ? 'apple' : /windows/i.test(s.so) ? 'windows' : /linux/i.test(s.so) ? 'linux' : 'tela'),
            h('div', { class: 'cresce' }, h('b', {}, s.maquina || T('Aparelho', 'Device')), s.atual ? h('span', { class: 'pilula online', estilo: { 'margin-left': '6px' } }, T('este', 'this one')) : s.online ? h('span', { class: 'pilula online', estilo: { 'margin-left': '6px' } }, 'online') : null,
              h('div', { class: 'peq suave selecionavel' }, (s.so || '?') + ' · IP ' + (s.ip || '—') + ' · ' + T('visto ', 'seen ') + new Date(s.visto).toLocaleString())),
            s.atual ? null : U.btn(T('Remover', 'Remove'), { tipo: 'perigo', peq: true, onclick: async () => { try { await API.req('sessoes/remover', { id: s.id }); A.som.tocar('estourar'); item.classList.add('estourando'); setTimeout(pintar, 420); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }));
          lista.append(item);
        });
      };
      pintar();
      const todos = U.btn(T('Desconectar todos os outros', 'Sign out all others'), { tipo: 'perigo', peq: true, icone: 'sair', onclick: async () => { if (!(await U.confirmar(T('Tirar a sua conta de TODOS os outros aparelhos? Só este continua conectado.', 'Sign your account out of ALL other devices? Only this one stays signed in.'), { sim: T('Desconectar todos', 'Sign out all'), perigo: true }))) return; try { await API.req('sessoes/remover-todas', {}); A.som.tocar('estourar'); pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } });
      return secao(T('Aparelhos conectados', 'Connected devices'), h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end', 'margin-bottom': '6px' } }, todos), h('p', { class: 'peq suave', estilo: { margin: '0 0 8px' } }, T('Onde a sua conta está aberta. Remover tira a conta daquele aparelho na hora.', 'Where your account is signed in. Removing signs that device out right away.')), lista);
    }
    // --- (0.7.1) iniciar com o sistema: seção própria com o botão de ligar/desligar (antes ficava escondida dentro de "Ao fechar a janela") ---
    function secaoInicio() {
      const estado = h('div', { class: 'peq suave', estilo: { 'margin-top': '6px' } });
      const linha = h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Iniciar junto com o sistema', 'Start with the system')), h('div', { class: 'peq suave' }, T('Quando o computador liga, o Aero abre sozinho na bandeja, pronto para chamadas e mensagens.', 'When the computer starts, Aero opens by itself in the tray, ready for calls and messages.'))));
      const pintar = (v) => { estado.textContent = v ? T('Ligado: o Aero abre quando você entrar no computador.', 'On: Aero opens when you sign in to the computer.') : T('Desligado: abra o Aero quando quiser.', 'Off: open Aero whenever you want.'); };
      const f = window.aero && window.aero.inicioSistema;
      if (!f) { estado.textContent = T('Feche o Aero pela bandeja (Sair) e abra de novo para terminar a atualização e liberar esta opção.', 'Quit Aero from the tray and open it again to finish the update and enable this option.'); return secao(T('Iniciar com o sistema', 'Start with the system'), linha, estado); }
      f().then((v) => {
        if (v === null) { estado.textContent = T('Este sistema não deixa o Aero abrir sozinho.', 'This system does not let Aero start by itself.'); return; }
        pintar(!!v);
        // (0.7.2) como abrir: só na bandeja ou com a janela em tela inteira
        const modo = window.aero.inicioModo ? h('select', { class: 'campo', 'aria-label': T('Como abrir', 'How to open'), estilo: { 'margin-top': '10px' } }, h('option', { value: 'bandeja' }, T('Abrir na bandeja (sem a janela na frente)', 'Open in the tray (no window)')), h('option', { value: 'janela' }, T('Abrir com a janela em tela inteira', 'Open with the window maximized'))) : null;
        if (modo) { modo.disabled = !v; window.aero.inicioModo().then((m) => { modo.value = m || 'bandeja'; }).catch(() => {}); modo.addEventListener('change', () => window.aero.inicioModo(modo.value).catch(() => {})); estado.after(modo); }
        linha.append(U.chave(!!v, async (on) => { try { const r = await f(on); pintar(!!r); if (modo) modo.disabled = !r; if (!!r !== on) U.toast(T('O sistema não aceitou a mudança.', 'The system did not accept the change.'), { tipo: 'erro' }); } catch (e) { U.toast(e.message || String(e), { tipo: 'erro' }); } }));
      }).catch(() => { estado.textContent = T('Feche o Aero pela bandeja (Sair) e abra de novo para liberar esta opção.', 'Quit Aero from the tray and open it again to enable this option.'); });
      return secao(T('Iniciar com o sistema', 'Start with the system'), linha, estado);
    }
    // --- ao fechar a janela: bandeja ou fechar de vez (app do PC) ---
    function secaoFechar() {
      const s = h('select', { class: 'campo', 'aria-label': T('Ao fechar a janela', 'When closing the window') }, [['perguntar', T('Perguntar toda vez', 'Ask every time')], ['bandeja', T('Fechar para a bandeja (continua rodando)', 'Close to tray (keeps running)')], ['sair', T('Fechar o Aero', 'Quit Aero')]].map(([v, r]) => h('option', { value: v }, r)));
      window.aero.bandeja.preferencia().then((v) => { s.value = v || 'perguntar'; }).catch(() => {});
      s.addEventListener('change', () => window.aero.bandeja.definir(s.value).catch(() => {}));
      return secao(T('Ao fechar a janela', 'When closing the window'), s, h('p', { class: 'peq suave', estilo: { margin: '6px 0 0' } }, T('Na bandeja, o Aero continua recebendo chamadas e mensagens; clique no ícone dele para abrir de novo.', 'In the tray, Aero keeps receiving calls and messages; click its icon to open it again.')));
    }
    // (0.5.9-7) prévia do chat nas Configurações: você e um amigo numa conversa de mentira, com o tamanho de letra e de foto escolhidos
    // (0.9.1) o lado das suas mensagens: duas maquetes animadas (como a da barra das abas) e um clique escolhe
    function escolhaLado() {
      const atual = () => { const v = A.cfg.v.chat.lado; return v === 'direita' || v === 'esquerda' ? v : document.documentElement.dataset.cxlado || 'esquerda'; };
      const conversa = (dir) => h('div', { class: 'mq-tela', 'aria-hidden': 'true' }, h('div', { class: 'mq-conv' },
        h('div', { class: 'mq-l' }, h('i', { class: 'mq-foto' }), h('i', { class: 'mq-bl w2' })),
        h('div', { class: 'mq-l eu' }, h('i', { class: 'mq-foto' }), h('i', { class: 'mq-bl w1' })),
        h('div', { class: 'mq-l' }, h('i', { class: 'mq-foto' }), h('i', { class: 'mq-bl w3' })),
        h('div', { class: 'mq-l eu' }, h('i', { class: 'mq-foto' }), h('i', { class: 'mq-bl ' + (dir ? 'w2' : 'w2') }))));
      const cartao = (id, nome, desc) => {
        const b = h('button', { type: 'button', class: 'mq-cartao mq-lado mq-' + id, role: 'radio', 'aria-checked': String(atual() === id) }, conversa(id === 'direita'), h('b', {}, nome), h('small', {}, desc));
        b.addEventListener('click', () => { A.cfg.v.chat.lado = id; A.cfg.salvar(); A.tema.aplicar(); A.som.tocar('click'); sync(); });
        return b;
      };
      const esq = cartao('esquerda', T('Todas à esquerda', 'All on the left'), T('As suas mensagens ficam do mesmo lado das outras, com a sua foto e o seu nome.', 'Your messages sit on the same side as everyone else\'s, with your photo and name.'));
      const dir = cartao('direita', T('As minhas à direita', 'Mine on the right'), T('Como no WhatsApp: as suas do lado direito, as dos outros do esquerdo.', 'Like WhatsApp: yours on the right, everyone else\'s on the left.'));
      const sync = () => { const v = atual(); esq.setAttribute('aria-checked', String(v === 'esquerda')); dir.setAttribute('aria-checked', String(v === 'direita')); };
      return h('div', { class: 'col', estilo: { gap: '6px' } }, h('div', { estilo: { 'font-weight': '600' } }, T('Lado das suas mensagens', 'Side of your messages')),
        h('div', { class: 'mq-escolha', role: 'radiogroup', 'aria-label': T('Lado das suas mensagens', 'Side of your messages') }, esq, dir));
    }
    function previaChat() {
      const eu = API.eu || { nome: 'Você', codigo: '' };
      const amigos = H.amigos.filter((a) => a.estado === 'aceita');
      const outro = amigos.length ? amigos[Math.floor(Math.random() * amigos.length)] : { nome: 'Bolhinha', codigo: 'PREVIA' };
      // (0.5.9-8) conversas comuns do dia a dia, sem forçar nada
      const conversas = A.idioma() === 'en'
        ? [[[1, 'hey'], [0, 'hi! how are you?'], [1, 'good, and you?']], [[0, 'hey, all good?'], [1, 'yeah, all good'], [0, 'nice']], [[1, 'good morning'], [0, 'morning!'], [1, 'how was your day?']]]
        : [[[1, 'oi'], [0, 'oi, tudo bem?'], [1, 'tudo sim, e você?']], [[0, 'e aí, tudo bem?'], [1, 'tudo certo'], [0, 'que bom']], [[1, 'bom dia'], [0, 'bom dia!'], [1, 'como foi o seu dia?']]];
      const conv = conversas[Math.floor(Math.random() * conversas.length)];
      const hora = new Date().toLocaleTimeString(A.idioma() === 'en' ? 'en' : 'pt-BR', { hour: '2-digit', minute: '2-digit' });
      return h('div', { class: 'cx-previa' }, h('div', { class: 'peq suave', estilo: { 'margin-bottom': '6px' } }, T('Prévia', 'Preview')),
        ...conv.map(([quem, txt]) => { const p = quem ? outro : eu; return h('div', { class: 'cx-msg' + (quem ? '' : ' eu') }, U.avatar(p, 34), h('div', { class: 'cx-conteudo' }, h('div', { class: 'cx-cab' }, h('b', {}, p.apelido || p.nome), h('span', { class: 'cx-hora' }, hora)), h('div', { class: 'cx-bal' }, h('div', { class: 'cx-txt' }, txt)))); }));
    }
    // --- (0.8.0) bolhas de conversa: o modelo e as cores das SUAS mensagens (todo mundo vê assim) ---
    function secaoBolhas() {
      const API = A.api, eu = API.eu || {};
      let bc = { m: 'padrao', c: '', f: '', ...(eu.bc || {}) };
      bc.cs = { ...(bc.cs || {}) }; if ((bc.c || bc.f) && !bc.cs[bc.m]) bc.cs[bc.m] = { c: bc.c, f: bc.f };
      // cada modelo com as cores dele: trocar de modelo traz as cores que você deu àquele modelo (ou as do próprio modelo)
      if (bc.g && !(bc.cs[bc.m] || {}).g) bc.cs[bc.m] = { ...(bc.cs[bc.m] || {}), g: bc.g };
      const coresDe = (m) => { const d = U.CORES_BOLHA[m] || U.CORES_BOLHA.padrao, x = bc.cs[m] || {}; return { c: x.c || '', f: x.f || '', g: Array.isArray(x.g) ? x.g : null, vc: x.c || d[0], vf: x.f || d[1] }; };
      const doModelo = (m) => { const k = coresDe(m), o = { ...bc, m, c: k.c, f: k.f }; if (k.g) o.g = k.g; else delete o.g; for (const x of ['ig', 'b', 'a', 'n', 'v']) delete o[x]; return o; };
      // (0.9.5) as bolhas de arte das integrações da Comunidade que você instalou (o estúdio de bolhas, bolhaarte.js)
      const BA = A.bolhaArte, artes = h('div', { class: 'bc-artes' });
      const pintarArtes = () => {
        if (!BA) return;
        const l = BA.instaladas();
        artes.replaceChildren(h('div', { class: 'peq suave' }, T('Bolhas de arte (das integrações que você instalou)', 'Art bubbles (from integrations you installed)')),
          l.length ? h('div', { class: 'bc-artes-lista', role: 'radiogroup' }, ...l.map((x) => {
            const sel = bc.m === 'arte' && bc.ig === x.ig && bc.b === x.b;
            return h('button', { type: 'button', role: 'radio', 'aria-checked': sel ? 'true' : 'false', class: 'bc-arte' + (sel ? ' sel' : ''), title: x.de, onclick: async () => {
              const antes = bc; bc = { ...bc, m: 'arte', ig: x.ig, b: x.b, a: x.a, n: x.nome }; pintar();
              try { const r = await BA.usar(x.ig, x.b); if (r) bc = { ...r, cs: bc.cs }; } catch (e) { bc = antes; U.toast(e.message, { tipo: 'erro' }); }
              pintar();
            } }, BA.previa({ m: 'arte', a: x.a }, { textos: ['Aa'], classe: 'mini' }), h('small', {}, x.nome));
          })) : h('div', { class: 'peq suave bc-artes-vazio' }, T('Nenhuma ainda. Artistas publicam bolhas na aba Integrações > Comunidade.', 'None yet. Artists publish bubbles in the Integrations > Community tab.')),
          h('label', { class: 'linha bc-arte-op' }, U.chave(BA.pref('ver'), (v) => BA.mudarPref('ver', v)), h('span', {}, T('Mostrar as bolhas de arte de outras pessoas', 'Show other people\'s art bubbles'))),
          h('label', { class: 'linha bc-arte-op' }, U.chave(BA.pref('animar'), (v) => BA.mudarPref('animar', v)), h('span', {}, T('Animar os GIFs das bolhas de outras pessoas', 'Animate GIFs in other people\'s bubbles'))));
      };
      const msg = (texto, meu, alvo) => { const tx = h('div', { class: 'cx-txt' }, h('span', {}, texto)), m = U.aplicarBolha(h('div', { class: 'cx-msg' + (meu ? ' eu' : '') }, tx), alvo); if (alvo && alvo.m === 'aquario') U.pelicula(tx); return m; };
      const previa = h('div', { class: 'bc-previa' });
      const modelos = h('div', { class: 'bc-modelos', role: 'radiogroup' });
      const corI = h('input', { type: 'color', class: 'bc-cor', value: coresDe(bc.m).vc }), fonteI = h('input', { type: 'color', class: 'bc-cor', value: coresDe(bc.m).vf });
      const nomeModelo = h('b', {});
      const corLbl = h('label', {}, corI, T('Cor da bolha', 'Bubble color')); // (0.8.2) na Aurora quem manda são as cores do degradê
      // (0.8.0) Bolha de sabão: as cores do anel em volta (de 2 a 6), com o × para tirar e o + para pôr mais uma
      // (0.8.2) a Aurora também: as cores do degradê que corre pela bolha
      const anel = h('div', { class: 'bc-anel' });
      const temVarias = (m) => !!U.CORES_VARIAS[m];
      const pintarAnel = () => {
        const m = bc.m; anel.hidden = !temVarias(m); corLbl.hidden = m === 'aurora'; if (anel.hidden) return;
        const pad = U.CORES_VARIAS[m], g = (coresDe(m).g || pad).slice();
        const usar = (novo, gravar) => { bc.cs[m] = { ...(bc.cs[m] || {}), g: novo }; bc = { ...bc, g: novo }; pintar(); if (gravar) { pintarAnel(); salvar(); } };
        anel.replaceChildren(h('span', { class: 'peq suave' }, m === 'aurora' ? T('Cores da aurora:', 'Aurora colors:') : T('Anel em volta:', 'Ring around:')), ...g.map((c, i) => {
          const inp = h('input', { type: 'color', class: 'bc-cor', value: c, 'aria-label': (m === 'aurora' ? T('Cor da aurora ', 'Aurora color ') : T('Cor do anel ', 'Ring color ')) + (i + 1) });
          inp.addEventListener('input', () => { const n = g.slice(); n[i] = inp.value; g[i] = inp.value; usar(n, false); }); inp.addEventListener('change', salvar);
          return h('span', { class: 'cor-it' }, inp, g.length > 2 ? h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar esta cor', 'Remove this color'), onclick: () => usar(g.filter((_, k) => k !== i), true) }, '×') : null);
        }), g.length < 6 ? U.btn('', { icone: 'mais', tipo: 'sec', redondo: true, peq: true, titulo: T('Mais uma cor', 'Add a color'), onclick: () => usar(g.concat(pad.concat(['#c9a3ff', '#ffc89a', '#9affea', '#ff9ad5']).find((c) => !g.includes(c)) || g[0]), true) }) : null);
      };
      const pintar = () => {
        previa.replaceChildren(msg(T('Oi! Olha a minha bolha nova 🫧', 'Hi! Look at my new bubble 🫧'), true, bc), msg(T('Ficou bonita!', 'Looks nice!'), false, null));
        // (1.0.0) os modelos do Aero Bubble: com o selo; escolher um travado vira prévia (só você vê, não salva)
        const X = A.extras, nv = (id) => (X ? X.nivelBolha(id) : 0), livre = (id) => !X || X.tem(nv(id));
        modelos.replaceChildren(...U.MODELOS_BOLHA.map(([id, pt, en]) => h('button', { type: 'button', role: 'radio', 'aria-checked': bc.m === id ? 'true' : 'false', class: 'bc-modelo' + (bc.m === id ? ' sel' : '') + (livre(id) ? '' : ' preso'), onclick: () => { bc = doModelo(id); corI.value = coresDe(id).vc; fonteI.value = coresDe(id).vf; pintar(); pintarAnel(); if (livre(id)) salvar(); } }, T(pt, en), livre(id) ? null : X.selo(nv(id)), msg(T('Olá', 'Hello'), true, doModelo(id)))));
        const fx = X && !livre(bc.m) ? X.faixaPrevia(nv(bc.m)) : null; if (fx) previa.append(fx);
        const md = U.MODELOS_BOLHA.find((x) => x[0] === bc.m); nomeModelo.textContent = md ? T(md[1], md[2]) : bc.m === 'arte' ? bc.n || '' : '';
        if (anel.hidden !== !temVarias(bc.m) || anel.dataset.m !== bc.m) { anel.dataset.m = bc.m; pintarAnel(); }
        cores.hidden = bc.m === 'arte'; pintarArtes();
      };
      let t = 0;
      const salvar = () => { if (A.extras && !A.extras.tem(A.extras.nivelBolha(bc.m))) return; clearTimeout(t); t = setTimeout(async () => { try { const r = await API.salvarPerfil({ bc }); if (API.eu) API.eu.bc = r.bc || bc; A.evt.emit('perfil'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } }, 350); };
      const mudarCor = (q, v) => { const d = U.CORES_BOLHA[bc.m] || U.CORES_BOLHA.padrao, val = v.toLowerCase() === d[q === 'c' ? 0 : 1] ? '' : v; bc.cs[bc.m] = { ...(bc.cs[bc.m] || {}), [q]: val }; bc = { ...bc, [q]: val }; pintar(); };
      corI.addEventListener('input', () => mudarCor('c', corI.value)); corI.addEventListener('change', salvar);
      fonteI.addEventListener('input', () => mudarCor('f', fonteI.value)); fonteI.addEventListener('change', salvar);
      const voltar = U.btn(T('Cores do modelo', 'Model colors'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: () => { delete bc.cs[bc.m]; bc = doModelo(bc.m); corI.value = coresDe(bc.m).vc; fonteI.value = coresDe(bc.m).vf; pintar(); pintarAnel(); salvar(); } });
      const cores = h('div', { class: 'bc-cores', estilo: { margin: '12px 0' } }, h('span', { class: 'peq suave' }, T('Cores da ', 'Colors of '), nomeModelo, ':'), corLbl, h('label', {}, fonteI, T('Cor da letra', 'Text color')), voltar);
      pintar(); pintarAnel();
      return secao(T('Bolhas de conversa', 'Chat bubbles'),
        h('p', { class: 'peq suave', estilo: { margin: '0 0 10px' } }, T('O jeito das suas mensagens no Aero Talk. Todo mundo vê a sua bolha do jeito que você escolher.', 'How your messages look in Aero Talk. Everyone sees your bubble the way you choose.')),
        modelos,
        cores,
        anel,
        previa,
        artes);
    }
    // --- (0.8.2) sons de digitação: um tema que toca a cada tecla (digitar.js) ---
    function secaoDigitar() {
      const D = A.digitar;
      const cfg = () => (A.cfg.v.digitar = { tema: 'nenhum', volume: 70, ...(A.cfg.v.digitar || {}) });
      const grade = h('div', { class: 'dg-temas', role: 'radiogroup', 'aria-label': T('Tema dos sons de digitação', 'Typing sound theme') });
      // (1.0.0) os pacotes do Aero Bubble: com o selo; clicar num travado toca só a prévia (não troca o seu tema)
      const X = A.extras, livre = (n) => !n || !X || X.tem(n), faixa = h('div', {});
      let parar = null;
      const pintar = () => grade.replaceChildren(...[['nenhum', 'Sem som', 'Off', '🔇', 0]].concat(D.TEMAS).map(([id, pt, en, ic, n]) => h('button', { type: 'button', role: 'radio', 'aria-checked': cfg().tema === id ? 'true' : 'false', class: 'dg-tema' + (id !== 'nenhum' ? ' com-som' : '') + (cfg().tema === id ? ' sel' : '') + (livre(n) ? '' : ' preso'), onclick: () => {
        if (!livre(n)) { faixa.replaceChildren(X.faixaPrevia(n) || ''); return; }
        faixa.replaceChildren(); cfg().tema = id; A.cfg.salvar(); pintar(); // (0.8.3) sem prévia ao clicar: o som se ouve digitando no campo de teste
      } }, h('span', { class: 'dg-ic', 'aria-hidden': 'true' }, ic), h('span', {}, T(pt, en)), livre(n) ? null : X.selo(n),
        id !== 'nenhum' && X ? X.altoFalante(() => { if (parar) parar(); parar = D.amostra(id); }) : null))); // (1.0.0) a prévia é só pelo alto-falante
      pintar();
      return secao(T('Sons de digitação', 'Typing sounds'),
        h('p', { class: 'peq suave', estilo: { margin: '0 0 10px' } }, T('Um som a cada tecla que você aperta nos campos de texto, com sons próprios para o espaço, o apagar e o Enter. Segurar a tecla não repete o som.', 'A sound for each key you press in text fields, with their own sounds for space, backspace and Enter. Holding a key does not repeat the sound.')),
        grade, faixa,
        h('div', { estilo: { 'margin-top': '12px' } }, h('div', { class: 'linha entre' }, h('span', {}, T('Volume da digitação', 'Typing volume'))), U.slider({ valor: cfg().volume, onchange: (v) => { D.volume(v); } })),
        h('input', { class: 'campo', type: 'text', estilo: { 'margin-top': '10px' }, placeholder: T('Experimente digitar aqui...', 'Try typing here...'), 'aria-label': T('Campo para testar os sons de digitação', 'Field to try the typing sounds') }));
    }
    // --- (0.8.3) indicador de digitação (como no Discord, mas com o texto que você quiser): o que os outros veem enquanto você digita ---
    function secaoIndicador() {
      const PADRAO = { e: [], a: 'nenhuma', t: '' };
      let dg = { ...PADRAO, ...((API.eu && API.eu.dg) || {}) }; dg.e = (dg.e || []).map((x) => (U.emojisDe(x).length === 1 ? U.emojisDe(x)[0] : '')).filter(Boolean); dg.ts = [...(dg.ts || [])]; dg.ep = (dg.ep || []).map((x) => (U.emojisDe(x).length === 1 ? U.emojisDe(x)[0] : '')).filter(Boolean);
      // (0.8.4) textos do Aero (não os do Discord). O "está" e as reticências são fixos: a pessoa escolhe só o meio (até 20 letras)
      const PRE = T('está', 'is'), POS = '...', MEIO = 20;
      const TEXTOS = [T('digitando', 'typing'), T('larpando', 'larping'), T('aprontando', 'up to something'), T('tramando algo', 'plotting something'), T('fofocando', 'gossiping'), T('filosofando', 'philosophizing'),
        T('escrevendo um livro', 'writing a novel'), T('caçando as palavras', 'hunting for words'), T('inventando moda', 'making stuff up'), T('no modo poeta', 'in poet mode'), T('soltando o verbo', 'spilling the tea'), T('apertando teclas', 'mashing keys')].map((m) => PRE + ' ' + m + POS);
      const meioDe = (x) => String(x || '').replace(/^\s*(está|is)\s+/i, '').replace(/\s*(\.\.\.|…)\s*$/, '').slice(0, MEIO);
      const EMOJIS = ['😭', '😂', '🥺', '😎', '🤔', '😈', '👀', '💀', '🔥', '✨', '💖', '💬', '⌨️', '✍️', '🫧', '🌊', '🐶', '🐱', '🐸', '🦴', '🍬', '🍕', '☕', '🎮', '🎧', '🎵', '⚡', '🌙', '⭐', '🌸', '🍀', '👻'];
      const ANIMS = [['nenhuma', T('Nenhuma', 'None')], ['pulso', T('Pulso', 'Pulse')], ['circulo', T('Círculo', 'Circle')], ['onda', T('Onda', 'Wave')]];
      const MODOS_EM = [['fixo', T('Os que eu escolhi', 'The ones I picked'), T('Sempre os mesmos 3 emojis', 'Always the same 3 emojis')], ['lista', T('Sortear da minha lista', 'Draw from my list'), T('Cada mensagem sorteia até 3 emojis da sua lista', 'Each message draws up to 3 emojis from your list')], ['tudo', T('Totalmente aleatórios', 'Fully random'), T('Cada mensagem sorteia 3 emojis quaisquer', 'Each message draws any 3 emojis')]];
      const dicaModo = h('small', { class: 'suave dg-ind-dica' });
      const modoEm = h('div', { class: 'dg-ind-anims dg-ind-modo' }), pote = h('div', { class: 'dg-ind-pote' }), lista = h('div', { class: 'dg-ind-lista' });
      const aleat = h('input', { type: 'checkbox' });
      aleat.addEventListener('change', () => { dg.ta = aleat.checked && dg.ts.length > 0; pintar(); salvar(); });
      const guardar = U.btn(T('Guardar este texto na lista', 'Save this text to the list'), { icone: 'mais', tipo: 'sec', peq: true, titulo: T('Até 10 textos', 'Up to 10 texts'), onclick: () => { if (dg.t && !dg.ts.includes(dg.t) && dg.ts.length < 10) { dg.ts.push(dg.t); if (dg.ts.length > 1) dg.ta = true; pintar(); salvar(); } } });
      const previa = h('div', { class: 'dg-ind-previa' }), slots = h('div', { class: 'dg-ind-emojis' }), anims = h('div', { class: 'dg-ind-anims' }), textos = h('div', { class: 'dg-ind-textos' });
      const proprio = h('input', { class: 'campo', type: 'text', maxlength: MEIO, placeholder: T('Ou escreva o seu (ex.: larpando)', 'Or write your own (e.g. larping)'), 'aria-label': T('Texto do indicador (entre "está" e "...")', 'Indicator text (between "is" and "...")') });
      proprio.value = dg.t && !TEXTOS.includes(dg.t) ? meioDe(dg.t) : '';
      const proprioLinha = h('label', { class: 'dg-ind-proprio' }, h('span', { class: 'dg-fixo' }, PRE), proprio, h('span', { class: 'dg-fixo' }, POS), h('small', { class: 'suave dg-conta' }, ''));
      const contar = () => { proprioLinha.querySelector('.dg-conta').textContent = proprio.value.length + '/' + MEIO; };
      let t = 0;
      const salvar = () => { clearTimeout(t); t = setTimeout(async () => { try { const tem = dg.e.length || dg.t || dg.ts.length || (dg.em && dg.em !== 'fixo'); const r = await API.salvarPerfil({ dg: tem ? dg : null }); if (API.eu) API.eu.dg = r.dg || null; } catch (e) { U.toast(e.message, { tipo: 'erro' }); } }, 400); };
      const nomeEu = () => (API.eu && API.eu.nome) || T('Você', 'You');
      // (0.8.6) o mesmo sorteio do servidor (cada mensagem sorteia um texto da lista e/ou os emojis), aqui só para a prévia
      const sortear = () => {
        let e = dg.e, t = dg.t;
        if (dg.ta && dg.ts.length) t = dg.ts[Math.floor(Math.random() * dg.ts.length)];
        const pote = dg.em === 'tudo' ? EMOJIS : dg.em === 'lista' ? dg.ep : null;
        if (pote && pote.length) { const l = [...pote]; e = []; for (let i = 0; i < Math.min(3, pote.length); i++) e.push(l.splice(Math.floor(Math.random() * l.length), 1)[0]); }
        return { e, t };
      };
      const pintar = () => {
        const r = sortear();
        previa.replaceChildren(r.e.length ? h('span', { class: 'cx-dig-emojis anim-' + dg.a }, ...r.e.map((e) => h('i', {}, e))) : h('span', { class: 'cx-dig-pontos' }, h('i'), h('i'), h('i')),
          h('span', {}, h('b', {}, nomeEu()), ' ', r.t || T('está digitando…', 'is typing…')),
          (dg.ta && dg.ts.length) || (dg.em && dg.em !== 'fixo') ? h('button', { type: 'button', class: 'dg-ind-resortear', title: T('Ver outro sorteio', 'See another draw'), onclick: () => pintar() }, A.icone('atualizar', 14)) : null);
        modoEm.replaceChildren(...MODOS_EM.map(([id, nome, dica]) => h('button', { type: 'button', class: (dg.em || 'fixo') === id ? 'sel' : '', 'aria-pressed': String((dg.em || 'fixo') === id), title: dica, onclick: () => { dg.em = id; pintar(); salvar(); } }, nome)));
        slots.hidden = (dg.em || 'fixo') !== 'fixo';
        pote.hidden = dg.em !== 'lista';
        pote.replaceChildren(...dg.ep.map((e, i) => h('span', { class: 'bolha-chip dg-ind-chip' }, e, h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar', 'Remove'), onclick: () => { dg.ep.splice(i, 1); pintar(); salvar(); } }, '×'))),
          dg.ep.length < 24 ? h('button', { type: 'button', class: 'dg-ind-slot', title: T('Pôr emojis na lista', 'Add emojis to the list'), onclick: (ev) => porNoPote(ev.currentTarget) }, '+') : null,
          h('small', { class: 'suave dg-ind-dica' }, T('Cada mensagem sorteia até 3 destes.', 'Each message draws up to 3 of these.')));
        lista.replaceChildren(...dg.ts.map((x, i) => h('span', { class: 'bolha-chip dg-ind-chip' }, x, h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar este texto', 'Remove this text'), onclick: () => { dg.ts.splice(i, 1); if (!dg.ts.length) dg.ta = false; pintar(); salvar(); } }, '×'))));
        guardar.disabled = !dg.t || dg.ts.includes(dg.t) || dg.ts.length >= 10;
        aleat.checked = !!dg.ta; aleat.disabled = !dg.ts.length;
        slots.replaceChildren(...[0, 1, 2].map((i) => {
          const b = h('button', { type: 'button', class: 'dg-ind-slot', title: dg.e[i] ? T('Trocar ou tirar este emoji', 'Change or remove this emoji') : T('Escolher um emoji', 'Pick an emoji') }, dg.e[i] || '+');
          b.addEventListener('click', () => escolher(b, i)); return b;
        }));
        const amostra = r.e.length ? r.e : ['✨', '💬', '⌨️'];
        anims.replaceChildren(...ANIMS.map(([id, nome]) => h('button', { type: 'button', class: 'dg-anim-op' + (dg.a === id ? ' sel' : ''), 'aria-pressed': String(dg.a === id), onclick: () => { dg.a = id; pintar(); salvar(); } }, h('span', { class: 'cx-dig-emojis anim-' + id }, ...amostra.map((e) => h('i', {}, e))), h('small', {}, nome))));
        dicaModo.textContent = (MODOS_EM.find(([id]) => id === (dg.em || 'fixo')) || MODOS_EM[0])[2];
        textos.replaceChildren(...TEXTOS.map((x) => h('button', { type: 'button', class: dg.t === x ? 'sel' : '', onclick: () => { dg.t = x === TEXTOS[0] ? '' : x; proprio.value = ''; contar(); pintar(); salvar(); } }, x)));
      };
      // (0.8.7) os campos de emoji só aceitam emoji: letras, números e símbolos somem enquanto você digita ou cola
      // escolher o emoji de um lugar: os mais usados à mão e um campo para qualquer outro (colar ou o teclado de emojis do sistema)
      function escolher(ancora, i) {
        let pop = null;
        const usar = (e) => { const lista = [...dg.e]; if (e) lista[i] = e; else lista.splice(i, 1); dg.e = lista.filter(Boolean).slice(0, 3); pintar(); salvar(); if (pop && pop.fechar) pop.fechar(); };
        // (0.8.7) a mesma grade de emojis do chat (com busca pelo nome); sem campo de texto, então só entra emoji
        const grade = A.gradeEmojis({ aoEscolher: (e) => usar(e) });
        pop = U.popover(ancora, [h('div', { class: 'dg-ind-grade' }, grade), dg.e[i] ? h('div', { estilo: { padding: '0 8px 8px' } }, U.btn(T('Tirar este emoji', 'Remove this emoji'), { icone: 'lixo', tipo: 'sec', peq: true, onclick: () => usar('') })) : null], { largura: 360, titulo: T('Emoji', 'Emoji') });
        setTimeout(() => grade.focar(), 50);
      }
      // (0.8.5) escolher os 3 de uma vez na lista: cada clique marca um (com o número da ordem), clicar de novo desmarca; no 3º já aplica
      function escolherVarios(ancora) {
        let pop = null, sel = [];
        const usar = () => { dg.e = sel.slice(0, 3); pintar(); salvar(); A.som.tocar('bolha'); if (pop && pop.fechar) pop.fechar(); };
        const pronto = U.btn(T('Usar estes', 'Use these'), { peq: true, onclick: () => { if (sel.length) usar(); } });
        const conta = h('span', { class: 'peq suave' });
        const botoes = EMOJIS.map((e) => h('button', { type: 'button', onclick: () => { const k = sel.indexOf(e); if (k >= 0) sel.splice(k, 1); else if (sel.length < 3) sel.push(e); if (sel.length === 3) { usar(); return; } marcar(); } }, e));
        const marcar = () => { botoes.forEach((b, k) => { const n = sel.indexOf(EMOJIS[k]); b.classList.toggle('sel', n >= 0); if (n >= 0) b.dataset.n = n + 1; else delete b.dataset.n; }); conta.textContent = sel.length + '/3'; pronto.disabled = !sel.length; };
        const grade = h('div', { class: 'dg-ind-pop varios' }, ...botoes);
        pop = U.popover(ancora, [grade, h('div', { class: 'linha entre', estilo: { padding: '0 8px 8px', gap: '8px' } }, conta, pronto)], { largura: 320, titulo: T('Escolha até 3 emojis', 'Pick up to 3 emojis') });
        marcar();
      }
      // (0.8.6) a lista de emojis para sortear: clicar marca/desmarca na hora; o campo aceita qualquer outro
      function porNoPote(ancora) {
        const grade = A.gradeEmojis({ marcado: (e) => dg.ep.includes(e), aoEscolher: (e, b) => { const k = dg.ep.indexOf(e); if (k >= 0) dg.ep.splice(k, 1); else if (dg.ep.length < 24) dg.ep.push(e); else return; if (b) b.classList.toggle('sel', dg.ep.includes(e)); pintar(); salvar(); } });
        U.popover(ancora, [h('div', { class: 'dg-ind-grade' }, grade)], { largura: 360, titulo: T('Emojis para sortear', 'Emojis to draw') });
        setTimeout(() => grade.focar(), 50);
      }
      proprio.addEventListener('input', () => { const m = proprio.value.replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, MEIO); dg.t = m.trim() ? PRE + ' ' + m.trim() + POS : ''; contar(); pintar(); salvar(); });
      contar();
      const sorte = () => { const em = [...EMOJIS].sort(() => Math.random() - 0.5); dg = { ...dg, em: 'fixo', e: [em[0], em[0], em[0]].map((x, k) => (Math.random() < 0.5 ? em[0] : em[k])), a: ANIMS[1 + Math.floor(Math.random() * 3)][0], t: TEXTOS[1 + Math.floor(Math.random() * (TEXTOS.length - 1))] }; proprio.value = ''; contar(); pintar(); salvar(); A.som.tocar('bolha'); };
      const limpar = () => { dg = { ...PADRAO, e: [], ts: [], ep: [] }; proprio.value = ''; contar(); pintar(); salvar(); };
      pintar();
      // (0.8.7) repaginado: a prévia em cima e três passos simples (emojis, animação, texto); o que é avançado fica guardado num "mais"
      const passo = (n, tit, ...corpo) => h('div', { class: 'dg-passo' }, h('div', { class: 'dg-passo-tit' }, h('span', { class: 'dg-passo-n' }, String(n)), h('b', {}, tit)), ...corpo);
      const varios = h('details', { class: 'dg-ind-mais' }, h('summary', {}, T('Mais: sortear entre vários textos', 'More: draw from several texts')),
        h('p', { class: 'peq suave', estilo: { margin: '6px 0' } }, T('Guarde até 10 textos; cada mensagem pode usar um deles.', 'Save up to 10 texts; each message can use one of them.')),
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, guardar), lista,
        h('label', { class: 'linha peq', estilo: { gap: '6px', 'margin-top': '6px' } }, aleat, T('Sortear um destes a cada mensagem', 'Draw one of these for each message')));
      if (dg.ts.length) varios.open = true;
      return secao(T('Indicador de digitação', 'Typing indicator'),
        h('p', { class: 'peq suave', estilo: { margin: '0 0 10px' } }, T('É o que os outros veem no Aero Talk enquanto você digita.', 'This is what others see in Aero Talk while you type.')),
        h('div', { class: 'dg-ind-palco' }, previa),
        h('div', { class: 'dg-passos' },
          passo(1, T('Emojis', 'Emojis'), modoEm, dicaModo,
            h('div', { class: 'linha dg-ind-linha' }, slots, pote, h('div', { class: 'linha dg-ind-acoes' },
              U.btn('', { icone: 'estrela', tipo: 'sec', redondo: true, peq: true, titulo: T('Escolher os 3 de uma vez', 'Pick all 3 at once'), onclick: (ev) => escolherVarios(ev.currentTarget) }),
              U.btn('', { icone: 'lixo', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar todos os emojis', 'Remove all emojis'), onclick: () => { dg.e = []; dg.ep = []; dg.em = 'fixo'; pintar(); salvar(); } })))),
          passo(2, T('Animação', 'Animation'), anims),
          passo(3, T('Texto', 'Text'), textos, h('div', { estilo: { 'margin-top': '8px' } }, proprioLinha), varios)),
        h('div', { class: 'linha', estilo: { 'margin-top': '12px', 'flex-wrap': 'wrap', gap: '8px' } }, U.btn(T('Surpreenda-me', 'Surprise me'), { icone: 'estrela', tipo: 'sec', peq: true, onclick: sorte }), U.btn(T('Redefinir', 'Reset'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: limpar })));
    }
    // --- feedback para o desenvolvedor ---
    function secaoFeedback() {
      const tipo = h('select', { class: 'campo', estilo: { width: 'auto' } }, [['ideia', T('Ideia', 'Idea')], ['bug', T('Problema', 'Bug')], ['elogio', T('Elogio', 'Praise')], ['outro', T('Outro', 'Other')]].map(([v, r]) => h('option', { value: v }, r)));
      // (0.8.2) no "Problema": onde foi
      const sub = h('select', { class: 'campo fb-sub', estilo: { width: 'auto' }, hidden: true, 'aria-label': T('Onde foi o problema', 'Where the problem was') }, [['', T('Onde foi o problema?', 'Where was the problem?')], ['chat', T('Chat', 'Chat')], ['transmissao', T('Transmissão', 'Streaming')], ['interface', T('Interface', 'Interface')], ['conexao', T('Conexão', 'Connection')], ['outros', T('Outros', 'Other')]].map(([v, r]) => h('option', { value: v }, r)));
      const texto = h('textarea', { class: 'campo', rows: 3, maxlength: 2000, placeholder: T('Conte o que você acha do Aero, o que está faltando ou o que deu errado...', 'Tell us what you think of Aero, what is missing or what went wrong...') });
      // (0.8.1) no "Problema", o relatório de diagnóstico vai junto (marcado por padrão; sem senhas nem tokens)
      const comDiag = h('input', { type: 'checkbox', checked: true });
      const linhaDiag = h('label', { class: 'linha peq', estilo: { gap: '6px' }, hidden: true }, comDiag, T('Incluir o relatório de diagnóstico (ajuda a achar o problema; sem senhas nem tokens)', 'Include the diagnostic report (helps find the problem; no passwords or tokens)'));
      // (0.8.2) anexos: fotos, GIFs, áudios e vídeos (até 4, de até 25 MB cada)
      const MAX = 4, TAM = 25 * 1024 * 1024, arquivos = [];
      const escolher = h('input', { type: 'file', accept: 'image/*,video/*,audio/*', multiple: true, hidden: true });
      const lista = h('div', { class: 'fb-anexos' });
      const pintarAnexos = () => lista.replaceChildren(...arquivos.map((f, i) => h('span', { class: 'bolha-chip fb-anexo' }, A.icone(/^image\//.test(f.type) ? 'imagem' : /^video\//.test(f.type) ? 'video' : 'musica', 16), h('span', { class: 'fb-anexo-nome' }, f.name), h('small', { class: 'suave' }, (f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB')),
        h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar', 'Remove'), onclick: () => { arquivos.splice(i, 1); pintarAnexos(); } }, '×'))));
      escolher.addEventListener('change', () => {
        for (const f of escolher.files) {
          if (!/^(image|video|audio)\//.test(f.type)) { U.toast(f.name + T(': só fotos, GIFs, áudios e vídeos.', ': only photos, GIFs, audio and video.'), { tipo: 'erro' }); continue; }
          if (f.size > TAM) { U.toast(f.name + T(': grande demais (máximo 25 MB).', ': too big (max 25 MB).'), { tipo: 'erro' }); continue; }
          if (arquivos.length >= MAX) { U.toast(T('No máximo 4 anexos.', 'At most 4 attachments.'), { tipo: 'erro' }); break; }
          arquivos.push(f);
        }
        escolher.value = ''; pintarAnexos();
      });
      const btnAnexar = U.btn(T('Anexar', 'Attach'), { icone: 'clipe', tipo: 'sec', peq: true, titulo: T('Fotos, GIFs, áudios e vídeos (até 25 MB cada)', 'Photos, GIFs, audio and video (up to 25 MB each)'), onclick: () => escolher.click() });
      tipo.addEventListener('change', () => { const bug = tipo.value === 'bug'; linhaDiag.hidden = !bug; sub.hidden = !bug; });
      const subir = async (f) => {
        const r = await fetch(`${API.servidor}/api/feedback/anexo`, { method: 'POST', headers: { Authorization: 'Bearer ' + API.token, 'Content-Type': f.type, 'X-Nome': encodeURIComponent(f.name.slice(0, 80)) }, body: f });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(f.name + ': ' + (d.erro || T('não consegui enviar.', 'could not upload.')));
        return d.id;
      };
      const enviar = async (e) => {
        const b = e.currentTarget; b.disabled = true;
        try {
          if (tipo.value === 'bug' && !sub.value) { sub.focus(); throw new Error(T('Escolha onde foi o problema.', 'Choose where the problem was.')); }
          if (texto.value.trim().length < 3) { texto.focus(); throw new Error(T('Escreva o seu feedback.', 'Write your feedback.')); }
          let diag = ''; if (tipo.value === 'bug' && comDiag.checked && A.diag) { try { diag = await A.diag.relatorio(); } catch (x) { diag = ''; } }
          const anexos = []; for (const f of arquivos) anexos.push(await subir(f));
          await API.req('feedback', { tipo: tipo.value, sub: tipo.value === 'bug' ? sub.value : '', texto: texto.value, diag, anexos });
          texto.value = ''; sub.value = ''; arquivos.length = 0; pintarAnexos();
          A.som.tocar('sucesso'); U.toast(T('Feedback enviado! O desenvolvedor lê todos.', 'Feedback sent! The developer reads them all.'), { tipo: 'ok' });
        } catch (x) { U.toast(x.message, { tipo: 'erro' }); }
        b.disabled = false;
      };
      return secao(T('Feedback', 'Feedback'), h('div', { class: 'col', estilo: { gap: '8px' } },
        // (1.0.2) o Aero é feito por uma pessoa só: deixar claro que bugs acontecem e que o feedback é o que faz ele melhorar
        h('p', { class: 'peq suave fb-umso' }, T('O Aero é feito por uma pessoa só. Pode (e vai) aparecer bug, e o app só fica melhor com vocês contando o que deu errado e o que está faltando. Todo feedback é lido.', 'Aero is made by one person. There can (and will) be bugs, and the app only gets better when you tell us what went wrong and what is missing. Every piece of feedback is read.')),
        h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, tipo, sub), texto, linhaDiag, lista, escolher,
        h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } }, U.btn(T('Enviar feedback', 'Send feedback'), { icone: 'enviar', peq: true, onclick: enviar }), btnAnexar),
        h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('A resposta chega aqui no app. Dá para anexar fotos, GIFs, áudios e vídeos.', 'The answer arrives here in the app. You can attach photos, GIFs, audio and video.'))));
    }

    // (0.8.0) as configurações em 4 grupos (Customização, Sistema, Conta e Apoio), cada um com a setinha para abrir e fechar
    // (0.8.7) as configurações em páginas (Aparência, Chats e sons, Sistema, Conta, Apoio). Na bolha do perfil, a lista das páginas fica na
    // coluna da esquerda, embaixo do seu cartão; na doca e no celular, numa fileira de orbes em cima. Trocar de página faz a nova "brotar".
    const paginas = [];
    const grupo = (id, titulo, icone, desc, caixas) => {
      const pg = h('div', { class: 'cfg-pagina', id: 'grupo-' + id, role: 'tabpanel', hidden: true }, U.mosaico(caixas.filter(Boolean).map((c) => { if (A.estudio) A.estudio.vestir(c); return c; }), { min: 560 }));
      paginas.push({ id, titulo, icone, desc, pg });
      return pg;
    };
    el.append(cab(T('Configurações', 'Settings')),
      grupo('customizacao', T('Aparência', 'Appearance'), 'oPaleta', T('Cores, vidro e bolhas de conversa', 'Colors, glass and chat bubbles'), [
        ...(() => { const ap = A.aparencia.secao(); return ap.partes.map((x) => secao(null, x)); })(), // (0.8.7) cada parte da aparência na sua caixa
        secaoBolhas(),
        ...(A.extras ? [secao(T('Ícone e sons', 'Icon and sounds'), A.extras.secaoApp())] : []), // (1.0.0) os extras do Aero Bubble no app
        ...(A.extras && A.extras.secaoChamada ? [secao(T('Tela de chamada', 'Call screen'), A.extras.secaoChamada())] : []), // (1.0.2) cor, imagem, bolhas e acessórios da sua chamada, com prévia
        ...(A.aer ? [secao('Skins', A.aer.secao())] : []), // (1.0.0) as skins .aer fazem parte da aparência
      ]),
      grupo('chats', T('Chats e sons', 'Chats and sounds'), 'chat', T('Mensagens, sons e digitação', 'Messages, sounds and typing'), [
        secao(T('Chats', 'Chats'), // (0.5.9-6) tamanho das mensagens e das fotos em todos os chats (Aero Talk, grupos e salas)
          h('div', {}, h('div', { class: 'linha entre' }, h('span', {}, T('Tamanho das mensagens', 'Message size')), h('span', { class: 'suave peq cx-fonte-num' }, (A.cfg.v.chat.fonte || 100) + '%')), U.slider({ valor: A.cfg.v.chat.fonte || 100, min: 80, max: 160, passo: 5, oninput: (v) => { A.cfg.v.chat.fonte = v; A.cfg.salvar(); A.tema.aplicar(); const n = el.querySelector('.cx-fonte-num'); if (n) n.textContent = v + '%'; } })),
          opcao(T('Fotos das pessoas no chat', 'People photos in chat'), ((x) => { x.classList.add('quebra'); return x; })(U.seg([['enorme', T('Muito grandes', 'Very large')], ['grande', T('Grandes', 'Large')], ['normal', T('Normais', 'Normal')], ['pequena', T('Pequenas', 'Small')], ['nao', T('Sem fotos', 'No photos')]], A.cfg.v.chat.foto || 'normal', (v) => { A.cfg.v.chat.foto = v; A.cfg.salvar(); A.tema.aplicar(); })), T('Com foto, clicar nela abre o mini perfil da pessoa.', 'With photos, clicking one opens the person\'s mini profile.')),
          escolhaLado(),
          previaChat(),
          opcao(T('Aviso de outras conversas', 'Alerts from other chats'), U.chave(A.cfg.v.avisoConversa !== false, (v) => { A.cfg.v.avisoConversa = v; A.cfg.salvar(); }), T('Com uma conversa aberta, as mensagens que chegam em outras aparecem num cartãozinho embaixo do nome, para pular para elas.', 'With a chat open, messages from other chats show in a small card under the name, so you can jump to them.'))),
        secao(T('Versão e som', 'Version and sound'),
          opcao(T('Versão da interface', 'Interface version'), U.seg([['lite', T('Otimizada', 'Optimized')], ['fancy', T('Completa', 'Fancy')]], A.cfg.v.visual === 'lite' ? 'lite' : 'fancy', (v) => { A.cfg.v.visual = v; A.tema.aplicar(); A.cfg.salvar(); }), T('Otimizada: sem desfoque nem bolhas. Melhor para Safari antigo e PC fraco.', 'Optimized: no blur or bubbles. Best for old Safari and weak PCs.')),
          opcao(T('Sons', 'Sounds'), U.chave(A.cfg.v.som.ativo, (v) => { A.cfg.v.som.ativo = v; A.cfg.salvar(); if (v) A.som.tocar('sucesso'); })),
          h('div', {}, h('div', { class: 'linha entre' }, h('span', {}, T('Volume dos sons', 'Sound volume'))), U.slider({ valor: A.cfg.v.som.volume, onchange: (v) => { A.som.volume(v); A.som.tocar('msg'); } })),
          h('div', { class: 'linha', estilo: { 'margin-top': '10px', 'flex-wrap': 'wrap' } }, btnSons, sonsEstado),
          opcao(T('Toque de chamada', 'Ringtone'), (() => { const t = h('select', { class: 'campo', estilo: { width: 'auto' } }, [['classico', T('Vidro', 'Glass')], ['brisa', T('Brisa', 'Breeze')], ['novo', T('Bolhas', 'Bubbles')], ['marimba', T('Marimba de vidro', 'Glass marimba')]].map(([v, r]) => h('option', { value: v }, r))); t.value = ['classico', 'marimba', 'brisa', 'novo'].includes(A.cfg.v.toque) ? A.cfg.v.toque : 'classico'; t.addEventListener('change', () => { A.cfg.v.toque = t.value; A.cfg.salvar(); });
            const ouvirT = () => A.som.tocar(t.value === 'novo' ? 'chamada-entrada' : 'chamada-entrada-' + t.value); // (1.0.0) a prévia é só pelo alto-falante
            return h('div', { class: 'linha', estilo: { gap: '8px', 'align-items': 'center' } }, t, A.extras ? ((x) => { x.classList.add('px-ouvir-solto'); return x; })(A.extras.altoFalante(ouvirT)) : null); })()),
          A.extras ? A.extras.secaoToques() : null), // (1.0.2) os toques do Aero Bubble dentro da caixa (soltos, ficavam fora dela e sem a animação da troca de aba)
        secaoDigitar(),
        API.eu ? secaoIndicador() : null,
      ]),
      grupo('sistema', T('Sistema', 'System'), 'ajustes', T('Idioma, controles, placa e aparelhos', 'Language, controllers, GPU and devices'), [
        secao(T('Geral', 'General'),
          opcao(T('Idioma', 'Language'), U.seg([['pt-BR', 'Português'], ['en', 'English']], A.idioma(), (v) => A.setIdioma(v))),
          opcao(T('Configurações iguais em todos os aparelhos', 'Same settings on every device'), U.chave(A.cfg.v.sincronizar !== false, async (v, ch) => {
            const bp = document.querySelector('.sinc-partes'); if (bp) bp.hidden = !v;
            if (!v) { await API.mudarSincronizar(false); U.toast(T('Este aparelho agora tem as configurações só dele.', 'This device now keeps its own settings.'), { ms: 2600 }); return; }
            const daqui = await U.confirmar(T('Quais configurações ficam valendo em todos os aparelhos?', 'Which settings should every device use?'), { titulo: T('Sincronizar de novo', 'Sync again'), sim: T('As deste aparelho', 'This device\'s'), nao: T('As da conta', 'The account\'s') });
            await API.mudarSincronizar(true, daqui);
          }), T('Escolha abaixo o que segue a sua conta. Desligado, este aparelho fica com as configurações dele (ex.: doca no celular e bolha no computador).', 'Choose below what follows your account. Off, this device keeps its own settings (e.g. dock on the phone and bubble on the computer).')),
          // (0.9.5) o que segue a conta, parte por parte
          h('div', { class: 'col sinc-partes', estilo: { gap: '2px', 'padding-left': '14px' }, hidden: A.cfg.v.sincronizar === false }, ...[
            ['aparencia', T('Aparência e barra das abas', 'Appearance and tab bar')], ['chats', T('Chats', 'Chats')],
            ['sons', T('Sons e volumes', 'Sounds and volumes')], ['integracoes', T('Integrações instaladas', 'Installed integrations')], ['geral', T('Idioma e atualizações', 'Language and updates')],
          ].map(([k, nome]) => opcao(nome, U.chave(API.sincParte(k), (v) => API.mudarSincParte(k, v))))),
          opcao(T('Pular a tela inicial', 'Skip the start screen'), U.chave(A.cfg.v.pularSplash, (v) => { A.cfg.v.pularSplash = v; A.cfg.salvar(); }), T('Abre direto na home.', 'Opens straight to home.'))),
        secao(T('Atualizações', 'Updates'), (() => { // (0.5.9-6)
          const est = h('span', { class: 'suave peq' }, 'v' + A.versao);
          const verificar = async (e) => {
            const b = e && e.currentTarget; if (b) b.disabled = true; est.textContent = T('Procurando...', 'Checking...');
            const r = A.sistema ? await A.sistema.verificarAtualizacao({ manual: true }).catch(() => null) : null;
            est.textContent = r && r.nova ? (r.instalador ? T('Versão ' + r.nova + ': precisa do instalador novo (site).', 'Version ' + r.nova + ': needs the new installer (website).') : T('Versão ' + r.nova + ' disponível.', 'Version ' + r.nova + ' available.')) : r && r.erro ? T('Não consegui procurar agora (sem internet?).', 'Could not check now (offline?).') : T('Você está na versão mais nova (v', 'You are on the latest version (v') + A.versao + ').';
            if (b) b.disabled = false;
          };
          return h('div', { class: 'col', estilo: { gap: '8px' } },
            opcao(T('Procurar atualizações automaticamente', 'Check for updates automatically'), U.chave(A.cfg.v.atualizar.auto !== false, (v) => { A.cfg.v.atualizar.auto = v; A.cfg.salvar(); }), T('A cada minuto. Quando sai versão nova, o app pergunta antes de atualizar.', 'Every minute. When a new version is out, the app asks before updating.')),
            opcao(T('Mostrar as novidades depois de atualizar', 'Show what\'s new after updating'), U.chave(A.cfg.v.atualizar.novidades === true, (v) => { A.cfg.v.atualizar.novidades = v; A.cfg.salvar(); }), T('Na primeira vez que o app abre numa versão nova, as Novidades dela aparecem sozinhas.', 'The first time the app opens on a new version, its notes show up on their own.')),
            // (1.0.2) versões de teste: só para testers, supporters e o desenvolvedor, e só no app do PC (mesma conta, mesmo servidor)
            A.plat.desktop && A.sistema && A.sistema.podeTeste && A.sistema.podeTeste() ? opcao(T('Receber versões de teste', 'Get test versions'), U.chave(A.cfg.v.atualizar.teste === true, (v) => {
              A.cfg.v.atualizar.teste = v; A.cfg.salvar();
              if (v) verificar(); else if (A.sistema.sairDoTeste) A.sistema.sairDoTeste();
            }), T('Você recebe as versões novas do app antes de todo mundo, com a mesma conta, os mesmos amigos e as mesmas conversas. Podem ter bugs: conte pelo Feedback. Se o canal de teste sair do ar ou a versão de teste não abrir, o Aero volta sozinho para a versão normal.', 'You get new app versions before everyone else, with the same account, friends and chats. They may have bugs: tell us through Feedback. If the test channel goes down or the test version does not open, Aero goes back to the regular version by itself.')) : null,
            h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '10px' } }, U.btn(T('Verificar atualização', 'Check for updates'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: verificar }),
              A.novidades && A.novidades.tem() ? U.btn(T('Novidades', 'What\'s new'), { icone: 'estrela', tipo: 'sec', peq: true, onclick: () => A.novidades.abrir() }) : null, est)); // (0.8.3) o que cada versão trouxe
        })()),
        h('section', { class: 'vidro pad larga', id: 'sec-controles', estilo: { 'margin-bottom': '14px' } }, h('h3', { estilo: { 'margin-bottom': '8px' } }, T('Controles', 'Controllers')),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '10px' } }, U.btn(T('Testar e configurar controles', 'Test and set up controllers'), { icone: 'controle', onclick: abrirControles }), h('span', { class: 'suave peq' }, A.pad.conectado() ? T('Controle detectado.', 'Controller detected.') : T('Nenhum controle detectado.', 'No controller detected.'))),
          h('div', { class: 'peq suave', estilo: { 'margin-top': '8px' } }, T('Os controles também navegam pelo app: direcional move, A confirma, B volta, LB/RB trocam de aba ou de área, o analógico direito rola a tela. Remapear botões, escolher o tipo de controle e calibrar os analógicos fica na tela de Controles.', 'Controllers also navigate the app: D-pad moves, A confirms, B goes back, LB/RB switch tab or area, the right stick scrolls. Remapping buttons, picking the controller type and calibrating sticks lives in the Controllers screen.'))),
        A.plat.desktop ? secao(T('Placa de vídeo', 'Graphics card'), gpuBox, winBloco, perfisBloco, h('label', { class: 'rot', estilo: { 'margin-top': '10px' } }, T('Modo de compatibilidade', 'Compatibility mode')), compat, vaBloco, drvBloco, h('div', { class: 'peq suave', estilo: { 'margin-top': '6px' } }, T('Se o vídeo ficar com falhas ou o computador travar ao transmitir, atualize o sistema (kernel, mesa e linux-firmware) e, enquanto isso, use "Sem aceleração de vídeo".', 'If video glitches or the computer freezes while sharing, update your system (kernel, mesa and linux-firmware) and meanwhile use "No video acceleration".'))) : null,
        secaoAparelhos(), A.plat.desktop && window.aero ? secaoInicio() : null, A.plat.desktop && window.aero && window.aero.bandeja ? secaoFechar() : null,
      ]),
      grupo('conta', T('Conta', 'Account'), 'pessoa', T('Privacidade, assinatura e acesso', 'Privacy, subscription and access'), [
        secaoPrivacidade(),
        A.apoio && A.apoio.secaoAssinatura ? secao(T('Assinatura', 'Subscription'), A.apoio.secaoAssinatura()) : null, // (0.8.2)
        secao(T('Conta e diagnóstico', 'Account and diagnostics'),
          opcao(T('E-mail', 'E-mail'), h('div', { class: 'linha' }, emailTxt, U.btn('', { icone: 'olho', tipo: 'sec', redondo: true, peq: true, titulo: T('Mostrar/ocultar', 'Show/hide'), onclick: () => { verEmail = !verEmail; pintarEmail(); } }), U.btn(T('Trocar e-mail', 'Change e-mail'), { tipo: 'sec', peq: true, onclick: trocarEmail }))),
          opcao(T('Código de acesso', 'Access code'), h('div', { class: 'linha' }, idSecreto, U.btn('', { icone: 'olho', tipo: 'sec', redondo: true, peq: true, titulo: T('Mostrar/ocultar', 'Show/hide'), onclick: () => { ver = !ver; idSecreto.textContent = ver ? meuCodigo() : '••••-••••-••••'; } }), U.btn('', { icone: 'copiar', tipo: 'sec', redondo: true, peq: true, titulo: T('Copiar', 'Copy'), onclick: (e) => U.copiar(API.codigoAcesso(), e.currentTarget) })), T('Entra em outros aparelhos e abre as suas conversas. O servidor não guarda este código (só um hash dele).', 'Signs in on other devices and opens your chats. The server does not store this code (only a hash of it).')),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', 'margin-top': '6px' } }, U.btn(T('Trocar código de acesso', 'Change access code'), { icone: 'atualizar', tipo: 'sec', peq: true, onclick: trocarCodigo })),
          opcao(T('Entrar com senha', 'Sign in with a password'), senhaBtns, T('O padrão é o código de acesso. Com uma senha, você também pode entrar digitando a sua # e a senha (o código continua valendo).', 'The default is the access code. With a password you can also sign in with your # and the password (the code still works).')),
          opcao(T('Entrar em outro aparelho', 'Sign in on another device'), U.btn(T('Mostrar QR code', 'Show QR code'), { icone: 'qr', tipo: 'sec', peq: true, onclick: () => entrarOutro() }), T('Mostra um QR e um código que muda a cada 30 segundos. No outro aparelho, escolha "QR code" na tela de entrar e leia (ou digite o código); aqui você confirma, sem digitar o código de acesso.', 'Shows a QR and a code that changes every 30 seconds. On the other device, pick "QR code" on the sign-in screen and scan it (or type the code); you confirm here, without typing the access code.')),
          h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', 'margin-top': '10px' } }, U.btn(T('Copiar relatório de diagnóstico', 'Copy diagnostics report'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(() => A.diag.relatorio(), e.currentTarget) }), U.btn(T('Sair da conta', 'Sign out'), { tipo: 'perigo', peq: true, onclick: () => ctx.sair && ctx.sair() })),
          h('div', { class: 'peq suave', estilo: { 'margin-top': '14px', 'text-align': 'center' } }, 'Aero v' + A.versao + ' · ', T('Criado por ', 'Created by '), h('b', {}, A.autor)),
          A.legal ? h('div', { class: 'linha', estilo: { 'justify-content': 'center', 'flex-wrap': 'wrap', gap: '8px', 'margin-top': '8px' } }, U.btn(T('Créditos', 'Credits'), { icone: 'estrela', tipo: 'sec', peq: true, onclick: () => A.legal.creditos() }), U.btn(T('Termos de Serviço', 'Terms of Service'), { icone: 'livro', tipo: 'sec', peq: true, onclick: () => A.legal.abrir() })) : null), // (1.0.2)
        secaoFeedback(),
      ]),
      // (0.8.7) cada integração da oficina ganha o seu lugar aqui, com as opções que ela declarou (o app desenha; ela não mexe no resto)
      ...(A.integ && A.integ.secoesConfig ? [grupo('integracoes', T('Integrações', 'Integrations'), 'oInteg', T('As opções das suas integrações', 'Your integrations\' options'), [igCaixa])] : []),
      A.apoio ? grupo('apoio', T('Apoio', 'Support'), 'coracao', T('Aero Bubble e outras ajudas', 'Aero Bubble and more'), [
        A.apoio ? h('section', { class: 'vidro pad larga', id: 'sec-apoio', estilo: { 'margin-bottom': '14px' } }, A.apoio.secao()) : null,
      ]) : null);
    const itens = {};
    let atual = null;
    const subnav = h('nav', { class: 'cfg-sub', role: 'tablist', 'aria-label': T('Partes das configurações', 'Settings sections') }, paginas.map((p) =>
      (itens[p.id] = h('button', { type: 'button', class: 'cfg-sub-it cfg-sub-' + p.id, role: 'tab', 'aria-selected': 'false', onclick: () => mostrar(p.id, true) }, A.orbe(p.icone, 34), h('span', { class: 'cfg-sub-tx' }, h('b', {}, p.titulo), h('small', {}, p.desc))))));
    function mostrar(id, clique) {
      if (!paginas.some((p) => p.id === id)) id = paginas[0].id;
      if (atual === id) return;
      const antes = atual; atual = id;
      paginas.forEach((p) => { const on = p.id === id; p.pg.hidden = !on; itens[p.id].classList.toggle('sel', on); itens[p.id].setAttribute('aria-selected', String(on)); });
      const pg = paginas.find((p) => p.id === id).pg;
      if (antes) { pg.classList.remove('entra'); void pg.offsetWidth; pg.classList.add('entra'); A.som.tocar('menu-abrir'); }
      A.cfg.v.cfgPagina = id; A.cfg.salvar();
      if (clique) { const c = el.closest('.conteudo'); if (c) c.scrollTo({ top: 0 }); }
    }
    if (ctx.lateralNaBolha && ctx.lateralNaBolha()) ctx.lateral(subnav); else el.insertBefore(subnav, el.children[1] || null);
    A.cfgPagina = mostrar; offs.push(() => { if (A.cfgPagina === mostrar) A.cfgPagina = null; });
    // (0.8.7) a página das integrações só aparece com alguma instalada, e se refaz quando você instala, muda ou tira uma
    const pintarInteg = () => {
      if (!A.integ || !A.integ.secoesConfig) return;
      const tem = A.integ.locais().length > 0;
      igCaixa.replaceChildren(...A.integ.secoesConfig());
      if (itens.integracoes) itens.integracoes.hidden = !tem;
      if (!tem && atual === 'integracoes') mostrar('customizacao');
    };
    pintarInteg(); offs.push(A.evt.on('integ:mudou', pintarInteg));
    { const ini = sub === 'apoio' ? 'apoio' : sub === 'integracoes' ? 'integracoes' : A.cfg.v.cfgPagina || 'customizacao'; mostrar(ini === 'integracoes' && itens.integracoes && itens.integracoes.hidden ? 'customizacao' : ini); }
    if (A.estudio) A.estudio.vestir(el);
    if (sub === 'perfil') setTimeout(() => el.querySelector('.cfg-pagina:not([hidden]) section') && el.querySelector('.cfg-pagina:not([hidden]) section').scrollIntoView({ block: 'start' }), 50);
    if (sub === 'apoio') setTimeout(() => { const s = el.querySelector('#sec-apoio'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 80);
    if (sub === 'controles') setTimeout(abrirControles, 120);
    // (0.8.7) a aba fica guardada ao sair (telas.js): voltar não remonta todas as páginas (era a travadinha ao abrir)
    return {
      limpar: () => offs.forEach((f) => f()),
      pausar() { if (subnav.parentNode && subnav.parentNode !== el) subnav.remove(); },
      retomar(sub2) {
        if (ctx.lateralNaBolha && ctx.lateralNaBolha()) ctx.lateral(subnav); else if (subnav.parentNode !== el) el.insertBefore(subnav, el.children[1] || null);
        A.cfgPagina = mostrar;
        if (sub2 === 'integracoes') { pintarInteg(); mostrar('integracoes'); }
        else if (sub2 === 'apoio') { mostrar('apoio'); setTimeout(() => { const s = el.querySelector('#sec-apoio'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 80); }
        else if (sub2 === 'controles') setTimeout(abrirControles, 120);
        else if (sub2 && paginas.some((p) => p.id === sub2)) mostrar(sub2);
      },
    };
  };
})();
