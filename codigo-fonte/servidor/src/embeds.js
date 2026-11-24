// (1.0.2) Cartões de links no chat, melhores que os do Discord: tudo dá para ver no Aero sem abrir o site.
// Spotify (música, álbum, playlist e podcast: a capa, a cor, e o trecho de 30 s de cada faixa para tocar aqui mesmo).
// Só devolve endereços conferidos (as capas e os trechos dos servidores do Spotify); o resto é texto.
// Criado por Ryan Victtor.
import { txt } from './util.js';
import { capaOk } from './midia.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };
const pegar = async (u, ms = 6000) => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(u, { headers: UA, signal: ctl.signal, redirect: 'follow' }); if (!r.ok) throw Object.assign(new Error('http ' + r.status), { status: r.status }); return await r.text(); } finally { clearTimeout(t); }
};
const num = (x) => (x != null && x !== '' && Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : 0);
const trecho = (u) => (typeof u === 'string' && /^https:\/\/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9]{10,80}(\?[A-Za-z0-9=&_.-]{0,200})?$/.test(u) ? u : '');
const idDeUri = (u) => { const m = /^spotify:(?:track|episode):([A-Za-z0-9]{22})$/.exec(String(u || '')); return m ? m[1] : ''; };
const corDe = (v) => { const c = v && v.backgroundBase; return c && [c.red, c.green, c.blue].every((x) => Number.isInteger(x) && x >= 0 && x < 256) ? [c.red, c.green, c.blue] : null; };

export const RE_SPOTIFY = /^https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{22})/i;

export async function spotify(url) {
  const m = RE_SPOTIFY.exec(url); if (!m) return null;
  const tipo = m[1].toLowerCase(), id = m[2], link = 'https://open.spotify.com/' + tipo + '/' + id;
  const [html, oe] = await Promise.all([
    pegar('https://open.spotify.com/embed/' + tipo + '/' + id).catch(() => ''),
    pegar('https://open.spotify.com/oembed?url=' + encodeURIComponent(link)).then((t) => JSON.parse(t)).catch(() => ({})),
  ]);
  const nx = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  let e = null; try { e = nx ? JSON.parse(nx[1]).props.pageProps.state.data.entity : null; } catch (_) { e = null; }
  if (!e && !oe.title) return null;
  e = e || {};
  const capas = (e.coverArt && e.coverArt.sources) || (e.visualIdentity && e.visualIdentity.image) || [];
  const capa = capaOk((Array.isArray(capas) && capas.length ? capas.slice().sort((a, b) => (b.width || 640) - (a.width || 640))[0].url : '') || oe.thumbnail_url || '');
  const artistas = Array.isArray(e.artists) ? e.artists.map((a) => a && a.name).filter(Boolean).slice(0, 4).join(', ') : '';
  const d = {
    tipo: 'spotify', k: tipo, id, url: link,
    titulo: txt(e.title || e.name || oe.title || '', 160), sub: txt(artistas || e.subtitle || '', 120), capa,
    cor: corDe(e.visualIdentity), dur: num(e.duration), exp: !!e.isExplicit,
  };
  if (tipo === 'track' || tipo === 'episode') d.prev = trecho(e.audioPreview && e.audioPreview.url);
  if (Array.isArray(e.trackList)) {
    d.faixas = e.trackList.slice(0, 100).map((f) => (f && f.title ? { t: txt(f.title, 160), a: txt(f.subtitle || '', 120), dur: num(f.duration), prev: trecho(f.audioPreview && f.audioPreview.url), id: idDeUri(f.uri), exp: !!f.isExplicit } : null)).filter(Boolean);
    d.total = d.faixas.length;
  }
  return d;
}

// ---------- Reddit ----------
// A página de embed do Reddit (embed.reddit.com) vem pronta do servidor: título, sub, autor, as fotos (até 20, da galeria também) e o vídeo.
// O vídeo do Reddit vem com o som separado; o cartão toca os dois juntos. Só endereços dos servidores de mídia do Reddit.
export const RE_REDDIT = /^https?:\/\/(?:(?:www|old|new|np|m|sh)\.)?reddit\.com\/(?:r\/([A-Za-z0-9_]{2,21})\/)?(?:comments|s)\/([A-Za-z0-9]{3,12})(?:\/([^/?#]{0,120}))?/i;
const desHtml = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const imgReddit = (u) => (typeof u === 'string' && u.length < 600 && /^https:\/\/(?:preview|i|external-preview)\.redd\.it\/[^\s"'<>\\]+$/.test(u) ? u : '');
const vidReddit = (u) => (typeof u === 'string' && u.length < 900 && /^https:\/\/(?:v\.redd\.it|packaged-media\.redd\.it)\/[^\s"'<>\\]+$/.test(u) ? u : '');
const existe = async (u) => { try { const r = await fetch(u, { method: 'HEAD', headers: UA }); return r.ok; } catch (_) { return false; } };

export async function reddit(url) {
  let m = RE_REDDIT.exec(url); if (!m) return null;
  let sub = m[1] || '', id = m[2], slug = m[3] || '';
  if (/\/s\//i.test(url)) { // link curto de compartilhar: segue o redirecionamento até o post de verdade
    try { const r = await fetch(url, { headers: UA, redirect: 'follow' }); const m2 = RE_REDDIT.exec(r.url || ''); if (!m2 || /\/s\//i.test(r.url)) return null; sub = m2[1] || ''; id = m2[2]; slug = m2[3] || ''; } catch (_) { return null; }
  }
  const link = 'https://www.reddit.com/' + (sub ? 'r/' + sub + '/' : '') + 'comments/' + id + '/' + (slug ? slug + '/' : '');
  const [html, oe] = await Promise.all([
    sub ? pegar('https://embed.reddit.com/r/' + sub + '/comments/' + id + '/' + (slug || '_') + '/?embed=true').catch(() => '') : Promise.resolve(''),
    pegar('https://www.reddit.com/oembed?url=' + encodeURIComponent(link)).then((t) => JSON.parse(t)).catch(() => ({})),
  ]);
  let ctx = {}; const c = /data-faceplate-tracking-context="([^"]{2,4000})"/.exec(html);
  try { ctx = c ? JSON.parse(desHtml(c[1])) : {}; } catch (_) { ctx = {}; }
  const post = ctx.post || {}, h1 = /<h1[^>]*>([\s\S]{1,600}?)<\/h1>/.exec(html);
  const titulo = txt(desHtml(((h1 && h1[1]) || '').replace(/<[^>]+>/g, '')).trim() || desHtml((/<title>([^<]{1,300})<\/title>/.exec(oe.html || '') || [])[1] || '') || '', 300);
  if (!titulo && !oe.author_name) return null;
  // fotos: cada imagem aparece em vários tamanhos (srcset); fica a maior de cada uma
  const fotos = new Map();
  for (const x of html.matchAll(/https:\/\/(?:preview|i)\.redd\.it\/([A-Za-z0-9_-]{6,80})\.(?:jpe?g|png|gif|webp)(?:\?[^\s"'<>\\]*)?/g)) {
    const u = imgReddit(desHtml(x[0])); if (!u) continue;
    // (1.0.2) a mesma foto vem como i.redd.it/<id> e preview.redd.it/<titulo>-v0-<id>: a chave é só o <id> (antes a foto aparecia duas vezes)
    const chave = x[1].replace(/^.*-v\d+-/, ''), w = +((/[?&]width=(\d+)/.exec(u) || [])[1] || 9999), ja = fotos.get(chave);
    if (!ja || (w > ja.w && w <= 1600) || (ja.w > 1600 && w < ja.w)) fotos.set(chave, { u, w });
    if (fotos.size >= 24) break;
  }
  if (post.url && imgReddit(post.url) && !fotos.size) fotos.set('p', { u: post.url, w: 0 });
  const midias = [...fotos.values()].slice(0, 20).map((f) => ({ tipo: 'foto', url: f.u }));
  // vídeo: o arquivo empacotado (já com som) se a página tiver; senão o DASH do v.redd.it com o som à parte
  let video = null;
  const pk = /https:\/\/packaged-media\.redd\.it\/[^\s"'<>\\]+?\.mp4\?[^\s"'<>\\]+/.exec(desHtml(html));
  const vr = /https:\/\/v\.redd\.it\/([a-z0-9]{8,20})/i.exec(html) || (/^https:\/\/v\.redd\.it\/([a-z0-9]{8,20})/i.exec(post.url || ''));
  if (pk && vidReddit(pk[0])) video = { url: pk[0] };
  else if (vr) {
    const base = 'https://v.redd.it/' + vr[1] + '/';
    for (const q of ['DASH_720.mp4', 'CMAF_720.mp4', 'DASH_480.mp4', 'CMAF_480.mp4', 'DASH_360.mp4']) if (await existe(base + q)) { video = { url: base + q }; break; }
    if (video) for (const a of ['DASH_AUDIO_128.mp4', 'CMAF_AUDIO_128.mp4', 'DASH_audio.mp4', 'DASH_AUDIO_64.mp4']) if (await existe(base + a)) { video.som = base + a; break; }
  }
  if (video) { video.capa = midias.length ? midias[0].url : ''; midias.length = 0; }
  const n = (k) => { const v = post[k]; return v != null && Number.isFinite(+v) ? Math.floor(+v) : null; };
  const corpo = /<div[^>]*(?:id="[^"]*-post-rtjson-content"|slot="text-body")[^>]*>([\s\S]{0,6000}?)<\/div>/.exec(html);
  return {
    tipo: 'reddit', url: link, sub: txt((ctx.subreddit && ctx.subreddit.name) || sub, 21), autor: txt(oe.author_name || '', 40), titulo,
    texto: corpo ? txt(desHtml(corpo[1].replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim(), 1200) : '',
    t: n('created_timestamp') || 0, nsfw: !!post.nsfw, pontos: n('score'), coment: n('number_comments'), midias, video,
  };
}

// ---------- Lojas (Amazon e AliExpress) ----------
// Preço, fotos do produto, nota e quantas avaliações, e quanto fica de imposto para quem compra no Brasil (estimativa, avisada como tal).
export const RE_LOJA = /^https?:\/\/(?:(?:www|pt|m|smile)\.)?(?:(amazon)\.(?:com\.br|com|co\.uk|de|es|fr|it|ca|co\.jp|com\.mx)|(a\.)?(aliexpress)\.(?:com|us|ru)|(amzn)\.(?:to|eu|com)|(a\.co))\/[^\s]{1,400}$/i;
const imgLoja = (u) => (typeof u === 'string' && u.length < 500 && /^https:\/\/(?:m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|ae0?\d?\.alicdn\.com|ae-pic-a1\.aliexpress-media\.com)\/[^\s"'<>\\]+$/.test(u) ? u.replace(/^https:\/\/images-na\.ssl-images-amazon\.com/, 'https://m.media-amazon.com') : '');
const precoDe = (s) => { // "R$ 1.234,56" / "$1,234.56" -> 1234.56
  const t = String(s || '').replace(/[^\d.,]/g, ''); if (!t) return null;
  const v = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  return Number.isFinite(+v) && +v > 0 ? Math.round(+v * 100) / 100 : null;
};
const moedaDe = (s, dom) => { const t = String(s || ''); if (/R\$/.test(t)) return 'BRL'; if (/US\$|USD/.test(t)) return 'USD'; if (/€/.test(t)) return 'EUR'; if (/£/.test(t)) return 'GBP'; if (/\$/.test(t)) return /com\.mx/.test(dom) ? 'MXN' : /\.ca\//.test(dom) ? 'CAD' : 'USD'; return /\.com\.br/.test(dom) ? 'BRL' : ''; };
const meta = (html, p) => { const r = new RegExp('<meta[^>]+(?:property|name)="' + p + '"[^>]+content="([^"]{1,1000})"', 'i').exec(html) || new RegExp('<meta[^>]+content="([^"]{1,1000})"[^>]+(?:property|name)="' + p + '"', 'i').exec(html); return r ? desHtml(r[1]) : ''; };

// imposto de importação no Brasil (Remessa Conforme): até US$ 50 -> 20%; acima -> 60% com US$ 20 de desconto; e ICMS de 17% "por dentro"
export function impostoBR(valor, moeda, cotacao) {
  if (!(valor > 0) || moeda === 'BRL' && cotacao == null) return null;
  const usd = moeda === 'USD' ? valor : cotacao ? valor * cotacao : null; if (usd == null) return null;
  const ii = usd <= 50 ? usd * 0.2 : Math.max(0, usd * 0.6 - 20);
  const icms = (usd + ii) / (1 - 0.17) * 0.17;
  return { ii: Math.round(ii * 100) / 100, icms: Math.round(icms * 100) / 100, total: Math.round((ii + icms) * 100) / 100, final: Math.round((usd + ii + icms) * 100) / 100, moeda: 'USD' };
}

export async function loja(url) {
  const m = RE_LOJA.exec(url); if (!m) return null;
  const ali = !!m[3];
  let html = '', final = url;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(url, { headers: { ...UA, Accept: 'text/html' }, redirect: 'follow', signal: ctl.signal }); clearTimeout(t);
    final = r.url || url; html = r.ok ? (await r.text()).slice(0, 1500000) : '';
  } catch (_) { html = ''; }
  if (!html || /captcha|robot check/i.test(html.slice(0, 20000)) && !/productTitle/.test(html)) return null;
  const dom = final.toLowerCase();
  const d = { tipo: 'loja', loja: ali ? 'aliexpress' : 'amazon', url: final.split('?')[0].slice(0, 400), titulo: '', fotos: [], preco: null, de: null, moeda: '', nota: null, aval: null, frete: '', imposto: null, incluso: false };
  if (!ali) {
    d.titulo = txt(desHtml((/id="productTitle"[^>]*>([\s\S]{1,600}?)<\/span>/.exec(html) || [])[1] || meta(html, 'og:title') || meta(html, 'title')).trim(), 300);
    const p = /class="a-price[^"]*"[^>]*>\s*<span class="a-offscreen">([^<]{1,40})<\/span>/.exec(html) || /id="priceblock_(?:our|deal)price"[^>]*>([^<]{1,40})</.exec(html) || /"priceAmount":([\d.]+)/.exec(html);
    if (p) { d.preco = /^[\d.]+$/.test(p[1]) ? +p[1] : precoDe(p[1]); d.moeda = moedaDe(p[1], dom); }
    const de = /class="a-price a-text-price"[^>]*>\s*<span class="a-offscreen">([^<]{1,40})<\/span>/.exec(html); if (de) d.de = precoDe(de[1]);
    const fs = new Set(); for (const x of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g)) { const u = imgLoja(x[1]); if (u) fs.add(u); if (fs.size >= 20) break; }
    if (!fs.size) for (const x of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g)) { const u = imgLoja(x[1]); if (u) fs.add(u); if (fs.size >= 20) break; }
    if (!fs.size) { const o = /id="landingImage"[^>]+src="([^"]+)"/.exec(html) || [, meta(html, 'og:image')]; const u = imgLoja(o[1]); if (u) fs.add(u); }
    d.fotos = [...fs];
    const nt = /<span class="a-icon-alt">([\d.,]{1,4}) (?:de|out of|von|sur|su|de un máximo de) 5/.exec(html); if (nt) d.nota = +nt[1].replace(',', '.');
    const av = /id="acrCustomerReviewText"[^>]*>([\d.,\s]{1,12})/.exec(html); if (av) d.aval = +av[1].replace(/[^\d]/g, '') || null;
    const fr = /data-csa-c-delivery-price="([^"]{1,60})"/.exec(html); if (fr) d.frete = txt(desHtml(fr[1]), 60);
    d.incluso = /amazon\.com\.br/.test(dom); // na Amazon Brasil o preço já vem com os impostos
  } else {
    const og = meta(html, 'og:title'); d.titulo = txt(og.replace(/\s*-\s*AliExpress.*$/i, ''), 300);
    if (!d.titulo) { const tt = /<title>([^<]{4,400})<\/title>/.exec(html); if (tt) d.titulo = txt(desHtml(tt[1]).replace(/\s*-\s*AliExpress.*$/i, ''), 300); }
    const blob = /window\.runParams\s*=\s*\{[\s\S]{0,40}data:\s*(\{[\s\S]*?\})\s*\};/.exec(html) || /_init_data_\s*=\s*\{\s*data:\s*(\{[\s\S]*?\})\s*\}/.exec(html);
    let j = null; try { j = blob ? JSON.parse(blob[1]) : null; } catch (_) { j = null; }
    const procura = (o, k, prof = 0) => { if (!o || typeof o !== 'object' || prof > 8) return undefined; if (k in o) return o[k]; for (const v of Object.values(o)) { const r = procura(v, k, prof + 1); if (r !== undefined) return r; } return undefined; };
    const imgs = (j && (procura(j, 'imagePathList') || [])) || [];
    d.fotos = (Array.isArray(imgs) ? imgs : []).map(imgLoja).filter(Boolean).slice(0, 20);
    // (1.0.2) a página nova não tem mais o bloco de dados inteiro: a lista de fotos vem solta no HTML (antes ficava só a primeira foto)
    if (d.fotos.length < 2) { const lp = /"imagePathList":\[([^\]]{1,6000})\]/.exec(html); if (lp) for (const x of lp[1].matchAll(/"(https:\/\/[^"]+)"/g)) { const u = imgLoja(x[1]); if (u && !d.fotos.includes(u)) d.fotos.push(u); if (d.fotos.length >= 20) break; } }
    if (!d.fotos.length) { const u = imgLoja(meta(html, 'og:image')); if (u) d.fotos.push(u); }
    const pr = j && (procura(j, 'formatedActivityPrice') || procura(j, 'formatedPrice') || procura(j, 'formattedPrice'));
    const prTxt = pr || (/"(?:minActivityAmount|minAmount)":\{"value":([\d.]+),"currency":"([A-Z]{3})"/.exec(html) || [])[0] || '';
    if (pr) { d.preco = precoDe(pr); d.moeda = moedaDe(pr, dom); } else { const x = /"(?:minActivityAmount|minAmount)":\{"value":([\d.]+),"currency":"([A-Z]{3})"/.exec(html); if (x) { d.preco = +x[1]; d.moeda = x[2]; } }
    void prTxt;
    const nt = j && procura(j, 'averageStar'); if (nt != null && Number.isFinite(+nt)) d.nota = Math.round(+nt * 10) / 10;
    const av = j && procura(j, 'totalValidNum'); if (av != null && Number.isFinite(+av)) d.aval = +av;
    if (!d.titulo && j) d.titulo = txt(procura(j, 'subject') || '', 300);
  }
  if (!d.titulo) return null;
  if (d.preco != null && !d.moeda) d.moeda = 'USD';
  if (!d.incluso && d.preco != null) d.imposto = impostoBR(d.preco, d.moeda, d.moeda === 'USD' ? 1 : null);
  if (d.moeda === 'BRL' && !d.incluso && d.preco != null) { // preço já em reais (AliExpress Brasil): calcula a partir de uma cotação aproximada
    const usd = d.preco / 5.4, ii = usd <= 50 ? usd * 0.2 : Math.max(0, usd * 0.6 - 20), icms = (usd + ii) / 0.83 * 0.17;
    d.imposto = { ii: Math.round(ii * 5.4 * 100) / 100, icms: Math.round(icms * 5.4 * 100) / 100, total: Math.round((ii + icms) * 5.4 * 100) / 100, final: Math.round((d.preco + (ii + icms) * 5.4) * 100) / 100, moeda: 'BRL' };
  }
  return d;
}
