// Aero Stream - perfil: cartão (banner, cores no estilo Nitro, bio, Discord e uma música do Spotify) e o editor do seu.
// O cartão dos amigos também traz: mandar mensagem, ligar, apelido (só você vê), assistir, confiar e remover.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, API = A.api, H = A.hub;
  const P = (A.perfil = {});
  const urlBanner = (cod, v) => (v ? `${API.servidor}/api/banner/${encodeURIComponent(cod)}?v=${v}` : '');
  // (0.8.3) perfis já vistos abrem na hora: a resposta guardada aparece logo e uma nova vem por trás para a próxima vez
  const cachePerfil = new Map(); // codigo -> { p, t, pedido }
  const pedirPerfil = (codigo) => {
    const c = cachePerfil.get(codigo);
    if (c && c.pedido) return c.pedido;
    const pedido = API.req('perfil/' + encodeURIComponent(codigo)).then((p) => { cachePerfil.set(codigo, { p, t: Date.now() }); return p; },
      (e) => { const x = cachePerfil.get(codigo); if (x) { delete x.pedido; if (!x.p) cachePerfil.delete(codigo); } throw e; });
    cachePerfil.set(codigo, { ...(c || {}), pedido });
    return pedido;
  };
  P.buscar = (codigo) => {
    const c = cachePerfil.get(codigo), idade = c && c.p ? Date.now() - c.t : Infinity;
    if (idade < 180000) { if (idade > 10000) pedirPerfil(codigo).catch(() => {}); return Promise.resolve(c.p); }
    return pedirPerfil(codigo);
  };
  P.adiantar = (codigo) => { const c = codigo && cachePerfil.get(codigo); if (!codigo || (c && (c.pedido || Date.now() - c.t < 10000))) return; pedirPerfil(codigo).catch(() => {}); };
  P.esquecer = (codigo) => { if (codigo) cachePerfil.delete(codigo); else cachePerfil.clear(); };
  A.evt.on('perfil', () => { if (API.eu) cachePerfil.delete(API.eu.codigo); });
  const CORES = [['#2d9ee0', '#7fd3ff'], ['#1fb6a6', '#a5f2c8'], ['#8a63e0', '#ff7ac8'], ['#e5533d', '#ffc26b'], ['#3fae2a', '#d7f36b'], ['#0b2a3d', '#2d9ee0'], ['#e0559c', '#ffd1e8'], ['#5d6b7a', '#c9d6e3']];

  // ---------- foto: GIF animado vai como está (até 20 MB, comprimido sem perda no servidor); as outras viram um quadrado de 160 px ----------
  P.prepararFoto = async (f) => {
    if (f.type === 'image/gif' || (await A.ui.animada(f))) { // GIF (ou WebP) animado: vai como está (até 20 MB; o servidor comprime sem perda)
      if (f.size > 20 * 1048576) throw new Error(T('Imagem animada grande demais (máximo 20 MB).', 'Animated image too large (max 20 MB).'));
      return { blob: f, url: URL.createObjectURL(f) };
    }
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(T('Imagem inválida.', 'Invalid image.'))); i.src = URL.createObjectURL(f); });
    const lado = Math.min(img.naturalWidth, img.naturalHeight), cv = h('canvas', { width: 160, height: 160 });
    cv.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 160, 160);
    URL.revokeObjectURL(img.src);
    let url = cv.toDataURL('image/jpeg', 0.85); if (url.length > 60000) url = cv.toDataURL('image/jpeg', 0.6);
    return url;
  };

  // (0.9.6) procurar um GIF direto na foto/banner (como no Discord), sem precisar baixar antes: busca no Klipy, clica e ele vira o arquivo
  P.escolherGif = (titulo) => new Promise((resolver) => {
    const U = A.ui, gifs = A.talk && A.talk.gifs;
    let termo = '', pag = 1, mais = true, carregando = false, serie = 0, pronto = false;
    const busca = h('input', { class: 'campo', type: 'search', placeholder: T('Procurar GIFs', 'Search GIFs'), maxlength: 60, autocomplete: 'off', spellcheck: 'false' });
    const cols = [h('div', { class: 'pf-gif-col' }), h('div', { class: 'pf-gif-col' }), h('div', { class: 'pf-gif-col' })], alt = [0, 0, 0];
    const grade = h('div', { class: 'pf-gif-grade' }, ...cols), aviso = h('p', { class: 'peq suave', hidden: true });
    const m = U.modal(titulo || T('Escolher GIF', 'Choose a GIF'), h('div', { class: 'col', estilo: { gap: '10px' } }, busca, h('div', { class: 'pf-gif-rola' }, grade, aviso)), { largura: 560, classe: 'pf-gif-janela', aoFechar: () => { if (!pronto) resolver(null); } });
    const limpar = () => { cols.forEach((c) => c.replaceChildren()); alt.fill(0); };
    const escolher = async (g, b) => {
      if (b.classList.contains('baixando')) return; b.classList.add('baixando');
      try {
        const r = await fetch(U.imgSegura(g.url) || g.url); if (!r.ok) throw new Error();
        const blob = await r.blob();
        if (blob.size > 20 * 1048576) throw new Error(T('Esse GIF é grande demais (máximo 20 MB).', 'That GIF is too large (max 20 MB).'));
        const tipo = /webp/.test(blob.type) ? 'image/webp' : 'image/gif';
        pronto = true; resolver(new File([blob], 'gif.' + (tipo === 'image/webp' ? 'webp' : 'gif'), { type: tipo })); m.fechar();
      } catch (e) { b.classList.remove('baixando'); U.toast(e.message || T('Não consegui baixar esse GIF.', 'Could not download that GIF.'), { tipo: 'erro' }); }
    };
    const carregar = async (novo) => {
      if (!gifs) { aviso.hidden = false; aviso.textContent = T('A busca de GIFs não está disponível agora.', 'GIF search is not available right now.'); return; }
      if (carregando && !novo) return;
      const n = ++serie; carregando = true;
      if (novo) { pag = 1; limpar(); aviso.hidden = true; }
      try {
        const r = await gifs.buscar(termo, pag); if (n !== serie) return;
        for (const g of r.gifs) {
          const prop = g.w && g.h ? g.h / g.w : 1, i = alt.indexOf(Math.min(...alt));
          const b = h('button', { type: 'button', class: 'pf-gif-it', title: g.titulo || 'GIF', estilo: { 'aspect-ratio': (1 / prop).toFixed(3) }, onclick: () => escolher(g, b) }, h('img', { src: g.prev, alt: g.titulo || 'GIF', loading: 'lazy', draggable: 'false' }));
          cols[i].append(b); alt[i] += prop;
        }
        mais = !!r.mais; pag++;
        if (!grade.querySelector('.pf-gif-it')) { aviso.hidden = false; aviso.textContent = T('Nenhum GIF encontrado.', 'No GIFs found.'); }
      } catch (e) { if (n === serie) { aviso.hidden = false; aviso.textContent = e.message || T('Não deu para buscar GIFs agora.', 'Could not search GIFs now.'); } }
      if (n === serie) carregando = false;
    };
    let t = 0; busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { termo = busca.value.trim(); carregar(true); }, 350); });
    busca.addEventListener('keydown', (e) => e.stopPropagation());
    const rola = grade.parentNode; rola.addEventListener('scroll', () => { if (mais && rola.scrollTop + rola.clientHeight > rola.scrollHeight - 240) carregar(false); }, { passive: true });
    carregar(true); setTimeout(() => busca.focus({ preventScroll: true }), 40);
  });

  // ---------- o cartão ----------
  // (0.5.9-7) a cor do corpo do cartão (embaixo do banner), escolhida pela pessoa: sólida ou degradê. A letra fica clara ou escura
  // conforme o fundo, para dar leitura.
  const claro = (hex) => { const n = parseInt(String(hex).slice(1), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32; };
  const HEX = /^#[0-9a-f]{6}$/i;
  const urlFundo = (cod, v) => (v ? `${API.servidor}/api/fundo/${encodeURIComponent(cod)}?v=${v}` : ''); // (0.8.5) imagem própria do fundo do cartão
  const urlNameplate = (cod, v) => (v ? `${API.servidor}/api/nameplate/${encodeURIComponent(cod)}?v=${v}` : '');
  const mediaCor = (cs) => { const l = cs.map((c) => parseInt(c.slice(1), 16)); const m = (sh) => Math.round(l.reduce((t, n) => t + ((n >> sh) & 255), 0) / l.length); return '#' + [16, 8, 0].map((sh) => m(sh).toString(16).padStart(2, '0')).join(''); };
  // (0.8.0) degradê com quantas cores a pessoa quiser (até 10), no ângulo dela: linear, radial (do centro para fora) ou cônico (girando)
  P.gradiente = (cs, g = 'linear', a = 160) => {
    const c = (cs || []).filter((x) => HEX.test(x)); if (!c.length) return ''; if (c.length === 1) c.push(c[0]);
    // circular: anéis suaves saindo do meio, sem o ponto onde as cores se juntam (o antigo "cônico" vira circular também)
    if (g === 'radial' || g === 'conico') return `radial-gradient(ellipse 85% 85% at 50% 50%, ${c.join(', ')})`;
    return `linear-gradient(${a | 0}deg, ${c.join(', ')})`;
  };
  // o fundo do cartão: automático, uma cor, o degradê, ou o próprio banner (com desfoque e escurecido na medida que a pessoa escolheu).
  // Sem "fd" (perfil salvo antes da 0.8.0): as duas cores antigas (fundo1 -> fundo2). A letra fica clara ou escura conforme o fundo.
  P.fundoDe = (p, banner) => {
    const fd = p.fd;
    const img = fd && fd.t === 'imagem' ? p.fdLocal || urlFundo(p.codigo, p.fdV) : fd && fd.t === 'banner' ? banner : '';
    if (img) return { classe: ' com-fundo fundo-banner fundo-escuro', estilo: { '--fb': `url("${img}")`, '--fb-blur': (fd.blur | 0) + 'px', '--fb-luz': String(Math.max(0, Math.min(100, fd.luz == null ? 45 : fd.luz)) / 100), '--f1': 'rgba(10,20,30,.55)' } };
    if (fd && (fd.t === 'cor' || fd.t === 'degrade') && (fd.c || []).length) {
      const cs = fd.t === 'cor' ? [fd.c[0]] : fd.c;
      return { classe: ' com-fundo ' + (claro(mediaCor(cs)) ? 'fundo-claro' : 'fundo-escuro'), estilo: { '--fbg': fd.t === 'cor' ? cs[0] : P.gradiente(cs, fd.g, fd.a), '--f1': cs[0], '--f2': cs[cs.length - 1] } };
    }
    if (fd && fd.t === 'auto') return { classe: '', estilo: {} };
    if (!HEX.test(p.fundo1 || '')) return { classe: '', estilo: {} };
    const f2 = HEX.test(p.fundo2 || '') ? p.fundo2 : p.fundo1;
    return { classe: ' com-fundo ' + (claro(mediaCor([p.fundo1, f2])) ? 'fundo-claro' : 'fundo-escuro'), estilo: { '--f1': p.fundo1, '--f2': f2 } };
  };
  // (0.8.7) o fundo do Mural: o vidro do Aero (padrão), igual ao fundo do cartão, uma cor, um degradê ou uma imagem própria (com desfoque
  // e escurecido). Volta { bg, img, blur, luz, claro } ou null (vidro)
  const urlFundoMural = (cod, v) => (v ? `${API.servidor}/api/mural-fundo/${encodeURIComponent(cod)}?v=${v}` : '');
  P.fundoMural = (p) => {
    const mf = p && p.mf; if (!mf || !mf.t || mf.t === 'vidro') return null;
    const deCores = (t, cs, g, a) => (cs && cs.length ? { bg: t === 'cor' ? cs[0] : P.gradiente(cs, g, a), claro: claro(mediaCor(t === 'cor' ? [cs[0]] : cs)) } : null);
    if (mf.t === 'imagem') { const img = p.mfLocal || urlFundoMural(p.codigo, p.mfV); return img ? { img, blur: mf.blur | 0, luz: mf.luz == null ? 35 : mf.luz, claro: false } : null; }
    if (mf.t === 'cor' || mf.t === 'degrade') return deCores(mf.t, mf.c, mf.g, mf.a);
    // igual ao cartão
    const fd = p.fd || {};
    if (fd.t === 'imagem' || fd.t === 'banner') { const img = fd.t === 'imagem' ? p.fdLocal || urlFundo(p.codigo, p.fdV) : p.bannerLocal || urlBanner(p.codigo, p.bannerV); if (img) return { img, blur: fd.blur | 0, luz: fd.luz == null ? 45 : fd.luz, claro: false }; }
    if (fd.t === 'cor' || fd.t === 'degrade') { const r = deCores(fd.t, fd.c, fd.g, fd.a); if (r) return r; }
    const c1 = p.cor1 || '#2d9ee0', c2 = p.cor2 || c1;
    return { bg: `linear-gradient(160deg, ${c1}, ${c2})`, claro: claro(mediaCor([c1, c2])) };
  };
  // (0.8.0) nameplate: o fundo do nome da pessoa nas listas (degradê, o banner dela ou uma imagem própria), sumindo para o lado do nome
  P.fundoNameplate = (p) => {
    const np = p && p.np;
    if (!np) return '';
    if (np.t === 'imagem' && p.npV) return `url("${urlNameplate(p.codigo, p.npV)}") center / cover no-repeat`;
    if (np.t === 'banner' && p.bannerV) return `url("${urlBanner(p.codigo, p.bannerV)}") center / cover no-repeat`;
    if (np.t === 'degrade' && (np.c || []).length) return P.gradiente(np.c, np.g, np.a);
    return '';
  };
  const pintarNp = (el, bg) => { el.classList.toggle('com-np', !!bg); if (bg) el.style.setProperty('--np', bg); else el.style.removeProperty('--np'); return el; };
  P.nameplate = (el, p) => pintarNp(el, P.fundoNameplate(p));
  // o seu cartão no fim da lista do Aero Talk: o que a pessoa escolheu mostrar nele. Nameplate: o fundo do nome; Banner: a imagem do
  // banner; Fundo do perfil: o fundo do cartão (cor, degradê ou banner; no automático, o degradê das cores do perfil). Automático: o
  // nameplate, senão o banner, senão o fundo do perfil. "loc": a prévia do editor (banner e nameplate ainda não enviados)
  P.fundoCartaoLista = (el, p, loc = {}) => {
    const modo = ((p && p.pf) || {}).eu || 'auto', banner = loc.banner || urlBanner(p.codigo, p.bannerV);
    const doBanner = () => (banner ? `url("${banner}") center / cover no-repeat` : '');
    const doNp = () => (loc.np !== undefined ? loc.np : P.fundoNameplate(p));
    const doFundo = () => {
      const f = P.fundoDe(p, banner);
      if (f.estilo['--fb']) return doBanner();
      if (f.estilo['--fbg']) return f.estilo['--fbg'];
      if (f.estilo['--f1']) return `linear-gradient(135deg, ${f.estilo['--f1']}, ${f.estilo['--f2']})`;
      return `linear-gradient(135deg, ${p.cor1 || '#2d9ee0'}, ${p.cor2 || p.cor1 || '#7fd3ff'})`;
    };
    const bg = modo === 'nada' ? '' : modo === 'nameplate' ? doNp() : modo === 'banner' ? doBanner() : modo === 'fundo' ? doFundo() : doNp() || doBanner() || doFundo();
    el.classList.toggle('eu-cheio', !!bg && modo !== 'nameplate');
    return pintarNp(el, bg);
  };
  // ---------- (0.8.0) o arranjo do perfil ----------
  // A FOTO fica num dos 9 lugares do cartão (em cima / no meio / embaixo x esquerda / centro / direita). Os WIDGETS (nome, bio, música e
  // Discord) ficam numa grade de verdade: 6 colunas x 8 linhas de quadradinhos pequenos, e cada widget ocupa um retângulo dela (x, y,
  // largura, altura). A grade é sempre a mesma: quadradinho vazio continua ocupando o lugar dele (o que foi posto embaixo fica embaixo) e
  // nada sai do retângulo de ninguém: o que não cabe é comprimido para caber. A foto no centro fica numa faixa da grade (em cima, entre a
  // 4ª e a 5ª linha ou embaixo); do lado, numa coluna própria. O banner fica em cima, embaixo, num lado, cobrindo tudo ou some.
  const LINHAS = ['c', 'm', 'b'], COLS = ['e', 'c', 'd'];
  const ZONAS = [].concat(...LINHAS.map((l) => COLS.map((c) => l + c)));
  // (0.8.7) itens do Mural soltos no cartão (arrastados da prévia do Mural na aba Arranjo): m0..m23, cada um aponta para um item
  const MI = Array.from({ length: 24 }, (_, i) => 'm' + i), ehItem = (k) => /^m\d+$/.test(k);
  const WIDGETS = ['nome', 'bio', 'musica', 'discord', 'lb', 'gl', ...MI], GC = 6, GR = 8;
  // (0.8.7) cartão maior = mais quadradinhos (do mesmo tamanho), não quadradinhos maiores
  const gcDe = (pf) => Math.max(4, Math.min(8, Math.round(((pf && pf.w) || 440) / 73)));
  const grDe = (pf) => (pf && pf.ht ? Math.max(6, Math.min(16, Math.round((pf.ht - 160) / 36))) : GR);
  const meioDe = (pf) => Math.floor(grDe(pf) / 2);
  // (0.8.7) os widgets novos (do Mural e o Letterboxd) só ganham lugar na grade quando a pessoa liga (pf.wf) ou tem o @ do Letterboxd:
  // quem não usa fica com o cartão como sempre foi
  const GRANDES = ['lb'];
  // (0.9.4) a bio vazia também não ocupa lugar: ela não aparece, e o lugar invisível dela travava os outros (o Letterboxd esticado voltava)
  const EXTRAS = ['bio', 'lb', 'gl', ...MI], COMPACTAVEIS = ['bio', 'musica', 'discord', 'gl', ...GRANDES];
  const entre = (v, a, z, pad) => (Number.isFinite(+v) ? Math.max(a, Math.min(z, Math.round(+v))) : pad);
  const COL_AL = { esquerda: 'e', centro: 'c', direita: 'd' }, BPS = ['cima', 'baixo', 'esquerda', 'direita'];
  // o menor retângulo de cada widget (compacto vira uma bolinha: 1 quadradinho basta)
  const minimo = (k, pf) => (ehItem(k) ? { w: 1, h: 2 } : pf.cp.includes(k) ? { w: 1, h: 1 } : GRANDES.includes(k) ? ((pf.ws || {})[k] === 'g' ? { w: 3, h: 2 } : { w: 2, h: 1 }) : k === 'gl' ? { w: 3, h: 2 } : k === 'musica' ? { p: { w: 2, h: 2 }, m: { w: 3, h: 2 }, g: { w: 4, h: 3 } }[pf.ms] : { w: 2, h: 1 });
  const TAM_PADRAO = (k, ms, ws) => (ehItem(k) ? { w: 2, h: 2 } : GRANDES.includes(k) ? ((ws || {})[k] === 'g' ? { w: 6, h: 3 } : { w: 6, h: 2 }) : k === 'nome' ? { w: 6, h: 1 } : k === 'bio' ? { w: 6, h: 2 } : k === 'gl' ? { w: 6, h: 2 } : k === 'discord' ? { w: 4, h: 1 } : { p: { w: 3, h: 3 }, m: { w: 6, h: 3 }, g: { w: 6, h: 5 } }[ms || 'm']);
  const GW_PADRAO = () => ({ nome: { x: 0, y: 0, w: 6, h: 1 }, bio: { x: 0, y: 1, w: 6, h: 2 }, musica: { x: 0, y: 3, w: 6, h: 3 }, discord: { x: 1, y: 6, w: 4, h: 1 }, lb: { x: 0, y: 6, w: 6, h: 2 }, gl: { x: 0, y: 6, w: 6, h: 2 } });
  const TAM_ANTES = {}; // (0.8.7) no editor: o tamanho de cada widget antes de virar bolinha (tirando o compacto, ele volta a ser o que era)
  const PF_PADRAO = () => ({ v: 4, fp: 'cc', gw: GW_PADRAO(), bn: 'faixa', bp: 'cima', cp: [], ms: 'm', w: 440, ht: 0, eu: 'auto' });
  const bate = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // com a foto no meio (centro), a grade é cortada entre a 4ª e a 5ª linha: um widget não pode atravessar a foto
  const fotoNaFaixa = (pf) => pf.fp[1] === 'c' || pf.fo === 'so', fotoNoMeio = (pf) => pf.fp[0] === 'm' && fotoNaFaixa(pf);
  const atravessa = (pf, r) => fotoNoMeio(pf) && r.y < meioDe(pf) && r.y + r.h > meioDe(pf);
  // deixa tudo dentro da grade, do tamanho mínimo, sem atravessar a foto e sem um em cima do outro. O widget "primeiro" (o que a pessoa
  // acabou de mexer) fica onde foi posto; quem estava ali vai para o lugar livre mais perto (ou diminui até caber)
  // (0.8.7) mais esperto: (1) arrastou um widget para cima de outro -> os dois trocam de lugar (o outro vai para onde o primeiro estava);
  // (2) quem ainda estiver no caminho vai para o lugar livre mais PERTO, mesmo que precise diminuir um pouco (antes ele preferia o
  // tamanho inteiro e ia parar do outro lado do cartão); (3) quem não está no caminho não sai do lugar
  // (0.9.4) "novos": quem acabou de aparecer (bio escrita, Letterboxd ligado) entra por último, no lugar livre mais perto, sem tirar ninguém do lugar
  P.ajustarGrade = (pf, primeiro, origem, novos) => {
    const GC = gcDe(pf), GR = grDe(pf), MEIO = meioDe(pf), postos = [];
    const livre = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= GC && r.y + r.h <= GR && !atravessa(pf, r) && !postos.some((o) => bate(o, r));
    const base = (k) => {
      const m = minimo(k, pf), g = pf.gw[k];
      const r = pf.cp.includes(k) ? { w: 1, h: 1 } : { w: entre(g.w, m.w, GC, m.w), h: entre(g.h, m.h, GR, m.h) }; // bolinha: sempre 1 quadradinho
      if (fotoNoMeio(pf)) r.h = Math.min(r.h, MEIO);
      r.x = entre(g.x, 0, GC - r.w, 0); r.y = entre(g.y, 0, GR - r.h, 0);
      if (atravessa(pf, r)) r.y = r.y + r.h / 2 < MEIO ? MEIO - r.h : MEIO;
      return r;
    };
    const ks = WIDGETS.filter((k) => pf.gw[k]);
    // o que foi mexido primeiro; depois quem não bate em ninguém (fica onde está); por último os que estão no caminho, do mais perto ao mais longe
    const R = Object.fromEntries(ks.map((k) => [k, base(k)]));
    const p0 = primeiro && R[primeiro];
    const noCaminho = (k) => p0 && k !== primeiro && bate(R[k], p0);
    const centro = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    // quem ficou sem lugar da última vez (pf._sb, só na memória) continua por último: não tira do lugar quem já estava arrumado
    const sobrou = new Set(pf._sb || []), semLugar = [];
    const fim = (k) => k !== primeiro && ((!!novos && novos.includes(k)) || sobrou.has(k));
    const ordem = [...(p0 ? [primeiro] : []), ...ks.filter((k) => k !== primeiro && !noCaminho(k) && !fim(k)),
      ...ks.filter((k) => noCaminho(k) && !fim(k)).sort((a, b) => { const ca = centro(R[a]), cb = centro(R[b]), cp = centro(p0); return Math.hypot(ca.x - cp.x, ca.y - cp.y) - Math.hypot(cb.x - cp.x, cb.y - cp.y); }), ...ks.filter(fim)];
    // troca: só um no caminho e ele cabe no lugar de onde o primeiro saiu
    const troca = {};
    if (p0 && origem) { const l = ks.filter(noCaminho); if (l.length === 1) troca[l[0]] = { ...R[l[0]], x: Math.max(0, Math.min(GC - R[l[0]].w, origem.x)), y: Math.max(0, Math.min(GR - R[l[0]].h, origem.y)) }; }
    for (const k of ordem) {
      const m = minimo(k, pf), bola = pf.cp.includes(k);
      let r = troca[k] && livre(troca[k]) ? troca[k] : R[k];
      if (!livre(r)) {
        let melhor = null;
        const tams = [];
        for (let ww = r.w, hh = r.h; ;) { tams.push({ w: ww, h: hh }); if (ww <= m.w && hh <= m.h) break; if (ww - m.w >= hh - m.h && ww > m.w) ww--; else if (hh > m.h) hh--; else ww--; }
        for (const t of bola ? [{ w: 1, h: 1 }] : tams) {
          const perda = r.w * r.h - t.w * t.h;
          for (let y = 0; y + t.h <= GR; y++) for (let x = 0; x + t.w <= GC; x++) {
            const c = { x, y, w: t.w, h: t.h }; if (!livre(c)) continue;
            const d = Math.abs(x - r.x) + Math.abs(y - r.y) * 1.2, custo = d * 2 + perda * 1.2;
            if (!melhor || custo < melhor.custo) melhor = { ...c, custo };
          }
        }
        // (0.9.4) não coube nem no menor tamanho: em vez de ficar por cima de outro, vira bolinha num quadradinho livre (se puder ser compacto)
        if (!melhor && !bola && k !== primeiro && COMPACTAVEIS.includes(k)) {
          for (let y = 0; y < GR && !melhor; y++) for (let x = 0; x < GC && !melhor; x++) { const c = { x, y, w: 1, h: 1 }; if (livre(c)) melhor = { ...c, custo: 0 }; }
          if (melhor) { TAM_ANTES[k] = { w: r.w, h: r.h }; pf.cp = [...pf.cp, k]; }
        }
        if (melhor) { delete melhor.custo; r = melhor; } else if (k !== primeiro) { semLugar.push(k); r = { x: r.x, y: r.y, w: Math.min(r.w, bola ? 1 : m.w), h: Math.min(r.h, bola ? 1 : m.h) }; }
      }
      pf.gw[k] = r; postos.push(r);
    }
    if (semLugar.length) pf._sb = semLugar; else delete pf._sb;
    return pf;
  };
  // os arranjos de teste anteriores: grade de 4 x 3 quadradinhos (0.8.0 de teste), 9 lugares, 5 lugares + alinhamento e ordem dos blocos
  function layAntigo(x) {
    const vaz = () => Object.fromEntries(ZONAS.map((z) => [z, []]));
    if (x.lay && typeof x.lay === 'object' && ZONAS.some((z) => Array.isArray(x.lay[z]))) { const l = vaz(); for (const z of ZONAS) l[z] = Array.isArray(x.lay[z]) ? x.lay[z] : []; return l; }
    if (x.lay && typeof x.lay === 'object') {
      const al = (l) => COL_AL[(x.al || {})[l]] || 'c', L = x.lay, l0 = vaz();
      const por = (lista, z) => (Array.isArray(lista) ? lista : []).forEach((k) => l0[z].push(k));
      por(L.topo, 'c' + al('topo')); por(L.esq, 'me'); por(L.meio, 'm' + al('meio')); por(L.dir, 'md'); por(L.baixo, 'b' + al('baixo'));
      x.bp = (L.esq || []).includes('banner') ? 'esquerda' : (L.dir || []).includes('banner') ? 'direita' : (L.baixo || []).includes('banner') ? 'baixo' : 'cima';
      return l0;
    }
    if (Array.isArray(x.ord)) {
      const seq = [].concat(...x.ord.map((k) => (k === 'cab' ? ['foto', 'nome'] : k === 'redes' ? ['discord'] : ['foto', ...WIDGETS].includes(k) ? [k] : [])));
      const col = COL_AL[x.av] || 'c', l0 = vaz();
      for (const k of seq) l0[k === 'foto' || k === 'nome' ? 'c' + col : 'm' + col].push(k);
      x.cp = (x.bio === 'compacta' ? ['bio'] : []).concat(x.rs ? ['musica', 'discord'] : []); x.w = 440 * (+x.tam || 100) / 100;
      return l0;
    }
    return null;
  }
  // quadradinho antigo (3 colunas x 4 linhas) -> retângulo na grade nova, no mesmo lado e na mesma altura
  function gradeDeSlots(sl, ms) {
    const gw = {};
    for (const k of WIDGETS) {
      const n = +sl[k]; if (!Number.isInteger(n) || n < 0 || n > 11) continue;
      const t = TAM_PADRAO(k, ms), col = n % 3;
      gw[k] = { ...t, x: col === 0 ? 0 : col === 2 ? GC - t.w : Math.floor((GC - t.w) / 2), y: Math.floor(n / 3) * 2 };
    }
    return gw;
  }
  function slotsDeLay(lay) {
    const sl = {}, usado = new Set(), R = { c: 0, m: 1, b: 3 };
    for (const z of ZONAS) for (const k of lay[z]) {
      if (!WIDGETS.includes(k) || sl[k] !== undefined) continue;
      const col = COLS.indexOf(z[1]);
      for (let i = 0; i < 4; i++) { const q = ((R[z[0]] + i) % 4) * 3 + col; if (!usado.has(q)) { sl[k] = q; usado.add(q); break; } }
    }
    return sl;
  }
  // (0.8.2) a borda animada do perfil: a do Supporter (coração) ou a do Donator; o desenvolvedor tem a do Supporter
  P.bordaDe = (sl) => (!Array.isArray(sl) ? '' : sl.includes('supporter') || sl.includes('dev') ? 'supporter' : sl.includes('donator') ? 'donator' : '');
  P.arranjoDe = (p) => {
    const x = { ...((p && p.pf) || {}) }, d = PF_PADRAO();
    let pf = d;
    const ms = ['p', 'm', 'g'].includes(x.ms) ? x.ms : 'm';
    if ((x.gw && typeof x.gw === 'object') || x.v === 4) pf = { ...d, fp: ZONAS.includes(x.fp) ? x.fp : 'cc', gw: x.gw && typeof x.gw === 'object' ? x.gw : {} };
    else if (x.sl && typeof x.sl === 'object') pf = { ...d, fp: ZONAS.includes(x.fp) ? x.fp : 'cc', gw: gradeDeSlots(x.sl, ms) };
    else { const lay = layAntigo(x); if (lay) pf = { ...d, fp: ZONAS.find((z) => lay[z].includes('foto')) || 'cc', gw: gradeDeSlots(slotsDeLay(lay), ms) }; }
    if (pf !== d) Object.assign(pf, { bn: ['cheio', 'nenhum'].includes(x.bn) ? x.bn : 'faixa', bp: BPS.includes(x.bp) ? x.bp : 'cima',
      cp: (Array.isArray(x.cp) ? x.cp : []).filter((k, i, l) => COMPACTAVEIS.includes(k) && l.indexOf(k) === i),
      ms, w: entre(x.w, 300, 560, 440), ht: +x.ht > 0 ? entre(x.ht, 300, 800, 0) : 0 });
    if (x.eu) pf.eu = x.eu;
    pf.ws = {}; for (const k of GRANDES) if (x.ws && x.ws[k] === 'g') pf.ws[k] = 'g';
    pf.mi = {}; for (const k of MI) { const r = x.mi && x.mi[k]; if (r && typeof r === 'object' && /^[fsamlbj]$/.test(String(r.k)) && typeof r.t === 'string' && r.t) pf.mi[k] = { k: r.k, t: r.t }; } // (0.8.7) itens do Mural no cartão
    if (x.ba === false) pf.ba = false; // (0.8.2) a borda animada desligada
    if (x.bt === 'donator') pf.bt = 'donator'; // (0.8.2) o Supporter pode usar a borda do Donator
    if (x.fo === 'so') pf.fo = 'so'; // (0.9.6) só a foto vai para o canto (sem coluna própria: o resto do cartão fica igual)
    if (x.si === false) pf.si = false; // (0.9.6) sem insígnias nem selos
    if (Array.isArray(x.so)) { const so = x.so.filter((v, i, l) => typeof v === 'string' && /^[si]:/.test(v) && v.length <= 42 && l.indexOf(v) === i).slice(0, 30); if (so.length) pf.so = so; } // (1.0.0) as insígnias escondidas, uma por uma
    if (['lado', 'esquerda', 'direita'].includes(x.ma)) pf.ma = x.ma; // (0.8.7) esquerda, meio (padrão) ou direita; "lado" é o antigo // (0.8.6) a foto do mini perfil no mesmo lado da do cartão (o padrão é no meio)
    // cópia (o perfil guardado não muda) e todo widget com um retângulo
    const gw = {}, pad = GW_PADRAO(), novos = [];
    for (const k of WIDGETS) {
      if (EXTRAS.includes(k) && !P.temWidget(k, p, pf)) continue; // widget novo desligado
      const r = pf.gw && pf.gw[k]; if (!r || typeof r !== 'object') novos.push(k); gw[k] = r && typeof r === 'object' ? { x: +r.x, y: +r.y, w: +r.w, h: +r.h } : { x: 0, y: 0, ...pad[k], ...TAM_PADRAO(k, pf.ms, pf.ws) };
      if (ehItem(k) && !x.i2 && gw[k].w === 1 && gw[k].h === 2) gw[k].w = 2; // (0.8.7) os itens do Mural de 1 x 2 viram 2 x 2 (uma vez só)
    }
    pf.i2 = 1;
    pf.gw = gw; pf.v = 4; delete pf.sl;
    P.ajustarGrade(pf, null, null, novos);
    pf.av = { e: 'esquerda', c: 'centro', d: 'direita' }[pf.fp[1]]; // de que lado fica a foto
    pf.avMini = pf.ma === 'lado' ? pf.av : pf.ma === 'esquerda' || pf.ma === 'direita' ? pf.ma : 'centro'; // (0.8.6) no mini perfil: no meio, a não ser que a pessoa escolha o mesmo lado do cartão
    pf.bnc = false;
    return pf;
  };
  // (0.8.7) o widget novo aparece? (o do Mural, se a pessoa ligou no cartão; o do Letterboxd, se tem o @)
  P.temWidget = (k, p, pf) => (ehItem(k) ? !!(pf && pf.mi && pf.mi[k]) : k === 'lb' ? !!(p && p.lb) : k === 'gl' ? !!(p && p.gl) : k === 'bio' ? !!(p && p.bio) : true);
  // no editor: quem foi ligado entra na grade (no lugar livre mais perto), quem foi desligado sai
  // (0.9.4) devolve quem acabou de entrar (vai por último no ajustarGrade). Quem sai guarda o retângulo na memória: apagou a bio e escreveu
  // de novo, ela tenta voltar para o mesmo lugar
  const SAIU = {};
  P.acertarExtras = (pf, p) => {
    const novos = [];
    for (const k of EXTRAS) {
      if (!P.temWidget(k, p, pf)) { if (pf.gw[k]) SAIU[k] = { ...pf.gw[k] }; delete pf.gw[k]; }
      else if (!pf.gw[k]) { pf.gw[k] = SAIU[k] ? { ...SAIU[k] } : { x: 0, y: 0, ...GW_PADRAO()[k], ...TAM_PADRAO(k, pf.ms, pf.ws) }; novos.push(k); }
    }
    return novos;
  };
  P.ZONAS = ZONAS; P.WIDGETS = WIDGETS; P.gcDe = gcDe; P.grDe = grDe; P.ehItem = ehItem;
  P.PARTES = { gl: ['guns.lol', 'guns.lol'], foto: ['Foto', 'Photo'], nome: ['Nome', 'Name'], bio: ['Biografia', 'Bio'], musica: ['Música', 'Song'], discord: ['Discord', 'Discord'], ff: ['Filmes favoritos', 'Favorite movies'], fs: ['Séries favoritas', 'Favorite shows'], fa: ['Animes favoritos', 'Favorite anime'], fm: ['Músicas favoritas', 'Favorite songs'], fl: ['Álbuns favoritos', 'Favorite albums'], fj: ['Jogos favoritos', 'Favorite games'], lb: ['Letterboxd', 'Letterboxd'] };
  P.NOME_ZONA = (z) => T({ c: 'Em cima', m: 'No meio', b: 'Embaixo' }[z[0]], { c: 'Top', m: 'Middle', b: 'Bottom' }[z[0]]) + ' · ' + T({ e: 'esquerda', c: 'centro', d: 'direita' }[z[1]], { e: 'left', c: 'center', d: 'right' }[z[1]]);
  const ICONE_PARTE = { foto: 'pessoa', nome: 'lapis', bio: 'chat', musica: 'spotify', discord: 'discord', ff: 'video', fs: 'tela', fa: 'estrela', fm: 'musica', fl: 'disco', fj: 'jogo', lb: 'letterboxd', gl: 'link' };
  // as bolinhas compactas abrem para dentro do cartão: embaixo dela (ou em cima, sem espaço), sem passar das bordas
  function posicionarBolha(b) {
    const corpo = b.closest('.perfil-corpo'), pop = b.querySelector('.pf-bolha-abre'); if (!corpo || !pop) return;
    const rc = corpo.getBoundingClientRect(), rb = b.getBoundingClientRect(), z = rc.width / (corpo.offsetWidth || 1) || 1;
    const W = corpo.clientWidth, Hh = Math.max(corpo.clientHeight, corpo.scrollHeight), pw = Math.max(160, Math.min(290, W - 24));
    pop.style.width = pw + 'px';
    const ph = pop.offsetHeight, bx = (rb.left - rc.left) / z, by = (rb.top - rc.top) / z + corpo.scrollTop, bw = rb.width / z, bh = rb.height / z;
    const esq = Math.max(12, Math.min(bx + bw / 2 - pw / 2, W - pw - 12));
    const embaixo = by + bh + 6 + ph <= Hh - 8 || by - ph - 6 < 8;
    pop.style.left = (esq - bx) + 'px'; pop.style.top = (embaixo ? bh + 6 : -(ph + 6)) + 'px';
    pop.style.transformOrigin = (bx + bw / 2 - esq) + 'px ' + (embaixo ? '0' : '100%');
  }
  // (0.8.0) nada sai do retângulo do widget: o que não cabe é comprimido. Texto (bio) diminui a letra até caber; o resto (nome, música,
  // Discord) é encolhido por inteiro. O nome também cresce quando o retângulo dele é maior. Refeito quando o cartão muda de tamanho.
  const roCaber = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => { for (const e of es) { const c = e.target.closest('.pf-w'); if (c) caberJa(c); } }) : null;
  const pendentesCaber = new Set(); let caberRaf = 0;
  const caberJa = (c) => { pendentesCaber.add(c); if (!caberRaf) caberRaf = requestAnimationFrame(() => { caberRaf = 0; const l = [...pendentesCaber]; pendentesCaber.clear(); for (const x of l) if (x.isConnected) caber(x); }); };
  function caber(cel) {
    const el = cel.firstElementChild; if (!el || cel.classList.contains('compacto')) return;
    const W = cel.clientWidth, Hh = cel.clientHeight; if (!W || !Hh) return;
    const k = cel.dataset.parte, st = el.style;
    if (ehItem(k)) { st.zoom = ''; st.width = ''; return; } // (0.8.7) o item do Mural fica no formato da capa pelo CSS
    if (GRANDES.includes(k)) { st.zoom = ''; st.width = ''; st.maxWidth = ''; return; } // (0.8.7) o Letterboxd se arruma pelo CSS: as capas pela altura do espaço, sem encolher tudo
    if (k === 'bio' && el.classList.contains('perfil-bio')) {
      st.zoom = ''; st.width = '100%'; st.maxHeight = '100%';
      let f = 14; st.fontSize = f + 'px';
      while (f > 8 && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) { f -= 0.5; st.fontSize = f + 'px'; }
      el.classList.toggle('corta', el.scrollHeight > el.clientHeight + 1);
      return;
    }
    const fluido = k === 'discord' || k === 'gl' || GRANDES.includes(k) || ehItem(k) || (k === 'musica' && !el.classList.contains('tam-p'));
    st.zoom = '1'; st.width = fluido ? W + 'px' : ''; st.maxWidth = 'none';
    // (0.8.7) a música nunca espreme o nome: abaixo da largura mínima ela diminui inteira
    const minW = k === 'musica' ? (el.classList.contains('tam-g') ? 250 : el.classList.contains('tam-m') ? 200 : 0) : 0;
    let z = 1;
    if (k === 'nome') {
      st.width = 'max-content';
      z = Math.min(W / Math.max(1, el.offsetWidth), Hh / Math.max(1, el.offsetHeight), 1.5); // o nome enche o retângulo (sem passar dele)
    } else {
      for (let i = 0; i < 4; i++) {
        const hh = el.offsetHeight, ww = el.offsetWidth;
        const nz = Math.min(1, Hh / Math.max(1, hh), fluido ? (minW ? W / minW : 1) : W / Math.max(1, ww));
        if (Math.abs(nz - z) < 0.01 && i) break;
        z = nz; if (fluido) st.width = W / z + 'px';
      }
    }
    z = Math.max(0.3, Math.floor(z * 100) / 100);
    st.zoom = String(z);
  }
  function comprimirAoCaber(conteudo) {
    if (!roCaber) return;
    for (const c of conteudo.querySelectorAll(':scope > .pf-w')) { roCaber.observe(c); if (c.firstElementChild) roCaber.observe(c.firstElementChild); }
  }
  // (0.8.7) as capas passam pelo servidor do Aero (o aparelho de quem vê o perfil não fala com sites de fora)
  P.capa = (c) => (c ? `${API.servidor}/api/capa?u=${encodeURIComponent(c)}` : '');
  const CATS_FAV = { f: ['video', ['Filmes', 'Movies']], s: ['tela', ['Séries', 'Shows']], a: ['estrela', ['Animes', 'Anime']], m: ['musica', ['Músicas', 'Songs']], l: ['disco', ['Álbuns', 'Albums']], j: ['jogo', ['Jogos', 'Games']] };
  const quadrado = (cat) => cat === 'm' || cat === 'l';
  // uma capa com o nome embaixo; clicar abre o link (IMDb, AniList, Spotify, Deezer ou YouTube Music) no navegador
  const capaItem = (x, cat, comNome) => {
    const el = h('div', { class: 'fav-capa' + (quadrado(cat) ? ' q' : ''), title: x.t + (x.a ? ' · ' + x.a : ''), tabindex: x.u ? '0' : null, role: x.u ? 'link' : null },
      h('div', { class: 'fav-img' }, x.c ? h('img', { src: P.capa(x.c), alt: '', loading: 'lazy', draggable: 'false', referrerpolicy: 'no-referrer' }) : A.icone(CATS_FAV[cat] ? CATS_FAV[cat][0] : 'video', 22)),
      comNome ? h('div', { class: 'fav-tx' }, h('b', {}, x.t), x.a ? h('small', {}, x.a) : null) : null);
    if (x.u) { const ir = (e) => { if (e.type === 'keydown' && e.key !== 'Enter') return; if (el.closest('.editando')) return; e.stopPropagation(); A.ui.abrirFora(x.u); }; el.addEventListener('click', ir); el.addEventListener('keydown', ir); }
    return el;
  };
  // (0.8.7) um item do Mural solto no cartão (só a capa, sem rótulo): clicar mostra a nota e o comentário. Vem do Mural (do servidor ou
  // o que está sendo editado agora); o cartão guarda só a categoria e o nome
  function itemMural(ref, mural, dono) {
    const el = h('div', { class: 'pf-item' + (quadrado(ref.k) ? ' q' : ''), title: ref.t, tabindex: '0', role: 'button' }, h('span', { class: 'pf-item-ic' }, A.icone(CATS_FAV[ref.k][0], 20)));
    Promise.resolve(mural).then((m) => {
      const v = (m || {})[ref.k] || {}, x = [v.fav, ...(v.gosto || []), ...(v.quero || [])].find((y) => y && y.t === ref.t);
      if (!x) { el.classList.add('sumiu'); return; }
      if (x.c) el.append(h('img', { src: P.capa(x.c), alt: '', loading: 'lazy', draggable: 'false', referrerpolicy: 'no-referrer', onerror: (e) => e.target.remove() }));
      el.title = x.t + (x.a ? ' · ' + x.a : '');
      const abrir = (e) => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; if (el.closest('.editando')) return; e.preventDefault(); e.stopPropagation(); A.mural.detalhe(x, ref.k, dono); };
      el.addEventListener('click', abrir); el.addEventListener('keydown', abrir);
    }).catch(() => {});
    return el;
  }
  // (0.8.7) widget Letterboxd: os 4 favoritos do perfil de lá, com capa. Clicar abre a janela com os curtidos e os vistos por último
  const cacheLb = new Map();
  const dadosLb = (u) => {
    const c = cacheLb.get(u); if (c && Date.now() - c.em < 600000) return c.p;
    const pr = fetch(`${API.servidor}/api/letterboxd?u=${encodeURIComponent(u)}`, { headers: { Authorization: 'Bearer ' + (API.token || '') } }).then((r) => r.json()).then((d) => { if (d.erro) throw new Error(d.erro); return d; });
    pr.catch(() => cacheLb.delete(u)); cacheLb.set(u, { em: Date.now(), p: pr });
    return pr;
  };
  const estrelas = (n) => (n ? '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') : '');
  const filmeLb = (u, f, extra) => { const x = { t: f.t, a: [f.a, estrelas(f.n), f.l ? '♥' : '', f.r ? '↻' : ''].filter(Boolean).join(' '), c: f.c, u: f.u || (f.s ? `https://letterboxd.com/film/${f.s}/` : '') }; const el = capaItem(x, 'f', true); if (extra) el.append(extra); return el; };
  // (0.9.0) no cartão: quantas capas cabem lado a lado na altura do widget (no mínimo 4) e o tamanho delas, sem sobrar espaço dos lados
  function encaixarLb(grade) {
    if (typeof ResizeObserver !== 'function') return;
    const ajustar = () => {
      if (!grade.isConnected || !grade.closest('.pf-w-lb')) return;
      const itens = [...grade.children].filter((x) => x.classList.contains('fav-capa')); if (!itens.length) return;
      const W = grade.clientWidth, H = grade.clientHeight; if (!W || !H) return;
      const gap = parseFloat(getComputedStyle(grade).columnGap) || 6;
      const n = Math.max(Math.min(4, itens.length), Math.min(itens.length, Math.floor((W + gap) / (H * 2 / 3 + gap))));
      const w = Math.max(16, Math.min((W - (n - 1) * gap) / n, H * 2 / 3));
      itens.forEach((x, i) => { x.hidden = i >= n; });
      grade.style.setProperty('--lb-w', w.toFixed(1) + 'px');
    };
    new ResizeObserver(ajustar).observe(grade); ajustar();
  }
  function letterboxd(u, tam, escolhidos) {
    const meus = Array.isArray(escolhidos) ? escolhidos.slice(0, 4) : []; // (0.8.7) os favoritos escolhidos no editor valem mais
    const g = tam === 'g', grade = h('div', { class: 'fav-grade' }, h('div', { class: 'peq suave' }, T('Carregando...', 'Loading...')));
    const el = h('div', { class: 'perfil-fav perfil-lb' + (g ? ' g' : ''), tabindex: '0', role: 'button', title: T('Ver os curtidos e os vistos por último', 'View liked and recently watched') },
      h('div', { class: 'fav-cab' }, A.icone('letterboxd', 16), h('span', { class: 'cresce' }, 'Letterboxd · @' + u), h('span', { class: 'lb-media' })), grade);
    dadosLb(u).then((d) => {
      // (0.9.0) os favoritos primeiro; sobrando espaço dos lados, entram os vistos por último e os curtidos (as capas ficam do maior tamanho que cabe)
      const vistos = new Set(), l = [...(meus.length ? meus : d.favs), ...d.recentes, ...d.curtidos].filter((f) => { const k = f.s || f.u || f.t; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 10);
      grade.replaceChildren(...(l.length ? l.map((f) => filmeLb(u, f, null)) : [h('div', { class: 'peq suave' }, T('Nenhum filme no Letterboxd ainda.', 'No Letterboxd films yet.'))]));
      if (!g) grade.querySelectorAll('.fav-tx').forEach((x) => x.remove());
      encaixarLb(grade);
      el.querySelector('.lb-media').textContent = d.media ? '★ ' + d.media.toFixed(1) : '';
    }).catch((e) => {
      if (meus.length) { grade.replaceChildren(...meus.map((f) => filmeLb(u, f, null))); if (!g) grade.querySelectorAll('.fav-tx').forEach((x) => x.remove()); encaixarLb(grade); return; }
      grade.replaceChildren(h('div', { class: 'peq suave' }, e.message || T('O Letterboxd não respondeu.', 'Letterboxd did not answer.')));
    });
    const abrir = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (el.closest('.editando') || e.target.closest('.fav-capa[role=link]')) return;
      e.preventDefault(); e.stopPropagation();
      dadosLb(u).catch(() => ({ favs: [], recentes: [], curtidos: [], media: 0 })).then((d) => {
        if (meus.length) d = { ...d, favs: meus };
        const sec = (tit, l) => (l.length ? [h('div', { class: 'rot' }, tit), h('div', { class: 'fav-grade lb-janela-grade' }, ...l.map((f) => filmeLb(u, f, null)))] : []);
        A.ui.modal('Letterboxd · @' + u, h('div', { class: 'col lb-resumo' },
          d.media ? h('div', { class: 'peq suave' }, T('Nota média dos últimos filmes: ', 'Average rating of recent films: ') + '★ ' + d.media.toFixed(1)) : null,
          ...sec(T('Favoritos', 'Favorites'), d.favs), ...sec(T('Vistos por último', 'Recently watched'), d.recentes), ...sec(T('Curtidos', 'Liked'), d.curtidos),
          U2.btn(T('Abrir no Letterboxd', 'Open on Letterboxd'), { icone: 'externo', tipo: 'sec', peq: true, onclick: () => A.ui.abrirFora('https://letterboxd.com/' + u + '/') })), { largura: 560, classe: 'lb-janela' });
      }).catch(() => {});
    };
    el.addEventListener('click', abrir); el.addEventListener('keydown', abrir);
    return el;
  }
  const U2 = { btn: (...a) => A.ui.btn(...a) };
  function cartao(p, { bannerLocal, fotoLocal, verFotos, editor, souEu } = {}) {
    if (!editor && A.extras && A.api.eu && p.codigo === A.api.eu.codigo) p = A.extras.filtrar(p, true); // (1.0.0) o seu: só o que o plano de agora cobre
    const c1 = p.cor1 || '#2d9ee0', c2 = p.cor2 || p.cor1 || '#7fd3ff';
    const banner = bannerLocal || urlBanner(p.codigo, p.bannerV);
    const fundo = P.fundoDe(p, banner), pf = P.arranjoDe(p), cp = new Set(pf.cp), cheio = pf.bn === 'cheio' && !!banner;
    const nomeEl = h('span', { class: 'perfil-nome-txt' }, p.apelido || p.nome);
    A.ui.aplicarNome(nomeEl, p.nm);
    const vazio = (k) => (editor ? h('div', { class: 'pf-vazio', dados: { parte: k } }, T(...P.PARTES[k]), h('small', {}, T(' (vazio)', ' (empty)'))) : null);
    const bolha = (k, ic, conteudo, rot) => h('div', { class: 'pf-bolha ' + k, dados: { parte: k }, tabindex: '0', 'aria-label': rot }, h('span', { class: 'trilho-bola', title: k === 'discord' ? rot : null }, ic), h('div', { class: 'pf-bolha-abre' }, conteudo));
    const discord = p.discord ? h('div', { class: 'perfil-linha' }, h('span', { class: 'perfil-ic discord', title: 'Discord: @' + p.discord }, A.icone('discord', 20)), h('span', { class: 'selecionavel cresce', title: '@' + p.discord }, '@' + p.discord), A.ui.btn('', { icone: 'copiar', tipo: 'sec', redondo: true, peq: true, titulo: T('Copiar usuário do Discord', 'Copy Discord username'), onclick: (e) => A.ui.copiar(p.discord, e.currentTarget) })) : null;
    // (0.9.5) widget do guns.lol: a prévia do link da pessoa (o guns.lol não deixa ler a página, então a prévia é montada aqui)
    const gl = p.gl ? (() => {
      // capa: o banner da pessoa (ou o degradê das cores do perfil), escurecida; por cima a foto com brilho, o nome, um pedaço da bio e o link
      const url = 'https://guns.lol/' + p.gl, bioCurta = (p.bio || '').split('\n')[0].slice(0, 80);
      return h('button', { type: 'button', class: 'perfil-gl', title: url, estilo: { '--gl1': c1, '--gl2': c2, ...(banner ? { '--gl-capa': `url("${banner}")` } : {}) },
        onclick: (e) => { if (editor) return; e.stopPropagation(); A.ui.abrirFora(url); } },
        h('span', { class: 'gl-capa', 'aria-hidden': 'true' }), h('span', { class: 'gl-brilho', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('span', { class: 'gl-av' }, A.ui.avatar(p, 56)),
        h('span', { class: 'gl-txt' }, h('b', {}, p.apelido || p.nome), bioCurta ? h('span', { class: 'gl-bio' }, bioCurta) : null,
          h('span', { class: 'gl-url' }, A.icone('link', 12), 'guns.lol/' + p.gl)),
        h('span', { class: 'gl-ir' }, T('Abrir', 'Open'), A.icone('externo', 12)));
    })() : null;
    const mus = p.spotify ? musica(p.spotify, cp.has('musica') ? 'm' : pf.ms) : null;
    const bioEl = p.bio ? h('div', { class: 'perfil-bio' }, ...(editor ? [p.bio] : A.ui.textoComLinks(p.bio))) : null; // (0.9.5) links clicáveis
    const partes = {
      foto: h('div', { class: 'perfil-av', dados: { parte: 'foto' } }, (() => { const av = A.ui.avatar(p, 92, p.codigo ? A.ui.estadoDe(p.codigo) : undefined); /* (0.8.6) a bolinha de status também no cartão (o seu e o dos outros) */ if (fotoLocal) { const im = av.querySelector('img') || h('img', { alt: '', draggable: 'false' }); im.src = fotoLocal; if (!im.parentNode) av.append(im); } return av; })()),
      nome: h('div', { class: 'perfil-nome', dados: { parte: 'nome' } }, nomeEl, p.apelido ? h('small', { class: 'suave' }, ' (' + p.nome + ')') : null, ' ', p.tag ? h('span', { class: 'tag' }, '#' + p.tag) : null, ' ', A.ui.insignias && pf.si !== false ? A.ui.insignias(p.ins, p.sl, pf.so) : null),
      bio: !bioEl ? null : cp.has('bio') ? bolha('bio', A.icone('chat', 18), bioEl, T('Biografia', 'Bio')) : ((bioEl.dataset.parte = 'bio'), bioEl),
      musica: !mus ? vazio('musica') : cp.has('musica') ? bolha('musica', A.icone('spotify', 22), mus, T('Música do perfil', 'Profile song')) : ((mus.dataset.parte = 'musica'), mus),
      ...Object.fromEntries(MI.filter((k) => pf.mi[k]).map((k) => [k, itemMural(pf.mi[k], p.muralLocal || (p.codigo && A.mural ? A.mural.dados(p.codigo, p.mv) : null), p.apelido || p.nome)])),
      lb: p.lb ? letterboxd(p.lb, (pf.ws || {}).lb) : null,
      gl: !gl ? null : cp.has('gl') ? bolha('gl', A.icone('link', 20), gl, 'guns.lol/' + p.gl) : ((gl.dataset.parte = 'gl'), gl),
      discord: !discord ? vazio('discord') : cp.has('discord') ? bolha('discord', A.icone('discord', 20), discord, 'Discord: @' + p.discord) : ((discord.dataset.parte = 'discord'), discord.classList.add('perfil-discord'), discord),
    };
    // (0.8.7) os widgets do Mural e o do Letterboxd compactos viram bolinha
    for (const k of GRANDES) if (partes[k] && cp.has(k)) partes[k] = bolha(k, A.icone(ICONE_PARTE[k], 20), partes[k], T(...P.PARTES[k]));
    // a grade: 6 colunas x 8 linhas de quadradinhos; a foto no centro ganha uma faixa própria (em cima, no meio ou embaixo) e do lado,
    // uma coluna própria. Cada widget fica no retângulo dele, sempre no mesmo lugar (linha vazia não some)
    const [fl, fc] = pf.fp, lado = !fotoNaFaixa(pf);
    const GC = gcDe(pf), GR = grDe(pf), faixaFoto = lado ? -1 : { c: 0, m: meioDe(pf), b: GR }[fl];
    const linhaDe = (y) => y + 1 + (faixaFoto >= 0 && y >= faixaFoto ? 1 : 0); // linha da grade CSS (a faixa da foto conta como uma)
    const colDe = (x) => x + 1 + (lado && fc === 'e' ? 1 : 0);
    const fotoCx = h('div', { class: 'pf-foto v-' + fl + (lado ? '' : ' h-' + fc) }, partes.foto);
    const filhos = [fotoCx];
    if (lado) Object.assign(fotoCx.style, { gridRow: '1 / -1', gridColumn: fc === 'e' ? '1' : String(GC + 1) });
    else Object.assign(fotoCx.style, { gridRow: String(faixaFoto + 1), gridColumn: '1 / -1' });
    for (const k of WIDGETS) {
      const w = partes[k]; if (!w || !pf.gw[k]) continue;
      // (0.8.4) a bio fica sempre com o texto no meio: antes, perto da direita, o texto grudava na direita (e na esquerda, na esquerda)
      const r = pf.gw[k], cx = r.x + r.w / 2 - GC / 2, al = k === 'bio' ? 'c' : cx < -0.75 ? 'e' : cx > 0.75 ? 'd' : 'c';
      delete w.dataset.parte;
      const cel = h('div', { class: 'pf-w pf-w-' + k + ' al-' + al + (cp.has(k) ? ' compacto' : '') + (k === 'musica' ? ' ms-' + (cp.has('musica') ? 'm' : pf.ms) : ''), dados: { parte: k },
        estilo: { 'grid-column': colDe(r.x) + ' / span ' + r.w, 'grid-row': linhaDe(r.y) + ' / span ' + (r.h + (faixaFoto > r.y && faixaFoto < r.y + r.h ? 1 : 0)) } }, w);
      filhos.push(cel);
    }
    // no editor: os quadradinhos de verdade (os mesmos lugares que os widgets usam), para mirar ao arrastar
    if (editor) for (let y = 0; y < GR; y++) for (let x = 0; x < GC; x++) filhos.push(h('div', { class: 'pf-cel', dados: { x: String(x), y: String(y) }, estilo: { 'grid-column': String(colDe(x)), 'grid-row': String(linhaDe(y)) } }));
    const linhasCss = [];
    for (let y = 0; y <= GR; y++) { if (y === faixaFoto) linhasCss.push('auto'); if (y < GR) linhasCss.push('var(--fila)'); }
    const colsCss = (lado && fc === 'e' ? 'auto ' : '') + 'repeat(' + GC + ', minmax(0, 1fr))' + (lado && fc === 'd' ? ' auto' : '');
    const conteudo = h('div', { class: 'pf-conteudo ' + (lado ? 'lado lado-' + fc : 'centro'), estilo: { 'grid-template-columns': colsCss, 'grid-template-rows': linhasCss.join(' ') } }, ...filhos);
    // o editor move as peças ao vivo com isto (o mesmo cálculo de linha e coluna da grade de cima)
    conteudo.posDe = (r) => ({ col: colDe(r.x) + ' / span ' + r.w, lin: linhaDe(r.y) + ' / span ' + (r.h + (faixaFoto > r.y && faixaFoto < r.y + r.h ? 1 : 0)) });
    comprimirAoCaber(conteudo);
    // o banner: uma faixa em cima, embaixo, na esquerda ou na direita (ou cobrindo tudo, ou nenhum). A foto encostada na faixa fica
    // metade em cima dela
    const faixa = cheio || pf.bn === 'nenhum' ? null : h('div', { class: 'perfil-banner', dados: editor ? { parte: 'banner' } : {}, estilo: banner ? { 'background-image': `url("${banner}")` } : {} });
    const sobre = !faixa ? '' : pf.bp === 'cima' && fl === 'c' ? 'cima' : pf.bp === 'baixo' && fl === 'b' ? 'baixo' : lado && pf.bp === 'esquerda' && fc === 'e' ? 'esquerda' : lado && pf.bp === 'direita' && fc === 'd' ? 'direita' : '';
    if (sobre) fotoCx.classList.add('sobre', 'sobre-' + sobre);
    const corpo = h('div', { class: 'perfil-corpo pf-grade' + (cheio ? ' bn-cheio' : faixa ? ' bn-' + pf.bp : ' bn-nenhum') + (sobre ? ' foto-sobre' : ''), estilo: cheio ? { '--bnf': `url("${banner}")` } : {} }, faixa, conteudo);
    corpo.querySelectorAll('.pf-bolha').forEach((b) => { const ir = () => posicionarBolha(b); b.addEventListener('pointerenter', ir); b.addEventListener('focusin', ir);
      // (0.8.7) já nasce no lugar certo (dentro do cartão): fechada, ela ficava passando da borda e o cartão ganhava rolagem para o lado
      let n = 0; requestAnimationFrame(function f() { if (b.isConnected) posicionarBolha(b); else if (++n < 60) requestAnimationFrame(f); }); });
    // a animação do perfil de quem tem o Donator ou o Supporter: a borda do cartão brilha e gira
    // (0.8.2) quem tem pode desligar a borda (pf.ba === false)
    const tipo0 = P.bordaDe(p.sl), tipoA = tipo0 === 'supporter' && pf.bt === 'donator' ? 'donator' : tipo0, apoio = tipoA && pf.ba !== false ? ' pf-apoio pf-apoio-' + tipoA : '';
    const el = h('div', { class: 'perfil-cartao' + fundo.classe + apoio + ' av-' + pf.av + (pf.ht ? ' alto' : ''), estilo: { '--c1': c1, '--c2': c2, '--pw': pf.w + 'px', '--ph': pf.ht + 'px', ...fundo.estilo } }, corpo);
    if (A.extras) { A.extras.moldura(el.querySelector('.perfil-av .avatar'), p.mo, c1, c2); A.extras.acessorios(el, p.ac, p.codigo); if (verFotos) A.extras.abertura(el, p.ab); } // (1.0.0) moldura, acessórios e a animação de abrir
    // (0.7.2) no perfil aberto: clicar na foto ou no banner mostra a imagem inteira na tela (animada, se for), com zoom; botão direito baixa ou copia
    if (verFotos) {
      const nome = (p.nome || 'aero').replace(/[^\w.-]+/g, '_');
      const av = el.querySelector('.perfil-av .avatar'), urlAv = A.avatarUrl(p.codigo, p.av);
      if (banner && faixa) { faixa.classList.add('ver-foto'); faixa.title = T('Ver o banner', 'View banner'); faixa.addEventListener('click', () => A.ui.verImagem(banner, { nome: nome + '-banner' })); }
      if (av && souEu) { // a sua foto: ver a foto ou editar o perfil
        av.classList.add('ver-foto'); av.title = T('Ver a foto ou editar o perfil', 'View photo or edit profile');
        av.addEventListener('click', (e) => { const r = av.getBoundingClientRect(); A.ui.menuContexto({ clientX: r.left + r.width / 2, clientY: r.bottom + 4, preventDefault() {}, ancora: av }, [
          urlAv ? { texto: T('Ver foto', 'View photo'), icone: 'olho', onclick: () => A.ui.verImagem(urlAv, { nome: nome + '-foto' }) } : null,
          { texto: T('Editar perfil', 'Edit profile'), icone: 'lapis', onclick: souEu }].filter(Boolean)); e.stopPropagation(); });
      } else if (urlAv && av) { av.classList.add('ver-foto'); av.title = T('Ver a foto', 'View photo'); av.addEventListener('click', () => A.ui.verImagem(urlAv, { nome: nome + '-foto' })); }
    }
    return el;
  }
  // o trecho escolhido (0.5.9-3): a música inteira vem do YouTube, tocada por yt.html (no servidor) de "inicio" até inicio + 30 s
  const mmss = (seg) => Math.floor(seg / 60) + ':' + String(Math.floor(seg % 60)).padStart(2, '0');
  // (0.6.0) UM tocador do trecho só, escondido e reaproveitado (yt.html): trocar de música nele é quase instantâneo, e parado ele não gasta
  // nada. Ele é criado na primeira vez que um perfil com música é aberto (depois da animação de abrir) e fica pronto para os próximos.
  let yt = null; // { f, pronto }
  const ouvintesYt = new Set();
  addEventListener('message', (e) => { if (yt && e.source === yt.f.contentWindow && e.data && e.data.aeroYt) ouvintesYt.forEach((f) => f(e.data)); });
  const chaveTrecho = (s) => s.yt.join(',') + '@' + (s.inicio | 0);
  function tocadorYt() {
    if (yt && yt.f.isConnected) return yt;
    const f = h('iframe', { src: `${API.servidor}/yt.html?pre=1&vol=${Math.round(volMusica() * 100)}`, allow: 'autoplay; encrypted-media', title: 'Aero', tabindex: '-1', 'aria-hidden': 'true',
      estilo: { position: 'fixed', left: '-400px', top: '0', width: '200px', height: '200px', border: '0', opacity: '0', 'pointer-events': 'none' } });
    document.body.append(f);
    yt = { f, carregado: '' };
    return yt;
  }
  const mandar = (msg) => { const p = tocadorYt(); const ir = () => { try { p.f.contentWindow.postMessage(msg, '*'); } catch (e) { /* ok */ } }; if (p.f.dataset.ok) ir(); else p.f.addEventListener('load', () => { p.f.dataset.ok = '1'; ir(); }, { once: true }); };
  function aquecer(s) { // deixa o trecho carregado e parado: o play começa na hora
    if (!s || !s.yt || !s.yt.length) return;
    const k = chaveTrecho(s); const p = tocadorYt(); if (p.carregado === k) return;
    p.carregado = k; mandar('carregar:' + s.yt.join(',') + '@' + (s.inicio | 0) + '@pre');
  }
  const esfriar = () => { if (yt) mandar('parar'); };
  function tocarTrecho(s, { aoTempo, aoFim, aoErro }) {
    const p = tocadorYt(); p.carregado = chaveTrecho(s);
    mandar('vol:' + Math.round(volMusica() * 100)); mandar('carregar:' + s.yt.join(',') + '@' + (s.inicio | 0));
    let feito = false, comecou = false, limite = 0;
    const fim = (erro) => { if (feito) return; feito = true; ouvintesYt.delete(ouvir); clearTimeout(limite); clearTimeout(semInicio); mandar('parar'); (erro ? aoErro : aoFim)(); };
    const ouvir = (d) => { if (d.ev === 'tocando') { if (!comecou && parar.depois != null) { parar.pular(parar.depois); parar.depois = null; } comecou = true; } if (d.ev === 'tempo') aoTempo(Math.min(1, d.t / 30)); if (d.ev === 'fim') fim(false); if (d.ev === 'erro') fim(true); };
    ouvintesYt.add(ouvir);
    limite = setTimeout(() => fim(false), 33000); const semInicio = setTimeout(() => { if (!comecou) fim(true); }, 7000); // (0.9.1) o YouTube não começou: vai para a prévia sem esperar tanto
    const parar = () => fim(false);
    parar.vol = (v) => mandar('vol:' + Math.round(v * 100));
    // (0.8.3) pula para um ponto do trecho (0 a 1); ainda carregando, pula assim que começar a tocar
    parar.depois = null;
    parar.pular = (x) => { if (!comecou) { parar.depois = x; return; } mandar('pular:' + (x * 30).toFixed(2)); clearTimeout(limite); limite = setTimeout(() => fim(false), (30 - x * 30) * 1000 + 3000); };
    return parar;
  }
  // tocador de 30 s: o trecho escolhido (YouTube) ou a prévia do Deezer (buscada na hora de tocar: o link dela vence em algumas horas)
  let tocandoAgora = null;
  const volMusica = () => { const v = +A.cfg.v.volMusica; return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.45; }; // os trechos vinham muito altos
  // (0.8.0) a onda da música grande: barrinhas de alturas fixas para cada música (sempre as mesmas), a parte tocada acende
  function ondaDe(nome) {
    let x = 2166136261; for (const ch of String(nome || '')) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
    const alt = []; for (let i = 0; i < 40; i++) { x = Math.imul(x ^ (i + 7), 16777619) >>> 0; const env = 0.55 + 0.45 * Math.sin((i / 39) * Math.PI); alt.push(Math.round((0.28 + 0.72 * ((x % 1000) / 1000)) * env * 100)); }
    const lado = (cls) => h('span', { class: cls }, ...alt.map((v) => h('i', { estilo: { height: Math.max(14, v) + '%' } })));
    return h('div', { class: 'musica-onda', 'aria-hidden': 'true' }, lado('onda-fundo'), lado('onda-cheia'));
  }
  // (0.9.1) o link da prévia de cada música, guardado por 40 min (o do Deezer vence em algumas horas) e pedido uma vez só
  const linksPrevia = new Map();
  function linkPrevia(s) {
    const porId = s.fonte === 'deezer' && /^\d+$/.test(String(s.id || ''));
    const q = [s.nome, s.artista].filter(Boolean).join(' ').slice(0, 100);
    if (!porId && q.length < 2) return Promise.reject(new Error('sem prévia'));
    const k = porId ? 'id:' + s.id : 'q:' + q.toLowerCase();
    const ja = linksPrevia.get(k);
    if (ja && Date.now() - ja.em < 40 * 60000) return ja.p;
    const p = fetch(`${API.servidor}/api/musica/previa?` + (porId ? 'id=' + encodeURIComponent(s.id) : 'q=' + encodeURIComponent(q)), { headers: { Authorization: 'Bearer ' + API.token } })
      .then((r) => r.json()).then((d) => { if (!d.previa) throw new Error(d.erro || 'sem prévia'); return d.previa; });
    linksPrevia.set(k, { p, em: Date.now() });
    p.catch(() => linksPrevia.delete(k));
    if (linksPrevia.size > 80) linksPrevia.delete(linksPrevia.keys().next().value);
    return p;
  }
  function tocador(s, { onda, aoLigar, busca, volLado } = {}) {
    const barra = h('i'), btn = A.ui.btn('', { icone: 'play', redondo: true, peq: true, titulo: T('Ouvir 30 segundos', 'Play 30 seconds') });
    btn.classList.add('musica-play');
    const vol = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(volMusica() * 100), class: 'musica-vol', title: T('Volume da música', 'Song volume'), 'aria-label': T('Volume da música', 'Song volume') });
    vol.addEventListener('click', (e) => e.stopPropagation());
    vol.addEventListener('input', () => { A.cfg.v.volMusica = +vol.value / 100; A.cfg.salvar(); if (audio) audio.volume = volMusica(); if (trecho && trecho.vol) trecho.vol(volMusica()); });
    // (0.6.0) a minutagem exata do ponto que está tocando (no "Ajustar trecho" mostra onde a música está, ex.: 2:23)
    const tempoEl = h('span', { class: 'musica-tempo' }, s.yt && s.yt.length ? mmss(s.inicio || 0) : '0:00');
    const tempoEm = (x) => mmss((s.yt && s.yt.length ? s.inicio || 0 : 0) + x * 30);
    const marcarTempo = (x) => { if (!segurando) tempoEl.textContent = tempoEm(x); };
    let segurando = false; // (0.8.5) arrastando a barra: o que está tocando não puxa a barra de volta
    // (0.8.0) volume compacto: só um iconezinho; clicando, o controle de volume aparece no lugar da barra (nada sai do tocador)
    const volBtn = h('button', { type: 'button', class: 'musica-vol-btn', title: T('Volume da música', 'Song volume'), 'aria-label': T('Volume da música', 'Song volume'), 'aria-expanded': 'false' }, A.icone('volume', 15));
    const meio = h('div', { class: 'musica-meio' }, h('div', { class: 'musica-barra' }, barra), onda ? ondaDe(s.nome + s.artista) : null, busca ? h('span', { class: 'musica-pino', 'aria-hidden': 'true' }) : null, volLado ? null : vol);
    // (0.8.7) médio e grande: o volume abre do lado do botão (a barra só encolhe um pouco, nada fica por cima dela)
    const el = h('div', { class: 'musica-tocador' + (busca ? ' com-busca' : '') + (volLado ? ' vol-lado' : '') }, btn, meio, tempoEl, volLado ? h('span', { class: 'musica-vol-lado' }, vol) : null, volBtn);
    // o andamento (0 a 1) e se está tocando: a barra, a onda e o braço do vinil seguem
    const prog = (x) => { if (segurando) return; progJa(x); };
    const progJa = (x) => { barra.style.transform = `scaleX(${x.toFixed(3)})`; const pm = el.closest('.perfil-musica'); el.style.setProperty('--x', x.toFixed(3)); if (pm) pm.style.setProperty('--x', x.toFixed(3)); };
    // (0.8.0) tocando: se o tocador sair da tela (fechou o perfil, trocou o tamanho do widget, mudou de aba), a música para junto
    let vigia = 0;
    const ligado = (sim) => {
      el.classList.toggle('tocando', sim); const pm = el.closest('.perfil-musica'); if (pm) pm.classList.toggle('tocando', sim); if (aoLigar) aoLigar(sim);
      clearInterval(vigia); vigia = sim ? setInterval(() => { if (!el.isConnected) parar(); }, 300) : 0;
    };
    const abrirVol = (sim) => { el.classList.toggle('vol-aberto', sim); volBtn.setAttribute('aria-expanded', String(sim)); if (sim) setTimeout(() => A.ui.pintarRange && A.ui.pintarRange(vol), 0); };
    volBtn.addEventListener('click', (e) => { e.stopPropagation(); abrirVol(!el.classList.contains('vol-aberto')); });
    volBtn.addEventListener('wheel', (e) => { e.preventDefault(); vol.value = Math.max(0, Math.min(100, +vol.value + (e.deltaY < 0 ? 5 : -5))); vol.dispatchEvent(new Event('input')); A.ui.pintarRange && A.ui.pintarRange(vol); }, { passive: false });
    el.addEventListener('pointerleave', () => abrirVol(false));
    setTimeout(() => A.ui.pintarRange && A.ui.pintarRange(vol), 0);
    let audio = null, trecho = null, previaPronta = null;
    const temTrecho = !!(s.yt && s.yt.length);
    // a prévia do Deezer também já vem buscada (e carregando) quando o mouse chega no botão
    const buscarPrevia = () => {
      // (0.7.14) música que não veio do Deezer (link do Spotify, ou o trecho do YouTube que o dono do vídeo não deixa tocar fora do YouTube):
      // acha a mesma música no Deezer pelo nome e toca a prévia dela, em vez de ficar sem som. (0.9.1) uma ida só ao servidor e o link
      // guardado por um tempo (vale para todos os tocadores da mesma música, no perfil e no Mural)
      if (!previaPronta) previaPronta = linkPrevia(s).then((u) => { const a = new Audio(); a.preload = 'auto'; a.src = u; try { a.load(); } catch (_) { /* ok */ } return a; });
      previaPronta.catch(() => { previaPronta = null; });
      return previaPronta;
    };
    const aquecerJa = () => { if (temTrecho) aquecer(s); else if (s.nome || s.fonte === 'deezer') buscarPrevia().catch(() => {}); };
    // (0.5.9-8) só quando o mouse (ou o controle) chega no play: abrir o tocador do YouTube logo ao abrir o perfil (e a cada letra digitada no
    // editor, que refaz a prévia) era o que mais travava o perfil
    // (0.9.1) já quando o mouse entra no tocador (não só no botão): mais tempo para carregar antes do clique
    el.addEventListener('pointerenter', aquecerJa); btn.addEventListener('focus', aquecerJa); el.addEventListener('touchstart', aquecerJa, { passive: true });
    // (0.9.1) sem trecho: o link da prévia já vem buscado quando o tocador aparece (só o link, leve; o som carrega no mouse/toque)
    if (!temTrecho && (s.nome || s.fonte === 'deezer')) (window.requestIdleCallback || setTimeout)(() => { if (el.isConnected) linkPrevia(s).catch(() => {}); }, { timeout: 1500 });
    // (0.6.0) e logo depois que o perfil termina de abrir (sem pesar na animação): o play já começa tocando
    if (temTrecho) (window.requestIdleCallback || setTimeout)(() => { if (el.isConnected) aquecer(s); }, { timeout: 900 });
    const parar = () => { if (audio) { audio.pause(); audio.currentTime = 0; audio = null; previaPronta = null; } if (trecho) { const t = trecho; trecho = null; t(); } btn.replaceChildren(A.icone('play', 18)); prog(0); ligado(false); if (tocandoAgora === parar) tocandoAgora = null; };
    const previa = async () => {
      btn.replaceChildren(A.icone('parar', 18)); tocandoAgora = parar; ligado(true);
      const a = await buscarPrevia();
      if (tocandoAgora !== parar) return;
      audio = a; audio.volume = volMusica();
      audio.ontimeupdate = () => { const x = audio && audio.duration ? audio.currentTime / audio.duration : 0; prog(x); marcarTempo(x); };
      audio.onended = parar;
      await audio.play();
      if (pularDepois != null) { const x = pularDepois; pularDepois = null; el.pular(x); }
    };
    // (0.8.3) pular para um ponto (0 a 1) do que está tocando; parado, começa a tocar dali
    let pularDepois = null;
    el.pular = (x) => {
      x = Math.max(0, Math.min(0.98, x));
      if (audio && audio.duration) { audio.currentTime = x * audio.duration; prog(x); marcarTempo(x); return; }
      if (trecho && trecho.pular) { trecho.pular(x); prog(x); marcarTempo(x); return; }
      pularDepois = x;
      if (!(tocandoAgora === parar)) btn.click();
      if (trecho && trecho.pular) { pularDepois = null; trecho.pular(x); }
    };
    el.andamento = () => +(el.style.getPropertyValue('--x') || 0);
    el.tempoEm = tempoEm;
    // (0.8.5) médio e grande: clicar ou arrastar na barra (ou na onda) escolhe o ponto do trecho; o tempo mostra para onde vai
    if (busca) {
      meio.title = T('Clique ou arraste para escolher o ponto da música', 'Click or drag to pick the point in the song');
      const xDe = (ev) => { const r = meio.getBoundingClientRect(); return Math.max(0, Math.min(0.98, (ev.clientX - r.left) / (r.width || 1))); };
      meio.addEventListener('pointermove', (ev) => { if (!segurando) meio.style.setProperty('--h', xDe(ev).toFixed(3)); });
      meio.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || el.classList.contains('vol-aberto') || e.target === vol) return;
        e.preventDefault(); e.stopPropagation();
        let x = xDe(e);
        const mostrar = () => { progJa(x); tempoEl.textContent = tempoEm(x); };
        segurando = true; el.classList.add('buscando'); mostrar();
        try { meio.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        const mover = (ev) => { x = xDe(ev); mostrar(); };
        const fim = () => {
          meio.removeEventListener('pointermove', mover); meio.removeEventListener('pointerup', fim); meio.removeEventListener('pointercancel', fim);
          segurando = false; el.classList.remove('buscando'); el.pular(x);
        };
        meio.addEventListener('pointermove', mover); meio.addEventListener('pointerup', fim); meio.addEventListener('pointercancel', fim);
      });
      meio.addEventListener('click', (e) => e.stopPropagation());
    }
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (audio || trecho || tocandoAgora === parar) { parar(); return; }
      if (tocandoAgora) tocandoAgora();
      if (temTrecho) { // o trecho escolhido da música inteira
        btn.replaceChildren(A.icone('parar', 18)); tocandoAgora = parar; ligado(true);
        trecho = tocarTrecho(s, { aoTempo: (x) => { prog(x); marcarTempo(x); }, aoFim: () => { trecho = null; parar(); },
          aoErro: () => { trecho = null; parar(); A.log.aviso('música do perfil: o YouTube não tocou o trecho', s.yt.join(',')); previa().catch(() => { parar(); A.ui.toast(T('Não deu para tocar o trecho agora.', 'Could not play the clip now.'), { tipo: 'erro' }); }); } });
        return;
      }
      if (s.fonte !== 'deezer' && !s.nome) return;
      try { await previa(); } catch (er) { parar(); A.ui.toast(T('Não deu para tocar a prévia agora.', 'Could not play the preview now.'), { tipo: 'erro' }); }
    };
    return el;
  }
  P.tocador = tocador;
  P.pararPrevia = () => { if (tocandoAgora) tocandoAgora(); esfriar(); }; // fechou o perfil: a música para e o tocador pré-carregado some
  // (0.5.9-9) o tocador do Spotify é uma página inteira (outro processo, scripts, fontes): carregar junto com a janela fazia o perfil
  // engasgar no meio da animação de abrir. Ele entra logo depois, no mesmo lugar e do mesmo tamanho (nada pula)
  function spotifyDepois(s) {
    const lugar = h('div', { estilo: { height: '80px', 'border-radius': '12px', background: 'rgba(0,0,0,.15)' } });
    setTimeout(() => { if (lugar.isConnected) lugar.replaceWith(h('iframe', { src: `https://open.spotify.com/embed/track/${s.id}?utm_source=aero&theme=0`, width: '100%', height: '80', frameborder: '0', loading: 'lazy', allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture', title: s.nome + ' — ' + s.artista })); }, 650);
    return lugar;
  }
  // (0.8.0) a música em três jeitos: pequena (um disco de vinil com a capa no meio; tocando, o braço entra no disco e anda até o fim
  // do trecho enquanto ele gira), média (capa, nome e a barra) e grande (a capa grande em cima da própria capa desfocada, com a onda)
  function girador(el) {
    let ang = 0, vel = 0, alvo = 0, raf = 0, ult = 0;
    const g = (sim) => { alvo = sim && document.documentElement.dataset.anim !== 'reduzida' ? 200 : 0; if (!raf) raf = requestAnimationFrame(passo); };
    // (0.8.3) arrastando o braço, o disco gira junto com a mão (para trás voltando, para frente avançando)
    g.empurrar = (d) => { ang = (ang + d + 360) % 360; el.style.rotate = ang.toFixed(2) + 'deg'; };
    const passo = (t) => {
      const dt = ult ? Math.min(0.05, (t - ult) / 1000) : 0; ult = t;
      vel += (alvo - vel) * Math.min(1, dt * (alvo ? 4 : 1.8)); ang = (ang + vel * dt) % 360;
      el.style.rotate = ang.toFixed(2) + 'deg';
      if (el.isConnected && (alvo || vel > 3)) raf = requestAnimationFrame(passo); else { raf = 0; ult = 0; if (!alvo) vel = 0; }
    };
    return g;
  }
  const capaOk = (u) => typeof u === 'string' && /^https:\/\/[^"'()\s\\]+$/.test(u);
  function musica(s, tam = 'm') {
    // Spotify: o tocador oficial (sem login ele toca 30 s). Deezer ou trecho escolhido: o tocador do Aero.
    const deezer = s.fonte === 'deezer', proprio = deezer || (s.yt && s.yt.length);
    const link = deezer ? `https://www.deezer.com/track/${s.id}` : `https://open.spotify.com/track/${s.id}`;
    const capa = () => (s.capa ? h('img', { src: s.capa, alt: '', draggable: 'false' }) : h('span', { class: 'musica-sem-capa' }, A.icone('musica', 20)));
    const selo = () => h('span', { class: 'perfil-ic spotify mini', title: 'Spotify' }, A.icone('spotify', 20));
    const info = () => h('div', { class: 'perfil-musica-info' }, h('b', { title: s.nome }, s.nome), h('small', {}, s.artista || (deezer ? 'Deezer' : 'Spotify')));
    const abrir = () => h('a', { class: 'perfil-musica-abrir', href: link, target: '_blank', rel: 'noopener noreferrer', title: deezer ? T('Abrir no Deezer', 'Open on Deezer') : T('Abrir no Spotify', 'Open on Spotify') }, A.icone('externo', 15));
    if (!proprio) return h('div', { class: 'perfil-musica com-embed' }, spotifyDepois(s), h('div', { class: 'perfil-musica-card' }, h('span', { class: 'musica-capa' }, capa(), selo()), info(), abrir()));
    // (0.8.0) pequena: só o disco (clicar nele toca e para) e o volume, que aparece com o mouse em cima. O giro é feito aqui (não por
    // animação de CSS): ao parar ele vai perdendo velocidade e fica onde parou, sem voltar de uma vez para o começo
    if (tam === 'p') {
      const discoGira = h('span', { class: 'vinil-disco' }, h('span', { class: 'vinil-selo' }, capa()));
      const gira = girador(discoGira), tcP = tocador(s, { aoLigar: gira });
      const nomeTodo = [s.nome, s.artista].filter(Boolean).join(' — ');
      const disco = h('button', { type: 'button', class: 'vinil', title: nomeTodo, 'aria-label': T('Tocar ou parar: ', 'Play or stop: ') + nomeTodo, onclick: (e) => { e.stopPropagation(); tcP.querySelector('.musica-play').click(); } },
        discoGira, h('span', { class: 'vinil-brilho' }), h('span', { class: 'vinil-braco', title: T('Arraste o braço para dentro do disco para avançar (ou gire o disco)', 'Drag the arm into the record to skip ahead (or spin the record)') }, h('i')));
      // (0.8.3) segurar o braço do vinil e arrastar escolhe o ponto da música: para a esquerda (para dentro do disco) avança, para a direita
      // volta. O braço segue a mão, o disco gira junto e, soltando, a música continua dali (parada, começa a tocar dali)
      // (0.8.5) mais fácil de mexer: (1) o braço se arrasta em qualquer direção (para dentro do disco avança, para fora volta) e bem
      // menos sensível; (2) girar o próprio disco com o mouse, como um DJ, também escolhe o ponto (uma volta = o trecho inteiro).
      // Enquanto mexe, um anel em volta do disco e o tempo no meio mostram para onde a música vai; soltando, ela continua dali
      const braco = disco.querySelector('.vinil-braco');
      const dica = h('span', { class: 'vinil-dica', 'aria-hidden': 'true' });
      disco.append(h('span', { class: 'vinil-anel', 'aria-hidden': 'true' }), dica);
      const engolirClique = () => { const engolir = (x2) => { x2.stopPropagation(); x2.preventDefault(); }; addEventListener('click', engolir, true); setTimeout(() => removeEventListener('click', engolir, true), 0); };
      const arrastar = (e, alvo, calcular) => {
        const pm = alvo.closest('.perfil-musica'), a0 = pm.classList.contains('tocando') ? tcP.andamento() : 0;
        let x = a0, moveu = false;
        const x0 = e.clientX, y0 = e.clientY;
        try { alvo.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        const mostrar = () => { pm.style.setProperty('--x', x.toFixed(3)); dica.textContent = tcP.tempoEm(x); };
        const mover = (ev) => {
          if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
          if (!moveu) { moveu = true; pm.classList.add('braco-arrastando'); }
          x = Math.max(0, Math.min(0.98, calcular(ev, a0)));
          mostrar();
        };
        const fim = () => {
          alvo.removeEventListener('pointermove', mover); alvo.removeEventListener('pointerup', fim); alvo.removeEventListener('pointercancel', fim);
          pm.classList.remove('braco-arrastando');
          if (moveu) { engolirClique(); tcP.pular(x); } else if (alvo === braco) tcP.querySelector('.musica-play').click();
        };
        alvo.addEventListener('pointermove', mover); alvo.addEventListener('pointerup', fim); alvo.addEventListener('pointercancel', fim);
      };
      braco.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, y0 = e.clientY; let ultX = x0, ultY = y0;
        // o braço sai do canto de cima à direita: o caminho até o centro do disco é para a esquerda e para baixo
        arrastar(e, braco, (ev, a0) => {
          gira.empurrar(((ultX - ev.clientX) + (ev.clientY - ultY)) * 1.5); ultX = ev.clientX; ultY = ev.clientY;
          return a0 + ((x0 - ev.clientX) * 0.75 + (ev.clientY - y0) * 0.65) / 150;
        });
      });
      disco.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || braco.contains(e.target)) return;
        const r = disco.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ang = (ev) => Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
        let ult = ang(e), soma = 0;
        arrastar(e, disco, (ev, a0) => {
          const a = ang(ev); let d = a - ult; if (d > 180) d -= 360; if (d < -180) d += 360; ult = a;
          if (Math.hypot(ev.clientX - cx, ev.clientY - cy) > 6) { soma += d; gira.empurrar(d); }
          return a0 + soma / 360;
        });
      });
      const aquecerP = () => tcP.querySelector('.musica-play').dispatchEvent(new Event('pointerenter'));
      disco.addEventListener('pointerenter', aquecerP); disco.addEventListener('focus', aquecerP);
      const raizP = h('div', { class: 'perfil-musica tam-p' }, disco, h('div', { class: 'vinil-lado' }, tcP));
      // (0.8.0) só o disco: com o mouse em cima o volume aparece direto do lado, sem precisar abrir
      // some com um pequeno atraso (passar o mouse pela borda não fecha) e nunca no meio de um arraste; a rodinha em cima do disco também muda o volume
      const volEl = tcP.querySelector('.musica-vol');
      let fechaP = 0, arrastando = false;
      const volP = (sim) => { clearTimeout(fechaP); if (!sim && arrastando) return; tcP.classList.toggle('vol-aberto', sim); if (sim && volEl && A.ui.pintarRange) A.ui.pintarRange(volEl); };
      raizP.addEventListener('pointerenter', () => volP(true)); raizP.addEventListener('pointerleave', () => { clearTimeout(fechaP); fechaP = setTimeout(() => volP(false), 450); });
      if (volEl) volEl.addEventListener('pointerdown', () => { arrastando = true; addEventListener('pointerup', () => { arrastando = false; if (!raizP.matches(':hover')) volP(false); }, { once: true }); });
      raizP.addEventListener('wheel', (e) => { if (!volEl) return; e.preventDefault(); volP(true); volEl.value = Math.max(0, Math.min(100, +volEl.value + (e.deltaY < 0 ? 5 : -5))); volEl.dispatchEvent(new Event('input')); A.ui.pintarRange && A.ui.pintarRange(volEl); }, { passive: false });
      raizP.addEventListener('focusin', () => volP(true)); raizP.addEventListener('focusout', (e) => { if (!raizP.contains(e.relatedTarget)) volP(false); });
      return raizP;
    }
    const tc = tocador(s, { onda: tam === 'g', busca: true, volLado: true });
    if (tam === 'g') return h('div', { class: 'perfil-musica tam-g', estilo: capaOk(s.capa) ? { '--capa': `url("${s.capa}")` } : {} },
      h('div', { class: 'grande-topo' }, h('span', { class: 'musica-capa grande' }, capa(), selo()), h('div', { class: 'grande-info' }, info(), abrir())), tc);
    return h('div', { class: 'perfil-musica tam-m' }, h('div', { class: 'perfil-musica-card' }, h('span', { class: 'musica-capa' }, capa(), selo()), info(), abrir()), tc);
  }
  P.cartao = cartao;

  // ---------- o menu do botão direito de uma pessoa (Conexões, amigos, membros do grupo) ----------
  // grupo: { c (a conversa), agir(acao) } quando o menu é de um membro de grupo (mostra o que o seu papel permite)
  // extras: itens que vêm primeiro (ex.: "Fixar" na lista de conversas)
  P.amizade = async (p, acao) => {
    P.esquecer(p && p.codigo);
    try {
      await API.amigos[acao](p.codigo); A.som.tocar(acao === 'aceitar' ? 'sucesso' : 'bolha');
      A.ui.toast(acao === 'aceitar' ? T('Agora vocês são amigos.', 'You are friends now.') : T('Pedido de amizade enviado para ', 'Friend request sent to ') + (p.nome || '#' + p.tag) + '.', { tipo: 'ok', ms: 2600 });
      return true;
    } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); return false; }
  };
  P.menu = (ev, p, { grupo, extras = [] } = {}) => {
    const U = A.ui, eu = API.eu || {}, souEu = p.codigo === eu.codigo;
    const amigo = H.amigos.find((x) => x.codigo === p.codigo && x.estado === 'aceita');
    const it = [...extras, ...(extras.length ? [null] : []), { texto: T('Perfil', 'Profile'), icone: 'pessoa', onclick: () => P.ver(p.codigo) }];
    if (!souEu && amigo && A.talk) {
      it.push({ texto: T('Mensagem', 'Message'), icone: 'chat', onclick: async () => { const c = await A.talk.abrirDM(p.codigo); A.talk.irPara(c.id); } });
      it.push({ texto: T('Iniciar chamada', 'Start call'), icone: 'telefone', onclick: async () => A.talk.ligar(await A.talk.abrirDM(p.codigo), false) });
      if (A.plat.camera) it.push({ texto: T('Chamada de vídeo', 'Video call'), icone: 'video', onclick: async () => A.talk.ligar(await A.talk.abrirDM(p.codigo), true) });
      it.push({ texto: T('Mudar apelido', 'Change nickname'), icone: 'lapis', onclick: () => P.ver(p.codigo) });
    }
    // (0.6.9) mencionar a pessoa na conversa aberta
    if (!souEu && A.talk && A.talk.podeMencionar && A.talk.podeMencionar()) it.push({ texto: T('Mencionar', 'Mention'), icone: 'responder', onclick: () => A.talk.mencionar({ codigo: p.codigo, nome: p.apelido || p.nome }) });
    // (0.6.0) pedir amizade direto pelo menu (ou aceitar o pedido que a pessoa mandou)
    if (!souEu && !amigo && p.codigo) {
      const est = (H.amigos.find((x) => x.codigo === p.codigo) || {}).estado;
      if (est === 'recebido') it.push({ texto: T('Aceitar pedido de amizade', 'Accept friend request'), icone: 'mais', onclick: () => P.amizade(p, 'aceitar') });
      else if (est !== 'enviado') it.push({ texto: T('Adicionar amigo', 'Add friend'), icone: 'mais', onclick: () => P.amizade(p, 'pedir') });
    }
    if (p.tag) it.push({ texto: T('Copiar #', 'Copy #') + p.tag, icone: 'copiar', onclick: () => U.copiar('#' + p.tag) });
    // (0.5.9-6) o ID fixo da conta: só o desenvolvedor vê (o servidor só manda para ele)
    if (eu.cargo === 'dev' && p.codigo) it.push({ texto: T('Copiar ID', 'Copy ID'), icone: 'copiar', onclick: async () => { try { const d = await API.req('perfil/' + encodeURIComponent(p.codigo)); if (d.uid) U.copiar(d.uid); else U.toast(T('Sem ID.', 'No ID.'), { tipo: 'erro' }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } });
    if (grupo && !souEu && p.papel !== 'dono') {
      const meu = grupo.c.meuPapel, dono = meu === 'dono';
      const extra = [];
      if (dono) extra.push({ texto: p.papel === 'admin' ? T('Tirar admin', 'Remove admin') : T('Tornar admin', 'Make admin'), icone: 'escudo', onclick: () => grupo.agir(p.papel === 'admin' ? 'membro' : 'admin', p) });
      if (dono || (meu === 'admin' && p.papel === 'membro')) {
        extra.push({ texto: p.semChamada ? T('Liberar chamadas', 'Allow calls') : T('Bloquear chamadas', 'Block calls'), icone: 'telefone', onclick: () => grupo.agir(p.semChamada ? 'comChamada' : 'semChamada', p) });
        extra.push({ texto: T('Remover do grupo', 'Remove from group'), icone: 'sair', perigo: true, onclick: async () => { if (await U.confirmar(T('Remover ', 'Remove ') + (p.apelido || p.nome) + T(' do grupo?', ' from the group?'), { perigo: true })) grupo.agir('remover', p); } });
      }
      if (extra.length) it.push(null, ...extra);
    }
    if (!souEu) {
      it.push(null);
      if (amigo) it.push({ texto: T('Desfazer amizade', 'Unfriend'), icone: 'lixo', perigo: true, onclick: async () => { if (await U.confirmar(T('Desfazer a amizade com ', 'Unfriend ') + p.nome + '?', { perigo: true })) { try { await API.amigos.remover(p.codigo); A.som.tocar('estourar'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } } });
      const bloq = ((API.eu && API.eu.bloqueados) || []).includes(p.codigo);
      it.push({ texto: bloq ? T('Desbloquear', 'Unblock') : T('Bloquear', 'Block'), icone: 'bloquear', perigo: !bloq, onclick: () => P.bloquear(p, !bloq) });
      it.push({ texto: T('Denunciar', 'Report'), icone: 'bandeira', perigo: true, onclick: () => A.admin && A.admin.denunciar(p) });
    }
    return U.menuContexto(ev, it);
  };

  // ---------- bloquear (0.6.0): a pessoa não vê o seu perfil, não manda pedido de amizade e ninguém vê as mensagens do outro ----------
  P.bloquear = async (p, sim) => {
    P.esquecer(p && p.codigo);
    const U = A.ui;
    if (sim && !(await U.confirmar(h('div', {}, h('p', { estilo: { margin: '0 0 6px', 'font-size': '17px' } }, T('Bloquear ', 'Block ') + (p.apelido || p.nome) + '?'), h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Vocês deixam de ser amigos, a pessoa não vê o seu perfil nem consegue te mandar pedido de amizade, e nenhum dos dois vê as mensagens do outro.', 'You stop being friends, they cannot see your profile or send you a friend request, and neither of you sees the other\'s messages.'))), { sim: T('Bloquear', 'Block'), perigo: true }))) return false;
    try {
      await API.req('bloquear', { codigo: p.codigo, sim });
      if (API.eu) API.eu.bloqueados = sim ? [...new Set([...(API.eu.bloqueados || []), p.codigo])] : (API.eu.bloqueados || []).filter((x) => x !== p.codigo);
      A.som.tocar(sim ? 'estourar' : 'bolha'); U.toast(sim ? T('Bloqueado.', 'Blocked.') : T('Desbloqueado.', 'Unblocked.'), { ms: 2000 });
      if (A.talk) A.talk.carregar().catch(() => {});
      return true;
    } catch (e) { U.toast(e.message, { tipo: 'erro' }); return false; }
  };

  // ---------- (1.0.2) compartilhar o perfil: um link (e o QR dele) que abre o perfil no Aero ----------
  P.linkDe = (p) => 'https://web.aerostream.workers.dev/app/?perfil=' + encodeURIComponent(p.codigo);
  P.compartilhar = (p) => {
    const U = A.ui, link = P.linkDe(p), nome = p.apelido || p.nome;
    const texto = T('Me encontre no Aero: ', 'Find me on Aero: ') + (p.tag ? '#' + p.tag + ' ' : '');
    const qr = A.qr ? A.qr(link, 190) : null; if (qr) qr.classList.add('perfil-qr');
    const campo = h('input', { class: 'campo', value: link, readonly: true, onfocus: (e) => e.target.select() });
    const botoes = h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap', 'justify-content': 'center' } },
      U.btn(T('Copiar link', 'Copy link'), { icone: 'copiar', onclick: () => U.copiar(link) }),
      p.tag ? U.btn(T('Copiar #', 'Copy #') + p.tag, { icone: 'copiar', tipo: 'sec', onclick: () => U.copiar('#' + p.tag) }) : null,
      navigator.share ? U.btn(T('Enviar...', 'Send...'), { icone: 'enviar', tipo: 'sec', onclick: () => navigator.share({ title: nome, text: texto, url: link }).catch(() => {}) }) : null);
    U.modal(T('Compartilhar o perfil', 'Share profile'), h('div', { class: 'col perfil-compartilhar', estilo: { gap: '12px', 'align-items': 'center' } },
      h('p', { class: 'peq suave', estilo: { margin: 0, 'text-align': 'center' } }, T('Quem abrir o link (ou ler o QR com a câmera) cai direto no perfil de ', 'Whoever opens the link (or scans the QR) lands right on the profile of ') + nome + '.'),
      qr, campo, botoes), { largura: 400 });
  };
  { // abriu o Aero por um link de perfil
    const cod = new URLSearchParams(location.search).get('perfil');
    if (cod && /^[\w-]{1,32}$/.test(cod)) { try { history.replaceState(null, '', location.pathname); } catch (_) { /* ok */ } const tira = A.evt.on('hub:conectou', () => { tira(); setTimeout(() => P.ver(cod), 900); }); }
  }

  // ---------- (1.0.2) perfil exclusivo: a bio e as cores que só um amigo vê ----------
  P.editarExclusivo = (p) => {
    const U = A.ui, x = p.meuExc || {}, eu = API.eu || {};
    const bio = h('textarea', { class: 'campo', rows: 4, maxlength: 190, placeholder: T('A bio que só ', 'The bio only ') + (p.apelido || p.nome) + T(' vê', ' sees') }); bio.value = x.bio || '';
    const cor = (k, pad) => h('input', { type: 'color', class: 'perfil-cor', value: x[k] || pad, 'aria-label': k === 'cor1' ? T('Cor principal', 'Main color') : T('Segunda cor', 'Second color') });
    const c1 = cor('cor1', eu.cor1 || '#2d9ee0'), c2 = cor('cor2', eu.cor2 || '#7fd3ff');
    const usarCores = U.chave(!!(x.cor1 || x.cor2), (v) => { coresL.classList.toggle('apagado', !v); });
    const coresL = h('div', { class: 'linha' + (x.cor1 || x.cor2 ? '' : ' apagado'), estilo: { gap: '10px' } }, c1, c2);
    const salvar = async (apagar) => {
      try {
        P.esquecer(p.codigo);
        const d = await API.req('perfil/exclusivo', apagar ? { codigo: p.codigo, apagar: true } : { codigo: p.codigo, bio: bio.value, ...(usarCores.checked !== false && !coresL.classList.contains('apagado') ? { cor1: c1.value, cor2: c2.value } : {}) });
        p.meuExc = d.meuExc || undefined; A.som.tocar('sucesso'); m.fechar();
        U.toast(apagar ? T('Agora ela vê o seu perfil público.', 'They now see your public profile.') : T('Pronto: só ela vê esse perfil.', 'Done: only they see this profile.'), { tipo: 'ok', ms: 2600 });
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    };
    const m = U.modal(T('Perfil para ', 'Profile for ') + (p.apelido || p.nome), h('div', { class: 'col', estilo: { gap: '10px' } },
      h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Ela vê o seu perfil com esta bio e estas cores, e pode trocar para o público quando quiser. O resto do perfil continua igual.', 'They see your profile with this bio and colors, and can switch to the public one anytime. The rest stays the same.')),
      bio, h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Cores só para ela', 'Colors just for them')), usarCores), coresL), {
      largura: 420,
      acoes: [...(p.meuExc ? [{ texto: T('Apagar', 'Delete'), tipo: 'perigo', onclick: () => salvar(true) }] : []), { texto: T('Salvar', 'Save'), onclick: () => salvar(false) }],
    });
  };

  // ---------- ver o perfil de alguém ----------
  P.ver = async (codigo) => {
    const U = A.ui;
    const souEu = !!(API.eu && codigo === API.eu.codigo); // (0.8.0) o seu perfil abre igual os outros veem; a sua foto dá "ver" ou "editar"
    let p; try { p = await P.buscar(codigo); } catch (e) { U.toast(e.message, { tipo: 'erro' }); return; }
    if (p.bloqueado) { // você bloqueou: só o nome e o botão de desbloquear
      const m0 = U.modal(p.nome, h('div', { class: 'col', estilo: { gap: '10px', 'align-items': 'center' } }, h('p', { class: 'suave' }, T('Você bloqueou esta pessoa.', 'You blocked this person.')), U.btn(T('Desbloquear', 'Unblock'), { tipo: 'sec', onclick: async () => { if (await P.bloquear(p, false)) { m0.fechar(); P.ver(codigo); } } })), { largura: 380 });
      return;
    }
    const a = H.amigos.find((x) => x.codigo === codigo);
    const amigoOk = p.amizade === 'aceita';
    const ds = H.dispositivosDe(codigo).find((d) => d.sala);
    const apelido = h('input', { class: 'campo', placeholder: T('Apelido (só você vê)', 'Nickname (only you see it)'), maxlength: 32, value: p.apelido || '' });
    apelido.value = p.apelido || '';
    const acoes = h('div', { class: 'linha perfil-acoes' });
    let m = null;
    const ir = (f) => async () => { m.fechar(); try { await f(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
    if (amigoOk && A.talk) {
      acoes.append(U.btn(T('Mensagem', 'Message'), { icone: 'chat', onclick: ir(async () => { const c = await A.talk.abrirDM(codigo); A.talk.irPara(c.id); }) }),
        U.btn('', { icone: 'telefone', tipo: 'sec', redondo: true, titulo: T('Ligar', 'Call'), onclick: ir(async () => A.talk.ligar(await A.talk.abrirDM(codigo), false)) }),
        A.plat.camera ? U.btn('', { icone: 'video', tipo: 'sec', redondo: true, titulo: T('Chamada de vídeo', 'Video call'), onclick: ir(async () => A.talk.ligar(await A.talk.abrirDM(codigo), true)) }) : null);
    }
    else if (p.podeMensagem && A.talk) acoes.append(U.btn(T('Mensagem', 'Message'), { icone: 'chat', onclick: ir(async () => { const c = await A.talk.abrirDM(codigo); A.talk.irPara(c.id); }) })); // (0.6.0) quem não é amigo, se a pessoa aceita mensagens/pedidos
    // (0.6.0) quem ainda não é amigo: pedir amizade (ou aceitar o pedido) pelo próprio perfil
    if (!amigoOk && !(API.eu && codigo === API.eu.codigo)) {
      const est = p.amizade || (a && a.estado);
      if (est === 'enviado') { const b = U.btn(T('Pedido enviado', 'Request sent'), { icone: 'relogio', tipo: 'sec' }); b.disabled = true; acoes.append(b); }
      else {
        const b = U.btn(est === 'recebido' ? T('Aceitar pedido', 'Accept request') : T('Adicionar amigo', 'Add friend'), { icone: 'mais', tipo: 'ok', onclick: async () => { if (await P.amizade(p, est === 'recebido' ? 'aceitar' : 'pedir')) { b.disabled = true; b.lastChild.textContent = est === 'recebido' ? T('Amigos', 'Friends') : T('Pedido enviado', 'Request sent'); } } });
        acoes.append(b);
      }
    }
    // (0.8.6) offline: há quanto tempo a pessoa esteve online (se as duas deixam)
    const vistoTx = !souEu && p.visto ? (!H.online(codigo) ? A.ui.vistoHa(p.visto) : p.vm === 'atividade' && Date.now() - p.visto > 600000 ? A.ui.ativoHa(p.visto) : '') : '';
    if (souEu) acoes.append(U.btn(T('Editar perfil', 'Edit profile'), { icone: 'lapis', onclick: ir(() => P.editar()) }));
    acoes.append(U.btn('', { icone: 'link', tipo: 'sec', redondo: true, titulo: T('Compartilhar o perfil', 'Share profile'), onclick: () => P.compartilhar(p) })); // (1.0.2)
    const extras = h('div', { class: 'col', estilo: { gap: '10px', 'margin-top': '12px' } });
    if (vistoTx) extras.append(h('div', { class: 'perfil-visto peq suave' }, A.icone('relogio', 14), vistoTx));
    if (!souEu && A.aparelhos) extras.append(A.aparelhos.vivo(codigo, { rotulo: true, tam: 15 })); // (1.0.2) os aparelhos conectados agora
    if (amigoOk) {
      extras.append(h('div', { class: 'linha' }, apelido, U.btn(T('Salvar', 'Save'), { peq: true, tipo: 'sec', onclick: async () => { try { P.esquecer(codigo); await API.req('apelido', { codigo, apelido: apelido.value }); U.toast(T('Apelido salvo.', 'Nickname saved.'), { tipo: 'ok', ms: 2000 }); A.talk && A.talk.carregar().catch(() => {}); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } })));
      if (a) extras.append(h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Entra na minha tela sem pedir', 'Joins my screen without asking')), U.chave(a.confia, (v) => API.amigos.confianca(codigo, v).catch((e) => U.toast(e.message, { tipo: 'erro' })))));
      // (0.6.0) avisar quando ESTA pessoa ficar online (o aviso deixou de ser para todo mundo)
      extras.append(h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Avisar quando ficar online', 'Notify me when they come online')), U.chave(!!p.avisarOnline, (v) => { P.esquecer(codigo); API.req('amigos/avisar-online', { codigo, sim: v }).catch((e) => U.toast(e.message, { tipo: 'erro' })); })));
      extras.append(h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, h('div', {}, T('Perfil só para esta pessoa', 'Profile just for this person')), h('small', { class: 'suave' }, p.meuExc ? T('Ela vê a bio e as cores que você fez para ela.', 'They see the bio and colors you made for them.') : T('Uma bio e cores que só ela vê (Supporter).', 'A bio and colors only they see (Supporter).'))), U.btn(p.meuExc ? T('Editar', 'Edit') : T('Criar', 'Create'), { peq: true, tipo: 'sec', icone: 'lapis', onclick: () => P.editarExclusivo(p) }))); // (1.0.2)
      extras.append(h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, U.btn(T('Remover amigo', 'Remove friend'), { tipo: 'perigo', peq: true, onclick: async () => { if (await U.confirmar(T('Remover ', 'Remove ') + p.nome + '?', { perigo: true })) { await API.amigos.remover(codigo).catch((e) => U.toast(e.message, { tipo: 'erro' })); m.fechar(); } } })));
    }
    if (!souEu) extras.append(h('div', { class: 'linha', estilo: { 'justify-content': 'center' } }, U.btn(T('Bloquear', 'Block'), { icone: 'bloquear', tipo: 'link', peq: true, onclick: async () => { if (await P.bloquear(p, true)) m.fechar(); } }), U.btn(T('Denunciar', 'Report'), { icone: 'bandeira', tipo: 'link', peq: true, onclick: () => { m.fechar(); A.admin && A.admin.denunciar(p); } })));
    if (p.assinatura && A.apoio && A.apoio.resumoDev) extras.append(A.apoio.resumoDev(p.assinatura)); // (0.8.2) só o desenvolvedor recebe isso do servidor
    const comMural = A.mural && ['esquerda', 'direita', 'cima', 'baixo'].includes(p.ml), deLado = comMural && (p.ml === 'esquerda' || p.ml === 'direita');
    const opCartao = { verFotos: true, souEu: souEu ? () => { m.fechar(); P.editar(); } : null }, larg0 = Math.max(480, P.arranjoDe(p).w + 40);
    const montar = (q) => (A.mural ? A.mural.juntar(cartao(q, opCartao), q) : cartao(q, opCartao));
    // (1.0.2) o amigo fez um perfil só para você: abre nele, e dá para ver o público
    const mesclar = (q) => (q.exc ? { ...q, bio: q.exc.bio || q.bio, cor1: q.exc.cor1 || q.cor1, cor2: q.exc.cor2 || q.cor2 } : q);
    let cartaoEl = montar(mesclar(p));
    const trocaExc = p.exc ? U.seg([['exc', T('Feito para você', 'Made for you')], ['pub', T('Público', 'Public')]], 'exc', (v) => { const novo = montar(v === 'exc' ? mesclar(p) : p); cartaoEl.replaceWith(novo); cartaoEl = novo; requestAnimationFrame(() => { caberLargura(); caberMural(); vigiar(); }); }) : null;
    if (trocaExc) trocaExc.classList.add('perfil-troca-exc');
    m = U.modal(null, [trocaExc, cartaoEl, A.jogando ? A.jogando.cartao(codigo) : null, A.assistindo ? A.assistindo.cartao(codigo) : null, A.ouvindo ? A.ouvindo.cartao(codigo) : null, acoes, extras], { largura: larg0 + (deLado ? 470 : 0), classe: 'perfil-modal perfil-ver', som: ['perfil-abrir', 'perfil-fechar'], aoFechar: () => { P.pararPrevia(); removeEventListener('resize', aoMudar); } }); // fechou o perfil: a música para
    // (0.8.7) a janela nunca passa da tela: o Mural (em cima ou embaixo) usa todo o espaço que sobra e rola por dentro, os botões ficam
    // à vista
    let ro = null;
    const vigiar = () => { const mu = m.el.querySelector('.pf-com-mural .mural'); if (ro) ro.disconnect(); if (mu && typeof ResizeObserver === 'function') { ro = new ResizeObserver(caberMural); ro.observe(mu); } };
    const caberMural = () => {
      const mu = m.el.querySelector('.pf-com-mural.ml-cima .mural, .pf-com-mural.ml-baixo .mural'); if (!mu || !mu.isConnected) return;
      const sobra = m.el.scrollHeight - m.el.clientHeight; if (sobra <= 0) return;
      const alvo = mu.offsetHeight - sobra - 2;
      // (0.8.7) o Mural fica onde você pôs (antes, em tela baixa, ele ia sozinho para a direita e abrir/fechar parava de funcionar)
      mu.closest('.pf-com-mural').style.setProperty('--mr-max', Math.max(250, alvo) + 'px'); // (0.8.7) nunca baixinho demais
    };
    // (0.9.2) cartão grande + Mural ao lado numa tela estreita: tudo encolhe junto em vez de a borda do cartão passar da janela
    const caberLargura = () => {
      const j = m.el.querySelector('.pf-com-mural:is(.ml-esquerda, .ml-direita)') || m.el.querySelector('.perfil-cartao'); if (!j || !j.isConnected) return;
      j.style.zoom = ''; const pai = j.parentElement, cab = pai ? pai.clientWidth : 0;
      // (0.9.5) só o cartão (sem Mural): vale a largura do arranjo dele. O scrollWidth contava coisas escondidas que passam da borda
      // (como o painel que só aparece no hover) e o perfil ficava minúsculo
      const lg = j.classList.contains('perfil-cartao') ? (parseFloat(j.style.getPropertyValue('--pw')) || j.offsetWidth) : j.scrollWidth;
      if (cab > 0 && lg > cab + 1) j.style.zoom = String(Math.max(0.5, (cab - 2) / lg));
    };
    const aoMudar = () => { caberLargura(); caberMural(); };
    addEventListener('resize', aoMudar);
    requestAnimationFrame(() => requestAnimationFrame(() => { caberLargura(); caberMural(); vigiar(); }));
  };

  // ---------- mini perfil (0.5.9-6, como o do Discord, com a cara do Aero) ----------
  // Abre ao lado da foto clicada no chat: banner, foto (clicar abre o perfil completo), nome, #, insígnias, bio, a música, o Discord, onde a
  // pessoa está agora e uma caixa "Conversar com @fulano" que manda a mensagem no privado. Fica dentro da mesma bolha que ondula dos embeds.
  let miniAberto = null;
  P.fecharMini = () => { if (miniAberto) miniAberto(); };
  P.mini = async (codigo, ancora) => {
    const U = A.ui;
    if (miniAberto) { const mesma = miniAberto.codigo === codigo; miniAberto(); if (mesma) return; }
    let p; try { p = await P.buscar(codigo); } catch (e) { U.toast(e.message, { tipo: 'erro' }); return; }
    const eu = API.eu || {}, souEu = codigo === eu.codigo;
    if (p.exc) p = { ...p, bio: p.exc.bio || p.bio, cor1: p.exc.cor1 || p.cor1, cor2: p.exc.cor2 || p.cor2 }; // (1.0.2) o perfil que o amigo fez só para você
    const c1 = p.cor1 || '#2d9ee0', c2 = p.cor2 || p.cor1 || '#7fd3ff', banner = urlBanner(p.codigo, p.bannerV);
    const ds = H.dispositivosDe ? H.dispositivosDe(codigo) : [];
    const sala = null, on = souEu || ds.length > 0; // (0.9.6) sem salas: a tela é só nas chamadas
    const onde = sala ? (sala.comp ? T('Transmitindo agora', 'Sharing now') : T('Em uma sala', 'In a room')) : ds.length ? (ds.some((d) => d.estado === 'online') ? T('Online em ', 'Online on ') + ds[0].maquina : T('Ausente', 'Away')) : souEu ? T('Você', 'You') : p.visto ? A.ui.vistoHa(p.visto) : T('Offline', 'Offline');
    if (p.visto) A.ui.lembrarVisto(codigo, p.visto, p.vm);
    const verCompleto = () => { fechar(); P.ver(codigo); };
    if (souEu && A.extras) p = A.extras.filtrar(p, true);
    const av = A.ui.avatar(p, 76, A.ui.estadoDe(codigo));
    if (A.extras) A.extras.moldura(av, p.mo, c1, c2); // (1.0.0) a moldura da foto também no mini perfil
    const caixa = h('input', { class: 'campo mini-conversar', maxlength: 2000, placeholder: T('Conversar com @', 'Message @') + (p.apelido || p.nome) });
    const fundo = P.fundoDe(p, banner), pfm = P.arranjoDe(p);
    const el = h('div', { class: 'mini-perfil' + fundo.classe + ' av-' + pfm.avMini + (pfm.bnc ? ' bn-compacto' : ''), role: 'dialog', 'aria-label': p.nome, estilo: { '--c1': c1, '--c2': c2, ...fundo.estilo } },
      h('div', { class: 'mini-banner', estilo: banner ? { 'background-image': `url("${banner}")` } : {} }),
      h('button', { type: 'button', class: 'mini-av', title: T('Ver o perfil completo', 'View full profile'), onclick: verCompleto }, av),
      h('div', { class: 'mini-corpo' },
        h('button', { type: 'button', class: 'mini-nome', onclick: verCompleto }, A.ui.aplicarNome(h('span', {}, p.apelido || p.nome), p.nm), p.apelido ? h('small', { class: 'suave' }, ' (' + p.nome + ')') : null),
        h('div', { class: 'mini-tag' }, p.tag ? '#' + p.tag : '', ' ', A.aparelhos ? A.aparelhos.vivo(codigo) : null, !souEu && A.idiomas ? A.idiomas.relogio(p.fz) : null, ' ', U.insignias && !(p.pf && p.pf.si === false) ? U.insignias(p.ins, p.sl, p.pf && p.pf.so) : null),
        // (0.7.9) não existe imagem da sala aqui: mandar a tela de alguém para quem só abriu o perfil vazaria o que ela mostra só para quem está na sala
        sala ? h('div', { class: 'mini-sala' + (sala.comp ? ' ao-vivo' : '') },
          h('div', { class: 'mini-sala-info' }, h('span', { class: 'mini-sala-ic' }, A.icone(sala.comp ? 'tela' : 'olho', 20)), h('div', { class: 'cresce' }, h('b', {}, onde), sala.comp ? h('span', { class: 'mini-sala-vivo' }, T('AO VIVO', 'LIVE')) : h('small', {}, T('Está na sala, sem transmitir', 'In the room, not sharing')))),
          souEu ? null : U.btn(sala.comp ? T('Assistir', 'Watch') : T('Pedir para entrar', 'Ask to join'), { peq: true, tipo: 'ok', icone: 'olho', onclick: () => { fechar(); A.abrirSala({ papel: 'membro', sala: sala.sala }); } }))
          : h('div', { class: 'mini-onde' + (on ? ' on' : '') }, h('i'), onde),
        p.bio ? h('div', { class: 'mini-bio' }, ...A.ui.textoComLinks(p.bio)) : null,
        A.jogando ? A.jogando.cartao(codigo, { mini: true }) : null, A.assistindo ? A.assistindo.cartao(codigo, { mini: true }) : null, // (1.0.0) o jogo aberto agora (atividade de jogo)
        A.ouvindo ? A.ouvindo.cartao(codigo, { mini: true }) : null, // (1.0.0) a música tocando agora, com a barra andando
        p.spotify ? musica(p.spotify) : null,
        p.discord ? h('div', { class: 'perfil-linha mini-linha' }, h('span', { class: 'perfil-ic discord mini', title: 'Discord: @' + p.discord }, A.icone('discord', 13)), h('span', { class: 'selecionavel cresce', title: '@' + p.discord }, '@' + p.discord), U.btn('', { icone: 'copiar', tipo: 'sec', redondo: true, peq: true, titulo: T('Copiar usuário do Discord', 'Copy Discord username'), onclick: (e) => U.copiar(p.discord, e.currentTarget) })) : null,
        p.uid ? h('div', { class: 'perfil-linha perfil-id mini-linha' }, 'ID', h('code', { class: 'selecionavel' }, p.uid), U.btn('', { icone: 'copiar', tipo: 'sec', redondo: true, peq: true, titulo: T('Copiar ID (só você vê)', 'Copy ID (only you see it)'), onclick: (e) => U.copiar(p.uid, e.currentTarget) })) : null,
        !souEu && p.amizade === 'aceita' && A.talk ? caixa : null));
    caixa.addEventListener('keydown', async (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key !== 'Enter' || !caixa.value.trim()) return;
      const texto = caixa.value.trim(); caixa.disabled = true;
      try { const c = await A.talk.abrirDM(codigo); await A.talk.enviar(c, { texto }); fechar(); A.talk.irPara(c.id); } catch (x) { caixa.disabled = false; U.toast(x.message, { tipo: 'erro' }); }
    });
    document.body.append(el); A.ui.pelicula(el);
    // ao lado da foto clicada (à direita; sem espaço, à esquerda), sem sair da janela
    const r = ancora && ancora.getBoundingClientRect ? ancora.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3 };
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = r.right + 12; if (x + w > innerWidth - 8) x = r.left - w - 12; x = Math.max(8, Math.min(x, innerWidth - w - 8));
    const y = Math.max(8, Math.min(r.top - 20, innerHeight - hh - 8));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', transformOrigin: (r.left + (r.right - r.left) / 2 - x) + 'px ' + (r.top - y + 17) + 'px' });
    A.som.tocar('mini-abrir');
    if (document.documentElement.dataset.entrada === 'pad') setTimeout(() => { const b = el.querySelector('.mini-av'); if (b) b.focus({ preventScroll: true }); }, 60); // aberto pelo controle: o foco já entra nele
    let fechado = false;
    function fechar() {
      if (fechado) return; fechado = true; if (miniAberto === fechar) miniAberto = null;
      document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', tecla, true); removeEventListener('resize', fechar);
      P.pararPrevia(); A.som.tocar('mini-fechar');
      el.classList.add('fechando'); setTimeout(() => el.remove(), 260);
    }
    fechar.codigo = codigo;
    const fora = (e) => { if (!el.contains(e.target) && !(ancora && ancora.contains && ancora.contains(e.target))) fechar(); };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    setTimeout(() => { document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true); addEventListener('resize', fechar); }, 0);
    miniAberto = fechar;
    return { fechar, el };
  };

  // ---------- editar o seu ----------
  async function comprimirBanner(f) {
    if (f.type === 'image/gif' || (await A.ui.animada(f))) { // GIF (ou WebP) animado: vai como está (o canvas tiraria a animação); até 20 MB
      if (f.size > 20 * 1048576) throw new Error(T('Imagem animada grande demais para o banner (máximo 20 MB).', 'Animated image too large for the banner (max 20 MB).'));
      return { blob: f, url: URL.createObjectURL(f) };
    }
    const b = await A.ui.encolher(f); // (0.9.4) até 20 MB, na qualidade original
    return { blob: b, url: URL.createObjectURL(b) };
  }

  P.editar = async () => {
    const U = A.ui;
    let eu; try { eu = await API.req('eu'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); return; }
    const st = { fundo1: eu.fundo1 || '', fundo2: eu.fundo2 || '', cor1: eu.cor1 || '', cor2: eu.cor2 || '', bio: eu.bio || '', discord: eu.discord || '', spotify: eu.spotify || null, bannerNovo: null, tirarBanner: false, nome: eu.nome, tag: eu.tag, fotoNova: null,
      // (0.8.0) estilo do nome, fundo (degradê de várias cores / banner), nameplate e arranjo do perfil
      nm: { f: 'padrao', e: 'solido', c: [], ...(eu.nm || {}) },
      fd: eu.fd ? { ...eu.fd, c: (eu.fd.c || []).slice() } : HEX.test(eu.fundo1 || '') ? { t: eu.fundo2 && eu.fundo2 !== eu.fundo1 ? 'degrade' : 'cor', g: 'linear', a: 165, c: eu.fundo2 && eu.fundo2 !== eu.fundo1 ? [eu.fundo1, eu.fundo2] : [eu.fundo1], blur: 14, luz: 45 } : { t: 'auto', g: 'linear', a: 165, c: [], blur: 14, luz: 45 },
      np: eu.np ? { ...eu.np, c: (eu.np.c || []).slice() } : { t: 'nenhum', g: 'linear', a: 90, c: [] }, npNovo: null, tirarNp: false, fdNovo: null, tirarFd: false,
      mf: eu.mf ? { ...eu.mf, c: (eu.mf.c || []).slice() } : { t: 'vidro', g: 'linear', a: 160, c: [] }, mfNovo: null, tirarMf: false, // (0.8.7) o fundo do Mural
      mural: {}, muralMudou: false, ml: eu.ml || '', lb: eu.lb || '', gl: eu.gl || '', lbf: Array.isArray(eu.lbf) ? eu.lbf.slice(0, 4) : [], // (0.8.7) o Mural (carregado à parte), o lado dele e o Letterboxd
      pf: P.arranjoDe(eu), ...(A.extras ? A.extras.estadoDe(eu) : {}) }; // (1.0.0) + os extras do Aero Bubble
    const previa = h('div', { class: 'perfil-previa' });
    // (0.5.9-8) a prévia é refeita uma vez por quadro, no máximo (antes, a cada letra: o cartão inteiro, foto e tocador incluídos)
    let pintarPedido = 0;
    let abaAtual = 'perfil'; // (0.8.0) os quadradinhos, os contornos e as alças de tamanho só aparecem (e só arrastam) na aba Arranjo
    let thumbBn = null;
    const pintar = () => { if (!pintarPedido) pintarPedido = requestAnimationFrame(pintarJa); };
    const urlLocal = (x) => x && (x.url || x);
    const comoFica = () => ({ ...eu, ...st, muralLocal: st.mural, bannerV: st.tirarBanner ? 0 : eu.bannerV, fd: st.fd.t === 'auto' ? { t: 'auto' } : st.fd, np: st.np.t === 'nenhum' ? null : st.np, npV: st.tirarNp ? 0 : eu.npV, fdV: st.tirarFd ? 0 : eu.fdV, fdLocal: urlLocal(st.fdNovo), mf: st.mf.t === 'vidro' ? null : st.mf, mfV: st.tirarMf ? 0 : eu.mfV, mfLocal: urlLocal(st.mfNovo), bannerLocal: st.tirarBanner ? '' : urlLocal(st.bannerNovo) || '' });
    const pintarJa = () => {
      pintarPedido = 0;
      const p = comoFica(); P.ajustarGrade(st.pf, null, null, P.acertarExtras(st.pf, p)); // tamanho mínimo da música, foto no meio etc.
      const bnLocal = urlLocal(st.bannerNovo);
      const c = cartao(p, { bannerLocal: bnLocal, fotoLocal: urlLocal(st.fotoNova), editor: true });
      editarCartao(c);
      // (0.8.7) sem piscar: o cartão novo é montado escondido por cima do antigo, cada widget já ganha o tamanho certo (a música aparecia
      // um quadro sem o ajuste) e só então os dois trocam de lugar
      const velhos = [...previa.children], palco = h('div', { class: 'pf-palco' }, c);
      if (velhos.length) Object.assign(palco.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: '100%' });
      previa.append(palco);
      pintarListas(p, bnLocal);
      if (thumbBn) { const u = bnLocal || urlBanner(p.codigo, p.bannerV); thumbBn.style.backgroundImage = u ? `url("${u}")` : ''; thumbBn.classList.toggle('vazio', !u); }
      encaixar(c);
      c.querySelectorAll('.pf-w').forEach((x) => { try { caber(x); } catch (e) { /* ok */ } });
      velhos.forEach((x) => x.remove()); palco.removeAttribute('style');
      if (previa.parentElement && previa.parentElement.dataset.ml) ajustarLado(); // (0.8.7) o Mural do lado: o zoom com o cartão já pronto
    };
    // (0.8.0) cores, ângulo, desfoque e luz só repintam o cartão que já está na tela: refazer o cartão inteiro a cada passo do
    // seletor fazia os widgets piscarem (e a música/foto recomeçarem)
    let retocarPedido = 0;
    const retocar = () => {
      if (pintarPedido || retocarPedido) return;
      retocarPedido = requestAnimationFrame(() => {
        retocarPedido = 0;
        const c = previa.querySelector('.perfil-cartao');
        if (pintarPedido) return;
        if (st.mf.t === 'cartao') retocarMural(); // (0.8.7) o mural "igual ao cartão" acompanha
        if (!c) { pintar(); return; }
        const p = comoFica(), bnLocal = urlLocal(st.bannerNovo), f = P.fundoDe(p, bnLocal || urlBanner(p.codigo, p.bannerV));
        c.classList.remove('com-fundo', 'fundo-banner', 'fundo-escuro', 'fundo-claro');
        for (const k of f.classe.split(' ')) if (k) c.classList.add(k);
        for (const k of ['--fb', '--fb-blur', '--fb-luz', '--f1', '--f2', '--fbg']) c.style.removeProperty(k);
        for (const [k, v] of Object.entries(f.estilo)) c.style.setProperty(k, v);
        c.style.setProperty('--c1', p.cor1 || '#2d9ee0'); c.style.setProperty('--c2', p.cor2 || p.cor1 || '#7fd3ff');
        const nm = c.querySelector('.perfil-nome-txt'); if (nm) A.ui.aplicarNome(nm, p.nm);
        pintarListas(p, bnLocal);
      });
    };
    // (0.8.0) a prévia no tamanho de verdade do cartão, diminuída para caber na coluna (a conta é a mesma: só a escala muda)
    const escala = (c) => (parseFloat(c.style.zoom) || 1);
    // a escala é a do cartão mais largo (560 px): assim um cartão mais estreito aparece mais estreito na prévia, como fica de verdade
    function encaixar(c) {
      c.style.width = st.pf.w + 'px';
      // (0.8.7) com o Mural do lado (aba Mural): o cartão no tamanho dele; quem diminui os dois juntos é o --mlz (antes ele encolhia duas vezes)
      const ml = previa.parentElement && previa.parentElement.dataset.ml;
      if (ml === 'esquerda' || ml === 'direita') { previa.style.width = st.pf.w + 'px'; c.style.zoom = '1'; return; }
      previa.style.removeProperty('width');
      const cabe = previa.clientWidth || 560;
      c.style.zoom = String(Math.min(1, cabe / 560));
    }
    // (0.8.0) segurar e arrastar: um widget mostra os quadradinhos (soltar num ocupado troca os dois de lugar), a foto mostra os 9
    // lugares do cartão e o banner mostra os lados. O que estiver embaixo do mouse acende.
    const maisPerto = (mapa, x, y) => {
      let melhor = null, dist = Infinity;
      for (const q of mapa.children) { const r = q.getBoundingClientRect(), d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); if (d < dist) { dist = d; melhor = q; } }
      return melhor;
    };
    // (0.8.0) os widgets andam e mudam de tamanho nos quadradinhos de verdade do cartão (.pf-cel, os mesmos lugares que eles usam).
    // O retângulo que vai ficar acende; quem estiver no caminho vai para o lugar livre mais perto quando soltar.
    // (0.8.7) arrastar um item da prévia do Mural para dentro do cartão (aba Arranjo): ele vira um widget de 1 x 2 quadradinhos
    const soltarItem = (x, cat, e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY, img = e.currentTarget.querySelector('img');
      let fant = null, alvo = null;
      const mover = (ev) => {
        if (!fant) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
          fant = h('div', { class: 'mr-fantasma' + (quadrado(cat) ? ' q' : '') }, img ? h('img', { src: img.src, alt: '' }) : A.icone(CATS_FAV[cat][0], 22));
          document.body.append(fant); A.som.tocar('desgrudar');
        }
        fant.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 40}px) rotate(${Math.max(-8, Math.min(8, (ev.clientX - x0) / 30))}deg)`;
        const c = previa.querySelector('.perfil-cartao'), rc = c && c.getBoundingClientRect(), dentro = rc && ev.clientX >= rc.left && ev.clientX <= rc.right && ev.clientY >= rc.top && ev.clientY <= rc.bottom;
        alvo = dentro ? celPerto(c, ev.clientX, ev.clientY) : null;
        if (c) acender(c, alvo ? { ...alvo, w: 2, h: 2 } : null, '');
        fant.classList.toggle('dentro', !!alvo);
      };
      const fim = () => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
        if (fant) fant.remove();
        const c = previa.querySelector('.perfil-cartao'); if (c) acender(c, null, '');
        if (!fant || !alvo) return;
        // o mesmo item já está no cartão: só muda de lugar
        let k = MI.find((q) => st.pf.mi[q] && st.pf.mi[q].k === cat && st.pf.mi[q].t === x.t) || MI.find((q) => !st.pf.mi[q]);
        if (!k) { U.toast(T('O cartão já tem itens demais do Mural.', 'The card already has too many Wall items.'), { tipo: 'erro' }); return; }
        const ja = st.pf.mi[k] && st.pf.mi[k].t === x.t && st.pf.gw[k]; st.pf.mi[k] = { k: cat, t: x.t }; st.pf.gw[k] = ja ? { ...st.pf.gw[k], x: alvo.x, y: alvo.y } : { x: alvo.x, y: alvo.y, w: 2, h: 2 };
        P.ajustarGrade(st.pf, k); A.som.tocar('grudar'); pintarJa();
      };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
    };
    // (0.8.7) a prévia do Mural embaixo do cartão (nas abas Mural e Arranjo, ou quando o mural está ligado)
    const muralPrev = h('div', { class: 'pf-mural-previa' });
    let muralChave = '';
    // (0.8.7) mexer no fundo do Mural só repinta o fundo do mural da prévia (sem refazer o mural)
    const retocarMural = () => { const mu = muralPrev.querySelector('.mural'); if (mu && A.mural.aplicarFundo) A.mural.aplicarFundo(mu, P.fundoMural(comoFica())); else pintarMural(true); };
    const pintarMural = (forcar) => {
      // (0.8.7) só nas abas Mural e Arranjo. Na aba Mural, a prévia fica do lado escolhido do cartão (como no perfil de verdade),
      // diminuída para caber inteira, sem rolagem
      const ver = abaAtual === 'arranjo' || (abaAtual === 'mural' && !!st.ml), lado = abaAtual === 'mural' && st.ml ? st.ml : '';
      const chave = [ver, st.ml, abaAtual].join('|');
      const caixaP = muralPrev.parentElement;
      if (caixaP) { if (lado) caixaP.dataset.ml = lado; else delete caixaP.dataset.ml; }
      if (!forcar && chave === muralChave) { ajustarLado(); return; } muralChave = chave;
      muralPrev.hidden = !ver;
      if (!ver) { muralPrev.replaceChildren(); ajustarLado(); return; }
      muralPrev.replaceChildren(h('div', { class: 'pf-mural-previa-rot' }, A.icone('apps', 14), abaAtual === 'arranjo' ? T('Arraste um item do Mural para dentro do cartão', 'Drag a Wall item into the card') : T('Prévia do Mural', 'Wall preview')),
        A.mural.painel(st.mural, { lado: st.ml || 'baixo', dono: eu.apelido || eu.nome, aba: A.mural.abaVista, arrastar: abaAtual === 'arranjo' ? soltarItem : null, previa: true, fundo: P.fundoMural(comoFica()) }));
      ajustarLado();
    };
    let rafLado = 0;
    function ajustarLado() {
      const cx = muralPrev.parentElement; if (!cx) return;
      cancelAnimationFrame(rafLado);
      { const c = previa.querySelector('.perfil-cartao'); if (c) encaixar(c); }
      if (!cx.dataset.ml) { cx.style.removeProperty('--mlz'); return; }
      rafLado = requestAnimationFrame(() => {
        cx.style.setProperty('--mlz', '1');
        const lat = cx.dataset.ml === 'esquerda' || cx.dataset.ml === 'direita', W = cx.clientWidth - 28, H = cx.clientHeight - 40;
        const a = { width: previa.offsetWidth, height: previa.offsetHeight }, b = { width: muralPrev.offsetWidth, height: muralPrev.offsetHeight }; // (0.8.7) sem o zoom da janela, na mesma medida do clientWidth
        const w = lat ? a.width + b.width + 12 : Math.max(a.width, b.width), hh = lat ? Math.max(a.height, b.height) : a.height + b.height + 12;
        cx.style.setProperty('--mlz', String(Math.max(0.35, Math.min(1, W / (w || 1), H > 100 ? H / (hh || 1) : 1)).toFixed(3)));
      });
    }
    const celPerto = (c, x, y) => {
      let melhor = null, dist = Infinity;
      for (const q of c.querySelectorAll('.pf-cel')) { const r = q.getBoundingClientRect(), d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); if (d < dist) { dist = d; melhor = q; } }
      return melhor ? { x: +melhor.dataset.x, y: +melhor.dataset.y } : null;
    };
    const acender = (c, r, k) => {
      const outros = WIDGETS.filter((w) => w !== k).map((w) => st.pf.gw[w]).filter(Boolean);
      for (const q of c.querySelectorAll('.pf-cel')) {
        const p1 = { x: +q.dataset.x, y: +q.dataset.y, w: 1, h: 1 }, dentro = !!r && bate(p1, r);
        q.classList.toggle('alvo', dentro); q.classList.toggle('empurra', dentro && outros.some((o) => bate(o, p1)));
      }
    };
    // (0.8.0) arrastar ao vivo: o widget sai do lugar e segue o mouse (inclinando com o movimento), uma sombra mostra onde ele vai cair e
    // os outros já deslizam para onde vão ficar (o mesmo cálculo de quando solta). Puxando o cantinho, ele cresce ao vivo e os outros abrem espaço.
    const simular = (k, r) => {
      const pf = { ...st.pf, cp: st.pf.cp.slice(), gw: Object.fromEntries(Object.entries(st.pf.gw).map(([a, b]) => [a, { ...b }])) };
      pf.gw[k] = { ...r }; P.ajustarGrade(pf, k, st.pf.gw[k]); simCp = pf.cp; return pf.gw;
    };
    let simCp = null; // (0.9.4) quem virou bolinha por falta de lugar na simulação (vale quando solta)
    const semMov = () => document.documentElement.dataset.anim === 'reduzida' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // FLIP: guarda onde cada um estava, muda a grade e anima do lugar antigo até o novo
    const deslizar = (els, mudar, z, ms = 240) => {
      const antes = new Map(els.map((x) => [x, x.getBoundingClientRect()]));
      mudar();
      if (semMov()) return;
      for (const x of els) {
        const a = antes.get(x), b = x.getBoundingClientRect();
        if (!a || !b.width || !b.height || (Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5)) continue;
        x.getAnimations().forEach((an) => { if (an.id === 'pf-flip') an.cancel(); });
        const an = x.animate([{ transformOrigin: '0 0', transform: `translate(${(a.left - b.left) / z}px, ${(a.top - b.top) / z}px) scale(${a.width / b.width}, ${a.height / b.height})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.2,.9,.25,1.15)' });
        an.id = 'pf-flip';
      }
    };
    const porNaGrade = (el, pos) => { el.style.setProperty('grid-column', pos.col); el.style.setProperty('grid-row', pos.lin); };
    function arrastarWidget(c, cel, k, e, redimensionar) {
      const conteudo = cel.parentElement, r0 = { ...st.pf.gw[k] }, x0 = e.clientX, y0 = e.clientY, pega = celPerto(c, x0, y0) || { x: r0.x, y: r0.y };
      const off = { x: Math.max(0, Math.min(r0.w - 1, pega.x - r0.x)), y: Math.max(0, Math.min(r0.h - 1, pega.y - r0.y)) };
      const m = minimo(k, st.pf), compacto = st.pf.cp.includes(k);
      const outros = [...conteudo.querySelectorAll(':scope > .pf-w')].filter((x) => x !== cel);
      let novo = null, gw = null, comecou = false, sombra = null, ultX = x0, incl = 0, raf = 0;
      const mover = (ev) => {
        if (!comecou) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
          comecou = true; c.classList.add('arrastando'); if (redimensionar) c.classList.add('crescendo'); cel.classList.add('pf-pegado'); A.som.tocar('desgrudar');
          sombra = h('div', { class: 'pf-sombra' + (compacto ? ' bola' : '') }); porNaGrade(sombra, conteudo.posDe(r0)); conteudo.append(sombra);
        }
        if (redimensionar && compacto) return; // a bolinha é sempre 1 quadradinho
        const z = escala(c), q = celPerto(c, ev.clientX, ev.clientY); if (!q) return;
        let r;
        const GC = gcDe(st.pf), GR = grDe(st.pf);
        if (redimensionar) r = { x: r0.x, y: r0.y, w: Math.max(m.w, Math.min(GC - r0.x, q.x - r0.x + 1)), h: Math.max(m.h, Math.min(GR - r0.y, q.y - r0.y + 1)) };
        else r = { w: r0.w, h: r0.h, x: Math.max(0, Math.min(GC - r0.w, q.x - off.x)), y: Math.max(0, Math.min(GR - r0.h, q.y - off.y)) };
        if (!novo || r.x !== novo.x || r.y !== novo.y || r.w !== novo.w || r.h !== novo.h) {
          novo = r; gw = simular(k, r); A.som.tocar('hover'); acender(c, gw[k], k);
          deslizar([...outros, sombra, ...(redimensionar ? [cel] : [])], () => {
            for (const o of outros) if (gw[o.dataset.parte]) porNaGrade(o, conteudo.posDe(gw[o.dataset.parte]));
            porNaGrade(sombra, conteudo.posDe(gw[k]));
            if (redimensionar) porNaGrade(cel, conteudo.posDe(gw[k]));
          }, z, 260);
        }
        if (!redimensionar) {
          // segue o mouse e inclina para o lado em que está indo (volta reto quando para)
          incl = Math.max(-7, Math.min(7, incl * 0.6 + (ev.clientX - ultX) * 0.5)); ultX = ev.clientX;
          cel.style.translate = (ev.clientX - x0) / z + 'px ' + (ev.clientY - y0) / z + 'px'; cel.style.rotate = incl.toFixed(2) + 'deg';
          cancelAnimationFrame(raf); raf = requestAnimationFrame(function endireita() { incl *= 0.85; cel.style.rotate = incl.toFixed(2) + 'deg'; if (Math.abs(incl) > 0.1 && cel.isConnected) raf = requestAnimationFrame(endireita); });
        }
      };
      const fim = () => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
        cancelAnimationFrame(raf);
        if (!comecou) return;
        const z = escala(c);
        // o widget pousa (animado) no lugar da sombra; depois a prévia é refeita com tudo no lugar
        deslizar([cel], () => { cel.style.translate = ''; cel.style.rotate = ''; cel.classList.remove('pf-pegado'); if (gw) porNaGrade(cel, conteudo.posDe(gw[k])); }, z, 280);
        if (sombra) { sombra.classList.add('some'); }
        c.classList.remove('arrastando', 'crescendo'); acender(c, null, k);
        if (gw) { st.pf.gw = gw; if (simCp) st.pf.cp = simCp.slice(); }
        A.som.tocar('grudar');
        setTimeout(pintarJa, semMov() ? 0 : 300);
      };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
    }
    // (0.9.0) no celular o arranjo é por toques: toque num bloco para escolher; a barrinha embaixo do cartão move (setas) e muda o tamanho
    // (+ e -) um quadradinho por vez. Arrastar peças pequenas com o dedo era difícil e cobria o que estava embaixo
    const toqueArr = () => !!(A.plat.celular || matchMedia('(pointer: coarse)').matches);
    function pintarSel(c) {
      previa.querySelectorAll(':scope > .pf-mov').forEach((x) => x.remove());
      c.querySelectorAll('.pf-sel').forEach((x) => x.classList.remove('pf-sel'));
      const k = st.selW, r0 = k && st.pf.gw[k];
      if (!toqueArr() || abaAtual !== 'arranjo' || !r0) return;
      const el = c.querySelector('.pf-w[data-parte="' + k + '"]'); if (el) el.classList.add('pf-sel');
      const compacto = st.pf.cp.includes(k);
      const mexer = (dx, dy, dw, dh) => {
        const GC = gcDe(st.pf), GR = grDe(st.pf), m = minimo(k, st.pf), r = st.pf.gw[k];
        const w = compacto ? 1 : Math.max(m.w, Math.min(GC, r.w + dw)), hh = compacto ? 1 : Math.max(m.h, Math.min(GR, r.h + dh));
        const novo = { w, h: hh, x: Math.max(0, Math.min(GC - w, r.x + dx)), y: Math.max(0, Math.min(GR - hh, r.y + dy)) };
        if (novo.x === r.x && novo.y === r.y && novo.w === r.w && novo.h === r.h) { A.som.tocar('erro'); return; }
        st.pf.gw = simular(k, novo); if (simCp) st.pf.cp = simCp.slice(); A.som.tocar('grudar'); pintarJa();
      };
      const b = (ic, tit, f, extra) => { const x = U.btn(extra || '', { icone: ic, tipo: 'sec', redondo: !extra, peq: true, titulo: tit, onclick: f }); return x; };
      const nome = T(...(P.PARTES[k] || [k, k]));
      previa.append(h('div', { class: 'pf-mov' },
        h('div', { class: 'pf-mov-cab' }, h('b', {}, nome), b('fechar', T('Pronto', 'Done'), () => { st.selW = ''; pintarSel(c); })),
        h('div', { class: 'pf-mov-linha' },
          h('div', { class: 'pf-mov-setas' }, b('setaE', T('Para a esquerda', 'Left'), () => mexer(-1, 0, 0, 0)), h('div', { class: 'col' }, b('chevron', T('Para cima', 'Up'), () => mexer(0, -1, 0, 0)), (() => { const x = b('chevron', T('Para baixo', 'Down'), () => mexer(0, 1, 0, 0)); x.classList.add('pf-mov-baixo'); return x; })()), b('setaD', T('Para a direita', 'Right'), () => mexer(1, 0, 0, 0))),
          compacto ? null : h('div', { class: 'pf-mov-tam' },
            h('span', { class: 'peq suave' }, T('Largura', 'Width')), b('menos', T('Mais estreito', 'Narrower'), () => mexer(0, 0, -1, 0)), b('mais', T('Mais largo', 'Wider'), () => mexer(0, 0, 1, 0)),
            h('span', { class: 'peq suave' }, T('Altura', 'Height')), b('menos', T('Mais baixo', 'Shorter'), () => mexer(0, 0, 0, -1)), b('mais', T('Mais alto', 'Taller'), () => mexer(0, 0, 0, 1))))));
    }
    function editarCartao(c) {
      c.classList.toggle('editando', abaAtual === 'arranjo');
      setTimeout(() => { if (c.isConnected) pintarSel(c); }, 0);
      // (0.8.7) item do Mural no cartão: botão direito tira
      c.querySelectorAll('.pf-w').forEach((el) => { const k = el.dataset.parte; if (!ehItem(k)) return; el.addEventListener('contextmenu', (e) => {
        U.menuContexto(e, [{ texto: T('Tirar do cartão', 'Remove from card'), icone: 'fechar', onclick: () => { delete st.pf.mi[k]; delete st.pf.gw[k]; A.som.tocar('click'); pintarJa(); } }]);
      }); });
      // (0.8.7) favoritos e Letterboxd: o tamanho pelo botão direito (compacto vira bolinha, médio e grande mudam o quanto aparece)
      c.querySelectorAll(GRANDES.map((k) => '.pf-w-' + k).join(', ')).forEach((el) => el.addEventListener('contextmenu', (e) => {
        const k = el.dataset.parte, agora = st.pf.cp.includes(k) ? 'p' : (st.pf.ws || {})[k] === 'g' ? 'g' : 'm';
        const por = (t) => { st.pf.cp = st.pf.cp.filter((x) => x !== k); st.pf.ws = { ...(st.pf.ws || {}) }; delete st.pf.ws[k]; if (t === 'p') st.pf.cp.push(k); if (t === 'g') st.pf.ws[k] = 'g';
          const m = minimo(k, st.pf), r = st.pf.gw[k]; if (r) { if (t === 'p' && agora !== 'p') TAM_ANTES[k] = { w: r.w, h: r.h }; const v = agora === 'p' && t !== 'p' && TAM_ANTES[k] ? TAM_ANTES[k] : r; r.w = t === 'p' ? 1 : Math.max(v.w, m.w); r.h = t === 'p' ? 1 : Math.max(v.h, m.h); } P.ajustarGrade(st.pf, k); pintarJa(); };
        U.menuContexto(e, [['p', T('Compacto', 'Compact')], ['m', T('Médio', 'Medium')], ['g', T('Grande', 'Large')]].map(([t, n]) => ({ texto: (t === agora ? '✓ ' : '') + n, onclick: () => por(t) })));
      }));
      c.querySelectorAll('[data-parte]').forEach((el) => {
        el.classList.add('pf-pega'); el.title = T('Segure e arraste para outro lugar', 'Hold and drag to another spot');
        if (WIDGETS.includes(el.dataset.parte)) { el.title = T('Segure e arraste para outro lugar · puxe o cantinho para mudar o tamanho', 'Hold and drag to another spot · drag the corner to resize'); if (!el.classList.contains('compacto')) el.append(h('span', { class: 'pf-tam', 'aria-hidden': 'true' })); } // (0.8.7) a bolinha não muda de tamanho: sem o cantinho (ele cobria a bolinha e arrastar virava "aumentar")
        el.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || !c.classList.contains('editando') || e.target.closest('button, a, input, iframe, .pf-bolha-abre .musica-tocador')) return;
          e.preventDefault(); e.stopPropagation();
          if (WIDGETS.includes(el.dataset.parte) && toqueArr()) { st.selW = st.selW === el.dataset.parte ? '' : el.dataset.parte; A.som.tocar('click'); pintarSel(c); return; } // (0.9.0) celular: tocar escolhe, a barra move
          if (WIDGETS.includes(el.dataset.parte)) { arrastarWidget(c, el, el.dataset.parte, e, !!e.target.closest('.pf-tam') && !el.classList.contains('compacto')); return; }
          const k = el.dataset.parte, x0 = e.clientX, y0 = e.clientY, r0 = el.getBoundingClientRect();
          let fant = null, alvo = null, mapa = null;
          const mover = (ev) => {
            if (!fant) {
              if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
              fant = el.cloneNode(true); fant.classList.add('pf-fantasma');
              const w = Math.min(r0.width, 240), z = escala(c);
              Object.assign(fant.style, { width: w / z + 'px', zoom: String(z) });
              const NB = { cima: T('Banner em cima', 'Banner on top'), baixo: T('Banner embaixo', 'Banner at the bottom'), esquerda: T('Banner na esquerda', 'Banner on the left'), direita: T('Banner na direita', 'Banner on the right'), cheio: T('Cobrir o perfil todo', 'Cover the whole profile') };
              mapa = k === 'banner' ? h('div', { class: 'pf-mapa bn' }, ...Object.keys(NB).map((q) => h('div', { dados: { zona: q } }, NB[q])))
                : h('div', { class: 'pf-mapa' }, ...ZONAS.map((q) => h('div', { dados: { zona: q }, class: q === st.pf.fp ? 'dele' : '' }, P.NOME_ZONA(q))));
              c.append(mapa); document.body.append(fant); el.classList.add('pf-pegado'); A.som.tocar('desgrudar');
            }
            const z = escala(c); fant.style.left = (ev.clientX - (x0 - r0.left)) / z + 'px'; fant.style.top = (ev.clientY - (y0 - r0.top)) / z + 'px';
            const novo = maisPerto(mapa, ev.clientX, ev.clientY);
            if (novo && novo !== alvo) A.som.tocar('hover');
            if (alvo) alvo.classList.remove('alvo');
            alvo = novo; if (alvo) alvo.classList.add('alvo');
          };
          const fim = () => {
            removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
            if (!fant) return;
            fant.remove(); if (mapa) mapa.remove(); el.classList.remove('pf-pegado');
            if (!alvo) return;
            const zona = alvo.dataset.zona;
            if (k === 'banner') { if (zona === 'cheio') st.pf.bn = 'cheio'; else { st.pf.bn = 'faixa'; st.pf.bp = zona; } pintarBn(); }
            else { st.pf.fp = zona; P.ajustarGrade(st.pf); }
            A.som.tocar('grudar'); pintarJa();
          };
          addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
        });
      });
      // as bordas da direita e de baixo: puxar muda a largura e a altura de verdade (duplo clique na de baixo: altura automática)
      const puxa = (eixo) => {
        const b = h('div', { class: 'pf-puxa pf-puxa-' + eixo, title: eixo === 'w' ? T('Puxe para mudar a largura', 'Drag to change the width') : T('Puxe para mudar a altura (duplo clique: automática)', 'Drag to change the height (double click: automatic)') });
        b.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
          const z = escala(c), x0 = e.clientX, y0 = e.clientY, w0 = st.pf.w, h0 = st.pf.ht || c.offsetHeight;
          c.classList.add('puxando');
          const mover = (ev) => {
            if (eixo === 'w') st.pf.w = Math.round(Math.max(300, Math.min(560, w0 + (ev.clientX - x0) / z)));
            else st.pf.ht = Math.round(Math.max(300, Math.min(800, h0 + (ev.clientY - y0) / z)));
            c.style.setProperty('--pw', st.pf.w + 'px'); c.style.setProperty('--ph', st.pf.ht + 'px'); c.classList.toggle('alto', !!st.pf.ht);
            c.style.width = st.pf.w + 'px'; sincronizarTamanho();
          };
          const fim = () => { removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true); c.classList.remove('puxando'); pintarJa(); };
          addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
        });
        if (eixo === 'h') b.addEventListener('dblclick', () => { st.pf.ht = 0; sincronizarTamanho(); pintarJa(); });
        return b;
      };
      c.append(puxa('w'), puxa('h'));
    }
    let sincronizarTamanho = () => {};
    // foto, nome e # (antes ficavam nas Configurações)
    const foto = h('input', { type: 'file', accept: 'image/*', hidden: true });
    // (0.6.0) recortar antes (arrastar e dar zoom no círculo); GIF animado vai como está (recortar tiraria a animação)
    foto.addEventListener('change', async () => { const f = foto.files[0]; foto.value = ''; if (!f) return; try { const r = f.type === 'image/gif' || (await U.animada(f)) ? f : await U.recortar(f, { largura: 320, altura: 320, redondo: true, titulo: T('Ajustar a foto', 'Adjust the photo') }); if (!r) return; st.fotoNova = await P.prepararFoto(r.type ? r : f); pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } });
    // (0.6.0) fotos de perfil recentes: um toque volta para qualquer uma
    const recentes = h('div', { class: 'perfil-recentes' });
    API.req('avatares-recentes').then((r) => {
      for (const v of r.recentes || []) {
        const b = h('button', { type: 'button', class: 'perfil-recente', title: T('Usar esta foto de novo', 'Use this photo again'), onclick: async () => { try { await API.req('avatares-recentes/usar', { v }); await API.carregarEu(); A.evt.emit('perfil'); A.som.tocar('sucesso'); eu.av = API.eu.av; st.fotoNova = null; pintar(); U.toast(T('Foto trocada.', 'Photo changed.'), { tipo: 'ok', ms: 1800 }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }, h('img', { alt: '', loading: 'lazy' }));
        fetch(`${API.servidor}/api/avatar-recente/${v}`, { headers: { Authorization: 'Bearer ' + API.token } }).then((r) => (r.ok ? r.blob() : null)).then((d) => { if (d) b.firstChild.src = URL.createObjectURL(d); }).catch(() => {}); // o token nunca vai no endereço
        recentes.append(b);
      }
      if (recentes.children.length) recentes.prepend(h('span', { class: 'peq suave' }, T('Recentes:', 'Recent:')));
    }).catch(() => {});
    const nomeI = h('input', { class: 'campo', maxlength: 24, 'aria-label': T('Nome', 'Name') }); nomeI.value = st.nome;
    nomeI.addEventListener('input', () => { st.nome = nomeI.value; pintar(); });
    const tagI = h('input', { class: 'campo', maxlength: 20, 'aria-label': T('Sua #', 'Your #') }); tagI.value = st.tag;
    const tagMsg = h('div', { class: 'peq', estilo: { 'min-height': '18px' } });
    let tt = 0;
    tagI.addEventListener('input', () => {
      clearTimeout(tt); st.tag = tagI.value.trim().replace(/^#/, ''); pintar();
      const v = st.tag; if (v.toLowerCase() === String(eu.tag).toLowerCase()) { tagMsg.textContent = ''; return; }
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(v)) { tagMsg.textContent = T('3 a 20 caracteres: letras, números, _ . -', '3 to 20 characters: letters, numbers, _ . -'); tagMsg.style.color = 'var(--aviso)'; return; }
      tagMsg.textContent = T('Verificando...', 'Checking...'); tagMsg.style.color = 'var(--suave)';
      tt = setTimeout(async () => { try { const livre = await API.tagLivre(v); if (st.tag !== v) return; tagMsg.textContent = livre ? T('#' + v + ' está livre!', '#' + v + ' is available!') : T('#' + v + ' já está em uso.', '#' + v + ' is taken.'); tagMsg.style.color = livre ? 'var(--ok)' : 'var(--erro)'; } catch (e) { tagMsg.textContent = ''; } }, 450);
    });
    const bio = h('textarea', { class: 'campo', rows: 3, maxlength: 190, placeholder: T('Fale um pouco de você...', 'Tell people about yourself...') }); bio.value = st.bio;
    bio.addEventListener('input', () => { st.bio = bio.value; pintar(); });
    const disc = h('input', { class: 'campo', placeholder: T('seu_usuario (do Discord)', 'your_username (Discord)'), maxlength: 33, value: st.discord }); disc.value = st.discord;
    disc.addEventListener('input', () => { st.discord = disc.value.trim().replace(/^@/, '').toLowerCase(); pintar(); });
    const cor = (k) => { const i = h('input', { type: 'color', class: 'perfil-cor', value: st[k] || (k === 'cor1' ? '#2d9ee0' : '#7fd3ff'), 'aria-label': k === 'cor1' ? T('Cor principal', 'Main color') : T('Segunda cor', 'Second color') }); i.addEventListener('input', () => { st[k] = i.value; retocar(); }); return i; };
    const c1 = cor('cor1'), c2 = cor('cor2');
    const paleta = h('div', { class: 'perfil-paleta' }, ...CORES.map(([x, y]) => h('button', { type: 'button', class: 'perfil-paleta-it', estilo: { '--g': `linear-gradient(160deg, ${x}, ${y})` }, title: x + ' → ' + y, 'aria-label': x + ' → ' + y, onclick: () => { st.cor1 = x; st.cor2 = y; c1.value = x; c2.value = y; retocar(); A.som.tocar('bolha'); } })));
    const arq = h('input', { type: 'file', accept: 'image/*', hidden: true });
    arq.addEventListener('change', async () => { const f = arq.files[0]; arq.value = ''; if (!f) return; try { const r = f.type === 'image/gif' || (await U.animada(f)) ? f : await U.recortar(f, { largura: 1200, altura: 420, nativo: true, titulo: T('Ajustar o banner', 'Adjust the banner') }); if (!r) return; st.bannerNovo = await comprimirBanner(r.type ? r : f); st.tirarBanner = false; pintar(); } catch (e) { U.toast(/GIF|MB/.test(e.message) ? e.message : T('Não consegui abrir essa imagem.', 'Could not open that image.'), { tipo: 'erro' }); } });
    const musicaInfo = h('div', { class: 'peq suave' });
    const pintarMusica = () => { musicaInfo.textContent = st.spotify ? '♪ ' + st.spotify.nome + (st.spotify.artista ? ' — ' + st.spotify.artista : '') + (st.spotify.yt ? ' (' + mmss(st.spotify.inicio || 0) + ' – ' + mmss((st.spotify.inicio || 0) + 30) + ')' : '') : T('Nenhuma música escolhida.', 'No song chosen.'); };
    // (0.5.9-6) com música escolhida: "Ajustar trecho" (abre direto na escolha dos 30 s, sem procurar de novo)
    const botoesMusica = h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } });
    const pintarBotoesMusica = () => {
      const trocar = (s) => { st.spotify = s; pintarMusica(); pintar(); pintarBotoesMusica(); };
      botoesMusica.replaceChildren(
        U.btn(st.spotify ? T('Trocar música', 'Change song') : T('Procurar música', 'Search song'), { icone: 'musica', tipo: 'sec', peq: true, onclick: () => buscarMusica(trocar) }),
        st.spotify && st.spotify.yt && st.spotify.yt.length && st.spotify.duracao ? U.btn(T('Ajustar trecho', 'Adjust clip'), { icone: 'ajustes', tipo: 'sec', peq: true, onclick: () => buscarMusica(trocar, { ajustar: st.spotify }) }) : null,
        st.spotify ? U.btn(T('Tirar música', 'Remove song'), { tipo: 'sec', peq: true, onclick: () => trocar(null) }) : null);
    };
    pintarMusica(); pintarBotoesMusica();
    // ---------- (0.8.0) peças do editor ----------
    const rot = (t) => h('div', { class: 'rot' }, t);
    const dica = (t) => h('div', { class: 'peq suave' }, t);
    // (0.8.7) o estúdio do perfil: cada escolha vira um cartãozinho com o desenho do que ela faz, e as partes viram blocos com orbe
    const desenho = (tipo, v) => h('span', { class: `pv pv-${tipo} pv-${tipo}-${v}`, 'aria-hidden': 'true' }, h('i'), h('b'), h('em'));
    const visual = (seg, tipo, valores) => { seg.classList.add('seg-vis'); seg.classList.remove('quebra'); seg.querySelectorAll(':scope > button').forEach((b, i) => { if (valores[i]) b.prepend(desenho(tipo, valores[i])); }); return seg; };
    const bloco = (icone, titulo, ...filhos) => h('div', { class: 'pf-bloco' }, h('div', { class: 'pf-bloco-cab' }, A.orbe(icone, 28), h('b', {}, titulo)), ...filhos);
    const widget = (k, titulo, desc, ...filhos) => h('div', { class: 'pf-widget pf-widget-' + k }, h('div', { class: 'pf-widget-cab' }, h('span', { class: 'pf-widget-ic' }, A.icone(k, 24)), h('div', { class: 'cresce' }, h('b', {}, titulo), h('small', {}, desc))), ...filhos);
    const faixa = (min, max, valor, aoMudar, rotulo) => { const i = U.slider({ min, max, valor, oninput: (v) => { aoMudar(v); retocar(); } }); i.setAttribute('aria-label', rotulo); return h('div', { class: 'linha perfil-faixa' }, h('span', { class: 'peq' }, rotulo), i); };
    // lista de cores (até "max"): cada uma com o seletor, "+" acrescenta e "×" tira
    function listaCores(arr, max, aoMudar, min = 1) {
      const caixa = h('div', { class: 'nm-cores' });
      const refazer = () => {
        caixa.textContent = '';
        arr.forEach((c, i) => {
          const inp = h('input', { type: 'color', class: 'perfil-cor', value: c, 'aria-label': T('Cor ', 'Color ') + (i + 1) });
          inp.addEventListener('input', () => { arr[i] = inp.value; aoMudar(); });
          caixa.append(h('span', { class: 'cor-it' }, inp, arr.length > min ? h('button', { type: 'button', class: 'cor-tirar', title: T('Tirar esta cor', 'Remove this color'), onclick: () => { arr.splice(i, 1); refazer(); aoMudar(); } }, '×') : null));
        });
        if (arr.length < max) caixa.append(U.btn('', { icone: 'mais', tipo: 'sec', redondo: true, peq: true, titulo: T('Mais uma cor', 'Add a color'), onclick: () => { arr.push(arr.length ? outra(arr[arr.length - 1]) : '#2d9ee0'); refazer(); aoMudar(); } }));
      };
      caixa.refazer = refazer; refazer();
      return caixa;
    }
    const outra = (hex) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return '#' + [g, b, r].map((v) => v.toString(16).padStart(2, '0')).join(''); }; // gira os canais: outra cor bem diferente
    const PRESETS_DEG = [['#2d9ee0', '#9b6cff'], ['#ff5f6d', '#ffc371'], ['#42f5b3', '#3fa9ff', '#b26cff'], ['#0b2a3d', '#1a7bc4', '#7fd3ff'], ['#ff6fae', '#ffd1e8'], ['#1d976c', '#93f9b9'], ['#141e30', '#243b55'], ['#f12711', '#f5af19'], ['#ff5f6d', '#ffc371', '#47e3a0', '#4facfe', '#b26cff']];
    const presets = (aoEscolher, lista = PRESETS_DEG) => h('div', { class: 'nm-cores' }, ...lista.map((cs) => h('button', { type: 'button', class: 'nm-preset' + (cs.length > 1 ? ' largo' : ''), estilo: { background: cs.length > 1 ? `linear-gradient(45deg, ${cs.join(', ')})` : cs[0] }, title: cs.join(' → '), onclick: () => { aoEscolher(cs.slice()); A.som.tocar('bolha'); } })));
    // um degradê completo: tipo (linear, radial, cônico), ângulo e as cores
    function editorDegrade(o, ret = retocar) {
      const cores = listaCores(o.c, 10, () => ret());
      const ang = faixa(0, 360, o.a, (v) => { o.a = v; if (ret !== retocar) ret(); }, T('Ângulo', 'Angle'));
      const tipo = U.seg([['linear', T('Linear', 'Linear')], ['radial', T('Circular', 'Circular')]], o.g === 'conico' ? 'radial' : (o.g || 'linear'), (v) => { o.g = v; ang.hidden = v === 'radial'; ret(); });
      ang.hidden = o.g === 'radial' || o.g === 'conico'; if (o.g === 'conico') o.g = 'radial';
      return h('div', { class: 'col', estilo: { gap: '8px' } }, tipo, ang, cores, presets((cs) => { o.c.splice(0, o.c.length, ...cs); cores.refazer(); ret(); }), dica(T('Quantas cores quiser (até 10).', 'As many colors as you like (up to 10).')));
    }

    // ----- aba Nome -----
    const previaNome = h('div', {}), modoAnim = h('div', { class: 'nm-grade nm-amostra nm-modo', hidden: true }), gradeFontes = h('div', { class: 'nm-grade nm-amostra' }), gradeEfeitos = h('div', { class: 'nm-grade nm-amostra' }), coresNome = h('div', { class: 'col', estilo: { gap: '8px' } });
    const SOLIDAS = ['#ffffff', '#e5473b', '#ff8a3d', '#f5c542', '#3fae2a', '#1fb6a6', '#2d9ee0', '#5865f2', '#9b6cff', '#e0559c', '#8a9ba8', '#1d2b38'].map((c) => [c]);
    const PRISMAS = [['#ff5f6d', '#ffc371', '#47e3a0', '#4facfe'], ['#f9d423', '#ff4e50', '#b26cff', '#3fa9ff'], ['#7fd3ff', '#ffffff', '#ffd1e8', '#b26cff'], ['#00f5a0', '#00d9f5', '#7b61ff', '#ff61d2']];
    function pintarNomes() {
      const op = (nm, rotulo, sel, clique) => h('button', { type: 'button', class: 'nm-op' + (sel ? ' sel' : ''), onclick: () => { clique(); A.som.tocar('click'); pintarNomes(); pintar(); } }, U.aplicarNome(h('b', {}, st.nome || 'Aero'), nm), h('small', {}, rotulo));
      gradeFontes.replaceChildren(...U.FONTES_NOME.map(([v, pt, en]) => op({ ...st.nm, f: v }, T(pt, en), st.nm.f === v, () => { st.nm.f = v; })));
      gradeEfeitos.replaceChildren(...U.EFEITOS_NOME.map(([v, pt, en]) => {
        const preso = U.NOME_EXCLUSIVOS.includes(v) && !U.temExclusivos();
        const nx = A.extras ? A.extras.nivelEfeito(v) : 0; // (1.0.0) os efeitos novos do Aero Bubble: dá para ver a prévia; salvar, só com o plano
        const b = op({ ...st.nm, e: v, c: [] }, (preso ? '🔒 ' : '') + T(pt, en), st.nm.e === v, () => { if (preso) { U.toast(T('O Diamante é exclusivo do Aero Bubble Donator e Supporter. Veja em Configurações > Apoie.', 'Diamond is exclusive to Aero Bubble Donator and Supporter. See Settings > Support.')); return; } st.nm.e = v; st.nm.c = []; });
        if (U.NOME_EXCLUSIVOS.includes(v)) b.classList.add('nm-exclusivo');
        if (nx) { b.classList.add('nm-pago'); if (!A.extras.tem(nx)) b.classList.add('preso'); b.append(A.extras.selo(nx)); }
        return b;
      }));
      // (0.8.0) os que se mexem: no nome todo ou letra por letra
      const porLetra = U.NOME_POR_LETRA.includes(st.nm.e) && st.nm.e !== 'onda';
      modoAnim.hidden = !porLetra;
      if (porLetra) modoAnim.replaceChildren(...[['todo', T('Nome todo', 'Whole name')], ['letra', T('Letra por letra', 'Letter by letter')]].map(([v, r]) => op({ ...st.nm, a: v }, r, (st.nm.a === 'letra' ? 'letra' : 'todo') === v, () => { st.nm.a = v === 'letra' ? 'letra' : undefined; })));
      previaNome.replaceChildren(...[A.extras && A.extras.faixaPrevia(A.extras.nivelEfeito(st.nm.e))].filter(Boolean));
      const n = (U.EFEITOS_NOME.find((x) => x[0] === st.nm.e) || [])[3] || 1;
      const base = U.CORES_NOME_PADRAO[st.nm.e] || ['#2d9ee0'];
      const atuais = st.nm.c.length ? st.nm.c : base.slice(0, n);
      // (0.8.0) os degradês: de 2 a 8 cores, com o × para tirar e o + para pôr mais uma
      if (U.NOME_LIVRE.includes(st.nm.e)) {
        if (!st.nm.c.length) st.nm.c = base.slice();
        if (st.nm.c.length < 2) st.nm.c.push(outra(st.nm.c[0]));
        coresNome.replaceChildren(
          h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, listaCores(st.nm.c, U.NOME_MAX_CORES, () => retocar(), 2), U.btn(T('Cores do efeito', 'Effect colors'), { tipo: 'sec', peq: true, onclick: () => { st.nm.c = []; pintarNomes(); pintar(); } })),
          presets((cs) => { st.nm.c = cs; pintarNomes(); pintar(); }, PRISMAS.concat(PRESETS_DEG)),
          dica(T('De 2 a 8 cores.', 'From 2 to 8 colors.')));
        return;
      }
      const inputs = atuais.slice(0, n).map((c, i) => { const inp = h('input', { type: 'color', class: 'perfil-cor', value: c, 'aria-label': T('Cor do nome ', 'Name color ') + (i + 1) }); inp.addEventListener('input', () => { const cs = (st.nm.c.length ? st.nm.c : base.slice(0, n)).slice(); cs[i] = inp.value; st.nm.c = cs; retocar(); }); inp.addEventListener('change', () => pintarNomes()); const rot = A.extras && A.extras.ROTULOS_CORES && A.extras.ROTULOS_CORES()[st.nm.e]; if (rot && rot[i]) { inp.setAttribute('aria-label', rot[i]); return h('label', { class: 'nm-cor-rot', title: rot[i] }, inp, h('span', { class: 'peq suave' }, rot[i])); } return inp; });
      coresNome.replaceChildren(
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, ...inputs, U.btn(T('Cores do efeito', 'Effect colors'), { tipo: 'sec', peq: true, onclick: () => { st.nm.c = []; pintarNomes(); pintar(); } })),
        n === 1 ? presets((cs) => { st.nm.c = cs; pintarNomes(); pintar(); }, SOLIDAS) : null,
        n >= 2 ? presets((cs) => { st.nm.c = cs.slice(0, Math.max(n, 2)); pintarNomes(); pintar(); }, n >= 3 ? PRISMAS.concat(PRESETS_DEG.filter((x) => x.length >= 3)) : PRESETS_DEG) : null);
    }
    pintarNomes();
    const abaNome = h('div', { class: 'col', estilo: { gap: '10px' } },
      rot(T('Fonte', 'Font')), gradeFontes, rot(T('Efeito', 'Effect')), gradeEfeitos, previaNome, modoAnim, rot(T('Cores', 'Colors')), coresNome,
      dica(T('Os efeitos animados se mexem no seu perfil e quando passam o mouse no seu nome.', 'Animated effects move on your profile and when someone hovers your name.')),
      U.btn(T('Voltar ao nome normal', 'Back to plain name'), { tipo: 'sec', peq: true, onclick: () => { st.nm = { f: 'padrao', e: 'solido', c: [] }; pintarNomes(); pintar(); } }));

    // ----- aba Fundo -----
    const fundoCor = h('div', {}), fundoDeg = h('div', {}), fundoBn = h('div', { class: 'col', estilo: { gap: '8px' } });
    const corUnica = h('input', { type: 'color', class: 'perfil-cor', value: st.fd.c[0] || '#1d2b38', 'aria-label': T('Cor do cartão', 'Card color') });
    corUnica.addEventListener('input', () => { st.fd.c[0] = corUnica.value; retocar(); });
    fundoCor.append(h('div', { class: 'linha', estilo: { gap: '10px', 'flex-wrap': 'wrap' } }, corUnica, presets((cs) => { st.fd.c[0] = cs[0]; corUnica.value = cs[0]; retocar(); }, SOLIDAS)));
    const dicaBn = dica('');
    fundoBn.append(faixa(0, 40, st.fd.blur == null ? 14 : st.fd.blur, (v) => { st.fd.blur = v; }, T('Desfoque', 'Blur')), faixa(0, 100, st.fd.luz == null ? 45 : st.fd.luz, (v) => { st.fd.luz = v; }, T('Escurecer', 'Darken')),
      dicaBn);
    // (0.8.5) "Imagem": uma imagem ou GIF animado só para o fundo do cartão (o banner continua o mesmo)
    const fundoImg = h('div', { class: 'col', estilo: { gap: '8px' } });
    const arqFd = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
    arqFd.addEventListener('change', async () => {
      const f = arqFd.files[0]; arqFd.value = ''; if (!f) return;
      try {
        const b = await U.encolher(f); // (0.9.4) até 20 MB vai na qualidade original; acima disso, reduz até caber
        if (!b || b.size > 20 * 1048576) throw new Error(T('Imagem grande demais (máximo 20 MB).', 'Image too large (max 20 MB).'));
        st.fdNovo = { blob: b, url: URL.createObjectURL(b) }; st.tirarFd = false; pintar();
      } catch (e) { U.toast(e.message || T('Não consegui abrir essa imagem.', 'Could not open that image.'), { tipo: 'erro' }); }
    });
    fundoImg.append(h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, arqFd,
      U.btn(T('Escolher imagem ou GIF', 'Choose image or GIF'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arqFd.click() }),
      U.btn(T('Tirar imagem', 'Remove image'), { tipo: 'sec', peq: true, onclick: () => { st.fdNovo = null; st.tirarFd = true; pintar(); } })));
    const pintarModoFundo = () => {
      fundoCor.hidden = st.fd.t !== 'cor'; fundoDeg.hidden = st.fd.t !== 'degrade'; fundoBn.hidden = st.fd.t !== 'banner' && st.fd.t !== 'imagem'; fundoImg.hidden = st.fd.t !== 'imagem';
      dicaBn.textContent = st.fd.t === 'imagem' ? T('A imagem (ou GIF animado) vira o fundo do cartão inteiro; o banner continua no lugar dele. Sem imagem, fica o fundo automático.', 'The image (or animated GIF) becomes the whole card background; your banner stays where it is. Without an image, the automatic background is used.') : T('O seu banner vira o fundo do cartão inteiro. Sem banner, fica o fundo automático.', 'Your banner becomes the whole card background. Without a banner, the automatic background is used.');
      if (st.fd.t === 'degrade' && !fundoDeg.firstChild) { if (st.fd.c.length < 2) st.fd.c.splice(0, st.fd.c.length, st.fd.c[0] || '#1d2b38', outra(st.fd.c[0] || '#1d2b38')); fundoDeg.append(editorDegrade(st.fd)); }
      if (st.fd.t === 'cor' && !st.fd.c.length) st.fd.c.push(corUnica.value);
    };
    const segFundo = U.seg([['auto', T('Automático', 'Automatic')], ['cor', T('Cor', 'Color')], ['degrade', T('Degradê', 'Gradient')], ['banner', 'Banner'], ['imagem', T('Imagem', 'Image')]], st.fd.t, (v) => { st.fd.t = v; pintarModoFundo(); pintar(); });
    visual(segFundo, 'fd', ['auto', 'cor', 'degrade', 'banner', 'imagem']); pintarModoFundo();
    thumbBn = h('div', { class: 'pf-bn-thumb', 'aria-hidden': 'true' }, h('span', {}, T('sem banner', 'no banner')));
    const abaFundo = h('div', { class: 'col', estilo: { gap: '12px' } },
      bloco('imagem', 'Banner', thumbBn, h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, arq, U.btn(T('Escolher imagem', 'Choose image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arq.click() }), U.btn(T('Escolher GIF', 'Choose a GIF'), { icone: 'gif', tipo: 'sec', peq: true, onclick: async () => { const f = await P.escolherGif(T('Um GIF para o seu banner', 'A GIF for your banner')); if (!f) return; try { st.bannerNovo = await comprimirBanner(f); st.tirarBanner = false; pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }), U.btn(T('Tirar banner', 'Remove banner'), { tipo: 'sec', peq: true, onclick: () => { st.bannerNovo = null; st.tirarBanner = true; pintar(); } })), dica(T('Tamanho ideal: 1200 × 420 (o banner compacto mostra a faixa do meio, uns 1200 × 220). GIF animado também vale.', 'Ideal size: 1200 × 420 (the compact banner shows the middle strip, about 1200 × 220). Animated GIFs work too.'))),
      bloco('oPaleta', T('Cores do perfil (moldura)', 'Profile colors (frame)'), h('div', { class: 'pf-moldura' }, h('div', { class: 'pf-moldura-atual' }, c1, c2, h('small', { class: 'suave' }, T('As suas', 'Yours'))), h('div', { class: 'pf-moldura-mod' }, h('small', { class: 'suave' }, T('Modelos', 'Presets')), paleta))), // (0.8.7) as duas atuais | os modelos
      bloco('apps', T('Fundo do cartão', 'Card background'), segFundo, fundoCor, fundoDeg, fundoImg, fundoBn));

    // ----- aba Nameplate -----
    const npDeg = h('div', {}), npImg = h('div', { class: 'col', estilo: { gap: '8px' } }), npBn = dica(T('Usa o seu banner (a faixa do meio).', 'Uses your banner (the middle strip).'));
    const arqNp = h('input', { type: 'file', accept: 'image/*', hidden: true });
    arqNp.addEventListener('change', async () => { const f = arqNp.files[0]; arqNp.value = ''; if (!f) return; try { const r = f.type === 'image/gif' || (await U.animada(f)) ? f : await U.recortar(f, { largura: 900, altura: 180, nativo: true, titulo: T('Ajustar o nameplate', 'Adjust the nameplate') }); if (!r) return; const b = await U.encolher(r.type ? r : f); if (b.size > 20 * 1048576) throw new Error(T('Imagem grande demais (máximo 20 MB).', 'Image too large (max 20 MB).')); st.npNovo = { blob: b, url: URL.createObjectURL(b) }; st.tirarNp = false; pintar(); } catch (e) { U.toast(e.message || T('Não consegui abrir essa imagem.', 'Could not open that image.'), { tipo: 'erro' }); } });
    npImg.append(h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, arqNp, U.btn(T('Escolher imagem', 'Choose image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arqNp.click() })), dica(T('Tamanho ideal: 900 × 180 (5:1). O lado esquerdo fica mais apagado para o nome aparecer.', 'Ideal size: 900 × 180 (5:1). The left side fades so your name stays readable.')));
    const pintarModoNp = () => {
      npDeg.hidden = st.np.t !== 'degrade'; npImg.hidden = st.np.t !== 'imagem'; npBn.hidden = st.np.t !== 'banner';
      if (st.np.t === 'degrade' && !npDeg.firstChild) { if (st.np.c.length < 2) st.np.c.splice(0, st.np.c.length, '#2d9ee0', '#9b6cff'); npDeg.append(editorDegrade(st.np)); }
    };
    const segNp = U.seg([['nenhum', T('Nenhum', 'None')], ['degrade', T('Degradê', 'Gradient')], ['banner', 'Banner'], ['imagem', T('Imagem', 'Image')]], st.np.t, (v) => { st.np.t = v; pintarModoNp(); pintar(); });
    visual(segNp, 'np', ['nenhum', 'degrade', 'banner', 'imagem']); pintarModoNp();
    const abaNp = h('div', { class: 'col', estilo: { gap: '10px' } }, dica(T('O nameplate é o fundo do seu nome nas listas de conversa dos seus amigos.', 'The nameplate is the background behind your name in your friends\' chat lists.')), segNp, npDeg, npBn, npImg);

    // ----- aba Arranjo -----
    // o banner: em cima, embaixo, na esquerda, na direita ou cobrindo tudo (também dá para arrastar o banner na prévia)
    const segBn = h('div', {});
    function pintarBn() {
      const s0 = U.seg([['cima', T('Em cima', 'Top')], ['baixo', T('Embaixo', 'Bottom')], ['esquerda', T('Esquerda', 'Left')], ['direita', T('Direita', 'Right')], ['cheio', T('Cobrir o perfil todo', 'Cover the whole profile')], ['nenhum', T('Sem banner', 'No banner')]],
        st.pf.bn !== 'faixa' ? st.pf.bn : st.pf.bp, (v) => { if (v === 'cheio' || v === 'nenhum') st.pf.bn = v; else { st.pf.bn = 'faixa'; st.pf.bp = v; } pintar(); });
      visual(s0, 'bn', ['cima', 'baixo', 'esquerda', 'direita', 'cheio', 'nenhum']); segBn.replaceChildren(s0);
    }
    pintarBn();
    const compactas = h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } });
    const segMus = visual(U.seg([['p', T('Pequena', 'Small')], ['m', T('Média', 'Medium')], ['g', T('Grande', 'Large')]], st.pf.ms, (v) => { st.pf.ms = v; pintar(); }), 'mus', ['p', 'm', 'g']);
    const linhaMus = h('div', { class: 'col', estilo: { gap: '6px' } }, rot(T('Tamanho da música', 'Song size')), segMus);
    const pintarCompactas = () => {
      compactas.replaceChildren(...['bio', 'musica', 'discord', ...(st.gl ? ['gl'] : [])].map((k) => {
        const sel = st.pf.cp.includes(k);
        return h('button', { type: 'button', class: 'pf-chip' + (sel ? ' sel' : ''), 'aria-pressed': String(sel), onclick: () => { st.pf.cp = sel ? st.pf.cp.filter((x) => x !== k) : st.pf.cp.concat(k); const g = st.pf.gw[k]; if (g) { if (!sel) TAM_ANTES[k] = { w: g.w, h: g.h }; st.pf.gw[k] = sel ? { ...g, ...(TAM_ANTES[k] || minimo(k, st.pf)) } : { ...g, w: 1, h: 1 }; } P.ajustarGrade(st.pf, k); pintarCompactas(); pintar(); A.som.tocar('click'); } }, A.icone({ bio: 'chat', musica: 'spotify', discord: 'discord', gl: 'link' }[k], 15), T(...P.PARTES[k]));
      }));
      linhaMus.hidden = st.pf.cp.includes('musica');
    };
    pintarCompactas();
    const largura = U.slider({ min: 300, max: 560, valor: st.pf.w, oninput: (v) => { st.pf.w = v; rotW.textContent = v + ' px'; pintar(); } });
    const altura = U.slider({ min: 280, max: 800, valor: st.pf.ht || 280, oninput: (v) => { st.pf.ht = v < 300 ? 0 : v; rotH.textContent = st.pf.ht ? st.pf.ht + ' px' : T('Automática', 'Automatic'); pintar(); } });
    largura.setAttribute('aria-label', T('Largura do perfil', 'Profile width')); altura.setAttribute('aria-label', T('Altura do perfil', 'Profile height'));
    const rotW = h('span', { class: 'peq suave' }), rotH = h('span', { class: 'peq suave' });
    sincronizarTamanho = () => { largura.atualizar(st.pf.w); altura.atualizar(st.pf.ht || 280); rotW.textContent = st.pf.w + ' px'; rotH.textContent = st.pf.ht ? st.pf.ht + ' px' : T('Automática', 'Automatic'); };
    sincronizarTamanho();
    const segEu = U.seg([['auto', T('Automático', 'Automatic')], ['nada', T('Nada', 'None')], ['nameplate', 'Nameplate'], ['banner', 'Banner'], ['fundo', T('Fundo do perfil', 'Profile background')]], st.pf.eu, (v) => { st.pf.eu = v; pintar(); }); visual(segEu, 'eu', ['auto', 'nada', 'nameplate', 'banner', 'fundo']);
    // as prévias das listas: o seu cartão no fim da sua lista (aqui) e o seu nome na lista dos amigos (na aba Nameplate)
    const euCaixa = h('div', {}), npCaixa = h('div', {});
    function pintarListas(p, bnLocal) {
      let np = P.fundoNameplate(p);
      if (st.np.t === 'imagem' && st.npNovo) np = `url("${urlLocal(st.npNovo)}") center / cover no-repeat`;
      if (st.np.t === 'banner' && bnLocal) np = `url("${bnLocal}") center / cover no-repeat`;
      const linha = h('div', { class: 'tk-item perfil-previa-np fixo' }, A.ui.avatar(p, 46, 'online'), h('div', { class: 'cresce' }, h('div', { class: 'tk-item-nome' }, A.ui.aplicarNome(h('span', {}, p.nome), st.nm)), h('div', { class: 'tk-item-previa' }, T('online', 'online'))));
      pintarNp(linha, np); npCaixa.replaceChildren(linha);
      const euCard = h('div', { class: 'tk-eu perfil-previa-np fixo' }, A.ui.avatar(p, 46, 'online'), h('div', { class: 'cresce' }, A.ui.aplicarNome(h('b', {}, p.nome), st.nm), h('div', { class: 'peq suave tk-eu-bio' }, p.bio || T('Toque para editar o seu perfil', 'Tap to edit your profile'))));
      P.fundoCartaoLista(euCard, p, { banner: bnLocal, np }); euCaixa.replaceChildren(euCard);
    }
    abaNp.append(rot(T('Como o seu nome aparece na lista dos seus amigos', 'How your name looks in your friends\' list')), npCaixa);
    const miniPrev = h('div', { class: 'pf-mini-prev', 'aria-hidden': 'true' }); // (0.8.7) antes de usar no bloco abaixo
    const abaArranjo = h('div', { class: 'col', estilo: { gap: '10px' } },
      h('div', { class: 'pf-dica' }, A.icone('mouse', 18), h('span', {}, T('Segure e arraste na prévia: cada widget (nome, bio, música e Discord) vai para os quadradinhos da grade e fica exatamente ali; puxe o cantinho dele para mudar o tamanho (o que não couber é comprimido). A foto vai para um dos 9 lugares; o banner, para um dos lados.', 'Hold and drag in the preview: each widget (name, bio, song and Discord) goes to the grid squares and stays exactly there; drag its corner to resize it (whatever does not fit is shrunk). The photo goes to one of the 9 spots; the banner, to one of the sides.'))),
      bloco('imagem', 'Banner', segBn),
      // (0.9.6) a foto num canto: só ela vai para o lado (o resto do cartão fica igual) ou ela ganha uma coluna inteira só dela
      // (1.0.0) explicado de verdade: o que cada um muda no cartão, e um aviso quando a foto está no meio (aí a escolha ainda não muda nada)
      bloco('pessoa', T('Foto na lateral', 'Photo on the side'),
        dica(T('Vale quando você arrasta a sua foto para a esquerda ou para a direita do cartão, na prévia. Escolha como o resto do cartão se arruma em volta dela:', 'Applies when you drag your photo to the left or right of the card, in the preview. Choose how the rest of the card arranges around it:')),
        h('ul', { class: 'pf-fo-lista peq' },
          h('li', {}, h('b', {}, T('Foto numa linha: ', 'Photo in a row: ')), T('a foto fica numa linha só dela, encostada no lado, na altura em que você a pôs (em cima, no meio ou embaixo). O nome e os widgets continuam usando a largura toda do cartão.', 'the photo gets a row of its own, against the side, at the height you put it (top, middle or bottom). Your name and widgets keep the full width of the card.')),
          h('li', {}, h('b', {}, T('Foto numa coluna: ', 'Photo in a column: ')), T('a foto ganha uma faixa só dela, de cima a baixo, e o nome e os widgets ficam ao lado dela, como uma página de revista.', 'the photo gets its own strip from top to bottom, and your name and widgets sit next to it, like a magazine page.'))),
        st.pf.fp[1] === 'c' ? h('div', { class: 'peq suave pf-fo-aviso' }, A.icone('atencao', 14), h('span', {}, T('Agora a sua foto está no meio, então isto só faz diferença quando você arrastá-la para um dos lados.', 'Your photo is in the middle now, so this only matters once you drag it to one side.'))) : null,
        visual(U.seg([['so', T('Foto numa linha', 'Photo in a row')], ['col', T('Foto numa coluna', 'Photo in a column')]], st.pf.fo === 'so' ? 'so' : 'col', (v) => { if (v === 'so') st.pf.fo = 'so'; else delete st.pf.fo; P.ajustarGrade(st.pf); pintar(); }), 'fo', ['so', 'col'])),
      bloco('chat', T('Widgets compactos', 'Compact widgets'), dica(T('Viram uma bolinha que abre com o mouse.', 'They become a small bubble that opens on hover.')), compactas, linhaMus),
      bloco('ajustes', T('Tamanho do perfil', 'Profile size'),
        h('div', { class: 'linha perfil-faixa' }, h('span', { class: 'peq' }, T('Largura', 'Width')), largura, rotW),
        h('div', { class: 'linha perfil-faixa' }, h('span', { class: 'peq' }, T('Altura', 'Height')), altura, rotH),
        dica(T('Ou puxe as bordas da direita e de baixo do cartão na prévia.', 'Or drag the right and bottom edges of the card in the preview.'))),
      bloco('pessoa', T('Mini perfil', 'Mini profile'), dica(T('A foto quando clicam nela no chat.', 'Your photo when someone clicks it in chat.')),
      visual(U.seg([['esquerda', T('Esquerda', 'Left')], ['meio', T('Meio', 'Center')], ['direita', T('Direita', 'Right')]], maAtual(), (v) => { if (v === 'meio') delete st.pf.ma; else st.pf.ma = v; pintarMiniPrev(); }), 'ma', ['esquerda', 'meio', 'direita']), miniPrev),
      U.btn(T('Voltar o arranjo ao padrão', 'Reset the layout'), { tipo: 'sec', peq: true, onclick: () => { const eu0 = st.pf.eu, ba0 = st.pf.ba, bt0 = st.pf.bt, ma0 = st.pf.ma, si0 = st.pf.si, so0 = st.pf.so; st.pf = P.arranjoDe({}); st.pf.eu = eu0; if (ba0 === false) st.pf.ba = false; if (si0 === false) st.pf.si = false; if (so0) st.pf.so = so0; if (bt0) st.pf.bt = bt0; if (ma0) st.pf.ma = ma0; pintarBn(); pintarCompactas(); sincronizarTamanho(); pintar(); } }));

    // (0.8.7) prévia do mini perfil: como o cartãozinho aparece no chat com a foto à esquerda, no meio ou à direita
    function maAtual() { return st.pf.ma === 'lado' ? ({ e: 'esquerda', d: 'direita' }[(st.pf.fp || 'cc')[1]] || 'meio') : st.pf.ma === 'esquerda' || st.pf.ma === 'direita' ? st.pf.ma : 'meio'; }
    function pintarMiniPrev() {
      const ma = maAtual(), b = (typeof st.bannerNovo === 'string' && st.bannerNovo) || (st.tirarBanner ? null : urlBanner(eu.codigo, eu.bannerV)), c1 = st.cor1 || '#2d9ee0', c2 = st.cor2 || st.cor1 || '#7fd3ff';
      miniPrev.className = 'pf-mini-prev lado-' + ma;
      miniPrev.style.setProperty('--c1', c1); miniPrev.style.setProperty('--c2', c2);
      miniPrev.replaceChildren(h('div', { class: 'pf-mini-prev-cartao' },
        h('div', { class: 'pf-mini-prev-banner', estilo: b ? { 'background-image': `url("${b}")` } : {} }),
        h('div', { class: 'pf-mini-prev-av' }, U.avatar(eu, 52)),
        h('div', { class: 'pf-mini-prev-txt' }, h('b', {}, eu.apelido || eu.nome || ''), h('small', {}, '#' + (eu.tag || ''))),
        h('i', { class: 'pf-mini-prev-l1' }), h('i', { class: 'pf-mini-prev-l2' })));
    }
    pintarMiniPrev();
    const edStatus = U.editorStatus(); // (0.8.5) o "Salvar perfil" também salva o status personalizado que ficou sem salvar
    // ----- aba Perfil (o de sempre) -----
    const abaPerfil = h('div', { class: 'col', estilo: { gap: '10px' } },
        // (0.8.7) o personalizado é um status à parte (não se mistura com Online/Ausente...): escolher um dos outros tira o personalizado
        (() => {
          const persCx = h('div', { class: 'col st-pers-cx', estilo: { gap: '8px' } }, h('div', { class: 'rot' }, T('Seu status personalizado', 'Your custom status')), edStatus);
          const ini = eu.stc && eu.status !== 'invisivel' ? 'pers' : eu.status || 'online';
          persCx.hidden = ini !== 'pers';
          const seg = visual(U.seg([['online', T('Online', 'Online')], ['ausente', T('Ausente', 'Away')], ['ocupado', T('Não perturbe', 'Do not disturb')], ['invisivel', T('Invisível', 'Invisible')], ['pers', T('Personalizado', 'Custom')]], ini, async (v) => {
            persCx.hidden = v !== 'pers';
            if (v !== 'pers') await U.mudarStatus(v, true);
            else if ((A.api.eu || eu).status !== 'online') await U.mudarStatus('online');
          }), 'st', ['online', 'ausente', 'ocupado', 'invisivel', 'pers']);
          return bloco('pessoa', T('Status', 'Status'), seg, persCx);
        })(), // (0.8.3)
        // (0.9.6) quem não gosta de insígnias no perfil pode esconder (as suas somem do cartão, do mini perfil e da lista do grupo)
        (() => { // (1.0.0) liga ou desliga todas e escolhe exatamente quais aparecem: cada uma num cartão com a prévia, o nome e o que ela é,
          // e em cima a prévia de como fica ao lado do seu nome (muda na hora, junto com a prévia do perfil)
          const SOBRE = { dev: T('Quem faz o Aero', 'Made Aero'), mod: T('Cuida da comunidade', 'Looks after the community'), standard: T('Selo do seu plano', 'Your plan badge'), plus: T('Selo do seu plano', 'Your plan badge'),
            donator: T('Selo do seu plano', 'Your plan badge'), supporter: T('Selo do seu plano', 'Your plan badge'),
            fundador: T('Para sempre', 'Forever') };
          const sls = (Array.isArray(eu.sl) ? eu.sl : []).filter((x, i, l) => U.nomeSelo && U.nomeSelo(x) && l.indexOf(x) === i);
          const inss = (Array.isArray(eu.ins) ? eu.ins : []).filter((x) => x && x.t).slice(0, 4);
          const itens = [...sls.map((x) => ({ k: 's:' + x, el: U.selos([x]), nome: U.nomeSelo(x), sobre: SOBRE[x] || (/^fiel\d+$/.test(x) ? T('Selo de fidelidade', 'Loyalty badge') : '') })),
            ...inss.map((x) => ({ k: U.chaveIns(x), el: U.insignias([x]), nome: x.t, sobre: T('Insígnia especial', 'Special badge') }))].filter((x, i, l) => x.el && l.findIndex((y) => y.k === x.k) === i);
          if (!itens.length) return null;
          const oculta = (k) => Array.isArray(st.pf.so) && st.pf.so.includes(k);
          const quantas = h('small', { class: 'ins-quantas suave' });
          const amostra = h('div', { class: 'ins-amostra', 'aria-live': 'polite' });
          const botoes = [];
          const repintar = () => {
            const n = itens.filter((x) => !oculta(x.k)).length;
            quantas.textContent = T(`${n} de ${itens.length} aparecendo`, `${n} of ${itens.length} showing`);
            const ins = U.insignias(inss, sls, st.pf.so);
            amostra.replaceChildren(h('span', { class: 'rot-mini suave' }, T('Ao lado do seu nome', 'Next to your name')),
              h('div', { class: 'ins-amostra-nome' }, h('b', {}, st.nome || eu.nome), ins ? [' ', ins] : h('span', { class: 'peq suave' }, ' ' + T('(nenhuma)', '(none)'))));
            botoes.forEach((b, i) => b.setAttribute('aria-pressed', String(!oculta(itens[i].k))));
          };
          const marcar = (k, mostrar) => { const so = (Array.isArray(st.pf.so) ? st.pf.so : []).filter((x) => x !== k); if (!mostrar) so.push(k); if (so.length) st.pf.so = so; else delete st.pf.so; };
          const grade = h('div', { class: 'ins-escolha', role: 'group', 'aria-label': T('Quais insígnias mostrar', 'Which badges to show') }, ...itens.map((x) => {
            const b = h('button', { type: 'button', class: 'ins-esc', title: x.nome, 'aria-pressed': String(!oculta(x.k)) },
              h('span', { class: 'ins-esc-prev' + (x.k[0] === 's' ? ' selo' : '') }, x.el),
              h('span', { class: 'ins-esc-txt' }, h('b', {}, x.nome), x.sobre ? h('small', {}, x.sobre) : null),
              h('span', { class: 'ins-esc-marca', 'aria-hidden': 'true' }, A.icone('ok', 12)));
            b.onclick = () => { marcar(x.k, oculta(x.k)); repintar(); pintar(); };
            botoes.push(b); return b;
          }));
          const todas = (mostrar) => { itens.forEach((x) => marcar(x.k, mostrar)); repintar(); pintar(); };
          const atalhos = h('div', { class: 'linha ins-atalhos' }, quantas, h('span', { class: 'cresce' }),
            U.btn(T('Todas', 'All'), { tipo: 'sec', peq: true, onclick: () => todas(true) }), U.btn(T('Nenhuma', 'None'), { tipo: 'sec', peq: true, onclick: () => todas(false) }));
          const corpo = h('div', { class: 'col ins-corpo' }, amostra, atalhos, grade);
          corpo.hidden = st.pf.si === false;
          repintar();
          return h('div', { class: 'col', estilo: { gap: '10px' } }, h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Mostrar minhas insígnias', 'Show my badges'), h('div', { class: 'peq suave' }, T('Escolha exatamente quais aparecem ao lado do seu nome: no perfil, no mini perfil e nos grupos.', 'Pick exactly which ones show next to your name: on your profile, mini profile and in groups.'))),
            U.chave(st.pf.si !== false, (v) => { if (v) delete st.pf.si; else st.pf.si = false; corpo.hidden = !v; pintar(); })), corpo);
        })(),
        P.bordaDe(eu.sl) ? (() => { // (0.8.2) Donator: liga ou desliga. Supporter: liga ou desliga e escolhe a borda (a dele ou a do Donator)
          const sup = P.bordaDe(eu.sl) === 'supporter';
          const qual = sup ? ((x) => { x.classList.add('pf-borda-qual'); return x; })(U.seg([['supporter', 'Supporter'], ['donator', 'Donator']], st.pf.bt === 'donator' ? 'donator' : 'supporter', (v) => { if (v === 'donator') st.pf.bt = 'donator'; else delete st.pf.bt; pintar(); })) : null;
          if (qual) qual.hidden = st.pf.ba === false;
          const desc = () => (!sup || st.pf.bt !== 'donator' ? (sup ? T('A borda de coração do Supporter, girando em volta do cartão.', 'The Supporter heart border, spinning around the card.') : T('A borda do Donator, girando em volta do cartão.', 'The Donator border, spinning around the card.')) : T('A borda do Donator, girando em volta do cartão.', 'The Donator border, spinning around the card.'));
          const dsc = h('div', { class: 'peq suave' }, desc());
          return h('div', { class: 'col', estilo: { gap: '6px' } },
            h('div', { class: 'opcao curta' }, h('div', { class: 'cresce' }, T('Borda animada no perfil', 'Animated profile border'), dsc),
              U.chave(st.pf.ba !== false, (v) => { if (v) delete st.pf.ba; else st.pf.ba = false; if (qual) qual.hidden = !v; pintar(); })),
            qual ? h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, qual) : null);
        })() : null,
        bloco('lapis', T('Você', 'You'), h('div', { class: 'rot' }, T('Foto', 'Photo')), h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, foto, U.btn(T('Trocar foto', 'Change photo'), { icone: 'camera', tipo: 'sec', peq: true, onclick: () => foto.click() }), U.btn(T('Escolher GIF', 'Choose a GIF'), { icone: 'gif', tipo: 'sec', peq: true, onclick: async () => { const f = await P.escolherGif(T('Um GIF para a sua foto', 'A GIF for your photo')); if (!f) return; try { st.fotoNova = await P.prepararFoto(f); pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }), h('span', { class: 'peq suave' }, T('GIF animado de até 20 MB também vale', 'Animated GIFs up to 20 MB work too'))), recentes,
        h('div', { class: 'linha', estilo: { gap: '10px', 'align-items': 'flex-start', 'flex-wrap': 'wrap' } },
          h('div', { class: 'cresce', estilo: { 'min-width': '160px' } }, h('div', { class: 'rot' }, T('Nome', 'Name')), nomeI),
          h('div', { class: 'cresce', estilo: { 'min-width': '160px' } }, h('div', { class: 'rot' }, T('Sua # (única)', 'Your # (unique)')), tagI, tagMsg)),
        h('div', { class: 'rot' }, T('Biografia', 'Bio')), bio));
    // (0.8.7) widgets do Mural e do Letterboxd (já fazem parte do perfil, sem integração): cada categoria do Mural pode virar um widget
    const favCampos = (() => {
      const lbI = h('input', { class: 'campo', placeholder: T('seu usuário do Letterboxd', 'your Letterboxd username'), maxlength: 16 }); lbI.value = st.lb;
      lbI.addEventListener('change', () => { st.lb = lbI.value.trim().replace(/^@/, '').toLowerCase(); pintar(); });
      // (0.9.0) sem escolher favoritos aqui: o widget mostra o que aparece no seu Letterboxd
      return [widget('letterboxd', 'Letterboxd', T('Os filmes do seu Letterboxd, com capa. Clicar abre os curtidos e os vistos por último', 'Films from your Letterboxd, with posters. Clicking opens liked and recently watched'), h('div', { class: 'col', estilo: { gap: '8px' } }, lbI))];
    })();
    // (0.9.5) guns.lol (integração oficial): o link já vem pronto, a pessoa só põe o nick
    const glCampo = (() => {
      const glI = h('input', { class: 'campo gl-nick', placeholder: T('seu nick', 'your nickname'), maxlength: 32, spellcheck: 'false', autocapitalize: 'off' }); glI.value = st.gl;
      glI.addEventListener('input', () => { const v = glI.value.trim().replace(/^(?:https?:\/\/)?(?:www\.)?guns\.lol\//i, '').replace(/^@/, '').replace(/\/+$/, '').toLowerCase(); if (v !== glI.value) glI.value = v; st.gl = /^[a-z0-9_.-]{1,32}$/.test(v) ? v : ''; pintar(); pintarCompactas(); });
      return widget('link', 'guns.lol', T('Prévia da sua página no cartão, com o seu banner e a sua foto. Quem clicar vai para lá', 'A preview of your page on the card, with your banner and photo. Clicking it opens it'),
        h('label', { class: 'gl-campo' }, h('span', { class: 'gl-pre' }, 'https://guns.lol/'), glI));
    })();
    const widgetsInteg = h('div', { class: 'pf-widgets' }, ...favCampos);
    const pintarGl = () => { const ok = (A.integ && A.integ.instalada && A.integ.instalada('gunslol')) || !!st.gl; if (ok && !glCampo.isConnected) widgetsInteg.append(glCampo); else if (!ok) glCampo.remove(); };
    pintarGl(); const offGl = A.evt.on('integ:mudou', pintarGl);
    // (0.8.7) a aba Mural: de que lado do cartão ele fica (ou sem mural) e o que tem nele
    const muralCaixa = h('div', { class: 'col' }, h('div', { class: 'suave peq' }, T('Carregando o mural...', 'Loading the wall...')));
    A.mural.esquecer(eu.codigo);
    A.mural.dados(eu.codigo, eu.mv).then((m) => { st.mural = JSON.parse(JSON.stringify(m || {})); muralCaixa.replaceChildren(A.mural.editor(st.mural, () => { st.muralMudou = true; pintar(); pintarMural(true); }, () => pintarMural(true))); pintar(); pintarMural(true); })
      .catch(() => muralCaixa.replaceChildren(dica(T('Não deu para abrir o mural agora.', 'Could not open the wall now.'))));
    const ladoMural = U.seg([['', T('Sem mural', 'No wall')], ['esquerda', T('Esquerda', 'Left')], ['direita', T('Direita', 'Right')], ['cima', T('Em cima', 'Top')], ['baixo', T('Embaixo', 'Bottom')]], st.ml, (v) => { st.ml = v; A.som.tocar('click'); pintar(); pintarMural(); });
    visual(ladoMural, 'ml', ['nada', 'esquerda', 'direita', 'cima', 'baixo']); // (0.8.7) cada lado com o desenho do cartão e do mural
    // (0.8.7) o fundo do Mural: o vidro do Aero, igual ao cartão, uma cor, um degradê ou uma imagem própria
    const mfCor = h('div', {}), mfDeg = h('div', {}), mfImg = h('div', { class: 'col', estilo: { gap: '8px' } });
    const mfCorI = h('input', { type: 'color', class: 'perfil-cor', value: st.mf.c[0] || '#1d2b38', 'aria-label': T('Cor do mural', 'Wall color') });
    mfCorI.addEventListener('input', () => { st.mf.c[0] = mfCorI.value; retocarMural(); });
    mfCor.append(h('div', { class: 'linha', estilo: { gap: '10px', 'flex-wrap': 'wrap' } }, mfCorI, presets((cs) => { st.mf.c[0] = cs[0]; mfCorI.value = cs[0]; retocarMural(); }, SOLIDAS)));
    const arqMf = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
    arqMf.addEventListener('change', async () => {
      const f = arqMf.files[0]; arqMf.value = ''; if (!f) return;
      try {
        const b = await U.encolher(f); // (0.9.4) até 20 MB vai na qualidade original
        if (!b || b.size > 20 * 1048576) throw new Error(T('Imagem grande demais (máximo 20 MB).', 'Image too large (max 20 MB).'));
        st.mfNovo = { blob: b, url: URL.createObjectURL(b) }; st.tirarMf = false; retocarMural();
      } catch (e) { U.toast(e.message || T('Não consegui abrir essa imagem.', 'Could not open that image.'), { tipo: 'erro' }); }
    });
    mfImg.append(h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, arqMf,
        U.btn(T('Escolher imagem ou GIF', 'Choose image or GIF'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arqMf.click() }),
        U.btn(T('Tirar imagem', 'Remove image'), { tipo: 'sec', peq: true, onclick: () => { st.mfNovo = null; st.tirarMf = true; retocarMural(); } })),
      faixa(0, 40, st.mf.blur == null ? 0 : st.mf.blur, (v) => { st.mf.blur = v; retocarMural(); }, T('Desfoque', 'Blur')),
      faixa(0, 100, st.mf.luz == null ? 35 : st.mf.luz, (v) => { st.mf.luz = v; retocarMural(); }, T('Escurecer', 'Darken')));
    const mfDica = dica('');
    const pintarModoMf = () => {
      mfCor.hidden = st.mf.t !== 'cor'; mfDeg.hidden = st.mf.t !== 'degrade'; mfImg.hidden = st.mf.t !== 'imagem';
      mfDica.hidden = !(st.mf.t === 'vidro' || st.mf.t === 'cartao');
      mfDica.textContent = st.mf.t === 'cartao' ? T('O mural usa o mesmo fundo do seu cartão (aba Fundo).', 'The wall uses the same background as your card (Background tab).') : T('O vidro do Aero, nas cores do seu perfil.', 'Aero glass, in your profile colors.');
      if (st.mf.t === 'degrade' && !mfDeg.firstChild) { if (st.mf.c.length < 2) st.mf.c.splice(0, st.mf.c.length, st.cor1 || '#2d9ee0', st.cor2 || '#9b6cff'); // (começa nas cores do perfil)
        mfDeg.append(editorDegrade(st.mf, retocarMural)); }
      if (st.mf.t === 'cor' && !st.mf.c.length) { st.mf.c.push(st.cor1 || mfCorI.value); mfCorI.value = st.mf.c[0]; }
    };
    const segMf = U.seg([['vidro', T('Vidro', 'Glass')], ['cartao', T('Igual ao cartão', 'Same as card')], ['cor', T('Cor', 'Color')], ['degrade', T('Degradê', 'Gradient')], ['imagem', T('Imagem', 'Image')]], st.mf.t, (v) => { st.mf.t = v; pintarModoMf(); retocarMural(); });
    visual(segMf, 'mf', ['vidro', 'cartao', 'cor', 'degrade', 'imagem']); pintarModoMf();
    const abaMural = h('div', { class: 'col', estilo: { gap: '12px' } },
      bloco('apps', T('Mural', 'Wall'), dica(T('Uma seção à parte, grudada num lado do seu cartão, com abas de filmes, séries, animes, músicas, álbuns e jogos. Quem abre o seu perfil clica num item e vê a sua nota e o seu comentário.', 'A separate section stuck to one side of your card, with tabs for movies, shows, anime, songs, albums and games. Whoever opens your profile clicks an item to see your rating and comment.')),
        h('div', { class: 'rot' }, T('Lado do cartão', 'Card side')), ladoMural),
      bloco('imagem', T('Fundo do Mural', 'Wall background'), segMf, mfDica, mfCor, mfDeg, mfImg),
      muralCaixa);
    // (0.8.7) a aba Widgets: o que aparece no cartão além de você (por enquanto Discord e a música; outros vêm depois)
    const abaWidgets = h('div', { class: 'col', estilo: { gap: '12px' } },
        h('div', { class: 'pf-widgets' },
          widget('discord', 'Discord', T('O seu @ aparece no cartão', 'Your @ shows on the card'), disc),
          widget('spotify', T('Música do perfil', 'Profile song'), T('Busca ou link do Spotify; você escolhe o trecho de 30 s', 'Search or Spotify link; you pick the 30 s part'), musicaInfo, botoesMusica)),
        widgetsInteg);
    // (0.8.1) perfis salvos (Supporter): 5 espaços com o estilo e o arranjo do perfil, para trocar num clique
    const salvos = h('div', { class: 'col pf-salvos', estilo: { gap: '6px' } });
    const pintarSalvos = (r) => {
      const max = r.max || 0;
      if (!max) { salvos.replaceChildren(h('div', { class: 'rot' }, T('Perfis salvos', 'Saved profiles')), dica('🔒 ' + T('Com o Aero Bubble Supporter: guarde até 5 perfis e troque num clique.', 'With Aero Bubble Supporter: keep up to 5 profiles and switch in one click.'))); return; }
      const fazer = async (acao, i, extra = {}) => {
        try {
          const x = await API.req('perfis-salvos', { acao, i, ...extra });
          if (acao === 'usar') { m.fechar(false); setTimeout(() => P.editar(), 320); return; }
          pintarSalvos(x);
        } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      };
      const linhas = Array.from({ length: max }, (_, i) => {
        const x = (r.perfis || [])[i];
        return h('div', { class: 'pf-salvo' + (x ? '' : ' vazio') },
          h('span', { class: 'cresce' }, x ? x.nome : T('Espaço ' + (i + 1) + ' (vazio)', 'Slot ' + (i + 1) + ' (empty)')),
          x ? U.btn(T('Usar', 'Use'), { peq: true, onclick: () => fazer('usar', i) }) : null,
          U.btn(x ? T('Substituir', 'Replace') : T('Guardar aqui', 'Save here'), { peq: true, tipo: 'sec', onclick: () => { const nome = x ? x.nome : (st.nome || 'Perfil') + ' ' + (i + 1); fazer('salvar', i, { nome }); } }),
          x ? U.btn('', { icone: 'fechar', peq: true, tipo: 'sec', redondo: true, titulo: T('Apagar', 'Delete'), onclick: () => fazer('apagar', i) }) : null);
      });
      salvos.replaceChildren(h('div', { class: 'rot' }, T('Perfis salvos', 'Saved profiles')), ...linhas,
        dica(T('Guarda o perfil como está salvo agora (estilo do nome, fundo, nameplate, arranjo, bio e música). A foto e o banner continuam os de agora.', 'Keeps your profile as it is saved now (name style, background, nameplate, layout, bio and song). Your photo and banner stay the same.')));
    };
    API.req('perfis-salvos', { acao: 'listar' }).then(pintarSalvos).catch(() => {});
    abaPerfil.append(salvos);
    const abas = { perfil: abaPerfil, widgets: abaWidgets, mural: abaMural, nome: abaNome, fundo: abaFundo, np: abaNp, arranjo: abaArranjo };
    if (A.extras) abas.extras = A.extras.abaPerfil(st, pintar, { rot, dica }); // (1.0.0) os extras do Aero Bubble (moldura, abertura, acessórios, chamada)
    const caixaAba = h('div', { class: 'perfil-aba' });
    // (0.8.7) todas as abas ficam montadas, uma em cima da outra: trocar de aba só mostra outra (sem montar nada, então não trava) e a
    // janela fica sempre do tamanho da maior aba (não muda de tamanho a cada troca)
    for (const [k, no] of Object.entries(abas)) { no.classList.add('pf-pagina'); no.dataset.aba = k; caixaAba.append(no); }
    const irAba = (k) => {
      abaAtual = k;
      for (const [k2, no] of Object.entries(abas)) { const fora = k2 !== k; no.classList.toggle('fora', fora); no.inert = fora; }
      // (1.0.2) as entradas (botões brotando) da aba que aparece já terminam: a aba chega pronta, sem os botões piscarem um por um
      try { for (const an of abas[k].getAnimations({ subtree: true })) if (an.effect && an.effect.target !== abas[k] && an.effect.getTiming().iterations !== Infinity) an.finish(); } catch (e) { /* ok */ }
      const c = previa.querySelector('.perfil-cartao'); if (c) c.classList.toggle('editando', k === 'arranjo');
      pintarMural();
    };
    const segAbas = U.seg([['perfil', T('Perfil', 'Profile')], ['widgets', 'Widgets'], ['mural', T('Mural', 'Wall')], ['nome', T('Nome', 'Name')], ['fundo', T('Fundo', 'Background')], ['np', 'Nameplate'], ['arranjo', T('Arranjo', 'Layout')], ...(abas.extras ? [['extras', 'Extras']] : [])], 'perfil', (k) => { irAba(k); A.som.tocar('click'); });
    segAbas.classList.add('quebra', 'perfil-abas'); irAba('perfil');
    // (0.8.7) cada aba do editor ganha o seu orbe (a régua de ferramentas do estúdio)
    segAbas.querySelectorAll('button').forEach((b, i) => { const ic = ['pessoa', 'musica', 'apps', 'lapis', 'imagem', 'estrela', 'painel', 'coroa'][i]; if (ic) { b.prepend(A.orbe(ic, 30)); b.dataset.cor = String(i + 1); } }); // (1.0.0) cada aba com a sua cor
    new ResizeObserver(() => { const c = previa.querySelector('.perfil-cartao'); if (c) encaixar(c); }).observe(previa);
    const corpo = h('div', { class: 'perfil-editor' }, h('div', { class: 'perfil-previa-caixa' }, h('i', { class: 'palco-luz', 'aria-hidden': 'true' }), previa, h('i', { class: 'palco-chao', 'aria-hidden': 'true' }), muralPrev), h('div', { class: 'col pf-ed-dir', estilo: { gap: '12px', 'min-width': '0' } }, segAbas, caixaAba));
    pintarJa();
    const m = U.modal(T('Seu perfil', 'Your profile'), corpo, {
      largura: 1160, classe: 'perfil-modal', som: ['perfil-abrir', 'perfil-fechar'], acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Salvar perfil', 'Save profile'), valor: true }],
      aoFechar: async (v) => {
        P.pararPrevia(); offGl();
        if (!v) return;
        try {
          await edStatus.salvarPendente();
          if (st.nome.trim() !== eu.nome || st.tag !== eu.tag) await API.salvarPerfil({ nome: st.nome, tag: st.tag });
          if (st.fotoNova) { if (st.fotoNova.blob) await API.subirImagem('avatar', st.fotoNova.blob); else await API.salvarAvatar(st.fotoNova); }
          // fundo1/fundo2 seguem junto (quem ainda usa uma versão antiga vê pelo menos as cores do degradê)
          const fd = st.fd, legado = fd.t === 'cor' ? [fd.c[0] || '', ''] : fd.t === 'degrade' ? [fd.c[0] || '', fd.c[fd.c.length - 1] || ''] : ['', ''];
          if (st.muralMudou) { await A.mural.salvar(st.mural); A.mural.esquecer(eu.codigo); }
          if (st.clNovo && A.extras && A.extras.tem(3)) { try { const r = await API.subirImagem('ligacao', st.clNovo); st.clV = r.clV; } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } // (1.0.0) o cartão de ligação
          await API.req('perfil-extra', { ...(A.extras ? A.extras.paraSalvar(st) : {}), bio: st.bio, cor1: st.cor1, cor2: st.cor2, fundo1: legado[0], fundo2: legado[1], discord: st.discord, spotify: st.spotify,
            ml: st.ml, lb: st.lb, gl: st.gl, lbf: [], nm: st.nm, fd: st.tirarFd ? { ...st.fd, tirarImagem: true } : st.fd, np: st.np.t === 'nenhum' ? { t: 'nenhum', tirarImagem: !!st.tirarNp } : st.np, pf: st.pf,
            mf: st.mf.t === 'vidro' ? { t: 'vidro', tirarImagem: !!st.tirarMf } : st.tirarMf ? { ...st.mf, tirarImagem: true } : st.mf });
          if (st.np.t === 'imagem' && st.npNovo) await API.subirImagem('nameplate', st.npNovo.blob);
          if (st.fd.t === 'imagem' && st.fdNovo) await API.subirImagem('fundo', st.fdNovo.blob);
          if (st.mf.t === 'imagem' && st.mfNovo) await API.subirImagem('mural', st.mfNovo.blob);
          if (st.tirarBanner) await API.req('banner', { dados: '' });
          else if (st.bannerNovo) { if (st.bannerNovo.blob) await API.subirImagem('banner', st.bannerNovo.blob); else await API.req('banner', { dados: st.bannerNovo }); }
          await API.carregarEu(); A.som.tocar('sucesso'); U.toast(T('Perfil salvo!', 'Profile saved!'), { tipo: 'ok', ms: 2500 });
          A.evt.emit('perfil'); // (0.5.9-7) o nome, a # e a foto novos aparecem no topo e no Aero Talk na hora, sem refazer a tela (U.atualizarVivos)
        } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      },
    });
  };

  // ---------- escolher a música do perfil: busca (Deezer, sem precisar de Premium, com prévia de 30 s) ou um link do Spotify ----------
  // ajustar: a música que já está no perfil (abre direto na escolha do trecho, sem procurar de novo)
  function buscarMusica(escolher, { ajustar } = {}) {
    const U = A.ui;
    const q = h('input', { class: 'campo', placeholder: T('Nome da música ou artista', 'Song or artist name'), 'aria-label': T('Procurar música', 'Search song') });
    const link = h('input', { class: 'campo', placeholder: 'https://open.spotify.com/track/...', 'aria-label': T('Link do Spotify', 'Spotify link') });
    const res = h('div', { class: 'musica-lista' }, h('p', { class: 'suave peq' }, T('Digite para procurar (cada música tem 30 s de prévia).', 'Type to search (each song has a 30 s preview).')));
    let t = 0, serie = 0;
    const req = async (rota) => { const r = await fetch(`${API.servidor}/api/${rota}`, { headers: { Authorization: 'Bearer ' + API.token } }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || T('A busca falhou.', 'Search failed.')); return d; };
    // escolheu a música: o servidor acha a música inteira (YouTube) e a pessoa escolhe QUAL trecho de 30 s fica no perfil
    const pegar = async (f, ja) => {
      if (A.perfil.pararPrevia) A.perfil.pararPrevia();
      const base = { fonte: f.fonte, id: f.id, nome: f.nome, artista: f.artista || '', capa: f.capa || '' };
      let v = [];
      if (ja && ja.yt && ja.yt.length && ja.duracao) v = ja.yt.map((id, i) => ({ id, duracao: i ? 0 : ja.duracao }));
      else {
        res.textContent = ''; res.append(h('p', { class: 'suave peq' }, T('Procurando a música inteira para você escolher o trecho...', 'Finding the full song so you can pick the part...')));
        try { v = (await req('musica/youtube?q=' + encodeURIComponent(((f.artista || '') + ' ' + f.nome).trim()))).videos || []; } catch (e) { /* sem a música inteira: fica a prévia */ }
      }
      if (!v.length) { m.fechar(); escolher(base); A.som.tocar('sucesso'); return; }
      const dur = v[0].duracao, max = Math.max(0, dur - 30);
      const ini = h('input', { type: 'range', min: 0, max, step: 1, value: Math.min(max, ja && ja.inicio != null ? ja.inicio : Math.round(dur * 0.3)), class: 'cresce', 'aria-label': T('Início do trecho', 'Clip start') });
      const rotulo = h('b', {});
      const pintar = () => { rotulo.textContent = mmss(+ini.value) + ' – ' + mmss(Math.min(dur, +ini.value + 30)); };
      const atual = () => ({ ...base, yt: v.map((x) => x.id), inicio: +ini.value, duracao: dur });
      const ouvir = h('div', {}); const novoTocador = () => { ouvir.textContent = ''; ouvir.append(tocador(atual())); };
      ini.addEventListener('input', () => { pintar(); if (A.perfil.pararPrevia) A.perfil.pararPrevia(); }); ini.addEventListener('change', novoTocador);
      pintar(); novoTocador(); A.ui.pintarRange(ini);
      res.textContent = '';
      res.append(h('div', { class: 'musica-item' }, base.capa ? h('img', { src: base.capa, alt: '' }) : h('span', { class: 'musica-sem-capa' }, A.icone('musica', 20)), h('span', { class: 'cresce' }, h('b', {}, base.nome), h('small', {}, base.artista))),
        h('div', { class: 'rot', estilo: { 'margin-top': '10px' } }, T('Qual parte da música fica no seu perfil? (30 segundos)', 'Which part of the song goes on your profile? (30 seconds)')),
        h('div', { class: 'linha', estilo: { gap: '10px', 'align-items': 'center' } }, ini, rotulo, ouvir),
        h('div', { class: 'linha', estilo: { 'margin-top': '10px', 'justify-content': 'flex-end' } }, U.btn(T('Usar este trecho', 'Use this part'), { icone: 'ok', onclick: () => { if (A.perfil.pararPrevia) A.perfil.pararPrevia(); m.fechar(); escolher(atual()); A.som.tocar('sucesso'); } })));
    };
    const procurar = async () => {
      const termo = q.value.trim(); if (termo.length < 2) return;
      const n = ++serie; res.textContent = ''; res.append(h('p', { class: 'suave peq' }, T('Procurando...', 'Searching...')));
      try {
        const d = await req('musica?q=' + encodeURIComponent(termo));
        if (n !== serie) return;
        res.textContent = '';
        if (!d.faixas.length) { res.append(h('p', { class: 'suave peq' }, T('Nada encontrado.', 'Nothing found.'))); return; }
        d.faixas.forEach((f) => res.append(h('div', { class: 'musica-item' },
          f.capa ? h('img', { src: f.capa, alt: '' }) : h('span', { class: 'musica-sem-capa' }, A.icone('musica', 20)),
          h('span', { class: 'cresce' }, h('b', {}, f.nome), h('small', {}, f.artista + (f.album ? ' · ' + f.album : ''))),
          tocador(f), U.btn(T('Escolher', 'Pick'), { peq: true, onclick: () => pegar(f) }))));
      } catch (e) { if (n === serie) { res.textContent = ''; res.append(h('p', { class: 'msg erro' }, e.message)); } }
    };
    const usarLink = async () => { try { const d = await req('musica/spotify?url=' + encodeURIComponent(link.value.trim())); pegar(d.faixa); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(procurar, 380); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(t); procurar(); } });
    link.addEventListener('keydown', (e) => { if (e.key === 'Enter') usarLink(); });
    const m = U.modal(ajustar ? T('Ajustar trecho', 'Adjust clip') : T('Música do perfil', 'Profile song'), ajustar ? [res] : [q, res, h('div', { class: 'rot', estilo: { 'margin-top': '12px' } }, T('Ou cole o link de uma música do Spotify', 'Or paste a Spotify song link')), h('div', { class: 'linha' }, link, U.btn(T('Usar', 'Use'), { peq: true, tipo: 'sec', onclick: usarLink }))], { largura: 600, aoFechar: () => { if (tocandoAgora) tocandoAgora(); } });
    if (ajustar) pegar(ajustar, ajustar); else setTimeout(() => q.focus(), 200);
  }
  P.buscarMusica = buscarMusica;
})();
