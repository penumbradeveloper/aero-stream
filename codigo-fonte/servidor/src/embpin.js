// (1.0.6) Cartões do Pinterest e o Instagram completo no chat. Criado por Ryan Victtor.
// Pinterest: o pin inteiro (foto, vídeo, carrossel e as páginas dos pins de ideia), quem salvou, a pasta, salvos e reações; pasta e perfil
// viram um mural com os pins. Os dados vêm da página pública do pin e da API pública dos widgets do Pinterest (a dos botões de embed).
// Instagram: o reel/post de verdade (vídeo, fotos do carrossel, legenda, curtidas, comentários e views) pela página de embed pública.
// O aparelho de quem vê não fala com o Pinterest nem com o Instagram: fotos passam pelo /api/img e os vídeos por /api/pin e /api/ig (aqui),
// que também servem para baixar.
import { txt } from './util.js';
import { buscarSoPermitidos, limiteIp } from './midia.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };
const num = (x) => (x != null && x !== '' && Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : null);
const limpa = (s, n) => txt(String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ''), n);

async function pegar(url, headers, ms = 9000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { headers, redirect: 'follow', signal: ctl.signal }); return r.ok ? { r, texto: (await r.text()).slice(0, 4000000) } : null; }
  catch (_) { return null; } finally { clearTimeout(t); }
}

// ---------- Pinterest ----------
const DOM_PIN = String.raw`(?:[a-z]{2,3}\.|www\.)?pinterest\.(?:com|[a-z]{2}|com?\.[a-z]{2})`;
export const RE_PINTEREST = new RegExp(String.raw`^https?:\/\/(?:${DOM_PIN}\/(?:pin\/(?:[\w-]{0,120}--)?\d{5,25}|(?!pin\/|search\/|ideas\/|today\/|_\/|login|signup|settings|business\/)[A-Za-z0-9_]{3,40}(?:\/(?!_|pins\/?(?:[?#]|$))[\w%-]{1,120})?\/?(?:[?#]|$))|pin\.it\/[A-Za-z0-9]{4,20})`, 'i');
const RE_PIN_ID = new RegExp(String.raw`^https?:\/\/${DOM_PIN}\/pin\/(?:[\w-]{0,120}--)?(\d{5,25})`, 'i');
const RE_PASTA = new RegExp(String.raw`^https?:\/\/${DOM_PIN}\/([A-Za-z0-9_]{3,40})(?:\/([\w%-]{1,120}))?\/?(?:[?#]|$)`, 'i');
const PIN_IMG = /^https:\/\/i\.pinimg\.com\/[A-Za-z0-9_./-]{5,200}\.(?:jpe?g|png|webp|gif)$/i;
export const PIN_VIDEO = /^https:\/\/v\d?\.pinimg\.com\/videos\/[A-Za-z0-9_./-]{5,200}\.mp4$/i;
const pimg = (u) => (typeof u === 'string' && PIN_IMG.test(u) ? u : '');
const pvid = (u) => (typeof u === 'string' && PIN_VIDEO.test(u) ? u : '');
const grande = (u) => (pimg(u) ? u.replace(/\/(?:\d{2,4}x(?:\d{2,4})?(?:_RS)?)\//, '/736x/') : ''); // a do tamanho do cartão
const original = (u) => (pimg(u) ? u.replace(/\/(?:\d{2,4}x(?:\d{2,4})?(?:_RS)?|736x)\//, '/originals/') : '');

// os blocos de dados que a página do pin já traz prontos (o mesmo pin em pedaços): junta tudo num objeto só
function dadosDaPagina(html) {
  const o = {}, marca = '__PWS_RELAY_REGISTER_COMPLETED_REQUEST__(';
  for (let i = html.indexOf(marca); i >= 0; i = html.indexOf(marca, i + 1)) {
    const ini = html.indexOf('{', html.indexOf('",', i)), fim = html.indexOf(');</script>', ini);
    if (ini < 0 || fim < 0) continue;
    let j; try { j = JSON.parse(html.slice(ini, fim)); } catch (_) { continue; }
    let v = j && j.data && j.data.v3GetPinQueryv2; v = (v && v.data) || v;
    if (v && typeof v === 'object') juntar(o, v, 0);
  }
  return o;
}
// cada bloco traz uma parte (um tem o vídeo em 720p, outro o nome de quem salvou): junta campo a campo, sem apagar o que já veio
function juntar(o, v, prof) {
  for (const [k, x] of Object.entries(v)) {
    if (x == null) continue;
    if (o[k] == null) o[k] = x;
    else if (prof < 12 && typeof o[k] === 'object' && typeof x === 'object' && Array.isArray(o[k]) === Array.isArray(x)) {
      if (Array.isArray(x)) { for (let i = 0; i < Math.min(x.length, 60); i++) { if (o[k][i] == null) o[k][i] = x[i]; else if (typeof o[k][i] === 'object' && typeof x[i] === 'object') juntar(o[k][i], x[i], prof + 1); } }
      else juntar(o[k], x, prof + 1);
    }
  }
}
// o melhor vídeo e a melhor foto dentro de um pedaço (página do pin de ideia, item do carrossel ou o pin)
function midiaDe(x) {
  let video = null, foto = '', capa = '';
  const ver = (n, prof) => {
    if (!n || typeof n !== 'object' || prof > 9) return;
    if (Array.isArray(n)) { for (const y of n) ver(y, prof + 1); return; }
    if (typeof n.url === 'string') {
      if (pvid(n.url) && (!video || /720/.test(n.url))) video = { url: n.url, w: num(n.width) || 0, h: num(n.height) || 0, dur: Math.round((num(n.duration) || 0) / 1000), capa: pimg(n.thumbnail) || '' };
      else if (pimg(n.url) && /\/originals\//.test(n.url)) foto = n.url;
      else if (pimg(n.url) && !foto && /\/(736x|564x)\//.test(n.url)) foto = n.url;
    }
    for (const [k, y] of Object.entries(n)) if (y && typeof y === 'object' && !/^(pinner|originPinner|nativeCreator|board|user|creator)$/i.test(k)) ver(y, prof + 1);
  };
  ver(x, 0);
  if (video) { capa = video.capa || grande(foto); return { tipo: 'video', url: video.url, capa: capa && grande(capa), orig: capa, w: video.w, h: video.h, dur: video.dur }; }
  return foto ? { tipo: 'foto', url: grande(foto), orig: original(foto) || foto } : null;
}
const nickDe = (p) => p.username || (/^https:\/\/[a-z.]*pinterest\.[a-z.]+\/([A-Za-z0-9_]{3,40})\/?$/.exec(p.profile_url || '') || [])[1] || '';
const pessoaPin = (p) => (p && (p.username || p.full_name || p.fullName) ? { nick: limpa(nickDe(p), 40), nome: limpa(p.fullName || p.full_name || '', 60),
  av: pimg(p.imageMediumUrl || p.imageLargeUrl || p.image_small_url || p.imageSmallUrl || ''), seg: num(p.followerCount != null ? p.followerCount : p.follower_count) } : null);

async function pin(id) {
  const pg = await pegar('https://www.pinterest.com/pin/' + id + '/', { ...UA, Accept: 'text/html' });
  const o = pg ? dadosDaPagina(pg.texto) : {};
  // a API dos widgets: os números e a foto, mesmo quando a página vier sem os dados
  let w = null; try { const r = await pegar('https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=' + id, UA); w = r && JSON.parse(r.texto).data[0]; } catch (_) { w = null; }
  if (!o.entityId && !w) return null;
  const midias = [];
  const sp = o.storyPinData && Array.isArray(o.storyPinData.pages) ? o.storyPinData.pages : [];
  const car = o.carouselData && (o.carouselData.carouselSlots || o.carouselData.carousel_slots);
  for (const x of (sp.length ? sp : Array.isArray(car) ? car : []).slice(0, 20)) { const m = midiaDe(x); if (m) midias.push(m); }
  if (!midias.length) { const m = midiaDe({ v: o.videos, i: o.images_orig || o.images_736x }) || midiaDe(w && { i: w.images }); if (m) midias.push(m); }
  if (!midias.length) return null;
  const fo = o.images_orig || o.images_736x || {};
  if (midias[0].tipo === 'foto' && !midias[0].w) { midias[0].w = num(fo.width) || 0; midias[0].h = num(fo.height) || 0; }
  for (const m of midias) if (m.tipo === 'foto' && !m.w && w && w.images && w.images['564x']) { m.w = num(w.images['564x'].width) || 0; m.h = num(w.images['564x'].height) || 0; }
  const ag = o.aggregatedPinData || (w && w.aggregated_pin_data) || {}, bd = o.board || (w && w.board) || {};
  const autor = pessoaPin(o.nativeCreator) || pessoaPin(o.originPinner) || pessoaPin(o.pinner) || pessoaPin(w && w.pinner);
  const salvou = pessoaPin(o.pinner) || pessoaPin(w && w.pinner);
  const tit = limpa(o.title || o.gridTitle || (o.storyPinData && o.storyPinData.metadata && o.storyPinData.metadata.pinTitle) || '', 200);
  const desc = limpa(String(o.closeupUnifiedDescription || o.description || (w && w.description) || '').trim(), 800);
  const link = typeof o.link === 'string' && /^https?:\/\//.test(o.link) && !/pinterest\./i.test(o.link) ? txt(o.link, 300) : '';
  const t = Date.parse(o.createdAt || '') || 0;
  return { tipo: 'pinterest', id: String(id), url: 'https://www.pinterest.com/pin/' + id + '/', titulo: tit, texto: desc === tit ? '' : desc, autor, salvou: salvou && autor && salvou.nick === autor.nick ? null : salvou,
    pasta: bd && bd.name ? { nome: limpa(bd.name, 80), url: /^\/[\w%/-]{1,160}$/.test(bd.url || '') ? 'https://www.pinterest.com' + bd.url : '' } : null,
    salvos: num(ag.aggregatedStats ? ag.aggregatedStats.saves : ag.aggregated_stats && ag.aggregated_stats.saves), coms: num(ag.commentCount), reacoes: num(o.totalReactionCount),
    cor: /^#[0-9a-f]{6}$/i.test(o.dominantColor || (w && w.dominant_color) || '') ? (o.dominantColor || w.dominant_color) : '', link, t, midias };
}
// pasta ou perfil: até 24 pins (a foto e a proporção; o vídeo de um pin vem quando a pessoa abre ele)
async function mural(nick, pasta) {
  const base = 'https://widgets.pinterest.com/v3/pidgets/' + (pasta ? 'boards/' + encodeURIComponent(nick) + '/' + encodeURIComponent(decodeURIComponent(pasta)) : 'users/' + encodeURIComponent(nick)) + '/pins/';
  let d; try { const r = await pegar(base, UA); d = r && JSON.parse(r.texto).data; } catch (_) { d = null; }
  if (!d || !Array.isArray(d.pins)) return null;
  const pins = d.pins.slice(0, 24).map((p) => { const im = (p.images && (p.images['564x'] || p.images['237x'])) || {}; const u = pimg(im.url); return u ? { id: String(p.id), foto: grande(u), orig: original(u), w: num(im.width) || 0, h: num(im.height) || 0, video: !!p.is_video, cor: /^#[0-9a-f]{6}$/i.test(p.dominant_color || '') ? p.dominant_color : '' } : null; }).filter(Boolean);
  const u = d.user || {}, b = d.board || {};
  const autor = { nick: limpa(nick, 40), nome: limpa(u.full_name || '', 60), av: pimg(String(u.image_small_url || '').replace('/60x60_RS/', '/140x140_RS/')), seg: num(u.follower_count), pins: num(u.pin_count), sobre: limpa(u.about || '', 300) };
  if (pasta) return { tipo: 'pinterest-pasta', url: 'https://www.pinterest.com/' + nick + '/' + pasta + '/', nome: limpa(b.name || decodeURIComponent(pasta).replace(/-/g, ' '), 80), texto: limpa(b.description || '', 300), seg: num(b.follower_count), qtd: num(b.pin_count), autor, pins };
  return { tipo: 'pinterest-perfil', url: 'https://www.pinterest.com/' + nick + '/', autor, pins };
}
export async function pinterest(url) {
  if (!RE_PINTEREST.test(url)) return null;
  let u = url;
  if (/^https?:\/\/pin\.it\//i.test(u)) { // o link curto do app: leva até o pin (ou à pasta)
    const r = await buscarSoPermitidos(u, (x) => /^https:\/\/(?:[a-z0-9-]+\.)?pinterest\.[a-z.]{2,8}\//i.test(x), { headers: UA });
    u = (r && r.url) || ''; if (!r || !r.ok) { const loc = r && r.headers && r.headers.get('Location'); if (loc) u = loc; }
    if (!RE_PINTEREST.test(u)) return null;
  }
  const id = RE_PIN_ID.exec(u); if (id) return pin(id[1]);
  const m = RE_PASTA.exec(u); if (m && !/^(pin|search|ideas|today|_|login|signup|settings|business)$/i.test(m[1])) return mural(m[1], m[2] || '');
  return null;
}

// ---------- Instagram ----------
export const RE_INSTAGRAM = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})|^https?:\/\/(?:www\.|m\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/i;
const RESERVADOS_IG = /^(explore|accounts|direct|stories|about|legal|developer|p|reel|reels|tv|web)$/i;
const IG_CDN = /^https:\/\/(?:[a-z0-9-]{1,40}\.){1,4}(?:fbcdn\.net|cdninstagram\.com)\/[^\s"'<>\\]{5,1500}$/i;
const igOk = (u) => (typeof u === 'string' && IG_CDN.test(u) ? u : '');
// a página de embed (a que o próprio Instagram coloca nos sites) traz o post inteiro quando é pedida como um iframe
// No Node (o servidor de teste) o fetch troca o Sec-Fetch-Mode para "cors" e o Instagram responde sem o post: lá vai pelo https do Node
async function pegarIframe(url, headers) {
  if (!(globalThis.process && globalThis.process.versions && globalThis.process.versions.node)) return pegar(url, headers);
  const https = await import('node:' + 'https');
  return new Promise((ok) => {
    const q = https.get(url, { headers, timeout: 9000 }, (r) => { if (r.statusCode !== 200) { r.resume(); ok(null); return; } let t = ''; r.setEncoding('utf8'); r.on('data', (c) => { if (t.length < 4000000) t += c; }); r.on('end', () => ok({ r, texto: t })); });
    q.on('error', () => ok(null)); q.on('timeout', () => { q.destroy(); ok(null); });
  });
}
async function postIG(codigo) {
  const pg = await pegarIframe('https://www.instagram.com/p/' + codigo + '/embed/captioned/', { ...UA, Accept: 'text/html,application/xhtml+xml', 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'cross-site' });
  if (!pg) return null;
  const m = /"contextJSON":"((?:[^"\\]|\\.)*)"/.exec(pg.texto); if (!m) return null;
  let c; try { c = JSON.parse(JSON.parse('"' + m[1] + '"')); } catch (_) { return null; }
  const sm = c && c.gql_data && (c.gql_data.shortcode_media || c.gql_data.xdt_shortcode_media);
  return sm && sm.shortcode ? sm : null;
}
const memoIG = new Map();
async function postIGMemo(codigo) {
  const ja = memoIG.get(codigo); if (ja && Date.now() - ja.t < 600000) return ja.sm;
  const sm = await postIG(codigo); if (memoIG.size > 300) memoIG.clear(); if (sm) memoIG.set(codigo, { t: Date.now(), sm }); return sm;
}
const itensIG = (sm) => {
  const filhos = sm.edge_sidecar_to_children && Array.isArray(sm.edge_sidecar_to_children.edges) ? sm.edge_sidecar_to_children.edges.map((e) => e && e.node).filter(Boolean) : [sm];
  return filhos.slice(0, 20).map((n) => ({ video: !!n.is_video && !!igOk(n.video_url), w: num(n.dimensions && n.dimensions.width) || 0, h: num(n.dimensions && n.dimensions.height) || 0, foto: igOk(n.display_url), mp4: igOk(n.video_url) }));
};
export async function instagram(url) {
  const m = RE_INSTAGRAM.exec(url); if (!m) return null;
  if (m[3]) {
    const tipo = /^reel|tv/i.test(m[2]) ? 'reel' : 'post';
    const d = { tipo: 'instagram', sub: tipo, codigo: m[3], nick: m[1] ? txt(m[1], 30) : '', url: 'https://www.instagram.com/' + (tipo === 'reel' ? 'reel' : 'p') + '/' + m[3] + '/' };
    let sm = null; try { sm = await postIGMemo(m[3]); } catch (_) { sm = null; }
    if (!sm) return d; // privado, apagado ou o Instagram não respondeu: fica o cartão simples (o player oficial abre no clique)
    const it = itensIG(sm);
    if (!it.some((x) => x.foto || x.mp4)) return d;
    const o = sm.owner || {}, leg = sm.edge_media_to_caption && sm.edge_media_to_caption.edges && sm.edge_media_to_caption.edges[0];
    const mu = sm.clips_music_attribution_info;
    Object.assign(d, { completo: 1, nick: txt(o.username || d.nick, 30), autor: { nick: txt(o.username || '', 30), av: igOk(o.profile_pic_url) ? 1 : 0, ok: !!o.is_verified },
      texto: limpa(leg && leg.node && leg.node.text, 1500), cur: num(sm.edge_liked_by && sm.edge_liked_by.count), com: num(sm.edge_media_to_comment && sm.edge_media_to_comment.count),
      views: num(sm.video_view_count), dur: Math.round(+sm.video_duration || 0), t: num(sm.taken_at_timestamp) ? num(sm.taken_at_timestamp) * 1000 : 0,
      midias: it.map((x) => ({ tipo: x.video ? 'video' : 'foto', w: x.w, h: x.h })) });
    if (mu && (mu.song_name || mu.artist_name)) d.musica = { titulo: limpa(mu.song_name, 100), autor: limpa(mu.artist_name, 60) };
    return d;
  }
  if (m[4] && !RESERVADOS_IG.test(m[4])) return { tipo: 'instagram', sub: 'perfil', nick: txt(m[4], 30), url: 'https://www.instagram.com/' + m[4] + '/' };
  return null;
}

// ---------- os vídeos e as fotos passam por aqui (tocar e baixar) ----------
// /api/pin?u=<vídeo do pinimg>  |  /api/ig?c=<código>&n=<item>&f=v (vídeo) | i (foto) | a (foto de quem postou)
// O endereço do Instagram vence em algumas horas: o servidor busca de novo pelo código (guardado 10 min). Com Range (dá para pular) e limite por IP
const CAB_MIDIA = (tipo) => ({ 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Content-Security-Policy': "default-src 'none'; sandbox" });
async function repassar(request, alvo, ok, tipos) {
  const range = request.headers.get('Range');
  const r = await buscarSoPermitidos(alvo, ok, { headers: { ...UA, ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}) } });
  const tipo = (r.headers.get('Content-Type') || '').toLowerCase().split(';')[0].trim();
  if (!(r.status === 200 || r.status === 206) || !tipos.test(tipo)) return null;
  const h = new Headers(CAB_MIDIA(tipo));
  for (const k of ['Content-Length', 'Content-Range']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  return new Response(r.body, { status: r.status, headers: h });
}
const nada = (s = 404) => new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*' } });
export async function pinMidia(request, url, env) {
  const u = url.searchParams.get('u') || '';
  if (!pvid(u)) return nada(400);
  if (!(await limiteIp(env, request, 'pin'))) return nada(429);
  return (await repassar(request, u, (x) => !!pvid(x), /^video\/mp4$/)) || nada();
}
export async function igMidia(request, url, env) {
  const c = url.searchParams.get('c') || '', n = Math.max(0, Math.min(19, parseInt(url.searchParams.get('n'), 10) || 0)), f = url.searchParams.get('f') || 'i';
  if (!/^[A-Za-z0-9_-]{5,40}$/.test(c) || !/^[via]$/.test(f)) return nada(400);
  if (!(await limiteIp(env, request, 'ig'))) return nada(429);
  const sm = await postIGMemo(c); if (!sm) return nada();
  const it = itensIG(sm)[n];
  const alvo = f === 'a' ? igOk(sm.owner && sm.owner.profile_pic_url) : !it ? '' : f === 'v' ? it.mp4 : it.foto;
  if (!alvo) return nada();
  const r = await repassar(request, alvo, (x) => !!igOk(x), f === 'v' ? /^video\/mp4$/ : /^image\/(jpeg|png|webp|heic|avif)$/);
  if (!r && f === 'v') memoIG.delete(c); // o endereço venceu: a próxima vez busca de novo
  return r || nada();
}
