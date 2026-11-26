// (0.9.1) Notificações push: avisam de mensagem nova quando o Aero está fechado.
// - O servidor nunca guarda nem manda o texto (as mensagens são cifradas): só "quem mandou" e "em qual conversa", por no máximo 3 dias.
// - Cada aparelho ganha um token próprio de push, guardado só como SHA-256 e preso à sessão: sair da conta (ou derrubar a sessão) mata o push.
// - Navegador/site instalado: Web Push com VAPID e SEM conteúdo (o aviso só acorda o app, que busca as novidades com o token dele).
// - App do Android: o próprio app pergunta as novidades em segundo plano com o mesmo token.
import { resposta, erro, hex } from './util.js';

const MAX_AVISOS = 30, VIDA_AVISO = 3 * 24 * 3600e3, MAX_APARELHOS = 10;
// só os serviços de push de verdade (o servidor não faz pedido para endereço qualquer)
const HOSTS_PUSH = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]*push\.apple\.com)$/;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha = async (s) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));

export class Push {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }

  async chaves() {
    if (this._ch) return this._ch;
    let j = await this.st.get('vapid');
    if (!j) {
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      j = { priv: await crypto.subtle.exportKey('jwk', par.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', par.publicKey)) };
      await this.st.put('vapid', j);
    }
    this._ch = { pub: j.pub, priv: await crypto.subtle.importKey('jwk', j.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
    return this._ch;
  }

  async jwt(aud) {
    const ch = await this.chaves(), enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
    const corpo = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://web.aerostream.workers.dev' });
    const ass = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, ch.priv, new TextEncoder().encode(corpo));
    return corpo + '.' + b64u(ass);
  }

  // (1.0.3) o push do Google para o app do Android: a conta de serviço do Firebase (segredo FCM_CONTA, JSON) vira um acesso de 1 h
  async fcmAcesso() {
    const env = this.hub.env || {};
    if (!env.FCM_CONTA) return null;
    if (this._fcm && this._fcm.ate > Date.now() + 60000) return this._fcm;
    let sa; try { sa = JSON.parse(env.FCM_CONTA); } catch (_) { return null; }
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o))), agora = Math.floor(Date.now() / 1000);
    const corpo = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 });
    const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    const ch = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const jwt = corpo + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', ch, new TextEncoder().encode(corpo)));
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    if (!d.access_token) return null;
    this._fcm = { tk: d.access_token, pid: sa.project_id, ate: Date.now() + (Math.max(300, +d.expires_in || 3600) * 1000) };
    return this._fcm;
  }
  // um toque vazio (k: 'n' = chegou mensagem, 'l' = leram em outro aparelho): o app pergunta as novidades com o token dele
  async fcmTocar(contaId, k, ap, tipo) {
    try {
      const a = await this.fcmAcesso(); if (!a) return;
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.pid}/messages:send`, { method: 'POST', headers: { Authorization: 'Bearer ' + a.tk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: ap.f, data: { k: tipo }, android: { priority: tipo === 'n' ? 'HIGH' : 'NORMAL', ttl: tipo === 'n' ? '86400s' : '3600s', ...(tipo === 'l' ? { collapse_key: 'lidas' } : {}) } } }) });
      if (r.status === 404 || r.status === 400) { const x = await this.st.get(k); if (x && x.f === ap.f) { delete x.f; await this.st.put(k, x); } } // o token morreu (app desinstalado)
      else if (r.status === 401) this._fcm = null;
    } catch (_) { /* fica a checagem de tempos em tempos */ }
  }

  // rota sem login: o aparelho (ou o service worker) pergunta as novidades com o token de push dele
  async rotaPublica(rota, b, ip) {
    if (rota === 'push/fundo') return this.fundo(b, ip);
    if (rota === 'push/fcm') return this.guardarFcm(b, ip);
    if (rota !== 'push/novas') return null;
    if (!this.hub.limitar('pushn:' + ip, 40, 60000)) return erro('Devagar!', 429);
    const t = typeof b.t === 'string' && /^[A-Za-z0-9]{40}$/.test(b.t) ? b.t : '';
    if (!t) return resposta({ fim: true });
    const k = 'pt:' + (await sha(t)), ap = await this.st.get(k);
    if (!ap) return resposta({ fim: true });
    if (!(await this.st.get(ap.s))) { await this.tirar(ap.c, k); return resposta({ fim: true }); } // a sessão acabou: o push acaba junto
    // (1.0.2) os avisos do mesmo milissegundo da última busca que ela ainda não tinha (ap.vn: os que ela já mandou) também vêm
    const de0 = ap.desde || 0, vn = ap.vn || [];
    const lista = ((await this.st.get('pn:' + ap.c)) || []).filter((x) => (x.t >= de0 || (x.t === de0 - 1 && !vn.includes(x.cid))) && Date.now() - x.t < VIDA_AVISO);
    // (1.0.2) as conversas lidas em outro aparelho desde a última pergunta: este aparelho tira a notificação delas
    const pl = (await this.st.get('pl:' + ap.c)) || {}, desde = ap.ultima || 0;
    // (as lidas no mesmo milissegundo da última busca já foram mandadas nela: ap.lv guarda quais, para não mandar de novo)
    const lidas = Object.keys(pl).filter((cid) => (pl[cid] > desde || (pl[cid] === desde && !(ap.lv || []).includes(cid))) && !lista.some((x) => x.cid === cid && x.t > pl[cid]));
    const agora = Date.now(); ap.desde = agora + 1; ap.ultima = agora; ap.lv = Object.keys(pl).filter((cid) => pl[cid] === agora).slice(0, 30); if (!ap.lv.length) delete ap.lv;
    ap.vn = lista.filter((x) => x.t === agora).map((x) => x.cid).slice(0, 30); if (!ap.vn.length) delete ap.vn; await this.st.put(k, ap);
    return resposta({ novas: lista.slice(-15), lidas: lidas.slice(0, 30) });
  }

  async rota(conta, rota, metodo, b, chaveSessao) {
    if (rota === 'push/chave' && metodo === 'GET') return resposta({ chave: (await this.chaves()).pub });
    if (rota === 'push/registrar' && metodo === 'POST') {
      if (!this.hub.limitar('pushr:' + conta.id, 10, 3600e3)) return erro('Devagar!', 429);
      let w = null;
      if (b.web && typeof b.web.endpoint === 'string' && b.web.endpoint.length < 1000) {
        try { const u = new URL(b.web.endpoint); if (u.protocol === 'https:' && HOSTS_PUSH.test(u.hostname)) w = u.href; } catch (_) { /* inválido */ }
        if (!w) return erro('Endereço de push inválido.');
      }
      if (typeof b.antigo === 'string' && /^[A-Za-z0-9]{40}$/.test(b.antigo)) await this.tirar(conta.id, 'pt:' + (await sha(b.antigo)));
      const t = Array.from(crypto.getRandomValues(new Uint8Array(40)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[x % 56]).join('');
      const k = 'pt:' + (await sha(t));
      let l = ((await this.st.get('pd:' + conta.id)) || []);
      while (l.length >= MAX_APARELHOS) { const v = l.shift(); await this.st.delete(v); }
      l.push(k);
      await this.st.put({ [k]: { c: conta.id, s: chaveSessao, w, desde: Date.now() }, ['pd:' + conta.id]: l });
      return resposta({ t });
    }
    if (rota === 'push/sair' && metodo === 'POST') {
      if (typeof b.t === 'string' && /^[A-Za-z0-9]{40}$/.test(b.t)) await this.tirar(conta.id, 'pt:' + (await sha(b.t)));
      return resposta({ ok: true });
    }
    return null;
  }

  // (0.9.5) o próprio Android avisa que o app foi para o fundo (ou voltou), sem depender da página: ela é congelada logo depois e a
  // conexão continua parecendo viva, então o servidor achava que o app estava na tela e não guardava o aviso
  async fundo(b, ip) {
    if (!this.hub.limitar('pushf:' + ip, 60, 60000)) return erro('Devagar!', 429);
    const t = typeof b.t === 'string' && /^[A-Za-z0-9]{40}$/.test(b.t) ? b.t : '';
    if (!t) return resposta({ fim: true });
    const k = 'pt:' + (await sha(t)), ap = await this.st.get(k);
    if (!ap) return resposta({ fim: true });
    const em = Number.isFinite(b.em) ? b.em : Date.now();
    if (em < (ap.foraEm || 0)) return resposta({ ok: true }); // chegou depois de um aviso mais novo deste aparelho
    ap.fora = b.sim === true ? Date.now() : 0; ap.foraEm = em; await this.st.put(k, ap);
    return resposta({ ok: true });
  }

  // (1.0.3) o app do Android entrega o token do push do Google, preso ao token de push dele (sem login: o token já é a prova)
  async guardarFcm(b, ip) {
    if (!this.hub.limitar('pushg:' + ip, 20, 60000)) return erro('Devagar!', 429);
    const t = typeof b.t === 'string' && /^[A-Za-z0-9]{40}$/.test(b.t) ? b.t : '';
    const f = typeof b.f === 'string' && /^[A-Za-z0-9_:-]{20,400}$/.test(b.f) ? b.f : '';
    if (!t || !f) return erro('Inválido.');
    const k = 'pt:' + (await sha(t)), ap = await this.st.get(k);
    if (!ap || !(await this.st.get(ap.s))) return resposta({ fim: true });
    if (ap.f !== f) { ap.f = f; await this.st.put(k, ap); }
    return resposta({ ok: true });
  }

  async tirar(contaId, k) {
    await this.st.delete(k);
    const l = (await this.st.get('pd:' + contaId)) || [];
    if (l.includes(k)) await this.st.put('pd:' + contaId, l.filter((x) => x !== k));
  }

  // (1.0.2) a conversa foi lida (em qualquer aparelho): os avisos dela que ainda não foram buscados somem, e os aparelhos que já mostraram
  // a notificação fecham ela na próxima vez que perguntarem. Uma leitura só do que já existe: sem aviso pendente, não grava nada
  async lida(contaId, cid) {
    const av = (await this.st.get('pn:' + contaId)) || [], agora = Date.now();
    if (!av.some((x) => x.cid === cid)) return; // nenhum aviso dessa conversa: nenhum aparelho mostrou notificação dela
    const pl = (await this.st.get('pl:' + contaId)) || {};
    const resto = av.filter((x) => x.cid !== cid && agora - x.t < VIDA_AVISO);
    for (const [c, t] of Object.entries(pl)) if (agora - t > VIDA_AVISO) delete pl[c];
    pl[cid] = agora;
    const ks = Object.keys(pl); if (ks.length > 40) for (const c of ks.sort((a, b) => pl[a] - pl[b]).slice(0, ks.length - 40)) delete pl[c];
    await this.st.put({ ['pn:' + contaId]: resto, ['pl:' + contaId]: pl });
    // (1.0.3) os celulares com o push do Google tiram a notificação na hora (antes, só na próxima checagem)
    const envios = [];
    for (const k of (await this.st.get('pd:' + contaId)) || []) { const ap = await this.st.get(k); if (ap && ap.f) envios.push(this.fcmTocar(contaId, k, ap, 'l')); }
    if (envios.length) { const p = Promise.all(envios); try { this.hub.ctx.waitUntil(p); } catch (_) { await p; } }
  }

  // mensagem nova: vai para cada aparelho com push que não está com o Aero na tela agora (fechado, no fundo ou sem conexão)
  async avisar(contaId, item) {
    const l = (await this.st.get('pd:' + contaId)) || [];
    if (!l.length) return;
    const agora = Date.now(), naTela = new Set();
    for (const w of this.hub.ctx.getWebSockets('c:' + contaId)) { let a = null; try { a = w.deserializeAttachment(); } catch (_) { /* ok */ } if (a && a.sid && !a.fundo) naTela.add(a.sid); }
    const longe = [];
    for (const k of l) {
      const ap = await this.st.get(k); if (!ap) continue;
      const ss = await this.st.get(ap.s); if (!ss) continue;
      if (ss.sid && naTela.has(ss.sid) && !ap.fora) { if ((ap.desde || 0) <= agora) { ap.desde = agora + 1; await this.st.put(k, ap); } continue; } // já viu dentro do app
      longe.push([k, ap]);
    }
    if (!longe.length) return;
    const av = ((await this.st.get('pn:' + contaId)) || []).filter((x) => agora - x.t < VIDA_AVISO);
    av.push({ ...item, t: agora });
    await this.st.put('pn:' + contaId, av.slice(-MAX_AVISOS));
    const envios = [];
    for (const [k, ap] of longe) {
      if (ap.f) envios.push(this.fcmTocar(contaId, k, ap, 'n')); // (1.0.3) o app do Android, na hora
      if (!ap.w) continue;
      envios.push((async () => {
        try {
          const u = new URL(ap.w), jwt = await this.jwt(u.origin), pub = (await this.chaves()).pub;
          const r = await fetch(ap.w, { method: 'POST', headers: { Authorization: `vapid t=${jwt}, k=${pub}`, TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
          if (r.status === 404 || r.status === 410) await this.tirar(contaId, k); // a inscrição morreu
        } catch (_) { /* tenta na próxima */ }
      })());
    }
    if (envios.length) { const p = Promise.all(envios); try { this.hub.ctx.waitUntil(p); } catch (_) { await p; } }
  }
}
