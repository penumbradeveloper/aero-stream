// Aero Stream - (1.0.2) cartões de links no chat, melhores que os do Discord: dá para ver (e ouvir) tudo aqui, sem abrir o site.
// Spotify: música, álbum, playlist e podcast com a capa e a cor da capa; cada faixa toca o trecho de 30 s aqui mesmo, com pausa, barra
// e volume (que fica guardado). O nome abre no app do Spotify (no PC, direto no Spotify aberto) e o botão direito copia o link.
// Só um trecho toca por vez no app inteiro. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const E = (A.embeds = {});
  const mmss = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const lerVol = () => { try { const v = +localStorage.getItem('aero-vol-trecho'); return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem('aero-vol-trecho') !== null ? v : 0.6; } catch (_) { return 0.6; } };
  const gravarVol = (v) => { try { localStorage.setItem('aero-vol-trecho', String(v)); } catch (_) { /* sem guardar */ } };

  // ---------- o tocador único: um <audio> para o app inteiro ----------
  const P = { audio: null, dono: null, vol: lerVol(), mudo: false };
  const audio = () => {
    if (P.audio) return P.audio;
    const a = new Audio(); a.preload = 'none'; a.volume = P.vol;
    a.addEventListener('timeupdate', () => { if (!P.dono) return; if (P.dono.vivo && !P.dono.vivo()) { a.pause(); P.dono = null; return; } P.dono.tempo(a.currentTime, a.duration); }); // o cartão saiu da página (conversa fechada): para
    a.addEventListener('play', () => P.dono && P.dono.estado(true));
    a.addEventListener('pause', () => P.dono && P.dono.estado(false));
    a.addEventListener('ended', () => P.dono && P.dono.fim());
    a.addEventListener('error', () => P.dono && P.dono.estado(false));
    return (P.audio = a);
  };
  E.parar = () => { if (P.audio) P.audio.pause(); };
  // pausa ao entrar em chamada ou quando outra música do app começa
  if (A.evt) { A.evt.on('chamada:entrou', E.parar); A.evt.on('musica:tocar', E.parar); }
  const tocar = (dono, url) => {
    const a = audio();
    if (P.dono && P.dono !== dono) { P.dono.estado(false); P.dono.tempo(0, 0); }
    P.dono = dono;
    if (a.src !== url) { a.src = url; }
    a.volume = P.vol; a.muted = P.mudo;
    a.play().catch(() => dono.estado(false));
  };
  const definirVol = (v) => { P.vol = Math.max(0, Math.min(1, v)); P.mudo = P.vol === 0; gravarVol(P.vol); if (P.audio) { P.audio.volume = P.vol; P.audio.muted = P.mudo; } document.querySelectorAll('.emb-vol input').forEach((i) => { if (+i.value !== Math.round(P.vol * 100)) { i.value = Math.round(P.vol * 100); pintarVol(i); } }); };
  const pintarVol = (i) => { i.style.setProperty('--v', i.value + '%'); const b = i.closest('.emb-vol'); if (b) b.classList.toggle('mudo', +i.value === 0); };

  // o controle de volume (o Discord não tem): o ícone liga e desliga o som, a barrinha ajusta
  function volume() {
    const inp = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(P.vol * 100)), 'aria-label': T('Volume', 'Volume') });
    pintarVol(inp);
    let antes = P.vol || 0.6;
    inp.addEventListener('input', (e) => { e.stopPropagation(); pintarVol(inp); definirVol(inp.value / 100); });
    inp.addEventListener('click', (e) => e.stopPropagation());
    const bt = h('button', { type: 'button', class: 'emb-vol-bt', title: T('Som', 'Sound'), onclick: (e) => { e.stopPropagation(); if (P.vol > 0) { antes = P.vol; definirVol(0); } else definirVol(antes || 0.6); } }, A.icone('volume', 16), A.icone('mudo', 16));
    return h('div', { class: 'emb-vol' + (P.vol === 0 ? ' mudo' : '') }, bt, inp);
  }

  const marcaSpotify = (t) => A.icone('spotify', t);
  const rotTipo = { track: T('Música', 'Song'), album: T('Álbum', 'Album'), playlist: 'Playlist', episode: T('Episódio', 'Episode') };

  // abre no app do Spotify: no PC, a música vai direto para o Spotify aberto; senão o link (o celular abre no app do Spotify)
  const abrirNoSpotify = async (k, id, url) => {
    const p = window.aero && window.aero.ouvindo;
    if (p && p.tocar && (k === 'track' || k === 'episode')) { try { const r = await p.tocar({ f: 'spotify', id, k: k === 'episode' ? 'e' : 'm', p: 0, tocando: true }); if (r && r.ok) { E.parar(); return; } } catch (_) { /* abre o link */ } }
    A.ui.abrirFora(url);
  };

  // o cartão, enquanto o servidor responde, já tem o tamanho certo (a conversa não pula quando ele chega)
  E.spotify = (u, { dados, menu, grudar = () => {} }) => {
    const cartao = h('div', { class: 'cx-midia emb-sp carregando' }, h('div', { class: 'emb-sp-topo' }, h('div', { class: 'emb-sp-capa' }), h('div', { class: 'emb-sp-info' }, h('span', { class: 'emb-sp-selo' }, marcaSpotify(14), 'Spotify'))));
    cartao.addEventListener('contextmenu', menu);
    dados(u).then((d) => {
      if (!d || d.tipo !== 'spotify') { cartao.replaceWith(h('span')); grudar(); return; }
      montar(cartao, d); grudar();
    });
    return A.ui.pelicula(cartao);
  };

  function montar(cartao, d) {
    cartao.classList.remove('carregando');
    if (d.cor) cartao.style.setProperty('--sp', `rgb(${d.cor[0]}, ${d.cor[1]}, ${d.cor[2]})`);
    const lista = d.k === 'playlist' || d.k === 'album';
    const faixas = lista ? (d.faixas || []) : [{ t: d.titulo, a: d.sub, dur: d.dur, prev: d.prev, id: d.id, exp: d.exp }];
    let atual = -1, tocando = false;
    const capa = h('div', { class: 'emb-sp-capa' }, d.capa ? h('img', { src: d.capa, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }) : marcaSpotify(36));
    const nome = h('button', { type: 'button', class: 'emb-sp-nome', title: T('Abrir no Spotify (botão direito: copiar o link)', 'Open on Spotify (right-click: copy link)'), onclick: (e) => { e.stopPropagation(); abrirNoSpotify(d.k, d.id, d.url); } }, d.titulo);
    const sub = d.sub ? h('div', { class: 'emb-sp-sub' }, d.exp ? h('i', { class: 'emb-sp-e', title: T('Explícita', 'Explicit') }, 'E') : null, d.sub) : null;
    const play = h('button', { type: 'button', class: 'emb-sp-play', 'aria-label': T('Tocar o trecho', 'Play preview'), onclick: (e) => { e.stopPropagation(); alternar(); } }, A.icone('play', 22), A.icone('pausa', 22));
    const ant = lista ? h('button', { type: 'button', class: 'emb-sp-pulo', 'aria-label': T('Anterior', 'Previous'), onclick: (e) => { e.stopPropagation(); pular(-1); } }, A.icone('setaE', 16)) : null;
    const prox = lista ? h('button', { type: 'button', class: 'emb-sp-pulo', 'aria-label': T('Próxima', 'Next'), onclick: (e) => { e.stopPropagation(); pular(1); } }, A.icone('setaD', 16)) : null;
    const barraIn = h('i'), barra = h('div', { class: 'emb-sp-barra', title: T('Arraste para ir a outro ponto do trecho', 'Drag to seek') }, barraIn);
    const tempo = h('span', { class: 'emb-sp-tempo' }, '0:00');
    const tocandoAgora = h('div', { class: 'emb-sp-agora', hidden: !lista });
    const semTrecho = !faixas.some((f) => f.prev);
    const controles = h('div', { class: 'emb-sp-ctl' + (semTrecho ? ' sem' : '') }, ant, play, prox, h('div', { class: 'emb-sp-linha' }, barra, tempo), volume());
    cartao.replaceChildren(
      h('div', { class: 'emb-sp-topo' }, capa, h('div', { class: 'emb-sp-info' },
        h('span', { class: 'emb-sp-selo' }, marcaSpotify(14), rotTipo[d.k] || 'Spotify', h('b', { class: 'emb-sp-previa' }, T('Prévia', 'Preview'))),
        nome, sub, tocandoAgora,
        lista ? h('div', { class: 'emb-sp-qtd' }, d.total === 1 ? T('1 música', '1 song') : (d.total || faixas.length) + T(' músicas', ' songs')) : (d.dur ? h('div', { class: 'emb-sp-qtd' }, mmss(d.dur)) : null))),
      semTrecho ? h('div', { class: 'emb-sp-aviso' }, T('O Spotify não deixa ouvir um trecho desta. Abra no Spotify para ouvir.', 'Spotify has no preview for this one. Open it on Spotify to listen.')) : controles);
    const linhas = [];
    if (lista && faixas.length) {
      const ol = h('ol', { class: 'emb-sp-faixas' });
      faixas.forEach((f, i) => {
        const li = h('li', { class: 'emb-sp-faixa' + (f.prev ? '' : ' sem'), tabindex: f.prev ? '0' : '-1', title: f.prev ? T('Tocar o trecho', 'Play preview') : T('Sem trecho', 'No preview') },
          h('span', { class: 'emb-sp-n' }, h('b', {}, String(i + 1)), A.icone('play', 13), A.icone('pausa', 13)),
          h('span', { class: 'emb-sp-ft' }, h('b', {}, f.exp ? h('i', { class: 'emb-sp-e' }, 'E') : null, f.t), f.a ? h('small', {}, f.a) : null),
          h('span', { class: 'emb-sp-dur' }, mmss(f.dur)));
        li.addEventListener('click', (e) => { e.stopPropagation(); if (!f.prev) return; if (atual === i) alternar(); else ir(i); });
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
        li.addEventListener('contextmenu', (e) => { if (!f.id) return; e.preventDefault(); e.stopPropagation(); const link = 'https://open.spotify.com/track/' + f.id; A.ui.menuContexto(e, [{ texto: T('Abrir no Spotify', 'Open on Spotify'), icone: 'externo', onclick: () => abrirNoSpotify('track', f.id, link) }, { texto: T('Copiar link da música', 'Copy song link'), icone: 'copiar', onclick: () => A.ui.copiar(link) }]); });
        linhas.push(li); ol.append(li);
      });
      cartao.append(h('div', { class: 'emb-sp-rolar' }, ol));
    }
    const dono = {
      estado: (v) => { tocando = v; cartao.classList.toggle('tocando', v); play.setAttribute('aria-label', v ? T('Pausar', 'Pause') : T('Tocar o trecho', 'Play preview')); linhas.forEach((l, i) => l.classList.toggle('tocando', v && i === atual)); },
      tempo: (s, dur) => { const t = dur && Number.isFinite(dur) ? dur : 30; barraIn.style.width = Math.min(100, (s / t) * 100) + '%'; tempo.textContent = mmss(s * 1000) + ' / ' + mmss(t * 1000); },
      fim: () => { if (lista && pular(1, true)) return; dono.estado(false); dono.tempo(0, 0); },
      vivo: () => cartao.isConnected,
    };
    function ir(i) {
      const f = faixas[i]; if (!f || !f.prev) return false;
      atual = i; linhas.forEach((l, k) => l.classList.toggle('atual', k === i));
      if (lista) { tocandoAgora.hidden = false; tocandoAgora.replaceChildren(A.icone('musica', 12), h('span', {}, f.t + (f.a ? ' · ' + f.a : ''))); const li = linhas[i], r = li && li.closest('.emb-sp-rolar'); if (r) { const a = r.getBoundingClientRect(), b = li.getBoundingClientRect(); if (b.top < a.top + 4 || b.bottom > a.bottom - 4) r.scrollTo({ top: r.scrollTop + (b.top - a.top) - (a.height - b.height) / 2, behavior: 'smooth' }); } }
      tocar(dono, f.prev); return true;
    }
    function alternar() {
      if (P.dono === dono && P.audio && !P.audio.paused) { P.audio.pause(); return; }
      if (P.dono === dono && atual >= 0 && P.audio && P.audio.src) { P.audio.play().catch(() => {}); return; }
      const i = faixas.findIndex((f) => f.prev); if (i >= 0) ir(atual >= 0 ? atual : i);
    }
    function pular(dir, sozinho) {
      for (let i = atual + dir; i >= 0 && i < faixas.length; i += dir) if (faixas[i].prev) return ir(i);
      if (!sozinho) A.som && A.som.tocar && A.som.tocar('erro');
      return false;
    }
    // arrastar na barra: vai para o ponto do trecho
    const irPara = (e) => { if (P.dono !== dono || !P.audio || !P.audio.duration) return; const r = barra.getBoundingClientRect(); P.audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * P.audio.duration; };
    barra.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (P.dono !== dono) return; barra.setPointerCapture(e.pointerId); irPara(e); const mv = (ev) => irPara(ev), up = () => { barra.removeEventListener('pointermove', mv); barra.removeEventListener('pointerup', up); }; barra.addEventListener('pointermove', mv); barra.addEventListener('pointerup', up); });
  }

  // ---------- (1.0.2) lojas: Amazon e AliExpress ----------
  // Tudo para analisar o produto sem sair do Aero: as fotos (até 20, numa faixa que rola, e abrem grandes com setas), o preço (e o de antes),
  // a nota com as estrelas e quantas avaliações, e quanto fica de imposto para quem compra no Brasil. Comprar é só no botão da loja.
  const LOJAS = { amazon: { nome: 'Amazon', cor: '#ff9900' }, aliexpress: { nome: 'AliExpress', cor: '#e62e04' } };
  const dinheiro = (v, m) => { if (v == null) return ''; try { return new Intl.NumberFormat(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR', { style: 'currency', currency: m || 'USD' }).format(v); } catch (_) { return (m || '') + ' ' + v; } };
  const estrelas = (n) => { const el = h('span', { class: 'emb-lj-estrelas', 'aria-label': n + ' / 5' }); for (let i = 1; i <= 5; i++) { const f = Math.max(0, Math.min(1, n - i + 1)); const s = h('span', { class: 'emb-lj-est' }); s.style.setProperty('--f', Math.round(f * 100) + '%'); el.append(s); } return el; };
  E.loja = (u, { dados, menu, grudar = () => {}, soLink = false }) => {
    const cartao = h('div', { class: 'cx-midia emb-lj carregando' }, h('div', { class: 'emb-lj-esq' }));
    const el = A.ui.pelicula(cartao);
    dados(u).then((d) => {
      if (!d || d.tipo !== 'loja') { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...A.ui.textoComLinks(u)) : h('span')); return; }
      const L = LOJAS[d.loja] || LOJAS.amazon, url = d.url || u, abrir = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } A.ui.abrirFora(url); };
      cartao.style.setProperty('--lj', L.cor);
      const fotos = (d.fotos || []).slice(0, 20), itens = fotos.map((f, i) => ({ url: f, video: false, nome: d.loja + '-' + (i + 1) + '.jpg', link: url }));
      let atual = 0;
      const grande = fotos.length ? h('img', { src: fotos[0], alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }) : null;
      const palco = h('button', { type: 'button', class: 'emb-lj-palco', title: T('Ver as fotos', 'View photos'), onclick: (e) => { e.stopPropagation(); if (itens.length) A.ui.verImagem(itens[atual].url, { nome: itens[atual].nome, link: url, galeria: { itens, i: atual } }); } }, grande || A.icone('imagem', 34));
      if (fotos.length > 1) palco.append(h('span', { class: 'emb-lj-qtd' }, A.icone('imagem', 12), String(fotos.length)));
      const faixa = fotos.length > 1 ? h('div', { class: 'emb-lj-faixa' }) : null;
      if (faixa) fotos.forEach((f, i) => { const b = h('button', { type: 'button', class: 'emb-lj-mini' + (i ? '' : ' on'), 'aria-label': T('Foto ', 'Photo ') + (i + 1) }, h('img', { src: f, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }));
        const ver = (e) => { e.stopPropagation(); atual = i; grande.src = f; faixa.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
        b.addEventListener('click', ver); b.addEventListener('mouseenter', ver); faixa.append(b); });
      const info = h('div', { class: 'emb-lj-info' },
        h('div', { class: 'emb-lj-loja' }, h('span', { class: 'emb-lj-ponto' }), L.nome),
        h('a', { class: 'emb-lj-titulo', href: url, title: d.titulo, onclick: abrir }, d.titulo));
      if (d.nota != null) info.append(h('div', { class: 'emb-lj-nota' }, h('b', null, String(d.nota).replace('.', A.idioma && A.idioma() === 'en' ? '.' : ',')), estrelas(d.nota), d.aval != null ? h('small', null, '(' + new Intl.NumberFormat(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR').format(d.aval) + ' ' + T('avaliações', 'reviews') + ')') : null));
      if (d.preco != null) {
        const pr = h('div', { class: 'emb-lj-preco' }, h('b', null, dinheiro(d.preco, d.moeda)));
        if (d.de && d.de > d.preco) pr.append(h('s', null, dinheiro(d.de, d.moeda)), h('span', { class: 'emb-lj-off' }, '-' + Math.round((1 - d.preco / d.de) * 100) + '%'));
        info.append(pr);
      } else info.append(h('div', { class: 'emb-lj-preco sem' }, T('Preço só na loja', 'Price on the store only')));
      if (d.incluso) info.append(h('div', { class: 'emb-lj-imp ok' }, A.icone('check', 13), T('Impostos já inclusos no preço', 'Taxes already included')));
      else if (d.imposto) {
        const im = d.imposto, mo = im.moeda || d.moeda;
        info.append(h('div', { class: 'emb-lj-imp', title: T('Estimativa do Remessa Conforme: imposto de importação (20% até US$ 50; 60% menos US$ 20 acima) e ICMS de 17%. O valor final pode mudar.', 'Brazil import estimate (Remessa Conforme). The final amount may change.') },
          h('div', null, h('span', null, T('Imposto de importação', 'Import tax')), h('b', null, dinheiro(im.ii, mo))),
          h('div', null, h('span', null, 'ICMS'), h('b', null, dinheiro(im.icms, mo))),
          h('div', { class: 'tot' }, h('span', null, T('Total com impostos (estim.)', 'Total with taxes (est.)')), h('b', null, dinheiro(im.final, mo)))));
      }
      if (d.frete) info.append(h('div', { class: 'emb-lj-frete' }, d.frete));
      info.append(h('button', { type: 'button', class: 'emb-lj-ir', onclick: abrir }, T('Ver na ', 'View on ') + L.nome, A.icone('externo', 13)));
      cartao.classList.remove('carregando');
      cartao.replaceChildren(h('div', { class: 'emb-lj-fotos' }, palco, faixa), info);
      cartao.addEventListener('contextmenu', (e) => { if (!e.target.closest('.emb-lj-mini, .emb-lj-palco')) menu(e); });
      grudar();
    });
    return el;
  };
})();
