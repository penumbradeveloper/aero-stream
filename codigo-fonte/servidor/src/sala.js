// Sala: um grupo de participantes. O vídeo NÃO passa por aqui (vai direto entre os aparelhos, WebRTC);
// a sala só faz: lista de participantes, aprovação de entrada, repasse das mensagens de conexão, chat,
// estado de compartilhamento e contagem de tempo (estatísticas dos amigos).
//
// A sala PERSISTE: se o host cair, ela continua existindo. Quem criou volta com o "código de retorno".
//
// Mensagens do cliente -> sala:
//   sinal {para, dados}  | chat {texto} | comp {ativo, modo} | mic {ativo} | cursor {cor}
//   input {acao: 'pedir', dono} | input {acao: 'pausar'|'retomar'|'sair'|'real', ativo}
//   host ou quem transmite em modo jogo: input {acao: 'aprovar'|'negar'|'revogar', id} | perm {id, perm, livre}
//   host: aprovar {id} | recusar {id} | moderar {id, acao: 'remover'|'banir'}
// Mensagens da sala -> cliente:
//   erro {codigo, msg} | aguardando | aprovado | recusado | removido | sala {...snapshot}
//   pedido {...} (para o host) | sinal {de, dados} | chat {de, texto, t}
import { enviar, txt } from './util.js';

const MAX_PESSOAS = 40, MAX_ESPERANDO = 15, MAX_ENTRADAS_MIN = 30; // (0.8.7)
const PERM_PADRAO = { gamepad: true, mouse: true, teclado: true };
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_CHAT = 2000;
const MAX_HIST = 200;            // mensagens guardadas (quem entra depois vê o histórico; tudo some quando a sala é apagada)
const MAX_IMG = 1900 * 1024;     // imagem, áudio ou vídeo curto do chat (o app comprime as imagens antes de mandar; cabe num valor do armazenamento)
const MAX_IMGS = 120;            // imagens por sala (as mais antigas saem)
const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'video/mp4', 'video/webm']; // (0.8.0) mensagem de voz e vídeo curto também
const idCurto = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
const limparTexto = (t) => txt(String(t || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' '), MAX_CHAT).trim();
const SEIS_HORAS = 6 * 3600 * 1000;
const GRACA_VAZIA = 60 * 1000;      // sala vazia por 1 minuto é APAGADA (o código fica livre para outra sala)
const LIMITE_VAZIA = 10 * 60 * 1000; // trava de segurança: nenhuma sala fica aberta mais de 10 min sem ninguém, mesmo com algum bug
// Queda de rede (não "sair"): o lugar da pessoa fica guardado por este tempo. Se ela reconectar com o segredo de retomada, volta com o
// MESMO id, e as conexões de vídeo (que vão direto entre os aparelhos e muitas vezes nem caíram) continuam sem piscar.
const GRACA_RETORNO = 30 * 1000;
const novoSegredo = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// ctl = { dono, st: 'pedindo' | 'ativo' | 'pausado', real: bool }: quem controla a tela de quem. "real" = o mouse e o teclado
// de verdade do computador de quem transmite (só uma pessoa por vez); os demais viram cursores emulados que só indicam.
const publico = (a) => ({
  id: a.id, nome: a.nome, tag: a.tag || '', codigo: a.codigo || '', av: a.av || 0, host: a.papel === 'host',
  comp: !!a.comp, modo: a.modo || '', mic: !!a.mic, perm: a.perm || PERM_PADRAO, livre: !!a.livre, cor: a.cor || '',
  ctl: a.ctl || null, conta: !!a.uid, pd: a.porDono || {},
});
// (0.8.7) a permissão que vale na tela de "dono": a regra geral do host e, se o dono não for o host, também a regra dele (as duas precisam deixar)
const regraDe = (a, dono) => {
  const geral = a.perm || PERM_PADRAO, r = dono && dono.a.papel !== 'host' ? ((a.porDono || {})[dono.a.id] || null) : null;
  const out = {}; for (const k of Object.keys(PERM_PADRAO)) out[k] = geral[k] !== false && (!r || r.perm[k] !== false); return out;
};
const limparAtt = (a) => { const { substituido, saindo, ...resto } = a; return resto; };

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.agora = () => Date.now(); // trocável nos testes
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ---------- estado (guardado nos próprios WebSockets, sobrevive à hibernação) ----------
  todos() { return this.ctx.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() })).filter((x) => x.a); }
  admitidos() { return this.todos().filter((x) => x.a.admitido); }
  doHost() { return this.todos().filter((x) => x.a.papel === 'host'); }
  porId(id) { return this.todos().find((x) => x.a.id === id); }
  cfg() { return this.ctx.storage.get('cfg'); }

  // ---------- quem caiu há pouco (lugar guardado) ----------
  async carregarAus() { if (!this.aus) this.aus = (await this.ctx.storage.get('aus')) || {}; return this.aus; }
  async gravarAus() { await this.ctx.storage.put('aus', this.aus || {}); }
  // tira os que não voltaram a tempo; devolve quantos saíram de vez
  async purgarAus() {
    await this.carregarAus();
    const agora = this.agora(); let n = 0;
    for (const [id, r] of Object.entries(this.aus)) if (r.ate <= agora) { delete this.aus[id]; this.soltarControles(id); n++; }
    if (n) { await this.gravarAus(); this.difundir(); }
    return n;
  }

  // LÍDER (0.5.9-5): quem aprova os pedidos de entrada. É o host (quem criou a sala); se ele sair, passa para quem entrou logo depois
  // dele (o mais antigo dos que ficaram). Quando o host volta, ele é o líder de novo.
  lider() {
    const adm = this.admitidos();
    const host = adm.find((p) => p.a.papel === 'host');
    if (host) return host;
    return adm.filter((p) => p.a.papel !== 'host').sort((p, q) => (p.a.entrou || 0) - (q.a.entrou || 0))[0] || null;
  }
  snapshot(x) {
    const adm = this.admitidos();
    const host = adm.find((p) => p.a.papel === 'host');
    const lider = this.lider();
    // (0.6.0) uma pessoa aparece UMA vez: o lugar guardado de quem caiu some se a mesma conta (ou o mesmo id) já está de volta
    const aus = Object.values(this.aus || {}).filter((r) => !adm.some((p) => p.a.id === r.a.id || (r.a.uid && p.a.uid === r.a.uid))).map((r) => ({ ...publico(r.a), ausente: true }));
    const snap = {
      tipo: 'sala', voce: x.a.id, hostOnline: !!host, host: host ? host.a.id : null, lider: lider ? lider.a.id : null, participantes: [...adm.map((p) => publico(p.a)), ...aus],
    };
    if (x.a.papel === 'host' || (lider && lider.a.id === x.a.id)) {
      snap.pendentes = this.todos().filter((p) => !p.a.admitido).map((p) => ({
        id: p.a.id, nome: p.a.nome, tag: p.a.tag || '', codigo: p.a.codigo || '', av: p.a.av || 0, amigo: p.a.amigo || '',
      }));
    }
    return snap;
  }

  difundir() {
    for (const x of this.admitidos()) enviar(x.ws, this.snapshot(x));
    for (const x of this.doHost()) if (!x.a.admitido) enviar(x.ws, this.snapshot(x));
  }

  recusar(msg, codigo, tipoErro) {
    const [cliente, servidor] = Object.values(new WebSocketPair());
    servidor.accept();
    enviar(servidor, { tipo: 'erro', codigo: tipoErro, msg });
    servidor.close(codigo, 'recusado');
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // ---------- entrada ----------
  async fetch(request) {
    if (typeof request === 'string') request = new Request(request);
    if (request.headers.get('Upgrade') !== 'websocket') {
      const u0 = new URL(request.url);
      if (u0.pathname === '/img' || u0.pathname.startsWith('/img/')) return this.imagem(request, u0);
      if (u0.pathname === '/estado') { // existe? (nada de quem está dentro: só se está aberta)
        const cfg = await this.cfg(); await this.carregarAus();
        return new Response(JSON.stringify({ existe: !!cfg, pessoas: this.admitidos().length + Object.keys(this.aus || {}).length }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Use WebSocket', { status: 426 });
    }
    const url = new URL(request.url);
    const q = (k, n) => txt(url.searchParams.get(k) || '', n);
    const papel = q('papel', 10);
    const uid = q('uid', 64); // preenchido só pelo Worker, depois de verificar a conta
    const ident = {
      nome: q('nome', 24) || 'Visitante', tag: q('tag', 20), codigo: q('amigo', 8), av: Number(q('av', 8)) || 0, uid,
      mudo: !!uid && q('mudo', 2) === '1', // silenciado pela moderação (só o Worker preenche)
    };
    let cfg = await this.cfg();
    await this.carregarAus();
    // Retomada: quem caiu volta com o mesmo id (e o mesmo estado: transmitindo, microfone, controle...) se tiver o segredo certo.
    // Também cobre a conexão "meio aberta" (a antiga ainda não percebeu que morreu): ela é substituída na hora.
    let antigo = null;
    const retId = q('retomar', 12), retSeg = q('seg', 64);
    if (retId && retSeg) {
      const vivo = this.porId(retId);
      if (vivo && vivo.a.seg === retSeg) {
        antigo = vivo.a;
        vivo.ws.serializeAttachment({ ...vivo.a, substituido: true });
        try { vivo.ws.close(4001, 'retomado'); } catch (_) {}
      } else {
        const r = this.aus[retId];
        if (r && r.a.seg === retSeg && r.ate > this.agora()) antigo = r.a;
      }
      if (antigo && antigo.papel !== (papel === 'host' ? 'host' : 'membro')) antigo = null;
      if (antigo) { delete this.aus[retId]; await this.gravarAus(); }
    }
    // a mesma pessoa voltou sem o segredo (app reaberto): o lugar guardado dela não fica como fantasma
    const fantasma = (r) => (papel === 'host' ? r.a.papel === 'host' : !!uid && r.a.uid === uid);
    if (!antigo && Object.values(this.aus).some(fantasma)) {
      for (const [k, r] of Object.entries(this.aus)) if (fantasma(r)) { delete this.aus[k]; this.soltarControles(k); }
      await this.gravarAus();
    }
    const id = antigo ? antigo.id : crypto.randomUUID().slice(0, 8);
    const seg = novoSegredo();

    if (papel === 'host') {
      const chave = q('chave', 20).toUpperCase().replace(/\s/g, '');
      if (chave.length < 8) return this.recusar('Código de retorno inválido.', 4010, 'chave');
      if (!cfg) {
        // (0.9.6) as salas acabaram: compartilhar a tela é só nas chamadas do Aero Talk. Sala nova não é mais criada
        if (!this.env || !this.env.SALAS_NOVAS) return this.recusar('As salas acabaram: compartilhe a tela numa chamada do Aero Talk.', 4010, 'fim');
        cfg = { criada: this.agora(), hostKey: chave, admitidos: [], banidos: [] };
        await this.ctx.storage.put('cfg', cfg);
      } else if (cfg.hostKey !== chave) {
        return this.recusar('Essa sala já existe e o código de retorno não confere.', 4010, 'chave');
      }
      await this.contabilizar();
      for (const h of this.doHost()) { // o host voltou (ou reabriu o app): o acesso antigo é substituído
        h.ws.serializeAttachment({ ...h.a, substituido: true });
        try { h.ws.close(4000, 'substituido'); } catch (_) {}
      }
      const [cliente, servidor] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(servidor, ['p:' + id]);
      servidor.serializeAttachment(antigo ? { ...limparAtt(antigo), seg } : { id, papel: 'host', admitido: true, ...ident, perm: { ...PERM_PADRAO }, entrou: this.agora(), seg });
      enviar(servidor, { tipo: 'retomada', id, seg });
      await this.enviarHistorico(servidor);
      this.difundir();
      await this.agendar();
      return new Response(null, { status: 101, webSocket: cliente });
    }

    if (papel === 'membro') {
      if (!cfg) return this.recusar('Essa sala não existe.', 4004, 'inexistente');
      if (uid && cfg.banidos.includes(uid)) return this.recusar('Você foi removido desta sala.', 4003, 'banido');
      // (0.8.7) segurança: limite de pessoas por sala, de gente esperando aprovação e de entradas por minuto (contra spam de conexões)
      if (!antigo) {
        const agora = this.agora(), vivos = this.todos().filter((x) => !x.a.substituido);
        this.entradas = (this.entradas || []).filter((t) => agora - t < 60000);
        if (vivos.length >= MAX_PESSOAS) return this.recusar('A sala está cheia.', 4005, 'cheia');
        if (vivos.filter((x) => !x.a.admitido).length >= MAX_ESPERANDO) return this.recusar('Muita gente esperando para entrar. Tente daqui a pouco.', 4005, 'cheia');
        if (this.entradas.length >= MAX_ENTRADAS_MIN) return this.recusar('Muitas entradas seguidas. Tente daqui a pouco.', 4005, 'cheia');
        this.entradas.push(agora);
      }
      // UM aparelho por conta: a mesma conta entrou por outro aparelho (ex.: estava no celular e abriu no PC). O aparelho novo fica com
      // o lugar (já aprovado, com as mesmas regras) e o antigo sai com um aviso, sem tentar voltar.
      if (uid) for (const x of this.todos()) {
        if (x.a.papel !== 'membro' || x.a.uid !== uid || x.a.substituido || (antigo && x.a.id === antigo.id)) continue;
        enviar(x.ws, { tipo: 'erro', codigo: 'outro-aparelho', msg: 'Você entrou nesta sala por outro aparelho.' });
        x.ws.serializeAttachment({ ...x.a, substituido: true });
        this.soltarControles(x.a.id);
        try { x.ws.close(4002, 'outro-aparelho'); } catch (_) {}
      }
      // (0.6.0) voltou com uma conexão nova (não a "retomada"): o lugar guardado da queda anterior desta conta sai da lista
      if (uid) { await this.carregarAus(); let mudouAus = false; for (const [k, r] of Object.entries(this.aus || {})) if (r.a.uid === uid && !(antigo && r.a.id === antigo.id)) { delete this.aus[k]; this.soltarControles(r.a.id); mudouAus = true; } if (mudouAus) await this.gravarAus(); }
      const jaAdmitido = (!!uid && cfg.admitidos.includes(uid)) || !!(antigo && antigo.admitido);
      await this.contabilizar();
      const [cliente, servidor] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(servidor, ['p:' + id]);
      const regra = (uid && cfg.regras && cfg.regras[uid]) || {};
      servidor.serializeAttachment(antigo ? { ...limparAtt(antigo), admitido: jaAdmitido, seg } : { id, papel: 'membro', admitido: jaAdmitido, ...ident, amigo: ident.codigo, perm: { ...PERM_PADRAO, ...(regra.perm || {}) }, livre: !!regra.livre, entrou: this.agora(), seg });
      enviar(servidor, { tipo: 'retomada', id, seg });
      if (jaAdmitido) {
        enviar(servidor, { tipo: 'aprovado', voce: id });
        await this.enviarHistorico(servidor);
      } else {
        enviar(servidor, { tipo: 'aguardando', id });
        const lid = this.doHost()[0] || this.lider(); // o pedido vai para o líder (o host; sem ele, quem entrou logo depois)
        if (lid) enviar(lid.ws, { tipo: 'pedido', id, nome: ident.nome, tag: ident.tag, codigo: ident.codigo, av: ident.av, amigo: ident.codigo });
      }
      this.difundir();
      await this.agendar();
      return new Response(null, { status: 101, webSocket: cliente });
    }

    return new Response('papel inválido', { status: 400 });
  }

  // ---------- mensagens ----------
  async webSocketMessage(ws, mensagem) {
    if (typeof mensagem !== 'string' || mensagem.length > 65536) return;
    let m;
    try { m = JSON.parse(mensagem); } catch (_) { return; }
    const a = ws.deserializeAttachment();
    if (!a) return;
    const ehHost = a.papel === 'host';

    // --- só o host decide quem entra e modera ---
    const ehLider = ehHost || (() => { const l = this.lider(); return !!l && l.a.id === a.id; })();
    if (ehLider && (m.tipo === 'aprovar' || m.tipo === 'recusar')) {
      const alvo = this.porId(m.id);
      if (!alvo || alvo.a.admitido) return;
      if (m.tipo === 'recusar') {
        enviar(alvo.ws, { tipo: 'recusado' });
        try { alvo.ws.close(4003, 'recusado'); } catch (_) {}
        this.difundir();
        return;
      }
      await this.contabilizar();
      alvo.ws.serializeAttachment({ ...alvo.a, admitido: true });
      if (alvo.a.uid) {
        const cfg = await this.cfg();
        if (!cfg.admitidos.includes(alvo.a.uid)) { cfg.admitidos.push(alvo.a.uid); await this.ctx.storage.put('cfg', cfg); }
      }
      enviar(alvo.ws, { tipo: 'aprovado', voce: alvo.a.id });
      await this.enviarHistorico(alvo.ws);
      this.difundir();
      await this.agendar();
      return;
    }
    if (ehHost && m.tipo === 'moderar') {
      const alvo = this.porId(m.id);
      if (!alvo || alvo.a.papel === 'host') return;
      if (m.acao === 'banir' && alvo.a.uid) {
        const cfg = await this.cfg();
        cfg.banidos.push(alvo.a.uid);
        cfg.admitidos = cfg.admitidos.filter((u) => u !== alvo.a.uid);
        await this.ctx.storage.put('cfg', cfg);
      } else if (m.acao === 'remover' && alvo.a.uid) {
        const cfg = await this.cfg(); // removido não volta sozinho: precisa de nova aprovação
        cfg.admitidos = cfg.admitidos.filter((u) => u !== alvo.a.uid);
        await this.ctx.storage.put('cfg', cfg);
      }
      enviar(alvo.ws, { tipo: 'removido' });
      try { alvo.ws.close(4003, 'removido'); } catch (_) {}
      return;
    }
    // regras de controle remoto por pessoa: quem transmite em modo jogo (ou o host) decide quem entra sem pedir e o que pode usar
    // (0.8.7) segurança: ninguém mexe nas próprias regras, e quem transmite (sem ser o host) só decide sobre a PRÓPRIA tela: as regras
    // dele ficam guardadas só para ele (porDono) e nunca valem para a tela de outra pessoa. As regras gerais continuam só do host.
    if (!ehHost && a.admitido && a.comp && a.modo === 'jogo' && m.tipo === 'perm') {
      const alvo = this.porId(m.id);
      if (!alvo || !alvo.a.admitido || alvo.a.id === a.id || alvo.a.papel === 'host') return;
      const pd = { ...(alvo.a.porDono || {}) }, atual = pd[a.id] || { perm: { ...PERM_PADRAO }, livre: false };
      const p = { ...atual.perm };
      for (const k of Object.keys(PERM_PADRAO)) if (typeof (m.perm || {})[k] === 'boolean') p[k] = m.perm[k];
      const livre = typeof m.livre === 'boolean' ? m.livre : !!atual.livre;
      pd[a.id] = { perm: p, livre };
      let novo = { ...alvo.a, porDono: pd };
      const ctl = novo.ctl && novo.ctl.dono === a.id ? novo.ctl : null;
      if (ctl && ctl.real && !p.mouse && !p.teclado) novo.ctl = { ...ctl, real: false };
      if (ctl && ctl.st === 'ativo' && !p.gamepad && !p.mouse && !p.teclado) novo.ctl = null;
      alvo.ws.serializeAttachment(novo);
      this.difundir();
      return;
    }
    if (ehHost && m.tipo === 'perm') {
      const alvo = this.porId(m.id);
      if (!alvo || !alvo.a.admitido || alvo.a.id === a.id) return;
      const p = { ...(alvo.a.perm || PERM_PADRAO) };
      for (const k of Object.keys(PERM_PADRAO)) if (typeof (m.perm || {})[k] === 'boolean') p[k] = m.perm[k];
      const livre = typeof m.livre === 'boolean' ? m.livre : !!alvo.a.livre;
      let novo = { ...alvo.a, perm: p, livre };
      if (novo.ctl && novo.ctl.real && !p.mouse && !p.teclado) novo.ctl = { ...novo.ctl, real: false };
      if (novo.ctl && novo.ctl.st === 'ativo' && !p.gamepad && !p.mouse && !p.teclado) novo.ctl = null; // perdeu todas as permissões
      alvo.ws.serializeAttachment(novo);
      if (alvo.a.uid) { // lembra por conta: na próxima vez que ele entrar, as regras já valem
        const cfg = await this.cfg();
        cfg.regras = cfg.regras || {};
        cfg.regras[alvo.a.uid] = { perm: p, livre };
        const chaves = Object.keys(cfg.regras);
        if (chaves.length > 200) delete cfg.regras[chaves[0]];
        await this.ctx.storage.put('cfg', cfg);
      }
      this.difundir();
      return;
    }

    if (m.tipo === 'sair') { ws.serializeAttachment({ ...a, saindo: true }); return; } // saída de propósito: o lugar não fica guardado

    if (!a.admitido) return; // quem ainda não foi aceito não faz mais nada

    if (m.tipo === 'sinal') {
      const alvo = this.porId(m.para);
      if (alvo && alvo.a.admitido) enviar(alvo.ws, { tipo: 'sinal', de: a.id, dados: m.dados });
    } else if (m.tipo === 'digitando') { // "Fulano está digitando…" (no máximo 1 aviso a cada 2 s por pessoa)
      const agora = this.agora();
      if (agora - (a.digT || 0) < 2000) return;
      ws.serializeAttachment({ ...a, digT: agora });
      for (const x of this.admitidos()) if (x.a.id !== a.id) enviar(x.ws, { tipo: 'digitando', de: a.id, nome: a.nome });
    } else if (m.tipo === 'chat') {
      if (a.mudo) { enviar(ws, { tipo: 'erro', codigo: 'chat', msg: 'Você está impedido de mandar mensagens pela moderação do Aero.' }); return; }
      const texto = limparTexto(m.texto);
      const arq = typeof m.img === 'string' && /^[0-9a-f]{16}$/.test(m.img) ? await this.ctx.storage.get('img:' + m.img) : null, img = arq ? m.img : '';
      if (!texto && !img) return;
      const agora = this.agora();
      const recentes = (a.chatT || []).filter((t) => agora - t < 5000);
      if (recentes.length >= 6) { enviar(ws, { tipo: 'erro', codigo: 'chat', msg: 'Devagar! Muitas mensagens seguidas.' }); return; }
      ws.serializeAttachment({ ...a, chatT: [...recentes, agora] });
      const hist = (await this.ctx.storage.get('chat')) || [];
      const alvoResp = m.resp && typeof m.resp === 'string' ? hist.find((x) => x.id === m.resp && !x.apagado) : null;
      const msg = { id: idCurto(), de: a.id, autor: a.uid || a.id, cod: a.uid ? a.codigo || '' : '', av: a.uid ? a.av || 0 : 0, nome: a.nome, texto, t: agora }; // av: versão da foto (o histórico mostra a foto mesmo de quem já saiu) // cod: código público da conta (o app reconhece as próprias mensagens depois de reconectar)
      if (img) { msg.img = img; msg.anexo = { tipo: /^audio\//.test(arq.tipo) ? 'audio' : /^video\//.test(arq.tipo) ? 'video' : 'imagem', mime: arq.tipo }; }
      if (alvoResp) msg.resp = { id: alvoResp.id, de: alvoResp.de, nome: alvoResp.nome, trecho: alvoResp.texto ? alvoResp.texto.slice(0, 120) : '', img: !!alvoResp.img };
      hist.push(msg); while (hist.length > MAX_HIST) hist.shift();
      await this.ctx.storage.put('chat', hist);
      const pub = { ...msg }; delete pub.autor;
      for (const x of this.admitidos()) enviar(x.ws, { tipo: 'chat', ...pub });
    } else if (m.tipo === 'chat-reagir') {
      // (0.8.0) reações, como no Aero Talk: o mesmo emoji de novo tira. Quem tem conta conta pelo código dela; convidado, pelo id na sala
      if (a.mudo) return;
      const e = typeof m.e === 'string' ? m.e.trim() : '';
      if (!e || e.length > 16 || /[\s<>]/.test(e)) return;
      const hist = (await this.ctx.storage.get('chat')) || [];
      const msg = hist.find((x) => x.id === m.id && !x.apagado); if (!msg) return;
      const quem = a.uid ? a.codigo || a.id : a.id, rea = msg.rea || {};
      const l = rea[e] || [];
      if (l.includes(quem)) rea[e] = l.filter((x) => x !== quem); else { if (!rea[e] && Object.keys(rea).length >= 20) return; rea[e] = [...l, quem].slice(-200); }
      if (!rea[e].length) delete rea[e];
      msg.rea = rea;
      await this.ctx.storage.put('chat', hist);
      for (const x of this.admitidos()) enviar(x.ws, { tipo: 'chat-reagido', id: msg.id, rea });
    } else if (m.tipo === 'chat-editar' || m.tipo === 'chat-apagar') {
      // só o autor edita; o autor ou o host apagam
      const hist = (await this.ctx.storage.get('chat')) || [];
      const msg = hist.find((x) => x.id === m.id && !x.apagado); if (!msg) return;
      const ehAutor = msg.de === a.id || (!!a.uid && msg.autor === a.uid);
      if (m.tipo === 'chat-editar') {
        if (!ehAutor) return;
        const texto = limparTexto(m.texto); if (!texto && !msg.img) return;
        msg.texto = texto; msg.editado = this.agora();
        await this.ctx.storage.put('chat', hist);
        for (const x of this.admitidos()) enviar(x.ws, { tipo: 'chat-editado', id: msg.id, texto, editado: msg.editado });
      } else {
        if (!ehAutor && !ehHost) return;
        msg.apagado = true; msg.texto = ''; if (msg.img) { await this.ctx.storage.delete('img:' + msg.img); delete msg.img; }
        await this.ctx.storage.put('chat', hist);
        for (const x of this.admitidos()) enviar(x.ws, { tipo: 'chat-apagado', id: msg.id });
      }
    } else if (m.tipo === 'comp') {
      await this.contabilizar();
      const ativo = !!m.ativo, modo = ativo ? txt(m.modo, 8) : '';
      ws.serializeAttachment({ ...a, comp: ativo, modo, ctl: ativo ? a.ctl : null });
      if (!ativo || modo !== 'jogo') this.soltarControles(a.id);
      this.difundir();
    } else if (m.tipo === 'input') {
      await this.input(ws, a, m);
    } else if (m.tipo === 'cursor') {
      const cor = typeof m.cor === 'string' && HEX.test(m.cor) ? m.cor.toLowerCase() : '';
      ws.serializeAttachment({ ...a, cor });
      this.difundir();
    } else if (m.tipo === 'mic') {
      ws.serializeAttachment({ ...a, mic: !!m.ativo });
      this.difundir();
    }
  }

  async enviarHistorico(ws) {
    const hist = (await this.ctx.storage.get('chat')) || [];
    enviar(ws, { tipo: 'chat-hist', msgs: hist.filter((x) => !x.apagado).map(({ autor, ...pub }) => pub) });
  }

  // ---------- imagens do chat (HTTP: POST /img?id=&seg= e GET /img/<id>) ----------
  async imagem(request, url) {
    const cab = { 'Content-Type': 'application/json' };
    const partes = url.pathname.split('/').filter(Boolean); // ['img'] ou ['img', '<id>']
    if (request.method === 'GET' && partes[1]) {
      if (!/^[0-9a-f]{16}$/.test(partes[1])) return new Response('não encontrada', { status: 404 });
      const r = await this.ctx.storage.get('img:' + partes[1]);
      if (!r) return new Response('não encontrada', { status: 404 });
      return new Response(r.dados, { headers: { 'Content-Type': r.tipo, 'Cache-Control': 'private, max-age=86400, immutable', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (request.method !== 'POST') return new Response('método', { status: 405 });
    // quem manda tem de estar NA sala (id + segredo de retomada da conexão aberta)
    const x = this.porId(txt(url.searchParams.get('id') || '', 12));
    if (!x || !x.a.admitido || x.a.seg !== url.searchParams.get('seg')) return new Response(JSON.stringify({ erro: 'fora da sala' }), { status: 403, headers: cab });
    const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!TIPOS_IMG.includes(tipo)) return new Response(JSON.stringify({ erro: 'tipo' }), { status: 415, headers: cab });
    const dados = await request.arrayBuffer();
    if (!dados.byteLength || dados.byteLength > MAX_IMG) return new Response(JSON.stringify({ erro: 'grande' }), { status: 413, headers: cab });
    const lista = (await this.ctx.storage.get('imgs')) || [];
    while (lista.length >= MAX_IMGS) await this.ctx.storage.delete('img:' + lista.shift());
    const id = idCurto();
    lista.push(id);
    await this.ctx.storage.put({ ['img:' + id]: { tipo, dados }, imgs: lista });
    return new Response(JSON.stringify({ img: id }), { headers: cab });
  }

  async webSocketClose(ws, codigo) { await this.saiu(ws, codigo); }
  async webSocketError(ws) { await this.saiu(ws, 1006); }

  async saiu(ws, codigo) {
    const a = ws.deserializeAttachment();
    try { ws.close(1000, 'ok'); } catch (_) {}
    if (!a) return;
    if (a.substituido) { this.difundir(); return; }
    await this.contabilizar(a); // o tempo de quem saiu conta até agora
    await this.carregarAus();
    // caiu (rede, aba suspensa, troca de Wi-Fi...): guarda o lugar. Saiu de propósito (código 1000 ou "sair"): sai na hora.
    if (a.admitido && !a.saindo && codigo !== 1000) {
      this.aus[a.id] = { a: limparAtt(a), ate: this.agora() + GRACA_RETORNO };
      await this.gravarAus();
    } else this.soltarControles(a.id);
    this.difundir();
    await this.agendar();
  }

  // ---------- controle remoto (modo jogo) ----------
  // Os eventos do teclado, mouse e controle NÃO passam por aqui: vão direto de quem joga para quem transmite (DataChannel).
  // A sala só decide quem pode: pedidos, aprovação, pausa e quem está com o mouse/teclado de verdade.
  soltarControles(donoId) {
    for (const x of this.todos()) {
      if (x.a.ctl && x.a.ctl.dono === donoId) {
        x.ws.serializeAttachment({ ...x.a, ctl: null });
        enviar(x.ws, { tipo: 'input-fim', dono: donoId });
      }
    }
  }

  async input(ws, a, m) {
    const erro = (msg) => enviar(ws, { tipo: 'erro', codigo: 'input', msg });
    const acao = txt(m.acao, 10);
    const ehHost = a.papel === 'host';
    const alvoDe = () => { const x = this.porId(txt(m.id, 12)); return x && x.a.admitido ? x : null; };
    // (0.8.7) aprovar é só do dono da tela; o host pode negar ou tirar alguém do controle (moderação), mas não liberar a tela dos outros
    const podeDecidir = (alvo, acao2) => alvo.a.ctl && (alvo.a.ctl.dono === a.id || (ehHost && acao2 !== 'aprovar'));

    if (acao === 'pedir') {
      const dono = this.porId(txt(m.dono, 12));
      if (!dono || !dono.a.admitido || !dono.a.comp || dono.a.modo !== 'jogo' || dono.a.id === a.id) return erro('Essa pessoa não está transmitindo em modo jogo.');
      const regraDono = (a.porDono || {})[dono.a.id] || null, permEf = regraDe(a, dono);
      if (!['gamepad', 'mouse', 'teclado'].some((k) => permEf[k])) return erro('Você não tem permissão para controlar.');
      const agora = this.agora();
      if (a.ctl && a.ctl.dono === dono.a.id) return;
      if (a.pedidoT && agora - a.pedidoT < 2500) return erro('Devagar! Espere um pouco para pedir de novo.');
      const mesmaConta = !!a.uid && a.uid === dono.a.uid;
      // (0.8.7) "entra sem pedir" só vale se quem liberou foi o dono DESTA tela (o host na tela dele, ou a regra do próprio dono)
      const livre = dono.a.papel === 'host' ? !!a.livre : !!(regraDono && regraDono.livre);
      const st = livre || mesmaConta ? 'ativo' : 'pedindo';
      ws.serializeAttachment({ ...a, pedidoT: agora, ctl: { dono: dono.a.id, st, real: false } });
      if (st === 'pedindo') enviar(dono.ws, { tipo: 'input-pedido', id: a.id, nome: a.nome });
      this.difundir();
      return;
    }
    if (acao === 'aprovar' || acao === 'negar' || acao === 'revogar') {
      const alvo = alvoDe();
      if (!alvo || !podeDecidir(alvo, acao)) return;
      if (acao === 'aprovar') {
        if (alvo.a.ctl.st !== 'pedindo') return;
        alvo.ws.serializeAttachment({ ...alvo.a, ctl: { ...alvo.a.ctl, st: 'ativo' } });
      } else {
        const dono = alvo.a.ctl.dono;
        alvo.ws.serializeAttachment({ ...alvo.a, ctl: null });
        enviar(alvo.ws, { tipo: 'input-fim', dono, negado: acao === 'negar' });
      }
      this.difundir();
      return;
    }
    if (!a.ctl) return;
    if (acao === 'sair') { ws.serializeAttachment({ ...a, ctl: null }); this.difundir(); return; }
    if (a.ctl.st === 'pedindo') return;
    if (acao === 'pausar') { ws.serializeAttachment({ ...a, ctl: { ...a.ctl, st: 'pausado', real: false } }); this.difundir(); return; }
    if (acao === 'retomar') { if (a.ctl.st === 'pausado') { ws.serializeAttachment({ ...a, ctl: { ...a.ctl, st: 'ativo' } }); this.difundir(); } return; }
    if (acao === 'real') { // pedir (ou largar) o mouse e o teclado de verdade
      if (!m.ativo) { ws.serializeAttachment({ ...a, ctl: { ...a.ctl, real: false } }); this.difundir(); return; }
      const dono = this.porId(a.ctl.dono);
      if (!dono) return;
      const p = regraDe(a, dono);
      if (!p.mouse && !p.teclado) return erro('Você não tem permissão de mouse e teclado.');
      if (a.ctl.st !== 'ativo') return;
      // (0.5.9-5) várias pessoas podem estar com o mouse e o teclado: quem transmite decide na hora quem manda (quem mexeu primeiro
      // enquanto os outros estavam parados; entrada.js). Antes só uma tinha, e as outras só apareciam como cursor.
      ws.serializeAttachment({ ...a, ctl: { ...a.ctl, real: true } });
      this.difundir();
    }
  }

  // ---------- estatísticas: quanto tempo cada amigo assistiu e ficou junto ----------
  // Cada vez que algo muda (entrou, saiu, começou/parou de compartilhar), soma o tempo desde a última vez
  // usando o estado ANTERIOR. Só contas verificadas entram (convidados não têm histórico).
  async contabilizar(incluir) {
    const agora = this.agora();
    const t0 = await this.ctx.storage.get('t0');
    if (!t0) { await this.ctx.storage.put('t0', agora); return; }
    const dt = Math.min(agora - t0, SEIS_HORAS);
    if (dt < 1000) return;
    await this.ctx.storage.put('t0', agora);
    const pres = this.admitidos().map((x) => x.a).filter((a) => a.uid);
    if (incluir && incluir.admitido && incluir.uid && !pres.some((p) => p.id === incluir.id)) pres.push(incluir);
    if (pres.length < 2) return;
    const por = new Map(); // "a|b" -> {a, b, aVeB, bVeA, juntos}
    const reg = (x, y) => { const k = x + '|' + y; if (!por.has(k)) por.set(k, { a: x, b: y, aVeB: 0, bVeA: 0, juntos: 0 }); return por.get(k); };
    for (let i = 0; i < pres.length; i++) {
      for (let j = i + 1; j < pres.length; j++) {
        const p = pres[i], q = pres[j];
        if (p.uid === q.uid) continue;
        const r = reg(p.uid, q.uid);
        r.juntos += dt;
        if (q.comp) r.aVeB += dt; // p estava na sala enquanto q transmitia
        if (p.comp) r.bVeA += dt;
      }
    }
    const itens = [...por.values()];
    if (!itens.length || !this.env || !this.env.HUB) return;
    try {
      await this.env.HUB.get(this.env.HUB.idFromName('global')).fetch('https://hub/interno/stats', {
        method: 'POST', body: JSON.stringify({ itens }),
      });
    } catch (e) { console.error('stats', e); }
  }

  // Um único alarme por sala. Vazia: fecha em 45 s. Com 2+ contas: soma o tempo a cada 5 min (nada se perde se algo cair).
  // Com gente mas sem 2 contas: vigia a cada 10 min. Assim uma sala nunca fica esquecida aberta.
  async agendar() {
    if (!this.ctx.storage.setAlarm) return;
    const n = this.todos().length, contas = this.admitidos().filter((x) => x.a.uid).length;
    let quando = n === 0 ? GRACA_VAZIA : contas >= 2 ? 300000 : LIMITE_VAZIA;
    const ates = Object.values(this.aus || {}).map((r) => r.ate - this.agora());
    if (ates.length) quando = Math.min(quando, Math.max(1000, Math.min(...ates)));
    await this.ctx.storage.setAlarm(this.agora() + quando);
  }

  async alarm() {
    const saiuDeVez = await this.purgarAus();
    if (this.todos().length === 0 && !Object.keys(this.aus).length) {
      // o último lugar guardado acabou de vencer: completa a graça normal da sala vazia antes de fechar
      if (saiuDeVez) { await this.ctx.storage.setAlarm(this.agora() + GRACA_VAZIA - GRACA_RETORNO); return; }
      await this.ctx.storage.deleteAll(); // ninguém na sala: ela fecha e o espaço no servidor é devolvido
      this.aus = {};
      return;
    }
    await this.contabilizar();
    await this.agendar();
  }
}
