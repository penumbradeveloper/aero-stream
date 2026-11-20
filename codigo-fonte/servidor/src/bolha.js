// Aero Stream - (0.7.14) AERO BUBBLE: a assinatura de quem apoia o app (é mais um apoio do que uma compra). Quatro planos:
//   Standard Patreon (R$ 10): anexos de até 100 MB e grupos (que você é dono ou admin) de até 15 pessoas
//   Plus Patreon     (R$ 15): anexos de até 250 MB e grupos de até 25 pessoas
//   Donator          (R$ 25): anexos de até 500 MB, grupos de até 30 pessoas, transmitir até 1440p 60 fps (120 fps até 1080p), o efeito de
//                             nome Diamante, a insígnia e a animação do perfil
//   Supporter        (R$ 50): tudo do Donator, e mais: anexos de até 1 GB, grupos de até 40 pessoas, até 10 chats e 5 chamadas de voz em cada
//                             grupo, transmissão sem limite (até 4K e 240 fps), a insígnia de coração, as integrações da comunidade, 5 perfis
//                             salvos para trocar num clique e as versões e novidades em teste antes de todo mundo (para testar e mandar opinião)
// Sem plano: anexos de até 10 MB, grupos de até 10 pessoas, 5 chats e 3 chamadas de voz por grupo e transmissão até 1080p 60 fps.
// tx: o teto da transmissão (0 até 1080p 60; 1 até 1440p 60 e 120 fps até 1080p; 2 sem limite)
// Como o plano chega na conta:
//  - Ko-fi (cartão/PayPal): o Ko-fi avisa o servidor a cada pagamento de assinatura (webhook /api/bolha/kofi, conferido pelo token secreto
//    KOFI_TOKEN). A conta é achada pelo e-mail do pagamento (comparado pelo HMAC, como no resto do servidor) ou pela # escrita na mensagem.
//  - (0.7.14) MERCADO PAGO, em reais: PIX (QR Code / copia e cola, vale 1 mês) ou cartão (assinatura que renova sozinha todo mês).
//    A cobrança nasce aqui, já com a conta na "referência" (aero.<id da conta>.<plano>.<aleatório>), então não depende de e-mail igual.
//    O aviso (webhook /api/bolha/mp) é só um "olhe o pagamento X": o servidor SEMPRE busca o pagamento no Mercado Pago com a própria chave
//    (MP_TOKEN) e confere status, moeda, valor e referência; um aviso falso não libera nada. Se MP_SEGREDO existir, a assinatura do aviso
//    (x-signature, HMAC) também é conferida. O app ainda pergunta pelo PIX a cada poucos segundos (bolha/pix/<id>), então funciona mesmo
//    se o aviso atrasar. Guardado aqui: só o número do pagamento (para não contar duas vezes) e o número da assinatura do cartão (para
//    cancelar). E-mail, CPF e cartão ficam no Mercado Pago.
//  - Outro jeito: o desenvolvedor dá o plano pela aba Moderação (admin/bolha).
// Cada pagamento vale 31 dias + 4 de folga (o Ko-fi cobra todo mês). Criado por Ryan Victtor.
import { resposta, erro, txt, normalizarTag } from './util.js';

const MB = 1024 * 1024, DIA = 86400000;
export const PLANOS = {
  standard: { nome: 'Standard Patreon', preco: 10, anexo: 100 * MB, grupo: 15, alta: false, tx: 0, chats: 5, voz: 3 },
  plus: { nome: 'Plus Patreon', preco: 15, anexo: 250 * MB, grupo: 25, alta: false, tx: 0, chats: 5, voz: 3 },
  donator: { nome: 'Donator', preco: 25, anexo: 500 * MB, grupo: 30, alta: true, tx: 1, chats: 5, voz: 3, exclusivo: true },
  supporter: { nome: 'Supporter', preco: 50, anexo: 1024 * MB, grupo: 40, alta: true, tx: 2, chats: 10, voz: 5, exclusivo: true, integracoes: true, modelos: 5, testes: true },
};
export const BASE = { anexo: 10 * MB, grupo: 10, alta: false, tx: 0, chats: 5, voz: 3 };
export const MAX_GRUPO_TETO = Math.max(...Object.values(PLANOS).map((p) => p.grupo));
export const VALIDADE = 35 * DIA;
const MAX_PRESENTE = 20;
const MESES_ANUAL_PAGOS = 10, DIAS_ANUAL = 12 * 31 + 4; // (1.0.0) // (0.8.2) amigos num presente só

// o plano que vale agora ('' sem plano ou vencido)
export const planoDe = (conta) => { const b = conta && conta.bolha; return b && PLANOS[b.plano] && (!b.ate || b.ate > Date.now()) ? b.plano : ''; };
// (1.0.0) fidelidade: meses seguidos no plano de agora (o "desde" volta a zero quando o plano muda, ou quando vence e passa 1 semana sem renovar)
export const CARENCIA_FIEL = 7 * DIA;
// a sequência ainda vale: o plano está ativo, ou venceu há menos de 1 semana (esperando a pessoa renovar)
const sequenciaViva = (conta) => { const b = conta && conta.bolha; return !!(b && b.desde && PLANOS[b.plano] && (planoDe(conta) || (b.ate && Date.now() - b.ate < CARENCIA_FIEL))); };
export const mesesSeguidos = (conta) => (planoDe(conta) && conta.bolha.desde ? Math.floor((Date.now() - conta.bolha.desde) / (30 * DIA)) : 0);
// o selo que evolui: 1, 2, 3 e 6 meses; depois 1, 2, 3, 4, 5, 7, 8, 9 e 10 anos seguidos (os anos contam em anos de verdade, 365 dias).
// O id é "fiel" + meses (fiel12 = 1 ano, fiel120 = 10 anos), então os que já existiam (fiel3, fiel6, fiel12) continuam iguais
const FIEL_ANOS = [10, 9, 8, 7, 5, 4, 3, 2, 1], FIEL_MESES = [6, 3, 2, 1];
export const seloFiel = (conta) => {
  if (!sequenciaViva(conta)) return ''; // na semana depois de vencer o selo continua (esperando renovar); depois some e a contagem zera
  const m = Math.floor((Date.now() - conta.bolha.desde) / (30 * DIA)); if (!m) return '';
  const anos = Math.floor((Date.now() - conta.bolha.desde) / (365 * DIA)), a = FIEL_ANOS.find((x) => anos >= x);
  if (a) return 'fiel' + a * 12;
  const n = FIEL_MESES.find((x) => m >= x); return n ? 'fiel' + n : '';
};
// o Supporter ganha 1 mês de Standard para dar a um amigo a cada 3 meses seguidos
export const presentesFiel = (conta) => { const b = conta && conta.bolha; if (planoDe(conta) !== 'supporter' || !b) return 0; const usados = b.fielDe === b.desde ? b.fielUsados || 0 : 0; return Math.max(0, Math.floor(mesesSeguidos(conta) / 3) - usados); };
export const limitesDe = (conta) => { const p = planoDe(conta); if (conta && conta.dev) return { ...PLANOS.supporter, plano: p }; return p ? { plano: p, ...PLANOS[p] } : { plano: '', ...BASE }; }; // (0.8.1) desenvolvedor: tudo liberado, o plano continua o de verdade
// o que o app da pessoa recebe (sem preço nem origem)
// r2: o servidor tem onde guardar arquivos grandes (sem isso, o limite de anexo continua 10 MB para todo mundo)
export const publicoBolha = (conta, r2 = true) => { const l = limitesDe(conta); return { plano: l.plano, ate: l.plano ? conta.bolha.ate || 0 : 0, anexo: r2 ? l.anexo : Math.min(l.anexo, BASE.anexo), grupo: l.grupo, alta: l.alta, tx: l.tx, chats: l.chats, voz: l.voz, exclusivo: !!l.exclusivo, integracoes: !!l.integracoes, modelos: l.modelos || 0, testes: !!l.testes, nivel: conta && conta.dev ? 4 : ({ standard: 1, plus: 2, donator: 3, supporter: 4 })[l.plano] || 0 }; }; // (1.0.0) nivel: os extras de cada plano (extras.js)

// nome do plano que veio do Ko-fi (o nome da assinatura) -> chave
const planoDoNome = (n) => { const s = String(n || '').toLowerCase(); return /support/.test(s) ? 'supporter' : /donat/.test(s) ? 'donator' : /plus/.test(s) ? 'plus' : /standa?r[td]|patreon/.test(s) ? 'standard' : ''; };
// comparar o token sem dar pistas pelo tempo
function igual(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0 && a.length > 0; }

const MP = 'https://api.mercadopago.com';
const REF = /^aero\.([0-9a-f-]{36})\.(standard|plus|donator|supporter)\.([0-9a-f]{8})$/;
const emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,}$/.test(e);
const hexDe = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const aleatorio = () => hexDe(crypto.getRandomValues(new Uint8Array(4)));
// horário no formato que o Mercado Pago pede (com o fuso de Brasília)
const dataMP = (t) => new Date(t - 3 * 3600000).toISOString().replace('Z', '-03:00');
// o motivo que o Mercado Pago deu (vai para o registro do servidor: nada de dado da pessoa)
const motivoMP = (d) => { d = d || {}; const c = Array.isArray(d.cause) && d.cause[0] ? d.cause[0] : {}; return String([d.error, d.message, c.code, c.description].filter(Boolean).join(' | ')).slice(0, 300); };
// o PIX que não saiu: diz o porquê quando dá para saber
function erroPix(r) {
  const m = motivoMP(r.d).toLowerCase();
  if (/key enabled|without key|qr render|13253/.test(m)) return 'O PIX do Mercado Pago ainda não está ligado: a conta que recebe precisa de uma chave PIX cadastrada no Mercado Pago. Por enquanto, use o cartão.';
  if (/same user|collector|payer.*(cannot|can not)|cannot pay yourself|2034/.test(m)) return 'Este e-mail é o da conta que recebe os pagamentos. Use outro e-mail para o recibo.';
  if (/email/.test(m)) return 'O Mercado Pago não aceitou este e-mail. Confira e tente de novo.';
  if (r.status === 0 || r.status >= 500) return 'O Mercado Pago não respondeu. Tente de novo em instantes.';
  return 'O Mercado Pago recusou o PIX' + (m ? ' (' + motivoMP(r.d).slice(0, 120) + ')' : '') + '. Tente de novo ou use o cartão.';
}

// (0.8.3) o pagamento foi concluído de verdade? Aprovado, com o dinheiro creditado (não "em análise"), com a data da aprovação e
// sem estorno. Só assim vira plano.
export const concluido = (p) => !!p && p.status === 'approved' && (!p.status_detail || p.status_detail === 'accredited') && !!p.date_approved && +p.transaction_amount > 0 && !(+p.transaction_amount_refunded > 0);
const ESTORNO = ['refunded', 'charged_back'];
// (0.8.3) as moedas do caixa (quanto vale 1 de cada em reais)
const MOEDAS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'ARS', 'MXN', 'CLP', 'COP', 'PEN', 'UYU'];

export class Bolha {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }
  // o que o app recebe: os limites e se dá para pagar pelo Mercado Pago aqui
  publico(conta) {
    const b = conta && conta.bolha, tem = !!planoDe(conta);
    // (0.8.2) desde e origem: a seção "Assinatura" da própria pessoa (desde quando e se veio de presente, PIX ou cartão)
    return { ...publicoBolha(conta, true), mp: !!this.hub.env.MP_TOKEN, cartao: !!(b && b.mp && tem), desde: tem ? b.desde || 0 : 0, origem: tem ? b.origem || '' : '', meses: mesesSeguidos(conta), presentesFiel: presentesFiel(conta), fundador: !!conta.fundador, anual: !!this.hub.env.MP_TOKEN };
  }
  // (0.8.2) tirar o plano (o desenvolvedor): se a pessoa assinava no cartão, a assinatura do Mercado Pago é cancelada junto (senão continuaria cobrando)
  async tirar(conta) {
    const id = conta.bolha && conta.bolha.mp;
    if (id) {
      try { await this.mpApi('/preapproval/' + encodeURIComponent(id), 'PUT', { status: 'cancelled' }); } catch (_) { /* ok */ }
      await this.registrar({ tipo: 'cancelou', plano: conta.bolha.plano, via: 'mp-cartao', conta: conta.id });
    }
    return this.darMs(conta, '', 0, '');
  }
  // (0.8.2) só o desenvolvedor: quem está com um plano que ELE deu (presente ou dado pelo painel), para ver quanto tempo falta
  async ativos() {
    const ids = (await this.tudo('bi:')).map(([k]) => k.slice(3)).filter((x) => x !== 'feito'), out = [];
    for (let i = 0; i < ids.length; i += 64) for (const c of await Promise.all(ids.slice(i, i + 64).map((x) => this.st.get('c:' + x)))) {
      if (c && planoDe(c) && ['presente', 'dev'].includes(c.bolha.origem)) out.push({ nome: c.nome, tag: c.tag || '', uid: c.uid || '', codigo: c.codigo, av: c.avatarV || 0, plano: c.bolha.plano, ate: c.bolha.ate || 0, desde: c.bolha.desde || 0, origem: c.bolha.origem || '', cartao: !!c.bolha.mp });
    }
    return out.sort((a, b) => (a.ate || Infinity) - (b.ate || Infinity) || a.nome.localeCompare(b.nome)); // quem acaba antes, primeiro
  }
  // (0.8.2) só o desenvolvedor, no perfil de alguém: o plano, se renova no cartão ou foi cancelado, por onde pagou e os últimos pagamentos
  async resumoDev(conta) {
    const b = conta.bolha || {}, plano = planoDe(conta);
    const evs = (await this.tudo('pg:')).map(([, v]) => v).filter((v) => v && v.conta === conta.id).sort((x, y) => y.t - x.t);
    const ultPago = evs.find((v) => v.tipo === 'pago'), ultCancel = evs.find((v) => v.tipo === 'cancelou');
    const cancelou = !!(ultCancel && (!ultPago || ultCancel.t >= ultPago.t) && !b.mp);
    return {
      plano, ate: plano ? b.ate || 0 : 0, desde: plano ? b.desde || 0 : 0, origem: plano ? b.origem || '' : '', venceu: !plano && b.plano ? b.plano : '',
      cartao: !!(b.mp && plano), cancelou: cancelou ? ultCancel.t : 0,
      total: Math.round(evs.filter((v) => v.tipo === 'pago').reduce((s, v) => s + (v.valor || 0), 0) * 100) / 100,
      historico: evs.slice(0, 12).map((v) => ({ t: v.t, tipo: v.tipo, plano: v.plano, valor: v.valor, via: v.via })),
    };
  }

  // dar (ou tirar, plano '') o plano; dias 0 = sem prazo (só pelo desenvolvedor)
  async dar(conta, plano, dias, origem) { return this.darMs(conta, plano, dias > 0 ? Math.min(dias, 3660) * DIA : 0, origem); }
  // (0.8.0) por qualquer tempo (o presente do desenvolvedor: minutos, horas, dias, meses ou anos). ms 0 = sem prazo
  async darMs(conta, plano, ms, origem) {
    if (plano && !PLANOS[plano]) return null;
    if (!plano) delete conta.bolha;
    else {
      // (1.0.0) renovou o mesmo plano até 1 semana depois de vencer: a sequência (o selo de fidelidade) continua de onde parou
      const agora = Date.now(), antes = planoDe(conta) === plano ? conta.bolha.ate || 0 : 0;
      conta.bolha = { plano, ate: ms > 0 ? Math.max(agora, antes) + Math.min(ms, 100 * 366 * DIA) : 0, desde: (conta.bolha && conta.bolha.plano === plano && sequenciaViva(conta) && conta.bolha.desde) || agora, origem: txt(origem, 20), mp: (conta.bolha && conta.bolha.mp) || undefined };
    }
    // (1.0.0) Fundador 1.0: quem é Donator ou Supporter no primeiro mês depois do lançamento da 1.0.0 (a data vem do ambiente); fica para sempre
    const lanc = +this.hub.env.LANCAMENTO_1_0 || 0;
    if (lanc && (plano === 'donator' || plano === 'supporter') && Date.now() >= lanc && Date.now() < lanc + 31 * DIA) conta.fundador = 1;
    await this.st.put('c:' + conta.id, conta);
    if (plano) await this.st.put('bi:' + conta.id, 1); // (0.8.2) quem já teve plano (o painel de assinaturas olha só essas contas)
    // (0.8.3) a insígnia do plano (coroa do Donator, coração do Supporter...) aparece na hora: no próprio app e na lista dos amigos
    const sl = (await this.hub.selos(conta)) || [];
    for (const ws of this.hub.ctx.getWebSockets('c:' + conta.id)) { try { ws.send(JSON.stringify({ tipo: 'bolha', bolha: this.publico(conta), sl })); } catch (_) { /* ok */ } }
    try { await this.hub.mudou([conta.id, ...Object.keys(conta.amigos || {})]); } catch (_) { /* ok */ }
    return conta;
  }
  // (0.8.2) o caixa, só para o painel do desenvolvedor: cada pagamento e cada cancelamento (plano, valor, por onde veio e a conta).
  // Nada de e-mail, nome de quem pagou ou CPF.
  async registrar(ev) {
    const t = ev.t || Date.now();
    await this.st.put('pg:' + String(t).padStart(14, '0') + ':' + aleatorio().slice(0, 6), { t, tipo: ev.tipo, plano: PLANOS[ev.plano] ? ev.plano : '', valor: Math.round((+ev.valor || 0) * 100) / 100, moeda: /^[A-Z]{3}$/.test(ev.moeda || '') ? ev.moeda : 'BRL', via: ev.via, conta: ev.conta || '' });
    if (ev.conta) await this.st.put('bi:' + ev.conta, 1);
  }

  // webhook do Ko-fi: POST application/x-www-form-urlencoded com o campo "data" (JSON). Responde 200 sempre que o token confere (o Ko-fi
  // repete o aviso se não receber 200); o mesmo pagamento duas vezes só conta uma.
  async kofi(request) {
    const segredo = this.hub.env.KOFI_TOKEN;
    if (!segredo) return erro('Não encontrado', 404);
    if (!this.hub.limitar('kofi:' + (request.headers.get('CF-Connecting-IP') || 'x'), 60, 60000)) return erro('Devagar!', 429);
    let d;
    try { const f = await request.formData(); d = JSON.parse(String(f.get('data') || '')); } catch (_) { return erro('Pedido inválido.'); }
    if (!d || !igual(d.verification_token, segredo)) return erro('Não autorizado.', 401);
    const tx = txt(d.kofi_transaction_id || d.message_id, 80);
    if (!tx) return erro('Pedido inválido.');
    if (await this.st.get('kofi:' + tx)) return resposta({ ok: true, repetido: true });
    // (0.8.3) só assinatura paga de verdade (valor maior que zero); quem paga de fora do Brasil paga na moeda dele: o plano pelo valor
    // é achado depois de converter para reais
    const valor = parseFloat(String(d.amount || '').replace(',', '.')) || 0, moeda = /^[A-Za-z]{3}$/.test(String(d.currency || '')) ? String(d.currency).toUpperCase() : 'BRL';
    const assinatura = (d.type === 'Subscription' || d.is_subscription_payment) && valor > 0;
    const plano = assinatura ? planoDoNome(d.tier_name) || this.planoPeloValor(await this.emReais(valor, moeda)) : '';
    let conta = null;
    // (0.8.5) a DOAÇÃO avulsa (e a compra na lojinha) também entra no caixa: antes só a assinatura contava, e uma doação pelo Ko-fi não aparecia
    // em soma nenhuma. O Ko-fi só manda este aviso depois que o pagamento foi aprovado; a doação não dá plano
    if (valor > 0 && (plano || /^(Donation|Subscription|Shop Order|Commission)$/i.test(String(d.type || '')))) {
      const email = String(d.email || '').trim().toLowerCase();
      if (email) conta = await this.hub.acesso.contaPorEmail(email);
      const tag = /#\s*([A-Za-z0-9_.]{3,20})/.exec(String(d.message || ''));
      if (!conta && tag) { const id = await this.st.get('t:' + normalizarTag(tag[1]).toLowerCase()); conta = id ? await this.st.get('c:' + id) : null; }
      if (conta && plano) await this.dar(conta, plano, VALIDADE / DIA, 'kofi');
      await this.registrar({ tipo: 'pago', plano, valor, moeda, via: 'kofi', conta: conta ? conta.id : '' });
    }
    // guardado só o necessário para não contar duas vezes (nada de e-mail ou nome de quem pagou)
    await this.st.put('kofi:' + tx, { t: Date.now(), plano, achou: !!conta, pg: 1 });
    return resposta({ ok: true });
  }
  // ---------- Mercado Pago ----------
  async mpApi(caminho, metodo = 'GET', corpo, idem) {
    try {
      const r = await fetch(MP + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + this.hub.env.MP_TOKEN, 'Content-Type': 'application/json', ...(idem ? { 'X-Idempotency-Key': idem } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
      let d = null; try { d = await r.json(); } catch (_) { /* ok */ }
      if (!r.ok) console.log('[bolha] Mercado Pago ' + metodo + ' ' + caminho.split('?')[0].replace(/\/[0-9a-zA-Z_-]{6,}$/, '/<id>') + ': ' + r.status + ' ' + motivoMP(d));
      return { ok: r.ok, status: r.status, d: d || {} };
    } catch (e) { console.log('[bolha] Mercado Pago fora do ar: ' + e.message); return { ok: false, status: 0, d: {} }; }
  }
  // rotas da pessoa (com sessão): bolha/pix, bolha/pix/<id>, bolha/cartao, bolha/cancelar
  async rota(conta, rota, metodo, b, url) {
    if (!rota.startsWith('bolha/')) return null;
    if (!this.hub.env.MP_TOKEN) return erro('Pagamento ainda não disponível.', 503);
    const seg = rota.split('/');
    if (rota === 'bolha/pix' && metodo === 'POST') return this.pix(conta, b, url);
    if (seg[1] === 'pix' && /^\d{1,20}$/.test(seg[2] || '') && metodo === 'GET') return this.conferirPix(conta, seg[2]);
    if (rota === 'bolha/cartao' && metodo === 'POST') return this.cartao(conta, b, url);
    if (rota === 'bolha/cancelar' && metodo === 'POST') return this.cancelar(conta);
    if (rota === 'bolha/presente-fiel' && metodo === 'POST') return this.presenteFiel(conta, b);
    return null;
  }
  // (1.0.0) o presente da fidelidade do Supporter: 1 mês de Standard para um amigo (sem pagar nada)
  async presenteFiel(conta, b) {
    if (presentesFiel(conta) < 1) return erro('Você ainda não tem presente para dar. A cada 3 meses seguidos de Supporter ganha um.', 403);
    if (!this.hub.limitar('pfiel:' + conta.id, 5, 600000)) return erro('Devagar! Tente de novo em alguns minutos.', 429);
    const id = await this.st.get('f:' + String((b && b.para) || '').slice(0, 40)), o = id && id !== conta.id && (await this.st.get('c:' + id));
    if (!o || !conta.amigos || !conta.amigos[o.id] || conta.amigos[o.id].estado !== 'aceita') return erro('Só dá para presentear os seus amigos.');
    const atual = planoDe(o);
    if (atual && atual !== 'standard') return erro((o.nome || 'Esse amigo') + ' já tem um plano maior.');
    const bl = conta.bolha; if (bl.fielDe !== bl.desde) { bl.fielDe = bl.desde; bl.fielUsados = 0; }
    bl.fielUsados = (bl.fielUsados || 0) + 1; await this.st.put('c:' + conta.id, conta);
    await this.dar(o, 'standard', 31, 'presente');
    try { await this.hub.admin.avisar(o.id, (conta.nome || 'Um amigo') + ' te deu 1 mês de Aero Bubble Standard!', 'bolha'); } catch (_) { /* ok */ }
    return resposta({ ok: true, bolha: this.publico(conta) });
  }
  pedido(conta, b) {
    const plano = String(b.plano || ''), P = PLANOS[plano];
    if (!P) return { e: erro('Plano inválido.') };
    const email = String(b.email || '').trim().toLowerCase();
    if (!emailOk(email)) return { e: erro('Escreva um e-mail válido (é para o recibo do Mercado Pago).') };
    if (!this.hub.limitar('mp:' + conta.id, 8, 600000)) return { e: erro('Devagar! Tente de novo em alguns minutos.', 429) };
    const cod = aleatorio().slice(0, 8);
    // (1.0.0) plano anual: paga 10 meses e leva 12 (só no PIX; o cartão continua mensal)
    if (b.anual === true) return { plano, P, email, ref: `aero.${conta.id}.${plano}.${cod}`, cod, n: 1, valor: P.preco * MESES_ANUAL_PAGOS, anual: true };
    return { plano, P, email, ref: `aero.${conta.id}.${plano}.${cod}`, cod, n: 1, valor: P.preco };
  }
  // (0.8.2) presente: o mesmo plano por 1 mês para cada amigo escolhido, tudo num pagamento só (o preço vezes o número de amigos).
  // Guarda quem recebe em "pres:<código>" (a referência do Mercado Pago só leva o código).
  async presente(conta, b) {
    const q = this.pedido(conta, b); if (q.e) return q;
    const cods = [...new Set((Array.isArray(b.para) ? b.para : []).map((x) => String(x || '').slice(0, 40)))];
    if (!cods.length) return { e: erro('Escolha pelo menos um amigo.') };
    if (cods.length > MAX_PRESENTE) return { e: erro('Dá para presentear até ' + MAX_PRESENTE + ' amigos de uma vez.') };
    const para = [];
    for (const cd of cods) {
      const id = await this.st.get('f:' + cd), o = id && id !== conta.id && (await this.st.get('c:' + id));
      const amigo = o && conta.amigos && conta.amigos[o.id] && conta.amigos[o.id].estado === 'aceita';
      if (!amigo) return { e: erro('Só dá para presentear os seus amigos.') };
      const atual = planoDe(o);
      if (atual && PLANOS[atual].preco > q.P.preco) return { e: erro((o.nome || 'Um amigo') + ' já tem um plano maior (' + PLANOS[atual].nome + ').') };
      para.push(o.id);
    }
    await this.st.put('pres:' + q.cod, { de: conta.id, para, plano: q.plano, t: Date.now() });
    return { ...q, n: para.length, valor: Math.round(q.P.preco * para.length * 100) / 100, para };
  }
  async pix(conta, b, url) {
    const q = b && b.para ? await this.presente(conta, b) : this.pedido(conta, b); if (q.e) return q.e;
    if (q.anual) await this.st.put('anual:' + q.cod, { conta: conta.id, plano: q.plano, t: Date.now() });
    const expira = Date.now() + 30 * 60000;
    const r = await this.mpApi('/v1/payments', 'POST', {
      transaction_amount: q.valor, description: 'Aero Bubble ' + q.P.nome + (q.anual ? ' (12 meses, pagando 10)' : ' (1 mês)') + (q.para ? ' de presente para ' + q.n + (q.n > 1 ? ' amigos' : ' amigo') : ''), payment_method_id: 'pix', payer: { email: q.email },
      external_reference: q.ref, notification_url: url.origin + '/api/bolha/mp', date_of_expiration: dataMP(expira),
    }, q.ref);
    const t = (r.d.point_of_interaction && r.d.point_of_interaction.transaction_data) || {};
    if (!r.ok || !r.d.id || !t.qr_code) return erro(erroPix(r), 502);
    return resposta({ id: String(r.d.id), codigo: t.qr_code, qr: t.qr_code_base64 || '', link: t.ticket_url || '', expira, valor: q.valor });
  }
  // o app pergunta se o PIX já caiu (não depende do aviso do Mercado Pago chegar)
  async conferirPix(conta, id) {
    if (!this.hub.limitar('mpv:' + conta.id, 40, 60000)) return erro('Devagar!', 429);
    const r = await this.mpApi('/v1/payments/' + id);
    if (!r.ok) return resposta({ status: 'pendente' });
    const m = REF.exec(String(r.d.external_reference || ''));
    if (!m || m[1] !== conta.id) return erro('Pagamento não encontrado.', 404);
    if (concluido(r.d)) { await this.aplicar(r.d, r.d.external_reference); const c = await this.st.get('c:' + conta.id), pr = await this.st.get('pres:' + m[3]); return resposta({ status: 'pago', bolha: this.publico(c), presente: pr ? pr.para.length : 0 }); }
    return resposta({ status: ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(r.d.status) ? 'cancelado' : 'pendente' });
  }
  async cartao(conta, b, url) {
    if (b && b.para) { // (0.8.2) presente no cartão: pagamento único (não renova), pela página do Mercado Pago
      const q = await this.presente(conta, b); if (q.e) return q.e;
      const r = await this.mpApi('/checkout/preferences', 'POST', {
        items: [{ id: q.plano, title: 'Aero Bubble ' + q.P.nome + ' (1 mês) de presente', quantity: q.n, unit_price: q.P.preco, currency_id: 'BRL' }],
        payer: { email: q.email }, external_reference: q.ref, notification_url: url.origin + '/api/bolha/mp', back_urls: { success: url.origin + '/app/', failure: url.origin + '/app/', pending: url.origin + '/app/' },
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 1 }, statement_descriptor: 'AERO STREAM',
      }, q.ref);
      if (!r.ok || !r.d.init_point) return erro('O Mercado Pago não respondeu. Tente de novo em instantes.', 502);
      return resposta({ link: r.d.init_point, valor: q.valor });
    }
    const q = this.pedido(conta, b); if (q.e) return q.e;
    const r = await this.mpApi('/preapproval', 'POST', {
      reason: 'Aero Bubble ' + q.P.nome, external_reference: q.ref, payer_email: q.email, back_url: url.origin + '/app/', status: 'pending',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: q.P.preco, currency_id: 'BRL' },
    }, q.ref);
    if (!r.ok || !r.d.init_point) return erro(r.status === 400 ? 'O Mercado Pago recusou. Confira se o e-mail é o da sua conta do Mercado Pago.' : 'O Mercado Pago não respondeu. Tente de novo em instantes.', 502);
    return resposta({ link: r.d.init_point });
  }
  async cancelar(conta) {
    const id = conta.bolha && conta.bolha.mp;
    if (!id) return erro('Você não tem assinatura no cartão.', 404);
    const r = await this.mpApi('/preapproval/' + encodeURIComponent(id), 'PUT', { status: 'cancelled' });
    if (!r.ok && r.status !== 404) return erro('O Mercado Pago não respondeu. Tente de novo em instantes.', 502);
    delete conta.bolha.mp; await this.st.put('c:' + conta.id, conta);
    await this.registrar({ tipo: 'cancelou', plano: conta.bolha.plano, via: 'mp-cartao', conta: conta.id });
    for (const ws of this.hub.ctx.getWebSockets('c:' + conta.id)) { try { ws.send(JSON.stringify({ tipo: 'bolha', bolha: this.publico(conta) })); } catch (_) { /* ok */ } }
    return resposta({ ok: true, bolha: this.publico(conta) }); // o plano continua até a data paga
  }
  // um pagamento aprovado vira plano (uma vez só por pagamento). ref: a referência da cobrança (do PIX ou da assinatura do cartão)
  async aplicar(p, ref, assinatura) {
    const m = REF.exec(String(ref || ''));
    if (p && m && ESTORNO.includes(p.status)) return this.estornar(p, m);
    if (!m || !concluido(p) || p.currency_id !== 'BRL') return null;
    const plano = m[2], pres = assinatura ? null : await this.st.get('pres:' + m[3]);
    if (pres) return this.aplicarPresente(p, plano, pres);
    const anual = assinatura ? null : await this.st.get('anual:' + m[3]);
    if (!(+p.transaction_amount >= PLANOS[plano].preco * (anual ? MESES_ANUAL_PAGOS : 1) - 0.001)) return null;
    const chave = 'mp:' + p.id;
    if (await this.st.get(chave)) return null;
    await this.st.put(chave, { t: Date.now(), plano, pg: 1, anual: anual ? 1 : undefined });
    await this.registrar({ tipo: 'pago', plano, valor: +p.transaction_amount, via: assinatura ? 'mp-cartao' : 'mp-pix', conta: m[1] });
    const conta = await this.st.get('c:' + m[1]);
    if (!conta) return null;
    const novo = planoDe(conta) !== plano;
    if (assinatura) conta.bolha = { ...(conta.bolha || {}), mp: String(assinatura).slice(0, 64) };
    await this.dar(conta, plano, anual ? DIAS_ANUAL : VALIDADE / DIA, assinatura ? 'cartao' : 'pix');
    if (novo) { try { await this.hub.admin.avisar(conta.id, 'Obrigado por apoiar o Aero! Seu Aero Bubble ' + PLANOS[plano].nome + ' está ativo.', 'bolha'); } catch (_) { /* ok */ } }
    return conta;
  }
  // (0.8.3) devolveram o dinheiro (estorno ou contestação no cartão): o mês pago sai do plano e o valor sai do caixa. Uma vez só.
  async estornar(p, m) {
    const chave = 'mp:' + p.id, x = await this.st.get(chave);
    if (!x || x.estorno) return null;
    x.estorno = Date.now(); await this.st.put(chave, x);
    const pres = await this.st.get('pres:' + m[3]), contas = pres ? pres.para : [m[1]], n = contas.length || 1;
    for (const id of contas) {
      await this.registrar({ tipo: 'estornou', plano: m[2], valor: Math.round((+p.transaction_amount / n) * 100) / 100, via: p.payment_method_id === 'pix' ? 'mp-pix' : 'mp-cartao', conta: id });
      const c = await this.st.get('c:' + id);
      if (c && planoDe(c) === m[2] && c.bolha.ate) { c.bolha.ate -= x.anual ? DIAS_ANUAL * DIA : VALIDADE; if (c.bolha.ate <= Date.now()) await this.darMs(c, '', 0, ''); else await this.darMs(c, m[2], 1, c.bolha.origem); }
    }
    return null;
  }
  // (0.8.3) o câmbio de agora (quanto vale 1 de cada moeda em reais). Busca de novo a cada 10 minutos; se a internet falhar, usa o último.
  async cambio() {
    const c = await this.st.get('cambio'), agora = Date.now();
    if (c && agora - c.t < 10 * 60000) return c;
    if (this._cambio) return this._cambio;
    this._cambio = (async () => {
      const taxas = {};
      try { // AwesomeAPI: cotação do real ao vivo
        const r = await fetch('https://economia.awesomeapi.com.br/json/last/' + MOEDAS.map((m) => m + '-BRL').join(','), { signal: AbortSignal.timeout(5000) });
        if (r.ok) { const d = await r.json(); for (const m of MOEDAS) { const v = d[m + 'BRL'] && +d[m + 'BRL'].bid; if (v > 0) taxas[m] = v; } }
      } catch (_) { /* tenta o outro */ }
      if (Object.keys(taxas).length < MOEDAS.length) {
        try { // reserva: open.er-api (1 real em cada moeda)
          const r = await fetch('https://open.er-api.com/v6/latest/BRL', { signal: AbortSignal.timeout(5000) });
          if (r.ok) { const d = await r.json(); for (const [m, v] of Object.entries((d && d.rates) || {})) if (/^[A-Z]{3}$/.test(m) && m !== 'BRL' && +v > 0 && !taxas[m]) taxas[m] = Math.round((1 / v) * 1e6) / 1e6; }
        } catch (_) { /* ok */ }
      }
      const novo = Object.keys(taxas).length ? { t: agora, taxas } : c ? { ...c, velho: true } : { t: 0, taxas: {} };
      if (Object.keys(taxas).length) await this.st.put('cambio', novo);
      return novo;
    })();
    try { return await this._cambio; } finally { this._cambio = null; }
  }
  async emReais(valor, moeda) { if (moeda === 'BRL') return valor; const t = (await this.cambio()).taxas[moeda]; return t ? valor * t : 0; }
  // (0.8.2) o presente pago: 1 mês do plano para cada amigo (quem pagou não recebe nada além do recibo)
  async aplicarPresente(p, plano, pres) {
    const n = pres.para.length, P = PLANOS[plano];
    if (!n || pres.plano !== plano || !concluido(p) || !(+p.transaction_amount >= P.preco * n - 0.001)) return null;
    const chave = 'mp:' + p.id;
    if (await this.st.get(chave)) return null;
    await this.st.put(chave, { t: Date.now(), plano, pg: 1, n });
    const via = p.payment_method_id === 'pix' ? 'mp-pix' : 'mp-cartao', de = await this.st.get('c:' + pres.de);
    for (const id of pres.para) {
      await this.registrar({ tipo: 'pago', plano, valor: Math.round((+p.transaction_amount / n) * 100) / 100, via, conta: id });
      const o = await this.st.get('c:' + id); if (!o) continue;
      await this.dar(o, plano, VALIDADE / DIA, via === 'mp-pix' ? 'pix' : 'cartao');
      try { await this.hub.admin.avisar(id, (de ? de.nome : 'Um amigo') + ' te deu de presente o Aero Bubble ' + P.nome + ' por 1 mês! Aproveite.', 'bolha'); } catch (_) { /* ok */ }
    }
    return de;
  }
  async conferirAssinatura(cab, url, id) {
    const segredo = this.hub.env.MP_SEGREDO, sig = cab.get('x-signature');
    if (!segredo) return true; // sem segredo configurado: vale a conferência no Mercado Pago (que sempre acontece)
    if (!sig) return false; // (0.8.7) com segredo, aviso sem assinatura é recusado (antes passava)
    const p = Object.fromEntries(sig.split(',').map((x) => x.trim().split('=')).filter((x) => x.length === 2));
    if (!p.ts || !p.v1) return false;
    const idQ = url.searchParams.get('data.id') || id, rid = cab.get('x-request-id');
    const manifesto = `id:${/^[a-z0-9]+$/i.test(idQ) ? idQ.toLowerCase() : idQ};` + (rid ? `request-id:${rid};` : '') + `ts:${p.ts};`;
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return igual(hexDe(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(manifesto))), String(p.v1).toLowerCase());
  }
  // o aviso do Mercado Pago (público). Responde 200 quando entendeu (o Mercado Pago repete se não receber)
  async mp(request, url) {
    if (!this.hub.env.MP_TOKEN) return erro('Não encontrado', 404);
    if (!this.hub.limitar('mpw:' + (request.headers.get('CF-Connecting-IP') || 'x'), 120, 60000)) return erro('Devagar!', 429);
    let c = {}; try { c = await request.json(); } catch (_) { /* aviso antigo: só no endereço */ }
    const tipo = String(c.type || c.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
    const id = String((c.data && c.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return resposta({ ok: true });
    if (!(await this.conferirAssinatura(request.headers, url, id))) return erro('Não autorizado.', 401);
    if (tipo === 'payment') {
      const p = (await this.mpApi('/v1/payments/' + id)).d;
      let ref = p.external_reference, pre = (p.metadata && p.metadata.preapproval_id) || (p.point_of_interaction && p.point_of_interaction.transaction_data && p.point_of_interaction.transaction_data.subscription_id) || '';
      if (!REF.test(String(ref || '')) && pre) ref = (await this.mpApi('/preapproval/' + encodeURIComponent(pre))).d.external_reference; // cobrança do cartão
      await this.aplicar(p, ref, pre);
    } else if (tipo === 'subscription_authorized_payment') {
      const ap = (await this.mpApi('/authorized_payments/' + id)).d;
      if (ap.preapproval_id && ap.payment && ap.payment.id) {
        const pa = (await this.mpApi('/preapproval/' + encodeURIComponent(ap.preapproval_id))).d;
        const p = (await this.mpApi('/v1/payments/' + ap.payment.id)).d;
        await this.aplicar(p, pa.external_reference, ap.preapproval_id);
      }
    } else if (tipo === 'subscription_preapproval') {
      const pa = (await this.mpApi('/preapproval/' + encodeURIComponent(id))).d, m = REF.exec(String(pa.external_reference || ''));
      if (m && ['cancelled', 'paused'].includes(pa.status)) { // cancelou pelo Mercado Pago: o plano vai até a data paga e não renova
        const conta = await this.st.get('c:' + m[1]);
        if (conta && conta.bolha && conta.bolha.mp === id) { delete conta.bolha.mp; await this.st.put('c:' + conta.id, conta); await this.registrar({ tipo: 'cancelou', plano: conta.bolha.plano, via: 'mp-cartao', conta: conta.id }); }
      }
    }
    return resposta({ ok: true });
  }
  // ---------- (0.8.2) painel de assinaturas (só o desenvolvedor; admin/assinaturas) ----------
  async tudo(prefixo) {
    const out = []; let depois;
    for (;;) {
      const pag = await this.st.list({ prefix: prefixo, limit: 1000, ...(depois ? { startAfter: depois } : {}) });
      for (const [k, v] of pag) out.push([k, v]);
      if (pag.size < 1000) return out;
      depois = [...pag.keys()].pop();
    }
  }
  // b: { de, ate, fuso } (como no Analytics). Responde: assinaturas ativas (por plano e por onde foram pagas), o que já entrou no total,
  // canceladas e vencidas, a previsão do próximo mês e o período escolhido (gráfico e os últimos pagamentos)
  async painel({ de, ate, fuso } = {}) {
    const agora = Date.now();
    ate = Math.min(+ate || agora, agora + DIA); de = de == null || !Number.isFinite(+de) ? ate - 30 * DIA : +de;
    if (!(de < ate)) de = ate - DIA;
    de = Math.max(de, ate - 800 * DIA);
    fuso = Math.max(-840, Math.min(840, Math.round(+fuso) || 0)) * 60000;
    // (0.8.5) o PIX de teste de R$ 0,67 que o #123 mandou direto no Nubank (antes de existir o "Registrar doação"): entra uma vez só
    if (!(await this.st.get('mig:pix-123-067'))) {
      const id = await this.st.get('t:' + normalizarTag('123').toLowerCase());
      if (id) { await this.registrar({ tipo: 'pago', plano: '', valor: 0.67, via: 'nubank', conta: id }); await this.st.put('mig:pix-123-067', { t: Date.now() }); }
    }
    // quem já teve plano (na 1ª vez procura nas contas antigas)
    if (!(await this.st.get('bi:feito'))) {
      let depois;
      for (;;) {
        const pag = await this.st.list({ prefix: 'c:', limit: 200, ...(depois ? { startAfter: depois } : {}) });
        const marca = {};
        for (const [, c] of pag) if (c && c.id && c.bolha && c.bolha.plano) marca['bi:' + c.id] = 1;
        if (Object.keys(marca).length) await this.st.put(marca);
        if (pag.size < 200) break;
        depois = [...pag.keys()].pop();
      }
      await this.st.put('bi:feito', 1);
    }
    const ids = (await this.tudo('bi:')).map(([k]) => k.slice(3)).filter((x) => x !== 'feito');
    const contas = new Map();
    for (let i = 0; i < ids.length; i += 64) for (const c of await Promise.all(ids.slice(i, i + 64).map((x) => this.st.get('c:' + x)))) if (c) contas.set(c.id, c);
    // os eventos (e os pagamentos de antes do caixa: só o plano, o valor é o preço)
    const evs = (await this.tudo('pg:')).map(([k, v]) => ({ ...v, k: k.slice(3) })); // (0.8.3) k: para apagar um pagamento de teste
    // (0.8.3) os registros antigos (sem pg:) também podem sair do caixa: ficam guardados (para o mesmo pagamento não contar duas vezes) com "fora"
    for (const [k, v] of await this.tudo('kofi:')) if (v && !v.pg && !v.fora && PLANOS[v.plano]) evs.push({ k, t: v.t, tipo: 'pago', plano: v.plano, valor: PLANOS[v.plano].preco, moeda: 'BRL', via: 'kofi', conta: '' });
    for (const [k, v] of await this.tudo('mp:')) if (v && !v.pg && !v.fora && PLANOS[v.plano]) evs.push({ k, t: v.t, tipo: 'pago', plano: v.plano, valor: PLANOS[v.plano].preco, moeda: 'BRL', via: 'mp', conta: '' });
    evs.sort((a, b) => a.t - b.t);
    const VIAS = ['kofi', 'nubank', 'mp-pix', 'mp-cartao', 'mp', 'outro', 'presente', 'manual'];
    const viaDaOrigem = (o) => ({ kofi: 'kofi', pix: 'mp-pix', cartao: 'mp-cartao', nubank: 'nubank', 'mp-pix': 'mp-pix', 'mp-cartao': 'mp-cartao', presente: 'presente', outro: 'outro' }[o] || 'manual');
    const reais = (n) => Math.round(n * 100) / 100;
    const planos = {}, vias = {};
    for (const p of Object.keys(PLANOS)) planos[p] = { nome: PLANOS[p].nome, preco: PLANOS[p].preco, ativas: 0, ativasPagas: 0, pagas: 0, receita: 0, canceladas: 0, venceram: 0, porVia: {} };
    for (const v of VIAS) vias[v] = { pagamentos: 0, receita: 0, ativas: 0, outras: {} };
    const assinantes = new Set(), primeiro = new Map(), ultimoPago = new Map(), ultimoCancel = new Map();
    // (0.8.3) cada moeda como chegou, e o total já convertido para reais com o câmbio de agora
    const cambio = await this.cambio(), moedas = {};
    const brl = (e) => (e.moeda === 'BRL' ? e.valor : cambio.taxas[e.moeda] ? e.valor * cambio.taxas[e.moeda] : 0);
    for (const e of evs) e.brl = reais(brl(e));
    let pagamentos = 0, receita = 0, anonimos = 0, estornos = 0;
    for (const e of evs) {
      const P = planos[e.plano], V = vias[e.via] || vias.outro;
      if (e.tipo === 'pago' || e.tipo === 'estornou') {
        const s = e.tipo === 'pago' ? 1 : -1, M = (moedas[e.moeda] = moedas[e.moeda] || { valor: 0, pagamentos: 0, brl: 0, taxa: e.moeda === 'BRL' ? 1 : cambio.taxas[e.moeda] || 0 });
        M.valor += s * e.valor; M.brl += s * e.brl; receita += s * e.brl; V.receita += s * e.brl; if (P) P.receita += s * e.brl;
        if (e.moeda !== 'BRL') V.outras[e.moeda] = reais((V.outras[e.moeda] || 0) + s * e.valor);
        if (s < 0) { estornos++; continue; }
        M.pagamentos++; pagamentos++; V.pagamentos++; if (P) P.pagas++;
        if (e.conta && e.plano) { assinantes.add(e.conta); if (!primeiro.has(e.conta)) primeiro.set(e.conta, e.t); ultimoPago.set(e.conta, e); } else if (!e.conta) anonimos++; // (0.8.5) doação (sem plano): entra nas somas, mas não é assinatura
      } else if (e.tipo === 'cancelou') { if (P) P.canceladas++; if (e.conta) ultimoCancel.set(e.conta, e.t); }
    }
    for (const M of Object.values(moedas)) { M.valor = reais(M.valor); M.brl = reais(M.brl); }
    // as ativas agora, por plano e por onde vieram; a previsão: quanto entra no próximo mês se todas as pagas renovarem
    // (0.8.3) a previsão conta só o que renova sozinho: a assinatura mensal do Ko-fi e o cartão do Mercado Pago. PIX (e o PIX direto
    // no Nubank) é de uma vez só e não entra
    const previsao = { total: 0, automatica: 0, assinaturas: 0, kofi: 0, cartao: 0, avulsas: 0, vencem30: 0 };
    for (const c of contas.values()) {
      const p = planoDe(c);
      if (p) {
        const via = viaDaOrigem(c.bolha.origem), P = planos[p];
        P.ativas++; P.porVia[via] = (P.porVia[via] || 0) + 1; vias[via].ativas++;
        const paga = !['presente', 'manual'].includes(via) && c.bolha.ate > 0;
        if (paga) {
          P.ativasPagas++;
          const auto = via === 'kofi' || (via === 'mp-cartao' && c.bolha.mp);
          if (auto) {
            const u = ultimoPago.get(c.id), v = u && u.plano === p && u.brl > 0 ? u.brl : P.preco; // o Ko-fi de fora cobra na moeda da pessoa
            previsao.total += v; previsao.assinaturas++; previsao[via === 'kofi' ? 'kofi' : 'cartao'] += v;
          } else { previsao.avulsas++; if (c.bolha.ate < agora + 30 * DIA) previsao.vencem30++; }
        }
      } else {
        const u = ultimoPago.get(c.id); // pagou e não renovou (sem ter cancelado depois do último pagamento)
        if (u && planos[u.plano] && !((ultimoCancel.get(c.id) || 0) > u.t)) planos[u.plano].venceram++;
      }
    }
    // o período: dia a dia (até 62 dias) ou mês a mês, no relógio de quem olha
    const porDia = ate - de <= 62 * DIA + DIA;
    const inicio = (t) => {
      if (porDia) return Math.floor((t - fuso) / DIA) * DIA + fuso;
      const d = new Date(t - fuso); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + fuso;
    };
    const proximo = (t) => { if (porDia) return t + DIA; const d = new Date(t - fuso); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) + fuso; };
    const serie = [], idx = new Map();
    for (let t = inicio(de); t < ate; t = proximo(t)) { const x = { t, valor: 0, n: 0, novas: 0, canceladas: 0, via: {} }; idx.set(t, x); serie.push(x); }
    const periodo = { de, ate, grao: porDia ? 'dia' : 'mes', receita: 0, pagamentos: 0, novas: 0, canceladas: 0, estornos: 0, serie, recentes: [] };
    for (const e of evs) {
      if (e.t < de || e.t >= ate) continue;
      const x = idx.get(inicio(e.t)); if (!x) continue;
      if (e.tipo === 'estornou') { x.valor -= e.brl; x.via[e.via] = reais((x.via[e.via] || 0) - e.brl); periodo.receita -= e.brl; periodo.estornos++; continue; }
      if (e.tipo === 'pago') {
        x.valor += e.brl; x.via[e.via] = reais((x.via[e.via] || 0) + e.brl); periodo.receita += e.brl;
        x.n++; periodo.pagamentos++;
        if (e.conta && primeiro.get(e.conta) === e.t) { x.novas++; periodo.novas++; }
      } else if (e.tipo === 'cancelou') { x.canceladas++; periodo.canceladas++; }
    }
    for (const x of serie) x.valor = reais(x.valor);
    periodo.receita = reais(periodo.receita);
    const linha = (e) => {
      const c = e.conta && contas.get(e.conta);
      return { id: e.k || '', t: e.t, tipo: e.tipo, plano: e.plano, valor: e.valor, moeda: e.moeda, brl: e.brl, via: e.via, nome: c ? c.nome : '', tag: c ? c.tag || '' : '', codigo: c ? c.codigo : '' };
    };
    periodo.recentes = evs.filter((e) => e.t >= de && e.t < ate).slice(-60).reverse().map(linha);
    // (0.8.3) todos os registros (os mais novos primeiro): a tabela "Últimos pagamentos" tem páginas de 10 e filtro por mês
    periodo.historico = evs.slice(-5000).reverse().map(linha);
    for (const p of Object.values(planos)) p.receita = reais(p.receita);
    for (const v of Object.values(vias)) v.receita = reais(v.receita);
    previsao.total = previsao.automatica = reais(previsao.total); previsao.kofi = reais(previsao.kofi); previsao.cartao = reais(previsao.cartao);
    return { agora, assinantes: assinantes.size + anonimos, pagamentos, estornos, receita: reais(receita), planos, vias, previsao, periodo, moedas, cambio: { t: cambio.t, velho: !!cambio.velho, taxas: Object.fromEntries(MOEDAS.filter((m) => cambio.taxas[m]).map((m) => [m, cambio.taxas[m]])) } };
  }
  // (0.8.3) o desenvolvedor apaga um pagamento do caixa (o que ele pôs só para testar). Não mexe no plano da pessoa.
  async apagarPagamento(id) {
    id = String(id || '');
    if (/^(kofi|mp):[A-Za-z0-9_.:-]{1,80}$/.test(id)) { const v = await this.st.get(id); if (!v || v.pg) return false; await this.st.put(id, { ...v, fora: true }); return true; }
    if (!/^\d{14}:[0-9a-f]{6}$/.test(id)) return false;
    if (!(await this.st.get('pg:' + id))) return false;
    await this.st.delete('pg:' + id); return true;
  }
  planoPeloValor(v) { const n = parseFloat(String(v || '').replace(',', '.')) || 0; return n >= 50 ? 'supporter' : n >= 25 ? 'donator' : n >= 15 ? 'plus' : n >= 10 ? 'standard' : ''; }
}
