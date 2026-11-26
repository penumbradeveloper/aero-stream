// Aero Stream - (1.0.3) cartões de jogos no chat: Roblox (jogo, perfil, item/pacote, comunidade) e Steam (jogo e perfil). Criado por Ryan Victtor.
// Tudo que importa já no cartão (números, fotos, vídeos, conquistas, itens), sem precisar abrir o site. Leve: só a foto da vez carrega,
// vídeo e player de fora só no clique, imagens pelo servidor do Aero, nada de rolagem dentro do cartão.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const E = (A.embeds = A.embeds || {});
  const img = (u) => (u && A.ui && A.ui.imgSegura ? A.ui.imgSegura(u) : '');
  const en = () => !!(A.idioma && A.idioma() === 'en');
  const curto = (n) => { if (n == null) return ''; try { return new Intl.NumberFormat(en() ? 'en' : 'pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (_) { return String(n); } };
  const cheio = (n) => { if (n == null) return ''; try { return new Intl.NumberFormat(en() ? 'en' : 'pt-BR').format(n); } catch (_) { return String(n); } };
  const quando = (t) => { if (!t) return ''; try { return new Intl.DateTimeFormat(en() ? 'en' : 'pt-BR', { dateStyle: 'medium' }).format(new Date(t)); } catch (_) { return ''; } };
  const dia = (t) => { if (!t) return ''; try { return new Intl.DateTimeFormat(en() ? 'en' : 'pt-BR', { dateStyle: 'short' }).format(new Date(t)); } catch (_) { return ''; } };
  const quandoHora = (t) => { try { return new Intl.DateTimeFormat(en() ? 'en' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)); } catch (_) { return ''; } };
  const abrir = (url) => (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } A.ui.abrirFora(url); };
  const svg = (t, vb, corpo) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', vb); s.setAttribute('width', t); s.setAttribute('height', t); s.setAttribute('aria-hidden', 'true'); s.innerHTML = corpo; return s; };
  const foto = (u, cls, alt = '') => (u ? h('img', { class: cls, src: img(u), alt, loading: 'lazy', decoding: 'async', draggable: 'false' }) : h('span', { class: cls + ' vazio' }));
  const esqueleto = (cls) => {
    const c = h('div', { class: 'cx-midia emb-x emb-jg ' + cls + ' carregando' }, h('div', { class: 'ex-esq' }));
    c.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG') t.classList.add('sem-img'); }, true); // imagem que não existe (jogo sem capa): some, sem o ícone quebrado
    return c;
  };
  const ok = (sim) => (sim ? h('span', { class: 'ex-ok', title: T('Verificado', 'Verified') }, A.icone('check', 10)) : null);
  const est = (v, r, titulo) => (v == null || v === '' ? null : h('div', { class: 'jg-est', title: titulo || null }, h('b', null, v), h('small', null, r)));
  const chip = (t, cls = '') => (t ? h('span', { class: 'jg-chip ' + cls }, t) : null);
  // o fundo do cartão (a imagem do perfil/jogo) numa camada própria: fica por cima da película de vidro (senão ela deixa tudo esbranquiçado)
  const fundoDe = (url, cls = '') => { const f = h('div', { class: 'jg-fundo ' + cls, 'aria-hidden': 'true' }); f.style.setProperty('--jg-fundo', `url("${img(url)}")`); return f; };
  const naoAbrir = (el) => { el.addEventListener('click', (e) => e.stopPropagation()); return el; };
  // texto longo: corta em poucas linhas e o "mais" abre ali mesmo
  function textoLongo(t, linhas = 4) {
    const el = h('div', { class: 'jg-txt' }, t); el.style.setProperty('--linhas', linhas);
    const mais = h('button', { type: 'button', class: 'jg-mais', hidden: '' }, T('Mostrar mais', 'Show more'));
    mais.addEventListener('click', (e) => { e.stopPropagation(); const ab = el.classList.toggle('aberto'); mais.textContent = ab ? T('Mostrar menos', 'Show less') : T('Mostrar mais', 'Show more'); });
    requestAnimationFrame(() => { if (el.scrollHeight > el.clientHeight + 2) mais.hidden = false; });
    return h('div', { class: 'jg-txt-caixa' }, el, mais);
  }

  // ---------- palco de mídia: a foto/vídeo da vez grande, e a fileira de miniaturas empilhadas (a última com +N) ----------
  // itens: { tipo: 'foto', url } | { tipo: 'yt', id, capa } | { tipo: 'video', url, capa }
  function palcoMidia(itens, link) {
    const n = itens.length; if (!n) return null;
    let i = 0;
    const palco = naoAbrir(h('div', { class: 'jg-palco' }));
    // (1.0.4) a galeria leva tudo, na mesma ordem das miniaturas: fotos, trailers (Steam) e vídeos do YouTube (Roblox)
    const galeria = itens.map((x, k) => x.tipo === 'foto' ? { url: img(x.url), video: false, nome: 'foto-' + (k + 1) + '.jpg', link }
      : x.tipo === 'yt' ? { url: img(x.capa), capa: img(x.capa), yt: x.id, video: true, nome: x.titulo || 'video', link: 'https://www.youtube.com/watch?v=' + x.id }
      : { url: x.url, capa: x.capa ? img(x.capa) : '', video: true, nome: (x.titulo || 'video') + '.mp4', link });
    const mostrar = (k, tocar) => {
      i = (k + n) % n; const x = itens[i];
      palco.classList.remove('tocando');
      if (x.tipo === 'foto') {
        const b = h('button', { type: 'button', class: 'jg-palco-foto', title: T('Ampliar', 'Enlarge') }, h('img', { src: img(x.url), alt: '', decoding: 'async', draggable: 'false' }));
        b.addEventListener('click', () => { const g = galeria[i]; A.ui.verImagem(g.url, { nome: g.nome, link, galeria: { itens: galeria, i } }); });
        palco.replaceChildren(b);
      } else if (!tocar) {
        const b = h('button', { type: 'button', class: 'jg-palco-foto', title: T('Assistir aqui', 'Watch here') }, x.capa ? h('img', { src: img(x.capa), alt: '', decoding: 'async', draggable: 'false' }) : null, h('span', { class: 'ex-play' }, A.icone('play', 28)));
        b.addEventListener('click', () => mostrar(i, true));
        palco.replaceChildren(b);
      } else if (x.tipo === 'yt') {
        palco.classList.add('tocando');
        palco.replaceChildren(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&rel=0&playsinline=1`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', title: 'YouTube', referrerpolicy: 'strict-origin-when-cross-origin' }));
      } else if (E.player) {
        palco.classList.add('tocando');
        const pl = E.player(x.url, null), v = pl.querySelector('video'); if (v && x.capa) v.poster = img(x.capa);
        palco.replaceChildren(pl); const g = pl.querySelector('.mp-grande'); if (g) g.click();
      }
      if (seta1) { palco.append(seta1, seta2, cont); cont.textContent = (i + 1) + '/' + n; }
      minis.querySelectorAll('.jg-mini').forEach((m, j) => m.classList.toggle('on', j === i));
    };
    const seta = (dir) => h('button', { type: 'button', class: 'ex-seta ' + (dir < 0 ? 'esq' : 'dir'), 'aria-label': dir < 0 ? T('Anterior', 'Previous') : T('Próxima', 'Next'), onclick: (e) => { e.stopPropagation(); mostrar(i + dir); } }, A.icone(dir < 0 ? 'setaE' : 'setaD', 18));
    const seta1 = n > 1 ? seta(-1) : null, seta2 = n > 1 ? seta(1) : null, cont = h('span', { class: 'ex-cont' });
    const VISIVEIS = 5, minis = naoAbrir(h('div', { class: 'jg-minis' }));
    itens.slice(0, VISIVEIS).forEach((x, k) => {
      const resto = k === VISIVEIS - 1 && n > VISIVEIS ? n - VISIVEIS + 1 : 0;
      const capa = x.tipo === 'foto' ? x.url : x.capa;
      minis.append(h('button', { type: 'button', class: 'jg-mini' + (x.tipo !== 'foto' ? ' video' : ''), title: x.titulo || null, onclick: () => {
        if (resto) { const g = galeria[k]; A.ui.verImagem(g.url, { nome: g.nome, link, galeria: { itens: galeria, i: k } }); return; }
        mostrar(k);
      } }, capa ? h('img', { src: img(capa), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null,
      x.tipo !== 'foto' ? h('span', { class: 'jg-mini-play' }, A.icone('play', 14)) : null, resto ? h('span', { class: 'jg-mini-mais' }, '+' + resto) : null));
    });
    let x0 = null;
    palco.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    palco.addEventListener('pointerup', (e) => { if (x0 == null || palco.classList.contains('tocando')) { x0 = null; return; } const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { e.preventDefault(); mostrar(i + (dx < 0 ? 1 : -1)); } });
    mostrar(0);
    return h('div', { class: 'jg-midia' }, palco, n > 1 ? minis : null);
  }

  // ================= Roblox =================
  E.ehRoblox = (u) => /^https?:\/\/(?:www\.|web\.)?roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:games|users|catalog|bundles|groups|communities)\/\d{1,20}/i.test(u);
  const marcaRb = (t) => svg(t, '0 0 24 24', '<path fill="currentColor" d="M5.2 1.5 22.5 6.1l-4.7 17.4L.5 18.9zm8.3 7.9-3.9-1-1 3.8 3.9 1z"/>');
  const robux = (t) => svg(t, '0 0 24 24', '<path fill="currentColor" d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8zm0 2.6L5.2 8.1v7.8L12 19.8l6.8-3.9V8.1zm-3.6 5h7.2v5.6H8.4zm2.2 2v1.6h2.8v-1.6z"/>');
  const preco = (d) => (d.gratis ? h('span', { class: 'rb-preco' }, T('Grátis', 'Free'))
    : d.preco != null ? h('span', { class: 'rb-preco' }, robux(15), cheio(d.preco))
    : d.revenda ? h('span', { class: 'rb-preco revenda', title: T('Menor preço de revenda', 'Lowest resale price') }, robux(15), cheio(d.revenda))
    : h('span', { class: 'rb-preco fora' }, T('Fora de venda', 'Off sale')));
  const donoRb = (c) => (c && c.nome ? h('a', { class: 'rb-dono', href: c.grupo ? 'https://www.roblox.com/communities/' + c.id : 'https://www.roblox.com/users/' + c.id + '/profile', onclick: abrir(c.grupo ? 'https://www.roblox.com/communities/' + c.id : 'https://www.roblox.com/users/' + c.id + '/profile') },
    T('por ', 'by '), h('b', null, c.nome), ok(c.ok)) : null);
  const rodRb = (url, t) => h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaRb(12), 'Roblox' + (t ? ' · ' + t : ''));
  // Jogar: no PC abre o Roblox instalado (o Sober no Linux) direto no jogo; no celular/navegador, a página do jogo (o app do Roblox pega o link)
  function jogar(placeId, url) {
    const bt = h('button', { type: 'button', class: 'rb-jogar' }, A.icone('play', 16), T('Jogar', 'Play'));
    bt.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.aero && window.aero.jogarRoblox) { bt.disabled = true; const foi = await window.aero.jogarRoblox(placeId).catch(() => false); setTimeout(() => { bt.disabled = false; }, 2500); if (foi) return; }
      // sem o app: a página oficial de "Jogar" do site (a mesma do botão Play, que oferece baixar o Roblox)
      A.ui.abrirFora(/^\d{1,20}$/.test(String(placeId)) ? 'https://www.roblox.com/games/start?placeId=' + placeId : url);
    });
    return bt;
  }

  function jogoRb(d) {
    const midia = [...(d.videos || []).map((v) => ({ tipo: 'yt', id: v.yt, capa: 'https://i.ytimg.com/vi/' + v.yt + '/hqdefault.jpg', titulo: v.titulo })), ...(d.fotos || []).map((u) => ({ tipo: 'foto', url: u }))];
    const partes = [];
    partes.push(h('div', { class: 'rb-cab' }, foto(d.icone, 'rb-icone'),
      h('div', { class: 'rb-cab-txt' }, h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome), donoRb(d.dono),
        d.ativos != null ? h('span', { class: 'rb-ativos' }, h('i'), T(curto(d.ativos) + ' jogando agora', curto(d.ativos) + ' playing now')) : null),
      h('button', { type: 'button', class: 'ex-logo rb', title: T('Abrir no Roblox', 'Open on Roblox'), onclick: abrir(d.url) }, marcaRb(18))));
    const pm = palcoMidia(midia, d.url); if (pm) partes.push(pm);
    partes.push(h('div', { class: 'rb-acoes' }, jogar(d.placeId, d.url),
      h('button', { type: 'button', class: 'rb-bt', title: T('Passes e produtos do jogo', 'Game passes and products'), onclick: abrir(d.url + '#!/store') }, A.icone('estrela', 14), T('Loja', 'Store')),
      h('button', { type: 'button', class: 'rb-bt', onclick: abrir(d.url + '#!/game-instances') }, A.icone('grupo', 14), T('Servidores', 'Servers'))));
    const tot = (d.likes || 0) + (d.dislikes || 0), pct = tot ? Math.round((d.likes / tot) * 100) : null;
    if (pct != null) partes.push(h('div', { class: 'rb-votos', title: cheio(d.likes) + ' 👍 · ' + cheio(d.dislikes) + ' 👎' },
      h('div', { class: 'rb-votos-txt' }, h('b', null, pct + '%'), h('span', null, T('de aprovação', 'approval')), h('span', { class: 'rb-votos-n' }, '👍 ' + curto(d.likes) + '  ·  👎 ' + curto(d.dislikes))),
      h('div', { class: 'rb-barra' }, (() => { const b = h('i'); b.style.setProperty('--p', pct + '%'); return b; })())));
    partes.push(h('div', { class: 'jg-ests' }, est(curto(d.visitas), T('Visitas', 'Visits'), cheio(d.visitas)), est(curto(d.favoritos), T('Favoritos', 'Favorites'), cheio(d.favoritos)),
      est(d.max != null ? String(d.max) : '', T('Por servidor', 'Server size')), est(dia(d.criado), T('Criado', 'Created'), quando(d.criado)), est(dia(d.atualizado), T('Atualizado', 'Updated'), quando(d.atualizado))));
    const mat = d.maturidade && d.maturidade.nome;
    partes.push(h('div', { class: 'jg-chips' }, chip(d.genero, 'gen'), chip(d.subgenero, 'gen'), mat ? chip(T('Maturidade: ', 'Maturity: ') + mat + (d.maturidade.idade ? ' · ' + d.maturidade.idade + '+' : ''), 'mat') : null));
    if (d.eventos && d.eventos.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, A.icone('estrela', 13), T('Eventos', 'Events')),
      ...d.eventos.map((e) => { const ao = e.ini <= Date.now(); return h('div', { class: 'rb-evento' + (ao ? ' ao-vivo' : '') }, h('span', { class: 'rb-ev-quando' }, ao ? T('Agora', 'Live') : quandoHora(e.ini)), h('span', { class: 'rb-ev-nome' }, e.titulo)); })));
    if (d.texto) partes.push(textoLongo(d.texto, 4));
    if (d.badges && d.badges.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, A.icone('estrela', 13), T('Insígnias', 'Badges')),
      h('div', { class: 'rb-badges' }, ...d.badges.map((b) => h('div', { class: 'rb-badge', title: b.nome + (b.desc ? '\n' + b.desc : '') + (b.ganhos != null ? '\n' + T('Ganha por ', 'Won by ') + cheio(b.ganhos) : '') },
        foto(b.icone, 'rb-badge-ic'), h('span', null, b.nome), b.taxa ? h('small', null, b.taxa + '%') : null)))));
    partes.push(rodRb(d.url, T('Experiência', 'Experience')));
    return partes;
  }
  function perfilRb(d, cartao) {
    cartao.classList.toggle('com-fundo', !!d.fundo);
    const partes = [d.fundo ? fundoDe(d.fundo, 'rb') : null, h('div', { class: 'rb-vitrine' },
      h('div', { class: 'rb-vitrine-txt' }, foto(d.rosto, 'rb-rosto'),
        h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome, ok(d.ok), d.premium ? h('span', { class: 'rb-premium', title: 'Premium' }, '◆') : null), h('small', { class: 'rb-nick' }, '@' + d.nick),
        d.banido ? chip(T('Conta banida', 'Banned account'), 'mat') : null),
      d.corpo ? h('button', { type: 'button', class: 'rb-corpo', title: T('Ver o avatar', 'View avatar'), onclick: (e) => { e.stopPropagation(); A.ui.verImagem(img(d.corpo), { nome: d.nick + '.png', link: d.url }); } }, h('img', { src: img(d.corpo), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })) : null,
      h('button', { type: 'button', class: 'ex-logo rb', title: T('Abrir no Roblox', 'Open on Roblox'), onclick: abrir(d.url) }, marcaRb(18)))];
    partes.push(h('div', { class: 'jg-ests' }, d.amigos ? est(curto(d.amigos), T('Amigos', 'Friends')) : null, est(curto(d.seguidores), T('Seguidores', 'Followers'), cheio(d.seguidores)), est(curto(d.seguindo), T('Seguindo', 'Following')), est(d.criado ? String(new Date(d.criado).getFullYear()) : '', T('Desde', 'Since'), quando(d.criado))));
    if (d.bio) partes.push(textoLongo(d.bio, 3));
    if (d.itens && d.itens.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, A.icone('pessoa', 13), T('Vestindo agora', 'Currently wearing')),
      h('div', { class: 'rb-itens' }, ...d.itens.map((x) => h('a', { class: 'rb-item', href: x.url, title: x.nome || null, onclick: abrir(x.url) }, foto(x.foto, 'rb-item-foto'), x.nome ? h('span', null, x.nome) : null)))));
    partes.push(rodRb(d.url, T('Perfil', 'Profile')));
    return partes;
  }
  function itemRb(d) {
    const partes = [h('div', { class: 'rb-item-cab' },
      h('button', { type: 'button', class: 'rb-vitrine-item', title: T('Ampliar', 'Enlarge'), onclick: (e) => { e.stopPropagation(); if (d.foto) A.ui.verImagem(img(d.foto), { nome: 'item.png', link: d.url }); } }, d.foto ? h('img', { src: img(d.foto), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null),
      h('div', { class: 'rb-item-info' },
        h('div', { class: 'jg-chips' }, chip(en() ? d.tipoItemEn : d.tipoItem), d.limitado ? chip(d.unico ? 'Limited U' : 'Limited', 'lim') : null),
        h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome), donoRb(d.dono), preco(d),
        h('div', { class: 'rb-flags' }, h('span', { class: d.trocavel ? 'sim' : 'nao' }, A.icone(d.trocavel ? 'check' : 'cadeado', 12), d.trocavel ? T('Trocável', 'Tradable') : T('Não trocável', 'Not tradable')),
          h('span', { class: d.aVenda ? 'sim' : 'nao' }, A.icone(d.aVenda ? 'check' : 'cadeado', 12), d.aVenda ? T('À venda', 'On sale') : T('Fora de venda', 'Off sale')))),
      h('button', { type: 'button', class: 'ex-logo rb', title: T('Abrir no Roblox', 'Open on Roblox'), onclick: abrir(d.url) }, marcaRb(18)))];
    partes.push(h('div', { class: 'jg-ests' }, est(curto(d.favoritos), T('Favoritos', 'Favorites'), cheio(d.favoritos)), d.total ? est(cheio(d.total), T('Unidades', 'Copies')) : null,
      d.restam ? est(cheio(d.restam), T('Restam', 'Remaining')) : null, est(dia(d.criado), T('Criado', 'Created'), quando(d.criado)), d.atualizado && d.atualizado !== d.criado ? est(dia(d.atualizado), T('Atualizado', 'Updated'), quando(d.atualizado)) : null));
    if (d.texto) partes.push(textoLongo(d.texto, 3));
    if (d.pecas && d.pecas.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, T('No pacote', 'In this bundle')),
      h('div', { class: 'rb-itens' }, ...d.pecas.map((x) => h('div', { class: 'rb-item', title: x.nome }, foto(x.foto, 'rb-item-foto'), h('span', null, x.nome))))));
    partes.push(rodRb(d.url, d.pacote ? T('Pacote', 'Bundle') : T('Item', 'Item')));
    return partes;
  }
  function grupoRb(d, cartao) {
    if (d.icone) cartao.style.setProperty('--rb-fundo', `url("${img(d.icone)}")`);
    const partes = [h('div', { class: 'rb-banner' + (d.icone ? ' com-icone' : '') }),
      h('div', { class: 'rb-grupo-cab' }, foto(d.icone, 'rb-icone grande'),
        h('div', { class: 'rb-cab-txt' }, h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome, ok(d.ok)),
          d.dono && d.dono.nome ? h('a', { class: 'rb-dono', href: 'https://www.roblox.com/users/' + d.dono.id + '/profile', onclick: abrir('https://www.roblox.com/users/' + d.dono.id + '/profile') }, T('Dono: ', 'Owner: '), h('b', null, d.dono.nome), ok(d.dono.ok)) : null),
        h('button', { type: 'button', class: 'ex-logo rb', title: T('Abrir no Roblox', 'Open on Roblox'), onclick: abrir(d.url) }, marcaRb(18)))];
    partes.push(h('div', { class: 'jg-ests' }, est(curto(d.membros), T('Membros', 'Members'), cheio(d.membros)), est(d.aberto ? T('Aberta', 'Open') : T('Com pedido', 'Request'), T('Entrada', 'Joining'))));
    if (d.aviso) partes.push(h('div', { class: 'rb-aviso' }, A.icone('chat', 13), d.aviso));
    if (d.texto) partes.push(textoLongo(d.texto, 4));
    if (d.jogos && d.jogos.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, A.icone('controle', 13), T('Experiências', 'Experiences')),
      ...d.jogos.map((j) => h('a', { class: 'rb-jogo-lin', href: j.url, onclick: abrir(j.url) }, foto(j.icone, 'rb-jogo-ic'), h('span', null, j.nome), j.visitas != null ? h('small', null, curto(j.visitas) + T(' visitas', ' visits')) : null))));
    partes.push(rodRb(d.url, T('Comunidade', 'Community')));
    return partes;
  }
  E.roblox = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = esqueleto('emb-rb'), el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      if (!d || !/^roblox-/.test(d.tipo || '')) { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      const partes = d.tipo === 'roblox-jogo' ? jogoRb(d) : d.tipo === 'roblox-perfil' ? perfilRb(d, cartao) : d.tipo === 'roblox-item' ? itemRb(d) : grupoRb(d, cartao);
      cartao.classList.remove('carregando'); cartao.classList.add(d.tipo);
      cartao.replaceChildren(...partes.filter(Boolean));
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.jg-palco')) menu(e); });
      grudar();
    });
    return el;
  };

  // ================= Steam =================
  E.ehSteam = (u) => /^https?:\/\/(?:store\.steampowered\.com\/app\/\d{1,10}|steamcommunity\.com\/app\/\d{1,10}|steamcommunity\.com\/(?:id\/[A-Za-z0-9_-]{2,64}|profiles\/\d{17}))/i.test(u);
  const srv = () => (A.api && A.api.servidor) || '';
  const sv = (u) => srv() + '/api/sv?u=' + encodeURIComponent(u);
  const marcaSt = (t) => svg(t, '0 0 24 24', '<path fill="currentColor" d="M11.98 0C5.68 0 .52 4.86.04 11.03l6.44 2.66a3.4 3.4 0 0 1 1.92-.59l2.87-4.15v-.06a4.53 4.53 0 1 1 4.53 4.53h-.1l-4.08 2.92.01.17a3.4 3.4 0 0 1-6.73.68L.32 15.3A12 12 0 1 0 11.98 0zM7.54 18.2l-1.47-.6a2.55 2.55 0 1 0 1.4-3.5l1.52.63a1.88 1.88 0 1 1-1.45 3.47zm11.4-9.27a3.02 3.02 0 1 0-6.04 0 3.02 3.02 0 0 0 6.04 0zm-5.28 0a2.27 2.27 0 1 1 4.54 0 2.27 2.27 0 0 1-4.54 0z"/>');
  const rodSt = (url, t) => h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaSt(12), 'Steam' + (t ? ' · ' + t : ''));
  const logoSt = (url) => h('button', { type: 'button', class: 'ex-logo st', title: T('Abrir na Steam', 'Open on Steam'), onclick: abrir(url) }, marcaSt(18));
  const PLAT = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
  function analise(a, titulo) {
    if (!a || !a.nome) return null;
    return h('div', { class: 'st-analise ' + (a.classe || 'pos'), title: a.pct != null && a.total != null ? T(a.pct + '% de ' + cheio(a.total) + ' análises são positivas', a.pct + '% of ' + cheio(a.total) + ' reviews are positive') : null },
      h('small', null, titulo), h('b', null, a.nome), a.total != null ? h('span', null, (a.pct != null ? a.pct + '% · ' : '') + cheio(a.total) + T(' análises', ' reviews')) : null,
      a.pct != null ? (() => { const b = h('i'); b.style.setProperty('--p', a.pct + '%'); return h('div', { class: 'st-barra' }, b); })() : null);
  }
  function jogoSt(d, cartao) {
    cartao.classList.toggle('com-fundo', !!d.fundo);
    const midia = [...(d.videos || []).map((v) => ({ tipo: 'video', url: sv('https://cdn.akamai.steamstatic.com/steam/apps/' + v.id + '/movie480.mp4'), capa: v.capa, titulo: v.nome })), ...(d.fotos || []).map((u) => ({ tipo: 'foto', url: u }))];
    const partes = [d.fundo ? fundoDe(d.fundo, 'st-jogo') : null, h('div', { class: 'st-cab' }, d.capa ? h('img', { class: 'st-capsula', src: img(d.capa), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null,
      h('div', { class: 'rb-cab-txt' }, h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome),
        d.devs && d.devs.length ? h('span', { class: 'rb-dono' }, T('por ', 'by '), h('b', null, d.devs.join(', '))) : null,
        h('span', { class: 'st-plat' }, ...(d.plataformas || []).map((p) => h('span', null, PLAT[p] || p)), d.controle ? h('span', null, A.icone('controle', 12), d.controle === 'total' ? T('Controle', 'Controller') : T('Controle parcial', 'Partial controller')) : null)),
      logoSt(d.url))];
    const pm = palcoMidia(midia, d.url); if (pm) partes.push(pm);
    // preço e os botões
    const p = d.preco, precoEl = d.embreve ? h('span', { class: 'st-preco' }, T('Em breve', 'Coming soon')) : d.gratis ? h('span', { class: 'st-preco' }, T('Grátis para jogar', 'Free to play')) : p ? h('span', { class: 'st-preco' }, p.desconto ? h('span', { class: 'st-desc' }, '-' + p.desconto + '%') : null, h('span', { class: 'st-valores' }, p.antes ? h('s', null, p.antes) : null, h('b', null, p.final))) : null;
    const app = h('button', { type: 'button', class: 'rb-jogar st', title: T('Abre o jogo no app da Steam', 'Opens the game in the Steam app') }, marcaSt(16), T('Abrir na Steam', 'Open in Steam'));
    app.addEventListener('click', async (e) => { e.stopPropagation(); if (window.aero && window.aero.abrirSteam) { app.disabled = true; const foi = await window.aero.abrirSteam(d.id).catch(() => false); setTimeout(() => { app.disabled = false; }, 2500); if (foi) return; } A.ui.abrirFora(d.url); });
    partes.push(h('div', { class: 'rb-acoes st-compra' }, precoEl, app));
    const an = h('div', { class: 'st-analises' }, analise(d.analises, T('Análises', 'Reviews')), analise(d.recentes, T('Últimos 30 dias', 'Last 30 days')));
    if (an.children.length) partes.push(an);
    partes.push(h('div', { class: 'jg-ests' }, est(d.lancamento, T('Lançamento', 'Release')), d.meta ? est(String(d.meta), 'Metacritic') : null, est(d.conquistas != null ? cheio(d.conquistas) : '', T('Conquistas', 'Achievements')), est(curto(d.recomendacoes), T('Recomendações', 'Recommendations'), cheio(d.recomendacoes))));
    const quem = [d.devs && d.devs.length ? h('div', null, h('small', null, T('Desenvolvedora', 'Developer')), h('b', null, d.devs.join(', '))) : null, d.pubs && d.pubs.length ? h('div', null, h('small', null, T('Distribuidora', 'Publisher')), h('b', null, d.pubs.join(', '))) : null].filter(Boolean);
    if (quem.length) partes.push(h('div', { class: 'st-quem' }, ...quem));
    const tags = (d.tags && d.tags.length ? d.tags : d.generos) || [];
    if (tags.length) partes.push(h('div', { class: 'jg-chips' }, ...tags.map((t) => chip(t)), d.idade ? chip(d.idade + '+', 'mat') : null));
    if (d.texto) partes.push(textoLongo(d.texto, 3));
    partes.push(rodSt(d.url, T('Loja', 'Store')));
    return partes;
  }
  function perfilSt(d, cartao) {
    cartao.classList.add('st-escuro');
    cartao.classList.toggle('com-fundo', !!d.fundo);
    const camada = d.fundo || d.fundoVideo ? fundoDe(d.fundo || '', 'st-perfil') : null;
    // fundo animado: só toca com o mouse em cima (e nunca no modo leve), e para ao sair
    if (camada && d.fundoVideo && !/lite/.test(document.documentElement.dataset.visual || '') && matchMedia('(hover: hover)').matches) {
      let v = null;
      cartao.addEventListener('mouseenter', () => { if (!v) { v = h('video', { src: sv(d.fundoVideo), muted: '', loop: '', playsinline: '', preload: 'none' }); v.muted = true; camada.prepend(v); } v.play().catch(() => {}); });
      cartao.addEventListener('mouseleave', () => { if (v) v.pause(); });
    }
    const av = h('div', { class: 'st-av' + (d.moldura ? ' com-moldura' : '') + ' ' + (d.online || 'off') }, d.avatar ? h('img', { src: img(d.avatar), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null, d.moldura ? h('img', { class: 'st-moldura', src: img(d.moldura), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null);
    const partes = [camada, h('div', { class: 'st-perfil-cab' }, av,
      h('div', { class: 'rb-cab-txt' }, h('a', { class: 'rb-nome', href: d.url, onclick: abrir(d.url) }, d.nome),
        d.nomeReal || d.local ? h('span', { class: 'st-real' }, d.bandeira ? h('img', { src: img(d.bandeira), alt: '', class: 'st-band' }) : null, [d.nomeReal, d.local].filter(Boolean).join(' · ')) : null,
        d.jogando ? h('span', { class: 'st-status jogo' }, T('Jogando ', 'Playing '), h('b', null, d.jogando)) : d.status ? h('span', { class: 'st-status ' + (d.online || 'off') }, d.status) : null),
      d.nivel != null ? h('div', { class: 'st-nivel', title: T('Nível Steam', 'Steam level') }, h('small', null, T('Nível', 'Level')), h('b', null, String(d.nivel))) : null,
      logoSt(d.url))];
    if (d.privado) { partes.push(h('div', { class: 'ex-privado' }, A.icone('cadeado', 15), T('Este perfil é privado', 'This profile is private'))); partes.push(rodSt(d.url, T('Perfil', 'Profile'))); return partes; }
    const c = d.contagens || {};
    partes.push(h('div', { class: 'jg-ests' }, est(c.jogos != null ? cheio(c.jogos) : '', T('Jogos', 'Games')), est(c.amigos != null ? cheio(c.amigos) : '', T('Amigos', 'Friends')), est(c.insignias != null ? cheio(c.insignias) : '', T('Insígnias', 'Badges')),
      est(c.capturas != null ? cheio(c.capturas) : '', T('Capturas', 'Screenshots')), est(c.analises != null ? cheio(c.analises) : '', T('Análises', 'Reviews'))));
    if (d.bio) partes.push(textoLongo(d.bio, 3));
    for (const v of d.vitrines || []) {
      const tit = v.titulo || v.nome || '';
      if (v.tipo === 'favoritegame' || v.tipo === 'favoritegroup') {
        const it = v.itens[0];
        partes.push(h('div', { class: 'jg-secao st-vitrine' }, tit && v.titulo ? h('b', { class: 'jg-tit' }, A.icone('estrela', 13), v.titulo) : null,
          h('a', { class: 'st-fav', href: (it && it.url) || d.url, onclick: abrir((it && it.url) || d.url) }, it ? h('img', { class: v.tipo === 'favoritegroup' ? 'st-fav-grupo' : 'st-fav-cap', src: img(it.img), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null,
            h('div', { class: 'st-fav-txt' }, v.nome ? h('b', null, v.nome) : null, h('div', { class: 'st-fav-stats' }, ...v.stats.map((s) => h('span', null, h('b', null, s.v), ' ' + s.r)))))));
        continue;
      }
      partes.push(h('div', { class: 'jg-secao st-vitrine' }, tit ? h('b', { class: 'jg-tit' }, A.icone('estrela', 13), tit) : null,
        v.itens.length ? h('div', { class: 'st-vit-itens ' + v.tipo }, ...v.itens.map((x) => h(x.url ? 'a' : 'span', { class: 'st-vit-item', href: x.url || null, title: x.nome || null, onclick: x.url ? abrir(x.url) : null }, h('img', { src: img(x.img), alt: x.nome || '', loading: 'lazy', decoding: 'async', draggable: 'false' })))) : null,
        v.texto ? h('div', { class: 'jg-txt' }, v.texto) : null,
        v.stats.length ? h('div', { class: 'st-fav-stats' }, ...v.stats.map((s) => h('span', null, h('b', null, s.v), ' ' + s.r))) : null));
    }
    if (d.recentes && d.recentes.length) partes.push(h('div', { class: 'jg-secao' }, h('b', { class: 'jg-tit' }, A.icone('controle', 13), T('Atividade recente', 'Recent activity')),
      ...d.recentes.map((g) => h('a', { class: 'st-recente', href: g.url || d.url, onclick: abrir(g.url || d.url) }, g.capa ? h('img', { class: 'st-rec-cap', src: img(g.capa), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null,
        h('div', { class: 'st-rec-txt' }, h('b', null, g.nome), g.info ? h('small', null, g.info.replace(/\s*\n\s*/g, ' · ')) : null,
          g.conq && g.conq.de ? (() => { const b = h('i'); b.style.setProperty('--p', Math.round((g.conq.tem / g.conq.de) * 100) + '%'); return h('div', { class: 'st-conq' }, h('div', { class: 'st-barra' }, b), h('span', null, g.conq.tem + '/' + g.conq.de)); })() : null)))));
    partes.push(rodSt(d.url, T('Perfil', 'Profile')));
    return partes;
  }
  E.steam = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = esqueleto('emb-st'), el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      if (!d || !/^steam-/.test(d.tipo || '')) { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      const partes = d.tipo === 'steam-jogo' ? jogoSt(d, cartao) : perfilSt(d, cartao);
      cartao.classList.remove('carregando'); cartao.classList.add(d.tipo);
      cartao.replaceChildren(...partes.filter(Boolean));
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.jg-palco')) menu(e); });
      grudar();
    });
    return el;
  };
  E.jogosPalco = palcoMidia; // a Steam usa o mesmo palco
  E.jogosUtil = { img, curto, cheio, quando, dia, abrir, svg, foto, esqueleto, ok, est, chip, textoLongo, naoAbrir };
})();
