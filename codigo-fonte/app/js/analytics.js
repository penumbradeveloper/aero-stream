// Aero Stream - Analytics (aba Desenvolvedor, só a conta do desenvolvedor): quantas contas existem, quantas pessoas estão online AO VIVO,
// quantas usaram nas últimas 24 h / 7 / 30 dias e, num período escolhido (hoje, ontem, 2/3/7 dias, este mês, mês passado, este ano, um dia
// ou um intervalo de datas), quantas pessoas diferentes usaram, o pico de online e o gráfico de online por hora (ou por dia).
// Os números vêm do servidor (servidor/src/analytics.js). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, U = A.ui, API = A.api;
  const HORA = 3600000, DIA = 24 * HORA;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const num = (n) => (n || 0).toLocaleString();
  const meiaNoite = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const somarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const doCampo = (v) => { const [a, m, d] = v.split('-').map(Number); return new Date(a, m - 1, d); }; // "2026-10-30" no fuso local
  const paraCampo = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  // os períodos prontos: [id, rótulo, () => [de, ate]]
  const PERIODOS = [
    ['hoje', T('Hoje', 'Today'), () => [meiaNoite(Date.now()), new Date()]],
    ['ontem', T('Ontem', 'Yesterday'), () => [somarDias(meiaNoite(Date.now()), -1), meiaNoite(Date.now())]],
    ['d2', T('2 dias', '2 days'), () => [somarDias(meiaNoite(Date.now()), -1), new Date()]],
    ['d3', T('3 dias', '3 days'), () => [somarDias(meiaNoite(Date.now()), -2), new Date()]],
    ['d7', T('7 dias', '7 days'), () => [somarDias(meiaNoite(Date.now()), -6), new Date()]],
    ['mes', T('Este mês', 'This month'), () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; }],
    ['mesPassado', T('Mês passado', 'Last month'), () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 1)]; }],
    ['ano', T('Este ano', 'This year'), () => { const d = new Date(); return [new Date(d.getFullYear(), 0, 1), d]; }],
  ];

  function painel() {
    const el = h('div', { class: 'col an', estilo: { gap: '14px' } });
    let periodo = { id: 'hoje', faixa: PERIODOS[0][2] }, dados = null, carregando = false, vivo = null;

    // --- ao vivo ---
    const nVivo = h('div', { class: 'an-vivo-n' }, '–'), detVivo = h('div', { class: 'suave' }, ' ');
    const cardVivo = h('section', { class: 'vidro pad an-vivo' }, h('div', { class: 'an-vivo-cab' }, h('span', { class: 'an-ponto' }), T('Online agora', 'Online now'), h('span', { class: 'pilula an-ao-vivo' }, T('ao vivo', 'live'))), nVivo, detVivo);
    const tile = (rotulo) => { const v = h('div', { class: 'an-tile-n' }, '–'), s = h('div', { class: 'peq suave' }, ' '); return { el: h('div', { class: 'vidro pad an-tile' }, h('div', { class: 'an-tile-r' }, rotulo), v, s), v, s }; };
    const tContas = tile(T('Contas criadas', 'Accounts created')), t1 = tile(T('Usaram nas últimas 24 h', 'Used in the last 24 h')), t7 = tile(T('Nos últimos 7 dias', 'In the last 7 days')), t30 = tile(T('Nos últimos 30 dias', 'In the last 30 days'));
    el.append(h('div', { class: 'an-topo' }, cardVivo, h('div', { class: 'an-tiles' }, tContas.el, t1.el, t7.el, t30.el)));
    const pintarVivo = (o) => {
      vivo = o;
      nVivo.textContent = num(o.total);
      detVivo.textContent = T(`${num(o.ativos)} ativas · ${num(o.ausentes)} ausentes · ${num(o.aparelhos)} aparelhos`, `${num(o.ativos)} active · ${num(o.ausentes)} away · ${num(o.aparelhos)} devices`);
      cardVivo.classList.remove('pulsou'); void cardVivo.offsetWidth; cardVivo.classList.add('pulsou');
    };

    // --- período ---
    const seg = U.seg(PERIODOS.map(([id, r]) => [id, r]), 'hoje', (id) => { periodo = { id, faixa: PERIODOS.find((p) => p[0] === id)[2] }; carregar(); });
    seg.classList.add('quebra');
    const hoje = paraCampo(new Date());
    const campoDia = h('input', { type: 'date', class: 'campo', max: hoje, value: hoje });
    const campoDe = h('input', { type: 'date', class: 'campo', max: hoje, value: paraCampo(somarDias(new Date(), -13)) }), campoAte = h('input', { type: 'date', class: 'campo', max: hoje, value: hoje });
    const anoAtual = new Date().getFullYear(), campoAno = h('select', { class: 'campo' }, [anoAtual, anoAtual - 1].map((a) => h('option', { value: a }, String(a))));
    const desmarcar = () => seg.querySelectorAll('button').forEach((b) => b.classList.remove('sel'));
    const usar = (id, faixa) => { desmarcar(); periodo = { id, faixa }; carregar(); };
    const avancado = h('details', { class: 'mais an-avancado' }, h('summary', {}, T('Pesquisa avançada', 'Advanced search')),
      h('div', { class: 'an-linhas' },
        h('label', { class: 'linha an-campo' }, h('span', {}, T('Dia específico', 'Specific day')), campoDia, U.btn(T('Ver o dia', 'View day'), { peq: true, onclick: () => { if (!campoDia.value) return; const d = doCampo(campoDia.value); usar('dia', () => [d, somarDias(d, 1)]); } })),
        h('label', { class: 'linha an-campo' }, h('span', {}, T('De', 'From')), campoDe, h('span', {}, T('até', 'to')), campoAte, U.btn(T('Ver o intervalo', 'View range'), { peq: true, onclick: () => {
          if (!campoDe.value || !campoAte.value) return;
          let a = doCampo(campoDe.value), b = doCampo(campoAte.value); if (b < a) [a, b] = [b, a];
          usar('intervalo', () => [a, somarDias(b, 1)]);
        } })),
        h('label', { class: 'linha an-campo' }, h('span', {}, T('Ano inteiro', 'Whole year')), campoAno, U.btn(T('Ver o ano', 'View year'), { peq: true, onclick: () => { const a = +campoAno.value; usar('anoX', () => [new Date(a, 0, 1), new Date(a + 1, 0, 1)]); } })),
        h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Até 3 dias o gráfico é hora a hora; mais que isso, dia a dia. Até 400 dias por pesquisa.', 'Up to 3 days the chart is hour by hour; longer, day by day. Up to 400 days per search.'))));
    const tituloPeriodo = h('div', { class: 'an-periodo-t' }, ' ');
    const pPessoas = tile(T('Pessoas diferentes', 'Different people')), pPico = tile(T('Pico de online', 'Online peak')), pNovas = tile(T('Contas novas', 'New accounts'));
    const grafico = h('div', { class: 'an-grafico' }), dica = h('div', { class: 'an-dica', hidden: '' });
    const tabela = h('div', { class: 'an-tabela' });
    const verTabela = h('details', { class: 'mais' }, h('summary', {}, T('Ver em tabela', 'View as table')), tabela);
    const erroEl = h('p', { class: 'msg erro', hidden: '' });
    el.append(h('section', { class: 'vidro pad col', estilo: { gap: '12px' } },
      h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '8px', 'justify-content': 'space-between' } }, h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, T('Período', 'Period')), tituloPeriodo),
      seg, avancado, erroEl,
      h('div', { class: 'an-tiles an-tiles-3' }, pPessoas.el, pPico.el, pNovas.el),
      h('div', { class: 'an-graf-cab' }, h('b', {}, T('Pessoas online', 'People online')), h('span', { class: 'peq suave an-graf-sub' }, ' ')),
      h('div', { class: 'an-graf-caixa' }, grafico, dica), verTabela));

    const fmtHora = (t, comDia) => { const d = new Date(t); return (comDia ? d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit' }) + ' ' : '') + String(d.getHours()).padStart(2, '0') + 'h'; };
    const fmtDia = (t, ano) => new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', ...(ano ? { year: 'numeric' } : {}) });
    const fmtFaixa = (de, ate) => { const a = new Date(de), b = new Date(ate - 1); return a.toDateString() === b.toDateString() ? a.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : a.toLocaleDateString() + ' – ' + b.toLocaleDateString(); };

    function pintar() {
      const r = dados; if (!r) return;
      tContas.v.textContent = num(r.contas); tContas.s.textContent = T('desde o começo', 'all time');
      t1.v.textContent = num(r.ativas.d1); t7.v.textContent = num(r.ativas.d7); t30.v.textContent = num(r.ativas.d30);
      t1.s.textContent = t7.s.textContent = t30.s.textContent = T('pessoas diferentes', 'different people');
      if (!vivo || vivo._t < r.agora) pintarVivo({ ...r.online, _t: r.agora });
      const P = r.periodo, porHora = P.grao === 'hora';
      tituloPeriodo.textContent = fmtFaixa(P.de, P.ate);
      pPessoas.v.textContent = num(P.pessoas); pPessoas.s.textContent = T('usaram o app no período', 'used the app in the period');
      pPico.v.textContent = num(P.pico.p); pPico.s.textContent = P.pico.p ? (porHora ? fmtHora(P.pico.t, P.serie.length > 24) : fmtDia(P.pico.t)) : T('ninguém online', 'nobody online');
      pNovas.v.textContent = num(P.novas); pNovas.s.textContent = T('criadas no período', 'created in the period');
      el.querySelector('.an-graf-sub').textContent = porHora ? T('maior número ao mesmo tempo, a cada hora', 'most at the same time, each hour') : T('maior número ao mesmo tempo, a cada dia', 'most at the same time, each day');
      desenhar(P, porHora);
      // tabela
      const linhas = P.serie.filter((x) => x.t <= r.agora);
      tabela.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, porHora ? T('Hora', 'Hour') : T('Dia', 'Day')), h('th', {}, T('Pico online', 'Online peak')), h('th', {}, T('Pessoas diferentes', 'Different people')), h('th', {}, T('Contas novas', 'New accounts')))),
        h('tbody', {}, linhas.slice().reverse().map((x) => h('tr', {}, h('td', {}, porHora ? fmtHora(x.t, true) : fmtDia(x.t, true)), h('td', {}, num(x.p)), h('td', {}, num(x.u)), h('td', {}, num(x.novas)))))));
    }

    // gráfico de barras (uma série: o pico de online). Passar o mouse mostra a hora/dia, o pico, as pessoas diferentes e as contas novas.
    function desenhar(P, porHora) {
      const W = Math.max(320, grafico.clientWidth || 700), Hh = 220, mE = 34, mD = 8, mT = 10, mB = 26;
      const s = P.serie, n = s.length, max = Math.max(1, ...s.map((x) => x.p));
      const passo = max <= 4 ? 1 : Math.ceil(max / 4 / (max > 20 ? 5 : 1)) * (max > 20 ? 5 : 1), topo = Math.ceil(max / passo) * passo;
      const x0 = mE, larg = W - mE - mD, alt = Hh - mT - mB, bw = larg / n, gap = Math.min(2, bw * 0.25);
      const y = (v) => mT + alt - (v / topo) * alt;
      const g = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, width: '100%', height: Hh, role: 'img', 'aria-label': T('Gráfico de pessoas online', 'Chart of people online') });
      for (let v = 0; v <= topo; v += passo) {
        g.append(svg('line', { x1: x0, x2: W - mD, y1: y(v), y2: y(v), class: v ? 'an-grade' : 'an-base' }));
        const t = svg('text', { x: x0 - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'an-eixo' }); t.textContent = v; g.append(t);
      }
      const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(larg / (porHora ? 44 : 52)))));
      const agora = dados.agora;
      s.forEach((x, i) => {
        const bx = x0 + i * bw + gap / 2, w = Math.max(1, bw - gap), hy = y(x.p), futuro = x.t > agora;
        if (x.p > 0) {
          const hgt = mT + alt - hy, r = Math.min(4, w / 2, hgt);
          g.append(svg('path', { class: 'an-barra' + (porHora && x.t <= agora && agora < x.t + HORA ? ' agora' : ''), d: `M${bx},${mT + alt}V${hy + r}Q${bx},${hy} ${bx + r},${hy}H${bx + w - r}Q${bx + w},${hy} ${bx + w},${hy + r}V${mT + alt}Z` }));
        }
        if (i % cada === 0) { const t = svg('text', { x: bx + w / 2, y: Hh - 8, 'text-anchor': 'middle', class: 'an-eixo' }); t.textContent = porHora ? (n > 24 && new Date(x.t).getHours() === 0 ? fmtDia(x.t) : fmtHora(x.t)) : fmtDia(x.t); g.append(t); }
        const alvo = svg('rect', { x: x0 + i * bw, y: mT, width: bw, height: alt, class: 'an-alvo' });
        alvo.addEventListener('mouseenter', () => {
          dica.hidden = false;
          dica.replaceChildren(h('b', {}, porHora ? fmtHora(x.t, n > 24) : fmtDia(x.t, true)), h('div', {}, futuro ? T('ainda não chegou', 'not yet') : T(`Pico online: ${num(x.p)}`, `Online peak: ${num(x.p)}`)),
            futuro ? null : h('div', {}, T(`Pessoas diferentes: ${num(x.u)}`, `Different people: ${num(x.u)}`)), futuro || !x.novas ? null : h('div', {}, T(`Contas novas: ${num(x.novas)}`, `New accounts: ${num(x.novas)}`)));
          const px = ((x0 + (i + 0.5) * bw) / W) * grafico.clientWidth;
          dica.style.left = Math.max(70, Math.min(grafico.clientWidth - 70, px)) + 'px';
          alvo.classList.add('sel');
        });
        alvo.addEventListener('mouseleave', () => { dica.hidden = true; alvo.classList.remove('sel'); });
        g.append(alvo);
      });
      grafico.replaceChildren(g);
    }

    async function carregar() {
      if (carregando) { carregar.depois = true; return; }
      carregando = true; el.classList.add('carregando');
      const [de, ate] = periodo.faixa();
      try {
        dados = await API.req('admin/analytics', { de: +de, ate: +ate, fuso: new Date().getTimezoneOffset() });
        erroEl.hidden = true; pintar();
      } catch (e) { erroEl.hidden = false; erroEl.textContent = e.message; }
      carregando = false; el.classList.remove('carregando');
      if (carregar.depois) { carregar.depois = false; carregar(); }
    }
    // o número ao vivo chega pelo servidor na hora; a barra da hora atual sobe junto
    const off = A.evt.on('hub:analytics-online', (m) => {
      pintarVivo({ ...m.online, _t: m.t });
      if (dados && dados.periodo.grao === 'hora') { const x = dados.periodo.serie.find((s) => s.t <= m.t && m.t < s.t + HORA); if (x && m.online.total > x.p) { x.p = m.online.total; desenhar(dados.periodo, true); } }
    });
    const offEu = A.evt.on('hub:eu', () => carregar());
    const iv = setInterval(() => { if (!document.hidden && el.isConnected) carregar(); }, 60000);
    let rt = 0; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => dados && desenhar(dados.periodo, dados.periodo.grao === 'hora'), 120); }); ro.observe(grafico);
    carregar();
    return { el, carregar, limpar: () => { off(); offEu(); clearInterval(iv); ro.disconnect(); clearTimeout(rt); } };
  }

  // ---------- (0.8.2) Assinaturas (Aero Bubble): só a conta do desenvolvedor (o servidor confere) ----------
  // Ativas por plano e por onde foram pagas, o que já entrou no total, canceladas e vencidas, a previsão do próximo mês e, no período,
  // o gráfico do que entrou (dia a dia ou mês a mês, por onde veio) e os últimos pagamentos. Os números vêm de servidor/src/bolha.js.
  const VIAS = () => ([
    ['kofi', 'Ko-fi'], ['nubank', T('PIX Nubank (direto)', 'PIX Nubank (direct)')], ['mp-pix', T('Mercado Pago · PIX', 'Mercado Pago · PIX')],
    ['mp-cartao', T('Mercado Pago · cartão', 'Mercado Pago · card')], ['mp', T('Mercado Pago (antigo)', 'Mercado Pago (old)')], ['outro', T('Outro', 'Other')],
  ]);
  const VIAS_SEM_PAGAR = () => ([['presente', T('Presente', 'Gift')], ['manual', T('Dado à mão', 'Given by hand')]]);
  const nomeVia = (v) => ([...VIAS(), ...VIAS_SEM_PAGAR()].find((x) => x[0] === v) || [v, v])[1];
  const brl = (v) => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const PERIODOS_CX = [
    ['d7', T('7 dias', '7 days'), () => [somarDias(meiaNoite(Date.now()), -6), new Date()]],
    ['d30', T('30 dias', '30 days'), () => [somarDias(meiaNoite(Date.now()), -29), new Date()]],
    PERIODOS[5], PERIODOS[6],
    ['m12', T('12 meses', '12 months'), () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 11, 1), d]; }],
    ['tudo', T('Desde o começo', 'All time'), () => { const d = new Date(); return [new Date(d.getFullYear() - 2, d.getMonth(), 1), d]; }],
  ];
  function painelAssinaturas() {
    const el = h('div', { class: 'col an asn', estilo: { gap: '14px' } });
    let periodo = { id: 'mes', faixa: PERIODOS_CX[2][2] }, dados = null, carregando = false;
    // (0.8.3) ver os valores em outra moeda (o câmbio vem do servidor, atualizado a cada 10 minutos)
    let verEm = 'BRL'; try { verEm = localStorage.getItem('aero-cx-moeda') || 'BRL'; } catch (e) { /* ok */ }
    const taxa = (m) => (m === 'BRL' ? 1 : (dados && dados.cambio && dados.cambio.taxas[m]) || 0);
    const emMoeda = (v, m) => { try { return (+v || 0).toLocaleString(undefined, { style: 'currency', currency: m }); } catch (e) { return (+v || 0).toFixed(2) + ' ' + m; } };
    const brl = (v) => (taxa(verEm) ? emMoeda((+v || 0) / taxa(verEm), verEm) : emMoeda(v, 'BRL'));
    const simbolo = () => { const t = taxa(verEm) ? verEm : 'BRL'; try { return (0).toLocaleString(undefined, { style: 'currency', currency: t, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '') || t; } catch (e) { return t; } };
    const fator = () => (taxa(verEm) ? 1 / taxa(verEm) : 1);
    const tile = (rotulo) => { const v = h('div', { class: 'an-tile-n' }, '–'), s = h('div', { class: 'peq suave' }, ' '); return { el: h('div', { class: 'vidro pad an-tile' }, h('div', { class: 'an-tile-r' }, rotulo), v, s), v, s }; };
    const tAtivas = tile(T('Assinaturas ativas', 'Active subscriptions')), tReceita = tile(T('Já entrou no total', 'Total received')), tPessoas = tile(T('Assinantes', 'Subscribers')), tPrev = tile(T('Previsão do próximo mês', 'Next month forecast'));
    const MOEDAS_VER = ['BRL', 'USD', 'EUR', 'GBP'];
    const segMoeda = U.seg(MOEDAS_VER.map((m) => [m, m]), MOEDAS_VER.includes(verEm) ? verEm : 'BRL', (m) => { verEm = m; try { localStorage.setItem('aero-cx-moeda', m); } catch (e) { /* ok */ } pintar(); });
    const cambioEl = h('div', { class: 'peq suave' }, ' ');
    const linhaMoeda = h('div', { class: 'linha asn-moeda', estilo: { gap: '10px', 'flex-wrap': 'wrap' } }, h('b', {}, T('Ver os valores em', 'Show amounts in')), segMoeda);
    el.append(linhaMoeda, cambioEl);
    el.append(h('div', { class: 'an-tiles' }, tAtivas.el, tReceita.el, tPessoas.el, tPrev.el));
    const caixaMoedas = h('div', { class: 'an-tabela asn-moedas' });
    const caixaPlanos = h('div', { class: 'asn-planos' }), caixaVias = h('div', { class: 'an-tabela asn-vias' });
    el.append(h('section', { class: 'vidro pad col', estilo: { gap: '12px' } }, h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, T('Por plano', 'By plan')), caixaPlanos));
    el.append(h('section', { class: 'vidro pad col', estilo: { gap: '8px' } }, h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, T('Para onde foi o dinheiro', 'Where the money went')), caixaVias));
    el.append(h('section', { class: 'vidro pad col', estilo: { gap: '8px' } }, h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, T('Moedas', 'Currencies')), h('div', { class: 'peq suave' }, T('Cada pagamento na moeda em que foi enviado. O total já soma tudo convertido para reais com o câmbio de agora.', 'Each payment in the currency it was sent in. The total already adds everything converted to reais at the current rate.')), caixaMoedas));
    // --- período ---
    const seg = U.seg(PERIODOS_CX.map(([id, r]) => [id, r]), 'mes', (id) => { pagRec = 0; periodo = { id, faixa: PERIODOS_CX.find((p) => p[0] === id)[2] }; carregar(); });
    seg.classList.add('quebra');
    const tituloPeriodo = h('div', { class: 'an-periodo-t' }, ' ');
    const pReceita = tile(T('Entrou no período', 'Received in the period')), pPag = tile(T('Pagamentos', 'Payments')), pNovas = tile(T('Assinantes novos', 'New subscribers')), pCanc = tile(T('Cancelamentos', 'Cancellations'));
    const grafico = h('div', { class: 'an-grafico' }), dica = h('div', { class: 'an-dica', hidden: '' }), legenda = h('div', { class: 'asn-legenda' });
    const tabela = h('div', { class: 'an-tabela' }), verTabela = h('details', { class: 'mais' }, h('summary', {}, T('Ver em tabela', 'View as table')), tabela);
    const recentes = h('div', { class: 'an-tabela asn-recentes' }), filtroRec = h('div', {}), recentesNav = h('div', {}), somaEl = h('div', { class: 'peq asn-soma', hidden: '' });
    let filtroMes = 'periodo', filtroMoeda = '', pagRec = 0;
    const erroEl = h('p', { class: 'msg erro', hidden: '' });
    el.append(h('section', { class: 'vidro pad col', estilo: { gap: '12px' } },
      h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', gap: '8px', 'justify-content': 'space-between' } }, h('h3', { estilo: { margin: 0, 'font-size': '17px' } }, T('Período', 'Period')), tituloPeriodo),
      seg, erroEl,
      h('div', { class: 'an-tiles an-tiles-3' }, pReceita.el, pPag.el, pNovas.el, pCanc.el),
      h('div', { class: 'an-graf-cab' }, h('b', {}, T('Quanto entrou', 'Money in')), h('span', { class: 'peq suave an-graf-sub' }, ' ')), legenda,
      h('div', { class: 'an-graf-caixa' }, grafico, dica), verTabela,
      h('div', { class: 'linha', estilo: { 'justify-content': 'space-between', 'flex-wrap': 'wrap', gap: '8px' } }, h('b', {}, T('Últimos pagamentos', 'Latest payments')), filtroRec), somaEl, recentes, recentesNav));

    const fmtDia = (t, ano) => new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', ...(ano ? { year: 'numeric' } : {}) });
    const fmtMes = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    const fmtFaixa = (de, ate) => new Date(de).toLocaleDateString() + ' – ' + new Date(ate - 1).toLocaleDateString();
    const nomePlano = (p) => (dados && dados.planos[p] ? dados.planos[p].nome : p || T('Doação', 'Donation')); // (0.8.5) sem plano: doação
    const ponto = (v) => h('span', { class: 'asn-ponto asn-v-' + v });

    function pintar() {
      const r = dados; if (!r) return;
      const pl = Object.entries(r.planos), totAtivas = pl.reduce((s, [, p]) => s + p.ativas, 0), totPagas = pl.reduce((s, [, p]) => s + p.ativasPagas, 0);
      tAtivas.v.textContent = num(totAtivas); tAtivas.s.textContent = T(`${num(totPagas)} pagas · ${num(totAtivas - totPagas)} presentes ou dadas à mão`, `${num(totPagas)} paid · ${num(totAtivas - totPagas)} gifts or given by hand`);
      tReceita.v.textContent = brl(r.receita); tReceita.s.textContent = T(`${num(r.pagamentos)} pagamentos desde o começo`, `${num(r.pagamentos)} payments all time`);
      tPessoas.v.textContent = num(r.assinantes); tPessoas.s.textContent = T('pessoas que já pagaram', 'people who have paid');
      tPrev.v.textContent = brl(r.previsao.total);
      tPrev.s.textContent = T(`só o que renova sozinho: ${brl(r.previsao.cartao)} no cartão · ${brl(r.previsao.kofi)} no Ko-fi`, `only what renews by itself: ${brl(r.previsao.cartao)} card · ${brl(r.previsao.kofi)} Ko-fi`) + (r.previsao.avulsas ? T(` · ${num(r.previsao.avulsas)} no PIX não contam`, ` · ${num(r.previsao.avulsas)} via PIX don't count`) : '');
      // (0.8.3) cada moeda como chegou e quanto deu em reais
      const ms = Object.entries(r.moedas || {}).sort((a, b) => b[1].brl - a[1].brl);
      caixaMoedas.replaceChildren(ms.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, T('Moeda', 'Currency')), h('th', {}, T('Como chegou', 'As received')), h('th', {}, T('Em reais agora', 'In reais now')), h('th', {}, T('Câmbio', 'Rate')), h('th', {}, T('Pagamentos', 'Payments')))),
        h('tbody', {}, ms.map(([m, x]) => h('tr', {}, h('td', {}, h('b', {}, m)), h('td', {}, emMoeda(x.valor, m)), h('td', {}, x.taxa ? emMoeda(x.brl, 'BRL') : h('span', { class: 'suave' }, T('sem câmbio', 'no rate'))), h('td', {}, m === 'BRL' ? '—' : x.taxa ? '1 ' + m + ' = ' + emMoeda(x.taxa, 'BRL') : '—'), h('td', {}, num(x.pagamentos))))))
        : h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Nenhum pagamento ainda.', 'No payments yet.')));
      const cb = r.cambio || {};
      linhaMoeda.hidden = !cb.t; // (0.8.3) sem câmbio do servidor não há para o que converter: a troca de moeda só aparece quando funciona
      cambioEl.textContent = cb.t ? T('Câmbio de ', 'Rates from ') + new Date(cb.t).toLocaleString() + (cb.velho ? T(' (sem internet agora: o último que deu para buscar)', ' (offline: the last one fetched)') : '') + ' · ' + Object.entries(cb.taxas || {}).filter(([m]) => ['USD', 'EUR', 'GBP'].includes(m)).map(([m, v]) => m + ' ' + emMoeda(v, 'BRL')).join(' · ') : T('Sem câmbio ainda: os valores de fora ficam fora do total.', 'No rates yet: foreign amounts stay out of the total.');
      // por plano
      caixaPlanos.replaceChildren(...pl.map(([id, p]) => h('div', { class: 'asn-plano asn-p-' + id },
        h('div', { class: 'linha entre' }, h('b', {}, p.nome), h('span', { class: 'peq suave' }, brl(p.preco) + T('/mês', '/mo'))),
        h('div', { class: 'asn-num' }, num(p.ativas), h('small', {}, T(' ativas', ' active'))),
        h('dl', { class: 'asn-dl' },
          h('dt', {}, T('Pagas agora', 'Paid now')), h('dd', {}, num(p.ativasPagas)),
          h('dt', {}, T('Pagamentos no total', 'Payments all time')), h('dd', {}, num(p.pagas)),
          h('dt', {}, T('Entrou no total', 'Total received')), h('dd', {}, brl(p.receita)),
          h('dt', {}, T('Canceladas', 'Cancelled')), h('dd', {}, num(p.canceladas)),
          h('dt', {}, T('Venceram sem renovar', 'Ended without renewing')), h('dd', {}, num(p.venceram))),
        Object.keys(p.porVia).length ? h('div', { class: 'asn-porvia' }, ...Object.entries(p.porVia).map(([v, n]) => h('span', { class: 'pilula asn-pil' }, ponto(v), nomeVia(v) + ': ' + num(n)))) : h('div', { class: 'peq suave' }, T('Nenhuma ativa.', 'None active.')))));
      // por onde entrou
      const outras = (o) => { const t = Object.entries(o || {}).map(([m, v]) => emMoeda(v, m)).join(' + '); return t ? T(' (inclui ', ' (includes ') + t + ')' : ''; };
      caixaVias.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, T('Onde', 'Where')), h('th', {}, T('Pagamentos', 'Payments')), h('th', {}, T('Total', 'Total')), h('th', {}, T('Ativas agora', 'Active now')))),
        h('tbody', {}, ...[...VIAS(), ...VIAS_SEM_PAGAR()].filter(([v]) => v !== 'mp' || r.vias.mp.pagamentos).map(([v, nome]) => { const x = r.vias[v] || {}; const pago = !VIAS_SEM_PAGAR().some((y) => y[0] === v);
          return h('tr', {}, h('td', {}, ponto(v), ' ', nome), h('td', {}, pago ? num(x.pagamentos) : '—'), h('td', {}, pago ? brl(x.receita) + outras(x.outras) : '—'), h('td', {}, num(x.ativas))); }))));
      // período
      const P = r.periodo, porDia = P.grao === 'dia';
      tituloPeriodo.textContent = fmtFaixa(P.de, P.ate);
      pReceita.v.textContent = brl(P.receita); pReceita.s.textContent = (verEm === 'BRL' ? T('em reais (o de fora já convertido)', 'in reais (foreign already converted)') : T('convertido para ', 'converted to ') + verEm) + (P.estornos ? T(` · ${num(P.estornos)} estornos descontados`, ` · ${num(P.estornos)} refunds taken out`) : '');
      pPag.v.textContent = num(P.pagamentos); pPag.s.textContent = T('renovações incluídas', 'renewals included');
      pNovas.v.textContent = num(P.novas); pNovas.s.textContent = T('primeiro pagamento no período', 'first payment in the period');
      pCanc.v.textContent = num(P.canceladas); pCanc.s.textContent = T('pediram para não renovar', 'asked not to renew');
      el.querySelector('.an-graf-sub').textContent = porDia ? T('a cada dia, por onde entrou', 'each day, by where it came from') : T('a cada mês, por onde entrou', 'each month, by where it came from');
      const usadas = VIAS().filter(([v]) => P.serie.some((x) => x.via[v]));
      legenda.replaceChildren(...(usadas.length ? usadas : VIAS().slice(0, 4)).map(([v, nome]) => h('span', { class: 'asn-leg' }, ponto(v), nome)));
      desenhar(P, porDia);
      const fmt = (t) => (porDia ? fmtDia(t, true) : fmtMes(t));
      tabela.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, porDia ? T('Dia', 'Day') : T('Mês', 'Month')), h('th', {}, T('Entrou', 'In')), h('th', {}, T('Pagamentos', 'Payments')), h('th', {}, T('Novos', 'New')), h('th', {}, T('Cancelamentos', 'Cancellations')))),
        h('tbody', {}, P.serie.filter((x) => x.t <= r.agora).reverse().map((x) => h('tr', {}, h('td', {}, fmt(x.t)), h('td', {}, brl(x.valor)), h('td', {}, num(x.n)), h('td', {}, num(x.novas)), h('td', {}, num(x.canceladas)))))));
      // (0.8.3) páginas de 10 e filtro por mês (no período escolhido acima, ou um mês qualquer de todo o histórico)
      const todos = P.historico || P.recentes, chaveMes = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
      const meses = [...new Set(todos.map((x) => chaveMes(x.t)))];
      if (filtroMes !== 'periodo' && !meses.includes(filtroMes)) filtroMes = 'periodo';
      const doMes = filtroMes === 'periodo' ? todos.filter((x) => x.t >= P.de && x.t < P.ate) : todos.filter((x) => chaveMes(x.t) === filtroMes);
      // (0.8.4) filtro por moeda: só os pagamentos que chegaram em reais, só os em dólar... (o total lá em cima continua somando tudo)
      const moedasLista = [...new Set(todos.filter((x) => x.tipo !== 'cancelou' && x.moeda).map((x) => x.moeda))].sort((a, b) => (a === 'BRL' ? -1 : b === 'BRL' ? 1 : a.localeCompare(b)));
      if (filtroMoeda && !moedasLista.includes(filtroMoeda)) filtroMoeda = '';
      const lista = filtroMoeda ? doMes.filter((x) => x.moeda === filtroMoeda && x.tipo !== 'cancelou') : doMes;
      const somaMoeda = filtroMoeda ? lista.reduce((t, x) => t + (x.tipo === 'estornou' ? -1 : 1) * (+x.valor || 0), 0) : 0;
      const nPags = Math.max(1, Math.ceil(lista.length / 10)); pagRec = Math.min(pagRec, nPags - 1);
      const pagina = lista.slice(pagRec * 10, pagRec * 10 + 10);
      const selMes = h('select', { class: 'campo asn-mes', 'aria-label': T('Filtrar por mês', 'Filter by month') }, h('option', { value: 'periodo' }, T('No período escolhido', 'In the chosen period')),
        ...meses.map((m) => { const [a, mm] = m.split('-'); return h('option', { value: m }, new Date(+a, +mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })); }));
      selMes.value = filtroMes; selMes.addEventListener('change', () => { filtroMes = selMes.value; pagRec = 0; pintar(); });
      const btnPag = (ic, tit, d, off) => U.btn('', { icone: ic, tipo: 'sec', redondo: true, peq: true, titulo: tit, onclick: () => { pagRec += d; pintar(); } });
      const navRec = h('div', { class: 'linha asn-pags' }, (() => { const b = btnPag('setaE', T('Página anterior', 'Previous page'), -1); b.disabled = pagRec === 0; return b; })(),
        h('span', { class: 'peq suave' }, T('Página ', 'Page ') + (pagRec + 1) + T(' de ', ' of ') + nPags + ' · ' + num(lista.length) + T(' registros', ' records')),
        (() => { const b = btnPag('setaD', T('Próxima página', 'Next page'), 1); b.disabled = pagRec >= nPags - 1; return b; })());
      const selMoeda = h('select', { class: 'campo asn-mes', 'aria-label': T('Filtrar por moeda', 'Filter by currency') }, h('option', { value: '' }, T('Todas as moedas', 'All currencies')),
        ...moedasLista.map((m) => h('option', { value: m }, m === 'BRL' ? T('Só em reais (BRL)', 'Only in reais (BRL)') : T('Só em ', 'Only in ') + m)));
      selMoeda.value = filtroMoeda; selMoeda.addEventListener('change', () => { filtroMoeda = selMoeda.value; pagRec = 0; pintar(); });
      filtroRec.replaceChildren(h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } }, moedasLista.length > 1 || filtroMoeda ? selMoeda : null, selMes));
      somaEl.hidden = !filtroMoeda;
      somaEl.textContent = filtroMoeda ? T('Soma em ', 'Total in ') + filtroMoeda + ': ' + emMoeda(somaMoeda, filtroMoeda) + ' · ' + num(lista.length) + T(' registros', ' records') + (filtroMoeda !== 'BRL' && taxa(filtroMoeda) ? ' (≈ ' + emMoeda(somaMoeda * taxa(filtroMoeda), 'BRL') + ')' : '') : '';
      recentes.replaceChildren(pagina.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, T('Quando', 'When')), h('th', {}, T('Conta', 'Account')), h('th', {}, T('Plano', 'Plan')), h('th', {}, T('Para onde', 'Where to')), h('th', {}, T('Valor', 'Amount')), h('th', {}, ''))),
        h('tbody', {}, pagina.map((x) => h('tr', { class: x.tipo === 'cancelou' ? 'asn-cancelou' : x.tipo === 'estornou' ? 'asn-estornou' : '' },
          h('td', {}, new Date(x.t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })),
          h('td', {}, x.nome ? x.nome + (x.tag ? ' #' + x.tag : '') : h('span', { class: 'suave' }, T('não achada', 'not found'))),
          h('td', {}, nomePlano(x.plano)), h('td', {}, ponto(x.via), ' ', nomeVia(x.via)),
          h('td', {}, x.tipo === 'cancelou' ? T('cancelou', 'cancelled') : [x.tipo === 'estornou' ? T('estornou −', 'refunded −') : '', (x.moeda === verEm || (x.moeda === 'BRL' && !taxa(verEm)) ? emMoeda(x.valor, x.moeda) : x.moeda === 'BRL' ? brl(x.valor) : h('span', { title: x.brl ? '≈ ' + emMoeda(x.brl, 'BRL') : '' }, emMoeda(x.valor, x.moeda), x.brl ? h('small', { class: 'suave' }, ' ≈ ' + brl(x.brl)) : null))]),
          // (0.8.3) o X aparece com o mouse em cima da linha: tira o registro do caixa e de todas as contas (entrou no período,
          // pagamentos, assinantes novos, gráfico...), que são refeitas pelo servidor. Não mexe no plano da pessoa.
          h('td', {}, x.id ? h('button', { type: 'button', class: 'asn-x', title: T('Remover da fatura', 'Remove from the records'), 'aria-label': T('Remover da fatura', 'Remove from the records'), onclick: async () => {
            if (!(await U.confirmar(T('Remover este pagamento? Ele sai de todas as somas do caixa. O plano da pessoa não muda.', 'Remove this payment? It leaves every total. The person\'s plan does not change.'), { perigo: true, sim: T('Remover', 'Remove') }))) return;
            try { await API.req('admin/assinatura/apagar', { id: x.id }); A.som.tocar('estourar'); carregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
          } }, A.icone('fechar', 14)) : null)))))
        : h('p', { class: 'peq suave', estilo: { margin: 0 } }, filtroMes === 'periodo' ? T('Nenhum pagamento no período.', 'No payments in the period.') : T('Nenhum pagamento nesse mês.', 'No payments in that month.')));
      navRec.hidden = nPags <= 1; recentesNav.replaceChildren(navRec);
    }

    // barras empilhadas: quanto entrou em cada dia/mês, uma cor para cada lugar (a legenda fica em cima; passar o mouse mostra os valores)
    function desenhar(P, porDia) {
      const W = Math.max(320, grafico.clientWidth || 700), Hh = 220, mE = 58, mD = 8, mT = 10, mB = 26;
      const s = P.serie, n = s.length, max = Math.max(10, ...s.map((x) => x.valor));
      const passo = (() => { const bruto = max / 4, e = Math.pow(10, Math.floor(Math.log10(bruto))); return [1, 2, 2.5, 5, 10].map((m) => m * e).find((m) => m >= bruto); })(), topo = Math.ceil(max / passo) * passo;
      const x0 = mE, larg = W - mE - mD, alt = Hh - mT - mB, bw = larg / n, gap = Math.min(2, bw * 0.25);
      const y = (v) => mT + alt - (v / topo) * alt;
      const g = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, width: '100%', height: Hh, role: 'img', 'aria-label': T('Gráfico do que entrou', 'Chart of money in') });
      for (let v = 0; v <= topo + 0.001; v += passo) {
        g.append(svg('line', { x1: x0, x2: W - mD, y1: y(v), y2: y(v), class: v ? 'an-grade' : 'an-base' }));
        const t = svg('text', { x: x0 - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'an-eixo' }); t.textContent = simbolo() + ' ' + num(Math.round(v * fator() * 100) / 100); g.append(t);
      }
      const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(larg / 52))));
      s.forEach((x, i) => {
        const bx = x0 + i * bw + gap / 2, w = Math.max(1, bw - gap);
        let base = 0; const partes = VIAS().filter(([v]) => x.via[v] > 0);
        partes.forEach(([v], k) => {
          const v0 = base, v1 = base + x.via[v]; base = v1;
          const yt = y(v1), yb = y(v0), hgt = yb - yt; if (hgt <= 0) return;
          const topoDaPilha = k === partes.length - 1, r = topoDaPilha ? Math.min(4, w / 2, hgt) : 0, sep = k ? 1 : 0; // 1px entre as partes
          g.append(svg('path', { class: 'asn-barra asn-v-' + v, d: `M${bx},${yb - sep}V${yt + r}Q${bx},${yt} ${bx + r},${yt}H${bx + w - r}Q${bx + w},${yt} ${bx + w},${yt + r}V${yb - sep}Z` }));
        });
        if (i % cada === 0) { const t = svg('text', { x: bx + w / 2, y: Hh - 8, 'text-anchor': 'middle', class: 'an-eixo' }); t.textContent = porDia ? fmtDia(x.t) : fmtMes(x.t); g.append(t); }
        const alvo = svg('rect', { x: x0 + i * bw, y: mT, width: bw, height: alt, class: 'an-alvo' });
        alvo.addEventListener('mouseenter', () => {
          dica.hidden = false;
          dica.replaceChildren(h('b', {}, porDia ? fmtDia(x.t, true) : fmtMes(x.t)), h('div', {}, T('Entrou: ', 'In: ') + brl(x.valor)),
            ...partes.map(([v, nome]) => h('div', { class: 'asn-dica-l' }, ponto(v), nome + ': ' + brl(x.via[v]))),
            x.n ? h('div', {}, T(`${num(x.n)} pagamentos`, `${num(x.n)} payments`)) : null, x.canceladas ? h('div', {}, T(`${num(x.canceladas)} cancelamentos`, `${num(x.canceladas)} cancellations`)) : null);
          const px = ((x0 + (i + 0.5) * bw) / W) * grafico.clientWidth;
          dica.style.left = Math.max(80, Math.min(grafico.clientWidth - 80, px)) + 'px';
          alvo.classList.add('sel');
        });
        alvo.addEventListener('mouseleave', () => { dica.hidden = true; alvo.classList.remove('sel'); });
        g.append(alvo);
      });
      grafico.replaceChildren(g);
    }

    async function carregar() {
      if (carregando) { carregar.depois = true; return; }
      carregando = true; el.classList.add('carregando');
      const [de, ate] = periodo.faixa();
      try { dados = await API.req('admin/assinaturas', { de: +de, ate: +ate, fuso: new Date().getTimezoneOffset() }); erroEl.hidden = true; pintar(); } catch (e) { erroEl.hidden = false; erroEl.textContent = e.message; }
      carregando = false; el.classList.remove('carregando');
      if (carregar.depois) { carregar.depois = false; carregar(); }
    }
    const iv = setInterval(() => { if (!document.hidden && el.isConnected) carregar(); }, 120000);
    let rt = 0; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => dados && desenhar(dados.periodo, dados.periodo.grao === 'dia'), 120); }); ro.observe(grafico);
    carregar();
    return { el, carregar, limpar: () => { clearInterval(iv); ro.disconnect(); clearTimeout(rt); } };
  }

  A.analytics = { painel, painelAssinaturas };
})();
