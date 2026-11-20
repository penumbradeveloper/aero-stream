// Aero Stream - (1.0.2) tradução das mensagens e dicionário por palavra. Passa pelo servidor: o endereço (IP) de quem pede nunca chega no
// tradutor nem no Wikcionário, e só vai o texto que a pessoa mandou traduzir (nada da conta). Criado por Ryan Victtor.
const LINGUA = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
const UA = { 'User-Agent': 'AeroStream/1.0 (+https://web.aerostream.workers.dev)' };

export async function traduzir(texto, para, de = 'auto') {
  texto = String(texto || '').slice(0, 2000); if (!texto.trim()) return { texto: '', de: '' };
  if (!LINGUA.test(para)) throw new Error('Língua inválida.');
  if (de !== 'auto' && !LINGUA.test(de)) de = 'auto';
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${de}&tl=${para}&dt=t&dt=rm&q=${encodeURIComponent(texto)}`;
  const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error('O tradutor não respondeu.');
  const d = await r.json();
  const partes = Array.isArray(d && d[0]) ? d[0] : [];
  const out = partes.map((p) => (Array.isArray(p) && typeof p[0] === 'string' ? p[0] : '')).join('');
  const rom = partes.map((p) => (Array.isArray(p) && typeof p[3] === 'string' ? p[3] : '')).join(' ').trim(); // como se lê (japonês, russo...)
  return { texto: out.slice(0, 4000), de: typeof d[2] === 'string' ? d[2].slice(0, 8) : de, rom: rom.slice(0, 400) || undefined };
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
