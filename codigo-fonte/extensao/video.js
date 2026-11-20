// Aero - Assistindo agora (extensão): roda nas abas da Twitch, da Kick e do YouTube (e nos sites que a pessoa adicionou no Aero e
// permitiu aqui na extensão) e lê só o que está passando: o título, o canal ou autor, a categoria, se é ao vivo e o tempo do vídeo.
// Não lê mais nada da página. Manda para o fundo da extensão, que repassa ao app do Aero neste computador. O que ler em cada site e
// quais sites estão ligados vêm do próprio Aero (aba Integrações > Assistindo agora). Criado por Ryan Victtor.
(() => {
  'use strict';
  if (window.__aeroAssistindo) return; // já está rodando nesta aba (a extensão injeta de novo depois de uma permissão nova)
  window.__aeroAssistindo = true;
  const api = globalThis.browser || globalThis.chrome;
  const host = location.hostname.toLowerCase();
  if (host === 'music.youtube.com' || /(^|\.)deezer\.com$/.test(host)) return; // música: quem lê é o pagina.js

  const qual = () => {
    if (/(^|\.)twitch\.tv$/.test(host)) return 'twitch';
    if (/(^|\.)kick\.com$/.test(host)) return 'kick';
    if (/(^|\.)youtube\.com$/.test(host)) return 'youtube';
    return 'site';
  };
  const f = qual();
  let cfg = null; // { on, conhecidos: { twitch, kick, youtube }, meus: [{ id, dom, on, quando, tit, selT, aut, selA, tirar }] }
  let ultimo = null, ultimoEm = 0, ultimaPos = -1, desdeOi = 0;

  const limpa = (v, max = 140) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const txt = (sel) => { try { const e = sel && document.querySelector(sel); return e ? limpa(e.textContent) : ''; } catch (e) { return ''; } };
  const meta = (k) => { const e = document.querySelector('meta[property="' + k + '"], meta[name="' + k + '"]'); return e ? limpa(e.getAttribute('content')) : ''; };
  const md = () => { try { return (navigator.mediaSession && navigator.mediaSession.metadata) || null; } catch (e) { return null; } };
  // o vídeo que importa: o maior que está passando (anúncios e prévias pequenas ficam de fora)
  function video() {
    let m = null, ma = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a < 120 * 68 || v.readyState < 1) continue;
      if (!v.paused && (!m || m.paused || a > ma)) { m = v; ma = a; } else if (!m || (m.paused && a > ma)) { m = v; ma = a; }
    }
    return m;
  }
  const seg = (path, i) => (path.split('/').filter(Boolean)[i] || '');
  const domOk = (d) => host === d || host.endsWith('.' + d);

  // ---------- cada site ----------
  const NAO_CANAL_TW = /^(directory|videos|settings|subscriptions|inventory|wallet|drops|search|downloads|jobs|p|turbo|store|friends|messages|login|signup|u|moderator|popout|embed|clip|clips)$/i;
  function twitch() {
    const p = location.pathname, c = seg(p, 0);
    if (!c || NAO_CANAL_TW.test(c) || !/^[A-Za-z0-9_]{2,25}$/.test(c)) return null;
    const v = video(); if (!v) return null;
    const vod = seg(p, 1) === 'videos' || seg(p, 1) === 'clip' || /^\/videos\//.test(p);
    const m = md();
    const t = txt('[data-a-target="stream-title"]') || (m && limpa(m.title)) || limpa(document.title.replace(/\s*-\s*Twitch\s*$/i, ''));
    const canal = txt('h1.tw-title') || txt('[data-a-target="channel-header-display-name"]') || (m && limpa(m.artist)) || c;
    const cat = txt('[data-a-target="stream-game-link"]');
    return { f: 'twitch', t, a: canal, c: cat, canal: c.toLowerCase(), live: !vod, ...tempos(v, !vod) };
  }
  const NAO_CANAL_KICK = /^(categories|category|browse|following|search|settings|dashboard|clips|video|videos|terms-of-service|privacy-policy|community-guidelines|dmca-policy|login|signup|messages|subscriptions|popout)$/i;
  function kick() {
    const p = location.pathname, c = seg(p, 0);
    if (!c || NAO_CANAL_KICK.test(c) || !/^[A-Za-z0-9_-]{2,30}$/.test(c)) return null;
    const v = video(); if (!v) return null;
    const vod = /^(videos|clips|video)$/i.test(seg(p, 1)) || /^\/video\//.test(p);
    const t = txt('[data-testid="livestream-title"]') || txt('[data-testid="stream-title"]') || limpa(meta('og:title').replace(/\s*(Live Stream\s*)?-\s*Watch Live on KICK\s*$/i, '').replace(/\s*\|\s*Kick\s*$/i, '')) || c;
    const canal = txt('#channel-username') || txt('[data-testid="channel-username"]') || c;
    const cat = txt('a[href^="/category/"]') || txt('a[href*="/categories/"]');
    return { f: 'kick', t, a: canal, c: cat, canal: c.toLowerCase(), live: !vod, ...tempos(v, !vod) };
  }
  function youtube() {
    const u = new URL(location.href);
    let id = u.searchParams.get('v') || '';
    if (!id) { const m = /^\/(shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname); if (m) id = m[2]; }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const pl = document.querySelector('#movie_player, .html5-video-player');
    if (pl && pl.classList.contains('ad-showing')) return ultimo ? JSON.parse(ultimo) : null; // anúncio: mantém o vídeo de antes
    const v = (pl && pl.querySelector('video')) || video(); if (!v) return null;
    const m = md();
    const t = (m && limpa(m.title)) || txt('ytd-watch-metadata h1') || limpa(document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube\s*$/i, ''));
    const a = (m && limpa(m.artist)) || txt('ytd-watch-metadata #owner #channel-name a') || txt('#owner #channel-name');
    const live = !!(pl && pl.classList.contains('ytp-live')) || v.duration === Infinity;
    return { f: 'youtube', t, a, id, live, ...tempos(v, live) };
  }
  function site() {
    const s = cfg && (cfg.meus || []).find((x) => x && x.on !== false && x.dom && domOk(x.dom));
    if (!s) return null;
    const v = video();
    const tocando = s.quando === 'aberta' ? document.visibilityState === 'visible' : !!(v && !v.paused && !v.ended);
    if (!tocando) return null;
    let t = s.tit === 'aba' ? limpa(document.title) : s.tit === 'sel' ? txt(s.selT) : s.tit === 'nada' ? '' : meta('og:title') || limpa(document.title);
    if (s.tirar) for (const x of String(s.tirar).split('|').map((y) => y.trim()).filter(Boolean)) t = limpa(t.split(x).join(' '));
    const a = s.aut === 'sel' ? txt(s.selA) : s.aut === 'og' ? meta('author') || meta('og:site_name') || meta('twitter:creator') : '';
    const base = { f: 'site', sid: s.id, t, a, live: false };
    return s.quando === 'aberta' || !v ? { ...base, d: 0, p: 0, tocando: true } : { ...base, ...tempos(v, false) };
  }
  // a posição do vídeo (ao vivo não tem barra)
  function tempos(v, live) {
    const d = !live && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    return { d, p: d ? v.currentTime : 0, tocando: !v.paused && !v.ended };
  }

  // ---------- olhar e mandar ----------
  const ligado = () => {
    if (!cfg || cfg.on !== true) return false;
    if (f === 'site') return true;
    return !cfg.conhecidos || cfg.conhecidos[f] !== false;
  };
  function ler() {
    if (!ligado()) return null;
    try { const x = f === 'twitch' ? twitch() : f === 'kick' ? kick() : f === 'youtube' ? youtube() : site(); return x && (x.t || x.a || x.f === 'site') ? x : null; } catch (e) { return null; }
  }
  function olhar() {
    const agora = Date.now();
    if (!ligado()) { // desligado no Aero: só pergunta de vez em quando se mudou (a resposta traz a lista de sites)
      if (ultimo !== '') { ultimo = ''; enviar(null); }
      if (agora - desdeOi > 15000) { desdeOi = agora; try { api.runtime.sendMessage({ tipo: 'oi' }); } catch (e) { parar(); } }
      return;
    }
    const x = ler();
    const k = x ? JSON.stringify({ ...x, p: 0 }) : '';
    // manda quando muda, quando a posição pulou e a cada 3 s enquanto há algo passando (o app esquece em 9 s sem aviso)
    const esperado = ultimaPos + (x && x.tocando ? (agora - ultimoEm) / 1000 : 0);
    if (k === ultimo && agora - ultimoEm < (x ? 3000 : 8000) && (!x || !x.d || Math.abs(x.p - esperado) < 3)) return;
    ultimo = k; ultimoEm = agora; ultimaPos = x ? x.p : 0;
    enviar(x);
  }
  function enviar(x) { try { api.runtime.sendMessage({ tipo: 'ass', ass: x }); } catch (e) { parar(); } }
  let timer = 0;
  function parar() { clearInterval(timer); timer = 0; } // a extensão foi atualizada ou removida: esta aba para

  async function lerCfg() { try { const r = await api.storage.local.get('sites'); cfg = (r && r.sites) || null; } catch (e) { cfg = null; } }
  try { api.storage.onChanged.addListener((m, area) => { if (area === 'local' && m.sites) { cfg = m.sites.newValue || null; ultimo = null; olhar(); } }); } catch (e) { /* ok */ }
  lerCfg().then(() => {
    try { api.runtime.sendMessage({ tipo: 'oi' }); } catch (e) { /* ok */ } desdeOi = Date.now();
    timer = setInterval(olhar, 1000);
    // play, pause, trocou de vídeo: avisa na hora
    for (const ev of ['play', 'pause', 'ended', 'loadedmetadata', 'seeked']) document.addEventListener(ev, () => setTimeout(olhar, 80), true);
    document.addEventListener('visibilitychange', () => setTimeout(olhar, 80));
    olhar();
  });
  addEventListener('pagehide', () => { try { api.runtime.sendMessage({ tipo: 'ass', ass: null }); } catch (e) { /* ok */ } });
})();
