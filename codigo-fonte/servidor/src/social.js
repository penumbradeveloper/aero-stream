// Aero Talk: conversas privadas e em grupo, perfil (banner, cores, bio, Discord, Spotify), apelidos e chamadas.
// Roda dentro do Hub (mesmas contas, mesma presença ao vivo). Criado por Ryan Victtor.
//
// CRIPTOGRAFIA DE PONTA A PONTA, POR CONTA: o servidor NÃO lê mensagens nem anexos. Cada conta tem um par de chaves (ECDH P-256); a parte
// privada fica aqui só dentro de um cofre cifrado pelo código de acesso (que o servidor não conhece; veja acesso.js). Quem manda cifra a
// mensagem com uma chave nova (AES-GCM) e embrulha essa chave para a chave da conta de cada participante.
// Aqui só ficam: quem mandou, quando, o tamanho e os bytes cifrados.
import * as midia from './midia.js';
import { resposta, erro, txt, umEmoji } from './util.js';
import { limitesDe, MAX_GRUPO_TETO } from './bolha.js';
import { nivelDe, limparPerfil, nmPublico, bcPublico, EFEITOS_NOME as EFEITOS_PAGOS, NOME_LEGADO } from './extras.js';
// (1.0.3) as abas do Mural: filmes, séries, animes, músicas, álbuns, livros, HQs, mangás e jogos
const MURAL_CATS = ['f', 's', 'a', 'm', 'l', 'b', 'h', 'g', 'j'];
const PERFIL_MODELO = ['bio', 'cor1', 'cor2', 'fundo1', 'fundo2', 'discord', 'spotify', 'nm', 'fd', 'np', 'pf', 'bc', 'ml', 'lb', 'gl', 'mf']; // o que um perfil salvo guarda
const IMGS_MODELO = [['fd', 'fdV'], ['np', 'npV'], ['mf', 'mfV']]; // (1.0.2) as imagens que o perfil salvo leva junto
const PERFIL_MODELO_X = ['mo', 'ab', 'ac', 'an', 'se', 'mc']; // (1.0.2) e os extras do Aero Bubble (moldura, abertura, acessórios, anel, som de entrada, moldura da câmera)

export const MAX_ANEXO = 10 * 1024 * 1024 + 64 * 1024;   // (0.7.14) 10 MB (+ a "etiqueta" da cifra)
const PEDACO = 1024 * 1024;                               // anexos guardados em pedaços de 1 MB (limite de valor do armazenamento)
const MAX_MSGS = 2000;                                    // por conversa (as mais antigas saem, com os anexos)
const MAX_MEMBROS = 50;                                   // teto técnico (chaves, diretório)
export const MAX_GRUPO = 10; // sem Aero Bubble (com ele, até 15, 25, 30 ou 40: o maior plano entre o dono e os admins do grupo)
const PARTE = 8 * 1024 * 1024;                            // (0.7.14) anexo grande (Aero Bubble): sobe em partes de 8 MB, cada uma cifrada à parte, guardadas no R2
// (0.7.14) dentro de um grupo: até 5 chats a mais (além do principal) e até 3 chamadas de voz (a do principal e mais 2). Cada um é uma
// conversa "filha" com as mesmas pessoas do grupo (as suas mensagens, fixadas e chamada), que segue o grupo em tudo (entrar, sair, papéis)
export const MAX_CHATS_EXTRA = 5, MAX_VOZ = 3; // sem plano (com o Supporter do dono ou de um admin: 10 e 5)
const MAX_DISPOSITIVOS = 8;
const B64 = /^[A-Za-z0-9+/=_-]+$/;
const HEX6 = /^#[0-9a-f]{6}$/i;
// (0.8.0) estilos de nome: as mesmas listas que o app mostra (app/js/ui.js, U.FONTES_NOME e U.EFEITOS_NOME)
const FONTES_NOME = ['padrao', 'arredondada', 'serifa', 'maquina', 'manuscrita', 'grossa', 'estreita', 'pixel', 'gotica', 'elegante'];
const EFEITOS_NOME = ['solido', 'degrade', 'neon', 'desenho', 'pop', 'gummy', 'pulo', 'elastico', 'onda', 'prisma', 'bolha', 'aurora', 'agua', 'gelo', 'fogo', 'galaxia', 'holograma', 'glitch', 'purpurina', 'brilho', 'diamante', ...Object.keys(EFEITOS_PAGOS)]; // (1.0.0) + os efeitos novos do Aero Bubble (extras.js)
const EFEITOS_EXCLUSIVOS = ['diamante']; // só com Donator ou Supporter
const pad = (n) => String(n).padStart(9, '0');
const aleatorioHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
async function sha(texto) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)); return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join(''); }

// a mensagem cifrada que chega do aparelho: só formatos esperados e tamanhos limitados
function cifraValida(c) {
  if (!c || typeof c !== 'object') return null;
  if (typeof c.iv !== 'string' || c.iv.length > 40 || !B64.test(c.iv)) return null;
  if (typeof c.ct !== 'string' || c.ct.length > 24000 || !B64.test(c.ct)) return null;
  if (typeof c.dev !== 'string' || !HEX16.test(c.dev)) return null;
  if (c.kc !== undefined && (typeof c.kc !== 'string' || !HEX16.test(c.kc))) return null;
  if (!c.chaves || typeof c.chaves !== 'object') return null;
  const chaves = {};
  for (const [d, v] of Object.entries(c.chaves).slice(0, MAX_MEMBROS * (MAX_DISPOSITIVOS + 1))) if (HEX16.test(d) && embValido(v)) chaves[d] = v;
  if (!Object.keys(chaves).length) return null;
  const out = { iv: c.iv, ct: c.ct, dev: c.dev, chaves };
  if (c.kc) out.kc = c.kc;
  return out;
}
const HEX16 = /^[0-9a-f]{16}$/;
const embValido = (v) => typeof v === 'string' && v.length < 200 && /^[A-Za-z0-9+/=_.-]+$/.test(v);

// (0.6.0) privacidade de cada conta: confirmação de leitura (como no WhatsApp: os dois precisam deixar ligada), quem pode mandar mensagem
// (só amigos, pedidos de mensagem como no Instagram, ou todos) e esconder o nome do aparelho e o sistema dos amigos (padrão: escondido)
export const privDe = (c) => { const p = (c && c.priv) || {}; return { lidos: p.lidos !== false, visto: p.visto !== false, vistoModo: p.vistoModo === 'atividade' ? 'atividade' : 'saida', mensagens: ['amigos', 'pedidos', 'todos'].includes(p.mensagens) ? p.mensagens : 'amigos', esconderAparelho: p.esconderAparelho !== false, esconderAparelhos: p.esconderAparelhos === true, mostrarSistema: p.mostrarSistema === true, pedidosAmizade: ['todos', 'amigos2', 'ninguem'].includes(p.pedidosAmizade) ? p.pedidosAmizade : 'todos' }; };
// bloqueio (0.6.0): vale para os dois lados (nenhum vê as mensagens do outro, nem perfil, nem pedido de amizade)
export const bloqueio = (a, b) => !!(a && b && (((a.bloqueados || {})[b.id]) || ((b.bloqueados || {})[a.id])));

// (0.8.6) o indicador de digitação com sorteio: cada mensagem nova (a semente s, que muda a cada mensagem enviada) sorteia um dos textos
// e os emojis, e o mesmo sorteio vale enquanto a pessoa escreve aquela mensagem. Os outros recebem só o resultado ({ e, a, t })
export const EMOJIS_DG = ['😭', '😂', '🥺', '😎', '🤔', '😈', '👀', '💀', '🔥', '✨', '💖', '💬', '⌨️', '✍️', '🫧', '🌊', '🐶', '🐱', '🐸', '🦴', '🍬', '🍕', '☕', '🎮', '🎧', '🎵', '⚡', '🌙', '⭐', '🌸', '🍀', '👻'];
export function sortearDg(dg, s, quem) {
  if (!dg || typeof dg !== 'object') return undefined;
  let h = 2166136261 >>> 0; for (const c of String(quem || '') + ':' + (Number.isFinite(+s) ? Math.floor(+s) : 0)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let { e = [], a = 'nenhuma', t = '' } = dg; e = (Array.isArray(e) ? e : []).map(umEmoji).filter(Boolean); // (0.8.7) o que ficou guardado antes também: só emoji
  if (dg.ta && Array.isArray(dg.ts) && dg.ts.length) t = dg.ts[Math.floor(rnd() * dg.ts.length)];
  const pote = dg.em === 'tudo' ? EMOJIS_DG : dg.em === 'lista' && Array.isArray(dg.ep) ? dg.ep.map(umEmoji).filter(Boolean) : null;
  if (pote && pote.length) { const n = Math.min(3, pote.length), l = [...pote]; e = []; for (let i = 0; i < n; i++) e.push(l.splice(Math.floor(rnd() * l.length), 1)[0]); }
  return { e, a, t };
}

export class Social {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }
  get(k) { return this.st.get(k); }
  online(id) { return this.hub.ctx.getWebSockets('c:' + id).length > 0; }

  // ---------- quem é quem ----------
  async contaPorCodigo(codigo) { const id = await this.get('f:' + String(codigo || '').toUpperCase()); return id ? this.get('c:' + id) : null; }
  amigos(conta, oid) { const r = conta.amigos[oid]; return !!r && r.estado === 'aceita'; }
  async publico(id) { const c = await this.get('c:' + id); return c ? { codigo: c.codigo, nome: c.nome, tag: c.tag || '', av: c.avatarV || 0, ins: c.ins || undefined, sl: await this.hub.selosVisiveis(c), bc: bcPublico((c.extra || {}).bc, nivelDe(c)), nm: nmPublico((c.extra || {}).nm, nivelDe(c)) } : null; }

  // avisa os aparelhos online dessas contas
  avisar(ids, msg) { for (const id of new Set(ids)) for (const ws of this.hub.ctx.getWebSockets('c:' + id)) { try { ws.send(JSON.stringify(msg)); } catch (_) { /* fechou */ } } }

  // ---------- rotas ----------
  async rota(conta, request, url, rota, b) {
    const seg = rota.split('/'), M = request.method;
    if (rota === 'chaves' && M === 'POST') return resposta({ ok: true }); // 0.5.7: não existe mais chave por aparelho (só a da conta)
    if (rota === 'chaves' && M === 'GET') return this.chaves(conta, url.searchParams.get('codigos') || '');
    if (rota === 'apelido' && M === 'POST') return this.apelido(conta, b);
    if (rota === 'convite-sala' && M === 'POST') return erro('As salas acabaram: chame a pessoa numa chamada do Aero Talk.', 410); // (0.9.6)
    if (rota === 'convite-sala/resposta' && M === 'POST') return this.responderConvite(conta, b);
    if (rota === 'perfil-extra' && M === 'POST') return this.perfilExtra(conta, b);
    if (rota === 'mural' && M === 'POST') return this.salvarMural(conta, b);
    if (seg[0] === 'mural' && seg[1] && M === 'GET') return this.verMural(conta, seg[1]);
    if (rota === 'perfis-salvos' && M === 'POST') return this.perfisSalvos(conta, b);
    if (rota === 'banner' && M === 'POST') return this.salvarBanner(conta, b);
    if (rota === 'bloquear' && M === 'POST') return this.bloquear(conta, b);
    if (seg[0] === 'convite' && seg[1] && M === 'GET') return this.verConvite(conta, seg[1]);
    if (seg[0] === 'convite' && seg[1] && seg[2] === 'entrar' && M === 'POST') return this.entrarConvite(conta, seg[1]);
    // (0.8.3) "copiar link" de uma imagem/GIF do chat: quem tem o link (que leva a chave depois do #, que nunca chega aqui) baixa os bytes
    // cifrados, mesmo de outra conversa. Sem a chave os bytes não servem para nada; os ids são aleatórios (80 bits)
    if (seg[0] === 'midia' && seg[1] && seg[2] && M === 'GET') {
      if (!/^[a-z0-9_-]{4,48}$/i.test(seg[1])) return erro('Anexo não encontrado.', 404);
      const cvm = await this.get('cv:' + seg[1]); if (!cvm) return erro('Anexo não encontrado.', 404);
      return seg[3] ? this.baixarParte(cvm, seg[2], seg[3]) : this.baixarAnexo(cvm, seg[2]);
    }
    if (seg[0] === 'conv') {
      if (seg.length === 1 && M === 'GET') return this.listar(conta);
      if (seg[1] === 'dm' && M === 'POST') return this.abrirDM(conta, b);
      if (seg[1] === 'grupo' && M === 'POST') return this.criarGrupo(conta, b);
      const cv = await this.get('cv:' + seg[1]);
      if (!cv || !cv.membros[conta.id]) return erro('Conversa não encontrada.', 404);
      const sub = seg.slice(2).join('/');
      // (0.7.14) num chat ou numa chamada de voz de dentro de um grupo, quem entra, sai, a foto e o convite são os do grupo
      if (cv.pai && ['membros', 'membro', 'sair', 'foto', 'convite', 'config'].includes(sub)) return erro('Isso se faz no grupo.', 400);
      if (sub === 'canais' && M === 'POST') return this.canais(cv, conta, b);
      if (sub === '' && M === 'GET') return resposta(await this.resumo(cv, conta));
      if (sub === 'msgs' && M === 'GET') return this.mensagens(cv, conta, url);
      if (sub === 'msgs' && M === 'POST') return this.novaMensagem(cv, conta, b);
      if (seg[2] === 'msgs' && seg[3] && seg[4] === 'reacao' && M === 'POST') return this.reagir(cv, conta, seg[3], b);
      if (seg[2] === 'msgs' && seg[3] && M === 'PUT') return this.editar(cv, conta, seg[3], b);
      if (seg[2] === 'msgs' && seg[3] && M === 'DELETE') return this.apagar(cv, conta, seg[3]);
      if (sub === 'lido' && M === 'POST') return this.lido(cv, conta, b);
      if (sub === 'anexo' && M === 'POST') return this.subirAnexo(cv, conta, request);
      if (sub === 'anexo-grande' && M === 'POST') return this.comecarGrande(cv, conta, b);
      if (seg[2] === 'anexo-grande' && seg[3] && seg[4] && M === 'POST') return this.parteGrande(cv, conta, seg[3], seg[4], request);
      if (seg[2] === 'anexo' && seg[3] && seg[4] && M === 'GET') return this.baixarParte(cv, seg[3], seg[4]);
      if (seg[2] === 'anexo' && seg[3] && M === 'GET') return this.baixarAnexo(cv, seg[3]);
      if (sub === 'membros' && M === 'POST') return this.adicionar(cv, conta, b);
      if (sub === 'membro' && M === 'POST') return this.mudarMembro(cv, conta, b);
      if (sub === 'config' && M === 'POST') return this.configurar(cv, conta, b);
      if (sub === 'sair' && M === 'POST') return this.sair(cv, conta);
      if (sub === 'chamada' && M === 'POST') return this.chamada(cv, conta, b);
      if (sub === 'foto' && M === 'POST') return this.fotoGrupo(cv, conta, request);
      if (sub === 'banner' && M === 'POST') return this.bannerGrupo(cv, conta, request);
      if (sub === 'chaves' && M === 'POST') return this.migrarChaves(cv, conta, b);
      if (sub === 'marca' && M === 'POST') return this.marcar(cv, conta, b);
      if (sub === 'mudo' && M === 'POST') return this.silenciar(cv, conta, b);
      if (sub === 'ocultar' && M === 'POST') return this.ocultar(cv, conta);
      if (sub === 'fixar' && M === 'POST') return this.fixar(cv, conta, b);
      if (sub === 'pedido' && M === 'POST') return this.responderPedido(cv, conta, b);
      if (sub === 'convite' && M === 'POST') return this.criarConvite(cv, conta);
    }
    return null;
  }

  // ---------- diretório de chaves públicas (a da conta; as dos aparelhos antigos só para abrir mensagens de antes da 0.5.7) ----------
  // só de quem tem a ver com você: você mesmo, amigos e quem está numa conversa com você
  async chaves(conta, codigos) {
    const out = {}, contas = {};
    const minhas = Object.keys(conta.convs || {});
    for (const cod of codigos.split(',').slice(0, MAX_MEMBROS)) {
      const o = await this.contaPorCodigo(cod.trim());
      if (!o) continue;
      const ok = o.id === conta.id || this.amigos(conta, o.id) || minhas.some((cid) => (o.convs || {})[cid]);
      if (ok) {
        out[o.codigo] = Object.entries(o.chaves || {}).map(([dev, v]) => ({ dev, pub: v.pub }));
        if (o.contaChave) contas[o.codigo] = { kid: o.contaChave.kid, pub: o.contaChave.pub, antigas: (o.contaAntigas || []).map((x) => ({ kid: x.kid, pub: x.pub })) };
      }
    }
    return resposta({ chaves: out, contas });
  }

  // um aparelho que abriu mensagens antigas (cifradas só para aparelhos) embrulha a chave delas para a chave da PRÓPRIA conta
  // Também: RE-COMPARTILHAR o histórico com quem está na conversa e ganhou uma chave nova (perdeu o aparelho antigo, redefiniu sem a
  // senha). Quem já lê a mensagem embrulha a chave dela para a chave ATUAL de outro membro ("R.<seu código>.<sua chave>.<...>").
  // Só para membros da conversa, só se a entrada ainda não existe: ninguém ganha acesso a algo que não deveria ler.
  async migrarChaves(cv, conta, b) {
    const kid = String(b.kid || '');
    if (!conta.contaChave || conta.contaChave.kid !== kid) return erro('Chave da conta desatualizada.', 409);
    if (!this.hub.limitar('mig:' + conta.id, 120, 60000)) return erro('Devagar!', 429);
    const kidsMembros = new Map();
    for (const id of Object.keys(cv.membros)) { if (id === conta.id) continue; const c = await this.get('c:' + id); if (c && c.contaChave) kidsMembros.set(c.contaChave.kid, true); }
    const prefixoR = 'R.' + conta.codigo + '.' + kid + '.';
    let n = 0;
    for (const it of (Array.isArray(b.itens) ? b.itens : []).slice(0, 100)) {
      const seq = parseInt(it && it.seq, 10) || 0, emb = it && it.emb, alvo = it && it.para ? String(it.para) : kid;
      if (seq < 1 || seq > (cv.seq || 0) || !embValido(emb)) continue;
      if (alvo === kid ? !emb.startsWith('M.') : !(kidsMembros.has(alvo) && emb.startsWith(prefixoR))) continue;
      const k = `cm:${cv.id}:${pad(seq)}`, m = await this.get(k);
      if (!m || m.apagado || !m.cifra || m.cifra.chaves[alvo]) continue;
      m.cifra.chaves[alvo] = emb; await this.st.put(k, m); n++;
    }
    return resposta({ ok: true, n });
  }

  // ---------- apelidos (só você vê) e perfil ----------
  async apelido(conta, b) {
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || !this.amigos(conta, o.id)) return erro('Só dá para dar apelido a amigos.');
    conta.apelidos = conta.apelidos || {};
    const a = txt(String(b.apelido || '').replace(/[\u0000-\u001f]/g, ''), 32);
    if (a) conta.apelidos[o.id] = a; else delete conta.apelidos[o.id];
    await this.st.put('c:' + conta.id, conta);
    await this.hub.sincronizar(conta.id);
    return resposta({ ok: true, apelido: a });
  }
  async perfilExtra(conta, b) {
    const p = conta.extra = conta.extra || {};
    const r = await this.aplicarExtra(conta, b, p); if (r) return r;
    await this.st.put('c:' + conta.id, conta);
    await this.hub.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, extra: p });
  }
  // (1.0.3) as regras do perfil num lugar só: o perfil público e o perfil feito para um amigo passam pelas mesmas (o que entrar no editor vale nos dois)
  async aplicarExtra(conta, b, p) {
    if (b.bio !== undefined) p.bio = txt(String(b.bio || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ''), 190);
    if (b.cor1 !== undefined) p.cor1 = HEX6.test(b.cor1) ? b.cor1 : '';
    if (b.fz !== undefined) p.fz = typeof b.fz === 'string' && b.fz.length <= 40 && /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/.test(b.fz) ? b.fz : ''; // (1.0.2) o fuso (o horário da pessoa aparece ao lado do nome, se ela deixar)
    if (b.cor2 !== undefined) p.cor2 = HEX6.test(b.cor2) ? b.cor2 : '';
    // (0.5.9-7) a cor do corpo do cartão (embaixo do banner): sólida (só fundo1) ou degradê (fundo1 -> fundo2)
    if (b.fundo1 !== undefined) p.fundo1 = HEX6.test(b.fundo1) ? b.fundo1 : '';
    if (b.fundo2 !== undefined) p.fundo2 = HEX6.test(b.fundo2) ? b.fundo2 : '';
    if (b.discord !== undefined) { const d = String(b.discord || '').trim().replace(/^@/, '').toLowerCase(); p.discord = /^[a-z0-9_.]{2,32}$/.test(d) ? d : ''; }
    // (0.8.7) o Mural: de que lado do cartão ele fica ('' = sem mural). O conteúdo fica guardado à parte (rota "mural")
    if (b.ml !== undefined) p.ml = ['esquerda', 'direita', 'cima', 'baixo'].includes(b.ml) ? b.ml : '';
    // (0.9.5) o nick do guns.lol (o widget mostra a prévia com o link guns.lol/nick)
    if (b.gl !== undefined) { const d = String(b.gl || '').trim().replace(/^(?:https?:\/\/)?(?:www\.)?guns\.lol\//i, '').replace(/^@/, '').replace(/\/+$/, '').toLowerCase(); p.gl = /^[a-z0-9_.-]{1,32}$/.test(d) ? d : ''; }
    if (b.lb !== undefined) { const d = String(b.lb || '').trim().replace(/^@/, '').toLowerCase(); p.lb = /^[a-z0-9_]{2,15}$/.test(d) ? d : ''; }
    // (0.8.7) os 4 filmes favoritos do Letterboxd, escolhidos no editor (o Letterboxd não deixa ler o perfil)
    if (b.lbf !== undefined) p.lbf = (Array.isArray(b.lbf) ? b.lbf : []).slice(0, 4).map((x) => {
      if (!x || typeof x !== 'object') return null;
      const t = txt(String(x.t || '').replace(/[\u0000-\u001f]/g, ''), 100); if (!t) return null;
      const u = String(x.u || '').slice(0, 200);
      return { t, a: txt(String(x.a || '').replace(/[\u0000-\u001f]/g, ''), 40), c: midia.capaOk(String(x.c || '')), u: /^https:\/\/(letterboxd\.com\/film\/[a-z0-9-]+\/|www\.imdb\.com\/title\/tt\d+\/)$/.test(u) ? u : '' };
    }).filter(Boolean);
    if (b.spotify !== undefined) { // a música do perfil: do Spotify (link) ou do Deezer (busca, com prévia de 30 s)
      const s = b.spotify, capa = String((s && s.capa) || '');
      if (s && s.fonte === 'deezer' && /^\d{1,15}$/.test(String(s.id || ''))) p.spotify = { fonte: 'deezer', id: String(s.id), nome: txt(s.nome, 100), artista: txt(s.artista, 100), capa: /^https:\/\/(cdn|e-cdns)-images\.dzcdn\.net\/images\/[A-Za-z0-9/._-]+$/.test(capa) ? capa : '' };
      else if (s && /^[A-Za-z0-9]{22}$/.test(String(s.id || ''))) p.spotify = { fonte: 'spotify', id: s.id, nome: txt(s.nome, 100), artista: txt(s.artista, 100), capa: /^https:\/\/(i\.scdn\.co|image-cdn-(ak|fa)\.spotifycdn\.com)\/image\/[A-Za-z0-9]+$/.test(capa) ? capa : '' };
      else p.spotify = null;
      // (0.5.9-3) o trecho escolhido: a música inteira vem do YouTube (vídeos achados pelo servidor) e toca de "inicio" até inicio + 30 s
      if (p.spotify) {
        const yt = Array.isArray(s.yt) ? s.yt.filter((v) => /^[A-Za-z0-9_-]{11}$/.test(String(v))).slice(0, 3) : [];
        if (yt.length) { p.spotify.yt = yt; p.spotify.inicio = Math.max(0, Math.min(3600, Math.round(+s.inicio || 0))); p.spotify.duracao = Math.max(0, Math.min(7200, Math.round(+s.duracao || 0))); }
      }
    }
    // (0.8.0) estilo do nome, fundo do perfil, nameplate e arranjo do perfil: só valores conhecidos passam
    const cores = (v, n) => (Array.isArray(v) ? v.filter((x) => HEX6.test(x)).slice(0, n).map((x) => x.toLowerCase()) : []);
    const um = (v, lista, pad) => (lista.includes(v) ? v : pad);
    const num = (v, a, z, pad) => (Number.isFinite(+v) ? Math.max(a, Math.min(z, Math.round(+v))) : pad);
    const TIPOS_DEG = ['linear', 'radial', 'conico'];
    if (b.nm !== undefined) {
      const x = b.nm;
      p.nm = x && typeof x === 'object' ? { f: um(x.f, FONTES_NOME, 'padrao'), e: um(NOME_LEGADO[x.e] || x.e, EFEITOS_NOME, 'solido'), c: cores(x.c, 8) } : null;
      if (p.nm && EFEITOS_EXCLUSIVOS.includes(p.nm.e) && !limitesDe(conta).exclusivo) p.nm.e = 'solido';
      if (p.nm && EFEITOS_PAGOS[p.nm.e] && EFEITOS_PAGOS[p.nm.e] > nivelDe(conta)) p.nm.e = 'solido'; // (1.0.0) efeito novo sem o plano
      if (p.nm && x.a === 'letra' && ['gummy', 'pulo', 'elastico'].includes(p.nm.e)) p.nm.a = 'letra'; // (0.8.0) animação letra por letra
      if (p.nm && p.nm.f === 'padrao' && p.nm.e === 'solido' && !p.nm.c.length) p.nm = null;
    }
    if (b.fd !== undefined) {
      const x = b.fd;
      p.fd = x && typeof x === 'object' ? { t: um(x.t, ['auto', 'cor', 'degrade', 'banner', 'imagem'], 'auto'), g: um(x.g, TIPOS_DEG, 'linear'), a: num(x.a, 0, 360, 160), c: cores(x.c, 10), blur: num(x.blur, 0, 40, 14), luz: num(x.luz, 0, 100, 45) } : null;
      if (x && x.tirarImagem) { delete p.fdV; await this.hub.apagarImagem('fd:', conta.id); } // (0.8.5) tirou a imagem própria do fundo
    }
    if (b.mf !== undefined) { // (0.8.7) o fundo do Mural: o vidro do Aero, igual ao cartão, uma cor, um degradê ou uma imagem própria
      const x = b.mf;
      p.mf = x && typeof x === 'object' && x.t !== 'vidro' ? { t: um(x.t, ['cartao', 'cor', 'degrade', 'imagem'], 'cartao'), g: um(x.g, TIPOS_DEG, 'linear'), a: num(x.a, 0, 360, 160), c: cores(x.c, 10), blur: num(x.blur, 0, 40, 0), luz: num(x.luz, 0, 100, 35) } : null;
      if (x && x.tirarImagem) { delete p.mfV; await this.hub.apagarImagem('mf:', conta.id); }
    }
    if (b.np !== undefined) {
      const x = b.np;
      p.np = x && typeof x === 'object' && x.t !== 'nenhum' ? { t: um(x.t, ['degrade', 'banner', 'imagem'], 'degrade'), g: um(x.g, TIPOS_DEG, 'linear'), a: num(x.a, 0, 360, 90), c: cores(x.c, 10) } : null;
      if (x && x.t === 'nenhum' && x.tirarImagem) { delete p.npV; await this.hub.apagarImagem('np:', conta.id); }
    }
    if (b.pf !== undefined) {
      // (0.8.0) o arranjo do perfil: a foto num dos 9 lugares, cada widget (nome, bio, música, Discord) num retângulo da grade de
      // 6 colunas x 8 linhas (x, y, largura, altura em quadradinhos), o banner (em cima, embaixo, nos lados, cobrindo tudo ou sem),
      // partes compactas, o jeito da música e o tamanho
      const x = b.pf, ZONAS = ['ce', 'cc', 'cd', 'me', 'mc', 'md', 'be', 'bc', 'bd'], MI = Array.from({ length: 24 }, (_, i) => 'm' + i), W = ['nome', 'bio', 'musica', 'discord', 'lb', 'gl', ...MI];
      if (x && typeof x === 'object' && x.gw && typeof x.gw === 'object') {
        const gw = {};
        for (const k of W) {
          const r = x.gw[k]; if (!r || typeof r !== 'object') continue;
          const v = ['x', 'y', 'w', 'h'].map((c) => Number(r[c]));
          if (!v.every(Number.isInteger)) continue;
          const [gx, gy, ww, hh] = v;
          if (gx < 0 || gy < 0 || ww < 1 || hh < 1 || gx + ww > 8 || gy + hh > 16) continue; // (0.8.7) cartão maior = mais quadradinhos (até 8 x 16)
          gw[k] = { x: gx, y: gy, w: ww, h: hh };
        }
        const cp = (Array.isArray(x.cp) ? x.cp : []).filter((v, i, l) => ['bio', 'musica', 'discord', 'lb', 'gl'].includes(v) && l.indexOf(v) === i);
        // (0.8.7) o tamanho dos widgets do Mural no cartão (médio ou grande; compacto é a bolinha de "cp") e quais aparecem (wf)
        const ws = {}; if (x.ws && x.ws.lb === 'g') ws.lb = 'g';
        // (0.8.7) itens do Mural soltos no cartão: cada um aponta para um item do Mural (categoria + nome)
        const mi = {}; for (const k of MI) { const r = x.mi && x.mi[k]; if (r && typeof r === 'object' && MURAL_CATS.includes(r.k) && gw[k]) { const t = txt(String(r.t || ''), 100); if (t) mi[k] = { k: r.k, t }; } }
        for (const k of MI) if (gw[k] && !mi[k]) delete gw[k];
        const ht = Number(x.ht) > 0 ? num(x.ht, 300, 800, 0) : 0;
        p.pf = { v: 4, fp: um(x.fp, ZONAS, 'cc'), gw, bn: um(x.bn, ['faixa', 'cheio', 'nenhum'], 'faixa'), bp: um(x.bp, ['cima', 'baixo', 'esquerda', 'direita'], 'cima'), cp, ms: um(x.ms, ['p', 'm', 'g'], 'm'), w: num(x.w, 300, 560, 440), ht, eu: um(x.eu, ['auto', 'nada', 'nameplate', 'banner', 'fundo'], 'auto') };
        if (Object.keys(ws).length) p.pf.ws = ws; if (Object.keys(mi).length) p.pf.mi = mi;
        if (x.i2) p.pf.i2 = 1; // (0.8.7) os itens do Mural no cartão já passaram para 2 x 2
        if (x.ba === false) p.pf.ba = false; // (0.8.2) a borda animada do Donator/Supporter desligada
        if (x.bt === 'donator') p.pf.bt = 'donator'; // (0.8.2) o Supporter escolheu a borda do Donator
        if (['lado', 'esquerda', 'direita'].includes(x.ma)) p.pf.ma = x.ma; // (0.8.6) a foto do mini perfil do mesmo lado da do cartão
        if (x.fo === 'so') p.pf.fo = 'so'; // (0.9.6) a foto vai para o canto sem ganhar uma coluna (o resto do cartão fica igual)
        if (x.si === false) p.pf.si = false; // (0.9.6) esconder as insígnias e os selos
        if (Array.isArray(x.so)) { const so = x.so.filter((v, i, l) => typeof v === 'string' && /^[si]:/.test(v) && v.length <= 42 && l.indexOf(v) === i).slice(0, 30); if (so.length) p.pf.so = so; } // (1.0.0) quais esconder, uma por uma
      } else p.pf = null;
    }
    // (1.0.2) moldura da foto e anel de quem fala feitos por artistas da Comunidade: a arte vem do pacote publicado (instalar é para todos)
    for (const [k, anel] of [['mo', false], ['an', true]]) {
      const x = b[k]; if (!x || x.t !== 'arte') continue;
      const a = await this.hub.integ.fotoArte(conta, x.ig, x.id, anel);
      delete b[k];
      // a que já estava no perfil e saiu do ar só sai dele (salvar o resto do perfil continua funcionando)
      if (!a) { if (p[k] && p[k].t === 'arte' && p[k].ig === x.ig && p[k].id === x.id) { delete p[k]; continue; } return erro(anel ? 'Esse anel não está mais disponível.' : 'Essa moldura não está mais disponível.', 404); }
      p[k] = a;
    }
    limparPerfil(b, p, nivelDe(conta)); // (1.0.0) os extras do Aero Bubble: moldura, abertura, acessórios, anel, som de entrar, moldura de câmera, cartão de ligação
    return null;
  }
  // (0.8.7) o Mural: filmes, séries, animes, músicas, álbuns e jogos. Cada categoria tem o favorito (1), "que eu gosto" (até 20) e
  // "quero" (assistir/ouvir/jogar, até 20). Cada item: nome, subtítulo, capa e link (de sites conhecidos), nota de 0 a 10 (meias
  // estrelas) e um comentário. Cada categoria fica numa chave própria (o perfil continua leve na lista de amigos)
  async salvarMural(conta, b) {
    if (!this.hub.limitar('mural:' + conta.id, 20, 60000)) return erro('Calma: muitas mudanças no mural.');
    const LINK = /^https:\/\/(www\.imdb\.com\/title\/tt\d+\/|anilist\.co\/(anime|manga)\/\d+|www\.deezer\.com\/(track|album)\/\d+|open\.spotify\.com\/(track|album)\/[A-Za-z0-9]{22}|music\.youtube\.com\/(watch\?v=[A-Za-z0-9_-]{11}|playlist\?list=[A-Za-z0-9_-]{10,60})|store\.steampowered\.com\/app\/\d+\/|letterboxd\.com\/film\/[a-z0-9-]+\/|kitsu\.app\/(anime|manga)\/\d+$|openlibrary\.org\/works\/OL\d+W$|books\.google\.com\/books\?id=[\w-]{6,20}$|en\.wikipedia\.org\/wiki\/[A-Za-z0-9_%().,'!-]+$)/;
    const limpa = (v, n) => txt(String(v || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ''), n);
    const item = (x) => {
      if (!x || typeof x !== 'object') return null;
      const t = limpa(x.t, 100); if (!t) return null;
      const u = String(x.u || '').slice(0, 200), n = Math.round(+x.n);
      const o = { t, a: limpa(x.a, 80), c: midia.capaOk(String(x.c || '')), u: LINK.test(u) ? u : '', n: n >= 1 && n <= 10 ? n : 0, cm: limpa(x.cm, 280) };
      // (0.8.7) músicas do Mural: o trecho de 30 s escolhido (vídeos do YouTube da música inteira, início e duração), como o da música do perfil
      const yt = Array.isArray(x.yt) ? x.yt.filter((v) => /^[A-Za-z0-9_-]{11}$/.test(String(v))).slice(0, 3) : [], dur = Math.round(+x.dur), ini = Math.round(+x.ini);
      if (yt.length && dur > 30 && dur <= 7200 && ini >= 0 && ini <= dur - 30) Object.assign(o, { yt, dur, ini });
      return o;
    };
    const m = b && typeof b.m === 'object' && b.m ? b.m : {}, novo = {};
    for (const c of MURAL_CATS) {
      const x = m[c] && typeof m[c] === 'object' ? m[c] : {};
      // (0.8.7) sem limite pequeno: até 100 em cada lista (o que cabe guardado numa chave só)
      const v = { fav: item(x.fav), gosto: (Array.isArray(x.gosto) ? x.gosto : []).slice(0, 100).map(item).filter(Boolean), quero: c === 'm' || c === 'l' || !Array.isArray(x.quero) ? [] : x.quero.slice(0, 100).map(item).filter(Boolean) };
      const agora = c === 'm' || c === 'l' || !Array.isArray(x.agora) ? [] : x.agora.slice(0, 100).map(item).filter(Boolean); if (agora.length) v.agora = agora; // (1.0.2) jogando/assistindo/lendo agora // (0.8.7) músicas e álbuns sem "quero ouvir"
      // (0.8.7) a ordem das seções (favorito, gosto, quero): a pessoa arrasta no editor
      const secs = c === 'm' || c === 'l' ? ['fav', 'gosto'] : ['fav', 'agora', 'gosto', 'quero'];
      const so = Array.isArray(x.so) ? x.so.filter((s, i, l) => secs.includes(s) && l.indexOf(s) === i) : [];
      const so2 = so.length ? [...so, ...secs.filter((s2) => !so.includes(s2))] : []; // (1.0.2) quem já tinha uma ordem não a perde com a seção nova
      if (so2.length === secs.length && so2.join() !== secs.join()) v.so = so2;
      if (JSON.stringify(v).length > 120000) return erro('Essa aba do mural ficou grande demais. Tire alguns itens ou comentários.');
      novo['mr:' + conta.id + ':' + c] = v.fav || v.gosto.length || v.quero.length || (v.agora && v.agora.length) ? v : null;
    }
    // (0.8.7) a ordem das abas (a pessoa arrasta no editor)
    const ord = (Array.isArray(b && b.ord) ? b.ord : []).filter((c, i, l) => MURAL_CATS.includes(c) && l.indexOf(c) === i);
    novo['mr:' + conta.id + ':o'] = ord.length ? ord : null;
    const tirar = Object.keys(novo).filter((k) => !novo[k]);
    for (const k of tirar) delete novo[k];
    if (tirar.length) await this.hub.ctx.storage.delete(tirar);
    if (Object.keys(novo).length) await this.hub.put(novo);
    const p = conta.extra = conta.extra || {};
    p.mv = (p.mv || 0) + 1; // a versão: quem já abriu o mural sabe que mudou
    await this.st.put('c:' + conta.id, conta);
    await this.hub.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, mv: p.mv });
  }
  async verMural(conta, codigo) {
    const oid = await this.hub.get('f:' + String(codigo).toUpperCase());
    const o = oid && (await this.hub.get('c:' + oid));
    if (!o || (o.bloqueados || {})[conta.id]) return erro('Perfil não encontrado.', 404);
    const ks = [...MURAL_CATS, 'o'].map((c) => 'mr:' + oid + ':' + c), d = await this.hub.ctx.storage.get(ks), m = {};
    for (const c of MURAL_CATS) { const v = d.get('mr:' + oid + ':' + c); if (v) m[c] = v; }
    const ord = d.get('mr:' + oid + ':o'); if (Array.isArray(ord)) m.ord = ord;
    return resposta({ m, mv: (o.extra || {}).mv || 0 });
  }
  // perfis salvos (Supporter): até 5 cópias do perfil (estilo, arranjo, foto, banner e Mural), para trocar num clique
  async perfisSalvos(conta, b) {
    const max = limitesDe(conta).modelos || 0, lista = conta.perfis = Array.isArray(conta.perfis) ? conta.perfis.slice(0, 5) : [];
    const i = Math.round(+b.i);
    if (b.acao === 'listar') return resposta({ ok: true, max, perfis: lista.map((x) => x && { nome: x.nome, quando: x.quando }) });
    if (!max) return erro('Os perfis salvos são do Supporter.');
    if (!(i >= 0 && i < max)) return erro('Esse espaço não existe.');
    if (b.acao === 'salvar') {
      const e = conta.extra || {}, dados = {};
      for (const k of [...PERFIL_MODELO, ...PERFIL_MODELO_X]) if (e[k] !== undefined) dados[k] = structuredClone(e[k]); // cópia: o espaço não muda junto com o perfil
      // (1.0.2) as imagens (fundo do cartão, nameplate e fundo do Mural) vão junto, numa cópia só deste espaço
      const img = {};
      for (const [pre, v] of IMGS_MODELO) img[pre] = e[v] && (await this.hub.copiarImagem(pre + ':', conta.id, 'ps' + pre + ':', conta.id + ':' + i)) ? 1 : 0;
      // (1.0.6) e a foto e o banner também: trocar de perfil sem eles parecia que o perfil salvo não tinha guardado nada
      img.a = conta.avatarV && (await this.hub.copiarImagem('a:', conta.id, 'psa:', conta.id + ':' + i)) ? 1 : 0;
      img.bn = e.bannerV && (await this.hub.copiarImagem('bn:', conta.id, 'psbn:', conta.id + ':' + i)) ? 1 : 0;
      // (1.0.6) e o conteúdo do Mural (filmes, séries, jogos...), numa cópia só deste espaço
      const mk = [...MURAL_CATS, 'o'], mr = await this.hub.ctx.storage.get(mk.map((c) => 'mr:' + conta.id + ':' + c)), copia = {};
      await this.hub.ctx.storage.delete(mk.map((c) => 'psmr:' + conta.id + ':' + i + ':' + c));
      for (const c of mk) { const v = mr.get('mr:' + conta.id + ':' + c); if (v) copia['psmr:' + conta.id + ':' + i + ':' + c] = v; }
      if (Object.keys(copia).length) await this.hub.put(copia);
      lista[i] = { nome: txt(String(b.nome || ''), 30) || 'Perfil ' + (i + 1), quando: Date.now(), dados, x: 1, img, mr: 1 };
    } else if (b.acao === 'usar') {
      if (!lista[i]) return erro('Esse espaço está vazio.');
      const e = conta.extra = conta.extra || {};
      for (const k of [...PERFIL_MODELO, ...(lista[i].x ? PERFIL_MODELO_X : [])]) { if (lista[i].dados[k] !== undefined) e[k] = structuredClone(lista[i].dados[k]); else delete e[k]; } // os salvos antes da 1.0.2 não mexem nos extras
      if (lista[i].img) for (const [pre, v] of IMGS_MODELO) {
        if (lista[i].img[pre] && (await this.hub.copiarImagem('ps' + pre + ':', conta.id + ':' + i, pre + ':', conta.id))) e[v] = (e[v] || 0) + 1; // versão nova: ninguém fica com a imagem antiga no cache
      }
      if (lista[i].mr) { // (1.0.6) o Mural daquele perfil volta inteiro (o de agora sai)
        const mk = [...MURAL_CATS, 'o'], mr = await this.hub.ctx.storage.get(mk.map((c) => 'psmr:' + conta.id + ':' + i + ':' + c)), novo = {}, tirar = [];
        for (const c of mk) { const v = mr.get('psmr:' + conta.id + ':' + i + ':' + c); if (v) novo['mr:' + conta.id + ':' + c] = v; else tirar.push('mr:' + conta.id + ':' + c); }
        if (tirar.length) await this.hub.ctx.storage.delete(tirar);
        if (Object.keys(novo).length) await this.hub.put(novo);
        e.mv = (e.mv || 0) + 1; // quem já abriu o mural sabe que mudou
      }
      const im = lista[i].img || {};
      if (im.a) { await this.hub.guardarRecente(conta); if (await this.hub.copiarImagem('psa:', conta.id + ':' + i, 'a:', conta.id)) conta.avatarV = (conta.avatarV || 0) + 1; } // a foto de agora fica nas recentes
      if (im.bn) { if (await this.hub.copiarImagem('psbn:', conta.id + ':' + i, 'bn:', conta.id)) e.bannerV = (e.bannerV || 0) + 1; }
      else if (im.bn === 0) { await this.hub.apagarImagem('bn:', conta.id); delete e.bannerV; } // guardado sem banner (os salvos antes da 1.0.6 não mexem nele)
      if (e.nm && EFEITOS_EXCLUSIVOS.includes(e.nm.e) && !limitesDe(conta).exclusivo) e.nm.e = 'solido';
      if (e.nm && EFEITOS_PAGOS[e.nm.e] && EFEITOS_PAGOS[e.nm.e] > nivelDe(conta)) e.nm.e = 'solido'; // (0.9.7) o perfil salvo não traz efeito de um plano que a pessoa não tem
    } else if (b.acao === 'apagar') { lista[i] = null; for (const pre of [...IMGS_MODELO.map((x) => x[0]), 'a', 'bn']) await this.hub.apagarImagem('ps' + pre + ':', conta.id + ':' + i); await this.hub.ctx.storage.delete([...MURAL_CATS, 'o'].map((c) => 'psmr:' + conta.id + ':' + i + ':' + c)); }
    else return erro('Ação desconhecida.');
    for (let k = 0; k < max; k++) if (lista[k] === undefined) lista[k] = null;
    await this.st.put('c:' + conta.id, conta);
    if (b.acao === 'usar') await this.hub.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, max, perfis: lista.map((x) => x && { nome: x.nome, quando: x.quando }), extra: conta.extra });
  }
  async salvarBanner(conta, b) {
    const d = typeof b.dados === 'string' ? b.dados : '';
    if (!d) { delete (conta.extra || {}).bannerV; await this.hub.apagarImagem('bn:', conta.id); await this.st.put('c:' + conta.id, conta); return resposta({ ok: true, bannerV: 0 }); }
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(d);
    if (!m || d.length > (m[1] === 'image/gif' ? 1950000 : 560000)) return erro('Imagem inválida ou grande demais (GIF: até 1,4 MB).'); // GIF animado vai como veio
    conta.extra = conta.extra || {};
    conta.extra.bannerV = (conta.extra.bannerV || 0) + 1;
    await this.hub.apagarImagem('bn:', conta.id);
    await this.st.put({ ['bn:' + conta.id]: { mime: m[1], b64: m[2] }, ['c:' + conta.id]: conta });
    await this.hub.mudou([conta.id, ...Object.keys(conta.amigos)]);
    return resposta({ ok: true, bannerV: conta.extra.bannerV });
  }

  // ---------- conversas ----------
  // (0.6.0) recibos: até onde cada pessoa RECEBEU (algum aparelho dela pegou a mensagem, mesmo sem abrir) e LEU. A leitura só aparece se
  // as DUAS contas deixam a confirmação de leitura ligada (Configurações > Privacidade); senão fica só "recebida".
  async recibos(cv, conta) {
    const eu = privDe(conta).lidos, out = [];
    for (const id of Object.keys(cv.membros)) {
      if (id === conta.id) continue;
      const o = await this.get('c:' + id); if (!o) continue;
      const r = (o.convs || {})[cv.id] || {};
      out.push({ codigo: o.codigo, entregue: Math.max(r.entregue || 0, r.lido || 0), lido: eu && privDe(o).lidos ? r.lido || 0 : undefined });
    }
    return out;
  }
  async avisarRecibos(cv, quemMudou) {
    for (const id of Object.keys(cv.membros)) {
      if (id === quemMudou) continue;
      const c = await this.get('c:' + id); if (!c || !this.online(id)) continue;
      this.avisar([id], { tipo: 'conv-recibo', cid: cv.id, recibos: await this.recibos(cv, c) });
    }
  }
  async resumo(cv, conta) {
    const membros = [];
    for (const [id, m] of Object.entries(cv.membros)) { const p = await this.publico(id); if (p) membros.push({ ...p, papel: m.papel, semChamada: !!m.semChamada, apelido: (conta.apelidos || {})[id] || '' }); }
    const meu = (conta.convs || {})[cv.id] || {};
    const pedido = cv.pedido ? { deMim: cv.pedido.de === conta.id, aceito: !!cv.pedido.aceito, recusado: !!cv.pedido.recusado } : undefined;
    return { id: cv.id, tipo: cv.tipo, nome: cv.nome || '', fotoV: cv.fotoV || 0, bannerV: cv.bannerV || 0, membros, seq: cv.seq || 0, lido: meu.lido || 0, marca: meu.marca || 0, mudo: !!meu.mudo, fixadas: cv.fixadas || [], pedido,
      recibos: await this.recibos(cv, conta), ult: cv.ult || cv.criado, um: await this.ultimaMsg(cv, conta), meuPapel: cv.membros[conta.id].papel, cham: await this.chamadaPublica(cv),
      pai: cv.pai || undefined, canal: cv.canal || undefined, limite: cv.tipo === 'grupo' && !cv.pai ? await this.limiteGrupo(cv) : undefined, limCanais: cv.tipo === 'grupo' && !cv.pai ? await this.limiteCanais(cv) : undefined, canais: cv.tipo === 'grupo' && !cv.pai ? (cv.canais || []).map((x) => ({ id: x.id, nome: x.nome, tipo: x.tipo })) : undefined };
  }
  // (0.8.3) a última mensagem (ainda cifrada) da conversa: a lista do Aero Talk mostra a prévia e os vistos dela desde o começo
  async ultimaMsg(cv, conta) {
    for (let s = cv.seq || 0, n = 0; s >= 1 && n < 4; s--, n++) {
      const m = await this.get(`cm:${cv.id}:${pad(s)}`); if (!m) continue;
      if (m.apagado) return { seq: m.seq, t: m.t, apagado: true };
      const p = await this.publico(m.de); if (!p) return null;
      if (m.de !== conta.id && bloqueio(conta, await this.get('c:' + m.de))) return null;
      return { seq: m.seq, de: p.codigo, t: m.t, cifra: m.cifra, sis: m.sis, anexo: m.anexo ? { id: m.anexo.id } : undefined, anexos: m.anexos ? m.anexos.map((a) => ({ id: a.id })) : undefined };
    }
    return null;
  }
  async listar(conta) {
    const out = [], entregar = [];
    for (const cid of Object.keys(conta.convs || {})) {
      const cv = await this.get('cv:' + cid); if (!cv || !cv.membros[conta.id]) continue;
      const r = conta.convs[cid];
      if (r.oculta && (cv.seq || 0) <= r.oculta) continue; // DM fechada: volta sozinha quando chegar mensagem nova
      if (cv.pedido && cv.pedido.recusado && cv.pedido.de !== conta.id) continue;
      if ((r.entregue || 0) < (cv.seq || 0)) { r.entregue = cv.seq; entregar.push(cv); } // abriu a lista: tudo até aqui foi RECEBIDO
      out.push(await this.resumo(cv, conta));
    }
    // (0.6.1) grava só o "recebido" na conta FRESCA: gravar a cópia lida no começo do pedido apagava uma conversa que tinha acabado de chegar
    // (outro pedido a ligou no meio) e ela sumia da lista até a próxima mensagem
    if (entregar.length) {
      const fresca = await this.get('c:' + conta.id);
      if (fresca && fresca.convs) { for (const cv of entregar) { const r = fresca.convs[cv.id]; if (r) r.entregue = Math.max(r.entregue || 0, cv.seq || 0); } await this.st.put('c:' + conta.id, fresca); }
      for (const cv of entregar) await this.avisarRecibos(cv, conta.id);
    }
    out.sort((x, y) => (y.ult || 0) - (x.ult || 0));
    return resposta({ conversas: out });
  }
  async ligar(cv, ids) { // registra a conversa na lista de cada conta
    for (const id of ids) {
      const c = await this.get('c:' + id); if (!c) continue;
      c.convs = c.convs || {}; if (!c.convs[cv.id]) { c.convs[cv.id] = { lido: 0 }; await this.st.put('c:' + id, c); }
    }
  }
  async desligar(cid, id) { const c = await this.get('c:' + id); if (c && c.convs && c.convs[cid]) { delete c.convs[cid]; await this.st.put('c:' + id, c); } }

  // quem pode mandar mensagem para "o" sem serem amigos (0.6.0): 'todos' direto, 'pedidos' uma mensagem e espera aceitar, 'amigos' ninguém
  podeEscrever(conta, o) { if (!o || bloqueio(conta, o)) return false; if (this.amigos(conta, o.id)) return true; return privDe(o).mensagens !== 'amigos'; }
  async abrirDM(conta, b) {
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || o.id === conta.id) return erro('Conta não encontrada.', 404);
    if (!this.podeEscrever(conta, o)) return erro(bloqueio(conta, o) ? 'Não dá para conversar com essa pessoa.' : 'Essa pessoa só recebe mensagens de amigos.', 403);
    const [x, y] = conta.id < o.id ? [conta.id, o.id] : [o.id, conta.id];
    const cid = 'd' + (await sha(x + '|' + y)).slice(0, 20);
    let cv = await this.get('cv:' + cid);
    if (!cv) { cv = { id: cid, tipo: 'dm', membros: { [x]: { papel: 'membro', desde: Date.now() }, [y]: { papel: 'membro', desde: Date.now() } }, criado: Date.now(), seq: 0 }; }
    if (!this.amigos(conta, o.id) && privDe(o).mensagens === 'pedidos' && !(cv.pedido && cv.pedido.aceito)) cv.pedido = cv.pedido && !cv.pedido.recusado ? cv.pedido : { de: conta.id, aceito: false, t: Date.now() };
    await this.st.put('cv:' + cid, cv);
    await this.ligar(cv, [conta.id]); // o outro lado só vê a conversa quando chegar a primeira mensagem
    const r = (await this.get('c:' + conta.id)); if (r.convs && r.convs[cid] && r.convs[cid].oculta) { delete r.convs[cid].oculta; await this.st.put('c:' + conta.id, r); }
    return resposta(await this.resumo(cv, r));
  }
  async responderPedido(cv, conta, b) {
    if (!cv.pedido || cv.pedido.de === conta.id) return erro('Não há pedido para responder.');
    if (b.aceitar) { cv.pedido.aceito = true; delete cv.pedido.recusado; } else { cv.pedido.recusado = true; }
    await this.st.put('cv:' + cv.id, cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true });
  }
  async criarGrupo(conta, b) {
    const nome = txt(String(b.nome || '').replace(/[<>\u0000-\u001f]/g, ''), 40);
    if (nome.length < 1) return erro('Dê um nome ao grupo.');
    const membros = { [conta.id]: { papel: 'dono', desde: Date.now() } };
    const max = limitesDe(conta).grupo;
    if (Array.isArray(b.membros) && b.membros.length > max - 1) return erro(`Grupos têm no máximo ${max} pessoas (você e mais ${max - 1}). Para mais gente, crie uma sala!`);
    for (const cod of (Array.isArray(b.membros) ? b.membros : []).slice(0, max - 1)) {
      const o = await this.contaPorCodigo(cod); if (o && this.amigos(conta, o.id)) membros[o.id] = { papel: 'membro', desde: Date.now() };
    }
    const cv = { id: 'g' + aleatorioHex(10), tipo: 'grupo', nome, dono: conta.id, membros, criado: Date.now(), seq: 0 };
    await this.st.put('cv:' + cv.id, cv);
    await this.ligar(cv, Object.keys(membros));
    this.avisar(Object.keys(membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, await this.get('c:' + conta.id)));
  }

  async mensagens(cv, conta, url) {
    // (0.9.1) número absurdo (2147483647, negativo...) não faz o servidor varrer posições que não existem: fica entre 1 e a última + 1
    const antes = Math.min((cv.seq || 0) + 1, Math.max(0, parseInt(url.searchParams.get('antes'), 10) || (cv.seq || 0) + 1));
    const lim = Math.min(80, Math.max(1, parseInt(url.searchParams.get('limite'), 10) || 50));
    const msgs = [];
    const seqs = String(url.searchParams.get('seqs') || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0 && x <= (cv.seq || 0)).slice(0, 50);
    if (seqs.length) { for (const s of seqs) { const m = await this.get(`cm:${cv.id}:${pad(s)}`); if (m) msgs.push(m); } msgs.reverse(); } // (0.6.0) as fixadas: mensagens pedidas pelo número
    else { // (0.8.7) em lotes (antes era uma leitura por mensagem, uma depois da outra)
      const piso = Math.max(1, (cv.seq || 0) - MAX_MSGS - 64); let lotes = 0; // as mais antigas que o limite já foram apagadas: não procura lá
      for (let s = antes - 1; s >= piso && msgs.length < lim && lotes++ < 40;) {
        const ks = []; for (let n = 0; n < 64 && s >= piso; n++, s--) ks.push(`cm:${cv.id}:${pad(s)}`);
        const mp = await this.st.get(ks); for (const k of ks) { const m = mp.get(k); if (m && msgs.length < lim) msgs.push(m); }
      }
    }
    msgs.reverse();
    const mapa = {}, bloq = {};
    for (const m of msgs) if (!mapa[m.de]) { mapa[m.de] = (await this.publico(m.de)) || { codigo: '?', nome: '?' }; bloq[m.de] = m.de !== conta.id && bloqueio(conta, await this.get('c:' + m.de)); }
    const r = (conta.convs || {})[cv.id];
    if (r && (r.entregue || 0) < (cv.seq || 0)) { r.entregue = cv.seq; await this.st.put('c:' + conta.id, conta); await this.avisarRecibos(cv, conta.id); }
    const reas = {}; for (const m of msgs) if (m.rea && !bloq[m.de]) reas[m.seq] = await this.reacoesPublicas(m.rea);
    return resposta({ msgs: msgs.map((m) => (bloq[m.de] ? { id: m.id, seq: m.seq, de: mapa[m.de].codigo, t: m.t, bloqueada: true } : { ...m, de: mapa[m.de].codigo, rea: reas[m.seq] || undefined })), mais: msgs.length ? msgs[0].seq > 1 : false });
  }
  async novaMensagem(cv, conta, b) {
    // (0.9.1) anti-spam: uma rajada curta passa (até 10 em 5 s), mas mensagem sem parar não (no máximo 60 por minuto). O app segura as
    // que passarem do limite (ficam com o relógio) e manda sozinho quando liberar, então quem recebe não é inundado
    if (!this.hub.limitar('msg:' + conta.id, 10, 5000) || !this.hub.limitar('msgm:' + conta.id, 60, 60000)) return erro('Devagar! Muitas mensagens seguidas.', 429);
    const mudo = await this.hub.admin.silenciado(conta);
    if (mudo) return erro('Você está impedido de mandar mensagens' + (mudo.ate ? ' até ' + new Date(mudo.ate).toLocaleString('pt-BR') : '') + (mudo.motivo ? ' (' + mudo.motivo + ')' : '') + '.', 403);
    const cifra = cifraValida(b.cifra);
    if (!cifra) return erro('Mensagem inválida.');
    if (cv.tipo === 'dm') {
      const outroId = Object.keys(cv.membros).find((id) => id !== conta.id), outro = outroId && (await this.get('c:' + outroId));
      if (!outro || bloqueio(conta, outro)) return erro('Não dá para mandar mensagem para essa pessoa.', 403);
      if (!this.amigos(conta, outroId)) {
        const pol = privDe(outro).mensagens;
        if (pol === 'amigos') return erro('Essa pessoa só recebe mensagens de amigos.', 403);
        if (cv.pedido && !cv.pedido.aceito) {
          if (cv.pedido.recusado) return erro('Essa pessoa recusou o pedido de mensagem.', 403);
          if (cv.pedido.de === conta.id && cv.pedido.enviada) return erro('Espere a pessoa aceitar o seu pedido de mensagem.', 403);
          if (cv.pedido.de !== conta.id) cv.pedido.aceito = true; // respondeu: aceitou
          else cv.pedido.enviada = true;
        }
        await this.ligar(cv, [outroId]);
      }
    }
    // (0.9.5) várias fotos/vídeos enviados juntos: uma mensagem só com a lista (o primeiro também vai em "anexo", para os apps antigos)
    const ids = Array.isArray(b.anexos) && b.anexos.length > 1 ? b.anexos.slice(0, 20).map(String) : b.anexo ? [String(b.anexo)] : [];
    if (ids.length > 1 && (new Set(ids).size !== ids.length || (b.anexo && String(b.anexo) !== ids[0]))) return erro('Anexo não encontrado.');
    const lista = [];
    for (const id of ids) {
      if (!/^[0-9a-f]{20}$/.test(id)) return erro('Anexo não encontrado.');
      const meta = await this.get(`cai:${cv.id}:${id}`);
      if (!meta || meta.de !== conta.id || (meta.r2 && !meta.pronto) || meta.usado || meta.preso) return erro('Anexo não encontrado.');
      lista.push([id, meta]);
    }
    for (const [id, meta] of lista) {
      if (meta.r2) { meta.usado = true; await this.st.put(`cai:${cv.id}:${id}`, meta); await this.st.delete(`anxp:${conta.id}:${id}`); }
      else if (lista.length > 1) { meta.preso = true; await this.st.put(`cai:${cv.id}:${id}`, meta); } // não entra em outra mensagem
    }
    const anexo = lista.length ? { id: lista[0][0], tam: lista[0][1].tam } : null;
    cv.seq = (cv.seq || 0) + 1; cv.ult = Date.now();
    const msg = { id: cv.seq, seq: cv.seq, de: conta.id, t: cv.ult, cifra };
    if (anexo) msg.anexo = anexo;
    if (lista.length > 1) msg.anexos = lista.map(([id, meta]) => ({ id, tam: meta.tam }));
    if (Number.isInteger(b.resp) && b.resp > 0 && b.resp < cv.seq) msg.resp = b.resp;
    const grava = { ['cv:' + cv.id]: cv, [`cm:${cv.id}:${pad(cv.seq)}`]: msg };
    await this.st.put(grava);
    if (cv.seq > MAX_MSGS) await this.removerMensagem(cv, cv.seq - MAX_MSGS, true);
    const eu = await this.publico(conta.id);
    // (0.6.0) DM fechada pela outra pessoa volta para a lista dela; quem tem bloqueio com quem mandou recebe só "mensagem oculta";
    // quem está com algum aparelho conectado já RECEBEU (o recibo de "recebida" vai para quem mandou)
    for (const id of Object.keys(cv.membros)) {
      if (id === conta.id) continue;
      const c = await this.get('c:' + id); if (!c) continue;
      c.convs = c.convs || {};
      let mudou = !c.convs[cv.id]; // primeira mensagem da DM: a conversa entra na lista da outra pessoa
      const r = c.convs[cv.id] = c.convs[cv.id] || { lido: 0 };
      if (r.oculta) { delete r.oculta; mudou = true; }
      const bl = bloqueio(conta, c);
      this.avisar([id], { tipo: 'conv-msg', cid: cv.id, msg: bl ? { id: msg.id, seq: msg.seq, de: eu.codigo, t: msg.t, bloqueada: true } : { ...msg, de: eu.codigo }, nome: cv.nome || '', deNome: eu.nome });
      if (this.online(id)) { r.entregue = cv.seq; mudou = true; }
      // (0.9.2) o push é por aparelho: o celular no fundo (ou fechado) recebe mesmo com o PC da pessoa aberto
      // (1.0.2) quem está na chamada com quem mandou não recebe push: já está ali com a pessoa
      const juntos = !!(cv.cham && cv.cham.quem && cv.cham.quem[id] && cv.cham.quem[conta.id]);
      // (1.0.3) não perturbe ou status com "sem notificações": só quem a pessoa escolheu em "quem pode passar" chega ao celular
      const passa = !!(c.prefs && c.prefs.v && Array.isArray(c.prefs.v.npExclusivos) && c.prefs.v.npExclusivos.includes(eu.codigo));
      const quieto = (c.status === 'ocupado' || !!(c.stc && c.stc.sn)) && !passa;
      if (!bl && !r.mudo && !quieto && !juntos) await this.hub.push.avisar(id, { cid: cv.id, de: eu.nome || '', cod: eu.codigo, av: eu.av, g: cv.tipo === 'dm' ? '' : (cv.nome || '') }).catch(() => {}); // (0.9.1) push
      if (mudou) await this.st.put('c:' + id, c);
    }
    this.avisar([conta.id], { tipo: 'conv-msg', cid: cv.id, msg: { ...msg, de: eu.codigo }, nome: cv.nome || '', deNome: eu.nome });
    await this.avisarRecibos(cv, null);
    return resposta({ ok: true, seq: msg.seq });
  }
  // (0.7.2) REAÇÕES com emoji (como no Discord): { emoji: [contas] } na mensagem. Clicar de novo tira. Todo mundo da conversa vê na hora.
  // O emoji fica aberto no servidor (só o emoji, nunca o texto da mensagem, que continua cifrado)
  async reagir(cv, conta, seq, b) {
    if (!this.hub.limitar('rea:' + conta.id, 60, 10000)) return erro('Devagar!', 429);
    const e = typeof b.e === 'string' ? b.e.trim() : '';
    if (!e || e.length > 32 || /[\s<>]/.test(e)) return erro('Reação inválida.');
    const k = `cm:${cv.id}:${pad(parseInt(seq, 10) || 0)}`, m = await this.get(k);
    if (!m || m.apagado || m.sis) return erro('Mensagem não encontrada.', 404);
    const rea = m.rea || {}, lista = rea[e] || [];
    const tem = lista.includes(conta.id), quer = b.sim == null ? !tem : !!b.sim;
    // (1.0.0) super reação ("s:" + emoji): Donator 3 por dia, Supporter sem limite. Tirar é sempre livre.
    let sup = null;
    if (e.startsWith('s:') && quer && !tem) {
      const nv = nivelDe(conta);
      if (nv < 3) return erro('A super reação é do Aero Bubble Donator e Supporter.', 403);
      if (nv === 3) { const kd = 'srd:' + conta.id + ':' + new Date().toISOString().slice(0, 10), n = (await this.get(kd)) || 0; if (n >= 3) return erro('Você já usou as 3 super reações de hoje. Amanhã tem mais!'); await this.st.put(kd, n + 1); }
      sup = { e: e.slice(2), de: conta.codigo };
    }
    if (quer && !tem) { if (!rea[e] && Object.keys(rea).length >= 20) return erro('Esta mensagem já tem reações demais.'); rea[e] = [...lista, conta.id]; }
    else if (!quer && tem) { rea[e] = lista.filter((x) => x !== conta.id); if (!rea[e].length) delete rea[e]; }
    else return resposta({ ok: true });
    if (Object.keys(rea).length) m.rea = rea; else delete m.rea;
    await this.st.put(k, m);
    const pub = await this.reacoesPublicas(m.rea);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-reacao', cid: cv.id, seq: m.seq, rea: pub, ...(sup ? { sup } : {}) });
    return resposta({ ok: true, rea: pub });
  }
  // as contas viram códigos públicos (o que o app conhece)
  async reacoesPublicas(rea) {
    if (!rea) return null;
    const out = {};
    for (const [e, ids] of Object.entries(rea)) { out[e] = []; for (const id of ids) { const p = await this.publico(id); if (p) out[e].push(p.codigo); } }
    return out;
  }
  async editar(cv, conta, seq, b) {
    const k = `cm:${cv.id}:${pad(parseInt(seq, 10) || 0)}`, m = await this.get(k);
    if (!m || m.apagado || m.de !== conta.id) return erro('Só dá para editar as suas mensagens.', 403);
    const cifra = cifraValida(b.cifra); if (!cifra) return erro('Mensagem inválida.');
    m.cifra = cifra; m.editado = Date.now();
    await this.st.put(k, m);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-editada', cid: cv.id, seq: m.seq, de: conta.codigo, t: m.t, cifra, editado: m.editado, rea: m.rea ? await this.reacoesPublicas(m.rea) : undefined, anexo: m.anexo ? { id: m.anexo.id } : undefined, anexos: m.anexos ? m.anexos.map((a) => ({ id: a.id })) : undefined }); // (0.7.14) com a hora: sem ela a mensagem editada ficava "NaN décadas atrás"
    return resposta({ ok: true });
  }
  async apagar(cv, conta, seq) {
    const n = parseInt(seq, 10) || 0, m = await this.get(`cm:${cv.id}:${pad(n)}`);
    const papel = cv.membros[conta.id].papel;
    if (!m || m.apagado) return erro('Mensagem não encontrada.', 404);
    if (m.de !== conta.id && !(cv.tipo === 'grupo' && (papel === 'dono' || papel === 'admin'))) return erro('Só dá para apagar as suas mensagens.', 403);
    await this.removerMensagem(cv, n, false);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-apagada', cid: cv.id, seq: n });
    return resposta({ ok: true });
  }
  async removerMensagem(cv, n, deVez) {
    const k = `cm:${cv.id}:${pad(n)}`, m = await this.get(k); if (!m) return;
    if (m.anexos) { for (const a of m.anexos) await this.apagarAnexo(cv.id, a.id); } else if (m.anexo) await this.apagarAnexo(cv.id, m.anexo.id);
    if (deVez) await this.st.delete(k); else await this.st.put(k, { id: m.id, seq: m.seq, de: m.de, t: m.t, apagado: true });
  }
  async lido(cv, conta, b) {
    // (0.9.1) a conta FRESCA: com muitas mensagens seguidas, gravar a cópia do começo do pedido podia desfazer um "recebida"/"lida" mais novo
    conta = (await this.get('c:' + conta.id)) || conta;
    conta.convs = conta.convs || {}; const r = conta.convs[cv.id] || {};
    const antes = r.lido || 0;
    r.lido = Math.min(cv.seq || 0, Math.max(antes, parseInt(b.seq, 10) || 0)); r.entregue = Math.max(r.entregue || 0, r.lido); conta.convs[cv.id] = r;
    await this.st.put('c:' + conta.id, conta);
    if (r.lido !== antes) { this.avisar([conta.id], { tipo: 'conv-lido', cid: cv.id, lido: r.lido }); await this.avisarRecibos(cv, conta.id); if (r.lido >= (cv.seq || 0)) await this.hub.push.lida(conta.id, cv.id).catch(() => {}); } // (0.6.0) os outros aparelhos da conta tiram o contador na hora
    return resposta({ ok: true, lido: r.lido });
  }
  // (0.6.0) "marcar como não lida": guarda de onde a pessoa quer continuar (a mensagem); não muda o "lida" que os outros veem
  async marcar(cv, conta, b) {
    const r = (conta.convs = conta.convs || {})[cv.id] = conta.convs[cv.id] || {};
    const seq = Math.max(0, Math.min(cv.seq || 0, parseInt(b.seq, 10) || 0));
    if (seq) r.marca = seq; else delete r.marca;
    await this.st.put('c:' + conta.id, conta);
    this.avisar([conta.id], { tipo: 'conv-marca', cid: cv.id, marca: seq });
    return resposta({ ok: true, marca: seq });
  }
  async silenciar(cv, conta, b) {
    const r = (conta.convs = conta.convs || {})[cv.id] = conta.convs[cv.id] || {};
    if (b.mudo) r.mudo = true; else delete r.mudo;
    await this.st.put('c:' + conta.id, conta);
    this.avisar([conta.id], { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true, mudo: !!r.mudo });
  }
  async ocultar(cv, conta) { // fechar a DM (some da lista até chegar mensagem nova)
    if (cv.tipo !== 'dm') return erro('Grupos não fecham: use "Sair do grupo".');
    const r = (conta.convs = conta.convs || {})[cv.id] = conta.convs[cv.id] || {};
    r.oculta = cv.seq || 0; await this.st.put('c:' + conta.id, conta);
    this.avisar([conta.id], { tipo: 'conv-removido', cid: cv.id });
    return resposta({ ok: true });
  }
  // mensagens fixadas: (0.6.9) qualquer pessoa da conversa fixa e desafixa (na DM e no grupo; antes no grupo só o dono e os admins)
  async fixar(cv, conta, b) {
    const seq = parseInt(b.seq, 10) || 0;
    const m = seq > 0 && (await this.get(`cm:${cv.id}:${pad(seq)}`));
    if (b.sim && (!m || m.apagado || m.sis)) return erro('Mensagem não encontrada.', 404);
    const l = (cv.fixadas || []).filter((x) => x !== seq);
    if (b.sim) l.unshift(seq);
    cv.fixadas = l.slice(0, 50);
    await this.st.put('cv:' + cv.id, cv);
    if (b.sim) await this.msgSistema(cv, conta.id, { tipo: 'fixou', seq }); // (1.0.2) "Fulano fixou uma mensagem." no chat, com o botão para ir até ela
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true, fixadas: cv.fixadas });
  }

  // ---------- bloquear (0.6.0) ----------
  async bloquear(conta, b) {
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || o.id === conta.id) return erro('Conta não encontrada.', 404);
    conta.bloqueados = conta.bloqueados || {};
    if (b.sim) {
      conta.bloqueados[o.id] = Date.now();
      delete conta.amigos[o.id]; if (o.amigos) delete o.amigos[conta.id]; // a amizade acaba junto
      await this.st.put({ ['c:' + conta.id]: conta, ['c:' + o.id]: o });
    } else { delete conta.bloqueados[o.id]; await this.st.put('c:' + conta.id, conta); }
    await this.hub.mudou([conta.id, o.id]);
    return resposta({ ok: true });
  }
  async listaBloqueados(conta) { const out = []; for (const id of Object.keys(conta.bloqueados || {})) { const p = await this.publico(id); if (p) out.push(p); } return out; }

  // ---------- convites de grupo por link (0.6.0, como no Discord: vale 24 h) ----------
  async criarConvite(cv, conta) {
    if (cv.tipo !== 'grupo') return erro('Só grupos têm convite.');
    if (!this.hub.limitar('gcv:' + conta.id, 20, 3600000)) return erro('Devagar! Muitos convites seguidos.', 429);
    const codigo = aleatorioHex(5).toUpperCase(), ate = Date.now() + 86400000;
    await this.st.put('gi:' + codigo, { cid: cv.id, por: conta.id, ate });
    return resposta({ codigo, ate });
  }
  async lerConvite(codigo) {
    if (!/^[0-9A-F]{10}$/.test(String(codigo))) return null;
    const c = await this.get('gi:' + codigo);
    if (!c || c.ate < Date.now()) return null;
    const cv = await this.get('cv:' + c.cid);
    return cv && cv.membros[c.por] ? { c, cv } : null; // (0.9.1) quem criou o link saiu ou foi removido: o link morre junto
  }
  async verConvite(conta, codigo) {
    const x = await this.lerConvite(codigo);
    if (!x) return resposta({ valido: false });
    const ids = Object.keys(x.cv.membros), avatares = [];
    for (const id of ids.slice(0, 4)) { const p = await this.publico(id); if (p) avatares.push(p); }
    return resposta({ valido: true, cid: x.cv.id, nome: x.cv.nome, fotoV: x.cv.fotoV || 0, membros: ids.length, avatares, ja: !!x.cv.membros[conta.id], cheio: ids.length >= (await this.limiteGrupo(x.cv)), ate: x.c.ate });
  }
  async entrarConvite(conta, codigo) {
    const x = await this.lerConvite(codigo);
    if (!x) return erro('Esse convite venceu ou não existe.', 404);
    const cv = x.cv;
    if (cv.membros[conta.id]) return resposta(await this.resumo(cv, conta));
    if (cv.fora && cv.fora[conta.id]) return erro('Você foi removido deste grupo. Peça para alguém do grupo te adicionar de novo.', 403);
    const max = await this.limiteGrupo(cv);
    if (Object.keys(cv.membros).length >= max) return erro(`O grupo já tem ${max} pessoas.`);
    const quem = await this.get('c:' + x.c.por); if (quem && bloqueio(conta, quem)) return erro('Não dá para entrar nesse grupo.', 403);
    cv.membros[conta.id] = { papel: 'membro', desde: Date.now() };
    await this.st.put('cv:' + cv.id, cv); await this.ligar(cv, [conta.id]); await this.sincronizarCanais(cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, await this.get('c:' + conta.id)));
  }

  // ---------- anexos (bytes já cifrados no aparelho; até 10 MB) ----------
  async subirAnexo(cv, conta, request) {
    if (!this.hub.limitar('anx:' + conta.id, 20, 60000)) return erro('Devagar! Muitos arquivos seguidos.', 429);
    const dados = new Uint8Array(await request.arrayBuffer());
    if (!dados.length || dados.length > MAX_ANEXO) return erro('Arquivo grande demais (máximo 10 MB).', 413);
    const id = aleatorioHex(10), partes = Math.ceil(dados.length / PEDACO), grava = {};
    for (let i = 0; i < partes; i++) grava[`cap:${cv.id}:${id}:${i}`] = dados.slice(i * PEDACO, (i + 1) * PEDACO);
    grava[`cai:${cv.id}:${id}`] = { de: conta.id, tam: dados.length, partes, t: Date.now() };
    await this.st.put(grava);
    return resposta({ id, tam: dados.length });
  }
  async baixarAnexo(cv, id) {
    if (!/^[0-9a-f]{20}$/.test(id)) return erro('Anexo não encontrado.', 404);
    const meta = await this.get(`cai:${cv.id}:${id}`);
    if (!meta) return erro('Anexo não encontrado.', 404);
    const out = new Uint8Array(meta.tam); let o = 0;
    for (let i = 0; i < meta.partes; i++) { const p = new Uint8Array(await this.get(`cap:${cv.id}:${id}:${i}`)); out.set(p, o); o += p.length; }
    return new Response(out, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
  }
  // (0.7.14) ANEXO GRANDE (Aero Bubble, de 10 MB até 50/100/500 MB conforme o plano de quem envia). O aparelho cifra o arquivo em partes
  // de 8 MB (cada uma com a sua etiqueta) e sobe uma de cada vez: nem o aparelho nem o servidor precisam ter o arquivo inteiro na memória.
  // As partes ficam no R2 (o armazenamento do Durable Object não comporta arquivos assim). Sem o R2 configurado, o limite continua 10 MB.
  //  1) POST anexo-grande { tam (do arquivo original), partes } -> { id }   2) POST anexo-grande/<id>/<n> (bytes de cada parte, em ordem)   3) a mensagem cita o id
  // O id só vale para a mensagem depois que todas as partes chegaram; partes que não viraram mensagem em 1 dia são apagadas.
  async comecarGrande(cv, conta, b) {
    const r2 = this.hub.env.ANEXOS, lim = limitesDe(conta).anexo, tam = Math.round(+b.tam || 0), partes = Math.round(+b.partes || 0);
    if (!this.hub.limitar('anx:' + conta.id, 20, 60000)) return erro('Devagar! Muitos arquivos seguidos.', 429);
    if (!(tam > 0) || tam > lim) return erro(lim > MAX_ANEXO ? `Arquivo grande demais (máximo ${Math.round(lim / 1048576)} MB).` : 'Arquivo grande demais (máximo 10 MB). Com o Aero Bubble, até 500 MB.', 413);
    if (partes !== Math.ceil(tam / PARTE)) return erro('Pedido inválido.');
    await this.limparGrandes(conta.id);
    const id = aleatorioHex(10);
    await this.st.put({ [`cai:${cv.id}:${id}`]: { de: conta.id, tam, partes, r2: true, local: !r2 || undefined, recebidas: 0, t: Date.now() }, [`anxp:${conta.id}:${id}`]: { cid: cv.id, t: Date.now() } });
    return resposta({ id, parte: PARTE });
  }
  async parteGrande(cv, conta, id, n, request) {
    if (!/^[0-9a-f]{20}$/.test(id) || !/^\d{1,3}$/.test(n)) return erro('Pedido inválido.');
    const meta = await this.get(`cai:${cv.id}:${id}`), i = +n;
    if (!meta || !meta.r2 || meta.de !== conta.id) return erro('Anexo não encontrado.', 404);
    if (i !== meta.recebidas || i >= meta.partes) return erro('Parte fora de ordem.', 409);
    const dados = new Uint8Array(await request.arrayBuffer());
    if (!dados.length || dados.length > PARTE + 64) return erro('Parte grande demais.', 413);
    meta.soma = (meta.soma || 0) + dados.length;
    if (meta.soma > meta.tam + meta.partes * 16) return erro('Arquivo grande demais.', 413);
    if (meta.local) { // (0.9.4) sem o R2: a parte fica no armazenamento do servidor, em pedaços de 1 MB
      const grava = {}, n2 = Math.ceil(dados.length / PEDACO);
      for (let j = 0; j < n2; j++) grava[`cag:${cv.id}:${id}:${i}:${j}`] = dados.slice(j * PEDACO, (j + 1) * PEDACO);
      await this.st.put(grava); (meta.ped = meta.ped || [])[i] = n2;
    } else await this.hub.env.ANEXOS.put(`a/${cv.id}/${id}/${i}`, dados);
    meta.recebidas = i + 1; if (meta.recebidas === meta.partes) meta.pronto = true;
    await this.st.put(`cai:${cv.id}:${id}`, meta);
    return resposta({ ok: true, pronto: !!meta.pronto });
  }
  async baixarParte(cv, id, n) {
    if (!/^[0-9a-f]{20}$/.test(id) || !/^\d{1,3}$/.test(n)) return erro('Anexo não encontrado.', 404);
    const meta = await this.get(`cai:${cv.id}:${id}`);
    if (!meta || !meta.r2 || !meta.pronto || +n >= meta.partes || (!meta.local && !this.hub.env.ANEXOS)) return erro('Anexo não encontrado.', 404);
    if (meta.local) {
      const n2 = (meta.ped || [])[+n] || 0, ps = [];
      for (let j = 0; j < n2; j++) ps.push(new Uint8Array(await this.get(`cag:${cv.id}:${id}:${+n}:${j}`)));
      const out = new Uint8Array(ps.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of ps) { out.set(p, o); o += p.length; }
      return new Response(out, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
    }
    const o = await this.hub.env.ANEXOS.get(`a/${cv.id}/${id}/${+n}`);
    if (!o) return erro('Anexo não encontrado.', 404);
    return new Response(o.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
  }
  // envios grandes que não viraram mensagem em 1 dia (o app fechou no meio, por exemplo): saem
  async limparGrandes(contaId) {
    const pend = await this.st.list({ prefix: `anxp:${contaId}:` });
    for (const [k, v] of pend) {
      if (Date.now() - v.t < 86400000) continue;
      const id = k.split(':')[2], meta = await this.get(`cai:${v.cid}:${id}`);
      if (meta && !meta.usado) await this.apagarAnexo(v.cid, id);
      await this.st.delete(k);
    }
  }
  async apagarAnexo(cid, id) {
    const meta = await this.get(`cai:${cid}:${id}`); if (!meta) return;
    if (meta.r2 && meta.local) { for (let i = 0; i < meta.partes; i++) { const ks = []; for (let j = 0; j < ((meta.ped || [])[i] || 0); j++) ks.push(`cag:${cid}:${id}:${i}:${j}`); if (ks.length) await this.st.delete(ks); } await this.st.delete([`cai:${cid}:${id}`, `anxp:${meta.de}:${id}`]); return; }
    if (meta.r2) { const r2 = this.hub.env.ANEXOS; if (r2) { const ks = []; for (let i = 0; i < meta.partes; i++) ks.push(`a/${cid}/${id}/${i}`); await r2.delete(ks).catch(() => {}); } await this.st.delete([`cai:${cid}:${id}`, `anxp:${meta.de}:${id}`]); return; }
    for (let i = 0; i < meta.partes; i++) await this.st.delete(`cap:${cid}:${id}:${i}`);
    await this.st.delete(`cai:${cid}:${id}`);
  }

  // ---------- grupos: membros, papéis e regras ----------
  // ---------- (0.7.14) chats e chamadas de voz de dentro de um grupo ----------
  // as conversas filhas copiam as pessoas do grupo (e os papéis); o que é só de cada um nela (lido, silenciado) fica na conta
  async sincronizarCanais(pai) {
    for (const x of pai.canais || []) {
      const f = await this.get('cv:' + x.id); if (!f) continue;
      const antes = Object.keys(f.membros);
      f.membros = {}; for (const [id, m] of Object.entries(pai.membros)) f.membros[id] = { papel: m.papel, desde: m.desde, semChamada: !!m.semChamada };
      f.dono = pai.dono; f.nome = x.nome;
      await this.st.put('cv:' + f.id, f);
      const novos = Object.keys(f.membros).filter((id) => !antes.includes(id)), sairam = antes.filter((id) => !f.membros[id]);
      if (novos.length) await this.ligar(f, novos);
      for (const id of sairam) { await this.desligar(f.id, id); this.avisar([id], { tipo: 'conv-removido', cid: f.id }); if (f.cham && f.cham.quem && f.cham.quem[id]) for (const d of f.cham.quem[id]) await this.chamadaSair(f, id, d); }
    }
  }
  async apagarCanal(pai, id, semAviso) {
    const f = await this.get('cv:' + id);
    pai.canais = (pai.canais || []).filter((x) => x.id !== id);
    if (f) {
      for (let n = Math.max(1, (f.seq || 0) - MAX_MSGS); n <= (f.seq || 0); n++) await this.removerMensagem(f, n, true); // (as de antes disso já saíram)
      for (const mid of Object.keys(f.membros)) await this.desligar(f.id, mid);
      if (!semAviso) this.avisar(Object.keys(f.membros), { tipo: 'conv-removido', cid: f.id });
      await this.st.delete('cv:' + f.id);
    }
  }
  async canais(cv, conta, b) {
    if (cv.tipo !== 'grupo' || cv.pai) return erro('Só grupos têm chats e chamadas de voz a mais.');
    if (!this.pode(cv, conta, 'config')) return erro('Só o dono e os admins mudam os chats do grupo.', 403);
    const acao = txt(b.acao, 10), nome = txt(String(b.nome || '').replace(/[<>#\u0000-\u001f]/g, ''), 24);
    cv.canais = cv.canais || [];
    if (acao === 'criar') {
      const tipo = b.tipo === 'voz' ? 'voz' : 'texto';
      if (!nome) return erro('Dê um nome.');
      const lim = await this.limiteCanais(cv);
      if (tipo === 'texto' && cv.canais.filter((x) => x.tipo === 'texto').length >= lim.chats) return erro(`O grupo já tem ${lim.chats} chats a mais (o máximo).`);
      if (tipo === 'voz' && cv.canais.filter((x) => x.tipo === 'voz').length >= lim.voz - 1) return erro(`O grupo já tem ${lim.voz} chamadas de voz (o máximo).`);
      const f = { id: 'g' + aleatorioHex(10), tipo: 'grupo', pai: cv.id, canal: tipo, nome, dono: cv.dono, membros: {}, criado: Date.now(), seq: 0 };
      await this.st.put('cv:' + f.id, f);
      cv.canais.push({ id: f.id, nome, tipo });
      await this.st.put('cv:' + cv.id, cv);
      await this.sincronizarCanais(cv);
    } else if (acao === 'renomear') {
      const x = cv.canais.find((y) => y.id === b.id); if (!x) return erro('Não encontrado.', 404);
      if (!nome) return erro('Dê um nome.');
      x.nome = nome; await this.st.put('cv:' + cv.id, cv); await this.sincronizarCanais(cv);
    } else if (acao === 'apagar') {
      if (!cv.canais.some((y) => y.id === b.id)) return erro('Não encontrado.', 404);
      await this.apagarCanal(cv, b.id); await this.st.put('cv:' + cv.id, cv);
    } else return erro('Ação desconhecida.');
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, conta));
  }
  pode(cv, conta, acao, alvoId) {
    if (cv.tipo !== 'grupo') return false;
    const eu = cv.membros[conta.id].papel, alvo = alvoId ? (cv.membros[alvoId] || {}).papel : null;
    if (acao === 'adicionar') return true; // (0.6.0) como no Discord: quem está no grupo pode adicionar os próprios amigos
    if (acao === 'config') return eu === 'dono' || eu === 'admin';
    if (acao === 'papel') return eu === 'dono' && alvo && alvo !== 'dono';                       // só o dono promove/rebaixa admins
    if (acao === 'remover' || acao === 'chamada') return alvo && alvo !== 'dono' && (eu === 'dono' || (eu === 'admin' && alvo === 'membro')); // ninguém remove o dono
    return false;
  }
  // quantos chats e chamadas de voz o grupo pode ter: o maior Aero Bubble entre o dono e os admins
  async limiteCanais(cv) {
    let chats = MAX_CHATS_EXTRA, voz = MAX_VOZ;
    for (const [id, m] of Object.entries(cv.membros)) if (m.papel === 'dono' || m.papel === 'admin') { const c = await this.get('c:' + id); if (c) { const l = limitesDe(c); chats = Math.max(chats, l.chats || 0); voz = Math.max(voz, l.voz || 0); } }
    return { chats, voz };
  }
  // (0.7.14) quantas pessoas cabem no grupo: 10, ou o maior Aero Bubble entre o dono e os admins
  async limiteGrupo(cv) {
    let max = MAX_GRUPO;
    for (const [id, m] of Object.entries(cv.membros)) if (m.papel === 'dono' || m.papel === 'admin') { const c = await this.get('c:' + id); if (c) max = Math.max(max, limitesDe(c).grupo); }
    return max;
  }
  async adicionar(cv, conta, b) {
    if (!this.pode(cv, conta, 'adicionar')) return erro('Você não pode adicionar pessoas aqui.', 403);
    const novos = [];
    const max = await this.limiteGrupo(cv);
    if (Object.keys(cv.membros).length >= max) return erro(`O grupo já tem ${max} pessoas (o máximo). Para mais gente, crie uma sala!`);
    for (const cod of (Array.isArray(b.codigos) ? b.codigos : []).slice(0, MAX_GRUPO_TETO)) {
      if (Object.keys(cv.membros).length >= max) break;
      const o = await this.contaPorCodigo(cod);
      if (o && !cv.membros[o.id] && this.amigos(conta, o.id)) { cv.membros[o.id] = { papel: 'membro', desde: Date.now() }; if (cv.fora) delete cv.fora[o.id]; novos.push(o.id); }
    }
    if (!novos.length) return erro('Ninguém novo para adicionar (só amigos seus entram).');
    await this.st.put('cv:' + cv.id, cv); await this.ligar(cv, novos); await this.sincronizarCanais(cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, conta));
  }
  async mudarMembro(cv, conta, b) {
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || !cv.membros[o.id]) return erro('Essa pessoa não está no grupo.', 404);
    if (b.acao === 'remover') {
      if (!this.pode(cv, conta, 'remover', o.id)) return erro('Você não pode remover essa pessoa.', 403);
      delete cv.membros[o.id]; await this.desligar(cv.id, o.id);
      (cv.fora = cv.fora || {})[o.id] = Date.now(); // (0.9.1) removido não volta sozinho por um link de convite antigo
      this.avisar([o.id], { tipo: 'conv-removido', cid: cv.id });
    } else if (b.acao === 'admin' || b.acao === 'membro') {
      if (!this.pode(cv, conta, 'papel', o.id)) return erro('Só o dono escolhe os admins.', 403);
      cv.membros[o.id].papel = b.acao;
    } else if (b.acao === 'semChamada' || b.acao === 'comChamada') {
      if (!this.pode(cv, conta, 'chamada', o.id)) return erro('Você não pode mudar isso para essa pessoa.', 403);
      cv.membros[o.id].semChamada = b.acao === 'semChamada';
    } else return erro('Ação desconhecida.');
    await this.st.put('cv:' + cv.id, cv); await this.sincronizarCanais(cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, conta));
  }
  async configurar(cv, conta, b) {
    if (!this.pode(cv, conta, 'config')) return erro('Só o dono e os admins mudam o grupo.', 403);
    const nome = txt(String(b.nome || '').replace(/[<>\u0000-\u001f]/g, ''), 40);
    if (nome) cv.nome = nome;
    await this.st.put('cv:' + cv.id, cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta(await this.resumo(cv, conta));
  }
  async sair(cv, conta) {
    if (cv.tipo !== 'grupo') return erro('Conversas privadas não têm "sair".');
    const eraDono = cv.membros[conta.id].papel === 'dono';
    delete cv.membros[conta.id]; await this.desligar(cv.id, conta.id);
    const resto = Object.entries(cv.membros);
    if (!resto.length) { for (const x of cv.canais || []) await this.apagarCanal(cv, x.id, true); await this.st.delete('cv:' + cv.id); return resposta({ ok: true }); }
    if (eraDono) { // o grupo passa para o admin mais antigo (ou o membro mais antigo)
      const prox = resto.sort((x, y) => (x[1].papel === 'admin' ? 0 : 1) - (y[1].papel === 'admin' ? 0 : 1) || x[1].desde - y[1].desde)[0];
      prox[1].papel = 'dono'; cv.dono = prox[0];
    }
    await this.st.put('cv:' + cv.id, cv); await this.sincronizarCanais(cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true });
  }

  // ---------- convite para uma sala (modo sala): o amigo recebe "Fulano te chamou para a sala" e aceita ou recusa ----------
  async convidarSala(conta, b) {
    const sala = String(b.sala || '').toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(sala)) return erro('Sala inválida.');
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || !this.amigos(conta, o.id)) return erro('Só dá para convidar amigos.', 403);
    if (!this.hub.limitar('cvs:' + conta.id, 20, 60000)) return erro('Devagar! Muitos convites seguidos.', 429);
    const online = this.hub.ctx.getWebSockets('c:' + o.id).length > 0;
    this.avisar([o.id], { tipo: 'convite-sala', sala, de: await this.publico(conta.id) });
    return resposta({ ok: true, online });
  }
  async responderConvite(conta, b) {
    const sala = String(b.sala || '').toUpperCase();
    const o = await this.contaPorCodigo(b.codigo);
    if (!o || !/^[A-Z0-9]{4,12}$/.test(sala) || !this.amigos(conta, o.id)) return erro('Convite inválido.');
    const eu = await this.publico(conta.id);
    this.avisar([o.id], { tipo: 'convite-sala-resposta', sala, de: eu, aceitou: !!b.aceitou });
    this.avisar([conta.id], { tipo: 'convite-sala-fim', sala, de: o.codigo }); // os seus outros aparelhos param de mostrar o convite
    return resposta({ ok: true });
  }

  // ---------- chamadas (estilo Skype: direto entre os aparelhos, sem sala) ----------
  // Aqui só se toca o "telefone" (HTTP) e se repassa a negociação do WebRTC entre os aparelhos (WebSocket, "cham-sinal").
  // A voz e o vídeo vão direto de um aparelho para o outro (ou pelo TURN da Cloudflare, cifrados pelo próprio WebRTC).
  async chamada(cv, conta, b) {
    const acao = txt(b.acao, 10);
    const id = String(b.id || '');
    if (!/^[a-z0-9]{8,24}$/.test(id)) return erro('Chamada inválida.');
    if (cv.membros[conta.id].semChamada) return erro('Você não pode fazer chamadas neste grupo.', 403);
    const eu = await this.publico(conta.id);
    const alvos = Object.entries(cv.membros).filter(([mid, m]) => mid !== conta.id && !m.semChamada).map(([mid]) => mid);
    const dev = /^[A-Za-z0-9_-]{4,64}$/.test(String(b.dev || '')) ? String(b.dev) : 'http-' + conta.id.slice(0, 8);
    if (acao === 'tocar') {
      if (!this.hub.limitar('cham:' + conta.id, 6, 60000)) return erro('Devagar! Muitas chamadas seguidas.', 429);
      if (cv.tipo === 'dm' && !this.amigos(conta, alvos[0])) return erro('Só dá para ligar para amigos.', 403);
      // já tem uma chamada acontecendo nesta conversa: quem "liga" entra nela (não toca de novo)
      if (cv.cham && Date.now() - (cv.cham.inicio || 0) > 15000) await this.podarChamada(cv); // (1.0.0) antes, confere se quem "está" na chamada ainda está mesmo
      if (cv.cham && Object.keys(cv.cham.quem || {}).length) {
        await this.chamadaEntrar(cv, conta.id, dev, cv.cham.id);
        // (1.0.2) na conversa a dois, quem não está na chamada é chamado de novo (antes "ligar" só entrava, sem tocar o telefone dela)
        const fora = cv.tipo === 'dm' && cv.canal !== 'voz' ? alvos.filter((x) => !(cv.cham.quem || {})[x]) : [];
        if (fora.length) this.avisar(fora, { tipo: 'chamada', cid: cv.id, id: cv.cham.id, video: !!cv.cham.video, de: eu, grupo: '' });
        return resposta({ ok: true, entrou: cv.cham.id, convidados: [] });
      }
      await this.chamadaEntrar(cv, conta.id, dev, id, !!b.video);
      // (0.7.14) chamada de voz de dentro de um grupo: como uma sala de voz, quem quiser entra (não toca o telefone de ninguém)
      if (cv.canal !== 'voz') this.avisar(alvos, { tipo: 'chamada', cid: cv.id, id, video: !!b.video, de: eu, grupo: cv.tipo === 'grupo' ? cv.nome : '' });
    } else if (acao === 'entrar') {
      if (cv.tipo === 'dm' && !this.amigos(conta, alvos[0])) return erro('Só dá para ligar para amigos.', 403); // (0.9.6) amizade desfeita: não entra mais
      if (cv.cham && Date.now() - (cv.cham.inicio || 0) > 15000) { await this.podarChamada(cv); if (!cv.cham && !b.retomar) return erro('Essa chamada já acabou.', 409); } // só tinha quem já tinha caído
      // (1.0.2) tem chamada viva na conversa: entra NELA, mesmo que o app mande o número de uma anterior (a faixa ficou com o número velho).
      // Antes isso dava "Essa chamada já acabou" e o "Entrar na chamada" não funcionava, só o "Ligar"
      const viva = cv.cham && Object.keys(cv.cham.quem || {}).length ? cv.cham.id : null;
      if (!viva && !b.retomar) return erro('Essa chamada já acabou.', 409);
      await this.chamadaEntrar(cv, conta.id, dev, viva || id, false, !!b.retomar);
      return resposta({ ok: true, entrou: cv.cham ? cv.cham.id : id, convidados: [] });
    } else if (acao === 'sair') await this.chamadaSair(cv, conta.id, dev);
    else if (acao === 'cancelar') { this.avisar(alvos, { tipo: 'chamada-fim', cid: cv.id, id }); await this.chamadaSair(cv, conta.id, dev); }
    else if (acao === 'recusar') this.avisar(Object.keys(cv.membros), { tipo: 'chamada-recusada', cid: cv.id, id, de: eu }); // inclui os seus outros aparelhos (param de tocar)
    else return erro('Ação desconhecida.');
    return resposta({ ok: true, convidados: (await Promise.all(alvos.map((x) => this.publico(x)))).filter(Boolean).map((p) => p.codigo) });
  }
  // ---------- foto do grupo (0.5.9-5): dono ou admin; imagem ou GIF de até 20 MB, guardada como a foto de perfil ----------
  async fotoGrupo(cv, conta, request) {
    if (cv.tipo !== 'grupo') return erro('Só grupos têm foto.');
    const papel = cv.membros[conta.id].papel;
    if (papel !== 'dono' && papel !== 'admin') return erro('Só o dono ou um admin muda a foto do grupo.', 403);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(gif|jpeg|png|webp)$/.test(mime)) return erro('Imagem inválida.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 20 * 1048576) return erro('Imagem grande demais (máximo 20 MB).', 413);
    await this.hub.guardarImagem('gf:', cv.id, bytes, mime);
    cv.fotoV = (cv.fotoV || 0) + 1; await this.st.put('cv:' + cv.id, cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true, fotoV: cv.fotoV });
  }

  // ---------- banner do grupo (0.8.7): dono ou admin; imagem ou GIF de até 20 MB; corpo vazio tira o banner ----------
  async bannerGrupo(cv, conta, request) {
    if (cv.tipo !== 'grupo') return erro('Só grupos têm banner.');
    const papel = cv.membros[conta.id].papel;
    if (papel !== 'dono' && papel !== 'admin') return erro('Só o dono ou um admin muda o banner do grupo.', 403);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) { delete cv.bannerV; await this.hub.apagarImagem('gb:', cv.id); }
    else {
      const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!/^image\/(gif|jpeg|png|webp)$/.test(mime)) return erro('Imagem inválida.');
      if (bytes.length > 20 * 1048576) return erro('Imagem grande demais (máximo 20 MB).', 413);
      await this.hub.guardarImagem('gb:', cv.id, bytes, mime);
      cv.bannerV = (cv.bannerV || 0) + 1;
    }
    await this.st.put('cv:' + cv.id, cv);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-mudou', cid: cv.id });
    return resposta({ ok: true, bannerV: cv.bannerV || 0 });
  }

  // ---------- chamada EM ANDAMENTO (0.5.9-4, como no Discord) ----------
  // A conversa guarda a chamada viva: quem está nela (por aparelho) e desde quando. Quem não está vê "Chamada em andamento — Entrar".
  // Ela só acaba quando o último sai (um desligar não derruba os outros). No chat ficam mensagens do sistema: "iniciou uma chamada" e,
  // no fim, quanto tempo durou (ou "chamada perdida" se ninguém atendeu). Essas mensagens não têm conteúdo privado (sem cifra).
  // (0.5.9-7) aparelho que não está mais conectado não conta como "na chamada". Se o aviso de que ele caiu se perdeu (app fechado à força,
  // servidor reiniciado durante uma atualização), a conversa mostrava "Chamada em andamento" para sempre. Aqui a chamada é conferida
  // com quem está ligado AGORA; sem ninguém, ela acaba (e o chat registra quanto durou).
  async podarChamada(cv) {
    const c = cv.cham; if (!c || !c.quem) return;
    // (1.0.0) conexão que parou de responder ao "ping" (o app manda um a cada 15 s) não conta: o celular que descarregou some sem fechar
    // a conexão, e ela ficava "aberta" no servidor por muito tempo. A chamada mostrava a pessoa lá dentro e ligar de novo caía nela
    const respondendo = (w) => { try { const t = this.hub.ctx.getWebSocketAutoResponseTimestamp(w); return !t || Date.now() - t.getTime() < 90000; } catch (_) { return true; } };
    const vivos = (contaId) => new Set(this.hub.ctx.getWebSockets('c:' + contaId).filter(respondendo).map((w) => { try { return (w.deserializeAttachment() || {}).dev; } catch (_) { return null; } }).filter(Boolean));
    let mudou = false;
    for (const [contaId, devs] of Object.entries(c.quem)) {
      // (0.7.0) quem caiu sem avisar (a internet piscou, o servidor reiniciou) tem 25 s para voltar antes de sair da chamada
      const v = vivos(contaId), ficam = devs.filter((d) => v.has(d) || (c.caiu && c.caiu[d] && Date.now() - c.caiu[d] < 25000));
      if (ficam.length !== devs.length) { mudou = true; for (const d of devs) if (!v.has(d)) await this.st.delete('chdev:' + d); if (ficam.length) c.quem[contaId] = ficam; else delete c.quem[contaId]; }
    }
    if (!mudou) return;
    if (!Object.keys(c.quem).length) { const atendida = Object.keys(c.contas || {}).length >= 2; delete cv.cham; await this.msgSistema(cv, c.por, atendida ? { tipo: 'chamada-fim', dur: Date.now() - c.inicio } : { tipo: 'chamada-perdida' }); }
    else await this.st.put('cv:' + cv.id, cv);
    // (0.9.0) todos da conversa ficam sabendo (antes só quem pedisse a lista de novo via que a chamada tinha acabado)
    this.avisar(Object.keys(cv.membros), { tipo: 'chamada-estado', cid: cv.id, cham: cv.cham && Object.keys(cv.cham.quem || {}).length ? await this.chamadaPublica(cv) : null });
  }
  async chamadaPublica(cv) {
    if (cv.cham && Date.now() - (cv.cham.inicio || 0) > 15000) await this.podarChamada(cv); // (logo no começo o aparelho pode ainda estar conectando)
    const c = cv.cham; if (!c || !c.quem || !Object.keys(c.quem).length) return null;
    const quem = [], devs = []; for (const [id, ds] of Object.entries(c.quem)) { const p = await this.publico(id); if (p) quem.push(p.codigo); devs.push(...ds); }
    return { id: c.id, inicio: c.inicio, video: !!c.video, quem, devs };
  }
  async msgSistema(cv, de, sis) {
    await this.ligar(cv, Object.keys(cv.membros)); // (0.6.0) ligação numa DM ainda sem mensagens: a conversa entra na lista de todos
    cv.seq = (cv.seq || 0) + 1; cv.ult = Date.now();
    const msg = { id: cv.seq, seq: cv.seq, de, t: cv.ult, sis };
    await this.st.put({ ['cv:' + cv.id]: cv, [`cm:${cv.id}:${pad(cv.seq)}`]: msg });
    if (cv.seq > MAX_MSGS) await this.removerMensagem(cv, cv.seq - MAX_MSGS, true);
    const eu = await this.publico(de);
    this.avisar(Object.keys(cv.membros), { tipo: 'conv-msg', cid: cv.id, msg: { ...msg, de: eu ? eu.codigo : '?' }, nome: cv.nome || '', deNome: eu ? eu.nome : '' });
  }
  async avisarChamada(cv) { this.avisar(Object.keys(cv.membros), { tipo: 'chamada-estado', cid: cv.id, cham: await this.chamadaPublica(cv) }); }
  // entra/sai um aparelho da chamada viva da conversa (dev = aparelho; a conta conta uma vez só)
  // retomada (0.7.0): a pessoa já estava na chamada e só reconectou (a chamada tinha sumido do servidor): volta sem o aviso "X iniciou uma chamada"
  async chamadaEntrar(cv, contaId, dev, id, video, retomada = false) {
    const agora = Date.now();
    if (!cv.cham || !Object.keys(cv.cham.quem || {}).length) { cv.cham = { id, inicio: agora, video: !!video, por: contaId, quem: {}, contas: {} }; if (!retomada) await this.msgSistema(cv, contaId, { tipo: 'chamada', video: !!video }); }
    const c = cv.cham;
    for (const d of c.quem[contaId] || []) if (d !== dev) { // entrou por outro aparelho: o aparelho antigo é avisado (e sai da chamada sozinho)
      await this.st.delete('chdev:' + d);
      for (const ws of this.hub.ctx.getWebSockets('c:' + contaId)) { try { if ((ws.deserializeAttachment() || {}).dev === d) ws.send(JSON.stringify({ tipo: 'chamada-trocou', cid: cv.id, id: c.id })); } catch (_) { /* ok */ } }
    }
    c.quem[contaId] = [dev]; // (0.6.0) a mesma pessoa nunca aparece duas vezes: a chamada é do aparelho, e entrar por outro troca de aparelho
    if (c.caiu && c.caiu[dev]) delete c.caiu[dev]; // (0.7.4) voltou: não conta mais como caído (a poda não o tira depois)
    c.contas[contaId] = 1;
    await this.st.put({ ['cv:' + cv.id]: cv, ['chdev:' + dev]: cv.id });
    await this.avisarChamada(cv);
  }
  async chamadaSair(cv, contaId, dev) {
    const c = cv.cham; if (!c || !c.quem[contaId]) return;
    c.quem[contaId] = c.quem[contaId].filter((d) => d !== dev);
    if (!c.quem[contaId].length) delete c.quem[contaId];
    await this.st.delete('chdev:' + dev);
    if (!Object.keys(c.quem).length) { // o último saiu: a chamada acaba e o chat registra quanto durou
      const atendida = Object.keys(c.contas || {}).length >= 2;
      delete cv.cham;
      await this.msgSistema(cv, c.por, atendida ? { tipo: 'chamada-fim', dur: Date.now() - c.inicio } : { tipo: 'chamada-perdida' });
    } else await this.st.put('cv:' + cv.id, cv);
    await this.avisarChamada(cv);
  }
  // o aparelho caiu (fechou o app, perdeu a internet): sai da chamada em que estava
  // (0.7.0) não sai na hora: guarda quando caiu. Se voltar (reconectou) em 25 s, a chamada continua sem ninguém perceber; senão, a poda tira.
  // Antes cada piscada da internet (ou o servidor reiniciando) derrubava a chamada e, ao voltar, aparecia "X iniciou uma chamada" de novo
  async aparelhoSaiu(contaId, dev) {
    const cid = await this.get('chdev:' + dev); if (!cid) return;
    const cv = await this.get('cv:' + cid); if (!cv) { await this.st.delete('chdev:' + dev); return; }
    const c = cv.cham; if (!c || !c.quem || !(c.quem[contaId] || []).includes(dev)) return;
    c.caiu = c.caiu || {}; c.caiu[dev] = Date.now(); await this.st.put('cv:' + cv.id, cv);
  }

  // "Fulano está digitando…": só para quem está na conversa (menos a própria conta), no máximo 1 aviso a cada 2 s
  async digitando(a, m) {
    if (!/^[dg][0-9a-f]{20}$/.test(String(m.cid || ''))) return;
    if (!this.hub.limitar('dig:' + a.dev, 1, 2000)) return;
    const cv = await this.get('cv:' + m.cid);
    if (!cv || !cv.membros[a.conta]) return;
    const dg = sortearDg(((await this.get('c:' + a.conta)) || {}).extra?.dg, m.s, a.conta); // (0.8.3) o indicador personalizado de quem digita
    this.avisar(Object.keys(cv.membros).filter((id) => id !== a.conta), { tipo: 'digitando', cid: cv.id, de: a.codigo, nome: a.nome, dg });
  }

  // repassa a negociação (oferta, resposta, ICE, entrar/sair, microfone/câmera) só para quem está na conversa
  async sinal(a, m, tam) {
    if (!/^[dg][0-9a-f]{20}$/.test(String(m.cid || '')) || !/^[a-z0-9]{8,24}$/.test(String(m.id || ''))) return;
    if (!m.dados || typeof m.dados !== 'object' || tam > 16000) return;
    if (!this.hub.limitar('sinal:' + a.dev, 600, 60000)) return;
    const cv = await this.get('cv:' + m.cid);
    if (!cv || !cv.membros[a.conta] || cv.membros[a.conta].semChamada) return;
    // (0.9.6) sinal só quando há uma chamada nesta conversa, e nunca para quem bloqueou (ou foi bloqueado por) quem manda.
    // Na conversa a dois, só entre amigos (como o "tocar"): pedido de mensagem pendente ou amizade desfeita não chega a tocar
    if (!cv.cham) return;
    const eu = await this.get('c:' + a.conta); if (!eu) return;
    let alvos;
    if (m.para === '*') alvos = Object.keys(cv.membros);
    else { const o = await this.contaPorCodigo(m.para); if (!o || !cv.membros[o.id]) return; alvos = [o.id]; }
    const permitidos = [];
    for (const id of new Set(alvos)) {
      if (id === a.conta) { permitidos.push(id); continue; }
      const o = await this.get('c:' + id); if (!o || bloqueio(eu, o)) continue;
      if (cv.tipo === 'dm' && !this.amigos(eu, id)) continue;
      permitidos.push(id);
    }
    alvos = permitidos;
    const paraDev = typeof m.paraDev === 'string' ? m.paraDev : '';
    const msg = JSON.stringify({ tipo: 'cham-sinal', cid: cv.id, id: m.id, de: a.codigo, deDev: a.dev, nome: a.nome, av: a.av, dados: m.dados });
    for (const cid of new Set(alvos)) {
      for (const ws of this.hub.ctx.getWebSockets('c:' + cid)) {
        const x = ws.deserializeAttachment();
        if (!x || x.dev === a.dev || (paraDev && x.dev !== paraDev)) continue;
        try { ws.send(msg); } catch (_) { /* fechou */ }
      }
    }
  }
}
