// Aero Stream - (1.0.2) tradução das mensagens e dicionário por palavra. Passa pelo servidor: o endereço (IP) de quem pede nunca chega no
// tradutor nem no Wikcionário, e só vai o texto que a pessoa mandou traduzir (nada da conta). Criado por Ryan Victtor.
const LINGUA = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
const UA = { 'User-Agent': 'AeroStream/1.0 (+https://web.aerostream.workers.dev)' };

// (1.0.2) o tradutor do Google passou a recusar o endereço antigo (translate_a/single) vindo de servidores ("429 Sorry"): a tradução
// parou de funcionar. Agora tenta o endereço da extensão do Chrome primeiro, o antigo depois e o MyMemory por último, e guarda a
// tradução no cache do Cloudflare (a mesma mensagem traduzida por várias pessoas de um grupo vira um pedido só)
const comTempo = (u, o = {}) => fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) }, signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
async function viaExtensao(texto, para, de) {
  const r = await comTempo(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${de}&tl=${para}&q=${encodeURIComponent(texto)}`);
  if (!r.ok) return null;
  const d = await r.json(), x = Array.isArray(d) ? d[0] : null;
  if (Array.isArray(x) && typeof x[0] === 'string') return { texto: x[0], de: typeof x[1] === 'string' ? x[1] : de };
  if (typeof x === 'string') return { texto: x, de };
  return null;
}
async function viaGtx(texto, para, de) {
  const r = await comTempo(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${de}&tl=${para}&dt=t&dt=rm&q=${encodeURIComponent(texto)}`);
  if (!r.ok) return null;
  const d = await r.json();
  const partes = Array.isArray(d && d[0]) ? d[0] : [];
  const out = partes.map((p) => (Array.isArray(p) && typeof p[0] === 'string' ? p[0] : '')).join('');
  const rom = partes.map((p) => (Array.isArray(p) && typeof p[3] === 'string' ? p[3] : '')).join(' ').trim(); // como se lê (japonês, russo...)
  return out ? { texto: out, de: typeof d[2] === 'string' ? d[2] : de, rom: rom || undefined } : null;
}
// (1.0.6) os mesmos dois endereços do Google por outros domínios (quando um recusa o servidor, o outro costuma aceitar)
async function viaGtxCurto(texto, para, de) {
  const r = await comTempo(`https://translate.googleapis.com/translate_a/t?client=gtx&sl=${de}&tl=${para}&q=${encodeURIComponent(texto)}`);
  if (!r.ok) return null;
  const d = await r.json(), x = Array.isArray(d) ? d[0] : null;
  if (Array.isArray(x) && typeof x[0] === 'string') return { texto: x[0], de: typeof x[1] === 'string' ? x[1] : de };
  if (typeof x === 'string') return { texto: x, de };
  return null;
}
async function viaGtxSite(texto, para, de) {
  const r = await comTempo(`https://translate.google.com/translate_a/single?client=gtx&sl=${de}&tl=${para}&dt=t&q=${encodeURIComponent(texto)}`);
  if (!r.ok) return null;
  const d = await r.json(), partes = Array.isArray(d && d[0]) ? d[0] : [];
  const out = partes.map((p) => (Array.isArray(p) && typeof p[0] === 'string' ? p[0] : '')).join('');
  return out ? { texto: out, de: typeof d[2] === 'string' ? d[2] : de } : null;
}
// (1.0.6) a tradução das mensagens é sempre "descobrir a língua": o MyMemory ficava de fora justo nela e, quando o Google recusava o
// servidor, aparecia "Não deu para traduzir agora". Agora ele descobre a língua sozinho e o texto longo vai em pedaços
const pedacos = (t, max = 450) => {
  const out = []; let resto = t;
  while (resto.length > max && out.length < 8) {
    let i = Math.max(resto.lastIndexOf('. ', max), resto.lastIndexOf('\n', max), resto.lastIndexOf('! ', max), resto.lastIndexOf('? ', max));
    if (i < max / 3) i = resto.lastIndexOf(' ', max); if (i < max / 3) i = max;
    out.push(resto.slice(0, i + 1)); resto = resto.slice(i + 1);
  }
  if (resto) out.push(resto.slice(0, max)); return out;
};
async function viaMyMemory(texto, para, de) {
  let lingua = de === 'auto' ? '' : de; const out = [];
  for (const p of pedacos(texto)) {
    if (!p.trim()) { out.push(p); continue; }
    const r = await comTempo(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${lingua || 'autodetect'}|${para}`);
    if (!r.ok) return null;
    const d = await r.json(), t = d && d.responseData && d.responseData.translatedText;
    if (typeof t !== 'string' || !t || d.responseStatus !== 200) return null;
    if (!lingua && typeof d.responseData.detectedLanguage === 'string') lingua = d.responseData.detectedLanguage;
    out.push(t + (/\s$/.test(p) ? ' ' : ''));
  }
  return out.length ? { texto: out.join('').trim(), de: lingua || de } : null;
}

export async function traduzir(texto, para, de = 'auto') {
  texto = String(texto || '').slice(0, 2000); if (!texto.trim()) return { texto: '', de: '' };
  if (!LINGUA.test(para)) throw new Error('Língua inválida.');
  if (de !== 'auto' && !LINGUA.test(de)) de = 'auto';
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  let chave = null;
  if (cache) {
    try {
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(de + '|' + para + '|' + texto))), (b) => b.toString(16).padStart(2, '0')).join('');
      chave = new Request('https://cache.aero/traduzir/' + h);
      const c = await cache.match(chave); if (c) return await c.json();
    } catch (_) { chave = null; }
  }
  let r = null;
  for (const via of [viaExtensao, viaGtx, viaGtxCurto, viaGtxSite]) { try { r = await via(texto, para, de); } catch (_) { r = null; } if (r) break; }
  if (!r) { try { r = await viaMyMemory(texto, para, de); } catch (_) { r = null; } }
  if (!r) throw new Error('O tradutor não respondeu.');
  const out = { texto: String(r.texto).slice(0, 4000), de: String(r.de || de).slice(0, 8), rom: r.rom ? String(r.rom).slice(0, 400) : undefined };
  if (cache && chave) { try { await cache.put(chave, new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=604800' } })); } catch (_) { /* sem cache */ } }
  return out;
}

// o verbete do Wikcionário daquela língua (pt.wiktionary para português, en.wiktionary para inglês...): só a parte da própria língua
const NOME_SECAO = { pt: /portugu/i, en: /english|inglês/i, es: /espa(ñ|n)ol|spanish/i, fr: /fran(ç|c)ais|french/i, de: /deutsch|german/i, it: /italiano|italian/i, ja: /日本語|japanese/i, ru: /русский|russian/i };
export async function dicionario(palavra, lingua) {
  palavra = String(palavra || '').trim().slice(0, 60); if (!palavra || /[\s<>{}|[\]]/.test(palavra) && palavra.split(/\s+/).length > 3) throw new Error('Palavra inválida.');
  const l = LINGUA.test(lingua) ? lingua.slice(0, 2) : 'pt';
  const pedir = async (t) => {
    const u = `https://${l}.wiktionary.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(t)}`;
    const r = await fetch(u, { headers: UA }); if (!r.ok) return '';
    const d = await r.json(); const pg = d && d.query && d.query.pages ? Object.values(d.query.pages)[0] : null;
    return pg && !('missing' in pg) ? String(pg.extract || '') : '';
  };
  let txt = await pedir(palavra); if (!txt && palavra !== palavra.toLowerCase()) txt = await pedir(palavra.toLowerCase());
  if (!txt) return { palavra, lingua: l, secoes: [] };
  // corta na seção da própria língua (o verbete traz outras línguas também)
  const linhas = txt.split('\n'), re = NOME_SECAO[l];
  let ini = 0, nivel = 0;
  if (re) for (let i = 0; i < linhas.length; i++) { const m = /^(=+)\s*(.+?)\s*=+$/.exec(linhas[i]); if (m && re.test(m[2]) && m[1].length <= 2) { ini = i + 1; nivel = m[1].length; break; } }
  const secoes = []; let atual = null;
  for (let i = ini; i < linhas.length && secoes.length < 8; i++) {
    const ln = linhas[i].trim(); if (!ln) continue;
    const m = /^(=+)\s*(.+?)\s*=+$/.exec(ln);
    if (m) { if (nivel && m[1].length <= nivel) break; atual = { t: m[2].slice(0, 60), l: [] }; secoes.push(atual); continue; }
    if (!atual) { atual = { t: '', l: [] }; secoes.push(atual); }
    if (atual.l.length < 8) atual.l.push(ln.slice(0, 300));
  }
  // seções que só têm referências/traduções não ajudam
  const util = secoes.filter((s) => s.l.length && !/^(tradu|transla|refer|ver também|see also|anagram|etimologia|etymology|fontes|sin[oô]nimos|synonym|alternative forms|formas alternativas|derived|termos derivados|related|descendants|hyponym|hypernym|coordinate)/i.test(s.t));
  return { palavra, lingua: l, secoes: util.slice(0, 6) };
}

// (1.0.6) "Ouvir" do dicionário: o app do PC (Electron no Linux) não tem voz nenhuma instalada e o botão ficava mudo. O áudio da palavra
// vem pelo servidor (o IP de quem ouve não chega no Google nem no Wikcionário): a voz do Google primeiro, a gravação do Wikcionário depois
const AUDIO_OK = /^(audio\/(mpeg|ogg|mp3|wav|x-wav|wave|vnd\.wave|webm)|application\/ogg)$/;
async function audioDe(u) {
  const r = await comTempo(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'audio/*' } });
  const tipo = (r.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!r.ok || !AUDIO_OK.test(tipo)) return null;
  const b = await r.arrayBuffer(); return b.byteLength > 200 && b.byteLength < 2e6 ? { b, tipo: tipo === 'application/ogg' ? 'audio/ogg' : tipo } : null;
}
async function audioWikcionario(t, l) {
  const api = `https://${l}.wiktionary.org/w/api.php?action=query&format=json&redirects=1&prop=images&imlimit=50&titles=${encodeURIComponent(t)}`;
  const r = await comTempo(api); if (!r.ok) return null;
  const d = await r.json(), pg = d && d.query && d.query.pages ? Object.values(d.query.pages)[0] : null;
  const arqs = (pg && pg.images ? pg.images : []).map((x) => x.title).filter((x) => /\.(ogg|oga|mp3|wav)$/i.test(x) && new RegExp('^(File|Ficheiro|Arquivo|Archivo|Fichier|Datei):' + l + '-', 'i').test(x));
  if (!arqs.length) return null;
  const nome = arqs.find((x) => /-us-|-br-/i.test(x)) || arqs[0];
  const ii = await comTempo(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent('File:' + nome.replace(/^[^:]+:/, ''))}`);
  if (!ii.ok) return null;
  const di = await ii.json(), p2 = di && di.query && di.query.pages ? Object.values(di.query.pages)[0] : null, url = p2 && p2.imageinfo && p2.imageinfo[0] && p2.imageinfo[0].url;
  return /^https:\/\/upload\.wikimedia\.org\//.test(url || '') ? audioDe(url) : null;
}
export async function falar(request, url, env, limiteIp) {
  const t = String(url.searchParams.get('t') || '').trim().slice(0, 80), lingua = String(url.searchParams.get('l') || '');
  if (!t || !LINGUA.test(lingua) || /[<>{}|[\]\n]/.test(t)) return new Response('', { status: 400 });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const chave = new Request('https://cache.aero/falar/' + lingua + '/' + encodeURIComponent(t));
  if (cache) { try { const c = await cache.match(chave); if (c) return c; } catch (_) { /* sem cache */ } }
  if (limiteIp && !(await limiteIp(env, request, 'falar'))) return new Response('', { status: 429, headers: { 'Retry-After': '60' } });
  const q = encodeURIComponent(t), tl = encodeURIComponent(lingua);
  let a = null;
  for (const u of [`https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${q}`, `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${q}`]) {
    try { a = await audioDe(u); } catch (_) { a = null; } if (a) break;
  }
  if (!a) { try { a = await audioWikcionario(t, lingua.slice(0, 2)); } catch (_) { a = null; } }
  if (!a) return new Response('', { status: 404 });
  const resp = new Response(a.b, { headers: { 'Content-Type': a.tipo, 'Cache-Control': 'public, max-age=604800', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' } });
  if (cache) { try { await cache.put(chave, resp.clone()); } catch (_) { /* ok */ } }
  return resp;
}
