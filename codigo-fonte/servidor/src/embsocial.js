// (1.0.3) Cartões de TikTok e Instagram no chat. Criado por Ryan Victtor.
// TikTok: vídeo (toca no player do Aero), post de fotos (carrossel com a música de fundo), curtidas, comentários, salvos, compartilhamentos,
// views, a música, e o perfil (seguidores, seguindo, curtidas, vídeos; conta privada mostra só o nome e a foto).
// O aparelho de quem vê não fala com a TikTok: fotos passam pelo /api/img e o vídeo/música pelo /api/tt (aqui), só quando a pessoa aperta play.
// Instagram: a página pública dele pede login, então o cartão mostra o que o link diz e o player oficial do Instagram abre só no clique.
import { txt } from './util.js';
import { buscarSoPermitidos, limiteIp } from './midia.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };
const num = (x) => (x != null && x !== '' && Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : null);

// ---------- TikTok ----------
export const RE_TIKTOK = /^https?:\/\/(?:(?:www|m)\.)?tiktok\.com\/(?:@[\w.-]{1,40}(?:\/(?:video|photo)\/\d{8,25})?\/?(?:[?#]|$)|t\/[A-Za-z0-9]{5,20})|^https?:\/\/(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]{5,20}/i;
const CDN_TT = /^https:\/\/[a-z0-9.-]{1,80}\.(?:tiktokcdn(?:-us|-eu)?\.com|tiktok\.com|tiktokv\.com|byteoversea\.com|ibyteimg\.com)\//i;
const ttImg = (u) => (typeof u === 'string' && u.length < 1800 && CDN_TT.test(u) ? u : '');

// a página pública (a mesma que o navegador abre): os dados vêm no bloco __UNIVERSAL_DATA_FOR_REHYDRATION__ e os cookies da visita
// são os que deixam baixar o vídeo (sem eles a TikTok responde 403)
async function paginaTT(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { ...UA, Accept: 'text/html' }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 3000000);
    const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
    let j; try { j = JSON.parse(m[1]).__DEFAULT_SCOPE__ || {}; } catch (_) { return null; }
    const ck = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : String(r.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z_]+=)/);
    const cookie = ck.map((c) => String(c).split(';')[0].trim()).filter((c) => /^(tt_chain_token|ttwid|tt_csrf_token|msToken)=/.test(c)).join('; ');
    return { j, cookie, final: r.url || url };
  } catch (_) { return null; } finally { clearTimeout(t); }
}

const autorTT = (a) => ({ nick: txt(a.uniqueId || '', 40), nome: txt(a.nickname || '', 60), av: ttImg(a.avatarMedium || a.avatarThumb || ''), ok: !!a.verified, privado: !!a.privateAccount });

export async function tiktok(url) {
  if (!RE_TIKTOK.test(url)) return null;
  // (1.0.4) post de fotos (link /photo/, ou o link curto vt./vm. que leva até ele): essa página vem sem os dados; a mesma em /video/ traz tudo
  const foto = (x) => /tiktok\.com\/@[\w.-]{1,40}\/photo\/(\d{8,25})/i.exec(x || '');
  let p = foto(url) ? null : await paginaTT(url);
  const fm = foto(url) || (p && !p.j['webapp.video-detail'] && foto(p.final));
  if (fm) p = (await paginaTT('https://www.' + fm[0].replace(/\/photo\//i, '/video/'))) || p;
  if (!p) return null;
  const it = p.j['webapp.video-detail'] && p.j['webapp.video-detail'].itemInfo && p.j['webapp.video-detail'].itemInfo.itemStruct;
  if (it && it.id) {
    const st = it.statsV2 || it.stats || {}, v = it.video || {}, mu = it.music || {}, a = autorTT(it.author || {});
    const d = { tipo: 'tiktok', id: txt(String(it.id), 25), url: 'https://www.tiktok.com/@' + a.nick + '/' + (it.imagePost ? 'photo' : 'video') + '/' + it.id,
      texto: txt(it.desc || '', 1200), t: num(it.createTime) ? num(it.createTime) * 1000 : 0, autor: a,
      cur: num(st.diggCount), com: num(st.commentCount), fav: num(st.collectCount), comp: num(st.shareCount), views: num(st.playCount) };
    if (mu.title || mu.playUrl) d.musica = { titulo: txt(mu.title || '', 100), autor: txt(mu.authorName || '', 60), capa: ttImg(mu.coverMedium || mu.coverThumb || ''), som: ttImg(mu.playUrl || ''), dur: num(mu.duration) || 0 };
    if (it.imagePost && Array.isArray(it.imagePost.images)) {
      d.fotos = it.imagePost.images.slice(0, 35).map((x) => { const l = (x.imageURL && x.imageURL.urlList) || []; return { url: ttImg(l[0] || ''), w: num(x.imageWidth) || 0, h: num(x.imageHeight) || 0 }; }).filter((x) => x.url);
    } else {
      d.video = { w: num(v.width) || 0, h: num(v.height) || 0, dur: num(v.duration) || 0, capa: ttImg(v.cover || v.originCover || '') };
    }
    return d;
  }
  const ui = p.j['webapp.user-detail'] && p.j['webapp.user-detail'].userInfo;
  if (ui && ui.user && ui.user.uniqueId) {
    const u = ui.user, st = ui.statsV2 || ui.stats || {}, a = autorTT(u);
    const d = { tipo: 'tiktok-perfil', url: 'https://www.tiktok.com/@' + a.nick, autor: a };
    if (!a.privado) Object.assign(d, { bio: txt(u.signature || '', 300), seguidores: num(st.followerCount), seguindo: num(st.followingCount), curtidas: num(st.heartCount != null && +st.heartCount >= 0 ? st.heartCount : st.heart), videos: num(st.videoCount),
      link: u.bioLink && typeof u.bioLink.link === 'string' && /^https?:\/\//.test(u.bioLink.link) ? txt(u.bioLink.link, 200) : '' });
    return d;
  }
  return null;
}

// /api/tt?v=<id> (o vídeo) ou /api/tt?m=<url da música>: passa pelo Aero, com Range (dá para pular no vídeo) e limite por IP
const memo = new Map();
export async function ttMidia(request, url, env) {
  const nada = (s = 404) => new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*' } });
  const id = url.searchParams.get('v') || '', som = url.searchParams.get('m') || '';
  if (!(id && /^\d{8,25}$/.test(id)) && !(som && ttImg(som))) return nada(400);
  if (!(await limiteIp(env, request, 'tt'))) return nada(429);
  const range = request.headers.get('Range'), cab = { ...UA, Referer: 'https://www.tiktok.com/', ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}) };
  let alvo = som, cookie = '';
  if (id) {
    let x = memo.get(id);
    if (!x || Date.now() - x.t > 300000) {
      const p = await paginaTT('https://www.tiktok.com/@i/video/' + id); const it = p && p.j['webapp.video-detail'] && p.j['webapp.video-detail'].itemInfo && p.j['webapp.video-detail'].itemInfo.itemStruct;
      const v = (it && it.video) || {}, end = ttImg(v.playAddr || '') || ttImg(v.downloadAddr || '');
      if (!end) return nada();
      x = { t: Date.now(), end, cookie: p.cookie }; if (memo.size > 200) memo.clear(); memo.set(id, x);
    }
    alvo = x.end; cookie = x.cookie;
  }
  const r = await buscarSoPermitidos(alvo, (u) => !!ttImg(u), { headers: cookie ? { ...cab, Cookie: cookie } : cab });
  const tipo = (r.headers.get('Content-Type') || '').toLowerCase();
  if (!(r.status === 200 || r.status === 206) || !/^(video\/mp4|audio\/(mpeg|mp4|x-m4a|aac))/.test(tipo)) { if (id) memo.delete(id); return nada(); }
  const h = new Headers({ 'Content-Type': tipo.split(';')[0], 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  for (const k of ['Content-Length', 'Content-Range']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  return new Response(r.body, { status: r.status, headers: h });
}

// ---------- Instagram ----------
export const RE_INSTAGRAM = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})|^https?:\/\/(?:www\.|m\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/i;
const RESERVADOS_IG = /^(explore|accounts|direct|stories|about|legal|developer|p|reel|reels|tv|web)$/i;
export function instagram(url) {
  const m = RE_INSTAGRAM.exec(url); if (!m) return null;
  if (m[3]) { const tipo = /^reel|tv/i.test(m[2]) ? 'reel' : 'post'; return { tipo: 'instagram', sub: tipo, codigo: m[3], nick: m[1] ? txt(m[1], 30) : '', url: 'https://www.instagram.com/' + (tipo === 'reel' ? 'reel' : 'p') + '/' + m[3] + '/' }; }
  if (m[4] && !RESERVADOS_IG.test(m[4])) return { tipo: 'instagram', sub: 'perfil', nick: txt(m[4], 30), url: 'https://www.instagram.com/' + m[4] + '/' };
  return null;
}
