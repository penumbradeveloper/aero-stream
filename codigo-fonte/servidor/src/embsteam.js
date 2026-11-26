// (1.0.3) Cartões da Steam no chat: jogo (fotos, trailers, tags, análises, preço, desenvolvedora...) e perfil (fundo do perfil, nível,
// vitrines, jogos recentes, contagens). Criado por Ryan Victtor. Usa a API pública da loja e as páginas públicas (as mesmas do navegador).
// Os trailers e o fundo animado passam pelo /api/sv (aqui), só quando a pessoa aperta play.
import { txt } from './util.js';
import { buscarSoPermitidos, limiteIp } from './midia.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };
const COOKIE = 'birthtime=470682001; lastagecheckage=1-0-1985; wants_mature_content=1; Steam_Language=brazilian';
const num = (x) => { if (x == null || String(x).trim() === '') return null; const n = +String(x).replace(/[.,\s]/g, ''); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null; };
const IMG = /^https:\/\/(?:shared|cdn|avatars|community|store|clan)\.(?:akamai|fastly|cloudflare)\.steamstatic\.com\/[^\s"'<>]{1,300}$|^https:\/\/steamcdn-a\.akamaihd\.net\/[^\s"'<>]{1,300}$/;
const imgSt = (u) => (typeof u === 'string' && IMG.test(u = u.replace(/&amp;/g, '&')) ? u : '');
const VID = /^https:\/\/(?:shared|cdn|video)\.(?:akamai|fastly|cloudflare)\.steamstatic\.com\/[^\s"'<>?]{1,300}\.(?:mp4|webm)$/;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const ent = (s) => String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, k) => (ENT[k] != null ? ENT[k] : k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : +k.slice(1)) : m));
const limpo = (s) => ent(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function pega(url, json, extra = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { ...UA, Cookie: COOKIE, Accept: json ? 'application/json' : 'text/html', ...extra }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return null;
    return json ? await r.json() : (await r.text()).slice(0, 1500000);
  } catch (_) { return null; } finally { clearTimeout(t); }
}
const existe = async (u) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000); try { const r = await fetch(u, { method: 'HEAD', headers: UA, signal: ctl.signal }); return r.ok && /^video\//.test(r.headers.get('Content-Type') || ''); } catch (_) { return false; } finally { clearTimeout(t); } };

export const RE_STEAM = /^https?:\/\/(?:store\.steampowered\.com\/app\/(\d{1,10})|steamcommunity\.com\/app\/(\d{1,10})|steamcommunity\.com\/(id|profiles)\/([A-Za-z0-9_-]{2,64}))/i;

// ---------- jogo ----------
async function jogo(id) {
  const [ap, html] = await Promise.all([pega(`https://store.steampowered.com/api/appdetails?appids=${id}&l=brazilian&cc=br`, true), pega(`https://store.steampowered.com/app/${id}/`, false)]);
  const g = ap && ap[id] && ap[id].success && ap[id].data; if (!g || !g.name) return null;
  const d = { tipo: 'steam-jogo', id, url: `https://store.steampowered.com/app/${id}/`, nome: txt(g.name, 120), texto: txt(limpo(g.short_description), 600),
    capa: imgSt(g.header_image), fundo: imgSt(g.background_raw || g.background), gratis: !!g.is_free,
    devs: (g.developers || []).slice(0, 3).map((x) => txt(x, 60)), pubs: (g.publishers || []).slice(0, 3).map((x) => txt(x, 60)),
    generos: (g.genres || []).slice(0, 4).map((x) => txt(x.description || '', 40)).filter(Boolean),
    lancamento: txt((g.release_date && g.release_date.date) || '', 40), embreve: !!(g.release_date && g.release_date.coming_soon),
    recomendacoes: num(g.recommendations && g.recommendations.total), conquistas: num(g.achievements && g.achievements.total),
    meta: g.metacritic && num(g.metacritic.score) ? num(g.metacritic.score) : null, idade: num(g.required_age) || 0,
    plataformas: Object.entries(g.platforms || {}).filter(([, v]) => v).map(([k]) => k).filter((k) => /^(windows|mac|linux)$/.test(k)), controle: g.controller_support === 'full' ? 'total' : g.controller_support ? 'parcial' : '' };
  const p = g.price_overview;
  if (p && p.final_formatted) d.preco = { final: txt(p.final_formatted, 30), antes: p.discount_percent ? txt(p.initial_formatted || '', 30) : '', desconto: num(p.discount_percent) || 0 };
  d.fotos = (g.screenshots || []).slice(0, 20).map((s) => imgSt(s.path_full)).filter(Boolean);
  // trailers: o mp4 de 480p (leve) quando ainda existe; os mais novos da Steam são só em streaming (DASH/HLS) e ficam com o botão da loja
  const mv = (g.movies || []).slice(0, 4);
  const ok = await Promise.all(mv.map((m) => (num(m.id) ? existe(`https://cdn.akamai.steamstatic.com/steam/apps/${m.id}/movie480.mp4`) : false)));
  d.videos = mv.map((m, k) => (ok[k] ? { id: num(m.id), nome: txt(m.name || '', 100), capa: imgSt(m.thumbnail) } : null)).filter(Boolean);
  if (html) {
    const tg = /InitAppTagModal\(\s*\d+,\s*(\[[\s\S]*?\])\s*,/.exec(html);
    if (tg) { try { d.tags = JSON.parse(tg[1]).slice(0, 12).map((t) => txt(t.name || '', 40)).filter(Boolean); } catch (_) { /* sem tags */ } }
    const linhas = [...html.matchAll(/user_reviews_summary_row"[^>]*data-tooltip-html="([^"]*)"[\s\S]{0,600}?game_review_summary[^"]*"[^>]*>([^<]+)</g)];
    const av = (m) => { if (!m) return null; const t = ent(m[1]), pct = /(\d{1,3})%/.exec(t), tot = /([\d.,]+)\s+an[áa]lises|([\d.,]+)\s+user reviews/i.exec(t); return { nome: txt(ent(m[2]).trim(), 40), pct: pct ? +pct[1] : null, total: tot ? num(tot[1] || tot[2]) : null, classe: /negativ/i.test(m[2]) ? 'neg' : /neutr|mistas|mixed/i.test(m[2]) ? 'mista' : 'pos' }; };
    const recente = linhas.find((m) => /30 dias|30 days/i.test(m[1])), geral = linhas.find((m) => !/30 dias|30 days/i.test(m[1]));
    if (geral) d.analises = av(geral);
    if (recente) d.recentes = av(recente);
  }
  return d;
}

// ---------- perfil ----------
async function perfil(tipo, quem) {
  const base = `https://steamcommunity.com/${tipo}/${quem}/`;
  const html = await pega(base, false); if (!html || !/actual_persona_name/.test(html)) return null;
  const um = (re) => { const m = re.exec(html); return m ? m[1] : ''; };
  const d = { tipo: 'steam-perfil', url: base, nome: txt(ent(um(/actual_persona_name">([^<]*)/)).trim(), 64), privado: /profile_private_info/.test(html) };
  // a foto (a moldura, se tiver, é outra imagem do mesmo bloco)
  const blocoAv = um(/playerAvatarAutoSizeInner">([\s\S]{0,3000}?)<\/picture>\s*<\/div>\s*<\/div>/) || um(/playerAvatarAutoSizeInner">([\s\S]{0,3000})/);
  const mold = um(/profile_avatar_frame">[\s\S]{0,700}?<img src="([^"]+)"/);
  const fotos = [...blocoAv.matchAll(/\s(?:src|srcset)="([^"\s]+)/g)].map((m) => imgSt(m[1])).filter((u) => u && u !== imgSt(mold));
  d.avatar = fotos.find((u) => /avatars\./.test(u)) || fotos[0] || '';
  if (imgSt(mold)) d.moldura = imgSt(mold);
  d.nivel = num(um(/friendPlayerLevelNum">(\d+)/));
  if (d.privado) return d;
  d.nomeReal = txt(ent(um(/header_real_name[^"]*">\s*<bdi>([^<]*)/)).trim(), 64);
  d.local = txt(limpo(um(/header_location">([\s\S]*?)<\/div>/)), 80);
  d.bandeira = imgSt(um(/<img class="profile_flag" src="([^"]+)"/));
  d.bio = txt(limpo(um(/profile_summary">([\s\S]*?)<\/div>/)), 600);
  const fundoVid = [...html.matchAll(/profile_animated_background">[\s\S]{0,1500}?<\/video>/g)][0];
  if (fundoVid) {
    const v = fundoVid[0], mp4 = /<source src="([^"]+\.mp4)"/.exec(v), poster = /poster="([^"]+)"/.exec(v);
    if (poster) d.fundo = imgSt(poster[1]);
    if (mp4 && VID.test(mp4[1])) d.fundoVideo = mp4[1];
  }
  if (!d.fundo) d.fundo = imgSt(um(/has_profile_background[^"]*"[^>]*style="background-image: url\( '([^']+)' \)/) || um(/profile_background_image_content[^"]*"[^>]*style="background-image: url\( '([^']+)' \)/) || um(/background-image: url\( '([^']+)' \)/));
  const est = (m) => { const v = m.trim(); return v && v !== '&nbsp;' ? num(v) : null; };
  d.contagens = {};
  for (const m of html.matchAll(/count_link_label">([^<]*)<\/span>\s*(?:&nbsp;)?\s*<span class="profile_count_link_total">\s*([^<]*?)\s*<\/span>/g)) {
    const r = m[1].trim(), v = est(m[2]); if (v == null) continue;
    const k = /^(Jogos|Games)$/i.test(r) ? 'jogos' : /^(Amigos|Friends)$/i.test(r) ? 'amigos' : /^(Ins[íi]gnias|Badges)$/i.test(r) ? 'insignias' : /^(Capturas|Screenshots)/i.test(r) ? 'capturas' : /^(An[áa]lises|Reviews)$/i.test(r) ? 'analises' : /^(Grupos|Groups)$/i.test(r) ? 'grupos' : /^(Pr[êe]mios|Awards)/i.test(r) ? 'premios' : '';
    if (k) d.contagens[k] = v;
  }
  // jogando agora / online
  const st = um(/profile_in_game_header">([^<]*)/); if (st) d.status = txt(st.trim(), 40);
  const jg = um(/profile_in_game_name">([^<]*)/); if (jg && !/^\s*$/.test(jg)) d.jogando = txt(ent(jg).trim(), 80);
  d.online = /profile_in_game persona (in-game|online)/.test(html) ? (/in-game/.test(um(/profile_in_game persona ([a-z-]+)/)) ? 'jogo' : 'on') : 'off';
  d.horas2sem = txt(ent(um(/recentgame_recentplaytime">[\s\S]*?<h2>([^<]*)/)).trim(), 40);
  // jogos recentes
  d.recentes = [];
  for (const bl of html.split('class="recent_game_content"').slice(1, 4)) {
    const cap = /game_capsule" src="([^"]+)"/.exec(bl), det = /game_info_details">([\s\S]*?)<\/div>/.exec(bl), nm = /game_name"><a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/.exec(bl);
    if (!nm) continue;
    const prog = /(\d+)\s*(?:\/|de|of)\s*(\d+)\s*(?:conquistas|achievements)/i.exec(limpo(bl.slice(0, 6000)));
    d.recentes.push({ nome: txt(ent(nm[2]).trim(), 80), capa: cap ? imgSt(cap[1]) : '', info: det ? txt(limpo(det[1]), 100) : '', url: /^https:\/\/steamcommunity\.com\/app\/\d+$/.test(nm[1]) ? nm[1].replace('steamcommunity.com/app/', 'store.steampowered.com/app/') : '', conq: prog ? { tem: +prog[1], de: +prog[2] } : null });
  }
  // vitrines (cada uma do jeito dela: jogo favorito, conquistas, insígnias, colecionador de jogos, capturas, grupo, texto...)
  d.vitrines = [];
  const pos = [...html.matchAll(/class="profile_customization"/g)].map((m) => m.index);
  for (let k = 0; k < pos.length && d.vitrines.length < 5; k++) {
    const b = html.slice(pos[k], pos[k + 1] || pos[k] + 30000);
    const tipoV = (/class="([a-z]+)_showcase\b/.exec(b) || [])[1] || '';
    const titulo = txt(ent(limpo((/profile_customization_header">([\s\S]*?)<\/div>/.exec(b) || [])[1] || '')), 60);
    const v = { tipo: tipoV, titulo, itens: [], stats: [] };
    for (const s of b.split(/class="[^"]*\bshowcase_slot\b/).slice(1, 13)) {
      const im = /<img[^>]*?\s(?:src|srcset)="([^"\s]+)/.exec(s.replace(/data-tooltip-html="[^"]*"/, '')), tip = /^[^>]*data-tooltip-html="([^"]*)"/.exec(s), a = /<a[^>]+href="([^"]+)"/.exec(s);
      const u = im && imgSt(im[1]); if (!u) continue;
      let nome = ''; if (tip) { const t = ent(tip[1]); nome = (/achievement_tooltip_name">([^<]+)/.exec(t) || /<h3>([^<]+)/.exec(t) || [])[1] || limpo(t).split('\n')[0]; }
      v.itens.push({ img: u, nome: txt((nome || '').trim(), 80), url: a && /^https:\/\/(steamcommunity\.com|store\.steampowered\.com)\//.test(a[1]) ? a[1] : '' });
    }
    for (const s of b.matchAll(/class="showcase_stat"[\s\S]*?class="value">\s*([^<]*?)\s*<\/div>\s*<div class="label">\s*([^<]*?)\s*<\/div>/g)) if (v.stats.length < 4) v.stats.push({ v: txt(ent(s[1]), 20), r: txt(ent(s[2]), 40) });
    const fav = /(?:favoritegame|favoritegroup)_name[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/.exec(b) || /showcase_item_detail_title[^>]*>\s*(?:<a[^>]*>)?([^<]+)/.exec(b); if (fav) v.nome = txt(ent(fav[1]).trim(), 80);
    const nota = /showcase_notes">([\s\S]*?)<\/div>/.exec(b); if (nota) v.texto = txt(limpo(nota[1]), 400);
    const ant = d.vitrines[d.vitrines.length - 1], repetida = !v.itens.length && ant && JSON.stringify(ant.stats) === JSON.stringify(v.stats);
    if ((v.itens.length || v.stats.length || v.texto) && !repetida) d.vitrines.push(v);
  }
  return d;
}

export async function steam(url) {
  const m = RE_STEAM.exec(url); if (!m) return null;
  if (m[1] || m[2]) return jogo(+(m[1] || m[2]));
  if (m[3] === 'profiles' && !/^\d{17}$/.test(m[4])) return null;
  return perfil(m[3].toLowerCase(), m[4]);
}

// /api/sv?u=<vídeo da Steam> (trailer de 480p ou o fundo animado do perfil): passa pelo Aero, com Range e limite por IP
export async function steamVideo(request, url, env) {
  const nada = (s = 404) => new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*' } });
  const alvo = url.searchParams.get('u') || '';
  if (!VID.test(alvo)) return nada(400);
  if (!(await limiteIp(env, request, 'sv'))) return nada(429);
  const range = request.headers.get('Range');
  const r = await buscarSoPermitidos(alvo, (u) => VID.test(u.split('?')[0]), { headers: { ...UA, ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}) } });
  const tipo = (r.headers.get('Content-Type') || '').toLowerCase();
  if (!(r.status === 200 || r.status === 206) || !/^video\/(mp4|webm)/.test(tipo)) return nada();
  const h = new Headers({ 'Content-Type': tipo.split(';')[0], 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  for (const k of ['Content-Length', 'Content-Range']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  return new Response(r.body, { status: r.status, headers: h });
}
