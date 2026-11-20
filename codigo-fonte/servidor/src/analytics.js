// Aero Stream - analytics (só o desenvolvedor vê, na aba Desenvolvedor): quantas contas existem, quantas pessoas estão online agora,
// quantas usaram o app nas últimas 24 h / 7 / 30 dias e o pico de pessoas online a cada hora.
//  - "Online" = contas com o app aberto (o WebSocket do Hub). Várias janelas/aparelhos da mesma conta contam como UMA pessoa.
//  - Guardado no armazenamento do Hub (nada sai do servidor e nada identifica ninguém):
//      an:contas         total de contas (contado uma vez de todas as contas que já existiam; depois soma a cada conta nova)
//      an:nh:<hora>      contas criadas naquela hora
//      an:h:<hora>       { p: pico online, u: pessoas diferentes online, f: online na última mudança }
//      an:v:<conta>      { t: a última vez (ms) que a conta esteve online, d: os dias (de Brasília) em que ela usou o app, até 400 }
//                        (as "ativas" de 24 h / 7 / 30 dias e quantas pessoas diferentes usaram num período qualquer)
//      an:desde          quando o registro começou
//  - Enquanto tem alguém online, um alarme na virada de cada hora abre a hora nova (quem continua online conta nela também).
// Criado por Ryan Victtor.
const HORA = 3600000, DIA = 24 * HORA, FUSO = 3 * HORA; // os dias são contados no horário de Brasília
const dia = (ms) => Math.floor((ms - FUSO) / DIA);
const visto = (v) => (typeof v === 'number' ? { t: v, d: [dia(v)] } : v || { t: 0, d: [] }); // (o começo guardava só o número)

export class Analytics {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; this.agora = () => Date.now(); this.ultimo = null; this.cacheVistos = null; }

  // quem está online agora: conta -> o "melhor" estado entre os aparelhos dela ('online' ganha de 'ausente'/'ocupado' e de 'invisivel')
  online(exceto) {
    const m = new Map();
    for (const ws of this.hub.ctx.getWebSockets()) {
      if (ws === exceto) continue;
      let a; try { a = ws.deserializeAttachment(); } catch (_) { continue; }
      if (!a || !a.conta) continue;
      const e = a.estado || 'online', era = m.get(a.conta);
      if (!era || e === 'online' || (era === 'invisivel' && e !== 'invisivel')) m.set(a.conta, e);
    }
    return m;
  }
  contagem(m, aparelhos) {
    let ativos = 0; for (const e of m.values()) if (e === 'online') ativos++;
    return { total: m.size, ativos, ausentes: m.size - ativos, aparelhos };
  }

  // alguém entrou, saiu ou mudou de estado. conta: quem entrou (só ele é conferido como "pessoa nova nesta hora"); todos: a hora virou
  async marcar({ conta, exceto, todos } = {}) {
    const agora = this.agora(), H = Math.floor(agora / HORA), D = dia(agora), on = this.online(exceto), n = on.size;
    if (!(await this.st.get('an:desde'))) await this.st.put('an:desde', agora);
    const chave = 'an:h:' + H, b = (await this.st.get(chave)) || { p: 0, u: 0, f: 0 }, antes = JSON.stringify(b);
    const conferir = todos ? [...on.keys()] : conta && on.has(conta) ? [conta] : [];
    const grava = {};
    for (const id of conferir) {
      const v = visto(await this.st.get('an:v:' + id));
      if (Math.floor(v.t / HORA) === H) continue;
      b.u++;
      grava['an:v:' + id] = { t: agora, d: v.d[v.d.length - 1] === D ? v.d : [...v.d, D].slice(-400) };
    }
    b.p = Math.max(b.p, n); b.f = n;
    if (JSON.stringify(b) !== antes) grava[chave] = b;
    if (Object.keys(grava).length) { await this.st.put(grava); this.cacheVistos = null; }
    // ao vivo para o desenvolvedor (só quando o número muda)
    const c = this.contagem(on, this.hub.ctx.getWebSockets().filter((w) => w !== exceto).length), sig = c.total + '/' + c.ativos;
    if (sig !== this.ultimo) {
      this.ultimo = sig;
      for (const ws of this.hub.ctx.getWebSockets('dev')) { if (ws === exceto) continue; try { ws.send(JSON.stringify({ tipo: 'analytics-online', online: c, t: agora })); } catch (_) { /* ok */ } }
    }
    if (n) await this.agendar(H);
  }
  async agendar(H) {
    const quando = (H + 1) * HORA + 2000;
    try { const ja = await this.st.getAlarm(); if (ja && ja <= quando) return; await this.st.setAlarm(quando); } catch (_) { /* ok */ }
  }
  // o alarme do Hub (na virada da hora): quem continua online conta na hora nova
  async hora() { await this.marcar({ todos: true }); }

  async novaConta() {
    if ((await this.st.get('an:contas')) == null) { await this.contas(); return; } // 1ª vez: a contagem das antigas já inclui esta
    const H = Math.floor(this.agora() / HORA);
    const n = (await this.st.get('an:contas')) || 0, nh = (await this.st.get('an:nh:' + H)) || 0;
    await this.st.put({ 'an:contas': n + 1, ['an:nh:' + H]: nh + 1 });
  }
  // total de contas. Na primeira vez, conta as que já existiam (e a hora em que cada uma foi criada, para as "contas novas" de qualquer período)
  async contas() {
    const n = await this.st.get('an:contas');
    if (n != null) return n;
    let total = 0, depois; const porHora = {};
    for (;;) {
      const pag = await this.st.list({ prefix: 'c:', limit: 200, ...(depois ? { startAfter: depois } : {}) });
      for (const [k, c] of pag) { depois = k; if (!c || !c.id) continue; total++; if (c.criado > 0) { const H = 'an:nh:' + Math.floor(c.criado / HORA); porHora[H] = (porHora[H] || 0) + 1; } }
      if (pag.size < 200) break;
    }
    const chaves = Object.keys(porHora);
    for (let i = 0; i < chaves.length; i += 100) await this.st.put(Object.fromEntries(chaves.slice(i, i + 100).map((k) => [k, porHora[k]])));
    await this.st.put('an:contas', total);
    return total;
  }

  // todas as contas que já usaram o app (desde o começo do registro): [{ id, t, d }]. Guardado por 1 minuto.
  async vistos() {
    const agora = this.agora();
    if (this.cacheVistos && agora - this.cacheVistos.t < 60000) return this.cacheVistos.l;
    const l = []; let depois;
    for (;;) {
      const pag = await this.st.list({ prefix: 'an:v:', limit: 1000, ...(depois ? { startAfter: depois } : {}) });
      for (const [k, v] of pag) { depois = k; l.push({ id: k.slice(5), ...visto(v) }); }
      if (pag.size < 1000) break;
    }
    this.cacheVistos = { t: agora, l };
    return l;
  }
  // as horas guardadas entre duas horas (inclusive): Map hora -> valor (só as que existem; as chaves têm o mesmo número de dígitos)
  async horas(prefixo, H0, H1) {
    const m = new Map();
    const l = await this.st.list({ prefix: prefixo, start: prefixo + H0, end: prefixo + (H1 + 1) });
    for (const [k, v] of l) { const h = +k.slice(prefixo.length); if (h >= H0 && h <= H1) m.set(h, v); }
    return m;
  }

  // o resumo: números de agora + um período [de, ate) escolhido no app (até 400 dias). Até 3 dias: hora a hora; mais que isso: dia a dia.
  // fuso: o getTimezoneOffset() do app (minutos), para os dias do gráfico baterem com o relógio de quem olha.
  async resumo({ de, ate, fuso } = {}) {
    const contas = await this.contas(); // (na 1ª vez conta as antigas e quando foram criadas)
    const agora = this.agora(), on = this.online(), Hagora = Math.floor(agora / HORA);
    ate = Math.min(+ate || agora, agora + HORA); de = de == null || !Number.isFinite(+de) ? ate - 7 * DIA : +de;
    if (!(de < ate)) de = ate - DIA;
    de = Math.max(de, ate - 400 * DIA);
    fuso = Math.max(-840, Math.min(840, Math.round(+fuso) || 0)) * 60000;
    const H0 = Math.floor(de / HORA), H1 = Math.floor((ate - 1) / HORA);
    const [hs, nhs, vs] = await Promise.all([this.horas('an:h:', H0, H1), this.horas('an:nh:', H0, H1), this.vistos()]);
    const porHora = ate - de <= 3 * DIA + HORA;
    const serie = [], idx = new Map();
    for (let h = H0; h <= H1; h++) {
      const t = porHora ? h * HORA : Math.floor((h * HORA - fuso) / DIA) * DIA + fuso; // o começo da hora ou do dia (no relógio do app)
      let x = idx.get(t);
      if (!x) { x = { t, p: 0, u: 0, novas: 0 }; idx.set(t, x); serie.push(x); }
      const b = hs.get(h); if (b) { x.p = Math.max(x.p, b.p); if (porHora) x.u = b.u; }
      x.novas += nhs.get(h) || 0;
      if (h === Hagora) x.p = Math.max(x.p, on.size);
    }
    // pessoas diferentes: por dia (dias de Brasília) e no período inteiro
    const D0 = dia(de), D1 = dia(ate - 1);
    let pessoas = 0;
    const ativas = { d1: 0, d7: 0, d30: 0, total: vs.length };
    const porDia = new Map();
    for (const v of vs) {
      const t = on.has(v.id) ? agora : v.t, d = agora - t;
      if (d < DIA) ativas.d1++; if (d < 7 * DIA) ativas.d7++; if (d < 30 * DIA) ativas.d30++;
      const dias = on.has(v.id) && v.d[v.d.length - 1] !== dia(agora) ? [...v.d, dia(agora)] : v.d;
      let usou = false;
      for (const x of dias) if (x >= D0 && x <= D1) { usou = true; porDia.set(x, (porDia.get(x) || 0) + 1); }
      if (usou) pessoas++;
    }
    if (!porHora) for (const x of serie) x.u = porDia.get(dia(x.t + 12 * HORA)) || 0; // (o meio do dia: não importa o fuso de quem olha)
    const pico = serie.reduce((m, x) => (x.p > m.p ? { p: x.p, t: x.t } : m), { p: 0, t: 0 });
    return {
      agora, desde: (await this.st.get('an:desde')) || agora,
      contas, online: this.contagem(on, this.hub.ctx.getWebSockets().length), ativas,
      periodo: { de, ate, grao: porHora ? 'hora' : 'dia', pessoas, novas: serie.reduce((s, x) => s + x.novas, 0), pico, serie },
    };
  }
}
