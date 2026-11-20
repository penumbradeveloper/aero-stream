// Aero Stream - administração: cargos (desenvolvedor e moderador), ID de cada conta, insígnias, banimentos (por conta, IP e aparelho),
// silenciar (não manda mensagens para ninguém), denúncias, feedback, aparelhos conectados e avisos para a pessoa.
//  - O ID (12 letras/números) é criado na primeira vez que a conta usa o app nesta versão e SÓ o desenvolvedor vê.
//  - Desenvolvedor (o dono): a conta do ID em DEV_UIDS E selada com a chave exclusiva DONO_CHAVE (segredo do servidor, nunca vai para o
//    app). Sem o selo, nem a conta certa vira dono; e ninguém faz o selo sem a chave. Trocar a chave desfaz todos os selos. Ele vê IDs, dá cargo de
//    moderador, insígnias, bane por IP/aparelho e lê os feedbacks. Moderador: bane e silencia por #, lê e responde denúncias; não mexe no
//    desenvolvedor nem em outro moderador, e não dá cargo nem insígnia.
//  - Tudo fica no armazenamento do Durable Object (continua lá com o app fechado).
// Criado por Ryan Victtor.
import { resposta, erro, txt, hex, normalizarTag, CORS } from './util.js';
import { PLANOS, publicoBolha } from './bolha.js';

const DEV_UIDS = [/* o ID da conta do dono fica só no servidor */]; // (0.9.4) a conta do desenvolvedor pelo ID (o ID é sorteado pelo servidor: ninguém escolhe o seu)
const UID = /^[0-9a-f]{12}$/;
const COR = /^#[0-9a-f]{6}$/i;
const SUBS_BUG = ['chat', 'transmissao', 'interface', 'conexao', 'outros'];
const MAX_ANEXOS_FB = 4, MAX_ANEXO_FB = 25 * 1024 * 1024, PEDACO_FB = 1024 * 1024;
const novoId = () => hex(crypto.getRandomValues(new Uint8Array(8)));
// comparar sem dar pistas pelo tempo
const iguais = (a, b) => { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0 && a.length > 0; };

export class Admin {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }
  get(k) { return this.st.get(k); }

  // ---------- cargo, ID e de onde a conta entra (IP e aparelho) ----------
  // (0.9.7) o dono: SÓ a conta do ID certo e com o selo feito pela chave exclusiva. Antes também valia o e-mail (e contas antigas sem o
  // e-mail provado), e isso abria brecha. O selo é um HMAC da chave do servidor sobre a conta e o ID: não dá para copiar nem inventar
  async seloDono(conta) {
    const k = this.hub.env.DONO_CHAVE; if (!k || !conta || !conta.uid) return '';
    if (!this._donoK) this._donoK = await crypto.subtle.importKey('raw', new TextEncoder().encode(k), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(new Uint8Array(await crypto.subtle.sign('HMAC', this._donoK, new TextEncoder().encode('aero-dono:' + conta.id + ':' + conta.uid))));
  }
  donoPossivel(conta) { return !!(conta && conta.uid && DEV_UIDS.includes(conta.uid)); }
  // REGRA PERMANENTE: a conta do dono (ID em DEV_UIDS) é SEMPRE desenvolvedor, sem restrição nenhuma, com ou sem o selo da chave.
  // O selo (DONO_CHAVE) fica só como registro extra; ele nunca pode tirar o cargo do dono (em 2026-11-18 tirou, e isso não pode voltar).
  async ehDev(conta) { return this.donoPossivel(conta); }
  // o dono prova a chave uma vez por conta: o servidor guarda só o selo (a chave não fica em lugar nenhum além do segredo do servidor)
  async ativarDono(conta, b) {
    if (!this.hub.limitar('dono:' + conta.id, 5, 3600000)) return erro('Tente de novo mais tarde.', 429);
    const k = this.hub.env.DONO_CHAVE, dada = String((b && b.chave) || '');
    if (!k || !this.donoPossivel(conta) || !iguais(dada, k)) return erro('Chave inválida.', 403);
    conta.donoS = await this.seloDono(conta); conta.dev = true;
    await this.st.put('c:' + conta.id, conta);
    return resposta({ ok: true });
  }
  async cargo(conta) { return (await this.ehDev(conta)) ? 'dev' : conta.cargo === 'mod' ? 'mod' : ''; }
  // (0.7.14) o IP NÃO fica guardado: só um código (HMAC com a chave secreta do servidor) que serve para banir a mesma rede e não volta a ser o IP
  async ipH(ip) { if (!ip || ip === 'x') return ''; const { hmac } = await this.hub.acesso.chaves(); return 'r' + hex(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode('ip:' + ip)))).slice(0, 20); }
  // chamado a cada pedido logado: cria o ID e guarda os últimos IPs (o código) e aparelhos (só grava quando muda)
  async garantir(conta, ip, hw) {
    let mudou = false;
    if ((conta.ips || []).some((x) => !/^r[0-9a-f]{20}$/.test(x))) { conta.ips = [...new Set(await Promise.all(conta.ips.map((x) => (/^r[0-9a-f]{20}$/.test(x) ? x : this.ipH(x)))))].filter(Boolean); mudou = true; } // contas antigas: IP aberto vira código
    ip = await this.ipH(ip);
    if (!conta.uid) { let u; do { u = hex(crypto.getRandomValues(new Uint8Array(6))); } while (await this.get('u:' + u)); conta.uid = u; await this.st.put('u:' + u, conta.id); mudou = true; }
    if (ip && ip !== 'x' && (conta.ips || [])[0] !== ip) { conta.ips = [ip, ...(conta.ips || []).filter((x) => x !== ip)].slice(0, 8); mudou = true; }
    if (hw && (conta.hws || [])[0] !== hw) { conta.hws = [hw, ...(conta.hws || []).filter((x) => x !== hw)].slice(0, 8); mudou = true; }
    const dv = await this.ehDev(conta); // (0.8.1) o desenvolvedor tem tudo das assinaturas (limitesDe lê isso)
    if (!!conta.dev !== dv) { if (dv) conta.dev = true; else delete conta.dev; mudou = true; }
    if (mudou) await this.st.put('c:' + conta.id, conta);
    return conta;
  }
  // banido? (a conta, o IP ou o aparelho) -> { ate, motivo } ou null. "ate" 0 = sem prazo.
  async banimento(conta, ip, hw) {
    const agora = Date.now(), vale = (b) => b && (!b.ate || b.ate > agora);
    const chaves = [];
    if (conta) chaves.push('ban:' + conta.id);
    if (ip && ip !== 'x') chaves.push('banip:' + (await this.ipH(ip)), 'banip:' + ip); // (o segundo: banimento de antes da 0.7.14, com o IP aberto)
    if (hw) chaves.push('banhw:' + hw);
    for (const k of chaves) {
      const b = await this.get(k); if (!vale(b)) continue;
      // (0.9.1) IP é compartilhado (operadora com CGNAT, Wi-Fi público): o bloqueio por IP só barra CONTA NOVA criada dali depois do banimento
      // (e quem tenta entrar sem conta). Quem já tinha conta antes e só divide o mesmo IP não é punido por outra pessoa. Vale no máximo 30 dias
      if (k.startsWith('banip:') && ((conta && conta.id !== b.conta && (conta.criado || 0) < (b.t || 0)) || (b.t && agora - b.t > 30 * 86400000))) continue;
      return { ate: b.ate || 0, motivo: b.motivo || '' };
    }
    return null;
  }
  async silenciado(conta) { const m = await this.get('mudo:' + conta.id); return m && (!m.ate || m.ate > Date.now()) ? { ate: m.ate || 0, motivo: m.motivo || '' } : null; }

  // ---------- avisos para a pessoa (resposta de denúncia/feedback, banimento) ----------
  // ref: a denúncia/feedback de onde veio (para a equipe ver se a pessoa já leu a resposta)
  async avisar(contaId, texto, tipo = 'admin', ref = '') {
    const c = await this.get('c:' + contaId); if (!c) return;
    const av = { id: novoId(), tipo, texto: txt(texto, 1000), t: Date.now(), ref: ref || undefined };
    c.avisos = [...(c.avisos || []), av].slice(-30);
    await this.st.put('c:' + c.id, c);
    for (const ws of this.hub.ctx.getWebSockets('c:' + contaId)) { try { ws.send(JSON.stringify({ tipo: 'aviso-admin', aviso: av })); } catch (_) { /* ok */ } }
    return av;
  }

  // (0.5.9-6) a pessoa FECHOU o aviso (não basta ter aparecido): sai da lista, a resposta da denúncia/feedback fica marcada como lida
  // e os outros aparelhos da conta fecham o mesmo aviso. O que não foi fechado aparece de novo ao abrir o app, em qualquer aparelho.
  async lido(conta, b) {
    const ids = new Set((b.ids || []).map(String).slice(0, 50));
    const lidos = (conta.avisos || []).filter((a) => ids.has(a.id));
    conta.avisos = (conta.avisos || []).filter((a) => !ids.has(a.id));
    const gl = [...ids].filter((id) => /^g[0-9a-f]{16}$/.test(id) && !(conta.agLidos || []).includes(id)); // (0.8.2) avisos para todo mundo
    if (gl.length) { conta.agLidos = [...(conta.agLidos || []), ...gl].slice(-100); lidos.push(...gl.map((id) => ({ id }))); }
    await this.st.put('c:' + conta.id, conta);
    // (0.8.2) os avisos que o desenvolvedor mandou: quem leu e quando
    for (const a of lidos) {
      const k = a.ref && /^env:[0-9a-f]{16}$/.test(a.ref) ? a.ref : /^g[0-9a-f]{16}$/.test(a.id) ? 'env:' + a.id : '';
      if (!k) continue;
      const e = await this.get(k); if (!e) continue;
      if (e.todos) e.nLidos = (e.nLidos || 0) + 1; else { const q = e.para.find((x) => x.id === conta.id); if (!q || q.lido) continue; q.lido = Date.now(); }
      await this.st.put(k, e); this.devMudou();
    }
    for (const a of lidos) {
      if (!a.ref || !/^(rp|fb):[0-9a-f]{16}$/.test(a.ref)) continue;
      const r = await this.get(a.ref); if (!r || !r.resposta) continue;
      r.resposta.lido = Date.now(); await this.st.put(a.ref, r);
    }
    if (lidos.length) for (const ws of this.hub.ctx.getWebSockets('c:' + conta.id)) { try { ws.send(JSON.stringify({ tipo: 'aviso-lido', ids: lidos.map((a) => a.id) })); } catch (_) { /* ok */ } }
    if (lidos.some((a) => a.ref)) this.equipeMudou();
    return resposta({ ok: true });
  }
  // (0.8.2) avisos para todo mundo: guardados uma vez só ("ag:"), e cada conta guarda quais já fechou. Valem por 30 dias e só para
  // quem já tinha conta quando o aviso saiu.
  async globaisDe(conta) {
    const desde = Date.now() - 30 * 86400000, lidos = new Set(conta.agLidos || []);
    const m = await this.st.list({ prefix: 'ag:', start: 'ag:' + String(desde).padStart(14, '0') });
    return [...m.values()].filter((a) => !lidos.has(a.id) && a.t >= (conta.criado || 0));
  }
  async avisarTodos(texto, tipo) {
    const av = { id: 'g' + novoId(), tipo, texto: txt(texto, 1000), t: Date.now() };
    await this.st.put('ag:' + String(av.t).padStart(14, '0') + ':' + av.id, av);
    await this.st.put('env:' + av.id, { id: av.id, t: av.t, texto: av.texto, tipo, todos: true, nLidos: 0 }); // (0.8.2) o histórico do desenvolvedor
    let n = 0;
    for (const ws of this.hub.ctx.getWebSockets()) {
      let a; try { a = ws.deserializeAttachment(); } catch (_) { continue; }
      if (!a || !a.conta) continue;
      try { ws.send(JSON.stringify({ tipo: 'aviso-admin', aviso: av })); n++; } catch (_) { /* ok */ }
    }
    return n;
  }

  // (0.8.3) feedbacks que o desenvolvedor ainda não leu (no total e por tipo); novo=true: chegou um agora (o app dele toca o som)
  async fbNovos(novo) {
    const m = await this.st.list({ prefix: 'fb:' }), porTipo = {}, porPessoa = {}; let n = 0;
    for (const f of m.values()) if (f && f.lido === false) { n++; porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1; porPessoa[f.de] = (porPessoa[f.de] || 0) + 1; }
    const r = { n, porTipo, porPessoa };
    if (novo !== undefined) for (const ws of this.hub.ctx.getWebSockets('dev')) { try { ws.send(JSON.stringify({ tipo: 'fb-novos', ...r, novo: !!novo })); } catch (_) { /* ok */ } }
    return r;
  }
  // (0.8.2) só a página do desenvolvedor (os avisos que ele mandou)
  devMudou() { for (const ws of this.hub.ctx.getWebSockets('dev')) { try { ws.send(JSON.stringify({ tipo: 'admin-mudou', o: 'avisos' })); } catch (_) { /* ok */ } } }
  // apagar um aviso mandado: some da lista de quem ainda não leu (e fecha na tela de quem está com o app aberto)
  async retirar(e) {
    if (e.todos) {
      const m = await this.st.list({ prefix: 'ag:' }); for (const [k, v] of m) if (v.id === e.id) await this.st.delete(k);
      for (const ws of this.hub.ctx.getWebSockets()) { let a; try { a = ws.deserializeAttachment(); } catch (_) { continue; } if (a && a.conta) { try { ws.send(JSON.stringify({ tipo: 'aviso-lido', ids: [e.id] })); } catch (_) { /* ok */ } } }
      return;
    }
    for (const q of e.para || []) {
      if (q.lido) continue;
      const c = await this.get('c:' + q.id); if (!c) continue;
      const antes = (c.avisos || []).length; c.avisos = (c.avisos || []).filter((a) => a.id !== q.av);
      if (c.avisos.length === antes) continue;
      await this.st.put('c:' + c.id, c);
      for (const ws of this.hub.ctx.getWebSockets('c:' + c.id)) { try { ws.send(JSON.stringify({ tipo: 'aviso-lido', ids: [q.av] })); } catch (_) { /* ok */ } }
    }
  }
  // a página da equipe se atualiza sozinha (denúncia nova, feedback novo, resposta lida...)
  equipeMudou() { for (const ws of this.hub.ctx.getWebSockets('equipe')) { try { ws.send(JSON.stringify({ tipo: 'admin-mudou' })); } catch (_) { /* ok */ } } }

  // ---------- quem é o alvo (ID só para o desenvolvedor; moderador usa a #) ----------
  async alvo(b, dev) {
    const uid = String(b.uid || '').toLowerCase().trim(), tag = normalizarTag(String(b.tag || '').replace(/^#/, ''));
    let id = null;
    if (uid && dev && UID.test(uid)) id = await this.get('u:' + uid);
    if (!id && tag) id = await this.get('t:' + tag.toLowerCase());
    return id ? this.get('c:' + id) : null;
  }
  async ficha(c, dev) {
    const ban = await this.banimento(c, null, null), mudo = await this.silenciado(c);
    const f = { nome: c.nome, tag: c.tag, codigo: c.codigo, av: c.avatarV || 0, nm: (c.extra || {}).nm || undefined, cargo: await this.cargo(c), seloMod: !!c.seloMod, sl: await this.hub.selos(c), ban, mudo, ins: c.ins || [], criado: c.criado, bolha: publicoBolha(c) };
    if (dev) Object.assign(f, { uid: c.uid || '', ips: c.ips || [], hws: c.hws || [] });
    return f;
  }

  // ---------- rotas ----------
  async rota(conta, rota, M, b, ip) {
    // para todo mundo: denunciar, mandar feedback, ver os avisos, aparelhos conectados, status
    if (rota === 'denunciar' && M === 'POST') return this.denunciar(conta, b);
    if (rota === 'feedback' && M === 'POST') return this.feedback(conta, b);
    if (rota === 'avisos' && M === 'GET') return resposta({ avisos: [...(conta.avisos || []), ...(await this.globaisDe(conta))] });
    if (rota === 'avisos/lido' && M === 'POST') return this.lido(conta, b);
    if (rota === 'admin/eu' && M === 'GET') return resposta({ cargo: await this.cargo(conta) });
    if (!rota.startsWith('admin/')) return null;
    const cargo = await this.cargo(conta), dev = cargo === 'dev';
    if (!cargo) return erro('Só para a equipe do Aero.', 403);
    if (rota === 'admin/analytics') return dev ? resposta(await this.hub.analytics.resumo(b)) : erro('Só o desenvolvedor pode ver isso.', 403); // b: { de, ate, fuso } (analytics.js)
    if (rota === 'admin/assinatura/apagar') { // (0.8.3) tirar do caixa um pagamento posto só para testar
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      return (await this.hub.bolha.apagarPagamento(b.id)) ? resposta({ ok: true }) : erro('Pagamento não encontrado.', 404);
    }
    if (rota === 'admin/assinaturas') return dev ? resposta(await this.hub.bolha.painel(b)) : erro('Só o desenvolvedor pode ver isso.', 403); // (0.8.2) o caixa do Aero Bubble (bolha.js)
    if (rota === 'admin/buscar') { const c = await this.alvo(b, dev); return c ? resposta({ conta: await this.ficha(c, dev) }) : erro('Ninguém com esse ' + (dev ? 'ID ou #' : '#') + '.', 404); }
    if (rota === 'admin/denuncias' && M === 'GET') return this.listar('rp:');
    if (rota === 'admin/denuncia/responder') return this.responder('rp:', b, true);
    if (rota === 'admin/denuncia/apagar') { await this.st.delete('rp:' + String(b.id || '')); this.equipeMudou(); return resposta({ ok: true }); }
    // (0.8.2) o desenvolvedor dispara avisos: para todo mundo ou para as pessoas escolhidas (ID ou #)
    if (rota === 'admin/avisos-enviar') {
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      const texto = txt(b.texto, 1000); if (!texto) return erro('Escreva o aviso.');
      const nivel = ['normal', 'aviso', 'alerta'].includes(b.nivel) ? b.nivel : 'normal', tipo = nivel === 'normal' ? 'admin' : nivel;
      if (b.todos === true) return resposta({ ok: true, todos: true, online: await this.avisarTodos(texto, tipo) });
      const alvos = (Array.isArray(b.para) ? b.para : []).slice(0, 200);
      if (!alvos.length) return erro('Escolha para quem mandar.');
      const feitos = new Set(), naoAchou = [], env = { id: novoId(), t: Date.now(), texto, tipo, para: [] };
      for (const x of alvos) {
        const v = String(x || '').trim(), q = /^[0-9a-f]{12}$/i.test(v) ? { uid: v } : { tag: v.replace(/^#/, '') };
        const o = v && (await this.alvo(q, true));
        if (!o) { naoAchou.push(v.slice(0, 40)); continue; }
        if (feitos.has(o.id)) continue; feitos.add(o.id);
        const av = await this.avisar(o.id, texto, tipo, 'env:' + env.id);
        if (av) env.para.push({ id: o.id, nome: o.nome, tag: o.tag || '', av: av.id, lido: 0 });
      }
      if (env.para.length) { await this.st.put('env:' + env.id, env); this.devMudou(); }
      return resposta({ ok: true, enviados: feitos.size, naoAchou });
    }
    // (0.8.2) os avisos que o desenvolvedor mandou: a lista com quem leu, apagar um (some também de quem ainda não leu) e limpar os já lidos
    if (rota === 'admin/avisos-enviados' && M === 'GET') {
      if (!dev) return erro('Só o desenvolvedor pode ver isso.', 403);
      const m = await this.st.list({ prefix: 'env:', limit: 500 });
      return resposta({ itens: [...m.values()].sort((x, y) => y.t - x.t).map((e) => ({ ...e, para: (e.para || []).map(({ nome, tag, lido }) => ({ nome, tag, lido })) })) });
    }
    if (rota === 'admin/aviso-enviado/apagar') {
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      const id = String(b.id || ''); if (!/^g?[0-9a-f]{16}$/.test(id)) return erro('Aviso não encontrado.', 404);
      const e = await this.get('env:' + id); if (!e) return erro('Aviso não encontrado.', 404);
      await this.retirar(e);
      await this.st.delete('env:' + id); this.devMudou();
      return resposta({ ok: true });
    }
    if (rota === 'admin/avisos-enviados/limpar') {
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      const m = await this.st.list({ prefix: 'env:', limit: 500 }), velho = Date.now() - 30 * 86400000, apagar = [];
      for (const [k, e] of m) if (e.todos ? e.t < velho : (e.para || []).every((x) => x.lido)) apagar.push(k);
      if (apagar.length) await this.st.delete(apagar);
      this.devMudou();
      return resposta({ ok: true, apagados: apagar.length });
    }
    const c = rota === 'admin/feedbacks' || rota === 'admin/feedbacks-novos' || rota.startsWith('admin/feedback/') ? null : await this.alvo(b, dev);
    // daqui para baixo, cada ação tem um alvo; moderador não mexe no desenvolvedor nem em outro moderador
    if (c) {
      const cargoAlvo = await this.cargo(c);
      // (0.8.1) o desenvolvedor pode dar a si mesmo insígnias, assinatura e selos; banir, silenciar e cargo continuam fora
      const proprio = dev && c.id === conta.id && !['admin/banir', 'admin/silenciar', 'admin/cargo'].includes(rota);
      if (!proprio && (cargoAlvo === 'dev' || (!dev && cargoAlvo === 'mod'))) return erro('Você não pode fazer isso com essa conta.', 403);
    }
    const prazo = (v) => { const n = Math.round(+v || 0); return n > 0 ? Date.now() + Math.min(n, 3650 * 86400000) : 0; }; // b.dur em ms; 0 = sem prazo
    if (rota === 'admin/banir') {
      if (!c) return erro('Ninguém com esse ' + (dev ? 'ID ou #' : '#') + '.', 404);
      const reg = { ate: prazo(b.dur), motivo: txt(b.motivo, 300), por: conta.id, t: Date.now() };
      const grava = { ['ban:' + c.id]: reg };
      if (dev && b.ip) for (const x of (c.ips || []).slice(0, 3)) grava['banip:' + x] = { ...reg, conta: c.id };
      if (dev && b.hw) for (const x of (c.hws || []).slice(0, 3)) grava['banhw:' + x] = { ...reg, conta: c.id };
      await this.st.put(grava);
      await this.avisar(c.id, 'Sua conta foi suspensa' + (reg.ate ? ' até ' + new Date(reg.ate).toLocaleString('pt-BR') : ' por tempo indeterminado') + (reg.motivo ? '. Motivo: ' + reg.motivo : '.'), 'ban');
      for (const ws of this.hub.ctx.getWebSockets('c:' + c.id)) { try { ws.close(4003, 'banido'); } catch (_) { /* ok */ } }
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/desbanir') {
      if (!c) return erro('Conta não encontrada.', 404);
      await this.st.delete('ban:' + c.id);
      if (dev) { for (const x of c.ips || []) { const r = await this.get('banip:' + x); if (r && r.conta === c.id) await this.st.delete('banip:' + x); } for (const x of c.hws || []) { const r = await this.get('banhw:' + x); if (r && r.conta === c.id) await this.st.delete('banhw:' + x); } }
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/silenciar') {
      if (!c) return erro('Conta não encontrada.', 404);
      const reg = { ate: prazo(b.dur), motivo: txt(b.motivo, 300), por: conta.id };
      await this.st.put('mudo:' + c.id, reg);
      await this.avisar(c.id, 'Você não pode mandar mensagens' + (reg.ate ? ' até ' + new Date(reg.ate).toLocaleString('pt-BR') : ' por tempo indeterminado') + (reg.motivo ? '. Motivo: ' + reg.motivo : '.'), 'mudo');
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/dessilenciar') { if (!c) return erro('Conta não encontrada.', 404); await this.st.delete('mudo:' + c.id); return resposta({ ok: true, conta: await this.ficha(c, dev) }); }
    // só o desenvolvedor
    if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
    if (rota === 'admin/cargo') {
      if (!c) return erro('Conta não encontrada.', 404);
      if (b.cargo === 'mod') c.cargo = 'mod'; else delete c.cargo;
      await this.st.put('c:' + c.id, c);
      await this.hub.mudou([c.id, ...Object.keys(c.amigos || {})]);
      if (c.cargo) await this.avisar(c.id, 'Você agora é moderador(a) do Aero. A aba Moderação apareceu no app.', 'cargo');
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/aviso') { // (0.8.2) o desenvolvedor manda um aviso para a pessoa (aparece na lista de avisos do app dela)
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      if (!c) return erro('Ninguém com esse ID ou #.', 404);
      const texto = txt(b.texto, 1000); if (!texto) return erro('Escreva o aviso.');
      // o jeito: notificação normal, aviso (atenção) ou alerta (urgente)
      const nivel = ['normal', 'aviso', 'alerta'].includes(b.nivel) ? b.nivel : 'normal';
      const env = { id: novoId(), t: Date.now(), texto, tipo: nivel === 'normal' ? 'admin' : nivel, para: [] };
      const av = await this.avisar(c.id, texto, env.tipo, 'env:' + env.id);
      if (av) { env.para.push({ id: c.id, nome: c.nome, tag: c.tag || '', av: av.id, lido: 0 }); await this.st.put('env:' + env.id, env); this.devMudou(); }
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/selo-mod') { // (0.8.0) só o ícone de moderador, sem o cargo
      if (!c) return erro('Conta não encontrada.', 404);
      if (b.sim) c.seloMod = true; else delete c.seloMod;
      await this.st.put('c:' + c.id, c);
      await this.hub.mudou([c.id, ...Object.keys(c.amigos || {})]);
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    if (rota === 'admin/insignias') {
      if (!c) return erro('Conta não encontrada.', 404);
      c.ins = (Array.isArray(b.ins) ? b.ins : []).slice(0, 4).map((x) => ({ t: txt(x.t, 24), c1: COR.test(x.c1) ? x.c1 : '#2d9ee0', c2: COR.test(x.c2) ? x.c2 : '', ct: COR.test(x.ct) ? x.ct : '#ffffff' })).filter((x) => x.t);
      await this.st.put('c:' + c.id, c);
      await this.hub.mudou([c.id, ...Object.keys(c.amigos || {})]);
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    // (0.7.14) Aero Bubble: dar, renovar ou tirar o plano de alguém (quem pagou por PIX, por exemplo). dias 0 = sem prazo
    if (rota === 'admin/bolha') {
      if (!c) return erro('Conta não encontrada.', 404);
      const plano = String(b.plano || ''); if (plano && !PLANOS[plano]) return erro('Plano inválido.');
      // (0.8.0) b.ms: qualquer duração (presente); b.dias continua valendo. 0 = sem prazo
      const ms = b.ms !== undefined ? Math.max(0, Math.round(+b.ms || 0)) : Math.max(0, Math.round(+b.dias || 0)) * 86400000;
      if (!Number.isFinite(ms)) return erro('Tempo inválido.');
      // (0.8.2) b.pago: { via, valor }: o desenvolvedor registra um pagamento que chegou fora do app (o PIX direto no Nubank, por exemplo)
      const VIAS_PAGO = ['nubank', 'kofi', 'mp-pix', 'mp-cartao', 'outro'];
      const pago = plano && dev && b.pago && VIAS_PAGO.includes(b.pago.via) ? { via: b.pago.via, valor: Math.max(0, Math.min(100000, +b.pago.valor || PLANOS[plano].preco)) } : null;
      if (b.pago && !pago) return erro(dev ? 'Pagamento inválido.' : 'Só o desenvolvedor registra pagamentos.', dev ? 400 : 403);
      if (!plano) { await this.hub.bolha.tirar(c); return resposta({ ok: true, conta: await this.ficha(c, dev) }); } // (0.8.2) cancela o cartão junto
      await this.hub.bolha.darMs(c, plano, ms, pago ? pago.via : b.presente ? 'presente' : 'dev');
      if (pago) await this.hub.bolha.registrar({ tipo: 'pago', plano, valor: pago.valor, via: pago.via, conta: c.id });
      if (plano) await this.avisar(c.id, b.presente && !pago ? 'Você ganhou de presente o Aero Bubble ' + PLANOS[plano].nome + (b.texto ? ' por ' + txt(b.texto, 40) : ' sem prazo') + '! Aproveite.' : 'Obrigado por apoiar o Aero! Seu Aero Bubble ' + PLANOS[plano].nome + ' está ativo.', 'bolha');
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    // (0.8.5) uma DOAÇÃO (sem plano) que chegou fora do app, como o PIX direto no Nubank: o Nubank não avisa ninguém, então o desenvolvedor
    // registra o valor e ele entra no caixa (soma do PIX Nubank, total e a conta da pessoa). O plano da pessoa não muda
    if (rota === 'admin/doacao') {
      if (!dev) return erro('Só o desenvolvedor registra pagamentos.', 403);
      if (!c) return erro('Conta não encontrada.', 404);
      const via = ['nubank', 'kofi', 'mp-pix', 'outro'].includes(b.via) ? b.via : 'nubank', valor = Math.round(+b.valor * 100) / 100;
      if (!(valor > 0 && valor <= 100000)) return erro('Valor inválido.');
      await this.hub.bolha.registrar({ tipo: 'pago', plano: '', valor, via, conta: c.id });
      return resposta({ ok: true, conta: await this.ficha(c, dev) });
    }
    // (0.8.2) o "Presentear" do desenvolvedor para várias pessoas de uma vez (ID ou #): dar (soma o tempo se já tiver o mesmo plano) ou tirar
    if (rota === 'admin/bolha-varios') {
      if (!dev) return erro('Só o desenvolvedor pode fazer isso.', 403);
      const tirar = b.tirar === true, plano = String(b.plano || '');
      if (!tirar && !PLANOS[plano]) return erro('Plano inválido.');
      const ms = Math.max(0, Math.round(+b.ms || 0)); if (!Number.isFinite(ms)) return erro('Tempo inválido.');
      const alvos = (Array.isArray(b.para) ? b.para : []).slice(0, 100);
      if (!alvos.length) return erro('Escolha para quem.');
      const feitos = [], naoAchou = [], semPlano = [], vistos = new Set();
      for (const x of alvos) {
        const v = String(x || '').trim(), q = /^[0-9a-f]{12}$/i.test(v) ? { uid: v } : { tag: v.replace(/^#/, '') };
        const o = v && (await this.alvo(q, true));
        if (!o) { naoAchou.push(v.slice(0, 40)); continue; }
        if (vistos.has(o.id)) continue; vistos.add(o.id);
        if (tirar) {
          if (!(o.bolha && o.bolha.plano)) { semPlano.push(o.tag || o.nome); continue; }
          await this.hub.bolha.tirar(o);
        } else {
          await this.hub.bolha.darMs(o, plano, ms, 'presente');
          await this.avisar(o.id, 'Você ganhou de presente o Aero Bubble ' + PLANOS[plano].nome + (ms ? (b.texto ? ' por ' + txt(b.texto, 40) : '') : ' sem prazo') + '! Aproveite.', 'bolha');
        }
        feitos.push({ nome: o.nome, tag: o.tag || '', plano: (o.bolha && o.bolha.plano) || '', ate: (o.bolha && o.bolha.ate) || 0 });
      }
      return resposta({ ok: true, feitos, naoAchou, semPlano });
    }
    if (rota === 'admin/bolha-lista' && M === 'GET') return dev ? resposta({ itens: await this.hub.bolha.ativos() }) : erro('Só o desenvolvedor pode ver isso.', 403);
    // (0.8.2) os anexos do feedback (fotos, GIFs, áudios e vídeos), só para o desenvolvedor
    if (rota.startsWith('admin/feedback-anexo/') && M === 'GET') {
      if (!dev) return erro('Só o desenvolvedor pode ver isso.', 403);
      const id = rota.slice(21); if (!/^[0-9a-f]{16}$/.test(id)) return erro('Anexo não encontrado.', 404);
      const meta = await this.get('fbm:' + id); if (!meta) return erro('Anexo não encontrado.', 404);
      const out = new Uint8Array(meta.tam); let o = 0;
      for (let i = 0; i < meta.partes; i++) { const p = await this.get('fbd:' + id + ':' + i); if (!p) break; const u = new Uint8Array(p); out.set(u, o); o += u.length; }
      return new Response(out, { headers: { ...CORS, 'Content-Type': meta.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (rota === 'admin/feedbacks' && M === 'GET') return this.listar('fb:');
    if (rota === 'admin/feedbacks-novos' && M === 'GET') return resposta(await this.fbNovos()); // (0.8.3) as bolinhas do desenvolvedor
    if (rota === 'admin/feedback/responder') return this.responder('fb:', b, false);
    if (rota === 'admin/feedback/lido') { const k = 'fb:' + String(b.id || ''), f = await this.get(k); if (!f) return erro('Feedback não encontrado.', 404); f.lido = b.lido !== false; await this.st.put(k, f); this.equipeMudou(); await this.fbNovos(false); return resposta({ ok: true }); }
    if (rota === 'admin/feedback/apagar') { const k = 'fb:' + String(b.id || ''), f = await this.get(k); if (f) await this.apagarAnexosFb(f.anexos); await this.st.delete(k); this.equipeMudou(); await this.fbNovos(false); return resposta({ ok: true }); }
    // (0.8.3) limpar os já lidos: todos ou só os de uma pessoa (de: o id interno que veio na lista). Ficam só os não lidos
    if (rota === 'admin/feedback/limpar-lidos') {
      const de = String(b.de || ''), m = await this.st.list({ prefix: 'fb:' }), apagar = [];
      for (const [k, f] of m) if (f && f.lido !== false && (!de || f.de === de)) { apagar.push(k); await this.apagarAnexosFb(f.anexos); }
      if (apagar.length) await this.st.delete(apagar);
      this.equipeMudou(); await this.fbNovos(false);
      return resposta({ ok: true, apagados: apagar.length });
    }
    return erro('Não encontrado', 404);
  }

  // ---------- denúncias e feedback (ficam guardados até alguém da equipe apagar) ----------
  async denunciar(conta, b) {
    if (!this.hub.limitar('den:' + conta.id, 5, 3600000)) return erro('Muitas denúncias seguidas. Tente mais tarde.', 429);
    const tag = normalizarTag(String(b.tag || '').replace(/^#/, '')), motivo = txt(b.motivo, 1000);
    if (motivo.length < 5) return erro('Conte o que aconteceu (pelo menos algumas palavras).');
    const alvoId = tag ? await this.get('t:' + tag.toLowerCase()) : null;
    const alvo = alvoId ? await this.get('c:' + alvoId) : null;
    const id = novoId();
    await this.st.put('rp:' + id, { id, t: Date.now(), de: conta.id, deNome: conta.nome, deTag: conta.tag, deUid: conta.uid || '', alvoNome: txt(b.nome, 24) || (alvo ? alvo.nome : ''), alvoTag: tag, alvoId: alvo ? alvo.id : '', alvoUid: alvo ? alvo.uid || '' : '', motivo, estado: 'aberta' });
    this.equipeMudou(); await this.fbNovos(true);
    return resposta({ ok: true });
  }
  async feedback(conta, b) {
    if (!this.hub.limitar('fb:' + conta.id, 5, 3600000)) return erro('Muitos feedbacks seguidos. Tente mais tarde.', 429);
    const texto = txt(b.texto, 2000); if (texto.length < 3) return erro('Escreva o seu feedback.');
    const id = novoId();
    const tipo = ['ideia', 'bug', 'elogio', 'outro'].includes(b.tipo) ? b.tipo : 'outro';
    // (0.8.1) no bug, o relatório de diagnóstico do app vai junto (a pessoa pode desmarcar; o relatório não tem senha nem token)
    const diag = tipo === 'bug' && typeof b.diag === 'string' ? b.diag.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 30000) : '';
    // (0.8.2) no bug, onde foi (chat, transmissão, interface, conexão ou outros); e os anexos que a pessoa subiu antes (feedback/anexo)
    const sub = tipo === 'bug' && SUBS_BUG.includes(b.sub) ? b.sub : '';
    const anexos = [];
    for (const a of (Array.isArray(b.anexos) ? b.anexos : []).slice(0, MAX_ANEXOS_FB)) {
      const aid = String(a || ''); if (!/^[0-9a-f]{16}$/.test(aid)) continue;
      const meta = await this.get('fbm:' + aid);
      if (!meta || meta.de !== conta.id || meta.usado) continue;
      meta.usado = true; await this.st.put('fbm:' + aid, meta);
      anexos.push({ id: aid, mime: meta.mime, nome: meta.nome, tam: meta.tam });
    }
    await this.st.put('fb:' + id, { id, t: Date.now(), de: conta.id, deNome: conta.nome, deTag: conta.tag, deUid: conta.uid || '', texto, tipo, estado: 'aberto', lido: false, ...(sub ? { sub } : {}), ...(anexos.length ? { anexos } : {}), ...(diag ? { diag } : {}) });
    this.equipeMudou();
    return resposta({ ok: true });
  }
  // (0.8.2) um anexo do feedback: os bytes (foto, GIF, áudio ou vídeo, até 25 MB) chegam antes, a mensagem cita o id
  async subirAnexoFb(conta, request) {
    if (!this.hub.limitar('fba:' + conta.id, 12, 3600000)) return erro('Muitos arquivos seguidos. Tente mais tarde.', 429);
    const mime = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!/^(image|video|audio)\/[a-z0-9.+-]{1,40}$/.test(mime) || mime === 'image/svg+xml') return erro('Só fotos, GIFs, áudios e vídeos.', 415);
    const dados = new Uint8Array(await request.arrayBuffer());
    if (!dados.length) return erro('Arquivo vazio.');
    if (dados.length > MAX_ANEXO_FB) return erro('Arquivo grande demais (máximo 25 MB).', 413);
    let nome = ''; try { nome = decodeURIComponent(request.headers.get('X-Nome') || ''); } catch (_) { /* ok */ }
    const id = novoId(), partes = Math.ceil(dados.length / PEDACO_FB), grava = {};
    for (let i = 0; i < partes; i++) grava['fbd:' + id + ':' + i] = dados.slice(i * PEDACO_FB, (i + 1) * PEDACO_FB);
    grava['fbm:' + id] = { de: conta.id, mime, nome: txt(nome, 80), tam: dados.length, partes, t: Date.now() };
    await this.st.put(grava);
    return resposta({ id, tam: dados.length });
  }
  async apagarAnexosFb(anexos) {
    for (const a of anexos || []) { const meta = await this.get('fbm:' + a.id); if (!meta) continue; const ks = ['fbm:' + a.id]; for (let i = 0; i < meta.partes; i++) ks.push('fbd:' + a.id + ':' + i); await this.st.delete(ks); }
  }
  async listar(prefixo) {
    const m = await this.st.list({ prefix: prefixo, limit: 500 });
    const lista = [...m.values()].sort((a, b) => b.t - a.t);
    return resposta({ itens: lista });
  }
  async responder(prefixo, b, denuncia) {
    const k = prefixo + String(b.id || ''), r = await this.get(k);
    if (!r) return erro('Não encontrado.', 404);
    const texto = txt(b.texto, 1000);
    r.resposta = { texto, banido: denuncia ? !!b.banido : undefined, t: Date.now() }; r.estado = 'respondida';
    await this.st.put(k, r);
    const cab = denuncia ? 'Sobre a sua denúncia de ' + (r.alvoNome || '#' + r.alvoTag) + ': ' + (b.banido ? 'a conta denunciada foi punida. ' : 'analisamos e, por enquanto, ninguém foi punido. ') : 'Resposta ao seu feedback: ';
    await this.avisar(r.de, cab + (texto || 'Obrigado por ajudar o Aero!'), denuncia ? 'denuncia' : 'feedback', k);
    this.equipeMudou();
    return resposta({ ok: true, item: r });
  }
}
