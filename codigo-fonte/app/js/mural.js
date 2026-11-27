// Aero Stream - (0.8.7) o Mural do perfil: uma seção à parte, grudada num dos 4 lados do cartão (a pessoa escolhe, ou não usa).
// Abas: Filmes, Séries, Animes, Músicas, Álbuns e Jogos. Cada aba tem o favorito (em destaque), "que eu gosto" e "quero" (assistir,
// ouvir ou jogar; músicas e álbuns ainda não lançados podem entrar só pelo nome). Clicar num item mostra a nota (estrelas) e o
// comentário da pessoa. As capas passam pelo servidor do Aero; o conteúdo vem da rota "mural" (fica fora da lista de amigos).
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, U = A.ui, API = A.api;
  const MU = (A.mural = {});
  const CATS = {
    f: { ic: 'video', nome: ['Filmes', 'Movies'], fav: ['Filme favorito', 'Favorite movie'], gosto: ['Filmes que eu gosto', 'Movies I like'], quero: ['Quero assistir', 'Want to watch'], busca: ['Procure um filme', 'Search a movie'] },
    s: { ic: 'tela', nome: ['Séries', 'Shows'], fav: ['Série favorita', 'Favorite show'], gosto: ['Séries que eu gosto', 'Shows I like'], agora: ['Assistindo agora', 'Watching now'], quero: ['Quero assistir', 'Want to watch'], busca: ['Procure uma série', 'Search a show'] },
    a: { ic: 'estrela', nome: ['Animes', 'Anime'], fav: ['Anime favorito', 'Favorite anime'], gosto: ['Animes que eu gosto', 'Anime I like'], agora: ['Assistindo agora', 'Watching now'], quero: ['Quero assistir', 'Want to watch'], busca: ['Procure um anime', 'Search an anime'] },
    m: { ic: 'musica', nome: ['Músicas', 'Songs'], fav: ['Música favorita', 'Favorite song'], gosto: ['Músicas que eu gosto', 'Songs I like'], busca: ['Procure ou cole um link (Spotify, Deezer, YouTube Music)', 'Search or paste a link (Spotify, Deezer, YouTube Music)'], q: true, link: true },
    l: { ic: 'disco', nome: ['Álbuns', 'Albums'], fav: ['Álbum favorito', 'Favorite album'], gosto: ['Álbuns que eu gosto', 'Albums I like'], busca: ['Procure ou cole um link de álbum', 'Search or paste an album link'], q: true, link: true },
    b: { ic: 'livro', nome: ['Livros', 'Books'], fav: ['Livro favorito', 'Favorite book'], gosto: ['Livros que eu gosto', 'Books I like'], agora: ['Lendo agora', 'Reading now'], quero: ['Quero ler', 'Want to read'], busca: ['Procure um livro (nome, autor ou ISBN)', 'Search a book (title, author or ISBN)'] },
    h: { ic: 'hq', nome: ['HQs', 'Comics'], fav: ['HQ favorita', 'Favorite comic'], gosto: ['HQs que eu gosto', 'Comics I like'], agora: ['Lendo agora', 'Reading now'], quero: ['Quero ler', 'Want to read'], busca: ['Procure uma HQ', 'Search a comic'] }, // (1.0.3)
    g: { ic: 'manga', nome: ['Mangás', 'Manga'], fav: ['Mangá favorito', 'Favorite manga'], gosto: ['Mangás que eu gosto', 'Manga I like'], agora: ['Lendo agora', 'Reading now'], quero: ['Quero ler', 'Want to read'], busca: ['Procure um mangá', 'Search a manga'] }, // (1.0.3)
    j: { ic: 'jogo', nome: ['Jogos', 'Games'], fav: ['Jogo favorito', 'Favorite game'], gosto: ['Jogos que eu gosto', 'Games I like'], agora: ['Jogando agora', 'Playing now'], quero: ['Quero jogar', 'Want to play'], busca: ['Procure um jogo', 'Search a game'] },
  };
  const ORDEM = ['f', 's', 'a', 'm', 'l', 'b', 'h', 'g', 'j'], MAX = 100;
  // (0.8.7) a ordem das abas que a pessoa escolheu (arrastando no editor); as que faltam vão no fim
  const ordemDe = (m) => { const o = (m && Array.isArray(m.ord) ? m.ord : []).filter((c) => ORDEM.includes(c)); return [...new Set([...o, ...ORDEM])]; };
  MU.ordemDe = ordemDe;
  // (0.8.7) a ordem das seções de cada aba (o favorito não precisa ficar em cima)
  // (0.8.7) músicas e álbuns não têm "quero ouvir" (é só ouvir)
  const secoesDe = (v, k) => { const ok = ['fav', ...(k && k.agora ? ['agora'] : []), 'gosto', ...(k && !k.quero ? [] : ['quero'])]; /* (1.0.2) + "agora" (jogando, assistindo, lendo) */ const o = (v && Array.isArray(v.so) ? v.so : []).filter((s) => ok.includes(s)); return [...new Set([...o, ...ok])]; };
  MU.CATS = CATS; MU.ORDEM = ORDEM;
  MU.capa = (c) => (c ? `${API.servidor}/api/capa?u=${encodeURIComponent(c)}` : '');
  MU.tem = (m, c) => !!(m && m[c] && (m[c].fav || (m[c].gosto || []).length || (CATS[c] && CATS[c].quero && (m[c].quero || []).length) || (CATS[c] && CATS[c].agora && (m[c].agora || []).length)));
  // o mural de alguém (guardado até mudar de versão)
  const cache = new Map();
  MU.dados = (codigo, mv) => {
    const c = cache.get(codigo); if (c && c.mv === (mv || 0)) return c.p;
    const p = API.req('mural/' + encodeURIComponent(codigo)).then((d) => d.m || {});
    p.catch(() => cache.delete(codigo)); cache.set(codigo, { mv: mv || 0, p });
    return p;
  };
  MU.esquecer = (codigo) => cache.delete(codigo);

  // estrelas de 0 a 10 (meias estrelas)
  const estrelas = (n, cls = '') => h('span', { class: 'mr-estrelas ' + cls, 'aria-label': n ? (n / 2) + ' / 5' : '' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: n >= i * 2 ? 'cheia' : n === i * 2 - 1 ? 'meia' : '' }, '★')));
  MU.estrelas = estrelas;
  // (1.0.2) a capa guardada não abriu (o site trocou o arquivo: a Wikipédia mudou o logo do League of Legends e do Valorant, por exemplo) ou o
  // item ficou sem capa: procura a capa de agora pelo nome, uma vez por item, e mostra essa (no próprio aparelho; nada é salvo)
  const novaCapa = new Map();
  const normT = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
  MU.capaAtual = (x, c) => {
    const k = c + ':' + normT(x.t); if (!x.t || !API.token || !CATS[c]) return Promise.resolve('');
    if (!novaCapa.has(k)) novaCapa.set(k, fetch(`${API.servidor}/api/busca?tipo=${c}&q=${encodeURIComponent(String(x.t).slice(0, 100))}`, { headers: { Authorization: 'Bearer ' + API.token } })
      .then((r) => r.json()).then((d) => { const l = (d && d.itens) || []; const it = l.find((y) => normT(y.t) === normT(x.t) && y.c) || null; return it && it.c !== x.c ? it.c : ''; }).catch(() => ''));
    return novaCapa.get(k);
  };
  // (1.0.3) jogos: o ícone do jogo (o "L" do League of Legends, o "V" do Valorant), da lista pública de jogos do Discord, no lugar do logo
  // gigante da Wikipédia (que virava letras enormes cortadas). A capa em pé da Steam continua sendo a preferida. O índice fica no site,
  // dividido pela primeira letra (scripts/jogos-icones.mjs)
  const pedacos = new Map();
  MU.iconeJogo = (t) => {
    const n = normT(t); if (n.length < 2 || !API.servidor) return Promise.resolve('');
    const k = /^[a-z]/.test(n) ? n[0] : '0';
    if (!pedacos.has(k)) pedacos.set(k, fetch(`${API.servidor}/jogos-icones/${k}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => { pedacos.delete(k); return {}; }));
    return pedacos.get(k).then((m) => { const v = m && m[n]; return v && /^\d{5,25}\/[a-f0-9]{32}$/.test(v) ? 'https://cdn.discordapp.com/app-icons/' + v + '.png?size=256' : ''; });
  };
  const capaSteam = (u) => /steamstatic\.com|steamcdn-a\.akamaihd\.net/.test(u || '');
  MU.imgCapa = (x, c, capa = MU.capa) => {
    const img = h('img', { alt: '', loading: 'lazy', draggable: 'false', referrerpolicy: 'no-referrer' });
    let tentou = false;
    const trocar = () => { if (tentou) { img.remove(); return; } tentou = true; MU.capaAtual(x, c).then((u) => { if (u) img.src = capa(u); else img.remove(); }); };
    img.onerror = trocar;
    // (1.0.3) carregou: o desenho de reserva (o controle) some de trás da imagem (ele aparecia no meio dos logos transparentes)
    img.addEventListener('load', () => { const caixa = img.parentElement; if (caixa) caixa.classList.add('com-img'); });
    if (c === 'j' && !capaSteam(x.c)) {
      MU.iconeJogo(x.t).then((u) => {
        if (u) { img.onerror = () => { img.onerror = trocar; img.classList.remove('mr-icone-jogo'); if (img.parentElement) img.parentElement.classList.remove('icone-jogo'); if (x.c) img.src = capa(x.c); else trocar(); }; img.classList.add('mr-icone-jogo'); const caixa = img.parentElement; if (caixa) caixa.classList.add('icone-jogo'); else img.dataset.ij = '1'; img.src = capa(u); }
        else if (x.c) img.src = capa(x.c); else trocar();
      });
      return img;
    }
    if (x.c) img.src = capa(x.c); else trocar();
    return img;
  };
  const imagem = (x, c) => { const im = x.c || c === 'j' ? MU.imgCapa(x, c) : null, el = h('div', { class: 'mr-img' + (CATS[c].q ? ' q' : '') + (im && im.dataset.ij ? ' icone-jogo' : '') }, im, h('span', { class: 'mr-img-ic' }, A.icone(CATS[c].ic, 22))); return el; };
  const NOME_LINK = (u) => (/imdb\.com/.test(u) ? 'IMDb' : /anilist/.test(u) ? 'AniList' : /wikipedia/.test(u) ? 'Wikipédia' : /books\.google/.test(u) ? 'Google Livros' : /openlibrary/.test(u) ? 'Open Library' : /kitsu\.app/.test(u) ? 'Kitsu' : /deezer/.test(u) ? 'Deezer' : /spotify/.test(u) ? 'Spotify' : /music\.youtube/.test(u) ? 'YouTube Music' : /steampowered/.test(u) ? 'Steam' : /wikipedia\.org/.test(u) ? 'Wikipedia' : /letterboxd/.test(u) ? 'Letterboxd' : T('o site', 'the site'));

  // (0.8.7) músicas do Mural tocam como a música do perfil: o trecho de 30 s escolhido (YouTube) ou, sem trecho, a prévia achada pelo nome
  const somDe = (x) => { const dz = /deezer\.com\/track\/(\d+)/.exec(x.u || ''); return { nome: x.t, artista: x.a || '', capa: x.c || '', ...(dz ? { fonte: 'deezer', id: dz[1] } : {}), ...(x.yt && x.yt.length ? { yt: x.yt, inicio: x.ini | 0, duracao: x.dur | 0 } : {}) }; };
  const tocadorDe = (x, o) => (A.perfil && A.perfil.tocador ? A.perfil.tocador(somDe(x), o || {}) : null);
  // a janelinha de um item: capa grande, nota e o comentário da pessoa
  MU.detalhe = (x, c, dono) => {
    const corpo = h('div', { class: 'mr-detalhe' }, imagem(x, c),
      h('div', { class: 'mr-detalhe-tx' }, h('b', { class: 'mr-detalhe-t' }, x.t), x.a ? h('div', { class: 'suave peq' }, x.a) : null,
        x.n ? h('div', { class: 'mr-detalhe-nota' }, estrelas(x.n, 'grande'), h('span', { class: 'suave peq' }, (x.n / 2).toLocaleString() + ' / 5')) : h('div', { class: 'suave peq' }, T('Sem nota', 'No rating')),
        x.cm ? h('blockquote', { class: 'mr-cm selecionavel' }, ...A.ui.textoComLinks(x.cm)) : null,
        c === 'm' ? h('div', { class: 'mr-toc-detalhe' }, tocadorDe(x, { onda: true, busca: true, volLado: true })) : null,
        dono ? h('div', { class: 'suave peq' }, T('por ', 'by ') + dono) : null,
        x.u ? U.btn(T('Abrir no ', 'Open on ') + NOME_LINK(x.u), { icone: 'externo', tipo: 'sec', peq: true, onclick: () => U.abrirFora(x.u) }) : null));
    U.modal(null, corpo, { largura: 420, classe: 'mr-janela' });
  };

  // ---------- o painel (no perfil aberto) ----------
  // m: o mural (ou uma promessa dele); lado: de que lado do cartão fica
  // (0.8.7) o fundo próprio do Mural (cor, degradê ou imagem com desfoque e escurecido); null = o vidro do Aero
  MU.aplicarFundo = (el, f) => {
    el.classList.toggle('mr-proprio', !!f); el.classList.toggle('mr-claro', !!(f && f.claro)); el.classList.toggle('mr-escuro', !!(f && !f.claro));
    let camada = el.querySelector(':scope > .mr-fundo');
    if (!f) { if (camada) camada.remove(); el.style.removeProperty('--mr-bg'); return; }
    el.style.setProperty('--mr-bg', f.bg || '#14202b');
    if (!f.img) { if (camada) camada.remove(); return; }
    if (!camada) { camada = h('div', { class: 'mr-fundo', 'aria-hidden': 'true' }, h('i')); el.prepend(camada); }
    camada.style.setProperty('--mr-img', `url("${String(f.img).replace(/["\\]/g, '')}")`);
    camada.style.setProperty('--mr-blur', (f.blur | 0) + 'px'); camada.style.setProperty('--mr-luz', String(Math.max(0, Math.min(100, f.luz == null ? 35 : f.luz)) / 100));
  };
  MU.painel = (m, { lado = 'direita', dono = '', aba, arrastar, previa, fundo } = {}) => {
    const corpo = h('div', { class: 'mr-corpo' }, h('div', { class: 'suave peq mr-carregando' }, T('Carregando o mural...', 'Loading the wall...')));
    const abas = h('div', { class: 'mr-abas', role: 'tablist' });
    const el = h('section', { class: 'mural mural-' + lado + (previa ? ' mural-previa' : '') + (arrastar ? ' mural-arrasta' : ''), 'aria-label': 'Mural' }, h('div', { class: 'mr-cab' }, A.orbe('apps', 26), h('b', {}, T('Mural', 'Wall'))), abas, corpo);
    if (fundo) MU.aplicarFundo(el, fundo);
    Promise.resolve(m).then((m) => {
      const cats = ordemDe(m).filter((c) => MU.tem(m, c));
      if (!cats.length) { corpo.replaceChildren(h('div', { class: 'suave peq mr-vazio' }, T('O mural ainda está vazio.', 'The wall is still empty.'))); return; }
      let atual = cats.includes(aba) ? aba : cats[0];
      const pintar = () => {
        const tinhaFoco = abas.contains(document.activeElement); // (1.0.2) pelo controle: a seleção fica na aba escolhida (antes voltava para o começo)
        abas.replaceChildren(...cats.map((c) => h('button', { type: 'button', role: 'tab', class: 'mr-aba' + (c === atual ? ' sel' : ''), 'aria-selected': String(c === atual), onclick: () => { if (c === atual) return; atual = c; if (previa) MU.abaVista = c; A.som.tocar('click'); pintar(); } }, A.icone(CATS[c].ic, 15), h('span', {}, T(...CATS[c].nome)))));
        if (tinhaFoco) { const b = abas.querySelector('.mr-aba.sel'); if (b) b.focus({ preventScroll: true }); }
        const v = m[atual], k = CATS[atual];
        const solta = (b, x) => { if (arrastar) { const c = atual; b.title = T('Arraste para o cartão', 'Drag into the card') + ' · ' + x.t; b.addEventListener('pointerdown', (e) => arrastar(x, c, e)); } };
        const it = (x) => {
          // (0.8.7) músicas: um play no cantinho da capa toca o trecho (sem abrir nada)
          const toc = atual === 'm' && !arrastar ? tocadorDe(x) : null;
          const b = h('div', { role: 'button', tabindex: '0', class: 'mr-it', title: x.t + (x.a ? ' · ' + x.a : '') }, imagem(x, atual), x.n ? estrelas(x.n, 'mini') : null, toc ? h('div', { class: 'mr-toc' }, toc) : null);
          const abrir = (e) => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; if (e.type === 'keydown') e.preventDefault(); if (!arrastar) MU.detalhe(x, atual, dono); };
          b.addEventListener('click', abrir); b.addEventListener('keydown', abrir); solta(b, x); return b;
        };
        // (0.8.7) como no Discord: 4 por linha, 2 linhas e "Mostrar mais" para o resto
        const grade = (tit, l) => {
          if (!l || !l.length) return null;
          const g = h('div', { class: 'mr-grade' + (k.q ? ' q' : '') }, ...l.slice(0, 8).map(it));
          const mais = l.length > 8 ? h('button', { type: 'button', class: 'mr-mais', onclick: () => { const todos = g.childElementCount > 8; g.replaceChildren(...(todos ? l.slice(0, 8) : l).map(it)); mais.textContent = todos ? T('Mostrar mais', 'Show more') : T('Mostrar menos', 'Show less'); A.som.tocar('click'); } }, T('Mostrar mais', 'Show more')) : null;
          return h('div', { class: 'mr-sec' }, h('div', { class: 'mr-sec-cab' }, h('b', {}, T(...tit))), g, mais);
        };
        const fav = v.fav ? (() => {
          const b = h('div', { role: 'button', tabindex: '0', class: 'mr-sec mr-fav' }, imagem(v.fav, atual),
            h('div', { class: 'mr-fav-tx' }, h('small', { class: 'mr-fav-rot' }, T(...k.fav)), h('b', {}, v.fav.t), v.fav.a ? h('span', { class: 'suave peq' }, v.fav.a) : null,
              v.fav.n ? estrelas(v.fav.n) : null, v.fav.cm ? h('i', { class: 'mr-fav-cm' }, v.fav.cm) : null,
              atual === 'm' && !arrastar ? h('div', { class: 'mr-toc-fav' }, tocadorDe(v.fav, { onda: true, busca: true, volLado: true })) : null));
          const abrir = (e) => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; if (e.type === 'keydown') e.preventDefault(); if (!arrastar) MU.detalhe(v.fav, atual, dono); };
          b.addEventListener('click', abrir); b.addEventListener('keydown', abrir); solta(b, v.fav); return b;
        })() : null;
        const secs = { fav, agora: k.agora && (v.agora || []).length ? grade(k.agora, v.agora) : null, gosto: grade(k.gosto, v.gosto), quero: k.quero ? grade(k.quero, v.quero) : null };
        corpo.replaceChildren(...secoesDe(v, k).map((s) => secs[s]).filter(Boolean));
      };
      pintar();
    }).catch(() => corpo.replaceChildren(h('div', { class: 'suave peq mr-vazio' }, T('Não deu para abrir o mural.', 'Could not open the wall.'))));
    return el;
  };
  // o cartão do perfil com o mural grudado no lado escolhido (lado a lado ou um em cima do outro, nunca um dentro do outro)
  // (0.8.7) a setinha entre o cartão e o mural recolhe e abre (como a da lista do Aero Talk); segurar e arrastar puxa o mural ao vivo
  const LADOS = ['esquerda', 'direita', 'cima', 'baixo'];
  const recolhido = () => { try { return localStorage.getItem('aero-mural-rec') === '1'; } catch (_) { return false; } };
  const gravarRec = (v) => { try { localStorage.setItem('aero-mural-rec', v ? '1' : ''); } catch (_) { /* ok */ } };
  MU.juntar = (cartao, p) => {
    if (!p || !LADOS.includes(p.ml) || !p.codigo) return cartao;
    const lado = p.ml, deitado = lado === 'cima' || lado === 'baixo', antes = lado === 'esquerda' || lado === 'cima';
    const painel = MU.painel(MU.dados(p.codigo, p.mv), { lado, dono: p.apelido || p.nome, fundo: A.perfil && A.perfil.fundoMural ? A.perfil.fundoMural(p) : null });
    const gaveta = h('div', { class: 'mr-gaveta' }, painel);
    // a setinha aponta para onde o mural vai (aberto: para o cartão, fechando; fechado: para fora, abrindo)
    const seta = h('button', { type: 'button', class: 'mr-seta', 'aria-label': T('Recolher ou abrir o mural', 'Collapse or expand the wall') }, A.icone('chevron', 16));
    const el = h('div', { class: 'pf-com-mural ml-' + lado }, ...(antes ? [gaveta, seta, cartao] : [cartao, seta, gaveta]));
    const medida = () => (deitado ? painel.offsetHeight : painel.offsetWidth) || (deitado ? 260 : 400);
    const por = (rec, anim = true) => {
      el.classList.toggle('recolhido', rec); seta.setAttribute('aria-expanded', String(!rec));
      seta.title = rec ? T('Abrir o mural', 'Expand the wall') : T('Recolher o mural', 'Collapse the wall');
      if (!anim) { gaveta.style.removeProperty('--mr-tam'); return; }
      gaveta.style.setProperty('--mr-tam', (rec ? 0 : medida()) + 'px');
    };
    por(recolhido(), false);
    const alternar = () => { const rec = !el.classList.contains('recolhido'); gaveta.style.setProperty('--mr-tam', (rec ? medida() : 0) + 'px'); void gaveta.offsetWidth; gravarRec(rec); A.som.tocar(rec ? 'mini-fechar' : 'grudar'); por(rec); setTimeout(() => { if (el.classList.contains('recolhido') === rec) gaveta.style.removeProperty('--mr-tam'); }, 420); };
    seta.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY, rec0 = el.classList.contains('recolhido'), total = medida(), sinal = antes ? 1 : -1;
      let moveu = false, tam = rec0 ? 0 : total;
      const mover = (ev) => {
        const d = (deitado ? y0 - ev.clientY : x0 - ev.clientX) * sinal; // para fora do cartão = abre
        if (!moveu && Math.abs(d) < 5) return;
        if (!moveu) { moveu = true; el.classList.add('puxando'); el.classList.remove('recolhido'); }
        tam = Math.max(0, Math.min(total, (rec0 ? 0 : total) + d));
        gaveta.style.setProperty('--mr-tam', tam + 'px');
      };
      const fim = () => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
        if (!moveu) { alternar(); return; }
        el.classList.remove('puxando');
        const rec = tam < total * 0.5; gravarRec(rec); A.som.tocar(rec ? 'mini-fechar' : 'grudar'); por(rec);
        setTimeout(() => { if (!el.classList.contains('puxando')) gaveta.style.removeProperty('--mr-tam'); }, 420);
      };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
    });
    seta.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
    // (1.0.6) o A do controle (e o cursor dele) chega como clique sem mouse (detail 0): antes só o mouse e o Enter abriam/fechavam o mural
    seta.addEventListener('click', (e) => { if (e.detail === 0) alternar(); });
    // (0.9.0) do lado: o mural na altura do cartão (antes passava muito dele e ficava fora de lugar)
    if (!deitado && typeof ResizeObserver === 'function') {
      const alt = () => { const hc = cartao.offsetHeight; if (hc) el.style.setProperty('--mr-h', Math.max(380, hc) + 'px'); };
      new ResizeObserver(alt).observe(cartao); requestAnimationFrame(alt);
    }
    // em cima ou embaixo: o mural cabe na tela junto com o cartão (sem a janela precisar rolar)
    if (deitado) requestAnimationFrame(() => { const hc = cartao.getBoundingClientRect().height || 400; el.style.setProperty('--mr-max', Math.max(220, Math.min(640, innerHeight * 0.9 - hc - 110)) + 'px'); /* (0.8.7) o espaço todo que sobra (a janela do perfil acerta o resto) */ });
    return el;
  };

  // ---------- o editor (aba Mural do editor do perfil) ----------
  // m: o mural (mexido direto); aoMudar(): avisa que mudou
  MU.editor = (m, aoMudar, aoAba) => {
    const pedir = (rota) => fetch(`${API.servidor}/api/${rota}`, { headers: { Authorization: 'Bearer ' + API.token } }).then((r) => r.json());
    const abas = h('div', { class: 'mr-abas mr-abas-ed', role: 'tablist' }), corpo = h('div', { class: 'col mr-ed' });
    let atual = ordemDe(m).includes(MU.abaVista) ? MU.abaVista : ordemDe(m)[0]; // (0.8.7) mudar algo não volta para a primeira aba
    const cat = (c) => { m[c] = m[c] || { fav: null, gosto: [], quero: [] }; if (!Array.isArray(m[c].agora)) m[c].agora = []; if (!Array.isArray(m[c].quero)) m[c].quero = []; return m[c]; };
    const mudou = () => { aoMudar(); pintarAbas(); };
    // a nota e o comentário de um item
    const editarItem = (x, depois) => {
      let n = x.n || 0;
      const est = h('div', { class: 'mr-escolher', role: 'slider', 'aria-label': T('Nota', 'Rating'), tabindex: '0' });
      const pintarEst = () => { est.replaceChildren(...[1, 2, 3, 4, 5].map((i) => h('span', { class: 'mr-est' + (n >= i * 2 ? ' cheia' : n === i * 2 - 1 ? ' meia' : '') }, h('i', { onclick: () => { n = n === i * 2 - 1 ? 0 : i * 2 - 1; pintarEst(); } }), h('i', { onclick: () => { n = n === i * 2 ? 0 : i * 2; pintarEst(); } }), '★')), h('small', { class: 'suave' }, n ? (n / 2).toLocaleString() + ' / 5' : T('sem nota', 'no rating'))); est.setAttribute('aria-valuenow', String(n / 2)); };
      est.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { n = Math.min(10, n + 1); pintarEst(); } if (e.key === 'ArrowLeft') { n = Math.max(0, n - 1); pintarEst(); } });
      pintarEst();
      const cm = h('textarea', { class: 'campo', rows: 4, maxlength: 280, placeholder: T('O que você achou? (opcional)', 'What did you think? (optional)') }); cm.value = x.cm || '';
      const corpoM = h('div', { class: 'col', estilo: { gap: '10px' } }, h('div', { class: 'linha' }, imagem(x, atual), h('div', { class: 'col cresce' }, h('b', {}, x.t), x.a ? h('small', { class: 'suave' }, x.a) : null)), est, cm);
      U.modal(T('Nota e comentário', 'Rating and comment'), corpoM, { largura: 420, classe: 'mr-janela', acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Pronto', 'Done'), valor: true }],
        aoFechar: (ok) => { if (ok === true) { x.n = n; x.cm = cm.value.trim().slice(0, 280); depois(); } } });
    };
    // (0.8.7) segurar e arrastar uma linha muda a ordem da lista (como as seções); os outros abrem espaço ao vivo
    // (1.0.0) e leva para outra seção (de "que eu gosto" para "quero", para o favorito...): solta em cima da seção e ela entra ali. No
    // favorito, o que já estava troca de lugar com ela. Seção que fica vazia some do perfil até ganhar outro item
    const rolaDe = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p; } return null; };
    const ordenavel = (row, l, i, onde, c) => {
      row.classList.add('mr-ed-ordena'); row.title = T('Arraste para mudar a ordem ou levar para outra seção', 'Drag to reorder or move to another section');
      row.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button, input, textarea, a')) return;
        const y0 = e.clientY, rola = rolaDe(row); let comecou = false, ultimoY = y0, tRola = 0;
        const secoes = () => [...corpo.querySelectorAll(':scope > .mr-ed-sec')];
        const linhas = (sec) => [...sec.querySelectorAll(':scope > .mr-ed-it')];
        const posicionar = (y) => {
          const secs = secoes(); if (!secs.length) return;
          // a seção embaixo do mouse (acima da primeira, a primeira; abaixo da última, a última)
          let alvoSec = secs.find((sc) => { const q = sc.getBoundingClientRect(); return y >= q.top && y <= q.bottom; });
          if (!alvoSec) alvoSec = y < secs[0].getBoundingClientRect().top ? secs[0] : secs[secs.length - 1];
          const ls = linhas(alvoSec).filter((r) => r !== row), antes = new Map([...corpo.querySelectorAll('.mr-ed-it')].map((r) => [r, r.getBoundingClientRect().top]));
          let alvo = null; for (const r of ls) { const q = r.getBoundingClientRect(); if (y < q.top + q.height / 2) { alvo = r; break; } }
          const fimSec = alvoSec.querySelector(':scope > .mr-busca');
          const ref = alvo || fimSec;
          if (row.parentElement === alvoSec && (ref === row.nextElementSibling)) return;
          if (row.parentElement === alvoSec && !alvo && row.nextElementSibling === fimSec) return;
          const mudouSec = row.parentElement !== alvoSec;
          alvoSec.insertBefore(row, ref);
          secs.forEach((sc) => sc.classList.toggle('mr-recebe', sc === alvoSec && alvoSec.dataset.s !== onde));
          A.som.tocar(mudouSec ? 'click' : 'hover');
          for (const r of corpo.querySelectorAll('.mr-ed-it')) { if (r === row) continue; const d = (antes.get(r) || 0) - r.getBoundingClientRect().top; if (d && Math.abs(d) < 400) r.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.9,.25,1.1)' }); }
        };
        // perto da borda da área que rola, ela rola sozinha (para levar até uma seção que está fora da tela)
        const rolar = () => {
          tRola = 0; if (!comecou || !rola) return;
          const q = rola.getBoundingClientRect(), borda = 48;
          const v = ultimoY < q.top + borda ? -Math.ceil((q.top + borda - ultimoY) / 4) : ultimoY > q.bottom - borda ? Math.ceil((ultimoY - (q.bottom - borda)) / 4) : 0;
          if (!v) return;
          const antes = rola.scrollTop; rola.scrollTop += v; if (rola.scrollTop !== antes) posicionar(ultimoY);
          tRola = requestAnimationFrame(rolar);
        };
        const mover = (ev) => {
          ultimoY = ev.clientY;
          if (!comecou) { if (Math.abs(ev.clientY - y0) < 5) return; comecou = true; row.classList.add('pegada'); corpo.classList.add('mr-arrastando'); A.som.tocar('desgrudar'); try { row.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } }
          posicionar(ev.clientY);
          if (!tRola) tRola = requestAnimationFrame(rolar);
        };
        const fim = () => {
          removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
          if (tRola) cancelAnimationFrame(tRola); tRola = 0;
          if (!comecou) return;
          row.classList.remove('pegada'); corpo.classList.remove('mr-arrastando'); A.som.tocar('grudar');
          const sec = row.parentElement && row.parentElement.closest('.mr-ed-sec'), para = sec && sec.dataset.s, v = cat(c);
          const novo = sec ? linhas(sec).indexOf(row) : -1;
          const x = onde === 'fav' ? v.fav : l[i];
          if (!x || !para) { pintar(); return; }
          if (para === onde) { if (l && novo >= 0 && novo !== i) { l.splice(i, 1); l.splice(novo, 0, x); mudou(); } pintar(); return; }
          const destino = para === 'fav' ? null : v[para];
          if (destino && destino.length >= MAX) { U.toast(T('Até 100 aqui.', 'Up to 100 here.'), { tipo: 'erro' }); pintar(); return; }
          // tira de onde estava
          if (onde === 'fav') v.fav = null; else l.splice(i, 1);
          if (para === 'fav') { const velho = v.fav; v.fav = x; if (velho && l) l.splice(Math.min(i, l.length), 0, velho); } // o favorito antigo vai para o lugar de onde este saiu
          else {
            const ja = x.u ? destino.findIndex((y) => y.u === x.u) : -1; if (ja >= 0) destino.splice(ja, 1); // já estava lá: não duplica
            destino.splice(Math.max(0, Math.min(novo, destino.length)), 0, x);
          }
          mudou(); pintar();
        };
        addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
      });
      return row;
    };
    const linhaItem = (x, l, i, c, onde) => ordenavel(h('div', { class: 'mr-ed-it' }, imagem(x, c),
      h('div', { class: 'cresce mr-ed-tx' }, h('b', {}, x.t), h('small', { class: 'suave' }, [x.a, x.cm ? '💬' : ''].filter(Boolean).join(' · ')), x.n ? estrelas(x.n, 'mini') : null),
      U.btn('', { icone: 'lapis', tipo: 'sec', redondo: true, peq: true, titulo: T('Nota e comentário', 'Rating and comment'), onclick: () => editarItem(x, () => { mudou(); pintar(); }) }),
      // (0.8.7) músicas: escolher o trecho de 30 s que toca (o mesmo jeito da música do perfil)
      c === 'm' && A.perfil && A.perfil.buscarMusica ? U.btn('', { icone: 'ajustes', tipo: x.yt ? 'ok' : 'sec', redondo: true, peq: true, titulo: x.yt ? T('Trocar o trecho', 'Change the clip') : T('Escolher o trecho', 'Pick the clip'),
        onclick: () => A.perfil.buscarMusica((s2) => { if (s2 && s2.yt && s2.yt.length) { x.yt = s2.yt.slice(0, 3); x.ini = s2.inicio | 0; x.dur = s2.duracao | 0; mudou(); pintar(); } }, { ajustar: { fonte: '', nome: x.t, artista: x.a || '', capa: x.c || '', ...(x.yt ? { yt: x.yt, inicio: x.ini, duracao: x.dur } : {}) } }) }) : null,
      U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar', 'Remove'), onclick: () => { if (l) l.splice(i, 1); else cat(c)[onde] = null; mudou(); pintar(); } })), l, i, onde, c);
    // a busca de uma seção (o favorito troca; as listas vão até 20)
    const busca = (c, onde) => {
      const k = CATS[c], campo = h('input', { class: 'campo', type: 'search', maxlength: 300, placeholder: T(...k.busca) }), res = h('div', { class: 'mr-res' });
      const por = (x) => {
        const v = cat(c), novo = { t: x.t, a: x.a || '', c: x.c || '', u: x.u || '', n: 0, cm: '' };
        if (onde === 'fav') v.fav = novo;
        else { if (v[onde].length >= MAX) { U.toast(T('Até 100 aqui.', 'Up to 100 here.'), { tipo: 'erro' }); return; } if (novo.u && v[onde].some((y) => y.u === novo.u)) return; v[onde].push(novo); }
        campo.value = ''; res.replaceChildren(); A.som.tocar('click'); mudou(); pintar();
      };
      let tt = 0, vez = 0;
      campo.addEventListener('input', () => {
        clearTimeout(tt); const q = campo.value.trim(), eu = ++vez;
        if (q.length < 2) { res.replaceChildren(); return; }
        tt = setTimeout(async () => {
          try {
            if (/^https?:\/\//.test(q)) {
              if (!k.link) { res.replaceChildren(h('div', { class: 'peq suave' }, T('Aqui é só pela busca.', 'Search only here.'))); return; }
              const d = await pedir('link?url=' + encodeURIComponent(q)); if (eu !== vez) return;
              if (d.erro) { res.replaceChildren(h('div', { class: 'peq suave' }, d.erro)); return; }
              if ((d.item.k === 'l') !== (c === 'l')) { res.replaceChildren(h('div', { class: 'peq suave' }, c === 'l' ? T('Esse link é de uma música, não de um álbum.', 'That link is a song, not an album.') : T('Esse link é de um álbum, não de uma música.', 'That link is an album, not a song.'))); return; }
              por(d.item); return;
            }
            const d = await pedir('busca?tipo=' + c + '&q=' + encodeURIComponent(q)); if (eu !== vez) return;
            const l = d.itens || [];
            // música/álbum que ainda não saiu: entra só pelo nome
            const semLink = k.q && onde === 'quero' ? h('button', { type: 'button', class: 'mr-op mr-op-nome', onclick: () => por({ t: q.slice(0, 100), a: T('Ainda não lançado', 'Not released yet') }) }, A.icone('mais', 16), h('span', { class: 'cresce' }, T('Pôr "' + q + '" (ainda não lançado)', 'Add "' + q + '" (not released yet)'))) : null;
            res.replaceChildren(...l.map((x) => h('button', { type: 'button', class: 'mr-op', onclick: () => por(x) }, imagem(x, c), h('span', { class: 'cresce' }, h('b', {}, x.t), x.a ? h('small', { class: 'suave' }, x.a) : null))),
              ...(l.length || semLink ? [] : [h('div', { class: 'peq suave' }, T('Nada encontrado.', 'Nothing found.'))]), ...(semLink ? [semLink] : []));
          } catch (e) { if (eu === vez) res.replaceChildren(h('div', { class: 'peq suave' }, T('A busca não respondeu.', 'Search did not answer.'))); }
        }, 380);
      });
      return h('div', { class: 'col mr-busca' }, campo, res);
    };
    // (0.8.7) as abas na ordem da pessoa: segure e arraste uma para o lado para mudar a ordem (a primeira abre primeiro no perfil)
    const pintarAbas = () => { const tinhaFoco = abas.contains(document.activeElement); pintarAbas0(); if (tinhaFoco) { const x = abas.querySelector('.mr-aba-ed.sel'); if (x) x.focus({ preventScroll: true }); } };
    const pintarAbas0 = () => abas.replaceChildren(...ordemDe(m).map((c) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'mr-aba-ed' + (c === atual ? ' sel' : '') + (MU.tem(m, c) ? ' tem' : ''), dados: { c }, 'aria-selected': String(c === atual), title: T('Clique para abrir · segure e arraste para mudar a ordem', 'Click to open · hold and drag to reorder') },
        h('span', { class: 'mr-aba-pega', 'aria-hidden': 'true' }), A.orbe(CATS[c].ic, 30), h('span', { class: 'mr-aba-nome' }, T(...CATS[c].nome)));
      b.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const x0 = e.clientX, y0 = e.clientY, r = b.getBoundingClientRect(), off = { x: x0 - r.left, y: y0 - r.top }; let movendo = false;
        const mover = (ev) => {
          if (!movendo) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; movendo = true; b.classList.add('pegada'); abas.classList.add('ordenando'); A.som.tocar('desgrudar'); }
          b.style.transform = '';
          // em cima de outra aba: troca de lugar com ela
          const outra = [...abas.children].find((o) => { if (o === b) return false; const q = o.getBoundingClientRect(); return ev.clientX > q.left && ev.clientX < q.right && ev.clientY > q.top && ev.clientY < q.bottom; });
          if (outra) { const l = [...abas.children]; abas.insertBefore(b, l.indexOf(b) < l.indexOf(outra) ? outra.nextSibling : outra); A.som.tocar('hover'); }
          const base = b.getBoundingClientRect();
          b.style.transform = `translate(${ev.clientX - off.x - base.left}px, ${ev.clientY - off.y - base.top}px) scale(1.06)`;
        };
        const fim = () => {
          removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
          if (!movendo) return;
          const engolir = (x) => { x.stopPropagation(); x.preventDefault(); }; addEventListener('click', engolir, true); setTimeout(() => removeEventListener('click', engolir, true), 0);
          b.classList.remove('pegada'); abas.classList.remove('ordenando'); b.style.transform = '';
          m.ord = [...abas.children].map((o) => o.dataset.c); A.som.tocar('grudar'); aoMudar(); pintarAbas();
        };
        addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
      });
      b.addEventListener('click', () => { if (atual === c) return; atual = c; MU.abaVista = c; A.som.tocar('click'); pintarAbas(); pintar(); if (aoAba) aoAba(c); });
      return b;
    }));
    const pintar = () => {
      const c = atual, k = CATS[c], v = cat(c);
      // (0.8.7) cada seção tem a alça do lado: segure e arraste para cima ou para baixo para mudar a ordem (vale no perfil também)
      const sec = (onde, tit, filhos) => {
        const pega = h('span', { class: 'mr-sec-pega', title: T('Segure e arraste para mudar a ordem', 'Hold and drag to reorder'), 'aria-hidden': 'true' }, A.icone('arrastar', 14));
        const el = h('div', { class: 'mr-sec mr-ed-sec', dados: { s: onde } }, h('div', { class: 'mr-sec-cab' }, pega, h('b', { class: 'cresce' }, T(...tit)), onde !== 'fav' ? h('small', { class: 'suave' }, String(v[onde].length)) : null), ...filhos, busca(c, onde));
        pega.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return; e.preventDefault();
          const y0 = e.clientY, x0 = e.clientX; let movendo = false, fant = null, off = null;
          const mover = (ev) => {
            if (!movendo) {
              if (Math.abs(ev.clientY - y0) < 5) return; movendo = true; A.som.tocar('desgrudar');
              // (0.8.7) como no Discord: uma cópia da seção vai junto com o mouse; no lugar fica o espaço onde ela vai cair
              const r = el.getBoundingClientRect(); off = { x: x0 - r.left, y: y0 - r.top };
              fant = el.cloneNode(true); fant.classList.add('mr-sec-fantasma'); fant.removeAttribute('data-s'); fant.inert = true;
              Object.assign(fant.style, { width: r.width + 'px', height: r.height + 'px' }); document.body.append(fant);
              el.classList.add('pegada');
            }
            fant.style.transform = `translate(${ev.clientX - off.x}px, ${ev.clientY - off.y}px) rotate(${Math.max(-2, Math.min(2, (ev.clientX - x0) / 60))}deg)`;
            const outra = [...corpo.children].find((o) => { if (o === el) return false; const q = o.getBoundingClientRect(); return ev.clientY > q.top + q.height * 0.25 && ev.clientY < q.bottom - q.height * 0.25; });
            if (outra) { const l = [...corpo.children]; corpo.insertBefore(el, l.indexOf(el) < l.indexOf(outra) ? outra.nextSibling : outra); A.som.tocar('hover'); }
          };
          const fim = () => {
            removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
            if (!movendo) return;
            const r = el.getBoundingClientRect(), f = fant;
            if (f) { f.classList.add('soltando'); f.style.transform = `translate(${r.left}px, ${r.top}px)`; setTimeout(() => { f.remove(); el.classList.remove('pegada'); }, 220); } else el.classList.remove('pegada');
            v.so = [...corpo.children].map((o) => o.dataset.s); A.som.tocar('grudar'); aoMudar();
          };
          addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
        });
        return el;
      };
      const vazia = () => h('div', { class: 'suave peq mr-ed-vazia' }, T('Vazia: não aparece no seu perfil até você pôr algo aqui.', 'Empty: hidden on your profile until you add something.'));
      const secs = {
        fav: () => sec('fav', k.fav, [v.fav ? linhaItem(v.fav, null, 0, c, 'fav') : h('div', { class: 'suave peq mr-ed-vazia' }, T('Escolha um ou arraste um para cá (aparece em destaque).', 'Pick one or drag one here (shown highlighted).'))]),
        gosto: () => sec('gosto', k.gosto, v.gosto.length ? v.gosto.map((x, i) => linhaItem(x, v.gosto, i, c, 'gosto')) : [vazia()]),
        agora: () => sec('agora', k.agora, v.agora.length ? v.agora.map((x, i) => linhaItem(x, v.agora, i, c, 'agora')) : [vazia()]),
        quero: () => sec('quero', k.quero, v.quero.length ? v.quero.map((x, i) => linhaItem(x, v.quero, i, c, 'quero')) : [vazia()]) };
      corpo.replaceChildren(...secoesDe(v, k).map((s) => secs[s]()));
    };
    pintarAbas(); pintar();
    return h('div', { class: 'col', estilo: { gap: '10px' } }, abas, corpo);
  };
  MU.salvar = (m) => API.req('mural', { m, ord: Array.isArray(m.ord) ? m.ord : [] });
})();
