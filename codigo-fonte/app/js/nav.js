// Aero Stream - controle (gamepad) navegando pelo app inteiro (v0.4): direcional/analógico esquerdo move, A confirma, B volta,
// LB/RB trocam de aba (ou de área na sala), analógico direito rola, X/Y atalhos. Funciona com vários controles ao mesmo tempo,
// respeita o layout escolhido (no Nintendo o "A" fica à direita), mostra legendas na tela e não deixa o foco ficar preso
// (slider tem "modo ajuste"; campo de texto sai com B ou para cima/baixo). Avisa também qual foi a última forma de entrada
// (mouse, teclado ou controle), para o contorno de foco aparecer só quando precisa. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const FOCAVEL = 'summary,button:not([disabled]),[role=button]:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  const estado = new Map(); // indice -> { ativos: Set, rep: {} }
  let raf = 0, espera = 0, ultimoT = 0, ajuste = null;

  const telaControles = () => !!document.querySelector('.tela.ativa.controles') && !document.querySelector('#modais .fundo-modal:not(.fechando)');
  // Os controles virtuais que ESTE computador criou para os amigos (jogador 1 a 4) aparecem para o navegador como um "Xbox 360" de verdade.
  // Enquanto algum estiver ligado, o menu do Aero ignora esse tipo de controle: antes, os botões do amigo também mexiam no menu do dono
  // (com som), em vez de irem só para o jogo.
  const virtualDoAmigo = (g) => A.entrada && A.entrada.slots && A.entrada.slots.some(Boolean) && /aero stream|045e.{0,20}028e|x-?box 360|xinput/i.test(g.id || '');
  const lerPads = () => (navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((g) => g && !virtualDoAmigo(g)) : []);
  const bloqueado = () => document.documentElement.dataset.lock === '1'; // controle remoto ativo: o controle é do jogo, não do menu

  A.pad = {
    captura: false, // true enquanto a tela de Controles está remapeando/calibrando: o resto do app ignora o controle por completo
    lista: () => lerPads().map((g) => ({ indice: g.index, nome: g.id.replace(/\s*\(.*$/, '').slice(0, 48) || 'Controle', id: g.id.slice(0, 80), botoes: g.buttons.length, eixos: g.axes.length, mapeamento: g.mapping })),
    conectado: () => lerPads().length > 0,
    iniciar() {
      addEventListener('gamepadconnected', (e) => { A.log.info('controle conectado', e.gamepad.id); A.evt.emit('pad:conectou', e.gamepad); document.documentElement.dataset.padok = '1'; loop(); });
      addEventListener('gamepaddisconnected', (e) => { estado.delete(e.gamepad.index); A.evt.emit('pad:desconectou', e.gamepad); if (!lerPads().length) delete document.documentElement.dataset.padok; });
      // (1.0.2) clique de mouse de verdade (não o do cursor do controle): as dicas do controle e a bolinha saem da tela na hora
      addEventListener('pointerdown', (e) => { document.documentElement.dataset.entrada = 'mouse'; if (!e.isTrusted) return; if (cur.on) cursorLigar(false, true); pedirDicas(); atualizarLegenda(); }, true);
      addEventListener('keydown', (e) => { if (!bloqueado() && !['Escape', 'Shift', 'Alt', 'AltGraph', 'Meta', 'OS', 'Control', 'CapsLock', 'Super', 'Hyper'].includes(e.key)) document.documentElement.dataset.entrada = 'teclado'; }, true);
      criarLegenda();
      if (A.pad.conectado()) { document.documentElement.dataset.padok = '1'; loop(); }
    },
  };

  // ---------- navegação espacial ----------
  // Itens fora da tela (mais abaixo numa aba comprida) TAMBÉM contam: o foco rola até eles. Antes só os visíveis contavam, e o direcional
  // primeiro rolava "às cegas" e depois escolhia pela geometria o que apareceu: era isso que fazia opções pularem ou nunca serem alcançadas.
  const visivel = (e) => {
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (e.closest('[inert],[hidden],.oculta,.painel.saindo,.painel.guardado')) return false; // (1.0.0) a aba que está saindo (deslizando) não conta
    // dentro de uma seção recolhida (<details> fechado) o Chrome ainda dá tamanho aos itens, mas eles não recebem foco: o controle "travava"
    // tentando ir para eles. Só o título (<summary>, que abre a seção com A) conta.
    const d = e.closest('details:not([open])'); if (d && !(e.tagName === 'SUMMARY' && e.parentElement === d)) return false;
    return true;
  };
  const naTela = (e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const popoverAberto = () => { const p = document.querySelector('#popovers .pop:not(.fechando)'); return p && window.Aero.ui._pop ? p : null; };
  function camadas() {
    const modais = document.querySelectorAll('#modais .fundo-modal:not(.fechando)');
    if (modais.length) return [modais[modais.length - 1]];
    const pop = popoverAberto();
    if (pop) return [pop]; // janelinha das setinhas da sala: o foco do controle fica dentro dela até fechar (B fecha)
    // (0.5.9-7) o menu do botão direito e o mini perfil também prendem o foco do controle até fechar (B fecha)
    const menu = document.querySelector('.menu-ctx:not(.estourando)'); if (menu) return [menu];
    const mini = document.querySelector('.mini-perfil:not(.fechando)'); if (mini) return [mini];
    const lista = [document.querySelector('.tela.ativa') || document.body];
    const t = document.getElementById('toasts'); if (t && t.querySelector('button')) lista.push(t);
    const p = document.getElementById('pip'); if (p && !p.hidden) lista.push(p);
    return lista;
  }
  function candidatos() { return camadas().flatMap((c) => Array.from(c.querySelectorAll(FOCAVEL))).filter(visivel); }
  // ---------- zonas ----------
  // Uma tela pode se dividir em zonas ([data-zona], ex.: a barra de abas e o conteúdo da aba). Com o foco numa zona, o direcional anda SÓ
  // dentro dela. Para ir a outra: data-zona-baixo / data-zona-cima dizem o nome da zona vizinha (ex.: das abas, ↓ entra no conteúdo; do conteúdo,
  // ↑ no topo volta às abas) e data-zona-voltar diz para onde o B leva. Ao entrar numa zona, o foco vai para o item [data-zona-inicio], o
  // selecionado (.sel) ou o primeiro de cima para baixo.
  const zonaDe = (e) => (e && e.closest ? e.closest('[data-zona]') : null);
  const memZona = new WeakMap(), memArea = new WeakMap(); // último item com foco em cada zona / área
  const zonaPorNome = (nome) => { for (const c of camadas()) { const z = c.querySelector('[data-zona="' + nome + '"]'); if (z) return z; } return null; };
  function entrarZona(nome) {
    const z = zonaPorNome(nome); if (!z) return false;
    const lista = Array.from(z.querySelectorAll(FOCAVEL)).filter(visivel); if (!lista.length) return false;
    const ordem = (l) => l.slice().sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
    const vis = lista.filter(naTela);
    // (1.0.0) volta para onde estava nessa zona (ex.: a conversa de antes ao voltar para o Aero Talk); senão o início dela
    const lembrado = memZona.get(z), ok = lembrado && lembrado.isConnected && lista.includes(lembrado) && nome !== 'abas';
    const alvo = (ok ? lembrado : null) || lista.find((e) => e.matches('[data-zona-inicio]')) || lista.find((e) => e.matches('[role=tab][aria-selected=true]')) || ordem(vis.length ? vis : lista)[0];
    foco(alvo); return true;
  }
  A.pad.entrarZona = entrarZona;
  // (1.0.0) trocou de aba pelo controle: o foco entra no conteúdo novo assim que ele aparece (antes ficava parado na barra de abas)
  A.pad.entrarQuandoPronto = (nome, origem) => {
    const t0 = performance.now();
    const tenta = () => {
      const at = document.activeElement;
      if (origem && at !== origem && at && at !== document.body) return; // a pessoa já foi para outro lugar
      // (1.0.2) espera a aba terminar de deslizar: o foco rolava a tela para "alcançar" o painel que ainda vinha de lado, e a troca parecia emperrar
      const deslizando = document.querySelector('.conteudo > .painel.saindo') || [...document.querySelectorAll('.conteudo > .painel:not(.guardado)')].some((p) => p.getAnimations().some((x) => x.playState === 'running' && x.effect && x.effect.target === p));
      if (deslizando && performance.now() - t0 < 1200) { setTimeout(tenta, 50); return; }
      if (entrarZona(nome)) return;
      if (performance.now() - t0 < 2000) setTimeout(tenta, 60);
    };
    setTimeout(tenta, 40);
  };
  const centro = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const ehTexto = (e) => e && (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'].includes(e.type)));

  function foco(e, som = true) { e.focus({ preventScroll: true }); if (lembrar) lembrar(e); try { e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); } catch (x) { /* ok */ } if (som) A.som.tocar('foco'); }

  // Rolagem: acha o primeiro ancestral que rola (ou o conteúdo da tela) e anda um pouco
  function rolavel(origem) {
    for (let e = origem; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 2) return e;
    }
    const centroEl = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    if (centroEl && centroEl !== origem) { const r = (function achar(e) { for (; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 2) return e; } return null; })(centroEl); if (r) return r; }
    const c = document.querySelector('#modais .modal') || document.querySelector('.tela.ativa .conteudo');
    return c && c.scrollHeight > c.clientHeight + 2 ? c : null;
  }

  A.pad.mover = (dir, tentativa = 0) => {
    document.documentElement.dataset.entrada = 'pad';
    let lista = candidatos();
    if (!lista.length) { if (tentativa < 2) requestAnimationFrame(() => requestAnimationFrame(() => A.pad.mover(dir, tentativa + 1))); return; }
    let atual = lista.includes(document.activeElement) ? document.activeElement : null;
    // saiu de um campo de texto com B: o próximo movimento parte do campo (não volta para dentro dele)
    if (!atual && semRestaurar && ultimo && lista.includes(ultimo.el)) atual = ultimo.el;
    semRestaurar = false;
    if (!atual) { // sem foco (ou o foco sumiu): volta para onde estava; senão a tela diz onde começar (data-zona-inicial); senão, o mais perto do centro
      if (restaurar(true)) return;
      const ini = camadas()[0].querySelector('[data-zona-inicial]');
      if (ini && entrarZona(ini.dataset.zona)) return;
      const vis = lista.filter(naTela); const base = vis.length ? vis : lista;
      const alvo = base.reduce((m, e) => { const c = centro(e); const d = Math.hypot(c.x - innerWidth / 2, c.y - innerHeight / 2); return !m || d < m.d ? { e, d } : m; }, null);
      foco(alvo.e); return;
    }
    const zona = zonaDe(atual);
    if (zona) { const dentro = lista.filter((e) => zona.contains(e)); if (dentro.length) lista = dentro; }
    // slider: em "modo ajuste" a esquerda e a direita mudam o valor; fora dele elas movem o foco normalmente
    if (atual.type === 'range' && ajuste === atual && (dir === 'esq' || dir === 'dir')) {
      const passo = Number(atual.step) || 1, mx = Number(atual.max), mi = Number(atual.min);
      atual.value = A.limitar(Number(atual.value) + (dir === 'dir' ? 1 : -1) * Math.max(passo, (mx - mi) / 20), mi, mx);
      atual.dispatchEvent(new Event('input', { bubbles: true })); atual.dispatchEvent(new Event('change', { bubbles: true })); A.som.tocar('foco'); return;
    }
    // campo de texto: esquerda/direita andam com o cursor do texto; quando o cursor já está na ponta (ou o campo está vazio), o foco segue
    // para o vizinho do lado (senão um botão ao lado do campo ficaria inalcançável pelo controle)
    if (ehTexto(atual) && (dir === 'esq' || dir === 'dir')) {
      let s = null, f = null, tam = 0;
      try { s = atual.selectionStart; f = atual.selectionEnd; tam = (atual.value || '').length; } catch (x) { s = null; } // email/number não expõem o cursor
      if (s !== null && f !== null) {
        if (s !== f) { const p = dir === 'esq' ? s : f; atual.setSelectionRange(p, p); return; }
        if (dir === 'esq' && s > 0) { atual.setSelectionRange(s - 1, s - 1); return; }
        if (dir === 'dir' && s < tam) { atual.setSelectionRange(s + 1, s + 1); return; }
      }
    }
    if (atual.tagName === 'SELECT' && (dir === 'esq' || dir === 'dir')) { mudarSelect(atual, dir === 'dir' ? 1 : -1); return; }
    const melhor = vizinho(atual, lista, dir);
    if (melhor) { foco(melhor); return; }
    // nada nessa direção dentro da zona: vai para a zona vizinha (se houver) ou rola a área; o foco nunca fica preso
    if (zona) {
      const prox = zona.dataset['zona' + dir[0].toUpperCase() + dir.slice(1)];
      const r = rolavel(atual);
      const podeRolar = r && r.contains(atual) && (dir === 'cima' ? r.scrollTop > 2 : dir === 'baixo' ? r.scrollTop + r.clientHeight < r.scrollHeight - 2 : false);
      if (prox && !podeRolar && entrarZona(prox)) return;
    }
    if (dir === 'cima' || dir === 'baixo') { const r = rolavel(atual); if (r) r.scrollBy({ top: dir === 'baixo' ? 160 : -160, behavior: 'smooth' }); }
  };

  // O vizinho numa direção: mede pelas BORDAS (não pelos centros) e prefere quem está na mesma linha/coluna. Pelos centros, um botão
  // pequeno ao lado de um cartão grande "ganhava" de quem estava logo abaixo, e a seleção pulava itens.
  function vizinho(atual, lista, dir) {
    const a = atual.getBoundingClientRect(), hor = dir === 'dir' || dir === 'esq';
    const ca = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const c = [];
    for (const e of lista) {
      if (e === atual || atual.contains(e) || e.contains(atual)) continue;
      const b = e.getBoundingClientRect(), cb = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      const ok = dir === 'dir' ? cb.x > ca.x + 4 && b.right > a.right - 2 : dir === 'esq' ? cb.x < ca.x - 4 && b.left < a.left + 2 : dir === 'baixo' ? cb.y > ca.y + 4 && b.bottom > a.bottom - 2 : cb.y < ca.y - 4 && b.top < a.top + 2;
      if (!ok) continue;
      const along = Math.max(0, dir === 'dir' ? b.left - a.right : dir === 'esq' ? a.left - b.right : dir === 'baixo' ? b.top - a.bottom : a.top - b.bottom);
      const sobre = hor ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const fora = sobre > 0 ? 0 : -sobre; // distância de lado (0 = mesma linha/coluna)
      const desvio = hor ? Math.abs(cb.y - ca.y) : Math.abs(cb.x - ca.x);
      c.push({ e, along, fora, desvio, sobre });
    }
    if (!c.length) return null;
    if (!hor) {
      // ↑/↓: sempre a PRÓXIMA linha (nunca pula uma linha inteira por estar "mais alinhada"); dentro dela, o mais perto na horizontal
      const m = Math.min(...c.map((x) => x.along));
      return c.filter((x) => x.along <= m + 24).sort((x, y) => (x.fora - y.fora) || (x.desvio - y.desvio))[0].e;
    }
    // ←/→: prefere quem está na mesma linha; sem ninguém nela, o mais perto
    const mesma = c.filter((x) => x.sobre > 0), pool = mesma.length ? mesma : c;
    return pool.sort((x, y) => (x.along + x.fora * 2 + x.desvio * 0.3) - (y.along + y.fora * 2 + y.desvio * 0.3))[0].e;
  }
  A.pad._vizinho = vizinho; // para os testes

  function mudarSelect(sel, passo) {
    const n = sel.options.length; if (!n) return;
    sel.selectedIndex = (sel.selectedIndex + passo + n) % n;
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); A.som.tocar('foco');
  }

  function confirmar() {
    const e = document.activeElement;
    const lista = candidatos();
    if (!e || e === document.body || !lista.includes(e)) { if (lista[0]) foco(lista[0]); return; }
    if (e.type === 'range') { ajuste = ajuste === e ? null : e; e.classList.toggle('ajustando', ajuste === e); atualizarLegenda(); A.som.tocar('click'); return; }
    if (ehTexto(e)) { e.focus(); try { e.select && e.select(); } catch (x) { /* ok */ } return; }
    if (e.tagName === 'SELECT') { mudarSelect(e, 1); return; }
    const z = zonaDe(e);
    if (z && z.dataset.zonaConfirmar) { e.click(); A.pad.entrarQuandoPronto(z.dataset.zonaConfirmar, e); return; } // A numa aba: abre e entra nela
    if (typeof e.click === 'function') e.click(); else e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // peças do desenho do controle são SVG: não têm click()
  }
  function voltar() {
    const e = document.activeElement;
    if (ajuste) { ajuste.classList.remove('ajustando'); ajuste = null; atualizarLegenda(); return; }
    if (ehTexto(e)) { semRestaurar = true; e.blur(); return; }
    const z = zonaDe(e);
    if (z && z.dataset.zonaVoltar && !document.querySelector('#modais .fundo-modal:not(.fechando)') && !popoverAberto() && entrarZona(z.dataset.zonaVoltar)) { A.som.tocar('fechar'); return; }
    const modais = document.querySelectorAll('#modais .fundo-modal:not(.fechando)');
    if (modais.length) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else if (popoverAberto()) { const ancora = A.ui._pop.ancora; A.ui._pop.fechar(); if (ancora && ancora.focus) ancora.focus({ preventScroll: true }); } // fecha a janelinha e devolve o foco para a setinha
    else if (A.ui.voltar) A.ui.voltar();
  }

  // ---------- (1.0.0) memória do foco ----------
  // O controle não perde mais o lugar: quando o item com foco some (o menu do X fechou, um filtro redesenhou a lista, a aba repintou),
  // o foco volta para o mesmo item ou para o equivalente dele (mesmo texto/dados) mais perto de onde estava, sem subir tudo de novo.
  const TRANSITORIO = '#modais, #popovers, .menu-ctx, .mini-perfil, .tv, #toasts, #pip';
  let ultimo = null, semRestaurar = false;
  const assinatura = (e) => e.tagName + '|' + (e.getAttribute('aria-label') || '') + '|' + (e.getAttribute('title') || '') + '|' + (e.textContent || '').trim().slice(0, 60) + '|' + Object.keys(e.dataset).sort().map((k) => k + '=' + e.dataset[k]).join(',');
  const AREA = '[data-area], [data-zona], aside, [role=log]';
  const areaDe = (e) => (e && e.closest ? e.closest(AREA) : null);
  function lembrar(e) {
    if (!e || !e.closest || e.closest(TRANSITORIO) || !e.closest('.tela.ativa')) return;
    semRestaurar = false;
    const a = areaDe(e), z = zonaDe(e);
    ultimo = { el: e, r: e.getBoundingClientRect(), sig: assinatura(e), area: a };
    if (a) memArea.set(a, e); if (z) memZona.set(z, e);
  }
  document.addEventListener('focusin', (ev) => lembrar(ev.target), true);
  const baseLivre = () => { const c = camadas()[0]; return c && c.matches && c.matches('.tela.ativa') ? c : null; };
  function restaurar(som) {
    const u = ultimo; if (!u || !baseLivre()) return false;
    const lista = candidatos(); if (!lista.length) return false;
    if (u.el.isConnected && lista.includes(u.el)) { foco(u.el, som); return true; }
    const cx = u.r.left + u.r.width / 2, cy = u.r.top + u.r.height / 2;
    const perto = (l) => l.reduce((m, e) => { const c = centro(e), d = Math.hypot(c.x - cx, c.y - cy); return !m || d < m.d ? { e, d } : m; }, null);
    const naArea = u.area && u.area.isConnected ? lista.filter((e) => u.area.contains(e)) : [];
    const pool = naArea.length ? naArea : lista;
    const igual = perto(pool.filter((e) => assinatura(e) === u.sig)) || (naArea.length ? perto(naArea) : null);
    if (!igual) return false;
    foco(igual.e, som); return true;
  }
  // chamado a cada quadro do controle: o foco caiu no "nada" (item sumiu, menu fechou) -> volta para o lugar
  let perdidoDesde = 0;
  function vigiarFoco(agora) {
    const at = document.activeElement;
    if (document.documentElement.dataset.entrada !== 'pad' || semRestaurar || (at && at !== document.body) || !ultimo || !baseLivre()) { perdidoDesde = 0; return; }
    if (!perdidoDesde) { perdidoDesde = agora; return; }
    if (agora - perdidoDesde > 90) { perdidoDesde = 0; if (!restaurar(false)) ultimo = null; }
  }

  // (1.0.0) rolando com o analógico direito, a seleção acompanha: o foco vai para o item visível mais perto de onde ele estava.
  // Assim, ao voltar para o direcional, a navegação continua dali (antes o foco ficava lá embaixo e o chat pulava de volta para o fim).
  let seguirT = 0;
  function seguirRolagem(r, agora) {
    if (agora - seguirT < 90) return; seguirT = agora;
    const at = document.activeElement;
    if (at && at !== document.body && !r.contains(at) && ehTexto(at)) return; // escrevendo em outro lugar: não tira o foco do campo
    const vr = r.getBoundingClientRect();
    const dentro = (e) => { const b = e.getBoundingClientRect(); return b.top >= vr.top - 2 && b.bottom <= vr.bottom + 2 && b.height > 0; };
    if (at && r.contains(at) && dentro(at)) return;
    const itens = Array.from(r.querySelectorAll(FOCAVEL)).filter((e) => visivel(e) && dentro(e)); if (!itens.length) return;
    const ar = at && at !== document.body && r.contains(at) ? at.getBoundingClientRect() : null;
    const ref = ar ? ar.top + ar.height / 2 : vr.top + vr.height / 2;
    let alvo = itens[0], md = Infinity;
    for (const e of itens) { const b = e.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - ref); if (d < md) { md = d; alvo = e; } }
    alvo.focus({ preventScroll: true }); lembrar(alvo);
  }

  // ---------- (1.0.0) áreas do layout (LT / RT) ----------
  // Cada pedaço do layout é uma área: o cartão + as abas, a lista de conversas, o cabeçalho da conversa, as mensagens, a caixa de escrever...
  // (as zonas das telas, as listas laterais <aside>, o histórico [role=log] e o que estiver marcado com data-area). LT e RT pulam de uma
  // para a outra, na ordem do layout (da esquerda para a direita, de cima para baixo), e cada área lembra o item em que você estava.
  function areas() {
    const base = baseLivre(); if (!base) return [];
    const mapa = new Map();
    for (const e of base.querySelectorAll(FOCAVEL)) {
      const a = areaDe(e); if (!a || !base.contains(a)) continue;
      let l = mapa.get(a); if (!l) mapa.set(a, (l = [])); l.push(e);
    }
    const out = [];
    for (const [a, l] of mapa) {
      if (!naTela(a)) continue;
      const itens = l.filter(visivel); if (!itens.length) continue;
      out.push({ a, itens, r: a.getBoundingClientRect() });
    }
    // a área "de fora" (ex.: o conteúdo da aba inteiro) começa onde estão os itens dela, não onde começa a caixa
    for (const x of out) { const rs = x.itens.map((e) => e.getBoundingClientRect()); x.l = Math.max(x.r.left, Math.min(...rs.map((r) => r.left))); x.t = Math.max(x.r.top, Math.min(...rs.map((r) => r.top))); }
    out.sort((x, y) => (Math.round(x.l / 90) - Math.round(y.l / 90)) || (x.t - y.t));
    return out;
  }
  function pularArea(d) {
    const l = areas(); if (!l.length) return;
    const at = document.activeElement, aAt = areaDe(at);
    const i = l.findIndex((x) => x.a === aAt);
    const j = i < 0 ? (d > 0 ? 0 : l.length - 1) : (i + d + l.length) % l.length;
    const { a, itens } = l[j];
    const m = memArea.get(a);
    if (m && m.isConnected && itens.includes(m)) { foco(m); return; }
    const vis = itens.filter(naTela), base = vis.length ? vis : itens;
    const marcado = base.find((e) => e.matches('[data-zona-inicio], .sel, [aria-selected=true], [aria-current]:not([aria-current=false])'));
    if (marcado) { foco(marcado); return; }
    const ord = base.slice().sort((x, y) => { const rx = x.getBoundingClientRect(), ry = y.getBoundingClientRect(); return (rx.top - ry.top) || (rx.left - ry.left); });
    foco(a.matches('[role=log]') ? ord[ord.length - 1] : ord[0]); // nas mensagens, começa pela mais nova (a de baixo)
  }

  // ---------- (1.0.0) busca rápida (Y) ----------
  const BUSCA_GEN = /^(procurar|pesquisar|buscar|search|find)/i;
  function campoBusca() {
    const base = baseLivre(); if (!base) return null;
    const marcados = Array.from(base.querySelectorAll('[data-busca]')).filter(visivel);
    if (marcados.length) return marcados[0];
    return Array.from(base.querySelectorAll('input:not([type=hidden]):not([disabled])')).filter(visivel).find((e) => e.type === 'search' || BUSCA_GEN.test(e.getAttribute('aria-label') || e.placeholder || '')) || null;
  }
  function buscar() {
    const at = document.activeElement;
    if (ehTexto(at)) { if (A.tecladoVirtual && !A.tecladoVirtual.aberto()) A.tecladoVirtual.abrir(at); return; } // num campo: Y abre o teclado
    const c = campoBusca(); if (!c) return;
    foco(c); try { c.select(); } catch (x) { /* ok */ }
    if (A.tecladoVirtual && !A.tecladoVirtual.aberto()) A.tecladoVirtual.abrir(c); // já abre o teclado do controle para digitar
  }

  // ---------- (1.0.0) cursor do controle (botão Home) ----------
  // Uma bolinha na tela que o analógico esquerdo move como um mouse: A clica, X é o botão direito, RS rola o que está embaixo dela,
  // B ou Home de novo guardam a bolinha. O direcional também guarda e segue navegando a partir do item embaixo dela.
  const cur = { on: false, x: 0, y: 0, el: null, sob: null };
  function cursorLigar(on, quieto) {
    if (on === cur.on) return;
    cur.on = on;
    if (!cur.el) { cur.el = h('div', { id: 'cursor-pad', 'aria-hidden': 'true' }); document.body.append(cur.el); }
    if (on) {
      const at = document.activeElement, r = at && at !== document.body && at.getBoundingClientRect ? at.getBoundingClientRect() : null;
      cur.x = r && r.width ? r.left + r.width / 2 : innerWidth / 2; cur.y = r && r.height ? r.top + r.height / 2 : innerHeight / 2;
      cur.el.classList.add('on'); cursorPintar(); A.som.tocar('pop-abrir');
    } else { cur.el.classList.remove('on', 'clicavel'); pararHover(); cur.sob = null; if (!quieto) A.som.tocar('fechar'); }
    atualizarLegenda();
  }
  function cursorPintar() {
    cur.x = A.limitar(cur.x, 2, innerWidth - 2); cur.y = A.limitar(cur.y, 2, innerHeight - 2);
    // (1.0.2) "translate" e não "transform": o "scale" de quando está em cima de algo clicável multiplicava a POSIÇÃO também (a bolinha
    // aparecia até 32% mais para baixo e para a direita de onde o clique caía: mirando numa DM de baixo, abria uma de cima)
    cur.el.style.translate = `${cur.x}px ${cur.y}px`;
    const sob = document.elementFromPoint(cur.x, cur.y);
    pedirDicas(); passar(cur.sob, sob); cur.sob = sob; cur.el.classList.toggle('clicavel', clicavel(sob));
  }
  // (1.0.6) a bolinha "passa o mouse" como o mouse de verdade: em cima de um vídeo aparecem os controles dele, os menus que abrem com o mouse
  // em cima abrem, as dicas aparecem. No app do PC ela move o mouse de dentro da janela (o :hover do CSS funciona igual ao do mouse);
  // no site e no celular vão os eventos de mouse para o que está embaixo e a classe .pad-hover marca o caminho até ele
  let hoverEls = [], ultMov = 0;
  const caminho = (e) => { const l = []; for (let x = e; x && x.nodeType === 1; x = x.parentElement) l.push(x); return l; };
  function passar(antes, agora) {
    const pc = window.aero && window.aero.moverMouse;
    if (pc) { const t = performance.now(); if (agora !== antes || t - ultMov > 30) { ultMov = t; try { window.aero.moverMouse(cur.x, cur.y); } catch (x) { /* ok */ } } return; }
    const o = { bubbles: true, cancelable: true, composed: true, clientX: cur.x, clientY: cur.y, view: window, pointerType: 'mouse', isPrimary: true, pointerId: 1 };
    if (agora !== antes) {
      const novos = agora ? caminho(agora) : [];
      for (const e of hoverEls) if (!novos.includes(e)) e.classList.remove('pad-hover');
      if (antes && antes.isConnected) { antes.dispatchEvent(new PointerEvent('pointerout', { ...o, relatedTarget: agora })); antes.dispatchEvent(new MouseEvent('mouseout', { ...o, relatedTarget: agora })); }
      for (const e of hoverEls) if (!novos.includes(e) && e.isConnected) { e.dispatchEvent(new PointerEvent('pointerleave', { ...o, bubbles: false })); e.dispatchEvent(new MouseEvent('mouseleave', { ...o, bubbles: false })); }
      if (agora) {
        agora.dispatchEvent(new PointerEvent('pointerover', { ...o, relatedTarget: antes })); agora.dispatchEvent(new MouseEvent('mouseover', { ...o, relatedTarget: antes }));
        for (const e of novos) if (!hoverEls.includes(e)) { e.dispatchEvent(new PointerEvent('pointerenter', { ...o, bubbles: false })); e.dispatchEvent(new MouseEvent('mouseenter', { ...o, bubbles: false })); }
      }
      hoverEls = novos; for (const e of novos) e.classList.add('pad-hover');
    }
    if (agora) { agora.dispatchEvent(new PointerEvent('pointermove', o)); agora.dispatchEvent(new MouseEvent('mousemove', o)); }
  }
  function pararHover() {
    if (window.aero && window.aero.moverMouse) { try { window.aero.moverMouse(-1, -1); } catch (x) { /* ok */ } }
    for (const e of hoverEls) e.classList.remove('pad-hover'); hoverEls = [];
  }
  // (1.0.2) só conta como clicável o que é um controle de verdade (botão, link, campo, item com a mãozinha). Antes valia qualquer coisa com
  // menu de botão direito ou foco por teclado: a lateral inteira, o topo e cada mensagem acendiam a bolinha mesmo no espaço vazio
  const CONTROLE = 'summary,button:not([disabled]),[role=button]:not([disabled]),[role=tab],[role=option],[role=radio],[role=checkbox],[role=switch],[role=menuitem],input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],label';
  function clicavel(sob) {
    if (!sob || !sob.closest) return false;
    return !!sob.closest(CONTROLE) || getComputedStyle(sob).cursor === 'pointer'; // (o cursor do CSS é herdado: o filho de algo com a mãozinha também tem)
  }
  function cursorClicar(direito) {
    const alvo = document.elementFromPoint(cur.x, cur.y); if (!alvo) return;
    const o = { bubbles: true, cancelable: true, composed: true, clientX: cur.x, clientY: cur.y, screenX: cur.x, screenY: cur.y, button: direito ? 2 : 0, buttons: direito ? 2 : 1, view: window };
    alvo.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerType: 'mouse', isPrimary: true, pointerId: 1 }));
    alvo.dispatchEvent(new MouseEvent('mousedown', o));
    const f = alvo.closest && alvo.closest(FOCAVEL); if (f && document.activeElement !== f) f.focus({ preventScroll: true });
    alvo.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 }));
    alvo.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
    if (direito) alvo.dispatchEvent(new MouseEvent('contextmenu', o)); else alvo.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 }));
    document.documentElement.dataset.entrada = 'pad'; // o pointerdown acima marcou "mouse": a legenda do controle continua
    A.som.tocar('click'); requestAnimationFrame(cursorPintar);
    // (1.0.2) clicou num campo de texto: o teclado do controle abre e a bolinha fica pausada (escondida) até o teclado fechar
    if (!direito && f && ehTexto(f) && A.tecladoVirtual && !A.tecladoVirtual.aberto()) A.tecladoVirtual.abrir(f);
  }
  function cursorQuadro(st, ativos, n, dt) {
    const novo = (k) => ativos.has(k) && !st.ativos.has(k);
    if (novo('home') || novo('b')) { // (1.0.2) fechou a bolinha: a seleção vai para o item mais perto de onde ela estava
      const x = cur.x, y = cur.y; cursorLigar(false);
      let melhor = null, dm = Infinity;
      for (const e of candidatos()) { const r = e.getBoundingClientRect(); const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = dx * dx + dy * dy; if (d < dm) { dm = d; melhor = e; } }
      if (melhor) foco(melhor, false);
      return;
    }
    if (['cima', 'baixo', 'esq', 'dir'].some((k) => ativos.has(k) && !st.ativos.has(k) && !(Math.abs(n.a[0]) > 0.6 || Math.abs(n.a[1]) > 0.6))) {
      // direcional: guarda a bolinha e continua do item que estava embaixo dela
      const sob = cur.sob && cur.sob.closest && cur.sob.closest(FOCAVEL); cursorLigar(false);
      if (sob && candidatos().includes(sob)) foco(sob, false);
      return 'dpad';
    }
    if (novo('a')) cursorClicar(false);
    if (novo('x')) cursorClicar(true);
    const lx = n.a[0], ly = n.a[1], m = Math.hypot(lx, ly);
    if (m > 0.02) { const v = 260 + 1500 * m * m; cur.x += (lx / m) * v * m * dt; cur.y += (ly / m) * v * m * dt; cursorPintar(); }
    const ry = n.a[3], rx = n.a[2];
    if (Math.abs(ry) > 0.05 || Math.abs(rx) > 0.05) { const r = rolavel(cur.sob || null); if (r) { r.scrollTop += ry * 1100 * dt; r.scrollLeft += rx * 1100 * dt; } }
  }
  addEventListener('resize', () => { if (cur.on) cursorPintar(); });
  A.evt.on('teclado', (aberto) => { if (!cur.el) return; cur.el.classList.toggle('pausado', !!aberto); if (!aberto && cur.on) requestAnimationFrame(cursorPintar); });
  A.evt.on('tela', () => { ultimo = null; cursorLigar(false); });

  // ---------- botões lógicos (já com layout, remapeamento e calibração) ----------
  function facesDe(lay) { return lay && lay.confirmar === 1 ? { a: 1, b: 0, x: 3, y: 2 } : { a: 0, b: 1, x: 2, y: 3 }; }
  const NOMES_FIXOS = { 4: 'lb', 5: 'rb', 6: 'lt', 7: 'rt', 8: 'voltar', 9: 'start', 10: 'l3', 11: 'r3', 12: 'cima', 13: 'baixo', 14: 'esq', 15: 'dir', 16: 'home' };
  // (1.0.2) os nomes dos botões apertados agora num controle (os mesmos que a navegação usa): para gravar atalhos e combos
  A.pad.nomesDe = (g) => {
    const n = A.controles.normalizar(g), f = facesDe(A.controles.layoutDe(g)), nomes = {}, out = new Set();
    nomes[f.a] = 'a'; nomes[f.b] = 'b'; nomes[f.x] = 'x'; nomes[f.y] = 'y';
    for (let i = 0; i < 17; i++) if (n.b & (1 << i)) { const nm = nomes[i] || NOMES_FIXOS[i]; if (nm) out.add(nm); }
    return out;
  };
  // (1.0.2) atalhos e combos do controle (Controles > Atalhos): um botão ou vários juntos fazem o que a pessoa escolheu. O combo mais
  // longo vence (LB+Y não dispara também o atalho do Y); o atalho troca o que aquele botão fazia. Fica só neste aparelho
  const ACOES_PAD = {
    config: [() => A.evt.emit('abrir-aba', 'config')],
    talk: [() => A.evt.emit('abrir-aba', 'talk')],
    conexoes: [() => A.evt.emit('abrir-aba', 'conexoes')],
    integ: [() => A.evt.emit('abrir-aba', 'integ')],
    ligar: [() => { const TK = A.talk, c = TK && (TK.conversas || []).find((x) => x.id === TK.aberta); if (c) TK.ligar(c, false).catch((e) => A.ui.toast(e.message, { tipo: 'erro' })); else A.ui.toast(A.T('Abra uma conversa para ligar.', 'Open a chat to call.')); }],
    video: [() => { const TK = A.talk, c = TK && (TK.conversas || []).find((x) => x.id === TK.aberta); if (c) TK.ligar(c, true).catch((e) => A.ui.toast(e.message, { tipo: 'erro' })); }],
    desligar: [() => { if (A.chamada && A.chamada.ativa) A.chamada.desligar(); }],
    mudo: [() => { if (A.chamada && A.chamada.ativa) A.chamada.mudo(); }],
    camera: [() => { if (A.chamada && A.chamada.ativa) A.chamada.camera(); }],
    tela: [() => { if (A.chamada && A.chamada.ativa) A.chamada.tela(); }],
    teclado: [() => { if (A.tecladoVirtual) A.tecladoVirtual.abrir(); }],
    prox: [() => A.evt.emit('pad:rb')], ant: [() => A.evt.emit('pad:lb')],
    voltar: [() => { if (A.ui.voltar) A.ui.voltar(); }],
    cursor: [() => cursorLigar(!cur.on)],
  };
  A.pad.ACOES = ACOES_PAD;
  A.pad.atalhos = () => (Array.isArray(A.cfg.v.padAtalhos) ? A.cfg.v.padAtalhos : []).filter((x) => x && ACOES_PAD[x.acao] && Array.isArray(x.b) && x.b.length);
  const atalhoAgora = (ativos, antes) => {
    const l = A.pad.atalhos(); if (!l.length || !ativos.size) return null;
    let melhor = null;
    for (const x of l) if (x.b.every((b) => ativos.has(b)) && x.b.some((b) => !antes.has(b)) && (!melhor || x.b.length > melhor.b.length)) melhor = x;
    return melhor;
  };

  function aoBotao(nome) {
    document.documentElement.dataset.entrada = 'pad';
    if (ajudaEl) { fecharAjuda(); return; } // a ajuda aberta: qualquer botão só fecha ela
    A.evt.emit('pad:' + nome);
    if (A.pad.captura && A.pad.captura(nome)) return; // (1.0.2) quem está na frente (ex.: a imagem aberta) pode pegar o botão
    if (nome === 'cima' || nome === 'baixo' || nome === 'esq' || nome === 'dir') A.pad.mover(nome);
    else if (nome === 'a') confirmar();
    else if (nome === 'b') { const menu = document.querySelector('.menu-ctx:not(.estourando)'), mini = document.querySelector('.mini-perfil:not(.fechando)'); if (menu && A.ui._menu) A.ui._menu.fechar(); else if (mini && A.perfil) A.perfil.fecharMini(); else voltar(); }
    else if (nome === 'x') abrirMenuDoFoco();
    else if (fora()) { // (1.0.0) fora da sala (lá esses botões já têm função)
      if (nome === 'rt' || nome === 'lt') pularArea(nome === 'rt' ? 1 : -1);
      else if (nome === 'y') buscar();
      else if (nome === 'home') cursorLigar(true);
    }
  }
  const fora = () => !document.querySelector('.tela.ativa.sala') && !(A.entrada && A.entrada.lock);
  // (0.5.9-7) X no controle = o "botão direito" do item selecionado (pessoa, conversa, bolha de conexão...): abre o mesmo menu, com FIXAR,
  // Perfil, Mensagem, Copiar ID etc. Na sala o X continua com a função de lá.
  function abrirMenuDoFoco() {
    const e = document.activeElement; if (!e || e === document.body || !e.closest('[data-menu]')) return;
    const alvo = e.closest('[data-menu]'), r = alvo.getBoundingClientRect();
    alvo.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(r.left + Math.min(r.width - 10, 60)), clientY: Math.round(r.top + r.height / 2) }));
  }

  function loop() {
    cancelAnimationFrame(raf); clearTimeout(espera); espera = 0;
    ultimoT = performance.now();
    const passo = (agora) => {
      const pads = lerPads();
      if (!pads.length) { raf = 0; return; }
      const dt = Math.min(0.05, (agora - ultimoT) / 1000); ultimoT = agora;
      // app em segundo plano (outra janela na frente, minimizado): o controle é de outro programa; esquece o que estava apertado
      // (1.0.2) sem foco (no jogo), só confere 4 vezes por segundo se o Aero voltou para a frente (antes rodava no ritmo da tela, 120x/s)
      if (!A.focado()) { estado.clear(); raf = 0; clearTimeout(espera); espera = setTimeout(() => { espera = 0; ultimoT = performance.now(); raf = requestAnimationFrame(passo); }, 250); return; }
      for (const g of pads) {
        const st = estado.get(g.index) || { ativos: new Set(), rep: {} };
        estado.set(g.index, st);
        // cadeado ligado: o controle é do jogo. Ao sair, o que ainda estiver apertado (ex.: START+SELECT+RB) só vale depois de soltar tudo.
        if (bloqueado()) { st.ativos = new Set(); st.espera = true; st.holdA = 0; continue; }
        const n = A.controles.normalizar(g), lay = A.controles.layoutDe(g), f = facesDe(lay);
        const ativos = new Set();
        const nomes = {}; nomes[f.a] = 'a'; nomes[f.b] = 'b'; nomes[f.x] = 'x'; nomes[f.y] = 'y';
        for (let i = 0; i < 17; i++) if (n.b & (1 << i)) { const nm = nomes[i] || NOMES_FIXOS[i]; if (nm) ativos.add(nm); }
        // analógico esquerdo vira direcional
        if (n.a[0] > 0.6) ativos.add('dir'); if (n.a[0] < -0.6) ativos.add('esq'); if (n.a[1] > 0.6) ativos.add('baixo'); if (n.a[1] < -0.6) ativos.add('cima');
        // Remapeando ou calibrando: o app não enxerga o controle (nada se move, nada confirma, nada volta). Quando termina, o botão que acabou
        // de ser usado ainda está apertado: só volta a valer depois de soltar tudo (senão o mesmo aperto confirmaria algo sem querer).
        if (A.pad.captura) { st.ativos = ativos; st.espera = true; continue; }
        if (st.espera) { st.ativos = ativos; if (ativos.size === 0) st.espera = false; continue; }
        // Tela de Controles (remapear/testar): é usada só com teclado e mouse. O controle NÃO mexe em nada da interface;
        // a única saída por ele é SEGURAR A por 1 segundo.
        if (telaControles()) {
          if (ativos.has('a')) {
            if (!st.holdA) st.holdA = agora;
            const prog = Math.min(1, (agora - st.holdA) / 1000); A.pad.progressoSaida = prog; A.evt.emit('pad:segurar-a', prog); // (0.6.0) 1 s (era 2)
            if (prog >= 1) { st.holdA = 0; st.espera = true; A.pad.progressoSaida = 0; A.evt.emit('pad:segurar-a', 0); if (A.ui.voltar) A.ui.voltar(); }
          } else if (st.holdA) { st.holdA = 0; A.pad.progressoSaida = 0; A.evt.emit('pad:segurar-a', 0); }
          st.ativos = ativos; continue;
        }
        // (0.6.0) SELECT + Y abre o teclado virtual de bolhas; SELECT + B fecha. Com ele aberto, os botões são dele (teclado.js)
        const tv = A.tecladoVirtual;
        if (tv && ativos.has('voltar') && ((ativos.has('y') && !st.ativos.has('y')) || (ativos.has('b') && !st.ativos.has('b')))) {
          st.selSo = false; st.ativos = ativos;
          if (ativos.has('y')) tv.abrir(); else tv.fechar();
          continue;
        }
        if (tv && tv.aberto()) {
          for (const nome of ativos) {
            const direcao = nome === 'cima' || nome === 'baixo' || nome === 'esq' || nome === 'dir';
            if (!st.ativos.has(nome)) { st.rep[nome] = agora + 380; tv.botao(nome); }
            else if ((direcao || nome === 'x') && agora >= st.rep[nome]) { st.rep[nome] = agora + 110; tv.botao(nome); }
          }
          st.ativos = ativos; continue;
        }
        // START + SELECT + RB: liga/desliga o cadeado (o controle vai para o jogo / volta para a interface)
        const combo = ativos.has('start') && ativos.has('voltar') && ativos.has('rb');
        if (combo && !st.combo) { st.combo = true; st.ativos = ativos; st.espera = true; A.evt.emit('pad:combo-cadeado'); continue; }
        if (!combo) st.combo = false;
        { const at = atalhoAgora(ativos, st.ativos); if (at) { st.ativos = ativos; st.espera = true; try { ACOES_PAD[at.acao][0](); } catch (e) { A.log && A.log.aviso && A.log.aviso('atalho do controle', e); } continue; } }
        // START com a janelinha (picture in picture) aberta fora da sala: volta para a sala em tela grande
        if (ativos.has('start') && !st.ativos.has('start') && !ativos.has('voltar') && A.ui.pip && A.ui.pip.visivel && !(A.ui.telaAtual() && A.ui.telaAtual().nome === 'sala')) { st.ativos = ativos; A.ui.pip.voltar(); continue; }
        // SELECT sozinho (apertou e soltou sem apertar mais nada): evento próprio; assim o combo START+SELECT+RB não dispara isso
        if (ativos.has('voltar') && !st.ativos.has('voltar')) st.selSo = true;
        if (st.selSo && [...ativos].some((n) => n !== 'voltar' && !st.ativos.has(n))) st.selSo = false;
        if (!ativos.has('voltar') && st.ativos.has('voltar') && st.selSo) { st.selSo = false; A.evt.emit('pad:select'); }
        if (cur.on) {
          document.documentElement.dataset.entrada = 'pad';
          if (cursorQuadro(st, ativos, n, dt) !== 'dpad') { st.ativos = ativos; if (ativos.size && A.ui.atividade) A.ui.atividade(); continue; }
        }
        for (const nome of ativos) {
          const direcao = nome === 'cima' || nome === 'baixo' || nome === 'esq' || nome === 'dir';
          if (!st.ativos.has(nome)) { st.rep[nome] = agora + 380; aoBotao(nome); }
          else if (direcao && agora >= st.rep[nome]) { st.rep[nome] = agora + 110; aoBotao(nome); } // segurar repete
        }
        st.ativos = ativos;
        // analógico direito rola a área
        const ry = n.a[3], rx = n.a[2];
        if (Math.abs(ry) > 0.05 || Math.abs(rx) > 0.05) {
          document.documentElement.dataset.entrada = 'pad';
          const r = rolavel(document.activeElement && document.activeElement !== document.body ? document.activeElement : null);
          if (r) { r.scrollTop += ry * 1100 * dt; r.scrollLeft += rx * 1100 * dt; seguirRolagem(r, agora); }
        }
        // legenda acompanha o controle que está sendo usado
        if (ativos.size && A.ui.atividade) A.ui.atividade(); // (0.8.3) o controle também conta como "usando o app"
        if (ativos.size && A.pad._ultimoLayout !== lay) { A.pad._ultimoLayout = lay; atualizarLegenda(); }
      }
      vigiarFoco(agora);
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  }

  // ---------- (1.0.0) dicas espalhadas pela tela ----------
  // Junto do item selecionado: A (o que ele faz), X (opções, se tiver) e B. Nas pontas da barra de abas: LB e RB. No campo de busca: Y.
  // Nos cantos da área em que você está: LT e RT. Na barra de rolagem: RS. SELECT (View) abre a ajuda com todos os botões.
  let dicaEl = null, marcasEl = null, ajudaEl = null, dicasRaf = 0, ajudaFechou = 0;
  const layAtual = () => A.pad._ultimoLayout || (lerPads()[0] ? A.controles.layoutDe(lerPads()[0]) : A.controles.LAYOUTS.xbox);
  function pedirDicas() { if (!dicasRaf) dicasRaf = requestAnimationFrame(() => { dicasRaf = 0; pintarDicas(); }); }
  const par = (botao, texto, lay) => h('span', { class: 'it' }, glifo(botao, lay), texto ? h('span', { class: 'tx' }, texto) : null);
  // (1.0.2) as marcas (LB, RB, Y, LT, RT, RS) e a dica do item são REAPROVEITADAS: antes eram apagadas e feitas de novo a cada passo do
  // direcional (e a cada rolagem), e todas piscavam com a animação de entrada. Agora uma marca só aparece quando o botão passa a valer ali
  // e some quando deixa de valer; no resto ela só desliza para o lugar novo
  const marcasVivas = new Map(); let marcasUsadas = null;
  function marca(botao, x, y, lay, texto) {
    const chave = botao + '|' + (texto || '') + '|' + (lay.familia || '') + (lay.confirmar || 0);
    let m = marcasVivas.get(chave);
    if (!m) { m = h('span', { class: 'marca-pad' + (texto ? ' com-tx' : '') }, glifo(botao, lay), texto ? h('span', { class: 'tx' }, texto) : null); marcasEl.append(m); marcasVivas.set(chave, m); m._wh = null; }
    if (marcasUsadas) marcasUsadas.add(chave);
    if (!m._wh) m._wh = [m.offsetWidth / 2 + 4, m.offsetHeight / 2 + 4]; // nunca sai da tela
    const l = Math.round(A.limitar(x, m._wh[0], innerWidth - m._wh[0])) + 'px', t = Math.round(A.limitar(y, m._wh[1], innerHeight - m._wh[1])) + 'px';
    if (m.style.left !== l) m.style.left = l; if (m.style.top !== t) m.style.top = t;
    return m;
  }
  function limparMarcas(todas) { for (const [k, m] of marcasVivas) if (todas || !marcasUsadas || !marcasUsadas.has(k)) { m.remove(); marcasVivas.delete(k); } }
  // a dica junto do item: só refaz o conteúdo quando os botões ou os textos mudam
  function dicaCom(lay, pares) {
    const sig = pares.map((p) => p.join(':')).join('|') + '|' + (lay.familia || '') + (lay.confirmar || 0);
    if (dicaEl._sig !== sig) { dicaEl._sig = sig; dicaEl.textContent = ''; dicaEl.append(...pares.map(([b, t]) => par(b, t, lay))); }
  }
  function pintarDicas() {
    if (!dicaEl) return;
    const raiz = document.documentElement;
    const ligado = raiz.dataset.entrada === 'pad' && !bloqueado() && raiz.dataset.lock !== '1' && !usaBarra() && !(A.tecladoVirtual && A.tecladoVirtual.aberto()) && !A.pad.captura;
    if (!ligado) { dicaEl.classList.remove('on'); limparMarcas(true); return; }
    const lay = layAtual();
    dicaEl.classList.toggle('segue', cur.on); // com a bolinha, a dica anda colada nela (sem deslizar atrás)
    if (cur.on) { // bolinha: a dica anda junto com ela
      limparMarcas(true);
      dicaCom(lay, [['a', T('Clicar', 'Click')], ['x', T('Botão direito', 'Right click')], ['b', T('Sair', 'Exit')]]);
      dicaEl.classList.add('on'); colocar(dicaEl, { left: cur.x - 2, right: cur.x + 2, top: cur.y - 2, bottom: cur.y + 2, width: 4, height: 4 }, false);
      return;
    }
    marcasUsadas = new Set();
    try { pintarDicasItem(lay); } finally { limparMarcas(false); marcasUsadas = null; }
  }
  function pintarDicasItem(lay) {
    const at = document.activeElement;
    const temFoco = at && at !== document.body && at.getBoundingClientRect && candidatos().includes(at);
    if (temFoco) {
      const z = zonaDe(at), modal = !!document.querySelector('#modais .fundo-modal:not(.fechando)');
      const verbo = ehTexto(at) ? null : at.type === 'range' ? T('Ajustar', 'Adjust') : at.tagName === 'SELECT' ? T('Mudar', 'Change') : z && z.dataset.zonaConfirmar && !modal ? T('Entrar', 'Enter') : T('Confirmar', 'Confirm');
      const pares = [];
      if (verbo) pares.push(['a', verbo]);
      if (ehTexto(at)) pares.push(['y', T('Teclado', 'Keyboard')]);
      if (at.closest('[data-menu]')) pares.push(['x', T('Opções', 'Options')]);
      pares.push(['b', z && z.dataset.zonaVoltar && !modal ? T('Abas', 'Tabs') : T('Voltar', 'Back')]);
      pares.push(['voltar', T('Ajuda', 'Help')]); // (1.0.2) era só "?" ao lado do nome do botão ("View ?"): ninguém entendia
      dicaCom(lay, pares);
      const surgiu = !dicaEl.classList.contains('on'); // aparecendo agora: nasce já no lugar (só desliza de um item para outro)
      if (surgiu) dicaEl.classList.add('segue');
      dicaEl.classList.add('on'); colocar(dicaEl, at.getBoundingClientRect(), true);
      if (surgiu) { void dicaEl.offsetWidth; dicaEl.classList.remove('segue'); }
    } else dicaEl.classList.remove('on');
    if (!baseLivre()) return;
    const tela = document.querySelector('.tela.ativa');
    // LB / RB nas pontas da barra de abas (no carrossel, em cima das setinhas)
    const abas = tela && tela.classList.contains('home') ? tela.querySelector('.topo .abas') : null;
    if (abas && visivel(abas.querySelector('.aba') || abas)) {
      const se = abas.querySelector('.car-seta-e'), sd = abas.querySelector('.car-seta-d'), ra = abas.getBoundingClientRect();
      const ce = se && se.offsetParent ? centro(se) : { x: ra.left + 4, y: ra.top + 4 }, cd = sd && sd.offsetParent ? centro(sd) : { x: ra.right - 4, y: ra.top + 4 };
      marca('lb', ce.x, ce.y, lay); marca('rb', cd.x, cd.y, lay);
    }
    // Y dentro da ponta direita do campo de busca
    const cb = campoBusca();
    if (cb && cb !== at && naTela(cb)) { const r = cb.getBoundingClientRect(); marca('y', r.right - 18, r.top + r.height / 2, lay); }
    // LT / RT nos cantos de cima da área atual (só quando há mais de uma)
    const area = temFoco ? areaDe(at) : null;
    if (area && naTela(area)) {
      const r = area.getBoundingClientRect(), top = Math.max(10, r.top);
      const outras = tela && Array.from(tela.querySelectorAll(AREA)).some((x) => x !== area && !x.contains(area) && !area.contains(x) && naTela(x));
      if (outras) { marca('lt', Math.max(14, r.left), top, lay); marca('rt', Math.min(innerWidth - 14, r.right), top, lay); }
    }
    // RS na barra de rolagem do que rola em volta do foco
    const rr = temFoco ? rolavel(at) : null;
    if (rr && rr.contains(at)) { const r = rr.getBoundingClientRect(); if (r.height > 120) marca('rs', Math.min(innerWidth - 16, r.right - 6), r.top + Math.min(r.height / 2, 60), lay); }
  }
  // Coloca a dica sem cobrir o resto: dentro da ponta direita do item quando ele é largo (a conversa, a mensagem, o campo);
  // senão logo abaixo, acima, à direita ou à esquerda dele, onde couber na tela.
  function colocar(el, r, dentroOk) {
    const w = el.offsetWidth, hh = el.offsetHeight, m = 8, W = innerWidth, H = innerHeight;
    const cabe = (x, y) => x >= m && y >= m && x + w <= W - m && y + hh <= H - m;
    const op = [];
    if (dentroOk && r.width >= w + 40 && r.height >= hh + 6) op.push([r.right - w - 8, r.top + (r.height - hh) / 2]);
    op.push([r.right - w, r.bottom + 6], [r.left, r.bottom + 6], [r.right - w, r.top - hh - 6], [r.right + 8, r.top + (r.height - hh) / 2], [r.left - w - 8, r.top + (r.height - hh) / 2]);
    let p = op.find(([x, y]) => cabe(x, y)) || [A.limitar(r.right - w, m, W - w - m), A.limitar(r.bottom + 6, m, H - hh - m)];
    const l = Math.round(p[0]) + 'px', t = Math.round(p[1]) + 'px';
    if (el.style.left !== l) el.style.left = l; if (el.style.top !== t) el.style.top = t;
  }
  function abrirAjuda() {
    if (ajudaEl) return;
    const lay = layAtual();
    const l = [['dpad', T('Mover a seleção', 'Move the selection')], ['a', T('Confirmar', 'Confirm')], ['b', T('Voltar', 'Back')], ['x', T('Opções do item (botão direito)', 'Item options (right click)')],
      ['y', T('Buscar (num campo de texto: teclado)', 'Search (in a text field: keyboard)')], ['lb', T('Aba anterior', 'Previous tab')], ['rb', T('Próxima aba', 'Next tab')],
      ['lt', T('Área anterior do layout', 'Previous layout area')], ['rt', T('Próxima área do layout', 'Next layout area')], ['rs', T('Rolar (a seleção acompanha)', 'Scroll (the selection follows)')],
      ['home', T('Cursor na tela', 'On-screen cursor')], ['voltar', T('Esta ajuda', 'This help')]];
    ajudaEl = h('div', { id: 'ajuda-pad', class: 'vidro', 'aria-hidden': 'true' }, h('b', { class: 'ajuda-pad-tit' }, T('Controle', 'Controller')),
      h('div', { class: 'ajuda-pad-grade' }, ...l.map(([b, t]) => h('span', { class: 'it' }, glifo(b, lay), h('span', { class: 'tx' }, t)))),
      h('div', { class: 'peq suave' }, T('Aperte qualquer botão para fechar', 'Press any button to close')));
    document.body.append(ajudaEl); A.som.tocar('pop-abrir'); pedirDicas();
  }
  function fecharAjuda() { if (!ajudaEl) return; ajudaFechou = performance.now(); const e = ajudaEl; ajudaEl = null; e.classList.add('fechando'); setTimeout(() => e.remove(), 220); A.som.tocar('fechar'); }
  A.evt.on('pad:select', () => { if (performance.now() - ajudaFechou > 600 && fora() && !A.pad.captura && !telaControles()) abrirAjuda(); });
  function criarDicas() {
    dicaEl = h('div', { id: 'dica-pad', class: 'vidro', 'aria-hidden': 'true' }); marcasEl = h('div', { id: 'marcas-pad', 'aria-hidden': 'true' });
    document.body.append(marcasEl, dicaEl);
    document.addEventListener('scroll', pedirDicas, { capture: true, passive: true });
    addEventListener('resize', pedirDicas);
    document.addEventListener('focusin', pedirDicas); document.addEventListener('focusout', pedirDicas);
    new MutationObserver(pedirDicas).observe(document.documentElement, { attributes: true, attributeFilter: ['data-entrada', 'data-lock', 'data-tela'] });
  }

  // ---------- legendas na tela ----------
  let legendaEl = null, extras = null;
  // Cada tela pode dizer o que os botões fazem ali: [{ botao: 'x', texto: 'Barra' }, ...]
  A.pad.legendas = (lista) => { extras = lista; atualizarLegenda(); };
  A.pad.atualizarLegenda = () => atualizarLegenda();
  function glifo(nome, lay) {
    const f = facesDe(lay), cor = lay.cor || [];
    const pos = { a: f.a, b: f.b, x: f.x, y: f.y };
    if (nome in pos) return h('span', { class: 'gl', estilo: { '--c': cor[pos[nome]] || '#9aa6b2' } }, lay.rot[pos[nome]]);
    const slot = { lb: 4, rb: 5, lt: 6, rt: 7, voltar: 8, start: 9, l3: 10, r3: 11 }[nome];
    // (1.0.2) no controle do tipo Xbox, View e Menu aparecem com o desenho do botão (as duas janelinhas e as três linhas), não com o nome
    if (lay.familia === 'xbox' && (slot === 8 || slot === 9)) return h('span', { class: 'gl largo gl-desenho', title: lay.rot[slot] }, slot === 8 ? '⧉' : '☰');
    if (slot !== undefined) return h('span', { class: 'gl largo' }, lay.rot[slot]);
    if (nome === 'texto') return null;
    if (nome === 'combo') return h('span', { class: 'gl-combo' }, glifo('start', lay), '+', glifo('voltar', lay), '+', glifo('rb', lay));
    if (nome === 'rs') return h('span', { class: 'gl largo' }, 'RS');
    if (nome === 'ls') return h('span', { class: 'gl largo' }, 'LS');
    if (nome === 'home') return h('span', { class: 'gl largo' }, 'Home');
    if (nome === 'dpad') return h('span', { class: 'gl largo' }, '✥');
    return h('span', { class: 'gl' }, '?');
  }
  function itens() {
    const emSlider = ajuste || (document.activeElement && document.activeElement.type === 'range');
    const modal = document.querySelector('#modais .fundo-modal:not(.fechando)');
    const tela = document.querySelector('.tela.ativa');
    const lista = [];
    if (A.pad.captura) return [{ botao: 'texto', texto: T('Aperte o botão do controle · Esc cancela', 'Press the controller button · Esc cancels') }];
    if (telaControles()) { const p = A.pad.progressoSaida || 0; return [{ botao: 'a', texto: p > 0 ? T('Voltando... ', 'Going back... ') + Math.round(p * 100) + '%' : T('Segure 1 s para voltar (esta tela usa teclado e mouse)', 'Hold 1 s to go back (this screen uses keyboard and mouse)') }]; }
    if (cur.on) return [];
    if (ajuste) lista.push({ botao: 'dpad', texto: T('Ajustar', 'Adjust') }, { botao: 'a', texto: T('Pronto', 'Done') }, { botao: 'b', texto: T('Pronto', 'Done') });
    else {
      lista.push({ botao: 'dpad', texto: T('Mover', 'Move') }, { botao: 'a', texto: emSlider ? T('Ajustar', 'Adjust') : T('Confirmar', 'Confirm') }, { botao: 'b', texto: T('Voltar', 'Back') });
      if (!modal) {
        const z = zonaDe(document.activeElement);
        if (z && z.dataset.zonaConfirmar) lista[1] = { botao: 'a', texto: T('Entrar na aba', 'Open tab') };
        if (z && z.dataset.zonaVoltar) lista[2] = { botao: 'b', texto: T('Voltar às abas', 'Back to tabs') };
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-menu]') && !(tela && tela.classList.contains('sala'))) lista.push({ botao: 'x', texto: T('Opções', 'Options') });
        if (extras) extras.forEach((e) => lista.push(e));
        else if (tela && tela.classList.contains('home')) lista.push({ botao: 'lb', texto: '' }, { botao: 'rb', texto: T('Trocar de aba', 'Switch tab') });
        if (A.ui.pip && A.ui.pip.visivel && !(tela && tela.classList.contains('sala'))) lista.push({ botao: 'start', texto: T('Voltar à sala', 'Back to room') });
        const ctl = A.sala && A.sala.ativa && A.sala.meuCtl && A.sala.meuCtl();
        if (ctl && ctl.st === 'ativo') lista.push({ botao: 'combo', texto: T('Cadeado (controle no jogo)', 'Lock (controller to game)') });
      }
      lista.push({ botao: 'rs', texto: T('Rolar', 'Scroll') });
    }
    return lista;
  }
  // (1.0.0) a barra de legenda embaixo fica só na sala, na tela de Controles e no ajuste de slider. No resto do app, as dicas ficam
  // espalhadas pela tela, onde cada ação acontece (dicas.js do controle, logo abaixo): no item selecionado, nas abas, na busca, na área.
  const usaBarra = () => !!(A.pad.captura || telaControles() || ajuste || document.querySelector('.tela.ativa.sala'));
  function atualizarLegenda() {
    pedirDicas();
    if (!legendaEl) return;
    legendaEl.classList.toggle('barra', usaBarra());
    const lay = A.pad._ultimoLayout || (lerPads()[0] ? A.controles.layoutDe(lerPads()[0]) : A.controles.LAYOUTS.xbox);
    legendaEl.textContent = '';
    for (const it of itens()) {
      const par = h('span', { class: 'it' }, glifo(it.botao, lay), it.texto ? h('span', { class: 'tx' }, it.texto) : null);
      legendaEl.append(par);
    }
  }
  function criarLegenda() {
    criarDicas();
    legendaEl = h('div', { id: 'legenda-pad', class: 'vidro', 'aria-hidden': 'true' });
    document.body.append(legendaEl);
    atualizarLegenda();
    A.evt.on('tela', () => setTimeout(atualizarLegenda, 60));
    A.evt.on('idioma', atualizarLegenda);
    A.evt.on('pad:segurar-a', atualizarLegenda);
    A.evt.on('tela', (nome) => { document.documentElement.dataset.tela = nome; });
    document.addEventListener('focusout', (e) => { if (ajuste && ajuste === e.target) { ajuste.classList.remove('ajustando'); ajuste = null; atualizarLegenda(); } });
    document.addEventListener('focusin', () => { if (document.documentElement.dataset.entrada === 'pad') atualizarLegenda(); });
    new MutationObserver(() => atualizarLegenda()).observe(document.getElementById('modais'), { childList: true });
    // janelinha das setinhas: aberta pelo controle, o foco já entra nela (senão o controle não alcançaria nada lá dentro)
    let raiz = document.getElementById('popovers');
    if (!raiz) { raiz = h('div', { id: 'popovers' }); document.body.append(raiz); }
    new MutationObserver(() => {
      atualizarLegenda();
      if (document.documentElement.dataset.entrada !== 'pad' || !popoverAberto()) return;
      setTimeout(() => { const p = popoverAberto(); if (!p || p.contains(document.activeElement)) return; const primeiro = Array.from(p.querySelectorAll(FOCAVEL)).filter(visivel)[0]; if (primeiro) foco(primeiro, false); }, 80);
    }).observe(raiz, { childList: true });
  }
})();
