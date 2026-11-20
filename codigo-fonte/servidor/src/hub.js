// Hub: contas, perfis, amigos, estatísticas e presença (quem está online). Uma instância só ("global").
// Cada conta tem 3 identificadores:
//   - código de acesso (secreto, AERO-XXXX-XXXX-XXXX): entra em outros aparelhos. O servidor NÃO guarda o código, só um hash (acesso.js)
//   - código de amigo (público, 6 letras): os outros te adicionam
//   - #tag (público, escolhida por você, única, até 20 caracteres): distingue nomes iguais
// Tudo fica no armazenamento do Durable Object (grátis e persistente).
import { CORS, resposta, erro, txt, aleatorio, hex, enviar, TAG_REGEX, normalizarTag, umEmoji } from './util.js';
import { Social, privDe, bloqueio } from './social.js';
import { capaOk } from './midia.js';
import * as Embeds from './embeds.js';
import { Acesso } from './acesso.js';
import { Admin } from './admin.js';
import { Bolha, planoDe, seloFiel } from './bolha.js';
import { traduzir, dicionario } from './idiomas.js';
import { nivelDe, nmPublico, extrasPublicos, bcPublico, BOLHAS as BOLHAS_PAGAS } from './extras.js';
import { Analytics } from './analytics.js';
import { Integracoes } from './integracoes.js';
import { Loja } from './aer.js';
import { Musica } from './musica.js';
import { Push } from './push.js';
// (1.0.2) os testers oficiais do Aero (pelo ID da conta): ganham o selo "Tester Oficial" no perfil
const TESTERS = new Set([/* os IDs dos testers oficiais ficam só no servidor */]);

const MSG_TAG = 'A # precisa ter de 3 a 20 caracteres: letras, números, _ . ou -';
const par = (a, b) => (a < b ? [a, b] : [b, a]);

// (0.6.0) o nome do aparelho e o sistema só vão para os amigos se a pessoa deixar (Privacidade; o padrão é esconder)
const msgPresenca = (a) => ({
  tipo: 'presenca', codigo: a.codigo, nome: a.nome, tag: a.tag, av: a.av, dispositivo: a.dev,
  maquina: a.esconder ? '' : a.maquina, so: a.esconder ? '' : a.so, ap: a.semAp ? undefined : a.ap || undefined, sov: a.mostraSo ? a.sov || undefined : undefined, estado: a.estado, sala: a.sala, comp: !!a.comp, ins: a.ins || undefined, stc: a.stc ? { t: a.stc.t, c: a.stc.c, i: a.stc.i } : undefined, ouv: ouvPublico(a), jog: jogPublico(a), ass: assPublico(a),
});
// (1.0.0) "Ouvindo agora" (como o do Discord): a música que toca no PC da pessoa. O servidor guarda quando ela começou (ini) e manda aos
// amigos quanto já tocou (dt, contado aqui): cada um calcula a barra pelo próprio relógio, sem depender do relógio de ninguém
const FONTES_OUV = ['spotify', 'ytmusic', 'deezer'];
const CAPA_OUV = /^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com|googleusercontent\.com|ytimg\.com|ggpht\.com|dzcdn\.net|mzstatic\.com)\/[^\s"'<>\\]{1,220}$/i;
const txtOuv = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const limparOuv = (x, agora = Date.now()) => {
  if (!x || typeof x !== 'object' || !FONTES_OUV.includes(x.f)) return null;
  const t = txtOuv(x.t, 80); if (!t) return null;
  const d = Math.round(Number(x.d)); const dur = Number.isFinite(d) && d > 0 && d <= 6 * 3600000 ? d : 0;
  let p = Math.round(Number(x.p)); if (!Number.isFinite(p) || p < 0) p = 0; if (dur) p = Math.min(p, dur);
  const o = { f: x.f, t, a: txtOuv(x.a, 80), al: txtOuv(x.al, 60), d: dur, ini: agora - p };
  if (typeof x.img === 'string' && x.img.length <= 240 && CAPA_OUV.test(x.img)) o.img = x.img;
  const ID = { spotify: /^[A-Za-z0-9]{22}$/, ytmusic: /^[A-Za-z0-9_-]{11}$/, deezer: /^[0-9]{1,14}$/ }[x.f];
  if (typeof x.id === 'string' && ID.test(x.id)) o.id = x.id;
  if (x.k === 'ep') o.k = 'ep'; // (1.0.0) episódio de podcast
  if (typeof x.jn === 'string' && /^[A-Za-z0-9]{4,16}$/.test(x.jn)) o.jn = x.jn; // (1.0.0) ouvindo junto com (o código de quem lidera)
  return o;
};
const ouvPublico = (a, agora = Date.now()) => {
  const o = a && a.ouv; if (!o || !o.t) return undefined;
  const dt = agora - o.ini; if (o.d && dt > o.d + 120000) return undefined; // acabou faz tempo e não veio a próxima: não mostra mais
  const { ini, ...resto } = o; return { ...resto, dt: Math.max(0, dt) };
};
// (1.0.0) "Atividade de jogo" (como a do Discord): o jogo que está aberto no PC, com os detalhes que o próprio jogo manda (pelo SDK do Aero
// ou pelo canal do Discord) ou os da atividade personalizada. Como na música, o servidor guarda quando começou (ini) e quando acaba (fim)
// pelo relógio dele e manda aos amigos quanto já passou (dt) e quanto falta (rest). Imagens só dos sites que a capa() busca.
const TIPOS_JOG = [0, 2, 3, 5], ORIGENS_JOG = ['jogo', 'discord', 'sdk', 'pers'];
const IMG_JOG = /^aero:jg\/[A-Z0-9]{6}\/[0-9a-f]{10}$/; // a foto que a própria pessoa enviou (ícone grande ou pequeno da atividade personalizada)
export const limparJog = (x, agora = Date.now()) => {
  if (!x || typeof x !== 'object') return null;
  const n = txtOuv(x.n, 100); if (!n) return null;
  const o = { n, tp: TIPOS_JOG.includes(x.tp) ? x.tp : 0, o: ORIGENS_JOG.includes(x.o) ? x.o : 'jogo' };
  for (const [k, max] of [['d', 100], ['s', 100], ['lt', 64], ['st', 64]]) { const v = txtOuv(x[k], max); if (v) o[k] = v; }
  for (const k of ['li', 'si']) { const v = typeof x[k] === 'string' && x[k].length <= 300 ? (IMG_JOG.test(x[k]) ? x[k] : capaOk(x[k])) : ''; if (v) o[k] = v; }
  const dt = Number(x.dt); if (Number.isFinite(dt) && dt >= 0 && dt <= 30 * 86400000) o.ini = agora - Math.round(dt);
  const rest = Number(x.rest); if (Number.isFinite(rest) && rest > 0 && rest <= 7 * 86400000) o.fim = agora + Math.round(rest);
  if (Array.isArray(x.p) && x.p.length === 2 && x.p.every((v) => Number.isInteger(v) && v >= 0 && v < 1e6) && x.p[1] > 0) o.p = [Math.min(x.p[0], x.p[1]), x.p[1]];
  if (typeof x.app === 'string' && /^\d{15,25}$/.test(x.app)) o.app = x.app;
  if (x.emu === 1) o.emu = 1;
  if (x.pj === 1) o.pj = 1; // (1.0.2) a partida aceita gente entrando
  if (Array.isArray(x.b)) { // (1.0.2) os botões do jogo (como no Discord): até 2, só https
    const b = x.b.slice(0, 2).map((y) => { if (!y || typeof y !== 'object') return null; const l = txtOuv(y.l, 32); let u = ''; try { const v = new URL(String(y.u || '')); if (v.protocol === 'https:' && v.hostname.includes('.') && !v.username && !v.password && v.href.length <= 300) u = v.href; } catch (e) { /* link torto */ } return l && u ? { l, u } : null; }).filter(Boolean);
    if (b.length) o.b = b;
  }
  const vb = txtOuv(x.vb, 20); if (vb) o.vb = vb; // o que vem antes do nome, escolhido pela pessoa ("Jogando", "Ao vivo na"...)
  if (typeof x.lk === 'string' && x.lk.length <= 300 && /^https:\/\/[^\s"'<>\\]+$/.test(x.lk)) { // o nome clicável (a live): só https
    try { const u = new URL(x.lk); if (u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password) o.lk = u.href; } catch (e) { /* link torto */ }
  }
  return o;
};
const jogPublico = (a, agora = Date.now()) => {
  const j = a && a.jog; if (!j || !j.n) return undefined;
  const { ini, fim, ...r } = j;
  if (ini) r.dt = Math.max(0, agora - ini);
  if (fim) r.rest = Math.max(0, fim - agora);
  return r;
};
// (1.0.0) "Assistindo agora": a live ou o vídeo que passa no navegador (Twitch, Kick, YouTube ou um site que a pessoa adicionou), pela
// extensão. Como na música, o servidor guarda quando começou (ini) e manda quanto já passou (dt). Os links e as imagens só de sites fixos.
const FONTES_ASS = ['twitch', 'kick', 'youtube', 'site'];
const LINK_ASS = {
  twitch: /^https:\/\/www\.twitch\.tv\/[a-z0-9_]{2,25}$/,
  kick: /^https:\/\/kick\.com\/[a-z0-9_-]{2,30}$/,
  youtube: /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/,
  site: /^https:\/\/(?=.{3,80}\/$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\/$/,
};
export const limparAss = (x, agora = Date.now()) => {
  if (!x || typeof x !== 'object' || !FONTES_ASS.includes(x.f)) return null;
  const t = txtOuv(x.t, 100); if (!t) return null;
  const o = { f: x.f, t };
  for (const [k, max] of [['a', 80], ['c', 60], ['vb', 20]]) { const v = txtOuv(x[k], max); if (v) o[k] = v; }
  if (x.f === 'site') {
    o.s = txtOuv(x.s, 40) || 'Site';
    const ic = txtOuv(x.ic, 8); if (ic) o.ic = ic;
    if (typeof x.cor === 'string' && /^#[0-9a-f]{6}$/i.test(x.cor)) o.cor = x.cor.toLowerCase();
  }
  if (typeof x.lk === 'string' && LINK_ASS[x.f].test(x.lk)) o.lk = x.lk;
  if (x.f === 'youtube' && typeof x.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(x.id)) o.id = x.id;
  if (x.f !== 'site' && typeof x.img === 'string' && capaOk(x.img)) o.img = x.img;
  if (x.live === true && x.f !== 'site') o.live = 1;
  const d = Math.round(Number(x.d)); const dur = !o.live && Number.isFinite(d) && d > 0 && d <= 24 * 3600000 ? d : 0;
  let p = Math.round(Number(x.p)); if (!Number.isFinite(p) || p < 0) p = 0; if (dur) p = Math.min(p, dur); else p = Math.min(p, 7 * 86400000);
  o.d = dur; o.ini = agora - p;
  return o;
};
const assPublico = (a, agora = Date.now()) => {
  const o = a && a.ass; if (!o || !o.t) return undefined;
  const dt = agora - o.ini; if (o.d && dt > o.d + 120000) return undefined; // o vídeo acabou faz tempo e não veio outro
  const { ini, ...resto } = o; return { ...resto, dt: Math.max(0, dt) };
};
// (0.8.3) status personalizado: até 30 letras, a cor da bolinha e um ícone (bolinha, controle, monitor ou </>)
const ICONES_STC = ['bolinha', 'controle', 'monitor', 'codigo'];
const limparStc = (x) => {
  if (!x || typeof x !== 'object') return null;
  const t = String(x.t || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const c = /^#[0-9a-f]{6}$/i.test(x.c || '') ? String(x.c).toLowerCase() : '#2fbf71';
  const i = x.i === 'ocupado' ? 'codigo' : ICONES_STC.includes(x.i) ? x.i : 'bolinha'; // o antigo "não perturbe" virou </>
  return x.sn ? { t, c, i, sn: true } : { t, c, i }; // (0.8.6) sn: sem notificações enquanto o status estiver ativo (só a própria conta vê)
};
// (1.0.0) figurinhas sem limite para ninguém (com ou sem assinatura). O teto abaixo é só uma trava técnica de segurança, para a
// lista não crescer sem fim dentro do registro da conta; ninguém chega nele usando o app normalmente
const TRAVA_FIGURINHAS = 5000, MAX_FAV_GIFS = 100, TRAVA_FAV_FIGS = 5000;
const urlGifOk = (u) => typeof u === 'string' && u.length < 400 && /^https:\/\/([a-z0-9-]+\.)*(klipy\.com|klipy\.co)\/[A-Za-z0-9/._~%-]+$/.test(u);
// invisível: para os amigos, este aparelho está offline (ninguém tem como saber que ele está aberto)
const invisivel = (a) => a && a.estado === 'invisivel';

// (0.7.14) na lista de aparelhos conectados só aparece o começo do IP (o bastante para reconhecer a rede, sem guardar o endereço inteiro)
const ipParcial = (ip) => { ip = String(ip || ''); if (!ip || ip === 'x') return ''; if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':') + ':…'; const p = ip.split('.'); return p.length === 4 ? p[0] + '.' + p[1] + '.*.*' : ''; };
const SESSAO_PARADA_MS = 90 * 86400000; // aparelho sem abrir o app por 90 dias precisa entrar de novo

// (0.8.0) modelos de bolha de conversa (o app desenha cada um)
const MODELOS_BOLHA = ['padrao', 'aero', 'aquario', 'sabao', 'neon', 'gibi', 'carta', 'terminal', 'aurora', 'pixel', 'madeira', 'cristal', 'holografico', 'vaporwave', 'doce', 'galaxia', 'lava']; // (1.0.0) + as do Aero Bubble (extras.js)
const BOLHA_COM_CORES = ['sabao', 'aurora']; // (0.8.2) as que aceitam várias cores (g): o anel da Bolha de sabão e o degradê da Aurora

// tentativas que protegem contas (adivinhar código, 2FA, e-mails de recuperação): estas sobrevivem a um reinício do Hub
const LIMITES_SEGUROS = /^(2fa|ent|reg|esq|esqm|emx|tot|ver|verm|lve|temail|troca|sen|sal|qrn|qrv|qrp):/;

export class Hub {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env || {};
    this.acesso = new Acesso(this); // entrar, criar conta, cofre da chave e "esqueci o código" (acesso.js)
    this.tent = new Map(); // limite de tentativas; os de segurança (entrar, 2FA, códigos, e-mails) ficam guardados e não zeram se o Hub reiniciar
    ctx.blockConcurrencyWhile(async () => {
      try { const t = await ctx.storage.get('limites:seg'); if (t) for (const [k, v] of Object.entries(t)) if (Array.isArray(v)) this.tent.set(k, v); } catch (e) { /* começa vazio */ }
    });
    this.tickets = new Map(); // bilhetes de WebSocket (veja novoTicket)
    this.social = new Social(this); // Aero Talk: conversas, grupos, perfil, chamadas (social.js)
    this.bolha = new Bolha(this); // (0.7.14) Aero Bubble: a assinatura (bolha.js)
    this.admin = new Admin(this); // cargos, ID, insígnias, banimentos, denúncias, feedback (admin.js)
    this.musica = new Musica(this); // (0.8.7) a fila do Música junto de cada conversa (musica.js)
    this.push = new Push(this); // (0.9.1) notificações push (push.js)
    this.loja = new Loja(this); // (1.0.0) a loja de skins (.aer)
    this.integ = new Integracoes(this); // (0.8.7) notas, comentários e instalações das Integrações (integracoes.js)
    this.analytics = new Analytics(this); // quantas contas, quem está online, pico por hora (analytics.js; só o desenvolvedor vê)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  get(k) { return this.ctx.storage.get(k); }
  put(o) { return this.ctx.storage.put(o); }

  limitar(chave, max, janelaMs) {
    const agora = Date.now();
    const lista = (this.tent.get(chave) || []).filter((t) => agora - t < janelaMs);
    if (lista.length >= max) return false;
    lista.push(agora);
    this.tent.set(chave, lista);
    if (LIMITES_SEGUROS.test(chave)) this.guardarLimites(agora);
    return true;
  }

  // Grava só os limites de segurança da última hora (a maior janela deles), no máximo 3000 chaves. Sem await: o Durable Object
  // só entrega a resposta depois que a gravação foi confirmada.
  guardarLimites(agora) {
    const o = {}; let n = 0;
    for (const [k, v] of this.tent) {
      if (!LIMITES_SEGUROS.test(k)) continue;
      const vivos = v.filter((t) => agora - t < 3600000);
      if (!vivos.length) { this.tent.delete(k); continue; }
      o[k] = vivos; if (++n >= 3000) break;
    }
    try { this.ctx.storage.put('limites:seg', o); } catch (e) { /* segue só na memória */ }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (p === '/hub') return await this.abrirPresenca(request, url);
      if (p === '/interno/verificar') {
        const c = await this.contaPorToken(request.headers.get('X-Aero-Ticket') ? this.usarTicket(request.headers.get('X-Aero-Ticket')) : request.headers.get('X-Aero-Token'));
        if (c && (await this.admin.banimento(c, null, null))) return erro('Conta suspensa.', 403);
        return c ? resposta({ id: c.id, codigo: c.codigo, nome: c.nome, tag: c.tag, av: c.avatarV || 0, mudo: !!(await this.admin.silenciado(c)) }) : erro('token inválido', 404);
      }
      if (p === '/interno/stats') return await this.somarStats(await request.json());
      if (p.startsWith('/api/')) return await this.api(request, url, p.slice(5));
    } catch (e) {
      console.error(e);
      return erro('Erro no servidor. Tente de novo.', 500);
    }
    return erro('Não encontrado', 404);
  }

  // ---------- contas ----------
  // a sessão guarda a "versão" da conta: trocar ou redefinir o código de acesso derruba as sessões antigas
  // (0.7.14) o token da sessão NÃO fica guardado: só o SHA-256 dele ("sh:<hash>"). Quem ler o armazenamento não consegue entrar em conta
  // nenhuma. Sessões antigas ("s:<token>") passam para o formato novo na primeira vez que forem usadas.
  async chaveSessao(token) {
    const c = this._shCache || (this._shCache = new Map());
    let k = c.get(token);
    if (!k) { k = 'sh:' + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))); if (c.size > 2000) c.clear(); c.set(token, k); }
    return k;
  }
  async sessao(token) {
    if (!token || !/^[0-9a-f]{48}$/.test(token)) return null;
    const k = await this.chaveSessao(token);
    let s = await this.get(k);
    if (!s) { // formato antigo: passa para o novo (e some o token guardado)
      const velho = await this.get('s:' + token);
      if (velho) { s = { ...velho, sid: velho.sid || token.slice(0, 10) }; await this.put({ [k]: s }); await this.ctx.storage.delete('s:' + token); const l = (await this.get('ss:' + s.conta)) || []; if (l.includes(token)) await this.put({ ['ss:' + s.conta]: l.map((x) => (x === token ? k : x)) }); }
    }
    return s ? { k, s } : null;
  }
  // a lista de sessões da conta guarda as chaves (hash); entradas antigas (o token) viram chave aqui
  async listaSessoes(contaId) {
    const l = (await this.get('ss:' + contaId)) || [];
    if (l.every((x) => x.startsWith('sh:'))) return l;
    const nova = [];
    for (const x of l) { if (x.startsWith('sh:')) nova.push(x); else { const r = await this.sessao(x); if (r) nova.push(r.k); } }
    await this.put({ ['ss:' + contaId]: [...new Set(nova)] });
    return [...new Set(nova)];
  }
  async novaSessao(conta, meta = {}) {
    const token = hex(crypto.getRandomValues(new Uint8Array(24)));
    const sid = hex(crypto.getRandomValues(new Uint8Array(5))); // o id que aparece em "aparelhos conectados" (não é parte do token)
    await this.put({ [await this.chaveSessao(token)]: { conta: conta.id, criado: Date.now(), v: conta.sv || 0, sid, ip: ipParcial(meta.ip), visto: Date.now() } });
    await this.indexarSessao(conta.id, token);
    return token;
  }
  // aparelhos conectados (Configurações): a lista de sessões de cada conta
  async indexarSessao(contaId, token) {
    const k = await this.chaveSessao(token), l = await this.listaSessoes(contaId);
    if (l.includes(k)) return;
    const vivos = [];
    for (const t of [...l, k]) { const s = await this.get(t); if (s && s.conta === contaId) vivos.push(t); }
    await this.put({ ['ss:' + contaId]: vivos.slice(-30) });
  }
  async sessoes(conta, tokenAtual) {
    const out = [], atual = await this.chaveSessao(tokenAtual);
    for (const t of await this.listaSessoes(conta.id)) {
      const s = await this.get(t); if (!s || s.conta !== conta.id || (s.v || 0) !== (conta.sv || 0)) continue;
      const online = this.ctx.getWebSockets('c:' + conta.id).some((w) => { const a = w.deserializeAttachment(); return a && a.sid === s.sid; });
      out.push({ id: s.sid, ip: ipParcial(s.ip), maquina: s.maquina || '', so: s.so || '', criado: s.criado, visto: s.visto || s.criado, atual: t === atual, online });
    }
    return resposta({ sessoes: out.sort((a, b) => b.visto - a.visto) });
  }
  async removerSessao(conta, sid, tokenAtual) {
    const l = await this.listaSessoes(conta.id), atual = await this.chaveSessao(tokenAtual);
    let t = null, sidT = '';
    for (const x of l) { const s = await this.get(x); if (s && s.sid === String(sid || '')) { t = x; sidT = s.sid; break; } }
    if (!t) return erro('Aparelho não encontrado.', 404);
    if (t === atual) return erro('Este é o aparelho que você está usando: use "Sair da conta".');
    await this.ctx.storage.delete(t);
    await this.put({ ['ss:' + conta.id]: l.filter((x) => x !== t) });
    for (const w of this.ctx.getWebSockets('c:' + conta.id)) { const a = w.deserializeAttachment(); if (a && a.sid === sidT) { try { w.send(JSON.stringify({ tipo: 'erro', codigo: 'removida', msg: 'Sessão encerrada em outro aparelho.' })); w.close(4001, 'sessao'); } catch (_) { /* ok */ } } }
    return resposta({ ok: true });
  }

  async removerOutras(conta, tokenAtual) { // (0.6.0) "Desconectar todos os outros aparelhos"
    const l = await this.listaSessoes(conta.id), atual = await this.chaveSessao(tokenAtual), eu = await this.get(atual);
    for (const t of l) if (t !== atual) await this.ctx.storage.delete(t);
    await this.put({ ['ss:' + conta.id]: l.filter((x) => x === atual) });
    this.derrubarOutros(conta.id, eu && eu.sid);
    return resposta({ ok: true });
  }
  derrubarOutros(contaId, sidAtual) {
    for (const w of this.ctx.getWebSockets('c:' + contaId)) {
      const a = w.deserializeAttachment(); if (!a) continue;
      try { if (a.sid === sidAtual) w.close(4000, 'nova-sessao'); else { w.send(JSON.stringify({ tipo: 'erro', codigo: 'removida', msg: 'Sessão encerrada em outro aparelho.' })); w.close(4001, 'sessao'); } } catch (_) { /* ok */ }
    }
  }

  async contaPorToken(token) {
    const r = await this.sessao(token); if (!r) return null;
    const s = r.s;
    if (s.visto && Date.now() - s.visto > SESSAO_PARADA_MS) { await this.ctx.storage.delete(r.k); return null; } // (0.7.8) aparelho esquecido não fica entrando para sempre; sessão antiga sem "visto" ganha a data na próxima conexão
    const c = s && (await this.get('c:' + s.conta));
    return c && (s.v || 0) === (c.sv || 0) ? c : null;
  }

  // (0.7.8) bilhete de uso único (60 s) para abrir uma conexão WebSocket: o navegador não deixa mandar cabeçalho nela, e o token da sessão no endereço
  // acabaria em registros. Fica só na memória: se o servidor reiniciar nesse minuto, o app pede outro ao reconectar.
  novoTicket(token) {
    const agora = Date.now();
    for (const [t, x] of this.tickets) if (x.ate < agora) this.tickets.delete(t);
    const ticket = hex(crypto.getRandomValues(new Uint8Array(32)));
    this.tickets.set(ticket, { token, ate: agora + 60000 });
    return ticket;
  }
  usarTicket(ticket) {
    const x = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return x && x.ate >= Date.now() ? x.token : null;
  }

  async tagLivre(tag, ignorarId) {
    const dono = await this.get('t:' + tag.toLowerCase());
    return !dono || dono === ignorarId;
  }

  async gerarTag(nome) {
    const base = nome.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').slice(0, 14) || 'Usuario';
    for (let i = 0; i < 20; i++) {
      const t = base + String(Math.floor(Math.random() * 9000) + 1000);
      if (await this.tagLivre(t)) return t;
    }
    return base + aleatorio(5);
  }

  // Contas antigas (Fase 2) não tinham # : ganham uma automática, que a pessoa pode trocar.
  async garantirTag(conta) {
    if (conta.tag) return conta;
    conta.tag = await this.gerarTag(conta.nome);
    conta.avatarV = conta.avatarV || 0;
    await this.put({ ['c:' + conta.id]: conta, ['t:' + conta.tag.toLowerCase()]: conta.id });
    return conta;
  }

  // (0.8.0) os selos que aparecem no perfil: desenvolvedor ou moderador oficial, e o plano do Aero Bubble
  // (1.0.2) os selos que aparecem junto do nome (chat, listas): só os que a pessoa deixou aparecendo no perfil (Perfil > Insígnias)
  async selosVisiveis(o) { const sl = await this.selos(o), pf = (o.extra || {}).pf || {}; if (pf.si === false) return []; return Array.isArray(pf.so) && pf.so.length ? sl.filter((x) => !pf.so.includes('s:' + x)) : sl; }
  async selos(o) { const out = [], cg = await this.admin.cargo(o), p = planoDe(o); if (cg) out.push(cg); else if (o.seloMod) out.push('mod'); if (TESTERS.has(o.uid)) out.push('tester'); if (p) out.push(p); const f = seloFiel(o); if (f) out.push(f); if (o.fundador) out.push('fundador'); return out.length ? out : undefined; } // (1.0.0) + o selo da fidelidade e o Fundador 1.0

  async lista(conta) {
    const out = [];
    for (const [oid, info] of Object.entries(conta.amigos)) {
      const o = await this.get('c:' + oid);
      if (o) out.push({ codigo: o.codigo, nome: o.nome, tag: o.tag || '', av: o.avatarV || 0, ins: o.ins || [], sl: await this.selosVisiveis(o), bc: bcPublico((o.extra || {}).bc, nivelDe(o)), nm: nmPublico((o.extra || {}).nm, nivelDe(o)), np: (o.extra || {}).np || undefined, npV: (o.extra || {}).npV || undefined, bannerV: (o.extra || {}).bannerV || undefined, estado: info.estado, confia: !!info.confia, avisarOnline: !!info.avisarOnline, desde: info.desde || 0, apelido: (conta.apelidos || {})[oid] || '', extra: info.estado === 'aceita' ? this.extraPublico(o) : undefined });
    }
    return out;
  }

  // banner, cores, bio, Discord e música do Spotify (o que a pessoa escolheu mostrar)
  extraPublico(o) { const e = o.extra || {}; return { bio: e.bio || '', cor1: e.cor1 || '', cor2: e.cor2 || '', fundo1: e.fundo1 || '', fundo2: e.fundo2 || '', discord: e.discord || '', spotify: e.spotify || null, ml: e.ml || '', mv: e.mv || 0, lb: e.lb || '', gl: e.gl || '', lbf: e.lbf || null, bannerV: e.bannerV || 0, bc: bcPublico(e.bc, nivelDe(o)) || null, nm: nmPublico(e.nm, nivelDe(o)) || null, fd: e.fd || null, np: e.np || null, npV: e.npV || 0, fdV: e.fdV || 0, mf: e.mf || null, mfV: e.mfV || 0, pf: e.pf || null, dg: e.dg || null, fz: e.fz || '', ...extrasPublicos(e, nivelDe(o)) }; }

  async perfilPublico(conta, codigo) {
    const oid = await this.get('f:' + codigo.toUpperCase());
    const o = oid && (await this.get('c:' + oid));
    if (!o || (o.bloqueados || {})[conta.id]) return erro('Perfil não encontrado.', 404); // (0.6.0) quem te bloqueou não aparece para você
    const rel = conta.amigos[oid];
    if ((conta.bloqueados || {})[oid]) return resposta({ codigo: o.codigo, nome: o.nome, tag: o.tag || '', av: 0, bloqueado: true });
    // (0.5.9-6) o ID da conta (fixo, ao contrário da #) só vai para o desenvolvedor; contas que ainda não tinham ganham um agora
    // (0.8.6) "visto por último": só se as duas pessoas deixam (como a confirmação de leitura)
    // "atividade": a última vez que mexeu no app (ou saiu, o que for mais recente); "saida": só a hora em que saiu. Invisível não conta nada
    const pv = privDe(o), podeVisto = oid !== conta.id && pv.visto && privDe(conta).visto;
    const vs = podeVisto ? (await this.get('vs:' + oid)) || 0 : 0, va = podeVisto && pv.vistoModo === 'atividade' ? (await this.get('va:' + oid)) || 0 : 0;
    const visto = Math.max(vs, va) || undefined, vm = visto && pv.vistoModo === 'atividade' ? 'atividade' : undefined;
    let uid, assinatura; if (await this.admin.ehDev(conta)) { if (!o.uid) await this.admin.garantir(o); uid = o.uid; assinatura = await this.bolha.resumoDev(o); } // (0.8.2) a assinatura também, só para o desenvolvedor
    return resposta({ uid, assinatura, codigo: o.codigo, nome: o.nome, tag: o.tag || '', av: o.avatarV || 0, ins: o.ins || [], sl: await this.selos(o), criado: o.criado, visto, vm, amizade: rel ? rel.estado : null, avisarOnline: !!(rel && rel.avisarOnline), podeMensagem: oid !== conta.id && this.social.podeEscrever(conta, o), apelido: (conta.apelidos || {})[oid] || '', ...this.extraPublico(o), fz: oid === conta.id || (rel && rel.estado === 'aceita') ? ((o.extra || {}).fz || '') : '', ...this.exclusivos(conta, o, rel) });
  }

  // (1.0.2) perfil exclusivo: um amigo pode ter um jeito do perfil só para você (bio e cores). Você vê o exclusivo e escolhe ver o público
  exclusivos(conta, o, rel) {
    if (!rel || rel.estado !== 'aceita' || o.id === conta.id) return {};
    const exc = nivelDe(o) >= 4 ? ((o.extra || {}).pp || {})[conta.id] : null, meu = ((conta.extra || {}).pp || {})[o.id];
    return { exc: exc || undefined, meuExc: meu || undefined };
  }
  async perfilExclusivo(conta, b) {
    if (nivelDe(conta) < 4) return erro('O perfil exclusivo é do Aero Bubble Supporter.', 403);
    const oid = await this.get('f:' + String(b.codigo || '').toUpperCase()), rel = oid && conta.amigos[oid];
    if (!rel || rel.estado !== 'aceita') return erro('Só dá para fazer um perfil exclusivo para um amigo.', 404);
    conta.extra = conta.extra || {}; const pp = (conta.extra.pp = conta.extra.pp || {});
    if (b.apagar) delete pp[oid];
    else {
      const COR = /^#[0-9a-f]{6}$/i;
      if (!pp[oid] && Object.keys(pp).length >= 30) return erro('Você já tem 30 perfis exclusivos. Apague um antes.', 400);
      const x = { bio: txt(String(b.bio || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ''), 190), cor1: COR.test(b.cor1) ? b.cor1.toLowerCase() : '', cor2: COR.test(b.cor2) ? b.cor2.toLowerCase() : '' };
      if (!x.bio && !x.cor1 && !x.cor2) delete pp[oid]; else pp[oid] = x;
    }
    if (!Object.keys(pp).length) delete conta.extra.pp;
    await this.put({ ['c:' + conta.id]: conta }); await this.mudou([oid]);
    return resposta({ ok: true, meuExc: pp[oid] || null });
  }

  async banner(codigo) { return this.servirImagem('bn:', codigo); }

  // ---------- foto e banner (0.5.9-4): GIF animado de até 20 MB ----------
  // Chegam em binário (não em base64), são comprimidos SEM PERDA (gzip: a imagem sai idêntica) e guardados em pedaços de 1 MB (o limite de
  // cada valor do armazenamento). Quem pede recebe já comprimido (Content-Encoding: gzip) e o navegador abre sozinho.
  async guardarImagem(prefixo, id, bytes, mime) {
    let dados = bytes, gz = false;
    try {
      const comp = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      if (comp.length < bytes.length * 0.97) { dados = comp; gz = true; }
    } catch (_) { /* sem compressão: guarda como veio */ }
    const antigo = await this.get(prefixo + id);
    const partes = Math.ceil(dados.length / 1048576), grava = {};
    for (let i = 0; i < partes; i++) grava[`${prefixo}${id}:p${i}`] = dados.slice(i * 1048576, (i + 1) * 1048576);
    grava[prefixo + id] = { mime, partes, tam: dados.length, gz, original: bytes.length };
    const chaves = Object.keys(grava);
    for (let i = 0; i < chaves.length; i += 100) { const lote = {}; for (const k of chaves.slice(i, i + 100)) lote[k] = grava[k]; await this.ctx.storage.put(lote); }
    if (antigo && antigo.partes) for (let i = partes; i < antigo.partes; i++) await this.ctx.storage.delete(`${prefixo}${id}:p${i}`);
  }
  async apagarImagem(prefixo, id) {
    const a = await this.get(prefixo + id);
    if (a && a.partes) for (let i = 0; i < a.partes; i++) await this.ctx.storage.delete(`${prefixo}${id}:p${i}`);
    await this.ctx.storage.delete(prefixo + id);
  }
  async servirImagem(prefixo, codigo) { return this.servirImagemId(prefixo, await this.get('f:' + String(codigo).toUpperCase())); }
  async servirImagemId(prefixo, id) {
    const a = id && (await this.get(prefixo + id));
    if (!a) return new Response('sem imagem', { status: 404, headers: CORS });
    const cab = { ...CORS, 'Content-Type': a.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' };
    if (a.b64) return new Response(Uint8Array.from(atob(a.b64), (c) => c.charCodeAt(0)), { headers: cab }); // formato antigo
    const out = new Uint8Array(a.tam); let o = 0;
    for (let i = 0; i < a.partes; i++) { const p = new Uint8Array(await this.get(`${prefixo}${id}:p${i}`)); out.set(p, o); o += p.length; }
    if (a.gz) return new Response(out, { headers: { ...cab, 'Content-Encoding': 'gzip' }, encodeBody: 'manual' });
    return new Response(out, { headers: cab });
  }
  async subirImagem(conta, tipo, request) {
    if (!this.limitar('img:' + conta.id, 10, 600000)) return erro('Devagar! Tente de novo em alguns minutos.', 429);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(gif|jpeg|png|webp)$/.test(mime)) return erro('Imagem inválida.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 20 * 1048576) return erro('Imagem grande demais (máximo 20 MB).', 413);
    if (mime === 'image/gif' && !(bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)) return erro('Esse arquivo não é um GIF.');
    if (tipo === 'avatar') {
      await this.guardarRecente(conta);
      await this.guardarImagem('a:', conta.id, bytes, mime);
      conta.avatarV = (conta.avatarV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
      await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
      return resposta({ ok: true, av: conta.avatarV });
    }
    if (tipo === 'nameplate') { // (0.8.0) a imagem do fundo do nome na lista (nameplate)
      await this.guardarImagem('np:', conta.id, bytes, mime);
      conta.extra = conta.extra || {}; conta.extra.npV = (conta.extra.npV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
      await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
      return resposta({ ok: true, npV: conta.extra.npV });
    }
    if (tipo === 'fundo') { // (0.8.5) uma imagem (ou GIF) só para o fundo do cartão do perfil, além do banner
      await this.guardarImagem('fd:', conta.id, bytes, mime);
      conta.extra = conta.extra || {}; conta.extra.fdV = (conta.extra.fdV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
      await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
      return resposta({ ok: true, fdV: conta.extra.fdV });
    }
    if (tipo === 'ligacao') { // (1.0.0) o cartão de ligação: a imagem que aparece no aviso de quem você liga (Donator ou acima)
      if (nivelDe(conta) < 3) return erro('O cartão de ligação é do Aero Bubble Donator e Supporter.', 403);
      await this.guardarImagem('cl:', conta.id, bytes, mime);
      conta.extra = conta.extra || {}; conta.extra.clV = (conta.extra.clV || 0) + 1; conta.extra.cl = 1; await this.put({ ['c:' + conta.id]: conta });
      await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
      return resposta({ ok: true, clV: conta.extra.clV });
    }
    if (tipo === 'acessorio') { // (1.0.0) uma imagem ou GIF para pôr como acessório no cartão (no lugar de um emoji)
      if (nivelDe(conta) < 3) return erro('Os acessórios são do Aero Bubble Donator e Supporter.', 403);
      if (bytes.length > 8 * 1048576) return erro('Imagem grande demais (máximo 8 MB).', 413);
      const id = hex(crypto.getRandomValues(new Uint8Array(5)));
      await this.guardarImagem('ax:', conta.id + ':' + id, bytes, mime);
      conta.extra = conta.extra || {};
      // guarda as 12 mais novas; as que estão no cartão agora nunca saem
      const usadas = new Set((conta.extra.ac || []).map((a) => a && a.i).filter(Boolean)), lista = [id, ...(conta.extra.axs || []).filter((x) => x !== id)];
      const fica = [], sai = [];
      for (const x of lista) (usadas.has(x) || fica.filter((y) => !usadas.has(y)).length < 12 ? fica : sai).push(x);
      for (const x of sai) await this.apagarImagem('ax:', conta.id + ':' + x);
      conta.extra.axs = fica; await this.put({ ['c:' + conta.id]: conta });
      return resposta({ ok: true, id, codigo: conta.codigo });
    }
    if (tipo === 'jogo') { // (1.0.0) a foto do jogo (ícone grande ou pequeno) da atividade personalizada: para todos
      if (bytes.length > 4 * 1048576) return erro('Imagem grande demais (máximo 4 MB).', 413);
      const id = hex(crypto.getRandomValues(new Uint8Array(5)));
      await this.guardarImagem('jg:', conta.id + ':' + id, bytes, mime);
      conta.extra = conta.extra || {};
      const lista = [id, ...(conta.extra.jgs || []).filter((x) => x !== id)], fica = lista.slice(0, 24); // as 24 mais novas
      for (const x of lista.slice(24)) await this.apagarImagem('jg:', conta.id + ':' + x);
      conta.extra.jgs = fica; await this.put({ ['c:' + conta.id]: conta });
      return resposta({ ok: true, id, codigo: conta.codigo, ref: 'aero:jg/' + conta.codigo + '/' + id });
    }
    if (tipo === 'mural') { // (0.8.7) uma imagem (ou GIF) só para o fundo do Mural
      await this.guardarImagem('mf:', conta.id, bytes, mime);
      conta.extra = conta.extra || {}; conta.extra.mfV = (conta.extra.mfV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
      await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
      return resposta({ ok: true, mfV: conta.extra.mfV });
    }
    await this.guardarImagem('bn:', conta.id, bytes, mime);
    conta.extra = conta.extra || {}; conta.extra.bannerV = (conta.extra.bannerV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
    await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, bannerV: conta.extra.bannerV });
  }

  // (0.6.0) fotos de perfil recentes: a foto que sai vai para um histórico (até 6), e dá para voltar a usar qualquer uma
  async guardarRecente(conta) {
    const a = await this.get('a:' + conta.id); if (!a) return;
    const v = conta.avatarV || 0, lista = (conta.avRecentes || []).filter((x) => x !== v);
    const bytes = a.b64 ? Uint8Array.from(atob(a.b64), (c) => c.charCodeAt(0)) : await this.lerImagem('a:', conta.id);
    if (!bytes) return;
    await this.guardarImagem('ar:', conta.id + ':' + v, bytes, a.mime);
    lista.unshift(v);
    for (const velha of lista.slice(6)) await this.apagarImagem('ar:', conta.id + ':' + velha);
    conta.avRecentes = lista.slice(0, 6);
  }
  async lerImagem(prefixo, id) {
    const a = await this.get(prefixo + id); if (!a || !a.partes) return null;
    const out = new Uint8Array(a.tam); let o = 0;
    for (let i = 0; i < a.partes; i++) { const p = new Uint8Array(await this.get(`${prefixo}${id}:p${i}`)); out.set(p, o); o += p.length; }
    if (!a.gz) return out;
    return new Uint8Array(await new Response(new Blob([out]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  async usarRecente(conta, v) {
    v = parseInt(v, 10) || 0;
    if (!(conta.avRecentes || []).includes(v)) return erro('Foto não encontrada.', 404);
    const a = await this.get('ar:' + conta.id + ':' + v); const bytes = a && (await this.lerImagem('ar:', conta.id + ':' + v));
    if (!bytes) return erro('Foto não encontrada.', 404);
    await this.guardarRecente(conta);
    await this.guardarImagem('a:', conta.id, bytes, a.mime);
    conta.avatarV = (conta.avatarV || 0) + 1; await this.put({ ['c:' + conta.id]: conta });
    await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, av: conta.avatarV });
  }

  // ---------- figurinhas (0.6.0): cada conta cria as suas (PNG/JPG/GIF, todas no mesmo tamanho); qualquer um vê pelo endereço ----------
  async novaFigurinha(conta, request) {
    if (!this.limitar('fig:' + conta.id, 30, 600000)) return erro('Devagar! Tente de novo em alguns minutos.', 429);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(gif|jpeg|png|webp)$/.test(mime)) return erro('Imagem inválida.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 2 * 1048576) return erro('Figurinha grande demais (máximo 2 MB).', 413);
    const lista = conta.figurinhas || [];
    if (lista.length >= TRAVA_FIGURINHAS) return erro('Não deu para criar a figurinha agora.');
    const id = hex(crypto.getRandomValues(new Uint8Array(5)));
    await this.guardarImagem('fg:', conta.id + ':' + id, bytes, mime);
    conta.figurinhas = [{ id, t: Date.now() }, ...lista]; await this.put({ ['c:' + conta.id]: conta });
    return resposta({ ok: true, id, figurinhas: conta.figurinhas });
  }
  // ---------- (1.0.0) emojis próprios (Aero Bubble): Plus 10, Donator 30 (com animados), Supporter 100. Vão no meio do texto como <em:CODIGO:ID:nome> ----------
  async novoEmoji(conta, request) {
    if (!this.limitar('emj:' + conta.id, 40, 600000)) return erro('Devagar! Tente de novo em alguns minutos.', 429);
    const nv = nivelDe(conta), max = nv >= 4 ? 100 : nv >= 3 ? 30 : nv >= 2 ? 10 : 0;
    if (!max) return erro('Emojis próprios são do Aero Bubble Plus, Donator e Supporter.', 403);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(gif|png|webp)$/.test(mime)) return erro('Imagem inválida.');
    if (mime === 'image/gif' && nv < 3) return erro('Emojis animados são do Donator e do Supporter.', 403);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 512 * 1024) return erro('Emoji grande demais (máximo 512 KB).', 413);
    if (mime === 'image/gif' && !(bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)) return erro('Esse arquivo não é um GIF.');
    const n = String(new URL(request.url).searchParams.get('n') || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    if (n.length < 2) return erro('Dê um nome de 2 a 24 letras (a-z, 0-9 e _).');
    const lista = conta.emojis || [];
    if (lista.length >= max) return erro(`Você já tem ${max} emojis. Apague algum para criar outro.`);
    if (lista.some((e) => e.n === n)) return erro('Você já tem um emoji com esse nome.');
    const id = hex(crypto.getRandomValues(new Uint8Array(5)));
    await this.guardarImagem('em:', conta.id + ':' + id, bytes, mime);
    conta.emojis = [...lista, { id, n, a: mime === 'image/gif' ? 1 : 0 }]; await this.put({ ['c:' + conta.id]: conta });
    return resposta({ ok: true, id, emojis: conta.emojis, codigo: conta.codigo });
  }
  async apagarEmoji(conta, id) {
    conta.emojis = (conta.emojis || []).filter((e) => e.id !== id);
    await this.apagarImagem('em:', conta.id + ':' + id); await this.put({ ['c:' + conta.id]: conta });
    return resposta({ ok: true, emojis: conta.emojis });
  }
  // o emoji só aparece enquanto o plano de quem criou cobre (o animado, do Donator para cima); fora disso, o app mostra :nome:
  async servirEmoji(cod, id) {
    const cid = await this.get('f:' + cod.toUpperCase()), dono = cid && (await this.get('c:' + cid));
    const e = dono && (dono.emojis || []).find((x) => x.id === id), nv = nivelDe(dono);
    if (!e || nv < 2 || (e.a && nv < 3)) return new Response('', { status: 404, headers: CORS });
    return this.servirImagemId('em:', cid + ':' + id);
  }
  async apagarFigurinha(conta, id) {
    conta.figurinhas = (conta.figurinhas || []).filter((f) => f.id !== id);
    await this.apagarImagem('fg:', conta.id + ':' + id); await this.put({ ['c:' + conta.id]: conta });
    return resposta({ ok: true, figurinhas: conta.figurinhas });
  }

  // ---------- GIFs (0.6.0): busca no Klipy pelo servidor (a chave fica só aqui: KLIPY_APP_KEY) e favoritos da conta ----------
  async gifs(conta, url) {
    const chave = this.env.KLIPY_APP_KEY;
    if (!chave) return erro('A busca de GIFs ainda não foi configurada no servidor.', 503);
    if (!this.limitar('gif:' + conta.id, 60, 60000)) return erro('Devagar!', 429);
    const q = txt(url.searchParams.get('q') || '', 60), pag = Math.max(1, Math.min(20, parseInt(url.searchParams.get('pag'), 10) || 1));
    const base = `https://api.klipy.com/api/v1/${encodeURIComponent(chave)}/gifs/${q ? 'search' : 'trending'}`;
    const qs = new URLSearchParams({ page: String(pag), per_page: '24', customer_id: conta.codigo, locale: 'pt', content_filter: 'medium' }); if (q) qs.set('q', q);
    let d; try { const r = await fetch(base + '?' + qs); d = await r.json(); } catch (_) { return erro('A busca de GIFs não respondeu. Tente de novo.', 502); }
    const lista = ((d && d.data && d.data.data) || []).map((g) => {
      const f = g.file || {}, pega = (t) => (f[t] && (f[t].gif || f[t].webp)) || null, grande = pega('hd') || pega('md'), peq = pega('sm') || pega('xs') || grande;
      return grande && peq ? { id: String(g.slug || g.id), url: grande.url, prev: peq.url, w: grande.width || 0, h: grande.height || 0, titulo: txt(g.title || '', 80) } : null;
    }).filter((g) => g && urlGifOk(g.url) && urlGifOk(g.prev));
    return resposta({ gifs: lista, mais: !!(d && d.data && d.data.has_next) });
  }
  // (0.7.1) dados de um link para o embed do chat: link de página do Klipy (klipy.com/gifs/nome) vira o GIF de verdade; vídeo do YouTube
  // ganha o título e o canal (o oEmbed do YouTube não responde para páginas de outro site, então quem pergunta é o servidor). Guardado 1 h.
  async embed(conta, url) {
    const u = txt(url.searchParams.get('u') || '', 400);
    if (!this.limitar('emb:' + conta.id, 120, 60000)) return erro('Devagar!', 429);
    this.cacheEmbed = this.cacheEmbed || new Map();
    const ja = this.cacheEmbed.get(u); if (ja && Date.now() - ja.t < 3600000) return resposta(ja.d);
    let d = null;
    const k = /^https:\/\/(?:www\.)?klipy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(gifs|stickers)\/([a-z0-9-]{1,120})\/?(?:[?#].*)?$/i.exec(u);
    const yt = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u);
    // (0.9.5) post do Twitter/X (e dos espelhos fxtwitter/vxtwitter/fixupx): texto, autor, números e as fotos/vídeos, pela API pública do FxTwitter
    const tw = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com)\/([A-Za-z0-9_]{1,15}|i\/web|i)\/status(?:es)?\/(\d{5,25})/i.exec(u);
    if (Embeds.RE_SPOTIFY.test(u)) { // (1.0.2) Spotify: a capa, a cor e o trecho de cada faixa
      try { d = await Embeds.spotify(u); } catch (_) { d = null; }
    } else if (Embeds.RE_REDDIT.test(u)) { // (1.0.2) Reddit: fotos (até 20), vídeo com som, texto e números
      try { d = await Embeds.reddit(u); } catch (_) { d = null; }
    } else if (Embeds.RE_LOJA.test(u)) { // (1.0.2) Amazon e AliExpress: preço, imposto, fotos e avaliações
      try { d = await Embeds.loja(u); } catch (_) { d = null; }
    } else if (tw) {
      try {
        const r = await fetch('https://api.fxtwitter.com/status/' + tw[2], { headers: { 'User-Agent': 'AeroStream-embed/1.0' } });
        const j = r.ok ? await r.json() : null, t = j && j.tweet;
        if (t && t.author) {
          const img = (x) => (typeof x === 'string' && /^https:\/\/pbs\.twimg\.com\/[^\s"'<>]{1,300}$/.test(x) ? x : '');
          const vid = (x) => (typeof x === 'string' && /^https:\/\/video\.twimg\.com\/[^\s"'<>]{1,400}$/.test(x) ? x : '');
          const mp4 = (m) => { const l = (m.formats || []).filter((f) => f && f.container === 'mp4' && vid(f.url)).sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0)); const bom = l.filter((f) => (f.bitrate || 0) <= 2300000).pop() || l[0]; return (bom && bom.url) || vid(m.url); };
          const num = (x) => (x != null && x !== '' && Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : null);
          const midias = ((t.media && t.media.all) || []).slice(0, 4).map((m) => {
            if (m.type === 'photo') { const f = img(m.url); return f ? { tipo: 'foto', url: f.replace(/\?.*$/, ''), w: num(m.width) || 0, h: num(m.height) || 0 } : null; }
            if (m.type === 'video' || m.type === 'gif') { const v = mp4(m); return v ? { tipo: m.type === 'gif' ? 'gif' : 'video', url: v, capa: img(m.thumbnail_url), w: num(m.width) || 0, h: num(m.height) || 0, dur: Math.round(+m.duration || 0) } : null; }
            return null;
          }).filter(Boolean);
          const a = t.author;
          d = { tipo: 'tweet', url: 'https://x.com/' + txt(a.screen_name || 'i', 15) + '/status/' + tw[2], texto: txt(t.text || '', 1200), t: num(t.created_timestamp) ? num(t.created_timestamp) * 1000 : 0,
            autor: { nome: txt(a.name || '', 60), nick: txt(a.screen_name || '', 15), av: img(a.avatar_url), ok: !!(a.verification && a.verification.verified) },
            resp: num(t.replies), rt: num(t.retweets), cur: num(t.likes), views: num(t.views), sens: !!t.possibly_sensitive, midias };
        }
      } catch (_) { d = null; }
    } else if (k) {
      const chave = this.env.KLIPY_APP_KEY; if (!chave) return erro('GIFs não configurados.', 503);
      try {
        const r = await fetch(`https://api.klipy.com/api/v1/${encodeURIComponent(chave)}/${k[1].toLowerCase()}/${k[2].toLowerCase()}?customer_id=${encodeURIComponent(conta.codigo)}`);
        const j = await r.json();
        const g = (j && j.data && (j.data.file ? j.data : (j.data.data && j.data.data[0]))) || null, f = (g && g.file) || {};
        const pega = (t) => (f[t] && (f[t].gif || f[t].webp)) || null, gr = pega('hd') || pega('md') || pega('sm');
        if (gr && urlGifOk(gr.url)) d = { tipo: 'gif', url: gr.url, w: gr.width || 0, h: gr.height || 0, titulo: txt((g && g.title) || '', 80) };
      } catch (_) { d = null; }
    } else if (yt) {
      try {
        const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + yt[1]));
        if (r.ok) { const j = await r.json(); d = { tipo: 'youtube', id: yt[1], titulo: txt(j.title || '', 200), autor: txt(j.author_name || '', 80) }; }
      } catch (_) { d = null; }
    }
    if (!d) return erro('Sem embed para este link.', 404);
    if (this.cacheEmbed.size > 500) this.cacheEmbed.clear();
    this.cacheEmbed.set(u, { t: Date.now(), d });
    return resposta(d);
  }
  async favoritarGif(conta, b) {
    const g = b && b.gif;
    let l = (conta.gifsFav || []).filter((x) => !g || x.url !== g.url);
    if (b.sim) {
      if (!g || !urlGifOk(g.url) || (g.prev && !urlGifOk(g.prev))) return erro('GIF inválido.');
      l.unshift({ url: g.url, prev: g.prev || g.url, w: Math.max(0, Math.min(4096, +g.w || 0)), h: Math.max(0, Math.min(4096, +g.h || 0)), ...(g.titulo ? { titulo: txt(g.titulo, 120) } : {}) }); // (0.8.5) o nome, para procurar dentro dos favoritos
    }
    conta.gifsFav = l.slice(0, MAX_FAV_GIFS); await this.put({ ['c:' + conta.id]: conta });
    for (const w of this.ctx.getWebSockets('c:' + conta.id)) { try { w.send(JSON.stringify({ tipo: 'gifs-fav' })); } catch (_) { /* ok */ } }
    return resposta({ ok: true, favoritos: conta.gifsFav });
  }

  // (0.8.5) figurinhas favoritas: as de qualquer pessoa (vistas no chat), guardadas na conta como os GIFs favoritos
  // (1.0.2) um nome para a figurinha (sua ou favorita), para achar pela busca do painel
  async nomearFigurinha(conta, b) {
    const cod = String((b && b.codigo) || '').toUpperCase(), id = String((b && b.id) || ''), n = txt(String((b && b.n) || ''), 40).trim();
    if (!/^[0-9a-f]{10}$/.test(id) || (cod && !/^[A-Z0-9]{6}$/.test(cod))) return erro('Figurinha inválida.');
    let achou = false;
    if (!cod || cod === conta.codigo) conta.figurinhas = (conta.figurinhas || []).map((f) => (f.id === id ? (achou = true, n ? { ...f, n } : { id: f.id, t: f.t }) : f));
    conta.figsFav = (conta.figsFav || []).map((f) => (f.id === id && (!cod || f.c === cod) ? (achou = true, n ? { ...f, n } : { c: f.c, id: f.id }) : f));
    if (!achou) return erro('Figurinha não encontrada.', 404);
    await this.put({ ['c:' + conta.id]: conta });
    return resposta({ ok: true, figurinhas: conta.figurinhas, favoritas: conta.figsFav });
  }
  async favoritarFigurinha(conta, b) {
    const cod = String((b && b.codigo) || '').toUpperCase(), id = String((b && b.id) || '');
    if (!/^[A-Z0-9]{6}$/.test(cod) || !/^[0-9a-f]{10}$/.test(id)) return erro('Figurinha inválida.');
    const l = (conta.figsFav || []).filter((x) => !(x.c === cod && x.id === id));
    if (b.sim) { const n = txt(String(b.n || ''), 40).trim(); l.unshift(n ? { c: cod, id, n } : { c: cod, id }); }
    conta.figsFav = l.slice(0, TRAVA_FAV_FIGS); await this.put({ ['c:' + conta.id]: conta });
    for (const w of this.ctx.getWebSockets('c:' + conta.id)) { try { w.send(JSON.stringify({ tipo: 'figs-fav' })); } catch (_) { /* ok */ } }
    return resposta({ ok: true, favoritas: conta.figsFav });
  }

  async atualizarPerfil(conta, b) {
    if (b.nome !== undefined) {
      const nome = txt(b.nome, 24);
      if (nome.length < 2) return erro('Escreva um nome com pelo menos 2 letras.');
      conta.nome = nome;
    }
    // (0.8.0) a bolha das suas mensagens: modelo e cores (todo mundo vê a sua do jeito que você escolheu)
    if (b.bc !== undefined) {
      if (b.bc === null) { if (conta.extra) delete conta.extra.bc; }
      else {
        const COR = /^#[0-9a-f]{6}$/i, x = b.bc || {};
        // (0.9.5) 'arte': uma bolha do estúdio, de uma integração da Comunidade. A arte vem do pacote publicado e fica guardada como estava
        const arte = x.m === 'arte' ? await this.integ.bolhaArte(conta, x.ig, x.b) : null;
        if (x.m === 'arte' && !arte) return erro('Essa bolha não está mais disponível.', 404);
        if (!arte && !MODELOS_BOLHA.includes(x.m)) return erro('Modelo de bolha inválido.');
        if (!arte && BOLHAS_PAGAS[x.m] && BOLHAS_PAGAS[x.m] > nivelDe(conta)) return erro(BOLHAS_PAGAS[x.m] >= 4 ? 'Esse modelo é do Aero Bubble Supporter.' : 'Esse modelo é do Aero Bubble Donator e Supporter.', 403);
        conta.extra = conta.extra || {};
        // (0.8.0) as cores de cada modelo (cs): trocar de modelo traz as cores que a pessoa deu a ele
        const cs = {};
        // (0.8.0) g: as cores do anel em volta (Bolha de sabão), de 2 a 6
        const anel = (v) => { const g = Array.isArray(v) ? v.filter((c) => COR.test(c)).slice(0, 6).map((c) => c.toLowerCase()) : []; return g.length >= 2 ? g : null; };
        if (x.cs && typeof x.cs === 'object') for (const m of MODELOS_BOLHA) { const y = x.cs[m]; if (!y || typeof y !== 'object') continue; const c = COR.test(y.c) ? y.c.toLowerCase() : '', f = COR.test(y.f) ? y.f.toLowerCase() : '', g = BOLHA_COM_CORES.includes(m) ? anel(y.g) : null; if (c || f || g) cs[m] = g ? { c, f, g } : { c, f }; }
        if (arte) conta.extra.bc = arte;
        else {
          conta.extra.bc = { m: x.m, c: COR.test(x.c) ? x.c.toLowerCase() : '', f: COR.test(x.f) ? x.f.toLowerCase() : '' };
          const g = BOLHA_COM_CORES.includes(x.m) ? anel(x.g) : null; if (g) conta.extra.bc.g = g;
        }
        if (Object.keys(cs).length) conta.extra.bc.cs = cs;
      }
    }
    // (0.8.3) o indicador de digitação: até 3 emojis, uma animação e o texto (ex.: "está tagarelando..."), que os outros veem no lugar
    // do "está digitando…". null volta ao padrão
    if (b.dg !== undefined) {
      if (b.dg === null) { if (conta.extra) delete conta.extra.dg; }
      else {
        const x = b.dg && typeof b.dg === 'object' ? b.dg : {};
        const e = (Array.isArray(x.e) ? x.e : []).map(umEmoji).filter(Boolean).slice(0, 3); // (0.8.7) só emoji: letras e símbolos comuns não entram
        const a = ['nenhuma', 'pulso', 'circulo', 'onda'].includes(x.a) ? x.a : 'nenhuma';
        // (0.8.4) "está" (ou "is") e as reticências são fixos: só o meio é da pessoa, até 20 letras
        const t0 = String(x.t || '').replace(/[\r\n\t]+/g, ' ').trim(), pre = /^is\s/i.test(t0) ? 'is' : 'está';
        const meio = txt(t0.replace(/^(está|is)\s+/i, '').replace(/\s*(\.\.\.|…)+\s*$/, '').trim(), 20).trim();
        const t = meio ? pre + ' ' + meio + '...' : '';
        // (0.8.6) vários textos (até 10) e emojis (até 24) para sortear um a cada mensagem; 'tudo' sorteia dos emojis do Aero
        const umTexto = (v) => { const v0 = String(v || '').replace(/[\r\n\t]+/g, ' ').trim(), p0 = /^is\s/i.test(v0) ? 'is' : 'está'; const m0 = txt(v0.replace(/^(está|is)\s+/i, '').replace(/\s*(\.\.\.|…)+\s*$/, '').trim(), 20).trim(); return m0 ? p0 + ' ' + m0 + '...' : ''; };
        const ts = [...new Set((Array.isArray(x.ts) ? x.ts : []).slice(0, 20).map(umTexto).filter(Boolean))].slice(0, 10);
        const ep = [...new Set((Array.isArray(x.ep) ? x.ep : []).slice(0, 40).map(umEmoji).filter(Boolean))].slice(0, 24);
        const em = x.em === 'tudo' ? 'tudo' : x.em === 'lista' && ep.length ? 'lista' : 'fixo';
        const ta = !!x.ta && ts.length > 0;
        conta.extra = conta.extra || {};
        if (!e.length && !t && !ts.length && em === 'fixo') delete conta.extra.dg;
        else { const d = { e, a, t }; if (ts.length) d.ts = ts; if (ta) d.ta = true; if (ep.length) d.ep = ep; if (em !== 'fixo') d.em = em; conta.extra.dg = d; }
      }
    }
    const grava = { ['c:' + conta.id]: conta };
    if (b.tag !== undefined) {
      const tag = normalizarTag(b.tag);
      if (!TAG_REGEX.test(tag)) return erro(MSG_TAG);
      if (!(await this.tagLivre(tag, conta.id))) return erro('Essa # já está em uso. Escolha outra.', 409);
      if (conta.tag && conta.tag.toLowerCase() !== tag.toLowerCase()) await this.ctx.storage.delete('t:' + conta.tag.toLowerCase());
      conta.tag = tag;
      grava['t:' + tag.toLowerCase()] = conta.id;
    }
    await this.put(grava);
    await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
    // (0.8.3) trocou a bolha: avisa na hora quem pode estar vendo as mensagens dela (os amigos, quem está nas mesmas conversas e os outros
    // aparelhos da pessoa) para as bolhas já na tela mudarem sem recarregar. Quem tem bloqueio com ela não recebe
    if (b.bc !== undefined) {
      const ids = new Set([conta.id, ...Object.keys(conta.amigos || {})]);
      for (const cid of Object.keys(conta.convs || {})) { const cv = await this.get('cv:' + cid); if (cv && cv.membros && cv.membros[conta.id]) for (const id of Object.keys(cv.membros)) ids.add(id); }
      const aviso = { tipo: 'bolha-mudou', codigo: conta.codigo, bc: bcPublico((conta.extra || {}).bc, nivelDe(conta)) || null };
      for (const id of ids) {
        if (id !== conta.id && ((conta.bloqueados || {})[id] || (((await this.get('c:' + id)) || {}).bloqueados || {})[conta.id])) continue;
        for (const ws of this.ctx.getWebSockets('c:' + id)) { try { ws.send(JSON.stringify(aviso)); } catch (_) { /* fechou */ } }
      }
    }
    return resposta({ ok: true, nome: conta.nome, tag: conta.tag, bc: (conta.extra || {}).bc || null, dg: (conta.extra || {}).dg || null });
  }

  async salvarAvatar(conta, b) {
    const d = typeof b.dados === 'string' ? b.dados : '';
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(d);
    // GIF animado vai como veio (até ~1 MB); as outras o app já reduz para 160x160
    if (!m || d.length > (m[1] === 'image/gif' ? 1450000 : 70000)) return erro('Imagem inválida ou grande demais (GIF: até 1 MB).');
    await this.guardarRecente(conta); // (0.6.0) a foto que sai vai para as recentes
    conta.avatarV = (conta.avatarV || 0) + 1;
    await this.apagarImagem('a:', conta.id);
    await this.put({ ['a:' + conta.id]: { mime: m[1], b64: m[2] }, ['c:' + conta.id]: conta });
    await this.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, av: conta.avatarV });
  }

  async avatar(codigo) { return this.servirImagem('a:', codigo); }

  // ---------- estatísticas (guardadas aqui, no servidor, para durar para sempre) ----------
  async somarStats(corpo) {
    const itens = Array.isArray(corpo && corpo.itens) ? corpo.itens : [];
    const grava = {};
    for (const it of itens) {
      if (!it.a || !it.b || it.a === it.b) continue;
      const [a, b] = par(it.a, it.b);
      const trocou = a !== it.a;
      const k = `st:${a}|${b}`;
      const r = grava[k] || (await this.get(k)) || { aVeB: 0, bVeA: 0, juntos: 0 };
      r.aVeB += Math.max(0, Math.round(trocou ? it.bVeA : it.aVeB) || 0);
      r.bVeA += Math.max(0, Math.round(trocou ? it.aVeB : it.bVeA) || 0);
      r.juntos += Math.max(0, Math.round(it.juntos) || 0);
      grava[k] = r;
    }
    if (Object.keys(grava).length) await this.put(grava);
    return resposta({ ok: true });
  }

  async stats(conta, codigo) {
    const oid = await this.get('f:' + codigo.toUpperCase());
    if (!oid || !conta.amigos[oid] || conta.amigos[oid].estado !== 'aceita') return erro('Só dá para ver estatísticas de amigos.', 404);
    const [a, b] = par(conta.id, oid);
    const r = (await this.get(`st:${a}|${b}`)) || { aVeB: 0, bVeA: 0, juntos: 0 };
    const souA = conta.id === a;
    return resposta({ voceViu: souA ? r.aVeB : r.bVeA, eleViu: souA ? r.bVeA : r.aVeB, juntos: r.juntos });
  }

  // ---------- API ----------
  async api(request, url, rota) {
    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    const seg = rota.split('/');
    let b = {};
    if (rota === 'bolha/kofi' && request.method === 'POST') return this.bolha.kofi(request); // o aviso de pagamento do Ko-fi (formulário, não JSON)
    if (rota === 'bolha/mp' && request.method === 'POST') return this.bolha.mp(request, url); // (0.7.14) o aviso do Mercado Pago
    { const lp = await this.loja.rotaPublica(rota, request, url); if (lp) return lp; } // (1.0.0) a volta do Mercado Pago de quem vende skins e o aviso das compras
    const binario = /^conv\/[^/]+\/(anexo|foto)$/.test(rota) || /^conv\/[^/]+\/anexo-grande\/[0-9a-f]+\/\d+$/.test(rota) || /^imagem\/(avatar|banner|nameplate|fundo|mural|ligacao|acessorio|jogo)$/.test(rota) || rota === 'figurinhas' || rota === 'emojis' || rota === 'feedback/anexo' || rota === 'integ/arte' || rota === 'loja/publicar'; // anexo do Aero Talk e foto/banner: bytes, não JSON
    if ((request.method === 'POST' || request.method === 'PUT') && !binario) {
      try { b = await request.json(); } catch (_) { return erro('JSON inválido.'); }
    }
    const hwPub = /^[0-9a-f]{16,64}$/.test(request.headers.get('X-Aero-HW') || '') ? request.headers.get('X-Aero-HW') : '';
    if ((rota === 'entrar' || rota === 'registrar') && (await this.admin.banimento(null, rota === 'registrar' ? ip : null, hwPub))) return erro('Este computador ou rede foi bloqueado no Aero.', 403); // (0.9.1) entrar numa conta que já existe: o IP é conferido junto com a conta (acesso.js)
    const publica = await this.acesso.rotaPublica(rota, b, ip, hwPub);
    if (publica) return publica;
    { const pu = await this.push.rotaPublica(rota, b, ip); if (pu) return pu; }
    if (rota === 'tag-livre') {
      if (!this.limitar('tag:' + ip, 60, 60000)) return erro('Devagar! Tente de novo em instantes.', 429);
      const tag = normalizarTag(url.searchParams.get('tag'));
      if (!TAG_REGEX.test(tag)) return resposta({ livre: false, motivo: MSG_TAG });
      const a = request.headers.get('Authorization') || '', token = a.startsWith('Bearer ') ? a.slice(7) : ''; // (0.7.14) o token só vale no cabeçalho (no endereço ele acabaria em registros)
      const eu = token && (await this.contaPorToken(token));
      return resposta({ livre: await this.tagLivre(tag, eu && eu.id) });
    }
    if (seg[0] === 'avatar' && seg[1] && request.method === 'GET') return this.avatar(seg[1]);
    if (seg[0] === 'banner' && seg[1] && request.method === 'GET') return this.banner(seg[1]);
    if (seg[0] === 'nameplate' && seg[1] && request.method === 'GET') return this.servirImagem('np:', seg[1]);
    if (seg[0] === 'fundo' && seg[1] && request.method === 'GET') return this.servirImagem('fd:', seg[1]);
    if (seg[0] === 'ligacao' && seg[1] && request.method === 'GET') return this.servirImagem('cl:', seg[1]); // (1.0.0)
    if (seg[0] === 'acessorio' && /^[A-Z0-9]{6}$/i.test(seg[1] || '') && /^[0-9a-f]{10}$/.test(seg[2] || '') && request.method === 'GET') { // (1.0.0) só enquanto o plano de quem pôs cobre
      const cid = await this.get('f:' + seg[1].toUpperCase()), dono = cid && (await this.get('c:' + cid));
      if (!dono || nivelDe(dono) < 3 || !((dono.extra && dono.extra.axs) || []).includes(seg[2])) return new Response('', { status: 404, headers: CORS });
      return this.servirImagemId('ax:', cid + ':' + seg[2]);
    }
    if (seg[0] === 'jogo-img' && /^[A-Z0-9]{6}$/i.test(seg[1] || '') && /^[0-9a-f]{10}$/.test(seg[2] || '') && request.method === 'GET') { // (1.0.0) a foto do jogo da atividade
      const cid = await this.get('f:' + seg[1].toUpperCase()), dono = cid && (await this.get('c:' + cid));
      if (!dono || !((dono.extra && dono.extra.jgs) || []).includes(seg[2])) return new Response('', { status: 404, headers: CORS });
      return this.servirImagemId('jg:', cid + ':' + seg[2]);
    }
    if (seg[0] === 'mural-fundo' && seg[1] && request.method === 'GET') return this.servirImagem('mf:', seg[1]);
    if (seg[0] === 'integ-arte' && seg[1] && request.method === 'GET') return this.integ.servirArte(seg[1]); // (0.9.5) as imagens das bolhas de arte
    if (seg[0] === 'integ-catalogo' && seg.length === 1 && request.method === 'GET') return this.integ.servirCatalogo(); // (1.0.2) o catálogo das integrações oficiais
    if (seg[0] === 'grupo-foto' && /^g[0-9a-f]{20}$/.test(seg[1] || '') && request.method === 'GET') return this.servirImagemId('gf:', seg[1]);
    if (seg[0] === 'grupo-banner' && /^g[0-9a-f]{20}$/.test(seg[1] || '') && request.method === 'GET') return this.servirImagemId('gb:', seg[1]);
    if (seg[0] === 'emoji' && /^[A-Z0-9]{6}$/i.test(seg[1] || '') && /^[0-9a-f]{10}$/.test(seg[2] || '') && request.method === 'GET') return this.servirEmoji(seg[1], seg[2]); // (1.0.0)
    if (seg[0] === 'figurinha' && /^[A-Z0-9]{6}$/i.test(seg[1] || '') && /^[0-9a-f]{10}$/.test(seg[2] || '') && request.method === 'GET') { const id = await this.get('f:' + seg[1].toUpperCase()); return this.servirImagemId('fg:', id ? id + ':' + seg[2] : ''); }

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; // (0.7.14) só no cabeçalho: token no endereço vaza para registros e histórico
    let conta = await this.contaPorToken(token);
    if (!conta) return erro('Sessão inválida. Entre de novo.', 401);
    if (rota === 'ws-ticket' && request.method === 'POST') return resposta({ ticket: this.novoTicket(token) }); // antes das outras barreiras: conta banida ainda precisa conectar para ver o aviso
    conta = await this.garantirTag(conta);
    conta = await this.acesso.arrumar(conta); // contas antigas: e-mail cifrado e a senha antiga apagada
    const hw = /^[0-9a-f]{16,64}$/.test(request.headers.get('X-Aero-HW') || '') ? request.headers.get('X-Aero-HW') : '';
    conta = await this.admin.garantir(conta, ip, hw);
    const equipe = !!(await this.admin.cargo(conta)); // a equipe nunca fica presa num bloqueio de IP/aparelho (ex.: banir alguém da mesma rede)
    const ban = await this.admin.banimento(conta, equipe ? null : ip, equipe ? null : hw);
    if (ban) return new Response(JSON.stringify({ erro: 'Conta suspensa' + (ban.ate ? ' até ' + new Date(ban.ate).toLocaleString('pt-BR') : '') + (ban.motivo ? ': ' + ban.motivo : '.'), banido: ban }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    if (rota === 'feedback/anexo' && request.method === 'POST') return this.admin.subirAnexoFb(conta, request); // (0.8.2)
    if (rota === 'integ/arte' && request.method === 'POST') return this.integ.subirArte(conta, request); // (0.9.5) imagem do estúdio de bolhas
    const adm = await this.admin.rota(conta, rota, request.method, b, ip);
    if (adm) return adm;
    { const bo = await this.bolha.rota(conta, rota, request.method, b, url); if (bo) return bo; }
    { const ig = await this.integ.rota(conta, rota, request.method, b); if (ig) return ig; }
    { const lj = await this.loja.rota(conta, rota, request.method, b, request, url); if (lj) return lj; } // (1.0.0) a loja de skins e o "verificado" dos .aer // (0.8.7) // (0.7.14) pagar o Aero Bubble pelo Mercado Pago
    if (seg[0] === 'push') { const pu = await this.push.rota(conta, rota, request.method, b, await this.chaveSessao(token)); if (pu) return pu; }
    if (rota === 'sessoes' && request.method === 'GET') return this.sessoes(conta, token);
    if (rota === 'sessoes/remover' && request.method === 'POST') return this.removerSessao(conta, b.id, token);
    if (rota === 'sessoes/remover-todas' && request.method === 'POST') return this.removerOutras(conta, token);
    // (0.6.0) privacidade: confirmação de leitura, quem pode mandar mensagem, esconder aparelho e sistema
    if (rota === 'privacidade' && request.method === 'GET') return resposta({ priv: privDe(conta), bloqueados: await this.social.listaBloqueados(conta) });
    if (rota === 'privacidade' && request.method === 'POST') {
      const p = conta.priv = conta.priv || {};
      if (b.lidos !== undefined) p.lidos = !!b.lidos;
      if (b.visto !== undefined) p.visto = !!b.visto; // (0.8.6) "visto por último"
      if (['saida', 'atividade'].includes(b.vistoModo)) p.vistoModo = b.vistoModo; // conta quando sai do app ou também quando mexe nele
      if (['amigos', 'pedidos', 'todos'].includes(b.mensagens)) p.mensagens = b.mensagens;
      if (['todos', 'amigos2', 'ninguem'].includes(b.pedidosAmizade)) p.pedidosAmizade = b.pedidosAmizade; // (0.8.7) quem pode mandar pedido de amizade
      if (b.esconderAparelho !== undefined) p.esconderAparelho = !!b.esconderAparelho;
      if (b.esconderAparelhos !== undefined) p.esconderAparelhos = !!b.esconderAparelhos; // (1.0.2) os símbolos dos aparelhos ao lado do nome
      if (b.mostrarSistema !== undefined) p.mostrarSistema = !!b.mostrarSistema; // (1.0.2) o ícone do sistema (distro, versão do Windows)
      await this.put({ ['c:' + conta.id]: conta });
      for (const w of this.ctx.getWebSockets('c:' + conta.id)) { const a = w.deserializeAttachment(); if (a) { const pv = privDe(conta); a.esconder = pv.esconderAparelho; a.semAp = pv.esconderAparelhos; a.mostraSo = pv.mostrarSistema; w.serializeAttachment(a); await this.anunciar(w); } try { w.send(JSON.stringify({ tipo: 'priv-mudou' })); } catch (_) { /* ok */ } }
      return resposta({ ok: true, priv: privDe(conta) });
    }
    if (rota === 'avatares-recentes' && request.method === 'GET') return resposta({ recentes: conta.avRecentes || [] });
    if (rota === 'avatares-recentes/usar' && request.method === 'POST') return this.usarRecente(conta, b.v);
    if (seg[0] === 'avatar-recente' && /^\d+$/.test(seg[1] || '') && request.method === 'GET') return this.servirImagemId('ar:', (conta.avRecentes || []).includes(+seg[1]) ? conta.id + ':' + seg[1] : '');
    if (rota === 'emojis' && request.method === 'GET') return resposta({ emojis: conta.emojis || [], codigo: conta.codigo }); // (1.0.0)
    if (rota === 'emojis' && request.method === 'POST') return this.novoEmoji(conta, request);
    if (seg[0] === 'emojis' && /^[0-9a-f]{10}$/.test(seg[1] || '') && request.method === 'DELETE') return this.apagarEmoji(conta, seg[1]);
    if (rota === 'figurinhas' && request.method === 'GET') return resposta({ figurinhas: conta.figurinhas || [], codigo: conta.codigo });
    if (rota === 'figurinhas' && request.method === 'POST') return this.novaFigurinha(conta, request);
    if (seg[0] === 'figurinhas' && /^[0-9a-f]{10}$/.test(seg[1] || '') && request.method === 'DELETE') return this.apagarFigurinha(conta, seg[1]);
    if (rota === 'gifs' && request.method === 'GET') return this.gifs(conta, url);
    if (rota === 'embed' && request.method === 'GET') return this.embed(conta, url);
    if (rota === 'gifs/favoritos' && request.method === 'GET') return resposta({ favoritos: conta.gifsFav || [] });
    if (rota === 'gifs/favoritos' && request.method === 'POST') return this.favoritarGif(conta, b);
    if (rota === 'figurinhas/favoritas' && request.method === 'GET') return resposta({ favoritas: conta.figsFav || [] });
    if (rota === 'figurinhas/favoritas' && request.method === 'POST') return this.favoritarFigurinha(conta, b);
    if (rota === 'figurinhas/nome' && request.method === 'POST') return this.nomearFigurinha(conta, b);
    // (0.5.9-7) configurações da conta (tema, sons, toque, chat, idioma...): as mesmas em todo aparelho. Guardadas como vieram (até 60 KB);
    // os outros aparelhos da conta ficam sabendo na hora e buscam a versão nova.
    // (1.0.2) termos de serviço: guarda a versão que a pessoa aceitou (e quando). O app mostra os termos de novo quando sai uma versão nova
    if (rota === 'termos' && request.method === 'POST') {
      const v = Math.round(+b.v || 0); if (!(v >= 1 && v <= 1000)) return erro('Versão inválida.');
      if (!(conta.termos >= v)) { conta.termos = v; conta.termosT = Date.now(); await this.put({ ['c:' + conta.id]: conta }); }
      return resposta({ ok: true, termos: conta.termos });
    }
    if (rota === 'prefs' && request.method === 'GET') return resposta({ prefs: conta.prefs || null });
    if (rota === 'prefs' && request.method === 'POST') {
      const v = b && b.v && typeof b.v === 'object' ? b.v : null, t = Math.min(Date.now() + 60000, Math.max(0, +b.t || 0));
      if (!v || JSON.stringify(v).length > 60000) return erro('Configurações grandes demais.', 413);
      if (conta.prefs && conta.prefs.t > t) return resposta({ ok: true, prefs: conta.prefs }); // chegou uma mais nova antes: fica a mais nova
      conta.prefs = { v, t }; await this.put({ ['c:' + conta.id]: conta });
      for (const w of this.ctx.getWebSockets('c:' + conta.id)) { try { w.send(JSON.stringify({ tipo: 'prefs-mudou', t })); } catch (_) { /* ok */ } }
      return resposta({ ok: true });
    }
    if (rota === 'status' && request.method === 'POST') { // online / ausente / invisível (fica guardado na conta)
      const est = ['online', 'ausente', 'invisivel', 'ocupado'].includes(b.estado) ? b.estado : 'online'; // ocupado = não perturbe (0.5.9-7)
      if (est === 'invisivel' && conta.status !== 'invisivel') await this.put({ ['vs:' + conta.id]: Date.now() }); // (0.8.6) para os outros, saiu agora
      conta.status = est;
      if (b.stc !== undefined) { const x = limparStc(b.stc); if (x) conta.stc = x; else delete conta.stc; } // (0.8.3) null tira o personalizado
      await this.put({ ['c:' + conta.id]: conta });
      for (const w of this.ctx.getWebSockets('c:' + conta.id)) { const a = w.deserializeAttachment(); if (!a) continue; const era = a.estado; a.estado = est; a.stc = conta.stc || null; w.serializeAttachment(a); await this.anunciarEstado(w, era); }
      try { await this.analytics.marcar(); } catch (_) { /* ok */ }
      return resposta({ ok: true, estado: est, stc: conta.stc || null });
    }

    if (rota === 'dono' && request.method === 'POST') return this.admin.ativarDono(conta, b); // (0.9.7) a chave exclusiva do dono
    if (rota === 'eu') {
      const cargoEu = await this.admin.cargo(conta);
      const donoPend = !cargoEu && this.env.DONO_CHAVE && this.admin.donoPossivel(conta) ? true : undefined; // (0.9.7) a conta do dono ainda sem o selo da chave
      return resposta({ donoPend, uid: cargoEu === 'dev' ? conta.uid : undefined, email: (await this.acesso.abrirEmail(conta)) || undefined, codigo: conta.codigo, nome: conta.nome, tag: conta.tag, av: conta.avatarV || 0, loginId: conta.loginId || undefined, criado: conta.criado, // o código só aparece em conta antiga ainda não migrada (o app troca pelo hash na hora)
         amigos: await this.lista(conta), ...this.extraPublico(conta), cargo: cargoEu, status: conta.status || 'online', stc: conta.stc || null, priv: privDe(conta), ins: conta.ins || [], sl: await this.selos(conta), avisos: (conta.avisos || []).length, mudo: await this.admin.silenciado(conta),
         bolha: this.bolha.publico(conta), priv: privDe(conta), bloqueados: Object.keys(conta.bloqueados || {}).length ? (await this.social.listaBloqueados(conta)).map((p) => p.codigo) : [], totp: !!(conta.totp && conta.totp.ativo), senha: !!conta.senha, termos: conta.termos || 0 });
    }
    if (rota === 'sair') {
      const k = await this.chaveSessao(token), ss = await this.get(k), sid = ss && ss.sid;
      await this.ctx.storage.delete(k); const l = await this.listaSessoes(conta.id); await this.put({ ['ss:' + conta.id]: l.filter((x) => x !== k) });
      // (0.8.7) segurança: as conexões abertas por esta sessão caem na hora (antes ficavam vivas até reconectar)
      if (sid) for (const w of this.ctx.getWebSockets('c:' + conta.id)) { const a = w.deserializeAttachment(); if (a && a.sid === sid) { try { w.close(4001, 'sessao'); } catch (_) { /* ok */ } } }
      return resposta({ ok: true });
    }
    if (rota === 'perfil' && request.method === 'POST') return this.atualizarPerfil(conta, b);
    if (rota === 'perfil/exclusivo' && request.method === 'POST') return this.perfilExclusivo(conta, b);
    // (1.0.2) traduzir uma mensagem e o dicionário por palavra (idiomas.js)
    if ((rota === 'traduzir' || rota === 'dicionario') && request.method === 'POST') {
      if (!this.limitar('idi:' + conta.id, 90, 60000)) return erro('Devagar! Tente de novo em um minuto.', 429);
      try { return resposta(rota === 'traduzir' ? await traduzir(b.texto, b.para, b.de) : await dicionario(b.palavra, b.lingua)); }
      catch (e) { return erro(e.message || 'Não deu certo agora.', 502); }
    }
    if (rota === 'avatar' && request.method === 'POST') return this.salvarAvatar(conta, b);
    if ((rota === 'imagem/avatar' || rota === 'imagem/banner' || rota === 'imagem/nameplate' || rota === 'imagem/fundo' || rota === 'imagem/mural' || rota === 'imagem/ligacao' || rota === 'imagem/acessorio' || rota === 'imagem/jogo') && request.method === 'POST') return this.subirImagem(conta, seg[1], request);
    if (rota === 'acesso/trocar') { const rs = await this.sessao(token); b._sid = (rs && rs.s.sid) || ''; }
    const ac = await this.acesso.rota(conta, rota, request.method, b);
    if (ac) return ac;
    if (seg[0] === 'perfil' && seg[1]) return this.perfilPublico(conta, seg[1]);
    if (seg[0] === 'amigos' && seg[2] === 'stats') return this.stats(conta, seg[1]);
    const social = await this.social.rota(conta, request, url, rota, b);
    if (social) return social;

    // ---------- amigos (aceita código de amigo OU #tag) ----------
    // (0.6.0) rota que ninguém tratou não cai mais aqui (antes respondia "Não existe ninguém com esse código" para qualquer coisa)
    if (!rota.startsWith('amigos/')) return erro('Esta função não existe neste servidor. Atualize o Aero.', 404);
    const alvo = txt(b.codigo, 40);
    let oid = alvo && (await this.get('f:' + alvo.toUpperCase()));
    if (!oid && alvo) { const t = normalizarTag(alvo); if (TAG_REGEX.test(t)) oid = await this.get('t:' + t.toLowerCase()); }
    if (!oid) return erro('Não existe ninguém com esse código ou #.', 404);
    if (oid === conta.id) return erro('Esse é o seu próprio código.');
    const outro = await this.get('c:' + oid);
    const meu = conta.amigos[oid];

    if (rota === 'amigos/pedir') {
      if (bloqueio(conta, outro)) return erro('Não dá para adicionar essa pessoa.', 403); // (0.6.0) bloqueio: nenhum pedido passa
      if (meu && (meu.estado === 'aceita' || meu.estado === 'enviado')) return resposta({ ok: true });
      const aceita = !!meu && meu.estado === 'recebido'; // ele já tinha pedido: vira amizade na hora
      if (!aceita) { // (0.8.7) a pessoa escolhe quem pode mandar pedido: todos, só amigos de amigos ou ninguém
        const quem = privDe(outro).pedidosAmizade;
        if (quem === 'ninguem') return erro('Essa pessoa não está recebendo pedidos de amizade.', 403);
        if (quem === 'amigos2' && !Object.entries(conta.amigos || {}).some(([id, x]) => x && x.estado === 'aceita' && outro.amigos && outro.amigos[id] && outro.amigos[id].estado === 'aceita'))
          return erro('Essa pessoa só recebe pedidos de amigos de amigos.', 403);
      }
      const desde = aceita ? Date.now() : 0;
      conta.amigos[oid] = { estado: aceita ? 'aceita' : 'enviado', confia: false, desde };
      outro.amigos[conta.id] = { estado: aceita ? 'aceita' : 'recebido', confia: false, desde };
    } else if (rota === 'amigos/aceitar') {
      if (!meu || meu.estado !== 'recebido') return erro('Esse pedido não existe mais.', 404);
      meu.estado = 'aceita'; meu.desde = Date.now();
      outro.amigos[conta.id].estado = 'aceita'; outro.amigos[conta.id].desde = meu.desde;
    } else if (rota === 'amigos/remover') {
      delete conta.amigos[oid];
      delete outro.amigos[conta.id];
    } else if (rota === 'amigos/avisar-online') { // (0.6.0) "Avisar quando ficar online", escolhido no perfil de cada amigo
      if (!meu || meu.estado !== 'aceita') return erro('Só para amigos.');
      meu.avisarOnline = !!b.sim;
      await this.put({ ['c:' + conta.id]: conta }); await this.sincronizar(conta.id);
      return resposta({ ok: true });
    } else if (rota === 'amigos/confianca') {
      if (!meu || meu.estado !== 'aceita') return erro('Só dá para confiar em amigos aceitos.');
      meu.confia = !!b.confia;
    } else {
      return erro('Não encontrado', 404);
    }
    await this.put({ ['c:' + conta.id]: conta, ['c:' + oid]: outro });
    await this.mudou([conta.id, oid]);
    return resposta({ ok: true });
  }

  // ---------- presença (quem está online) ----------
  async abrirPresenca(request, url) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Use WebSocket', { status: 426 });
    const tk = url.searchParams.get('ticket') ? this.usarTicket(url.searchParams.get('ticket')) : null; // (0.9.6) só bilhete de uso único; o token da sessão na URL não vale mais
    let conta = await this.contaPorToken(tk);
    const [cliente, servidor] = Object.values(new WebSocketPair());
    if (!conta) {
      servidor.accept();
      enviar(servidor, { tipo: 'erro', codigo: 'sessao', msg: 'Sessão inválida.' }); // (0.8.7) pode ser só o bilhete que venceu: o app confere antes de sair
      servidor.close(4001, 'sessao');
      return new Response(null, { status: 101, webSocket: cliente });
    }
    conta = await this.garantirTag(conta);
    const limpa = (x, n, padrao) => txt(x, n).replace(/[<>]/g, '') || padrao;
    const ip = request.headers.get('CF-Connecting-IP') || '', hw = /^[0-9a-f]{16,64}$/.test(url.searchParams.get('hw') || '') ? url.searchParams.get('hw') : '';
    const ban = await this.admin.banimento(conta, (await this.admin.cargo(conta)) ? null : ip, (await this.admin.cargo(conta)) ? null : hw);
    if (ban) { servidor.accept(); enviar(servidor, { tipo: 'banido', ban }); servidor.close(4003, 'banido'); return new Response(null, { status: 101, webSocket: cliente }); }
    const maquina = limpa(url.searchParams.get('maquina'), 32, 'Dispositivo'), so = limpa(url.searchParams.get('so'), 16, '?');
    const rs = await this.sessao(tk), ses = rs && rs.s;
    if (ses) { await this.put({ [rs.k]: { ...ses, sid: ses.sid || tk.slice(0, 10), ip: ipParcial(ip), maquina, so, visto: Date.now() } }); await this.indexarSessao(conta.id, tk); }
    const cargo = await this.admin.cargo(conta);
    this.ctx.acceptWebSocket(servidor, cargo ? ['c:' + conta.id, 'equipe', ...(cargo === 'dev' ? ['dev'] : [])] : ['c:' + conta.id]); // "equipe": recebe as mudanças da página da equipe; "dev": o analytics ao vivo
    servidor.serializeAttachment({
      conta: conta.id, codigo: conta.codigo, nome: conta.nome, tag: conta.tag, av: conta.avatarV || 0, ins: conta.ins || [],
      dev: /^[a-z0-9]{12}$/.test(url.searchParams.get('dev') || '') ? url.searchParams.get('dev') : crypto.randomUUID().slice(0, 8), sid: (ses && ses.sid) || tk.slice(0, 10), maquina, // (0.7.4) o mesmo id ao reconectar
      so, sov: /^[a-z0-9]{1,14}$/.test(url.searchParams.get('sov') || '') ? url.searchParams.get('sov') : '', ap: /^(android|ios)$/i.test(so) ? 'cel' : /^web$/i.test(so) ? 'web' : 'pc', semAp: privDe(conta).esconderAparelhos, mostraSo: privDe(conta).mostrarSistema, estado: ['ausente', 'invisivel', 'ocupado'].includes(conta.status) ? conta.status : 'online', sala: null, comp: false, esconder: privDe(conta).esconderAparelho, stc: conta.stc || null,
    });
    enviar(servidor, { tipo: 'eu', dev: servidor.deserializeAttachment().dev }); // o aparelho fica sabendo o próprio id (chamadas)
    await this.sincronizar(conta.id, [servidor]);
    await this.anunciar(servidor);
    try { await this.analytics.marcar({ conta: conta.id }); } catch (_) { /* ok */ }
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // Manda a lista de amigos + quem está online para os aparelhos dessa conta.
  async sincronizar(id, alvos) {
    const conta = await this.get('c:' + id);
    if (!conta) return;
    const lista = await this.lista(conta);
    const presencas = [];
    for (const [oid, info] of Object.entries(conta.amigos)) {
      if (info.estado !== 'aceita') continue;
      this.ctx.getWebSockets('c:' + oid).forEach((f) => { const a = f.deserializeAttachment(); if (a && !invisivel(a)) presencas.push(msgPresenca(a)); });
    }
    for (const ws of alvos || this.ctx.getWebSockets('c:' + id)) {
      enviar(ws, { tipo: 'amigos', lista });
      presencas.forEach((p) => enviar(ws, p));
    }
  }

  // Avisa os amigos aceitos sobre este aparelho (entrou, mudou de estado, abriu uma sala).
  async anunciar(ws, extra) {
    const a = ws.deserializeAttachment();
    if (!a) return;
    const conta = await this.get('c:' + a.conta);
    if (!conta) return;
    const m = extra || (invisivel(a) ? { tipo: 'offline', codigo: a.codigo, dispositivo: a.dev } : msgPresenca(a));
    for (const [oid, info] of Object.entries(conta.amigos)) {
      if (info.estado === 'aceita') this.ctx.getWebSockets('c:' + oid).forEach((f) => enviar(f, m));
    }
  }

  // mudou de online/ausente/invisível: para os amigos, ficar invisível é sair; voltar é entrar
  async anunciarEstado(ws, era) { const a = ws.deserializeAttachment(); if (!a) return; if (invisivel(a) && era !== 'invisivel') await this.anunciar(ws, { tipo: 'offline', codigo: a.codigo, dispositivo: a.dev }); else await this.anunciar(ws); }

  async mudou(ids) {
    const unicos = [...new Set(ids)];
    // Perfil novo (nome, #, foto) vale também nas presenças já abertas.
    for (const id of unicos) {
      const c = await this.get('c:' + id);
      if (!c) continue;
      for (const ws of this.ctx.getWebSockets('c:' + id)) {
        const a = ws.deserializeAttachment();
        if (a) { ws.serializeAttachment({ ...a, nome: c.nome, tag: c.tag, av: c.avatarV || 0, ins: c.ins || [] }); }
      }
    }
    for (const id of unicos) await this.sincronizar(id);
    for (const id of unicos) for (const ws of this.ctx.getWebSockets('c:' + id)) await this.anunciar(ws);
  }

  async webSocketMessage(ws, mensagem) {
    if (typeof mensagem !== 'string' || mensagem.length > 16384) return;
    let m;
    try { m = JSON.parse(mensagem); } catch (_) { return; }
    const a = ws.deserializeAttachment();
    if (!a || !m) return;
    if (m.tipo === 'cham-sinal') return this.social.sinal(a, m, mensagem.length); // chamada do Aero Talk (a oferta de vídeo é maior)
    if (m.tipo === 'musica') return this.musica.acao(a, m); // (0.8.7) Música junto: pôr, pular, pausar... (só quem está na conversa)
    if (m.tipo === 'digitando') return this.social.digitando(a, m); // "Fulano está digitando…" numa conversa
    if (m.tipo === 'ativo') { // (0.8.6) mexeu no app: o "visto por último" de quem escolheu contar a atividade (invisível não conta)
      if (invisivel(a) || !a.conta || !this.limitar('va:' + a.conta, 1, 55000)) return;
      const c0 = await this.get('c:' + a.conta); if (!c0 || c0.status === 'invisivel' || privDe(c0).vistoModo !== 'atividade' || !privDe(c0).visto) return;
      await this.put({ ['va:' + a.conta]: Date.now() }); return;
    }
    if (mensagem.length > 2048) return;
    if (m.tipo === 'sov') { // (1.0.2) trocou o ícone do sistema neste aparelho (distro, versão do Windows)
      const v = /^[a-z0-9]{1,14}$/.test(m.v || '') ? m.v : ''; if (a.sov === v || !this.limitar('sov:' + a.conta, 20, 60000)) return;
      a.sov = v; ws.serializeAttachment(a); if (!invisivel(a)) await this.anunciar(ws); return;
    }
    if (m.tipo === 'ouvindo') { // (1.0.0) a música que toca agora no PC (ou parou: ouv null). Invisível: guarda, mas ninguém fica sabendo
      if (!this.limitar('ouv:' + a.conta + ':' + a.dev, 30, 60000)) return;
      const o = limparOuv(m.ouv), antes = a.ouv || null;
      if (!o && !antes) return;
      a.ouv = o || undefined;
      try { ws.serializeAttachment(a); } catch (_) { a.ouv = undefined; ws.serializeAttachment(a); return; }
      if (!invisivel(a)) await this.anunciar(ws, { tipo: 'ouvindo', codigo: a.codigo, dispositivo: a.dev, ouv: ouvPublico(a) || null });
      return;
    }
    if (m.tipo === 'assistindo') { // (1.0.0) a live ou o vídeo de agora (ou parou: ass null). Invisível: guarda, mas ninguém fica sabendo
      if (!this.limitar('ass:' + a.conta + ':' + a.dev, 30, 60000)) return;
      const o = limparAss(m.ass), antes = a.ass || null;
      if (!o && !antes) return;
      const tentativas = o ? [o, { ...o, img: undefined, c: undefined, a: (o.a || '').slice(0, 40) || undefined, t: o.t.slice(0, 60) }, undefined] : [undefined];
      let ok = false;
      for (const t of tentativas) { a.ass = t ? JSON.parse(JSON.stringify(t)) : undefined; try { ws.serializeAttachment(a); ok = true; break; } catch (_) { /* tenta menor */ } }
      if (!ok) return;
      if (!invisivel(a)) await this.anunciar(ws, { tipo: 'assistindo', codigo: a.codigo, dispositivo: a.dev, ass: assPublico(a) || null });
      return;
    }
    if (m.tipo === 'jogando') { // (1.0.0) o jogo aberto agora (ou fechou: jog null). Invisível: guarda, mas ninguém fica sabendo
      if (!this.limitar('jog:' + a.conta + ':' + a.dev, 30, 60000)) return;
      const j = limparJog(m.jog), antes = a.jog || null;
      if (!j && !antes) return;
      // o anexo da conexão tem limite de tamanho: se não couber, vai sem as imagens e os textos dos ícones; depois só o essencial
      const tentativas = j ? [j, { ...j, li: undefined, si: undefined, lt: undefined, st: undefined }, { n: j.n.slice(0, 60), d: (j.d || '').slice(0, 60) || undefined, tp: j.tp, o: j.o, ini: j.ini }, undefined] : [undefined];
      let ok = false;
      for (const t of tentativas) { a.jog = t ? JSON.parse(JSON.stringify(t)) : undefined; try { ws.serializeAttachment(a); ok = true; break; } catch (_) { /* tenta menor */ } }
      if (!ok) return;
      if (!invisivel(a)) await this.anunciar(ws, { tipo: 'jogando', codigo: a.codigo, dispositivo: a.dev, jog: jogPublico(a) || null });
      return;
    }
    if (m.tipo === 'fundo') { a.fundo = m.sim === true; ws.serializeAttachment(a); return; } // (0.9.2) o celular foi para o fundo: este aparelho passa a receber push
    if (m.tipo === 'estado' && (m.estado === 'online' || m.estado === 'ausente')) { if (invisivel(a)) return; const c0 = await this.get('c:' + a.conta); if (c0 && ['ausente', 'ocupado'].includes(c0.status)) return; a.estado = m.estado; } // escolha da pessoa (ausente/não perturbe) vence o automático // invisível só muda pela escolha da pessoa (rota "status")
    else if (m.tipo === 'transmitindo') {
      a.sala = typeof m.sala === 'string' && /^[A-Z0-9]{4,12}$/.test(m.sala) ? m.sala : null;
      a.comp = !!m.comp && !!a.sala;
    } else return;
    ws.serializeAttachment(a);
    await this.anunciar(ws);
    if (m.tipo === 'estado') { try { await this.analytics.marcar(); } catch (_) { /* ok */ } }
  }

  async alarm() { await this.analytics.hora(); } // virada da hora com alguém online (analytics.js)
  async webSocketClose(ws) { await this.saiu(ws); }
  async webSocketError(ws) { await this.saiu(ws); }

  async saiu(ws) {
    const a = ws.deserializeAttachment();
    try { ws.close(1000, 'ok'); } catch (_) {}
    try { await this.analytics.marcar({ exceto: ws }); } catch (_) { /* ok */ }
    // (0.7.4) o aparelho já voltou por outra conexão (com o mesmo id) antes desta terminar de fechar: não saiu de nada (nem da chamada)
    if (a && a.conta && a.dev && this.ctx.getWebSockets('c:' + a.conta).some((w) => { try { return w !== ws && (w.deserializeAttachment() || {}).dev === a.dev && w.readyState === 1; } catch (_) { return false; } })) return;
    if (a) await this.anunciar(ws, { tipo: 'offline', codigo: a.codigo, dispositivo: a.dev });
    // (0.8.6) "visto por último": a hora em que o último aparelho da conta saiu (invisível não conta: para os outros já tinha saído)
    if (a && a.conta && !invisivel(a) && !this.ctx.getWebSockets('c:' + a.conta).some((w) => w !== ws && w.readyState === 1)) { try { await this.put({ ['vs:' + a.conta]: Date.now() }); } catch (_) { /* ok */ } }
    if (a && a.conta && a.dev) { try { await this.social.aparelhoSaiu(a.conta, a.dev); } catch (_) { /* ok */ } } // caiu no meio de uma chamada: sai dela
  }
}
