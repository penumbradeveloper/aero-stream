// (0.8.7) mídia sem chave e sem Spotify Premium: busca de filmes e séries (sugestões públicas do IMDb), animes (AniList), músicas e
// álbuns (Deezer), links do Spotify (página pública do player), do Deezer e do YouTube / YouTube Music, e o Letterboxd (perfil, RSS e
// curtidos públicos). Tudo devolve só o essencial: nome, subtítulo, capa e link. As capas passam pelo servidor (capa()), assim o
// aparelho de quem vê o perfil não fala com nenhum site de fora.

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };
const cache = () => caches.default;

async function pegar(url, { json = false, init = {}, ms = 5000 } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) }, signal: ctl.signal });
    if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
    return json ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}
// guarda a resposta (JSON) por "seg" segundos no cache do Cloudflare
async function guardado(chave, seg, fazer) {
  const k = new Request('https://cache.aero/' + chave), c = cache();
  const ja = await c.match(k); if (ja) return ja.json();
  const v = await fazer();
  await c.put(k, new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + seg } }));
  return v;
}
const ent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
const corta = (s, n) => ent(s).slice(0, n);

// ---------- capas: só destes sites ----------
export const HOSTS_CAPA = /^https:\/\/(m\.media-amazon\.com|s4\.anilist\.co|(cdn|e-cdns)-images\.dzcdn\.net|i\.scdn\.co|image-cdn-(ak|fa)\.spotifycdn\.com|i\.ytimg\.com|lh3\.googleusercontent\.com|yt3\.ggpht\.com|a\.ltrbxd\.com|shared\.(akamai|fastly)\.steamstatic\.com|steamcdn-a\.akamaihd\.net|(upload|thumb)\.wikimedia\.org|thumbnails\.libretro\.com|media\.kitsu\.app|covers\.openlibrary\.org|books\.google\.com|pbs\.twimg\.com|cdn\.discordapp\.com|media\.discordapp\.net|images\.igdb\.com|i\.imgur\.com|cdn\.(akamai|cloudflare)\.steamstatic\.com|(tr|t\d)\.rbxcdn\.com|static-cdn\.jtvnw\.net)\//; // (1.0.0) e as imagens da atividade de jogo
export const capaOk = (u) => (typeof u === 'string' && u.length < 400 && HOSTS_CAPA.test(u) ? u : '');
// Busca seguindo no máximo 3 redirecionamentos, e cada um precisa continuar num site permitido: um redirecionamento aberto num
// site da lista não faz o servidor buscar outro endereço qualquer (SSRF).
export async function buscarSoPermitidos(u, ok, init = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { ...init, redirect: 'manual' });
    if (r.status < 300 || r.status > 399) return r;
    const prox = r.headers.get('Location');
    if (!prox) return r;
    let abs; try { abs = new URL(prox, u).href; } catch (e) { break; }
    if (!ok(abs)) break;
    u = abs;
  }
  return new Response('', { status: 404 });
}
// Limite por IP dos proxies públicos (capas e vídeos do Twitter): ninguém usa o servidor como baixador de graça.
export async function limiteIp(env, request, tipo) {
  const lim = env && env.LIMITE_MIDIA;
  if (!lim || typeof lim.limit !== 'function') return true;
  const ip = (request && request.headers.get('CF-Connecting-IP')) || '?';
  try { return (await lim.limit({ key: tipo + ':' + ip })).success; } catch (e) { return true; }
}
const MUITOS = () => new Response('', { status: 429, headers: { 'Retry-After': '60' } });
export async function capa(u, env, request) {
  if (!capaOk(u)) return new Response('', { status: 404 });
  const k = new Request('https://cache.aero/capa/' + encodeURIComponent(u)), c = cache();
  const ja = await c.match(k); if (ja) return ja;
  if (!(await limiteIp(env, request, 'capa'))) return MUITOS();
  const r = await buscarSoPermitidos(u, capaOk, { headers: UA });
  const tipo = (r.headers.get('Content-Type') || '').toLowerCase(); // o Roblox manda "image/Png"
  if (!r.ok || !/^image\/(jpeg|png|webp|gif|avif)/.test(tipo)) return new Response('', { status: 404 });
  const b = await r.arrayBuffer(); if (b.byteLength > 1500000) return new Response('', { status: 404 });
  const res = new Response(b, { headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } });
  await c.put(k, res.clone());
  return res;
}
// (1.0.0) proxy geral de imagens (como o do Discord): qualquer imagem de fora (GIF colado no chat, link de imagem) passa por aqui,
// então o site dono da imagem só vê o servidor do Aero, nunca o IP de quem abriu a conversa. Só https, só nome de site público
// (nada de IP, localhost, rede interna), só imagem de verdade (sem SVG), no máximo 15 MB, e cada redirecionamento é conferido de novo.
export function imgOk(u) {
  let x; try { x = new URL(u); } catch (e) { return false; }
  if (x.protocol !== 'https:' || x.username || x.password || (x.port && x.port !== '443')) return false;
  const hn = x.hostname.toLowerCase().replace(/\.$/, '');
  if (!hn.includes('.') || /^[\d.]+$/.test(hn) || hn.includes(':') || hn.startsWith('[')) return false;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid|example)$/.test(hn)) return false;
  return u.length <= 2048;
}
export async function imgProxy(u, env, request) {
  const nada = (st = 404) => new Response('', { status: st, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' } });
  if (!imgOk(u)) return nada(400);
  const k = new Request('https://cache.aero/img/' + encodeURIComponent(u)), c = cache();
  const ja = await c.match(k); if (ja) return ja;
  if (!(await limiteIp(env, request, 'img'))) return MUITOS();
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await buscarSoPermitidos(u, imgOk, { headers: { 'User-Agent': UA['User-Agent'], Accept: 'image/avif,image/webp,image/apng,image/*;q=0.8' }, signal: ctl.signal });
    const tipo = (r.headers.get('Content-Type') || '').toLowerCase().split(';')[0].trim();
    if (!r.ok || !/^image\/(jpeg|jpg|pjpeg|png|apng|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon)$/.test(tipo)) return nada();
    const tam = +(r.headers.get('Content-Length') || 0); if (tam > 15e6) return nada(413);
    const b = await r.arrayBuffer(); if (b.byteLength > 15e6) return nada(413);
    const res = new Response(b, { headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
    await c.put(k, res.clone());
    return res;
  } catch (e) { return nada(502); } finally { clearTimeout(t); }
}
const imdbPeq = (u) => (u ? u.replace(/\._V1_.*\.jpg$/, '._V1_SX300_.jpg') : '');

// ---------- busca ----------
// tipo: f (filmes), s (séries), a (animes), m (músicas), l (álbuns), mu (músicas para a Música junto: Deezer + YouTube)
// (1.0.0) busca da atividade de jogo (o editor da atividade personalizada): acha também os jogos pequenos. Junta a Steam (a busca da loja
// e as sugestões da barra de busca, que pegam o começo do nome), o Roblox (as experiências) e a Wikipédia (jogos de qualquer console); cada
// um traz o ícone quadrado (i) e a capa (c). A lista sai ordenada pelo quanto o nome parece com o que a pessoa escreveu, e se nada parecer,
// tenta de novo aceitando erro de digitação.
const normJ = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, '');
const pares = (s) => { const l = []; for (let i = 0; i < s.length - 1; i++) l.push(s.slice(i, i + 2)); return l; };
export function parecido(q, nome) {
  const a = normJ(q), b = normJ(nome); if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.startsWith(a)) return 85 + Math.round(10 * a.length / b.length);
  if (a.startsWith(b) && b.length >= 4) return 60;
  if (b.includes(a)) return 70;
  const pa = pares(a), pb = pares(b); let c = 0; const resto = [...pb];
  for (const x of pa) { const k = resto.indexOf(x); if (k >= 0) { c++; resto.splice(k, 1); } }
  return Math.round(65 * (2 * c) / ((pa.length + pb.length) || 1)); // parecido de letras (erros de digitação)
}
const milhar = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' mi' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(n));
export async function buscarJogoAtividade(q) {
  q = String(q || '').trim().slice(0, 80); if (q.length < 2) return [];
  const wiki = (s) => pegar('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrlimit=10&prop=pageimages|description&piprop=thumbnail&pithumbsize=300&pilicense=any&gsrsearch='
    + encodeURIComponent(s + ' hastemplate:"Infobox video game"'), { json: true, ms: 4000, init: { headers: { 'User-Agent': 'AeroStream/1.0 (games search)' } } });
  const [st, sg, wk, rb] = await Promise.allSettled([
    pegar('https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=' + encodeURIComponent(q), { json: true, ms: 4000 }),
    pegar('https://store.steampowered.com/search/suggest?f=games&cc=US&l=english&realm=1&use_store_query=1&use_search_spellcheck=1&term=' + encodeURIComponent(q), { ms: 4000 }),
    wiki(q),
    pegar('https://apis.roblox.com/search-api/omni-search?pageType=all&sessionId=aero&searchQuery=' + encodeURIComponent(q), { json: true, ms: 4000 }),
  ]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  // Steam: a busca da loja e as sugestões (as duas trazem o número do app)
  const steam = new Map();
  for (const x of ((val(st) || {}).items || [])) if (x.type === 'app' && Number.isInteger(x.id) && !steam.has(x.id)) steam.set(x.id, { nome: String(x.name || ''), meta: x.metascore ? 'Metacritic ' + x.metascore : '' });
  const html = String(val(sg) || ''), re = /data-ds-appid="(\d{1,9})"[\s\S]*?class="match_name"[^>]*>([^<]{1,200})</g;
  for (let m; (m = re.exec(html)) && steam.size < 20;) { const id = +m[1]; if (!steam.has(id)) steam.set(id, { nome: ent(m[2]), meta: '' }); }
  const lista = [];
  for (const [id, x] of steam) lista.push({ t: corta(x.nome, 100), a: x.meta || 'Steam', c: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + id + '/library_600x900.jpg', u: 'https://store.steampowered.com/app/' + id + '/', f: 'steam', sid: id, p: parecido(q, x.nome) });
  // Wikipédia: jogos de qualquer console (e os que não estão na Steam); se já veio da Steam, só junta o ano
  let paginas = ((val(wk) || {}).query || {}).pages || [];
  const melhor = () => Math.max(0, ...lista.map((x) => x.p), ...paginas.map((p) => parecido(q, String(p.title || '').replace(/ \((\d{4} )?video game\)$/, ''))));
  if (melhor() < 60 && /^[\p{L}\p{N} ]+$/u.test(q)) { // nada parecido: tenta aceitando erro de digitação ("hollow nite" acha "Hollow Knight")
    const palavras = q.split(/\s+/).filter(Boolean), maior = [...palavras].sort((x, y) => y.length - x.length)[0];
    const [w2, s2] = await Promise.allSettled([wiki(palavras.map((w) => w + '~').join(' ')),
      palavras.length > 1 && maior.length >= 3 ? pegar('https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=' + encodeURIComponent(maior), { json: true, ms: 4000 }) : null]);
    const pg2 = ((val(w2) || {}).query || {}).pages; if (pg2 && pg2.length) paginas = pg2;
    for (const x of ((val(s2) || {}).items || [])) if (x.type === 'app' && Number.isInteger(x.id) && !steam.has(x.id)) {
      steam.set(x.id, { nome: String(x.name || ''), meta: x.metascore ? 'Metacritic ' + x.metascore : '' });
      lista.push({ t: corta(x.name, 100), a: x.metascore ? 'Metacritic ' + x.metascore : 'Steam', c: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + x.id + '/library_600x900.jpg', u: 'https://store.steampowered.com/app/' + x.id + '/', f: 'steam', sid: x.id, p: parecido(q, x.name) });
    }
  }
  for (const pg of paginas.sort((a, b) => a.index - b.index)) {
    const titulo = String(pg.title || '').replace(/ \((\d{4} )?video game\)$/, ''); if (!titulo) continue;
    const ano = (String(pg.description || '').match(/\b(19|20)\d\d\b/) || [''])[0];
    const s = lista.find((x) => x.f === 'steam' && normJ(x.t) === normJ(titulo));
    if (s) { if (ano) s.a = [ano, s.a === 'Steam' ? '' : s.a].filter(Boolean).join(' · '); continue; }
    lista.push({ t: corta(titulo, 100), a: ano || corta(pg.description, 60), c: capaOk(String((pg.thumbnail && pg.thumbnail.source) || '').replace(/\?.*$/, '')), u: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(pg.title).replace(/ /g, '_')), f: 'wiki', p: parecido(q, titulo) });
  }
  // Roblox: as experiências (com quantos estão jogando agora)
  const rob = [];
  for (const g of ((val(rb) || {}).searchResults || [])) {
    if (g.contentGroupType !== 'Game') continue;
    for (const x of g.contents || []) if (Number.isInteger(x.universeId) && x.name && rob.length < 6) rob.push(x);
  }
  for (const x of rob) {
    const nome = String(x.name).replace(/^\s*(\[[^\]]*\]|\([^)]*\)|[^\p{L}\p{N}]+)\s*/u, '').replace(/[^\p{L}\p{N})!?.]+$/u, '').trim() || String(x.name);
    lista.push({ t: corta(nome, 100), a: 'Roblox' + (x.playerCount ? ' · ' + milhar(x.playerCount) + ' jogando' : ''), u: 'https://www.roblox.com/games/' + (x.rootPlaceId || '') , f: 'roblox', rid: x.universeId, p: parecido(q, nome) - 3 });
  }
  // trilha sonora, demo e pacotes não são o jogo: vão para o fim (a não ser que a pessoa tenha procurado por isso)
  const extra = /\b(soundtrack|ost|demo|playtest|dlc|song pack|music pack|artbook|art book|wallpapers?|season pass|expansion pass|bundle)\b/i;
  for (const x of lista) if (extra.test(x.t) && !extra.test(q)) x.p -= 40;
  lista.sort((a, b) => b.p - a.p);
  const adulto = /\b(hentai|nsfw|porn\w*|sexy?|erotic\w*|nude)\b|18\s*\+/i; // a lista aparece no app de todo mundo: conteúdo adulto só se a pessoa procurar por ele
  const fica = lista.filter((x) => x.p >= 25 && (!adulto.test(x.t) || adulto.test(q))).slice(0, 14);
  // os ícones quadrados: os da Steam (uma ida para todos) e os do Roblox
  const sids = fica.filter((x) => x.sid).map((x) => x.sid), rids = fica.filter((x) => x.rid).map((x) => x.rid);
  const [ic, ri] = await Promise.allSettled([
    sids.length ? pegar('https://api.steampowered.com/ICommunityService/GetApps/v1/?' + sids.map((id, i) => 'appids%5B' + i + '%5D=' + id).join('&'), { json: true, ms: 4000 }) : null,
    rids.length ? pegar('https://thumbnails.roblox.com/v1/games/icons?size=256x256&format=Png&isCircular=false&universeIds=' + rids.join(','), { json: true, ms: 4000 }) : null,
  ]);
  const icS = new Map(((((val(ic) || {}).response) || {}).apps || []).filter((a) => /^[0-9a-f]{40}$/.test(a.icon || '')).map((a) => [a.appid, a.icon]));
  const icR = new Map(((val(ri) || {}).data || []).map((d) => [d.targetId, capaOk(String(d.imageUrl || ''))]));
  return fica.map((x) => {
    const o = { t: x.t, a: x.a, c: x.c || '', i: '', u: String(x.u || '').slice(0, 200), f: x.f };
    if (x.sid && icS.has(x.sid)) o.i = 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/' + x.sid + '/' + icS.get(x.sid) + '.jpg';
    if (x.rid && icR.get(x.rid)) o.i = o.c = icR.get(x.rid);
    return o;
  });
}
// (1.0.0) as imagens de um jogo para escolher o ícone da atividade (como no Playnite): as do artigo da Wikipédia (a capa de cada versão),
// os logos e capas do Wikimedia Commons com o nome do jogo e, se o jogo estiver na Steam, a capa, o banner, o logo e o ícone de lá.
// Cada imagem: u (link, sempre de um site que a capa() busca), k (capa, logo, tela ou icone) e o (de onde veio)
export async function imagensDoJogo(q) {
  q = String(q || '').trim().slice(0, 100); if (q.length < 2) return [];
  const palavras = normJ(q).length ? q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !['the', 'of', 'a', 'and', 'de', 'do', 'da'].includes(w)) : [];
  const temNome = (t) => { const n = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return palavras.length && palavras.filter((w) => n.includes(w)).length >= Math.max(1, Math.ceil(palavras.length * 0.6)); };
  const wk = { headers: { 'User-Agent': 'AeroStream/1.0 (games search)' } };
  const II = '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=600';
  const [art, com, st] = await Promise.allSettled([
    pegar('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&generator=images&gimlimit=50&titles=' + encodeURIComponent(q + '|' + q + ' (video game)') + II, { json: true, ms: 4500, init: wk }),
    pegar('https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrlimit=24&gsrsearch=' + encodeURIComponent(q) + II, { json: true, ms: 4500, init: wk }),
    pegar('https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=' + encodeURIComponent(q), { json: true, ms: 4000 }),
  ]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  const out = [], vistos = new Set();
  const por = (u, k, o) => { u = capaOk(u); if (u && !vistos.has(u) && out.length < 40) { vistos.add(u); out.push({ u, k, o }); } };
  // Steam: só se o nome bater
  const sj = (((val(st) || {}).items) || []).find((x) => x.type === 'app' && Number.isInteger(x.id) && normJ(x.name) === normJ(q));
  if (sj) {
    const b = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + sj.id + '/';
    try { const d = await pegar('https://api.steampowered.com/ICommunityService/GetApps/v1/?appids%5B0%5D=' + sj.id, { json: true, ms: 3000 }); const ic = ((((d || {}).response || {}).apps || [])[0] || {}).icon; if (/^[0-9a-f]{40}$/.test(ic || '')) por('https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/' + sj.id + '/' + ic + '.jpg', 'icone', 'Steam'); } catch (e) { /* sem ícone */ }
    por(b + 'library_600x900.jpg', 'capa', 'Steam'); por(b + 'logo.png', 'logo', 'Steam'); por(b + 'header.jpg', 'capa', 'Steam');
  }
  const tipoDe = (titulo, ii) => (/logo|wordmark/i.test(titulo) || ii.mime === 'image/svg+xml' ? 'logo' : /cover|box|capa|packag/i.test(titulo) || (ii.height > ii.width * 1.1) ? 'capa' : 'tela');
  const FOTO = /cosplay|comics|otakon|pax\b|convention|expo\b|festival|conference|\b(19|20)\d\d[ _-]\d|portrait|interview|_\d{4}_|\(cropped\)|rotated|brightened|statue|museum|merch|figure|plush|award|gdc\b|\bteam\b/i;
  const lerPaginas = (d, origem, filtrar) => {
    for (const pg of ((d || {}).query || {}).pages || []) {
      const ii = (pg.imageinfo || [])[0]; if (!ii) continue;
      const titulo = String(pg.title || '').replace(/^File:/, '');
      if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(ii.mime || '')) continue;
      if (/\b(logo|icon)\b.*\b(wiki\w*|commons|ooui|oojs)\b|^(wiki|commons|ooui|oojs|edit|symbol|flag|cscr|wpvg|question|padlock|portal|nuvola|crystal)/i.test(titulo)) continue; // ícones do próprio site
      if ((ii.width || 0) < 100 || (ii.height || 0) < 60) continue;
      if (FOTO.test(titulo) || !(temNome(titulo) || principal.has(titulo))) continue; // fotos de pessoas, eventos e cosplay não são do jogo
      const k = tipoDe(titulo, ii); if (filtrar && !(k === 'logo' || /cover|box ?art|boxart/i.test(titulo))) continue; // do Commons, só logo e capa com esse nome no arquivo
      if (/\b(porn\w*|nude|nsfw|hentai|sex\w*|erotic\w*)\b/i.test(titulo)) continue;
      por(String(ii.thumburl || ii.url || '').replace(/\?.*$/, ''), k, origem);
    }
  };
  let principal = new Set(); // a imagem do quadro do artigo (a capa), mesmo que o nome do arquivo não tenha o nome do jogo
  try { const d = await pegar('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages&piprop=name&titles=' + encodeURIComponent(q + '|' + q + ' (video game)'), { json: true, ms: 3000, init: wk }); principal = new Set((((d || {}).query || {}).pages || []).map((p) => String(p.pageimage || '').replace(/_/g, ' ')).filter(Boolean)); } catch (e) { /* sem */ }
  lerPaginas(val(art), 'Wikipédia', false);
  lerPaginas(val(com), 'Wikimedia Commons', true);
  return out;
}
export async function buscar(tipo, q) {
  q = String(q || '').trim().slice(0, 100); if (q.length < 2) return [];
  if (tipo === 'f' || tipo === 's') {
    const d = await pegar('https://v3.sg.media-imdb.com/suggestion/x/' + encodeURIComponent(q.toLowerCase()) + '.json', { json: true });
    const quer = tipo === 'f' ? ['movie', 'tvMovie'] : ['tvSeries', 'tvMiniSeries'];
    return ((d && d.d) || []).filter((x) => quer.includes(x.qid) && /^tt\d+$/.test(x.id)).slice(0, 8)
      .map((x) => ({ t: corta(x.l, 100), a: [x.y, corta(x.s, 60)].filter(Boolean).join(' · '), c: capaOk(imdbPeq(x.i && x.i.imageUrl)), u: 'https://www.imdb.com/title/' + x.id + '/' }));
  }
  if (tipo === 'j') {
    // (0.8.7) jogos: todos os que existem (de qualquer console, até os que não saíram no PC) vêm da Wikipédia (os artigos com a ficha de
    // jogo, com a capa e o ano); os da Steam juntam a capa em pé da biblioteca e a nota do Metacritic. Os que só estão na Steam vêm depois
    const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
    const [wk, st] = await Promise.allSettled([
      pegar('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrlimit=12&prop=pageimages|description&piprop=thumbnail&pithumbsize=500&pilicense=any&gsrsearch='
        + encodeURIComponent(q + ' hastemplate:"Infobox video game"'), { json: true, init: { headers: { 'User-Agent': 'AeroStream/1.0 (games search)' } } }),
      pegar('https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=' + encodeURIComponent(q), { json: true }),
    ]);
    const steam = ((st.status === 'fulfilled' && st.value && st.value.items) || []).filter((x) => x.type === 'app' && Number.isInteger(x.id))
      .map((x) => ({ n: norm(x.name), t: corta(x.name, 100), m: x.metascore ? 'Metacritic ' + x.metascore : '', c: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + x.id + '/library_600x900.jpg', u: 'https://store.steampowered.com/app/' + x.id + '/' }));
    const usados = new Set(), lista = [];
    const paginas = ((wk.status === 'fulfilled' && wk.value && wk.value.query && wk.value.query.pages) || []).sort((a, b) => a.index - b.index);
    for (const p of paginas) {
      const titulo = String(p.title || ''); if (!titulo) continue;
      const s = steam.find((x) => !usados.has(x) && x.n === norm(titulo)); if (s) usados.add(s);
      const ano = (String(p.description || '').match(/\b(19|20)\d\d\b/) || [''])[0];
      const wcapa = capaOk(String((p.thumbnail && p.thumbnail.source) || '').replace(/\?.*$/, ''));
      lista.push({ t: corta(titulo.replace(/ \((\d{4} )?video game\)$/, ''), 100), a: [ano, s && s.m].filter(Boolean).join(' · ') || corta(p.description, 60),
        c: (s && s.c) || wcapa, u: s ? s.u : 'https://en.wikipedia.org/wiki/' + encodeURIComponent(titulo.replace(/ /g, '_')) });
    }
    for (const s of steam) if (!usados.has(s)) lista.push({ t: s.t, a: s.m, c: s.c, u: s.u });
    return lista.slice(0, 12);
  }
  if (tipo === 'jgi') { try { return await guardado('jgi1:' + encodeURIComponent(q.toLowerCase()), 21600, () => imagensDoJogo(q)); } catch (e) { return imagensDoJogo(q); } }
  if (tipo === 'jg') { try { return await guardado('jg2:' + encodeURIComponent(q.toLowerCase()), 21600, () => buscarJogoAtividade(q)); } catch (e) { return buscarJogoAtividade(q); } }
  if (tipo === 'a') {
    // (0.8.7) AniList primeiro; se ele não responder (ou bloquear o servidor), o Kitsu
    try {
      const d = await pegar('https://graphql.anilist.co', { json: true, init: { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: 'query($q:String){Page(perPage:8){media(search:$q,type:ANIME,isAdult:false){title{romaji english} seasonYear format coverImage{large} siteUrl}}}', variables: { q } }) } });
      const l = ((((d || {}).data || {}).Page || {}).media || []).map((x) => ({ t: corta(x.title.english || x.title.romaji, 100), a: [x.seasonYear, x.format].filter(Boolean).join(' · '), c: capaOk(x.coverImage && x.coverImage.large), u: String(x.siteUrl || '').slice(0, 200) }));
      if (l.length) return l;
    } catch (_) { /* tenta o Kitsu */ }
    const k = await pegar('https://kitsu.io/api/edge/anime?page%5Blimit%5D=8&filter%5Btext%5D=' + encodeURIComponent(q), { json: true, init: { headers: { Accept: 'application/vnd.api+json' } } });
    return ((k && k.data) || []).filter((x) => x && x.attributes && /^\d+$/.test(String(x.id))).map((x) => { const a = x.attributes, ti = a.titles || {};
      return { t: corta(ti.en || a.canonicalTitle || ti.en_jp, 100), a: [String(a.startDate || '').slice(0, 4), String(a.subtype || '').toUpperCase()].filter(Boolean).join(' · '), c: capaOk(String((a.posterImage && (a.posterImage.medium || a.posterImage.small)) || '')), u: 'https://kitsu.app/anime/' + x.id }; });
  }
  if (tipo === 'g') {
    // (1.0.3) mangás: AniList (mangá, one-shot e novel), e o Kitsu se ele não responder
    try {
      const d = await pegar('https://graphql.anilist.co', { json: true, init: { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: 'query($q:String){Page(perPage:10){media(search:$q,type:MANGA,isAdult:false){title{romaji english} startDate{year} format staff(perPage:1){nodes{name{full}}} coverImage{large} siteUrl}}}', variables: { q } }) } });
      const l = ((((d || {}).data || {}).Page || {}).media || []).map((x) => ({ t: corta(x.title.english || x.title.romaji, 100), a: [x.startDate && x.startDate.year, corta(((((x.staff || {}).nodes || [])[0] || {}).name || {}).full, 40)].filter(Boolean).join(' · '), c: capaOk(x.coverImage && x.coverImage.large), u: String(x.siteUrl || '').slice(0, 200) }));
      if (l.length) return l;
    } catch (_) { /* tenta o Kitsu */ }
    const k = await pegar('https://kitsu.io/api/edge/manga?page%5Blimit%5D=10&filter%5Btext%5D=' + encodeURIComponent(q), { json: true, init: { headers: { Accept: 'application/vnd.api+json' } } });
    return ((k && k.data) || []).filter((x) => x && x.attributes && /^\d+$/.test(String(x.id))).map((x) => { const a = x.attributes, ti = a.titles || {};
      return { t: corta(ti.en || a.canonicalTitle || ti.en_jp, 100), a: [String(a.startDate || '').slice(0, 4), String(a.subtype || '').toUpperCase()].filter(Boolean).join(' · '), c: capaOk(String((a.posterImage && (a.posterImage.medium || a.posterImage.small)) || '')), u: 'https://kitsu.app/manga/' + x.id }; });
  }
  if (tipo === 'h') {
    // (1.0.3) HQs: as séries e revistas da Wikipédia (artigos com a ficha de quadrinho, com capa) e os encadernados do Google Livros
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
    const wiki = (busca, n) => pegar('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrlimit=' + n + '&prop=pageimages|description&piprop=thumbnail&pithumbsize=500&pilicense=any&gsrsearch='
      + encodeURIComponent(busca), { json: true, init: { headers: { 'User-Agent': 'AeroStream/1.0 (comics search)' } } });
    const [wd, wk, gb] = await Promise.allSettled([
      wiki(q + ' comic', 6), // a obra com o nome exato (Watchmen, Sandman): a ficha dela nem sempre é a de "série"
      wiki(q + ' hastemplate:"Infobox comic book title"', 8),
      pegar('https://www.googleapis.com/books/v1/volumes?maxResults=10&printType=books&q=' + encodeURIComponent(q + ' subject:comics'), { json: true }),
    ]);
    const lista = [], vistos = new Set();
    const por = (x) => { const k = norm(x.t); if (!x.t || vistos.has(k)) return; vistos.add(k); lista.push(x); };
    const paginas = (r) => ((r.status === 'fulfilled' && r.value && r.value.query && r.value.query.pages) || []).sort((a, b) => a.index - b.index);
    const ehHq = (p) => /comic|graphic novel|manga|manhwa|bande dessin|fumetti|quadrinh|cartoon|strip|limited series/i.test(String(p.description || ''));
    for (const p of [...paginas(wd).filter(ehHq), ...paginas(wk)]) {
      const titulo = String(p.title || ''); if (!titulo) continue;
      por({ t: corta(titulo.replace(/ \((comics?|comic book|magazine)\)$/i, ''), 100), a: corta(p.description, 60), c: capaOk(String((p.thumbnail && p.thumbnail.source) || '').replace(/\?.*$/, '')), u: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(titulo.replace(/ /g, '_')) });
    }
    for (const x of (gb.status === 'fulfilled' && gb.value && gb.value.items) || []) {
      const v = x.volumeInfo || {}; if (!/^[\w-]{6,20}$/.test(String(x.id))) continue;
      const cp = String((v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || '').replace(/^http:/, 'https:').replace(/&edge=curl/, '');
      por({ t: corta(v.title + (v.subtitle ? ': ' + v.subtitle : ''), 100), a: [String(v.publishedDate || '').slice(0, 4), corta((v.authors || []).slice(0, 2).join(', '), 60)].filter(Boolean).join(' · '), c: capaOk(cp), u: 'https://books.google.com/books?id=' + x.id });
    }
    return lista.sort((a, b) => (b.c ? 1 : 0) - (a.c ? 1 : 0)).slice(0, 12);
  }
  if (tipo === 'b') {
    // (0.9.0) livros: a Open Library (até os mais nichados, de qualquer língua) e o Google Books juntos, sem repetir o mesmo livro
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    const isbn = q.replace(/[-\s]/g, ''), ehIsbn = /^(97[89])?\d{9}[\dx]$/i.test(isbn);
    const [ol, gb] = await Promise.allSettled([
      pegar('https://openlibrary.org/search.json?limit=10&fields=key,title,author_name,first_publish_year,cover_i&' + (ehIsbn ? 'isbn=' + isbn : 'q=' + encodeURIComponent(q)), { json: true, init: { headers: { 'User-Agent': 'AeroStream/1.0 (books search)' } } }),
      pegar('https://www.googleapis.com/books/v1/volumes?maxResults=10&printType=books&q=' + encodeURIComponent(ehIsbn ? 'isbn:' + isbn : q), { json: true }),
    ]);
    const lista = [], vistos = new Set();
    const por = (x) => { const k = norm(x.t) + '|' + norm(x.a).slice(0, 12); if (!x.t || vistos.has(k)) return; vistos.add(k); lista.push(x); };
    for (const x of (ol.status === 'fulfilled' && ol.value && ol.value.docs) || []) {
      if (!/^\/works\/OL\d+W$/.test(String(x.key))) continue;
      por({ t: corta(x.title, 100), a: [x.first_publish_year, corta((x.author_name || []).slice(0, 2).join(', '), 60)].filter(Boolean).join(' · '),
        c: Number.isInteger(x.cover_i) ? 'https://covers.openlibrary.org/b/id/' + x.cover_i + '-M.jpg' : '', u: 'https://openlibrary.org' + x.key });
    }
    for (const x of (gb.status === 'fulfilled' && gb.value && gb.value.items) || []) {
      const v = x.volumeInfo || {}; if (!/^[\w-]{6,20}$/.test(String(x.id))) continue;
      const cp = String((v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || '').replace(/^http:/, 'https:').replace(/&edge=curl/, '');
      por({ t: corta(v.title + (v.subtitle ? ': ' + v.subtitle : ''), 100), a: [String(v.publishedDate || '').slice(0, 4), corta((v.authors || []).slice(0, 2).join(', '), 60)].filter(Boolean).join(' · '),
        c: capaOk(cp), u: 'https://books.google.com/books?id=' + x.id });
    }
    // os que têm capa primeiro
    return lista.sort((a, b) => (b.c ? 1 : 0) - (a.c ? 1 : 0)).slice(0, 12);
  }
  if (tipo === 'm' || tipo === 'l' || tipo === 'mu') {
    const d = await pegar('https://api.deezer.com/search' + (tipo === 'l' ? '/album' : '') + '?limit=8&q=' + encodeURIComponent(q), { json: true });
    const lista = ((d && d.data) || []).filter((x) => x.readable !== false).map((x) => tipo === 'l'
      ? { t: corta(x.title, 100), a: corta(x.artist && x.artist.name, 60), c: capaOk(x.cover_medium), u: 'https://www.deezer.com/album/' + x.id, f: 'deezer' }
      : { t: corta(x.title, 100), a: corta(x.artist && x.artist.name, 60), c: capaOk(x.album && x.album.cover_medium), u: 'https://www.deezer.com/track/' + x.id, f: 'deezer', id: String(x.id) });
    if (tipo !== 'mu') return lista;
    const yt = await ytBuscar(q, 4).catch(() => []);
    return [...lista.slice(0, 6), ...yt.map((v) => ({ t: v.t, a: v.a, c: 'https://i.ytimg.com/vi/' + v.v + '/mqdefault.jpg', u: 'https://music.youtube.com/watch?v=' + v.v, f: 'youtube', v: v.v }))];
  }
  return [];
}

// ---------- YouTube: busca de vídeos (a página pública de resultados) ----------
export async function ytBuscar(q, n = 3) {
  const out = [];
  const andar = (o) => {
    if (out.length >= n || !o || typeof o !== 'object') return;
    if (o.videoRenderer && /^[A-Za-z0-9_-]{11}$/.test(o.videoRenderer.videoId || '')) {
      const v = o.videoRenderer, tx = (x) => (x && (x.simpleText || (x.runs || []).map((r) => r.text).join(''))) || '';
      if (!out.some((x) => x.v === v.videoId)) out.push({ v: v.videoId, t: corta(tx(v.title), 140), a: corta(tx(v.ownerText || v.longBylineText), 80) }); return;
    }
    for (const k in o) andar(o[k]);
  };
  // (0.9.3) dos servidores da Cloudflare o YouTube às vezes manda a página de consentimento (ou demora): vai com o "aceito" dos cookies,
  // com mais tempo, e se a página não trouxer nada pergunta pela API da própria página do YouTube
  const ck = { headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI', 'Accept-Language': 'en-US,en;q=0.8' } };
  try {
    const t = await pegar('https://www.youtube.com/results?hl=en&gl=US&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q), { init: ck, ms: 8000 });
    const m = /(?:var ytInitialData|window\["ytInitialData"\]) = (\{.*?\});<\/script>/s.exec(t);
    if (m) andar(JSON.parse(m[1]));
  } catch (_) { /* tenta pela API */ }
  if (!out.length) {
    try {
      const d = await pegar('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', { json: true, ms: 8000, init: { method: 'POST', headers: { ...ck.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' } }, query: q, params: 'EgIQAQ==' }) } });
      andar(d);
    } catch (_) { /* sem resultado */ }
  }
  return out;
}
export async function ytInfo(v) {
  try { const d = await pegar('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v), { json: true, ms: 4000 }); return { t: corta(d.title, 140), a: corta(d.author_name, 80) }; } catch (e) { return e.status === 401 || e.status === 403 || e.status === 404 ? null : { t: '', a: '' }; }
}

// ---------- links: Spotify, Deezer, YouTube / YouTube Music ----------
// devolve { t, a, c, u, f (fonte), k ('m' música ou 'l' álbum), v? (vídeo do YouTube), id? }
export async function link(url) {
  url = String(url || '').trim().slice(0, 300);
  let m = /^https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z-]+\/)?(track|album)\/([A-Za-z0-9]{22})/.exec(url);
  if (m) {
    const [, tipo, id] = m;
    return guardado('sp/' + tipo + '/' + id, 86400, async () => {
      const [emb, oe] = await Promise.all([pegar('https://open.spotify.com/embed/' + tipo + '/' + id).catch(() => ''), pegar('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/' + tipo + '/' + id), { json: true }).catch(() => ({}))]);
      const art = /"artists":\[(.*?)\]/.exec(emb), nomes = art ? [...art[1].matchAll(/"name":"([^"]{1,80})"/g)].map((x) => x[1]).slice(0, 3).join(', ') : '';
      const tit = (/"title":"([^"]{1,140})"/.exec(emb) || [])[1] || oe.title || '';
      if (!tit) throw new Error('spotify');
      const js = (x) => { try { return JSON.parse('"' + x + '"'); } catch (_) { return x; } };
      return { t: corta(js(tit), 140), a: corta(js(nomes), 80), c: capaOk(oe.thumbnail_url), u: 'https://open.spotify.com/' + tipo + '/' + id, f: 'spotify', k: tipo === 'album' ? 'l' : 'm' };
    });
  }
  if (/^https?:\/\/(link\.deezer\.com|deezer\.page\.link)\//.test(url)) { // link curto do app do Deezer: segue até o link de verdade
    const r = await fetch(url, { redirect: 'follow', headers: UA }); url = r.url || '';
  }
  m = /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?(track|album)\/(\d{1,15})/.exec(url);
  if (m) {
    const d = await pegar('https://api.deezer.com/' + m[1] + '/' + m[2], { json: true });
    if (!d || d.error) throw new Error('deezer');
    return m[1] === 'album' ? { t: corta(d.title, 140), a: corta(d.artist && d.artist.name, 80), c: capaOk(d.cover_medium), u: 'https://www.deezer.com/album/' + m[2], f: 'deezer', k: 'l' }
      : { t: corta(d.title, 140), a: corta(d.artist && d.artist.name, 80), c: capaOk(d.album && d.album.cover_medium), u: 'https://www.deezer.com/track/' + m[2], f: 'deezer', k: 'm', id: m[2] };
  }
  m = /^https?:\/\/(?:music\.|www\.|m\.)?youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/.exec(url) || /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/.exec(url);
  if (m) {
    const inf = await ytInfo(m[1]); if (!inf) throw new Error('youtube');
    return { t: inf.t, a: inf.a.replace(/ - Topic$/, ''), c: 'https://i.ytimg.com/vi/' + m[1] + '/mqdefault.jpg', u: 'https://music.youtube.com/watch?v=' + m[1], f: /music\.youtube/.test(url) ? 'ytmusic' : 'youtube', k: 'm', v: m[1] };
  }
  m = /^https?:\/\/music\.youtube\.com\/(?:playlist\?list=|browse\/)([A-Za-z0-9_-]{10,60})/.exec(url);
  if (m) { // álbum do YouTube Music: o nome e a capa vêm da página pública
    const t = await pegar('https://music.youtube.com/playlist?list=' + m[1]).catch(() => '');
    const tit = (/<meta property="og:title" content="([^"]+)"/.exec(t) || [])[1], img = (/<meta property="og:image" content="([^"]+)"/.exec(t) || [])[1];
    if (!tit) throw new Error('ytmusic');
    return { t: corta(tit, 140), a: '', c: capaOk(ent(img)), u: 'https://music.youtube.com/playlist?list=' + m[1], f: 'ytmusic', k: 'l' };
  }
  m = /^https?:\/\/(?:www\.)?letterboxd\.com\/(?:[a-z0-9_]{2,15}\/)?film\/([a-z0-9-]{1,120})/.exec(url);
  if (m) { // (0.8.7) um filme do Letterboxd (a página do filme é aberta; o perfil não)
    const slug = m[1];
    return guardado('lbf/' + slug, 2592000, async () => {
      const t = await pegar('https://letterboxd.com/film/' + slug + '/');
      const tit = (/<meta property="og:title" content="([^"]+)"/.exec(t) || [])[1] || '';
      if (!tit) throw new Error('letterboxd');
      const nome = ent(tit), ano = /\((\d{4})\)$/.exec(nome), img = (/"image":"(https:\/\/a\.ltrbxd\.com\/[^"]+)"/.exec(t) || [])[1] || '';
      return { t: nome.replace(/\s*\(\d{4}\)$/, '').slice(0, 100), a: ano ? ano[1] : '', c: capaOk(img.replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop')), u: 'https://letterboxd.com/film/' + slug + '/', f: 'letterboxd', k: 'f' };
    });
  }
  throw new Error('link');
}
// uma música de qualquer lugar vira um vídeo do YouTube para tocar (sem bot e sem Premium: cada aparelho toca o vídeo)
export async function paraTocar(x) {
  if (x.v) return x;
  const nome = [x.a, x.t].filter(Boolean).join(' ');
  // (1.0.0) a música já achada antes fica guardada por 30 dias: menos buscas no YouTube, que bloqueia o servidor por um tempo quando são muitas
  const k = new Request('https://cache.aero/pt/' + encodeURIComponent(nome.toLowerCase().slice(0, 160))), c = cache();
  try { const ja = await c.match(k); if (ja) { const d = await ja.json(); if (d && /^[A-Za-z0-9_-]{11}$/.test(d.v || '')) return { ...x, v: d.v }; } } catch (_) { /* sem cache */ }
  let yt = await ytBuscar(nome + ' audio', 4);
  if (!yt.length) yt = await ytBuscar(nome, 4); // (0.9.3) sem o "audio" também
  // (0.9.3) o primeiro que pode tocar fora do YouTube (alguns vídeos oficiais não deixam)
  for (const y of yt) if (await ytInfo(y.v)) { try { await c.put(k, new Response(JSON.stringify({ v: y.v }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=2592000' } })); } catch (_) { /* ok */ } return { ...x, v: y.v }; }
  return null;
}

// ---------- Letterboxd ----------
const posterLb = (slug) => guardado('lbp/' + slug, 2592000, async () => {
  const t = await pegar('https://letterboxd.com/film/' + slug + '/').catch(() => '');
  const u = (/"image":"(https:\/\/a\.ltrbxd\.com\/[^"]+)"/.exec(t) || [])[1] || '';
  return { c: capaOk(u.replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop')) };
}).then((x) => x.c).catch(() => '');
const filmesDaGrade = (html, n) => {
  const out = [];
  for (const m of html.matchAll(/<(?:div|li)[^>]*data-(?:item|film)-slug="[^"]*"[^>]*>|<(?:div|li)[^>]*data-(?:item|film)-name="[^"]*"[^>]*>/g)) {
    const at = (n) => (new RegExp('data-(?:item|film)-' + n + '="([^"]+)"').exec(m[0]) || [])[1] || '';
    const slug = at('slug').replace(/^\/?film\//, '').replace(/\/$/, ''), nome0 = at('name') || ent(((/alt="([^"]+)"/.exec(html.slice(m.index, m.index + 600))) || [])[1] || '');
    if (!/^[a-z0-9-]{1,120}$/.test(slug) || !nome0 || out.some((f) => f.s === slug)) continue;
    const nome = ent(nome0), ano = /\((\d{4})\)$/.exec(nome);
    out.push({ s: slug, t: nome.replace(/\s*\(\d{4}\)$/, '').slice(0, 100), a: ano ? ano[1] : '' });
    if (out.length >= n) break;
  }
  return out;
};
// (0.8.7) o Letterboxd fecha as páginas de perfil para servidores (desafio do Cloudflare): o que vier é usado, e o RSS (aberto) dá os
// vistos por último e os curtidos entre eles. Os favoritos que a pessoa escolhe no editor (lbf) valem mais que os da página.
// Resposta vazia não fica guardada (tenta de novo na próxima vez)
const lbVazio = (d) => !d.favs.length && !d.recentes.length && !d.curtidos.length;
export async function letterboxd(u) {
  const k = new Request('https://cache.aero/lb3/' + u), c = cache();
  const ja = await c.match(k); if (ja) return ja.json();
  const [perfil, rss, curt] = await Promise.all([
    pegar('https://letterboxd.com/' + u + '/').catch(() => ''),
    pegar('https://letterboxd.com/' + u + '/rss/').catch((e) => { if (e.status === 404) throw Object.assign(new Error('Esse usuário não existe no Letterboxd.'), { status: 404 }); return ''; }),
    pegar('https://letterboxd.com/' + u + '/likes/films/').catch(() => '')]);
  const i = perfil.indexOf('id="favourites"'), sec = i >= 0 ? perfil.slice(i, perfil.indexOf('</section>', i)) : '';
  const favs = filmesDaGrade(sec, 4);
  let curtidos = filmesDaGrade(curt, 12);
  const tag = (b, n) => ent((new RegExp('<' + n + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</' + n + '>').exec(b) || [])[1] || '');
  const recentes = [];
  for (const m of rss.slice(0, 400000).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1], nome = tag(b, 'letterboxd:filmTitle'); if (!nome) continue;
    const nota = parseFloat(tag(b, 'letterboxd:memberRating')), img = (/<img src="([^"]+)"/.exec(ent(tag(b, 'description'))) || [])[1] || '';
    const lk = (/<link>https:\/\/letterboxd\.com\/[a-z0-9_]+\/film\/([a-z0-9-]{1,120})\//.exec(b) || [])[1] || '';
    recentes.push({ s: lk, t: nome.slice(0, 100), a: tag(b, 'letterboxd:filmYear').slice(0, 4), n: nota > 0 && nota <= 5 ? nota : 0, d: tag(b, 'letterboxd:watchedDate').slice(0, 10), r: tag(b, 'letterboxd:rewatch') === 'Yes', l: tag(b, 'letterboxd:memberLike') === 'Yes', c: capaOk(img.replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop')) });
    if (recentes.length >= 30) break;
  }
  if (!curtidos.length) curtidos = recentes.filter((f) => f.l).slice(0, 12);
  // as capas dos favoritos e dos curtidos vêm da página de cada filme (guardadas 30 dias)
  await Promise.all([...favs, ...curtidos].filter((f) => !f.c && f.s).map(async (f) => { f.c = await posterLb(f.s); }));
  const notas = recentes.filter((f) => f.n);
  const d = { u, favs, curtidos, recentes: recentes.slice(0, 12), media: notas.length ? Math.round(notas.reduce((a, f) => a + f.n, 0) / notas.length * 10) / 10 : 0 };
  if (!lbVazio(d)) await c.put(k, new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=1800' } }));
  return d;
}

// (0.9.5) vídeo de post do X: o vídeo do X recusa quem chega vindo de outro site, então ele passa por aqui (só de video.twimg.com, só .mp4,
// em pedaços: o player pede a parte que vai tocar). De quebra, o aparelho de quem assiste não fala com o X
const TW_VIDEO = /^https:\/\/video\.twimg\.com\/[A-Za-z0-9_\-\/]+\.mp4(\?tag=\d{1,3})?$/;
export async function twVideo(request, u, env) {
  if (typeof u !== 'string' || u.length > 400 || !TW_VIDEO.test(u)) return new Response('', { status: 404 });
  if (!(await limiteIp(env, request, 'tw'))) return MUITOS();
  const range = request.headers.get('Range');
  const r = await buscarSoPermitidos(u, (x) => x.length <= 400 && TW_VIDEO.test(x), { headers: range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {} });
  if (!(r.status === 200 || r.status === 206) || !/^video\/mp4/.test(r.headers.get('Content-Type') || '')) return new Response('', { status: 404 });
  const cab = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
  for (const k of ['Content-Length', 'Content-Range']) { const v = r.headers.get(k); if (v) cab.set(k, v); }
  return new Response(r.body, { status: r.status, headers: cab });
}
