// (1.0.3) Cartões do Roblox no chat: jogo, perfil, item (e pacote) e comunidade. Criado por Ryan Victtor.
// Tudo pelas APIs públicas do Roblox (sem login), em paralelo e com tempo-limite; as imagens são do tr.rbxcdn.com e passam pelo Aero.
import { txt } from './util.js';

const num = (x) => (x != null && x !== '' && Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : null);
const imgRb = (u) => (typeof u === 'string' && /^https:\/\/(?:tr|t\d)\.rbxcdn\.com\/[^\s"'<>]{1,300}$/.test(u) ? u : '');
const data = (x) => { const t = Date.parse(x); return Number.isFinite(t) ? t : 0; };

export const RE_ROBLOX = /^https?:\/\/(?:www\.|web\.)?roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(games|users|catalog|bundles|groups|communities)\/(\d{1,20})/i;

// (1.0.6) o Roblox às vezes recusa (429) os pedidos que saem da Cloudflare: tenta de novo pelo espelho roproxy (mesmas APIs) e, se
// ainda falhar, mais uma vez no endereço de sempre. Antes uma recusa no nome bastava para o cartão de perfil não aparecer
async function pega1(url, op) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { ...op, headers: { 'User-Agent': 'AeroStream-embed/1.0', Accept: 'application/json', ...(op.headers || {}) }, signal: ctl.signal });
    if (r.ok) return { j: await r.json() };
    return { de_novo: r.status === 429 || r.status >= 500 };
  } catch (_) { return { de_novo: true }; } finally { clearTimeout(t); }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function pega(url, op = {}) {
  let r = await pega1(url, op); if (r.j || !r.de_novo) return r.j || null;
  const espelho = url.replace(/^https:\/\/([a-z]+)\.roblox\.com\//, 'https://$1.roproxy.com/');
  if (espelho !== url) { await espera(250); r = await pega1(espelho, op); if (r.j) return r.j; }
  await espera(700); r = await pega1(url, op); return r.j || null;
}
const post = (url, corpo) => pega(url, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
const miniaturas = async (tipo, ids, tam, extra = '') => {
  if (!ids.length) return {};
  const j = await pega(`https://thumbnails.roblox.com/v1/${tipo}?${tipo.includes('games/') ? 'universeIds' : tipo.startsWith('users') ? 'userIds' : tipo.startsWith('groups') ? 'groupIds' : tipo.startsWith('badges') ? 'badgeIds' : tipo.startsWith('bundles') ? 'bundleIds' : 'assetIds'}=${ids.join(',')}&size=${tam}&format=Png${extra}`);
  const o = {}; for (const x of (j && j.data) || []) { const u = imgRb(x.imageUrl); if (u) o[x.targetId] = u; } return o;
};
const criador = (c) => (c ? { nome: txt(c.name || c.Name || c.username || '', 60), id: num(c.id || c.Id || c.CreatorTargetId || c.userId), grupo: /group/i.test(c.type || c.CreatorType || ''), ok: !!(c.hasVerifiedBadge || c.HasVerifiedBadge) } : null);

// ---------- jogo ----------
async function jogo(placeId) {
  const un = await pega(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  const U = num(un && un.universeId); if (!U) return null;
  const [gs, votos, midia, badges, fotos, icone, idade, eventos] = await Promise.all([
    pega(`https://games.roblox.com/v1/games?universeIds=${U}`),
    pega(`https://games.roblox.com/v1/games/votes?universeIds=${U}`),
    pega(`https://games.roblox.com/v2/games/${U}/media`),
    pega(`https://badges.roblox.com/v1/universes/${U}/badges?limit=10&sortOrder=Desc`),
    pega(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${U}&countPerUniverse=10&size=768x432&format=Png&defaults=false`),
    miniaturas('games/icons', [U], '256x256'),
    post('https://apis.roblox.com/experience-guidelines-api/experience-guidelines/get-age-recommendation', { universeId: U }),
    pega(`https://apis.roblox.com/virtual-events/v1/universes/${U}/virtual-events?limit=5`),
  ]);
  const g = gs && gs.data && gs.data[0]; if (!g) return null;
  const v = (votos && votos.data && votos.data[0]) || {};
  const root = num(g.rootPlaceId) || placeId;
  const d = { tipo: 'roblox-jogo', url: `https://www.roblox.com/games/${root}`, placeId: root, nome: txt(g.name || '', 120), texto: txt(g.description || '', 1500),
    dono: criador(g.creator), ativos: num(g.playing), visitas: num(g.visits), max: num(g.maxPlayers), favoritos: num(g.favoritedCount),
    likes: num(v.upVotes), dislikes: num(v.downVotes), criado: data(g.created), atualizado: data(g.updated),
    genero: txt(g.genre_l1 || (g.genre && g.genre !== 'All' ? g.genre : '') || '', 60), subgenero: txt(g.genre_l2 || '', 60), icone: icone[U] || '' };
  const ar = idade && idade.ageRecommendationDetails && idade.ageRecommendationDetails.summary && idade.ageRecommendationDetails.summary.ageRecommendation;
  if (ar) d.maturidade = { nome: txt(ar.displayName || '', 30), idade: num(ar.minimumAge) || 0 };
  const f = (fotos && fotos.data && fotos.data[0] && fotos.data[0].thumbnails) || [];
  d.fotos = f.map((x) => imgRb(x.imageUrl)).filter(Boolean).slice(0, 10);
  d.videos = ((midia && midia.data) || []).filter((m) => m.assetType === 'YouTubeVideo' && /^[A-Za-z0-9_-]{11}$/.test(m.videoHash || '')).slice(0, 4).map((m) => ({ yt: m.videoHash, titulo: txt(m.videoTitle || '', 100) }));
  const agora = Date.now();
  d.eventos = ((eventos && eventos.data) || []).map((e) => ({ titulo: txt(e.displayTitle || e.title || '', 100), ini: data(e.eventTime && e.eventTime.startUtc), fim: data(e.eventTime && e.eventTime.endUtc) }))
    .filter((e) => e.titulo && e.fim > agora).slice(0, 3);
  const bl = ((badges && badges.data) || []).filter((b) => b && b.enabled !== false).slice(0, 10);
  const bic = await miniaturas('badges/icons', bl.map((b) => b.iconImageId ? b.id : b.id), '150x150');
  d.badges = bl.map((b) => ({ nome: txt(b.displayName || b.name || '', 60), desc: txt(b.displayDescription || b.description || '', 140), icone: bic[b.id] || '', ganhos: num(b.statistics && b.statistics.awardedCount), taxa: b.statistics && Number.isFinite(+b.statistics.winRatePercentage) ? Math.round(+b.statistics.winRatePercentage * 1000) / 10 : null }));
  return d;
}

// ---------- perfil ----------
async function perfil(id) {
  let [u, cab, corpo, seg, sgn, ami, vestindo, fundo] = await Promise.all([
    pega(`https://users.roblox.com/v1/users/${id}`),
    miniaturas('users/avatar-headshot', [id], '150x150'),
    miniaturas('users/avatar', [id], '420x420'),
    pega(`https://friends.roblox.com/v1/users/${id}/followers/count`),
    pega(`https://friends.roblox.com/v1/users/${id}/followings/count`),
    pega(`https://friends.roblox.com/v1/users/${id}/friends/count`),
    pega(`https://avatar.roblox.com/v1/users/${id}/currently-wearing`),
    post('https://apis.roblox.com/profile-platform-api/v1/profiles/get', { profileId: String(id), profileType: 'User', components: [{ component: 'ProfileBackground' }, { component: 'UserProfileHeader' }] }),
  ]);
  // (1.0.6) sem os dados do usuário: o nome vem da busca em lote (outra rota do Roblox) e o resto fica como der
  if (!u || !u.id) {
    const l = await post('https://users.roblox.com/v1/users', { userIds: [Number(id)], excludeBannedUsers: false });
    const x = l && l.data && l.data[0]; if (!x || !x.id) return null;
    u = { id: x.id, name: x.name, displayName: x.displayName, hasVerifiedBadge: x.hasVerifiedBadge };
  }
  const d = { tipo: 'roblox-perfil', url: `https://www.roblox.com/users/${u.id}/profile`, nome: txt(u.displayName || u.name || '', 40), nick: txt(u.name || '', 40), ok: !!u.hasVerifiedBadge,
    banido: !!u.isBanned, bio: txt(u.description || '', 600), criado: data(u.created), rosto: cab[id] || '', corpo: corpo[id] || '',
    seguidores: num(seg && seg.count), seguindo: num(sgn && sgn.count), amigos: num(ami && ami.count) };
  const comp = (fundo && fundo.components) || {};
  if (comp.UserProfileHeader && comp.UserProfileHeader.isPremium) d.premium = true;
  const fid = num(comp.ProfileBackground && comp.ProfileBackground.assetId);
  if (fid) { const t = await miniaturas('assets', [fid], '768x432'); if (t[fid]) d.fundo = t[fid]; }
  const ids = ((vestindo && vestindo.assetIds) || []).map(num).filter(Boolean).slice(0, 12);
  if (ids.length) {
    const [fotos, det] = await Promise.all([miniaturas('assets', ids, '150x150'), detalhesCatalogo(ids)]);
    d.itens = ids.map((i) => ({ id: i, nome: (det[i] && det[i].name) || '', foto: fotos[i] || '', url: `https://www.roblox.com/catalog/${i}` })).filter((x) => x.foto);
  }
  return d;
}
// nomes de vários itens de uma vez (o catálogo pede o token anti-CSRF, que ele mesmo entrega na primeira resposta)
async function detalhesCatalogo(ids) {
  const url = 'https://catalog.roblox.com/v1/catalog/items/details', corpo = JSON.stringify({ items: ids.map((id) => ({ itemType: 'Asset', id })) });
  try {
    let r = await fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json', 'User-Agent': 'AeroStream-embed/1.0' } });
    const tk = r.headers.get('x-csrf-token');
    if (r.status === 403 && tk) r = await fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json', 'User-Agent': 'AeroStream-embed/1.0', 'x-csrf-token': tk } });
    const j = r.ok ? await r.json() : null, o = {};
    for (const x of (j && j.data) || []) o[x.id] = { name: txt(x.name || '', 80), fav: num(x.favoriteCount) };
    return o;
  } catch (_) { return {}; }
}

// ---------- item e pacote ----------
const TIPOS = { 2: ['Camiseta', 'T-Shirt'], 8: ['Chapéu', 'Hat'], 11: ['Camisa', 'Shirt'], 12: ['Calça', 'Pants'], 17: ['Cabeça', 'Head'], 18: ['Rosto', 'Face'], 19: ['Equipamento', 'Gear'], 41: ['Cabelo', 'Hair'], 42: ['Acessório de rosto', 'Face accessory'], 43: ['Acessório de pescoço', 'Neck accessory'], 44: ['Acessório de ombro', 'Shoulder accessory'], 45: ['Acessório da frente', 'Front accessory'], 46: ['Acessório das costas', 'Back accessory'], 47: ['Acessório da cintura', 'Waist accessory'], 48: ['Animação de escalar', 'Climb animation'], 61: ['Emote', 'Emote'], 64: ['Camiseta 3D', 'T-Shirt accessory'], 65: ['Camisa 3D', 'Shirt accessory'], 66: ['Calça 3D', 'Pants accessory'], 67: ['Jaqueta', 'Jacket'], 68: ['Suéter', 'Sweater'], 69: ['Shorts', 'Shorts'], 70: ['Sapato esquerdo', 'Left shoe'], 71: ['Sapato direito', 'Right shoe'], 72: ['Vestido/saia', 'Dress/skirt'], 76: ['Cílios', 'Eyelashes'], 77: ['Sobrancelhas', 'Eyebrows'], 79: ['Cabeça dinâmica', 'Dynamic head'] };
async function item(id) {
  const [e, fav, foto] = await Promise.all([
    pega(`https://economy.roblox.com/v2/assets/${id}/details`),
    pega(`https://catalog.roblox.com/v1/favorites/assets/${id}/count`),
    miniaturas('assets', [id], '420x420'),
  ]);
  if (!e || !e.Name) return null;
  const col = e.CollectiblesItemDetails || {}, limitado = !!(e.IsLimited || e.IsLimitedUnique || col.IsLimited);
  const t = TIPOS[e.AssetTypeId];
  return { tipo: 'roblox-item', url: `https://www.roblox.com/catalog/${id}`, nome: txt(e.Name, 100), texto: txt(e.Description || '', 600), dono: criador(e.Creator),
    tipoItem: t ? t[0] : '', tipoItemEn: t ? t[1] : '', criado: data(e.Created), atualizado: data(e.Updated), foto: foto[id] || '',
    preco: e.IsForSale ? num(e.PriceInRobux) : null, gratis: !!(e.IsForSale && !num(e.PriceInRobux)), aVenda: !!e.IsForSale,
    revenda: num(col.CollectibleLowestResalePrice), limitado, unico: !!e.IsLimitedUnique, trocavel: limitado, total: num(col.TotalQuantity), restam: num(e.Remaining),
    favoritos: typeof fav === 'number' ? num(fav) : null, vendas: num(e.Sales) || null };
}
async function pacote(id) {
  const [b, foto] = await Promise.all([pega(`https://catalog.roblox.com/v1/bundles/${id}/details`), miniaturas('bundles/thumbnails', [id], '420x420')]);
  if (!b || !b.name) return null;
  const p = b.product || {}, c = b.collectibleItemDetail || {};
  const ids = (b.items || []).filter((x) => x.type === 'Asset').map((x) => num(x.id)).filter(Boolean).slice(0, 8);
  const mini = await miniaturas('assets', ids, '150x150');
  return { tipo: 'roblox-item', pacote: true, url: `https://www.roblox.com/bundles/${id}`, nome: txt(b.name, 100), texto: txt(b.description || '', 600), dono: criador(b.creator),
    tipoItem: 'Pacote', tipoItemEn: 'Bundle', foto: foto[id] || '', aVenda: !!p.isForSale, preco: p.isForSale ? num(p.priceInRobux != null ? p.priceInRobux : c.price) : null, gratis: !!p.isFree,
    limitado: c.collectibleItemType === 'Limited', trocavel: c.collectibleItemType === 'Limited', total: num(c.totalQuantity) || null, restam: num(c.unitsAvailable) || null,
    pecas: (b.items || []).filter((x) => x.type === 'Asset').slice(0, 8).map((x) => ({ nome: txt(x.name || '', 80), foto: mini[x.id] || '' })).filter((x) => x.foto) };
}

// ---------- comunidade ----------
async function grupo(id) {
  const [g, ic, jogos] = await Promise.all([
    pega(`https://groups.roblox.com/v1/groups/${id}`),
    miniaturas('groups/icons', [id], '420x420'),
    pega(`https://games.roblox.com/v2/groups/${id}/gamesV2?accessFilter=Public&limit=10&sortOrder=Desc`),
  ]);
  if (!g || !g.name) return null;
  const d = { tipo: 'roblox-grupo', url: `https://www.roblox.com/communities/${id}`, nome: txt(g.name, 100), texto: txt(g.description || '', 1000), icone: ic[id] || '', ok: !!g.hasVerifiedBadge,
    membros: num(g.memberCount), dono: g.owner ? { nome: txt(g.owner.displayName || g.owner.username || '', 40), nick: txt(g.owner.username || '', 40), id: num(g.owner.userId), ok: !!g.owner.hasVerifiedBadge } : null,
    aberto: !!g.publicEntryAllowed, aviso: g.shout && g.shout.body ? txt(g.shout.body, 300) : '' };
  const js = ((jogos && jogos.data) || []).slice(0, 4);
  if (js.length) { const ics = await miniaturas('games/icons', js.map((x) => x.id), '150x150'); d.jogos = js.map((x) => ({ nome: txt(x.name || '', 80), visitas: num(x.placeVisits), icone: ics[x.id] || '', url: x.rootPlace && num(x.rootPlace.id) ? `https://www.roblox.com/games/${x.rootPlace.id}` : '' })).filter((x) => x.url).sort((a, b) => (b.visitas || 0) - (a.visitas || 0)); }
  return d;
}

export async function roblox(url) {
  const m = RE_ROBLOX.exec(url); if (!m) return null;
  const id = num(m[2]); if (!id) return null;
  const t = m[1].toLowerCase();
  if (t === 'games') return jogo(id);
  if (t === 'users') return perfil(id);
  if (t === 'catalog') return item(id);
  if (t === 'bundles') return pacote(id);
  return grupo(id);
}
