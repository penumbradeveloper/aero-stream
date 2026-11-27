// Aero Stream - (1.0.3) cartões de TikTok e Instagram no chat; (1.0.6) Pinterest, o post de verdade do Instagram e baixar. Criado por Ryan Victtor.
// TikTok: o vídeo toca no player do Aero (só baixa quando aperta play), post de fotos vira carrossel com a música de fundo, e aparecem
// curtidas, comentários, salvos, compartilhamentos, views e a música; o perfil mostra seguidores, seguindo, curtidas e vídeos
// (conta privada: só o nome e a foto). Instagram: o cartão do Aero, e o player oficial do Instagram abre aqui mesmo só no clique.
// Leve: nada de vídeo, música ou player de fora carrega antes do clique; fotos passam pelo servidor do Aero.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const E = (A.embeds = A.embeds || {});
  const img = (u) => (u && A.ui && A.ui.imgSegura ? A.ui.imgSegura(u) : '');
  const srv = () => (A.api && A.api.servidor) || '';
  const en = () => !!(A.idioma && A.idioma() === 'en');
  const curto = (n) => { if (n == null) return ''; try { return new Intl.NumberFormat(en() ? 'en' : 'pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (_) { return String(n); } };
  const svg = (t, vb, corpo) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', vb); s.setAttribute('width', t); s.setAttribute('height', t); s.setAttribute('aria-hidden', 'true'); s.innerHTML = corpo; return s; };
  const marcaTT = (t) => svg(t, '0 0 24 24', '<path fill="#25F4EE" d="M9.4 9.6v-.9a6.8 6.8 0 0 0-1-.1 6.9 6.9 0 0 0-3.9 12.6 6.9 6.9 0 0 1 4.9-11.6z"/><path fill="#25F4EE" d="M9.6 19.8a3.1 3.1 0 0 0 3.1-3V2h2.8a5.3 5.3 0 0 1-.1-1h-3.8v15a3.1 3.1 0 0 1-3.1 3 3.1 3.1 0 0 1-1.4-.4 3.1 3.1 0 0 0 2.5 1.2zM20.6 6.9V6a5.2 5.2 0 0 1-2.9-.9 5.3 5.3 0 0 0 2.9 1.8z"/><path fill="#FE2C55" d="M17.7 5.1a5.2 5.2 0 0 1-1.3-3.5h-1a5.3 5.3 0 0 0 2.3 3.5zM8.4 12.6a3.1 3.1 0 0 0-1.4 5.9 3.1 3.1 0 0 1 2.5-4.9 3.1 3.1 0 0 1 .9.1V9.9a6.8 6.8 0 0 0-.9-.1h-.2v2.9a3.1 3.1 0 0 0-.9-.1z"/><path fill="#FE2C55" d="M20.6 6.9v2.9a8.8 8.8 0 0 1-5.1-1.7v7.7a6.9 6.9 0 0 1-10.8 5.6A6.9 6.9 0 0 0 16.6 16V8.4a8.8 8.8 0 0 0 5.1 1.6V6.9a5.2 5.2 0 0 1-1.1 0z"/><path fill="#fff" d="M15.5 15.8V8.1a8.8 8.8 0 0 0 5.1 1.7V6.9a5.3 5.3 0 0 1-2.9-1.8 5.3 5.3 0 0 1-2.3-3.5h-2.8v15a3.1 3.1 0 0 1-5.6 1.8 3.1 3.1 0 0 1 1.4-5.9 3.1 3.1 0 0 1 .9.1V9.7a6.9 6.9 0 0 0-4.9 11.6 6.9 6.9 0 0 0 10.8-5.6z"/>');
  const marcaIG = (t) => svg(t, '0 0 24 24', '<defs><radialGradient id="igg" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#igg)"/><rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.2" cy="7.8" r="1" fill="#fff"/>');
  const abrir = (url) => (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } A.ui.abrirFora(url); };
  const num = (ic, v, tit) => (v == null ? null : h('span', { class: 'ex-num', title: tit }, A.icone(ic, 15), h('b', null, curto(v))));
  const quando = (t) => { if (!t) return ''; try { return new Intl.DateTimeFormat(en() ? 'en' : 'pt-BR', { dateStyle: 'medium' }).format(new Date(t)); } catch (_) { return ''; } };
  const avatar = (u, cls) => (u ? h('img', { class: cls, src: img(u), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : h('span', { class: cls }));
  const esqueleto = (cls) => h('div', { class: 'cx-midia emb-x ' + cls + ' carregando' }, h('div', { class: 'ex-esq' }));

  // (1.0.6) baixar: o botão fica girando enquanto baixa (vídeo grande leva uns segundos) e não deixa clicar duas vezes
  const baixarUm = (url, nome) => A.ui.baixar(url, nome);
  const baixarVarios = async (lista) => { for (const x of lista.slice(0, 35)) await A.ui.baixar(x.url, x.nome); };
  function botaoBaixar(tit, f) {
    const b = h('button', { type: 'button', class: 'ex-baixar', title: tit, 'aria-label': tit }, A.icone('download', 15), h('span', null, T('Baixar', 'Download')));
    b.addEventListener('click', async (e) => {
      e.stopPropagation(); if (b.classList.contains('baixando')) return;
      b.classList.add('baixando'); b.disabled = true;
      try { await f(); } finally { b.classList.remove('baixando'); b.disabled = false; }
    });
    return b;
  }
  // (1.0.6) fotos e vídeos misturados (Instagram e Pinterest): setas, bolinhas, arrastar; foto abre a galeria do Aero e o vídeo toca ali mesmo.
  // itens: { tipo: 'foto' | 'video', ver (a do cartão), grande (a da galeria / download), capa, src (o vídeo), w, h, dur, nome }
  function galeriaMista(itens, link) {
    const n = itens.length; let i = 0;
    const p0 = itens[0] || {}, ar = p0.w && p0.h ? Math.max(0.5, Math.min(1.9, p0.w / p0.h)) : 3 / 4;
    const faixa = h('div', { class: 'ex-faixa' });
    const gal = itens.map((x) => ({ url: x.tipo === 'video' ? x.src : img(x.grande || x.ver), video: x.tipo === 'video', nome: x.nome, link }));
    const parar = () => faixa.querySelectorAll('video').forEach((v) => v.pause());
    itens.forEach((x, k) => {
      const fig = (u) => h('img', { src: k < 2 ? img(u) : '', 'data-src': img(u), alt: '', decoding: 'async', draggable: 'false' });
      if (x.tipo !== 'video') { faixa.append(h('button', { type: 'button', class: 'ex-foto', tabindex: '-1', onclick: (e) => { e.stopPropagation(); A.ui.verImagem(gal[k].url, { nome: x.nome, link, galeria: { itens: gal, i: k } }); } }, fig(x.ver))); return; }
      const slide = h('div', { class: 'ex-foto ex-vslide' });
      const capa = h('button', { type: 'button', class: 'ex-capa', title: T('Assistir aqui', 'Watch here') }, x.capa ? fig(x.capa) : null,
        h('span', { class: 'ex-play' }, A.icone('play', 30)), x.dur ? h('span', { class: 'ex-dur' }, Math.floor(x.dur / 60) + ':' + String(x.dur % 60).padStart(2, '0')) : null);
      capa.addEventListener('click', (e) => {
        e.stopPropagation(); pararSom(); parar();
        if (E.player) { const pl = E.player(x.src, null), vv = pl.querySelector('video'); if (vv && x.capa) vv.poster = img(x.capa); if (vv) vv.loop = true; slide.replaceChildren(pl); const b = pl.querySelector('.mp-grande'); if (b) b.click(); }
        else slide.replaceChildren(h('video', { src: x.src, controls: '', autoplay: '', playsinline: '', loop: '', poster: x.capa ? img(x.capa) : null }));
        slide.classList.add('tocando');
      });
      slide.append(capa); faixa.append(slide);
    });
    const pontos = h('div', { class: 'ex-pontos' }), cont = h('span', { class: 'ex-cont' });
    const ir = (k) => {
      if (k !== i) parar();
      i = (k + n) % n; faixa.style.transform = `translateX(${-i * 100}%)`;
      for (const j of [i, i + 1]) { const im = faixa.children[j] && faixa.children[j].querySelector('img[data-src]'); if (im && !im.getAttribute('src')) im.src = im.dataset.src; }
      pontos.querySelectorAll('i').forEach((p, j) => p.classList.toggle('on', j === i)); cont.textContent = (i + 1) + '/' + n;
    };
    for (let k = 0; k < Math.min(n, 12); k++) pontos.append(h('i'));
    const seta = (dir) => h('button', { type: 'button', class: 'ex-seta ' + (dir < 0 ? 'esq' : 'dir'), 'aria-label': dir < 0 ? T('Anterior', 'Previous') : T('Próxima', 'Next'), onclick: (e) => { e.stopPropagation(); ir(i + dir); } }, A.icone(dir < 0 ? 'setaE' : 'setaD', 18));
    const palco = h('div', { class: 'ex-palco ex-carrossel' + (ar < 1 ? ' em-pe' : '') }, faixa, n > 1 ? seta(-1) : null, n > 1 ? seta(1) : null, n > 1 ? pontos : null, n > 1 ? cont : null);
    palco.style.setProperty('--ar', ar.toFixed(4));
    let x0 = null;
    palco.addEventListener('pointerdown', (e) => { x0 = e.target.closest('.mp, video') ? null : e.clientX; });
    palco.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (n > 1 && Math.abs(dx) > 40) { e.stopPropagation(); ir(i + (dx < 0 ? 1 : -1)); } });
    palco.addEventListener('click', (e) => e.stopPropagation());
    ir(0);
    palco.atual = () => i;
    return palco;
  }

  // um som por vez (a música do post de fotos): para ao entrar em chamada ou quando outro trecho começa
  let somAtual = null;
  const pararSom = () => { if (somAtual) { somAtual.a.pause(); somAtual.fim(); somAtual = null; } };
  if (A.evt) { A.evt.on('chamada:entrou', pararSom); A.evt.on('musica:tocar', pararSom); }

  // ---------- TikTok ----------
  E.ehTiktok = (u) => /^https?:\/\/(?:(?:www|m)\.)?tiktok\.com\/(?:@[\w.-]{1,40}(?:\/(?:video|photo)\/\d{8,25})?\/?(?:[?#]|$)|t\/[A-Za-z0-9]{5,20})|^https?:\/\/(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]{5,20}/i.test(u);
  function quemTT(a, url) {
    return h('div', { class: 'ex-topo' }, avatar(a.av, 'ex-av'),
      h('a', { class: 'ex-quem', href: 'https://www.tiktok.com/@' + a.nick, onclick: abrir('https://www.tiktok.com/@' + a.nick) },
        h('b', null, a.nome || a.nick, a.ok ? h('span', { class: 'ex-ok', title: T('Verificado', 'Verified') }, A.icone('check', 10)) : null), h('small', null, '@' + a.nick)),
      h('button', { type: 'button', class: 'ex-logo tt', title: T('Abrir na TikTok', 'Open on TikTok'), onclick: abrir(url) }, marcaTT(18)));
  }
  function textoTT(t) { // as #hashtags e @menções em destaque
    const el = h('div', { class: 'ex-txt' });
    for (const p of String(t).split(/([#@][\p{L}\p{N}_.]{1,60})/u)) el.append(/^[#@]/.test(p) ? h('span', { class: 'ex-tag' }, p) : p);
    return el;
  }
  function videoTT(d) {
    const v = d.video || {}, ar = v.w && v.h ? Math.max(0.5, Math.min(1.9, v.w / v.h)) : 9 / 16;
    const palco = h('div', { class: 'ex-palco' + (ar < 1 ? ' em-pe' : '') }); palco.style.setProperty('--ar', ar.toFixed(4));
    const capa = h('button', { type: 'button', class: 'ex-capa', title: T('Assistir aqui', 'Watch here') },
      v.capa ? h('img', { src: img(v.capa), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : null,
      h('span', { class: 'ex-play' }, A.icone('play', 30)), v.dur ? h('span', { class: 'ex-dur' }, Math.floor(v.dur / 60) + ':' + String(v.dur % 60).padStart(2, '0')) : null);
    capa.addEventListener('click', (e) => {
      e.stopPropagation(); pararSom();
      const src = srv() + '/api/tt?v=' + encodeURIComponent(d.id);
      if (E.player) { const pl = E.player(src, null), vv = pl.querySelector('video'); if (vv && v.capa) vv.poster = img(v.capa); if (vv) vv.loop = true; palco.replaceChildren(pl); palco.classList.add('tocando'); const b = pl.querySelector('.mp-grande'); if (b) b.click(); }
      else { const vv = h('video', { src, controls: '', autoplay: '', playsinline: '', loop: '', poster: v.capa ? img(v.capa) : null }); palco.replaceChildren(vv); palco.classList.add('tocando'); }
    });
    palco.append(capa);
    palco.addEventListener('click', (e) => e.stopPropagation());
    return palco;
  }
  // post de fotos: carrossel (setas, bolinhas, arrastar) com a música de fundo; tocar passa as fotos sozinho, como na TikTok
  function fotosTT(d) {
    const fs = d.fotos || [], n = fs.length; let i = 0, timer = 0;
    const ar = fs[0] && fs[0].w && fs[0].h ? Math.max(0.56, Math.min(1.9, fs[0].w / fs[0].h)) : 3 / 4;
    const faixa = h('div', { class: 'ex-faixa' });
    const itens = fs.map((f, k) => ({ url: img(f.url), video: false, nome: 'tiktok-' + (k + 1) + '.jpg', link: d.url }));
    fs.forEach((f, k) => faixa.append(h('button', { type: 'button', class: 'ex-foto', tabindex: '-1', onclick: (e) => { e.stopPropagation(); A.ui.verImagem(itens[k].url, { nome: itens[k].nome, link: d.url, galeria: { itens, i: k } }); } },
      h('img', { src: k < 2 ? img(f.url) : '', 'data-src': img(f.url), alt: '', decoding: 'async', draggable: 'false' }))));
    const pontos = h('div', { class: 'ex-pontos' }), cont = h('span', { class: 'ex-cont' });
    const ir = (k) => {
      i = (k + n) % n; faixa.style.transform = `translateX(${-i * 100}%)`;
      for (const j of [i, i + 1]) { const im = faixa.children[j] && faixa.children[j].firstChild; if (im && !im.getAttribute('src')) im.src = im.dataset.src; } // só carrega a foto da vez e a próxima
      pontos.querySelectorAll('i').forEach((p, j) => p.classList.toggle('on', j === i)); cont.textContent = (i + 1) + '/' + n;
    };
    for (let k = 0; k < Math.min(n, 12); k++) pontos.append(h('i'));
    const seta = (dir) => h('button', { type: 'button', class: 'ex-seta ' + (dir < 0 ? 'esq' : 'dir'), 'aria-label': dir < 0 ? T('Anterior', 'Previous') : T('Próxima', 'Next'), onclick: (e) => { e.stopPropagation(); ir(i + dir); } }, A.icone(dir < 0 ? 'setaE' : 'setaD', 18));
    const palco = h('div', { class: 'ex-palco ex-carrossel' }, faixa, n > 1 ? seta(-1) : null, n > 1 ? seta(1) : null, n > 1 ? pontos : null, n > 1 ? cont : null);
    palco.style.setProperty('--ar', ar.toFixed(4));
    let x0 = null; // arrastar com o dedo/mouse
    palco.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    palco.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { e.stopPropagation(); ir(i + (dx < 0 ? 1 : -1)); } });
    const som = d.musica && d.musica.som;
    if (som) {
      const bt = h('button', { type: 'button', class: 'ex-som', title: T('Tocar com a música', 'Play with music') }, A.icone('play', 16));
      const fim = () => { clearInterval(timer); timer = 0; bt.replaceChildren(A.icone('play', 16)); palco.classList.remove('tocando-som'); };
      bt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (somAtual && somAtual.bt === bt) { pararSom(); return; }
        pararSom(); if (E.parar) E.parar();
        const a = new Audio(srv() + '/api/tt?m=' + encodeURIComponent(som)); a.loop = true; a.volume = 0.7;
        a.play().catch(() => fim());
        somAtual = { a, bt, fim: () => { fim(); a.removeAttribute('src'); a.load(); } };
        bt.replaceChildren(A.icone('pausa', 16)); palco.classList.add('tocando-som');
        if (n > 1) timer = setInterval(() => { if (!palco.isConnected) { pararSom(); return; } ir(i + 1); }, 3000);
      });
      palco.append(bt);
    }
    ir(0);
    return palco;
  }
  function musicaTT(m, girando) {
    return h('div', { class: 'ex-musica' + (girando ? ' gira' : '') }, h('span', { class: 'ex-disco' }, m.capa ? h('img', { src: img(m.capa), alt: '', loading: 'lazy', draggable: 'false' }) : A.icone('musica', 12)),
      A.icone('musica', 13), h('span', { class: 'ex-musica-nome' }, (m.titulo || T('Som original', 'Original sound')) + (m.autor ? ' · ' + m.autor : '')));
  }
  function perfilTT(d) {
    const a = d.autor || {}, url = d.url;
    const partes = [h('div', { class: 'ex-banner tt' }, h('span', { class: 'ex-banner-marca' }, marcaTT(120))),
      h('div', { class: 'ex-perfil-cab' }, avatar(a.av, 'ex-av grande'), h('button', { type: 'button', class: 'ex-logo tt', title: T('Abrir na TikTok', 'Open on TikTok'), onclick: abrir(url) }, marcaTT(18))),
      h('a', { class: 'ex-quem grande', href: url, onclick: abrir(url) }, h('b', null, a.nome || a.nick, a.ok ? h('span', { class: 'ex-ok', title: T('Verificado', 'Verified') }, A.icone('check', 10)) : null), h('small', null, '@' + a.nick))];
    if (a.privado) partes.push(h('div', { class: 'ex-privado' }, A.icone('cadeado', 15), T('Esta conta é privada', 'This account is private')));
    else {
      if (d.bio) partes.push(h('div', { class: 'ex-txt' }, d.bio));
      const est = (v, r) => (v == null ? null : h('div', { class: 'ex-est' }, h('b', null, curto(v)), h('small', null, r)));
      partes.push(h('div', { class: 'ex-ests' }, est(d.seguidores, T('Seguidores', 'Followers')), est(d.seguindo, T('Seguindo', 'Following')), est(d.curtidas, T('Curtidas', 'Likes')), est(d.videos, T('Vídeos', 'Videos'))));
      if (d.link) partes.push(h('a', { class: 'ex-link', href: d.link, onclick: abrir(d.link) }, A.icone('link', 13), d.link.replace(/^https?:\/\/(www\.)?/, '')));
    }
    partes.push(h('button', { type: 'button', class: 'ex-ir tt', onclick: abrir(url) }, T('Ver perfil na TikTok', 'View profile on TikTok'), A.icone('externo', 13)));
    return partes;
  }
  E.tiktok = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = esqueleto('emb-tt'), el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      if (!d || (d.tipo !== 'tiktok' && d.tipo !== 'tiktok-perfil')) { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      const url = d.url || u;
      let partes;
      if (d.tipo === 'tiktok-perfil') { cartao.classList.add('perfil'); partes = perfilTT(d); }
      else {
        partes = [quemTT(d.autor || {}, url)];
        if (d.texto) partes.push(textoTT(d.texto));
        partes.push(d.fotos ? fotosTT(d) : videoTT(d));
        // (1.0.6) baixar direto no Aero: o vídeo, ou todas as fotos do post
        const bx = d.fotos ? botaoBaixar(T('Baixar fotos', 'Download photos'), () => baixarVarios(d.fotos.map((f, k) => ({ url: f.url, nome: 'tiktok-' + d.id + '-' + (k + 1) + '.jpg' }))))
          : botaoBaixar(T('Baixar vídeo', 'Download video'), () => baixarUm(srv() + '/api/tt?v=' + encodeURIComponent(d.id), 'tiktok-' + d.id + '.mp4'));
        partes.push(h('div', { class: 'ex-nums' }, num('coracao', d.cur, T('Curtidas', 'Likes')), num('chat', d.com, T('Comentários', 'Comments')), num('marcar', d.fav, T('Salvos', 'Favorites')), num('encaminhar', d.comp, T('Compartilhamentos', 'Shares')), num('play', d.views, T('Visualizações', 'Views')), bx));
        if (d.musica && (d.musica.titulo || d.musica.autor)) partes.push(musicaTT(d.musica));
        partes.push(h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaTT(12), 'TikTok' + (d.t ? ' · ' + quando(d.t) : '')));
      }
      cartao.classList.remove('carregando'); cartao.replaceChildren(...partes);
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.ex-palco')) menu(e); });
      grudar();
    });
    return el;
  };

  // ---------- Instagram ----------
  E.ehInstagram = (u) => /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:(?:[A-Za-z0-9._]{1,30}\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]{5,40}|(?!explore|accounts|direct|stories|about|legal|developer)[A-Za-z0-9._]{1,30}\/?(?:[?#]|$))/i.test(u);
  // (1.0.6) o post/reel inteiro no Aero: vídeo no player do Aero, fotos do carrossel, legenda, números e baixar. Tudo passa pelo /api/ig
  function igCompleto(cartao, d, menu) {
    const url = d.url, a = d.autor || {}, c = encodeURIComponent(d.codigo), ig = (n, f) => srv() + '/api/ig?c=' + c + '&n=' + n + '&f=' + f;
    const perfil = 'https://www.instagram.com/' + (a.nick || d.nick) + '/';
    const topo = h('div', { class: 'ex-topo' }, a.av ? h('img', { class: 'ex-av', src: ig(0, 'a'), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : h('span', { class: 'ex-av ig' }, ((a.nick || d.nick || '?')[0] || '?').toUpperCase()),
      h('a', { class: 'ex-quem', href: perfil, onclick: abrir(perfil) }, h('b', null, a.nick || d.nick || 'Instagram', a.ok ? h('span', { class: 'ex-ok ig', title: T('Verificado', 'Verified') }, A.icone('check', 10)) : null), h('small', null, d.sub === 'reel' ? T('Reel do Instagram', 'Instagram Reel') : T('Post do Instagram', 'Instagram post'))),
      h('button', { type: 'button', class: 'ex-logo ig', title: T('Abrir no Instagram', 'Open on Instagram'), onclick: abrir(url) }, marcaIG(20)));
    const itens = d.midias.map((m, k) => ({ tipo: m.tipo, ver: ig(k, 'i'), grande: ig(k, 'i'), capa: ig(k, 'i'), src: ig(k, 'v'), w: m.w, h: m.h, dur: k === 0 ? d.dur : 0, nome: 'instagram-' + d.codigo + (d.midias.length > 1 ? '-' + (k + 1) : '') + (m.tipo === 'video' ? '.mp4' : '.jpg') }));
    const palco = galeriaMista(itens, url);
    const bx = botaoBaixar(itens.length > 1 ? T('Baixar tudo', 'Download all') : itens[0].tipo === 'video' ? T('Baixar vídeo', 'Download video') : T('Baixar foto', 'Download photo'),
      () => baixarVarios(itens.map((x) => ({ url: x.tipo === 'video' ? x.src : x.grande, nome: x.nome }))));
    const partes = [topo];
    if (d.texto) partes.push(textoTT(d.texto));
    partes.push(palco, h('div', { class: 'ex-nums' }, num('coracao', d.cur, T('Curtidas', 'Likes')), num('chat', d.com, T('Comentários', 'Comments')), num('play', d.views, T('Visualizações', 'Views')), bx));
    if (d.musica && (d.musica.titulo || d.musica.autor)) partes.push(musicaTT(d.musica));
    partes.push(h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaIG(12), 'Instagram' + (d.t ? ' · ' + quando(d.t) : '')));
    cartao.classList.remove('carregando'); cartao.classList.add('ig-completo'); cartao.replaceChildren(...partes);
    cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.ex-palco')) menu(e); });
  }

  // ---------- Pinterest (1.0.6) ----------
  // pin: foto, vídeo (toca no player do Aero), carrossel e as páginas do pin de ideia; quem criou, quem salvou e em que pasta, salvos,
  // reações e comentários; baixar a foto original ou o vídeo. Pasta e perfil: o mural com os pins (cada um abre na galeria do Aero)
  const marcaPin = (t) => svg(t, '0 0 24 24', '<circle cx="12" cy="12" r="12" fill="#E60023"/><path fill="#fff" d="M12.3 4.6c-4.2 0-6.3 3-6.3 5.5 0 1.5.6 2.9 1.8 3.4.2.1.4 0 .4-.2l.2-.7c.1-.2 0-.3-.1-.5-.4-.4-.6-1-.6-1.8 0-2.3 1.7-4.4 4.5-4.4 2.5 0 3.8 1.5 3.8 3.5 0 2.6-1.2 4.9-2.9 4.9-1 0-1.7-.8-1.4-1.8.3-1.1.8-2.4.8-3.2 0-.7-.4-1.4-1.2-1.4-1 0-1.8 1-1.8 2.4 0 .9.3 1.5.3 1.5l-1.2 5c-.3 1.4 0 3.2 0 3.4 0 .1.2.1.2 0 .1-.1 1.2-1.5 1.6-2.9l.6-2.4c.3.6 1.2 1.1 2.2 1.1 2.9 0 4.8-2.6 4.8-6.1 0-2.7-2.3-5.2-5.7-5.2z"/>');
  E.ehPinterest = (u) => /^https?:\/\/(?:(?:[a-z]{2,3}\.|www\.)?pinterest\.(?:com|[a-z]{2}|com?\.[a-z]{2})\/(?:pin\/(?:[\w-]{0,120}--)?\d{5,25}|(?!pin\/|search\/|ideas\/|today\/|_\/|login|signup|settings|business\/)[A-Za-z0-9_]{3,40}(?:\/(?!_|pins\/?(?:[?#]|$))[\w%-]{1,120})?\/?(?:[?#]|$))|pin\.it\/[A-Za-z0-9]{4,20})/i.test(u);
  const pinVideo = (u) => srv() + '/api/pin?u=' + encodeURIComponent(u);
  function quemPin(a, sub, url) {
    const perfil = a && a.nick ? 'https://www.pinterest.com/' + a.nick + '/' : url;
    return h('div', { class: 'ex-topo' }, a && a.av ? avatar(a.av, 'ex-av') : h('span', { class: 'ex-av pin' }, ((a && (a.nome || a.nick)) || 'P')[0].toUpperCase()),
      h('a', { class: 'ex-quem', href: perfil, onclick: abrir(perfil) }, h('b', null, (a && (a.nome || a.nick)) || 'Pinterest'), h('small', null, sub || (a && a.nick ? '@' + a.nick : 'pinterest.com'))),
      h('button', { type: 'button', class: 'ex-logo pin', title: T('Abrir no Pinterest', 'Open on Pinterest'), onclick: abrir(url) }, marcaPin(26)));
  }
  function pinCartao(d) {
    const url = d.url, itens = d.midias.map((m, k) => ({ tipo: m.tipo, ver: m.tipo === 'video' ? m.capa : m.url, grande: m.orig || m.url, capa: m.capa, src: m.tipo === 'video' ? pinVideo(m.url) : '', w: m.w, h: m.h, dur: m.dur,
      nome: 'pinterest-' + d.id + (d.midias.length > 1 ? '-' + (k + 1) : '') + (m.tipo === 'video' ? '.mp4' : '.' + ((/\.(png|webp|gif)$/i.exec(m.orig || m.url) || [, 'jpg'])[1])) }));
    const partes = [quemPin(d.autor, d.autor && d.autor.nick ? '@' + d.autor.nick : '', url)];
    const palco = galeriaMista(itens, url); if (d.cor) palco.style.background = d.cor;
    partes.push(palco);
    if (d.titulo) partes.push(h('div', { class: 'ex-pin-tit' }, d.titulo));
    if (d.texto) partes.push(h('div', { class: 'ex-txt' }, d.texto));
    if (d.salvou || d.pasta) {
      const s = d.salvou, pasta = d.pasta && d.pasta.url ? h('a', { href: d.pasta.url, onclick: abrir(d.pasta.url) }, d.pasta.nome) : d.pasta ? h('b', null, d.pasta.nome) : null;
      partes.push(h('div', { class: 'ex-pin-salvo' }, s && s.av ? avatar(s.av, 'ex-av mini') : A.icone('alfinete', 14),
        h('span', null, s ? T('Salvo por ', 'Saved by ') : T('Na pasta ', 'In board '), s ? h('b', null, s.nome || s.nick) : null, s && pasta ? T(' em ', ' in ') : null, pasta)));
    }
    if (d.link) partes.push(h('a', { class: 'ex-link', href: d.link, onclick: abrir(d.link) }, A.icone('link', 13), d.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)));
    const bx = botaoBaixar(itens.length > 1 ? T('Baixar tudo', 'Download all') : itens[0].tipo === 'video' ? T('Baixar vídeo', 'Download video') : T('Baixar imagem', 'Download image'),
      () => baixarVarios(itens.map((x) => ({ url: x.tipo === 'video' ? x.src : x.grande, nome: x.nome }))));
    partes.push(h('div', { class: 'ex-nums' }, num('alfinete', d.salvos, T('Salvos', 'Saves')), num('coracao', d.reacoes, T('Reações', 'Reactions')), num('chat', d.coms, T('Comentários', 'Comments')), bx));
    partes.push(h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaPin(12), 'Pinterest' + (d.t ? ' · ' + quando(d.t) : '')));
    return partes;
  }
  // pasta ou perfil: o mural (colunas como no Pinterest); o pin de vídeo busca o vídeo quando é aberto
  function pinMural(d, dados) {
    const a = d.autor || {}, url = d.url, pasta = d.tipo === 'pinterest-pasta';
    const partes = [quemPin(a, pasta ? T('Pasta de ', 'Board by ') + '@' + a.nick : '@' + a.nick, url)];
    if (pasta) partes.push(h('div', { class: 'ex-pin-tit grande' }, d.nome));
    const sobre = pasta ? d.texto : a.sobre; if (sobre) partes.push(h('div', { class: 'ex-txt' }, sobre));
    const est = (v, r) => (v == null ? null : h('div', { class: 'ex-est' }, h('b', null, curto(v)), h('small', null, r)));
    partes.push(h('div', { class: 'ex-ests dois' }, pasta ? est(d.qtd, T('Pins', 'Pins')) : est(a.pins, T('Pins', 'Pins')), pasta ? est(d.seg, T('Seguidores', 'Followers')) : est(a.seg, T('Seguidores', 'Followers'))));
    const pins = (d.pins || []).slice(0, 12);
    if (pins.length) {
      const gal = pins.map((p) => ({ url: img(p.orig || p.foto), video: false, nome: 'pinterest-' + p.id + '.jpg', link: 'https://www.pinterest.com/pin/' + p.id + '/' }));
      const abrirPin = async (p, k) => {
        if (!p.video) { A.ui.verImagem(gal[k].url, { nome: gal[k].nome, link: gal[k].link, galeria: { itens: gal, i: k } }); return; }
        const x = await dados('https://www.pinterest.com/pin/' + p.id + '/').catch(() => null);
        const v = x && x.midias && x.midias.find((m) => m.tipo === 'video');
        if (v) { const src = pinVideo(v.url); A.ui.verImagem(src, { nome: 'pinterest-' + p.id + '.mp4', link: gal[k].link, galeria: { itens: [{ url: src, video: true, nome: 'pinterest-' + p.id + '.mp4', link: gal[k].link }], i: 0 } }); }
        else A.ui.verImagem(gal[k].url, { nome: gal[k].nome, link: gal[k].link, galeria: { itens: gal, i: k } });
      };
      // masonry de verdade: cada pin vai para a coluna mais baixa (o column-count do CSS jogava metade para colunas escondidas)
      const nCol = window.matchMedia && window.matchMedia('(max-width: 560px)').matches ? 2 : 3;
      const cols = Array.from({ length: nCol }, () => h('div', { class: 'ex-pin-col' })), alt = cols.map(() => 0);
      pins.forEach((p, k) => {
        const b = h('button', { type: 'button', class: 'ex-pin-item', title: p.video ? T('Assistir', 'Watch') : T('Ver imagem', 'View image'), onclick: (e) => { e.stopPropagation(); abrirPin(p, k); } },
          h('img', { src: img(p.foto), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }), p.video ? h('span', { class: 'ex-pin-play' }, A.icone('play', 14)) : null);
        const ar = p.w && p.h ? Math.max(0.6, Math.min(1.6, p.w / p.h)) : 0.75;
        b.style.setProperty('--ar', ar.toFixed(4)); if (p.cor) b.style.background = p.cor;
        const c = alt.indexOf(Math.min(...alt)); cols[c].append(b); alt[c] += 1 / ar;
      });
      partes.push(h('div', { class: 'ex-pin-grade' }, ...cols));
    }
    partes.push(h('button', { type: 'button', class: 'ex-ir pin', onclick: abrir(url) }, pasta ? T('Ver a pasta no Pinterest', 'View board on Pinterest') : T('Ver perfil no Pinterest', 'View profile on Pinterest'), A.icone('externo', 13)));
    return partes;
  }
  E.pinterest = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = esqueleto('emb-pin'), el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      const ok = d && ((d.tipo === 'pinterest' && d.midias && d.midias.length) || d.tipo === 'pinterest-pasta' || d.tipo === 'pinterest-perfil');
      if (!ok) { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      cartao.classList.remove('carregando'); cartao.replaceChildren(...(d.tipo === 'pinterest' ? pinCartao(d) : pinMural(d, dados)));
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.ex-palco, .ex-pin-grade')) menu(e); });
      grudar();
    });
    return el;
  };
  E.instagram = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = esqueleto('emb-ig'), el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      if (!d || d.tipo !== 'instagram') { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      if (d.completo && d.midias && d.midias.length) { igCompleto(cartao, d, menu); grudar(); return; } // (1.0.6) o post de verdade
      const url = d.url, perfil = d.sub === 'perfil', reel = d.sub === 'reel';
      const titulo = perfil ? '@' + d.nick : reel ? T('Reel do Instagram', 'Instagram Reel') : T('Post do Instagram', 'Instagram post');
      const sub = perfil ? T('Perfil no Instagram', 'Instagram profile') : d.nick ? '@' + d.nick : 'instagram.com';
      const topo = h('div', { class: 'ex-topo' }, h('span', { class: 'ex-av ig' }, perfil ? (d.nick[0] || '?').toUpperCase() : A.icone(reel ? 'play' : 'imagem', 18)),
        h('a', { class: 'ex-quem', href: url, onclick: abrir(url) }, h('b', null, titulo), h('small', null, sub)),
        h('button', { type: 'button', class: 'ex-logo ig', title: T('Abrir no Instagram', 'Open on Instagram'), onclick: abrir(url) }, marcaIG(20)));
      // o player oficial do Instagram (reel com som, carrossel, curtidas e legenda; no perfil, seguidores e os posts) só carrega no clique
      const palco = h('div', { class: 'ex-palco ex-ig-palco' + (perfil ? ' perfil' : reel ? ' reel' : '') });
      const ver = h('button', { type: 'button', class: 'ex-ig-ver' }, h('span', { class: 'ex-play' }, A.icone(perfil ? 'pessoa' : 'play', 28)), h('b', null, perfil ? T('Ver o perfil aqui', 'View profile here') : reel ? T('Assistir aqui', 'Watch here') : T('Ver o post aqui', 'View post here')));
      ver.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = perfil ? 'https://www.instagram.com/' + encodeURIComponent(d.nick) + '/embed/' : 'https://www.instagram.com/' + (reel ? 'reel' : 'p') + '/' + encodeURIComponent(d.codigo) + '/embed/captioned/';
        palco.classList.add('tocando'); palco.replaceChildren(h('iframe', { src, title: 'Instagram', loading: 'lazy', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox' }));
        grudar();
      });
      palco.append(ver); palco.addEventListener('click', (e) => e.stopPropagation());
      cartao.classList.remove('carregando'); cartao.replaceChildren(topo, palco, h('a', { class: 'ex-rod', href: url, onclick: abrir(url) }, marcaIG(12), 'Instagram'));
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.ex-palco')) menu(e); });
      grudar();
    });
    return el;
  };
})();
