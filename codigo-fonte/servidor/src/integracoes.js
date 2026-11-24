// (0.8.7) Integrações: as notas (estrelas), os comentários e quantas pessoas instalaram cada uma.
// As oficiais vêm dentro do app (só o desenvolvedor publica); as da comunidade chegam numa próxima etapa (publicar exige o Supporter).
// Nada daqui toca em mensagens, chaves ou privacidade: são só avaliações públicas de cada integração.
import { resposta, erro, hex, CORS, SEGURANCA } from './util.js';
import { limitesDe } from './bolha.js';
import { idsCatalogo, catalogoCorpo } from './catalogo-integ.js';

const OFICIAIS = new Set(idsCatalogo()); // (1.0.2) as oficiais são as do catálogo (catalogo-integ.js)
const ID = /^[a-z0-9-]{3,40}$/;
const MAX_COMENT = 500, MAX_GUARDADOS = 3000;
// (0.9.5) as bolhas de arte do estúdio: a arte do artista (moldura, fundo e personagens) e as escolhas dele. Nada disso é código nem CSS:
// são só números, cores, escolhas de listas e o código (hash) de imagens que já estão no servidor do Aero. Quem desenha a bolha é o app.
const HASH = /^[0-9a-f]{32}$/, COR6 = /^#[0-9a-f]{6}$/i;
const CANTOS_ARTE = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'], ZONAS_ARTE = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
export const MAX_ARTE = 4 * 1048576, LADO_ARTE = 1600;
const inteiro = (v, a, z, p) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(a, Math.min(z, Math.round(+v))) : p);
const umDe = (v, l, p) => (l.includes(v) ? v : p);
const imgArte = (x) => (x && typeof x === 'object' && HASH.test(x.h) ? { h: x.h, w: inteiro(x.w, 1, LADO_ARTE, 1), a: inteiro(x.a, 1, LADO_ARTE, 1), ...(HASH.test(x.p) ? { p: x.p } : {}) } : null);
// confere a arte de uma bolha: devolve só o que é permitido (ou null se não sobrar nada)
export function validarArte(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const o = { v: 1 };
  const m = a.moldura && typeof a.moldura === 'object' ? a.moldura : null, mi = m && imgArte(m.img);
  if (mi) { const c = Array.isArray(m.corte) ? m.corte : []; o.moldura = { img: mi, corte: [0, 1, 2, 3].map((i) => inteiro(c[i], 0, Math.floor((i % 2 ? mi.w : mi.a) / 2), 0)), escala: inteiro(m.escala, 10, 300, 100), rep: umDe(m.rep, ['esticar', 'repetir', 'arredondar'], 'esticar') }; }
  const f = a.fundo && typeof a.fundo === 'object' ? a.fundo : null, fi = f && imgArte(f.img);
  if (fi) o.fundo = { img: fi, modo: umDe(f.modo, ['cobrir', 'repetir', 'ajustar'], 'cobrir'), pos: umDe(f.pos, ZONAS_ARTE, 'c'), tam: inteiro(f.tam, 10, 300, 100), opac: inteiro(f.opac, 0, 100, 100) };
  const pers = (Array.isArray(a.pers) ? a.pers : []).slice(0, 3).map((x) => {
    const pi = x && typeof x === 'object' && imgArte(x.img); if (!pi) return null;
    return { img: pi, canto: umDe(x.canto, CANTOS_ARTE, 'tr'), alt: inteiro(x.alt, 16, 140, 56), sai: inteiro(x.sai, 0, 100, 50), x: inteiro(x.x, -50, 50, 0), y: inteiro(x.y, -50, 50, 0), camada: umDe(x.camada, ['frente', 'atras'], 'frente'), onde: umDe(x.onde, ['todas', 'primeira'], 'todas') };
  }).filter(Boolean);
  if (pers.length) o.pers = pers;
  const c = a.cor && typeof a.cor === 'object' ? a.cor : {};
  o.cor = { fundo: COR6.test(c.fundo) ? c.fundo.toLowerCase() : '', opac: inteiro(c.opac, 0, 100, 85), texto: COR6.test(c.texto) ? c.texto.toLowerCase() : '' };
  o.contorno = !!a.contorno; o.cantos = inteiro(a.cantos, 0, 30, 16); o.espaco = inteiro(a.espaco, 0, 30, 0);
  if (!o.moldura && !o.fundo && !o.pers && !o.cor.fundo) return null;
  return o;
}
// (1.0.2) molduras da foto e anéis de quem fala feitos por artistas (Supporter): uma imagem (PNG, WebP ou GIF, com a versão parada) em
// volta da foto, e só números e escolhas de listas. Nada de código nem CSS: quem desenha é o app, com as mesmas travas em qualquer lugar
export function validarArteFoto(a, anel) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const img = imgArte(a.img); if (!img) return null;
  const o = { v: 1, img, escala: inteiro(a.escala, 100, 220, 140), x: inteiro(a.x, -40, 40, 0), y: inteiro(a.y, -40, 40, 0), camada: umDe(a.camada, ['frente', 'atras'], 'frente'), giro: inteiro(a.giro, 0, 60, 0), pulso: !!a.pulso };
  if (anel) o.voz = inteiro(a.voz, 0, 100, 60);
  return o;
}
// os códigos das imagens que uma arte usa (com as versões paradas dos GIFs)
export const imagensDaArte = (a) => { const l = []; const um = (i) => { if (i) { l.push(i.h); if (i.p) l.push(i.p); } }; if (a) { um(a.moldura && a.moldura.img); um(a.fundo && a.fundo.img); for (const x of a.pers || []) um(x.img); if (!a.moldura && !a.fundo && !a.pers) um(a.img); } return l; };
// as molduras e os anéis de um pacote
const fotosDe = (l, anel) => (Array.isArray(l) ? l : []).slice(0, 6).map((b) => {
  if (!b || typeof b !== 'object') return null;
  const id = String(b.id || '').toLowerCase(); if (!/^[a-z0-9-]{1,20}$/.test(id)) return null;
  const nome = String(b.nome == null ? '' : b.nome).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30) || id;
  const arte = validarArteFoto(b.arte, anel); return arte ? { id, nome, arte } : null;
}).filter(Boolean);
// todas as artes de um pacote (bolhas, molduras e anéis)
const artesDoPacote = (pac) => [...((pac && pac.bolhas) || []).map((x) => x.arte), ...((pac && pac.molduras) || []).map((x) => x.arte), ...((pac && pac.aneis) || []).map((x) => x.arte)].filter(Boolean);
// as bolhas de um pacote: as de CSS (só id e nome) e as de arte
const bolhasDe = (l) => (Array.isArray(l) ? l : []).slice(0, 6).map((b) => {
  if (!b || typeof b !== 'object') return null;
  const id = String(b.id || '').toLowerCase(); if (!/^[a-z0-9-]{1,20}$/.test(id)) return null;
  const nome = String(b.nome == null ? '' : b.nome).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30) || id;
  if (b.arte === undefined) return { id, nome };
  const arte = validarArte(b.arte); return arte ? { id, nome, arte } : null;
}).filter(Boolean);
// o tamanho de uma imagem, lido do próprio arquivo (e a confirmação de que ele é mesmo do tipo que diz ser)
export function dimensoesImagem(b, mime) {
  const u16 = (i) => b[i] | (b[i + 1] << 8), b16 = (i) => (b[i] << 8) | b[i + 1], b32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3], u24 = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const txt = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  try {
    if (mime === 'image/png') { if (b.length < 24 || txt(1, 3) !== 'PNG' || b[0] !== 0x89 || txt(12, 4) !== 'IHDR') return null; return { w: b32(16), a: b32(20) }; }
    if (mime === 'image/gif') { if (b.length < 10 || !/^GIF8[79]a$/.test(txt(0, 6))) return null; return { w: u16(6), a: u16(8) }; }
    if (mime === 'image/webp') {
      if (b.length < 30 || txt(0, 4) !== 'RIFF' || txt(8, 4) !== 'WEBP') return null;
      const k = txt(12, 4);
      if (k === 'VP8 ') return { w: u16(26) & 0x3fff, a: u16(28) & 0x3fff };
      if (k === 'VP8L') return { w: 1 + (((b[22] & 0x3f) << 8) | b[21]), a: 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
      if (k === 'VP8X') return { w: 1 + u24(24), a: 1 + u24(27) };
      return null;
    }
    if (mime === 'image/jpeg') {
      if (b[0] !== 0xff || b[1] !== 0xd8) return null;
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const mk = b[i + 1];
        if (mk === 0xff) { i++; continue; }
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { w: b16(i + 7), a: b16(i + 5) };
        if (mk === 0xd8 || (mk >= 0xd0 && mk <= 0xd7) || mk === 0x01) { i += 2; continue; }
        i += 2 + b16(i + 2);
      }
      return null;
    }
  } catch (e) { return null; }
  return null;
}
// (0.9.1) a Comunidade: integrações publicadas por quem assina o Supporter. São só APARÊNCIA (CSS e opções descritas em JSON, sem código).
// O servidor recusa o que poderia mandar dado para fora ou rodar algo (links, @import, fontes de fora, escapes, scripts, SVG) e o app
// confere tudo de novo antes de instalar (as mesmas travas das integrações feitas em casa).
const CATS = new Set(['barra', 'tema', 'custom', 'misc']);
const MAX_PUB = 2000, MAX_PAC = 120000, DENUNCIAS_OCULTA = 5;
const CSS_RUIM = /(url\s*\(|image-set\s*\(|src\s*\(|expression\s*\(|javascript:|vbscript:|@import|@font-face|@namespace|@property|attr\s*\(|behavior\s*:|-moz-binding|\\|<\s*\/?\s*(script|style|iframe|object|embed|svg|link|meta)\b|paint\s*\(|element\s*\()/i;
const limpa = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const imagemOk = (u) => (typeof u === 'string' && u.length < 420000 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(u) ? u : '');
// confere o pacote: devolve { pac, imagem } ou lança o motivo
export function validarPacote(b) {
  const p = b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  if (!p) throw new Error('Pacote inválido.');
  const css = typeof p.css === 'string' ? p.css.slice(0, 60000) : '';
  if (CSS_RUIM.test(css)) throw new Error('A integração tem partes que não são permitidas (links, @import, fontes de fora, escapes ou HTML). Tire e tente de novo.');
  // as outras partes só podem ter números, textos curtos e listas (o app ainda limita cada uma ao instalar)
  const seguro = (v, fundo = 0) => {
    if (fundo > 6) return undefined;
    if (v == null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') return CSS_RUIM.test(v) ? '' : limpa(v, 600);
    if (Array.isArray(v)) return v.slice(0, 40).map((x) => seguro(x, fundo + 1));
    if (typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v).slice(0, 40)) if (/^[\w-]{1,30}$/.test(k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') o[k] = seguro(x, fundo + 1); return o; }
    return undefined;
  };
  const pac = { nome: limpa(p.nome, 40), desc: limpa(p.descricao || p.desc, 600), versao: limpa(p.versao, 12), css,
    opcoes: seguro(p.opcoes) || [], sons: p.sons ? seguro(p.sons) : null, barras: seguro(p.barras) || [], bolhas: bolhasDe(p.bolhas), presets: seguro(p.presets) || [], molduras: fotosDe(p.molduras, false), aneis: fotosDe(p.aneis, true) };
  if (!pac.nome) throw new Error('Dê um nome para a integração.');
  if (!css.trim() && !pac.opcoes.length && !pac.sons && !pac.presets.length && !pac.bolhas.some((x) => x.arte) && !pac.molduras.length && !pac.aneis.length) throw new Error('A integração está vazia.');
  if (JSON.stringify(pac).length > MAX_PAC) throw new Error('A integração é grande demais.');
  return { pac, imagem: imagemOk(p.imagem) };
}

export class Integracoes {
  constructor(hub) { this.hub = hub; }

  // (1.0.2) o catálogo das oficiais, aberto (o app busca antes mesmo de entrar) e guardado por 5 minutos pelo caminho
  servirCatalogo() { return new Response(catalogoCorpo(), { headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }); }
  async doc(id) { return (await this.hub.get('ig:' + id)) || { av: {}, inst: 0 }; }
  resumo(d) {
    const vs = Object.values(d.av || {}), n = vs.length;
    return { nota: n ? Math.round((vs.reduce((s, x) => s + x.e, 0) / n) * 10) / 10 : 0, votos: n, inst: d.inst || 0 };
  }
  async existe(id) { return ID.test(id || '') && (OFICIAIS.has(id) || (/^c-[a-f0-9]{10}$/.test(id) && !!(await this.hub.get('igc:' + id)))); }
  async indice() { return (await this.hub.get('igc-ind')) || []; }
  // o cartão de cada uma na lista (sem o CSS nem a imagem: esses vêm quando abre)
  cartao(x) { return { id: x.id, cat: x.cat, nome: x.pac.nome, resumo: x.pac.desc.slice(0, 160), versao: x.pac.versao, autor: x.autor, codigo: x.codigo, av: x.avV || 0, em: x.em, atual: x.atual, img: !!x.imagem, oculta: !!x.oculta }; }
  async reindexar(x, tirar) {
    let ind = (await this.indice()).filter((y) => y.id !== x.id);
    if (!tirar) ind.unshift({ ...this.cartao(x), ...this.resumo(await this.doc(x.id)) });
    if (ind.length > MAX_PUB) ind = ind.slice(0, MAX_PUB);
    await this.hub.put({ 'igc-ind': ind });
  }
  async atualizarNotas(id) {
    if (!id.startsWith('c-')) return;
    const ind = await this.indice(), i = ind.findIndex((y) => y.id === id); if (i < 0) return;
    ind[i] = { ...ind[i], ...this.resumo(await this.doc(id)) }; await this.hub.put({ 'igc-ind': ind });
  }
  async comunidade(conta, seg, metodo, b) {
    const pode = !!limitesDe(conta).integracoes, mod = !!(await this.hub.admin.cargo(conta));
    // publicar (nova) ou atualizar uma sua
    if (seg[1] === 'publicar' && metodo === 'POST') {
      if (!pode) return erro('Publicar na Comunidade é do Supporter. Instalar é para todo mundo.', 403);
      if (!this.hub.limitar('igpub:' + conta.id, 6, 3600000)) return erro('Você publicou muitas vezes seguidas. Tente de novo mais tarde.', 429);
      const cat = CATS.has(b.cat) ? b.cat : '';
      if (!cat) return erro('Escolha a categoria.');
      let v; try { v = validarPacote(b.pac); } catch (e) { return erro(e.message); }
      // (0.9.5) as imagens das bolhas de arte precisam já estar no servidor (o estúdio manda antes de publicar)
      for (const bo of [...v.pac.bolhas, ...v.pac.molduras, ...v.pac.aneis]) for (const h of imagensDaArte(bo.arte)) { const im = await this.hub.get('igam:' + h); if (!im || im.bloq) return erro('Uma imagem de "' + bo.nome + '" não está no servidor. Abra o estúdio e salve de novo.'); }
      let x = b.id ? await this.hub.get('igc:' + String(b.id)) : null;
      if (b.id && (!x || x.dono !== conta.id)) return erro('Só quem publicou pode atualizar.', 403);
      if (!x) {
        const minhas = (await this.indice()).filter((y) => y.codigo === conta.codigo).length;
        if (minhas >= 20) return erro('Você já tem 20 integrações publicadas. Apague alguma para publicar outra.');
        const id = 'c-' + [...crypto.getRandomValues(new Uint8Array(5))].map((n) => n.toString(16).padStart(2, '0')).join('');
        x = { id, dono: conta.id, em: Date.now() };
      }
      Object.assign(x, { cat, pac: v.pac, imagem: v.imagem || (b.manterImagem ? x.imagem || '' : ''), autor: conta.nome, codigo: conta.codigo, avV: conta.avatarV || 0, atual: Date.now() });
      await this.hub.put({ ['igc:' + x.id]: x });
      await this.reindexar(x);
      return resposta({ ok: true, id: x.id });
    }
    const id = seg[1];
    const x = /^c-[a-f0-9]{10}$/.test(id || '') ? await this.hub.get('igc:' + id) : null;
    if (!x) return erro('Integração não encontrada.', 404);
    // o pacote inteiro (para instalar ou ver a página)
    if (seg[2] === 'pacote' && metodo === 'GET') {
      if (x.oculta && !mod && x.dono !== conta.id) return erro('Esta integração está em revisão.', 403);
      return resposta({ ...this.cartao(x), pac: x.pac, imagem: x.imagem || '', meu: x.dono === conta.id, mod });
    }
    if (seg[2] === 'imagem' && metodo === 'GET') return resposta({ imagem: x.oculta ? '' : x.imagem || '' });
    // apagar: quem publicou ou a moderação
    if (seg.length === 2 && metodo === 'DELETE') {
      if (x.dono !== conta.id && !mod) return erro('Só quem publicou pode apagar.', 403);
      if (x.dono !== conta.id) await this.marcarArtes(x, true); // (0.9.5) apagada pela moderação: as artes dela somem de todas as bolhas
      await this.hub.ctx.storage.delete('igc:' + id); await this.reindexar(x, true);
      return resposta({ ok: true });
    }
    // denunciar: com várias denúncias de contas diferentes ela some da lista até a moderação olhar
    if (seg[2] === 'denunciar' && metodo === 'POST') {
      if (!this.hub.limitar('igden:' + conta.id, 10, 3600000)) return erro('Devagar!', 429);
      x.den = x.den || {}; x.den[conta.id] = { em: Date.now(), m: limpa(b.motivo, 200) };
      if (Object.keys(x.den).length >= DENUNCIAS_OCULTA) x.oculta = true;
      if (mod && b.liberar) { x.oculta = false; x.den = {}; }
      await this.hub.put({ ['igc:' + id]: x }); await this.reindexar(x); await this.marcarArtes(x, !!x.oculta);
      return resposta({ ok: true });
    }
    return null;
  }

  // (0.9.5) em revisão (ou apagada pela moderação): as imagens das bolhas dela deixam de ser entregues, e quem usava volta à bolha padrão
  async marcarArtes(x, bloq) {
    for (const arte of artesDoPacote(x.pac)) for (const h of imagensDaArte(arte)) {
      const im = await this.hub.get('igam:' + h); if (im && !!im.bloq !== bloq) { im.bloq = bloq; await this.hub.put({ ['igam:' + h]: im }); }
    }
  }
  // (0.9.5) uma imagem do estúdio de bolhas (PNG, JPG, WebP ou GIF): o servidor lê o tamanho do próprio arquivo (e confere que ele é mesmo
  // do tipo que diz), guarda pelo código (hash) do conteúdo e entrega sempre a mesma. Só quem pode publicar na Comunidade manda
  async subirArte(conta, request) {
    if (!limitesDe(conta).integracoes) return erro('Publicar na Comunidade é do Supporter. Instalar é para todo mundo.', 403);
    if (!this.hub.limitar('igarte:' + conta.id, 60, 3600000)) return erro('Você mandou muitas imagens seguidas. Tente de novo mais tarde.', 429);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(gif|jpeg|png|webp)$/.test(mime)) return erro('Use PNG, JPG, WebP ou GIF.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_ARTE) return erro('Imagem grande demais (até 4 MB).', 413);
    const d = dimensoesImagem(bytes, mime);
    if (!d || !d.w || !d.a) return erro('Esse arquivo não é uma imagem válida.');
    if (d.w > LADO_ARTE || d.a > LADO_ARTE) return erro('A imagem pode ter até ' + LADO_ARTE + ' × ' + LADO_ARTE + ' pixels.');
    const h = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).slice(0, 32);
    const ja = await this.hub.get('igam:' + h);
    if (ja && ja.bloq) return erro('Essa imagem foi removida pela moderação.', 403);
    if (!ja) { await this.hub.guardarImagem('iga:', h, bytes, mime); await this.hub.put({ ['igam:' + h]: { dono: conta.id, em: Date.now(), w: d.w, a: d.a } }); }
    return resposta({ ok: true, h, w: d.w, a: d.a });
  }
  async servirArte(h) {
    const im = HASH.test(h || '') ? await this.hub.get('igam:' + h) : null;
    if (!im || im.bloq) return erro('Imagem não encontrada.', 404);
    return this.hub.servirImagemId('iga:', h);
  }
  // (0.9.5) a bolha de arte que alguém escolheu: vem do pacote publicado (nunca do que o app mandou) e fica guardada como estava
  async bolhaArte(conta, ig, bid) {
    const pk = /^c-[a-f0-9]{10}$/.test(String(ig || '')) ? await this.hub.get('igc:' + ig) : null;
    if (!pk || (pk.oculta && pk.dono !== conta.id)) return null;
    const bo = ((pk.pac && pk.pac.bolhas) || []).find((z) => z && z.id === bid && z.arte);
    const a = bo && validarArte(bo.arte); if (!a) return null;
    for (const h of imagensDaArte(a)) { const im = await this.hub.get('igam:' + h); if (!im || im.bloq) return null; }
    return { m: 'arte', ig, b: bo.id, n: bo.nome, a, v: pk.atual || 0 };
  }

  // (1.0.2) a moldura da foto ou o anel de quem fala de um pacote da Comunidade: fica guardado no perfil como estava (igual às bolhas)
  async fotoArte(conta, ig, id, anel) {
    const pk = /^c-[a-f0-9]{10}$/.test(String(ig || '')) ? await this.hub.get('igc:' + ig) : null;
    if (!pk || (pk.oculta && pk.dono !== conta.id)) return null;
    const it = ((pk.pac && pk.pac[anel ? 'aneis' : 'molduras']) || []).find((z) => z && z.id === id);
    const a = it && validarArteFoto(it.arte, anel); if (!a) return null;
    for (const h of imagensDaArte(a)) { const im = await this.hub.get('igam:' + h); if (!im || im.bloq) return null; }
    return { t: 'arte', ig, id: it.id, n: it.nome, a, v: pk.atual || 0 };
  }

  async rota(conta, rota, metodo, b) {
    const seg = rota.split('/');
    if (seg[0] !== 'integ') return null;
    if (!this.hub.limitar('ig:' + conta.id, 90, 60000)) return erro('Devagar! Tente de novo em instantes.', 429);
    // o catálogo: notas e instalações de todas
    if (seg.length === 1 && metodo === 'GET') {
      const out = {}, minhas = {};
      for (const id of OFICIAIS) { const d = await this.doc(id); out[id] = this.resumo(d); const m = d.av && d.av[conta.id]; if (m) minhas[id] = m.e; }
      const mod = !!(await this.hub.admin.cargo(conta));
      const comunidade = (await this.indice()).filter((y) => !y.oculta || mod || y.codigo === conta.codigo);
      return resposta({ oficiais: out, comunidade, minhas, podePublicar: !!limitesDe(conta).integracoes });
    }
    if (seg[1] === 'publicar' || (seg[1] && seg[1].startsWith('c-') && (seg[2] === 'pacote' || seg[2] === 'imagem' || seg[2] === 'denunciar' || (seg.length === 2 && metodo === 'DELETE')))) {
      const r = await this.comunidade(conta, seg, metodo, b || {}); if (r) return r;
    }
    const id = seg[1];
    if (!(await this.existe(id))) return erro('Integração não encontrada.', 404);
    // a página: nota, os comentários mais recentes e a sua avaliação
    if (seg.length === 2 && metodo === 'GET') {
      const d = await this.doc(id), meu = (d.av || {})[conta.id] || null;
      const coment = Object.entries(d.av || {}).filter(([, x]) => x.t).sort((a, b2) => b2[1].em - a[1].em).slice(0, 60)
        .map(([cid, x]) => ({ codigo: x.c, nome: x.n, av: x.v || 0, e: x.e, t: x.t, em: x.em, meu: cid === conta.id }));
      return resposta({ ...this.resumo(d), coment, meu: meu ? { e: meu.e, t: meu.t || '' } : null });
    }
    if (seg[2] === 'avaliar' && metodo === 'POST') {
      const e = Math.round(Number(b.estrelas));
      if (!(e >= 1 && e <= 5)) return erro('Escolha de 1 a 5 estrelas.');
      const t = String(b.texto || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_COMENT);
      const d = await this.doc(id); d.av = d.av || {};
      if (!d.av[conta.id] && Object.keys(d.av).length >= MAX_GUARDADOS) { const velho = Object.entries(d.av).sort((a, b2) => a[1].em - b2[1].em)[0]; if (velho) delete d.av[velho[0]]; }
      d.av[conta.id] = { e, t, em: Date.now(), c: conta.codigo, n: conta.nome, v: conta.avatarV || 0 };
      await this.hub.put({ ['ig:' + id]: d }); await this.atualizarNotas(id);
      return resposta({ ok: true, ...this.resumo(d) });
    }
    if (seg[2] === 'avaliar' && metodo === 'DELETE') {
      const d = await this.doc(id); if (d.av) delete d.av[conta.id];
      await this.hub.put({ ['ig:' + id]: d }); await this.atualizarNotas(id);
      return resposta({ ok: true, ...this.resumo(d) });
    }
    // instalou / tirou: conta uma vez por conta (a lista fica na própria conta)
    if (seg[2] === 'instalar' && metodo === 'POST') {
      const tinha = Array.isArray(conta.igs) ? conta.igs : [], sim = !!b.sim, ja = tinha.includes(id);
      if (sim === ja) return resposta({ ok: true });
      conta.igs = sim ? [...tinha, id].slice(-60) : tinha.filter((x) => x !== id);
      const d = await this.doc(id); d.inst = Math.max(0, (d.inst || 0) + (sim ? 1 : -1));
      await this.hub.put({ ['ig:' + id]: d, ['c:' + conta.id]: conta }); await this.atualizarNotas(id);
      return resposta({ ok: true, ...this.resumo(d) });
    }
    return erro('Rota desconhecida.', 404);
  }
}
