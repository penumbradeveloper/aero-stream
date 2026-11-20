// Aero - Ouvindo agora (extensão): roda só nas abas do YouTube Music e do Deezer e lê a música tocando (título, artista, álbum, capa,
// posição). Não lê mais nada da página. Manda para o fundo da extensão, que repassa ao app do Aero neste computador. Criado por Ryan Victtor.
(() => {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const f = location.hostname === 'music.youtube.com' ? 'ytmusic' : 'deezer';
  let ultimo = null, ultimoEm = 0, ultimoP = 0, ultimaPos = 0;

  const tempo = (s) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? (+(m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) : NaN; };
  const txt = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; };

  // o id da música (para "Ouvir junto"): no YouTube Music vem no endereço; no Deezer, no link da música no tocador
  // e se é episódio de podcast (k 'ep'): no Deezer pelo link /episode/; no YouTube Music, pelo link do programa no tocador
  let kAtual = '';
  function idAtual() {
    if (f === 'ytmusic') {
      kAtual = document.querySelector('ytmusic-player-bar a[href*="browse/MPSP"], ytmusic-player-bar a[href*="podcast"]') ? 'ep' : '';
      const v = new URL(location.href).searchParams.get('v') || ''; return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
    }
    const sel = (t) => `[data-testid="item_title"] a[href*="/${t}/"], a[data-testid="item_title"][href*="/${t}/"], .player-full a[href*="/${t}/"]`;
    const l = document.querySelector(sel('episode')) || document.querySelector(sel('track'));
    const m = /\/(track|episode)\/(\d{1,14})/.exec((l && l.getAttribute('href')) || location.pathname);
    kAtual = m && m[1] === 'episode' ? 'ep' : '';
    return m ? m[2] : '';
  }
  const midia = () => [...document.querySelectorAll('video, audio')].find((e) => e.duration > 0 && Number.isFinite(e.duration));

  function ler() {
    let t = '', a = '', al = '', img = '';
    try {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      if (md) {
        t = md.title || ''; a = md.artist || ''; al = md.album || '';
        const arts = [...(md.artwork || [])].map((x) => ({ src: x.src, n: parseInt(String(x.sizes || '0'), 10) || 0 }));
        const bom = arts.filter((x) => x.n >= 200 && x.n <= 600).sort((x, y) => x.n - y.n)[0] || arts.sort((x, y) => y.n - x.n)[0];
        if (bom && /^https:\/\//.test(bom.src)) img = bom.src;
      }
    } catch (e) { /* sem acesso: usa a página abaixo */ }
    if (f === 'deezer' && !t) { t = txt('[data-testid="item_title"]'); a = txt('[data-testid="item_subtitle"]'); }
    if (!t) return null;
    // posição: o elemento de áudio/vídeo da página; no Deezer, os tempos escritos na barra
    let d = NaN, p = NaN, tocando = null;
    const el = [...document.querySelectorAll('video, audio')].find((e) => e.duration > 0 && Number.isFinite(e.duration));
    if (el) { d = el.duration; p = el.currentTime; tocando = !el.paused; }
    if (!(d > 0) && f === 'deezer') { p = tempo(txt('[data-testid="elapsed_time"]')); d = tempo(txt('[data-testid="remaining_time"]')); }
    if (tocando === null) { const st = navigator.mediaSession && navigator.mediaSession.playbackState; tocando = st === 'playing' || (st !== 'paused' && Number.isFinite(p) && Math.abs(p - ultimaPos) > 0.5); }
    if (Number.isFinite(p)) ultimaPos = p;
    const id = idAtual();
    return { f, t, a, al, img, id, k: kAtual, d: d > 0 ? d : 0, p: p >= 0 ? p : 0, tocando: !!tocando };
  }

  function olhar() {
    const x = ler();
    const k = x ? [x.t, x.a, x.al, x.img, x.id, x.k, x.tocando].join('\u0001') : '';
    const agora = Date.now();
    // manda quando muda, quando a posição pulou e a cada 1 s enquanto há música (a resposta traz os pedidos do "Ouvir junto")
    const esperado = ultimoP + (x && x.tocando ? (agora - ultimoEm) / 1000 : 0);
    if (k === ultimo && agora - ultimoEm < (x ? 900 : 4000) && (!x || Math.abs(x.p - esperado) < 3)) return;
    ultimo = k; ultimoEm = agora; ultimoP = x ? x.p : 0;
    try { api.runtime.sendMessage({ tipo: 'ouv', ouv: x }); } catch (e) { /* a extensão foi atualizada: esta aba para */ clearInterval(timer); }
  }
  const timer = setInterval(olhar, 1000);
  // apertou play/pause ou trocou de música: avisa na hora (sem esperar a próxima olhada)
  for (const ev of ['play', 'pause', 'ended', 'loadedmetadata']) document.addEventListener(ev, () => setTimeout(olhar, 60), true);
  // "Ouvir junto": o app pede para tocar a música de um amigo aqui (outra música: abre o endereço dela; a mesma: acerta o tempo)
  api.runtime.onMessage.addListener((m, quem) => {
    if (!m || m.tipo !== 'cmd' || !m.cmd || (quem && quem.id !== api.runtime.id)) return;
    const c = m.cmd;
    if (c.f !== f) return;
    if (c.id && c.id !== idAtual()) { if (c.tocando && /^https:\/\/(music\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}|www\.deezer\.com\/(track|episode)\/\d{1,14})$/.test(c.url)) location.href = c.url; return; }
    const el = midia();
    if (el) {
      const alvo = (c.p + (c.tocando ? Date.now() - c.em : 0)) / 1000;
      if (Math.abs(el.currentTime - alvo) > 2 && alvo < el.duration) el.currentTime = alvo;
      if (c.tocando && el.paused) el.play().catch(() => {}); else if (!c.tocando && !el.paused) el.pause();
    } else if (f === 'deezer' && c.tocando) { const b = document.querySelector('[data-testid="play_button_play"], button[aria-label="Play"], button[aria-label="Tocar"]'); if (b) b.click(); }
    setTimeout(olhar, 300);
  });
  addEventListener('pagehide', () => { try { api.runtime.sendMessage({ tipo: 'ouv', ouv: null }); } catch (e) { /* ok */ } });
  olhar();
})();
