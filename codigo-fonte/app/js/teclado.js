// Aero Stream - teclado virtual de bolhas para o controle (0.6.0). Criado por Ryan Victtor.
// SELECT + Y abre (escreve no campo que estava selecionado, ou no último campo de texto usado) e SELECT + B (ou B) fecha.
// Direcional/analógico move entre as bolhas, A aperta, X apaga, Y dá espaço, START envia (Enter), LB troca maiúsculas e RB os símbolos.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const LETRAS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm,.?'];
  const SIMBOLOS = ['1234567890', '@#$%&*-+()', '!"\':;/_=~^'];
  let el = null, alvo = null, lin = 0, col = 0, maius = false, simb = false, teclas = [];
  let ultimoCampo = null;
  document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=file]):not([type=color]), textarea')) ultimoCampo = e.target; });

  const linhas = () => {
    const base = (simb ? SIMBOLOS : LETRAS).map((l) => [...l].map((c) => ({ t: maius && !simb ? c.toUpperCase() : c })));
    base.push([{ t: maius ? '⇩' : '⇧', acao: 'maius', larga: true }, { t: simb ? 'abc' : '123', acao: 'simb', larga: true }, { t: T('espaço', 'space'), acao: 'espaco', maior: true }, { t: '⌫', acao: 'apagar', larga: true }, { t: '↵', acao: 'enter', larga: true }, { t: '✕', acao: 'fechar' }]);
    return base;
  };
  function pintar() {
    if (!el) return;
    const grade = el.querySelector('.tv-grade'); grade.textContent = ''; teclas = [];
    let i = 0;
    linhas().forEach((linha, li) => {
      const row = h('div', { class: 'tv-linha' });
      teclas.push(linha.map((k, ci) => {
        const b = h('button', { type: 'button', class: 'tv-tecla' + (k.larga ? ' larga' : '') + (k.maior ? ' maior' : '') + (k.acao ? ' acao' : ''), tabindex: '-1', estilo: { '--i': i++ }, onpointerdown: (e) => { e.preventDefault(); lin = li; col = ci; apertar(); } }, k.t);
        b.tecla = k; row.append(b); return b;
      }));
      grade.append(row);
    });
    lin = Math.min(lin, teclas.length - 1); col = Math.min(col, teclas[lin].length - 1);
    marcar();
  }
  function marcar() { el.querySelectorAll('.tv-tecla.foco').forEach((b) => b.classList.remove('foco')); const b = teclas[lin] && teclas[lin][col]; if (b) b.classList.add('foco'); }
  function escrever(txt) {
    if (!alvo || !alvo.isConnected) return;
    const a = alvo.selectionStart ?? alvo.value.length, b = alvo.selectionEnd ?? alvo.value.length;
    alvo.value = alvo.value.slice(0, a) + txt + alvo.value.slice(b);
    const p = a + txt.length; try { alvo.setSelectionRange(p, p); } catch (e) { /* ok */ }
    alvo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function apagar() {
    if (!alvo || !alvo.isConnected) return;
    const a = alvo.selectionStart ?? alvo.value.length, b = alvo.selectionEnd ?? alvo.value.length;
    const ini = a === b ? Math.max(0, a - 1) : a;
    alvo.value = alvo.value.slice(0, ini) + alvo.value.slice(b); try { alvo.setSelectionRange(ini, ini); } catch (e) { /* ok */ }
    alvo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function pop(b) { if (!b) return; b.classList.remove('apertou'); void b.offsetWidth; b.classList.add('apertou'); }
  function apertar() {
    const b = teclas[lin] && teclas[lin][col]; if (!b) return;
    const k = b.tecla; pop(b); A.som.tocar('menu-item');
    if (!k.acao) { escrever(k.t); if (maius && !simb) { maius = false; pintar(); } return; }
    if (k.acao === 'maius') { maius = !maius; pintar(); }
    else if (k.acao === 'simb') { simb = !simb; pintar(); }
    else if (k.acao === 'espaco') escrever(' ');
    else if (k.acao === 'apagar') apagar();
    else if (k.acao === 'enter') enter();
    else if (k.acao === 'fechar') fechar();
  }
  function enter() { if (!alvo) return; alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); if (alvo.form && alvo.form.requestSubmit) { /* formulários do app não usam submit */ } }
  function mover(d) {
    if (d === 'cima' || d === 'baixo') {
      const ant = teclas[lin][col], cx = ant.getBoundingClientRect().left + ant.offsetWidth / 2;
      lin = (lin + (d === 'baixo' ? 1 : -1) + teclas.length) % teclas.length;
      let melhor = 0, dist = Infinity; teclas[lin].forEach((b, i) => { const r = b.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - cx); if (dd < dist) { dist = dd; melhor = i; } }); col = melhor;
    } else col = (col + (d === 'dir' ? 1 : -1) + teclas[lin].length) % teclas[lin].length;
    marcar(); A.som.tocar('foco');
  }
  let veu = null;
  function abrir(campo) {
    alvo = campo || (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea') ? document.activeElement : ultimoCampo);
    if (!alvo || !alvo.isConnected) { A.ui.toast(T('Selecione um campo de texto primeiro.', 'Select a text field first.'), { ms: 2200 }); alvo = null; return; }
    if (el) return;
    lin = 0; col = 0; maius = false; simb = false;
    el = h('div', { class: 'tv vidro', role: 'dialog', 'aria-label': T('Teclado virtual', 'Virtual keyboard') },
      h('div', { class: 'tv-dica peq suave' }, T('A digita · X apaga · Y espaço · START envia · LB maiúsculas · RB símbolos · B fecha', 'A types · X deletes · Y space · START sends · LB caps · RB symbols · B closes')),
      h('div', { class: 'tv-grade' }));
    // (1.0.2) o fundo esmaece um pouco enquanto o teclado está aberto (só um véu por cima: não pega clique nem muda nada embaixo)
    if (veu) veu.remove(); veu = h('div', { class: 'tv-veu', 'aria-hidden': 'true' }); document.body.append(veu);
    document.body.append(el); pintar(); A.som.tocar('bolha-cresce'); A.evt.emit('teclado', true);
    try { alvo.focus({ preventScroll: true }); alvo.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ok */ }
    posicionar(); addEventListener('resize', posicionar);
    if (A.pad && A.pad.atualizarLegenda) A.pad.atualizarLegenda(); // as dicas do controle somem enquanto o teclado está aberto
  }
  // (1.0.0) o teclado nunca cobre o campo em que se está escrevendo: fica logo acima dele, ou abaixo, ou no lado da tela oposto
  function posicionar() {
    if (!el || !alvo || !alvo.isConnected) return;
    const r = alvo.getBoundingClientRect(), hT = el.offsetHeight, m = 10, vh = innerHeight;
    el.style.top = el.style.bottom = '';
    if (r.top - m >= hT + 8) el.style.bottom = (vh - r.top + m) + 'px'; // cabe acima do campo
    else if (vh - r.bottom - m >= hT + 8) el.style.top = (r.bottom + m) + 'px'; // cabe abaixo
    else if (r.top + r.height / 2 > vh / 2) el.style.top = '8px'; else el.style.bottom = '8px';
  }
  function fechar() { if (!el) return; removeEventListener('resize', posicionar); const e = el; el = null; e.classList.add('fechando'); if (veu) { const v = veu; veu = null; v.classList.add('fechando'); setTimeout(() => v.remove(), 260); } A.evt.emit('teclado', false); A.som.tocar('bolha-estoura'); setTimeout(() => e.remove(), 260); if (A.pad && A.pad.atualizarLegenda) A.pad.atualizarLegenda(); }
  // o controle, enquanto o teclado está aberto (nav.js chama isto antes do resto)
  function botao(nome) {
    if (!el) return false;
    if (['cima', 'baixo', 'esq', 'dir'].includes(nome)) mover(nome);
    else if (nome === 'a') apertar();
    else if (nome === 'x') { apagar(); pop(el.querySelector('.tv-tecla.acao:nth-child(4)')); A.som.tocar('menu-item'); }
    else if (nome === 'y') { escrever(' '); A.som.tocar('menu-item'); }
    else if (nome === 'start') enter();
    else if (nome === 'lb') { maius = !maius; pintar(); }
    else if (nome === 'rb') { simb = !simb; pintar(); }
    else if (nome === 'b') fechar();
    return true;
  }
  A.tecladoVirtual = { abrir, fechar, botao, aberto: () => !!el, alternar: () => (el ? fechar() : abrir()) };
})();
