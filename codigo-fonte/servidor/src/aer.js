// Aero - (1.0.0) A LOJA DE SKINS (.aer) e o "verificado": o servidor confere cada .aer publicado com as MESMAS regras do app
// (app/js/aer.js; os testes conferem que as duas listas batem), guarda pelo hash (SHA-256) e responde se um arquivo é da loja.
// Pagas: o dinheiro vai direto para a conta do Mercado Pago de quem fez (o "split" do marketplace: o Aero só recebe a comissão,
// nunca guarda dinheiro de ninguém). As oficiais (do desenvolvedor) vão inteiras para a conta do Aero. A licença fica presa à conta;
// estorno ou contestação tira a licença. Denúncia, e a remoção pelo hash (a mesma skin não volta com outro nome).
// Desconto do Donator e créditos do Supporter saem da comissão do Aero (quem fez recebe sempre o mesmo).
import { resposta, erro, txt } from './util.js';
import { nivelDe } from './extras.js';
import { mesesSeguidos } from './bolha.js';

// ---------- as regras do formato (iguais às do app) ----------
export const REGRAS = {
    formato: 1,
    maxArquivos: 200, maxTotal: 30 * 1048576, maxCss: 60000, maxManifesto: 16384, maxCamadas: 32768,
    caminhos: [
      [/^manifesto\.json$/, 'manifesto', 16384],
      [/^skin\.css$/, 'css', 60000],
      [/^camadas\.json$/, 'camadas', 32768],
      [/^imagens\/[a-z0-9_-]{1,40}\.(png|jpe?g|webp|gif)$/, 'imagem', 3 * 1048576],
      [/^fontes\/[a-z0-9_-]{1,40}\.woff2$/, 'fonte', 1048576],
      [/^fontes\/[a-z0-9_-]{1,40}\.(ttf|otf)$/, 'fonte', 4 * 1048576], // as fontes instaladas no PC (só as que a licença deixa embutir)
      [/^sons\/[a-z0-9_-]{1,40}\.(ogg|mp3|wav)$/, 'som', 1048576],
    ],
    // os sons do app que uma skin pode trocar
    sons: ['click', 'hover', 'foco', 'menu-item', 'sucesso', 'erro', 'bolha', 'abrir', 'pop-abrir', 'msg', 'estourar', 'grudar', 'chamada-entrada', 'cham-entrou', 'cham-entrei', 'tk-passar', 'tk-dm', 'tk-grupo', 'menu-abrir', 'menu-fechar', 'pop-fechar', 'fechar'],
};
const R = REGRAS;
const txt4 = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const ini = (b, l) => l.every((x, i) => b[i] === x);
export function podeEmbutir(b) {
  try {
    if (!b || b.length < 12 || txt4(b, 0) === 'ttcf') return false;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getUint16(4);
    if (n < 1 || n > 200 || 12 + n * 16 > b.length) return false;
    for (let i = 0; i < n; i++) {
      const r0 = 12 + i * 16; if (txt4(b, r0) !== 'OS/2') continue;
      const o = dv.getUint32(r0 + 8); if (o + 10 > b.length) return false;
      const fs = dv.getUint16(o + 8); return (fs & 0x000f) !== 0x0002 && !(fs & 0x0200);
    }
    return false;
  } catch (_) { return false; }
}
const ASSINATURA = {
  imagem: (b, nome) => (/\.png$/.test(nome) ? ini(b, [0x89, 0x50, 0x4e, 0x47]) : /\.jpe?g$/.test(nome) ? ini(b, [0xff, 0xd8, 0xff]) : /\.gif$/.test(nome) ? ini(b, [0x47, 0x49, 0x46, 0x38]) : ini(b, [0x52, 0x49, 0x46, 0x46]) && txt4(b, 8) === 'WEBP'),
  fonte: (b, nome) => (/\.woff2$/.test(nome) ? txt4(b, 0) === 'wOF2' : (/\.otf$/.test(nome) ? txt4(b, 0) === 'OTTO' : ini(b, [0, 1, 0, 0]) || txt4(b, 0) === 'true') && podeEmbutir(b)),
  som: (b, nome) => (/\.ogg$/.test(nome) ? txt4(b, 0) === 'OggS' : /\.wav$/.test(nome) ? txt4(b, 0) === 'RIFF' && txt4(b, 8) === 'WAVE' : txt4(b, 0).startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)),
};
const limpa = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
async function inflar(dados, max) {
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(dados).catch(() => {}); w.close().catch(() => {});
  const r = ds.readable.getReader(), partes = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > max) { r.cancel().catch(() => {}); throw new Error('Arquivo grande demais dentro da skin.'); } partes.push(value); }
  const o = new Uint8Array(n); let i = 0; for (const x of partes) { o.set(x, i); i += x.length; } return o;
}
// confere o .aer inteiro (o zip, cada arquivo, as assinaturas e o manifesto). Devolve { manifesto, hash } ou lança o motivo.
export async function validar(buf) {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 22 || b.length > R.maxTotal) throw new Error('Arquivo grande demais ou vazio.');
  let fim = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('Não é um arquivo .aer.');
  const n = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true);
  if (n > R.maxArquivos) throw new Error('Arquivos demais dentro da skin.');
  const arqs = new Map(); let total = 0;
  for (let k = 0; k < n; k++) {
    if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('Arquivo .aer quebrado.');
    const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true), tam = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (nome.endsWith('/')) continue;
    if (/\.\.|\\|^\/|[\u0000-\u001f]/.test(nome)) throw new Error('Nome de arquivo não permitido: ' + limpa(nome, 40));
    const regra = R.caminhos.find(([re]) => re.test(nome));
    if (!regra) throw new Error('Arquivo não permitido dentro da skin: ' + limpa(nome, 40));
    if (tam > regra[2]) throw new Error('Arquivo grande demais: ' + nome);
    total += tam; if (total > R.maxTotal) throw new Error('A skin passa de 30 MB.');
    if (loc + 30 > b.length || dv.getUint32(loc, true) !== 0x04034b50) throw new Error('Arquivo .aer quebrado.');
    const i2 = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), dados = b.subarray(i2, i2 + comp);
    let bytes;
    if (metodo === 0) bytes = dados.slice(); else if (metodo === 8) bytes = await inflar(dados, regra[2]); else throw new Error('Compressão não suportada.');
    if (bytes.length !== tam) throw new Error('Arquivo .aer quebrado.');
    if (ASSINATURA[regra[1]] && !ASSINATURA[regra[1]](bytes, nome)) throw new Error('Este arquivo não é o que diz ser: ' + nome);
    arqs.set(nome, { tipo: regra[1], bytes });
  }
  const man = arqs.get('manifesto.json'); if (!man) throw new Error('Falta o manifesto.json.');
  let j; try { j = JSON.parse(new TextDecoder().decode(man.bytes)); } catch (_) { throw new Error('manifesto.json inválido.'); }
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('manifesto.json inválido.');
  if (+j.formato !== R.formato) throw new Error('Esta skin é de outra versão do formato .aer.');
  const id = String(j.id || '').toLowerCase(); if (!/^[a-z0-9-]{3,32}$/.test(id)) throw new Error('O id da skin deve ter de 3 a 32 letras, números ou traços.');
  const nome = limpa(j.nome, 40); if (!nome) throw new Error('A skin precisa de um nome.');
  for (const c of ['camadas.json']) if (arqs.get(c)) { try { JSON.parse(new TextDecoder().decode(arqs.get(c).bytes)); } catch (_) { throw new Error(c + ' inválido.'); } }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('');
  return { manifesto: { id, nome, versao: limpa(j.versao, 12) || '1', descricao: limpa(j.descricao, 600) }, hash, tam: b.length };
}

// ---------- a loja ----------
const MP = 'https://api.mercadopago.com';
const PEDACO = 1048576;
const HASH = /^[0-9a-f]{64}$/, ID = /^[a-z0-9-]{3,32}$/, INTEG = /^c-[a-f0-9]{10}$/;
const REF = /^aerl\.([0-9a-f-]{36})\.([a-z0-9-]{3,32})\.([0-9a-f]{8})$/;
const ESTORNO = ['refunded', 'charged_back'];
const PRECO_MIN = 2, PRECO_MAX = 200;
const CREDITO_MES = 2; // o Supporter ganha R$ 2 de crédito na loja a cada mês seguido de plano
const desconto = (nivel) => (nivel >= 4 ? 0.10 : nivel >= 3 ? 0.05 : 0);
const centavos = (v) => Math.round(v * 100) / 100;
const hexA = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');
const emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,}$/.test(e);

export class Loja {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }
  get env() { return this.hub.env; }
  comissao() { const c = +this.env.LOJA_COMISSAO; return c >= 0 && c <= 0.5 ? c : 0.15; }
  async ehDev(conta) { return !!(conta && (conta.dev || (await this.hub.admin.cargo(conta)) === 'dev')); }
  // o que a lista mostra de cada skin
  async vitrine(s, conta) {
    const a = s.autor && (await this.st.get('c:' + s.autor));
    return { id: s.id, nome: s.nome, descricao: s.descricao, versao: s.versao, preco: s.preco, oficial: !!s.oficial, autor: s.oficial ? 'Aero' : (a && a.nome) || '', autorCod: !s.oficial && a ? a.codigo : '', tam: s.tam, em: s.em, vendas: s.vendas || 0, minha: !!conta && s.autor === conta.id, tenho: !!conta && (!s.preco || s.autor === conta.id || !!(await this.st.get(`lic:${conta.id}:${s.id}`))) };
  }
  // (1.0.3) o que vende: uma skin (ls:) ou uma integração paga da Comunidade (igc:, os ids c-xxxxxxxxxx)
  async item(id) {
    if (INTEG.test(id)) {
      const x = await this.st.get('igc:' + id); if (!x) return null;
      return { id, integ: true, nome: (x.pac && x.pac.nome) || 'Integração', preco: x.preco || 0, autor: x.dono, removida: !!x.oculta, vendas: x.vendas || 0 };
    }
    return this.st.get('ls:' + id);
  }
  async contarVenda(id, d) {
    const k = (INTEG.test(id) ? 'igc:' : 'ls:') + id, s = await this.st.get(k);
    if (s) { s.vendas = Math.max(0, (s.vendas || 0) + d); await this.st.put(k, s); }
  }
  // o que o app precisa para mostrar o preço e o "Conectar Mercado Pago"
  async infoVenda(conta) {
    const v = await this.st.get('vend:' + conta.id);
    return { vendedor: !!v, splitPronto: !!(this.env.MP_CLIENT_ID && this.env.MP_CLIENT_SECRET), pagamento: !!this.env.MP_TOKEN, comissao: this.comissao(), creditos: this.creditos(conta), desconto: desconto(nivelDe(conta)) };
  }
  creditos(conta) { const b = conta.bolha || {}; return nivelDe(conta) >= 4 ? Math.max(0, mesesSeguidos(conta) * CREDITO_MES - (b.lojaCredDe === b.desde ? b.lojaCred || 0 : 0)) : 0; }
  // o preço para quem compra (o desconto e o crédito saem da comissão do Aero)
  preco(s, conta, usarCredito) {
    const p = s.preco, nivel = nivelDe(conta), oficial = !!s.oficial, taxaCheia = oficial ? p : centavos(p * this.comissao());
    const d = Math.min(taxaCheia, centavos(p * desconto(nivel)));
    const cr = usarCredito ? Math.min(this.creditos(conta), taxaCheia - d) : 0;
    const total = centavos(p - d - cr);
    return { total, desconto: d, credito: centavos(cr), taxa: oficial ? 0 : centavos(taxaCheia - d - cr) };
  }

  // ---------- guardar e servir os bytes (R2 se houver; senão no próprio armazenamento, em pedaços de 1 MB) ----------
  async guardarBytes(hash, b) {
    if (this.env.ANEXOS) { await this.env.ANEXOS.put('aer/' + hash, b); return { r2: true }; }
    const grava = {}, n = Math.ceil(b.length / PEDACO); for (let i = 0; i < n; i++) grava[`lb:${hash}:${i}`] = b.slice(i * PEDACO, (i + 1) * PEDACO);
    await this.st.put(grava); return { pedacos: n };
  }
  async lerBytes(s) {
    if (s.r2) { const o = this.env.ANEXOS && (await this.env.ANEXOS.get('aer/' + s.hash)); return o ? new Uint8Array(await o.arrayBuffer()) : null; }
    const ps = []; for (let i = 0; i < (s.pedacos || 0); i++) { const x = await this.st.get(`lb:${s.hash}:${i}`); if (!x) return null; ps.push(new Uint8Array(x)); }
    const out = new Uint8Array(ps.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of ps) { out.set(x, o); o += x.length; } return out;
  }
  async apagarBytes(s) {
    if (s.r2) { if (this.env.ANEXOS) await this.env.ANEXOS.delete('aer/' + s.hash).catch(() => {}); return; }
    const ks = []; for (let i = 0; i < (s.pedacos || 0); i++) ks.push(`lb:${s.hash}:${i}`); if (ks.length) await this.st.delete(ks);
  }

  // ---------- rotas públicas (sem sessão): a volta do Mercado Pago e o aviso de pagamento ----------
  async rotaPublica(rota, request, url) {
    if (rota === 'loja/mp/volta' && request.method === 'GET') return this.mpVolta(url);
    if (rota === 'loja/mp' && request.method === 'POST') return this.aviso(request, url);
    return null;
  }
  // ---------- rotas com sessão ----------
  async rota(conta, rota, metodo, b, request, url) {
    const seg = rota.split('/');
    if (seg[0] === 'aer' && seg[1] === 'verificar' && metodo === 'GET') return this.verificar(seg[2]);
    if (seg[0] !== 'loja') return null;
    if (rota === 'loja' && metodo === 'GET') return this.lista(conta, url);
    if (rota === 'loja/publicar' && metodo === 'POST') return this.publicar(conta, request, url);
    if (rota === 'loja/denuncias' && metodo === 'GET') return this.denuncias(conta);
    if (rota === 'loja/mp/conectar' && metodo === 'POST') return this.mpConectar(conta, url);
    if (rota === 'loja/mp/desconectar' && metodo === 'POST') { await this.st.delete('vend:' + conta.id); return resposta({ ok: true }); }
    if (seg[1] === 'pix' && /^[0-9a-f]{8}$/.test(seg[2] || '') && metodo === 'GET') return this.conferirPix(conta, seg[2]);
    if (!ID.test(seg[1] || '')) return null;
    if (seg[2] === 'baixar' && metodo === 'GET') return this.baixar(conta, seg[1]);
    if (seg[2] === 'comprar' && metodo === 'POST') return this.comprar(conta, seg[1], b, url);
    if (seg[2] === 'denunciar' && metodo === 'POST') return this.denunciar(conta, seg[1], b);
    if (seg[2] === 'remover' && metodo === 'POST') return this.remover(conta, seg[1], b);
    return null;
  }

  // o arquivo é da loja? (o app pergunta ao instalar um .aer)
  async verificar(hash) {
    if (!HASH.test(hash || '')) return erro('Pedido inválido.');
    if (await this.st.get('lban:' + hash)) return resposta({ ok: false, removida: true });
    const id = await this.st.get('lh:' + hash), s = id && (await this.st.get('ls:' + id));
    if (!s || s.removida) return resposta({ ok: false });
    return resposta({ ok: true, loja: { id: s.id, nome: s.nome, oficial: !!s.oficial } });
  }
  async lista(conta, url) {
    if (!this.hub.limitar('lojal:' + conta.id, 60, 60000)) return erro('Devagar!', 429);
    const q = txt(url.searchParams.get('q') || '', 40).toLowerCase();
    const out = [];
    for (const [, s] of await this.st.list({ prefix: 'ls:', limit: 2000 })) {
      if (s.removida || (q && !(s.nome + ' ' + s.descricao).toLowerCase().includes(q))) continue;
      out.push(await this.vitrine(s, conta)); if (out.length >= 300) break;
    }
    out.sort((a, b) => (b.oficial - a.oficial) || b.em - a.em);
    const v = await this.st.get('vend:' + conta.id);
    return resposta({ skins: out, vendedor: !!v, splitPronto: !!(this.env.MP_CLIENT_ID && this.env.MP_CLIENT_SECRET), comissao: this.comissao(), creditos: this.creditos(conta), desconto: desconto(nivelDe(conta)), pode: nivelDe(conta) >= 3 || (await this.ehDev(conta)) });
  }

  // publicar (Donator e Supporter; o desenvolvedor publica as oficiais). O corpo é o .aer; o preço e o aceite dos termos vão no endereço.
  async publicar(conta, request, url) {
    const dev = await this.ehDev(conta);
    if (nivelDe(conta) < 3 && !dev) return erro('Publicar na loja é do Aero Bubble Donator.', 403);
    if (!this.hub.limitar('lojap:' + conta.id, 10, 3600000)) return erro('Devagar! Tente de novo mais tarde.', 429);
    if (url.searchParams.get('termos') !== '1') return erro('Aceite os termos da loja para publicar.');
    const preco = centavos(+url.searchParams.get('preco') || 0);
    if (preco && (preco < PRECO_MIN || preco > PRECO_MAX)) return erro(`O preço vai de R$ ${PRECO_MIN} a R$ ${PRECO_MAX} (ou grátis).`);
    const oficial = dev && url.searchParams.get('oficial') === '1';
    if (preco && !oficial && !(await this.st.get('vend:' + conta.id))) return erro('Para vender, conecte a sua conta do Mercado Pago (o dinheiro vai direto para ela).');
    const len = +request.headers.get('Content-Length') || 0; if (len > R.maxTotal) return erro('A skin passa de 30 MB.', 413);
    const b = new Uint8Array(await request.arrayBuffer());
    let v; try { v = await validar(b); } catch (e) { return erro(e.message || 'Arquivo .aer inválido.'); }
    if (await this.st.get('lban:' + v.hash)) return erro('Esta skin foi removida da loja e não pode voltar.', 403);
    const outro = await this.st.get('lh:' + v.hash); if (outro && outro !== v.manifesto.id) return erro('Esta mesma skin já está na loja.');
    if (INTEG.test(v.manifesto.id)) return erro('Esse id é reservado. Mude o id no manifesto.');
    const antes = await this.st.get('ls:' + v.manifesto.id);
    if (antes && antes.autor !== conta.id && !(dev && antes.oficial)) return erro('Já existe uma skin com este id na loja. Mude o id no manifesto.');
    if (antes && antes.removida) return erro('Esta skin foi removida da loja.', 403);
    const onde = await this.guardarBytes(v.hash, b);
    if (antes && antes.hash !== v.hash) await this.apagarBytes(antes); // a versão antiga sai (o hash dela continua "verificado" para quem já tem)
    const s = { id: v.manifesto.id, nome: v.manifesto.nome, descricao: v.manifesto.descricao, versao: v.manifesto.versao, preco, oficial: oficial || undefined, autor: conta.id, hash: v.hash, tam: v.tam, em: (antes && antes.em) || Date.now(), atualizada: Date.now(), vendas: (antes && antes.vendas) || 0, hashes: [...new Set([...(antes && antes.hashes) || [], v.hash])].slice(-20), ...onde };
    await this.st.put({ ['ls:' + s.id]: s, ['lh:' + v.hash]: s.id });
    return resposta({ ok: true, skin: await this.vitrine(s, conta) });
  }
  async baixar(conta, id) {
    const s = await this.st.get('ls:' + id);
    if (!s || s.removida) return erro('Skin não encontrada.', 404);
    if (s.preco && s.autor !== conta.id && !(await this.st.get(`lic:${conta.id}:${id}`)) && !(await this.ehDev(conta))) return erro('Compre a skin para baixar.', 402);
    if (!this.hub.limitar('lojab:' + conta.id, 30, 600000)) return erro('Devagar!', 429);
    const b = await this.lerBytes(s); if (!b) return erro('Skin não encontrada.', 404);
    return new Response(b, { headers: { 'Content-Type': 'application/x-aero-skin', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } });
  }

  // ---------- comprar ----------
  async comprar(conta, id, b, url) {
    const s = await this.item(id);
    if (!s || s.removida) return erro(s && s.integ ? 'Integração não encontrada.' : 'Skin não encontrada.', 404);
    if (!s.preco || s.autor === conta.id || (await this.st.get(`lic:${conta.id}:${id}`))) { if (!s.preco) await this.st.put(`lic:${conta.id}:${id}`, { t: Date.now(), gratis: 1 }); return resposta({ ok: true, tenho: true }); }
    if (!this.env.MP_TOKEN && s.oficial) return erro('Pagamento ainda não disponível.', 503);
    const email = String((b && b.email) || '').trim().toLowerCase(); if (!emailOk(email)) return erro('Escreva um e-mail válido (é para o recibo do Mercado Pago).');
    if (!this.hub.limitar('lojac:' + conta.id, 8, 600000)) return erro('Devagar! Tente de novo em alguns minutos.', 429);
    const q = this.preco(s, conta, !!(b && b.credito));
    let token = this.env.MP_TOKEN;
    if (!s.oficial) { token = await this.tokenVendedor(s.autor); if (!token) return erro(s.integ ? 'Quem fez esta integração ainda não pode receber. Tente mais tarde.' : 'Quem fez esta skin ainda não pode receber. Tente mais tarde.', 503); }
    const cod = hexA(4), ref = `aerl.${conta.id}.${id}.${cod}`;
    await this.st.put('lpg:' + cod, { comprador: conta.id, skin: id, vendedor: s.oficial ? '' : s.autor, total: q.total, credito: q.credito, t: Date.now() });
    const corpo = { transaction_amount: q.total, description: (s.integ ? 'Integração do Aero: ' : 'Skin do Aero: ') + s.nome, payment_method_id: 'pix', payer: { email }, external_reference: ref, notification_url: url.origin + '/api/loja/mp?c=' + cod, date_of_expiration: new Date(Date.now() + 30 * 60000 - 3 * 3600000).toISOString().replace('Z', '-03:00') };
    if (!s.oficial) corpo.application_fee = q.taxa; // a comissão do Aero (o resto vai direto para quem fez)
    const r = await this.mpApi(token, '/v1/payments', 'POST', corpo, ref);
    const t = (r.d.point_of_interaction && r.d.point_of_interaction.transaction_data) || {};
    if (!r.ok || !r.d.id || !t.qr_code) return erro('Não consegui criar o PIX agora. Tente de novo em instantes.', 502);
    const pg = await this.st.get('lpg:' + cod); pg.pid = String(r.d.id); await this.st.put('lpg:' + cod, pg);
    return resposta({ cod, codigo: t.qr_code, qr: t.qr_code_base64 || '', link: t.ticket_url || '', valor: q.total, desconto: q.desconto, credito: q.credito });
  }
  async conferirPix(conta, cod) {
    if (!this.hub.limitar('lojav:' + conta.id, 40, 60000)) return erro('Devagar!', 429);
    const pg = await this.st.get('lpg:' + cod); if (!pg || pg.comprador !== conta.id || !pg.pid) return erro('Pagamento não encontrado.', 404);
    const st = await this.processar(pg.pid, cod);
    return resposta({ status: st === 'pago' ? 'pago' : st === 'cancelado' ? 'cancelado' : 'pendente' });
  }
  // busca o pagamento no Mercado Pago (com o token de quem vendeu) e dá ou tira a licença
  async processar(pid, cod) {
    const pg = await this.st.get('lpg:' + cod); if (!pg || (pg.pid && pg.pid !== String(pid))) return 'pendente';
    const token = pg.vendedor ? await this.tokenVendedor(pg.vendedor) : this.env.MP_TOKEN; if (!token) return 'pendente';
    const r = await this.mpApi(token, '/v1/payments/' + encodeURIComponent(pid)); if (!r.ok) return 'pendente';
    const p = r.d, m = REF.exec(String(p.external_reference || ''));
    if (!m || m[1] !== pg.comprador || m[2] !== pg.skin || m[3] !== cod) return 'pendente';
    const chave = `lmp:${p.id}`, feito = await this.st.get(chave);
    if (ESTORNO.includes(p.status)) { // devolveram o dinheiro: a licença sai (uma vez só)
      if (feito && !feito.estorno) { feito.estorno = Date.now(); await this.st.put(chave, feito); await this.st.delete(`lic:${pg.comprador}:${pg.skin}`); await this.contarVenda(pg.skin, -1); }
      return 'cancelado';
    }
    if (['rejected', 'cancelled'].includes(p.status)) return 'cancelado';
    const ok = p.status === 'approved' && (!p.status_detail || p.status_detail === 'accredited') && p.currency_id === 'BRL' && +p.transaction_amount >= pg.total - 0.001;
    if (!ok) return 'pendente';
    if (feito) return 'pago';
    await this.st.put(chave, { t: Date.now(), cod, comprador: pg.comprador, skin: pg.skin, valor: +p.transaction_amount });
    await this.st.put(`lic:${pg.comprador}:${pg.skin}`, { t: Date.now(), pid: String(p.id) });
    await this.contarVenda(pg.skin, 1);
    if (pg.credito > 0) { const c = await this.st.get('c:' + pg.comprador); if (c && c.bolha) { const bl = c.bolha; if (bl.lojaCredDe !== bl.desde) { bl.lojaCredDe = bl.desde; bl.lojaCred = 0; } bl.lojaCred = centavos((bl.lojaCred || 0) + pg.credito); await this.st.put('c:' + c.id, c); } }
    return 'pago';
  }
  // o aviso do Mercado Pago (público): o código da compra vem no endereço; a assinatura é conferida como a do Aero Bubble
  async aviso(request, url) {
    if (!this.hub.limitar('lojaw:' + (request.headers.get('CF-Connecting-IP') || 'x'), 120, 60000)) return erro('Devagar!', 429);
    let c = {}; try { c = await request.json(); } catch (_) { /* ok */ }
    const tipo = String(c.type || c.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
    const id = String((c.data && c.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id') || ''), cod = url.searchParams.get('c') || '';
    if (!/^\d{1,20}$/.test(id) || !/^[0-9a-f]{8}$/.test(cod)) return resposta({ ok: true });
    if (!(await this.hub.bolha.conferirAssinatura(request.headers, url, id))) return erro('Não autorizado.', 401);
    if (tipo === 'payment') await this.processar(id, cod);
    return resposta({ ok: true });
  }

  // ---------- quem vende: conecta a própria conta do Mercado Pago (OAuth do marketplace) ----------
  async mpConectar(conta, url) {
    if (!this.env.MP_CLIENT_ID || !this.env.MP_CLIENT_SECRET) return erro('A venda ainda não está disponível.', 503);
    if (nivelDe(conta) < 3 && !(await this.ehDev(conta))) return erro('Vender é do Aero Bubble Donator e do Supporter.', 403);
    const estado = hexA(16); await this.st.put('lmps:' + estado, { conta: conta.id, t: Date.now() });
    const volta = url.origin + '/api/loja/mp/volta';
    return resposta({ url: 'https://auth.mercadopago.com.br/authorization?' + new URLSearchParams({ client_id: this.env.MP_CLIENT_ID, response_type: 'code', platform_id: 'mp', state: estado, redirect_uri: volta }) });
  }
  async mpVolta(url) {
    const pagina = (t) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aero</title><body style="font-family:system-ui;display:grid;place-items:center;height:90vh;margin:0;background:#d8f3ff;color:#0b3b5b"><p>${t}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'X-Frame-Options': 'DENY' } });
    const estado = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    if (!/^[0-9a-f]{32}$/.test(estado) || !/^[A-Za-z0-9_-]{4,200}$/.test(code)) return pagina('Pedido inválido.');
    const e = await this.st.get('lmps:' + estado); await this.st.delete('lmps:' + estado);
    if (!e || Date.now() - e.t > 15 * 60000) return pagina('O pedido expirou. Tente de novo pelo Aero.');
    const r = await this.oauth({ grant_type: 'authorization_code', code, redirect_uri: url.origin + '/api/loja/mp/volta' });
    if (!r) return pagina('O Mercado Pago não confirmou. Tente de novo pelo Aero.');
    await this.st.put('vend:' + e.conta, r);
    return pagina('Pronto! A sua conta do Mercado Pago está conectada. Pode voltar ao Aero.');
  }
  async oauth(corpo) {
    try {
      const r = await fetch(MP + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: this.env.MP_CLIENT_ID, client_secret: this.env.MP_CLIENT_SECRET, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) { console.log('[loja] oauth: ' + r.status); return null; }
      return { tok: d.access_token, ref: d.refresh_token || '', uid: String(d.user_id || ''), exp: Date.now() + (+d.expires_in || 15552000) * 1000 };
    } catch (_) { return null; }
  }
  async tokenVendedor(id) {
    const v = await this.st.get('vend:' + id); if (!v) return '';
    if (v.exp - Date.now() > 86400000) return v.tok;
    if (!v.ref) return '';
    const n = await this.oauth({ grant_type: 'refresh_token', refresh_token: v.ref }); if (!n) return v.exp > Date.now() ? v.tok : '';
    await this.st.put('vend:' + id, n); return n.tok;
  }
  async mpApi(token, caminho, metodo = 'GET', corpo, idem) {
    try {
      const r = await fetch(MP + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(idem ? { 'X-Idempotency-Key': idem } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
      let d = null; try { d = await r.json(); } catch (_) { /* ok */ }
      if (!r.ok) console.log('[loja] Mercado Pago ' + metodo + ' ' + caminho.split('?')[0].replace(/\/\d{4,}$/, '/<id>') + ': ' + r.status);
      return { ok: r.ok, status: r.status, d: d || {} };
    } catch (_) { return { ok: false, status: 0, d: {} }; }
  }

  // ---------- denúncia e remoção ----------
  async denunciar(conta, id, b) {
    const s = await this.st.get('ls:' + id); if (!s || s.removida) return erro('Skin não encontrada.', 404);
    if (!this.hub.limitar('lojad:' + conta.id, 10, 3600000)) return erro('Devagar!', 429);
    const motivo = txt(b && b.motivo, 400); if (!motivo) return erro('Conte o motivo da denúncia.');
    const k = `lden:${id}:${conta.id}`; if (await this.st.get(k)) return resposta({ ok: true });
    await this.st.put(k, { t: Date.now(), motivo, hash: s.hash });
    s.denuncias = (s.denuncias || 0) + 1; await this.st.put('ls:' + id, s);
    return resposta({ ok: true });
  }
  // a equipe vê as skins denunciadas (as mais denunciadas primeiro), para tirar ou deixar
  async denuncias(conta) {
    if (!(await this.hub.admin.cargo(conta))) return erro('Não encontrado', 404);
    const out = [];
    for (const [, s] of await this.st.list({ prefix: 'ls:', limit: 2000 })) if (s.denuncias && !s.removida) {
      const ms = []; for (const [, d] of await this.st.list({ prefix: `lden:${s.id}:`, limit: 20 })) ms.push(d.motivo);
      out.push({ ...(await this.vitrine(s, conta)), denuncias: s.denuncias, motivos: ms });
    }
    return resposta({ skins: out.sort((a, b) => b.denuncias - a.denuncias) });
  }
  // quem fez tira a própria skin; a equipe tira qualquer uma (e aí o hash fica barrado: não volta com outro nome)
  async remover(conta, id, b) {
    const s = await this.st.get('ls:' + id); if (!s) return erro('Skin não encontrada.', 404);
    const equipe = !!(await this.hub.admin.cargo(conta));
    if (s.autor !== conta.id && !equipe) return erro('Só quem fez ou a equipe podem tirar esta skin.', 403);
    s.removida = Date.now(); s.motivo = txt(b && b.motivo, 200); await this.st.put('ls:' + id, s);
    if (equipe && s.autor !== conta.id) { const g = {}; for (const hs of s.hashes || [s.hash]) g['lban:' + hs] = { t: Date.now(), id, por: conta.id }; await this.st.put(g); }
    await this.apagarBytes(s);
    return resposta({ ok: true });
  }
}
